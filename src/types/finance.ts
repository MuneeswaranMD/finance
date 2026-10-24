export type TransactionType = 'income' | 'expense' | 'transfer';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type LoanType = 'taken' | 'given';
export type LoanStatus = 'active' | 'closed' | 'defaulted';
export type InstallmentStatus = 'pending' | 'paid' | 'overdue';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SyncItemStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface UserProfile {
  id: string; // Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  currency: 'INR';
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // In INR
  category: string;
  account: string;
  date: string; // YYYY-MM-DD
  description: string;
  projectId?: string;
  invoicePaymentId?: string;
  loanPaymentId?: string;
  idempotencyKey?: string;
  tags?: string[];
  isOfflineDraft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  clientName?: string;
  budget: number;
  status: 'active' | 'completed' | 'on_hold';
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  total: number;
}

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  issueDate: string;
  dueDate: string;
  projectId?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  userId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  idempotencyKey: string; // Crucial for duplicate prevention
  notes?: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  userId: string;
  title: string;
  counterparty: string;
  type: LoanType; // taken = liability, given = asset
  principalAmount: number;
  annualInterestRate: number; // % e.g. 10.5
  tenureMonths: number;
  monthlyEMI: number;
  totalInterest: number;
  totalPayable: number;
  remainingPrincipal: number;
  startDate: string;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LoanInstallment {
  id: string;
  userId: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalComponent: number;
  interestComponent: number;
  totalEMI: number;
  remainingBalanceAfter: number;
  status: InstallmentStatus;
  paidDate?: string;
  paymentId?: string;
}

export interface LoanPayment {
  id: string;
  userId: string;
  loanId: string;
  installmentId?: string;
  installmentNumber?: number;
  amount: number;
  principalPaid: number;
  interestPaid: number;
  paymentDate: string;
  paymentMethod: string;
  idempotencyKey: string; // Duplicate prevention
  notes?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  alertThreshold: number; // e.g. 80 for 80%
  period: string; // YYYY-MM
  spentAmount: number;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
  status: 'in_progress' | 'achieved';
  createdAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  lastProcessedDate?: string;
  active: boolean;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  userId: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  data: any;
  idempotencyKey: string;
  timestamp: number;
  status: SyncItemStatus;
  retryCount: number;
  errorMessage?: string;
  conflictDetails?: {
    clientVersion: any;
    serverVersion: any;
  };
}

export interface FinancialSummary {
  cashBalance: number;
  monthlyCashInflow: number;
  monthlyCashOutflow: number;
  netCashFlow: number;
  accountsReceivable: number; // Accrual unpaid invoices
  totalLoanLiability: number; // Remaining principal for loans taken
  totalLoanAssets: number; // Remaining principal for loans given
  upcomingEMIsMonth: number;
  totalBudgetLimit: number;
  totalBudgetSpent: number;
}

export type TransactionClassification =
  | 'purchase'
  | 'loan_emi'
  | 'credit_card_bill'
  | 'transfer'
  | 'refund'
  | 'fee'
  | 'uncertain';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface BankEmailParseResult {
  amount: number;
  currency: 'INR';
  direction: 'debit' | 'credit';
  accountMasked: string;
  merchantOrDescription: string;
  transactionDate: string;
  referenceNumber?: string;
  paymentMethod: string;
  suggestedCategory: string;
  classification: TransactionClassification;
  confidence: number; // 0.0 - 1.0
  confidenceLevel: ConfidenceLevel;
  parserUsed: string;
  rawSubject: string;
  rawSnippet: string;
}

export interface ParsedEmailDoc {
  id: string; // e.g. email_{gmailMessageId}
  userId: string;
  gmailMessageId: string;
  gmailAccountId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  parseResult: BankEmailParseResult;
  status: 'pending_review' | 'auto_posted' | 'approved' | 'rejected' | 'ignored';
  transactionId?: string; // Links to created ledger transaction
  auditLog: Array<{ action: string; timestamp: string; details?: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSyncSettings {
  userId: string;
  autoPostTrusted: boolean; // Toggle for auto-posting high-confidence purchases
  minConfidenceToAutoPost: number; // e.g. 0.90
  connectedEmail?: string;
  lastSyncTimestamp?: string;
  syncedEmailCount: number;
}
