# FinanceFlow — Firebase Deployment & Verification Guide

This guide covers complete instructions for deploying the Expense Tracker PWA to Firebase, configuring Authentication, deploying Security Rules, compiling Cloud Functions, and deploying the frontend to Firebase Hosting.

---

## 1. Prerequisites

- **Node.js**: v20 or higher
- **Firebase CLI**: Install globally via:
  ```bash
  npm install -g firebase-tools
  ```
- A Google Cloud / Firebase account.

---

## 2. Firebase Console Initial Setup

1. Open [Firebase Console](https://console.firebase.google.com/) and click **Create a project** (e.g. `financeflow-pwa`).
2. **Enable Authentication**:
   - Go to **Build** -> **Authentication** -> **Get Started**.
   - Under the **Sign-in method** tab, enable **Email/Password**.
3. **Enable Cloud Firestore**:
   - Go to **Build** -> **Firestore Database** -> **Create database**.
   - Select **Start in production mode**.
   - Select a database location (for low latency in India, select `asia-south1` Mumbai).
4. **Register Web App**:
   - In Project Overview, click the **Web icon (`</>`)** to add a web app.
   - Register app name (e.g., `FinanceFlow Web`).
   - Copy the `firebaseConfig` object credentials.

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the values copied from your Firebase Console Web App settings:
```ini
VITE_FIREBASE_API_KEY=AIzaSy...Your_Actual_Key
VITE_FIREBASE_AUTH_DOMAIN=financeflow-pwa.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=financeflow-pwa
VITE_FIREBASE_STORAGE_BUCKET=financeflow-pwa.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

> **Security Note:** Never put Google Cloud Service Account private keys or Firebase Admin SDK credentials in frontend environment files. Only public web client configuration belongs in `.env`.

---

## 4. Deploying Security Rules & Composite Indexes

Authenticate and link your Firebase CLI:
```bash
firebase login
firebase use --add financeflow-pwa
```

Deploy Firestore Security Rules and composite indexes:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Verify that the rules are live under **Firestore Database -> Rules**.

---

## 5. Deploying Cloud Functions

The Cloud Functions in `functions/` handle trusted financial operations:
- `postInvoicePayment`: Atomic idempotent payment posting and cash income recording.
- `postLoanPayment`: Atomic idempotent EMI payment, principal decrement, and interest expense recording.
- `processRecurringTransactions`: Scheduled daily cron (midnight IST) for subscription auto-debit ledger entries.

Build and deploy functions:
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

---

## 6. Building & Deploying the PWA to Firebase Hosting

Compile the React + TypeScript frontend into optimized static production assets:
```bash
npm run build
```

Deploy to Firebase Hosting:
```bash
firebase deploy --only hosting
```

Your PWA is now live at `https://<your-project-id>.web.app` with HTTPS, Service Worker caching, and full offline IndexedDB support!

---

## 7. Local Development with Firebase Emulators (Optional)

To develop locally without incurring cloud charges:
```bash
# Start all emulators (Auth on 9099, Firestore on 8080, Functions on 5001, UI on 4000)
firebase emulators:start
```
In another terminal, start the Vite development server:
```bash
npm run dev
```

---

## 8. Automated Testing & Verification

Run the automated test suite to ensure all financial algorithms, reducing-balance amortizations, invoice balances, idempotency keys, and security rule logic pass:
```bash
npm run test
```

Expected output:
```text
 ✓ src/test/securityRulesLogic.test.ts (6 tests)
 ✓ src/test/financialCalculations.test.ts (9 tests)

 Test Files  2 passed (2)
      Tests  15 passed (15)
```
