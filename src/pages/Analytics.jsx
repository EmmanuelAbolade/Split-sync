// src/pages/Analytics.jsx
// Analytics & Stats page — spending over time, category breakdown,
// per-person balances, monthly summary, and who-owes-who overview.
// Uses Recharts for all visualisations with entrance animations.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { calculateBalances, calculateSettlements } from '../utils/balanceCalculator';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, PieChart as PieIcon, BarChart2,
  Calendar, ArrowLeftRight, ArrowLeft, Loader,
} from 'lucide-react';

// ─── Colour palette ───────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#fb923c'];

const CATEGORY_COLORS = {
  food:          '#f59e0b',
  transport:     '#6366f1',
  accommodation: '#10b981',
  entertainment: '#f43f5e',
  shopping:      '#a78bfa',
  utilities:     '#22d3ee',
  other:         '#94a3b8',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// fmt takes a currency code — falls back to plain number if none provided
const fmt = (n, currency = '') => currency ? `${currency} ${Number(n).toFixed(2)}` : Number(n).toFixed(2);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthKey(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      fontSize: '13px',
      backdropFilter: 'blur(8px)',
    }}>
      <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#94a3b8', fontWeight: 500 }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function ChartCard({ title, icon: Icon, children, delay = 0 }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
          <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [expenses, setExpenses] = useState([]);   // all expenses across all groups
  const [groups,   setGroups]   = useState([]);   // all user groups
  const [members,  setMembers]  = useState({});   // userId → displayName
  const [selectedGroupId, setSelectedGroupId] = useState('all'); // group filter

  // ── Fetch all data ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1. Get all groups the user belongs to
        const gSnap = await getDocs(
          query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid))
        );
        const groupList = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setGroups(groupList);

        // 2. Build a userId→name map from all members across groups
        const nameMap = {};
        groupList.forEach(g => {
          (g.members || []).forEach(m => {
            if (!nameMap[m.userId]) nameMap[m.userId] = m.name || m.email || 'Unknown';
          });
        });
        // Also add current user
        nameMap[user.uid] = user.displayName || user.email || 'You';
        setMembers(nameMap);

        // 3. Fetch all expenses for those groups
        if (groupList.length === 0) { setLoading(false); return; }

        const allExpenses = [];
        for (const g of groupList) {
          const eSnap = await getDocs(
            query(collection(db, 'expenses'), where('groupId', '==', g.id))
          );
          eSnap.docs.forEach(d => allExpenses.push({ id: d.id, groupName: g.name, ...d.data() }));
        }
        setExpenses(allExpenses);
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  // Active group and currency — null when "All Groups" is selected
  const activeGroup    = selectedGroupId === 'all' ? null : groups.find(g => g.id === selectedGroupId);
  const activeCurrency = activeGroup?.currency || null;

  // Filter expenses to selected group, or use all
  const filteredExpenses = selectedGroupId === 'all'
    ? expenses
    : expenses.filter(e => e.groupId === selectedGroupId);

  const filteredGroups = selectedGroupId === 'all'
    ? groups
    : groups.filter(g => g.id === selectedGroupId);

  // ── Derived chart data ──────────────────────────────────────────────────────

  // 1. Spending over time (last 6 months, area chart)
  const spendingOverTime = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      const k = monthKey(e.createdAt || e.date);
      map[k] = (map[k] || 0) + (e.amount || 0);
    });
    // Sort chronologically and take last 6
    return Object.entries(map)
      .sort((a, b) => {
        const pa = new Date(a[0]); const pb = new Date(b[0]);
        return pa - pb;
      })
      .slice(-6)
      .map(([month, total]) => ({ month, total: parseFloat(total.toFixed(2)) }));
  }, [filteredExpenses]);

  // 2. Category breakdown (pie chart)
  const categoryData = useMemo(() => {
    const map = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'other';
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: parseFloat(value.toFixed(2)),
      color: CATEGORY_COLORS[name] || '#94a3b8',
    }));
  }, [filteredExpenses]);

  // 3. Monthly summary (bar chart — this year)
  const monthlySummary = useMemo(() => {
    const year = new Date().getFullYear();
    const map  = {};
    MONTHS.forEach(m => { map[m] = 0; });
    filteredExpenses.forEach(e => {
      const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt || e.date);
      if (d.getFullYear() === year) {
        const m = MONTHS[d.getMonth()];
        map[m] = (map[m] || 0) + (e.amount || 0);
      }
    });
    return MONTHS.map(m => ({ month: m, amount: parseFloat((map[m] || 0).toFixed(2)) }));
  }, [filteredExpenses]);

  // 4. Per-person balance across all groups (bar chart)
  const perPersonData = useMemo(() => {
    const netBalances = {};
    filteredGroups.forEach(g => {
      const gExpenses = filteredExpenses.filter(e => e.groupId === g.id);
      const balances  = calculateBalances(gExpenses, g.members || []);
      Object.entries(balances).forEach(([uid, bal]) => {
        netBalances[uid] = (netBalances[uid] || 0) + bal;
      });
    });
    return Object.entries(netBalances)
      .map(([uid, balance]) => ({
        name:    (members[uid] || uid).split(' ')[0], // first name only
        balance: parseFloat(balance.toFixed(2)),
        isYou:   uid === user?.uid,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [filteredGroups, filteredExpenses, members, user]);

  // 5. Who owes who — aggregate across all groups
  const settlements = useMemo(() => {
    const allSettlements = [];
    filteredGroups.forEach(g => {
      const gExpenses = filteredExpenses.filter(e => e.groupId === g.id);
      const balances  = calculateBalances(gExpenses, g.members || []);
      const s         = calculateSettlements(balances);
      s.forEach(item => allSettlements.push({ ...item, groupName: g.name, currency: g.currency }));
    });
    // Consolidate: merge same from→to pairs
    const consolidated = {};
    allSettlements.forEach(({ from, to, amount }) => {
      const key = `${from}→${to}`;
      consolidated[key] = { from, to, amount: (consolidated[key]?.amount || 0) + amount };
    });
    return Object.values(consolidated)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [filteredGroups, filteredExpenses]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader size={32} className="animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (expenses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6 pb-24">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
          <BarChart2 size={36} className="text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No data yet</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
          Add expenses to your groups and your analytics will appear here.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ── Totals for summary cards — use filteredExpenses────────────────────────────────────────────────
  const totalSpend = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonth  = (() => {
    const now = new Date();
    return filteredExpenses
      .filter(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt || e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, e) => s + (e.amount || 0), 0);
  })();

  // Count of expenses this month (used when no single currency is active)
  const thisMonthCount = filteredExpenses.filter(e => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt || e.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-28">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Spending insights across all groups</p>
          </div>
        </div>
      </div>

      {/* Group selector — filters all charts to a single currency */}
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-1">
        <select
          value={selectedGroupId}
          onChange={e => setSelectedGroupId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Groups (mixed currencies)</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name} — {g.currency}</option>
          ))}
        </select>
        {!activeCurrency && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 px-1">
            Amounts across groups use different currencies. Select a group for accurate totals.
          </p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Spent',    value: activeCurrency ? fmt(totalSpend, activeCurrency) : `${filteredExpenses.length} expenses`, color: 'from-indigo-500 to-purple-600' },
            { label: 'This Month',     value: activeCurrency ? fmt(thisMonth, activeCurrency)  : `${thisMonthCount} expenses`,          color: 'from-cyan-500 to-blue-600' },
            { label: 'Total Expenses', value: `${filteredExpenses.length}`,                                                             color: 'from-amber-500 to-orange-500' },
            { label: 'Groups',         value: `${filteredGroups.length}`,                                                               color: 'from-emerald-500 to-teal-600' },
          ].map((c, i) => (
            <div
              key={c.label}
              className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white animate-fade-in`}
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <p className="text-xs font-medium text-white/80 mb-1">{c.label}</p>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── 1. Spending Over Time ── */}
        <ChartCard title="Spending Over Time" icon={TrendingUp} delay={100}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={spendingOverTime} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => activeCurrency ? `${activeCurrency} ${v}` : `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#colorSpend)"
                dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── 2. Monthly Summary ── */}
        <ChartCard title="Monthly Summary" icon={Calendar} delay={200}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySummary} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => activeCurrency ? `${activeCurrency} ${v}` : `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="amount"
                name="Spent"
                radius={[6, 6, 0, 0]}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {monthlySummary.map((_, i) => (
                  <Cell
                    key={i}
                    fill={new Date().getMonth() === i ? '#6366f1' : '#e0e7ff'}
                    className="dark:fill-indigo-900"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            Current month highlighted in purple
          </p>
        </ChartCard>

        {/* ── 3. Category Breakdown ── */}
        <ChartCard title="Category Breakdown" icon={PieIcon} delay={300}>
          {categoryData.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No category data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [fmt(value), name]}
                    content={<CustomTooltip />}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span className="text-xs text-gray-600 dark:text-gray-200">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </ChartCard>

        {/* ── 4. Per-Person Balance ── */}
        <ChartCard title="Per-Person Balance" icon={BarChart2} delay={400}>
          {perPersonData.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No balance data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(180, perPersonData.length * 44)}>
                <BarChart
                  data={perPersonData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} className="dark:opacity-20" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => activeCurrency ? `${activeCurrency} ${v}` : `${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="balance"
                    name="Balance"
                    radius={[0, 6, 6, 0]}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {perPersonData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.balance >= 0 ? '#10b981' : '#f43f5e'}
                        opacity={entry.isYou ? 1 : 0.75}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Owed money
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Owes money
                </span>
              </div>
            </>
          )}
        </ChartCard>

        {/* ── 5. Who Owes Who ── */}
        <ChartCard title="Who Owes Who" icon={ArrowLeftRight} delay={500}>
          {settlements.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">All settled up!</p>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, i) => {
                const fromName = (members[s.from] || s.from).split(' ')[0];
                const toName   = (members[s.to]   || s.to).split(' ')[0];
                const pct      = Math.min(100, (s.amount / settlements[0].amount) * 100);
                return (
                  <div
                    key={i}
                    className="animate-fade-in"
                    style={{ animationDelay: `${500 + i * 60}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        {/* From avatar */}
                        <span className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center">
                          {fromName[0]?.toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">{fromName}</span>
                        <ArrowLeftRight size={13} className="text-gray-400" />
                        <span className="font-medium text-gray-700 dark:text-gray-200">{toName}</span>
                        {/* To avatar */}
                        <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                          {toName[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="font-bold text-gray-800 dark:text-white text-sm">
                        {fmt(s.amount, s.currency || activeCurrency || '')}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-400 to-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

      </div>

      {/* ── Fade-in animation keyframes ── */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.45s ease-out both;
        }
      `}</style>
    </div>
  );
}
