// src/pages/Dashboard.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import CreateGroupModal from '../components/CreateGroupModal';
import { Home, Plane, Pizza, PartyPopper, Car, Palmtree, Gamepad2, Heart, Users, ShoppingCart, Coffee, Utensils, Music, Briefcase, GraduationCap, Gift, Settings, Bell, TrendingDown, TrendingUp, Layers, AlertCircle,  ArrowRightCircle } from 'lucide-react';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import InvitationNotification from '../components/InvitationNotification';
import OnboardingWizard from "../components/OnboardingWizard";
import NotificationsDropdown from '../components/NotificationsDropdown'; 
import { useNotificationsStore } from '../stores/notificationsStore';
import { calculateBalances, getUserBalanceSummary } from '../utils/balanceCalculator';
import { isActiveMember } from '../utils/memberDirectory';
import { loadMyPrivateDetails } from '../utils/privateProfile';

// Icon name to component mapping
const ICON_MAP = {
  home: Home,
  plane: Plane,
  pizza: Pizza,
  party: PartyPopper,
  car: Car,
  beach: Palmtree,
  game: Gamepad2,
  heart: Heart,
  users: Users,
  shopping: ShoppingCart,
  coffee: Coffee,
  dining: Utensils,
  music: Music,
  work: Briefcase,
  study: GraduationCap,
  gift: Gift,
};


function getIconComponent(iconName) {
  return ICON_MAP[iconName] || Home;
}

// Cycling tagline — rotates through phrases with a smooth fade transition
// Sits under the welcome greeting to give the dashboard a living feel
const TAGLINES = [
  'Any shared expense to split?',
  'Split smart. Settle fast. Stay balanced.',
  'Sort out who owes what, the easy way.',
  'Keep it fair, keep it simple — settle up.',
  'Keep relationships sync and smooth.',
];

