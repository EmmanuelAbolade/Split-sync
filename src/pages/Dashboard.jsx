// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import CreateGroupModal from '../components/CreateGroupModal';
import { Home, Plane, Pizza, PartyPopper, Car, Palmtree, Gamepad2, Heart, Users, ShoppingCart, Coffee, Utensils, Music, Briefcase, GraduationCap, Gift } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Settings, Bell } from 'lucide-react';
import InvitationNotification from '../components/InvitationNotification';
import OnboardingWizard from "../components/OnboardingWizard";
import NotificationsDropdown from '../components/NotificationsDropdown'; 
import { useNotificationsStore } from '../stores/notificationsStore';

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

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();
  const [hasPayment, setHasPayment] = useState(true);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount, subscribeToNotifications } = useNotificationsStore();

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);

          // Check if user has at least one payment method
          const pm = data?.paymentMethods;
          const hasPayment =
            !!pm?.paypalUsername || !!pm?.revolutUsername || !!pm?.encryptedIBAN;

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
  
  
  // Fetch user's groups in real-time
  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );

    // Listen for real-time updates
    const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setGroups(groupsData);
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


  // Subscribe to notifications
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToNotifications(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToNotifications]);


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
            className="h-10 w-auto"
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
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {/* Profile Photo */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary-dark shadow-card-hover">
              {userData?.photoURL ? (
                <img
                  src={userData.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {userData?.isFirstLogin === false 
                  ? `Welcome back, ${user?.displayName || 'there'}!`
                  : `Welcome, ${user?.displayName || 'there'}!`
                }
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Do you have any shared expenses to manage? Settle up with friends and family.
              </p>
            </div>
          </div>
        </div>

        {/* Your Groups Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Your Groups</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              Create Group
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-300">Loading groups...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && groups.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-card dark:shadow-gray-900/50 p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No groups yet
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Create your first group to start tracking shared expenses
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Create Your First Group
              </button>
            </div>
          )}

          {/* Groups Grid */}
          {!loading && groups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group, index) => {
                const IconComponent = getIconComponent(group.icon);
                return (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/group/${group.id}`)}
                    className="group bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:-translate-y-2 active:translate-y-0 p-6 cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-indigo-500 animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-card transform transition-transform group-hover:scale-110 group-hover:rotate-6">
                        <IconComponent className="text-white" size={28} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-lg mb-1 truncate">
                          {group.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Users size={14} />
                          {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
          
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Currency</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{group.currency}</span>
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
