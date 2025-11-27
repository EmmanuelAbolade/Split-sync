// src/pages/GroupDetails.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { 
  Home, Plane, Pizza, PartyPopper, Car, Palmtree, 
  Gamepad2, Heart, Users, ShoppingCart, Coffee, 
  Utensils, Music, Briefcase, GraduationCap, Gift,
  ArrowLeft, UserPlus, Plus, Link as LinkIcon
} from 'lucide-react';

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

export default function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteLink, setShowInviteLink] = useState(false);

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

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/invite/${groupId}`;
    navigator.clipboard.writeText(inviteLink);
    setShowInviteLink(true);
    setTimeout(() => setShowInviteLink(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading group...</p>
        </div>
      </div>
    );
  }

  if (!group) return null;

  const IconComponent = getIconComponent(group.icon);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">💰 SplitSync</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Group Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <IconComponent className="text-white" size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {group.name}
              </h2>
              <p className="text-gray-600 flex items-center gap-2">
                <Users size={16} />
                {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                <span className="mx-2">•</span>
                {group.currency}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={copyInviteLink}
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <LinkIcon size={18} />
              {showInviteLink ? 'Link Copied!' : 'Invite Link'}
            </button>
            <button
              className="flex-1 bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary-hover transition flex items-center justify-center gap-2"
              onClick={() => alert('Add Expense - Coming in Day 4!')}
            >
              <Plus size={18} />
              Add Expense
            </button>
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Members</h3>
            <button
              onClick={copyInviteLink}
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              <UserPlus size={16} />
              Invite
            </button>
          </div>

          <div className="space-y-3">
            {group.members?.map((member, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {member.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                {member.role === 'owner' && (
                  <span className="text-xs bg-primary-light text-primary px-2 py-1 rounded">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Expenses Section - Placeholder */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Expenses</h3>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-600 mb-2">No expenses yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Add your first expense to start tracking
            </p>
            <button
              onClick={() => alert('Add Expense - Coming in Day 4!')}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-hover transition"
            >
              Add First Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}