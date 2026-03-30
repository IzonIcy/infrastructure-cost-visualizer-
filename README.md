# Infrastructure Cost Visualizer

A lightweight browser-based dashboard to estimate and explore infrastructure spend.

## Live Site

Hosted URL: `https://infrastructure-cost-visualizer.vercel.app/`

## Features

- Add and remove resources with per-unit pricing inputs
- Compare pricing models (`On-Demand`, `Reserved`, `Spot`)
- Set a scenario name and monthly budget guardrail
- Real-time monthly and annual totals
- Budget delta tracking (over/under)
- Spend by category bars
- Pricing model donut split
- 12-month forecast with adjustable growth rate and month-12 projection callout
- Currency toggle (`USD`, `EUR`, `GBP`)
- Local state persistence in browser `localStorage`
- Optional backend API to save/load scenarios

## Quick Start

1. Open `index.html` directly in a browser.
2. Edit resource rows and pricing inputs.
3. Review updated totals and charts instantly.

## Optional: Run with a Local Server

If you prefer serving files over localhost:

```bash
npx serve .
```

Then open the printed URL.

## Backend (Optional)

This repo also includes an optional Node/Express backend that:

- Serves the static frontend
- Provides a small API to persist scenarios on disk (so you can save/load scenarios)

### Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### API

- `GET /api/health` → `{ ok: true }`
- `GET /api/scenarios` → list scenarios (metadata)
- `POST /api/scenarios` → create scenario
- `GET /api/scenarios/:id` → fetch scenario
- `PATCH /api/scenarios/:id` → update scenario
- `DELETE /api/scenarios/:id` → delete scenario

Scenarios are stored in `data/scenarios.json` (ignored by git).

## Formula

For each resource row:

`monthly_cost = qty * units_per_month * unit_price * (1 - discount%) * pricing_model_multiplier`

Pricing model multipliers:

- `On-Demand = 1.00`
- `Reserved = 0.72`
- `Spot = 0.35`
