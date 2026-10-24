import {
  BudgetEngineOutput,
  BudgetCoachSettings,
  DEFAULT_COACH_SETTINGS,
  generateAICoachInsight
} from './budgetCoachEngine';
import { formatINR } from './financialCalculations';

// Default Gemini API key from environment variable (or configured via localStorage)
const DEFAULT_GEMINI_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';

const API_KEY_STORAGE_KEY = 'myfinance_gemini_api_key';

export function getStoredGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_GEMINI_API_KEY;
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  }
}

export interface CoachChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
  isFallback?: boolean;
}

/**
 * Builds the strict grounded context prompt for Gemini
 */
function buildCoachPrompt(
  output: BudgetEngineOutput,
  settings: BudgetCoachSettings,
  userQuery: string
): string {
  const totalInflow = output.confirmedPersonalIncome + output.netBusinessPersonalDraw;

  return `You are "MyFinance AI Coach", an empathetic, mathematically disciplined personal finance coach specializing in Indian personal finance (INR ₹).

You MUST strictly follow these principles:
1. All figures must be in INR (₹) using Indian numbering.
2. Use the deterministic figures provided below as the absolute single source of truth. DO NOT invent or alter balances or income.
3. NEVER promise guaranteed investment returns.
4. NEVER advise spending money that is required for upcoming EMIs, committed bills, or statutory reserves.
5. Emphasize conservative baselines for variable/business incomes and explain the mathematical reason behind every recommendation.
6. Keep your answer concise, conversational, actionable, and formatted with bullet points or clear sections.

--- VERIFIED USER FINANCIAL SNAPSHOT (SINGLE SOURCE OF TRUTH) ---
- Profile Type: ${settings.incomeType.toUpperCase()}
- Total Confirmed Personal Inflow: ${formatINR(totalInflow)}
  * Confirmed Personal Income: ${formatINR(output.confirmedPersonalIncome)}
  * Net Business Personal Draw: ${formatINR(output.netBusinessPersonalDraw)} (after ${formatINR(output.businessDeductionsAndReserves)} business/tax reserves)
- Pending Invoice Receivables (Earned accrual, NOT cash in hand): ${formatINR(output.pendingInvoiceReceivables)}
- Recorded Expenses This Month: ${formatINR(output.totalExpenses)}
  * Essential Needs: ${formatINR(output.essentialExpenses)}
  * Discretionary Wants: ${formatINR(output.discretionaryExpenses)}
  * Debt Repayments (EMIs Paid): ${formatINR(output.debtRepaymentsRecorded)}
- Protected Reserves for Remaining Month: ${formatINR(output.totalReservedObligations)}
  * Upcoming EMIs: ${formatINR(output.upcomingEMIs)}
  * Upcoming Bills: ${formatINR(output.upcomingBills)}
- Liquid Bank Balance: ${formatINR(output.liquidCashBalance)}
- Safe Available Discretionary Balance: ${formatINR(output.safeAvailableBalance)}
- Safe Daily Spending Allowance: ${formatINR(output.safeDailySpendingLimit)}/day (Remaining: ${output.daysRemainingInMonth} days)
- Safe Weekly Spending Allowance: ${formatINR(output.safeWeeklySpendingLimit)}/week
- Projected Month-End Net: ${formatINR(output.projectedMonthEndSurplus)} (${output.isProjectedDeficit ? 'Deficit Risk' : 'Surplus'})
- Savings Rate: ${output.savingsRate}% (Target: ${settings.targetSavingsRate}%)
- Emergency Fund: ${formatINR(output.currentEmergencySavings)} (${output.emergencyFundMonthsCovered} months covered, target ${settings.emergencyFundMonths} months / ${formatINR(output.targetEmergencyFund)})
- Active Threshold Warnings: ${output.categoryAlerts.length > 0 ? output.categoryAlerts.map(a => `[${a.level.toUpperCase()}] ${a.category}: ${a.message}`).join('; ') : 'None, budgets are healthy'}

--- USER QUESTION / GOAL ---
"${userQuery}"

Provide a direct, practical, and mathematically sound coaching answer:`;
}

/**
 * Ask Gemini with fallback to deterministic local coach engine
 */
export async function askGeminiCoach(
  output: BudgetEngineOutput,
  userQuery: string,
  settings: BudgetCoachSettings = DEFAULT_COACH_SETTINGS,
  apiKeyOverride?: string
): Promise<{ text: string; isFallback: boolean }> {
  const apiKey = (apiKeyOverride || getStoredGeminiApiKey()).trim();

  // If no key is configured, fallback immediately
  if (!apiKey) {
    const local = generateAICoachInsight(userQuery, output, settings);
    return {
      text: `${local}\n\n*Note: Running in offline local calculation mode.*`,
      isFallback: true
    };
  }

  const prompt = buildCoachPrompt(output, settings, userQuery);

  // Candidate models: gemini-flash-latest and gemini-3.8-flash
  const candidateModels = ['gemini-flash-latest', 'gemini-3.8-flash'];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return { text: text.trim(), isFallback: false };
        }
      }
    } catch {
      // Try next model candidate or fallback
      continue;
    }
  }

  // Graceful local engine fallback
  const local = generateAICoachInsight(userQuery, output, settings);
  return {
    text: `${local}\n\n*(Offline Coach Engine: Calculated deterministically from current transactions)*`,
    isFallback: true
  };
}
