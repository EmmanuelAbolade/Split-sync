// functions/index.js
// Cloud Functions: scanReceipt (Google Vision OCR) + splitSyncChat (Anthropic AI chatbot proxy)

const functions = require('firebase-functions/v2');
const admin      = require('firebase-admin');
const vision     = require('@google-cloud/vision');
const https      = require('https');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const iban = require('./iban');
const privateData = require('./privateData');
const { FieldValue } = require('firebase-admin/firestore');
const { buildSystemPrompt } = require('./assistantPrompt');

const googleVisionApiKey = defineSecret('GOOGLE_VISION_API_KEY');
const ibanEncryptionKey  = defineSecret('IBAN_ENCRYPTION_KEY'); // 32-byte hex, AES-256-GCM
const legacyIbanKey      = defineSecret('LEGACY_IBAN_KEY');     // old client-side passphrase, read-only migration
const anthropicApiKey    = defineSecret('ANTHROPIC_API_KEY');
const paypalClientId     = defineSecret('PAYPAL_CLIENT_ID');
const paypalClientSecret = defineSecret('PAYPAL_CLIENT_SECRET');

// ─── capturePayPalOrder — PayPal REST API server-side capture ────────────────
// Captures a PayPal order server-side using the PayPal REST API.
// This avoids the browser cross-origin cookie limitation that prevents
// client-side capture (actions.order.capture()) from working on mobile browsers.
// Accepts: { orderId: string }
// Returns: { success: boolean, orderId: string, status: string }

