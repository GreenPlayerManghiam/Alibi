// src/App.tsx
import { useMemo, useRef, useState } from "react";
import { Activity, Send, Loader2, Sparkles, ReceiptText, MessageCircle, Copy, CheckCircle2, HandCoins, ThumbsUp, ThumbsDown, AlertCircle, LayoutDashboard, History, Settings as SettingsIcon } from "lucide-react";
import { processAlibiInput } from "./processAlibiInput";
import { useAlibiDb } from "./hooks/useAlibiDb";
import type { AlibiResult, AdviceResult, IouResult } from "./processAlibiInput";

export default function App() {
  const { profile, spentToday, totalSpent, pendingRegret, regretContext, loading: dbLoading, rateTransaction, saveTransaction, updateProfile } = useAlibiDb();
  
  const [activeTab, setActiveTab] = useState<"coach" | "history" | "settings">("coach");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AlibiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Settings local state initialized from live profile if available
  const [monthlyInput, setMonthlyInput] = useState(profile?.monthlyAllowance?.toString() ?? "15000");
  const [feesInput, setFeesInput] = useState(profile?.fixedFees?.toString() ?? "3000");
  const [daysInput, setDaysInput] = useState(profile?.remainingDays?.toString() ?? "20");

  const busy = useRef(false);

  const dailySafe = useMemo(() => {
    if (!profile) return 0;
    return Math.max((profile.monthlyAllowance - profile.fixedFees - totalSpent) / Math.max(profile.remainingDays, 1), 0);
  }, [profile, totalSpent]);
  
  const left = dailySafe - spentToday;
  const pressure = dailySafe > 0 ? spentToday / dailySafe : 1;
  const theme = pressure < 0.6 ? { stroke: "#a3e635", text: "text-lime-300", label: "Chill" } : pressure < 0.9 ? { stroke: "#fbbf24", text: "text-amber-300", label: "Watch it" } : { stroke: "#fb7185", text: "text-rose-400", label: "Danger" };

  const handleInput = async (text: string) => {
    if (!text.trim() || busy.current || !profile) return;
    busy.current = true; setLoading(true); setError(null);
    
    try {
      const budgetState = { monthlyAllowance: profile.monthlyAllowance - totalSpent, fixedFees: profile.fixedFees, remainingDays: profile.remainingDays, spentToday };
      const res = await processAlibiInput(text, budgetState, regretContext);
      setResult(res); 
      
      if (res.mode === "transaction") {
        await saveTransaction(res.data.amount, res.data.category, res.data.merchant, res.data.type);
      } else if (res.mode === "iou_nudge") {
        await saveTransaction(res.data.amount, res.data.category, res.data.iouBorrower || 'Friend', 'iou', res.data.iouBorrower);
      }
      setInput("");
    } catch (err: any) {
      setError(err.message || "Failed to connect to AI.");
    } finally {
      busy.current = false; setLoading(false);
    }
  };

  const handleLogAdviceAnyway = async (r: AdviceResult) => {
    await saveTransaction(r.data.amount, r.data.category, r.data.item, 'expense');
    setResult({ mode: "transaction", data: { amount: r.data.amount, category: r.data.category, merchant: r.data.item, type: "expense", aiCoachMessage: "Your call. Logged it, so I'll tighten tomorrow's budget." } });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updateProfile) {
      await updateProfile({
        monthlyAllowance: Number(monthlyInput),
        fixedFees: Number(feesInput),
        remainingDays: Number(daysInput)
      });
      alert("Budget profile updated successfully!");
      setActiveTab("coach");
    }
  };

  if (dbLoading) return <div className="min-h-screen bg-neutral-950 flex flex-col gap-4 items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8 text-neutral-500" /><p className="text-sm text-neutral-500">Connecting to Database...</p></div>;

  return (
    <div className="min-h-screen bg-neutral-950 flex justify-center selection:bg-lime-500/30">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col bg-gradient-to-b from-[#0a0a0c] via-[#12131a] to-black text-neutral-100 overflow-hidden shadow-2xl border-x border-neutral-900">
        
        {/* Top Header */}
        <header className="px-5 pt-6 pb-3 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
              <Activity className="h-4 w-4" style={{ color: theme.stroke }} />
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg block leading-none">Alibi.</span>
              <span className="text-[9px] text-neutral-400 tracking-wider uppercase">AI Social-Defense Coach</span>
            </div>
          </div>
          <span className="text-[10px] text-lime-400 font-mono tracking-widest uppercase bg-lime-500/10 px-2.5 py-1 rounded-full border border-lime-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse"></span>Live
          </span>
        </header>

        {/* Dynamic Views Container */}
        <div className="flex-1 overflow-y-auto pb-28">
          {activeTab === "coach" && (
            <div className="space-y-4 animate-fadeIn">
              {pendingRegret && (
                <div className="mx-5 mt-4 p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 shadow-xl relative overflow-hidden backdrop-blur-md">
                  <div className="absolute -right-4 -top-4 opacity-10"><Sparkles size={80} /></div>
                  <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-2">Hindsight Check</p>
                  <p className="text-sm text-indigo-100 mb-4">You spent <span className="font-bold text-white">₹{pendingRegret.amount}</span> at {pendingRegret.merchant}. Worth it?</p>
                  <div className="flex gap-2">
                    <button onClick={() => rateTransaction(pendingRegret.id, false)} className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ThumbsDown size={14}/> Regret it</button>
                    <button onClick={() => rateTransaction(pendingRegret.id, true)} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ThumbsUp size={14}/> Worth it</button>
                  </div>
                </div>
              )}

              {/* Main Gauge Section */}
              <section className="relative flex flex-col items-center pt-6 px-5">
                <div className="w-full bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col items-center relative overflow-hidden shadow-2xl backdrop-blur-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/5 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="relative h-[200px] w-[200px] rounded-full shadow-inner flex items-center justify-center my-2" style={{ boxShadow: `0 0 60px -20px ${theme.stroke}30` }}>
                    <div className="absolute inset-0 rounded-full border-[10px] border-white/5" />
                    <div className="absolute inset-0 rounded-full border-[10px]" style={{ borderColor: theme.stroke, clipPath: `polygon(0 0, 100% 0, 100% ${Math.min(pressure * 100, 100)}%, 0 ${Math.min(pressure * 100, 100)}%)`, transition: "clip-path 1s ease" }} />
                    <div className="text-center z-10">
                      <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-1">Safe to spend</span>
                      <span className={`font-mono text-4xl font-extrabold tabular-nums ${theme.text}`}>₹{Math.max(Math.round(left), 0)}</span>
                      <span className="mt-1 text-xs text-neutral-400 font-medium block">of ₹{Math.round(dailySafe)} / day</span>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">Spent Today</span>
                      <span className="font-mono text-base font-bold text-rose-400">₹{spentToday}</span>
                    </div>
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">Status</span>
                      <span className={`text-xs font-bold uppercase tracking-wide ${theme.text}`}>{theme.label}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* AI Interaction Output */}
              <section className="px-5 space-y-3">
                {error && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}
                {loading && <div className="flex flex-col items-center justify-center p-8 text-neutral-500 gap-2"><Loader2 className="h-6 w-6 animate-spin text-lime-400" /><p className="text-xs">Alibi is evaluating your financial risk...</p></div>}
                
                {!loading && result?.mode === "advice" && <AdviceCard r={result} onLogAnyway={() => handleLogAdviceAnyway(result)} />}
                {!loading && result?.mode === "iou_nudge" && <IouCard r={result} />}
                {!loading && result?.mode === "transaction" && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between backdrop-blur-md">
                    <div className="flex gap-3 items-center">
                      <div className="p-2.5 rounded-xl bg-lime-500/10 text-lime-400"><ReceiptText size={18}/></div>
                      <div><p className="font-semibold text-sm">{result.data.merchant}</p><p className="text-xs text-neutral-400">{result.data.aiCoachMessage}</p></div>
                    </div>
                    <span className="font-mono text-rose-400 font-bold">-₹{result.data.amount}</span>
                  </div>
                )}

                {!loading && !result && (
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-2">
                    <Sparkles className="mx-auto text-amber-400 h-5 w-5" />
                    <p className="text-xs font-medium text-neutral-300">Ready for your prompt</p>
                    <p className="text-[11px] text-neutral-500">Type something like: <span className="text-neutral-300 italic">"Friends want a ₹900 rooftop party tonight, should I?"</span></p>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "history" && (
            <div className="px-5 pt-6 space-y-3 animate-fadeIn">
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-2"><History size={15}/> Live Database Activity</h2>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Total Spent So Far</p>
                  <p className="text-xs text-neutral-500">All-time ledger</p>
                </div>
                <span className="font-mono text-rose-400 font-bold">₹{totalSpent}</span>
              </div>
              <p className="text-center text-xs text-neutral-500 pt-4">All transactions sync securely with your Supabase cloud backend[cite: 3].</p>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="px-5 pt-6 space-y-4 animate-fadeIn">
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-2"><SettingsIcon size={15}/> Configure Allowance</h2>
              <form onSubmit={handleSaveSettings} className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/10">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1 font-medium">Monthly Allowance (₹)</label>
                  <input type="number" value={monthlyInput} onChange={(e) => setMonthlyInput(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1 font-medium">Fixed Fees / Mess (₹)</label>
                  <input type="number" value={feesInput} onChange={(e) => setFeesInput(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500 font-mono" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1 font-medium">Remaining Days</label>
                  <input type="number" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500 font-mono" />
                </div>
                <button type="submit" className="w-full py-3 rounded-xl bg-lime-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-lime-300 transition-colors active:scale-95">Update Profile & Budget</button>
              </form>
            </div>
          )}
        </div>

        {/* Input Bar for Coach Mode */}
        {activeTab === "coach" && (
          <div className="absolute bottom-16 w-full px-4 bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-2">
            <div className="flex gap-2 bg-neutral-900/90 border border-white/10 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleInput(input)} placeholder="Ask AI coach or log a spend..." className="flex-1 bg-transparent px-3 text-sm focus:outline-none text-white placeholder-neutral-500" />
              <button disabled={loading} onClick={() => handleInput(input)} className="h-10 w-10 rounded-xl flex items-center justify-center text-black active:scale-95 transition-transform disabled:opacity-50 shadow-lg" style={{ background: theme.stroke }}><Send className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Bottom Navigation Tab Bar */}
        <nav className="absolute bottom-0 w-full h-16 border-t border-white/10 bg-black/95 px-6 flex items-center justify-around backdrop-blur-2xl z-30">
          <button onClick={() => setActiveTab("coach")} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "coach" ? "text-lime-400" : "text-neutral-500 hover:text-neutral-300"}`}>
            <LayoutDashboard size={18} />
            <span className="text-[10px] font-medium">Coach</span>
          </button>
          <button onClick={() => setActiveTab("history")} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "history" ? "text-lime-400" : "text-neutral-500 hover:text-neutral-300"}`}>
            <History size={18} />
            <span className="text-[10px] font-medium">History</span>
          </button>
          <button onClick={() => setActiveTab("settings")} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "settings" ? "text-lime-400" : "text-neutral-500 hover:text-neutral-300"}`}>
            <SettingsIcon size={18} />
            <span className="text-[10px] font-medium">Setup</span>
          </button>
        </nav>

      </div>
    </div>
  );
}

/* --- Subcomponents --- */
function ScriptButton({ label, text, color }: { label: string, text: string, color: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  
  return (
    <button onClick={handleCopy} className={`w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors relative group active:scale-[0.98]`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${color}`}>{label}</span>
      <p className="text-sm text-neutral-200 pr-8">{text}</p>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity">
        {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
      </div>
    </button>
  );
}

function AdviceCard({ r, onLogAnyway }: { r: AdviceResult, onLogAnyway: () => void }) {
  const { data: d } = r;
  return (
    <div className="space-y-3 pb-12">
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
        <p className="text-sm text-neutral-200 leading-relaxed"><Sparkles className="inline w-4 h-4 mr-2 text-amber-400 mb-0.5"/>{d.aiCoachMessage}</p>
      </div>
      {d.peerPressureDetected && d.socialScripts && (
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 backdrop-blur-md">
          <p className="text-[11px] uppercase tracking-widest text-indigo-400 font-bold mb-3 flex items-center gap-2"><MessageCircle size={14}/> Social Defense Scripts</p>
          <div className="space-y-2">
            {d.socialScripts.counterPlan && <ScriptButton label="Counter-Plan" text={d.socialScripts.counterPlan} color="text-emerald-400" />}
            <ScriptButton label="Honest Broke" text={d.socialScripts.honest} color="text-blue-400" />
            <ScriptButton label="Funny Dodge" text={d.socialScripts.funny} color="text-amber-400" />
          </div>
        </div>
      )}
      <button onClick={onLogAnyway} className="w-full text-center py-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        I'm doing it anyway, log it.
      </button>
    </div>
  );
}

function IouCard({ r }: { r: IouResult }) {
  const { data: d } = r;
  return (
    <div className="space-y-3 pb-12">
      <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
        <p className="text-[11px] uppercase tracking-widest text-emerald-400 font-bold mb-1 flex items-center gap-2"><HandCoins size={14}/> IOU Tracked</p>
        <p className="text-sm text-emerald-100">{d.iouBorrower} owes you <span className="font-bold">₹{d.amount}</span></p>
      </div>
      {d.socialScripts && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mb-3 flex items-center gap-2"><MessageCircle size={14}/> Gentle Nudge Scripts</p>
          <div className="space-y-2">
            {d.socialScripts.funny && <ScriptButton label="Funny Text" text={d.socialScripts.funny} color="text-amber-400" />}
            {d.socialScripts.honest && <ScriptButton label="Direct Ask" text={d.socialScripts.honest} color="text-blue-400" />}
          </div>
        </div>
      )}
    </div>
  );
}