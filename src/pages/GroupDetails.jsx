// src/pages/GroupDetails.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, getDocs, writeBatch, arrayRemove } from 'firebase/firestore';
import { authenticateWithBiometric, isBiometricEnabledOnDevice } from '../utils/biometric';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { useNotificationsStore, confirmPaymentReceived, declinePaymentReceived, createNotification } from '../stores/notificationsStore';
import { 
  Home, Plane, Pizza, PartyPopper, Car, Palmtree, 
  Gamepad2, Heart, Users, ShoppingCart, Coffee, 
  Utensils, Music, Briefcase, GraduationCap, Gift,
  ArrowLeft, UserPlus, Plus, Link as LinkIcon, UtensilsCrossed, Lightbulb, Tag, ChevronDown, Landmark, CheckCircle2, Clock, Mail, DollarSign, AlertTriangle, XCircle, LogOut, Trash2, MoreVertical
} from 'lucide-react';
import AddExpenseModal from '../components/AddExpenseModal';
import { calculateBalances, calculateSettlements, getUserBalanceSummary } from '../utils/balanceCalculator';
import SettleUpModal from '../components/SettleUpModal';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import ShareInviteModal from '../components/ShareInviteModal';
import { getMySentInvitations, cancelInvitation, sendInvitation } from '../utils/invitationSystem'; 

const ICON_MAP = {
  home: Home, plane: Plane, pizza: Pizza, party: PartyPopper,
  car: Car, beach: Palmtree, game: Gamepad2, heart: Heart,
  users: Users, shopping: ShoppingCart, coffee: Coffee,
  dining: Utensils, music: Music, work: Briefcase,
  study: GraduationCap, gift: Gift,
};

function getIconComponent(iconName) {
  return ICON_MAP[iconName] || Home;
}

// Category icon mapping
const CATEGORY_ICONS = {
  food: UtensilsCrossed,
  transport: Car,
  accommodation: Home,
  entertainment: PartyPopper,
  shopping: ShoppingCart,
  utilities: Lightbulb,
  other: Tag,
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || Tag;
}


