"use client";

import { ChangeEvent, ReactNode, useMemo, useState } from "react";
import {
  AgeGroup,
  MAX_80C_DEDUCTION,
  MAX_80CCD1B_DEDUCTION,
  MAX_80D_DEDUCTION,
  MAX_80DD_DEDUCTION,
  MAX_80EEB_DEDUCTION,
  MAX_80TTA_DEDUCTION,
  MAX_80TTB_DEDUCTION,
  MAX_80U_DEDUCTION,
  MAX_EMPLOYER_PF,
  MAX_GROSS_INCOME,
  MAX_OTHER_DEDUCTION,
  MAX_PROFESSIONAL_TAX,
  TaxComputation,
  TaxRegime,
  compareTaxRegimes,
} from "../utils/calculateTax";
import { computeHraExemption } from "../utils/hraExemption";
import { buildMonthlyCashflow, FY_MONTH_LABELS } from "../utils/monthlyCashflow";
import { ThemeToggle } from "./components/theme-toggle";
type SalaryField = "fixedPay" | "variablePay" | "employerPf" | "professionalTax";
type PayrollField = "employeePfAnnual" | "otherPayrollAnnual" | "lwfEmployeeAnnual";
type DeductionField =
  | "deduction80C"
  | "deduction80CCD1B"
  | "deduction80D"
  | "deduction80DD"
  | "deduction80E"
  | "deduction80EEB"
  | "deduction80G"
  | "deduction80GGA"
  | "deduction80U"
  | "deduction80TTA"
  | "deduction80TTB";
type BenefitKey =
  | "fuel"
  | "meal"
  | "officeWear"
  | "telecom"
  | "wellness"
  | "books"
  | "gadgets"
  | "driver";

type VariablePayMode = "amount" | "percent";

interface SalaryState {
  fixedPay: string;
  variablePay: string;
  variablePayMode: VariablePayMode;
  variableMonthSelected: boolean[];
  employerPf: string;
  professionalTax: string;
  employeePfAnnual: string;
  lwfEmployeeAnnual: string;
  otherPayrollAnnual: string;
  ageGroup: AgeGroup;
  preferredRegime: TaxRegime;
  deductionsOpen: boolean;
  /** HRA section 10(13A) inputs collapsed by default (same pattern as Chapter VI-A). */
  hraOpen: boolean;
  flexiOpen: boolean;
  hraRentAnnual: string;
  hraReceivedAnnual: string;
  /** When false, annual HRA received for the formula tracks 25% of fixed pay until the user edits the field. */
  hraReceivedManual: boolean;
  hraIsMetro: boolean;
  deductions: Record<DeductionField, string>;
  benefits: Record<BenefitKey, string>;
}

interface DeductionConfig {
  key: DeductionField;
  label: string;
  helper: string;
  max: number;
  seniorOnly?: boolean;
  nonSeniorOnly?: boolean;
}

interface BenefitConfig {
  key: BenefitKey;
  label: string;
  oldAnnualMax: number;
  newAnnualMax: number;
  note: string;
  taxableInNew?: boolean;
}

interface MonthlyRow {
  month: string;
  gross: number;
  tax: number;
  netAfterTax: number;
  highlight: boolean;
  postVariableCatchup: boolean;
}

type HraField = "hraRentAnnual" | "hraReceivedAnnual";

type ValidationErrors = Partial<
  Record<SalaryField | DeductionField | BenefitKey | PayrollField | "variableMonths" | HraField, string>
>;

const MAX_PAYROLL_LINE_ANNUAL = MAX_GROSS_INCOME;

/** Typical EPF employee + employer share at ₹1,800/month each (annualised for inputs). */
const DEFAULT_EPF_MONTHLY = 1_800;
const DEFAULT_EPF_ANNUAL = DEFAULT_EPF_MONTHLY * 12;
const DEFAULT_EPF_ANNUAL_STRING = String(DEFAULT_EPF_ANNUAL);

/** When the user has not overridden HRA received, assume this share of annual fixed pay (typical Basic proxy). */
const HRA_RECEIVED_DEFAULT_OF_FIXED = 0.25;
/** Default Basic salary proxy for HRA Rule 2A salary when the user has not overridden it. */
const HRA_SALARY_BASIS_DEFAULT_OF_FIXED = 0.5;

const defaultState: SalaryState = {
  fixedPay: "1000000",
  variablePay: "0",
  variablePayMode: "amount",
  variableMonthSelected: FY_MONTH_LABELS.map(() => false),
  employerPf: DEFAULT_EPF_ANNUAL_STRING,
  professionalTax: "0",
  employeePfAnnual: DEFAULT_EPF_ANNUAL_STRING,
  lwfEmployeeAnnual: "0",
  otherPayrollAnnual: "0",
  ageGroup: "below60",
  preferredRegime: "new",
  deductionsOpen: false,
  hraOpen: false,
  flexiOpen: false,
  hraRentAnnual: "0",
  hraReceivedAnnual: "0",
  hraReceivedManual: false,
  hraIsMetro: true,
  deductions: {
    deduction80C: "0",
    deduction80CCD1B: "0",
    deduction80D: "0",
    deduction80DD: "0",
    deduction80E: "0",
    deduction80EEB: "0",
    deduction80G: "0",
    deduction80GGA: "0",
    deduction80U: "0",
    deduction80TTA: "0",
    deduction80TTB: "0",
  },
  benefits: {
    fuel: "0",
    meal: "0",
    officeWear: "0",
    telecom: "0",
    wellness: "0",
    books: "0",
    gadgets: "0",
    driver: "0",
  },
};

const ageOptions: Array<{ value: AgeGroup; label: string; hint: string }> = [
  { value: "below60", label: "Below 60", hint: "Default slabs" },
  { value: "60to80", label: "60 – 80", hint: "Senior slabs" },
  { value: "80plus", label: "80+", hint: "Super senior" },
];

const deductionConfigs: DeductionConfig[] = [
  { key: "deduction80C", label: "80C", helper: "PPF, ELSS, LIC, etc.", max: MAX_80C_DEDUCTION },
  { key: "deduction80CCD1B", label: "80CCD(1B)", helper: "NPS (additional)", max: MAX_80CCD1B_DEDUCTION },
  { key: "deduction80D", label: "80D", helper: "Medical insurance", max: MAX_80D_DEDUCTION },
  { key: "deduction80DD", label: "80DD", helper: "Dependent disability", max: MAX_80DD_DEDUCTION },
  { key: "deduction80E", label: "80E", helper: "Education loan interest", max: MAX_OTHER_DEDUCTION },
  { key: "deduction80EEB", label: "80EEB", helper: "Electric vehicle loan", max: MAX_80EEB_DEDUCTION },
  { key: "deduction80G", label: "80G", helper: "Donations", max: MAX_OTHER_DEDUCTION },
  { key: "deduction80GGA", label: "80GGA", helper: "Research donations", max: MAX_OTHER_DEDUCTION },
  { key: "deduction80U", label: "80U", helper: "Self disability", max: MAX_80U_DEDUCTION },
  {
    key: "deduction80TTA",
    label: "80TTA",
    helper: "Savings account interest",
    max: MAX_80TTA_DEDUCTION,
    nonSeniorOnly: true,
  },
  {
    key: "deduction80TTB",
    label: "80TTB",
    helper: "Senior interest income",
    max: MAX_80TTB_DEDUCTION,
    seniorOnly: true,
  },
];

