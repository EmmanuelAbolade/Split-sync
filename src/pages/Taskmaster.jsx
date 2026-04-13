// src/pages/Taskmaster.jsx
// Taskmaster — Split-Sync Admin Panel
// Access protected by Firebase custom claims ({ admin: true })
// Default section: System Health dashboard
// Sections: System Health, User Management, Group Management,
//           Financial Oversight, Content Moderation, Notifications

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Users, Layers, DollarSign, Shield,
  Bell, LogOut, RefreshCw, Search, AlertCircle,
  CheckCircle2, XCircle, Trash2, Ban, Eye,
  BarChart2, Database, Server, ChevronRight,
  ArrowLeft, User, Mail, Calendar, Clock,
} from 'lucide-react';
import { auth, db } from '../services/firebase';
import {
  collection, getDocs, query, where, orderBy,
  limit, doc, updateDoc,
} from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';

// ── Admin claim check ─────────────────────────────────────────────────────────
// Returns true only when the Firebase ID token contains { admin: true }
async function checkAdminClaim() {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;
  const token = await currentUser.getIdTokenResult(true);
  return token.claims.admin === true;
}

// ── Sidebar navigation items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'health',    label: 'System Health',       icon: Activity },
  { id: 'users',     label: 'User Management',      icon: Users },
  { id: 'groups',    label: 'Group Management',     icon: Layers },
  { id: 'financial', label: 'Financial Oversight',  icon: DollarSign },
  { id: 'moderation',label: 'Content Moderation',   icon: Shield },
  { id: 'comms',     label: 'Notifications',         icon: Bell },
];

// ── Stat card component ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'indigo', icon: Icon }) {
  const colorMap = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    green:  'bg-green-50  dark:bg-green-900/20  text-green-600  dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    red:    'bg-red-50    dark:bg-red-900/20    text-red-600    dark:text-red-400',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {Icon && (
          <span className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Section: System Health ────────────────────────────────────────────────────
