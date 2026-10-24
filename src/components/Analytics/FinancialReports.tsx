import React from 'react';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Info,
  Briefcase,
  CheckCircle2
} from 'lucide-react';
import { Transaction, Invoice, Project } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';

interface FinancialReportsProps {
  transactions: Transaction[];
  invoices: Invoice[];
  projects: Project[];
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({
  transactions,
  invoices,
  projects
}) => {
  // 1. Cash Accounting Computations
  const cashInflow = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const cashOutflow = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = cashInflow - cashOutflow;

  // 2. Accrual Accounting Computations
  const totalInvoicedRevenue = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const directIncomeNonInvoice = transactions
    .filter((t) => t.type === 'income' && !t.invoicePaymentId)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAccruedRevenue = totalInvoicedRevenue + directIncomeNonInvoice;
  const netAccrualProfit = totalAccruedRevenue - cashOutflow;
  const accountsReceivable = invoices.reduce((sum, i) => sum + i.remainingBalance, 0);

  // 3. Category Breakdown for Expenses
  const expenses = transactions.filter((t) => t.type === 'expense');
  const catMap: Record<string, number> = {};
  expenses.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const categories = Object.entries(catMap)
    .map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: cashOutflow > 0 ? Math.round((amount / cashOutflow) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Accrual vs Cash Accounting Comparison */}
      <div className="glass-card">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Cash vs Accrual Accounting Analysis</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Comparing cash in hand versus earned accounting profit
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* Cash Basis Card */}
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-card)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <TrendingUp size={18} color="#10b981" />
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Cash Accounting Basis</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Actual Cash Inflow:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>+{formatINR(cashInflow)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Actual Cash Outflow:</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>-{formatINR(cashOutflow)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px',
                  fontWeight: 800,
                  fontSize: '1rem'
                }}
              >
                <span>Net Cash Generated:</span>
                <span style={{ color: netCashFlow >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatINR(netCashFlow)}
                </span>
              </div>
            </div>
          </div>

          {/* Accrual Basis Card */}
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-card)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Briefcase size={18} color="#6366f1" />
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Accrual Accounting Basis</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Earned Invoicing Revenue:</span>
                <span style={{ color: '#6366f1', fontWeight: 700 }}>+{formatINR(totalAccruedRevenue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Recognized Expenses:</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>-{formatINR(cashOutflow)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px',
                  fontWeight: 800,
                  fontSize: '1rem'
                }}
              >
                <span>Accrual Net Profit:</span>
                <span style={{ color: netAccrualProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatINR(netAccrualProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Explanation Box */}
        <div
          style={{
            padding: '14px 16px',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            fontSize: '0.825rem',
            color: 'var(--text-main)'
          }}
        >
          <Info size={20} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Reconciliation Insight:</strong> There is a difference of{' '}
            <strong style={{ color: '#d97706' }}>{formatINR(accountsReceivable)}</strong> between your Accrual Profit and Liquid Cash Flow. This represents unpaid client invoices in Accounts Receivable. In compliance with sound accounting principles, unpaid invoices are never treated as cash received until payments are settled.
          </div>
        </div>
      </div>

      {/* Expense Category Breakdown */}
      <div className="glass-card">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Expense Category Distribution</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Total Outflow: {formatINR(cashOutflow)}
          </p>
        </div>

        {categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No expense transactions to visualize.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {categories.map((c) => (
              <div key={c.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{c.category}</span>
                  <div>
                    <span style={{ fontWeight: 700 }}>{formatINR(c.amount)}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({c.percentage}%)</span>
                  </div>
                </div>
                <div
                  style={{
                    height: '8px',
                    background: 'rgba(0, 0, 0, 0.08)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${c.percentage}%`,
                      background: 'linear-gradient(90deg, #f43f5e, #fb923c)',
                      borderRadius: '999px'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Profitability */}
      <div className="glass-card">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Project Profitability Report</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Comparing client invoiced billings against project expenses
          </p>
        </div>

        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No projects found. Tag transactions or invoices with projects to track margins.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Budget</th>
                  <th>Invoiced (Revenue)</th>
                  <th>Direct Expenses</th>
                  <th>Net Margin</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const projInvoiced = invoices
                    .filter((i) => i.projectId === p.id)
                    .reduce((sum, i) => sum + i.totalAmount, 0);

                  const projExpenses = transactions
                    .filter((t) => t.projectId === p.id && t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);

                  const margin = projInvoiced - projExpenses;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td>{p.clientName || 'Internal'}</td>
                      <td>{formatINR(p.budget)}</td>
                      <td style={{ color: '#34d399', fontWeight: 700 }}>{formatINR(projInvoiced)}</td>
                      <td style={{ color: '#fb7185' }}>{formatINR(projExpenses)}</td>
                      <td style={{ fontWeight: 800, color: margin >= 0 ? '#34d399' : '#fb7185' }}>
                        {formatINR(margin)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
