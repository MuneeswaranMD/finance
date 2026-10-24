import { InvoiceItem, LoanInstallment } from '../types/finance';

/**
 * Standard Reducing Balance EMI Calculation formula:
 * E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * where:
 * P = Principal amount
 * r = Monthly interest rate (annual rate / 12 / 100)
 * n = Tenure in months
 */
export function calculateEMI(principal: number, annualInterestRatePct: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualInterestRatePct <= 0) {
    return Math.round((principal / tenureMonths) * 100) / 100;
  }

  const monthlyRate = annualInterestRatePct / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);

  return Math.round(emi * 100) / 100;
}

/**
 * Generates exact monthly amortization schedule splitting each EMI
 * into principal component and interest component.
 */
export function generateAmortizationSchedule(
  loanId: string,
  userId: string,
  principal: number,
  annualInterestRatePct: number,
  tenureMonths: number,
  startDateStr: string
): LoanInstallment[] {
  const schedule: LoanInstallment[] = [];
  const monthlyRate = annualInterestRatePct > 0 ? annualInterestRatePct / 12 / 100 : 0;
  const emi = calculateEMI(principal, annualInterestRatePct, tenureMonths);

  let currentBalance = principal;
  const baseDate = new Date(startDateStr);

  for (let i = 1; i <= tenureMonths; i++) {
    const dueDate = new Date(baseDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    let interestComponent = Math.round(currentBalance * monthlyRate * 100) / 100;
    let principalComponent = Math.round((emi - interestComponent) * 100) / 100;

    // Last installment adjustment to handle fractional rounding
    if (i === tenureMonths || principalComponent > currentBalance) {
      principalComponent = Math.round(currentBalance * 100) / 100;
      interestComponent = Math.round((emi - principalComponent) * 100) / 100;
      if (interestComponent < 0) interestComponent = 0;
    }

    const remainingBalanceAfter = Math.max(0, Math.round((currentBalance - principalComponent) * 100) / 100);
    const totalInstallment = Math.round((principalComponent + interestComponent) * 100) / 100;

    schedule.push({
      id: `${loanId}_inst_${i}`,
      userId,
      loanId,
      installmentNumber: i,
      dueDate: dueDateStr,
      principalComponent,
      interestComponent,
      totalEMI: totalInstallment,
      remainingBalanceAfter,
      status: 'pending'
    });

    currentBalance = remainingBalanceAfter;
  }

  return schedule;
}

/**
 * Calculates Subtotal, Tax and Total for Invoice line items
 */
export function calculateInvoiceTotals(items: InvoiceItem[]): {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const lineSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const lineTax = Math.round((lineSubtotal * (item.gstRate || 0)) / 100 * 100) / 100;
    subtotal += lineSubtotal;
    taxAmount += lineTax;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  return { subtotal, taxAmount, totalAmount };
}

/**
 * Determines invoice status based on total and paid amount
 */
export function determineInvoiceStatus(
  totalAmount: number,
  paidAmount: number,
  dueDate: string,
  currentStatus: string
): 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (currentStatus === 'draft') return 'draft';

  const remaining = Math.round((totalAmount - paidAmount) * 100) / 100;
  if (remaining <= 0) return 'paid';
  if (paidAmount > 0 && remaining > 0) return 'partially_paid';

  const today = new Date().toISOString().split('T')[0];
  if (dueDate < today) return 'overdue';

  return 'sent';
}

/**
 * Formats numbers in Indian Rupee format (e.g. ₹ 1,23,456.78)
 */
export function formatINR(value: number, includeDecimals = true): string {
  if (typeof value !== 'number' || isNaN(value)) return '₹0.00';

  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const parts = absVal.toFixed(2).split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Indian numbering: last 3 digits, then groups of 2
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = includeDecimals ? `${formattedInt}.${decPart}` : formattedInt;
  return `${isNegative ? '-' : ''}₹${result}`;
}

/**
 * Generates a unique, deterministic idempotency key for financial operations
 */
export function generateIdempotencyKey(prefix: string, entityId: string, amount: number, timestamp: number): string {
  return `${prefix}_${entityId}_${Math.round(amount * 100)}_${timestamp}`;
}
