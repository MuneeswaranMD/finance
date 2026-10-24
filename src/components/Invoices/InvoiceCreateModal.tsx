import React, { useState } from 'react';
import { X, Plus, Trash2, Check, FileText } from 'lucide-react';
import { Invoice, InvoiceItem, Project } from '../../types/finance';
import { calculateInvoiceTotals, formatINR } from '../../services/financialCalculations';
import { createInvoice } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface InvoiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects?: Project[];
}

export const InvoiceCreateModal: React.FC<InvoiceCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects = []
}) => {
  const { currentUser } = useAuth();
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [clientName, setClientName] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [projectId, setProjectId] = useState<string>('');
  const [notes, setNotes] = useState<string>('Thank you for your business. Please remit to our bank account.');

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'item_1',
      description: 'Consulting Services',
      quantity: 1,
      unitPrice: 25000,
      gstRate: 18,
      total: 29500
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate line total
    const qty = Number(updated[index].quantity) || 0;
    const price = Number(updated[index].unitPrice) || 0;
    const gst = Number(updated[index].gstRate) || 0;
    const sub = qty * price;
    updated[index].total = Math.round((sub + (sub * gst) / 100) * 100) / 100;

    setItems(updated);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `item_${Date.now()}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        gstRate: 18,
        total: 0
      }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }

    if (totalAmount <= 0) {
      setError('Invoice total must be greater than zero.');
      return;
    }

    if (!currentUser) {
      setError('You must be signed in.');
      return;
    }

    setLoading(true);

    try {
      const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newInvoice: Invoice = {
        id: invId,
        userId: currentUser.id,
        invoiceNumber,
        clientName: clientName.trim(),
        ...(clientEmail.trim() ? { clientEmail: clientEmail.trim() } : {}),
        issueDate,
        dueDate,
        ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
        items,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount: 0,
        remainingBalance: totalAmount,
        status: 'sent',
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await createInvoice(newInvoice);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="#6366f1" />
            <h2 className="modal-title">Create Client Invoice</h2>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Invoice Number</label>
              <input
                type="text"
                className="input-field"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Project (Optional)</label>
              <select
                className="input-field"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">No Project Tag</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Client Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Acme Tech Solutions"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Client Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="billing@acme.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Issue Date</label>
              <input
                type="date"
                className="input-field"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Due Date</label>
              <input
                type="date"
                className="input-field"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="input-label" style={{ margin: 0 }}>
                Invoice Line Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                <Plus size={13} />
                <span>Add Item</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto',
                    gap: '8px',
                    alignItems: 'center',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <input
                    type="text"
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    placeholder="Unit Price (₹)"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <select
                    className="input-field"
                    style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    value={item.gstRate}
                    onChange={(e) => handleItemChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                  >
                    <option value={0}>0% GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: items.length === 1 ? 'var(--text-muted)' : '#f87171',
                      cursor: items.length === 1 ? 'default' : 'pointer',
                      padding: '4px'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Subtotal & Total Summary */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '0.875rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Estimated GST / Tax:</span>
              <span>{formatINR(taxAmount)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: '1.05rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '6px'
              }}
            >
              <span>Total Invoice Amount:</span>
              <span style={{ color: '#818cf8' }}>{formatINR(totalAmount)}</span>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Payment Instructions / Notes</label>
            <input
              type="text"
              className="input-field"
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
              <span>{loading ? 'Creating Invoice...' : 'Generate & Issue Invoice'}</span>
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
