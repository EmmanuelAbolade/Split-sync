// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import CreateGroupModal from '../components/CreateGroupModal';
import { Home, Plane, Pizza, PartyPopper, Car, Palmtree, Gamepad2, Heart, Users, ShoppingCart, Coffee, Utensils, Music, Briefcase, GraduationCap, Gift } from 'lucide-react';

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
  const navigate = useNavigate();
  
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch user's groups in real-time
  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)  // ✅ FIXED! Query simple array
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
    console.log('Group created:', groupId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900"> SplitSync</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.displayName || 'there'}! 
          </h2>
          <p className="text-gray-600">
            Manage your shared expenses and settle up with friends
          </p>
        </div>

        {/* Your Groups Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Your Groups</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-primary to-primary-dark text-white px-4 py-2 rounded-lg hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              Create Group
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading groups...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && groups.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No groups yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first group to start tracking shared expenses
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-primary to-primary-dark text-white px-4 py-2 rounded-lg hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
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
                      className="group bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-2 active:translate-y-0 p-6 cursor-pointer border border-gray-100 hover:border-primary animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                    <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center flex-shrink-0 shadow-card transform transition-transform group-hover:scale-110 group-hover:rotate-6">
                        <IconComponent className="text-white" size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-lg mb-1 truncate">
                            {group.name}
                        </h4>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Users size={14} />
                            {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    </div>
          
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Currency</span>
                        <span className="font-semibold text-gray-900">{group.currency}</span>
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
    </div>
  );
}