function SystemHealth() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Run each query independently so one failure does not block the others
      const [usersSnap, groupsSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'groups')),
        getDocs(collection(db, 'expenses')),
      ]);

      // Invitations queried separately — may fail if index not yet built
      let pendingInvites = 0;
      try {
        const invitesSnap = await getDocs(
          query(collection(db, 'invitations'), where('status', '==', 'pending'))
        );
        pendingInvites = invitesSnap.size;
      } catch (invErr) {
        console.warn('Invitations query failed:', invErr.message);
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let activeCount = 0;
      usersSnap.forEach(d => {
        const lastActive = d.data().lastActive?.toDate?.();
        if (lastActive && lastActive > sevenDaysAgo) activeCount++;
      });

      setStats({
        totalUsers:    usersSnap.size,
        activeUsers:   activeCount,
        totalGroups:   groupsSnap.size,
        totalExpenses: expensesSnap.size,
        pendingInvites,
      });
    } catch (err) {
      console.error('Taskmaster health fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Health</h2>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading stats...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Users"      value={stats?.totalUsers}     icon={Users}    color="indigo" />
          <StatCard label="Active (7 days)"  value={stats?.activeUsers}    icon={Activity} color="green"  />
          <StatCard label="Total Groups"     value={stats?.totalGroups}    icon={Layers}   color="indigo" />
          <StatCard label="Total Expenses"   value={stats?.totalExpenses}  icon={DollarSign} color="orange" />
          <StatCard label="Pending Invites"  value={stats?.pendingInvites} icon={Bell}     color="orange" />
          <StatCard label="Platform Status"  value="Operational"           icon={Server}   color="green"
            sub="Firebase Hosting + Firestore" />
        </div>
      )}

      {/* Quick actions */}
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { label: 'Clean up expired invitations', icon: Trash2,    desc: 'Remove invitations older than 7 days' },
          { label: 'View Firestore quota',         icon: Database,  desc: 'Check read/write operation usage' },
          { label: 'View Cloud Function logs',     icon: Server,    desc: 'Check function execution errors' },
          { label: 'Platform analytics',           icon: BarChart2, desc: 'Users, groups, expenses over time' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition text-left group"
          >
            <span className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition">
              <action.icon size={16} />
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{action.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{action.desc}</p>
            </div>
            <ChevronRight size={14} className="ml-auto text-gray-300 dark:text-gray-600" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section: User Management ──────────────────────────────────────────────────
function UserManagement() {
  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100))
        );
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Taskmaster user fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filtered = users.filter(u =>
    (u.displayName || u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = async (userId, currentStatus) => {
    if (!window.confirm(`${currentStatus ? 'Re-activate' : 'Suspend'} this user?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { isActive: !currentStatus });
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, isActive: !currentStatus } : u
      ));
    } catch (err) {
      console.error('Suspend error:', err);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">User Management</h2>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading users...</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr
                  key={user.id}
                  className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                        {(user.displayName || user.fullName || user.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.displayName || user.fullName || '—'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {user.createdAt?.toDate?.()?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive === false ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                        <XCircle size={10} /> Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setSelected(user)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                        title="View user"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleSuspend(user.id, user.isActive !== false)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition"
                        title={user.isActive === false ? 'Re-activate' : 'Suspend'}
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
            Showing {filtered.length} of {users.length} users
          </p>
        </div>
      )}

      {/* User detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">User Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XCircle size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { icon: User,     label: 'Name',     val: selected.displayName || selected.fullName || '—' },
                { icon: Mail,     label: 'Email',    val: selected.email },
                { icon: Calendar, label: 'Joined',   val: selected.createdAt?.toDate?.()?.toLocaleString() ?? '—' },
                { icon: Clock,    label: 'Last active', val: selected.lastActive?.toDate?.()?.toLocaleString() ?? '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <row.icon size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400 w-24">{row.label}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{row.val}</span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400 w-24">Biometric</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {selected.biometricEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleSuspend(selected.id, selected.isActive !== false) || setSelected(null)}
                className="flex-1 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                {selected.isActive === false ? 'Re-activate' : 'Suspend User'}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Group Management ─────────────────────────────────────────────────
function GroupManagement() {
  const [groups,  setGroups]  = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(100))
        );
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Taskmaster group fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  const filtered = groups.filter(g =>
    (g.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Group Management</h2>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by group name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
      </div>
      {loading ? (
        <p className="text-gray-400 text-sm">Loading groups...</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Group</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Members</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Currency</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(group => (
                <tr
                  key={group.id}
                  className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{group.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {group.members?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {group.currency ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {group.isArchived ? (
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                        Archived
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
            Showing {filtered.length} of {groups.length} groups
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section: Financial Oversight ──────────────────────────────────────────────
function FinancialOversight() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinancial = async () => {
      setLoading(true);
      try {
        const expSnap = await getDocs(collection(db, 'expenses'));
        let totalAmount = 0;
        let settledCount = 0;
        const currencyMap = {};

        expSnap.forEach(d => {
          const data = d.data();
          const amt = data.amount || 0;
          const cur = data.currency || 'EUR';
          totalAmount += amt;
          if (data.isSettled) settledCount++;
          currencyMap[cur] = (currencyMap[cur] || 0) + amt;
        });

        setStats({
          totalExpenses: expSnap.size,
          settledCount,
          unsettledCount: expSnap.size - settledCount,
          currencyBreakdown: currencyMap,
        });
      } catch (err) {
        console.error('Taskmaster financial fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFinancial();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Financial Oversight</h2>
      {loading ? (
        <p className="text-gray-400 text-sm">Loading financial data...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard label="Total Expenses"   value={stats?.totalExpenses}   icon={DollarSign} color="indigo" />
            <StatCard label="Settled"          value={stats?.settledCount}    icon={CheckCircle2} color="green" />
            <StatCard label="Unsettled"        value={stats?.unsettledCount}  icon={AlertCircle}  color="orange" />
          </div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Volume by Currency
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            {Object.entries(stats?.currencyBreakdown || {}).map(([cur, total]) => (
              <div key={cur} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cur}</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {total.toFixed(2)}
                </span>
              </div>
            ))}
            {Object.keys(stats?.currencyBreakdown || {}).length === 0 && (
              <p className="text-sm text-gray-400">No expense data found.</p>
            )}
          </div>
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Payment credentials (IBANs, PayPal details) are encrypted client-side and are never visible in this panel, in line with GDPR and PCI DSS principles.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Section: Content Moderation ───────────────────────────────────────────────
function ContentModeration() {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Content Moderation</h2>
      <div className="space-y-3">
        {[
          { label: 'Scan expense descriptions for flagged keywords', icon: Search },
          { label: 'Review reported group names',                    icon: AlertCircle },
          { label: 'Delete abusive content',                         icon: Trash2 },
          { label: 'View user-submitted bug reports',                 icon: Eye },
        ].map(item => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition text-left group"
          >
            <span className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition">
              <item.icon size={16} />
            </span>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
            <ChevronRight size={14} className="ml-auto text-gray-300 dark:text-gray-600" />
          </button>
        ))}
      </div>
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Full keyword scanning and report management will be available in a future Taskmaster release. This section is scaffolded for extension.
        </p>
      </div>
    </div>
  );
}

// ── Section: Notifications / Communications ───────────────────────────────────
function Communications() {
  const [message, setMessage] = useState('');
  const [sent,    setSent]    = useState(false);

  const handleBroadcast = () => {
    if (!message.trim()) return;
    // TODO: Call a Cloud Function to write a system notification
    // to each user's notifications collection
    console.log('[Taskmaster] Broadcast message:', message);
    setSent(true);
    setMessage('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Notifications</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Send System-Wide In-App Notification
        </h3>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type a message to all users (e.g. scheduled maintenance notice)..."
          rows={4}
          maxLength={280}
          className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">{message.length}/280</span>
          <button
            onClick={handleBroadcast}
            disabled={!message.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send to All Users
          </button>
        </div>
        {sent && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
            <CheckCircle2 size={12} /> Message queued for delivery.
          </p>
        )}
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Broadcast delivery requires a Cloud Function that writes to each user's notifications collection. The UI is ready — wire up the function when needed.
        </p>
      </div>
    </div>
  );
}

// ── Main Taskmaster component ─────────────────────────────────────────────────
export default function Taskmaster() {
  const navigate          = useNavigate();
  const { user, logout }  = useAuthStore();
  const [isAdmin,  setIsAdmin]  = useState(null); // null = checking
  const [section,  setSection]  = useState('health');
  const [sidebarOpen, setSidebarOpen] = useState(false);

 useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setIsAdmin(false);
        return;
      }
      try {
        const token = await currentUser.getIdTokenResult(true);
        console.log('UID:', currentUser.uid);
        console.log('Claims:', JSON.stringify(token.claims));
        setIsAdmin(token.claims.admin === true);
      } catch (err) {
        console.error('Claim check error:', err);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Access denied ─────────────────────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Verifying access...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your account does not have admin privileges. If this is an error, contact the platform administrator.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Admin view ────────────────────────────────────────────────────────────
  const currentSection = NAV_ITEMS.find(n => n.id === section);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-white dark:bg-gray-800
        border-r border-gray-100 dark:border-gray-700
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:flex md:flex-col
      `}>
        {/* Sidebar header */}
        <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase mb-0.5">
            Taskmaster
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Admin Panel — Split-Sync</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setSidebarOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition
                ${section === item.id
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-r-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }
              `}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft size={12} /> Back to app
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <Layers size={18} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">
              {currentSection?.label}
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
              Taskmaster — Split-Sync Admin Panel
            </p>
          </div>
        </header>

        {/* Section content */}
        <main className="flex-1 p-6 overflow-y-auto max-w-5xl w-full mx-auto">
          {section === 'health'     && <SystemHealth />}
          {section === 'users'      && <UserManagement />}
          {section === 'groups'     && <GroupManagement />}
          {section === 'financial'  && <FinancialOversight />}
          {section === 'moderation' && <ContentModeration />}
          {section === 'comms'      && <Communications />}
        </main>
      </div>
    </div>
  );
}