const benefitConfigs: BenefitConfig[] = [
  { key: "fuel", label: "Fuel", oldAnnualMax: 180_000, newAnnualMax: 180_000, note: "Max ₹1,80,000 / year" },
  { key: "meal", label: "Meal", oldAnnualMax: 180_000, newAnnualMax: 180_000, note: "Max ₹1,80,000 / year" },
  {
    key: "officeWear",
    label: "Office wear",
    oldAnnualMax: 60_000,
    newAnnualMax: 0,
    note: "Max ₹60,000 / year",
    taxableInNew: true,
  },
  { key: "telecom", label: "Telecom", oldAnnualMax: 60_000, newAnnualMax: 60_000, note: "Max ₹60,000 / year" },
  { key: "wellness", label: "Wellness", oldAnnualMax: 60_000, newAnnualMax: 60_000, note: "Max ₹60,000 / year" },
  {
    key: "books",
    label: "Books",
    oldAnnualMax: 60_000,
    newAnnualMax: 0,
    note: "Max ₹60,000 / year",
    taxableInNew: true,
  },
  { key: "gadgets", label: "Gadgets & Equipment", oldAnnualMax: 60_000, newAnnualMax: 60_000, note: "Max ₹60,000 / year" },
  {
    key: "driver",
    label: "Driver Salary",
    oldAnnualMax: 300_000,
    newAnnualMax: 300_000,
    note: "Max ₹25,000 / month (₹3,00,000 / year) · company-policy dependent",
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const displayRegimeName = (regime: string) => (regime === "old" ? "Old" : "New");

const flexiSuffix = (hasFlexi: boolean) => (hasFlexi ? " (with flexi)" : "");

/** Tax snapshot panel — labels kept in one place (no scattered magic strings). */
const TAX_SNAPSHOT_LABELS = {
  oldRegimeTax: (hasFlexi: boolean) => `Old regime tax${flexiSuffix(hasFlexi)}`,
  newRegimeTax: (hasFlexi: boolean) => `New regime tax${flexiSuffix(hasFlexi)}`,
  saveWithRegime: (name: string) => `You save with ${displayRegimeName(name)}`,
  regimesEqualTitle: "Both regimes equal",
  regimesEqualCaption: (hasFlexi: boolean) =>
    hasFlexi ? "Same annual tax with your flexi." : "Same annual tax on these inputs.",
  saveCaption: (other: string) => `Per year vs ${displayRegimeName(other)} regime.`,
  flexiSavesOld: "Flexi saves in Old",
  flexiSavesNew: "Flexi saves in New",
};

const numericValue = (value: string) => {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getBenefitCap = (benefit: BenefitConfig, regime: TaxRegime) =>
  regime === "old" ? benefit.oldAnnualMax : benefit.newAnnualMax;

/** Sum of flexi / Pluxee amounts entered for a regime (capped per benefit; used for tax and cash-out). */
const computeBenefitsAnnual = (benefits: Record<BenefitKey, string>, regime: TaxRegime) =>
  benefitConfigs.reduce((sum, benefit) => {
    const cap = getBenefitCap(benefit, regime);
    return sum + clamp(numericValue(benefits[benefit.key]), 0, cap);
  }, 0);

const deriveVariablePayAnnual = (fixedPay: number, rawInput: number, mode: VariablePayMode) => {
  if (mode === "amount") {
    return clamp(rawInput, 0, MAX_GROSS_INCOME);
  }
  const pct = clamp(rawInput, 0, 100);
  const fromPercent = Math.round(fixedPay * (pct / 100));
  return clamp(fromPercent, 0, Math.max(0, MAX_GROSS_INCOME - fixedPay));
};

function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`surface-card elevate-hover rounded-[1.5rem] border border-[color:var(--line)] p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  helper,
  error,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  helper: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-2">
      {label ? (
        <span
          className={`text-sm font-medium ${disabled ? "text-slate-400 dark:text-slate-500" : "text-[color:var(--navy)] dark:text-[color:var(--foreground)]"}`}
        >
          {label}
        </span>
      ) : null}
      <input
        type="number"
        min={0}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2.5 text-sm text-[color:var(--navy)] outline-none transition duration-200 focus:border-[color:var(--accent-violet)] focus:ring-2 focus:ring-[color:var(--accent-violet)]/18 disabled:cursor-not-allowed disabled:bg-slate-100/80 disabled:text-slate-400 dark:text-[color:var(--foreground)] dark:disabled:bg-slate-800/80 dark:disabled:text-slate-500"
      />
      <span className={`text-xs ${error ? "text-red-600 dark:text-red-400" : "text-[color:var(--muted)]"}`}>
        {error || helper}
      </span>
    </label>
  );
}

interface SleekPillOption<T extends string> {
  id: T;
  label: string;
}

function SleekPillToggle<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
}: {
  ariaLabel: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly [SleekPillOption<T>, SleekPillOption<T>];
  disabled?: boolean;
  className?: string;
}) {
  const activeIndex = options[0].id === value ? 0 : options[1].id === value ? 1 : 0;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`segmented-pill-track max-w-full ${disabled ? "pointer-events-none opacity-45" : ""} ${className}`}
    >
      <span
        aria-hidden
        className="segmented-pill-thumb"
        style={{
          left: activeIndex === 0 ? "4px" : "calc(50% + 2px)",
        }}
      />
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`relative z-[1] min-h-[42px] flex-1 rounded-full px-2 text-sm font-semibold tracking-tight transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)] sm:min-h-[44px] sm:px-3 ${
              active ? "text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RegimeToggle({
  value,
  onChange,
}: {
  value: TaxRegime;
  onChange: (regime: TaxRegime) => void;
}) {
  return (
    <SleekPillToggle
      ariaLabel="Tax regime"
      className="max-w-md"
      value={value}
      onChange={onChange}
      options={[
        { id: "old", label: "Old" },
        { id: "new", label: "New" },
      ]}
    />
  );
}

