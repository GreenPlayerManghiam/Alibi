import { useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Coffee,
  Flame,
  Lightbulb,
  Loader2,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Train,
  Users,
} from "lucide-react";
import { processSpendPulseSafe, type ResolveSource } from "./processSpendPulseSafe";
import type { SpendPulseResult, AdviceResult } from "./processSpendPulseInput";

/* ------------------------------------------------------------------ */
/* Demo profile (swap for Supabase `profiles` + summed `transactions`) */
/* ------------------------------------------------------------------ */
const PROFILE = { monthlyAllowance: 10000, fixedFees: 3000, remainingDays: 18 };
const SEED = { totalSpent: 690, spentToday: 230 }; // momos 180 + auto 50

const PRESETS = [
  { label: "₹180 Canteen", text: "180 canteen momos", icon: Coffee },
  { label: "₹50 Auto", text: "auto 50 to main gate", icon: Train },
  { label: "Plan: ₹800 Café", text: "Friends want to go to a café tonight, planning to spend 800. Should I?", icon: Users },
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const inr = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

const pressureTheme = (pct: number) =>
  pct < 0.6
    ? { stroke: "#a3e635", text: "text-lime-300", label: "Chill", glow: "shadow-lime-400/20" }
    : pct < 0.9
    ? { stroke: "#fbbf24", text: "text-amber-300", label: "Watch it", glow: "shadow-amber-400/20" }
    : { stroke: "#fb7185", text: "text-rose-400", label: "Danger", glow: "shadow-rose-500/30" };

const VERDICT = {
  go_ahead: { label: "GO AHEAD", cls: "bg-lime-300 text-lime-950" },
  think_twice: { label: "THINK TWICE", cls: "bg-amber-300 text-amber-950" },
  skip: { label: "SKIP IT", cls: "bg-rose-400 text-rose-950" },
} as const;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function SpendPulseApp() {
  const [totalSpent, setTotalSpent] = useState(SEED.totalSpent);
  const [spentToday, setSpentToday] = useState(SEED.spentToday);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpendPulseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ResolveSource | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const busy = useRef(false);

  // Real math: ((allowance - fixedFees) - totalSpent) / remainingDays
  const dailySafe = useMemo(
    () =>
      Math.max(
        (PROFILE.monthlyAllowance - PROFILE.fixedFees - totalSpent) / Math.max(PROFILE.remainingDays, 1),
        0
      ),
    [totalSpent]
  );
  const left = dailySafe - spentToday;
  const pressure = dailySafe > 0 ? spentToday / dailySafe : 1;
  const theme = pressureTheme(pressure);

  const R = 86;
  const C = 2 * Math.PI * R;
  const fill = Math.min(Math.max(left / (dailySafe || 1), 0), 1);

  const commit = (amount: number, type: "expense" | "income") => {
    if (type === "income") {
      setTotalSpent((t) => Math.max(t - amount, 0));
    } else {
      setTotalSpent((t) => t + amount);
      setSpentToday((s) => s + amount);
    }
  };

  const handleInput = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const budgetState = {
        monthlyAllowance: PROFILE.monthlyAllowance - totalSpent,
        fixedFees: PROFILE.fixedFees,
        remainingDays: PROFILE.remainingDays,
        spentToday,
      };
      const { result: res, source: src, ms } = await processSpendPulseSafe(clean, budgetState);
      setResult(res);
      setSource(src);
      setLatency(ms);
      if (res.mode === "transaction") commit(res.data.amount, res.data.type);
      setInput("");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const logAnyway = (r: AdviceResult) => {
    commit(r.data.amount, "expense");
    setResult({
      mode: "transaction",
      data: {
        amount: r.data.amount, category: r.data.category, merchant: r.data.item,
        type: "expense", aiCoachMessage: "Your call. Logged it, so I'll tighten tomorrow's budget.",
      },
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col bg-gradient-to-b from-[#12131a] via-[#0d0e13] to-black text-neutral-100 overflow-clip">
        <StageIndicator source={source} ms={latency} />

        {/* ambient glow tied to pressure */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl opacity-25 transition-colors duration-700"
          style={{ background: theme.stroke }}
        />

        {/* Header */}
        <header className="relative flex items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" style={{ color: theme.stroke }} />
            <span className="font-semibold tracking-tight text-lg">SpendPulse</span>
          </div>
          <span className="text-[11px] uppercase tracking-widest text-neutral-500">
            {PROFILE.remainingDays} days left
          </span>
        </header>

        {/* Ring gauge */}
        <section className="relative flex flex-col items-center pt-6">
          <div className={`relative h-[220px] w-[220px] rounded-full shadow-2xl ${theme.glow}`}>
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle cx="100" cy="100" r={R} fill="none" stroke="#1f2130" strokeWidth="14" />
              <circle
                cx="100" cy="100" r={R} fill="none"
                stroke={theme.stroke} strokeWidth="14" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - fill)}
                style={{ transition: "stroke-dashoffset 700ms ease, stroke 500ms ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] uppercase tracking-widest text-neutral-500">
                {left >= 0 ? "safe to spend today" : "over today's limit"}
              </span>
              <span className={`font-mono text-5xl font-bold tabular-nums ${theme.text}`}>
                {left < 0 ? "−" : ""}{inr(left)}
              </span>
              <span className="mt-1 text-xs text-neutral-500">of {inr(dailySafe)} / day</span>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs ${theme.text}`}>
            {pressure >= 0.9 ? <Flame className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {theme.label} · {Math.round(pressure * 100)}% used
          </div>
        </section>

        {/* Dual-mode output card */}
        <section className="relative flex-1 px-5 pt-6 pb-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the vibe…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
          )}

          {!loading && !error && !result && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-neutral-500">
              Type what you spent, or what you're <em>about</em> to spend.
            </div>
          )}

          {!loading && result?.mode === "advice" && <AdviceCard r={result} onLog={() => logAnyway(result)} />}
          {!loading && result?.mode === "transaction" && <LedgerCard r={result} />}
        </section>

        {/* Quick input dock */}
        <footer className="sticky bottom-0 border-t border-white/10 bg-black/70 px-4 pb-5 pt-3 backdrop-blur-xl">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {PRESETS.map(({ label, text, icon: Icon }) => (
              <button
                key={label}
                disabled={loading}
                onClick={() => handleInput(text)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 transition active:scale-95 hover:bg-white/10 disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: theme.stroke }} />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-1.5 pl-4 pr-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInput(input)}
              placeholder='"Paid 480 lunch with Riya" or "Should I…"'
              className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
            />
            <button
              onClick={() => handleInput(input)}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="grid h-9 w-9 place-items-center rounded-xl text-black transition active:scale-95 disabled:opacity-40"
              style={{ background: theme.stroke }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage indicator (presenter-only status pill)                        */
/* ------------------------------------------------------------------ */
function StageIndicator({ source, ms }: { source: ResolveSource | null; ms: number | null }) {
  const cfg =
    source === "live"
      ? { dot: "bg-lime-400", ping: false, label: "AI Online" }
      : source === "fallback"
      ? { dot: "bg-amber-400", ping: true, label: "Local Fallback" }
      : { dot: "bg-neutral-600", ping: false, label: "Ready" };

  return (
    <div
      className="pointer-events-none absolute right-3 top-2 z-10 flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-widest text-neutral-500 opacity-70"
      aria-hidden
    >
      <span className="relative flex h-1.5 w-1.5">
        {cfg.ping && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      {cfg.label}
      {ms !== null && <span className="font-mono normal-case tracking-normal text-neutral-600">{ms}ms</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */
function AdviceCard({ r, onLog }: { r: AdviceResult; onLog: () => void }) {
  const d = r.data;
  const v = VERDICT[d.verdict];
  const scoreColor = d.regretRiskScore >= 70 ? "text-rose-400" : d.regretRiskScore >= 40 ? "text-amber-300" : "text-lime-300";

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Regret risk</div>
          <div className={`font-mono text-6xl font-bold leading-none tabular-nums ${scoreColor}`}>
            {d.regretRiskScore}
            <span className="text-lg text-neutral-600">/100</span>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-md px-2.5 py-1 text-[11px] font-black tracking-wider ${v.cls}`}>{v.label}</span>
          <div className="mt-2 font-mono text-sm text-neutral-400">{inr(d.amount)} · {d.category}</div>
        </div>
      </div>

      {d.peerPressureDetected && d.peerPressureNote && (
        <div className="flex gap-2.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-3 text-sm text-fuchsia-100">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Peer pressure detected</div>
            {d.peerPressureNote}
          </div>
        </div>
      )}

      {d.cheaperAlternative && (
        <div className="flex gap-2.5 rounded-xl border border-lime-300/25 bg-lime-300/10 p-3 text-sm text-lime-100">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-lime-300">Cheaper move</div>
            {d.cheaperAlternative}
          </div>
        </div>
      )}

      <div className="flex gap-2 text-sm text-neutral-200">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <p className="leading-snug">{d.aiCoachMessage}</p>
      </div>

      <button
        onClick={onLog}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-white/10 py-2 text-xs text-neutral-400 transition hover:bg-white/5 active:scale-[0.98]"
      >
        I'm doing it anyway, log it <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LedgerCard({ r }: { r: Extract<SpendPulseResult, { mode: "transaction" }> }) {
  const d = r.data;
  const income = d.type === "income";
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <ReceiptText className="h-5 w-5 text-neutral-300" />
          </div>
          <div>
            <div className="text-sm font-semibold">{d.merchant}</div>
            <span className="mt-0.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
              {d.category}
            </span>
          </div>
        </div>
        <div className={`font-mono text-2xl font-bold tabular-nums ${income ? "text-lime-300" : "text-rose-400"}`}>
          {income ? "+" : "−"}{inr(d.amount)}
        </div>
      </div>
      <div className="flex gap-2 border-t border-white/10 pt-3 text-sm text-neutral-200">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <p className="leading-snug">{d.aiCoachMessage}</p>
      </div>
    </div>
  );
}
