import React, { useState } from 'react';
import {
  Landmark,
  Plus,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle2,
  TrendingDown,
  PieChart,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Loan, LoanInstallment } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';
import { deleteLoan } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';
import { LoanScheduleModal } from './LoanScheduleModal';

interface LoanListProps {
  loans: Loan[];
  installments: LoanInstallment[];
  onOpenCreateModal: () => void;
  onOpenPaymentModal: (loan: Loan, installment: LoanInstallment | null) => void;
  onRefresh?: () => void;
}

export const LoanList: React.FC<LoanListProps> = ({
  loans,
  installments,
  onOpenCreateModal,
  onOpenPaymentModal,
  onRefresh
}) => {
  const { currentUser } = useAuth();
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalBorrowedLiability = loans
    .filter((l) => l.type === 'taken' && l.status === 'active')
    .reduce((sum, l) => sum + l.remainingPrincipal, 0);

  const totalLentAssets = loans
    .filter((l) => l.type === 'given' && l.status === 'active')
    .reduce((sum, l) => sum + l.remainingPrincipal, 0);

  const monthlyEMICommitment = loans
    .filter((l) => l.type === 'taken' && l.status === 'active')
    .reduce((sum, l) => sum + l.monthlyEMI, 0);

  const handleConfirmDelete = async () => {
    if (!loanToDelete || !currentUser) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLoan(loanToDelete.id, currentUser.id);
      setLoanToDelete(null);
      if (selectedLoanForSchedule?.id === loanToDelete.id) {
        setSelectedLoanForSchedule(null);
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete loan');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Metrics Row */}
      <div className="grid-metrics" style={{ marginBottom: '20px' }}>
        <div className="metric-card" style={{ borderLeft: '4px solid #f43f5e' }}>
          <span className="metric-title">Total Outstanding Debt (Principal)</span>
          <div className="metric-value" style={{ color: '#e11d48' }}>
            {formatINR(totalBorrowedLiability)}
          </div>
          <div className="metric-subtitle">Across active taken loans</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid #10b981' }}>
          <span className="metric-title">Loans Given (Receivable Assets)</span>
          <div className="metric-value" style={{ color: '#10b981' }}>
            {formatINR(totalLentAssets)}
          </div>
          <div className="metric-subtitle">Principal owed back to you</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <span className="metric-title">Monthly EMI Commitment</span>
          <div className="metric-value" style={{ color: '#4f46e5' }}>
            {formatINR(monthlyEMICommitment)}
          </div>
          <div className="metric-subtitle">Total monthly cash outflow for debt</div>
        </div>
      </div>

      <div className="glass-card">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Loans & Reducing Balance EMI Tracker</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Principal vs interest separation with complete amortization schedules
            </p>
          </div>

          <button onClick={onOpenCreateModal} className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>Add Loan</span>
          </button>
        </div>

        {loans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            No loans recorded. Add a home loan, personal loan, or lent-out fund to track EMIs.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {loans.map((loan) => {
              const paidPrincipal = Math.max(0, loan.principalAmount - loan.remainingPrincipal);
              const progressPct = Math.min(
                100,
                Math.round((paidPrincipal / loan.principalAmount) * 100)
              );

              // Find next pending installment
              const nextPendingInst = installments
                .filter((i) => i.loanId === loan.id && i.status === 'pending')
                .sort((a, b) => a.installmentNumber - b.installmentNumber)[0];

              return (
                <div
                  key={loan.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{loan.title}</div>
                        <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                          {loan.counterparty} • {loan.type === 'taken' ? 'Borrowed' : 'Lent Out'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className="status-pill"
                          style={{
                            background: loan.status === 'active' ? 'var(--accent-info-light)' : 'var(--accent-income-light)',
                            color: loan.status === 'active' ? '#38bdf8' : '#34d399'
                          }}
                        >
                          {loan.status}
                        </span>

                        <button
                          onClick={() => setLoanToDelete(loan)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            transition: 'color 0.15s ease'
                          }}
                          title="Delete Loan"
                          className="hover-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '12px 0' }}>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Monthly EMI:</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#818cf8' }}>
                          {formatINR(loan.monthlyEMI)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Interest Rate:</div>
                        <div style={{ fontWeight: 700 }}>
                          {loan.annualInterestRate}% p.a.
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Remaining Principal:</div>
                        <div style={{ fontWeight: 700, color: '#fbbf24' }}>
                          {formatINR(loan.remainingPrincipal)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Original Principal:</div>
                        <div style={{ fontWeight: 600 }}>
                          {formatINR(loan.principalAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Principal Repayment Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Principal Repaid: {progressPct}%</span>
                        <span>{formatINR(paidPrincipal)}</span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          background: 'rgba(0, 0, 0, 0.08)',
                          borderRadius: '999px',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${progressPct}%`,
                            background: 'linear-gradient(90deg, #10b981, #6366f1)',
                            borderRadius: '999px'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <button
                      onClick={() => setSelectedLoanForSchedule(loan)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.775rem' }}
                    >
                      <FileText size={13} />
                      <span>Schedule & EMIs</span>
                    </button>

                    {loan.status === 'active' && (
                      <button
                        onClick={() => onOpenPaymentModal(loan, nextPendingInst || null)}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1.2, fontSize: '0.775rem' }}
                      >
                        <CreditCard size={13} />
                        <span>Pay Next EMI</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {loanToDelete && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: '#f87171' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Delete Loan Record?</h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 16px 0' }}>
              Are you sure you want to delete <strong>{loanToDelete.title}</strong>?
              <br /><br />
              This will permanently delete the loan, its entire amortization schedule ({installments.filter(i => i.loanId === loanToDelete.id).length} monthly EMI installments), and linked payment records.
            </p>

            {deleteError && (
              <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '6px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setLoanToDelete(null)}
                disabled={isDeleting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <LoanScheduleModal
        loan={selectedLoanForSchedule}
        installments={installments}
        isOpen={!!selectedLoanForSchedule}
        onClose={() => setSelectedLoanForSchedule(null)}
        onOpenPaymentModal={(l, inst) => onOpenPaymentModal(l, inst)}
        onRefresh={onRefresh}
      />
    </div>
  );
};
