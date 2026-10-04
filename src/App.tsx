// src/App.tsx
import { useMemo, useRef, useState, useEffect } from "react";
import { Send, Loader2, Sparkles, ReceiptText, MessageCircle, Copy, CheckCircle2, HandCoins, ThumbsUp, ThumbsDown, AlertCircle, LayoutDashboard, Settings as SettingsIcon, PieChart, Coffee, Train, Users, ShieldCheck, Flame, ArrowUpRight, Scale, Users2, PlusCircle } from "lucide-react";
import { processAlibiSafe, type ResolveSource } from "./processAlibiSafe";
import type { AlibiResult, AdviceResult, IouResult } from "./processAlibiInput";
import SayNoScript from "./SayNoScript";
import { useAlibiDb } from "./hooks/useAlibiDb";

const PRESETS = [
  { label: "₹180 Canteen", text: "180 canteen momos", icon: Coffee },
  { label: "₹50 Auto", text: "auto 50 to main gate", icon: Train },
  { label: "Plan: ₹800 Café", text: "Friends want to go to a café tonight, planning to spend 800", icon: Users },
] as const;

const inr = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

// Refined Apple-coded pressure themes (Moving away from harsh mono-orange to dynamic amber/rose/emerald)
const pressureTheme = (pct: number) =>
  pct < 0.6
    ? { stroke: "#f59e0b", text: "text-amber-400", label: "Chill", glow: "shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)]" }
    : pct < 0.9
    ? { stroke: "#f97316", text: "text-orange-500", label: "Watch it", glow: "shadow-[0_0_50px_-10px_rgba(249,115,22,0.4)]" }
    : { stroke: "#f43f5e", text: "text-rose-500", label: "Danger", glow: "shadow-[0_0_60px_-10px_rgba(244,63,94,0.5)]" };

const VERDICT = {
  go_ahead: { label: "GO AHEAD", cls: "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]" },
  think_twice: { label: "THINK TWICE", cls: "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]" },
  skip: { label: "SKIP IT", cls: "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]" },
} as const;

// Rich Apple-grade chart palette (Indigo, Emerald, Amber, Rose, Violet)
const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

