// src/components/CreateGroupModal.jsx
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import IconSelector from './IconSelector';
import { useRef } from 'react';
import { useKeyboardAware } from '../hooks/useKeyboardAware';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [icon, setIcon] = useState('home');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { user } = useAuthStore();

  const currencies = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const groupData = {
        name: groupName.trim(),
        icon,
        currency,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        memberIds: [user.uid],
        members: [
          {
            userId: user.uid,
            name: user.displayName || user.email,
            email: user.email,
            role: 'owner',
            joinedAt: new Date(),
          }
        ],
      };

      const docRef = await addDoc(collection(db, 'groups'), groupData);
      
      setGroupName('');
      setIcon('home');
      setCurrency('EUR');
      
      if (onGroupCreated) {
        onGroupCreated(docRef.id);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  function MyForm() {
    const amountInputRef = useRef(null);
    useKeyboardAware(amountInputRef);

    return (
      <input
        ref={amountInputRef}
        type="number"
        // ... other props
      />
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-card-3d animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Create Group</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Flat Mates, Paris Trip"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              required
            />
          </div>

          <IconSelector selected={icon} onSelect={setIcon} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
