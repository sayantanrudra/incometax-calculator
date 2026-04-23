"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";
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
  | "driver";

interface SalaryState {
  fixedPay: string;
  variablePay: string;
  employerPf: string;
  professionalTax: string;
  employeePfAnnual: string;
  lwfEmployeeAnnual: string;
  otherPayrollAnnual: string;
  ageGroup: AgeGroup;
  preferredRegime: TaxRegime;
  isDirectorEligible: boolean;
  advancedOpen: boolean;
  deductionsOpen: boolean;
  flexiOpen: boolean;
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
  directorOnly?: boolean;
}

interface MonthlyRow {
  month: string;
  gross: number;
  tax: number;
  net: number;
  highlight: boolean;
}

type ValidationErrors = Partial<Record<SalaryField | DeductionField | BenefitKey | PayrollField, string>>;

const DIRECTOR_MIN_CTC = 8_000_000;
const MAX_PAYROLL_LINE_ANNUAL = MAX_GROSS_INCOME;
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

/** Typical EPF employee + employer share at ₹1,800/month each (annualised for inputs). */
const DEFAULT_EPF_MONTHLY = 1_800;
const DEFAULT_EPF_ANNUAL = DEFAULT_EPF_MONTHLY * 12;
const DEFAULT_EPF_ANNUAL_STRING = String(DEFAULT_EPF_ANNUAL);

const defaultState: SalaryState = {
  fixedPay: "1000000",
  variablePay: "0",
  employerPf: DEFAULT_EPF_ANNUAL_STRING,
  professionalTax: "0",
  employeePfAnnual: DEFAULT_EPF_ANNUAL_STRING,
  lwfEmployeeAnnual: "0",
  otherPayrollAnnual: "0",
  ageGroup: "below60",
  preferredRegime: "new",
  isDirectorEligible: false,
  advancedOpen: false,
  deductionsOpen: false,
  flexiOpen: false,
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
  { key: "meal", label: "Meal", oldAnnualMax: 120_000, newAnnualMax: 120_000, note: "Max ₹1,20,000 / year" },
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
  {
    key: "driver",
    label: "Driver",
    oldAnnualMax: 300_000,
    newAnnualMax: 300_000,
    note: "Max ₹3,00,000 / year",
    directorOnly: true,
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const numericValue = (value: string) => {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getBenefitCap = (benefit: BenefitConfig, regime: TaxRegime, isDirectorEligible: boolean) => {
  if (benefit.directorOnly && !isDirectorEligible) {
    return 0;
  }
  return regime === "old" ? benefit.oldAnnualMax : benefit.newAnnualMax;
};

const buildMonthlySchedule = (totalCtc: number, variablePay: number, totalTax: number) => {
  const fixedMonthly = Math.max(0, totalCtc - variablePay) / 12;
  const variableHalf = variablePay / 2;

  return MONTHS.map<MonthlyRow>((month) => {
    const highlight = month === "Sep" || month === "Mar";
    const gross = fixedMonthly + (highlight ? variableHalf : 0);
    const tax = totalCtc > 0 ? (gross / totalCtc) * totalTax : 0;

    return {
      month: highlight ? `${month} · variable` : month,
      gross,
      tax,
      net: Math.max(0, gross - tax),
      highlight,
    };
  });
};

function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`surface-card elevate-hover rounded-[1.5rem] border p-5 sm:p-6 ${className}`}>
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
      <span className={`text-sm font-medium ${disabled ? "text-slate-400" : "text-[color:var(--navy)]"}`}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-[color:var(--navy)] outline-none transition duration-200 focus:border-[color:var(--accent-violet)] focus:ring-2 focus:ring-[color:var(--accent-violet)]/18 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      />
      <span className={`text-xs ${error ? "text-red-600" : "text-[color:var(--muted)]"}`}>{error || helper}</span>
    </label>
  );
}

