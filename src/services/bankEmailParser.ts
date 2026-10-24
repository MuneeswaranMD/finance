import {
  BankEmailParseResult,
  ConfidenceLevel,
  TransactionClassification
} from '../types/finance';

interface ParserRule {
  bankName: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray, text: string) => Partial<BankEmailParseResult>;
}

// Merchant pattern dictionary for accurate categorization
const MERCHANT_CATEGORY_MAP: Array<{ pattern: RegExp; category: string; method?: string }> = [
  // Food & Dining
  { pattern: /zomato|swiggy|mcdonald|starbucks|domino|kfc|burger king|cafe|restaurant|eats/i, category: 'Dining & Food' },
  // Groceries & Essentials
  { pattern: /blinkit|zepto|instamart|bigbasket|dmart|supermarket|grocery|nature basket|milk|vegetable/i, category: 'Groceries' },
  // Commute & Travel
  { pattern: /uber|ola|rapido|irctc|makemytrip|goibibo|indigo|air india|petrol|fuel|indianoil|bharat petroleum|hpcl|shell/i, category: 'Travel & Commute' },
  // Utilities & Bills
  { pattern: /airtel|jio|vodafone|vi|bescom|tata power|electricity|gas|water|broadband|act fibernet/i, category: 'Utilities & Bills' },
  // Tech & Subscriptions
  { pattern: /netflix|spotify|amazon prime|hotstar|apple|google play|youtube|chatgpt|openai|github|aws/i, category: 'Tech & Subscriptions' },
  // Shopping
  { pattern: /amazon|flipkart|myntra|ajio|tata cliq|zara|h&m|decathlon|croma|reliance digital/i, category: 'Shopping' },
  // Healthcare
  { pattern: /apollo|pharmeasy|1mg|netmeds|hospital|clinic|pharmacy|medplus|pathology|diagnostics/i, category: 'Healthcare' }
];

