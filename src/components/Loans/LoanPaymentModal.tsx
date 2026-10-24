import React, { useState } from 'react';
import { X, Check, ShieldCheck, Landmark } from 'lucide-react';
import { Loan, LoanInstallment, LoanPayment } from '../../types/finance';
import { formatINR, generateIdempotencyKey } from '../../services/financialCalculations';
import { recordLoanPayment } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface LoanPaymentModalProps {
  loan: Loan | null;
  installment: LoanInstallment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = ['HDFC Bank (Auto-Debit)', 'ICICI Bank', 'SBI Bank', 'UPI', 'Net Banking'];

export const LoanPaymentModal: React.FC<LoanPaymentModalProps> = ({
  loan,
  installment,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentDate, setPaymentDate] = useState<string>(
    installment?.dueDate || new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !loan) return null;

  const emiAmount = installment ? installment.totalEMI : loan.monthlyEMI;
  const principalComponent = installment
    ? installment.principalComponent
    : Math.round((emiAmount * 0.7) * 100) / 100;
  const interestComponent = installment
    ? installment.interestComponent
    : Math.round((emiAmount - principalComponent) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) {
      setError('You must be signed in.');
      return;
    }

    setLoading(true);

    try {
      const paymentId = `loan_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const installmentNum = installment?.installmentNumber || 1;
      const idempotencyKey = generateIdempotencyKey(
        'emi_pay',
        `${loan.id}_inst_${installmentNum}`,
        emiAmount,
        Date.now()
      );

      const payment: LoanPayment = {
        id: paymentId,
        userId: currentUser.id,
        loanId: loan.id,
        installmentId: installment?.id,
        installmentNumber: installmentNum,
        amount: emiAmount,
        principalPaid: principalComponent,
        interestPaid: interestComponent,
        paymentDate,
        paymentMethod,
        idempotencyKey,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      const res = await recordLoanPayment(payment);
      if (!res.success) {
        setError(res.message || 'Loan payment failed');
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post loan payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Pay Loan EMI Installment</h2>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              {loan.title} ({loan.counterparty}) {installment ? `• Installment #${installment.installmentNumber}` : ''}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Financial Separation Alert */}
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.775rem',
            color: '#cbd5e1'
          }}
        >
          <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>
            Strict Financial Segregation:
          </div>
          <div>
            • <strong>Principal Reduction:</strong> {formatINR(principalComponent)} (Decreases loan liability)
          </div>
          <div>
            • <strong>Interest Charge:</strong> {formatINR(interestComponent)} (Tax deductible P&L Expense)
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(244, 63, 94, 0.12)',
              color: '#f87171',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              marginBottom: '16px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">EMI Amount Due (INR)</label>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: '#059669',
                fontFamily: 'var(--font-heading)',
                background: 'var(--bg-card-subtle)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {formatINR(emiAmount)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Payment Date</label>
              <input
                type="date"
                className="input-field"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Debited Account</label>
              <select
                className="input-field"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Notes</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. ECS auto debit ref #987213"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              <Check size={16} />
              <span>{loading ? 'Processing EMI...' : 'Confirm & Post EMI Payment'}</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