function RegimeToggle({
  value,
  onChange,
}: {
  value: TaxRegime;
  onChange: (regime: TaxRegime) => void;
}) {
  const options: Array<{ id: TaxRegime; label: string }> = [
    { id: "new", label: "New regime" },
    { id: "old", label: "Old regime" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tax regime"
      className="relative flex w-full max-w-md rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]"
    >
      <span
        aria-hidden
        className="regime-toggle-thumb pointer-events-none absolute bottom-1 top-1 rounded-xl bg-white shadow-[0_4px_14px_rgba(109,75,217,0.12)] ring-1 ring-slate-200/50 transition-[left,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: "calc(50% - 6px)",
          left: value === "new" ? "4px" : "calc(50% + 2px)",
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
            onClick={() => onChange(opt.id)}
            className={`relative z-[1] min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-violet)] ${
              active ? "text-[color:var(--navy)]" : "text-[color:var(--muted)] hover:text-[color:var(--navy)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
                ? "border-[color:var(--accent-violet)]/35 bg-gradient-to-br from-[color:var(--accent-violet-soft)] to-[color:var(--accent-soft)] text-[color:var(--navy)] shadow-sm"
                : "border-slate-200/90 bg-slate-50/80 text-[color:var(--muted)] hover:border-slate-300/90 hover:bg-white/60"
            }`}
          >
            <span className="block font-semibold text-[color:var(--navy)]">{opt.label}</span>
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
}: {
  label: string;
  value: string;
  accent?: boolean;
  caption?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-transform duration-200 will-change-transform motion-safe:hover:-translate-y-0.5 ${
        accent
          ? "border-teal-200/70 bg-gradient-to-br from-teal-50/85 via-white to-violet-50/50 shadow-[0_8px_24px_rgba(13,159,122,0.08)]"
          : "border-slate-200/75 bg-gradient-to-br from-slate-50/90 to-white/80 hover:border-slate-300/80"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 font-display text-xl text-[color:var(--navy)] sm:text-2xl">{value}</p>
      {caption ? <p className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">{caption}</p> : null}
    </div>
  );
}

function BenefitField({
  benefit,
  regime,
  value,
  isDirectorEligible,
  onChange,
}: {
  benefit: BenefitConfig;
  regime: TaxRegime;
  value: string;
  isDirectorEligible: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const cap = getBenefitCap(benefit, regime, isDirectorEligible);
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
        className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-[color:var(--navy)] outline-none transition duration-200 focus:border-[color:var(--accent-violet)] focus:ring-2 focus:ring-[color:var(--accent-violet)]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      <span className={`text-xs ${disabled ? "text-slate-400" : "text-[color:var(--muted)]"}`}>
        {cap > 0 ? `${benefit.note}${benefit.directorOnly ? " · Directors & above only." : ""}` : "Not applicable in this setup."}
      </span>
    </label>
  );
}

interface PayrollAnnualBreakdown {
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
}: {
  result: TaxComputation;
  title: string;
  showDetails: boolean;
  onToggle: () => void;
  payrollAnnual: PayrollAnnualBreakdown;
}) {
  const taxPercent = result.totalCtc > 0 ? (result.totalTax / result.totalCtc) * 100 : 0;
  const exemptionPercent = result.totalCtc > 0 ? (result.totalExemptions / result.totalCtc) * 100 : 0;
  const netPercent = Math.max(0, 100 - taxPercent - exemptionPercent);

  /** CTC not credited as bank salary: ER PF + flexi; then payslip deductions (EE PF, PT, LWF, other). */
  const payrollTotal =
    result.employerPfDeduction +
    result.pluxeeExemption +
    payrollAnnual.employeePf +
    payrollAnnual.professionalTax +
    payrollAnnual.lwfEmployee +
    payrollAnnual.other;
  const annualAfterTaxBeforePayroll = Math.max(0, result.totalCtc - result.totalTax);
  const annualAfterPayroll = Math.max(0, annualAfterTaxBeforePayroll - payrollTotal);
  const monthlyAfterPayroll = annualAfterPayroll / 12;

  return (
    <SectionCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Breakdown</p>
          <h2 className="mt-1 font-display text-2xl text-[color:var(--navy)]">{title}</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Income-tax computation, then payslip deductions for estimated in-hand.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98]"
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
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100/90">
              <Row label="Gross income (CTC)" value={formatCurrency(result.totalCtc)} />
              <Row label="Employer PF (exempt component)" value={`− ${formatCurrency(result.employerPfDeduction)}`} />
              <Row
                label="Professional tax (deduction in old regime only)"
                value={`− ${formatCurrency(result.professionalTaxDeduction)}`}
              />
              <Row label="Standard deduction" value={`− ${formatCurrency(result.standardDeduction)}`} />
              <Row label="Pluxee / flexi exempt" value={`− ${formatCurrency(result.pluxeeExemption)}`} />
              <Row label="Chapter VI-A" value={`− ${formatCurrency(result.chapterVIADeductions)}`} />
              <Row label="Taxable income" value={formatCurrency(result.taxableIncome)} strong />
              <p className="px-0 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Tax on taxable income (FY 2024-25 · Section 115BAC slabs, Budget 2024)
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
              Post-tax payroll (CTC &amp; payslip, annual)
            </p>
            <p className="mb-2 text-xs text-[color:var(--muted)]">
              Employer PF and Pluxee/flexi are CTC routed to ER PF and benefits (not bank salary). We subtract them
              after tax along with payslip lines so in-hand is cash retained from the package.
            </p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100/90">
              <Row label="Net after income tax" value={formatCurrency(annualAfterTaxBeforePayroll)} />
              <Row
                label="Employer PF (ER share, from CTC)"
                value={`− ${formatCurrency(result.employerPfDeduction)}`}
              />
              <Row
                label="Pluxee / flexi (benefits, not bank salary)"
                value={`− ${formatCurrency(result.pluxeeExemption)}`}
              />
              <Row label="Employee PF (EPF)" value={`− ${formatCurrency(payrollAnnual.employeePf)}`} />
              <Row label="Professional tax (payslip)" value={`− ${formatCurrency(payrollAnnual.professionalTax)}`} />
              <Row label="LWF (employee)" value={`− ${formatCurrency(payrollAnnual.lwfEmployee)}`} />
              <Row label="Other payroll deductions" value={`− ${formatCurrency(payrollAnnual.other)}`} />
              <Row label="Net after tax &amp; payroll (annual)" value={formatCurrency(annualAfterPayroll)} strong />
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
            value={formatCurrency(annualAfterPayroll)}
            caption="After ER PF, flexi, EPF, PT, LWF, other."
          />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Composition</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-200/50 shadow-inner">
          <div
            className="composition-segment bg-[color:var(--chart-tax)]"
            style={{ width: `${Math.min(taxPercent, 100)}%` }}
            title="Tax"
          />
          <div
            className="composition-segment bg-[color:var(--chart-exempt)]"
            style={{ width: `${Math.min(exemptionPercent, 100)}%` }}
            title="Exemptions"
          />
          <div
            className="composition-segment bg-[color:var(--chart-net)]"
            style={{ width: `${Math.min(netPercent, 100)}%` }}
            title="Net"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chart-tax)] shadow-sm ring-1 ring-white/50" /> Tax
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chart-exempt)] shadow-sm ring-1 ring-white/50" /> Exemptions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--chart-net)] shadow-sm ring-1 ring-white/50" /> Net
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${strong ? "font-semibold text-[color:var(--navy)]" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
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
          <h2 className="mt-1 font-display text-2xl text-[color:var(--navy)]">Cashflow view</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Tax spread by month (simplified model).</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98]"
        >
          {open ? "See less" : "See more"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-4 gap-3 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              <span>Month</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Tax</span>
              <span className="text-right">Net in-hand</span>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <div
                  key={row.month}
                        className={`grid grid-cols-4 gap-3 px-3 py-2.5 text-sm transition-colors duration-300 ${row.highlight ? "bg-gradient-to-r from-violet-50/80 to-teal-50/50 font-medium" : ""}`}
                >
                  <span className="text-[color:var(--navy)]">{row.month}</span>
                  <span className="text-right tabular-nums text-slate-700">{formatCurrency(row.gross)}</span>
                  <span className="text-right tabular-nums text-slate-700">{formatCurrency(row.tax)}</span>
                  <span className="text-right tabular-nums text-[color:var(--navy)]">{formatCurrency(row.net)}</span>
                </div>
              ))}
            </div>
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
  const variablePay = numericValue(state.variablePay);
  const employerPf = numericValue(state.employerPf);
  const professionalTax = numericValue(state.professionalTax);
  const employeePfAnnual = numericValue(state.employeePfAnnual);
  const lwfEmployeeAnnual = numericValue(state.lwfEmployeeAnnual);
  const otherPayrollAnnual = numericValue(state.otherPayrollAnnual);
  const totalCtc = fixedPay + variablePay;
  const canEnableDirector = totalCtc >= DIRECTOR_MIN_CTC;

  useEffect(() => {
    if (!canEnableDirector && state.isDirectorEligible) {
      setState((current) => ({
        ...current,
        isDirectorEligible: false,
        benefits: { ...current.benefits, driver: "0" },
      }));
    }
  }, [canEnableDirector, state.isDirectorEligible]);

  const errors = useMemo(() => {
    const nextErrors: ValidationErrors = {};
    const salaryChecks: Array<[SalaryField, number, number]> = [
      ["fixedPay", fixedPay, Number.MAX_SAFE_INTEGER],
      ["variablePay", variablePay, Number.MAX_SAFE_INTEGER],
      ["employerPf", employerPf, MAX_EMPLOYER_PF],
      ["professionalTax", professionalTax, MAX_PROFESSIONAL_TAX],
    ];
    salaryChecks.forEach(([field, value, max]) => {
      if (value < 0) nextErrors[field] = "Cannot be negative.";
      else if (value > max) nextErrors[field] = "Value too high.";
    });
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
      const cap = getBenefitCap(benefit, state.preferredRegime, state.isDirectorEligible && canEnableDirector);
      if (raw < 0) nextErrors[benefit.key] = "Cannot be negative.";
      else if (raw > cap && cap > 0) nextErrors[benefit.key] = `Max ${formatCurrency(cap)}.`;
    });
    return nextErrors;
  }, [
    canEnableDirector,
    employeePfAnnual,
    employerPf,
    fixedPay,
    lwfEmployeeAnnual,
    otherPayrollAnnual,
    professionalTax,
    state.benefits,
    state.deductions,
    state.isDirectorEligible,
    state.preferredRegime,
    variablePay,
  ]);

  const benefitExemptions = useMemo(
    () =>
      (["old", "new"] as TaxRegime[]).reduce<Record<TaxRegime, number>>(
        (acc, regime) => {
          acc[regime] = benefitConfigs.reduce((sum, benefit) => {
            const cap = getBenefitCap(benefit, regime, state.isDirectorEligible && canEnableDirector);
            return sum + clamp(numericValue(state.benefits[benefit.key]), 0, cap);
          }, 0);
          return acc;
        },
        { old: 0, new: 0 },
      ),
    [canEnableDirector, state.benefits, state.isDirectorEligible],
  );

  const baseInput = {
    fixedPay,
    variablePay,
    employerPf,
    professionalTax,
    ageGroup: state.ageGroup,
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

  const schedule = useMemo(
    () => buildMonthlySchedule(totalCtc, variablePay, activeWithBenefits.totalTax),
    [activeWithBenefits.totalTax, totalCtc, variablePay],
  );

  const postPayrollMonthly = useMemo(() => {
    const payrollCashOut =
      activeWithBenefits.employerPfDeduction +
      activeWithBenefits.pluxeeExemption +
      employeePfAnnual +
      otherPayrollAnnual +
      professionalTax +
      lwfEmployeeAnnual;
    return Math.max(0, totalCtc - activeWithBenefits.totalTax - payrollCashOut) / 12;
  }, [
    activeWithBenefits.employerPfDeduction,
    activeWithBenefits.pluxeeExemption,
    activeWithBenefits.totalTax,
    employeePfAnnual,
    lwfEmployeeAnnual,
    otherPayrollAnnual,
    professionalTax,
    totalCtc,
  ]);

  const payrollAnnualBreakdown = useMemo(
    (): PayrollAnnualBreakdown => ({
      employeePf: employeePfAnnual,
      professionalTax,
      lwfEmployee: lwfEmployeeAnnual,
      other: otherPayrollAnnual,
    }),
    [employeePfAnnual, lwfEmployeeAnnual, otherPayrollAnnual, professionalTax],
  );

  const flexiTaxSavedAnnual = useMemo(
    () => Math.max(0, activeWithoutBenefits.totalTax - activeWithBenefits.totalTax),
    [activeWithBenefits.totalTax, activeWithoutBenefits.totalTax],
  );

  const whatChangedMessage = useMemo(() => {
    const without = comparisonWithoutBenefits.bestRegime === "old" ? "Old regime" : "New regime";
    const withB = comparisonWithBenefits.bestRegime === "old" ? "Old regime" : "New regime";
    const same = comparisonWithoutBenefits.bestRegime === comparisonWithBenefits.bestRegime;
    const regimeLine = same
      ? `${withB} stays best with Pluxee applied.`
      : `${withB} becomes better once Pluxee is included.`;
    return `${without} is best without flexi benefits. ${regimeLine} Extra tax saved with Pluxee in this view: ${formatCurrency(flexiTaxSavedAnnual)}.`;
  }, [
    comparisonWithBenefits.bestRegime,
    comparisonWithoutBenefits.bestRegime,
    flexiTaxSavedAnnual,
  ]);

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
    <main className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="hero-wash soft-ring animate-fade-in-up mb-8 rounded-[1.75rem] border border-[color:var(--line)] px-5 py-5 sm:px-6">
          <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="bg-gradient-to-r from-[color:var(--navy)] via-[color:var(--accent-violet)] to-[color:var(--accent)] bg-clip-text font-display text-2xl tracking-tight text-transparent motion-reduce:bg-none motion-reduce:text-[color:var(--navy)]">
                Income Tax Calculator
              </p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[color:var(--muted)]">
                FY 2024-25 · old &amp; new regime, flexi benefits, and take-home estimates
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,450px)_minmax(0,1fr)]">
          <div className="stagger-children space-y-6">
            <SectionCard>
              <div className="mb-5">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Quick setup</p>
                <h1 className="mt-1 font-display text-2xl tracking-tight text-[color:var(--navy)]">Your pay</h1>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Fixed compensation"
                    value={state.fixedPay}
                    helper=""
                    error={errors.fixedPay}
                    onChange={handleSalaryChange("fixedPay")}
                  />
                  <InputField
                    label="Variable pay / bonus"
                    value={state.variablePay}
                    helper=""
                    error={errors.variablePay}
                    onChange={handleSalaryChange("variablePay")}
                  />
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Total CTC</p>
                    <p className="mt-1 font-display text-3xl text-[color:var(--navy)]">{formatCurrency(totalCtc)}</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[color:var(--muted)]">Regime</p>
                    <RegimeToggle value={state.preferredRegime} onChange={(regime) => setState((c) => ({ ...c, preferredRegime: regime }))} />
                    <p className="text-xs font-medium text-[color:var(--muted)]">Age</p>
                    <AgeToggle value={state.ageGroup} onChange={(age) => setState((c) => ({ ...c, ageGroup: age }))} />
                    <div className="flex justify-end border-t border-slate-200/80 pt-3">
                      <button
                        type="button"
                        onClick={() => setState((c) => ({ ...c, advancedOpen: !c.advancedOpen }))}
                        className="rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98]"
                      >
                        {state.advancedOpen ? "Hide assumptions" : "Advanced"}
                      </button>
                    </div>
                  </div>
                </div>

                {state.advancedOpen ? (
                  <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                        Employer PF &amp; professional tax
                      </p>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <InputField
                          label="Employer PF (annual)"
                          value={state.employerPf}
                          helper={``}
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
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
                      <p className="text-sm font-medium text-[color:var(--navy)]">Estimated take-home (cashflow)</p>
                      <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted)]">
                        After income tax, we subtract employer PF, Pluxee/flexi (non-cash benefits), employee PF, PT,
                        LWF, and other lines from CTC so monthly in-hand matches cash retained from the package.
                      </p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <InputField
                          label="Employee PF (annual)"
                          value={state.employeePfAnnual}
                          helper={``}
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <input
                        type="checkbox"
                        checked={state.isDirectorEligible && canEnableDirector}
                        disabled={!canEnableDirector}
                        onChange={(e) => setState((c) => ({ ...c, isDirectorEligible: e.target.checked }))}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-[color:var(--accent-violet)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-violet)]/30 focus-visible:ring-offset-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-[color:var(--navy)]">Directors &amp; above</span>
                        <span className="text-xs text-[color:var(--muted)]">Unlocks driver benefit when CTC ≥ ₹80 lakh.</span>
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard className={oldRegimeDisabled ? "opacity-55" : ""}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="md:max-w-[200px]">
                  <h2 className="font-display text-xl text-[color:var(--navy)]">Chapter VI-A</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {oldRegimeDisabled
                      ? "Only active in old regime — switch regime to edit."
                      : "Old regime deductions (capped per section limits)."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, deductionsOpen: !c.deductionsOpen }))}
                  className="rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98]"
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
          </div>

          <div className="stagger-children space-y-6">
            <div className="stagger-children grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricTile
                label="Best without Pluxee"
                value={comparisonWithoutBenefits.bestRegime === "old" ? "Old" : "New"}
              />
              <MetricTile
                label="Best with Pluxee"
                value={comparisonWithBenefits.bestRegime === "old" ? "Old" : "New"}
                accent
              />
              <MetricTile label="Pluxee tax saved" value={formatCurrency(flexiTaxSavedAnnual)} />
              <MetricTile
                label="After income tax (monthly)"
                value={formatCurrency(activeWithBenefits.monthlyNetInHand)}
              />
              <MetricTile
                label="After payroll (est. monthly)"
                value={formatCurrency(Math.round(postPayrollMonthly))}
              />
            </div>

            <SectionCard>
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{whatChangedMessage}</p>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Selected regime tax: <span className="font-semibold text-[color:var(--navy)]">{formatCurrency(activeWithBenefits.totalTax)}</span>
              </p>
            </SectionCard>

            <SectionCard>
              <h2 className="font-display text-xl text-[color:var(--navy)]">Tax snapshot</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                How flexi changes tax in your <span className="font-medium text-[color:var(--navy)]">{state.preferredRegime === "old" ? "old" : "new"}</span> regime, then how old and new compare using the same flexi inputs.
              </p>

              <div className="mt-6 space-y-8">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                    Flexi in your selected regime
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <MetricTile
                      label="Tax before flexi (annual)"
                      value={formatCurrency(activeWithoutBenefits.totalTax)}
                      caption="Income tax when flexi is not treated as exempt."
                    />
                    <MetricTile
                      label="Tax after flexi (annual)"
                      value={formatCurrency(activeWithBenefits.totalTax)}
                      caption="Income tax with your flexi amounts applied."
                    />
                    <MetricTile
                      label="You save (annual)"
                      value={formatCurrency(flexiTaxSavedAnnual)}
                      accent={flexiTaxSavedAnnual > 0}
                      caption={
                        flexiTaxSavedAnnual === 0
                          ? "Enter flexi amounts below to see savings."
                          : "Versus leaving all flexi at zero."
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    Flexi treated as exempt (annual):{" "}
                    <span className="font-medium text-[color:var(--navy)]">
                      {formatCurrency(benefitExemptions[state.preferredRegime])}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">
                    Old vs new regime (same flexi inputs)
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    Totals use your current flexi amounts under each regime&apos;s rules.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <MetricTile
                      label="Old regime tax (annual)"
                      value={formatCurrency(comparisonWithBenefits.oldRegime.totalTax)}
                      accent={state.preferredRegime === "old"}
                    />
                    <MetricTile
                      label="New regime tax (annual)"
                      value={formatCurrency(comparisonWithBenefits.newRegime.totalTax)}
                      accent={state.preferredRegime === "new"}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-6 text-xs text-[color:var(--muted)]">
                Taxable income, exemptions, and effective rate for the selected regime are in the breakdown below.
              </p>
            </SectionCard>

            <SectionCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-xl text-[color:var(--navy)]">Flexi benefits (Pluxee)</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">Annual exempt amounts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, flexiOpen: !c.flexiOpen }))}
                  className="shrink-0 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--navy)] shadow-sm transition duration-200 hover:border-[color:var(--accent-violet)]/25 hover:bg-violet-50/40 hover:shadow-md motion-safe:active:scale-[0.98]"
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
                        isDirectorEligible={state.isDirectorEligible && canEnableDirector}
                        onChange={handleBenefitChange(benefit.key)}
                      />
                      {errors[benefit.key] ? <p className="mt-1 text-xs text-red-600">{errors[benefit.key]}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[color:var(--muted)]">
                  Collapsed by default — use <span className="font-medium text-[color:var(--navy)]">See more</span> to edit
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
            />

            <MonthlyScheduleCard rows={schedule} />
          </div>
        </div>
      </div>
    </main>
  );
}
