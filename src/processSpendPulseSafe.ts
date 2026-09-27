import { processSpendPulseInput, type BudgetState, type SpendPulseResult } from "./processSpendPulseInput";

export type ResolveSource = "live" | "fallback";
export interface SafeResult {
  result: SpendPulseResult;
  source: ResolveSource;
  ms: number;
}

const TIMEOUT_MS = 2500;
const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY ?? "";

/**
 * processSpendPulseSafe
 * Races the live Gemini call against a fixed ceiling. If Gemini stalls,
 * errors, or there's no API key configured (common on stage wifi / a
 * fresh clone with no .env yet), returns a deterministic mock instead
 * so the demo never hangs or shows a blank card.
 */
export async function processSpendPulseSafe(
  rawInput: string,
  budgetState: BudgetState
): Promise<SafeResult> {
  const t0 = performance.now();

  if (!API_KEY) {
    return { result: mockFor(rawInput, budgetState), source: "fallback", ms: Math.round(performance.now() - t0) };
  }

  const live = processSpendPulseInput(rawInput, budgetState, { apiKey: API_KEY });
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), TIMEOUT_MS));

  try {
    const winner = await Promise.race([live, timeout]);
    if (winner === "timeout") {
      return { result: mockFor(rawInput, budgetState), source: "fallback", ms: Math.round(performance.now() - t0) };
    }
    return { result: winner as SpendPulseResult, source: "live", ms: Math.round(performance.now() - t0) };
  } catch {
    return { result: mockFor(rawInput, budgetState), source: "fallback", ms: Math.round(performance.now() - t0) };
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic student micro-economy mocks (no network required)     */
/* ------------------------------------------------------------------ */
function mockFor(rawInput: string, b: BudgetState): SpendPulseResult {
  const text = rawInput.toLowerCase();
  const amountMatch = Number((rawInput.match(/\d[\d,]*(\.\d+)?/)?.[0] ?? "").replace(/,/g, "")) || 0;

  const discretionary = Math.max(b.monthlyAllowance - b.fixedFees, 0);
  const dailySafe = discretionary / Math.max(b.remainingDays, 1);
  const usedPct = dailySafe > 0 ? Math.round(((b.spentToday + amountMatch) / dailySafe) * 100) : 100;

  const isPlan = /plan|should i|friends want|thinking of|going to (go|order)/.test(text);

  if (isPlan) {
    const amount = amountMatch || 500;
    const peerPressure = /friends?|everyone|group|squad/.test(text);
    const risky = usedPct > 90 || amount > dailySafe;
    return {
      mode: "advice",
      data: {
        amount,
        category: /café|cafe|movie|party|club/.test(text) ? "Social" : "Food",
        item: rawInput.slice(0, 40),
        verdict: risky ? "skip" : usedPct > 60 ? "think_twice" : "go_ahead",
        regretRiskScore: Math.min(95, Math.max(15, usedPct)),
        peerPressureDetected: peerPressure,
        peerPressureNote: peerPressure
          ? "Group plan detected — easy to overspend when everyone else is paying too."
          : "",
        cheaperAlternative: risky ? "Suggest a cheaper hangout spot or split the bill fewer ways." : "",
        aiCoachMessage: risky
          ? "This eats a big chunk of your safe budget — think twice before saying yes."
          : "Should fit fine within today's budget. Go for it.",
      },
    };
  }

  const isIncome = /got|received|sent|credited|mom|dad|home/.test(text) && /\d/.test(text);
  const isAuto = /auto|bus|cab|uber|ola/.test(text);
  const isAcademic = /xerox|notes|book|stationery|print/.test(text);

  return {
    mode: "transaction",
    data: {
      amount: amountMatch || 100,
      category: isIncome ? "Income" : isAuto ? "Travel" : isAcademic ? "Academic" : "Food",
      merchant: rawInput.slice(0, 30) || "Manual entry",
      type: isIncome ? "income" : "expense",
      aiCoachMessage: isIncome
        ? "Nice top-up! Keep some aside before it disappears into snacks."
        : `Logged! You've used ${usedPct}% of today's safe budget.`,
    },
  };
}
