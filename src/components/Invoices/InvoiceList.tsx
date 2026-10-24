import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CreditCard,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  Building
} from 'lucide-react';
import { Invoice } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';
import { exportInvoicesToCSV } from '../../services/csvExport';

interface InvoiceListProps {
  invoices: Invoice[];
  onOpenCreateModal: () => void;
  onOpenPaymentModal: (invoice: Invoice) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onOpenCreateModal,
  onOpenPaymentModal
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = invoices.filter((inv) => {
    if (filterStatus === 'all') return true;
    return inv.status === filterStatus;
  });

  const totalInvoiced = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalReceived = invoices.reduce((sum, i) => sum + i.paidAmount, 0);
  const totalReceivable = invoices.reduce((sum, i) => sum + i.remainingBalance, 0);

  return (
    <div>
      {/* Summary Banner */}
      <div className="grid-metrics" style={{ marginBottom: '20px' }}>
        <div className="metric-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <span className="metric-title">Total Invoiced (Accrual Billed)</span>
          <div className="metric-value">{formatINR(totalInvoiced)}</div>
          <div className="metric-subtitle">Across {invoices.length} invoices</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid #10b981' }}>
          <span className="metric-title">Actual Cash Collected</span>
          <div className="metric-value" style={{ color: '#10b981' }}>{formatINR(totalReceived)}</div>
          <div className="metric-subtitle">Confirmed in bank/UPI</div>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <span className="metric-title">Pending Accounts Receivable</span>
          <div className="metric-value" style={{ color: '#d97706' }}>{formatINR(totalReceivable)}</div>
          <div className="metric-subtitle">Earned revenue not yet received</div>
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
            marginBottom: '16px'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Invoices & Accounts Receivable</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Accrual revenue tracking with strict separation from cash inflow
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => exportInvoicesToCSV(filtered)}
              className="btn btn-secondary btn-sm"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button onClick={onOpenCreateModal} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>New Invoice</span>
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            marginBottom: '16px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {(['all', 'sent', 'partially_paid', 'paid', 'overdue', 'draft'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                background: filterStatus === s ? 'var(--bg-dark)' : 'rgba(0, 0, 0, 0.05)',
                border: filterStatus === s ? '1px solid var(--bg-dark)' : '1px solid transparent',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                color: filterStatus === s ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                transition: 'var(--transition)',
                boxShadow: filterStatus === s ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none'
              }}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            No invoices found for this status.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Total Billed</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 700, color: '#818cf8', whiteSpace: 'nowrap' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.clientName}</div>
                      {inv.clientEmail && (
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {inv.clientEmail}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <div>Issued: {inv.issueDate}</div>
                      <div>Due: {inv.dueDate}</div>
                    </td>
                    <td>
                      <span className={`status-pill status-${inv.status}`}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {formatINR(inv.totalAmount)}
                    </td>
                    <td style={{ color: '#34d399', fontWeight: 600 }}>
                      {formatINR(inv.paidAmount)}
                    </td>
                    <td style={{ fontWeight: 800, color: inv.remainingBalance > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                      {formatINR(inv.remainingBalance)}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {inv.status !== 'paid' && inv.status !== 'cancelled' ? (
                        <button
                          onClick={() => onOpenPaymentModal(inv)}
                          className="btn btn-success btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <CreditCard size={13} />
                          <span>Record Payment</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>
                          ✓ Fully Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
