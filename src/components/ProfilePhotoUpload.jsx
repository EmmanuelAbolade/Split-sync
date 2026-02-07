// src/components/ProfilePhotoUpload.jsx
import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../services/firebase';
import { Camera, Loader, X } from 'lucide-react';

export default function ProfilePhotoUpload({ user, currentPhotoURL, onPhotoUpdated }) {
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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setError('');
    setUploading(true);

    try {
      // Create storage reference
      const storageRef = ref(storage, `profilePhotos/${user.uid}`);
      
      // Upload file
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const photoURL = await getDownloadURL(storageRef);
      
      // Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: photoURL,
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
          {currentPhotoURL ? (
            <img
              src={currentPhotoURL}
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
