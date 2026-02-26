// src/components/CloudinaryUpload.jsx
import { useState, useRef } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Camera, Loader, Upload, Trash2 } from 'lucide-react';

export default function CloudinaryUpload({ user, currentPhotoURL, onPhotoUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB for Cloudinary)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview({
        url: reader.result,
        file: file
      });
      setError('');
      setShowOptions(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadConfirm = async () => {
    if (!preview) return;

  setUploading(true);
  setError('');

  try {
    // ⭐ OPTIONAL: Delete old photo first (if exists)
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const oldPublicId = userDoc.data()?.cloudinaryPublicId;
    
    if (oldPublicId) {
      console.log('🗑️ Old photo found, will be replaced:', oldPublicId);
      // Note: Actual deletion requires Cloudinary API with authentication
      // For now, we'll just let old photos accumulate (they're small)
      // You can manually delete them from Cloudinary dashboard if needed
    }
    
    const timestamp = Date.now();
    const uniqueId = `${user.uid}_${timestamp}`;
    
    const formData = new FormData();
    formData.append('file', preview.file);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'splitsync/profiles');
    formData.append('public_id', uniqueId);
    
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`;
    
    console.log('📤 Uploading to Cloudinary with ID:', uniqueId);
    
    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary error:', errorData);
      throw new Error('Upload failed: ' + (errorData.error?.message || 'Unknown error'));
    }

    const data = await response.json();
    const photoURL = data.secure_url;
    
    console.log('✅ Upload successful!');
    console.log('New photo URL:', photoURL);
    
    await updateDoc(doc(db, 'users', user.uid), {
      photoURL: photoURL,
      customPhotoURL: true,
      cloudinaryPublicId: data.public_id,
      updatedAt: new Date(),
    });

    console.log('✅ Firestore updated');

    setPreview(null);
    setUploading(false);

    if (onPhotoUpdated) {
      console.log('📞 Calling onPhotoUpdated callback...');
      onPhotoUpdated(photoURL);
    }
    
  } catch (err) {
    console.error('❌ Upload error:', err);
    setError('Failed to upload photo. Please try again.');
    setUploading(false);
  }
};

  const handleCancelPreview = () => {
    setPreview(null);
    setError('');
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm('Remove your custom photo? Your Google profile picture (if available) will be used instead.')) {
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Update Firestore - remove custom photo flag and URL
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: user.photoURL || null, // Revert to Google photo or null
        customPhotoURL: false,
        cloudinaryPublicId: null,
        updatedAt: new Date(),
      });

      // Callback to parent
      if (onPhotoUpdated) {
        onPhotoUpdated(user.photoURL || null);
      }

      setShowOptions(false);
      setUploading(false);
      
    } catch (err) {
      console.error('Remove photo error:', err);
      setError('Failed to remove photo. Please try again.');
      setUploading(false);
    }
  };

  // Generate optimized Cloudinary URL for display
  const getOptimizedUrl = (url) => {
    if (!url || !url.includes('cloudinary')) return url;
    
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/${parts[1]}`;
    }
    return url;
  };

  const displayUrl = preview ? preview.url : getOptimizedUrl(currentPhotoURL);

  return (
    <div className="flex flex-col items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      <div className="relative inline-block mb-3">
        {/* Profile Photo Display */}
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-600 dark:to-indigo-800 shadow-card-hover dark:shadow-gray-900/50 border-4 border-white dark:border-gray-800">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile"
              className="w-full h-full object-cover"
              key={displayUrl} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl font-bold text-white">
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Upload/Change Button Overlay */}
        {!preview && (
          <button
            onClick={() => setShowOptions(!showOptions)}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary dark:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl dark:shadow-gray-900/50 transition-all duration-300 transform hover:scale-110 disabled:opacity-50"
            title={currentPhotoURL ? "Change photo" : "Upload photo"}
          >
            {uploading ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Camera size={16} />
            )}
          </button>
        )}
      </div>

      {/* Preview Actions */}
      {preview && !uploading && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3 max-w-xs">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-3 text-center font-medium">
            Replace with this photo?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelPreview}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadConfirm}
              className="flex-1 px-3 py-2 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition text-sm font-medium"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Uploading State */}
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Loader size={14} className="animate-spin" />
          <span>Uploading...</span>
        </div>
      )}

      {/* Options Menu */}
      {showOptions && !preview && !uploading && (
        <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 animate-scale-in">
          <button
            onClick={() => {
              fileInputRef.current?.click();
              setShowOptions(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 transition"
          >
            <Upload size={16} />
            {currentPhotoURL ? 'Change Photo' : 'Upload Photo'}
          </button>
          
          {currentPhotoURL && (
            <button
              onClick={handleRemovePhoto}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition"
            >
              <Trash2 size={16} />
              Remove Photo
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs mt-2 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Helper Text */}
      {!preview && !uploading && !error && (
        <p className="text-xs text-gray-300 dark:text-gray-400 text-center mt-1">
          {currentPhotoURL ? 'Click camera to change' : 'Click camera to upload'}
        </p>
      )}
    </div>
  );
}