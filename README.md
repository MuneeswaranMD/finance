# FinanceFlow — INR Expense Tracker & AI Finance Coach PWA

FinanceFlow is a high-integrity personal and business financial management system tailored for Indian personal finance (INR ₹). Built with React, TypeScript, Firebase Authentication, Cloud Firestore, Recharts, and Google Gemini AI.

## Key Features

1. **Strict Accounting & Income Segregation**
   - Segregates confirmed earned income from loans, transfers, refunds, and pending invoices.
   - Distinct income profiles: Salaried (Fixed), Freelancer (Conservative variable baseline), Business Owner (Operating reserve deduction).

2. **Smart Budget Engine & Transparent Math**
   - 50/30/20 budget framework with custom emergency targets and month-end burn-rate forecasts.
   - Windfall Allocator allocating lump-sum bonuses to high-interest debt, emergency reserves, and goals.

3. **Grounded Gemini AI Finance Coach**
   - Contextual chat with Gemini 3.8 Flash (`gemini-flash-latest`) analyzing real ledger calculations.
   - Deterministic local engine fallback when offline.

4. **Reducing Balance Loan & EMI Schedules**
   - Full mathematical amortization engine with monthly principal/interest split.
   - Track Borrowed Loans (Liabilities) vs Lent Out (Assets).
   - Reversible EMI payments and individual schedule installment management.

5. **Invoicing & Accounts Receivable**
   - Generate, export, and track status (`draft`, `sent`, `partially_paid`, `paid`, `overdue`).
   - Project tagging for cost attribution.

6. **Bank Email Parsing & Review Queue**
   - Rule-based regex parser for HDFC, SBI, ICICI, Axis, and UPI alerts.
   - Human-in-the-loop review queue separating purchases from liability payments.

7. **Progressive Web App (PWA)**
   - Offline-ready app shell with ServiceWorker caching and background queue.
   - Installable on Android, iOS, and Desktop.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS with curated dark/lime design system and mobile responsive grids
- **Backend / DB**: Firebase Authentication & Cloud Firestore
- **Charts**: Recharts
- **Icons**: Lucide React
- **AI**: Google Generative Language API (`gemini-flash-latest`)

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Firebase credentials and optional Gemini API key:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Locally
```bash
npm run dev
```

### 4. Run Tests & Build
```bash
# Run Vitest test suite
npx vitest run

# Production Build
npm run build
```

## License
MIT
