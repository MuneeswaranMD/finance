import {
  Transaction,
  Invoice,
  Loan,
  LoanInstallment,
  Budget,
  SavingsGoal,
  RecurringTransaction
} from '../types/finance';
import { formatINR } from './financialCalculations';

export type IncomeSourceType =
  | 'salary'
  | 'freelance'
  | 'project_payment'
  | 'business_income'
  | 'bonus'
  | 'investment_return'
  | 'other';

export type ExpenseNature = 'essential' | 'discretionary' | 'debt_repayment' | 'transfer' | 'business_expense';

export interface BudgetCoachSettings {
  incomeType: 'stable' | 'variable' | 'business';
  targetSavingsRate: number; // e.g. 25 (%)
  emergencyFundMonths: number; // e.g. 6
  businessExpenseReservePct: number; // e.g. 20 (%)
  taxReservePct: number; // e.g. 15 (%)
  windfallAllocation: {
    emergencyFundPct: number;
    debtRepaymentPct: number;
    financialGoalsPct: number;
    discretionaryPct: number;
  };
}

export const DEFAULT_COACH_SETTINGS: BudgetCoachSettings = {
  incomeType: 'stable',
  targetSavingsRate: 25,
  emergencyFundMonths: 6,
  businessExpenseReservePct: 20,
  taxReservePct: 15,
  windfallAllocation: {
    emergencyFundPct: 35,
    debtRepaymentPct: 25,
    financialGoalsPct: 25,
    discretionaryPct: 15
  }
};

export interface CategoryBudgetAlert {
  category: string;
  spent: number;
  limit: number;
  percentageUsed: number;
  level: 'normal' | 'warning_75' | 'critical_90' | 'breach_100';
  message: string;
  suggestedReduction: number;
}