export default function App() {
  const { profile, spentToday, totalSpent, categoryTotals = {}, pendingRegret, regretContext, loading: dbLoading, rateTransaction, saveTransaction, updateProfile } = useAlibiDb();
  
  const [activeTab, setActiveTab] = useState<"coach" | "history" | "settings">("coach");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AlibiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ResolveSource | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [resultId, setResultId] = useState(0);
  const busy = useRef(false);

  const [monthlyInput, setMonthlyInput] = useState("15000");
  const [feesInput, setFeesInput] = useState("3000");
  const [daysInput, setDaysInput] = useState("20");
  const [persona, setPersona] = useState<"hostel_kid" | "gentle_mentor" | "strict_accountant">("hostel_kid");
  const [roastMode, setRoastMode] = useState<"gentle" | "savage" | "absolute_menace">("savage");
  
  const [bailoutAmount, setBailoutAmount] = useState("");
  const [bailoutNote, setBailoutNote] = useState("");

  useEffect(() => {
    if (profile) {
      setMonthlyInput(profile.monthlyAllowance.toString());
      setFeesInput(profile.fixedFees.toString());
      setDaysInput(profile.remainingDays.toString());
    }
  }, [profile]);

  const dailySafe = useMemo(() => {
    if (!profile) return 0;
    return Math.max((profile.monthlyAllowance - profile.fixedFees - totalSpent) / Math.max(profile.remainingDays, 1), 0);
  }, [profile, totalSpent]);

  const left = dailySafe - spentToday;
  const pressure = dailySafe > 0 ? spentToday / dailySafe : 1;
  const theme = pressureTheme(pressure);

  const R = 86;
  const C = 2 * Math.PI * R;
  const fill = Math.min(Math.max(left / (dailySafe || 1), 0), 1);

  const handleInput = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy.current || !profile) return;
    busy.current = true; setLoading(true); setError(null);
    try {
      const budgetState = { 
        monthlyAllowance: profile.monthlyAllowance - totalSpent, 
        fixedFees: profile.fixedFees, 
        remainingDays: profile.remainingDays, 
        spentToday,
        persona,
        roastMode
      };
      
      const { result: res, source: src, ms } = await processAlibiSafe(clean, budgetState, regretContext);
      
      setResult(res); setSource(src); setLatency(ms); setResultId((n) => n + 1);
      
      if (res.mode === "transaction") {
        await saveTransaction(res.data.amount, res.data.category, res.data.merchant, res.data.type || 'expense');
      } else if (res.mode === "iou_nudge") {
        await saveTransaction(res.data.amount, res.data.category, res.data.iouBorrower || 'Friend', 'iou', res.data.iouBorrower);
      }
      setInput("");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      busy.current = false; setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updateProfile) {
      try {
        await updateProfile({ monthlyAllowance: Number(monthlyInput), fixedFees: Number(feesInput), remainingDays: Number(daysInput) });
        alert("Settings & AI Vibe updated successfully!");
        setActiveTab("coach");
      } catch (err) {
        console.error("Settings save error:", err);
        alert("Failed to save settings.");
      }
    }
  };

  const handleBailout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(bailoutAmount);
    if (!amt || amt <= 0 || !profile) return;
    
    try {
      if (saveTransaction) {
        await saveTransaction(amt, "Income", bailoutNote || "Parent Bailout / Top-up", "income");
      }
      if (updateProfile) {
        const newAllowance = (profile.monthlyAllowance || 0) + amt;
        setMonthlyInput(newAllowance.toString());
        await updateProfile({ monthlyAllowance: newAllowance });
      }
      setBailoutAmount("");
      setBailoutNote("");
      alert(`Successfully added ${inr(amt)} to your budget pool!`);
    } catch (err) {
      console.error("Bailout error:", err);
      alert("Failed to process bailout.");
    }
  };

  const logAnyway = (r: AdviceResult) => {
    saveTransaction(r.data.amount, r.data.category, r.data.item, "expense");
    setResult({ mode: "transaction", data: { amount: r.data.amount, category: r.data.category, merchant: r.data.item, type: "expense", aiCoachMessage: "Logged anyway. Adjusting tomorrow's budget." }});
  };

  if (dbLoading) return <div className="min-h-screen bg-[#0b0b0c] flex flex-col items-center justify-center text-amber-400"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-[#0b0b0c] flex justify-center selection:bg-indigo-500/30 font-sans">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col bg-[#121214] text-neutral-100 overflow-clip shadow-2xl border-x border-white/10">
        
        {/* Subtle dynamic background ambient glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-[120px] opacity-15 transition-colors duration-700" style={{ background: theme.stroke }} />

        <header className="relative flex items-center justify-between px-5 pt-6 pb-2 z-20">
          <div className="flex items-center gap-2.5">
            {/* Concept A Logo: Shield-Pulse in Cupertino Amber */}
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="2 12 7 12 9 8 13 16 15 12 20 12" />
            </svg>
            <span className="font-semibold tracking-tight text-xl text-white">Alibi</span>
          </div>
          {activeTab === "coach" && <StageIndicator source={source} ms={latency} />}
        </header>

        <div className="flex-1 overflow-y-auto pb-44">
          {activeTab === "coach" && (
            <div className="animate-rise">
              <section className="relative flex flex-col items-center pt-6">
                <div className={`relative h-[220px] w-[220px] rounded-full flex items-center justify-center bg-[#1c1c1e]/80 border border-white/10 ios-glass ${theme.glow}`}>
                  <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-2xl">
                    <circle cx="100" cy="100" r={R} fill="none" stroke="#2c2c2e" strokeWidth="12" />
                    <circle cx="100" cy="100" r={R} fill="none" stroke={theme.stroke} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - fill)} style={{ transition: "stroke-dashoffset 700ms ease, stroke 500ms ease", filter: `drop-shadow(0 0 10px ${theme.stroke})` }} />
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1 font-medium">{left >= 0 ? "Safe to spend" : "Over limit"}</span>
                    <span className={`font-mono text-5xl font-light tabular-nums tracking-tighter text-white`}>{left < 0 ? "−" : ""}{inr(left)}</span>
                    <span className="mt-1 text-xs text-neutral-500 font-medium">of {inr(dailySafe)} / day</span>
                  </div>
                </div>
                <div className={`mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur-md`}>
                  {pressure >= 0.9 ? <Flame className="h-4 w-4 text-rose-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
                  <span className={theme.text}>{theme.label}</span> · {Math.round(pressure * 100)}% used
                </div>
              </section>

              {pendingRegret && (
                <div className="mx-5 mb-2 mt-8 p-5 rounded-[24px] ios-glass-card relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10"><Sparkles size={80} /></div>
                  <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold mb-2">Hindsight Check</p>
                  <p className="text-sm text-neutral-200 mb-4">You spent <span className="font-mono text-white font-bold">₹{pendingRegret.amount}</span> at {pendingRegret.merchant}. Worth it?</p>
                  <div className="flex gap-2">
                    <button onClick={() => rateTransaction(pendingRegret.id, false)} className="flex-1 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ThumbsDown size={14}/> Regret it</button>
                    <button onClick={() => rateTransaction(pendingRegret.id, true)} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ThumbsUp size={14}/> Worth it</button>
                  </div>
                </div>
              )}

              <section className="relative px-5 pt-8 space-y-4">
                {loading && <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-400"><Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Evaluating risk model...</div>}
                {!loading && error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">{error}</div>}
                {!loading && !error && !result && <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-neutral-500">Type what you spent, or ask Alibi financial manager.</div>}
                {!loading && result?.mode === "advice" && <div key={resultId} className="animate-rise"><AdviceCard r={result} onLog={() => logAnyway(result)} onCancel={() => setResult(null)} /></div>}
                {!loading && result?.mode === "transaction" && <div key={resultId} className="animate-rise"><LedgerCard r={result} onCancel={() => setResult(null)} /></div>}
                {!loading && result?.mode === "iou_nudge" && <div key={resultId} className="animate-rise"><IouCard r={result} onCancel={() => setResult(null)} /></div>}
              </section>
            </div>
          )}

          {activeTab === "history" && (
            <div className="px-5 pt-6 space-y-6 animate-rise">
              <div className="p-6 rounded-[24px] ios-glass-card flex flex-col items-center">
                <DonutChart totals={categoryTotals} totalSpent={totalSpent} />
                <div className="mt-6 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1">Total Spent</p>
                  <p className="font-mono text-3xl font-light text-white">{inr(totalSpent)}</p>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2"><Users2 size={15} className="text-indigo-400"/> Regret Circles (Social Patterns)</h2>
                <div className="space-y-3 ios-glass-card p-5 rounded-[24px]">
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-white">Weekend Hangouts</p>
                      <p className="text-[10px] text-neutral-500">High temptation zone</p>
                    </div>
                    <span className="font-mono text-xs font-medium text-rose-400">75% regret</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-white">Hostel Mess Crew</p>
                      <p className="text-[10px] text-neutral-500">Casual canteen runs</p>
                    </div>
                    <span className="font-mono text-xs font-medium text-amber-400">40% regret</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-white">Study-Group Lunches</p>
                      <p className="text-[10px] text-neutral-500">Productive & low spend</p>
                    </div>
                    <span className="font-mono text-xs font-medium text-emerald-400">10% regret</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2"><PieChart size={15} className="text-indigo-400"/> Envelope Breakdown</h2>
                <div className="space-y-5 ios-glass-card p-5 rounded-[24px]">
                  {Object.keys(categoryTotals).length > 0 ? (
                    Object.entries(categoryTotals)
                      .sort(([, a], [, b]) => b - a) 
                      .map(([cat, amt], idx) => {
                      if (amt <= 0) return null;
                      
                      const truePct = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
                      const maxBudgetForVisuals = Math.max((profile?.monthlyAllowance || 15000) * 0.3, totalSpent); 
                      const barPct = Math.min((amt / maxBudgetForVisuals) * 100, 100);
                      const catColor = CHART_COLORS[idx % CHART_COLORS.length];

                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1.5 font-medium">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catColor }}></span>
                              <span className="text-neutral-300">{cat}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-neutral-500 text-xs mt-0.5">{truePct}%</span>
                              <span className="font-mono text-white" style={{ color: catColor }}>{inr(amt)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${barPct}%`, backgroundColor: catColor }}></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-xs text-neutral-500 py-4">No spending data yet. Log a transaction!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="px-5 pt-6 space-y-6 animate-rise">
              <div className="p-5 rounded-[24px] bg-amber-500/5 border border-amber-500/20 space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <PlusCircle size={16} />
                  <h2 className="text-xs font-semibold uppercase tracking-widest">Emergency Bailout / Top-Up</h2>
                </div>
                <p className="text-xs text-neutral-400">Got cash from home or a freelance gig? Inject it instantly into your safe allowance.</p>
                <form onSubmit={handleBailout} className="space-y-3">
                  <input type="number" placeholder="Amount (e.g. 2000)" value={bailoutAmount} onChange={(e) => setBailoutAmount(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono" />
                  <input type="text" placeholder="Note (e.g. Mom sent GPay)" value={bailoutNote} onChange={(e) => setBailoutNote(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400" />
                  <button type="submit" className="w-full py-2.5 rounded-xl bg-amber-400 text-black font-semibold text-xs uppercase tracking-wider hover:bg-amber-300 transition-all active:scale-95">Claim Bailout</button>
                </form>
              </div>

              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-2"><SettingsIcon size={15} className="text-indigo-400"/> AI Persona & Budget Config</h2>
                <form onSubmit={handleSaveSettings} className="space-y-4 ios-glass-card p-5 rounded-[24px]">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1.5 font-medium">AI Persona Vibe</label>
                    <select value={persona} onChange={(e: any) => setPersona(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500">
                      <option value="hostel_kid">Street-Smart Hostel Kid (Witty & Real)</option>
                      <option value="gentle_mentor">Gentle Mentor (Supportive & Calm)</option>
                      <option value="strict_accountant">Strict Accountant (No-Nonsense)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1.5 font-medium">Roast Aggression Level</label>
                    <select value={roastMode} onChange={(e: any) => setRoastMode(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500">
                      <option value="gentle">Gentle Nudge</option>
                      <option value="savage">Savage Roast</option>
                      <option value="absolute_menace">Absolute Menace (Brutal)</option>
                    </select>
                  </div>
                  <div><label className="text-xs text-neutral-400 block mb-1.5 font-medium">Monthly Allowance (₹)</label><input type="number" value={monthlyInput} onChange={(e) => setMonthlyInput(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono" /></div>
                  <div><label className="text-xs text-neutral-400 block mb-1.5 font-medium">Fixed Fees / Mess (₹)</label><input type="number" value={feesInput} onChange={(e) => setFeesInput(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono" /></div>
                  <div><label className="text-xs text-neutral-400 block mb-1.5 font-medium">Remaining Days</label><input type="number" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono" /></div>
                  <button type="submit" className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 mt-2 shadow-lg shadow-indigo-600/20">Save Settings</button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Input tray with Presets */}
        {activeTab === "coach" && (
          <div className="absolute bottom-[72px] w-full px-4 pt-4 pb-2 bg-gradient-to-t from-[#121214] via-[#121214]/95 to-transparent z-40">
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {PRESETS.map(({ label, text, icon: Icon }) => (
                <button key={label} disabled={loading} onClick={() => setInput(text)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-neutral-300 hover:bg-white/10 active:scale-95 whitespace-nowrap transition-all">
                  <Icon className="h-3 w-3 text-amber-400" />{label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1c1c1e]/90 ios-glass py-1.5 pl-4 pr-1.5 shadow-2xl focus-within:border-indigo-500 transition-colors">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleInput(input)} placeholder="Ask Alibi financial manager..." className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none" />
              <button onClick={() => handleInput(input)} disabled={loading || !input.trim()} className="grid h-10 w-10 place-items-center rounded-xl text-white active:scale-95 disabled:opacity-40 transition-transform bg-indigo-600 shadow-md shadow-indigo-600/30"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        <nav className="absolute bottom-0 w-full h-[72px] border-t border-white/10 ios-glass px-6 flex items-center justify-around z-50">
          <button onClick={() => setActiveTab("coach")} className={`flex flex-col items-center gap-1.5 transition-colors active:scale-95 ${activeTab === "coach" ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" : "text-neutral-500 hover:text-neutral-300"}`}><LayoutDashboard size={20} /><span className="text-[10px] font-medium tracking-wider">Coach</span></button>
          <button onClick={() => setActiveTab("history")} className={`flex flex-col items-center gap-1.5 transition-colors active:scale-95 ${activeTab === "history" ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" : "text-neutral-500 hover:text-neutral-300"}`}><PieChart size={20} /><span className="text-[10px] font-medium tracking-wider">Envelopes</span></button>
          <button onClick={() => setActiveTab("settings")} className={`flex flex-col items-center gap-1.5 transition-colors active:scale-95 ${activeTab === "settings" ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" : "text-neutral-500 hover:text-neutral-300"}`}><SettingsIcon size={20} /><span className="text-[10px] font-medium tracking-wider">Config</span></button>
        </nav>
      </div>
    </div>
  );
}

/* Subcomponents */
function DonutChart({ totals, totalSpent }: { totals: Record<string, number>, totalSpent: number }) {
  if (totalSpent === 0) return <div className="w-32 h-32 rounded-full border-[8px] border-white/5"></div>;
  
  let cumulativePercent = 0;
  const radius = 15.91549430918954; 
  const entries = Object.entries(totals).filter(([, amt]) => amt > 0).sort(([, a], [, b]) => b - a);

  return (
    <svg viewBox="0 0 42 42" className="w-40 h-40 drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
      <circle cx="21" cy="21" r={radius} fill="transparent" stroke="#2c2c2e" strokeWidth="8" />
      {entries.map(([cat, amt], idx) => {
        const percent = (amt / totalSpent) * 100;
        const offset = 100 - cumulativePercent + 25; 
        cumulativePercent += percent;
        
        return (
          <circle 
            key={cat} cx="21" cy="21" r={radius} 
            fill="transparent" 
            stroke={CHART_COLORS[idx % CHART_COLORS.length]} 
            strokeWidth="8" 
            strokeDasharray={`${percent} ${100 - percent}`} 
            strokeDashoffset={offset} 
            className="transition-all duration-1000 ease-out"
          />
        );
      })}
    </svg>
  );
}

function StageIndicator({ source, ms }: { source: ResolveSource | null; ms: number | null }) {
  const cfg = source === "live" ? { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]", ping: false, label: "Groq Online" } : source === "fallback" ? { dot: "bg-amber-400", ping: true, label: "Fallback" } : { dot: "bg-neutral-600", ping: false, label: "Ready" };
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[9px] font-medium tracking-widest text-neutral-400 backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">{cfg.ping && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />}<span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} /></span>
      {cfg.label} {ms !== null && <span className="font-mono normal-case text-neutral-500 ml-1">{ms}ms</span>}
    </div>
  );
}

function AdviceCard({ r, onLog, onCancel }: { r: AdviceResult; onLog: () => void; onCancel: () => void }) {
  const d = r.data;
  const v = VERDICT[d.verdict as keyof typeof VERDICT] || VERDICT.think_twice;
  const scoreColor = d.regretRiskScore >= 70 ? "text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]" : d.regretRiskScore >= 40 ? "text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" : "text-emerald-400";

  return (
    <div className="space-y-4 rounded-[24px] ios-glass-card p-5 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">Regret risk score</div>
          <div className={`font-mono text-5xl font-light leading-none tabular-nums tracking-tighter ${scoreColor}`}>{d.regretRiskScore}<span className="text-base text-neutral-600 font-normal">/100</span></div>
        </div>
        <div className="text-right">
          <button onClick={onCancel} title="Cancel / Dismiss" className={`inline-block rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-widest ${v.cls} hover:opacity-95 active:scale-95 transition-transform cursor-pointer`}>
            {v.label} ✕
          </button>
          <div className="mt-2.5 font-mono text-xs text-neutral-400 font-medium">{inr(d.amount)} · {d.category}</div>
        </div>
      </div>

      {d.futureTrade && (
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-sm text-amber-100">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-0.5">Future-You Trade</div>
            <p className="font-medium">{d.futureTrade}</p>
          </div>
        </div>
      )}

      {d.peerPressureDetected && d.peerPressureNote && <div className="flex gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-sm text-rose-100"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /><div><div className="text-[10px] font-semibold uppercase tracking-widest text-rose-400 mb-0.5">Peer pressure</div>{d.peerPressureNote}</div></div>}
      {d.cheaperAlternative && <div className="flex gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 text-sm text-indigo-100"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /><div><div className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-0.5">Cheaper alternative</div>{d.cheaperAlternative}</div></div>}
      <div className="flex gap-2.5 text-sm text-neutral-300 font-medium bg-black/40 p-3 rounded-xl border border-white/5"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /><p className="leading-snug">{d.aiCoachMessage}</p></div>
      {d.verdict !== "go_ahead" && d.socialScripts && <SayNoScript scripts={d.socialScripts as any} />}
      <button onClick={onLog} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all">I'm doing it anyway, log it <ArrowUpRight className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function LedgerCard({ r, onCancel }: { r: Extract<AlibiResult, { mode: "transaction" }>; onCancel: () => void }) {
  const d = r.data;
  const txType = d.type || 'expense';
  const income = txType === "income";
  
  return (
    <div className="space-y-3 rounded-[24px] ios-glass-card p-5 shadow-xl relative">
      <button onClick={onCancel} className="absolute right-4 top-4 text-xs font-semibold text-neutral-500 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 active:scale-95">Dismiss ✕</button>
      <div className="flex items-center justify-between pr-16">
        <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/60 border border-white/10"><ReceiptText className="h-5 w-5 text-indigo-400" /></div><div><div className="text-sm font-semibold text-white mb-0.5">{d.merchant}</div><span className="inline-block rounded-full bg-white/5 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-400">{d.category}</span></div></div>
        <div className={`font-mono text-2xl font-light tabular-nums ${income ? "text-emerald-400" : "text-white"}`}>{income ? "+" : "−"}{inr(d.amount)}</div>
      </div>
      <div className="flex gap-2.5 bg-black/40 p-3 rounded-xl border border-white/5 text-sm text-neutral-300 font-medium"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /><p className="leading-snug">{d.aiCoachMessage}</p></div>
    </div>
  );
}

function IouCard({ r, onCancel }: { r: IouResult; onCancel: () => void }) {
  const { data: d } = r;
  return (
    <div className="space-y-4 rounded-[24px] ios-glass-card p-5 shadow-xl relative">
      <button onClick={onCancel} className="absolute right-4 top-4 text-xs font-semibold text-neutral-500 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 active:scale-95">Dismiss ✕</button>
      <div className="flex items-center justify-between pr-16">
        <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/60 border border-white/10"><HandCoins className="h-5 w-5 text-amber-400" /></div><div><div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-0.5">IOU Tracked</div><div className="text-sm font-semibold text-white">{d.iouBorrower}</div></div></div>
        <div className="font-mono text-2xl font-light tabular-nums text-white">{inr(d.amount)}</div>
      </div>
      {d.socialScripts && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold mb-3 flex items-center gap-2"><MessageCircle size={14}/> Gentle Nudge Scripts</p>
          <div className="space-y-2">
            {d.socialScripts.funny && <ScriptButton label="Funny Text" text={d.socialScripts.funny} color="text-amber-400" />}
            {d.socialScripts.honest && <ScriptButton label="Direct Ask" text={d.socialScripts.honest} color="text-indigo-400" />}
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptButton({ label, text, color }: { label: string, text: string, color: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  
  return (
    <button onClick={handleCopy} className={`w-full text-left p-3 rounded-xl border border-white/10 bg-black/50 hover:bg-white/5 transition-colors relative group active:scale-[0.98]`}>
      <span className={`text-[10px] font-semibold uppercase tracking-widest block mb-1.5 ${color}`}>{label}</span>
      <p className="text-sm text-neutral-300 pr-8 leading-snug">{text}</p>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity">
        {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
      </div>
    </button>
  );
}