import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  Send,
  Calculator,
  Calendar,
  Briefcase,
  UserCheck,
  Building2,
  CheckCircle2,
  RefreshCw,
  Gift,
  Search,
  Key,
  Flame,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import {
  Transaction,
  Invoice,
  Loan,
  LoanInstallment,
  Budget,
  SavingsGoal,
  RecurringTransaction
} from '../../types/finance';
import {
  calculateBudgetEngine,
  BudgetCoachSettings,
  DEFAULT_COACH_SETTINGS,
  RecommendationItem
} from '../../services/budgetCoachEngine';
import {
  askGeminiCoach,
  CoachChatMessage,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey
} from '../../services/geminiCoachService';
import { formatINR } from '../../services/financialCalculations';

interface SmartBudgetCoachProps {
  transactions: Transaction[];
  invoices: Invoice[];
  loans: Loan[];
  installments?: LoanInstallment[];
  budgets: Budget[];
  savingsGoals?: SavingsGoal[];
  recurringTransactions?: RecurringTransaction[];
  onNavigateTab?: (tab: string) => void;
}

export const SmartBudgetCoach: React.FC<SmartBudgetCoachProps> = ({
  transactions,
  invoices,
  loans,
  installments = [],
  budgets,
  savingsGoals = [],
  recurringTransactions = [],
  onNavigateTab
}) => {
  // Income Profile Config State
  const [coachSettings, setCoachSettings] = useState<BudgetCoachSettings>(DEFAULT_COACH_SETTINGS);

  // Windfall custom amount
  const [windfallAmount, setWindfallAmount] = useState<number>(50000);

  // Math trace inspection modal state
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendationItem | null>(null);
  const [isTraceOpen, setIsTraceOpen] = useState<boolean>(false);

  // Gemini API Key config toggle
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(getStoredGeminiApiKey());

  // AI Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<CoachChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'coach',
      text: 'Namaste! I am your MyFinance AI Coach. I analyze your confirmed cash flows, protect committed EMIs and upcoming bills, and compute your daily safe-to-spend limits. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Run Deterministic Budget Engine
  const budgetOutput = useMemo(() => {
    return calculateBudgetEngine(
      transactions,
      invoices,
      loans,
      installments,
      budgets,
      savingsGoals,
      recurringTransactions,
      coachSettings
    );
  }, [transactions, invoices, loans, installments, budgets, savingsGoals, recurringTransactions, coachSettings]);

  // Total confirmed personal inflow
  const totalConfirmedInflow = budgetOutput.confirmedPersonalIncome + budgetOutput.netBusinessPersonalDraw;

  // 50/30/20 Comparison Data
  const targetNeeds = totalConfirmedInflow * 0.5;
  const targetWants = totalConfirmedInflow * 0.3;
  const targetSavings = totalConfirmedInflow * 0.2;

  const actualNeedsPct = totalConfirmedInflow > 0 ? Math.round((budgetOutput.essentialExpenses / totalConfirmedInflow) * 100) : 0;
  const actualWantsPct = totalConfirmedInflow > 0 ? Math.round((budgetOutput.discretionaryExpenses / totalConfirmedInflow) * 100) : 0;
  const actualSavingsPct = Math.max(0, budgetOutput.savingsRate);

  const rule503020Data = [
    {
      category: 'Needs (50%)',
      ActualPct: actualNeedsPct,
      TargetPct: 50,
      actualAmount: budgetOutput.essentialExpenses,
      targetAmount: targetNeeds
    },
    {
      category: 'Wants (30%)',
      ActualPct: actualWantsPct,
      TargetPct: 30,
      actualAmount: budgetOutput.discretionaryExpenses,
      targetAmount: targetWants
    },
    {
      category: 'Savings (20%)',
      ActualPct: actualSavingsPct,
      TargetPct: coachSettings.targetSavingsRate,
      actualAmount: Math.max(0, budgetOutput.monthlySurplusDeficit),
      targetAmount: targetSavings
    }
  ];

  // Month burn rate & velocity chart data
  const burnRateData = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const data = [];

    const totalIncome = totalConfirmedInflow > 0 ? totalConfirmedInflow : 100000;
    const currentSpend = budgetOutput.totalExpenses;
    const dailyAvg = budgetOutput.dailyAverageBurnRate;

    for (let day = 1; day <= totalDays; day++) {
      const isPast = day <= currentDay;
      const linearSafeBudget = (totalIncome * 0.75 / totalDays) * day;
      const projectedSpend = isPast
        ? (currentDay > 0 ? (currentSpend / currentDay) * day : 0)
        : currentSpend + dailyAvg * (day - currentDay);

      data.push({
        day: `D${day}`,
        SafeBudget: Math.round(linearSafeBudget),
        Spend: isPast ? Math.round(projectedSpend) : undefined,
        Projected: !isPast ? Math.round(projectedSpend) : undefined
      });
    }
    return data;
  }, [budgetOutput, totalConfirmedInflow]);

  // Windfall split computation based on settings
  const windfallSplit = useMemo(() => {
    const alloc = coachSettings.windfallAllocation;
    return {
      emergencyFund: (windfallAmount * alloc.emergencyFundPct) / 100,
      debtRepayment: (windfallAmount * alloc.debtRepaymentPct) / 100,
      financialGoals: (windfallAmount * alloc.financialGoalsPct) / 100,
      discretionary: (windfallAmount * alloc.discretionaryPct) / 100
    };
  }, [windfallAmount, coachSettings]);

  // Handle AI Chat submit
  const handleSendMessage = async (queryText?: string) => {
    const query = (queryText || chatInput).trim();
    if (!query || isAiLoading) return;

    const userMsg: CoachChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!queryText) setChatInput('');
    setIsAiLoading(true);

    try {
      const response = await askGeminiCoach(budgetOutput, query, coachSettings);
      const coachMsg: CoachChatMessage = {
        id: `msg_c_${Date.now()}`,
        sender: 'coach',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: response.isFallback
      };
      setChatMessages(prev => [...prev, coachMsg]);
    } catch {
      const errMsg: CoachChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'coach',
        text: 'Sorry, I encountered an issue analyzing that. Please try again or verify your Gemini key.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const openTraceModal = (rec: RecommendationItem) => {
    setSelectedRecommendation(rec);
    setIsTraceOpen(true);
  };

  const handleSaveApiKey = () => {
    setStoredGeminiApiKey(apiKeyInput);
    setIsKeyModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '60px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(99, 102, 241, 0.15))',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Smart Budget Calculator & AI Finance Coach
              </h1>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}
              >
                Grounded INR Engine
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Deterministic cash-flow math, zero double-counting, conservative variable baselines, and Gemini AI insights.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
            title="Configure Gemini API Key"
          >
            <Key size={14} />
            <span>AI Key</span>
          </button>
        </div>
      </div>

      {/* Income Profile Selector Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Income Profile:
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
              width: '100%'
            }}
          >
            <button
              onClick={() => setCoachSettings(p => ({ ...p, incomeType: 'stable' }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: coachSettings.incomeType === 'stable' ? '#10b981' : 'var(--border-subtle)',
                background: coachSettings.incomeType === 'stable' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: coachSettings.incomeType === 'stable' ? '#34d399' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <UserCheck size={14} style={{ flexShrink: 0 }} />
              <span>Salaried (Fixed)</span>
            </button>

            <button
              onClick={() => setCoachSettings(p => ({ ...p, incomeType: 'variable' }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: coachSettings.incomeType === 'variable' ? '#6366f1' : 'var(--border-subtle)',
                background: coachSettings.incomeType === 'variable' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: coachSettings.incomeType === 'variable' ? '#818cf8' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Briefcase size={14} style={{ flexShrink: 0 }} />
              <span>Freelance / Variable</span>
            </button>

            <button
              onClick={() => setCoachSettings(p => ({ ...p, incomeType: 'business' }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: coachSettings.incomeType === 'business' ? '#f59e0b' : 'var(--border-subtle)',
                background: coachSettings.incomeType === 'business' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: coachSettings.incomeType === 'business' ? '#fbbf24' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Building2 size={14} style={{ flexShrink: 0 }} />
              <span>Business Owner</span>
            </button>
          </div>
        </div>

        {/* Sliders for variable / business reserve adjustments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {coachSettings.incomeType === 'business' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Business Reserve: <strong>{coachSettings.businessExpenseReservePct}%</strong>
              </span>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={coachSettings.businessExpenseReservePct}
                onChange={e => setCoachSettings(p => ({ ...p, businessExpenseReservePct: Number(e.target.value) }))}
                style={{ width: '80px', accentColor: '#f59e0b' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Emergency Target: <strong>{coachSettings.emergencyFundMonths} Mos</strong>
            </span>
            <select
              value={coachSettings.emergencyFundMonths}
              onChange={e => setCoachSettings(p => ({ ...p, emergencyFundMonths: Number(e.target.value) }))}
              style={{
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.78rem'
              }}
            >
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="9">9 Months</option>
              <option value="12">12 Months</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Target Savings: <strong>{coachSettings.targetSavingsRate}%</strong>
            </span>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={coachSettings.targetSavingsRate}
              onChange={e => setCoachSettings(p => ({ ...p, targetSavingsRate: Number(e.target.value) }))}
              style={{ width: '80px', accentColor: '#10b981' }}
            />
          </div>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid-metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {/* Metric 1: Confirmed Personal Inflow */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Confirmed Personal Inflow</span>
            <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="metric-value positive">
            {formatINR(totalConfirmedInflow)}
          </div>
          <div className="metric-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Pending: {formatINR(budgetOutput.pendingInvoiceReceivables)}
            </span>
            <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>
              Audit Verified
            </span>
          </div>
        </div>

        {/* Metric 2: Safe Daily Allowance */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Safe Daily Spending</span>
            <Calendar size={14} style={{ color: '#6366f1' }} />
          </div>
          <div className={`metric-value ${budgetOutput.safeDailySpendingLimit > 0 ? 'text-main' : 'negative'}`}>
            {formatINR(budgetOutput.safeDailySpendingLimit)}
          </div>
          <div className="metric-footer">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {budgetOutput.daysRemainingInMonth} days left in month
            </span>
          </div>
        </div>

        {/* Metric 3: Safe Weekly Allowance */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Safe Weekly Allowance</span>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
          </div>
          <div className="metric-value">
            {formatINR(budgetOutput.safeWeeklySpendingLimit)}
          </div>
          <div className="metric-footer">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Protects {formatINR(budgetOutput.totalReservedObligations)} EMIs & bills
            </span>
          </div>
        </div>

        {/* Metric 4: Projected Month-End Net */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Projected Month-End Net</span>
            <TrendingUp size={14} style={{ color: !budgetOutput.isProjectedDeficit ? '#10b981' : '#ef4444' }} />
          </div>
          <div className={`metric-value ${!budgetOutput.isProjectedDeficit ? 'positive' : 'negative'}`}>
            {formatINR(budgetOutput.projectedMonthEndSurplus)}
          </div>
          <div className="metric-footer">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Burn: {formatINR(budgetOutput.dailyAverageBurnRate)}/day
            </span>
          </div>
        </div>

        {/* Metric 5: Emergency Fund */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Emergency Fund Runway</span>
            <ShieldCheck size={14} style={{ color: '#f59e0b' }} />
          </div>
          <div className="metric-value" style={{ color: '#fbbf24' }}>
            {budgetOutput.emergencyFundMonthsCovered.toFixed(1)} <span style={{ fontSize: '0.85rem' }}>/ {coachSettings.emergencyFundMonths} Mo</span>
          </div>
          <div className="metric-footer">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Holdings: {formatINR(budgetOutput.currentEmergencySavings)}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings & Threshold Alerts (75%, 90%, 100%) */}
      {budgetOutput.categoryAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
              Active Budget Threshold Warnings & Recommended Cuts
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {budgetOutput.categoryAlerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  background:
                    alert.level === 'breach_100'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : alert.level === 'critical_90'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(59, 130, 246, 0.1)',
                  border: `1px solid ${
                    alert.level === 'breach_100'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : alert.level === 'critical_90'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(59, 130, 246, 0.3)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: alert.level === 'breach_100' ? '#f87171' : alert.level === 'critical_90' ? '#fbbf24' : '#60a5fa'
                    }}
                  >
                    {alert.level === 'breach_100' ? '100% Breached' : alert.level === 'critical_90' ? '90% Approached' : '75% Paced'}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {formatINR(alert.spent)} / {formatINR(alert.limit)} ({alert.percentageUsed}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {alert.message}
                </div>
                {alert.suggestedReduction > 0 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Action: Trim spending in <strong>{alert.category}</strong> by <strong>{formatINR(alert.suggestedReduction)}</strong> to rebalance.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Visualizations Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Chart 1: 50/30/20 Rule Adherence */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>50 / 30 / 20 Budget Rule</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target: Needs (50%), Wants (30%), Savings ({coachSettings.targetSavingsRate}%)
              </p>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: budgetOutput.savingsRate >= coachSettings.targetSavingsRate ? '#10b981' : '#f59e0b',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              Savings Rate: {budgetOutput.savingsRate}%
            </span>
          </div>

          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rule503020Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="category" stroke="var(--text-muted)" fontSize={11} />
                <YAxis unit="%" stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% (${formatINR(name === 'ActualPct' ? item.payload.actualAmount : item.payload.targetAmount)})`,
                    name === 'ActualPct' ? 'Actual %' : 'Target %'
                  ]}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="ActualPct" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual %" />
                <Bar dataKey="TargetPct" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.6} name="Target %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cash-Flow Velocity & Trajectory Forecast */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Month-End Spend Velocity</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Linear safe budget vs projected burn rate trajectory
              </p>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: !budgetOutput.isProjectedDeficit ? '#10b981' : '#f87171',
                padding: '4px 8px',
                borderRadius: '6px',
                background: !budgetOutput.isProjectedDeficit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
              }}
            >
              {!budgetOutput.isProjectedDeficit ? 'Surplus Projected' : 'Deficit Risk'}
            </span>
          </div>

          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnRateData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} interval={4} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={v => `₹${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(val: any) => [formatINR(val), '']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="SafeBudget" stroke="#6366f1" fill="rgba(99, 102, 241, 0.1)" strokeWidth={2} name="Safe Budget" />
                <Area type="monotone" dataKey="Spend" stroke="#10b981" fill="rgba(16, 185, 129, 0.2)" strokeWidth={2.5} name="Actual Spend" />
                <Area type="monotone" dataKey="Projected" stroke="#f59e0b" strokeDasharray="4 4" fill="transparent" strokeWidth={2} name="Projected" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transparent Actionable Recommendations */}
      {budgetOutput.recommendations.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Flame size={18} style={{ color: '#10b981' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Personalized Coach Recommendations</h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              (Click any card to inspect the exact mathematical formula & verified inputs)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {budgetOutput.recommendations.map(rec => (
              <div
                key={rec.id}
                onClick={() => openTraceModal(rec)}
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {rec.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: rec.priority === 'high' ? '#f87171' : '#fbbf24',
                      background: rec.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {rec.priority}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {rec.summary}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.76rem', color: '#34d399', fontWeight: 700 }}>
                    Step: {rec.actionableStep}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Windfall Allocation & Audit Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Windfall / Bonus Allocator */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <Gift size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Windfall & Bonus Allocator</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Smart distribution algorithm to prevent lifestyle inflation
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Expected Bonus or Inflow (₹):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                value={windfallAmount}
                onChange={e => setWindfallAmount(Math.max(0, Number(e.target.value)))}
                className="form-input"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
              />
              <button
                onClick={() => setWindfallAmount(50000)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                ₹50k
              </button>
              <button
                onClick={() => setWindfallAmount(100000)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                ₹1 Lakh
              </button>
            </div>
          </div>

          {/* Allocation Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                🛡️ Emergency Fund ({coachSettings.windfallAllocation.emergencyFundPct}%):
              </span>
              <strong style={{ fontSize: '0.84rem', color: '#34d399' }}>
                {formatINR(windfallSplit.emergencyFund)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                ⚡ High-Interest Debt ({coachSettings.windfallAllocation.debtRepaymentPct}%):
              </span>
              <strong style={{ fontSize: '0.84rem', color: '#f87171' }}>
                {formatINR(windfallSplit.debtRepayment)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                🎯 Savings Goals ({coachSettings.windfallAllocation.financialGoalsPct}%):
              </span>
              <strong style={{ fontSize: '0.84rem', color: '#818cf8' }}>
                {formatINR(windfallSplit.financialGoals)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                ✨ Guilt-Free Discretionary ({coachSettings.windfallAllocation.discretionaryPct}%):
              </span>
              <strong style={{ fontSize: '0.84rem', color: '#fbbf24' }}>
                {formatINR(windfallSplit.discretionary)}
              </strong>
            </div>
          </div>
        </div>

        {/* Subscription & Recurring Expense Audit */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <Search size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Recurring Subscriptions Audit</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Identified periodic charges and rising categories
              </p>
            </div>
          </div>

          {budgetOutput.subscriptionAudit.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No recurring subscription charges detected in this billing cycle.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {budgetOutput.subscriptionAudit.map((sub, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--bg-main)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>
                      {sub.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Annualized: {formatINR(sub.annualizedCost)}/yr
                    </span>
                  </div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    {formatINR(sub.monthlyAmount)}/mo
                  </strong>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Monthly subscription load:
            </span>
            <strong style={{ fontSize: '0.88rem', color: '#f87171' }}>
              {formatINR(budgetOutput.subscriptionAudit.reduce((sum, s) => sum + s.monthlyAmount, 0))}
            </strong>
          </div>
        </div>
      </div>

      {/* AI Coach Conversational Section */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Ask Your AI Finance Coach</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Grounded in your live bank ledger with verified mathematical limits
              </p>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleSendMessage('Can I afford a ₹15,000 purchase today?')}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '999px' }}
            >
              "Can I afford ₹15k?"
            </button>
            <button
              onClick={() => handleSendMessage('What is my safe daily limit and why?')}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '999px' }}
            >
              "Explain safe daily limit"
            </button>
            <button
              onClick={() => handleSendMessage('How is my emergency fund progressing?')}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '999px' }}
            >
              "Audit Emergency Fund"
            </button>
          </div>
        </div>

        {/* Chat History Container */}
        <div
          style={{
            minHeight: '200px',
            maxHeight: '340px',
            overflowY: 'auto',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '12px'
          }}
        >
          {chatMessages.map(msg => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background:
                    msg.sender === 'user'
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'var(--bg-card)',
                  color: msg.sender === 'user' ? '#ffffff' : 'var(--text-main)',
                  border: msg.sender === 'coach' ? '1px solid var(--border-subtle)' : 'none',
                  fontSize: '0.86rem',
                  lineHeight: '1.45',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {msg.text}
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                {msg.timestamp} {msg.isFallback && '• Local Engine'}
              </span>
            </div>
          ))}

          {isAiLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '8px' }}>
              <RefreshCw size={14} className="spin" style={{ animation: 'spin 1.2s linear infinite' }} />
              <span>Analyzing financial models and grounding response...</span>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask anything: e.g. 'Can I buy a phone for ₹20,000 without breaking my emergency fund?'"
            className="form-input"
            style={{ flex: 1, padding: '10px 14px', fontSize: '0.88rem' }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isAiLoading || !chatInput.trim()}
            className="btn btn-primary"
            style={{ padding: '0 20px', borderRadius: 'var(--radius-md)' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Math Inspection Modal */}
      {isTraceOpen && selectedRecommendation && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Deterministic Math Trace</h3>
              </div>
              <button
                onClick={() => setIsTraceOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Close
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              All financial advice in MyFinance is anchored in transparent, deterministic formulas. Zero black-box estimates.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>
                  Recommendation
                </span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {selectedRecommendation.title}
                </strong>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>
                  Mathematical Formula
                </span>
                <code style={{ fontSize: '0.85rem', color: '#34d399', display: 'block', marginTop: '4px' }}>
                  {selectedRecommendation.calculationDetails.formula}
                </code>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Live Ledger Inputs
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(selectedRecommendation.calculationDetails.inputs).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                      <strong style={{ color: 'var(--text-main)' }}>
                        {typeof val === 'number' ? formatINR(val) : String(val)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#34d399', fontWeight: 700, display: 'block' }}>
                  Calculated Result & Explanation
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#10b981', lineHeight: '1.4' }}>
                  {selectedRecommendation.calculationDetails.resultExplanation}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gemini API Key Configuration Modal */}
      {isKeyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} style={{ color: '#6366f1' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Gemini AI API Key</h3>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Close
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              The AI Finance Coach uses Google Gemini Flash models to provide conversational explanations of your deterministic budget limits.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                API Key:
              </label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Enter your Gemini API key (or set in .env)"
                className="form-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsKeyModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveApiKey} className="btn btn-primary">
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