exports.capturePayPalOrder = functions.https.onCall(
  { secrets: [paypalClientId, paypalClientSecret] },
  async (request) => {

    // Require authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to complete a payment.'
      );
    }

    const { orderId } = request.data || {};

    if (!orderId || typeof orderId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid PayPal order ID is required.'
      );
    }

    // Step 1 — Obtain a PayPal OAuth2 access token using client credentials
    const credentials = Buffer.from(
      `${paypalClientId.value()}:${paypalClientSecret.value()}`
    ).toString('base64');

    const tokenBody = 'grant_type=client_credentials';

    const accessToken = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api-m.sandbox.paypal.com',
        path:     '/v1/oauth2/token',
        method:   'POST',
        headers: {
          'Authorization':  `Basic ${credentials}`,
          'Content-Type':   'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(tokenBody),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.access_token) {
              resolve(parsed.access_token);
            } else {
              console.error('PayPal token error:', parsed);
              reject(new functions.https.HttpsError(
                'internal',
                'Failed to obtain PayPal access token.'
              ));
            }
          } catch (err) {
            reject(new functions.https.HttpsError('internal', 'Failed to parse PayPal token response.'));
          }
        });
      });

      req.on('error', (err) => {
        console.error('PayPal token request error:', err);
        reject(new functions.https.HttpsError('internal', 'Network error reaching PayPal.'));
      });

      req.write(tokenBody);
      req.end();
    });

    // Step 2 — Capture the approved order using the access token
    const captureBody = '{}';

    const captureResult = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api-m.sandbox.paypal.com',
        path:     `/v2/checkout/orders/${orderId}/capture`,
        method:   'POST',
        headers: {
          'Authorization':  `Bearer ${accessToken}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(captureBody),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.status === 'COMPLETED') {
              resolve(parsed);
            } else {
              console.error('PayPal capture response:', parsed);
              reject(new functions.https.HttpsError(
                'internal',
                parsed.message || `Capture returned status: ${parsed.status}`
              ));
            }
          } catch (err) {
            reject(new functions.https.HttpsError('internal', 'Failed to parse PayPal capture response.'));
          }
        });
      });

      req.on('error', (err) => {
        console.error('PayPal capture request error:', err);
        reject(new functions.https.HttpsError('internal', 'Network error during PayPal capture.'));
      });

      req.write(captureBody);
      req.end();
    });

    return {
      success: true,
      orderId: captureResult.id,
      status:  captureResult.status,
    };
  }
);


// ─── encryptIban / getIban — server-side IBAN protection ─────────────────────
// See functions/iban.js for the rationale and storage format.

exports.encryptIban = functions.https.onCall(
  { secrets: [ibanEncryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const clean = iban.normaliseIban(request.data?.iban);
    if (!clean) {
      throw new functions.https.HttpsError('invalid-argument', 'Please enter a valid IBAN.');
    }
    return { encryptedIBAN: iban.encryptV2(clean, ibanEncryptionKey.value()) };
  }
);

// Returns a user's plain IBAN to the owner, or to a member of a group the owner
// is also in. Legacy client-encrypted values are re-encrypted to v2 on read.
exports.getIban = functions.https.onCall(
  { secrets: [ibanEncryptionKey, legacyIbanKey] },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const callerId = request.auth.uid;
    const { userId, groupId } = request.data || {};
    if (!userId || typeof userId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
    }

    const db = admin.firestore();

    if (userId !== callerId) {
      if (!groupId || typeof groupId !== 'string') {
        throw new functions.https.HttpsError('permission-denied', 'Not allowed to view this IBAN.');
      }
      const groupSnap = await db.doc(`groups/${groupId}`).get();
      if (!groupSnap.exists || !iban.shareGroup(groupSnap.data(), callerId, userId)) {
        throw new functions.https.HttpsError('permission-denied', 'Not allowed to view this IBAN.');
      }
    }

    // Bank details live in the owner-only private doc (legacy data migrated on read)
    const { ref: privRef, data: loaded } = await privateData.loadPrivate(db, FieldValue, userId);
    // Pre-Feb-2026 accounts stored the IBAN in plain text — encrypt it now
    const data = await privateData.upgradePlainIban(
      privRef, FieldValue, loaded, (p) => iban.encryptV2(p, ibanEncryptionKey.value()), iban.normaliseIban
    );
    const stored = data.paymentMethods?.encryptedIBAN || null;
    if (!stored) return { iban: null };

    let result;
    try {
      result = iban.decryptAny(stored, ibanEncryptionKey.value(), legacyIbanKey.value());
    } catch (err) {
      console.error('getIban decrypt failed for', userId, err.message);
      return { iban: null };
    }

    // Upgrade legacy ciphertext so the old (publicly bundled) key stops mattering
    if (result.legacy) {
      try {
        await privRef.set({
          paymentMethods: { encryptedIBAN: iban.encryptV2(result.iban, ibanEncryptionKey.value()) },
        }, { merge: true });
      } catch (err) {
        console.warn('getIban re-encrypt failed for', userId, err.message);
      }
    }

    return { iban: result.iban };
  }
);

// Returns the payment options of every current member of a group the caller
// belongs to: PayPal/Revolut usernames, BIC and whether a bank account exists.
// Never returns IBANs (see getIban) or phone numbers.
exports.getGroupPaymentMethods = functions.https.onCall({ secrets: [ibanEncryptionKey] }, async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { groupId } = request.data || {};
  if (!groupId || typeof groupId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'groupId is required.');
  }
  const db = admin.firestore();
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  const members = groupSnap.exists ? (groupSnap.data().members || []) : [];
  if (!members.some(m => m.userId === request.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'You are not a member of this group.');
  }
  const entries = await Promise.all(members.map(async (m) => {
    try {
      const { ref, data: loaded } = await privateData.loadPrivate(db, FieldValue, m.userId);
      // Encrypt any pre-Feb-2026 plain-text IBAN while we're here
      const data = await privateData.upgradePlainIban(
        ref, FieldValue, loaded, (p) => iban.encryptV2(p, ibanEncryptionKey.value()), iban.normaliseIban
      );
      return [m.userId, privateData.publicPaymentView(data.paymentMethods)];
    } catch (err) {
      console.warn('getGroupPaymentMethods failed for', m.userId, err.message);
      return [m.userId, null];
    }
  }));
  return { methods: Object.fromEntries(entries) };
});


// ─── scanReceipt — Google Cloud Vision OCR ────────────────────────────────────

exports.scanReceipt = functions.https.onCall(
  { secrets: [googleVisionApiKey] },
  async (request) => {

    // Require sign-in — otherwise anyone could spend the Vision API quota
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to scan receipts.');
    }

    const data = request.data;

    if (!data || !data.imageData) {
      console.error('No image data received!');
      throw new functions.https.HttpsError('invalid-argument', 'Image data is required.');
    }

    try {

      const client = new vision.ImageAnnotatorClient({
        apiKey: googleVisionApiKey.value(),
      });

      const [result] = await client.textDetection({
        image: { content: data.imageData },
      });

      const detections = result.textAnnotations;
      const fullText   = detections[0]?.description || '';

      const lines = fullText.split('\n').filter(l => l.trim());

      let merchantName = 'Receipt';
      for (const line of lines.slice(0, 10)) {
        if (line.length >= 3 && /[a-zA-Z]/.test(line)) {
          merchantName = line.trim();
          break;
        }
      }

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
// Accepts: { messages: [{role, content}], userContext: { groupCount, sharedCount, personalCount } }
// Returns: { reply: string }

exports.splitSyncChat = functions.https.onCall(
  { secrets: [anthropicApiKey] },
  async (request) => {

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

    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Each message must have role and content.');
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Message role must be user or assistant.');
      }
      // Cap message size so the endpoint can't be used to run up API costs
      if (msg.content.length > 4000) {
        throw new functions.https.HttpsError('invalid-argument', 'Message is too long.');
      }
    }

    const trimmedMessages = messages.slice(-20);

    // Full app guide lives in assistantPrompt.js — keep it in sync with features
    const systemPrompt = buildSystemPrompt(userContext);

    // claude-sonnet-4-20250514 was retired on 2026-06-15 (API returned not_found_error).
    // Sonnet 5.5 thinks by default; thinking tokens count toward max_tokens, so the
    // budget is larger than the visible reply and effort is kept low for chat.
    const requestBody = JSON.stringify({
      model:         'claude-sonnet-5-5',
      max_tokens:    2048,
      output_config: { effort: 'low' },
      fallbacks:     'default',
      system:        systemPrompt,
      messages:      trimmedMessages,
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
          'anthropic-beta':    'server-side-fallback-2026-07-01',
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
            if (parsed.stop_reason === 'refusal') {
              resolve({ reply: 'Sorry, I can only help with questions about using Split-Sync.' });
              return;
            }
            // Response may start with a thinking block — pick the text block(s).
            const reply = (parsed.content || [])
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('\n')
              .trim() || 'Sorry, I could not generate a response.';
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