function AgeToggle({
  value,
  onChange,
}: {
  value: AgeGroup;
  onChange: (age: AgeGroup) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Age category" className="flex w-full flex-col gap-2 sm:flex-row sm:gap-1.5">
      {ageOptions.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] flex-1 rounded-xl border px-2 py-2.5 text-left text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)] sm:text-center ${
              active
                ? "border-[color:var(--accent-violet)]/35 bg-gradient-to-br from-[color:var(--accent-violet-soft)] to-[color:var(--accent-soft)] text-[color:var(--navy)] shadow-sm dark:from-violet-900/40 dark:to-teal-900/25 dark:text-[color:var(--foreground)]"
                : "border-slate-200/90 bg-slate-50/80 text-[color:var(--muted)] hover:border-slate-300/90 hover:bg-white/60 dark:border-slate-600/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/50"
            }`}
          >
            <span className="block font-semibold text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
              {opt.label}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-[color:var(--muted)]">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function MetricTile({
  label,
  value,
  accent,
  caption,
  winner,
}: {
  label: string;
  value: string;
  accent?: boolean;
  caption?: string;
  /** Highlights the lower-tax regime tile (not used when accent is true). */
  winner?: boolean;
}) {
  const isWinnerTile = Boolean(winner && !accent);
  const surfaceClasses = accent
    ? "border-teal-300/80 bg-gradient-to-br from-teal-100/90 via-white to-violet-100/70 shadow-[0_8px_24px_rgba(13,159,122,0.12)] dark:border-teal-800/50 dark:from-teal-950/40 dark:via-slate-900/50 dark:to-violet-950/35 dark:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
    : isWinnerTile
      ? "metric-tile-winner border-transparent"
      : "border-slate-300/85 bg-gradient-to-br from-slate-100/95 to-slate-50/90 hover:border-slate-400/70 dark:border-slate-600/60 dark:from-slate-900/50 dark:to-slate-900/30 dark:hover:border-slate-500/80";

  return (
    <div
      className={`rounded-2xl border p-4 transition-transform duration-200 will-change-transform motion-safe:hover:-translate-y-0.5 ${surfaceClasses}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
        {isWinnerTile ? (
          <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200">
            Best
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-xl text-[color:var(--navy)] transition-all duration-200 dark:text-[color:var(--foreground)] sm:text-2xl">
        {value}
      </p>
      {caption ? <p className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">{caption}</p> : null}
    </div>
  );
}

function BenefitField({
  benefit,
  regime,
  value,
  onChange,
}: {
  benefit: BenefitConfig;
  regime: TaxRegime;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const cap = getBenefitCap(benefit, regime);
  const disabled = cap === 0;

  return (
    <label className="block space-y-2">
      <span className={`text-xs font-semibold uppercase tracking-wide ${disabled ? "text-slate-400" : "text-[color:var(--muted)]"}`}>
        {benefit.label}
        {benefit.taxableInNew ? " (taxable in new)" : ""}
      </span>
      <input
        type="number"
        min={0}
        max={cap}
        disabled={disabled}
        value={disabled ? "0" : value}
        onChange={onChange}
        className="w-full rounded-xl border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2.5 text-sm text-[color:var(--navy)] outline-none transition duration-200 focus:border-[color:var(--accent-violet)] focus:ring-2 focus:ring-[color:var(--accent-violet)]/15 disabled:cursor-not-allowed disabled:bg-slate-100/80 dark:text-[color:var(--foreground)] dark:disabled:bg-slate-800/80"
      />
      <span className={`text-xs ${disabled ? "text-slate-400" : "text-[color:var(--muted)]"}`}>
        {cap > 0 ? benefit.note : "Not applicable in this regime."}
      </span>
    </label>
  );
}

interface PayrollAnnualBreakdown {
  /** Flexi / Pluxee amounts (capped for selected regime) deducted from in-hand, not from taxable income twice. */
  pluxeeCashOut: number;
  employeePf: number;
  professionalTax: number;
  lwfEmployee: number;
  other: number;
}

function BreakdownSection({
  result,
  title,
  showDetails,
  onToggle,
  payrollAnnual,
  /** FY bank-salary total after tax and payroll; same basis as headline in-hand tile. */
  annualNetAfterPayroll,
}: {
  result: TaxComputation;
  title: string;
  showDetails: boolean;
  onToggle: () => void;
  payrollAnnual: PayrollAnnualBreakdown;
  annualNetAfterPayroll: number;
}) {
  const taxPercent = result.totalCtc > 0 ? (result.totalTax / result.totalCtc) * 100 : 0;
  const exemptionPercent = result.totalCtc > 0 ? (result.totalExemptions / result.totalCtc) * 100 : 0;
  const netPercent = Math.max(0, 100 - taxPercent - exemptionPercent);

  const annualAfterTaxBeforePayroll = Math.max(0, result.totalCtc - result.totalTax);
  const monthlyAfterPayroll = annualNetAfterPayroll / 12;

  return (
    <SectionCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Breakdown</p>
          <h2 className="mt-1 font-display text-2xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Income-tax computation, then payroll deductions for estimated in-hand.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98] dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-[color:var(--foreground)] dark:hover:bg-violet-950/40"
        >
          {showDetails ? "See less" : "See more"}
        </button>
      </div>

      {showDetails ? (
        <div className="mt-6 space-y-6 text-sm">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Income tax (FY view)
            </p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100/90 dark:divide-slate-700/80 dark:border-slate-700/60 p-[15px]">
              <Row label="Gross income (CTC)" value={formatCurrency(result.totalCtc)} />
              <Row
                label="Professional tax (deduction in old regime only)"
                value={`− ${formatCurrency(result.professionalTaxDeduction)}`}
              />
              <Row label="Standard deduction" value={`− ${formatCurrency(result.standardDeduction)}`} />
              <Row label="Pluxee / flexi exempt" value={`− ${formatCurrency(result.pluxeeExemption)}`} />
              <Row
                label="HRA exempt u/s 10(13A)"
                value={
                  result.regime === "old"
                    ? `− ${formatCurrency(result.hraExemption)}`
                    : "— Not used in new regime"
                }
              />
              <Row label="Chapter VI-A" value={`− ${formatCurrency(result.chapterVIADeductions)}`} />
              <Row label="Taxable income" value={formatCurrency(result.taxableIncome)} strong />
              <p className="px-0 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                {result.regime === "new"
                  ? "Tax on taxable income (Section 115BAC · Finance Act 2025 slabs, FY 2025-26 onward)"
                  : "Tax on taxable income (default rates · old regime slabs)"}
              </p>
              <Row label="Tax at slab rates (before rebate &amp; surcharge)" value={formatCurrency(result.slabTax)} />
              <Row label="Less: Rebate u/s 87A" value={`− ${formatCurrency(result.rebate87A)}`} />
              {result.rebateMarginalRelief > 0 ? (
                <Row label="Less: Marginal relief (rebate)" value={`− ${formatCurrency(result.rebateMarginalRelief)}`} />
              ) : null}
              {result.surcharge > 0 ? <Row label="Add: Surcharge" value={formatCurrency(result.surcharge)} /> : null}
              {result.surchargeMarginalRelief > 0 ? (
                <Row label="Less: Marginal relief (surcharge)" value={`− ${formatCurrency(result.surchargeMarginalRelief)}`} />
              ) : null}
              <Row label="Income tax before cess" value={formatCurrency(result.incomeTaxBeforeCess)} strong />
              <Row label="Add: Health &amp; education cess (4%)" value={formatCurrency(result.cess)} />
              <Row label="Tax (incl. cess)" value={formatCurrency(result.totalTax)} strong />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Post-tax payroll (annual)
            </p>
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              Pluxee / flexi and other payroll lines are not part of bank salary after tax. We subtract them here so
              in-hand reflects cash retained from your taxable package.
            </p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100/90 dark:divide-slate-700/80 dark:border-slate-700/60 p-[15px]">
              <Row label="Net after income tax" value={formatCurrency(annualAfterTaxBeforePayroll)} />
              <Row
                label="Pluxee / flexi (benefits, not bank salary)"
                value={`− ${formatCurrency(payrollAnnual.pluxeeCashOut)}`}
              />
              <Row label="Employee PF (EPF)" value={`− ${formatCurrency(payrollAnnual.employeePf)}`} />
              <Row label="Professional tax" value={`− ${formatCurrency(payrollAnnual.professionalTax)}`} />
              <Row label="LWF (employee)" value={`− ${formatCurrency(payrollAnnual.lwfEmployee)}`} />
              <Row label="Other payroll deductions" value={`− ${formatCurrency(payrollAnnual.other)}`} />
              <Row label="Net after tax &amp; payroll (annual)" value={formatCurrency(annualNetAfterPayroll)} strong />
              <Row
                label="Est. monthly in-hand after payroll"
                value={formatCurrency(Math.round(monthlyAfterPayroll))}
                strong
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Taxable income" value={formatCurrency(result.taxableIncome)} />
          <MetricTile label="Total tax" value={formatCurrency(result.totalTax)} accent />
          <MetricTile
            label="After payroll (annual)"
            value={formatCurrency(annualNetAfterPayroll)}
            caption="After flexi, EPF, PT, LWF, other."
          />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">CTC breakup</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-200/50 shadow-inner dark:bg-slate-800/90 dark:ring-slate-600/50">
          <div
            className="composition-segment bg-[color:var(--chart-tax)]"
            style={{ width: `${Math.min(taxPercent, 100)}%` }}
            title={`Tax: ${formatCurrency(result.totalTax)}`}
          />
          <div
            className="composition-segment bg-[color:var(--chart-exempt)]"
            style={{ width: `${Math.min(exemptionPercent, 100)}%` }}
            title={`Exemptions: ${formatCurrency(result.totalExemptions)}`}
          />
          <div
            className="composition-segment bg-[color:var(--chart-net)]"
            style={{ width: `${Math.min(netPercent, 100)}%` }}
            title={`In hand: ${formatCurrency(annualNetAfterPayroll)}`}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chart-tax)] shadow-sm ring-1 ring-white/50 dark:ring-slate-700/80" />{" "}
            Tax ({Math.round(taxPercent)}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chart-exempt)] shadow-sm ring-1 ring-white/50 dark:ring-slate-700/80" />{" "}
            Exemptions ({Math.round(exemptionPercent)}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chart-net)] shadow-sm ring-1 ring-white/50 dark:ring-slate-700/80" />{" "}
            In hand ({Math.round(netPercent)}%)
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-2.5 ${strong ? "font-semibold text-[color:var(--navy)] dark:text-[color:var(--foreground)]" : "text-slate-600 dark:text-slate-400"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums transition-all duration-200">{value}</span>
    </div>
  );
}

