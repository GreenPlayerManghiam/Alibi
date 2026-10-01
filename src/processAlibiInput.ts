// src/processAlibiInput.ts
export type Category = "Food" | "Travel" | "Social" | "Academic" | "Income";

export interface BudgetState {
  monthlyAllowance: number;
  fixedFees: number;
  remainingDays: number;
  spentToday: number;
}

export type SocialScripts = { funny: string; honest: string; firm: string; counterPlan: string; };

export interface TransactionResult {
  mode: "transaction";
  data: { amount: number; category: Category; merchant: string; type: "expense" | "income"; aiCoachMessage: string; };
}

export interface AdviceResult {
  mode: "advice";
  data: { amount: number; category: Category; item: string; verdict: "go_ahead" | "think_twice" | "skip"; regretRiskScore: number; peerPressureDetected: boolean; aiCoachMessage: string; socialScripts?: SocialScripts; };
}

export interface IouResult {
  mode: "iou_nudge";
  data: { amount: number; category: Category; iouBorrower: string; type: "iou"; aiCoachMessage: string; socialScripts: SocialScripts; };
}

export type AlibiResult = TransactionResult | AdviceResult | IouResult;

export async function processAlibiInput(
  rawInput: string,
  budgetState: BudgetState,
  regretContext: string,
  opts: { apiKey: string } = { apiKey: (import.meta as any).env?.VITE_GROQ_API_KEY ?? "" }
): Promise<AlibiResult> {
  const input = rawInput.trim();
  if (!input) throw new Error("Empty input");
  if (!opts.apiKey) throw new Error("Missing Groq API Key in .env.local");

  const dailySafe = Math.max((budgetState.monthlyAllowance - budgetState.fixedFees) / Math.max(budgetState.remainingDays, 1), 0);

  const SYSTEM_PROMPT = `You are Alibi, a ruthless financial social-defense AI coach for students.
  Daily Safe Budget: ₹${Math.round(dailySafe)}. Spent today: ₹${budgetState.spentToday}.
  PAST REGRETS: ${regretContext || "None."}

  Classify input into ONE mode:
  1. "transaction": already happened.
  2. "advice": about to happen (pre-spend check).
  3. "iou_nudge": paid for someone else.

  Rules:
  - If advice: check PAST REGRETS. Call them out if repeating a regret. If friends mentioned, generate socialScripts to say no.
  - If iou_nudge: extract iouBorrower name. Generate socialScripts to ask for money back.
  - OUTPUT PURE JSON ONLY. No markdown.
  SCHEMA: { "mode": "advice", "data": { "amount": 0, "category": "Food", "merchant": "Name", "type": "expense", "verdict": "go_ahead", "regretRiskScore": 0, "peerPressureDetected": false, "iouBorrower": "Name", "aiCoachMessage": "Message", "socialScripts": { "funny": "", "honest": "", "firm": "", "counterPlan": "" } } }`;

  const url = `https://api.groq.com/openai/v1/chat/completions`;
  
  const res = await fetch(url, {
    method: "POST", 
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b", // Using Groq's universal open-weights endpoint
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `INPUT: "${input}"` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Groq API Error: ${errorData?.error?.message || res.status}`);
  }

  const json = await res.json();
  
  try {
    return JSON.parse(json.choices[0].message.content) as AlibiResult;
  } catch (err) {
    throw new Error("AI returned corrupted JSON data.");
  }
}