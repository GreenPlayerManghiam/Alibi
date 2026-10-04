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
  data: { 
    amount: number; 
    category: Category; 
    item: string; 
    verdict: "go_ahead" | "think_twice" | "skip"; 
    regretRiskScore: number; 
    peerPressureDetected: boolean; 
    peerPressureNote?: string; 
    aiCoachMessage: string; 
    socialScripts?: SocialScripts; 
    cheaperAlternative?: string; 
  };
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

  const SYSTEM_PROMPT = `You are Alibi, an elite, street-smart financial manager and social-defense AI built specifically for university and college hostel students. 
  
  CURRENT FINANCIAL CONTEXT:
  - Daily Safe Budget: ₹${Math.round(dailySafe)}
  - Spent Today: ₹${budgetState.spentToday}
  - Days Left in Month: ${budgetState.remainingDays}
  - PAST STUDENT REGRETS: ${regretContext || "None recorded yet."}

  CLASSIFY THE USER INPUT INTO ONE MODE:
  1. "transaction": Money already spent or received.
  2. "advice": Pre-spend check / peer pressure dilemma ("Should I buy...", "Friends want to go to...").
  3. "iou_nudge": Paid for someone else and need to ask for money back.

  COACHING RULES:
  - Speak like a sharp, modern financial manager who actually understands student life.
  - If giving advice, cross-reference PAST REGRETS. If they are about to repeat a past mistake, call them out directly!
  - Generate killer WhatsApp "social defense scripts".
  - OUTPUT PURE JSON ONLY. No markdown blocks, no backticks.

  EXACT JSON SCHEMA TO RETURN:
  {
    "mode": "transaction" | "advice" | "iou_nudge",
    "data": {
      "amount": number,
      "category": "Food" | "Travel" | "Social" | "Academic" | "Income",
      "merchant": "string",
      "item": "string",
      "type": "expense" | "income",
      "verdict": "go_ahead" | "think_twice" | "skip",
      "regretRiskScore": number,
      "peerPressureDetected": boolean,
      "peerPressureNote": "string",
      "cheaperAlternative": "string",
      "iouBorrower": "string",
      "aiCoachMessage": "1-2 punchy sentences.",
      "socialScripts": {
        "funny": "string",
        "honest": "string",
        "firm": "string",
        "counterPlan": "string"
      }
    }
  }`;

  const url = `https://api.groq.com/openai/v1/chat/completions`;
  
  const res = await fetch(url, {
    method: "POST", 
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${opts.apiKey}`
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `INPUT: "${input}"` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
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