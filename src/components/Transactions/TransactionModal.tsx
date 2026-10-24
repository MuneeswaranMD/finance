import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Check, FolderPlus } from 'lucide-react';
import { Transaction, TransactionType, Project } from '../../types/finance';
import { addTransaction, saveProject } from '../../services/firestoreService';
import { generateIdempotencyKey } from '../../services/financialCalculations';
import { useAuth } from '../../context/AuthContext';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects?: Project[];
}

const CATEGORIES = {
  expense: [
    'Groceries',
    'Rent & Housing',
    'Utilities & Bills',
    'Dining & Food',
    'Travel & Commute',
    'Healthcare',
    'Tech & Subscriptions',
    'Loan Interest',
    'Debt Principal Repayment',
    'Shopping',
    'Other Expense'
  ],
  income: [
    'Salary',
    'Invoicing Revenue',
    'Freelance & Consulting',
    'Investments & Dividends',
    'Rental Income',
    'Loan Principal Inflow',
    'Other Income'
  ],
  transfer: ['Account Transfer', 'Self Transfer', 'ATM Withdrawal']
};

const ACCOUNTS = ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'UPI (GooglePay/PhonePe)', 'Cash in Hand', 'Credit Card'];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects = []
}) => {
  const { currentUser } = useAuth();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>(CATEGORIES.expense[0]);
  const [account, setAccount] = useState<string>(ACCOUNTS[0]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Project creation states
  const [availableProjects, setAvailableProjects] = useState<Project[]>(projects);
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectClient, setNewProjectClient] = useState<string>('');
  const [projectSaving, setProjectSaving] = useState<boolean>(false);

  useEffect(() => {
    setAvailableProjects(projects);
  }, [projects]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(CATEGORIES[newType][0]);
  };

  const handleCreateQuickProject = async () => {
    if (!newProjectName.trim() || !currentUser) return;
    setProjectSaving(true);
    try {
      const newProj: Project = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: currentUser.id,
        name: newProjectName.trim(),
        ...(newProjectClient.trim() ? { clientName: newProjectClient.trim() } : {}),
        budget: 0,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      await saveProject(newProj);
      setAvailableProjects((prev) => [newProj, ...prev]);
      setProjectId(newProj.id);

      // Automatically add project name tag
      const projectTag = newProjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const existing = tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [];
      if (!existing.includes(projectTag)) {
        setTagsInput([...existing, projectTag].join(', '));
      }

      setIsCreatingProject(false);
      setNewProjectName('');
      setNewProjectClient('');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setProjectSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive INR amount.');
      return;
    }

    if (!currentUser) {
      setError('You must be signed in.');
      return;
    }

    setLoading(true);

    try {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const idempotencyKey = generateIdempotencyKey('usr_tx', txId, numAmount, Date.now());
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const transaction: Transaction = {
        id: txId,
        userId: currentUser.id,
        type,
        amount: Math.round(numAmount * 100) / 100,
        category,
        account,
        date,
        description: description.trim() || `${type} transaction`,
        ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
        idempotencyKey,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addTransaction(transaction);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={22} color="#10b981" />
            <h2 className="modal-title">Record Transaction (INR)</h2>
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
          {/* Transaction Type Segmented Control */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '4px',
              marginBottom: '18px'
            }}
          >
            {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background:
                    type === t
                      ? t === 'income'
                        ? 'var(--accent-income)'
                        : t === 'expense'
                        ? 'var(--accent-expense)'
                        : 'var(--bg-dark)'
                      : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: type === t ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  boxShadow: type === t ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Amount in INR */}
          <div className="input-group">
            <label className="input-label">Amount in INR (₹)</label>
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
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Category</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES[type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Account / Payment Method</label>
              <select
                className="input-field"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Date</label>
              <input
                type="date"
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="input-label" style={{ margin: 0 }}>Project Tag / Allocation</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(!isCreatingProject)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#10b981',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <FolderPlus size={13} />
                  <span>{isCreatingProject ? 'Cancel' : '+ New Project'}</span>
                </button>
              </div>

              {isCreatingProject ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Project Name (e.g. Acme Website Redesign)"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    autoFocus
                    style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                  />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Client Name (Optional)"
                    value={newProjectClient}
                    onChange={(e) => setNewProjectClient(e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateQuickProject}
                    disabled={projectSaving || !newProjectName.trim()}
                    className="btn btn-primary btn-sm"
                    style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    {projectSaving ? 'Saving...' : 'Save & Tag Project'}
                  </button>
                </div>
              ) : (
                <select
                  className="input-field"
                  value={projectId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsCreatingProject(true);
                    } else {
                      setProjectId(e.target.value);
                      const proj = availableProjects.find(p => p.id === e.target.value);
                      if (proj) {
                        const slug = proj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        const current = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
                        if (!current.includes(slug)) {
                          setTagsInput([...current, slug].join(', '));
                        }
                      }
                    }
                  }}
                >
                  <option value="">No Project</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      📁 {p.name} {p.clientName ? `(${p.clientName})` : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Create New Project...</option>
                </select>
              )}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Description / Notes</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Monthly Grocery restock at DMart"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label" style={{ margin: 0 }}>Tags (comma separated)</label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click to add quick tag</span>
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. freelance, client-project, essentials, tax-deductible"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />

            {/* Quick Tag Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {['freelance', 'client-project', 'tax-deductible', 'reimbursable', 'personal', 'office-supplies'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const current = tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [];
                    if (!current.includes(tag)) {
                      setTagsInput([...current, tag].join(', '));
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              <Check size={16} />
              <span>{loading ? 'Recording...' : 'Record Transaction'}</span>
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
