// src/components/ReceiptScanner.jsx - GOOGLE VISION API VERSION
import { useState, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../services/firebase';
import { Camera, X, Loader, Image as ImageIcon, Lightbulb, Sun, Droplets, FileCheck, Edit3, CheckCircle2, Sparkles, Upload } from 'lucide-react';

export default function ReceiptScanner({ onDataExtracted, isOpen, onClose }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [extractedData, setExtractedData] = useState({ title: '', amount: '', date: '' });
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
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

    try {
      // Upload image to Cloudinary FIRST
      let receiptURL = null;
      try {
        const formData = new FormData();
        formData.append('file', image);
        formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'splitsync/receipts'); // Separate folder for receipts
        
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`;
        
        const uploadResponse = await fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          receiptURL = uploadData.secure_url;
          console.log('Receipt uploaded to Cloudinary:', receiptURL);
        } else {
          console.error('Cloudinary upload failed');
        }
      } catch (uploadError) {
        console.error('Error uploading to Cloudinary:', uploadError);
        // Continue with OCR even if upload fails
      }

      // Process with Google Vision
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const fullResult = reader.result;
          const base64Data = fullResult.split(',')[1];
          
          if (!base64Data || base64Data.length === 0) {
            alert('Failed to convert image to base64');
            setProcessing(false);
            return;
          }
          
          const functions = getFunctions(app, 'us-central1');
          const scanReceipt = httpsCallable(functions, 'scanReceipt');
          
          const result = await scanReceipt({ imageData: base64Data });
          
          if (result.data.success) {
            // Add receiptURL to extracted data
            setExtractedData({
              ...result.data.data,
              receiptURL: receiptURL // Add the Cloudinary URL
            });
            setShowReview(true);
          } else {
            alert(result.data.error || 'Failed to scan receipt. Please try again.');
          }
        } catch (error) {
          console.error('Scan error:', error);
          alert('Failed to scan receipt: ' + error.message);
        } finally {
          setProcessing(false);
        }
      };

      reader.onerror = () => {
        alert('Failed to read image file');
        setProcessing(false);
      };

      reader.readAsDataURL(image);

    } catch (error) {
      alert('Failed to process receipt: ' + error.message);
      setProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (!extractedData.amount || parseFloat(extractedData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!extractedData.title.trim()) {
      alert('Please enter a description');
      return;
    }
    
    if (onDataExtracted) {
      onDataExtracted(extractedData);
    }
    handleClose();
  };

  const handleClose = () => {
    setImage(null);
    setImagePreview(null);
    setShowReview(false);
    setExtractedData({ title: '', amount: '', date: '' });
    setProcessing(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-scale-in">
      <div className="bg-white rounded-lg w-full max-w-lg sm:max-w-2xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {showReview ? 'Review & Edit' : 'Scan Receipt'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1" disabled={processing}>
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {showReview ? (
          /* Review & Edit Screen */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={18} className="text-green-600" />
                <p className="text-sm font-medium text-green-900">
                  Receipt scanned successfully
                </p>
              </div>
              <p className="text-xs text-green-700 ml-6">
                Please verify the data below
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description / Merchant Name *
              </label>
              <input
                type="text"
                value={extractedData.title}
                onChange={(e) => setExtractedData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., TK Maxx, Applus, Tesco"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount (EUR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={extractedData.amount}
                onChange={(e) => setExtractedData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="84.96"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={extractedData.date}
                onChange={(e) => setExtractedData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowReview(false);
                  setImage(null);
                  setImagePreview(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Scan Again
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition"
              >
                Add to Expense
              </button>
            </div>
          </div>
        ) : !imagePreview ? (
          /* Upload Screen */
          <div className="space-y-3 sm:space-y-4">
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full border-2 border-primary bg-primary text-white rounded-lg p-6 sm:p-8 hover:bg-primary-hover transition"
            >
              <Camera className="mx-auto mb-3 sm:mb-4" size={48} />
              <p className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">Take Photo</p>
              <p className="text-sm sm:text-base opacity-90">Scan receipt with camera</p>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 hover:border-primary hover:bg-primary-light transition"
            >
              <ImageIcon className="mx-auto mb-3 sm:mb-4 text-gray-400" size={40} />
              <p className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">Choose from Gallery</p>
              <p className="text-xs sm:text-sm text-gray-600">Select existing photo</p>
            </button>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={18} className="text-yellow-600" />
                <p className="text-sm font-bold text-yellow-900">Tips for Best Results</p>
              </div>
              <ul className="text-xs text-yellow-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <FileCheck size={14} className="mt-0.5 flex-shrink-0 text-yellow-600" />
                  <span>Place receipt on a light/white surface</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sun size={14} className="mt-0.5 flex-shrink-0 text-yellow-600" />
                  <span>Use good lighting (natural light is best)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Droplets size={14} className="mt-0.5 flex-shrink-0 text-yellow-600" />
                  <span>Avoid shadows and glare</span>
                </li>
                <li className="flex items-start gap-2">
                  <FileCheck size={14} className="mt-0.5 flex-shrink-0 text-yellow-600" />
                  <span>Keep receipt flat and straight</span>
                </li>
                <li className="flex items-start gap-2">
                  <Edit3 size={14} className="mt-0.5 flex-shrink-0 text-yellow-600" />
                  <span>You can always edit the amount after scanning!</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-blue-600" />
                <p className="text-sm font-bold text-blue-900">Powered by Google Cloud Vision API</p>
              </div>
              <ul className="text-xs sm:text-sm text-blue-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  <span><strong>85%+ accuracy</strong> on real-world receipts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  <span>Works with various receipt formats</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  <span>Automatically extracts merchant, total, and date</span>
                </li>
                <li className="flex items-start gap-2">
                  <Edit3 size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  <span>You can review and edit before adding</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* Image Preview */
          <div className="space-y-3 sm:space-y-4">
            <div className="relative">
              <img src={imagePreview} alt="Receipt" className="w-full h-48 sm:h-64 object-contain bg-gray-100 rounded-lg" />
              {!processing && (
                <button
                  onClick={() => { setImage(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1.5 sm:p-2 rounded-full hover:bg-red-600"
                >
                  <X size={14} className="sm:w-4 sm:h-4" />
                </button>
              )}
            </div>

            {processing && (
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Loader className="animate-spin text-primary" size={18} />
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    Scanning with Google Vision API...
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full animate-pulse w-full" />
                </div>
                <p className="text-xs text-gray-600 mt-2">This takes 3-5 seconds</p>
              </div>
            )}

            {!processing && (
              <button
                onClick={processReceipt}
                className="w-full px-4 py-2.5 sm:py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Scan with Google Vision API
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
