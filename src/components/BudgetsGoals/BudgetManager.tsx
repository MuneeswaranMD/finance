import React, { useState } from 'react';
import {
  Target,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  Sparkles,
  PiggyBank,
  Repeat,
  Trash2,
  Pencil,
  Calendar
} from 'lucide-react';
import { Budget, SavingsGoal, RecurringTransaction } from '../../types/finance';
import { formatINR } from '../../services/financialCalculations';
import {
  saveBudget,
  saveSavingsGoal,
  saveRecurringTransaction,
  deleteRecurringTransaction
} from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

interface BudgetManagerProps {
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringTransactions: RecurringTransaction[];
  onRefresh: () => void;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({
  budgets,
  savingsGoals,
  recurringTransactions,
  onRefresh
}) => {
  const { currentUser } = useAuth();
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);

  // Form states for new budget
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('15000');
  const [threshold, setThreshold] = useState('80');

  // Form states for new goal
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('100000');
  const [goalCurrent, setGoalCurrent] = useState('20000');
  const [goalDate, setGoalDate] = useState('2027-01-01');

  // Form states for recurring
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('1500');
  const [recType, setRecType] = useState<'expense' | 'income'>('expense');
  const [recCategory, setRecCategory] = useState('Utilities');
  const [recFreq, setRecFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recDueDate, setRecDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingRecId, setEditingRecId] = useState<string | null>(null);

  const resetRecurringForm = () => {
    setEditingRecId(null);
    setRecTitle('');
    setRecAmount('1500');
    setRecType('expense');
    setRecCategory('Utilities');
    setRecFreq('monthly');
    setRecDueDate(new Date().toISOString().split('T')[0]);
    setShowAddRecurring(false);
  };

  const handleStartEditRecurring = (rec: RecurringTransaction) => {
    setEditingRecId(rec.id);
    setRecTitle(rec.title);
    setRecAmount(String(rec.amount));
    setRecType(rec.type === 'income' ? 'income' : 'expense');
    setRecCategory(rec.category || 'Utilities');
    setRecFreq(rec.frequency);
    setRecDueDate(rec.nextDueDate || new Date().toISOString().split('T')[0]);
    setShowAddRecurring(true);
  };

