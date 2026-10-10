# Alibi

An AI-powered financial coach for university students — fast text capture, a daily "safe-to-spend" gauge, and a Social Peer-Pressure & Regret-Risk Defense Engine for spends that haven't happened yet.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. The app works immediately with **no API key** — `processSpendPulseSafe` falls back to deterministic local mocks, which is what the 3 preset chips are tuned for.

## Enable live AI responses (optional)

Alibi is powered primarily by **Groq LLM inference** (`openai/gpt-oss-20b`) for sub-second, zero-lag responses. *(Note: From our testing, alternative LLMs like OpenAI and Gemini did not perform as reliably for this real-time financial coaching use case, so Groq is our primary engine).*

1. Get a free Groq API key.
2. Copy `.env.example` to `.env` and paste your key into `VITE_GROQ_API_KEY`.
3. Restart `npm run dev`.

The stage-indicator pill in the top-right corner shows `AI Online` (green) when Groq answered, or `Local Fallback` (amber) when it timed out or no key is set — built specifically for reliable live demos on variable wifi.

## Project structure

- `src/App.tsx` — UI: Apple titanium ring gauge, quick-input dock, dual-mode result card
- `src/processSpendPulseInput.ts` — Groq JSON-mode intent router
- `src/processSpendPulseSafe.ts` — 2.5s timeout race + offline mock fallback

## Supabase backend (optional)

`spendpulse_schema.sql` contains the `profiles` and `transactions` table schemas with RLS policies and seed data for wiring up persistence later. Not required to run this standalone prototype.

## Deploy

```bash
npm run build
```

Outputs a static `dist/` folder — deployable to Vercel, Netlify, or GitHub Pages as-is.