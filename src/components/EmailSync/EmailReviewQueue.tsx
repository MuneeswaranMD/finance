import React, { useState, useEffect } from 'react';
import {
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  HelpCircle,
  Landmark,
  CreditCard,
  ShieldCheck,
  PlusCircle,
  Info,
  ChevronDown,
  ChevronUp,
  History,
  Send
} from 'lucide-react';
import { ParsedEmailDoc, EmailSyncSettings } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';
import {
  getParsedEmails,
  getEmailSyncSettings,
  saveEmailSyncSettings,
  triggerGmailSync,
  processReviewAction
} from '../../services/emailSyncService';
import { useAuth } from '../../context/AuthContext';

interface EmailReviewQueueProps {
  onTransactionPosted: () => void;
}

export const EmailReviewQueue: React.FC<EmailReviewQueueProps> = ({ onTransactionPosted }) => {
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState<ParsedEmailDoc[]>([]);
  const [settings, setSettings] = useState<EmailSyncSettings | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending_review');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Simulation modal state
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simSubject, setSimSubject] = useState('INR 300.00 was debited from your A/c no. XX5204.');
  const [simSnippet, setSimSnippet] = useState('INR 300.00 was debited from your A/c no. XX5204 on 24-Oct-26.');

  // Settings drawer state
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Approval popover state
  const [approvingEmail, setApprovingEmail] = useState<ParsedEmailDoc | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editAccount, setEditAccount] = useState('');

  // Expanded audit trails
  const [expandedAudits, setExpandedAudits] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [emailList, userSettings] = await Promise.all([
        getParsedEmails(currentUser.id),
        getEmailSyncSettings(currentUser.id)
      ]);
      setEmails(emailList);
      setSettings(userSettings);
    } catch (e) {
      console.error('Failed to load email queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleSyncNow = async () => {
    if (!currentUser) return;
    setSyncing(true);
    try {
      await triggerGmailSync(currentUser.id);
      await loadData();
      onTransactionPosted();
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSyncing(true);
    try {
      await triggerGmailSync(currentUser.id, simSubject, simSnippet);
      setShowSimulateModal(false);
      await loadData();
      onTransactionPosted();
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (updates: Partial<EmailSyncSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await saveEmailSyncSettings(updated);
  };

  const startApproval = (email: ParsedEmailDoc) => {
    setApprovingEmail(email);
    setEditCategory(email.parseResult.suggestedCategory);
    setEditDescription(email.parseResult.merchantOrDescription);
    setEditAmount(email.parseResult.amount.toString());
    setEditAccount(email.parseResult.paymentMethod);
  };

  const confirmApproval = async () => {
    if (!approvingEmail) return;
    const numAmount = parseFloat(editAmount) || approvingEmail.parseResult.amount;

    await processReviewAction(approvingEmail, 'approve', {
      amount: numAmount,
      category: editCategory,
      description: editDescription,
      account: editAccount,
      type: approvingEmail.parseResult.direction === 'debit' ? 'expense' : 'income'
    });

    setApprovingEmail(null);
    await loadData();
    onTransactionPosted();
  };

  const handleReject = async (email: ParsedEmailDoc) => {
    await processReviewAction(email, 'reject');
    await loadData();
  };

  const toggleAudit = (id: string) => {
    setExpandedAudits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pendingCount = emails.filter((e) => e.status === 'pending_review').length;

  const filteredEmails = emails.filter((e) => {
    if (filterStatus === 'all') return true;
    return e.status === filterStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Sync Control */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <Mail size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Bank Email Parsing & Review Queue</h2>
                {pendingCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: '1px solid rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    {pendingCount} Pending Review
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Deterministic regex parsing for HDFC, SBI, ICICI, Axis and UPI with safe fallback
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="btn btn-secondary btn-sm"
              style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}
              title="Configure Gmail sync settings"
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setShowSimulateModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}
              title="Test bank email parsing with custom text"
            >
              <PlusCircle size={15} />
              <span>Simulate Bank Email</span>
            </button>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="btn btn-primary btn-sm"
              style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={15} className={syncing ? 'spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync Bank Emails'}</span>
            </button>
          </div>
        </div>

        {/* Financial Rules Notice */}
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.825rem',
            color: 'var(--text-main)',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <ShieldCheck size={18} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#4338ca' }}>Strict Financial Segregation:</strong> Never assume every debit is a purchase! Debits identified as <strong>Loan EMIs</strong>, <strong>Credit Card Bills</strong>, or <strong>Account Transfers</strong> are protected and placed in the Review Queue for user verification so liabilities and expenses remain accurate.
          </div>
        </div>

        {/* Settings Drawer */}
        {showSettingsDrawer && settings && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Automation & Posting Preferences</div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Auto-Post High Confidence Purchases</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Only applies to standard merchant purchases (Swiggy, Blinkit, Uber, Amazon). Never auto-posts loans or uncertain debits.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPostTrusted}
                onChange={(e) => handleSaveSettings({ autoPostTrusted: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Minimum Confidence Threshold</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Transactions below this score require manual approval: {(settings.minConfidenceToAutoPost * 100).toFixed(0)}%
                </div>
              </div>
              <input
                type="range"
                min="0.70"
                max="0.95"
                step="0.05"
                value={settings.minConfidenceToAutoPost}
                onChange={(e) => handleSaveSettings({ minConfidenceToAutoPost: parseFloat(e.target.value) })}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {[
          { key: 'pending_review', label: `Pending Review (${pendingCount})` },
          { key: 'auto_posted', label: 'Auto-Posted' },
          { key: 'approved', label: 'User Approved' },
          { key: 'rejected', label: 'Rejected / Ignored' },
          { key: 'all', label: `All (${emails.length})` }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            style={{
              background: filterStatus === tab.key ? 'var(--bg-dark)' : 'rgba(0, 0, 0, 0.05)',
              border: filterStatus === tab.key ? '1px solid var(--bg-dark)' : '1px solid transparent',
              padding: '7px 16px',
              borderRadius: 'var(--radius-pill)',
              color: filterStatus === tab.key ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'var(--transition)',
              boxShadow: filterStatus === tab.key ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Email Queue List */}
      {filteredEmails.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
          <CheckCircle size={32} color="#10b981" style={{ marginBottom: '8px' }} />
          <div>No emails found for this filter. All bank alerts have been processed!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredEmails.map((email) => {
            const { parseResult } = email;
            const isUncertain = parseResult.classification === 'uncertain' || parseResult.confidenceLevel === 'low';
            const isLoan = parseResult.classification === 'loan_emi';
            const isCreditCard = parseResult.classification === 'credit_card_bill';

            return (
              <div
                key={email.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${
                    isUncertain
                      ? 'rgba(245, 158, 11, 0.4)'
                      : isLoan
                      ? 'rgba(99, 102, 241, 0.4)'
                      : 'var(--border-subtle)'
                  }`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'var(--transition)'
                }}
              >
                {/* Header: Subject & Bank Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          background: 'rgba(0, 0, 0, 0.06)',
                          color: 'var(--text-main)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700
                        }}
                      >
                        {parseResult.parserUsed}
                      </span>

                      {/* Classification Badge */}
                      <span
                        style={{
                          background:
                            isLoan
                              ? 'rgba(99,102,241,0.2)'
                              : isCreditCard
                              ? 'rgba(6,182,212,0.2)'
                              : isUncertain
                              ? 'rgba(245,158,11,0.2)'
                              : 'rgba(16,185,129,0.2)',
                          color:
                            isLoan
                              ? '#818cf8'
                              : isCreditCard
                              ? '#38bdf8'
                              : isUncertain
                              ? '#fbbf24'
                              : '#34d399',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}
                      >
                        {parseResult.classification.replace('_', ' ')}
                      </span>

                      <span
                        style={{
                          fontSize: '0.725rem',
                          color:
                            parseResult.confidenceLevel === 'high'
                              ? '#34d399'
                              : parseResult.confidenceLevel === 'medium'
                              ? '#fbbf24'
                              : '#f87171',
                          fontWeight: 700
                        }}
                      >
                        {(parseResult.confidence * 100).toFixed(0)}% Confidence ({parseResult.confidenceLevel})
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.975rem' }}>
                      {email.subject}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-heading)',
                        color: parseResult.direction === 'debit' ? '#fb7185' : '#34d399'
                      }}
                    >
                      {parseResult.direction === 'debit' ? '-' : '+'}
                      {formatINR(parseResult.amount)}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      A/c: {parseResult.accountMasked}
                    </div>
                  </div>
                </div>

                {/* Extracted Details Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '10px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.825rem'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Merchant / Counterparty:</span>
                    <div style={{ fontWeight: 600 }}>{parseResult.merchantOrDescription}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Suggested Category:</span>
                    <div style={{ fontWeight: 600, color: '#818cf8' }}>{parseResult.suggestedCategory}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Method / Channel:</span>
                    <div>{parseResult.paymentMethod}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>Reference / UTR:</span>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.775rem' }}>
                      {parseResult.referenceNumber || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Audit Trail & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    onClick={() => toggleAudit(email.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <History size={13} />
                    <span>Audit Log ({email.auditLog.length})</span>
                    {expandedAudits[email.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {email.status === 'pending_review' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleReject(email)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', color: '#f87171' }}
                      >
                        <XCircle size={14} />
                        <span>Dismiss</span>
                      </button>
                      <button
                        onClick={() => startApproval(email)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <CheckCircle size={14} />
                        <span>Confirm & Post to Ledger</span>
                      </button>
                    </div>
                  ) : (
                    <span className="status-pill status-paid" style={{ fontSize: '0.75rem' }}>
                      ✓ {email.status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Collapsible Audit Trail */}
                {expandedAudits[email.id] && (
                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.725rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {email.auditLog.map((log, idx) => (
                      <div key={idx} style={{ color: 'var(--text-secondary)' }}>
                        <strong style={{ color: '#818cf8' }}>[{log.action}]</strong>{' '}
                        {new Date(log.timestamp).toLocaleTimeString()}: {log.details}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approval & Confirmation Modal */}
      {approvingEmail && (
        <div className="modal-overlay" onClick={() => setApprovingEmail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Confirm Bank Transaction</h2>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                  A/c {approvingEmail.parseResult.accountMasked} • {approvingEmail.subject}
                </p>
              </div>
              <button className="close-btn" onClick={() => setApprovingEmail(null)}>
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmApproval();
              }}
            >
              <div className="input-group">
                <label className="input-label">Confirmed Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Expense Category</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Account Channel</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editAccount}
                    onChange={(e) => setEditAccount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Description</label>
                <input
                  type="text"
                  className="input-field"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Post to Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setApprovingEmail(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulate Bank Email Modal */}
      {showSimulateModal && (
        <div className="modal-overlay" onClick={() => setShowSimulateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Simulate Incoming Bank Email</h2>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                  Test parsing with real bank subjects and SMS alert formats
                </p>
              </div>
              <button className="close-btn" onClick={() => setShowSimulateModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSimulateSubmit}>
              <div className="input-group">
                <label className="input-label">Email Subject</label>
                <input
                  type="text"
                  className="input-field"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Body Snippet</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={simSnippet}
                  onChange={(e) => setSimSnippet(e.target.value)}
                />
              </div>

              {/* Quick sample chips */}
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick Templates:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSubject('INR 300.00 was debited from your A/c no. XX5204.');
                      setSimSnippet('INR 300.00 was debited from your A/c no. XX5204 on 24-Oct-26.');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem' }}
                  >
                    User Prompt Example (₹300)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSubject('INR 18,500.00 debited from A/c XX5204 towards HDFC Housing Loan EMI installment');
                      setSimSnippet('Monthly home loan EMI debited via ECS Ref #EMI102938');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem' }}
                  >
                    Home Loan EMI (₹18.5k)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSubject('Dear SBI UPI User, A/c 5204 debited by 350.00 on 24Oct26 transfer to Zomato Ref No 429381928391');
                      setSimSnippet('SBI UPI debit transfer to Zomato Ref No 429381928391');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem' }}
                  >
                    SBI UPI Zomato (₹350)
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Parse & Ingest Email
                </button>
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
