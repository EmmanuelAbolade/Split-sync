// src/pages/QuickAdd.jsx
// Quick Add Expense page — lists the user's groups with proper Lucide icons
// and varying colours so users can visually distinguish them at a glance.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import {
  ArrowLeft, Plus,
  Home, Plane, Pizza, PartyPopper, Car, Palmtree,
  Gamepad2, Heart, Users, ShoppingCart, Coffee,
  Utensils, Music, Briefcase, GraduationCap, Gift,
} from 'lucide-react';
import AddExpenseModal from '../components/AddExpenseModal';

// Matches the same icon map used in GroupDetails
const ICON_MAP = {
  home:     Home,
  plane:    Plane,
  pizza:    Pizza,
  party:    PartyPopper,
  car:      Car,
  beach:    Palmtree,
  game:     Gamepad2,
  heart:    Heart,
  users:    Users,
  shopping: ShoppingCart,
  coffee:   Coffee,
  dining:   Utensils,
  music:    Music,
  work:     Briefcase,
  study:    GraduationCap,
  gift:     Gift,
};

// Colour palette — one per icon type for visual variety
const ICON_COLORS = {
  home:     'from-blue-500 to-blue-600',
  plane:    'from-indigo-500 to-indigo-600',
  pizza:    'from-orange-500 to-red-500',
  party:    'from-pink-500 to-rose-500',
  car:      'from-slate-500 to-slate-600',
  beach:    'from-cyan-500 to-teal-500',
  game:     'from-violet-500 to-purple-600',
  heart:    'from-rose-500 to-pink-600',
  users:    'from-blue-600 to-indigo-600',
  shopping: 'from-amber-500 to-orange-500',
  coffee:   'from-yellow-600 to-amber-600',
  dining:   'from-red-500 to-orange-500',
  music:    'from-fuchsia-500 to-purple-500',
  work:     'from-gray-600 to-slate-600',
  study:    'from-emerald-500 to-green-600',
  gift:     'from-pink-400 to-rose-500',
};

function getIconComponent(iconName) {
  return ICON_MAP[iconName] || Home;
}

function getIconColor(iconName) {
  return ICON_COLORS[iconName] || 'from-indigo-500 to-indigo-600';
}

export default function QuickAdd() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [groups,         setGroups]         = useState([]);
  const [selectedGroup,  setSelectedGroup]  = useState(null);
  const [showAddExpense, setShowAddExpense]  = useState(false);

  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(groupsData);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setShowAddExpense(true);
  };

  const handleCloseModal = () => {
    setShowAddExpense(false);
    setSelectedGroup(null);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">

      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Add Expense</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-gray-600 dark:text-gray-300 mb-6">Select a group to add an expense</p>

        {groups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-12 text-center">
            <Plus size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No groups yet
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Create a group first to add expenses
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => {
              const IconComponent = getIconComponent(group.icon);
              const colorClass    = getIconColor(group.icon);
              const isSolo        = (group.members?.length || 0) <= 1;

              return (
                <button
                  key={group.id}
                  onClick={() => !isSolo && handleGroupSelect(group)}
                  disabled={isSolo}
                  title={isSolo ? 'Invite at least one member before adding an expense' : ''}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 transition-all duration-300 p-5 text-left border w-full
                    ${isSolo
                      ? 'border-gray-100 dark:border-gray-700 opacity-60 cursor-not-allowed'
                      : 'border-gray-100 dark:border-gray-700 hover:shadow-card-hover transform hover:-translate-y-1 cursor-pointer'
                    }`}
                >
                  <div className="flex items-center gap-4">

                    {/* Icon with unique colour per group type */}
                    <div className={`w-12 h-12 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center shadow-sm shrink-0`}>
                      <IconComponent size={22} className="text-white" />
                    </div>

                    {/* Group info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate">
                        {group.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''} • {group.currency}
                      </p>
                      {isSolo && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          Invite a member first
                        </p>
                      )}
                    </div>

                    {/* Add icon — only shown when group is active */}
                    {!isSolo && (
                      <Plus size={20} className="text-primary dark:text-indigo-400 shrink-0" />
                    )}

                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {selectedGroup && (
        <AddExpenseModal
          isOpen={showAddExpense}
          onClose={handleCloseModal}
          group={selectedGroup}
        />
      )}
    </div>
  );
}