export interface RecommendationItem {
  id: string;
  type: 'emergency_fund' | 'debt_priority' | 'spending_cut' | 'subscription_audit' | 'windfall_strategy' | 'budget_allocation';
  title: string;
  summary: string;
  actionableStep: string;
  calculationDetails: {
    formula: string;
    inputs: Record<string, string | number>;
    resultExplanation: string;
  };
  impactAmount?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BudgetEngineOutput {
  // 1. Confirmed vs Pending Income
  confirmedPersonalIncome: number;
  grossBusinessRevenue: number;
  businessDeductionsAndReserves: number;
  netBusinessPersonalDraw: number;
  pendingInvoiceReceivables: number;
  incomeByType: Record<IncomeSourceType, number>;

  // 2. Expenses breakdown
  essentialExpenses: number;
  discretionaryExpenses: number;
  debtRepaymentsRecorded: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;

  // 3. Upcoming Obligations & Reserved Cash
  upcomingEMIs: number;
  upcomingBills: number;
  totalReservedObligations: number;

  // 4. Balances & Daily Allowances
  liquidCashBalance: number;
  safeAvailableBalance: number; // Cash balance minus upcoming required reserves
  monthlySurplusDeficit: number;
  savingsRate: number; // %
  daysRemainingInMonth: number;
  daysPassedInMonth: number;
  safeDailySpendingLimit: number;
  safeWeeklySpendingLimit: number;

  // 5. Forecast & Velocity
  dailyAverageBurnRate: number;
  projectedMonthEndExpenses: number;
  projectedMonthEndSurplus: number;
  isProjectedDeficit: boolean;

  // 6. Emergency Fund & Goals
  monthlyEssentialCommitments: number; // Essential expenses + EMI
  targetEmergencyFund: number;
  currentEmergencySavings: number;
  emergencyFundProgressPct: number;
  emergencyFundMonthsCovered: number;
  goalsWithCompletionForecast: Array<{
    title: string;
    targetAmount: number;
    currentAmount: number;
    remaining: number;
    projectedCompletionMonths: number;
    estimatedDate: string;
  }>;

  // 7. Dynamic Alerts & Recommendations
  categoryAlerts: CategoryBudgetAlert[];
  recommendations: RecommendationItem[];
  subscriptionAudit: Array<{
    name: string;
    monthlyAmount: number;
    annualizedCost: number;
  }>;
  risingCategories: Array<{
    category: string;
    currentMonthAmount: number;
    previousMonthAmount: number;
    growthPct: number;
  }>;
}

/**
 * Categorize Indian expenses into Essential (Needs) vs Discretionary (Wants)
 */
export function classifyExpenseNature(category: string, note?: string): ExpenseNature {
  const cat = (category || '').toLowerCase();
  const desc = (note || '').toLowerCase();

  if (cat.includes('transfer') || desc.includes('self transfer') || desc.includes('to own')) {
    return 'transfer';
  }
  if (cat.includes('loan') || cat.includes('emi') || cat.includes('debt') || desc.includes('emi')) {
    return 'debt_repayment';
  }
  if (cat.includes('business') || desc.includes('vendor payment') || desc.includes('office')) {
    return 'business_expense';
  }

  // Standard Indian Essential Needs
  const essentialCategories = [
    'groceries',
    'rent',
    'rent & housing',
    'utilities',
    'utilities & bills',
    'electricity',
    'water',
    'wifi & broadband',
    'healthcare',
    'medicine',
    'travel & commute',
    'petrol',
    'fuel',
    'metro',
    'education',
    'insurance',
    'school fees'
  ];

  if (essentialCategories.some((e) => cat.includes(e))) {
    return 'essential';
  }

  // Discretionary Wants
  return 'discretionary';
}

/**
 * Classify Indian Income Source
 */
export function classifyIncomeSource(category: string, description: string): IncomeSourceType {
  const text = `${category} ${description}`.toLowerCase();

  if (text.includes('salary') || text.includes('payroll') || text.includes('ctc')) {
    return 'salary';
  }
  if (text.includes('freelance') || text.includes('upwork') || text.includes('fiverr') || text.includes('consulting')) {
    return 'freelance';
  }
  if (text.includes('project') || text.includes('milestone') || text.includes('invoice payment')) {
    return 'project_payment';
  }
  if (text.includes('business') || text.includes('store') || text.includes('client revenue')) {
    return 'business_income';
  }
  if (text.includes('bonus') || text.includes('incentive') || text.includes('diwali bonus') || text.includes('appraisal')) {
    return 'bonus';
  }
  if (text.includes('dividend') || text.includes('mutual fund') || text.includes('interest') || text.includes('stock')) {
    return 'investment_return';
  }
  return 'other';
}

/**
 * Pure Deterministic Budget Engine & Recommendation Calculator
 */
export function calculateBudgetEngine(
  transactions: Transaction[],
  invoices: Invoice[],
  loans: Loan[],
  installments: LoanInstallment[],
  budgets: Budget[],
  savingsGoals: SavingsGoal[],
  recurring: RecurringTransaction[],
  settings: BudgetCoachSettings = DEFAULT_COACH_SETTINGS,
  referenceDate: Date = new Date()
): BudgetEngineOutput {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-indexed
  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Days in month calculations
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = referenceDate.getDate();
  const daysPassed = Math.max(1, currentDay);
  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

  // 1. Filter Transactions for current & previous month
  const currentMonthTx = transactions.filter((t) => (t.date || '').startsWith(currentMonthStr));
  const prevMonthTx = transactions.filter((t) => (t.date || '').startsWith(prevMonthStr));

  // Exclude transfers and loans given/taken from being counted as personal income or expense
  const validCurrentTx = currentMonthTx.filter((t) => {
    const nature = classifyExpenseNature(t.category, t.description);
    return nature !== 'transfer';
  });

  // Income Segregation
  let confirmedPersonalIncome = 0;
  let grossBusinessRevenue = 0;
  const incomeByType: Record<IncomeSourceType, number> = {
    salary: 0,
    freelance: 0,
    project_payment: 0,
    business_income: 0,
    bonus: 0,
    investment_return: 0,
    other: 0
  };

  for (const tx of validCurrentTx) {
    if (tx.type === 'income') {
      const src = classifyIncomeSource(tx.category, tx.description);
      incomeByType[src] += tx.amount;

      if (src === 'business_income') {
        grossBusinessRevenue += tx.amount;
      } else {
        confirmedPersonalIncome += tx.amount;
      }
    }
  }

  // Business income reserve calculation:
  // After business operational reserve and tax buffer, the remaining is personal draw
  const businessDeductionRate = ((settings.businessExpenseReservePct + settings.taxReservePct) / 100);
  const businessDeductionsAndReserves = Math.round(grossBusinessRevenue * businessDeductionRate * 100) / 100;
  const netBusinessPersonalDraw = Math.max(0, Math.round((grossBusinessRevenue - businessDeductionsAndReserves) * 100) / 100);

  // Total confirmed personal earned income available
  const totalEarnedPersonalIncome = Math.round((confirmedPersonalIncome + netBusinessPersonalDraw) * 100) / 100;

  // Pending uncollected receivables (strictly not counted as confirmed cash income)
  const pendingInvoiceReceivables = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.remainingBalance, 0);

