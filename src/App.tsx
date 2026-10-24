import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  FileSpreadsheet,
  Landmark,
  PiggyBank,
  PieChart,
  Plus,
  RefreshCw,
  Wallet,
  Calendar,
  AlertCircle,
  Mail,
  TrendingUp,
  Percent,
  Sparkles
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useSync } from './context/SyncContext';
import {
  Transaction,
  Invoice,
  Loan,
  LoanInstallment,
  Project,
  Budget,
  SavingsGoal,
  RecurringTransaction
} from './types/finance';
import { getCollectionData } from './services/firestoreService';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { MetricCards } from './components/Dashboard/MetricCards';
import { HomeDashboard } from './components/Dashboard/HomeDashboard';
import { ExpenseActivities } from './components/Analytics/ExpenseActivities';
import { FinancialInsights } from './components/Analytics/FinancialInsights';
import { SmartBudgetCoach } from './components/SmartCoach/SmartBudgetCoach';
import { TransactionList } from './components/Transactions/TransactionList';
import { TransactionModal } from './components/Transactions/TransactionModal';
import { InvoiceList } from './components/Invoices/InvoiceList';
import { InvoiceCreateModal } from './components/Invoices/InvoiceCreateModal';
import { InvoicePaymentModal } from './components/Invoices/InvoicePaymentModal';
import { LoanList } from './components/Loans/LoanList';
import { LoanCreateModal } from './components/Loans/LoanCreateModal';
import { LoanPaymentModal } from './components/Loans/LoanPaymentModal';
import { BudgetManager } from './components/BudgetsGoals/BudgetManager';
import { FinancialReports } from './components/Analytics/FinancialReports';
import { EmailReviewQueue } from './components/EmailSync/EmailReviewQueue';
import { SyncStatusModal } from './components/SyncStatusModal';
import { AuthModal } from './components/AuthModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { AuthPortal } from './components/Auth/AuthPortal';
import { formatINR } from './services/financialCalculations';

