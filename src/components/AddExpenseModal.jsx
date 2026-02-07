// src/components/AddExpenseModal.jsx
import ReceiptScanner from './ReceiptScanner';
import { Camera } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import Tooltip from './Tooltip';

const CATEGORIES = [
  { id: 'food', name: 'Food & Dining' },
  { id: 'transport', name: 'Transport' },
  { id: 'accommodation', name: 'Accommodation' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'other', name: 'Other' },
];

const SPLIT_METHODS = [
  { id: 'equal', name: 'Equal Split', description: 'Split equally among members' },
  { id: 'percentage', name: 'By Percentage', description: 'Custom percentage per person' },
  { id: 'exact', name: 'Exact Amounts', description: 'Specific amount per person' },
  { id: 'shares', name: 'By Shares', description: 'Proportional shares (e.g., 2x, 1x)' },
];

export default function AddExpenseModal({ isOpen, onClose, group }) {
  const { user } = useAuthStore();
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(user?.uid || '');
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState('equal');
  const [selectedMembers, setSelectedMembers] = useState({});
  const [splits, setSplits] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);

      // Initialize members when modal opens
    useEffect(() => {
      if (isOpen && group?.members) {
        const initial = {};
        group.members.forEach(member => {
          initial[member.userId] = true;
        });
        setSelectedMembers(initial);
        
        // Initialize splits based on split method
        const initialSplits = {};
        if (splitMethod === 'percentage') {
          // First member gets 100%, rest get 0%
          group.members.forEach((member, index) => {
            initialSplits[member.userId] = index === 0 ? '100.0' : '0.0';
          });
        } else if (splitMethod === 'shares') {
          group.members.forEach(member => {
            initialSplits[member.userId] = '1';
          });
        } else {
          group.members.forEach(member => {
            initialSplits[member.userId] = '';
          });
        }
        setSplits(initialSplits);
      }
    }, [isOpen, splitMethod, group?.members]);
      
    // Reinitialize splits when split method changes
    useEffect(() => {
      if (!group?.members) return;
      
      const selected = Object.keys(selectedMembers).filter(id => selectedMembers[id]);
      const newSplits = {};
      
      if (splitMethod === 'percentage') {
        // First selected member gets 100%, rest get 0%
        selected.forEach((userId, index) => {
          newSplits[userId] = index === 0 ? '100.0' : '0.0';
        });
      } else if (splitMethod === 'shares') {
        selected.forEach(userId => {
          newSplits[userId] = '1';
        });
      } else {
        selected.forEach(userId => {
          newSplits[userId] = '';
        });
      }
      
      // ... reinitialize splits based on new method
      setSplits(newSplits);
    }, [splitMethod]);

    // toggleMember function
    const toggleMember = (userId) => {
        setSelectedMembers(prev => ({
          ...prev,
          [userId]: !prev[userId]
        }));
      };
      
      // updateSplit function (the one we just fixed)
      const updateSplit = (userId, value) => {
  if (splitMethod === 'percentage') {
    // Allow free typing - don't format yet!
    const numValue = value === '' ? 0 : parseFloat(value);
    
    // Don't restrict typing - let them type any number
    // We'll validate on blur or submit
    const selected = Object.keys(selectedMembers).filter(id => selectedMembers[id]);
    
    // Update this user's value (keep as string, no formatting!)
    const newSplits = { ...splits };
    newSplits[userId] = value; // Keep exact typed value
    
    // Calculate remaining for last member (only if value is valid)
    if (!isNaN(numValue)) {
      const lastMember = selected[selected.length - 1];
      const otherMembers = selected.filter(id => id !== userId && id !== lastMember);
      
      const othersTotal = otherMembers.reduce((sum, id) => {
        return sum + (parseFloat(newSplits[id]) || 0);
      }, 0);
      
      // Calculate remaining
      let remaining = 100 - numValue - othersTotal;
      remaining = Math.max(0, Math.min(100, remaining));
      
      // Update last member (unless this IS the last member)
      if (userId !== lastMember && selected.length > 1) {
        newSplits[lastMember] = remaining.toFixed(1);
      } else if (userId === lastMember && selected.length > 1) {
        // If editing last member, adjust first member
        const firstMember = selected[0];
        if (userId !== firstMember) {
          newSplits[firstMember] = remaining.toFixed(1);
        }
      }
    }
    
    setSplits(newSplits);
  } else {
    // Other split methods
    setSplits(prev => ({
      ...prev,
      [userId]: value
    }));
  }
};

  const calculateSplits = () => {
    const amountNum = parseFloat(amount) || 0;
    const selected = Object.keys(selectedMembers).filter(id => selectedMembers[id]);
    
    if (selected.length === 0) return {};

    const result = {};

    switch (splitMethod) {
      case 'equal':
        const equalAmount = amountNum / selected.length;
        selected.forEach(id => {
          result[id] = equalAmount;
        });
        break;

      case 'percentage':
        selected.forEach(id => {
          const percent = parseFloat(splits[id]) || 0;
          result[id] = (amountNum * percent) / 100;
        });
        break;

      case 'exact':
        selected.forEach(id => {
          result[id] = parseFloat(splits[id]) || 0;
        });
        break;

      case 'shares':
        const totalShares = selected.reduce((sum, id) => {
          return sum + (parseFloat(splits[id]) || 1);
        }, 0);
        const perShare = amountNum / totalShares;
        selected.forEach(id => {
          const shares = parseFloat(splits[id]) || 1;
          result[id] = perShare * shares;
        });
        break;
    }

    return result;
  };

  const validateSplits = () => {
    const amountNum = parseFloat(amount) || 0;
    const calculated = calculateSplits();
    const total = Object.values(calculated).reduce((sum, val) => sum + val, 0);

    if (splitMethod === 'percentage') {
      const totalPercent = Object.keys(selectedMembers)
        .filter(id => selectedMembers[id])
        .reduce((sum, id) => sum + (parseFloat(splits[id]) || 0), 0);
      
      if (Math.abs(totalPercent - 100) > 0.01) {
        return `Percentages must add up to exactly100% (currently ${totalPercent.toFixed(1)}%)`;
      }
    }

    if (splitMethod === 'exact') {
      if (Math.abs(total - amountNum) > 0.01) {
        return `Split amounts must equal total (currently ${total.toFixed(2)} vs ${amountNum.toFixed(2)})`;
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Expense title is required');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (amountNum > 1000000) {
      setError('Amount cannot exceed €1,000,000');
      return;
    }

    const selected = Object.keys(selectedMembers).filter(id => selectedMembers[id]);
    if (selected.length === 0) {
      setError('Select at least one member');
      return;
    }

    const validationError = validateSplits();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Show confirmation instead of submitting immediately
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmation(false);
    setLoading(true);

    try {
      const calculated = calculateSplits();
      
      const expenseData = {
        groupId: group.id,
        title: title.trim(),
        amount: parseFloat(amount),
        currency: group.currency,
        paidBy,
        category,
        description: description.trim(),
        date: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`),
        splitMethod,
        splits: calculated,
        participants: Object.keys(selectedMembers).filter(id => selectedMembers[id]),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        ...(scannedData?.receiptURL && { receiptURL: scannedData.receiptURL })
      };

      await addDoc(collection(db, 'expenses'), expenseData);
      
      // Reset form
      setTitle('');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setSplitMethod('equal');
      
      onClose();
    } catch (err) {
      console.error('Error adding expense:', err);
      setError('Failed to add expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleReceiptData = (data) => {
    // Store ALL scanned data including receiptURL
    setScannedData(data);
    // Pre-fill form with extracted data
    if (data.title) setTitle(data.title);
    if (data.amount) setAmount(data.amount);
    if (data.date) setDate(data.date);
    
    // Close scanner
    setShowReceiptScanner(false);
  };


  if (!isOpen) return null;

  const calculated = calculateSplits();
  const selected = Object.keys(selectedMembers).filter(id => selectedMembers[id]);

  // Confirmation view
  if (showConfirmation) {
    const payer = group?.members?.find(m => m.userId === paidBy);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-card-3d animate-scale-in">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Confirm Expense</h2>
          
          <div className="space-y-3 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">{title}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{group?.currency} {parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Paid by:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{payer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Category:</span>
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">{category}</span>
                </div>
                {description && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Description:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Split method:</span>
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">{splitMethod}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Split Details:</h4>
              <div className="space-y-1">
                {selected.map(userId => {
                  const member = group?.members?.find(m => m.userId === userId);
                  const amount = calculated[userId];
                  return (
                    <div key={userId} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{member?.name}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {group?.currency} {amount?.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
            Are you sure you want to add this expense?
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmation(false)}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Go Back
            </button>
            <button
              onClick={handleConfirmSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Confirm & Add'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  
  return (
    <>
    {/* Receipt Scanner - NOW PROPERLY INSIDE RETURN */}
    <ReceiptScanner
      isOpen={showReceiptScanner}
      onClose={() => setShowReceiptScanner(false)}
      onDataExtracted={handleReceiptData}
    />

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 my-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Expense</h2>
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
           {/* Scan Receipt Button */}
            <button
              type="button"
              onClick={() => {
                setShowReceiptScanner(true);
              }}
              className="w-full mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition flex items-center justify-center gap-2 font-medium"
            >
              <Camera size={20} />
              Scan Receipt (Auto-fill)
            </button>

          {/* Scrollable Content */}
      <div className="overflow-y-auto p-6 pt-4"></div>
        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title & Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expense Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => setTitle(e.target.value.trim())}
                placeholder="e.g., Dinner at Restaurant"
                maxLength="100"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount ({group.currency})
                <Tooltip text="Enter the total amount that was paid for this expense. This will be divided among the selected members based on the split method." />
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty or valid numbers with max 2 decimals
                  if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                    setAmount(value);
                  }
                }}
                onBlur={(e) => {
                  // Format to 2 decimals when user leaves field
                  if (e.target.value && !isNaN(e.target.value)) {
                    const formatted = parseFloat(e.target.value).toFixed(2);
                    setAmount(formatted);
                  }
                }}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                required
              />
            </div>
          </div>

          {/* Paid By & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Paid By *
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                required
              >
                {group?.members?.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Split Method */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Split Method
              <Tooltip text="Choose how to divide: Equally (split evenly among all), Percentage (by %), Exact amounts (specific amounts per person), or Shares (by ratio like 1:2:3)." />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SPLIT_METHODS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSplitMethod(method.id)}
                  className={`p-3 rounded-lg border-2 text-left transition ${
                    splitMethod === method.id
                      ? 'border-primary dark:border-indigo-500 bg-primary-light dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="font-semibold text-sm dark:text-white">{method.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{method.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Member Selection */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Split Between
              <Tooltip text="Select which group members should pay their share. You can choose everyone or just specific people who participated in this expense." />
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              {group?.members?.map((member) => (
                <label
                  key={member.userId}
                  className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-600 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers[member.userId] || false}
                    onChange={() => toggleMember(member.userId)}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="flex-1 dark:text-white">{member.name}</span>
                  
                  {selectedMembers[member.userId] && splitMethod !== 'equal' && (
                    <input
                      type="number"
                      step={splitMethod === 'percentage' ? '0.01' : splitMethod === 'shares' ? '1' : '0.01'}
                      value={splits[member.userId] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        
                        // Validation based on split method
                        if (splitMethod === 'shares') {
                          // Shares: only positive integers
                          if (value === '' || /^\d+$/.test(value)) {
                            const num = parseInt(value);
                            if (value === '' || (num > 0 && num <= 100)) {
                              updateSplit(member.userId, value);
                            }
                          }
                        } else if (splitMethod === 'exact') {
                          // Exact amounts: max 2 decimals, positive only
                          if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                            updateSplit(member.userId, value);
                          }
                        } else {
                          // Percentage: handled by updateSplit function
                          updateSplit(member.userId, value);
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        
                        // Format on blur
                        if (splitMethod === 'percentage' && value) {
                          const num = parseFloat(value);
                          if (!isNaN(num)) {
                            const formatted = Math.max(0, Math.min(100, num)).toFixed(1);
                            updateSplit(member.userId, formatted);
                          }
                        } else if (splitMethod === 'exact' && value) {
                          const num = parseFloat(value);
                          if (!isNaN(num) && num > 0) {
                            const formatted = num.toFixed(2);
                            updateSplit(member.userId, formatted);
                          }
                        } else if (splitMethod === 'shares' && value) {
                          const num = parseInt(value);
                          if (!isNaN(num) && num > 0) {
                            updateSplit(member.userId, num.toString());
                          }
                        }
                      }}
                      placeholder={
                        splitMethod === 'percentage' ? '%' :
                        splitMethod === 'shares' ? 'shares' : 
                        group?.currency
                      }
                      min={
                        splitMethod === 'percentage' ? '0' :
                        splitMethod === 'shares' ? '1' :
                        '0.01'
                      }
                      max={
                        splitMethod === 'percentage' ? '100' :
                        splitMethod === 'shares' ? '100' :
                        undefined
                      }
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  
                  {selectedMembers[member.userId] && calculated[member.userId] !== undefined && (
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {group?.currency} {calculated[member.userId].toFixed(2)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Percentage Total Indicator */}
        {splitMethod === 'percentage' && selected.length > 0 && (
          <div className={`mt-2 p-2 rounded text-sm text-center font-medium ${
            (() => {
              const total = selected.reduce((sum, id) => sum + (parseFloat(splits[id]) || 0), 0);
              const isValid = Math.abs(total - 100) < 0.01;
              return isValid ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
            })()
          }`}>
            {(() => {
              const total = selected.reduce((sum, id) => sum + (parseFloat(splits[id]) || 0), 0);
              const isValid = Math.abs(total - 100) < 0.01;
              return isValid 
                ? `✓ Total: ${total.toFixed(1)}% (Perfect!)` 
                : `Total: ${total.toFixed(1)}% (Must equal 100%)`;
            })()}
          </div>
        )}
     

          {/* Summary */}
          {amount && selected.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700 dark:text-gray-300">Total Amount:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {group?.currency} {parseFloat(amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-700 dark:text-gray-300">Split among:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selected.length} member{selected.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
