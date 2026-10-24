import React, { useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Filter,
  Tag,
  Calendar
} from 'lucide-react';
import { Transaction, TransactionType } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';
import { exportTransactionsToCSV } from '../../services/csvExport';
import { deleteTransaction } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface TransactionListProps {
  transactions: Transaction[];
  onRefresh: () => void;
  openCreateModal: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onRefresh,
  openCreateModal
}) => {
  const { currentUser } = useAuth();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchDesc = (tx.description || '').toLowerCase().includes(q);
      const matchCat = tx.category.toLowerCase().includes(q);
      const matchAcc = tx.account.toLowerCase().includes(q);
      const matchTags = (tx.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchDesc && !matchCat && !matchAcc && !matchTags) return false;
    }

    return true;
  });

  const categories = Array.from(new Set(transactions.map((t) => t.category)));

  const handleDelete = async (id: string) => {
    if (!currentUser) return;
    if (window.confirm('Are you sure you want to delete this transaction record?')) {
      await deleteTransaction(id, currentUser.id);
      onRefresh();
    }
  };

  return (
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Cash & Bank Ledger</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Realized cash transactions in Indian Rupee
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => exportTransactionsToCSV(filtered)}
            className="btn btn-secondary btn-sm"
            title="Download CSV report"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button onClick={openCreateModal} className="btn btn-primary btn-sm">
            <span>+ Add Entry</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
          alignItems: 'center'
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }}
          />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '34px', paddingBottom: '8px', paddingTop: '8px' }}
            placeholder="Search by note, account, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Type pills */}
        <div className="pill-switcher">
          {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`switcher-pill ${filterType === t ? 'active' : ''}`}
              style={{ textTransform: 'capitalize', padding: '6px 14px', fontSize: '0.8rem' }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Category select */}
        <select
          className="input-field"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions Table */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 10px',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}
        >
          No transactions found matching your criteria.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount (INR)</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} color="var(--text-muted)" />
                      <span>{tx.date}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.description}</div>
                    {tx.tags && tx.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {tx.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: '0.675rem',
                              background: 'rgba(0,0,0,0.05)',
                              border: '1px solid var(--border-subtle)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(0,0,0,0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)'
                      }}
                    >
                      {tx.category}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                    {tx.account}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 800,
                      fontFamily: 'var(--font-heading)',
                      color:
                        tx.type === 'income'
                          ? '#34d399'
                          : tx.type === 'expense'
                          ? '#fb7185'
                          : '#818cf8',
                      fontSize: '0.95rem'
                    }}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {formatINR(tx.amount)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px'
                      }}
                      title="Delete record"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
