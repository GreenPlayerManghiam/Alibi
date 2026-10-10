# Alibi

An AI-powered financial coach for university students — fast text capture,
a daily "safe-to-spend" gauge, and a Social Peer-Pressure & Regret-Risk
Defense Engine for spends that haven't happened yet.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. The app works immediately with **no API
key** — `processSpendPulseSafe` falls back to deterministic local mocks,
which is what the 3 preset chips are tuned for.

## Enable live AI responses (optional)

1. Get a free Gemini key: https://aistudio.google.com/apikey
2. Copy `.env.example` to `.env` and paste the key into `VITE_GEMINI_API_KEY`
3. Restart `npm run dev`

The stage-indicator pill in the top-right corner shows `AI Online` (green)
when Gemini answered, or `Local Fallback` (amber) when it timed out or no
key is set — useful for live demos on unreliable wifi.

## Project structure

- `src/App.tsx` — UI: ring gauge, quick-input dock, dual-mode result card
- `src/processSpendPulseInput.ts` — Gemini JSON-mode intent router
- `src/processSpendPulseSafe.ts` — 2.5s timeout race + offline mock fallback

## Supabase backend (optional)

`spendpulse_schema.sql` (in the parent chat/output) has the `profiles` and
`transactions` table schema with RLS policies and seed data, for wiring up
persistence later. Not required to run this prototype.

## Deploy

```bash
npm run build
```

Outputs a static `dist/` folder — deployable to Vercel, Netlify, or GitHub
Pages as-is.