export default function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteLink] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [expenses, setExpenses] = useState([]);  
  const [showRecentExpenses, setShowRecentExpenses] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [memberPhotos, setMemberPhotos] = useState({});
  const [memberPaymentMethods, setMemberPaymentMethods] = useState({});
  const [pendingPaymentBanner, setPendingPaymentBanner] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [settlementActionLoading, setSettlementActionLoading] = useState({});
  const [showPaymentHistory, setShowPaymentHistory] = useState(true);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [leaveBlockReason, setLeaveBlockReason] = useState(null); // null | { amount, currency, direction }
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [groupActionError, setGroupActionError] = useState('');

  // Delete group
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState(null); // null | [{ name, amount, currency }]
  // Auth before delete
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteAuthError, setDeleteAuthError] = useState('');
  const [deleteAuthLoading, setDeleteAuthLoading] = useState(false);
  // Derive pending settlement data from the global notifications store.
  // This avoids a separate Firestore query and requires no new collection.
  const { notifications: allNotifications } = useNotificationsStore();

  // payment_confirmation_needed notifications addressed to THIS user for THIS group
  // Used to show payee confirm/decline banners and payer "awaiting" banners
  const groupPaymentActions = allNotifications.filter(
    n => n.data?.groupId === groupId &&
      n.type === 'payment_confirmation_needed' &&
      n.requiresAction === true &&
      !n.read
  );

  // payment_log notifications owned by THIS user for THIS group (payer's activity record)
  const groupPaymentLog = allNotifications.filter(
    n => n.data?.groupId === groupId && n.type === 'payment_log'
  );

  // Get display title with current names for settlements
  const getDisplayTitle = (expense) => {
    if (!expense.isSettlement) return expense.title;
    
    const fromUserId = expense.paidBy;
    const toUserId = expense.participants?.find(id => id !== expense.paidBy);
    
    const fromMember = group.members?.find(m => m.userId === fromUserId);
    const toMember = group.members?.find(m => m.userId === toUserId);
    
    return `Settlement: ${fromMember?.name || 'Unknown'} → ${toMember?.name || 'Unknown'}`;
  };

  // Format a timestamp into a short date string
  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Helper to format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  // Fetch group details on mount
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        
        if (groupDoc.exists()) {
          setGroup({ id: groupDoc.id, ...groupDoc.data() });
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('Error fetching group:', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [groupId, navigate]);


  // Fetch member photos
  useEffect(() => {
    if (!group?.members) return;

    const fetchMemberPhotos = async () => {
      const photos = {};
      
      for (const member of group.members) {
        try {
          const userDoc = await getDoc(doc(db, 'users', member.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            photos[member.userId] = userData.photoURL || null;
          }
        } catch (err) {
          console.error(`Error fetching photo for ${member.userId}:`, err);
        }
      }
      
      setMemberPhotos(photos);
    };

    fetchMemberPhotos();
  }, [group?.members]);
  
  // Fetch member payment methods
  useEffect(() => {
    if (!group?.members) return;

    const fetchPaymentMethods = async () => {
      const methods = {};
      for (const member of group.members) {
        try {
          const userDoc = await getDoc(doc(db, 'users', member.userId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            methods[member.userId] = data.paymentMethods || null;
          }
        } catch (error) {
          console.error(`Error fetching payment methods for ${member.userId}:`, error);
        }
      }
      setMemberPaymentMethods(methods);
    };

    fetchPaymentMethods();
  }, [group?.members]);

  // Fetch expenses in real-time (onSnapshot) and sort by date descending
  useEffect(() => {
    if (!groupId) return;

    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', groupId),
    );

    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by date manually
      expensesData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA; // Newest first
      });
      
      setExpenses(expensesData);
      setLoadingExpenses(false);
    }, (error) => {
      console.error('Error fetching expenses:', error);
      setLoadingExpenses(false);
    });

    return () => unsubscribe();
  }, [groupId]);


  // Check for pending payment confirmations when the user returns to the tab (after PayPal flow)
  useEffect(() => {
    // Safety checks - don't run if data isn't ready
    if (!groupId) return;
    if (!group) return;
    if (!expenses) return;
    if (!Array.isArray(expenses)) return;
    if (!group.members || !Array.isArray(group.members)) return;
    
    const checkPendingOnFocus = () => {
        
      try {
        const pending = sessionStorage.getItem('pendingPayment');
        
        if (!pending) {
          return;
        }
        
        const paymentData = JSON.parse(pending);
        
        // Check if this payment belongs to THIS group
        if (paymentData.groupId !== groupId) {
          return;
        }
        setPendingPaymentBanner(paymentData);
        
        // Calculate settlements to find matching one
        const balances = calculateBalances(expenses, group.members);
        const settlements = calculateSettlements(balances);
        
        const matchingSettlement = settlements.find(
          s => s.from === paymentData.fromUserId && s.to === paymentData.toUserId
        );

        // If we find a matching settlement, open the SettleUpModal for it
        if (matchingSettlement) {
          //setSelectedSettlement(matchingSettlement);
        }
        // Clear pending payment from sessionStorage after processing
      } catch (err) {
      }
    };

    // Check on mount in case user is already back and focused
    checkPendingOnFocus();
    
    // Check on window focus (user returns from PayPal)
    const handleFocus = () => {
      checkPendingOnFocus();
    };

    // Also check when tab becomes visible (in case user switched tabs instead of windows)
    const handleVisibility = () => {
      if (!document.hidden) {
        checkPendingOnFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [groupId, group, expenses]); // Safe dependencies

  // Load pending invitations
  useEffect(() => {
    const loadPendingInvitations = async () => {
      if (!group?.id || !user?.uid) return;
      
      try {
        const invitations = await getMySentInvitations(user.uid, group.id);
        const pending = invitations.filter(inv => inv.status === 'pending');
        setPendingInvitations(pending);
      } catch (error) {
        console.error('Error loading pending invitations:', error);
      }
    };
    
    loadPendingInvitations();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingInvitations, 30000);
    return () => clearInterval(interval);
  }, [group?.id, user?.uid]);
  
  // Opens the leave confirmation — checks current user balance first.
  // If the user has an unsettled balance, shows the blocking reason.
  const handleOpenLeave = () => {
    setShowGroupOptions(false);
    setGroupActionError('');
    const balances = calculateBalances(expenses, group.members || []);
    const rawBalance = balances[user.uid] || 0;
    const absBalance = Math.abs(rawBalance);
    if (absBalance > 0.01) {
      setLeaveBlockReason({
        amount: absBalance.toFixed(2),
        currency: group.currency,
        direction: rawBalance < 0 ? 'owe' : 'are owed',
      });
    } else {
      setLeaveBlockReason(null);
    }
    setShowConfirmLeave(true);
  };

  // Removes the current user from the group members array.
  const handleLeaveGroup = async () => {
    if (!user || !group) return;
    setGroupActionLoading(true);
    setGroupActionError('');
    try {
      const currentMember = group.members.find(m => m.userId === user.uid);
      if (!currentMember) throw new Error('Member record not found.');
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayRemove(currentMember),
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('[GroupDetails] Leave group failed:', err);
      setGroupActionError('Failed to leave the group. Please try again.');
      setGroupActionLoading(false);
    }
  };

  // Opens the delete confirmation — checks that ALL members are settled first.
  const handleOpenDelete = () => {
    setShowGroupOptions(false);
    setGroupActionError('');
    const balances = calculateBalances(expenses, group.members || []);
    const unsettled = (group.members || [])
      .filter(m => Math.abs(balances[m.userId] || 0) > 0.01)
      .map(m => ({
        name: m.name,
        amount: Math.abs(balances[m.userId]).toFixed(2),
        currency: group.currency,
      }));
    setDeleteBlockReason(unsettled.length > 0 ? unsettled : null);
    setDeletePassword('');
    setDeleteAuthError('');
    setShowConfirmDelete(true);
  };

    // Authenticates the user before allowing group deletion.
    // Uses biometric if enabled on device, otherwise password re-entry.
    // Google OAuth users skip re-auth (Firebase does not support password reauth for OAuth).
    const handleAuthAndDelete = async () => {
      setDeleteAuthLoading(true);
      setDeleteAuthError('');

      try {
        const isGoogleUser = user.providerData?.some(p => p.providerId === 'google.com');

        if (isGoogleUser) {
          // Google OAuth — skip re-auth, proceed directly
          await handleDeleteGroup();
          return;
        }

        const biometricEnabled = isBiometricEnabledOnDevice(user.uid);

        if (biometricEnabled) {
          const authenticated = await authenticateWithBiometric(user.uid, 'Confirm group deletion');
          if (!authenticated) {
            setDeleteAuthError('Biometric authentication failed. Please try again.');
            setDeleteAuthLoading(false);
            return;
          }
          await handleDeleteGroup();
        } else {
          // Password re-entry
          if (!deletePassword.trim()) {
            setDeleteAuthError('Please enter your password to confirm.');
            setDeleteAuthLoading(false);
            return;
          }
          const credential = EmailAuthProvider.credential(user.email, deletePassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await handleDeleteGroup();
        }
      } catch (err) {
        console.error('[GroupDetails] Auth before delete failed:', err);
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setDeleteAuthError('Incorrect password. Please try again.');
        } else {
          setDeleteAuthError('Authentication failed. Please try again.');
        }
        setDeleteAuthLoading(false);
      }
    };

  // Deletes all expenses, notifies all members, then deletes the group document.
  const handleDeleteGroup = async () => {
    if (!user || !group || group.createdBy !== user.uid) return;
    setGroupActionLoading(true);
    setGroupActionError('');
    try {
      // Batch-delete all expenses in this group
      const expensesSnap = await getDocs(
        query(collection(db, 'expenses'), where('groupId', '==', groupId))
      );
      const batch = writeBatch(db);
      expensesSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      // Notify all other members
      const otherMembers = (group.members || []).filter(m => m.userId !== user.uid);
      await Promise.all(
        otherMembers.map(m =>
          createNotification({
            userId: m.userId,
            type: 'group_deleted',
            title: 'Group Deleted',
            message: `"${group.name}" was deleted by ${user.displayName || 'the group owner'}.`,
            data: { groupId, groupName: group.name },
          })
        )
      );

      // Delete the group document itself
      await deleteDoc(doc(db, 'groups', groupId));
      navigate('/dashboard');
    } catch (err) {
      console.error('[GroupDetails] Delete group failed:', err);
      setGroupActionError('Failed to delete the group. Please try again.');
      setGroupActionLoading(false);
    }
  };
  
  
  // LOADING CHECK FIRST
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading group...</p>
        </div>
      </div>
    );
  }

  // NULL CHECK SECOND
  if (!group) return null;

  const balances = calculateBalances(expenses, group.members || []);
  const settlements = calculateSettlements(balances);
  const userBalance = getUserBalanceSummary(balances, user.uid, group.members);
  const IconComponent = getIconComponent(group.icon);
  const isOwner = group.createdBy === user.uid;

  // THEN RETURN JSX
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white"> SplitSync</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Group Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/50 p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover dark:from-indigo-600 dark:to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <IconComponent className="text-white" size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {group.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <Users size={16} />
                {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                <span className="mx-2">•</span>
                {group.currency}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 relative">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2"
            >
              <LinkIcon size={18} />
              {showInviteLink ? 'Link Copied!' : 'Invite Link'}
            </button>
            <button
              className="flex-1 bg-primary dark:bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              onClick={() => setShowAddExpense(true)}
            >
              <Plus size={18} />
              Add Expense
            </button>

            {/* More options — leave (members) or delete (owner) */}
            <div className="relative">
              <button
                onClick={() => setShowGroupOptions(prev => !prev)}
                className="p-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                title="Group options"
              >
                <MoreVertical size={18} />
              </button>

              {showGroupOptions && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowGroupOptions(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                    {!isOwner && (
                      <button
                        onClick={handleOpenLeave}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                      >
                        <LogOut size={16} />
                        Leave Group
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={handleOpenDelete}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <Trash2 size={16} />
                        Delete Group
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>


          {/* Balance Summary */}
          {expenses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className={`p-6 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 border ${
                userBalance.status === 'settled' ? 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800' :
                userBalance.status === 'owed' ? 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800' :
                'bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border-orange-200 dark:border-orange-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{userBalance.message}</p>
                    {userBalance.status !== 'settled' && (
                      <p className="text-2xl font-bold mt-1 transition-all duration-300 hover:scale-110 dark:text-white">
                        {group.currency} {userBalance.amount.toFixed(2)}
                      </p>
                    )}
                    {userBalance.status === 'settled' && (
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={18} />
                        All settled up!
                      </p>
                    )}
                  </div>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    userBalance.status === 'settled'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : userBalance.status === 'owed'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-orange-100 dark:bg-orange-900/30'
                  }`}>
                    {userBalance.status === 'settled'
                      ? <CheckCircle2 size={22} className="text-green-600 dark:text-green-400" />
                      : userBalance.status === 'owed'
                        ? <DollarSign size={22} className="text-blue-600 dark:text-blue-400" />
                        : <AlertTriangle size={22} className="text-orange-600 dark:text-orange-400" />
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pending Payment Banner - sessionStorage-based (shown while user is in the same session) */}
        {pendingPaymentBanner && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl p-4 mb-6 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Payment Confirmation Needed
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                  Did you complete your {pendingPaymentBanner.method?.toUpperCase()} payment of{' '}
                  <strong>{pendingPaymentBanner.currency} {pendingPaymentBanner.amount?.toFixed(2)}</strong>{' '}
                  to <strong>{pendingPaymentBanner.toName}</strong>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const matchingSettlement = settlements.find(
                        s => s.from === pendingPaymentBanner.fromUserId && 
                            s.to === pendingPaymentBanner.toUserId
                      );
                      if (matchingSettlement) {
                        setSelectedSettlement(matchingSettlement);
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-600 transition text-sm font-medium"
                  >
                    Yes, Mark as Paid
                  </button>
                  <button
                    onClick={() => {
                      sessionStorage.removeItem('pendingPayment');
                      setPendingPaymentBanner(null);
                    }}
                    className="px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition text-sm"
                  >
                    Not Yet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Action Banners - derived from notifications store, no separate Firestore query.
            Payee sees confirm/decline; payer sees "awaiting confirmation" notice. */}
        {groupPaymentActions.map((notif) => {
          const pd = notif.data || {};
          // eslint-disable-next-line no-unused-vars
          const isPayee = notif.userId === user.uid; // always true here (payee's notification)
          const actionLoading = settlementActionLoading[notif.id];

          return (
            <div
              key={notif.id}
              className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl p-4 mb-4 animate-scale-in"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Payment Confirmation Required
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mb-1">
                    <strong>{pd.payerName}</strong> claims to have paid you{' '}
                    <strong>{pd.currency} {Number(pd.amount).toFixed(2)}</strong> via{' '}
                    <strong>{pd.method?.toUpperCase()}</strong>.
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                    Confirm only if you actually received the money. The balance updates only after your confirmation.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setSettlementActionLoading(prev => ({ ...prev, [notif.id]: 'confirming' }));
                        try {
                          await confirmPaymentReceived(notif.id);
                        } catch (err) {
                          console.error('Error confirming payment:', err);
                        } finally {
                          setSettlementActionLoading(prev => ({ ...prev, [notif.id]: null }));
                        }
                      }}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition text-sm font-medium disabled:opacity-60"
                    >
                      {actionLoading === 'confirming'
                        ? <Clock size={14} className="animate-spin" />
                        : <CheckCircle2 size={14} />}
                      {actionLoading === 'confirming' ? 'Confirming...' : 'Confirm Received'}
                    </button>
                    <button
                      onClick={async () => {
                        setSettlementActionLoading(prev => ({ ...prev, [notif.id]: 'declining' }));
                        try {
                          await declinePaymentReceived(notif.id);
                        } catch (err) {
                          console.error('Error declining payment:', err);
                        } finally {
                          setSettlementActionLoading(prev => ({ ...prev, [notif.id]: null }));
                        }
                      }}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition text-sm disabled:opacity-60"
                    >
                      {actionLoading === 'declining'
                        ? <Clock size={14} className="animate-spin" />
                        : <XCircle size={14} />}
                      {actionLoading === 'declining' ? 'Declining...' : 'Did Not Receive'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock size={20} className="text-orange-600 dark:text-orange-400" />
                Pending Invitations ({pendingInvitations.length})
              </h3>
            </div>

            <div className="space-y-3">
              {pendingInvitations.map((invitation) => {
                const createdAt = invitation.createdAt?.toDate?.() || new Date(invitation.createdAt);
                const timeAgo = formatTimeAgo(createdAt);

                return (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Mail size={20} className="text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {invitation.toUserName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {invitation.toUserEmail}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Invited {timeAgo}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (window.confirm('Resend invitation?')) {
                            await sendInvitation(
                              user,
                              invitation.toUserId,
                              group.id,
                              group.name
                            );
                            alert('Invitation resent!');
                          }
                        }}
                        className="px-3 py-1.5 text-sm border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40 transition"
                      >
                        Resend
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm('Cancel this invitation?')) {
                            const result = await cancelInvitation(invitation.id, user.uid);
                            if (result.success) {
                              setPendingInvitations(prev => 
                                prev.filter(inv => inv.id !== invitation.id)
                              );
                              alert('Invitation cancelled');
                            }
                          }
                        }}
                        className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Members Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Members</h3>
            <button
              onClick={() => setShowShareModal(true)}
              className="text-primary dark:text-indigo-400 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              <UserPlus size={16} />
              Invite
            </button>
          </div>

          <div className="space-y-3">
            {group.members?.map((member, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 rounded-lg shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center overflow-hidden">
                    {memberPhotos[member.userId] ? (
                      <img
                        src={memberPhotos[member.userId]}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-primary dark:text-indigo-400 font-semibold">
                        {member.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                      {memberPaymentMethods[member.userId]?.encryptedIBAN && (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-800">
                          <Landmark size={12} />
                          <span>SEPA Ready</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {member.role === 'owner' && (
                  <span className="text-xs bg-primary-light dark:bg-indigo-900/30 text-primary dark:text-indigo-400 px-2 py-1 rounded">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Settlements Section */}
        {expenses.length > 0 && settlements.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Settlement Summary
            </h3>
            <div className="space-y-3">
              {settlements.map((settlement, index) => {
                const fromMember = group.members?.find(m => m.userId === settlement.from);
                const toMember = group.members?.find(m => m.userId === settlement.to);
                
                const userIsPaying = user.uid === settlement.from;
                const userIsReceiving = user.uid === settlement.to;
                const userIsInvolved = userIsPaying || userIsReceiving;
                
                return (
                  <div
                    key={index}
                    className="p-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-700 dark:via-gray-750 dark:to-gray-700 rounded-lg shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 border border-gray-100 dark:border-gray-600"
                  >
                    {/* Mobile: Stacked Layout */}
                    <div className="md:hidden space-y-3">
                      {/* From Member */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {memberPhotos[settlement.from] ? (
                            <img
                              src={memberPhotos[settlement.from]}
                              alt={fromMember?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-orange-600 dark:text-orange-400 font-semibold">
                              {fromMember?.name?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{fromMember?.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">owes</p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-center py-2">
                        <p className="text-2xl font-bold text-primary dark:text-indigo-400">
                          {group.currency} {settlement.amount.toFixed(2)}
                        </p>
                      </div>

                      {/* To Member */}
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">to</p>
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {memberPhotos[settlement.to] ? (
                            <img
                              src={memberPhotos[settlement.to]}
                              alt={toMember?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              {toMember?.name?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{toMember?.name || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Horizontal Layout */}
                    <div className="hidden md:flex items-center justify-between gap-3 mb-3">
                      {/* From Member */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {memberPhotos[settlement.from] ? (
                            <img
                              src={memberPhotos[settlement.from]}
                              alt={fromMember?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-orange-600 dark:text-orange-400 font-semibold">
                              {fromMember?.name?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {fromMember?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">owes</p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="flex-shrink-0">
                        <p className="text-lg font-bold text-primary dark:text-indigo-400 whitespace-nowrap">
                          {group.currency} {settlement.amount.toFixed(2)}
                        </p>
                      </div>

                      {/* To Member */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">to</p>
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {memberPhotos[settlement.to] ? (
                            <img
                              src={memberPhotos[settlement.to]}
                              alt={toMember?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              {toMember?.name?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {toMember?.name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Button - Both Layouts */}
                    <div className="md:mt-3">
                      {userIsInvolved ? (
                        <button
                          onClick={() => setSelectedSettlement(settlement)}
                          className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                            userIsPaying
                              ? 'bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white hover:shadow-lg transform hover:scale-[1.02]'
                              : 'bg-success text-white hover:opacity-90'
                          }`}
                        >
                          {userIsPaying ? `Pay ${group.currency}${settlement.amount.toFixed(2)}` : 'Mark as Received'}
                        </button>
                      ) : (
                        <div className="w-full text-center py-2 text-sm text-gray-400 dark:text-gray-500 italic">
                          Not involved
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {settlements.length === 0 && (
              <div className="text-center py-6 flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
                <p className="text-green-600 dark:text-green-400 font-semibold">Everyone is settled up!</p>
              </div>
            )}
          </div>
        )}


        {/* Balances Breakdown */}
        {expenses.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Individual Balances
            </h3>
            <div className="space-y-2">
              {group.members?.map((member) => {
                const balance = balances[member.userId] || 0;
                const isSettled = Math.abs(balance) < 0.01;
                
                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                        isSettled ? 'bg-gray-200 dark:bg-gray-600' :
                        balance > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
                      }`}>
                        {memberPhotos[member.userId] ? (
                          <img
                            src={memberPhotos[member.userId]}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className={`font-semibold ${
                            isSettled ? 'text-gray-600 dark:text-gray-400' :
                            balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {member.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* USER NAME HERE! */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{member.name}</p>
                        {member.userId === user.uid && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">(You)</span>
                        )}
                      </div>
                    </div> 
                    
                    <div className="text-right">
                      {isSettled ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Settled</span>
                      ) : balance > 0 ? (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">gets back</p>
                          <p className="font-bold text-green-600 dark:text-green-400">
                            {group.currency} {balance.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">owes</p>
                          <p className="font-bold text-orange-600 dark:text-orange-400">
                            {group.currency} {Math.abs(balance).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}   
        
        {/* My Payment Activity - payer's personal record of all payments sent in this group.
            Sourced from payment_log notifications in the existing notifications collection. */}
        {groupPaymentLog.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
            {/* Collapsible header */}
            <button
              type="button"
              onClick={() => setShowPaymentHistory(prev => !prev)}
              className="w-full flex items-center justify-between mb-1"
            >
              <div className="flex items-center gap-2">
                <DollarSign size={20} className="text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  My Payment Activity
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full">
                  {groupPaymentLog.length}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${showPaymentHistory ? 'rotate-180' : ''}`}
              />
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-left">
              Payments you have initiated — awaiting confirmation, confirmed, or declined.
            </p>

            {showPaymentHistory && (
              <div className="space-y-3">
                {groupPaymentLog.map((record) => {
                  // payment_log uses notification-level status field
                  const status = record.status || 'pending_confirmation';
                  const pd = record.data || {};

                  const statusConfig = {
                    pending_confirmation: {
                      label: 'Awaiting Confirmation',
                      icon: <Clock size={14} className="text-amber-600 dark:text-amber-400" />,
                      pill: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                      border: 'border-amber-200 dark:border-amber-800',
                      bg: 'bg-amber-50 dark:bg-amber-900/10',
                      hint: `Waiting for ${pd.payeeName} to confirm receipt.`,
                    },
                    confirmed: {
                      label: 'Confirmed',
                      icon: <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />,
                      pill: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
                      border: 'border-green-200 dark:border-green-800',
                      bg: 'bg-green-50 dark:bg-green-900/10',
                      hint: `${pd.payeeName} confirmed receiving this payment. Balance updated.`,
                    },
                    declined: {
                      label: 'Not Confirmed',
                      icon: <XCircle size={14} className="text-red-600 dark:text-red-400" />,
                      pill: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                      border: 'border-red-200 dark:border-red-800',
                      bg: 'bg-red-50 dark:bg-red-900/10',
                      hint: `${pd.payeeName} could not confirm this payment. Use Retry to try again.`,
                    },
                  };

                  const cfg = statusConfig[status] || statusConfig.pending_confirmation;
                  const date = formatDate(record.createdAt);

                  return (
                    <div
                      key={record.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border ${cfg.border} ${cfg.bg} transition-all duration-200`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm">
                        <DollarSign size={18} className="text-indigo-500 dark:text-indigo-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {pd.currency} {Number(pd.amount).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            to {pd.payeeName}
                          </span>
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.pill}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1 flex-wrap">
                          <span className="uppercase font-medium tracking-wide">{pd.method}</span>
                          <span>•</span>
                          <span>{date}</span>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          {cfg.hint}
                        </p>

                        {/* Retry button only appears when the payment was declined */}
                        {status === 'declined' && (
                          <button
                            type="button"
                            onClick={() => {
                              const matching = settlements.find(
                                s => s.from === user.uid && s.to === pd.payeeId
                              );
                              if (matching) setSelectedSettlement(matching);
                            }}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 dark:bg-indigo-700 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition"
                          >
                            <DollarSign size={12} />
                            Retry Payment
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Expenses Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/50 p-6">
          {/* Modified Header - Collapsible */}
          <div className="flex items-center justify-between mb-4">
            <div 
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => setShowRecentExpenses(!showRecentExpenses)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Expenses</h3>
                  <ChevronDown 
                    size={20} 
                    className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${
                      showRecentExpenses ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                {expenses.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {expenses.length} expense{expenses.length !== 1 ? 's' : ''} • Total: {group.currency} {expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent collapse when clicking Add
                setShowAddExpense(true);
              }}
              className="text-primary dark:text-indigo-400 text-sm font-medium flex items-center gap-1 hover:underline transition-all duration-300 transform hover:scale-105"
            >
              <Plus size={16} />
              Add Expense
            </button>
          </div>

          {/* Collapsible Content - ALL YOUR EXISTING CODE */}
          {showRecentExpenses && (
            <>
              {loadingExpenses ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-indigo-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm">Loading expenses...</p>
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📊</div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">No expenses yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Add your first expense to start tracking
                  </p>
                  <button
                    onClick={() => setShowAddExpense(true)}
                    className="bg-primary dark:bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition"
                  >
                    Add First Expense
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map((expense) => {
                    const payer = group.members?.find(m => m.userId === expense.paidBy);
                    const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);

                    return (
                      <div
                        key={expense.id}
                        onClick={() => setSelectedExpense(expense)}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary dark:hover:border-indigo-500 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-card-hover dark:hover:shadow-gray-900/50 cursor-pointer bg-white dark:bg-gray-700 shadow-card dark:shadow-gray-900/50"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-0 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">{getDisplayTitle(expense)}</h4>
                
                              {/* Category Icon Badge */}
                              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                                {(() => {
                                  const CategoryIcon = getCategoryIcon(expense.category);
                                  return <CategoryIcon size={14} className="text-gray-600 dark:text-gray-400" />;
                                })()}
                                <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{expense.category}</span>
                              </div>
                            </div>
              
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Paid by {payer?.name || 'Unknown'}
                            </p>
                            {expense.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{expense.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {expense.currency} {expense.amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {expenseDate.toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <Users size={14} className="text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Split {expense.splitMethod} among {expense.participants?.length || 0} member
                            {expense.participants?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      
      </div>
      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showAddExpense}
        onClose={() => {
          setShowAddExpense(false);
          setEditingExpense(null);
        }}
        group={group}
        initialExpense={editingExpense}
      />
      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={!!selectedSettlement}
        onClose={() => {
          setSelectedSettlement(null);
          // Clear banner if payment was confirmed
          const pending = sessionStorage.getItem('pendingPayment');
          if (!pending) {
            setPendingPaymentBanner(null);
          }
        }}
        settlement={selectedSettlement}
        group={group}
        currentUserId={user.uid}
      />

      {/* Expense Details Modal */}
      <ExpenseDetailsModal
        isOpen={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        group={group}
        currentUserId={user.uid}
        groupExpenses={expenses}
        onEdit={(expense) => {
          setSelectedExpense(null);
          setEditingExpense(expense);
          setShowAddExpense(true);
        }}
        onDeleted={() => setSelectedExpense(null)}
      />

      {/* Share Invite Modal */}
      <ShareInviteModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        inviteLink={`${process.env.REACT_APP_BASE_URL || window.location.origin}/invite/${groupId}`}
        groupName={group?.name}
      />
    {/* ── Leave Group Confirmation Modal ──────────────────────────────────── */}
      {showConfirmLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-center w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full mx-auto mb-4">
              <LogOut size={28} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">Leave Group</h3>

            {leaveBlockReason ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
                  You cannot leave <strong>{group.name}</strong> yet.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-5 text-center">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    You {leaveBlockReason.direction}{' '}
                    <span className="text-amber-900 dark:text-amber-200">
                      {leaveBlockReason.currency} {leaveBlockReason.amount}
                    </span>
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Settle all balances before leaving.
                  </p>
                </div>
                <button
                  onClick={() => { setShowConfirmLeave(false); setLeaveBlockReason(null); }}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
                >
                  OK, Got It
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  Are you sure you want to leave <strong>{group.name}</strong>? You will lose access to this group.
                </p>
                {groupActionError && (
                  <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">{groupActionError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowConfirmLeave(false); setGroupActionError(''); }}
                    disabled={groupActionLoading}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeaveGroup}
                    disabled={groupActionLoading}
                    className="flex-1 px-4 py-3 bg-amber-500 dark:bg-amber-600 text-white rounded-lg hover:bg-amber-600 dark:hover:bg-amber-700 transition font-medium disabled:opacity-50"
                  >
                    {groupActionLoading ? 'Leaving...' : 'Leave Group'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Group Confirmation Modal ─────────────────────────────────── */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-center w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto mb-4">
              <Trash2 size={28} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">Delete Group</h3>

            {deleteBlockReason ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
                  Cannot delete <strong>{group.name}</strong>. These members still have outstanding balances:
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 space-y-1 max-h-40 overflow-y-auto">
                  {deleteBlockReason.map((m, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-red-800 dark:text-red-300 font-medium">{m.name}</span>
                      <span className="text-red-700 dark:text-red-400">{m.currency} {m.amount}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-5">
                  All members must settle before the group can be deleted.
                </p>
                <button
                  onClick={() => { setShowConfirmDelete(false); setDeleteBlockReason(null); }}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
                >
                  OK, Got It
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                  Are you sure you want to permanently delete <strong>{group.name}</strong>?
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 text-center mb-4">
                  All expenses will be deleted and all members will be notified. This cannot be undone.
                </p>

                {/* Password input — only shown for email/password users without biometric */}
                {!user.providerData?.some(p => p.providerId === 'google.com') &&
                  !isBiometricEnabledOnDevice(user.uid) && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Enter your password to confirm
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}

                {(deleteAuthError || groupActionError) && (
                  <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">
                    {deleteAuthError || groupActionError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowConfirmDelete(false); setGroupActionError(''); setDeleteAuthError(''); setDeletePassword(''); }}
                    disabled={groupActionLoading || deleteAuthLoading}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAuthAndDelete}
                    disabled={groupActionLoading || deleteAuthLoading}
                    className="flex-1 px-4 py-3 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition font-medium disabled:opacity-50"
                  >
                    {(groupActionLoading || deleteAuthLoading) ? 'Verifying...' : 'Delete Group'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}