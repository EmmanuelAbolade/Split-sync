// src/pages/Taskmaster.jsx
// Taskmaster — Split-Sync Admin Panel
// Access protected by Firebase custom claims ({ admin: true }); the Firestore
// rules independently restrict what an admin can read and change.
// Sections: System Health, Growth, User Management, Group Management,
//           Financial Oversight, Content Moderation, Notifications

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Users, Layers, DollarSign, Shield,
  Bell, LogOut, RefreshCw, Search, AlertCircle,
  CheckCircle2, XCircle, Trash2, Ban, Eye,
  BarChart2, Database, Server, ChevronRight,
  ArrowLeft, User, Mail, Calendar, Clock, ExternalLink, MessageSquare, Pencil,
} from 'lucide-react';
import { auth, db } from '../services/firebase';
import {
  collection, getDocs, doc, updateDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import {
  computeFinancials, summariseGroups, scanContent, monthlyGrowth,
  findExpiredInvitations, countActiveUsers, sortByCreatedDesc,
} from '../utils/adminStats';

const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'splitsync-dev';
const CONSOLE = `https://console.firebase.google.com/project/${PROJECT_ID}`;
const FEEDBACK_SUBMISSIONS_URL = 'https://formspree.io/forms/mqeyogqd/submissions';

// ── Sidebar navigation items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'health',    label: 'System Health',       icon: Activity },
  { id: 'growth',    label: 'Platform Growth',     icon: BarChart2 },
  { id: 'users',     label: 'User Management',      icon: Users },
  { id: 'groups',    label: 'Group Management',     icon: Layers },
  { id: 'financial', label: 'Financial Oversight',  icon: DollarSign },
  { id: 'moderation',label: 'Content Moderation',   icon: Shield },
  { id: 'comms',     label: 'Notifications',         icon: Bell },
];

const docsOf = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const fmt = (n) => Number(n || 0).toFixed(2);

// ── Shared UI ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'indigo', icon: Icon, onClick }) {
  const colorMap = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    green:  'bg-green-50  dark:bg-green-900/20  text-green-600  dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    red:    'bg-red-50    dark:bg-red-900/20    text-red-600    dark:text-red-400',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm text-left w-full ${onClick ? 'hover:border-indigo-300 dark:hover:border-indigo-600 transition' : ''}`}
    >
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
    </Wrapper>
  );
}