  // 2. Expenses Classification
  let essentialExpenses = 0;
  let discretionaryExpenses = 0;
  let debtRepaymentsRecorded = 0;
  const expensesByCategory: Record<string, number> = {};

  for (const tx of validCurrentTx) {
    if (tx.type === 'expense') {
      expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.amount;
      const nature = classifyExpenseNature(tx.category, tx.description);

      if (nature === 'debt_repayment') {
        debtRepaymentsRecorded += tx.amount;
      } else if (nature === 'essential') {
        essentialExpenses += tx.amount;
      } else {
        discretionaryExpenses += tx.amount;
      }
    }
  }

  const totalExpenses = Math.round((essentialExpenses + discretionaryExpenses + debtRepaymentsRecorded) * 100) / 100;

  // 3. Upcoming Obligations (EMIs & Recurring Bills for current month)
  const activeTakenLoans = loans.filter((l) => l.type === 'taken' && l.status === 'active');
  const upcomingEMIs = activeTakenLoans.reduce((sum, l) => sum + l.monthlyEMI, 0);

  const upcomingBills = recurring
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  // Required reserves: we must never advise spending money earmarked for debt and upcoming bills
  const totalReservedObligations = Math.round((upcomingEMIs + upcomingBills) * 100) / 100;

  // 4. Balances & Daily Allowances
  const liquidCashBalance = transactions.reduce((sum, t) => {
    if (t.type === 'income') return sum + t.amount;
    if (t.type === 'expense') return sum - t.amount;
    return sum;
  }, 0);

  const safeAvailableBalance = Math.max(0, Math.round((liquidCashBalance - totalReservedObligations) * 100) / 100);
  const monthlySurplusDeficit = Math.round((totalEarnedPersonalIncome - totalExpenses) * 100) / 100;
  const savingsRate = totalEarnedPersonalIncome > 0
    ? Math.max(0, Math.round(((totalEarnedPersonalIncome - totalExpenses) / totalEarnedPersonalIncome) * 1000) / 10)
    : 0;

  // Discretionary budget target: based on target savings and essential obligations
  const targetSavingsAmount = (totalEarnedPersonalIncome * settings.targetSavingsRate) / 100;
  const allowedTotalExpense = Math.max(0, totalEarnedPersonalIncome - targetSavingsAmount);
  const remainingDiscretionaryBudget = Math.max(0, allowedTotalExpense - essentialExpenses - debtRepaymentsRecorded - discretionaryExpenses);

  const safeDailySpendingLimit = Math.max(
    0,
    Math.round((remainingDiscretionaryBudget / daysRemaining) * 100) / 100
  );
  const safeWeeklySpendingLimit = Math.round(safeDailySpendingLimit * 7 * 100) / 100;

  // 5. Month-End Spending Velocity & Forecast
  const dailyAverageBurnRate = daysPassed > 0 ? Math.round((totalExpenses / daysPassed) * 100) / 100 : 0;
  const projectedMonthEndExpenses = Math.round(dailyAverageBurnRate * totalDaysInMonth * 100) / 100;
  const projectedMonthEndSurplus = Math.round((totalEarnedPersonalIncome - projectedMonthEndExpenses) * 100) / 100;
  const isProjectedDeficit = projectedMonthEndSurplus < 0;

