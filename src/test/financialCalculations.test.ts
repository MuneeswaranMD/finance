import { describe, it, expect } from 'vitest';
import {
  calculateEMI,
  generateAmortizationSchedule,
  calculateInvoiceTotals,
  determineInvoiceStatus,
  formatINR,
  generateIdempotencyKey
} from '../services/financialCalculations';
import { InvoiceItem } from '../types/finance';

describe('Financial Calculations Engine', () => {
  describe('EMI & Reducing Balance Calculations', () => {
    it('calculates accurate EMI for ₹1,00,000 at 12% annual interest for 12 months', () => {
      const emi = calculateEMI(100000, 12, 12);
      // Standard financial formula: 100000 * 0.01 * (1.01^12) / (1.01^12 - 1) = ~8884.88
      expect(emi).toBe(8884.88);
    });

    it('calculates zero interest loan as equal parts', () => {
      const emi = calculateEMI(120000, 0, 12);
      expect(emi).toBe(10000);
    });

    it('handles edge cases with 0 principal or tenure', () => {
      expect(calculateEMI(0, 10, 12)).toBe(0);
      expect(calculateEMI(50000, 10, 0)).toBe(0);
    });

    it('generates an exact amortization schedule with principal and interest components', () => {
      const principal = 100000;
      const rate = 12;
      const tenure = 12;
      const schedule = generateAmortizationSchedule('loan_1', 'user_1', principal, rate, tenure, '2026-01-01');

      expect(schedule.length).toBe(12);

      // Verify each installment has required components
      let totalPrincipalPaid = 0;
      let totalInterestPaid = 0;

      schedule.forEach((inst, idx) => {
        expect(inst.installmentNumber).toBe(idx + 1);
        expect(inst.principalComponent).toBeGreaterThan(0);
        expect(inst.interestComponent).toBeGreaterThanOrEqual(0);
        expect(inst.totalEMI).toBeCloseTo(inst.principalComponent + inst.interestComponent, 2);
        totalPrincipalPaid += inst.principalComponent;
        totalInterestPaid += inst.interestComponent;
      });

      // Crucial Financial Invariant: Sum of principal components MUST equal original principal
      expect(Math.round(totalPrincipalPaid)).toBe(principal);
      // Final remaining balance MUST be 0
      expect(schedule[schedule.length - 1].remainingBalanceAfter).toBe(0);
    });
  });

  describe('Invoice Calculations & Accrual Rules', () => {
    it('calculates subtotal, GST, and total accurately across line items', () => {
      const items: InvoiceItem[] = [
        {
          id: 'item_1',
          description: 'Web App Development',
          quantity: 2,
          unitPrice: 25000,
          gstRate: 18,
          total: 59000 // 50000 + 18% = 59000
        },
        {
          id: 'item_2',
          description: 'Cloud Server Setup',
          quantity: 1,
          unitPrice: 10000,
          gstRate: 18,
          total: 11800 // 10000 + 18% = 11800
        }
      ];

      const { subtotal, taxAmount, totalAmount } = calculateInvoiceTotals(items);
      expect(subtotal).toBe(60000); // 50000 + 10000
      expect(taxAmount).toBe(10800); // 18% of 60000
      expect(totalAmount).toBe(70800); // 60000 + 10800
    });

    it('accurately updates invoice status based on payment state', () => {
      const total = 50000;
      const futureDate = '2099-12-31';
      const pastDate = '2020-01-01';

      expect(determineInvoiceStatus(total, 0, futureDate, 'sent')).toBe('sent');
      expect(determineInvoiceStatus(total, 0, pastDate, 'sent')).toBe('overdue');
      expect(determineInvoiceStatus(total, 20000, futureDate, 'sent')).toBe('partially_paid');
      expect(determineInvoiceStatus(total, 50000, futureDate, 'sent')).toBe('paid');
      expect(determineInvoiceStatus(total, 60000, futureDate, 'sent')).toBe('paid');
      expect(determineInvoiceStatus(total, 0, futureDate, 'draft')).toBe('draft');
      expect(determineInvoiceStatus(total, 0, futureDate, 'cancelled')).toBe('cancelled');
    });
  });

  describe('Indian Rupee (INR) Formatting', () => {
    it('formats values in Indian numbering system with Lakhs and Crores', () => {
      expect(formatINR(1000)).toBe('₹1,000.00');
      expect(formatINR(100000)).toBe('₹1,00,000.00');
      expect(formatINR(1234567.89)).toBe('₹12,34,567.89');
      expect(formatINR(10000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    });

    it('formats negative balances and zeros properly', () => {
      expect(formatINR(0)).toBe('₹0.00');
      expect(formatINR(-5432.1)).toBe('-₹5,432.10');
    });
  });

  describe('Idempotency Key Integrity', () => {
    it('generates consistent, collision-resistant keys for duplicate prevention', () => {
      const key1 = generateIdempotencyKey('inv_pay', 'inv_101', 5000.5, 1700000000);
      const key2 = generateIdempotencyKey('inv_pay', 'inv_101', 5000.5, 1700000000);
      const key3 = generateIdempotencyKey('inv_pay', 'inv_101', 5000.5, 1700000001);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toContain('inv_pay_inv_101_500050');
    });
  });
});
