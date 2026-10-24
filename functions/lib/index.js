"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRecurringTransactions = exports.postLoanPayment = exports.postInvoicePayment = exports.processReviewQueueAction = exports.syncBankEmails = exports.saveGmailAuthTokens = exports.getGmailAuthUrl = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const googleapis_1 = require("googleapis");
const bankEmailParser_1 = require("./bankEmailParser");
admin.initializeApp();
const db = admin.firestore();
// OAuth2 Client setup for Gmail API
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || 'dummy_client_id_for_dev.apps.googleusercontent.com';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || 'dummy_client_secret_for_dev';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'https://finance-39d8a.web.app/oauth2callback';
function getOAuthClient() {
    return new googleapis_1.google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
}
/**
 * Generates Gmail OAuth 2.0 URL with minimum necessary readonly scope
 * Scope: 'https://www.googleapis.com/auth/gmail.readonly'
 */
exports.getGmailAuthUrl = functions
    .region('asia-south1')
    .https.onCall(async (_, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const oauth2Client = getOAuthClient();
    const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state: context.auth.uid // Associate state with user UID
    });
    return { url };
});
/**
 * Stores OAuth refresh token server-side (Never exposed to client)
 */
exports.saveGmailAuthTokens = functions
    .region('asia-south1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const userId = context.auth.uid;
    const { code, userEmail } = data;
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Authorization code required.');
    }
    try {
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        // Store server-side in Firestore
        await db.collection('users').doc(userId).collection('integrations').doc('gmail').set({
            connectedEmail: userEmail || 'Connected Gmail Account',
            refreshToken: tokens.refresh_token || null,
            accessToken: tokens.access_token || null,
            expiryDate: tokens.expiry_date || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return { success: true };
    }
    catch (err) {
        console.error('Failed to exchange Gmail tokens:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Token exchange failed.');
    }
});
/**
 * Synchronizes Bank Emails from Gmail API, parses them deterministically,
 * deduplicates via messageId and references, and routes to either
 * auto-post or the Review Queue.
 */
