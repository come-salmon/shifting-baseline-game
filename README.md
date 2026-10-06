# The Shifting Baseline

React + Vite + Tailwind. Routes: `/host`, `/play`, `/dashboard`.

```
npm install
npm run dev        # http://localhost:5173 (also exposed on the LAN)
```

## Sync backend
- **No config**: local adapter (BroadcastChannel/localStorage). Works across tabs of one browser only. Good for testing: open `/host` and `/play?room=CODE` in two tabs.
- **Real phones**: create a Firebase project with a Realtime Database (test-mode rules), copy `.env.example` to `.env.local`, fill it in, restart `npm run dev`. Then set the QR "Base URL" on the host page to a URL phones can reach (LAN IP like `http://192.168.1.20:5173`, or a deployed URL, e.g. Vercel/Netlify).

## Demo / emergency
Dashboard → **Load sample dataset** (34 simulated players, both games).

## Design notes
- θ = level where P(target) = 0.5 from a per-player logistic fit (ridge on slope, interpolation fallback).
- Round 1: 2 trials per level (50% ≥ 6). Round 2: 1,2,3,5,7,1,0,0,1,0 trials for levels 1–10 (10% ≥ 6).
- Face images are procedural SVG (`src/data/stimuli.ts`); replace with photos in `public/faces/` if wanted.

