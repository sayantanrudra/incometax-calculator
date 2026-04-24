# Income Tax Calculator & Tax Optimiser

India **FY 2024-25** salary tax **estimator** — old vs new regime, Chapter VI-A, flexi benefits, cess, surcharge (marginal relief), and **87A** rebate. Built with **Next.js 15** (App Router), **React 18**, **TypeScript**, **Tailwind CSS**.

> ⚠️ Illustrative only — not tax or legal advice. Cross-check with a CA or official notifications.

---

## 🧰 Stack

| | |
| --- | --- |
| Framework | Next.js 15 · App Router |
| UI | React 18 · Tailwind |
| Logic | `utils/calculateTax.ts` (+ Vitest) |

---

## ✨ Features

| | | |
| --- | --- | --- |
| ⚖️ | **Regimes** | Old / new toggle, side-by-side numbers, “best regime” with and without flexi |
| 💵 | **Income** | Fixed + variable pay; optional employer PF & professional tax (PT in old regime in the engine) |
| 🎂 | **Age** | Old-regime slabs: &lt;60, 60–80, 80+ |
| 🏠 | **HRA** | Section 10(13A) style exemption (old regime); metro vs non-metro — `utils/hraExemption.ts` |
| 📑 | **Chapter VI-A** | 80C, 80CCD(1B), 80D, 80DD, 80E, 80EEB, 80G, 80GGA, 80U, 80TTA/80TTB (age-gated in UI) |
| 🎫 | **Flexi (Pluxee-style)** | Fuel, meal, office wear, telecom, wellness, books, driver — annual caps; new regime handling for office wear & books in UI; director driver when CTC ≥ ₹80L |
| 📊 | **Outputs** | Standard deduction, exemptions, taxable income, tax, effective rate |
| 📅 | **Cashflow** | Simple monthly view — variable in Sep & Mar (`utils/monthlyCashflow.ts`) |

---

## 🚀 Run

**Needs:** Node.js (LTS) + npm

```bash
npm install
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) (change port via Next if needed)

---

## ⚙️ Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run dev:webpack` | Dev with Webpack |
| `npm run build` / `npm start` | Production build & serve |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Vitest |

---

## 📁 Key paths

| Path | Role |
| --- | --- |
| `app/page.tsx` | Calculator UI & validation |
| `app/layout.tsx` | Layout, fonts, metadata |
| `app/globals.css` | Global styles / CSS variables |
| `utils/calculateTax.ts` | Slabs, deductions, rebate, surcharge, cess, `compareTaxRegimes` |
| `utils/hraExemption.ts` | HRA exemption helper |
| `utils/monthlyCashflow.ts` | Monthly cashflow helper |

Imports use `@/*` from repo root (`tsconfig.json`).

---

## 🌐 Deploy

[Import on Vercel](https://vercel.com/new) (Next.js preset) or run `npm run build` and host any Next-compatible platform.
