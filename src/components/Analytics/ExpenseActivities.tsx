import React, { useState } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import {
  Calendar,
  Eye,
  EyeOff,
  Filter,
  BarChart2,
  PieChart as PieIcon,
  ArrowUpRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Transaction, Budget } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';

interface ExpenseActivitiesProps {
  transactions: Transaction[];
  budgets: Budget[];
  onNavigateTab?: (tab: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Groceries': '#cbf536', // Primary Lime
  'Dining & Food': '#0284c7', // Sky Blue
  'Utilities & Bills': '#db2777', // Magenta Pink
  'Rent & Housing': '#f59e0b', // Amber
  'Travel & Commute': '#8b5cf6', // Violet
  'Shopping': '#10b981', // Emerald
  'Healthcare': '#ef4444', // Red
  'Tech & Subscriptions': '#06b6d4', // Cyan
  'Loan Interest': '#6366f1', // Indigo
  'Other Expense': '#94a3b8'
};

const DEFAULT_COLOR_PALETTE = ['#cbf536', '#0284c7', '#db2777', '#f59e0b', '#8b5cf6', '#10b981', '#06b6d4'];

export const ExpenseActivities: React.FC<ExpenseActivitiesProps> = ({
  transactions,
  budgets,
  onNavigateTab
}) => {
  const [periodFilter, setPeriodFilter] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [showAmount, setShowAmount] = useState(true);
  const [selectedAmountChip, setSelectedAmountChip] = useState<number>(250);

  // Filter expenses
  const expenses = transactions.filter((t) => t.type === 'expense');

  // Compute category aggregates
  const categoryMap: Record<string, number> = {};
  let totalExpense = 0;

  for (const exp of expenses) {
    categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    totalExpense += exp.amount;
  }

  const chartData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
    color: CATEGORY_COLORS[name] || DEFAULT_COLOR_PALETTE[Math.floor(Math.random() * DEFAULT_COLOR_PALETTE.length)]
  })).sort((a, b) => b.value - a.value);

  // Top category percentage
  const topCategory = chartData[0];
  const topCategoryPct = topCategory && totalExpense > 0
    ? Math.round((topCategory.value / totalExpense) * 100)
    : 0;

  // Month-over-month comparison metrics
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const budgetUtilization = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top 3-Screen Pill Switcher (Reference Screens) */}
      {onNavigateTab && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
          <div className="pill-switcher">
            <button
              className="switcher-pill"
              onClick={() => onNavigateTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className="switcher-pill active"
              onClick={() => onNavigateTab('activities')}
            >
              Activities
            </button>
            <button
              className="switcher-pill"
              onClick={() => onNavigateTab('insights')}
            >
              Insights
            </button>
            <button
              className="switcher-pill"
              onClick={() => onNavigateTab('coach')}
              style={{ color: '#10b981' }}
            >
              AI Coach
            </button>
          </div>
        </div>
      )}

      {/* Top Filter Bar: Date Range + Period Pills (Reference Screen 2) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Calendar size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
            Current Billing Cycle (October)
          </span>
        </div>

        {/* Period Switcher Pills (Day, Week, Month, Year) */}
        <div className="pill-switcher">
          {(['day', 'week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              className={`switcher-pill ${periodFilter === p ? 'active' : ''}`}
              onClick={() => setPeriodFilter(p)}
              style={{ textTransform: 'capitalize' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Total Expense Card + Donut Chart (Reference Screen 2) */}
      <div className="surface-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Expense</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 900 }}>
                {showAmount ? formatINR(totalExpense) : '₹••••••'}
              </div>
              <button
                onClick={() => setShowAmount(!showAmount)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                title="Toggle amount visibility"
              >
                {showAmount ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}
          >
            <BarChart2 size={18} />
          </div>
        </div>

        {/* Donut Chart with Center Text */}
        <div style={{ position: 'relative', width: '100%', height: '280px', marginTop: '10px', marginBottom: '14px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Tooltip
                formatter={(value: any) => [formatINR(Number(value)), 'Expense']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700
                }}
              />
              <Pie
                data={chartData.length > 0 ? chartData : [{ name: 'No Expenses', value: 1, color: '#e2e8f0' }]}
                innerRadius={78}
                outerRadius={108}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ResponsiveContainer>

          {/* Center Callout Text inside Donut */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
              {showAmount ? formatINR(totalExpense, false) : '••••'}
            </div>
            {topCategory && (
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                ({topCategoryPct}%)
              </div>
            )}
          </div>
        </div>

        {/* Legend colored dots */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '14px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          {chartData.slice(0, 6).map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: c.color,
                  display: 'inline-block'
                }}
              />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions & Amount Chips (Reference Screen 2) */}
      <div className="surface-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Recent Transactions</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Yesterday & earlier</p>
          </div>

          {/* Stacked User Avatars from Reference */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#cbf536', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem' }}>
              M
            </div>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0284c7', border: '2px solid #fff', marginLeft: '-8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.7rem' }}>
              A
            </div>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#db2777', border: '2px solid #fff', marginLeft: '-8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.7rem' }}>
              +8
            </div>
          </div>
        </div>

        {/* Horizontal Amount Chips from Reference Screen 2 */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginBottom: '14px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {[100, 250, 400, 550, 1000].map((amt) => {
            const isSelected = selectedAmountChip === amt;
            return (
              <button
                key={amt}
                onClick={() => setSelectedAmountChip(amt)}
                style={{
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-pill)',
                  border: isSelected ? 'none' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--primary-lime)' : 'var(--bg-card-subtle)',
                  color: isSelected ? '#000000' : 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  boxShadow: isSelected ? 'var(--shadow-lime)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                ₹{amt}
              </button>
            );
          })}
        </div>

        {/* Expense Rows */}
        <div>
          {expenses.slice(0, 5).map((exp) => (
            <div key={exp.id} className="tx-row-item">
              <div className="tx-left">
                <div className="tx-icon-sq">
                  {exp.category[0] || '₹'}
                </div>
                <div>
                  <div className="tx-title">{exp.description}</div>
                  <div className="tx-date">{exp.date} • {exp.category}</div>
                </div>
              </div>
              <div className="tx-amount debit">
                -{formatINR(exp.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Month-over-Month & Budget Utilization */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div className="surface-card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Monthly Budget Utilization</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, margin: '6px 0', fontFamily: 'var(--font-heading)' }}>
            {budgetUtilization}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {formatINR(totalExpense)} spent of {formatINR(totalBudget)} allocation
          </div>
        </div>

        <div className="surface-card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Top Expense Category</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, margin: '6px 0', fontFamily: 'var(--font-heading)', color: '#0284c7' }}>
            {topCategory ? topCategory.name : 'N/A'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {topCategory ? `${formatINR(topCategory.value)} (${topCategoryPct}% of total)` : 'No expenses recorded'}
          </div>
        </div>
      </div>
    </div>
  );
};