export class BankEmailParser {
  private static parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/,/g, '').trim();
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }

  private static formatDate(dateStr?: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      // Fallback below
    }
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Deterministic Bank Specific Parsers
   */
  private static specificParsers: ParserRule[] = [
    // 1. HDFC Bank
    {
      bankName: 'HDFC Bank',
      // Handles: "INR 300.00 was debited from your A/c no. XX5204." or with VPA
      pattern: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:was|has been)?\s*debited from (?:your )?A\/c (?:no\.? )?([X\*\d]+)/i,
      extract: (match, text) => {
        const amount = BankEmailParser.parseAmount(match[1]);
        const account = match[2];

        // Extract VPA/merchant if available
        const vpaMatch = text.match(/(?:to\s*VPA|towards\s*VPA|to|towards)\s+([A-Za-z0-9.\-_@]+)/i);
        const refMatch = text.match(/(?:UPI Ref(?:\s*No)?|Ref(?:\s*No)?|UTR)\s*[:#\-]?\s*([A-Za-z0-9]+)/i);

        return {
          amount,
          direction: 'debit',
          accountMasked: account,
          merchantOrDescription: vpaMatch ? vpaMatch[1] : 'HDFC Bank Debit',
          referenceNumber: refMatch ? refMatch[1] : undefined,
          paymentMethod: vpaMatch ? 'UPI' : 'Bank Account'
        };
      }
    },

    // 2. State Bank of India (SBI)
    {
      bankName: 'SBI',
      // Handles: "Dear SBI UPI User, A/c 5204 debited by 300.00 on 24Oct26 transfer to XYZ Ref No 429381928391"
      pattern: /A\/c\s*([X\*\d]+)\s*(?:is )?debited by\s*(?:INR|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)(?:\s*on\s*([^\s]+))?\s*transfer to\s*(.*?)(?:\s+Ref(?:\s*No\.?)?[:\s]+([A-Za-z0-9]+)|$|\.)/i,
      extract: (match, text) => {
        const account = match[1];
        const amount = BankEmailParser.parseAmount(match[2]);
        const dateStr = match[3];
        let merchant = match[4]?.trim() || 'SBI UPI Transfer';
        let ref = match[5]?.trim();
        if (!ref) {
          const fallbackRef = text.match(/Ref(?:\s*No\.?)?[:\s]+([A-Za-z0-9]+)/i);
          if (fallbackRef) ref = fallbackRef[1];
        }

        return {
          amount,
          direction: 'debit',
          accountMasked: account,
          merchantOrDescription: merchant,
          transactionDate: BankEmailParser.formatDate(dateStr),
          referenceNumber: ref,
          paymentMethod: 'UPI'
        };
      }
    },

    // 3. ICICI Bank
    {
      bankName: 'ICICI Bank',
      // Handles: "Dear Customer, your Ac XX5204 is debited for INR 300.00 on 24-Oct-26. Info: UPI:429381928391:Zomato."
      pattern: /Ac\s*([X\*\d]+)\s*is debited for\s*(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)(?:\s*on\s*([^.]+))?\.\s*Info:\s*([^.]+)/i,
      extract: (match) => {
        const account = match[1];
        const amount = BankEmailParser.parseAmount(match[2]);
        const dateStr = match[3];
        const info = match[4]?.trim() || '';

        const refMatch = info.match(/(?:UPI|NEFT|IMPS)[:\s]*([A-Za-z0-9]+)/i);
        return {
          amount,
          direction: 'debit',
          accountMasked: account,
          merchantOrDescription: info || 'ICICI Bank Debit',
          transactionDate: BankEmailParser.formatDate(dateStr),
          referenceNumber: refMatch ? refMatch[1] : undefined,
          paymentMethod: info.toLowerCase().includes('upi') ? 'UPI' : 'Bank Account'
        };
      }
    },

    // 4. Axis Bank
    {
      bankName: 'Axis Bank',
      pattern: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*debited from A\/c no\.?\s*([X\*\d]+)(?:\s*on\s*([^.]+))?(?:\s*Info:\s*([^.]+))?/i,
      extract: (match) => {
        const amount = BankEmailParser.parseAmount(match[1]);
        const account = match[2];
        const dateStr = match[3];
        const info = match[4]?.trim() || 'Axis Bank Debit';
        const refMatch = info.match(/(?:UPI|Ref|UTR)[/:\s]*([A-Za-z0-9]+)/i);

        return {
          amount,
          direction: 'debit',
          accountMasked: account,
          merchantOrDescription: info,
          transactionDate: BankEmailParser.formatDate(dateStr),
          referenceNumber: refMatch ? refMatch[1] : undefined,
          paymentMethod: info.toLowerCase().includes('upi') ? 'UPI' : 'Bank Account'
        };
      }
    },

    // 5. Generic Credited Pattern
    {
      bankName: 'Generic Bank (Credit)',
      pattern: /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:was|has been)?\s*credited to (?:your )?A\/c (?:no\.? )?([X\*\d]+)/i,
      extract: (match) => ({
        amount: BankEmailParser.parseAmount(match[1]),
        direction: 'credit',
        accountMasked: match[2],
        merchantOrDescription: 'Bank Account Credit',
        paymentMethod: 'Bank Transfer'
      })
    }
  ];

  /**
   * Safe Fallback Parser when specific bank patterns do not match cleanly
   */
  private static parseWithFallback(text: string): Partial<BankEmailParseResult> {
    // 1. Amount
    const amountMatch = text.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                        text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?|₹)/i);
    const amount = amountMatch ? BankEmailParser.parseAmount(amountMatch[1]) : 0;

    // 2. Direction
    let direction: 'debit' | 'credit' = 'debit';
    if (/credited|received|deposit|refund/i.test(text) && !/debited/i.test(text)) {
      direction = 'credit';
    }

    // 3. Masked account
    const accMatch = text.match(/(?:A\/c(?:\s*no\.?)?|account|card)\s*(?:ending\s*(?:with|in)\s*)?[:\s]*([X\*\d]{3,12})/i);
    const accountMasked = accMatch ? accMatch[1] : 'XX0000';

    // 4. Reference number
    const refMatch = text.match(/(?:UPI(?:\s*Ref(?:\s*No\.?)?|\/)|Ref\s*(?:No\.?)?|UTR(?:\s*No\.?)?|Txn(?:\s*ID)?)\s*[:#\-]?\s*([A-Za-z0-9]{8,22})/i);
    const referenceNumber = refMatch ? refMatch[1] : undefined;

    // 5. Merchant extraction snippet
    const merchantMatch = text.match(/(?:to|towards|at|paid to)\s+([A-Za-z0-9.\-_@ ]{3,35})(?:\s*on|\s*Ref|\s*via|\.|$)/i);
    const merchantOrDescription = merchantMatch ? merchantMatch[1].trim() : (direction === 'credit' ? 'Credit Inflow' : 'Bank Debit');

    return {
      amount,
      direction,
      accountMasked,
      merchantOrDescription,
      referenceNumber,
      paymentMethod: referenceNumber || text.toLowerCase().includes('upi') ? 'UPI' : 'Bank Account'
    };
  }

  /**
   * Financial Classifier: Never assumes every debit is a purchase!
   * Classifies transactions into:
   * - 'purchase' (Merchant spending)
   * - 'loan_emi' (Loan installment / EMI / Auto debit)
   * - 'credit_card_bill' (Card payments)
   * - 'transfer' (Account transfer / self sweep)
   * - 'refund' (Reversals / refunds)
   * - 'fee' (Bank service charges / annual fee / SMS charge)
   * - 'uncertain' (Requires user review)
   */
  public static classifyTransaction(
    direction: 'debit' | 'credit',
    description: string,
    text: string
  ): {
    classification: TransactionClassification;
    category: string;
    confidenceDelta: number;
  } {
    const combined = `${description} ${text}`.toLowerCase();

    // 1. Credit Card Bill Payment
    if (/credit\s*card|cc\s*bill|billdesk\s*cc|sbi\s*card|hdfc\s*card|icici\s*card|cred\s*cc/i.test(combined)) {
      return {
        classification: 'credit_card_bill',
        category: 'Credit Card Bill',
        confidenceDelta: 0.15
      };
    }

    // 2. Loan EMI Repayment (Vital distinction from purchases)
    if (/\bemi\b|loan\s*installment|loan\s*repayment|housing\s*loan|car\s*loan|personal\s*loan|bajaj\s*finance|nach\s*debit|ecs\s*debit/i.test(combined)) {
      return {
        classification: 'loan_emi',
        category: 'Loan Repayment',
        confidenceDelta: 0.2
      };
    }

    // 3. Bank Charges & Fees
    if (/annual\s*fee|maintenance\s*charge|sms\s*charge|penal\s*interest|gst\s*on\s*charges|debit\s*card\s*fee/i.test(combined)) {
      return {
        classification: 'fee',
        category: 'Bank Charges & Fees',
        confidenceDelta: 0.15
      };
    }

    // 4. Account Transfers / Self Sweep
    if (/transfer\s*to\s*own|self\s*transfer|neft\s*to\s*self|imps\s*to\s*self|sweep\s*in|sweep\s*out|fd\s*booking/i.test(combined)) {
      return {
        classification: 'transfer',
        category: 'Account Transfer',
        confidenceDelta: 0.1
      };
    }

    // 5. Refunds & Reversals
    if (/refund|reversal|chargeback|credited\s*back|cashback/i.test(combined)) {
      return {
        classification: 'refund',
        category: 'Refund / Reversal',
        confidenceDelta: 0.15
      };
    }

    // 6. Known Merchant Purchases
    for (const item of MERCHANT_CATEGORY_MAP) {
      if (item.pattern.test(combined)) {
        return {
          classification: 'purchase',
          category: item.category,
          confidenceDelta: 0.2
        };
      }
    }

    // 7. General Salary / Income if Credit
    if (direction === 'credit') {
      if (/salary|payroll|wages/i.test(combined)) {
        return {
          classification: 'purchase',
          category: 'Salary',
          confidenceDelta: 0.2
        };
      }
      return {
        classification: 'purchase',
        category: 'Other Income',
        confidenceDelta: 0.05
      };
    }

    // 8. Uncertain Debit (Safe guard against false classification)
    return {
      classification: 'uncertain',
      category: 'Unclassified Debit',
      confidenceDelta: -0.25
    };
  }

  /**
   * Main Parsing Entrypoint
   * Takes an email subject and body snippet, applies parsers, classifies the operation,
   * computes confidence score, and returns standardized BankEmailParseResult.
   */
  public static parse(subject: string, bodySnippet: string = ''): BankEmailParseResult {
    const fullText = `${subject} ${bodySnippet}`.trim();
    let partialResult: Partial<BankEmailParseResult> = {};
    let parserUsed = 'Fallback Parser';
    let baseConfidence = 0.65;

    // 1. Try specific bank rules first
    for (const parser of BankEmailParser.specificParsers) {
      const match = fullText.match(parser.pattern);
      if (match) {
        partialResult = parser.extract(match, fullText);
        parserUsed = parser.bankName;
        baseConfidence = 0.85; // Deterministic bank pattern match
        break;
      }
    }

    // 2. If no specific bank match, use safe fallback extraction
    if (!partialResult.amount || partialResult.amount <= 0) {
      partialResult = BankEmailParser.parseWithFallback(fullText);
    }

    const amount = partialResult.amount || 0;
    const direction = partialResult.direction || 'debit';
    const accountMasked = partialResult.accountMasked || 'XX5204';
    const merchantOrDescription = partialResult.merchantOrDescription || (direction === 'credit' ? 'Credit Received' : 'Bank Debit');
    const referenceNumber = partialResult.referenceNumber;
    const paymentMethod = partialResult.paymentMethod || 'Bank Account';
    const transactionDate = partialResult.transactionDate || new Date().toISOString().split('T')[0];

    // 3. Classify transaction and assign category
    const { classification, category, confidenceDelta } = BankEmailParser.classifyTransaction(
      direction,
      merchantOrDescription,
      fullText
    );

    // Compute Confidence
    let confidence = baseConfidence + confidenceDelta;
    if (referenceNumber) confidence += 0.05;
    if (amount > 0) confidence += 0.05;
    if (accountMasked !== 'XX0000') confidence += 0.05;

    // Cap confidence between 0.1 and 0.99
    confidence = Math.min(0.99, Math.max(0.1, Math.round(confidence * 100) / 100));

    let confidenceLevel: ConfidenceLevel = 'low';
    if (confidence >= 0.85 && classification !== 'uncertain') {
      confidenceLevel = 'high';
    } else if (confidence >= 0.70) {
      confidenceLevel = 'medium';
    }

    return {
      amount,
      currency: 'INR',
      direction,
      accountMasked,
      merchantOrDescription,
      transactionDate,
      referenceNumber,
      paymentMethod,
      suggestedCategory: category,
      classification,
      confidence,
      confidenceLevel,
      parserUsed,
      rawSubject: subject,
      rawSnippet: bodySnippet
    };
  }
}
