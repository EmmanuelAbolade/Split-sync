// src/pages/JoinGroup.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { Users, CheckCircle } from 'lucide-react';

export default function JoinGroup() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [inviterName, setInviterName] = useState(''); // ✅ ADDED

  useEffect(() => {
    const fetchGroup = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        
        if (!groupDoc.exists()) {
          setError('Group not found. The invite link may be invalid.');
          setLoading(false);
          return;
        }

        const groupData = { id: groupDoc.id, ...groupDoc.data() };
        setGroup(groupData);

        // ✅ ADDED: Get inviter name
        const creatorMember = groupData.members?.find(
          m => m.userId === groupData.createdBy
        );
        if (creatorMember) {
          setInviterName(creatorMember.name);
        }

        // Check if user is already a member
        const isMember = groupData.memberIds?.includes(user.uid);
        setAlreadyMember(isMember);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching group:', err);
        setError('Failed to load group. Please try again.');
        setLoading(false);
      }
    };

    fetchGroup();
  }, [groupId, user, navigate]);

  const handleJoinGroup = async () => {
    if (!user || !group) return;

    setJoining(true);
    setError('');

    try {
      const newMember = {
        userId: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        role: 'member',
        joinedAt: new Date(),
      };

      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(newMember),
        memberIds: arrayUnion(user.uid),
      });

      // Navigate to group after joining
      setTimeout(() => {
        navigate(`/group/${groupId}`);
      }, 1500);
    } catch (err) {
      console.error('Error joining group:', err);
      setError('Failed to join group. Please try again.');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid Invite</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-primary dark:bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-8 max-w-md w-full text-center">
          <CheckCircle className="text-green-500 dark:text-green-400 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Already a Member</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            You're already part of <span className="font-semibold">{group?.name}</span>!
          </p>
          <button
            onClick={() => navigate(`/group/${groupId}`)}
            className="bg-primary dark:bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition mt-6"
          >
            View Group
          </button>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Joining group...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="text-primary dark:text-indigo-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {/* ✅ CHANGED: Show inviter name */}
            {inviterName ? 'You\'re Invited!' : 'Join Group'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {/* ✅ CHANGED: Personalized message */}
            {inviterName 
              ? `${inviterName} invited you to join` 
              : 'You\'ve been invited to join'
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            {group?.name}
          </h2>
          <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300">
            <Users size={16} />
            <span className="text-sm">
              {group?.members?.length || 0} member{group?.members?.length !== 1 ? 's' : ''}
            </span>
            <span className="mx-2">•</span>
            <span className="text-sm">{group?.currency}</span>
          </div>
          {/* ✅ ADDED: Show inviter wants to share with you */}
          {inviterName && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              {inviterName} wants to share expenses with you
            </p>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💰</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Track Expenses</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Record shared expenses easily</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">See Balances</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Know who owes what instantly</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Settle Up</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Record payments when settled</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleJoinGroup}
          className="w-full bg-primary dark:bg-indigo-600 text-white px-6 py-4 rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition text-lg font-semibold"
        >
          Join {group?.name}
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full mt-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