  // 6. Emergency Fund & Goals
  // Monthly essential commitments = essential living expenses + EMI commitments
  const monthlyEssentialCommitments = Math.max(
    10000,
    essentialExpenses + upcomingEMIs + upcomingBills
  );
  const targetEmergencyFund = Math.round(monthlyEssentialCommitments * settings.emergencyFundMonths);

  // Approximate current liquid emergency reserves from liquid balance
  const currentEmergencySavings = Math.max(0, Math.min(targetEmergencyFund, liquidCashBalance));
  const emergencyFundProgressPct = targetEmergencyFund > 0
    ? Math.min(100, Math.round((currentEmergencySavings / targetEmergencyFund) * 100))
    : 100;
  const emergencyFundMonthsCovered = monthlyEssentialCommitments > 0
    ? Math.round((currentEmergencySavings / monthlyEssentialCommitments) * 10) / 10
    : 0;

  // Goals projection
  const estimatedMonthlySavingsCapacity = Math.max(0, monthlySurplusDeficit);
  const goalsWithCompletionForecast = savingsGoals.map((g) => {
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    const months = estimatedMonthlySavingsCapacity > 0
      ? Math.ceil(remaining / (estimatedMonthlySavingsCapacity * 0.5)) // assume 50% surplus towards goals
      : 99;

    const projectedDate = new Date(referenceDate);
    projectedDate.setMonth(projectedDate.getMonth() + (months === 99 ? 12 : months));
    const estimatedDate = months === 99 ? 'Need additional savings' : projectedDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    return {
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      remaining,
      projectedCompletionMonths: months,
      estimatedDate
    };
  });

  // 7. Category Alerts (75%, 90%, 100%)
  const categoryAlerts: CategoryBudgetAlert[] = [];
  for (const b of budgets) {
    const spent = expensesByCategory[b.category] || 0;
    const limit = b.monthlyLimit;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    let level: CategoryBudgetAlert['level'] = 'normal';
    let message = `Spending on track at ${pct}% of ${formatINR(limit)}`;
    let suggestedReduction = 0;

    if (pct >= 100) {
      level = 'breach_100';
      suggestedReduction = spent - limit;
      message = `Budget breached by ${formatINR(suggestedReduction)}! Immediate spending freeze advised.`;
    } else if (pct >= 90) {
      level = 'critical_90';
      suggestedReduction = Math.round((spent - limit * 0.85) * 100) / 100;
      message = `Critical alert: At ${pct}% of budget. Only ${formatINR(limit - spent)} remaining for ${daysRemaining} days.`;
    } else if (pct >= 75) {
      level = 'warning_75';
      message = `Warning: Reached ${pct}% of monthly limit. Pace remaining spend to ${formatINR((limit - spent) / daysRemaining)}/day.`;
    }

    if (level !== 'normal') {
      categoryAlerts.push({
        category: b.category,
        spent,
        limit,
        percentageUsed: pct,
        level,
        message,
        suggestedReduction
      });
    }
  }

  // 8. Recurring Subscriptions Audit
  const subscriptionCategories = ['tech & subscriptions', 'subscriptions', 'entertainment', 'utilities & bills'];
  const subscriptionAudit: Array<{ name: string; monthlyAmount: number; annualizedCost: number }> = [];

  for (const tx of validCurrentTx) {
    if (tx.type === 'expense' && subscriptionCategories.some((s) => tx.category.toLowerCase().includes(s))) {
      subscriptionAudit.push({
        name: tx.description || tx.category,
        monthlyAmount: tx.amount,
        annualizedCost: tx.amount * 12
      });
    }
  }

  // 9. Rising Categories Month-over-Month (>15% jump)
  const prevExpensesByCategory: Record<string, number> = {};
  for (const tx of prevMonthTx) {
    if (tx.type === 'expense') {
      prevExpensesByCategory[tx.category] = (prevExpensesByCategory[tx.category] || 0) + tx.amount;
    }
  }

