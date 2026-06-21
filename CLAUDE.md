# CrashQuote AI — Project Brief

Context file for Claude Code. Read this first when opening the project.

## What this is

An AI-assisted crash repair quoting app for a NZ panel & paint shop
(Andrews & Gilmores). The estimator photographs a damaged vehicle, the app
uses Claude Vision to assess the damage, generates an editable repair
estimate, and (eventually) exports it to Panel Quote via a Chrome extension.

Workflow: **Photos → AI assessment → editable estimate → export.**

Used on **both tablet (capture at the vehicle) and desktop (finalise)**.
Customers sometimes glance at the screen, so the UI is friendly and
professional, not a bare technical tool.

## How it's built

- `server.js` — Node/Express backend. Serves the front-end from `/public`
  and exposes `POST /api/analyze`, which takes `{ photos:[{base64,mime}],
  vehicle:{...} }`, adds the secret API key, calls Claude, and returns a
  structured JSON damage assessment. Also `GET /api/health`.
- `public/index.html` — the whole front-end (vanilla JS, no build step).
  Single-file app with screens: capture → analyzing → review → quote →
  export. It POSTs to `/api/analyze`.
- API key is read from `process.env.ANTHROPIC_API_KEY` — never hard-coded.
- Model in use: `claude-sonnet-4-6`.

## Run locally

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
# http://localhost:3000
```

## Shop-specific values (currently placeholders — replace with real ones)

- Labour rate: **$95/hr** (hard-coded as SHOP_RATE in both server and front-end)
- Default replacement-part cost: **$350** (placeholder when repair_method = Replace)
- GST: **15%** (NZ)
- Paint products: **Spies Hecker** (consumables via SprayStore) — not yet costed
- Currency: **NZD**, GST-inclusive

## What's done

- Backend proxy (tested, works)
- Friendly responsive front-end (capture, AI review, quote builder, export)
- Live AI damage detection through the backend
- Editable line items with live totals + GST

## What's left to build (in rough priority order)

1. **Chrome extension** — auto-fill Panel Quote fields from the quote JSON.
   Manifest v3, content script on the Panel Quote domain, field-map config.
   (Investigate first whether Panel Quote offers an API — cleaner than DOM fill.)
2. **PDF export** — generate a branded estimate PDF.
3. **Rego lookup** — CarJam or NZTA API to auto-fill make/model/year/colour.
4. **Live parts pricing** — Parts Trader (NZ) or supplier catalogue.
5. **Spies Hecker paint costing** — quantities by panel count, repair method,
   and colour complexity (solid/metallic/pearl/tri-coat).
6. **Real shop rates** — replace the $95 and $350 placeholders.
7. **Quote history / saving** — currently each quote is in-memory only.

## Deployment

Designed for Railway or Render. Push to GitHub (exclude `.env`), connect the
repo, set `ANTHROPIC_API_KEY` as an environment variable, generate a domain.
See README.md for the full step-by-step.

## Notes / gotchas

- The Anthropic API is pay-as-you-go and separate from the Claude chat plan.
- Don't add `capture="environment"` to the file input — it blocks gallery
  selection on Samsung phones. Leave it off so users get the full chooser.
- Keep the API key server-side only. Never ship it in the front-end.
