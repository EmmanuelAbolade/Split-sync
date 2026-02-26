// functions/index.js
// Cloud Functions: scanReceipt (Google Vision OCR) + splitSyncChat (Anthropic AI chatbot proxy)

const functions = require('firebase-functions/v2');
const admin      = require('firebase-admin');
const vision     = require('@google-cloud/vision');
const https      = require('https');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const googleVisionApiKey = defineSecret('GOOGLE_VISION_API_KEY');
const anthropicApiKey    = defineSecret('ANTHROPIC_API_KEY');

// ─── scanReceipt — Google Cloud Vision OCR ────────────────────────────────────

exports.scanReceipt = functions.https.onCall(
  { secrets: [googleVisionApiKey] },
  async (request) => {

    const data = request.data;

    if (!data || !data.imageData) {
      console.error('No image data received!');
      throw new functions.https.HttpsError('invalid-argument', 'Image data is required.');
    }

    try {

      // Initialize Vision API client
      const client = new vision.ImageAnnotatorClient({
        apiKey: googleVisionApiKey.value(),
      });

      // Perform text detection
      const [result] = await client.textDetection({
        image: { content: data.imageData },
      });

      const detections = result.textAnnotations;
      const fullText   = detections[0]?.description || '';

      // Parse the text
      const lines = fullText.split('\n').filter(l => l.trim());

      // Extract merchant (first meaningful line)
      let merchantName = 'Receipt';
      for (const line of lines.slice(0, 10)) {
        if (line.length >= 3 && /[a-zA-Z]/.test(line)) {
          merchantName = line.trim();
          break;
        }
      }

      // Extract amount
      let amount = '';
      const amountPatterns = [
        /total[:\s]*[€$£]?\s*(\d+[.,]\d{2})/i,
        /amount[:\s]*[€$£]?\s*(\d+[.,]\d{2})/i,
      ];

      for (const pattern of amountPatterns) {
        const match = fullText.match(pattern);
        if (match) {
          amount = match[1].replace(',', '.');
          break;
        }
      }

      if (!amount) {
        const decimals = fullText.match(/\d+[.,]\d{2}/g) || [];
        const amounts  = decimals.map(d => parseFloat(d.replace(',', '.'))).filter(a => a > 0);
        if (amounts.length > 0) {
          amount = Math.max(...amounts).toFixed(2);
        }
      }

      // Extract date
      let date = new Date().toISOString().split('T')[0];
      const dateMatch = fullText.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        date = `${year}-${month}-${day}`;
      }

      return {
        success: true,
        data: {
          title:  merchantName.substring(0, 50),
          amount: amount || '',
          date:   date,
        },
      };

    } catch (error) {
      console.error('scanReceipt error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ─── splitSyncChat — Anthropic AI chatbot proxy ───────────────────────────────
// Keeps the Anthropic API key secure on the server side.
// Accepts: { messages: [{role, content}], userContext: { groupCount, totalBalance } }
// Returns: { reply: string }

exports.splitSyncChat = functions.https.onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {

    // Require authenticated user
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to use the assistant.'
      );
    }

    const { messages, userContext } = request.data || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Messages array is required.');
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Each message must have role and content.');
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Message role must be user or assistant.');
      }
    }

    // Limit to last 20 messages to control token usage
    const trimmedMessages = messages.slice(-20);

    // Build personalised system prompt
    const systemPrompt = `You are the Split-Sync assistant — a friendly, helpful support bot built into the Split-Sync expense-splitting app. Your role is to help users understand and use Split-Sync effectively.

About Split-Sync:
Split-Sync is a Progressive Web App (PWA) for splitting expenses and managing group finances. It supports multiple splitting methods, payment integrations, and real-time balance tracking.

Core features you can help with:
- Creating and managing groups (travel, household, events, etc.)
- Adding expenses and splitting them equally, by percentage, exact amounts, or shares
- Understanding balances — what you owe and what others owe you
- Settling up using PayPal, Revolut, or bank transfer (SEPA/IBAN)
- Scanning receipts with the camera to auto-fill expense details
- Setting up payment methods in your profile
- Using the Analytics page to see spending trends and charts
- Biometric authentication and security settings
- Auto-logout timer and session settings
- Inviting friends to groups via QR code or invite link
- Dark mode and appearance settings

${userContext ? `User context: The user currently has ${userContext.groupCount || 0} group(s).${userContext.totalBalance !== undefined ? ` Their net balance is \u20ac${userContext.totalBalance.toFixed(2)}.` : ''}` : ''}

Tone and style:
- Be concise, warm, and direct — no long-winded responses
- Use plain language, no jargon
- If a question is outside Split-Sync (e.g. general finance advice), politely redirect
- Never make up features that do not exist
- If unsure, say so and suggest the user check Settings or contact support

Keep replies short — ideally 2 to 4 sentences unless a step-by-step explanation is needed.

Formatting rules — always follow these:
- Never use markdown — no **bold**, no *italic*, no # headers
- For numbered steps, write them as plain text: "1. Do this  2. Then this" — each on its own line
- Never use bullet points with * or - symbols
- Write in plain conversational sentences only`;

    // Call Anthropic API via Node https module (no extra SDK needed in functions)
    const requestBody = JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 512,
      system:     systemPrompt,
      messages:   trimmedMessages,
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         anthropicApiKey.value(),
          'anthropic-version': '2023-06-01',
          'Content-Length':    Buffer.byteLength(requestBody),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end',  () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.error) {
              console.error('Anthropic API error:', parsed.error);
              reject(new functions.https.HttpsError('internal', parsed.error.message || 'AI error'));
              return;
            }
            const reply = parsed.content?.[0]?.text || 'Sorry, I could not generate a response.';
            resolve({ reply });
          } catch (err) {
            console.error('Parse error:', err);
            reject(new functions.https.HttpsError('internal', 'Failed to parse AI response.'));
          }
        });
      });

      req.on('error', (err) => {
        console.error('HTTPS request error:', err);
        reject(new functions.https.HttpsError('internal', 'Network error calling AI service.'));
      });

      req.write(requestBody);
      req.end();
    });
  }
);