  const risingCategories: Array<{ category: string; currentMonthAmount: number; previousMonthAmount: number; growthPct: number }> = [];
  for (const [cat, currentAmt] of Object.entries(expensesByCategory)) {
    const prevAmt = prevExpensesByCategory[cat] || 0;
    if (prevAmt > 1000 && currentAmt > prevAmt * 1.15) {
      const growthPct = Math.round(((currentAmt - prevAmt) / prevAmt) * 100);
      risingCategories.push({
        category: cat,
        currentMonthAmount: currentAmt,
        previousMonthAmount: prevAmt,
        growthPct
      });
    }
  }

  // 10. Personalized Recommendations with Transparent Calculation Details
  const recommendations: RecommendationItem[] = [];

  // Rec 1: Emergency Fund Buffer
  if (emergencyFundMonthsCovered < settings.emergencyFundMonths) {
    const deficit = targetEmergencyFund - currentEmergencySavings;
    const monthlyAlloc = Math.min(deficit, Math.max(2000, Math.round(monthlySurplusDeficit * 0.4)));
    recommendations.push({
      id: 'rec_emergency_fund',
      type: 'emergency_fund',
      title: `Build ${settings.emergencyFundMonths}-Month Emergency Reserve`,
      summary: `You currently hold ${emergencyFundMonthsCovered} months of essential coverage (${formatINR(currentEmergencySavings)}). Target is ${formatINR(targetEmergencyFund)}.`,
      actionableStep: `Allocate ${formatINR(monthlyAlloc)} this month to high-yield liquid savings.`,
      calculationDetails: {
        formula: 'Monthly Essential Expenses × Target Months = Required Emergency Buffer',
        inputs: {
          'Essential Expenses + EMIs': formatINR(monthlyEssentialCommitments),
          'Target Months': settings.emergencyFundMonths,
          'Current Liquid Cushion': formatINR(currentEmergencySavings)
        },
        resultExplanation: `${formatINR(monthlyEssentialCommitments)} × ${settings.emergencyFundMonths} = ${formatINR(targetEmergencyFund)}. Remaining gap is ${formatINR(deficit)}.`
      },
      impactAmount: monthlyAlloc,
      priority: 'high'
    });
  }

  // Rec 2: Daily Spending Limit Adherence
  if (safeDailySpendingLimit > 0) {
    recommendations.push({
      id: 'rec_daily_allowance',
      type: 'spending_cut',
      title: 'Optimal Discretionary Daily Pace',
      summary: `To meet your ${settings.targetSavingsRate}% savings goal, cap unbudgeted discretionary spend at ${formatINR(safeDailySpendingLimit)}/day for the next ${daysRemaining} days.`,
      actionableStep: `Keep dining, shopping, and entertainment below ${formatINR(safeWeeklySpendingLimit)} this week.`,
      calculationDetails: {
        formula: '(Allowed Discretionary Budget - Spent So Far) ÷ Days Remaining',
        inputs: {
          'Confirmed Income': formatINR(totalEarnedPersonalIncome),
          'Target Savings (25%)': formatINR(targetSavingsAmount),
          'Days Left in Month': daysRemaining
        },
        resultExplanation: `Remaining discretionary pool of ${formatINR(remainingDiscretionaryBudget)} divided across ${daysRemaining} days yields a daily safe limit of ${formatINR(safeDailySpendingLimit)}.`
      },
      impactAmount: safeDailySpendingLimit,
      priority: 'medium'
    });
  }

