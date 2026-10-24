import React, { useState } from 'react';
import { X, Check, ShieldCheck, DollarSign } from 'lucide-react';
import { Invoice, InvoicePayment } from '../../types/finance';
import { formatINR, generateIdempotencyKey } from '../../services/financialCalculations';
import { recordInvoicePayment } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface InvoicePaymentModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = ['UPI (GooglePay/PhonePe)', 'Bank Transfer (NEFT/RTGS)', 'Cheque', 'Cash in Hand', 'Card'];

export const InvoicePaymentModal: React.FC<InvoicePaymentModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [amount, setAmount] = useState<string>(() =>
    invoice ? invoice.remainingBalance.toString() : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please specify a positive payment amount.');
      return;
    }

    if (numAmount > invoice.remainingBalance + 0.01) {
      setError(`Payment cannot exceed remaining invoice balance of ${formatINR(invoice.remainingBalance)}.`);
      return;
    }

    if (!currentUser) {
      setError('You must be signed in.');
      return;
    }

    setLoading(true);

    try {
      const paymentId = `inv_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const idempotencyKey = generateIdempotencyKey(
        'inv_pay',
        invoice.id,
        numAmount,
        Date.now()
      );

      const payment: InvoicePayment = {
        id: paymentId,
        userId: currentUser.id,
        invoiceId: invoice.id,
        amount: Math.round(numAmount * 100) / 100,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        idempotencyKey,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      const result = await recordInvoicePayment(payment);
      if (!result.success) {
        setError(result.message || 'Payment failed.');
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Record Invoice Payment</h2>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              Invoice #{invoice.invoiceNumber} • {invoice.clientName}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Balance status banner */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Invoiced</div>
            <div style={{ fontWeight: 700 }}>{formatINR(invoice.totalAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Already Paid</div>
            <div style={{ fontWeight: 700, color: '#34d399' }}>{formatINR(invoice.paidAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remaining Balance</div>
            <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.05rem' }}>
              {formatINR(invoice.remainingBalance)}
            </div>
          </div>
        </div>

        {/* Cash recognition notice */}
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.775rem',
            color: '#34d399',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={18} />
          <span>
            Recording this payment registers actual cash received in your ledger and adjusts Accounts Receivable.
          </span>
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
            <label className="input-label">Payment Amount in INR (₹)</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  fontSize: '1.1rem'
                }}
              >
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                className="input-field"
                style={{ paddingLeft: '32px', fontSize: '1.2rem', fontWeight: 700 }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setAmount(invoice.remainingBalance.toString())}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.725rem', padding: '2px 8px' }}
              >
                Full Balance ({formatINR(invoice.remainingBalance)})
              </button>
              <button
                type="button"
                onClick={() => setAmount((invoice.remainingBalance / 2).toFixed(2))}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.725rem', padding: '2px 8px' }}
              >
                50% Partial
              </button>
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
              <label className="input-label">Payment Method</label>
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
            <label className="input-label">Transaction / UTR Reference #</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. UPI/20261024/987654 or NEFT123"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Notes</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Received via PhonePe QR"
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
              <span>{loading ? 'Recording Payment...' : 'Confirm & Post Payment'}</span>
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
