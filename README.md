# Cloud Spend Planning Desk

Interactive dashboard for estimating cloud infrastructure costs. No signup, no build step — just open the HTML file and start modeling.

**Live:** [https://infrastructure-cost-visualizer.vercel.app/](https://infrastructure-cost-visualizer.vercel.app/)

## What it does

Cloud pricing is confusing. Every provider has On-Demand, Reserved, and Spot pricing with different discounts, and figuring out what your bill will actually look like usually means spreadsheets. This is a single-page tool that lets you:

- Add resources with quantities and pricing
- Compare On-Demand vs Reserved vs Spot side by side
- Set a budget and see instant over/under feedback
- View spend breakdowns by category and pricing model
- Project costs 12 months out with adjustable growth rate
- Toggle between USD, EUR, GBP
- Save scenarios to your browser (or to a backend if you want)

## Running it

It's a single HTML file. No dependencies, no build step:

```bash
open index.html
```

Or serve it:

```bash
npx serve .
```

### Optional backend for saving scenarios

```bash
npm install
npm run dev
```

Then `http://localhost:3000`.

## How the math works

```
monthly = qty × units_per_month × unit_price × (1 − discount%) × pricing_multiplier
```

| Model     | Multiplier |
|-----------|-----------|
| On-Demand | 1.00      |
| Reserved  | 0.72      |
| Spot      | 0.35      |

## Why vanilla JS?

This project intentionally has no framework. For a single-page tool that amounts to a fancy calculator, adding React/Vue/Svelte adds more complexity than it removes. The whole thing is ~500 lines of HTML/CSS/JS. You can read every line and understand exactly what it does.

## Stack

Frontend: HTML, CSS, JavaScript (zero deps).  
Backend (optional): Node.js, Express, JSON file storage.
