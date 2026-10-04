// src/processAlibiSafe.ts
import { processAlibiInput, type BudgetState, type AlibiResult, type SayNoScripts } from "./processAlibiInput";

export type ResolveSource = "live" | "fallback";
export interface SafeResult {
  result: AlibiResult;
  source: ResolveSource;
  ms: number;
}

const TIMEOUT_MS = 2500;
const API_KEY = (import.meta as any).env?.VITE_GROQ_API_KEY ?? "";

export async function processAlibiSafe(
  rawInput: string,
  budgetState: BudgetState
): Promise<SafeResult> {
  const t0 = performance.now();

  if (!API_KEY) {
    return { result: mockFor(rawInput, budgetState), source: "fallback", ms: Math.round(performance.now() - t0) };
  }

  const live = processAlibiInput(rawInput, budgetState, { apiKey: API_KEY });
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), TIMEOUT_MS));

  try {
    const winner = await Promise.race([live, timeout]);
    if (winner === "timeout") {
      return { result: mockFor(rawInput, budgetState), source: "fallback", ms: Math.round(performance.now() - t0) };
    }
    return { result: winner as AlibiResult, source: "live", ms: Math.round(performance.now() - t0) };
  } catch {
    return { result: mockFor(rawInput, budgetState), source: "fallback", ms: Math.round(performance.now() - t0) };
  }
}

function sayNoFor(item: string, cheaperAlternative: string): SayNoScripts {
  const plan = item.trim() || "that";
  const swap = cheaperAlternative
    ? ` ${cheaperAlternative.replace(/^suggest\s+/i, "how about ").replace(/\.$/, "")}?`
    : " maybe something cheaper instead?";
  return {
    funny: `Bro I am praying on my allowance rn 😭 count me out for "${plan}" this time, broke era`,
    honest: `Ngl trying to stay on budget this week, so I'll skip "${plan}" this time. Next one's on me though.`,
    firm: `Can't make it for "${plan}" today, sticking to my budget.${swap}`,
  };
}

function mockFor(rawInput: string, b: BudgetState): AlibiResult {
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
    const verdict = risky ? "skip" : usedPct > 60 ? "think_twice" : "go_ahead";
    const item = rawInput.slice(0, 40);
    const cheaperAlternative = risky ? "Suggest a cheaper hangout spot or split the bill fewer ways." : "";
    const emptyScripts: SayNoScripts = { funny: "", honest: "", firm: "" };
    return {
      mode: "advice",
      data: {
        amount,
        category: /café|cafe|movie|party|club/.test(text) ? "Social" : "Food",
        item,
        verdict,
        regretRiskScore: Math.min(95, Math.max(15, usedPct)),
        peerPressureDetected: peerPressure,
        peerPressureNote: peerPressure ? "Group plan detected — easy to overspend when everyone else is paying too." : "",
        cheaperAlternative,
        aiCoachMessage: risky ? "This eats a big chunk of your safe budget — think twice before saying yes." : "Should fit fine within today's budget. Go for it.",
        sayNoScripts: verdict === "go_ahead" ? emptyScripts : sayNoFor(item, cheaperAlternative),
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
      aiCoachMessage: isIncome ? "Nice top-up! Keep some aside before it disappears into snacks." : `Logged! You've used ${usedPct}% of today's safe budget.`,
    },
  };
}