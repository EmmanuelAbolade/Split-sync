// src/components/ExpenseDetailsModal.jsx

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  X, User, Calendar, Tag, Users, DollarSign, FileText,
  Receipt, Download, ExternalLink, Pencil, Trash2,
  AlertTriangle, Lock, Archive, ArchiveRestore, Info,
} from 'lucide-react';

export default function ExpenseDetailsModal({
  isOpen,
  onClose,
  expense,
  group,
  currentUserId,
  groupExpenses = [],
  onEdit,
  onDeleted,
  onStatusChanged,
}) {
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [actionLoading,      setActionLoading]      = useState(false);
  const [actionError,        setActionError]        = useState('');

  if (!isOpen || !expense) return null;

  const payer       = group?.members?.find(m => m.userId === expense.paidBy);
  const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
  const isSettlement = !!expense.isSettlement;
  const isCreator    = expense.createdBy === currentUserId;
  const canModify    = isCreator && !isSettlement;

  // Archive / deleted status
  const isArchived = expense.status === 'archived';
  const isDeleted  = expense.status === 'deleted';

  // Edit is blocked only when a settlement was recorded AFTER this expense was created.
  // This is more precise than blocking on any group-level settlement.
  const expenseCreatedAt = expense.createdAt?.toDate?.() || new Date(0);
  const hasSubsequentSettlement = groupExpenses.some(e =>
    e.isSettlement === true &&
    (e.createdAt?.toDate?.() || new Date(0)) > expenseCreatedAt
  );
  const editBlocked   = canModify && hasSubsequentSettlement;
  const deleteBlocked = canModify && hasSubsequentSettlement;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getSettlementTitle = () => {
    if (!expense.participants || expense.participants.length !== 2) return 'Settlement';
    const fromMember = group?.members?.find(m => m.userId === expense.paidBy);
    const toUserId   = expense.participants.find(id => id !== expense.paidBy);
    const toMember   = group?.members?.find(m => m.userId === toUserId);
    return `Settlement: ${fromMember?.name || 'Unknown'} to ${toMember?.name || 'Unknown'}`;
  };

  const participantShares = expense.participants?.map(userId => {
    const member     = group?.members?.find(m => m.userId === userId);
    const share      = expense.splits?.[userId] || 0;
    const percentage = expense.amount > 0
      ? ((share / expense.amount) * 100).toFixed(1)
      : '0.0';
    return { member, share, percentage };
  }) || [];

  const getSplitMethodDisplay = () => {
    const map = {
      equal:      'Split Equally',
      percentage: 'Split by Percentage',
      exact:      'Exact Amounts',
      shares:     'Split by Shares',
    };
    return map[expense.splitMethod] || expense.splitMethod;
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  // Soft delete — removes from balance calculations, keeps the record
  const handleSoftDelete = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await updateDoc(doc(db, 'expenses', expense.id), {
        status:    'deleted',
        deletedAt: new Date(),
        deletedBy: currentUserId,
      });
      setShowDeleteConfirm(false);
      onClose();
      if (onDeleted) onDeleted();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error('[ExpenseDetailsModal] Soft delete failed:', err);
      setActionError('Failed to delete expense. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Archive — hides from active list, still counted in balances
  const handleArchive = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await updateDoc(doc(db, 'expenses', expense.id), {
        status:     'archived',
        archivedAt: new Date(),
        archivedBy: currentUserId,
      });
      setShowArchiveConfirm(false);
      onClose();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error('[ExpenseDetailsModal] Archive failed:', err);
      setActionError('Failed to archive expense. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Restore — moves archived expense back to active list
  const handleRestore = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await updateDoc(doc(db, 'expenses', expense.id), {
        status:     'active',
        restoredAt: new Date(),
        restoredBy: currentUserId,
      });
      onClose();
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error('[ExpenseDetailsModal] Restore failed:', err);
      setActionError('Failed to restore expense. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete confirmation screen ─────────────────────────────────────────────
  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-xl">
          <div className="flex items-center justify-center w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
            Remove Expense
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-1">
            Are you sure you want to remove
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white text-center mb-3">
            "{expense.title}"?
          </p>
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4">
            <Info size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              This expense will be removed from balance calculations. The record is kept for audit purposes. This cannot be undone.
            </p>
          </div>
          {actionError && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">{actionError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={actionLoading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSoftDelete}
              disabled={actionLoading}
              className="flex-1 px-4 py-3 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Archive confirmation screen ────────────────────────────────────────────
  if (showArchiveConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-xl">
          <div className="flex items-center justify-center w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mx-auto mb-4">
            <Archive size={28} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
            Archive Expense
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
            Archive "{expense.title}"?
          </p>
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
            <Info size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Archived expenses are hidden from your active list but still count toward group balances. You can restore them at any time from the Archived view.
            </p>
          </div>
          {actionError && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">{actionError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setShowArchiveConfirm(false)}
              disabled={actionLoading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleArchive}
              disabled={actionLoading}
              className="flex-1 px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main details view ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 pr-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {isSettlement ? getSettlementTitle() : expense.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {isSettlement && (
                <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded border border-green-200 dark:border-green-800">
                  Settlement
                </span>
              )}
              {isArchived && (
                <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded border border-gray-200 dark:border-gray-600">
                  Archived
                </span>
              )}
              {isDeleted && (
                <span className="inline-block px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded border border-red-200 dark:border-red-800">
                  Removed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Edit — creator only, locked if subsequent settlement exists */}
            {canModify && !isArchived && !isDeleted && (
              editBlocked ? (
                <div
                  className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed rounded-lg"
                  title="Editing is locked because a settlement was recorded after this expense was created."
                >
                  <Lock size={18} />
                </div>
              ) : (
                <button
                  onClick={() => { onClose(); if (onEdit) onEdit(expense); }}
                  className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition"
                  title="Edit expense"
                >
                  <Pencil size={18} />
                </button>
              )
            )}

            {/* Archive — creator only, not on settlements, not already archived/deleted */}
            {canModify && !isArchived && !isDeleted && (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title="Archive this expense — hides it from the active list but keeps it in balance calculations"
              >
                <Archive size={18} />
              </button>
            )}

            {/* Restore — shown when archived */}
            {canModify && isArchived && (
              <button
                onClick={handleRestore}
                disabled={actionLoading}
                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition disabled:opacity-50"
                title="Restore this expense to your active list"
              >
                <ArchiveRestore size={18} />
              </button>
            )}

            {/* Delete — creator only, blocked if subsequent settlement exists */}
            {canModify && !isDeleted && (
              deleteBlocked ? (
                <div
                  className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed rounded-lg"
                  title="Removal is locked because a settlement was recorded after this expense was created."
                >
                  <Trash2 size={18} />
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                  title="Remove this expense from balance calculations"
                >
                  <Trash2 size={18} />
                </button>
              )
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Edit locked notice */}
        {editBlocked && !isArchived && !isDeleted && (
          <div className="mb-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <Lock size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Editing and removal are locked because a settlement was recorded after this expense was created. Archive it to hide it from the active list.
            </p>
          </div>
        )}

        {/* Archived notice */}
        {isArchived && (
          <div className="mb-4 flex items-start gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <Archive size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              This expense is archived. It is hidden from your active list but still counts toward group balances. Use the restore button above to make it active again.
            </p>
          </div>
        )}

        {/* Deleted notice */}
        {isDeleted && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
            <AlertTriangle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">
              This expense has been removed and no longer affects group balances. It is kept here for audit purposes only.
            </p>
          </div>
        )}

        {/* General action error */}
        {actionError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{actionError}</p>
        )}

        {/* Receipt Image */}
        {expense.receiptURL && (
          <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={20} className="text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Scanned Receipt</h3>
            </div>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-2 mb-3">
              <img src={expense.receiptURL} alt="Receipt" className="w-full h-64 object-contain rounded" />
            </div>
            <div className="flex gap-2">
              <a
                href={expense.receiptURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-600 transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} /> View Full Size
              </a>
              <a
                href={expense.receiptURL}
                download
                className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <Download size={16} /> Download
              </a>
            </div>
          </div>
        )}

        {/* Amount Card */}
        <div className={`rounded-lg p-6 mb-6 text-center border ${
          isDeleted
            ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'
            : 'bg-primary-light dark:bg-indigo-900/30 border-primary dark:border-indigo-700'
        }`}>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Amount</p>
          <p className={`text-4xl font-bold ${
            isDeleted
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-primary dark:text-indigo-400'
          }`}>
            {expense.currency} {expense.amount.toFixed(2)}
          </p>
          {isDeleted && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Not included in balance calculations
            </p>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-primary dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paid by</p>
              <p className="font-semibold text-gray-900 dark:text-white">{payer?.name || 'Unknown'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{payer?.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {expenseDate.toLocaleDateString('en-IE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {expenseDate.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Tag size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Category</p>
              <p className="font-semibold text-gray-900 dark:text-white capitalize">{expense.category || 'Other'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Split Method</p>
              <p className="font-semibold text-gray-900 dark:text-white">{getSplitMethodDisplay()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {participantShares.length} participant{participantShares.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {expense.description && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={18} className="text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Description</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              {expense.description}
            </p>
          </div>
        )}

        {/* Split Breakdown */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={18} className="text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Split Breakdown</h3>
          </div>
          <div className="space-y-2">
            {participantShares.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                    <span className="text-primary dark:text-indigo-400 font-semibold">
                      {item.member?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.member?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.percentage}% of total</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {expense.currency} {item.share.toFixed(2)}
                  </p>
                  {item.member?.userId === expense.paidBy && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method (settlements only) */}
        {isSettlement && expense.paymentMethod && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Payment Method:</strong>{' '}
              {expense.paymentMethod === 'paypal' ? 'PayPal' : 'Manual Payment'}
            </p>
            {expense.paypalOrderId && (
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Order ID: {expense.paypalOrderId}
              </p>
            )}
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
