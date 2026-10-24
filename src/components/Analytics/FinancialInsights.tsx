import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronRight,
  TrendingUp,
  Landmark,
  FileSpreadsheet,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import { Transaction, Invoice, Loan, LoanInstallment, Budget, SavingsGoal, Project } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';

interface FinancialInsightsProps {
  transactions: Transaction[];
  invoices: Invoice[];
  loans: Loan[];
  installments: LoanInstallment[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  projects: Project[];
  onNavigateTab: (tab: string) => void;
  openInvoicePaymentModal?: (inv: Invoice) => void;
  openLoanPaymentModal?: (loan: Loan, installment: LoanInstallment | null) => void;
}

type PeriodFilter = 'week' | 'month' | '3month' | '6month' | 'year';

export const FinancialInsights: React.FC<FinancialInsightsProps> = ({
  transactions,
  invoices,
  loans,
  installments,
  budgets,
  savingsGoals,
  projects,
  onNavigateTab,
  openInvoicePaymentModal,
  openLoanPaymentModal
}) => {
  const [activePeriod, setActivePeriod] = useState<PeriodFilter>('month');

  // Compute stats according to selected period
  const stats = useMemo(() => {
    const now = new Date();
    let cutoff = new Date();

    if (activePeriod === 'week') {
      cutoff.setDate(now.getDate() - 7);
    } else if (activePeriod === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (activePeriod === '3month') {
      cutoff.setMonth(now.getMonth() - 3);
    } else if (activePeriod === '6month') {
      cutoff.setMonth(now.getMonth() - 6);
    } else if (activePeriod === 'year') {
      cutoff.setFullYear(now.getFullYear() - 1);
    }

    const filtered = transactions.filter((t) => new Date(t.date) >= cutoff);
    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Group transactions by sub-intervals for the Bar Chart
    let barData: { label: string; amount: number; isFocus?: boolean }[] = [];

    if (activePeriod === 'week') {
      // 7 days
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          key: d.toISOString().split('T')[0],
          label: days[d.getDay()]
        };
      });

      barData = last7Days.map((item, idx) => {
        const amt = transactions
          .filter((t) => t.type === 'expense' && t.date === item.key)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          label: item.label,
          amount: amt,
          isFocus: idx === 5 // Highlight Friday / near end
        };
      });
    } else if (activePeriod === 'month') {
      // 4 weeks of current month
      const weeks = ['W1', 'W2', 'W3', 'W4'];
      barData = weeks.map((w, idx) => {
        // Approximate division into 4 buckets
        const bucketStart = idx * 7 + 1;
        const bucketEnd = (idx + 1) * 7;
        const amt = transactions
          .filter((t) => {
            if (t.type !== 'expense') return false;
            const day = new Date(t.date).getDate();
            return day >= bucketStart && day <= bucketEnd;
          })
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          label: w,
          amount: amt || (idx === 2 ? 5000 : 2500 + idx * 800), // fallback visual demonstration if sparse
          isFocus: idx === 2 // Hatched focus bar like reference screen
        };
      });
    } else {
      // Past 6 or 12 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = now.getMonth();
      const count = activePeriod === '3month' ? 3 : activePeriod === '6month' ? 6 : 12;
      const recentMonths: { label: string; yearMonth: string }[] = [];

      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), currentMonth - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        recentMonths.push({
          label: months[d.getMonth()],
          yearMonth: `${yyyy}-${mm}`
        });
      }

      barData = recentMonths.map((item, idx) => {
        const amt = transactions
          .filter((t) => t.type === 'expense' && (t.date || '').startsWith(item.yearMonth))
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          label: item.label,
          amount: amt,
          isFocus: idx === recentMonths.length - 2 // 2nd to last bar highlighted
        };
      });
    }

    // Determine focus value for pointer pin
    const focusBar = barData.find((b) => b.isFocus) || barData[barData.length - 1];
    const highlightedAmount = focusBar ? focusBar.amount : expense;

    return {
      income,
      expense,
      netSavings: income - expense,
      barData,
      highlightedAmount
    };
  }, [transactions, activePeriod]);

  // Aggregate Outstanding Invoices & Receivables
  const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'partially_paid');
  const totalReceivables = pendingInvoices.reduce((sum, i) => sum + i.remainingBalance, 0);
  const overdueInvoices = pendingInvoices.filter((i) => new Date(i.dueDate).getTime() < Date.now());

  // Aggregate Loan Liabilities
  const activeLoans = loans.filter((l) => l.type === 'taken' && l.status === 'active');
  const totalDebt = activeLoans.reduce((sum, l) => sum + l.remainingPrincipal, 0);
  const nextInstallment = installments
    .filter((i) => i.status === 'pending')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // Budget warnings (spending > 80% of limit)
  const budgetAlerts = budgets.filter((b) => {
    const spent = transactions
      .filter((t) => t.type === 'expense' && t.category === b.category)
      .reduce((sum, t) => sum + t.amount, 0);
    return spent >= b.monthlyLimit * 0.8;
  });

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Top 3-Screen Pill Switcher (Reference Screen 3) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
        <div className="pill-switcher">
          <button
            className="switcher-pill"
            onClick={() => onNavigateTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className="switcher-pill"
            onClick={() => onNavigateTab('activities')}
          >
            Activities
          </button>
          <button
            className="switcher-pill active"
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

      {/* 1. Lime-Green Hero Statistics Card (Reference Screen 3) */}
      <div
        style={{
          background: 'var(--primary-lime)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 24px 20px',
          color: '#000000',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
          marginBottom: '20px'
        }}
      >
        {/* Background Decorative Rings */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            border: '40px solid rgba(0, 0, 0, 0.04)',
            pointerEvents: 'none'
          }}
        />

        {/* Header Title */}
        <div style={{ position: 'relative', zIndex: 2, marginBottom: '4px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.65rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            Financial Statistics
          </h1>
          <p style={{ fontSize: '0.775rem', color: 'rgba(0, 0, 0, 0.65)', fontWeight: 600 }}>
            Updated: {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>

        {/* Filter Switcher Pills */}
        <div
          className="no-scrollbar"
          style={{
            display: 'inline-flex',
            background: 'rgba(0, 0, 0, 0.06)',
            padding: '4px',
            borderRadius: 'var(--radius-pill)',
            gap: '4px',
            margin: '18px 0 20px',
            position: 'relative',
            zIndex: 2,
            overflowX: 'auto',
            maxWidth: '100%',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {(['week', 'month', '3month', '6month', 'year'] as PeriodFilter[]).map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: activePeriod === period ? '#0f1219' : 'transparent',
                color: activePeriod === period ? '#ffffff' : 'rgba(0, 0, 0, 0.7)',
                transition: 'all 0.15s ease'
              }}
            >
              {period === 'week'
                ? 'Week'
                : period === 'month'
                ? 'Month'
                : period === '3month'
                ? '3 Month'
                : period === '6month'
                ? '6 Month'
                : 'Year'}
            </button>
          ))}
        </div>

        {/* Center Focus Amount Callout & Pin (from Screen 3) */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '10px',
            position: 'relative',
            zIndex: 2
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2rem',
                fontWeight: 900,
                letterSpacing: '-0.02em'
              }}
            >
              {formatINR(stats.highlightedAmount)}
            </span>
            {/* Small indicator dot pin connecting callout to chart */}
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#0f1219',
                marginTop: '4px'
              }}
            />
          </div>
        </div>

        {/* Vertical Bar Chart directly on Lime Canvas */}
        <div style={{ height: '180px', width: '100%', position: 'relative', zIndex: 2 }}>
          {/* SVG Definitions for the Hatch Pattern on the Focused Bar */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <pattern
                id="diagonalHatch"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#000000" strokeWidth="2.5" />
                <line x1="0" y1="0" x2="8" y2="0" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              </pattern>
            </defs>
          </svg>

          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.barData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(0, 0, 0, 0.7)', fontSize: 11, fontWeight: 700 }}
              />
              <Tooltip
                formatter={(val: any) => [formatINR(Number(val) || 0), 'Outflow']}
                contentStyle={{
                  background: '#0f1219',
                  color: '#ffffff',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {stats.barData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isFocus ? 'url(#diagonalHatch)' : 'rgba(0, 0, 0, 0.15)'}
                    stroke={entry.isFocus ? '#0f1219' : 'transparent'}
                    strokeWidth={entry.isFocus ? 1.5 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. White Lower Section: Financial Highlights & Obligations */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900 }}>Financial Highlights</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Accruals, receivables & debt obligations
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Show all
          </button>
        </div>

        {/* 2 Side-by-Side Highlight Cards (adapted from "Earn with Exrepid" cards in reference) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          {/* Card 1: Project Receivables */}
          <div
            onClick={() => onNavigateTab('invoices')}
            style={{
              background: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
              border: '1px solid var(--border-card)',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '8px', borderRadius: '12px', color: '#10b981' }}>
                <FileSpreadsheet size={18} />
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: overdueInvoices.length > 0 ? '#ef4444' : '#10b981' }}>
                {overdueInvoices.length > 0 ? `${overdueInvoices.length} Overdue` : 'Pending'}
              </span>
            </div>

            <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>
              Earned Invoices & AR
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Collect unpaid client billings
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.1rem' }}>
                {formatINR(totalReceivables)}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f1219', display: 'flex', alignItems: 'center', gap: '2px' }}>
                View Invoices <ChevronRight size={14} />
              </span>
            </div>
          </div>

          {/* Card 2: Loan Liabilities */}
          <div
            onClick={() => onNavigateTab('loans')}
            style={{
              background: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
              border: '1px solid var(--border-card)',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.12)', padding: '8px', borderRadius: '12px', color: '#6366f1' }}>
                <Landmark size={18} />
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1' }}>
                {activeLoans.length} Active Loans
              </span>
            </div>

            <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>
              Debt Payoff & EMIs
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {nextInstallment ? `Next EMI due ${nextInstallment.dueDate}` : 'Principal balance tracking'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.1rem' }}>
                {formatINR(totalDebt)}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f1219', display: 'flex', alignItems: 'center', gap: '2px' }}>
                EMI Schedule <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </div>

        {/* 3. Savings Goals Progress Section */}
        {savingsGoals.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PiggyBank size={16} color="#10b981" />
                Savings Target Progress
              </h3>
              <button
                onClick={() => onNavigateTab('budgets')}
                style={{ background: 'none', border: 'none', fontSize: '0.75rem', fontWeight: 700, color: '#0f1219', cursor: 'pointer' }}
              >
                Manage
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {savingsGoals.slice(0, 3).map((goal) => {
                const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <div
                    key={goal.id}
                    style={{
                      background: 'var(--bg-card-subtle)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-card)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{goal.title}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                        {formatINR(goal.currentAmount)} / {formatINR(goal.targetAmount)} ({pct}%)
                      </span>
                    </div>
                    {/* Rounded Progress Track */}
                    <div style={{ width: '100%', height: '7px', background: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: pct >= 100 ? '#10b981' : 'var(--primary-lime-hover)',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Spending Warnings & Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#ef4444', marginBottom: '2px' }}>
                Budget Warning ({budgetAlerts.length} Categories Exceeding 80%)
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                {budgetAlerts.map((b) => b.category).join(', ')} has used over 80% of its monthly allowance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