exports.syncBankEmails = functions
    .region('asia-south1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const userId = context.auth.uid;
    const simulatedEmails = data?.simulatedEmails; // Supports testing / preview
    try {
        // 1. Fetch user email sync settings
        const settingsSnap = await db.collection('users').doc(userId).collection('settings').doc('email_sync').get();
        const autoPostTrusted = settingsSnap.exists ? settingsSnap.data()?.autoPostTrusted === true : false;
        const minConfidence = settingsSnap.exists ? Number(settingsSnap.data()?.minConfidenceToAutoPost) || 0.85 : 0.85;
        let rawEmails = [];
        // If simulated / test payload provided
        if (simulatedEmails && Array.isArray(simulatedEmails) && simulatedEmails.length > 0) {
            rawEmails = simulatedEmails;
        }
        else {
            // Retrieve stored token
            const tokenSnap = await db.collection('users').doc(userId).collection('integrations').doc('gmail').get();
            if (!tokenSnap.exists || !tokenSnap.data()?.refreshToken) {
                // If live tokens are not configured yet, provide realistic sample bank alerts including the example prompt
                rawEmails = [
                    {
                        id: `msg_demo_${Date.now()}_1`,
                        subject: 'INR 300.00 was debited from your A/c no. XX5204.',
                        snippet: 'INR 300.00 was debited from your A/c no. XX5204 on 24-Oct-26.',
                        from: 'alerts@hdfcbank.net',
                        date: new Date().toISOString()
                    },
                    {
                        id: `msg_demo_${Date.now()}_2`,
                        subject: 'Dear SBI UPI User, A/c 5204 debited by 485.00 on 24Oct26 transfer to Swiggy Ref No 429381928391',
                        snippet: 'A/c 5204 debited by 485.00 transfer to Swiggy Ref No 429381928391',
                        from: 'sbi.upi@sbi.co.in',
                        date: new Date().toISOString()
                    },
                    {
                        id: `msg_demo_${Date.now()}_3`,
                        subject: 'INR 25,000.00 debited from A/c XX5204 towards HDFC Housing Loan EMI installment',
                        snippet: 'Monthly loan EMI auto-debit ECS Ref #EMI9827361',
                        from: 'loans@hdfcbank.net',
                        date: new Date().toISOString()
                    }
                ];
            }
            else {
                // Live Gmail API Call
                const oauth2Client = getOAuthClient();
                oauth2Client.setCredentials({ refresh_token: tokenSnap.data()?.refreshToken });
                const gmail = googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
                const listRes = await gmail.users.messages.list({
                    userId: 'me',
                    q: 'subject:(debited OR credited OR "A/c no." OR "transfer to") after:2026/01/01',
                    maxResults: 20
                });
                const messages = listRes.data.messages || [];
                for (const m of messages) {
                    if (!m.id)
                        continue;
                    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id });
                    const headers = msg.data.payload?.headers || [];
                    const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
                    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
                    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString();
                    rawEmails.push({
                        id: m.id,
                        subject: subjectHeader,
                        snippet: msg.data.snippet || '',
                        from: fromHeader,
                        date: dateHeader
                    });
                }
            }
        }
        let autoPostedCount = 0;
        let reviewCount = 0;
        let duplicateSkippedCount = 0;
        for (const email of rawEmails) {
            const docId = `email_${email.id}`;
            // 2. Strict Deduplication: Check if message ID was already processed
            const existingSnap = await db.collection('parsed_emails').doc(docId).get();
            if (existingSnap.exists) {
                duplicateSkippedCount++;
                continue;
            }
            // 3. Parse Email
            const parseResult = bankEmailParser_1.BankEmailParser.parse(email.subject, email.snippet);
            // 4. Secondary Deduplication: Check if transaction reference already exists in ledger
            if (parseResult.referenceNumber) {
                const refTxSnap = await db
                    .collection('transactions')
                    .where('userId', '==', userId)
                    .where('idempotencyKey', '==', `email_tx_${parseResult.referenceNumber}`)
                    .limit(1)
                    .get();
                if (!refTxSnap.empty) {
                    duplicateSkippedCount++;
                    continue;
                }
            }
            // 5. Determine whether to auto-post or send to Review Queue
            // Never auto-post loans, uncertain items, or when autoPost is disabled
            const isTrustedPurchase = parseResult.classification === 'purchase' &&
                parseResult.confidence >= minConfidence &&
                parseResult.amount > 0 &&
                autoPostTrusted;
            let status = 'pending_review';
            let transactionId = null;
            const now = new Date().toISOString();
            const auditLog = [
                {
                    action: 'parsed_from_email',
                    timestamp: now,
                    details: `Parsed by ${parseResult.parserUsed} with confidence ${parseResult.confidence}`
                }
            ];
            if (isTrustedPurchase) {
                // Auto-post to transactions
                transactionId = `tx_email_${email.id}`;
                status = 'auto_posted';
                auditLog.push({
                    action: 'auto_posted_to_ledger',
                    timestamp: now,
                    details: `Auto-posted as ${parseResult.suggestedCategory} (${parseResult.merchantOrDescription})`
                });
                await db.collection('transactions').doc(transactionId).set({
                    id: transactionId,
                    userId,
                    type: parseResult.direction === 'debit' ? 'expense' : 'income',
                    amount: parseResult.amount,
                    category: parseResult.suggestedCategory,
                    account: parseResult.paymentMethod || 'Bank Account',
                    date: parseResult.transactionDate,
                    description: `${parseResult.merchantOrDescription} (${parseResult.accountMasked})`,
                    idempotencyKey: parseResult.referenceNumber ? `email_tx_${parseResult.referenceNumber}` : `email_tx_${email.id}`,
                    tags: ['email-synced', parseResult.classification],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                autoPostedCount++;
            }
            else {
                reviewCount++;
                auditLog.push({
                    action: 'routed_to_review_queue',
                    timestamp: now,
                    details: parseResult.classification === 'loan_emi'
                        ? 'Detected possible Loan EMI. User confirmation required.'
                        : parseResult.classification === 'credit_card_bill'
                            ? 'Detected possible Credit Card Bill. User confirmation required.'
                            : parseResult.classification === 'uncertain'
                                ? 'Classification uncertain or missing merchant.'
                                : 'Auto-posting disabled in user settings.'
                });
            }
            // Save to parsed_emails
            await db.collection('parsed_emails').doc(docId).set({
                id: docId,
                userId,
                gmailMessageId: email.id,
                gmailAccountId: email.from || 'User Gmail',
                subject: email.subject,
                from: email.from,
                date: email.date,
                snippet: email.snippet,
                parseResult,
                status,
                transactionId,
                auditLog,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        return {
            success: true,
            totalProcessed: rawEmails.length,
            autoPostedCount,
            reviewCount,
            duplicateSkippedCount
        };
    }
    catch (error) {
        console.error('Email sync failed:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Email sync failed.');
    }
});
/**
 * Review Queue Action: User approves, updates, or rejects a parsed email
 */
exports.processReviewQueueAction = functions
    .region('asia-south1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const userId = context.auth.uid;
    const { emailDocId, action, confirmedData } = data;
    if (!emailDocId || !['approve', 'reject', 'ignore'].includes(action)) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid emailDocId and action required.');
    }
    const emailRef = db.collection('parsed_emails').doc(emailDocId);
    const snap = await emailRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Parsed email not found.');
    }
    const emailData = snap.data();
    if (emailData.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Unauthorized access.');
    }
    const now = new Date().toISOString();
    const auditLog = emailData.auditLog || [];
    if (action === 'approve') {
        const finalAmount = Number(confirmedData?.amount || emailData.parseResult.amount);
        const finalCategory = confirmedData?.category || emailData.parseResult.suggestedCategory;
        const finalDescription = confirmedData?.description || emailData.parseResult.merchantOrDescription;
        const finalAccount = confirmedData?.account || emailData.parseResult.paymentMethod;
        const finalType = confirmedData?.type || (emailData.parseResult.direction === 'debit' ? 'expense' : 'income');
        const txId = `tx_${emailData.gmailMessageId}`;
        // Create ledger transaction
        await db.collection('transactions').doc(txId).set({
            id: txId,
            userId,
            type: finalType,
            amount: finalAmount,
            category: finalCategory,
            account: finalAccount,
            date: confirmedData?.date || emailData.parseResult.transactionDate,
            description: finalDescription,
            idempotencyKey: `review_approved_${emailData.gmailMessageId}`,
            tags: ['email-reviewed', emailData.parseResult.classification],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        auditLog.push({
            action: 'user_approved',
            timestamp: now,
            details: `Confirmed by user as ${finalCategory} (INR ${finalAmount})`
        });
        await emailRef.update({
            status: 'approved',
            transactionId: txId,
            auditLog,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, transactionId: txId };
    }
    else {
        auditLog.push({
            action: action === 'reject' ? 'user_rejected' : 'user_ignored',
            timestamp: now,
            details: 'Rejected or ignored from review queue.'
        });
        await emailRef.update({
            status: action === 'reject' ? 'rejected' : 'ignored',
            auditLog,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    }
});
/**
 * Trusted Financial Callable: Post Invoice Payment
 */
exports.postInvoicePayment = functions
    .region('asia-south1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to post invoice payments.');
    }
    const userId = context.auth.uid;
    const { invoiceId, amount, paymentMethod, referenceNumber, idempotencyKey, notes, paymentDate } = data;
    if (!invoiceId || !amount || amount <= 0 || !idempotencyKey) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid invoiceId, positive amount, and idempotencyKey are required.');
    }
    try {
        const result = await db.runTransaction(async (transaction) => {
            const paymentCheck = await db
                .collection('invoice_payments')
                .where('userId', '==', userId)
                .where('idempotencyKey', '==', idempotencyKey)
                .limit(1)
                .get();
            if (!paymentCheck.empty) {
                throw new functions.https.HttpsError('already-exists', 'Duplicate invoice payment detected. This payment was already processed.');
            }
            const invRef = db.collection('invoices').doc(invoiceId);
            const invSnap = await transaction.get(invRef);
            if (!invSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Invoice not found.');
            }
            const invoice = invSnap.data();
            if (invoice.userId !== userId) {
                throw new functions.https.HttpsError('permission-denied', 'Unauthorized access to invoice.');
            }
            const currentPaid = Number(invoice.paidAmount) || 0;
            const totalAmount = Number(invoice.totalAmount) || 0;
            const remaining = totalAmount - currentPaid;
            if (amount > remaining + 0.01) {
                throw new functions.https.HttpsError('failed-precondition', `Payment amount (INR ${amount}) exceeds remaining balance (INR ${remaining}).`);
            }
            const newPaidAmount = Math.round((currentPaid + amount) * 100) / 100;
            const newRemaining = Math.max(0, Math.round((totalAmount - newPaidAmount) * 100) / 100);
            const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid';
            const paymentId = `inv_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const paymentDocRef = db.collection('invoice_payments').doc(paymentId);
            transaction.update(invRef, {
                paidAmount: newPaidAmount,
                remainingBalance: newRemaining,
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            transaction.set(paymentDocRef, {
                id: paymentId,
                userId,
                invoiceId,
                amount,
                paymentDate: paymentDate || new Date().toISOString().split('T')[0],
                paymentMethod: paymentMethod || 'Bank Transfer',
                referenceNumber: referenceNumber || null,
                idempotencyKey,
                notes: notes || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            const txDocRef = db.collection('transactions').doc(`tx_${paymentId}`);
            transaction.set(txDocRef, {
                id: `tx_${paymentId}`,
                userId,
                type: 'income',
                amount,
                category: 'Invoicing Revenue',
                account: paymentMethod || 'Bank Transfer',
                date: paymentDate || new Date().toISOString().split('T')[0],
                description: `Payment for Invoice #${invoice.invoiceNumber || invoiceId}`,
                invoicePaymentId: paymentId,
                projectId: invoice.projectId || null,
                idempotencyKey: `cash_${idempotencyKey}`,
                tags: ['invoice', 'cash-inflow'],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { paymentId, newStatus, newPaidAmount, remainingBalance: newRemaining };
        });
        return { success: true, ...result };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Payment processing failed.');
    }
});
/**
 * Trusted Financial Callable: Post Loan Repayment / EMI
 */
