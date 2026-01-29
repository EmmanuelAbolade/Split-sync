// src/pages/QuickAdd.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, Plus } from 'lucide-react';
import AddExpenseModal from '../components/AddExpenseModal';

export default function QuickAdd() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Bar */}
      <div className="bg-white shadow-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Quick Add Expense</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-gray-600 mb-6">Select a group to add an expense</p>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card p-12 text-center">
            <Plus size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No groups yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create a group first to add expenses
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 py-3 rounded-lg hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleGroupSelect(group)}
                className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-1 p-6 text-left"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-card">
                    <span className="text-white text-xl">
                      {group.icon || '📁'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {group.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {group.members?.length || 0} members • {group.currency}
                    </p>
                  </div>
                  <Plus size={24} className="text-primary" />
                </div>
              </button>
            ))}
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
