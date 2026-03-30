# Cloud Spend Planning Desk

A lightweight browser-based dashboard to estimate infrastructure spend with a more grounded planning worksheet and simple scenario persistence.

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
- Display currency toggle (`USD`, `EUR`, `GBP`) with approximate planning FX
- Local state persistence in browser `localStorage`
- Optional backend API to save/load scenarios

## Quick Start

1. Open `index.html` directly in a browser.
2. Edit resource rows and pricing inputs.
3. Review updated totals and charts instantly.

When you switch currency, the worksheet converts visible prices and budget values using rough planning rates. It is meant for scenario modeling, not invoice-grade FX.

## Optional: Run with a Local Server

If you prefer serving files over localhost:

```bash
npx serve .
```

Then open the printed URL.

## Backend (Optional)

This repo also includes an optional Node/Express backend that:

- Serves only the frontend assets
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