  // Rec 3: Deficit Alert & Discretionary Reductions
  if (isProjectedDeficit || monthlySurplusDeficit < 0) {
    const cutNeeded = Math.abs(projectedMonthEndSurplus);
    recommendations.push({
      id: 'rec_deficit_reduction',
      type: 'spending_cut',
      title: 'Avoid Month-End Cash Deficit',
      summary: `Current burn rate indicates projected expenses of ${formatINR(projectedMonthEndExpenses)}, exceeding confirmed income by ${formatINR(cutNeeded)}.`,
      actionableStep: `Trim discretionary categories (Dining out, shopping) by ${formatINR(Math.min(discretionaryExpenses, cutNeeded))} before month end.`,
      calculationDetails: {
        formula: '(Current Total Expenses ÷ Days Passed) × Total Days = Projected Burn',
        inputs: {
          'Burn Rate to Date': `${formatINR(dailyAverageBurnRate)}/day`,
          'Days in Month': totalDaysInMonth,
          'Confirmed Income': formatINR(totalEarnedPersonalIncome)
        },
        resultExplanation: `Projected spend of ${formatINR(projectedMonthEndExpenses)} minus confirmed income ${formatINR(totalEarnedPersonalIncome)} creates a deficit of ${formatINR(cutNeeded)}.`
      },
      impactAmount: cutNeeded,
      priority: 'high'
    });
  }

  // Rec 4: Variable / Freelance Income Baseline Guidance
  if (settings.incomeType === 'variable') {
    recommendations.push({
      id: 'rec_variable_income_baseline',
      type: 'budget_allocation',
      title: 'Conservative Baseline for Variable Earnings',
      summary: `You have ${formatINR(pendingInvoiceReceivables)} in pending invoices. We treat this strictly as unconfirmed accruals to prevent cash shortfalls.`,
      actionableStep: 'Never commit to long-term subscriptions or discretionary lifestyle creep on anticipated project checks until funds clear your bank account.',
      calculationDetails: {
        formula: 'Budget = Confirmed Bank Cash Only (Pending Accounts Receivable strictly excluded)',
        inputs: {
          'Confirmed Cash': formatINR(totalEarnedPersonalIncome),
          'Pending Invoices': formatINR(pendingInvoiceReceivables)
        },
        resultExplanation: `Pending revenue (${formatINR(pendingInvoiceReceivables)}) is tracked for accrual billing, but daily spending limits use only cleared funds (${formatINR(totalEarnedPersonalIncome)}).`
      },
      priority: 'medium'
    });
  }

  // Rec 5: Windfall Additional Income Split Rule
  const sampleWindfall = 25000;
  const windfallSplit = {
    emergency: Math.round((sampleWindfall * settings.windfallAllocation.emergencyFundPct) / 100),
    debt: Math.round((sampleWindfall * settings.windfallAllocation.debtRepaymentPct) / 100),
    goals: Math.round((sampleWindfall * settings.windfallAllocation.financialGoalsPct) / 100),
    discretionary: Math.round((sampleWindfall * settings.windfallAllocation.discretionaryPct) / 100)
  };

  recommendations.push({
    id: 'rec_windfall_split',
    type: 'windfall_strategy',
    title: 'Surplus & Bonus Split Strategy',
    summary: 'When unexpected bonuses or freelance windfalls arrive, automatically split them according to your custom disciplined ratio.',
    actionableStep: `For a sample ₹25,000 inflow: ${formatINR(windfallSplit.emergency)} to Emergency Fund, ${formatINR(windfallSplit.debt)} to Prepay Debt, ${formatINR(windfallSplit.goals)} to Goals, and ${formatINR(windfallSplit.discretionary)} for Guilt-Free Discretionary Spend.`,
    calculationDetails: {
      formula: 'Windfall × Configured Allocation Percentages',
      inputs: {
        'Emergency %': `${settings.windfallAllocation.emergencyFundPct}%`,
        'Debt Repay %': `${settings.windfallAllocation.debtRepaymentPct}%`,
        'Goals %': `${settings.windfallAllocation.financialGoalsPct}%`,
        'Discretionary %': `${settings.windfallAllocation.discretionaryPct}%`
      },
      resultExplanation: `Disciplined wealth creation formula ensures zero lifestyle dilution while allowing guilt-free enjoyment.`
    },
    priority: 'low'
  });

