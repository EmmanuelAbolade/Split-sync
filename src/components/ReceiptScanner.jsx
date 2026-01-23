// src/components/ReceiptScanner.jsx
import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Upload, X, Loader, Image as ImageIcon } from 'lucide-react';

export default function ReceiptScanner({ onDataExtracted, isOpen, onClose }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const processReceipt = async () => {
    if (!image) return;

    setProcessing(true);
    setProgress(0);
    setExtractedText('');

    try {
      // Process image with Tesseract
      const result = await Tesseract.recognize(
        image,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const text = result.data.text;
      setExtractedText(text);

      // Extract data from text
      const extractedData = parseReceiptText(text);
      
      // Send data back to parent
      if (onDataExtracted) {
        onDataExtracted(extractedData);
      }

      // Close scanner
      setTimeout(() => {
        handleClose();
      }, 1000);

    } catch (error) {
      console.error('OCR Error:', error);
      alert('Failed to process receipt. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const parseReceiptText = (text) => {
    console.log('📄 Raw OCR Text:', text);
    
    const lines = text.split('\n').filter(line => line.trim());
    
    // IMPROVED MERCHANT NAME EXTRACTION
    let title = '';
    
    // Get first 5 lines (merchant name usually at top)
    const topLines = lines.slice(0, 5);
    console.log('🔍 Top lines for merchant search:', topLines);
    
    // Words to exclude from merchant names
    const excludeWords = [
      'receipt', 'invoice', 'bill', 'tax', 'vat', 'order',
      'date', 'time', 'table', 'server', 'guest', 'welcome',
      'thank', 'you', 'please', 'visit', 'again', 'call'
    ];
    
    // Patterns to avoid (dates, times, numbers only, etc.)
    const avoidPatterns = [
      /^\d+$/,                          // Only numbers: "123"
      /^\d{1,2}[\/\-\.]\d{1,2}/,       // Dates: "12/01" or "12-01"
      /^\d{1,2}:\d{2}/,                 // Times: "12:30"
      /^[A-Z]{2,3}\s*\d+$/,             // Table numbers: "TB 12", "TAB12"
      /^#\d+$/,                          // Order numbers: "#123"
      /^receipt|^invoice|^bill/i,       // Starts with generic words
    ];
    
    // Score each line for being a merchant name
    const candidates = topLines.map((line, index) => {
      let score = 0;
      const cleanLine = line.trim();
      const lowerLine = cleanLine.toLowerCase();
      
      // Skip empty or very short lines
      if (cleanLine.length < 3) return { line: cleanLine, score: -100, reason: 'Too short' };
      
      // Skip lines matching avoid patterns
      for (const pattern of avoidPatterns) {
        if (pattern.test(cleanLine)) {
          return { line: cleanLine, score: -100, reason: `Matches pattern: ${pattern}` };
        }
      }
      
      // Skip lines with exclude words
      const hasExcludeWord = excludeWords.some(word => lowerLine.includes(word));
      if (hasExcludeWord) {
        return { line: cleanLine, score: -100, reason: 'Contains exclude word' };
      }
      
      // POSITIVE SCORING:
      
      // Earlier lines get higher scores (merchant usually at top)
      score += (5 - index) * 20; // Line 0: +100, Line 1: +80, etc.
      
      // Prefer lines with letters (actual names vs numbers)
      const letterCount = (cleanLine.match(/[a-zA-Z]/g) || []).length;
      score += Math.min(letterCount * 2, 50); // Up to +50 for letters
      
      // Prefer lines with uppercase (business names often capitalized)
      const uppercaseCount = (cleanLine.match(/[A-Z]/g) || []).length;
      score += uppercaseCount * 3; // +3 per uppercase letter
      
      // Prefer lines that are all caps (common for merchant names)
      if (cleanLine === cleanLine.toUpperCase() && letterCount > 2) {
        score += 30;
      }
      
      // Prefer medium-length lines (5-30 chars) - too short or too long is suspicious
      if (cleanLine.length >= 5 && cleanLine.length <= 30) {
        score += 20;
      } else if (cleanLine.length > 30) {
        score -= 20; // Penalize very long lines
      }
      
      // Bonus for having multiple words (business names usually have spaces)
      const wordCount = cleanLine.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 4) {
        score += 15;
      }
      
      // Penalize lines with lots of numbers
      const digitCount = (cleanLine.match(/\d/g) || []).length;
      if (digitCount > cleanLine.length * 0.3) {
        score -= 30; // More than 30% digits is suspicious
      }
      
      // Penalize lines with special characters (except &, -, ')
      const specialChars = cleanLine.match(/[^a-zA-Z0-9\s&\-']/g) || [];
      score -= specialChars.length * 5;
      
      return { line: cleanLine, score, reason: 'Scored' };
    });
    
    console.log('🏆 Merchant candidates with scores:', candidates);
    
    // Pick the highest-scoring candidate
    const bestCandidate = candidates
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    
    if (bestCandidate) {
      title = bestCandidate.line;
      console.log('✅ Selected merchant:', title, 'Score:', bestCandidate.score);
    } else {
      // Fallback: just take first reasonable line
      title = lines.find(line => 
        line.trim().length > 3 && 
        !line.match(/^\d+$/) &&
        !/receipt|invoice/i.test(line)
      ) || 'Receipt';
      console.log('⚠️ Using fallback merchant:', title);
    }
    
    // Clean up title
    title = title.trim().substring(0, 50);
    
    // IMPROVED AMOUNT EXTRACTION - Prioritize "total" keywords
    let amount = '';
    
    // Pattern 1: Look for explicit TOTAL keywords (HIGHEST PRIORITY)
    const totalPatterns = [
      /total\s*sale[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /grand\s*total[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /total\s*amount[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /final\s*total[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /amount\s*due[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /total[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /^total\s+(\d+[.,]\d{2})/im,
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        amount = match[1].replace(',', '.');
        console.log('✅ Found TOTAL with pattern:', pattern, '→', amount);
        break;
      }
    }

    // Pattern 2: If no explicit total found, find the LARGEST number
    if (!amount) {
      console.log('⚠️ No explicit total found, searching for largest amount...');
      
      const allAmounts = [];
      const amountPatterns = [
        /€\s*(\d+[.,]\d{2})/g,
        /(\d+[.,]\d{2})\s*€/g,
        /\b(\d+[.,]\d{2})\b/g,
      ];

      for (const pattern of amountPatterns) {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          const value = parseFloat(match[1].replace(',', '.'));
          if (value > 0 && value < 10000) {
            allAmounts.push(value);
          }
        });
      }

      const uniqueAmounts = [...new Set(allAmounts)].sort((a, b) => b - a);
      console.log('💰 All amounts found:', uniqueAmounts);

      if (uniqueAmounts.length > 0) {
        amount = uniqueAmounts[0].toFixed(2);
        console.log('✅ Using LARGEST amount as total:', amount);
      }
    }

    // Pattern 3: Look for specific keywords to EXCLUDE
    const excludePatterns = [
      /service[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /vat[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /tax[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /subtotal[:\s]*€?\s*(\d+[.,]\d{2})/i,
      /discount[:\s]*€?\s*(\d+[.,]\d{2})/i,
    ];

    for (const pattern of excludePatterns) {
      const match = text.match(pattern);
      if (match && amount === match[1].replace(',', '.')) {
        console.log('⚠️ Amount matches excluded keyword, looking for better match...');
        const allAmounts = [];
        const globalPattern = /\b(\d+[.,]\d{2})\b/g;
        const matches = [...text.matchAll(globalPattern)];
        matches.forEach(match => {
          const value = parseFloat(match[1].replace(',', '.'));
          if (value > 0 && value < 10000 && value !== parseFloat(amount)) {
            allAmounts.push(value);
          }
        });
        const uniqueAmounts = [...new Set(allAmounts)].sort((a, b) => b - a);
        if (uniqueAmounts.length > 0) {
          amount = uniqueAmounts[0].toFixed(2);
          console.log('✅ Found better total:', amount);
        }
        break;
      }
    }

    // Extract date
    let date = new Date().toISOString().split('T')[0];
    const datePatterns = [
      /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/,
      /(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const [_, p1, p2, p3] = match;
        try {
          if (p1.length === 4) {
            date = `${p1}-${p2}-${p3}`;
          } else {
            date = `${p3}-${p2}-${p1}`;
          }
          const testDate = new Date(date);
          if (isNaN(testDate)) {
            date = new Date().toISOString().split('T')[0];
          }
        } catch (e) {
          date = new Date().toISOString().split('T')[0];
        }
        break;
      }
    }

    console.log('📊 Final extracted data:', { title, amount, date });

    return {
      amount: amount || '',
      date,
      title,
      rawText: text
    };
  };

  const handleClose = () => {
    setImage(null);
    setImagePreview(null);
    setExtractedText('');
    setProgress(0);
    setProcessing(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[60]">
      <div className="bg-white rounded-lg w-full max-w-lg sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Scan Receipt</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            disabled={processing}
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Upload Area */}
        {!imagePreview ? (
          <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {/* Take Photo Button (Primary) */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full border-2 border-primary bg-primary text-white rounded-lg p-6 sm:p-8 text-center hover:bg-primary-hover transition"
            >
              <Camera className="mx-auto mb-3 sm:mb-4" size={48} />
              <p className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
                Take Photo
              </p>
              <p className="text-sm sm:text-base opacity-90">
                Use your camera to capture receipt
              </p>
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Upload from Gallery Button (Secondary) */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center hover:border-primary hover:bg-primary-light transition"
            >
              <ImageIcon className="mx-auto mb-3 sm:mb-4 text-gray-400" size={40} />
              <p className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                Choose from Gallery
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                Select an existing photo from your device
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Image Preview */}
            <div className="relative">
              <img
                src={imagePreview}
                alt="Receipt preview"
                className="w-full h-48 sm:h-64 object-contain bg-gray-100 rounded-lg"
              />
              {!processing && (
                <button
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1.5 sm:p-2 rounded-full hover:bg-red-600"
                >
                  <X size={14} className="sm:w-4 sm:h-4" />
                </button>
              )}
            </div>

            {/* Processing Status */}
            {processing && (
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <Loader className="animate-spin text-primary" size={18} />
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    Processing... {progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Extracted Text Preview */}
            {extractedText && !processing && (
              <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                <p className="text-sm sm:text-base font-medium text-green-900 mb-1 sm:mb-2">
                  ✓ Receipt processed successfully!
                </p>
                <p className="text-xs sm:text-sm text-green-700">
                  Data extracted and added to expense form
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {!processing && !extractedText && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                  }}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm sm:text-base"
                >
                  Retake Photo
                </button>
                <button
                  onClick={processReceipt}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Camera size={16} className="sm:w-[18px] sm:h-[18px]" />
                  Scan Receipt
                </button>
              </div>
            )}

            {extractedText && !processing && (
              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 sm:py-3 bg-success text-white rounded-lg hover:opacity-90 transition text-sm sm:text-base"
              >
                Done
              </button>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Tips for best results:</h3>
          <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
            <li>• Make sure business name at top is clearly visible</li>
            <li>• Ensure "TOTAL" or "Total Sale" text is readable</li>
            <li>• Use good lighting (phone flashlight helps)</li>
            <li>• Hold phone steady and parallel to receipt</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
