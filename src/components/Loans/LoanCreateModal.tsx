import React, { useState } from 'react';
import { X, Check, Landmark, Calculator } from 'lucide-react';
import { Loan, LoanType } from '../../types/finance';
import { calculateEMI, formatINR } from '../../services/financialCalculations';
import { createLoanWithAmortization } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface LoanCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoanCreateModal: React.FC<LoanCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [type, setType] = useState<LoanType>('taken');
  const [principal, setPrincipal] = useState<string>('500000');
  const [interestRate, setInterestRate] = useState<string>('9.5');
  const [tenureMonths, setTenureMonths] = useState<string>('36');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const numPrincipal = parseFloat(principal) || 0;
  const numRate = parseFloat(interestRate) || 0;
  const numTenure = parseInt(tenureMonths, 10) || 0;

  const calculatedEMI = calculateEMI(numPrincipal, numRate, numTenure);
  const totalPayable = Math.round(calculatedEMI * numTenure * 100) / 100;
  const totalInterest = Math.max(0, Math.round((totalPayable - numPrincipal) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !counterparty.trim()) {
      setError('Please provide loan title and counterparty.');
      return;
    }

    if (numPrincipal <= 0 || numTenure <= 0) {
      setError('Principal and tenure must be positive numbers.');
      return;
    }

    if (!currentUser) {
      setError('You must be signed in.');
      return;
    }

    setLoading(true);

    try {
      const loanId = `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const loan: Loan = {
        id: loanId,
        userId: currentUser.id,
        title: title.trim(),
        counterparty: counterparty.trim(),
        type,
        principalAmount: numPrincipal,
        annualInterestRate: numRate,
        tenureMonths: numTenure,
        monthlyEMI: calculatedEMI,
        totalInterest,
        totalPayable,
        remainingPrincipal: numPrincipal,
        startDate,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await createLoanWithAmortization(loan);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create loan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark size={22} color="#818cf8" />
            <h2 className="modal-title">Create Loan & EMI Schedule</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
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
          {/* Loan Type */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '4px',
              marginBottom: '16px'
            }}
          >
            <button
              type="button"
              onClick={() => setType('taken')}
              style={{
                flex: 1,
                padding: '8px',
                background: type === 'taken' ? 'var(--bg-dark)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: type === 'taken' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: type === 'taken' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                transition: 'var(--transition)'
              }}
            >
              Borrowed Loan (Liability)
            </button>
            <button
              type="button"
              onClick={() => setType('given')}
              style={{
                flex: 1,
                padding: '8px',
                background: type === 'given' ? 'var(--accent-income)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: type === 'given' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: type === 'given' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                transition: 'var(--transition)'
              }}
            >
              Lent Out (Asset)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Loan Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. HDFC Home Loan or Car Loan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Bank / Counterparty</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. HDFC Bank Ltd"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Principal Amount in INR (₹)</label>
            <input
              type="number"
              step="1000"
              className="input-field"
              style={{ fontSize: '1.15rem', fontWeight: 700 }}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Annual Interest (%)</label>
              <input
                type="number"
                step="0.05"
                className="input-field"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Tenure (Months)</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Start Date</label>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Real-time EMI Amortization Preview */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8', marginBottom: '8px' }}>
              <Calculator size={16} />
              <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>Amortization Breakdown (Reducing Balance)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Monthly EMI:</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#34d399' }}>
                  {formatINR(calculatedEMI)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Total Interest:</div>
                <div style={{ fontWeight: 700, color: '#fb7185' }}>
                  {formatINR(totalInterest)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Total Repayment:</div>
                <div style={{ fontWeight: 700 }}>
                  {formatINR(totalPayable)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: '2 1 180px' }}
            >
              <Check size={16} />
              <span>{loading ? 'Creating Schedule...' : 'Save & Generate Schedule'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: '1 1 90px' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
