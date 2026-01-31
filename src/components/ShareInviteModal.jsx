// src/components/ShareInviteModal.jsx
import { useState } from 'react';
import { X, Copy, CheckCircle, MessageCircle, Mail, Share2, QrCode } from 'lucide-react';
import QRCodeCanvas from './QRCodeCanvas';

export default function ShareInviteModal({ isOpen, onClose, inviteLink, groupName }) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const shareMessage = `Join my group "${groupName}" on SplitSync! Click here: ${inviteLink}`;

  const handleCopy = async () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback
        prompt('Copy this link:', inviteLink);
      }
    } else {
      prompt('Copy this link:', inviteLink);
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
  };

  const handleSMS = () => {
    // iOS and Android compatible
    const url = `sms:?&body=${encodeURIComponent(shareMessage)}`;
    window.location.href = url;
  };

  const handleEmail = () => {
    const subject = `Join my group "${groupName}" on SplitSync`;
    const body = `Hi!\n\nI'd like to invite you to join my group "${groupName}" on SplitSync.\n\nClick here to join: ${inviteLink}\n\nSplitSync makes it easy to track shared expenses and settle up with friends!\n\nSee you there!`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join "${groupName}" on SplitSync`,
          text: shareMessage,
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled or error - fallback to copy
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-card-3d animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Share Invite Link</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Invite Link Display */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle size={18} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-700">Share via:</p>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">WhatsApp</p>
                <p className="text-xs text-gray-600">Share via WhatsApp</p>
              </div>
            </button>

            {/* SMS */}
            <button
              onClick={handleSMS}
              className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">Text Message</p>
                <p className="text-xs text-gray-600">Share via SMS/iMessage</p>
              </div>
            </button>

            {/* Email */}
            <button
              onClick={handleEmail}
              className="w-full flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                <Mail size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">Email</p>
                <p className="text-xs text-gray-600">Share via email</p>
              </div>
            </button>

            {/* QR Code */}
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                <QrCode size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">QR Code</p>
                <p className="text-xs text-gray-600">Show scannable QR code</p>
              </div>
            </button>

            {/* More Options (Native Share) */}
            {navigator.share && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <Share2 size={20} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">More Options</p>
                  <p className="text-xs text-gray-600">Share via other apps</p>
                </div>
              </button>
            )}
          </div>

          {/* QR Code Display */}
          {showQR && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center animate-scale-in">
              <p className="text-sm font-medium text-gray-700 mb-4">
                Scan to join group
              </p>
              <QRCodeCanvas value={inviteLink} size={200} />
              <p className="text-xs text-gray-500 mt-4">
                Scan this QR code with your phone camera
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
