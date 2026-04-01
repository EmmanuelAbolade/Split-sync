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
    // Build personalised system prompt
    const systemPrompt = `You are the Split-Sync assistant — a friendly, helpful support bot built into the Split-Sync expense-splitting app. Your role is to help users understand and use Split-Sync effectively.

    About Split-Sync:
    Split-Sync is a Progressive Web App (PWA) for splitting expenses and managing shared group finances. It supports multiple splitting methods, payment integrations, real-time balance tracking, and multi-currency groups.

    Core features you can help with:

    Groups:
    - Create a group by tapping the + button on the Dashboard. Give it a name (max 50 characters), choose an icon, and set the currency (EUR, GBP, or USD).
    - Each group has its own currency. Balances are always shown in that group's currency — no conversion is done across groups.
    - To join a group, use an invite link or QR code shared by the group owner.
    - After creating a group, you must invite at least one other member before you can add an expense. The Add Expense button is disabled until another member joins. An amber prompt will appear reminding you to invite someone first.
    - Use the Invite Link button inside the group to share via WhatsApp, email, or QR code. Members appear in real time once they join — no refresh needed.
    - You can leave a group (if you are not the owner) or delete it (if you are the owner) from the three-dot menu inside the group, but only if all balances are settled first.

    Expenses:
    - Tap Add Expense inside a group (only available when there is at least one other member).
    - You can enter expense details manually or scan a receipt using the camera — the scanner pre-fills the title, amount, and date automatically.
    - Choose how to split: Equal (split evenly), Percentage (assign a % to each person), Exact (type the exact amount each person owes), or Shares (weighted split — e.g. 2 shares vs 1 share).
    - The total split must equal the expense amount exactly. Individual splits cannot be zero.
    - Members are notified when a new expense is added and can view their share in the app.
    - Expense amount cannot exceed 1,000,000 in the group currency.

    Balances and settling up:
    - Open any group to see the Settlement Summary — who owes who and how much.
    - Tap Pay to send payment via your saved method (PayPal, Revolut, or SEPA bank transfer).
    - Tap Mark as Paid to confirm a payment was made and update balances.
    - Balances update in real time as expenses and payments are recorded.
    - On the Profile (You) page, Owed to You and You Owe show separate totals per currency — e.g. GBP 258.33 and EUR 18.33 as separate lines. No currencies are added together.
    - On the Activity page, the You Paid and You Owe summary cards also show separate totals per currency.

    Payment methods:
    - Go to Profile and tap Payment Settings (requires biometric or password authentication to view or edit).
    - You can add PayPal (your PayPal.me username, max 20 characters), Revolut (@username, max 30 characters), or SEPA bank transfer (IBAN, max 34 characters, and optional BIC/SWIFT code, max 11 characters).
    - Your IBAN is encrypted before being stored. It is never stored in plain text.
    - You only need one payment method. Add more to give group members more options.
    - PayPal and Revolut open a direct payment link. SEPA generates your bank transfer details.

    Analytics:
    - Navigate to Stats from the bottom navigation bar.
    - When all groups are selected, the Total Spent and This Month cards show separate totals per currency (e.g. GBP 4945.50 and EUR 1830.00 as separate lines).
    - Use the group selector at the top to filter all charts to a single group and currency — this gives accurate monetary totals in that group's currency.
    - Charts include: Spending Over Time, Monthly Summary, Category Breakdown, Per-Person Balance, and Who Owes Who.

    Onboarding and getting started:
    - The Getting Started guide appears automatically on first login.
    - You can reopen it anytime from Settings — scroll down to find the Revisit Getting Started Guide option.
    - The guide covers: setting up payment methods, enabling biometric login, adding your phone number, creating or joining a group, inviting members, adding expenses, settling up, and optional features.

    Security and account:
    - Enable biometric login (fingerprint or Face ID) from Settings for faster and more secure sign-in. It can be toggled on or off at any time.
    - A session timeout can be configured in Settings — you will be warned before being signed out.
    - Display name can be updated in Settings (max 50 characters). The name syncs across all your groups automatically.
    - Group name max length is 50 characters.

    Other features:
    - Dark mode: toggle in Settings under Appearance.
    - QR code sharing: share your group invite as a scannable QR code from inside a group.
    - Receipt Scanner: scan a receipt to pre-fill expense title, amount, and date (beta feature).
    - Notifications: receive alerts for group invites, new expenses, and payment updates.
    - Install as app: add Split-Sync to your home screen from Settings for a native app experience.
    - Contact Discovery: add your phone number in Profile so friends can find and add you to groups more easily.
    - A Help and Support section is available in Settings with more information and a video guide.

    ${userContext ? `User context: The user currently has ${userContext.groupCount || 0} group(s).` : ''}

    Tone and style:
    - Be concise, warm, and direct — no long-winded responses
    - Use plain language, no jargon
    - If a question is outside Split-Sync (e.g. general finance advice), politely redirect
    - Never make up features that do not exist in the list above
    - If unsure, suggest the user check Settings or the Getting Started guide

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
