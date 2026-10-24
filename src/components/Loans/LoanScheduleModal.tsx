import React, { useState } from 'react';
import { X, Download, CreditCard, CheckCircle, Calendar, Trash2, RotateCcw } from 'lucide-react';
import { Loan, LoanInstallment } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';
import { exportLoanScheduleToCSV } from '../../services/csvExport';
import { deleteLoanInstallment, revertLoanInstallmentPayment } from '../../services/firestoreService';

interface LoanScheduleModalProps {
  loan: Loan | null;
  installments: LoanInstallment[];
  isOpen: boolean;
  onClose: () => void;
  onOpenPaymentModal: (loan: Loan, installment: LoanInstallment) => void;
  onRefresh?: () => void;
}

export const LoanScheduleModal: React.FC<LoanScheduleModalProps> = ({
  loan,
  installments,
  isOpen,
  onClose,
  onOpenPaymentModal,
  onRefresh
}) => {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  if (!isOpen || !loan) return null;

  const loanInstallments = installments.filter((i) => i.loanId === loan.id);

  const handleDeleteInstallment = async (installmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this installment from the schedule?')) return;
    setActionLoadingId(installmentId);
    try {
      await deleteLoanInstallment(installmentId);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete installment:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevertPayment = async (inst: LoanInstallment) => {
    if (!window.confirm(`Revert EMI #${inst.installmentNumber} payment? This will restore ${formatINR(inst.principalComponent)} back to the loan principal balance.`)) return;
    setActionLoadingId(inst.id);
    try {
      await revertLoanInstallmentPayment(inst.id, loan.id, inst.principalComponent);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to revert payment:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '860px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Amortization Schedule</h2>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              {loan.title} ({loan.counterparty}) • Principal: {formatINR(loan.principalAmount)} • Rate: {loan.annualInterestRate}%
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing {loanInstallments.length} monthly installments
          </div>
          <button
            onClick={() => exportLoanScheduleToCSV(loan, loanInstallments)}
            className="btn btn-secondary btn-sm"
          >
            <Download size={14} />
            <span>Export Schedule CSV</span>
          </button>
        </div>

        <div className="table-responsive" style={{ maxHeight: '440px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Due Date</th>
                <th>Principal Part</th>
                <th>Interest Part</th>
                <th>Total EMI</th>
                <th>Remaining Principal</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loanInstallments.map((inst) => {
                const isLoading = actionLoadingId === inst.id;
                return (
                  <tr key={inst.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                      #{inst.installmentNumber}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} color="var(--text-muted)" />
                        <span>{inst.dueDate}</span>
                      </div>
                    </td>
                    <td style={{ color: '#818cf8', fontWeight: 600 }}>
                      {formatINR(inst.principalComponent)}
                    </td>
                    <td style={{ color: '#fb7185', fontWeight: 600 }}>
                      {formatINR(inst.interestComponent)}
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      {formatINR(inst.totalEMI)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                      {formatINR(inst.remainingBalanceAfter)}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {inst.status === 'paid' ? (
                        <span className="status-pill status-paid">
                          <CheckCircle size={11} />
                          Paid
                        </span>
                      ) : (
                        <span className="status-pill status-pending">
                          Pending
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {inst.status === 'paid' ? (
                          <button
                            onClick={() => handleRevertPayment(inst)}
                            disabled={isLoading}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.725rem', color: '#fbbf24' }}
                            title="Revert EMI payment back to pending and restore loan balance"
                          >
                            <RotateCcw size={12} />
                            <span>{isLoading ? '...' : 'Revert'}</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                onClose();
                                onOpenPaymentModal(loan, inst);
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.725rem' }}
                            >
                              <CreditCard size={12} />
                              <span>Pay</span>
                            </button>
                            <button
                              onClick={() => handleDeleteInstallment(inst.id)}
                              disabled={isLoading}
                              className="btn btn-secondary btn-sm hover-danger"
                              style={{ padding: '3px 6px', color: '#f87171' }}
                              title="Delete this installment"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
