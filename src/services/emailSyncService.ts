import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions, getIsDemoMode } from './firebaseConfig';
import { ParsedEmailDoc, EmailSyncSettings } from '../types/finance';
import { BankEmailParser } from './bankEmailParser';
import { addTransaction, cleanFirestoreData } from './firestoreService';

// Default initial settings
export const DEFAULT_EMAIL_SETTINGS: EmailSyncSettings = {
  userId: 'demo_user',
  autoPostTrusted: false, // Safe default: requires review until enabled
  minConfidenceToAutoPost: 0.85,
  connectedEmail: 'user.finance@gmail.com',
  syncedEmailCount: 3
};

// In-memory demo store for parsed emails
let demoParsedEmails: ParsedEmailDoc[] = [
  {
    id: 'email_msg_101',
    userId: 'demo_user',
    gmailMessageId: 'msg_101',
    gmailAccountId: 'user.finance@gmail.com',
    subject: 'INR 300.00 was debited from your A/c no. XX5204.',
    from: 'alerts@hdfcbank.net',
    date: new Date().toISOString(),
    snippet: 'INR 300.00 was debited from your A/c no. XX5204 on 24-Oct-26.',
    parseResult: BankEmailParser.parse('INR 300.00 was debited from your A/c no. XX5204.', ''),
    status: 'pending_review',
    auditLog: [
      {
        action: 'parsed_from_email',
        timestamp: new Date().toISOString(),
        details: 'Parsed via HDFC Bank rule with 0.85 confidence. Unclassified merchant requires review.'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'email_msg_102',
    userId: 'demo_user',
    gmailMessageId: 'msg_102',
    gmailAccountId: 'user.finance@gmail.com',
    subject: 'Dear SBI UPI User, A/c 5204 debited by 485.00 on 24Oct26 transfer to Swiggy Ref No 429381928391',
    from: 'sbi.upi@sbi.co.in',
    date: new Date().toISOString(),
    snippet: 'A/c 5204 debited by 485.00 transfer to Swiggy Ref No 429381928391',
    parseResult: BankEmailParser.parse(
      'Dear SBI UPI User, A/c 5204 debited by 485.00 on 24Oct26 transfer to Swiggy Ref No 429381928391',
      ''
    ),
    status: 'pending_review',
    auditLog: [
      {
        action: 'parsed_from_email',
        timestamp: new Date().toISOString(),
        details: 'High confidence match. Pending approval.'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'email_msg_103',
    userId: 'demo_user',
    gmailMessageId: 'msg_103',
    gmailAccountId: 'user.finance@gmail.com',
    subject: 'INR 25,000.00 debited from A/c XX5204 towards HDFC Housing Loan EMI installment',
    from: 'loans@hdfcbank.net',
    date: new Date().toISOString(),
    snippet: 'Monthly loan EMI auto-debit ECS Ref #EMI9827361',
    parseResult: BankEmailParser.parse(
      'INR 25,000.00 debited from A/c XX5204 towards HDFC Housing Loan EMI installment',
      'Monthly loan EMI auto-debit ECS Ref #EMI9827361'
    ),
    status: 'pending_review',
    auditLog: [
      {
        action: 'parsed_from_email',
        timestamp: new Date().toISOString(),
        details: 'Detected Loan EMI repayment. Excluded from generic purchases.'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export async function getEmailSyncSettings(userId: string): Promise<EmailSyncSettings> {
  if (getIsDemoMode()) {
    return { ...DEFAULT_EMAIL_SETTINGS, userId };
  }

  try {
    const docRef = doc(firestoreDb, 'users', userId, 'settings', 'email_sync');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as EmailSyncSettings;
    }
  } catch (e) {
    console.warn('Failed to load email settings from firestore:', e);
  }

  return { ...DEFAULT_EMAIL_SETTINGS, userId };
}

export async function saveEmailSyncSettings(settings: EmailSyncSettings): Promise<void> {
  if (getIsDemoMode()) {
    Object.assign(DEFAULT_EMAIL_SETTINGS, settings);
    return;
  }

  const docRef = doc(firestoreDb, 'users', settings.userId, 'settings', 'email_sync');
  await setDoc(docRef, settings, { merge: true });
}

export async function getParsedEmails(userId: string): Promise<ParsedEmailDoc[]> {
  if (getIsDemoMode()) {
    return [...demoParsedEmails];
  }

  try {
    const q = query(collection(firestoreDb, 'parsed_emails'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: ParsedEmailDoc[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ParsedEmailDoc));
    return list;
  } catch (err) {
    console.warn('Failed to query parsed_emails from Firestore, falling back to local:', err);
    return [...demoParsedEmails];
  }
}

export async function triggerGmailSync(
  userId: string,
  simulatedSubject?: string,
  simulatedSnippet?: string
): Promise<{
  success: boolean;
  totalProcessed: number;
  autoPostedCount: number;
  reviewCount: number;
}> {
  if (simulatedSubject) {
    // Process single custom email simulation
    const msgId = `sim_${Date.now()}`;
    const parseResult = BankEmailParser.parse(simulatedSubject, simulatedSnippet || '');
    const settings = await getEmailSyncSettings(userId);

    const isTrusted =
      parseResult.classification === 'purchase' &&
      parseResult.confidence >= settings.minConfidenceToAutoPost &&
      settings.autoPostTrusted;

    const newEmail: ParsedEmailDoc = {
      id: `email_${msgId}`,
      userId,
      gmailMessageId: msgId,
      gmailAccountId: settings.connectedEmail || 'user@example.com',
      subject: simulatedSubject,
      from: 'alerts@bank.com',
      date: new Date().toISOString(),
      snippet: simulatedSnippet || simulatedSubject,
      parseResult,
      status: isTrusted ? 'auto_posted' : 'pending_review',
      auditLog: [
        {
          action: 'parsed_from_email',
          timestamp: new Date().toISOString(),
          details: `Parsed by ${parseResult.parserUsed} with confidence ${parseResult.confidence}`
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isTrusted) {
      // Auto-post to ledger
      const txId = `tx_${msgId}`;
      newEmail.transactionId = txId;
      newEmail.auditLog.push({
        action: 'auto_posted_to_ledger',
        timestamp: new Date().toISOString(),
        details: `Auto-posted as ${parseResult.suggestedCategory}`
      });

      await addTransaction({
        id: txId,
        userId,
        type: parseResult.direction === 'debit' ? 'expense' : 'income',
        amount: parseResult.amount,
        category: parseResult.suggestedCategory,
        account: parseResult.paymentMethod,
        date: parseResult.transactionDate,
        description: `${parseResult.merchantOrDescription} (${parseResult.accountMasked})`,
        idempotencyKey: `email_tx_${msgId}`,
        tags: ['email-synced', parseResult.classification],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    if (getIsDemoMode()) {
      demoParsedEmails.unshift(newEmail);
    } else {
      await setDoc(doc(firestoreDb, 'parsed_emails', newEmail.id), cleanFirestoreData(newEmail));
    }

    return {
      success: true,
      totalProcessed: 1,
      autoPostedCount: isTrusted ? 1 : 0,
      reviewCount: isTrusted ? 0 : 1
    };
  }

  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('192.168.'));

  const enableRemoteSync = import.meta.env.VITE_ENABLE_REMOTE_EMAIL_SYNC === 'true';

  // Live Cloud Function Trigger (in cloud production or when explicitly configured)
  if (!getIsDemoMode() && (!isLocalDev || enableRemoteSync)) {
    try {
      const syncFn = httpsCallable<any, any>(firebaseFunctions, 'syncBankEmails');
      const res = await syncFn({});
      return res.data;
    } catch (e: any) {
      console.warn('Remote sync unavailable, falling back to local simulation:', e?.message || e);
    }
  }

  // Realistic local bank alerts when on localhost, offline, or testing
  const sampleAlerts = [
    {
      subject: 'Dear SBI UPI User, A/c 5204 debited by 485.00 on 24Oct26 transfer to Swiggy Ref No 429381928391',
      from: 'sbi.upi@sbi.co.in',
      snippet: 'A/c 5204 debited by 485.00 transfer to Swiggy Ref No 429381928391'
    },
    {
      subject: 'Salary credit of INR 1,25,000.00 from ACME TECH PVT LTD into A/c XX5204',
      from: 'alerts@hdfcbank.net',
      snippet: 'NEFT credit of INR 1,25,000.00 from ACME TECH PVT LTD on 24-Oct-26'
    },
    {
      subject: 'INR 25,000.00 debited from A/c XX5204 towards HDFC Housing Loan EMI installment',
      from: 'loans@hdfcbank.net',
      snippet: 'Monthly loan EMI auto-debit ECS Ref #EMI9827361'
    }
  ];

  const settings = await getEmailSyncSettings(userId);
  let autoPosted = 0;
  let reviewed = 0;

  for (const sample of sampleAlerts) {
    const parseResult = BankEmailParser.parse(sample.subject, sample.snippet);
    const msgId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isTrusted =
      parseResult.classification === 'purchase' &&
      parseResult.confidence >= settings.minConfidenceToAutoPost &&
      settings.autoPostTrusted;

    const emailDoc: ParsedEmailDoc = {
      id: `email_${msgId}`,
      userId,
      gmailMessageId: msgId,
      gmailAccountId: settings.connectedEmail || 'user@gmail.com',
      subject: sample.subject,
      from: sample.from,
      date: new Date().toISOString(),
      snippet: sample.snippet,
      parseResult,
      status: isTrusted ? 'auto_posted' : 'pending_review',
      auditLog: [
        {
          action: 'parsed_from_email',
          timestamp: new Date().toISOString(),
          details: `Parsed via ${parseResult.parserUsed} rule with ${(parseResult.confidence * 100).toFixed(0)}% confidence`
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isTrusted) {
      autoPosted++;
      const txId = `tx_${msgId}`;
      emailDoc.transactionId = txId;
      await addTransaction({
        id: txId,
        userId,
        type: parseResult.direction === 'debit' ? 'expense' : 'income',
        amount: parseResult.amount,
        category: parseResult.suggestedCategory,
        account: parseResult.paymentMethod,
        date: parseResult.transactionDate,
        description: `${parseResult.merchantOrDescription} (${parseResult.accountMasked})`,
        idempotencyKey: `email_tx_${msgId}`,
        tags: ['email-synced', parseResult.classification],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      reviewed++;
    }

    if (getIsDemoMode()) {
      demoParsedEmails.unshift(emailDoc);
    } else {
      await setDoc(doc(firestoreDb, 'parsed_emails', emailDoc.id), cleanFirestoreData(emailDoc));
    }
  }

  return {
    success: true,
    totalProcessed: sampleAlerts.length,
    autoPostedCount: autoPosted,
    reviewCount: reviewed
  };
}

export async function processReviewAction(
  emailDoc: ParsedEmailDoc,
  action: 'approve' | 'reject' | 'ignore',
  confirmedData?: {
    amount: number;
    category: string;
    description: string;
    account: string;
    type: 'income' | 'expense' | 'transfer';
  }
): Promise<void> {
  const now = new Date().toISOString();

  if (action === 'approve') {
    const finalAmount = confirmedData?.amount || emailDoc.parseResult.amount;
    const finalCategory = confirmedData?.category || emailDoc.parseResult.suggestedCategory;
    const finalDescription = confirmedData?.description || emailDoc.parseResult.merchantOrDescription;
    const finalAccount = confirmedData?.account || emailDoc.parseResult.paymentMethod;
    const finalType = confirmedData?.type || (emailDoc.parseResult.direction === 'debit' ? 'expense' : 'income');

    const txId = `tx_${emailDoc.gmailMessageId}`;

    // Post to ledger
    await addTransaction({
      id: txId,
      userId: emailDoc.userId,
      type: finalType,
      amount: finalAmount,
      category: finalCategory,
      account: finalAccount,
      date: emailDoc.parseResult.transactionDate,
      description: finalDescription,
      idempotencyKey: `review_approved_${emailDoc.gmailMessageId}`,
      tags: ['email-reviewed', emailDoc.parseResult.classification],
      createdAt: now,
      updatedAt: now
    });

    emailDoc.status = 'approved';
    emailDoc.transactionId = txId;
    emailDoc.auditLog.push({
      action: 'user_approved',
      timestamp: now,
      details: `Approved as ${finalCategory} (INR ${finalAmount})`
    });
  } else {
    emailDoc.status = action === 'reject' ? 'rejected' : 'ignored';
    emailDoc.auditLog.push({
      action: action === 'reject' ? 'user_rejected' : 'user_ignored',
      timestamp: now,
      details: 'Item dismissed from review queue.'
    });
  }

  if (getIsDemoMode()) {
    const idx = demoParsedEmails.findIndex((e) => e.id === emailDoc.id);
    if (idx >= 0) demoParsedEmails[idx] = { ...emailDoc };
  } else {
    const docRef = doc(firestoreDb, 'parsed_emails', emailDoc.id);
    await updateDoc(docRef, {
      status: emailDoc.status,
      transactionId: emailDoc.transactionId || null,
      auditLog: emailDoc.auditLog,
      updatedAt: serverTimestamp()
    });
  }
}
