import React from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Send,
  CreditCard,
  Building,
  Clock,
  ChevronRight,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { Transaction, Invoice, Loan, LoanInstallment } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';

interface HomeDashboardProps {
  cashBalance: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  transactions: Transaction[];
  invoices: Invoice[];
  loans: Loan[];
  installments: LoanInstallment[];
  onNavigateTab: (tab: string) => void;
  openAddTxModal: () => void;
  openInvoiceCreateModal: () => void;
  openLoanPaymentModal: (loan: Loan, installment: LoanInstallment | null) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  cashBalance,
  monthlyInflow,
  monthlyOutflow,
  transactions,
  invoices,
  loans,
  installments,
  onNavigateTab,
  openAddTxModal,
  openInvoiceCreateModal,
  openLoanPaymentModal
}) => {
  // Find upcoming EMI installment
  const nextPendingEMI = installments
    .filter((i) => i.status === 'pending')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const loanForEMI = nextPendingEMI ? loans.find((l) => l.id === nextPendingEMI.loanId) : null;

  // Pending client invoices
  const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'partially_paid');
  const totalReceivable = pendingInvoices.reduce((sum, i) => sum + i.remainingBalance, 0);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Top 3-Screen Pill Switcher (Reference Screen 1) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
        <div className="pill-switcher">
          <button
            className="switcher-pill active"
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
            className="switcher-pill"
            onClick={() => onNavigateTab('insights')}
          >
            Insights
          </button>
          <button
            className="switcher-pill"
            onClick={() => onNavigateTab('coach')}
            style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
          >
            <Sparkles size={13} />
            <span>AI Coach</span>
          </button>
        </div>
      </div>

      {/* 1. Hero Lime-Green Card (Reference Screen 1) */}
      <div className="lime-hero-card">
        <div className="lime-card-header">
          <div className="balance-title-group">
            <span className="balance-label">Wallet Balance</span>
            <span className="percent-badge-dark">+4.2%</span>
          </div>

          <button
            className="card-action-sq"
            onClick={() => onNavigateTab('transactions')}
            title="View cash ledger"
          >
            <CreditCard size={18} color="#000000" />
          </button>
        </div>

        <div className="balance-huge-text">
          {formatINR(cashBalance)}
        </div>
        <div className="balance-date-text">
          Updated: {new Date().toLocaleDateString('en-GB')}
        </div>

        {/* Inner White Floating Card */}
        <div className="lime-inner-white-card">
          <div className="cash-flow-col">
            <div className="flow-icon-circle expense">
              <ArrowDown size={18} />
            </div>
            <div>
              <div className="flow-label">Expense</div>
              <div className="flow-amount">{formatINR(monthlyOutflow)}</div>
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: 'rgba(0,0,0,0.08)' }} />

          <div className="cash-flow-col" style={{ paddingLeft: '16px' }}>
            <div className="flow-icon-circle income">
              <ArrowUp size={18} />
            </div>
            <div>
              <div className="flow-label">Income</div>
              <div className="flow-amount" style={{ color: '#10b981' }}>{formatINR(monthlyInflow)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Action 4-Card Grid (Reference Screen 1) */}
      <div className="quick-action-grid">
        <div className="quick-action-card" onClick={openAddTxModal}>
          <div className="action-icon-circle">
            <ArrowUpRight size={20} />
          </div>
          <span className="action-card-label">Add Expense</span>
        </div>

        <div className="quick-action-card" onClick={openAddTxModal}>
          <div className="action-icon-circle">
            <ArrowDownLeft size={20} />
          </div>
          <span className="action-card-label">Add Income</span>
        </div>

        <div className="quick-action-card" onClick={() => onNavigateTab('invoices')}>
          <div className="action-icon-circle">
            <Send size={18} />
          </div>
          <span className="action-card-label">Send Invoice</span>
        </div>

        <div className="quick-action-card" onClick={() => onNavigateTab('loans')}>
          <div className="action-icon-circle">
            <Building size={18} />
          </div>
          <span className="action-card-label">Pay EMI</span>
        </div>
      </div>

      {/* 3. Actionable Reminders: Upcoming EMIs & Receivables */}
      {(nextPendingEMI || pendingInvoices.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px',
            marginBottom: '28px'
          }}
        >
          {nextPendingEMI && loanForEMI && (
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <Clock size={14} color="#f59e0b" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
                    Upcoming EMI Due
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{loanForEMI.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Due: {nextPendingEMI.dueDate} • {formatINR(nextPendingEMI.totalEMI)}
                </div>
              </div>

              <button
                onClick={() => openLoanPaymentModal(loanForEMI, nextPendingEMI)}
                className="btn btn-primary btn-sm"
              >
                Pay Now
              </button>
            </div>
          )}

          {pendingInvoices.length > 0 && (
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              onClick={() => onNavigateTab('invoices')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <ShieldAlert size={14} color="#0284c7" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                    Pending Receivables ({pendingInvoices.length})
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  {formatINR(totalReceivable)} Awaiting Collection
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Earned accrual revenue from client invoices
                </div>
              </div>

              <ChevronRight size={18} color="var(--text-muted)" />
            </div>
          )}

          {/* Smart AI Coach Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(99, 102, 241, 0.14))',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => onNavigateTab('coach')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                    Smart Coach & Budget Engine
                  </span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                    AI
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                  Check Safe Daily Spending & 50/30/20 Plan
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Grounded in INR bank transactions with Gemini AI analysis
                </div>
              </div>
            </div>

            <ChevronRight size={18} color="#34d399" />
          </div>
        </div>
      )}

      {/* 4. Transactions List Section (Reference Screen 1) */}
      <div className="surface-card">
        <div className="section-header-flex">
          <h3 className="section-title">Transactions</h3>
          <span className="see-all-link" onClick={() => onNavigateTab('transactions')}>
            See all
          </span>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No recent transactions. Add an expense or income to start tracking.
          </div>
        ) : (
          <div>
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="tx-row-item">
                <div className="tx-left">
                  <div className="tx-icon-sq">
                    {tx.category[0] || '₹'}
                  </div>
                  <div>
                    <div className="tx-title">{tx.description}</div>
                    <div className="tx-date">
                      {tx.date} • {tx.account}
                    </div>
                  </div>
                </div>

                <div className={`tx-amount ${tx.type === 'expense' ? 'debit' : 'credit'}`}>
                  {tx.type === 'expense' ? '-' : '+'}
                  {formatINR(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