  const handleDeleteRecurring = async (rec: RecurringTransaction) => {
    if (!window.confirm(`Are you sure you want to delete "${rec.title}" subscription?`)) return;
    try {
      await deleteRecurringTransaction(rec.id);
      if (editingRecId === rec.id) {
        resetRecurringForm();
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to delete recurring transaction:', err);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const numLimit = parseFloat(limit) || 0;
    const newBudget: Budget = {
      id: `budget_${Date.now()}`,
      userId: currentUser.id,
      category,
      monthlyLimit: numLimit,
      alertThreshold: parseFloat(threshold) || 80,
      period: new Date().toISOString().substring(0, 7),
      spentAmount: 0,
      createdAt: new Date().toISOString()
    };
    await saveBudget(newBudget);
    setShowAddBudget(false);
    onRefresh();
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const target = parseFloat(goalTarget) || 0;
    const curr = parseFloat(goalCurrent) || 0;
    const newGoal: SavingsGoal = {
      id: `goal_${Date.now()}`,
      userId: currentUser.id,
      title: goalTitle.trim(),
      targetAmount: target,
      currentAmount: curr,
      targetDate: goalDate,
      category: 'General',
      status: curr >= target ? 'achieved' : 'in_progress',
      createdAt: new Date().toISOString()
    };
    await saveSavingsGoal(newGoal);
    setShowAddGoal(false);
    onRefresh();
  };

  const handleDepositGoal = async (goal: SavingsGoal) => {
    const depositStr = prompt(`Enter deposit amount in INR for ${goal.title}:`, '10000');
    if (!depositStr) return;
    const deposit = parseFloat(depositStr);
    if (isNaN(deposit) || deposit <= 0) return;

    const newCurr = Math.round((goal.currentAmount + deposit) * 100) / 100;
    const updated: SavingsGoal = {
      ...goal,
      currentAmount: newCurr,
      status: newCurr >= goal.targetAmount ? 'achieved' : 'in_progress'
    };
    await saveSavingsGoal(updated);
    onRefresh();
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const amt = parseFloat(recAmount) || 0;

    const existingRec = editingRecId ? recurringTransactions.find((r) => r.id === editingRecId) : null;

    const recData: RecurringTransaction = {
      id: editingRecId || `rec_${Date.now()}`,
      userId: currentUser.id,
      title: recTitle.trim(),
      amount: amt,
      type: recType,
      category: recCategory,
      frequency: recFreq,
      nextDueDate: recDueDate || new Date().toISOString().split('T')[0],
      active: existingRec ? existingRec.active : true,
      createdAt: existingRec?.createdAt || new Date().toISOString()
    };
    await saveRecurringTransaction(recData);
    resetRecurringForm();
    onRefresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Category Budgets & Spending Control */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Monthly Category Budgets</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Spending limits with automatic warning alerts (&gt;80%) and over-budget triggers
            </p>
          </div>
          <button onClick={() => setShowAddBudget(!showAddBudget)} className="btn btn-secondary btn-sm">
            <Plus size={14} />
            <span>Set Budget</span>
          </button>
        </div>

        {showAddBudget && (
          <form
            onSubmit={handleCreateBudget}
            style={{
              background: 'var(--bg-surface-elevated)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Category</label>
                <input
                  type="text"
                  className="input-field"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Monthly Limit (INR)</label>
                <input
                  type="number"
                  className="input-field"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Warning Alert Threshold (%)</label>
                <input
                  type="number"
                  className="input-field"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                Save Budget
              </button>
              <button type="button" onClick={() => setShowAddBudget(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {budgets.map((b) => {
            const pct = Math.round((b.spentAmount / b.monthlyLimit) * 100);
            const isOverrun = pct > 100;
            const isWarning = pct >= b.alertThreshold && !isOverrun;

            return (
              <div
                key={b.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isOverrun ? 'rgba(244, 63, 94, 0.4)' : isWarning ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700 }}>{b.category}</span>
                  <span
                    className="status-pill"
                    style={{
                      background: isOverrun
                        ? 'var(--accent-expense-light)'
                        : isWarning
                        ? 'var(--accent-warning-light)'
                        : 'var(--accent-income-light)',
                      color: isOverrun ? '#fb7185' : isWarning ? '#fbbf24' : '#34d399'
                    }}
                  >
                    {isOverrun ? 'Budget Exceeded!' : isWarning ? 'Near Limit' : 'On Track'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '6px' }}>
                  <span>Spent: <strong style={{ color: isOverrun ? '#fb7185' : 'inherit' }}>{formatINR(b.spentAmount)}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Limit: {formatINR(b.monthlyLimit)}</span>
                </div>

                <div
                  style={{
                    height: '8px',
                    background: 'rgba(0, 0, 0, 0.08)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, pct)}%`,
                      background: isOverrun ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981',
                      borderRadius: '999px'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Savings Goals */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Target Savings Goals</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Long-term financial milestones (Emergency reserve, Down payment, Wealth building)
            </p>
          </div>
          <button onClick={() => setShowAddGoal(!showAddGoal)} className="btn btn-secondary btn-sm">
            <Plus size={14} />
            <span>New Goal</span>
          </button>
        </div>

        {showAddGoal && (
          <form
            onSubmit={handleCreateGoal}
            style={{
              background: 'var(--bg-surface-elevated)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Goal Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Dream House Down Payment"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Target Amount (INR)</label>
                <input
                  type="number"
                  className="input-field"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Initial Balance (INR)</label>
                <input
                  type="number"
                  className="input-field"
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Target Completion Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                Save Goal
              </button>
              <button type="button" onClick={() => setShowAddGoal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {savingsGoals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            return (
              <div
                key={goal.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{goal.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: {goal.targetDate}</div>
                  </div>
                  <span
                    className="status-pill"
                    style={{
                      background: goal.status === 'achieved' ? 'var(--accent-income-light)' : 'rgba(99,102,241,0.15)',
                      color: goal.status === 'achieved' ? '#34d399' : '#818cf8'
                    }}
                  >
                    {goal.status === 'achieved' ? 'Achieved!' : `${pct}% Done`}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                    {formatINR(goal.currentAmount)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    of {formatINR(goal.targetAmount)}
                  </span>
                </div>

                <div
                  style={{
                    height: '8px',
                    background: 'rgba(0, 0, 0, 0.08)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                      borderRadius: '999px'
                    }}
                  />
                </div>

                <button
                  onClick={() => handleDepositGoal(goal)}
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'flex-end', fontSize: '0.75rem' }}
                >
                  <PiggyBank size={13} />
                  <span>Deposit Funds</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Recurring Transactions & Subscriptions */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Recurring Transactions & Subscriptions</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Scheduled monthly bills, SIPs, utilities & subscriptions
            </p>
          </div>
          <button
            onClick={() => {
              if (showAddRecurring && editingRecId) {
                resetRecurringForm();
              } else {
                setShowAddRecurring(!showAddRecurring);
              }
            }}
            className="btn btn-secondary btn-sm"
          >
            <Plus size={14} />
            <span>{showAddRecurring ? 'Close' : 'Add Recurring'}</span>
          </button>
        </div>

        {showAddRecurring && (
          <form
            onSubmit={handleSaveRecurring}
            style={{
              background: 'var(--bg-surface-elevated)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981' }}>
                {editingRecId ? '✏️ Edit Recurring Subscription' : '➕ Add Recurring Schedule'}
              </span>
              {editingRecId && (
                <button
                  type="button"
                  onClick={resetRecurringForm}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Title / Service Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Netflix, Broadband, SIP"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="input-field"
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Next Due / Billing Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={recDueDate}
                  onChange={(e) => setRecDueDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Frequency</label>
                <select
                  className="input-field"
                  value={recFreq}
                  onChange={(e) => setRecFreq(e.target.value as any)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Category</label>
                <select
                  className="input-field"
                  value={recCategory}
                  onChange={(e) => setRecCategory(e.target.value)}
                >
                  <option value="Utilities">Utilities & Bills</option>
                  <option value="Tech & Subscriptions">Tech & Subscriptions</option>
                  <option value="Rent & Housing">Rent & Housing</option>
                  <option value="Dining & Food">Dining & Food</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Investments & Dividends">Investments & SIP</option>
                  <option value="Salary">Salary (Income)</option>
                  <option value="Other Expense">Other Expense</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Type</label>
                <select
                  className="input-field"
                  value={recType}
                  onChange={(e) => setRecType(e.target.value as any)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                {editingRecId ? 'Update Schedule' : 'Save Schedule'}
              </button>
              <button type="button" onClick={resetRecurringForm} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Frequency</th>
                <th>Category</th>
                <th>Next Due Date</th>
                <th style={{ textAlign: 'right' }}>Amount (INR)</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                    No recurring transactions scheduled. Add a monthly subscription, utility, or SIP above!
                  </td>
                </tr>
              ) : (
                recurringTransactions.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 600 }}>{rec.title}</td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {rec.frequency}
                    </td>
                    <td>{rec.category}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        <span>{rec.nextDueDate || 'Not set'}</span>
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        color: rec.type === 'income' ? '#34d399' : '#fb7185'
                      }}
                    >
                      {formatINR(rec.amount)}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleStartEditRecurring(rec)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.725rem' }}
                          title="Edit this subscription"
                        >
                          <Pencil size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRecurring(rec)}
                          className="btn btn-secondary btn-sm hover-danger"
                          style={{ padding: '3px 6px', color: '#f87171' }}
                          title="Delete this subscription"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
