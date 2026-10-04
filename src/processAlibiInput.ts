// src/processAlibiInput.ts
export type Category = "Food" | "Travel" | "Social" | "Academic" | "Income";

export interface BudgetState {
  monthlyAllowance: number;
  fixedFees: number;
  remainingDays: number;
  spentToday: number;
  persona?: "hostel_kid" | "gentle_mentor" | "strict_accountant";
  roastMode?: "gentle" | "savage" | "absolute_menace";
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
    futureTrade?: string;
    friendGroupTag?: string;
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

  // --- CLIENT-SIDE PSYCHOLOGICAL STATE MACHINE PARAMETERS ---
  const discretionary = Math.max(budgetState.monthlyAllowance - budgetState.fixedFees, 0);
  const dailySafe = Math.max(discretionary / Math.max(budgetState.remainingDays, 1), 0);
  
  // 1. Velocity Tracking: Calculate burn velocity ratio compared to safe daily allowance
  const burnVelocity = dailySafe > 0 ? (budgetState.spentToday / dailySafe).toFixed(2) : "1.00";

  // 2. Social-Context Tagging: Detect if spend is social temptation or solo necessity
  const isSocial = /cafe|café|movie|party|club|friends|squad|drinks|hangout|pizza/i.test(input);
  const socialTag = isSocial ? "SOCIAL_TEMPTATION" : "SOLO_NECESSITY";

  // 3. Aggression Multiplier & Persona Mapping
  const personaStyle = 
    budgetState.persona === "gentle_mentor" 
      ? "You are a warm, supportive financial mentor who guides university students with empathy and gentle encouragement." 
      : budgetState.persona === "strict_accountant"
      ? "You are a strict, no-nonsense corporate auditor who treats every rupee with extreme corporate discipline."
      : "You are Alibi, an elite, street-smart financial manager and social-defense AI built specifically for university and college hostel students. You use witty hostel slang, call out bad spending, and understand mess-life fatigue.";

  const roastTone =
    budgetState.roastMode === "absolute_menace"
      ? "ROAST MODE: ABSOLUTE MENACE. Be brutally sarcastic, mercilessly roast terrible financial choices, and hold nothing back."
      : budgetState.roastMode === "savage"
      ? "ROAST MODE: SAVAGE. Call out bad choices directly with sharp wit."
      : "ROAST MODE: GENTLE. Keep it light and friendly.";

  const SYSTEM_PROMPT = `${personaStyle}
  
  ${roastTone}

  DYNAMIC STATE MACHINE CONTEXT:
  - Daily Safe Budget: ₹${Math.round(dailySafe)}
  - Spent Today: ₹${budgetState.spentToday}
  - Burn Velocity Ratio: ${burnVelocity}x of daily limit
  - Context Tag: ${socialTag}
  - Days Left in Month: ${budgetState.remainingDays}
  - PAST STUDENT REGRETS: ${regretContext || "None recorded yet."}

  CLASSIFY THE USER INPUT INTO ONE MODE:
  1. "transaction": Money already spent or received.
  2. "advice": Pre-spend check / peer pressure dilemma ("Should I buy...", "Friends want to go to...").
  3. "iou_nudge": Paid for someone else and need to ask for money back.

  OUTPUT PURE JSON ONLY. No markdown blocks, no backticks.

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
      "futureTrade": "string",
      "friendGroupTag": "string",
      "iouBorrower": "string",
      "aiCoachMessage": "1-2 punchy sentences matching your persona and roast mode.",
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
      temperature: 0.5
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Groq API Error: ${errorData?.error?.message || res.status}`);
  }

  const json = await res.json();
  
  try {
    const parsed = JSON.parse(json.choices[0].message.content) as AlibiResult;
    
    // Safety check: if the AI accidentally returned a decimal like 0.8 instead of 80, fix it
    if (parsed.mode === "advice" && parsed.data && typeof parsed.data.regretRiskScore === "number") {
      if (parsed.data.regretRiskScore > 0 && parsed.data.regretRiskScore <= 1) {
        parsed.data.regretRiskScore = Math.round(parsed.data.regretRiskScore * 100);
      }
    }
    
    return parsed;
  } catch (err) {
    throw new Error("AI returned corrupted JSON data.");
  }
}