  return {
    confirmedPersonalIncome,
    grossBusinessRevenue,
    businessDeductionsAndReserves,
    netBusinessPersonalDraw,
    pendingInvoiceReceivables,
    incomeByType,
    essentialExpenses,
    discretionaryExpenses,
    debtRepaymentsRecorded,
    totalExpenses,
    expensesByCategory,
    upcomingEMIs,
    upcomingBills,
    totalReservedObligations,
    liquidCashBalance,
    safeAvailableBalance,
    monthlySurplusDeficit,
    savingsRate,
    daysRemainingInMonth: daysRemaining,
    daysPassedInMonth: daysPassed,
    safeDailySpendingLimit,
    safeWeeklySpendingLimit,
    dailyAverageBurnRate,
    projectedMonthEndExpenses,
    projectedMonthEndSurplus,
    isProjectedDeficit,
    monthlyEssentialCommitments,
    targetEmergencyFund,
    currentEmergencySavings,
    emergencyFundProgressPct,
    emergencyFundMonthsCovered,
    goalsWithCompletionForecast,
    categoryAlerts,
    recommendations,
    subscriptionAudit,
    risingCategories
  };
}

/**
 * AI Finance Coach Contextual Explainer
 * Explains deterministic financial calculations in conversational, empathetic,
 * highly analytical natural language with Indian Rupee precision.
 */