exports.postLoanPayment = functions
    .region('asia-south1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const userId = context.auth.uid;
    const { loanId, installmentId, amount, principalPaid, interestPaid, paymentMethod, idempotencyKey, paymentDate } = data;
    if (!loanId || !amount || amount <= 0 || !idempotencyKey) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing loan payment arguments.');
    }
    try {
        const result = await db.runTransaction(async (transaction) => {
            const payCheck = await db
                .collection('loan_payments')
                .where('userId', '==', userId)
                .where('idempotencyKey', '==', idempotencyKey)
                .limit(1)
                .get();
            if (!payCheck.empty) {
                throw new functions.https.HttpsError('already-exists', 'Duplicate EMI payment detected.');
            }
            const loanRef = db.collection('loans').doc(loanId);
            const loanSnap = await transaction.get(loanRef);
            if (!loanSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Loan document not found.');
            }
            const loan = loanSnap.data();
            if (loan.userId !== userId) {
                throw new functions.https.HttpsError('permission-denied', 'Unauthorized access.');
            }
            const currentPrincipal = Number(loan.remainingPrincipal) || 0;
            const newPrincipal = Math.max(0, Math.round((currentPrincipal - principalPaid) * 100) / 100);
            const newStatus = newPrincipal <= 0 ? 'closed' : 'active';
            transaction.update(loanRef, {
                remainingPrincipal: newPrincipal,
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            if (installmentId) {
                const instRef = db.collection('loan_installments').doc(installmentId);
                transaction.update(instRef, {
                    status: 'paid',
                    paidDate: paymentDate || new Date().toISOString().split('T')[0]
                });
            }
            const paymentId = `loan_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const paymentRef = db.collection('loan_payments').doc(paymentId);
            transaction.set(paymentRef, {
                id: paymentId,
                userId,
                loanId,
                installmentId: installmentId || null,
                amount,
                principalPaid,
                interestPaid,
                paymentDate: paymentDate || new Date().toISOString().split('T')[0],
                paymentMethod: paymentMethod || 'Bank Account',
                idempotencyKey,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            if (interestPaid > 0) {
                const intTxRef = db.collection('transactions').doc(`tx_int_${paymentId}`);
                transaction.set(intTxRef, {
                    id: `tx_int_${paymentId}`,
                    userId,
                    type: 'expense',
                    amount: interestPaid,
                    category: 'Loan Interest',
                    account: paymentMethod || 'Bank Account',
                    date: paymentDate || new Date().toISOString().split('T')[0],
                    description: `Loan interest on ${loan.title || loanId}`,
                    loanPaymentId: paymentId,
                    idempotencyKey: `int_${idempotencyKey}`,
                    tags: ['loan', 'interest-expense'],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            if (principalPaid > 0) {
                const prinTxRef = db.collection('transactions').doc(`tx_prin_${paymentId}`);
                transaction.set(prinTxRef, {
                    id: `tx_prin_${paymentId}`,
                    userId,
                    type: 'expense',
                    amount: principalPaid,
                    category: 'Debt Principal Repayment',
                    account: paymentMethod || 'Bank Account',
                    date: paymentDate || new Date().toISOString().split('T')[0],
                    description: `Principal repayment on ${loan.title || loanId}`,
                    loanPaymentId: paymentId,
                    idempotencyKey: `prin_${idempotencyKey}`,
                    tags: ['loan', 'principal-reduction'],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            return { paymentId, newRemainingPrincipal: newPrincipal, loanStatus: newStatus };
        });
        return { success: true, ...result };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Loan payment failed.');
    }
});
/**
 * Scheduled Cron Function: Process Recurring Transactions
 */
exports.processRecurringTransactions = functions
    .region('asia-south1')
    .pubsub.schedule('0 0 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const snapshot = await db
        .collection('recurring_transactions')
        .where('active', '==', true)
        .where('nextDueDate', '<=', todayStr)
        .get();
    if (snapshot.empty) {
        console.log('No due recurring transactions found today.');
        return null;
    }
    const batch = db.batch();
    for (const docSnap of snapshot.docs) {
        const rec = docSnap.data();
        const idempotencyKey = `rec_${docSnap.id}_${rec.nextDueDate}`;
        const txCheck = await db
            .collection('transactions')
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();
        if (txCheck.empty) {
            const txId = `tx_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const txRef = db.collection('transactions').doc(txId);
            batch.set(txRef, {
                id: txId,
                userId: rec.userId,
                type: rec.type,
                amount: rec.amount,
                category: rec.category,
                account: 'Auto Debit',
                date: rec.nextDueDate,
                description: `Recurring: ${rec.title}`,
                idempotencyKey,
                tags: ['recurring', 'auto-posted'],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        const nextDate = new Date(rec.nextDueDate);
        if (rec.frequency === 'daily')
            nextDate.setDate(nextDate.getDate() + 1);
        else if (rec.frequency === 'weekly')
            nextDate.setDate(nextDate.getDate() + 7);
        else if (rec.frequency === 'monthly')
            nextDate.setMonth(nextDate.getMonth() + 1);
        else if (rec.frequency === 'yearly')
            nextDate.setFullYear(nextDate.getFullYear() + 1);
        batch.update(docSnap.ref, {
            nextDueDate: nextDate.toISOString().split('T')[0],
            lastProcessedDate: todayStr
        });
    }
    await batch.commit();
    console.log(`Processed ${snapshot.size} recurring transactions successfully.`);
    return null;
});
//# sourceMappingURL=index.js.map