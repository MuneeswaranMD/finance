import { describe, it, expect } from 'vitest';
import { BankEmailParser } from '../services/bankEmailParser';

describe('Bank Email Parsing Engine', () => {
  it('parses the example prompt subject: "INR 300.00 was debited from your A/c no. XX5204."', () => {
    const subject = 'INR 300.00 was debited from your A/c no. XX5204.';
    const result = BankEmailParser.parse(subject, '');

    expect(result.amount).toBe(300);
    expect(result.currency).toBe('INR');
    expect(result.direction).toBe('debit');
    expect(result.accountMasked).toBe('XX5204');
    expect(result.parserUsed).toBe('HDFC Bank');
  });

  it('recognizes and classifies Loan EMI repayments (Never assuming every debit is a purchase)', () => {
    const subject = 'INR 25,000.00 was debited from your A/c no. XX5204 towards HDFC Housing Loan EMI installment';
    const result = BankEmailParser.parse(subject);

    expect(result.amount).toBe(25000);
    expect(result.direction).toBe('debit');
    expect(result.classification).toBe('loan_emi');
    expect(result.suggestedCategory).toBe('Loan Repayment');
    expect(result.confidenceLevel).toBe('high');
  });

  it('recognizes Credit Card bill settlements', () => {
    const subject = 'INR 12,450.00 debited from A/c XX5204 to BILLDESK CC SBI Card payment';
    const result = BankEmailParser.parse(subject);

    expect(result.amount).toBe(12450);
    expect(result.direction).toBe('debit');
    expect(result.classification).toBe('credit_card_bill');
    expect(result.suggestedCategory).toBe('Credit Card Bill');
  });

  it('extracts UPI references, amounts, and auto-suggests food category for Zomato/Swiggy', () => {
    const email = 'Dear SBI UPI User, A/c 5204 debited by 485.50 on 24Oct26 transfer to Zomato Ref No 429381928391';
    const result = BankEmailParser.parse(email);

    expect(result.amount).toBe(485.5);
    expect(result.accountMasked).toBe('5204');
    expect(result.referenceNumber).toBe('429381928391');
    expect(result.classification).toBe('purchase');
    expect(result.suggestedCategory).toBe('Dining & Food');
    expect(result.paymentMethod).toBe('UPI');
    expect(result.confidenceLevel).toBe('high');
  });

  it('classifies bank maintenance charges, annual fees, and SMS charges as fee', () => {
    const subject = 'INR 177.00 was debited from your A/c no. XX5204 towards Annual SMS charges and maintenance fee';
    const result = BankEmailParser.parse(subject);

    expect(result.amount).toBe(177);
    expect(result.classification).toBe('fee');
    expect(result.suggestedCategory).toBe('Bank Charges & Fees');
  });

  it('handles safe fallback parsing for non-standard bank alert formats with rupee symbol', () => {
    const text = 'Alert: ₹1,500.00 spent on your card ending with 9812 at Blinkit Daily Groceries UTR: 98127391823';
    const result = BankEmailParser.parse(text);

    expect(result.amount).toBe(1500);
    expect(result.currency).toBe('INR');
    expect(result.direction).toBe('debit');
    expect(result.suggestedCategory).toBe('Groceries');
    expect(result.referenceNumber).toBe('98127391823');
  });

  it('flags unclassified/ambiguous debits as uncertain with reduced confidence for user review', () => {
    const vagueDebit = 'INR 500.00 was debited from your A/c no. XX5204.';
    const result = BankEmailParser.parse(vagueDebit);

    // Because there is no merchant or purpose specified, it flags uncertain to prompt confirmation
    expect(result.classification).toBe('uncertain');
    expect(result.suggestedCategory).toBe('Unclassified Debit');
    expect(result.confidenceLevel).not.toBe('high');
  });
});
