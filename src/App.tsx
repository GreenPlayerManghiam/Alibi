// src/App.tsx
import { useMemo, useRef, useState } from "react";
import { Activity, Send, Loader2, Sparkles, ReceiptText, MessageCircle, Copy, CheckCircle2, HandCoins, ThumbsUp, ThumbsDown, AlertCircle } from "lucide-react";
import { processAlibiInput } from "./processAlibiInput";
import { useAlibiDb } from "./hooks/useAlibiDb";
import type { AlibiResult, AdviceResult, IouResult } from "./processAlibiInput";

export default function App() {
  const { profile, spentToday, totalSpent, pendingRegret, regretContext, loading: dbLoading, rateTransaction, saveTransaction } = useAlibiDb();
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AlibiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  if (dbLoading) return <div className="min-h-screen bg-neutral-950 flex flex-col gap-4 items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8 text-neutral-500" /><p className="text-sm text-neutral-500">Connecting to Database...</p></div>;

  return (
    <div className="min-h-screen bg-neutral-950 flex justify-center selection:bg-lime-500/30">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col bg-gradient-to-b from-[#0a0a0c] via-[#12131a] to-black text-neutral-100 overflow-clip">
        
        <header className="px-5 pt-8 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" style={{ color: theme.stroke }} />
            <span className="font-bold tracking-tight text-xl">Alibi.</span>
          </div>
          <span className="text-[10px] text-lime-500 font-mono tracking-widest uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse"></span>Live</span>
        </header>

        {pendingRegret && (
          <div className="mx-5 mb-2 mt-4 p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 shadow-xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute -right-4 -top-4 opacity-10"><Sparkles size={80} /></div>
            <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mb-2">Hindsight Check</p>
            <p className="text-sm text-indigo-100 mb-4">You spent <span className="font-bold text-white">₹{pendingRegret.amount}</span> at {pendingRegret.merchant}. Worth it?</p>
            <div className="flex gap-2">
              <button onClick={() => rateTransaction(pendingRegret.id, false)} className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ThumbsDown size={14}/> Regret it</button>
              <button onClick={() => rateTransaction(pendingRegret.id, true)} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ThumbsUp size={14}/> Worth it</button>
            </div>
          </div>
        )}

        <section className="relative flex flex-col items-center pt-8">
          <div className="relative h-[220px] w-[220px] rounded-full shadow-2xl flex items-center justify-center" style={{ boxShadow: `0 0 80px -20px ${theme.stroke}30` }}>
             <div className="absolute inset-0 rounded-full border-[12px] border-white/5" />
             <div className="absolute inset-0 rounded-full border-[12px]" style={{ borderColor: theme.stroke, clipPath: `polygon(0 0, 100% 0, 100% ${Math.min(pressure * 100, 100)}%, 0 ${Math.min(pressure * 100, 100)}%)`, transition: "clip-path 1s ease" }} />
            <div className="text-center z-10">
              <span className="text-[11px] uppercase tracking-widest text-neutral-500 block mb-1">Safe to spend</span>
              <span className={`font-mono text-5xl font-bold tabular-nums ${theme.text}`}>₹{Math.max(Math.round(left), 0)}</span>
              <span className="mt-1 text-xs text-neutral-500 block">of ₹{Math.round(dailySafe)} / day</span>
            </div>
          </div>
        </section>

        <section className="relative flex-1 px-5 pt-8 pb-24 overflow-y-auto">
          {error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2 mb-4"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}
          {loading && <div className="flex justify-center p-6 text-neutral-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!loading && result?.mode === "advice" && <AdviceCard r={result} onLogAnyway={() => handleLogAdviceAnyway(result)} />}
          {!loading && result?.mode === "iou_nudge" && <IouCard r={result} />}
          {!loading && result?.mode === "transaction" && <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"><div className="flex gap-3"><ReceiptText className="text-neutral-400"/><div><p className="font-semibold text-sm">{result.data.merchant}</p><p className="text-xs text-neutral-500">{result.data.aiCoachMessage}</p></div></div><span className="font-mono text-rose-400 font-bold">-₹{result.data.amount}</span></div>}
        </section>

        <footer className="fixed bottom-0 w-full max-w-[430px] border-t border-white/5 bg-black/90 px-4 pb-6 pt-4 backdrop-blur-2xl">
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleInput(input)} placeholder="Log a real spend or plan..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-neutral-500 text-white placeholder-neutral-600" />
            <button disabled={loading} onClick={() => handleInput(input)} className="h-11 w-11 rounded-xl flex items-center justify-center text-black active:scale-95 transition-transform disabled:opacity-50" style={{ background: theme.stroke }}><Send className="h-4 w-4" /></button>
          </div>
        </footer>
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
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
        <p className="text-sm text-neutral-200 leading-relaxed"><Sparkles className="inline w-4 h-4 mr-2 text-amber-400 mb-0.5"/>{d.aiCoachMessage}</p>
      </div>
      {d.peerPressureDetected && d.socialScripts && (
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20">
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
    <div className="space-y-4">
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