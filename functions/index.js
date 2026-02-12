// functions/index.js
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const googleVisionApiKey = defineSecret('GOOGLE_VISION_API_KEY');

exports.scanReceipt = functions.https.onCall(
  { secrets: [googleVisionApiKey] },
  async (request) => {
     
    const data = request.data;
    
    if (!data || !data.imageData) {
      console.error('❌ No image data received!');
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
      const fullText = detections[0]?.description || '';
      
      
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
        /total[:\s]*[\€\$\£]?\s*(\d+[.,]\d{2})/i,
        /amount[:\s]*[\€\$\£]?\s*(\d+[.,]\d{2})/i,
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
        const amounts = decimals.map(d => parseFloat(d.replace(',', '.'))).filter(a => a > 0);
        if (amounts.length > 0) {
          amount = Math.max(...amounts).toFixed(2);
        }
      }

      // Extract date
      let date = new Date().toISOString().split('T')[0];
      const dateMatch = fullText.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (dateMatch) {
        const [_, day, month, year] = dateMatch;
        date = `${year}-${month}-${day}`;
      }

      return {
        success: true,
        data: {
          title: merchantName.substring(0, 50),
          amount: amount || '',
          date: date,
        },
      };
    } catch (error) {
      console.error('❌ Error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);