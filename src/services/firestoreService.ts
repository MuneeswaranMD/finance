import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  runTransaction,
  writeBatch,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { firestoreDb, getIsDemoMode } from './firebaseConfig';
import {
  Transaction,
  Project,
  Invoice,
  InvoicePayment,
  Loan,
  LoanInstallment,
  LoanPayment,
  Budget,
  SavingsGoal,
  RecurringTransaction,
  UserProfile
} from '../types/finance';
import {
  determineInvoiceStatus,
  generateAmortizationSchedule
} from './financialCalculations';
import {
  enqueueSyncItem,
  saveLocalCache,
  getLocalCache
} from './offlineQueue';

// In-memory demo store for seamless testing without Firebase project configuration
const demoStore: Record<string, any[]> = {
  profiles: [],
  transactions: [
    {
      id: 'tx_demo_1',
      userId: 'demo_user',
      type: 'income',
      amount: 150000,
      category: 'Salary',
      account: 'HDFC Bank',
      date: new Date().toISOString().split('T')[0],
      description: 'Monthly Engineering Salary',
      tags: ['salary', 'tech'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'tx_demo_2',
      userId: 'demo_user',
      type: 'expense',
      amount: 32000,
      category: 'Rent',
      account: 'HDFC Bank',
      date: new Date().toISOString().split('T')[0],
      description: 'Apartment Rent (Indiranagar, Bangalore)',
      tags: ['housing', 'fixed'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'tx_demo_3',
      userId: 'demo_user',
      type: 'expense',
      amount: 8500,
      category: 'Groceries',
      account: 'UPI',
      date: new Date().toISOString().split('T')[0],
      description: 'Nature Basket Organic Groceries',
      tags: ['food', 'groceries'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  projects: [
    {
      id: 'proj_demo_1',
      userId: 'demo_user',
      name: 'Fintech Mobile App Redesign',
      clientName: 'Apex Cloud Solutions',
      budget: 350000,
      status: 'active',
      notes: 'PWA milestone 1 with UPI integration',
      createdAt: new Date().toISOString()
    }
  ],
  invoices: [
    {
      id: 'inv_demo_1',
      userId: 'demo_user',
      invoiceNumber: 'INV-2026-001',
      clientName: 'Apex Cloud Solutions',
      clientEmail: 'billing@apexcloud.io',
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      projectId: 'proj_demo_1',
      items: [
        {
          id: 'item_1',
          description: 'UI/UX Design Architecture Sprint',
          quantity: 1,
          unitPrice: 100000,
          gstRate: 18,
          total: 118000
        }
      ],
      subtotal: 100000,
      taxAmount: 18000,
      totalAmount: 118000,
      paidAmount: 50000,
      remainingBalance: 68000,
      status: 'partially_paid',
      notes: 'Advance 50k received via NEFT. Balance on UAT.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  invoice_payments: [
    {
      id: 'inv_pay_demo_1',
      userId: 'demo_user',
      invoiceId: 'inv_demo_1',
      amount: 50000,
      paymentDate: '2026-10-05',
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'NEFT982736412',
      idempotencyKey: 'inv_pay_inv_demo_1_50000_1728100000',
      notes: 'Advance milestone payment',
      createdAt: new Date().toISOString()
    }
  ],
  loans: [
    {
      id: 'loan_demo_1',
      userId: 'demo_user',
      title: 'HDFC Home Loan',
      counterparty: 'HDFC Bank',
      type: 'taken',
      principalAmount: 2500000,
      annualInterestRate: 8.75,
      tenureMonths: 120,
      monthlyEMI: 31336.56,
      totalInterest: 1260387.2,
      totalPayable: 3760387.2,
      remainingPrincipal: 2420000,
      startDate: '2026-01-01',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  loan_installments: [],
  loan_payments: [],
  budgets: [
    {
      id: 'budget_demo_1',
      userId: 'demo_user',
      category: 'Groceries',
      monthlyLimit: 15000,
      alertThreshold: 80,
      period: '2026-10',
      spentAmount: 8500,
      createdAt: new Date().toISOString()
    },
    {
      id: 'budget_demo_2',
      userId: 'demo_user',
      category: 'Dining & Entertainment',
      monthlyLimit: 10000,
      alertThreshold: 80,
      period: '2026-10',
      spentAmount: 9200,
      createdAt: new Date().toISOString()
    }
  ],
  savings_goals: [
    {
      id: 'goal_demo_1',
      userId: 'demo_user',
      title: 'Emergency Reserve Fund (6 Months)',
      targetAmount: 500000,
      currentAmount: 320000,
      targetDate: '2027-03-31',
      category: 'Emergency',
      status: 'in_progress',
      createdAt: new Date().toISOString()
    }
  ],
  recurring_transactions: [
    {
      id: 'rec_demo_1',
      userId: 'demo_user',
      title: 'Broadband Fiber Internet',
      amount: 1499,
      type: 'expense',
      category: 'Utilities',
      frequency: 'monthly',
      nextDueDate: '2026-11-05',
      active: true,
      createdAt: new Date().toISOString()
    }
  ]
};

// Initialize demo installments for demo loan
if (demoStore.loans.length > 0) {
  demoStore.loan_installments = generateAmortizationSchedule(
    'loan_demo_1',
    'demo_user',
    2500000,
    8.75,
    120,
    '2026-01-01'
  );
}

// Helper to check network connectivity
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Strips undefined fields recursively to prevent Firestore 'unsupported field value: undefined' errors
 */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && typeof (val as any).toMillis !== 'function') {
        cleaned[key] = cleanFirestoreData(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

// Generic collection fetch with local cache fallback
export async function getCollectionData<T>(collectionName: string, userId: string): Promise<T[]> {
  // If demo mode, retrieve from demo store or local cache
  if (getIsDemoMode()) {
    const list = demoStore[collectionName] || [];
    return list.filter((i) => i.userId === userId || userId === 'demo_user') as T[];
  }

  // If offline, read from IndexedDB local cache directly
  if (!isOnline()) {
    const cached = await getLocalCache<T>(collectionName);
    return cached.filter((i: any) => i.userId === userId);
  }

  try {
    const q = query(collection(firestoreDb, collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const data: T[] = [];
    snapshot.forEach((docSnap) => {
      data.push({ id: docSnap.id, ...docSnap.data() } as T);
    });

    // Update local offline cache in background
    saveLocalCache(collectionName, data);
    return data;
  } catch (error) {
    console.warn(`Firestore read for ${collectionName} failed. Falling back to local cache:`, error);
    const cached = await getLocalCache<T>(collectionName);
    return cached.filter((i: any) => i.userId === userId);
  }
}

// ----------------- PROFILE -----------------
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const profiles = await getCollectionData<UserProfile>('profiles', userId);
  return profiles.length > 0 ? profiles[0] : null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (getIsDemoMode()) {
    const idx = (demoStore.profiles || []).findIndex((p) => p.id === profile.id);
    if (idx >= 0) demoStore.profiles[idx] = profile;
    else demoStore.profiles.push(profile);
    return;
  }

  await setDoc(doc(firestoreDb, 'profiles', profile.id), cleanFirestoreData(profile));
}

// ----------------- TRANSACTIONS -----------------
export async function addTransaction(transaction: Transaction): Promise<void> {
  // Offline or Demo handling
  if (getIsDemoMode() || !isOnline()) {
    demoStore.transactions.unshift(transaction);
    await enqueueSyncItem({
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: transaction.userId,
      operation: 'create',
      collection: 'transactions',
      docId: transaction.id,
      data: cleanFirestoreData(transaction),
      idempotencyKey: transaction.idempotencyKey || `tx_${transaction.id}`
    });
    return;
  }

  const txRef = doc(firestoreDb, 'transactions', transaction.id);
  await setDoc(txRef, cleanFirestoreData({
    ...transaction,
    updatedAt: serverTimestamp()
  }));
}

export async function deleteTransaction(id: string, userId: string): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    demoStore.transactions = demoStore.transactions.filter((t) => t.id !== id);
    await enqueueSyncItem({
      id: `sync_${Date.now()}`,
      userId,
      operation: 'delete',
      collection: 'transactions',
      docId: id,
      data: null,
      idempotencyKey: `del_tx_${id}`
    });
    return;
  }

  await deleteDoc(doc(firestoreDb, 'transactions', id));
}

// ----------------- INVOICES & PAYMENTS -----------------
export async function createInvoice(invoice: Invoice): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    demoStore.invoices.unshift(invoice);
    await enqueueSyncItem({
      id: `sync_${Date.now()}`,
      userId: invoice.userId,
      operation: 'create',
      collection: 'invoices',
      docId: invoice.id,
      data: cleanFirestoreData(invoice),
      idempotencyKey: `inv_${invoice.id}`
    });
    return;
  }

  await setDoc(doc(firestoreDb, 'invoices', invoice.id), cleanFirestoreData({
    ...invoice,
    updatedAt: serverTimestamp()
  }));
}

/**
 * Trusted Financial Operation:
 * Records an invoice payment idempotently.
 * 1. Checks that the idempotency key was not already processed.
 * 2. Updates the invoice paidAmount and status atomically.
 * 3. Creates the invoice_payments record.
 * 4. Creates a cash transaction (Income) record - recognizing cash only when paid!
 */
export async function recordInvoicePayment(payment: InvoicePayment): Promise<{
  success: boolean;
  message?: string;
}> {
  if (getIsDemoMode() || !isOnline()) {
    // Check duplicate idempotency key in demo
    const exists = demoStore.invoice_payments.some((p) => p.idempotencyKey === payment.idempotencyKey);
    if (exists) {
      return { success: false, message: 'Duplicate payment submission detected via idempotency key.' };
    }

    const invIndex = demoStore.invoices.findIndex((inv) => inv.id === payment.invoiceId);
    if (invIndex === -1) {
      return { success: false, message: 'Invoice not found.' };
    }

    const invoice = demoStore.invoices[invIndex];
    const newPaidAmount = Math.round((invoice.paidAmount + payment.amount) * 100) / 100;
    const newRemaining = Math.max(0, Math.round((invoice.totalAmount - newPaidAmount) * 100) / 100);
    const newStatus = determineInvoiceStatus(invoice.totalAmount, newPaidAmount, invoice.dueDate, invoice.status);

    demoStore.invoices[invIndex] = {
      ...invoice,
      paidAmount: newPaidAmount,
      remainingBalance: newRemaining,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    demoStore.invoice_payments.push(payment);

    // Create cash received transaction record
    const cashTx: Transaction = {
      id: `tx_inv_pay_${payment.id}`,
      userId: payment.userId,
      type: 'income',
      amount: payment.amount,
      category: 'Invoicing Revenue',
      account: payment.paymentMethod,
      date: payment.paymentDate,
      description: `Payment received for Invoice #${invoice.invoiceNumber} (${invoice.clientName})`,
      invoicePaymentId: payment.id,
      projectId: invoice.projectId,
      idempotencyKey: `cash_${payment.idempotencyKey}`,
      tags: ['invoice', 'cash-inflow'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    demoStore.transactions.unshift(cashTx);

    await enqueueSyncItem({
      id: `sync_${Date.now()}`,
      userId: payment.userId,
      operation: 'create',
      collection: 'invoice_payments',
      docId: payment.id,
      data: payment,
      idempotencyKey: payment.idempotencyKey
    });

    return { success: true };
  }

  // Live Cloud Firestore Atomic Transaction
  try {
    await runTransaction(firestoreDb, async (transaction) => {
      // Check for duplicate payment via idempotency key
      const payQuery = query(
        collection(firestoreDb, 'invoice_payments'),
        where('idempotencyKey', '==', payment.idempotencyKey)
      );
      const existingPayments = await getDocs(payQuery);
      if (!existingPayments.empty) {
        throw new Error('Duplicate payment submission detected via idempotency key.');
      }

      const invRef = doc(firestoreDb, 'invoices', payment.invoiceId);
      const invSnap = await transaction.get(invRef);

      if (!invSnap.exists()) {
        throw new Error('Invoice document does not exist.');
      }

      const invoice = invSnap.data() as Invoice;
      const newPaidAmount = Math.round((invoice.paidAmount + payment.amount) * 100) / 100;
      const newRemaining = Math.max(0, Math.round((invoice.totalAmount - newPaidAmount) * 100) / 100);
      const newStatus = determineInvoiceStatus(invoice.totalAmount, newPaidAmount, invoice.dueDate, invoice.status);

      // 1. Update Invoice
      transaction.update(invRef, {
        paidAmount: newPaidAmount,
        remainingBalance: newRemaining,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 2. Insert Invoice Payment
      const payRef = doc(firestoreDb, 'invoice_payments', payment.id);
      transaction.set(payRef, {
        ...payment,
        createdAt: serverTimestamp()
      });

      // 3. Insert Cash Income Transaction
      const cashTxRef = doc(firestoreDb, 'transactions', `tx_inv_pay_${payment.id}`);
      transaction.set(cashTxRef, {
        id: `tx_inv_pay_${payment.id}`,
        userId: payment.userId,
        type: 'income',
        amount: payment.amount,
        category: 'Invoicing Revenue',
        account: payment.paymentMethod,
        date: payment.paymentDate,
        description: `Payment received for Invoice #${invoice.invoiceNumber} (${invoice.clientName})`,
        invoicePaymentId: payment.id,
        projectId: invoice.projectId,
        idempotencyKey: `cash_${payment.idempotencyKey}`,
        tags: ['invoice', 'cash-inflow'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (err: any) {
    console.error('Invoice payment transaction failed:', err);
    return { success: false, message: err.message || 'Payment transaction failed' };
  }
}

// ----------------- LOANS & EMI REPAYMENTS -----------------
export async function createLoanWithAmortization(loan: Loan): Promise<void> {
  const schedule = generateAmortizationSchedule(
    loan.id,
    loan.userId,
    loan.principalAmount,
    loan.annualInterestRate,
    loan.tenureMonths,
    loan.startDate
  );

  if (getIsDemoMode() || !isOnline()) {
    demoStore.loans.unshift(loan);
    demoStore.loan_installments.push(...schedule);

    await enqueueSyncItem({
      id: `sync_${Date.now()}`,
      userId: loan.userId,
      operation: 'create',
      collection: 'loans',
      docId: loan.id,
      data: loan,
      idempotencyKey: `loan_${loan.id}`
    });
    return;
  }

  // Atomic batch write loan + all amortization schedule installments
  const batch = writeBatch(firestoreDb);
  const loanRef = doc(firestoreDb, 'loans', loan.id);
  batch.set(loanRef, {
    ...loan,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  for (const installment of schedule) {
    const instRef = doc(firestoreDb, 'loan_installments', installment.id);
    batch.set(instRef, installment);
  }

  await batch.commit();
}

/**
 * Deletes a Loan and all its associated amortization installments & payment records
 */
export async function deleteLoan(loanId: string, userId: string): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    demoStore.loans = (demoStore.loans || []).filter((l) => l.id !== loanId);
    demoStore.loan_installments = (demoStore.loan_installments || []).filter((i) => i.loanId !== loanId);
    demoStore.loan_payments = (demoStore.loan_payments || []).filter((p) => p.loanId !== loanId);
    await enqueueSyncItem({
      id: `sync_${Date.now()}`,
      userId,
      operation: 'delete',
      collection: 'loans',
      docId: loanId,
      data: null,
      idempotencyKey: `del_loan_${loanId}`
    });
    return;
  }

  // 1. Delete Loan document
  await deleteDoc(doc(firestoreDb, 'loans', loanId));

  // 2. Query and batch delete all installments for this loan
  try {
    const instQuery = query(collection(firestoreDb, 'loan_installments'), where('loanId', '==', loanId));
    const instSnaps = await getDocs(instQuery);
    if (!instSnaps.empty) {
      const batch = writeBatch(firestoreDb);
      instSnaps.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('Failed to delete associated installments for loan:', err);
  }

  // 3. Query and batch delete any payments for this loan
  try {
    const payQuery = query(collection(firestoreDb, 'loan_payments'), where('loanId', '==', loanId));
    const paySnaps = await getDocs(payQuery);
    if (!paySnaps.empty) {
      const batch = writeBatch(firestoreDb);
      paySnaps.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('Failed to delete associated payments for loan:', err);
  }
}

/**
 * Deletes an individual EMI installment from the schedule
 */
export async function deleteLoanInstallment(installmentId: string): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    demoStore.loan_installments = (demoStore.loan_installments || []).filter((i) => i.id !== installmentId);
    return;
  }

  await deleteDoc(doc(firestoreDb, 'loan_installments', installmentId));
}

/**
 * Reverts a Paid EMI installment back to Pending and restores remaining loan principal
 */
export async function revertLoanInstallmentPayment(
  installmentId: string,
  loanId: string,
  principalToRestore: number
): Promise<{ success: boolean; message?: string }> {
  if (getIsDemoMode() || !isOnline()) {
    const inst = (demoStore.loan_installments || []).find((i) => i.id === installmentId);
    if (inst) {
      inst.status = 'pending';
      delete inst.paidDate;
      delete inst.paymentId;
    }
    const loan = (demoStore.loans || []).find((l) => l.id === loanId);
    if (loan) {
      loan.remainingPrincipal = Math.min(
        loan.principalAmount,
        Math.round((loan.remainingPrincipal + principalToRestore) * 100) / 100
      );
      loan.status = 'active';
    }
    return { success: true };
  }

  try {
    await runTransaction(firestoreDb, async (transaction) => {
      const instRef = doc(firestoreDb, 'loan_installments', installmentId);
      const loanRef = doc(firestoreDb, 'loans', loanId);

      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) {
        throw new Error('Loan does not exist.');
      }

      const loanData = loanSnap.data() as Loan;
      const newPrincipal = Math.min(
        loanData.principalAmount,
        Math.round((loanData.remainingPrincipal + principalToRestore) * 100) / 100
      );

      transaction.update(loanRef, {
        remainingPrincipal: newPrincipal,
        status: 'active',
        updatedAt: serverTimestamp()
      });

      transaction.update(instRef, {
        status: 'pending',
        paidDate: null,
        paymentId: null
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to revert EMI payment.' };
  }
}

/**
 * Trusted Financial Operation:
 * Records an EMI payment idempotently:
 * 1. Checks duplicate idempotency key to prevent double EMI deduction.
 * 2. Marks the specific loan installment as 'paid'.
 * 3. Decrements remaining principal on the loan.
 * 4. Closes loan if remaining principal reaches 0.
 * 5. Creates separate transaction records for:
 *    - Interest Expense (tax deductible P&L expense)
 *    - Principal Repayment (balance sheet liability reduction)
 */
export async function recordLoanPayment(payment: LoanPayment): Promise<{
  success: boolean;
  message?: string;
}> {
  if (getIsDemoMode() || !isOnline()) {
    const exists = demoStore.loan_payments.some((p) => p.idempotencyKey === payment.idempotencyKey);
    if (exists) {
      return { success: false, message: 'Duplicate loan EMI payment detected via idempotency key.' };
    }

    const loanIndex = demoStore.loans.findIndex((l) => l.id === payment.loanId);
    if (loanIndex === -1) {
      return { success: false, message: 'Loan not found.' };
    }

    const loan = demoStore.loans[loanIndex];
    const newRemainingPrincipal = Math.max(
      0,
      Math.round((loan.remainingPrincipal - payment.principalPaid) * 100) / 100
    );
    const newStatus = newRemainingPrincipal <= 0 ? 'closed' : 'active';

    demoStore.loans[loanIndex] = {
      ...loan,
      remainingPrincipal: newRemainingPrincipal,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (payment.installmentId) {
      const instIndex = demoStore.loan_installments.findIndex((i) => i.id === payment.installmentId);
      if (instIndex >= 0) {
        demoStore.loan_installments[instIndex] = {
          ...demoStore.loan_installments[instIndex],
          status: 'paid',
          paidDate: payment.paymentDate,
          paymentId: payment.id
        };
      }
    }

    demoStore.loan_payments.push(payment);

    // Record separate interest expense
    if (payment.interestPaid > 0) {
      const interestTx: Transaction = {
        id: `tx_loan_int_${payment.id}`,
        userId: payment.userId,
        type: 'expense',
        amount: payment.interestPaid,
        category: 'Loan Interest',
        account: payment.paymentMethod,
        date: payment.paymentDate,
        description: `Interest charge on ${loan.title} (EMI #${payment.installmentNumber || ''})`,
        loanPaymentId: payment.id,
        idempotencyKey: `int_${payment.idempotencyKey}`,
        tags: ['loan', 'interest-expense'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      demoStore.transactions.unshift(interestTx);
    }

    // Record principal repayment
    if (payment.principalPaid > 0) {
      const principalTx: Transaction = {
        id: `tx_loan_prin_${payment.id}`,
        userId: payment.userId,
        type: 'expense',
        amount: payment.principalPaid,
        category: 'Debt Principal Repayment',
        account: payment.paymentMethod,
        date: payment.paymentDate,
        description: `Principal reduction on ${loan.title} (EMI #${payment.installmentNumber || ''})`,
        loanPaymentId: payment.id,
        idempotencyKey: `prin_${payment.idempotencyKey}`,
        tags: ['loan', 'principal-reduction'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      demoStore.transactions.unshift(principalTx);
    }

    await enqueueSyncItem({
      id: `sync_${Date.now()}`,
      userId: payment.userId,
      operation: 'create',
      collection: 'loan_payments',
      docId: payment.id,
      data: payment,
      idempotencyKey: payment.idempotencyKey
    });

    return { success: true };
  }

  // Live Cloud Firestore Atomic Transaction
  try {
    await runTransaction(firestoreDb, async (transaction) => {
      // 1. Idempotency Check
      const payQuery = query(
        collection(firestoreDb, 'loan_payments'),
        where('idempotencyKey', '==', payment.idempotencyKey)
      );
      const existing = await getDocs(payQuery);
      if (!existing.empty) {
        throw new Error('Duplicate loan payment submission detected.');
      }

      const loanRef = doc(firestoreDb, 'loans', payment.loanId);
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) {
        throw new Error('Loan does not exist.');
      }

      const loan = loanSnap.data() as Loan;
      const newRemainingPrincipal = Math.max(
        0,
        Math.round((loan.remainingPrincipal - payment.principalPaid) * 100) / 100
      );
      const newStatus = newRemainingPrincipal <= 0 ? 'closed' : 'active';

      // 2. Update Loan
      transaction.update(loanRef, {
        remainingPrincipal: newRemainingPrincipal,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 3. Update Installment if specified
      if (payment.installmentId) {
        const instRef = doc(firestoreDb, 'loan_installments', payment.installmentId);
        transaction.update(instRef, {
          status: 'paid',
          paidDate: payment.paymentDate,
          paymentId: payment.id
        });
      }

      // 4. Save Payment Record
      const paymentRef = doc(firestoreDb, 'loan_payments', payment.id);
      transaction.set(paymentRef, {
        ...payment,
        createdAt: serverTimestamp()
      });

      // 5. Save Interest expense transaction
      if (payment.interestPaid > 0) {
        const intRef = doc(firestoreDb, 'transactions', `tx_loan_int_${payment.id}`);
        transaction.set(intRef, {
          id: `tx_loan_int_${payment.id}`,
          userId: payment.userId,
          type: 'expense',
          amount: payment.interestPaid,
          category: 'Loan Interest',
          account: payment.paymentMethod,
          date: payment.paymentDate,
          description: `Interest charge on ${loan.title} (EMI #${payment.installmentNumber || ''})`,
          loanPaymentId: payment.id,
          idempotencyKey: `int_${payment.idempotencyKey}`,
          tags: ['loan', 'interest-expense'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 6. Save Principal reduction transaction
      if (payment.principalPaid > 0) {
        const prinRef = doc(firestoreDb, 'transactions', `tx_loan_prin_${payment.id}`);
        transaction.set(prinRef, {
          id: `tx_loan_prin_${payment.id}`,
          userId: payment.userId,
          type: 'expense',
          amount: payment.principalPaid,
          category: 'Debt Principal Repayment',
          account: payment.paymentMethod,
          date: payment.paymentDate,
          description: `Principal reduction on ${loan.title} (EMI #${payment.installmentNumber || ''})`,
          loanPaymentId: payment.id,
          idempotencyKey: `prin_${payment.idempotencyKey}`,
          tags: ['loan', 'principal-reduction'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error('Loan repayment transaction failed:', err);
    return { success: false, message: err.message || 'Loan repayment failed' };
  }
}

// ----------------- PROJECTS, BUDGETS, SAVINGS GOALS, RECURRING -----------------
export async function saveProject(project: Project): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    demoStore.projects.unshift(project);
    return;
  }
  await setDoc(doc(firestoreDb, 'projects', project.id), cleanFirestoreData(project));
}

export async function saveBudget(budget: Budget): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    const idx = demoStore.budgets.findIndex((b) => b.id === budget.id);
    if (idx >= 0) demoStore.budgets[idx] = budget;
    else demoStore.budgets.push(budget);
    return;
  }
  await setDoc(doc(firestoreDb, 'budgets', budget.id), cleanFirestoreData(budget));
}

export async function saveSavingsGoal(goal: SavingsGoal): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    const idx = demoStore.savings_goals.findIndex((g) => g.id === goal.id);
    if (idx >= 0) demoStore.savings_goals[idx] = goal;
    else demoStore.savings_goals.push(goal);
    return;
  }
  await setDoc(doc(firestoreDb, 'savings_goals', goal.id), cleanFirestoreData(goal));
}

export async function saveRecurringTransaction(rec: RecurringTransaction): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    const idx = demoStore.recurring_transactions.findIndex((r) => r.id === rec.id);
    if (idx >= 0) demoStore.recurring_transactions[idx] = rec;
    else demoStore.recurring_transactions.push(rec);
    return;
  }
  await setDoc(doc(firestoreDb, 'recurring_transactions', rec.id), cleanFirestoreData(rec));
}

export async function deleteRecurringTransaction(recId: string): Promise<void> {
  if (getIsDemoMode() || !isOnline()) {
    demoStore.recurring_transactions = (demoStore.recurring_transactions || []).filter((r) => r.id !== recId);
    return;
  }
  await deleteDoc(doc(firestoreDb, 'recurring_transactions', recId));
}