function ActionCard({ label, desc, icon: Icon, onClick, href, busy }) {
  const cls = 'flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition text-left group w-full disabled:opacity-50';
  const inner = (
    <>
      <span className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition">
        <Icon size={16} />
      </span>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{busy ? 'Working…' : label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
      </div>
      {href
        ? <ExternalLink size={14} className="ml-auto text-gray-300 dark:text-gray-600" />
        : <ChevronRight size={14} className="ml-auto text-gray-300 dark:text-gray-600" />}
    </>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <button onClick={onClick} disabled={busy} className={cls}>{inner}</button>;
}

function Notice({ kind = 'info', children }) {
  const styles = {
    info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
    error:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
    warn:    'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200',
  };
  return <div className={`p-3 border rounded-xl text-sm ${styles[kind]}`}>{children}</div>;
}

function SectionHeader({ title, onRefresh }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {onRefresh && (
        <button onClick={onRefresh} className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          <RefreshCw size={14} /> Refresh
        </button>
      )}
    </div>
  );
}

// Loads the named collections once per section (admins may read all of them).
function useCollections(names) {
  const key = names.join(',');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = {};
    await Promise.all(key.split(',').map(async (name) => {
      try {
        result[name] = docsOf(await getDocs(collection(db, name)));
      } catch (err) {
        console.error(`Taskmaster: failed to load ${name}:`, err);
        result[name] = [];
        setError(`Could not load ${name} (${err.code || err.message}).`);
      }
    }));
    setData(result);
    setLoading(false);
  }, [key]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ── Section: System Health ────────────────────────────────────────────────────
function SystemHealth({ onNavigate }) {
  const { data, loading, error, reload } = useCollections(['users', 'groups', 'expenses', 'invitations']);
  const [cleanup, setCleanup] = useState(null); // { kind, text }
  const [busy, setBusy] = useState(false);

  const users = data.users || [];
  const invitations = data.invitations || [];
  const pending = invitations.filter(i => i.status === 'pending');
  const expired = findExpiredInvitations(invitations);

  const handleCleanup = async () => {
    if (expired.length === 0) {
      setCleanup({ kind: 'info', text: 'No expired invitations to remove.' });
      return;
    }
    if (!window.confirm(`Delete ${expired.length} expired invitation(s)?`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < expired.length; i += 450) {
        const batch = writeBatch(db);
        expired.slice(i, i + 450).forEach(inv => batch.delete(doc(db, 'invitations', inv.id)));
        await batch.commit();
      }
      setCleanup({ kind: 'success', text: `Removed ${expired.length} expired invitation(s).` });
      reload();
    } catch (err) {
      setCleanup({ kind: 'error', text: `Cleanup failed: ${err.code || err.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader title="System Health" onRefresh={reload} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

      {loading ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading stats...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Users"      value={users.length}                       icon={Users}    color="indigo" onClick={() => onNavigate('users')} />
          <StatCard label="Active (7 days)"  value={countActiveUsers(users, 7)}         icon={Activity} color="green"
            sub="Users who opened the app this week" />
          <StatCard label="Total Groups"     value={(data.groups || []).length}         icon={Layers}   color="indigo" onClick={() => onNavigate('groups')} />
          <StatCard label="Total Expenses"   value={(data.expenses || []).filter(e => !e.isSettlement && e.status !== 'deleted').length}
            icon={DollarSign} color="orange" sub="Excludes settlements and removed" onClick={() => onNavigate('financial')} />
          <StatCard label="Pending Invites"  value={pending.length} icon={Bell} color="orange"
            sub={expired.length ? `${expired.length} expired` : 'None expired'} />
          <StatCard label="Platform Status"  value="Operational" icon={Server} color="green"
            sub="Data loaded from Firestore" />
        </div>
      )}

      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Quick Actions
      </h3>
      {cleanup && <div className="mb-3"><Notice kind={cleanup.kind}>{cleanup.text}</Notice></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard label="Clean up expired invitations" icon={Trash2} busy={busy}
          desc={`Delete pending invitations past their 7-day expiry (${expired.length} found)`} onClick={handleCleanup} />
        <ActionCard label="View Firestore usage" icon={Database}
          desc="Reads, writes and storage in the Firebase console" href={`${CONSOLE}/firestore/usage`} />
        <ActionCard label="View Cloud Function logs" icon={Server}
          desc="Execution errors for the assistant, IBAN and receipt functions" href={`${CONSOLE}/functions/logs`} />
        <ActionCard label="Platform growth" icon={BarChart2}
          desc="New users, groups and expenses per month" onClick={() => onNavigate('growth')} />
      </div>
    </div>
  );
}

// ── Section: Platform Growth ──────────────────────────────────────────────────
function PlatformGrowth() {
  const { data, loading, error, reload } = useCollections(['users', 'groups', 'expenses']);
  const rows = loading ? [] : monthlyGrowth({ users: data.users, groups: data.groups, expenses: data.expenses }, 6);
  const max = Math.max(1, ...rows.flatMap(r => [r.users, r.groups, r.expenses]));
  const Bar = ({ value, color }) => (
    <div className="flex items-center gap-2">
      <div className={`h-2 rounded ${color}`} style={{ width: `${(value / max) * 100}%`, minWidth: value ? 4 : 0 }} />
      <span className="text-xs text-gray-600 dark:text-gray-300">{value}</span>
    </div>
  );
  return (
    <div>
      <SectionHeader title="Platform Growth" onRefresh={reload} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-left">
                {['Month', 'New users', 'New groups', 'New expenses'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.label}</td>
                  <td className="px-4 py-3 w-1/4"><Bar value={r.users} color="bg-indigo-500" /></td>
                  <td className="px-4 py-3 w-1/4"><Bar value={r.groups} color="bg-green-500" /></td>
                  <td className="px-4 py-3 w-1/4"><Bar value={r.expenses} color="bg-orange-500" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
            Based on each record's creation date. Records without one are not counted.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section: User Management ──────────────────────────────────────────────────
function UserManagement() {
  const { user: me } = useAuthStore();
  const { data, loading, error, reload } = useCollections(['users', 'groups']);
  const [overrides, setOverrides] = useState({}); // userId -> isActive after a change
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);

  const users = sortByCreatedDesc(data.users || []).map(u =>
    u.id in overrides ? { ...u, isActive: overrides[u.id] } : u
  );
  const groupCount = (uid) => (data.groups || []).filter(g => g.members?.some(m => m.userId === uid)).length;

  const filtered = users.filter(u =>
    (u.displayName || u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  // Suspended users are signed out at login and blocked from writing by the rules
  const handleSuspend = async (target) => {
    const isActive = target.isActive !== false;
    if (target.id === me?.uid) {
      setNotice({ kind: 'error', text: 'You cannot suspend your own admin account.' });
      return;
    }
    if (!window.confirm(`${isActive ? 'Suspend' : 'Re-activate'} ${target.displayName || target.email || 'this user'}?`)) return;
    try {
      await updateDoc(doc(db, 'users', target.id), { isActive: !isActive });
      setOverrides(prev => ({ ...prev, [target.id]: !isActive }));
      setSelected(prev => (prev?.id === target.id ? { ...prev, isActive: !isActive } : prev));
      setNotice({ kind: 'success', text: `${target.displayName || target.email} ${isActive ? 'suspended' : 're-activated'}.` });
    } catch (err) {
      console.error('Suspend error:', err);
      setNotice({ kind: 'error', text: `Could not update user: ${err.code || err.message}` });
    }
  };

  return (
    <div>
      <SectionHeader title="User Management" onRefresh={reload} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {notice && <div className="mb-4"><Notice kind={notice.kind}>{notice.text}</Notice></div>}

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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Last active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                        {(user.displayName || user.fullName || user.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.displayName || user.fullName || '—'}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {user.createdAt?.toDate?.()?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {user.lastActive?.toDate?.()?.toLocaleDateString() ?? '—'}
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
                      <button onClick={() => setSelected(user)} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition" title="View user">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handleSuspend(user)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition" title={user.isActive === false ? 'Re-activate' : 'Suspend'}>
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
            Showing {filtered.length} of {users.length} users. Payment details and phone numbers are private and are not visible to admins.
          </p>
        </div>
      )}

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
                { icon: User,     label: 'Name',        val: selected.displayName || selected.fullName || '—' },
                { icon: Mail,     label: 'Email',       val: selected.email || '—' },
                { icon: Calendar, label: 'Joined',      val: selected.createdAt?.toDate?.()?.toLocaleString() ?? '—' },
                { icon: Clock,    label: 'Last active', val: selected.lastActive?.toDate?.()?.toLocaleString() ?? '—' },
                { icon: Layers,   label: 'Groups',      val: groupCount(selected.id) },
                { icon: Shield,   label: 'Status',      val: selected.isActive === false ? 'Suspended' : 'Active' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <row.icon size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400 w-24">{row.label}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{row.val}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleSuspend(selected)}
                disabled={selected.id === me?.uid}
                className="flex-1 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-40"
              >
                {selected.isActive === false ? 'Re-activate' : 'Suspend User'}
              </button>
              <button onClick={() => setSelected(null)} className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
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
  const { data, loading, error, reload } = useCollections(['groups', 'expenses']);
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState(null);

  const groups = sortByCreatedDesc(summariseGroups(data.groups || [], data.expenses || []));
  const filtered = groups.filter(g =>
    (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.ownerName || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s) => ({
    outstanding: <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">Balances due</span>,
    settled:     <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">Settled</span>,
    empty:       <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">No expenses</span>,
  }[s]);

  return (
    <div>
      <SectionHeader title="Group Management" onRefresh={reload} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by group or owner name..."
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
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Group</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Members</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Expenses</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(group => (
                <tr key={group.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{group.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Owner: {group.ownerName} · {group.currency ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{group.typeLabel}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{group.members?.length ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{group.expenseCount}</td>
                  <td className="px-4 py-3">{statusBadge(group.balanceStatus)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(group)} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition" title="View group">
                      <Eye size={14} />
                    </button>
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XCircle size={18} />
              </button>
            </div>
            <div className="text-sm space-y-1 mb-4 text-gray-600 dark:text-gray-300">
              <p>Type: {selected.typeLabel} · Currency: {selected.currency}</p>
              <p>Owner: {selected.ownerName}</p>
              <p>Created: {selected.createdAt?.toDate?.()?.toLocaleString() ?? '—'}</p>
              <p>Expenses: {selected.expenseCount} · {statusBadge(selected.balanceStatus)}</p>
            </div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Members</h4>
            <ul className="text-sm space-y-1 mb-4">
              {(selected.members || []).map(m => (
                <li key={m.userId} className="text-gray-900 dark:text-white">
                  {m.name || m.email} <span className="text-xs text-gray-400">{m.role === 'owner' ? '(owner)' : ''}</span>
                </li>
              ))}
            </ul>
            {(selected.formerMembers || []).length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Former members</h4>
                <ul className="text-sm space-y-1">
                  {selected.formerMembers.map(m => (
                    <li key={m.userId} className="text-gray-500 dark:text-gray-400">
                      {m.name} <span className="text-xs">({m.reason === 'account_deleted' ? 'account deleted' : 'left'})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Financial Oversight ──────────────────────────────────────────────
function FinancialOversight() {
  const { data, loading, error, reload } = useCollections(['groups', 'expenses']);
  const f = loading ? null : computeFinancials(data.groups || [], data.expenses || []);

  const CurrencyList = ({ title, map, empty }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      {Object.entries(map || {}).map(([cur, total]) => (
        <div key={cur} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cur}</span>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(total)}</span>
        </div>
      ))}
      {Object.keys(map || {}).length === 0 && <p className="text-sm text-gray-400">{empty}</p>}
    </div>
  );

  return (
    <div>
      <SectionHeader title="Financial Oversight" onRefresh={reload} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading financial data...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Expenses"            value={f.expenseCount}      icon={DollarSign}   color="indigo" sub="Active and archived" />
            <StatCard label="Settlements"         value={f.settlementCount}   icon={CheckCircle2} color="green"  sub="Recorded payments" />
            <StatCard label="Removed"             value={f.removedCount}      icon={Trash2}       color="red"    sub="Kept for audit, not in totals" />
            <StatCard label="Groups with balances due" value={f.outstandingGroups} icon={AlertCircle} color="orange" />
            <StatCard label="Groups fully settled" value={f.settledGroups}    icon={CheckCircle2} color="green" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CurrencyList title="Spending by currency"    map={f.spendingByCurrency}    empty="No expenses yet." />
            <CurrencyList title="Settled by currency"     map={f.settlementsByCurrency} empty="No settlements yet." />
            <CurrencyList title="Still owed by currency"  map={f.outstandingByCurrency} empty="Nothing outstanding." />
          </div>
          <div className="mt-4">
            <Notice kind="warn">
              Payment details (PayPal and Revolut usernames, bank details) are stored in each user's private profile and IBANs are encrypted on the server. Admins cannot see them.
            </Notice>
          </div>
        </>
      )}
    </div>
  );
}

// ── Section: Content Moderation ───────────────────────────────────────────────
const DEFAULT_KEYWORDS = 'scam, fraud, hate, abuse, idiot, stupid';

function ContentModeration() {
  const { user: me } = useAuthStore();
  const { data, loading, error, reload } = useCollections(['groups', 'expenses']);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [results, setResults]   = useState(null);
  const [notice, setNotice]     = useState(null);

  const runScan = () => {
    setNotice(null);
    setResults(scanContent(keywords.split(','), data.groups || [], data.expenses || []));
  };

  // Soft-removes an expense: it leaves all balances but stays as an audit record
  const removeExpense = async (r) => {
    if (!window.confirm(`Remove this expense from "${r.groupName}"? It will no longer count in balances.`)) return;
    try {
      await updateDoc(doc(db, 'expenses', r.id), {
        status: 'deleted', deletedAt: new Date(), deletedBy: me?.uid || 'admin', moderated: true,
      });
      setResults(prev => prev.filter(x => !(x.kind === 'expense' && x.id === r.id)));
      setNotice({ kind: 'success', text: 'Expense removed.' });
    } catch (err) {
      setNotice({ kind: 'error', text: `Could not remove expense: ${err.code || err.message}` });
    }
  };

  const renameGroup = async (r) => {
    const name = window.prompt('New group name:', '[Renamed by moderator]');
    if (!name || !name.trim()) return;
    try {
      await updateDoc(doc(db, 'groups', r.id), {
        name: name.trim().slice(0, 50), moderatedAt: new Date(), moderatedBy: me?.uid || 'admin',
      });
      setResults(prev => prev.filter(x => !(x.kind === 'group' && x.id === r.id)));
      setNotice({ kind: 'success', text: `Group renamed to "${name.trim().slice(0, 50)}".` });
      reload();
    } catch (err) {
      setNotice({ kind: 'error', text: `Could not rename group: ${err.code || err.message}` });
    }
  };

  return (
    <div>
      <SectionHeader title="Content Moderation" onRefresh={reload} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Keyword scan</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Searches group names and expense titles and descriptions. Separate keywords with commas.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button onClick={runScan} disabled={loading} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 justify-center">
            <Search size={14} /> {loading ? 'Loading…' : 'Scan'}
          </button>
        </div>

        {notice && <div className="mt-3"><Notice kind={notice.kind}>{notice.text}</Notice></div>}

        {results && (
          <div className="mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 size={14} /> No matches found.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {results.map(r => (
                  <li key={`${r.kind}-${r.id}`} className="py-3 flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 ${r.kind === 'group' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                      {r.kind === 'group' ? 'Group' : 'Expense'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white break-words">{r.text}</p>
                      <p className="text-xs text-gray-400">Matched "{r.keyword}" · {r.groupName}</p>
                    </div>
                    {r.kind === 'expense' ? (
                      <button onClick={() => removeExpense(r)} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 hover:underline shrink-0">
                        <Trash2 size={12} /> Remove
                      </button>
                    ) : (
                      <button onClick={() => renameGroup(r)} className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline shrink-0">
                        <Pencil size={12} /> Rename
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard label="View user feedback" icon={MessageSquare}
          desc="Submissions from the in-app feedback form (Formspree)" href={FEEDBACK_SUBMISSIONS_URL} />
        <ActionCard label="Open the feedback form" icon={Eye}
          desc="See the form users fill in" href="/feedback.html" />
      </div>
      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        Removing an expense keeps it as an audit record but takes it out of all balances. Admins can only remove expenses and rename groups; they cannot edit amounts or members.
      </p>
    </div>
  );
}

// ── Section: Notifications / Communications ───────────────────────────────────
function Communications() {
  const [message, setMessage] = useState('');
  const [title,   setTitle]   = useState('Message from Split-Sync');
  const [notice,  setNotice]  = useState(null);
  const [sending, setSending] = useState(false);

  // Writes one in-app notification per user (batched, 450 writes per batch)
  const handleBroadcast = async () => {
    const text = message.trim();
    if (!text) return;
    setNotice(null);
    let users;
    try {
      users = docsOf(await getDocs(collection(db, 'users')));
    } catch (err) {
      setNotice({ kind: 'error', text: `Could not load users: ${err.code || err.message}` });
      return;
    }
    const recipients = users.filter(u => u.isActive !== false);
    if (!window.confirm(`Send this notification to ${recipients.length} user(s)?`)) return;
    setSending(true);
    try {
      for (let i = 0; i < recipients.length; i += 450) {
        const batch = writeBatch(db);
        recipients.slice(i, i + 450).forEach(u => {
          batch.set(doc(collection(db, 'notifications')), {
            userId: u.id,
            type: 'system',
            title: title.trim() || 'Message from Split-Sync',
            message: text,
            read: false,
            requiresAction: false,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      setNotice({ kind: 'success', text: `Sent to ${recipients.length} user(s).` });
      setMessage('');
    } catch (err) {
      setNotice({ kind: 'error', text: `Sending failed: ${err.code || err.message}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Notifications" />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Send System-Wide In-App Notification
        </h3>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={60}
          placeholder="Title"
          className="w-full mb-2 px-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
        />
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
            disabled={!message.trim() || sending}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send to All Users'}
          </button>
        </div>
        {notice && <div className="mt-3"><Notice kind={notice.kind}>{notice.text}</Notice></div>}
      </div>
      <Notice kind="info">
        The message appears in every active user's notification bell. Suspended accounts are skipped.
      </Notice>
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
        setIsAdmin(token.claims.admin === true);
      } catch (err) {
        console.error('Claim check error:', err);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

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
  const go = (id) => { setSection(id); setSidebarOpen(false); };

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
        <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase mb-0.5">
            Taskmaster
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Admin Panel — Split-Sync</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
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

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft size={12} /> Back to app
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Open menu"
          >
            <Layers size={18} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">{currentSection?.label}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Taskmaster — Split-Sync Admin Panel</p>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto max-w-5xl w-full mx-auto">
          {section === 'health'     && <SystemHealth onNavigate={go} />}
          {section === 'growth'     && <PlatformGrowth />}
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
