import { describe, it, expect } from 'vitest';
import {
  calculateBudgetEngine,
  classifyExpenseNature,
  classifyIncomeSource,
  generateAICoachInsight,
  DEFAULT_COACH_SETTINGS
} from '../budgetCoachEngine';
import { Transaction, Invoice, Loan, LoanInstallment, Budget, SavingsGoal, RecurringTransaction } from '../../types/finance';

describe('Budget Coach Engine', () => {
  it('correctly classifies essential vs discretionary expenses and excludes transfers', () => {
    expect(classifyExpenseNature('Rent & Housing')).toBe('essential');
    expect(classifyExpenseNature('Groceries')).toBe('essential');
    expect(classifyExpenseNature('Utilities & Bills')).toBe('essential');
    expect(classifyExpenseNature('Dining & Food')).toBe('discretionary');
    expect(classifyExpenseNature('Shopping')).toBe('discretionary');
    expect(classifyExpenseNature('Self Transfer', 'Transfer to SBI account')).toBe('transfer');
    expect(classifyExpenseNature('Loan EMI', 'HDFC Home Loan')).toBe('debt_repayment');
  });

  it('correctly classifies income sources and separates business income', () => {
    expect(classifyIncomeSource('Salary', 'Monthly salary credit')).toBe('salary');
    expect(classifyIncomeSource('Freelance', 'UI Design work')).toBe('freelance');
    expect(classifyIncomeSource('Business Income', 'Store client sales')).toBe('business_income');
  });

  it('computes confirmed personal income, reserves, and safe daily limit deterministically', () => {
    const fixedDate = new Date('2026-10-15T00:00:00.000Z');

    const sampleTransactions: Transaction[] = [
      {
        id: 'tx_1',
        userId: 'u1',
        type: 'income',
        amount: 80000,
        category: 'Salary',
        account: 'HDFC',
        date: '2026-10-01',
        description: 'October Salary',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'tx_2',
        userId: 'u1',
        type: 'expense',
        amount: 25000,
        category: 'Rent & Housing',
        account: 'HDFC',
        date: '2026-10-02',
        description: 'House Rent',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'tx_3',
        userId: 'u1',
        type: 'expense',
        amount: 5000,
        category: 'Dining & Food',
        account: 'UPI',
        date: '2026-10-05',
        description: 'Dining out',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'tx_4',
        userId: 'u1',
        type: 'transfer',
        amount: 10000,
        category: 'Transfer',
        account: 'HDFC',
        date: '2026-10-08',
        description: 'Transfer to ICICI',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const sampleInvoices: Invoice[] = [
      {
        id: 'inv_1',
        userId: 'u1',
        invoiceNumber: 'INV-101',
        clientName: 'Acme Corp',
        issueDate: '2026-10-05',
        dueDate: '2026-10-25',
        items: [],
        subtotal: 30000,
        taxAmount: 5400,
        totalAmount: 35400,
        paidAmount: 0,
        remainingBalance: 35400,
        status: 'sent',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const sampleLoans: Loan[] = [
      {
        id: 'l_1',
        userId: 'u1',
        title: 'Car Loan',
        counterparty: 'HDFC Bank',
        type: 'taken',
        principalAmount: 500000,
        annualInterestRate: 9,
        tenureMonths: 36,
        monthlyEMI: 15899,
        totalInterest: 72364,
        totalPayable: 572364,
        remainingPrincipal: 450000,
        startDate: '2026-01-01',
        status: 'active',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const sampleBudgets: Budget[] = [
      {
        id: 'b_1',
        userId: 'u1',
        category: 'Dining & Food',
        monthlyLimit: 6000,
        alertThreshold: 75,
        period: '2026-10',
        spentAmount: 5000,
        createdAt: ''
      }
    ];

    const output = calculateBudgetEngine(
      sampleTransactions,
      sampleInvoices,
      sampleLoans,
      [],
      sampleBudgets,
      [],
      [],
      DEFAULT_COACH_SETTINGS,
      fixedDate
    );

    // Verified assertions:
    // Confirmed income: 80,000 (pending invoice 35,400 must NOT be counted as cash)
    expect(output.confirmedPersonalIncome).toBe(80000);
    expect(output.pendingInvoiceReceivables).toBe(35400);

    // Essential: 25,000, Discretionary: 5,000
    expect(output.essentialExpenses).toBe(25000);
    expect(output.discretionaryExpenses).toBe(5000);
    expect(output.totalExpenses).toBe(30000);

    // Upcoming EMI reserved: 15,899
    expect(output.upcomingEMIs).toBe(15899);
    expect(output.totalReservedObligations).toBe(15899);

    // Category alert: 5000/6000 is 83% -> warning_75
    expect(output.categoryAlerts.length).toBeGreaterThan(0);
    expect(output.categoryAlerts[0].level).toBe('warning_75');

    // Safe Daily Spending Limit is calculated and positive
    expect(output.safeDailySpendingLimit).toBeGreaterThan(0);

    // Recommendations exist with transparent formula details
    expect(output.recommendations.length).toBeGreaterThan(0);
    expect(output.recommendations[0].calculationDetails.formula).toBeDefined();
  });

  it('generates context-aware AI coach insights grounded in real calculations', () => {
    const mockOutput = calculateBudgetEngine([], [], [], [], [], [], [], DEFAULT_COACH_SETTINGS);
    mockOutput.safeAvailableBalance = 25000;
    mockOutput.safeDailySpendingLimit = 800;

    const affordInsight = generateAICoachInsight('Can I afford a phone for 12000?', mockOutput, DEFAULT_COACH_SETTINGS);
    expect(affordInsight).toContain('Coach');
    expect(affordInsight).toContain('12,000');
  });
});