function MonthlyScheduleCard({ rows }: { rows: MonthlyRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <SectionCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Monthly schedule</p>
          <h2 className="mt-1 font-display text-2xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
            Cashflow view
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98] dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-[color:var(--foreground)] dark:hover:bg-violet-950/40"
        >
          {open ? "See less" : "See more"}
        </button>
      </div>

      {open ? (
        <div className="scroll-fade-x relative mt-5 overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-600/70">
          <div className="min-w-[480px]">
            <div className="grid grid-cols-4 gap-2 border-b border-slate-200 bg-slate-50/80 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)] dark:border-slate-600/70 dark:bg-slate-900/70 sm:gap-3 sm:px-3 sm:py-2.5 sm:text-xs">
              <span>Month</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Tax (TDS est.)</span>
              <span className="text-right">Net in-hand (after payroll)</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
              {rows.map((row) => (
                <div
                  key={row.month}
                  className={`grid grid-cols-4 gap-2 px-2 py-2 text-xs transition-colors duration-300 sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm ${row.highlight ? "bg-gradient-to-r from-violet-50/80 to-teal-50/50 font-medium dark:from-violet-950/40 dark:to-teal-950/30" : ""}`}
                >
                  <span className="text-[color:var(--navy)] dark:text-[color:var(--foreground)]">{row.month}</span>
                  <span className="text-right tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(row.gross)}</span>
                  <span className="text-right tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(row.tax)}</span>
                  <span className="text-right tabular-nums text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                    {formatCurrency(row.netAfterTax)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-[color:var(--muted)]">
              TDS varies by month; the twelve &quot;Net in-hand&quot; figures are adjusted so their FY total matches
              the headline estimate (last month absorbs rounding).
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[color:var(--muted)]">Collapsed by default — expand to view the month-wise table.</p>
      )}
    </SectionCard>
  );
}

export default function HomePage() {
  const [state, setState] = useState<SalaryState>(defaultState);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const fixedPay = numericValue(state.fixedPay);
  const variablePayRaw = numericValue(state.variablePay);
  const variablePayAnnual = deriveVariablePayAnnual(fixedPay, variablePayRaw, state.variablePayMode);
  const employerPf = numericValue(state.employerPf);
  const professionalTax = numericValue(state.professionalTax);
  const employeePfAnnual = numericValue(state.employeePfAnnual);
  const lwfEmployeeAnnual = numericValue(state.lwfEmployeeAnnual);
  const otherPayrollAnnual = numericValue(state.otherPayrollAnnual);
  const totalCtc = fixedPay + variablePayAnnual;
  const variableMonthCount = state.variableMonthSelected.filter(Boolean).length;

  const defaultHraReceivedAnnual = useMemo(
    () => Math.round(fixedPay * HRA_RECEIVED_DEFAULT_OF_FIXED),
    [fixedPay],
  );

  const salaryForHra = useMemo(
    () => clamp(Math.round(fixedPay * HRA_SALARY_BASIS_DEFAULT_OF_FIXED), 0, MAX_GROSS_INCOME),
    [fixedPay],
  );

  const hraExemptAnnual = useMemo(() => {
    const annualHraReceived = state.hraReceivedManual
      ? numericValue(state.hraReceivedAnnual)
      : defaultHraReceivedAnnual;
    return computeHraExemption({
      annualRentPaid: numericValue(state.hraRentAnnual),
      annualHraReceived,
      salaryForHra,
      isMetro: state.hraIsMetro,
    });
  }, [
    defaultHraReceivedAnnual,
    salaryForHra,
    state.hraIsMetro,
    state.hraReceivedAnnual,
    state.hraReceivedManual,
    state.hraRentAnnual,
  ]);

  const hraReceivedFieldValue = state.hraReceivedManual
    ? state.hraReceivedAnnual
    : String(defaultHraReceivedAnnual);

  const errors = useMemo(() => {
    const nextErrors: ValidationErrors = {};
    const salaryChecks: Array<[SalaryField, number, number]> = [
      ["fixedPay", fixedPay, Number.MAX_SAFE_INTEGER],
      ["employerPf", employerPf, MAX_EMPLOYER_PF],
      ["professionalTax", professionalTax, MAX_PROFESSIONAL_TAX],
    ];
    salaryChecks.forEach(([field, value, max]) => {
      if (value < 0) nextErrors[field] = "Cannot be negative.";
      else if (value > max) nextErrors[field] = "Value too high.";
    });
    if (state.variablePayMode === "amount") {
      if (variablePayRaw < 0) nextErrors.variablePay = "Cannot be negative.";
      else if (variablePayRaw > MAX_GROSS_INCOME) nextErrors.variablePay = "Value too high.";
    } else if (variablePayRaw < 0) {
      nextErrors.variablePay = "Cannot be negative.";
    } else if (variablePayRaw > 100) {
      nextErrors.variablePay = "Percent cannot exceed 100.";
    }
    if (variablePayAnnual > 0 && variableMonthCount === 0) {
      nextErrors.variableMonths = "Select at least one month when variable pay is greater than zero.";
    }
    const payrollChecks: Array<[PayrollField, number, number]> = [
      ["employeePfAnnual", employeePfAnnual, MAX_PAYROLL_LINE_ANNUAL],
      ["lwfEmployeeAnnual", lwfEmployeeAnnual, MAX_PAYROLL_LINE_ANNUAL],
      ["otherPayrollAnnual", otherPayrollAnnual, MAX_PAYROLL_LINE_ANNUAL],
    ];
    payrollChecks.forEach(([field, value, max]) => {
      if (value < 0) nextErrors[field] = "Cannot be negative.";
      else if (value > max) nextErrors[field] = "Value too high.";
    });
    deductionConfigs.forEach((config) => {
      const v = numericValue(state.deductions[config.key]);
      if (v < 0) nextErrors[config.key] = "Cannot be negative.";
      else if (v > config.max) nextErrors[config.key] = `Cap: ${formatCurrency(config.max)}.`;
    });
    benefitConfigs.forEach((benefit) => {
      const raw = numericValue(state.benefits[benefit.key]);
      const cap = getBenefitCap(benefit, state.preferredRegime);
      if (raw < 0) nextErrors[benefit.key] = "Cannot be negative.";
      else if (raw > cap && cap > 0) nextErrors[benefit.key] = `Max ${formatCurrency(cap)}.`;
    });

    const validateHraAnnualLine = (field: HraField, value: number) => {
      if (value < 0) nextErrors[field] = "Cannot be negative.";
      else if (value > MAX_GROSS_INCOME) nextErrors[field] = "Value too high.";
    };
    validateHraAnnualLine("hraRentAnnual", numericValue(state.hraRentAnnual));
    if (state.hraReceivedManual) {
      validateHraAnnualLine("hraReceivedAnnual", numericValue(state.hraReceivedAnnual));
    }
    return nextErrors;
  }, [
    employeePfAnnual,
    employerPf,
    fixedPay,
    lwfEmployeeAnnual,
    otherPayrollAnnual,
    professionalTax,
    state.benefits,
    state.deductions,
    state.hraReceivedAnnual,
    state.hraReceivedManual,
    state.hraRentAnnual,
    state.preferredRegime,
    state.variablePayMode,
    variableMonthCount,
    variablePayAnnual,
    variablePayRaw,
  ]);

  const benefitExemptions = useMemo(
    (): Record<TaxRegime, number> => ({
      old: computeBenefitsAnnual(state.benefits, "old"),
      new: computeBenefitsAnnual(state.benefits, "new"),
    }),
    [state.benefits],
  );

  const rawPluxeeActiveAnnual = useMemo(
    () => computeBenefitsAnnual(state.benefits, state.preferredRegime),
    [state.benefits, state.preferredRegime],
  );

  const baseInput = {
    fixedPay,
    variablePay: variablePayAnnual,
    employerPf,
    professionalTax,
    ageGroup: state.ageGroup,
    hraExemption: hraExemptAnnual,
    oldRegimeDeductions: {
      deduction80C: numericValue(state.deductions.deduction80C),
      deduction80CCD1B: numericValue(state.deductions.deduction80CCD1B),
      deduction80D: numericValue(state.deductions.deduction80D),
      deduction80DD: numericValue(state.deductions.deduction80DD),
      deduction80E: numericValue(state.deductions.deduction80E),
      deduction80EEB: numericValue(state.deductions.deduction80EEB),
      deduction80G: numericValue(state.deductions.deduction80G),
      deduction80GGA: numericValue(state.deductions.deduction80GGA),
      deduction80U: numericValue(state.deductions.deduction80U),
      deduction80TTA: numericValue(state.deductions.deduction80TTA),
      deduction80TTB: numericValue(state.deductions.deduction80TTB),
    },
  };

  const comparisonWithoutBenefits = compareTaxRegimes(baseInput);
  const comparisonWithBenefits = compareTaxRegimes({
    ...baseInput,
    pluxeeExemptions: benefitExemptions,
  });

  const activeWithBenefits =
    state.preferredRegime === "old" ? comparisonWithBenefits.oldRegime : comparisonWithBenefits.newRegime;
  const activeWithoutBenefits =
    state.preferredRegime === "old" ? comparisonWithoutBenefits.oldRegime : comparisonWithoutBenefits.newRegime;

  const payrollCashOutAnnual = useMemo(
    () =>
      rawPluxeeActiveAnnual +
      employeePfAnnual +
      otherPayrollAnnual +
      professionalTax +
      lwfEmployeeAnnual,
    [employeePfAnnual, lwfEmployeeAnnual, otherPayrollAnnual, professionalTax, rawPluxeeActiveAnnual],
  );

  /** Same FY figure for headline in-hand, breakdown, and schedule reconciliation (tax engine CTC + rounded net). */
  const annualNetAfterPayroll = useMemo(
    () =>
      Math.max(
        0,
        Math.round(activeWithBenefits.totalCtc - activeWithBenefits.totalTax - payrollCashOutAnnual),
      ),
    [activeWithBenefits.totalCtc, activeWithBenefits.totalTax, payrollCashOutAnnual],
  );
  const postPayrollMonthly = annualNetAfterPayroll / 12;

  const scheduleVariableMask = useMemo(() => {
    if (variablePayAnnual > 0 && variableMonthCount === 0) {
      return FY_MONTH_LABELS.map(() => true);
    }
    return state.variableMonthSelected;
  }, [state.variableMonthSelected, variableMonthCount, variablePayAnnual]);

  const schedule = useMemo(
    () =>
      buildMonthlyCashflow({
        fixedPayAnnual: fixedPay,
        variablePayAnnual: variablePayAnnual,
        variableMonthSelected: scheduleVariableMask,
        totalCtc,
        totalTaxAnnual: activeWithBenefits.totalTax,
        annualPayrollCashOut: payrollCashOutAnnual,
        targetAnnualNetTakeHome: annualNetAfterPayroll,
      }),
    [
      activeWithBenefits.totalTax,
      annualNetAfterPayroll,
      fixedPay,
      payrollCashOutAnnual,
      scheduleVariableMask,
      totalCtc,
      variablePayAnnual,
    ],
  );

  const payrollAnnualBreakdown = useMemo(
    (): PayrollAnnualBreakdown => ({
      pluxeeCashOut: rawPluxeeActiveAnnual,
      employeePf: employeePfAnnual,
      professionalTax,
      lwfEmployee: lwfEmployeeAnnual,
      other: otherPayrollAnnual,
    }),
    [employeePfAnnual, lwfEmployeeAnnual, otherPayrollAnnual, professionalTax, rawPluxeeActiveAnnual],
  );

  const flexiTaxSavedAnnual = useMemo(
    () => Math.max(0, activeWithoutBenefits.totalTax - activeWithBenefits.totalTax),
    [activeWithBenefits.totalTax, activeWithoutBenefits.totalTax],
  );

  const regimeSavingsVersusOther = useMemo(() => {
    const { savings, bestRegime } = comparisonWithBenefits;
    if (savings === 0) {
      return { tie: true as const, savings: 0 };
    }
    const betterName = bestRegime === "old" ? "old" : "new";
    const worseName = bestRegime === "old" ? "new" : "old";
    return { tie: false as const, savings, betterName, worseName };
  }, [comparisonWithBenefits]);

  const oldRegimeTileWinner =
    !regimeSavingsVersusOther.tie && comparisonWithBenefits.bestRegime === "old";
  const newRegimeTileWinner =
    !regimeSavingsVersusOther.tie && comparisonWithBenefits.bestRegime === "new";

  const flexiFlipsBestRegime = useMemo(
    () => comparisonWithoutBenefits.bestRegime !== comparisonWithBenefits.bestRegime,
    [comparisonWithBenefits.bestRegime, comparisonWithoutBenefits.bestRegime],
  );

  const flexiSavingsOldAnnual = useMemo(
    () =>
      Math.max(
        0,
        comparisonWithoutBenefits.oldRegime.totalTax - comparisonWithBenefits.oldRegime.totalTax,
      ),
    [
      comparisonWithoutBenefits.oldRegime.totalTax,
      comparisonWithBenefits.oldRegime.totalTax,
    ],
  );

  const flexiSavingsNewAnnual = useMemo(
    () =>
      Math.max(
        0,
        comparisonWithoutBenefits.newRegime.totalTax - comparisonWithBenefits.newRegime.totalTax,
      ),
    [
      comparisonWithoutBenefits.newRegime.totalTax,
      comparisonWithBenefits.newRegime.totalTax,
    ],
  );

  const hasAnyFlexiExemption = benefitExemptions.old > 0 || benefitExemptions.new > 0;

  const handleSalaryChange = (field: SalaryField) => (event: ChangeEvent<HTMLInputElement>) => {
    setState((current) => ({ ...current, [field]: event.target.value }));
  };

  const handlePayrollChange = (field: PayrollField) => (event: ChangeEvent<HTMLInputElement>) => {
    setState((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleDeductionChange = (field: DeductionField) => (event: ChangeEvent<HTMLInputElement>) => {
    setState((current) => ({
      ...current,
      deductions: { ...current.deductions, [field]: event.target.value },
    }));
  };

  const handleBenefitChange = (field: BenefitKey) => (event: ChangeEvent<HTMLInputElement>) => {
    setState((current) => ({
      ...current,
      benefits: { ...current.benefits, [field]: event.target.value },
    }));
  };

  const oldRegimeDisabled = state.preferredRegime !== "old";

  return (
    <main className="min-h-screen pb-12 text-[color:var(--foreground)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="hero-wash soft-ring animate-fade-in-up mb-8 rounded-[1.75rem] border border-[color:var(--line)] px-5 py-5 sm:px-6">
          <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="bg-gradient-to-r from-[color:var(--navy)] via-[color:var(--accent-violet)] to-[color:var(--accent)] bg-clip-text font-display text-2xl tracking-tight text-transparent motion-reduce:bg-none motion-reduce:text-[color:var(--navy)] dark:from-[color:var(--foreground)] dark:via-violet-300 dark:to-teal-300">
                Income Tax Calculator
              </p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[color:var(--muted)]">
                FY 2025-26 onward · old &amp; new regime, flexi exemptions, HRA (old regime), and take-home estimates
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col items-stretch gap-3 sm:w-auto sm:items-end">
              <ThemeToggle />
              <div
                className={`w-full rounded-2xl border px-4 py-3 text-sm leading-snug shadow-sm transition-all duration-200 sm:max-w-md ${
                  regimeSavingsVersusOther.tie
                    ? "surface-info text-sky-900 dark:text-sky-200"
                    : "surface-success text-emerald-900 dark:text-emerald-100"
                }`}
              >
                {regimeSavingsVersusOther.tie ? (
                  <span>Old and new regime income tax is the same on these inputs.</span>
                ) : (
                  <span>
                    <span className="mb-1.5 inline-block rounded-full border border-emerald-300/70 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-900/60 dark:text-emerald-100">
                      Savings
                    </span>{" "}
                    You save{" "}
                    <span className="font-semibold tabular-nums">{formatCurrency(regimeSavingsVersusOther.savings)}</span>{" "}
                    per year by choosing the <span className="font-semibold">{regimeSavingsVersusOther.betterName}</span>{" "}
                    regime over the <span className="font-medium">{regimeSavingsVersusOther.worseName}</span> regime.
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,450px)_minmax(0,1fr)]">
          <div className="stagger-children space-y-6">
            <SectionCard>
              <div className="mb-5">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Quick setup</p>
                <h1 className="mt-1 font-display text-2xl tracking-tight text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                  Your pay
                </h1>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-1">
                  <InputField
                    label="Fixed compensation (annual)"
                    value={state.fixedPay}
                    helper="Annual taxable salary. Excludes employer PF."
                    error={errors.fixedPay}
                    onChange={handleSalaryChange("fixedPay")}
                  />
                  <div className="space-y-4 rounded-2xl border border-[color:var(--nested-panel-border)] bg-[color:var(--nested-panel)] p-4 dark:border-slate-600/55 dark:bg-slate-950/35">
                    <p className="text-sm font-semibold text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                      Variable pay
                    </p>
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Variable type
                      </p>
                      <SleekPillToggle
                        ariaLabel="Variable pay input type"
                        value={state.variablePayMode}
                        onChange={(mode) => setState((c) => ({ ...c, variablePayMode: mode }))}
                        options={[
                          { id: "amount", label: "Amount (₹)" },
                          { id: "percent", label: "Percentage (%)" },
                        ]}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {state.variablePayMode === "amount" ? "Variable value (₹/yr)" : "Variable value (%)"}
                      </p>
                      <InputField
                        label=""
                        value={state.variablePay}
                        helper={
                          state.variablePayMode === "amount"
                            ? `Used in tax as ${formatCurrency(variablePayAnnual)} / year.`
                            : `≈ ${formatCurrency(variablePayAnnual)} / year from your fixed pay.`
                        }
                        error={errors.variablePay}
                        onChange={handleSalaryChange("variablePay")}
                      />
                    </div>
                    {errors.variableMonths ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{errors.variableMonths}</p>
                    ) : null}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Variable disbursement months ({variableMonthCount}/12)
                      </p>
                      <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
                        Cashflow splits variable equally across selected FY months (simplified).
                      </p>
                      <div className="flex flex-wrap gap-1.5 md:max-w-[300px] md:mx-auto">
                        {FY_MONTH_LABELS.map((label, index) => {
                          const on = state.variableMonthSelected[index];
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() =>
                                setState((c) => {
                                  const next = [...c.variableMonthSelected];
                                  next[index] = !next[index];
                                  return { ...c, variableMonthSelected: next };
                                })
                              }
                              className={`min-h-[36px] min-w-[2.75rem] rounded-full border px-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)] ${
                                on
                                  ? "border-transparent bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-[0_0_12px_rgba(139,92,246,0.42)] dark:from-violet-400 dark:to-violet-700 dark:shadow-[0_0_16px_rgba(167,139,250,0.38)]"
                                  : "border border-[color:var(--pill-track-border)] bg-[color:var(--pill-track)] text-[color:var(--muted)] hover:border-slate-300/80 dark:hover:border-slate-500/80"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-[color:var(--nested-panel-border)] bg-[color:var(--nested-panel)] p-4 dark:border-slate-600/50 dark:bg-slate-950/40">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Total CTC</p>
                    <p className="mt-1 font-display text-3xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                      {formatCurrency(totalCtc)}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[color:var(--muted)]">Regime</p>
                    <RegimeToggle value={state.preferredRegime} onChange={(regime) => setState((c) => ({ ...c, preferredRegime: regime }))} />
                    <p className="text-xs font-medium text-[color:var(--muted)]">Age</p>
                    <AgeToggle value={state.ageGroup} onChange={(age) => setState((c) => ({ ...c, ageGroup: age }))} />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-[color:var(--nested-panel-border)] bg-[color:var(--card)] p-4 dark:border-slate-600/55 dark:bg-slate-950/50">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Employer PF &amp; professional tax
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <InputField
                        label="Employer PF (annual)"
                        value={state.employerPf}
                        helper="Informational only — not added to taxable income or in-hand."
                        error={errors.employerPf}
                        onChange={handleSalaryChange("employerPf")}
                      />
                      <InputField
                        label="Professional tax (annual)"
                        value={state.professionalTax}
                        helper=""
                        error={errors.professionalTax}
                        onChange={handleSalaryChange("professionalTax")}
                      />
                    </div>
                  </div>
                  <div className="border-t border-slate-200/80 pt-4 dark:border-slate-600/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Employee payroll (annual)
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <InputField
                        label="Employee PF (annual)"
                        value={state.employeePfAnnual}
                        helper=""
                        error={errors.employeePfAnnual}
                        onChange={handlePayrollChange("employeePfAnnual")}
                      />
                      <InputField
                        label="LWF employee (annual)"
                        value={state.lwfEmployeeAnnual}
                        helper=""
                        error={errors.lwfEmployeeAnnual}
                        onChange={handlePayrollChange("lwfEmployeeAnnual")}
                      />
                      <InputField
                        label="Other fixed annual deductions"
                        value={state.otherPayrollAnnual}
                        helper="Loan, union, insurance, etc. (annual total)."
                        error={errors.otherPayrollAnnual}
                        onChange={handlePayrollChange("otherPayrollAnnual")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard className={oldRegimeDisabled ? "opacity-55" : ""}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="md:max-w-[200px]">
                  <h2 className="font-display text-xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                    Chapter VI-A
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {oldRegimeDisabled
                      ? "Only active in old regime — switch regime to edit."
                      : "Old regime deductions (capped per section limits)."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, deductionsOpen: !c.deductionsOpen }))}
                  className="rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98] dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-[color:var(--foreground)] dark:hover:bg-violet-950/40"
                >
                  {state.deductionsOpen ? "See less" : "See more"}
                </button>
              </div>
              {state.deductionsOpen ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {deductionConfigs.map((config) => {
                    const ageBlocked =
                      (config.seniorOnly && state.ageGroup === "below60") ||
                      (config.nonSeniorOnly && state.ageGroup !== "below60");
                    const disabled = oldRegimeDisabled || ageBlocked;
                    return (
                      <InputField
                        key={config.key}
                        label={config.label}
                        value={disabled ? "0" : state.deductions[config.key]}
                        helper={ageBlocked ? "Not for this age group." : config.helper}
                        error={errors[config.key]}
                        disabled={disabled}
                        onChange={handleDeductionChange(config.key)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard className={oldRegimeDisabled ? "opacity-55" : ""}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="md:max-w-[min(100%,28rem)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Section 10(13A)
                  </p>
                  <h2 className="mt-1 font-display text-xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                    House Rent Allowance (HRA)
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {oldRegimeDisabled
                      ? "HRA exemption applies in the old regime only — switch to Old to edit and include it in tax."
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, hraOpen: !c.hraOpen }))}
                  className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98] dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-[color:var(--foreground)] dark:hover:bg-violet-950/40"
                >
                  {state.hraOpen ? "See less" : "See more"}
                </button>
              </div>
              {state.hraOpen ? (
                <div className="mt-5 space-y-4 rounded-2xl border border-[color:var(--nested-panel-border)] bg-[color:var(--nested-panel)] p-4 dark:border-slate-600/55 dark:bg-slate-950/35">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-medium text-[color:var(--muted)]">Computed exempt HRA (annual)</p>
                    <p className="font-display text-lg tabular-nums text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                      {formatCurrency(hraExemptAnnual)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      City type (Rule 2A)
                    </p>
                    <SleekPillToggle
                      ariaLabel="Metro or non-metro for HRA"
                      className="max-w-md"
                      value={state.hraIsMetro ? "metro" : "nonmetro"}
                      onChange={(v) => setState((c) => ({ ...c, hraIsMetro: v === "metro" }))}
                      disabled={oldRegimeDisabled}
                      options={[
                        { id: "metro", label: "Metro" },
                        { id: "nonmetro", label: "Non-Metro" },
                      ]}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Annual rent paid"
                      value={state.hraRentAnnual}
                      helper=""
                      error={errors.hraRentAnnual}
                      disabled={oldRegimeDisabled}
                      onChange={(e) => setState((c) => ({ ...c, hraRentAnnual: e.target.value }))}
                    />
                    <InputField
                      label="Annual HRA received (from employer)"
                      value={hraReceivedFieldValue}
                      helper="Defaults to 25% of annual fixed pay until you change it."
                      error={state.hraReceivedManual ? errors.hraReceivedAnnual : undefined}
                      disabled={oldRegimeDisabled}
                      onChange={(e) =>
                        setState((c) => ({
                          ...c,
                          hraReceivedManual: true,
                          hraReceivedAnnual: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>

          <div className="stagger-children space-y-6">
            <SectionCard>
              <h2 className="font-display text-xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                Tax snapshot
              </h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Comparing both regimes
                {hasAnyFlexiExemption ? " with your flexi exemptions" : ""}.
                {!regimeSavingsVersusOther.tie ? (
                  <>
                    {" "}
                    Recommended:{" "}
                    <span className="font-medium text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                      {displayRegimeName(comparisonWithBenefits.bestRegime)}
                    </span>
                    .
                  </>
                ) : null}
              </p>

              <div className="mt-5 space-y-5 rounded-2xl border border-slate-300/85 bg-gradient-to-br from-slate-100/95 to-slate-50/90 p-4 dark:border-slate-600/60 dark:from-slate-900/50 dark:to-slate-900/30 sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricTile
                    label={TAX_SNAPSHOT_LABELS.oldRegimeTax(hasAnyFlexiExemption)}
                    value={formatCurrency(comparisonWithBenefits.oldRegime.totalTax)}
                    winner={oldRegimeTileWinner}
                  />
                  <MetricTile
                    label={TAX_SNAPSHOT_LABELS.newRegimeTax(hasAnyFlexiExemption)}
                    value={formatCurrency(comparisonWithBenefits.newRegime.totalTax)}
                    winner={newRegimeTileWinner}
                  />
                  {regimeSavingsVersusOther.tie ? (
                    <MetricTile
                      label={TAX_SNAPSHOT_LABELS.regimesEqualTitle}
                      value={formatCurrency(0)}
                      caption={TAX_SNAPSHOT_LABELS.regimesEqualCaption(hasAnyFlexiExemption)}
                    />
                  ) : (
                    <MetricTile
                      label={TAX_SNAPSHOT_LABELS.saveWithRegime(regimeSavingsVersusOther.betterName)}
                      value={formatCurrency(regimeSavingsVersusOther.savings)}
                      caption={TAX_SNAPSHOT_LABELS.saveCaption(regimeSavingsVersusOther.worseName)}
                      accent
                    />
                  )}
                </div>

                {!regimeSavingsVersusOther.tie && state.preferredRegime !== comparisonWithBenefits.bestRegime ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setState((c) => ({ ...c, preferredRegime: comparisonWithBenefits.bestRegime }))
                      }
                      className="w-full rounded-full border border-emerald-400/55 bg-emerald-100/70 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 sm:w-auto dark:border-emerald-500/45 dark:bg-emerald-900/40 dark:text-emerald-100 dark:hover:bg-emerald-900/55"
                    >
                      Switch to {displayRegimeName(comparisonWithBenefits.bestRegime)} regime
                    </button>
                  </div>
                ) : null}

                {hasAnyFlexiExemption ? (
                  <div className="surface-success rounded-xl border px-3 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90 dark:text-emerald-200/90">
                      Flexi tax saved (annual)
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                          {TAX_SNAPSHOT_LABELS.flexiSavesOld}
                        </span>
                        <span className="ml-1.5 font-display tabular-nums text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                          {formatCurrency(flexiSavingsOldAnnual)}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                          {TAX_SNAPSHOT_LABELS.flexiSavesNew}
                        </span>
                        <span className="ml-1.5 font-display tabular-nums text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                          {formatCurrency(flexiSavingsNewAnnual)}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : null}

                {flexiFlipsBestRegime ? (
                  <p className="surface-warning rounded-lg border px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100">
                    Best regime without flexi:{" "}
                    <span className="font-medium text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                      {comparisonWithoutBenefits.bestRegime === "old" ? "Old" : "New"}
                    </span>
                    . With flexi:{" "}
                    <span className="font-medium text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                      {comparisonWithBenefits.bestRegime === "old" ? "Old" : "New"}
                    </span>
                    .
                  </p>
                ) : null}

                <div className="grid gap-3 border-t border-slate-200/90 pt-4 dark:border-slate-600/50 sm:grid-cols-2">
                  <MetricTile
                    label="Est. in hand / month (after payroll)"
                    value={formatCurrency(Math.round(postPayrollMonthly))}
                    accent
                  />
                  <MetricTile
                    label="Flexi lowers tax / year (selected regime)"
                    value={formatCurrency(flexiTaxSavedAnnual)}
                    caption={
                      flexiTaxSavedAnnual === 0
                        ? "Add flexi below to see savings vs zero flexi."
                        : "Versus flexi at zero in your selected regime."
                    }
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-xl text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                    Flexi benefits (Pluxee)
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Caps and tax exemption follow the regime you selected. Old regime includes office wear and books
                    (with annual caps); new regime treats those as taxable (inputs disabled) while fuel, meal, telecom,
                    wellness, gadgets, and driver follow the caps shown. Driver salary exemption is company-policy
                    dependent.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, flexiOpen: !c.flexiOpen }))}
                  className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98] dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-[color:var(--foreground)] dark:hover:bg-violet-950/40"
                >
                  {state.flexiOpen ? "See less" : "See more"}
                </button>
              </div>
              {state.flexiOpen ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {benefitConfigs.map((benefit) => (
                    <div key={benefit.key}>
                      <BenefitField
                        benefit={benefit}
                        regime={state.preferredRegime}
                        value={state.benefits[benefit.key]}
                        onChange={handleBenefitChange(benefit.key)}
                      />
                      {errors[benefit.key] ? <p className="mt-1 text-xs text-red-600">{errors[benefit.key]}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[color:var(--muted)]">
                  Collapsed by default — use{" "}
                  <span className="font-medium text-[color:var(--navy)] dark:text-[color:var(--foreground)]">
                    See more
                  </span>{" "}
                  to edit
                  flexi amounts (tax still uses your saved values).
                </p>
              )}
            </SectionCard>

            <BreakdownSection
              result={activeWithBenefits}
              title={state.preferredRegime === "old" ? "Old regime" : "New regime"}
              showDetails={showBreakdown}
              onToggle={() => setShowBreakdown((s) => !s)}
              payrollAnnual={payrollAnnualBreakdown}
              annualNetAfterPayroll={annualNetAfterPayroll}
            />

            <MonthlyScheduleCard rows={schedule} />
          </div>
        </div>
      </div>

      <footer className="mx-auto mt-16 max-w-7xl border-t border-[color:var(--line)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl text-xs leading-relaxed text-[color:var(--muted)]">
            This tool produces estimates for illustration only. Tax outcomes depend on your employer&apos;s payroll,
            declarations, proofs, and CBDT rules in force. It is not legal, tax, or financial advice — confirm with your
            payroll team or a qualified chartered accountant before acting.
          </p>
          <p className="text-sm text-[color:var(--muted)] sm:text-right">
            Built with <span className="text-red-500">&#9829;</span> for clearer salary planning.
          </p>
        </div>
      </footer>
    </main>
  );
}
