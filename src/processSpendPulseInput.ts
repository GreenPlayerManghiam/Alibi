// SpendPulse dual-mode intent router (Gemini JSON mode).
// Mode 1 "transaction": user reports something already spent/received.
// Mode 2 "advice": user is ABOUT to spend -> Regret-Risk & Peer-Pressure engine.
// NOTE: call from a server route / Supabase Edge Function so the API key stays secret.

export type Category = "Food" | "Travel" | "Social" | "Academic" | "Income";

export interface BudgetState {
  monthlyAllowance: number;
  fixedFees: number;
  remainingDays: number;
  spentToday: number;
}

export interface TransactionResult {
  mode: "transaction";
  data: {
    amount: number;
    category: Category;
    merchant: string;
    type: "expense" | "income";
    aiCoachMessage: string;
  };
}

export interface AdviceResult {
  mode: "advice";
  data: {
    amount: number;
    category: Category;
    item: string;
    verdict: "go_ahead" | "think_twice" | "skip";
    regretRiskScore: number; // 0-100
    peerPressureDetected: boolean;
    peerPressureNote: string; // "" if none
    cheaperAlternative: string; // "" if none
    aiCoachMessage: string;
  };
}

export type SpendPulseResult = TransactionResult | AdviceResult;

const CATEGORIES: Category[] = ["Food", "Travel", "Social", "Academic", "Income"];

// Gemini responseSchema (OpenAPI subset). One flat object keeps both modes
// in a single call; we validate and reshape afterwards.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    mode: { type: "STRING", enum: ["transaction", "advice"] },
    amount: { type: "NUMBER" },
    category: { type: "STRING", enum: CATEGORIES },
    label: { type: "STRING" }, // merchant (transaction) or item (advice)
    type: { type: "STRING", enum: ["expense", "income"] },
    verdict: { type: "STRING", enum: ["go_ahead", "think_twice", "skip"] },
    regretRiskScore: { type: "NUMBER" },
    peerPressureDetected: { type: "BOOLEAN" },
    peerPressureNote: { type: "STRING" },
    cheaperAlternative: { type: "STRING" },
    aiCoachMessage: { type: "STRING" },
  },
  required: ["mode", "amount", "category", "label", "aiCoachMessage"],
};

const SYSTEM_PROMPT = `You are SpendPulse, a friendly money coach for Indian university students living on a hostel/mess allowance. Amounts are in rupees (₹).

Classify the input into ONE mode:
- "transaction": already happened ("Paid 480 lunch with Riya", "180 canteen momos", "got 500 from mom").
- "advice": about to happen or a question ("should I buy...", "friends want to go to...", "thinking of ordering...").

Rules:
- category must be one of: ${CATEGORIES.join(", ")}. Money received => category "Income", type "income".
- label: short merchant/place/person context (transaction) or the item/plan (advice).
- aiCoachMessage: max 2 short sentences, casual, no lecture. Use ONLY the numbers given in METRICS; never invent figures.
- For advice mode also set verdict, regretRiskScore (0-100), peerPressureDetected (true if friends/group/FOMO/"everyone is going" drives the spend), peerPressureNote, cheaperAlternative (empty string if none).
- Regret-risk goes UP for: impulse buys, peer-driven Social spend, amount above the remaining daily safe budget, late-month timing. It goes DOWN for: Academic needs, small amounts, planned spends.
- For transaction mode leave verdict/regretRiskScore/peer fields out.`;

function computeMetrics(amount: number | null, b: BudgetState) {
  const discretionary = Math.max(b.monthlyAllowance - b.fixedFees, 0);
  const days = Math.max(b.remainingDays, 1);
  // Simplification: budgetState has no month-to-date spend, so daily safe
  // budget = discretionary pool spread over remaining days.
  const dailySafe = discretionary / days;
  const leftToday = dailySafe - b.spentToday;
  const usedPct = dailySafe > 0 ? ((b.spentToday + (amount ?? 0)) / dailySafe) * 100 : 100;
  return {
    dailySafeBudget: Math.round(dailySafe),
    spentTodayBefore: Math.round(b.spentToday),
    leftTodayBefore: Math.round(leftToday),
    usedTodayPctAfter: Math.round(usedPct),
    daysOfBudgetThisCosts: dailySafe > 0 && amount ? +(amount / dailySafe).toFixed(1) : 0,
  };
}

export async function processSpendPulseInput(
  rawInput: string,
  budgetState: BudgetState,
  opts: { apiKey: string; model?: string } = {
    apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY ?? "",
  }
): Promise<SpendPulseResult> {
  const input = rawInput.trim();
  if (!input) throw new Error("Empty input");

  // Rough pre-parse so the LLM sees accurate numbers (first number in text).
  const guess = Number((input.match(/\d[\d,]*(\.\d+)?/)?.[0] ?? "").replace(/,/g, "")) || null;
  const metrics = computeMetrics(guess, budgetState);

  const model = opts.model ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `INPUT: "${input}"\nBUDGET: ${JSON.stringify(budgetState)}\nMETRICS (use these numbers): ${JSON.stringify(metrics)}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let raw: any;
  try {
    raw = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return fallback(input, guess, budgetState);
  }

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !CATEGORIES.includes(raw.category)) {
    return fallback(input, guess, budgetState);
  }

  if (raw.mode === "advice") {
    return {
      mode: "advice",
      data: {
        amount,
        category: raw.category,
        item: String(raw.label ?? input),
        verdict: ["go_ahead", "think_twice", "skip"].includes(raw.verdict) ? raw.verdict : "think_twice",
        regretRiskScore: Math.min(100, Math.max(0, Math.round(Number(raw.regretRiskScore) || 50))),
        peerPressureDetected: Boolean(raw.peerPressureDetected),
        peerPressureNote: String(raw.peerPressureNote ?? ""),
        cheaperAlternative: String(raw.cheaperAlternative ?? ""),
        aiCoachMessage: String(raw.aiCoachMessage ?? ""),
      },
    };
  }

  return {
    mode: "transaction",
    data: {
      amount,
      category: raw.category,
      merchant: String(raw.label ?? input),
      type: raw.type === "income" || raw.category === "Income" ? "income" : "expense",
      aiCoachMessage: String(raw.aiCoachMessage ?? ""),
    },
  };
}

// Deterministic fallback if the LLM returns junk: still logs the spend.
function fallback(input: string, amount: number | null, b: BudgetState): TransactionResult {
  const m = computeMetrics(amount, b);
  return {
    mode: "transaction",
    data: {
      amount: amount ?? 0,
      category: "Food",
      merchant: input.slice(0, 40),
      type: "expense",
      aiCoachMessage: `Logged! You've used ${m.usedTodayPctAfter}% of today's safe budget.`,
    },
  };
}
