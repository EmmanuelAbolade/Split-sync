// src/components/CloudinaryUpload.jsx
import { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Camera, Loader } from 'lucide-react';

export default function CloudinaryUpload({ user, currentPhotoURL, onPhotoUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
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

    setError('');
    setUploading(true);

    try {
      // Create FormData for Cloudinary upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'splitsync/profiles'); // Organize in folder
      formData.append('public_id', user.uid); // Use user ID as filename
      
      // Upload to Cloudinary
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`;
      
      const response = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      // Get the optimized URL (Cloudinary auto-optimizes)
      const photoURL = data.secure_url;
      
      // Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: photoURL,
        cloudinaryPublicId: data.public_id, // Store for future deletion if needed
        updatedAt: new Date(),
      });

      // Callback to parent
      if (onPhotoUpdated) {
        onPhotoUpdated(photoURL);
      }

      setUploading(false);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload photo. Please try again.');
      setUploading(false);
    }
  };

  // Generate optimized Cloudinary URL for display
  const getOptimizedUrl = (url) => {
    if (!url || !url.includes('cloudinary')) return url;
    
    // Add Cloudinary transformations for profile photos
    // w_200,h_200,c_fill,g_face (200x200, cropped to face, fill mode)
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/${parts[1]}`;
    }
    return url;
  };

  const displayUrl = getOptimizedUrl(currentPhotoURL);

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      <div className="relative inline-block">
        {/* Profile Photo Display */}
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-600 dark:to-indigo-800 shadow-card-hover dark:shadow-gray-900/50">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl font-bold text-white">
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Upload Button Overlay */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-8 h-8 bg-primary dark:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:scale-110 disabled:opacity-50"
        >
          {uploading ? (
            <Loader size={16} className="animate-spin" />
          ) : (
            <Camera size={16} />
          )}
        </button>
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