export const AppContent: React.FC = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const { isOnline, syncStatus } = useSync();

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isInvoiceCreateOpen, setIsInvoiceCreateOpen] = useState(false);
  const [isInvoicePayOpen, setIsInvoicePayOpen] = useState(false);
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<Invoice | null>(null);

  const [isLoanCreateOpen, setIsLoanCreateOpen] = useState(false);
  const [isLoanPayOpen, setIsLoanPayOpen] = useState(false);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<Loan | null>(null);
  const [selectedInstallmentForPay, setSelectedInstallmentForPay] = useState<LoanInstallment | null>(null);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [
        txData,
        invData,
        loanData,
        instData,
        projData,
        budData,
        goalData,
        recData
      ] = await Promise.all([
        getCollectionData<Transaction>('transactions', currentUser.id),
        getCollectionData<Invoice>('invoices', currentUser.id),
        getCollectionData<Loan>('loans', currentUser.id),
        getCollectionData<LoanInstallment>('loan_installments', currentUser.id),
        getCollectionData<Project>('projects', currentUser.id),
        getCollectionData<Budget>('budgets', currentUser.id),
        getCollectionData<SavingsGoal>('savings_goals', currentUser.id),
        getCollectionData<RecurringTransaction>('recurring_transactions', currentUser.id)
      ]);

      // Sort transactions descending by date
      txData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(txData);
      setInvoices(invData);
      setLoans(loanData);
      setInstallments(instData);
      setProjects(projData);
      setBudgets(budData);
      setSavingsGoals(goalData);
      setRecurringTransactions(recData);
    } catch (err) {
      console.error('Error fetching collection data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived Financial Metrics
  const cashBalance = transactions.reduce((sum, t) => {
    if (t.type === 'income') return sum + t.amount;
    if (t.type === 'expense') return sum - t.amount;
    return sum;
  }, 0);

  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentMonthTx = transactions.filter((t) => (t.date || '').startsWith(currentMonthStr));

  const monthlyInflow = currentMonthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyOutflow = currentMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const accountsReceivable = invoices.reduce((sum, i) => sum + i.remainingBalance, 0);

  const loanLiability = loans
    .filter((l) => l.type === 'taken' && l.status === 'active')
    .reduce((sum, l) => sum + l.remainingPrincipal, 0);

  const nextEMI = loans
    .filter((l) => l.type === 'taken' && l.status === 'active')
    .reduce((sum, l) => sum + l.monthlyEMI, 0);

  const openInvoicePayment = (inv: Invoice) => {
    setSelectedInvoiceForPay(inv);
    setIsInvoicePayOpen(true);
  };

  const openLoanPayment = (loan: Loan, installment: LoanInstallment | null) => {
    setSelectedLoanForPay(loan);
    setSelectedInstallmentForPay(installment);
    setIsLoanPayOpen(true);
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at top, #141f36 0%, #080c14 100%)',
          color: '#f8fafc',
          fontFamily: 'var(--font-body)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ccff00 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              boxShadow: '0 8px 24px rgba(204, 255, 0, 0.3)'
            }}
          >
            <Wallet size={32} color="#000000" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px', fontFamily: 'var(--font-heading)' }}>
            FinanceFlow
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '0.875rem'
            }}
          >
            <RefreshCw size={16} className="spin" />
            <span>Loading your workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPortal />;
  }

  return (
    <div className="app-container">
      {/* Desktop Navigation Sidebar */}
      <aside className="desktop-sidebar">
        <div className="brand-header">
          <div className="brand-icon">
            <Wallet size={22} color="white" />
          </div>
          <div>
            <div className="brand-title">FinanceFlow</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="brand-badge">PWA</span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>INR (₹)</span>
            </div>
          </div>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'activities' ? 'active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            <TrendingUp size={18} />
            <span>Activities</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <Percent size={18} />
            <span>Financial Insights</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'coach' ? 'active' : ''}`}
            onClick={() => setActiveTab('coach')}
            style={activeTab === 'coach' ? { background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(99, 102, 241, 0.22))', borderColor: 'rgba(16, 185, 129, 0.4)' } : undefined}
          >
            <Sparkles size={18} style={{ color: '#10b981' }} />
            <span>Smart Coach</span>
            <span
              style={{
                marginLeft: 'auto',
                background: 'linear-gradient(135deg, #10b981, #6366f1)',
                color: '#ffffff',
                fontSize: '0.65rem',
                padding: '2px 6px',
                borderRadius: '999px',
                fontWeight: 800
              }}
            >
              AI
            </span>
          </button>

          <button
            className={`nav-link ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <ReceiptText size={18} />
            <span>Cash Ledger</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            <FileSpreadsheet size={18} />
            <span>Invoices & AR</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'loans' ? 'active' : ''}`}
            onClick={() => setActiveTab('loans')}
          >
            <Landmark size={18} />
            <span>Loans & EMIs</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'budgets' ? 'active' : ''}`}
            onClick={() => setActiveTab('budgets')}
          >
            <PiggyBank size={18} />
            <span>Budgets & Goals</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'email_sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('email_sync')}
          >
            <Mail size={18} />
            <span>Bank Emails</span>
            <span style={{ marginLeft: 'auto', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '999px', fontWeight: 800 }}>
              Review
            </span>
          </button>

          <button
            className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <PieChart size={18} />
            <span>Accrual Reports</span>
          </button>
        </nav>

        {/* Quick Add Button in Sidebar */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setIsTxModalOpen(true)}
            className="btn btn-primary"
            style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
          >
            <Plus size={16} />
            <span>Add Transaction</span>
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          openSyncModal={() => setIsSyncModalOpen(true)}
          openAuthModal={() => setIsAuthModalOpen(true)}
          openConfigModal={() => setIsConfigModalOpen(true)}
        />

        <main className="content-body">
          {activeTab === 'dashboard' && (
            <HomeDashboard
              cashBalance={cashBalance}
              monthlyInflow={monthlyInflow}
              monthlyOutflow={monthlyOutflow}
              transactions={transactions}
              invoices={invoices}
              loans={loans}
              installments={installments}
              onNavigateTab={(tab) => setActiveTab(tab)}
              openAddTxModal={() => setIsTxModalOpen(true)}
              openInvoiceCreateModal={() => setIsInvoiceCreateOpen(true)}
              openLoanPaymentModal={openLoanPayment}
            />
          )}

          {activeTab === 'activities' && (
            <ExpenseActivities
              transactions={transactions}
              budgets={budgets}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'insights' && (
            <FinancialInsights
              transactions={transactions}
              invoices={invoices}
              loans={loans}
              installments={installments}
              budgets={budgets}
              savingsGoals={savingsGoals}
              projects={projects}
              onNavigateTab={(tab) => setActiveTab(tab)}
              openInvoicePaymentModal={openInvoicePayment}
              openLoanPaymentModal={openLoanPayment}
            />
          )}

          {activeTab === 'coach' && (
            <SmartBudgetCoach
              transactions={transactions}
              invoices={invoices}
              loans={loans}
              installments={installments}
              budgets={budgets}
              savingsGoals={savingsGoals}
              recurringTransactions={recurringTransactions}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionList
              transactions={transactions}
              onRefresh={fetchData}
              openCreateModal={() => setIsTxModalOpen(true)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoiceList
              invoices={invoices}
              onOpenCreateModal={() => setIsInvoiceCreateOpen(true)}
              onOpenPaymentModal={openInvoicePayment}
            />
          )}

          {activeTab === 'loans' && (
            <LoanList
              loans={loans}
              installments={installments}
              onOpenCreateModal={() => setIsLoanCreateOpen(true)}
              onOpenPaymentModal={openLoanPayment}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetManager
              budgets={budgets}
              savingsGoals={savingsGoals}
              recurringTransactions={recurringTransactions}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'analytics' && (
            <FinancialReports
              transactions={transactions}
              invoices={invoices}
              projects={projects}
            />
          )}

          {activeTab === 'email_sync' && (
            <EmailReviewQueue onTransactionPosted={fetchData} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openQuickAdd={() => setIsTxModalOpen(true)}
      />

      {/* Modals */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSuccess={fetchData}
        projects={projects}
      />

      <InvoiceCreateModal
        isOpen={isInvoiceCreateOpen}
        onClose={() => setIsInvoiceCreateOpen(false)}
        onSuccess={fetchData}
        projects={projects}
      />

      <InvoicePaymentModal
        invoice={selectedInvoiceForPay}
        isOpen={isInvoicePayOpen}
        onClose={() => {
          setIsInvoicePayOpen(false);
          setSelectedInvoiceForPay(null);
        }}
        onSuccess={fetchData}
      />

      <LoanCreateModal
        isOpen={isLoanCreateOpen}
        onClose={() => setIsLoanCreateOpen(false)}
        onSuccess={fetchData}
      />

      <LoanPaymentModal
        loan={selectedLoanForPay}
        installment={selectedInstallmentForPay}
        isOpen={isLoanPayOpen}
        onClose={() => {
          setIsLoanPayOpen(false);
          setSelectedLoanForPay(null);
          setSelectedInstallmentForPay(null);
        }}
        onSuccess={fetchData}
      />

      <SyncStatusModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <FirebaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
