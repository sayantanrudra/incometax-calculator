# incometax-calculator

India **FY 2024-25** salary income tax calculator built with **Next.js 14** (App Router), **React 18**, **TypeScript**, and **Tailwind CSS**. It compares the **old** and **new** tax regimes, applies **Chapter VI-A** deductions (old regime only), models **Pluxee-style flexi** exemptions with per-benefit caps, and includes cess, surcharge (with marginal relief), and **Section 87A** rebate logic in `utils/calculateTax.ts`.

## Features

- **Regimes**: Toggle old vs new; side-by-side comparison and “best regime” with and without flexi benefits.
- **Income**: Fixed pay, variable pay, optional employer PF and professional tax (PT applies in old regime in the engine).
- **Age**: Slabs for below 60, 60–80, and 80+ under the old regime.
- **Chapter VI-A**: 80C, 80CCD(1B), 80D, 80DD, 80E, 80EEB, 80G, 80GGA, 80U, 80TTA / 80TTB (age-gated in the UI).
- **Flexi (Pluxee)**: Fuel, meal, office wear, telecom, wellness, books, driver—with annual caps; office wear and books treated as taxable in the new regime in the UI; driver benefit for directors when CTC ≥ ₹80 lakh.
- **UI**: Breakdown (standard deduction, exemptions, taxable income, tax), effective rate, simplified **monthly cashflow** (variable in Sep and Mar).

This is an **illustrative tool**, not tax or legal advice. Verify figures with a qualified professional or official notifications.

## Prerequisites

- **Node.js** (LTS recommended) and **npm**

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (default `next dev` port unless you override it).

## Scripts

| Command        | Description        |
| -------------- | ------------------ |
| `npm run dev`  | Development server |
| `npm run build`| Production build   |
| `npm start`    | Serve production build |
| `npm run lint` | Next.js ESLint     |

## Project layout

| Path | Role |
| ---- | ---- |
| `app/layout.tsx` | Root layout, fonts (Fraunces, Manrope), metadata |
| `app/page.tsx` | Client-side calculator UI and validation |
| `app/globals.css` | Global styles and CSS variables |
| `utils/calculateTax.ts` | Slabs, deductions, rebate, surcharge, cess, `compareTaxRegimes` |

Path alias `@/*` is configured in `tsconfig.json` for imports from the repo root.

## Deploy

Import this repository in [Vercel](https://vercel.com/new) and use the **Next.js** preset, or build with `npm run build` and host the output on any platform that supports Next.js.