export function generateAICoachInsight(
  question: string,
  data: BudgetEngineOutput,
  settings: BudgetCoachSettings
): string {
  const q = question.toLowerCase();

  // Question 1: Can I afford a purchase?
  if (q.includes('afford') || q.includes('buy') || q.includes('spend') || q.includes('purchase') || q.includes('cost')) {
    const numMatches = question.match(/\b\d[\d,]*\b/g);
    const amount = numMatches && numMatches.length > 0 ? parseInt(numMatches[0].replace(/,/g, ''), 10) : 10000;

    if (amount > data.safeAvailableBalance) {
      return `⚠️ **Financial Coach Caution:** You cannot safely afford this ${formatINR(amount, false)} purchase right now. Your liquid balance after reserving ${formatINR(data.totalReservedObligations, false)} for upcoming EMIs and essential bills leaves only **${formatINR(data.safeAvailableBalance)}** in safe uncommitted funds. Making this purchase would cause an overdraft or dip into reserved loan commitments.`;
    }

    if (amount > data.safeDailySpendingLimit * 7) {
      const daysOfAllowance = Math.round(amount / Math.max(1, data.safeDailySpendingLimit));
      return `💡 **Coach Analysis:** You have enough liquid cushion (${formatINR(data.safeAvailableBalance)}), but spending **${formatINR(amount)}** consumes **${daysOfAllowance} days** of your safe discretionary spending allowance (${formatINR(data.safeDailySpendingLimit)}/day). If this is essential, proceed; otherwise, defer it until next month or trim discretionary dining/shopping by ${formatINR(amount * 0.5)} to preserve your ${settings.targetSavingsRate}% savings goal.`;
    }

    return `✅ **Coach Approval:** Yes, you can comfortably afford this **${formatINR(amount)}** purchase! Even after deducting this, your essential reserves of **${formatINR(data.totalReservedObligations)}** for EMIs and bills remain 100% protected, and your remaining discretionary allowance will stay healthy at ${formatINR(Math.max(0, data.safeDailySpendingLimit - (amount / data.daysRemainingInMonth)))}/day.`;
  }

  // Question 2: Daily limit / allowance
  if (q.includes('daily') || q.includes('allowance') || q.includes('today')) {
    return `🎯 **Safe Daily Spending Allowance:** Your calculated safe limit is **${formatINR(data.safeDailySpendingLimit)}/day** (or **${formatINR(data.safeWeeklySpendingLimit)}/week**) for the remaining **${data.daysRemainingInMonth} days** of the month.\n\n*Calculation details:* Based on confirmed income of ${formatINR(data.confirmedPersonalIncome + data.netBusinessPersonalDraw)}, after accounting for ${formatINR(data.essentialExpenses)} in needs and ${formatINR(data.totalReservedObligations)} in debt obligations, sticking to this daily pace guarantees you meet your **${settings.targetSavingsRate}% savings target**.`;
  }

  // Question 3: Emergency Fund
  if (q.includes('emergency') || q.includes('reserve') || q.includes('safety net')) {
    return `🛡️ **Emergency Fund Diagnostic:** Your target 6-month buffer is **${formatINR(data.targetEmergencyFund)}** (based on ${formatINR(data.monthlyEssentialCommitments)} monthly essential living & EMI commitments). You currently hold **${formatINR(data.currentEmergencySavings)}** (${data.emergencyFundProgressPct}% completed, covering **${data.emergencyFundMonthsCovered} months**).\n\n*Coach Recommendation:* Direct ${formatINR(Math.max(2500, Math.round(data.monthlySurplusDeficit * 0.4)))} from your monthly surplus into a liquid mutual fund or auto-sweep FD to close the remaining gap within ${Math.ceil((data.targetEmergencyFund - data.currentEmergencySavings) / Math.max(2500, data.monthlySurplusDeficit * 0.4))} months.`;
  }

  // Question 4: Bonus / Windfall
  if (q.includes('bonus') || q.includes('windfall') || q.includes('extra income')) {
    return `✨ **Surplus Allocation Rule:** When unexpected revenue or a bonus arrives, avoid lifestyle dilution by applying your custom split formula:\n- **${settings.windfallAllocation.emergencyFundPct}%** (${formatINR((50000 * settings.windfallAllocation.emergencyFundPct) / 100)} on ₹50k) to Emergency Buffer\n- **${settings.windfallAllocation.debtRepaymentPct}%** (${formatINR((50000 * settings.windfallAllocation.debtRepaymentPct) / 100)}) to Principal Debt Prepayment\n- **${settings.windfallAllocation.financialGoalsPct}%** (${formatINR((50000 * settings.windfallAllocation.financialGoalsPct) / 100)}) to Long-term Goals\n- **${settings.windfallAllocation.discretionaryPct}%** (${formatINR((50000 * settings.windfallAllocation.discretionaryPct) / 100)}) for Guilt-Free Personal Celebration!`;
  }

  // Default general diagnosis
  return `📊 **AI Finance Coach Monthly Summary:**\n- **Confirmed Inflow:** ${formatINR(data.confirmedPersonalIncome + data.netBusinessPersonalDraw)} (strictly excluding ${formatINR(data.pendingInvoiceReceivables)} pending accruals)\n- **Burn Rate:** Averaging ${formatINR(data.dailyAverageBurnRate)}/day (${formatINR(data.totalExpenses)} spent to date)\n- **Health Check:** Your savings rate is **${data.savingsRate}%** (Target: ${settings.targetSavingsRate}%).\n- **Daily Pace:** Stay below **${formatINR(data.safeDailySpendingLimit)}/day** to finish the month with a healthy surplus of ${formatINR(data.projectedMonthEndSurplus)}.`;
}

/**
 * Windfall Distribution Calculator
 */
export function calculateWindfallDistribution(
  amount: number,
  needsEmergencyFund: boolean = true,
  hasHighInterestDebt: boolean = false
) {
  const emergencyPct = needsEmergencyFund ? 35 : 15;
  const debtPct = hasHighInterestDebt ? 30 : 15;
  const goalsPct = 25;
  const discretionaryPct = 100 - (emergencyPct + debtPct + goalsPct);

  return {
    emergencyFundPercent: emergencyPct,
    emergencyFundAmount: Math.round((amount * emergencyPct) / 100),
    debtRepaymentPercent: debtPct,
    debtRepaymentAmount: Math.round((amount * debtPct) / 100),
    goalsPercent: goalsPct,
    goalsAmount: Math.round((amount * goalsPct) / 100),
    discretionaryPercent: discretionaryPct,
    discretionaryAmount: Math.round((amount * discretionaryPct) / 100)
  };
}

// Aliases for compatibility
export const runBudgetEngine = calculateBudgetEngine;
export type UserProfileConfig = BudgetCoachSettings;
export interface CalculationTrace {
  metric: string;
  formula: string;
  inputs: Record<string, string | number>;
  result: string | number;
}