function CyclingTagline() {
  const [index,   setIndex]   = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setVisible(false);
      setTimeout(() => {
        // Swap text then fade back in
        setIndex(prev => (prev + 1) % TAGLINES.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className="text-xs font-medium tracking-wide text-indigo-400 dark:text-indigo-500 mb-1 mt-0.5"
      style={{
        opacity:    visible ? 1 : 0,
        transition: 'opacity 400ms ease-in-out',
        minHeight:  '1.2rem',
      }}
    >
      {TAGLINES[index]}
    </p>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();
  const [hasPayment, setHasPayment] = useState(true);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [groupBalances, setGroupBalances] = useState({}); // groupId -> { status, amount, currency }
  const [pendingConfirmation, setPendingConfirmation] = useState(null); // first pending payment notification
  const [isAdmin, setIsAdmin] = useState(false);

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount, notifications } = useNotificationsStore();

  // First pending payment confirmation for the banner
  useEffect(() => {
    const pending = notifications.find(
      n => n.type === 'payment_confirmation_needed' && n.requiresAction && !n.read
    );
    setPendingConfirmation(pending || null);
  }, [notifications]);

  // Aggregate totals across all groups
  const overviewStats = useMemo(() => {
    let totalOwe = {};
    let totalOwed = {};
    let oweCount = 0;
    let owedCount = 0;
    let highestDebt = null; // { amount, currency, groupId, groupName }

    Object.entries(groupBalances).forEach(([groupId, bal]) => {
      if (bal.status === 'owes') {
        totalOwe[bal.currency] = (totalOwe[bal.currency] || 0) + bal.amount;
        oweCount++;
        // Track the single highest debt for the settlement suggestion
        if (!highestDebt || bal.amount > highestDebt.amount) {
          const group = groups.find(g => g.id === groupId);
          highestDebt = {
            amount: bal.amount,
            currency: bal.currency,
            groupId,
            groupName: group?.name || '',
          };
        }
      } else if (bal.status === 'owed') {
        totalOwed[bal.currency] = (totalOwed[bal.currency] || 0) + bal.amount;
        owedCount++;
      }
    });

    return { totalOwe, totalOwed, oweCount, owedCount, highestDebt };
  }, [groupBalances, groups]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) return;
      try {
        const token = await auth.currentUser.getIdTokenResult(true);
        setIsAdmin(token.claims.admin === true);
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);

          // Check if user has at least one payment method (stored privately)
          const { paymentMethods: pm } = await loadMyPrivateDetails(user.uid);
          // pm.iban: plain-text IBAN saved by versions before Feb 2026 (being encrypted on load)
          const hasPayment =
            !!pm?.paypalUsername || !!pm?.revolutUsername || !!pm?.encryptedIBAN || !!pm?.iban;

          setHasPayment(hasPayment);


          // If first login, show onboarding wizard
          if (data.isFirstLogin) {
            setShowOnboarding(true);
          }

          // Reopen wizard if triggered from Settings
          const shouldReopen = localStorage.getItem('splitsync_reopen_wizard');
          if (shouldReopen) {
            localStorage.removeItem('splitsync_reopen_wizard');
            setShowOnboarding(true);
          }

          
          // Mark first login as complete
          if (data.isFirstLogin) {
            await updateDoc(doc(db, 'users', user.uid), {
              isFirstLogin: false,
              lastLoginAt: new Date(),
            });
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    
    fetchUserData();
  }, [user]);
  
  
  // Fetch user's groups in real-time and calculate balances
  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(groupsQuery, async (snapshot) => {
      // memberIds may still list people who left before leave-group cleared it
      const allGroups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      const groupsData = allGroups.filter(g => isActiveMember(g, user.uid));
      setGroups(groupsData);

      // Self-heal legacy data: remove this user from memberIds of groups they
      // already left, and record a name snapshot so history keeps their name.
      allGroups
        .filter(g => !isActiveMember(g, user.uid))
        .forEach(g => {
          try {
          const alreadyRecorded = g.formerMembers?.some(m => m.userId === user.uid);
          updateDoc(doc(db, 'groups', g.id), {
            memberIds: arrayRemove(user.uid),
            ...(!alreadyRecorded && {
              formerMembers: arrayUnion({
                userId: user.uid,
                name: user.displayName || user.email || 'Former member',
                email: user.email || '',
                leftAt: new Date(),
                reason: 'left',
              }),
            }),
          }).catch(err => console.warn('[Dashboard] legacy membership cleanup failed:', err?.code));
          } catch (err) {
            console.warn('[Dashboard] legacy membership cleanup skipped:', err?.message);
          }
        });

      // Fetch expenses for each group and calculate user balance
      const balanceMap = {};
      await Promise.all(
        groupsData.map(async (group) => {
          try {
            const expSnap = await getDocs(
              query(collection(db, 'expenses'), where('groupId', '==', group.id))
            );
            const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const balances = calculateBalances(expenses, group.members || []);
            const summary = getUserBalanceSummary(balances, user.uid, group.members || []);
            balanceMap[group.id] = {
              status: summary.status,
              amount: summary.amount,
              currency: group.currency,
            };
          } catch (e) {
            console.error('[Dashboard] balance fetch error', group.id, e);
          }
        })
      );
      setGroupBalances(balanceMap);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching groups:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleGroupCreated = (groupId) => {
    // Groups will update automatically via real-time listener
  };

  const [invitationCount, setInvitationCount] = useState(0);
  const [showInvitations, setShowInvitations] = useState(true);

  // Play sound or show toast when new invitations arrive
  useEffect(() => {
    if (invitationCount > 0) {
      // Play sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(err => console.log('Audio play failed:', err));
      
      // Or show toast
      alert(`🔔 You have ${invitationCount} new invitation(s)!`);
    }
  }, [invitationCount]);

  // Listen for real-time invitation changes/notifications
  useEffect(() => {
    if (!user) return;
    
    // Listen for real-time invitation changes
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(invitationsQuery, (snapshot) => {
      const count = snapshot.docs.length;
      setInvitationCount(count);
    });
    
    return () => unsubscribe();
  }, [user]);


  // Handle invitation count updates
  const handleInvitationUpdate = (count) => {
    setInvitationCount(count);
    
    // Auto-hide if no invitations
    if (count === 0) {
      setShowInvitations(false);
    } else {
      setShowInvitations(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Invitation Notifications */}
      {user && showInvitations && invitationCount > 0 && (
        <div className="mb-6 animate-scale-in">
          <InvitationNotification
            user={user}
            onInvitationUpdate={handleInvitationUpdate}
          />
        </div>
      )}

      {/* payment notification banner UI */}
      {!hasPayment && (
        <div className="mb-4 p-4 rounded-xl border border-yellow-300
                        bg-yellow-50 text-yellow-800
                        dark:bg-yellow-900/20 dark:text-yellow-300
                        dark:border-yellow-700">

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">
                Payment method not set
              </p>
              <p className="text-xs mt-1">
                Add at least one payment method to receive settlements faster.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="ml-4 px-3 py-2 rounded-lg text-sm
                        bg-primary text-white hover:bg-primary-hover
                        dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              Set Up
            </button>
          </div>
        </div>
      )}



      <OnboardingWizard
        open={showOnboarding}
        navigate={navigate}
        onClose={() => setShowOnboarding(false)}
        onFinish={async () => {
          setShowOnboarding(false);

          // Optional: store a “tour completed” flag too (separate from isFirstLogin)
          await updateDoc(doc(db, "users", user.uid), {
            onboardingCompletedAt: new Date(),
          });
        }}
      />


      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <img 
            src="/logo.png" 
            alt="Split-Sync" 
            className="h-10 w-auto cursor-pointer"
            onClick={() => isAdmin ? navigate('/taskmaster') : navigate('/dashboard')}
            title={isAdmin ? 'Open Taskmaster' : 'Go to dashboard'}
          />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <Settings size={24} />
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary-dark shadow-card-hover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400 dark:hover:ring-indigo-500 transition"
              onClick={() => navigate('/profile')}
              title="Go to your profile"
            >
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {userData?.isFirstLogin === false
                  ? `Welcome back, ${user?.displayName?.split(' ')[0] || 'there'}!`
                  : `Welcome, ${user?.displayName?.split(' ')[0] || 'there'}!`}
              </h2>
              <CyclingTagline />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              
            </div>
          </div>
        </div>

        {/* Overview stat cards */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Overview</p>

          {/* Row 1 — financial summary */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {/* You owe */}
            <div
              onClick={() => navigate('/activity', { state: { filter: 'owe' } })}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown size={13} className="text-orange-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">You owe</p>
              </div>
              {Object.keys(overviewStats.totalOwe).length === 0 ? (
                <p className="text-base font-semibold text-gray-400 dark:text-gray-500">—</p>
              ) : (
                Object.entries(overviewStats.totalOwe).map(([cur, amt]) => (
                  <p key={cur} className="text-base font-semibold text-orange-600 dark:text-orange-400">
                    {cur} {amt.toFixed(2)}
                  </p>
                ))
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {overviewStats.oweCount > 0 ? `${overviewStats.oweCount} group${overviewStats.oweCount !== 1 ? 's' : ''}` : 'all settled'}
              </p>
            </div>

            {/* Owed to you */}
            <div
              onClick={() => navigate('/activity', { state: { filter: 'paid' } })}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 cursor-pointer hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/10 transition"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={13} className="text-green-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Owed to you</p>
              </div>
              {Object.keys(overviewStats.totalOwed).length === 0 ? (
                <p className="text-base font-semibold text-gray-400 dark:text-gray-500">—</p>
              ) : (
                Object.entries(overviewStats.totalOwed).map(([cur, amt]) => (
                  <p key={cur} className="text-base font-semibold text-green-600 dark:text-green-400">
                    {cur} {amt.toFixed(2)}
                  </p>
                ))
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {overviewStats.owedCount > 0 ? `${overviewStats.owedCount} group${overviewStats.owedCount !== 1 ? 's' : ''}` : 'nothing yet'}
              </p>
            </div>

            {/* Groups count */}
            <div
              onClick={() => document.getElementById('groups-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={13} className="text-indigo-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Groups</p>
              </div>
              <p className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                {groups.length}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">active</p>
            </div>
          </div>

          
        </div>

        {/* Suggested settlement — only shown when user has a debt */}
        {overviewStats.highestDebt && (
          <div className="mb-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
              <ArrowRightCircle size={12} />
              Suggested settlement
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {overviewStats.highestDebt.groupName}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Highest outstanding debt
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-base font-semibold text-orange-600 dark:text-orange-400">
                  {overviewStats.highestDebt.currency} {overviewStats.highestDebt.amount.toFixed(2)}
                </p>
                <button
                  onClick={() => navigate(`/group/${overviewStats.highestDebt.groupId}`)}
                  className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition whitespace-nowrap"
                >
                  Settle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending payment confirmation banner */}
        {pendingConfirmation && (
          <div className="mb-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Payment awaiting confirmation
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {pendingConfirmation.message || 'Someone has sent you a payment — confirm receipt.'}
              </p>
            </div>
            <button
              onClick={() => {
                const groupId = pendingConfirmation.data?.groupId;
                if (groupId) navigate(`/group/${groupId}`);
              }}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
            >
              Review
            </button>
          </div>
        )}

        {/* Groups section */}
        <div id="groups-section" className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Your groups</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-card-hover transition-all duration-300 flex items-center gap-2"
            >
              + Create group
            </button>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading groups...</p>
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-10 text-center">
              <Users size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No groups yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Create your first group to start tracking shared expenses
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:shadow-card-hover transition-all duration-300"
              >
                Create your first group
              </button>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group, index) => {
                const IconComponent = getIconComponent(group.icon);
                const bal = groupBalances[group.id];
                return (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/group/${group.id}`)}
                    className="group bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 p-8 cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-indigo-500 flex items-center gap-4 animate-slide-up"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-card transform transition-transform group-hover:scale-110 group-hover:rotate-6">
                      <IconComponent className="text-white" size={34} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <Users size={18} />
                        {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                        <span className="mx-1">·</span>
                        {group.currency}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {!bal ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500">—</p>
                      ) : bal.status === 'settled' ? (
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">Settled</p>
                      ) : bal.status === 'owed' ? (
                        <>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                            +{group.currency} {bal.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">owed to you</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            -{group.currency} {bal.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">you owe</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGroupCreated={handleGroupCreated}
      />

      {/* Notifications Dropdown */}
      <NotificationsDropdown
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}
