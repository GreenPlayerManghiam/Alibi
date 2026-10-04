// src/SayNoScript.tsx
import { useState } from "react";
import { Check, Copy, MessageCircleOff } from "lucide-react";
import type { SayNoScripts } from "./processAlibiInput";

const TONES: { key: keyof SayNoScripts; label: string }[] = [
  { key: "funny", label: "Funny" },
  { key: "honest", label: "Honest" },
  { key: "firm", label: "Firm" },
];

export default function SayNoScript({ scripts }: { scripts: SayNoScripts }) {
  const [tone, setTone] = useState<keyof SayNoScripts>("honest");
  const [copied, setCopied] = useState(false);
  const text = scripts[tone];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API blocked
    }
  };

  if (!text) return null;

  return (
    <div className="space-y-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
        <MessageCircleOff className="h-3.5 w-3.5" />
        Say-No Script
      </div>
      <div className="flex gap-1.5">
        {TONES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTone(t.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
              tone === t.key
                ? "bg-amber-300 text-black"
                : "bg-white/5 text-neutral-400 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="rounded-lg bg-black/30 p-2.5 text-sm italic leading-snug text-amber-100">"{text}"</p>
      <button onClick={copy} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/25 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/10 active:scale-[0.98]">
        {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy to send</>}
      </button>
    </div>
  );
}