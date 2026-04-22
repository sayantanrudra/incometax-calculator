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
  MAX_OTHER_DEDUCTION,
  MAX_PROFESSIONAL_TAX,
  TaxComputation,
  TaxRegime,
  compareTaxRegimes,
} from "../utils/calculateTax";

type SalaryField = "fixedPay" | "variablePay" | "employerPf" | "professionalTax";
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
  ageGroup: AgeGroup;
  preferredRegime: TaxRegime;
  isDirectorEligible: boolean;
  advancedOpen: boolean;
  deductionsOpen: boolean;
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

type ValidationErrors = Partial<Record<SalaryField | DeductionField | BenefitKey, string>>;

const DIRECTOR_MIN_CTC = 8_000_000;
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const defaultState: SalaryState = {
  fixedPay: "1000000",
  variablePay: "100000",
  employerPf: "0",
  professionalTax: "2400",
  ageGroup: "below60",
  preferredRegime: "new",
  isDirectorEligible: false,
  advancedOpen: false,
  deductionsOpen: false,
  deductions: {
    deduction80C: "150000",
    deduction80CCD1B: "50000",
    deduction80D: "25000",
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
    <div
      className={`rounded-[1.5rem] border border-slate-200/90 bg-white/95 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6 ${className}`}
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
      <span className={`text-sm font-medium ${disabled ? "text-slate-400" : "text-[color:var(--navy)]"}`}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[color:var(--navy)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
      className="flex w-full max-w-md rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
              active
                ? "bg-white text-[color:var(--navy)] shadow-sm ring-1 ring-slate-200/80"
                : "text-[color:var(--muted)] hover:text-[color:var(--navy)]"
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
            className={`min-h-[44px] flex-1 rounded-xl border px-2 py-2.5 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] sm:text-center ${
              active
                ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--navy)] shadow-sm"
                : "border-slate-200/90 bg-slate-50/80 text-[color:var(--muted)] hover:border-slate-300"
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
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white"
          : "border-slate-200/80 bg-slate-50/50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 font-display text-xl text-[color:var(--navy)] sm:text-2xl">{value}</p>
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
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[color:var(--navy)] outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      <span className={`text-xs ${disabled ? "text-slate-400" : "text-[color:var(--muted)]"}`}>
        {cap > 0 ? `${benefit.note}${benefit.directorOnly ? " · Directors & above only." : ""}` : "Not applicable in this setup."}
      </span>
    </label>
  );
}

function BreakdownSection({
  result,
  title,
  showDetails,
  onToggle,
}: {
  result: TaxComputation;
  title: string;
  showDetails: boolean;
  onToggle: () => void;
}) {
  const taxPercent = result.totalCtc > 0 ? (result.totalTax / result.totalCtc) * 100 : 0;
  const exemptionPercent = result.totalCtc > 0 ? (result.totalExemptions / result.totalCtc) * 100 : 0;
  const netPercent = Math.max(0, 100 - taxPercent - exemptionPercent);

  return (
    <SectionCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Breakdown</p>
          <h2 className="mt-1 font-display text-2xl text-[color:var(--navy)]">{title}</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Tax, exemptions and net in-hand split.</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-[color:var(--navy)] hover:bg-slate-100"
        >
          {showDetails ? "See less" : "See more"}
        </button>
      </div>

      {showDetails ? (
        <div className="mt-6 space-y-0 divide-y divide-slate-100 text-sm">
          <Row label="Gross income (CTC)" value={formatCurrency(result.totalCtc)} />
          <Row label="Employer PF" value={`− ${formatCurrency(result.employerPfDeduction)}`} />
          <Row label="Professional tax" value={`− ${formatCurrency(result.professionalTaxDeduction)}`} />
          <Row label="Standard deduction" value={`− ${formatCurrency(result.standardDeduction)}`} />
          <Row label="Pluxee / flexi exempt" value={`− ${formatCurrency(result.pluxeeExemption)}`} />
          <Row label="Chapter VI-A" value={`− ${formatCurrency(result.chapterVIADeductions)}`} />
          <Row label="Taxable income" value={formatCurrency(result.taxableIncome)} strong />
          <Row label="Tax (incl. cess)" value={formatCurrency(result.totalTax)} strong />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Taxable income" value={formatCurrency(result.taxableIncome)} />
          <MetricTile label="Total tax" value={formatCurrency(result.totalTax)} accent />
          <MetricTile label="Net in-hand" value={formatCurrency(result.totalCtc - result.totalTax)} />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Composition</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
          <div className="bg-[#f9708a]" style={{ width: `${Math.min(taxPercent, 100)}%` }} title="Tax" />
          <div className="bg-[#8b7cff]" style={{ width: `${Math.min(exemptionPercent, 100)}%` }} title="Exemptions" />
          <div className="bg-[#3dd9a9]" style={{ width: `${Math.min(netPercent, 100)}%` }} title="Net" />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f9708a]" /> Tax
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#8b7cff]" /> Exemptions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3dd9a9]" /> Net
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
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-[color:var(--navy)] hover:bg-slate-100"
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
                  className={`grid grid-cols-4 gap-3 px-3 py-2.5 text-sm ${row.highlight ? "bg-sky-50/50 font-medium" : ""}`}
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
  }, [canEnableDirector, employerPf, fixedPay, professionalTax, state.benefits, state.deductions, state.isDirectorEligible, state.preferredRegime, variablePay]);

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

  const whatChangedMessage = useMemo(() => {
    const without = comparisonWithoutBenefits.bestRegime === "old" ? "Old regime" : "New regime";
    const withB = comparisonWithBenefits.bestRegime === "old" ? "Old regime" : "New regime";
    const same = comparisonWithoutBenefits.bestRegime === comparisonWithBenefits.bestRegime;
    const regimeLine = same
      ? `${withB} stays best with Pluxee applied.`
      : `${withB} becomes better once Pluxee is included.`;
    const pluxeeDelta = Math.max(0, activeWithoutBenefits.totalTax - activeWithBenefits.totalTax);
    return `${without} is best without flexi benefits. ${regimeLine} Extra tax saved with Pluxee in this view: ${formatCurrency(pluxeeDelta)}.`;
  }, [
    activeWithBenefits.totalTax,
    activeWithoutBenefits.totalTax,
    comparisonWithBenefits.bestRegime,
    comparisonWithoutBenefits.bestRegime,
  ]);

  const handleSalaryChange = (field: SalaryField) => (event: ChangeEvent<HTMLInputElement>) => {
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
  const effectiveRate = Number.isFinite(activeWithBenefits.effectiveTaxRate) ? activeWithBenefits.effectiveTaxRate : 0;

  return (
    <main className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="hero-wash soft-ring mb-8 rounded-[1.75rem] border border-[color:var(--line)] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl text-[color:var(--navy)]">Income Tax Calculator</p>
              <p className="text-sm text-[color:var(--muted)]">FY 2024-25 · salary, Chapter VI-A and Pluxee-style benefits</p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-[color:var(--muted)]">
              Estimates include cess & surcharge per engine
            </span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <SectionCard>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Quick setup</p>
                  <h1 className="mt-1 font-display text-2xl text-[color:var(--navy)]">Salary profile</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, advancedOpen: !c.advancedOpen }))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-[color:var(--navy)] hover:bg-slate-100"
                >
                  {state.advancedOpen ? "Hide assumptions" : "Advanced"}
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Fixed compensation"
                    value={state.fixedPay}
                    helper="Annual fixed (₹10,00,000 default)."
                    error={errors.fixedPay}
                    onChange={handleSalaryChange("fixedPay")}
                  />
                  <InputField
                    label="Variable pay / bonus"
                    value={state.variablePay}
                    helper="Annual variable (₹1,00,000 default)."
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
                  </div>
                </div>

                {state.advancedOpen ? (
                  <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InputField
                        label="Employer PF"
                        value={state.employerPf}
                        helper="Exempt portion of CTC."
                        error={errors.employerPf}
                        onChange={handleSalaryChange("employerPf")}
                      />
                      <InputField
                        label="Professional tax"
                        value={state.professionalTax}
                        helper="Old regime deduction."
                        error={errors.professionalTax}
                        onChange={handleSalaryChange("professionalTax")}
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <input
                        type="checkbox"
                        checked={state.isDirectorEligible && canEnableDirector}
                        disabled={!canEnableDirector}
                        onChange={(e) => setState((c) => ({ ...c, isDirectorEligible: e.target.checked }))}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-[color:var(--accent)]"
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
                <div>
                  <h2 className="font-display text-xl text-[color:var(--navy)]">Chapter VI-A</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {oldRegimeDisabled ? "Only active in old regime — switch regime to edit." : "Old regime deductions (capped)."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((c) => ({ ...c, deductionsOpen: !c.deductionsOpen }))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-[color:var(--navy)]"
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

          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Best without Pluxee"
                value={comparisonWithoutBenefits.bestRegime === "old" ? "Old" : "New"}
              />
              <MetricTile
                label="Best with Pluxee"
                value={comparisonWithBenefits.bestRegime === "old" ? "Old" : "New"}
                accent
              />
              <MetricTile
                label="Pluxee tax saved"
                value={formatCurrency(Math.max(0, activeWithoutBenefits.totalTax - activeWithBenefits.totalTax))}
              />
              <MetricTile label="Monthly in-hand" value={formatCurrency(activeWithBenefits.monthlyNetInHand)} />
            </div>

            <SectionCard>
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted)]">Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{whatChangedMessage}</p>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Selected regime tax: <span className="font-semibold text-[color:var(--navy)]">{formatCurrency(activeWithBenefits.totalTax)}</span>
              </p>
            </SectionCard>

            <SectionCard>
              <h2 className="font-display text-xl text-[color:var(--navy)]">With vs without Pluxee</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricTile label="Old regime tax" value={formatCurrency(comparisonWithBenefits.oldRegime.totalTax)} />
                <MetricTile label="New regime tax" value={formatCurrency(comparisonWithBenefits.newRegime.totalTax)} accent />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricTile label="Taxable income" value={formatCurrency(activeWithBenefits.taxableIncome)} />
                <MetricTile label="Tax without Pluxee" value={formatCurrency(activeWithoutBenefits.totalTax)} />
                <MetricTile label="Effective rate" value={`${effectiveRate.toFixed(2)}%`} />
                <MetricTile label="Total exemptions" value={formatCurrency(activeWithBenefits.totalExemptions)} />
              </div>
            </SectionCard>

            <SectionCard>
              <h2 className="font-display text-xl text-[color:var(--navy)]">Flexi benefits (Pluxee)</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Annual exempt amounts. No separate “enable” — adjust values directly.</p>
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
            </SectionCard>

            <BreakdownSection
              result={activeWithBenefits}
              title={state.preferredRegime === "old" ? "Old regime" : "New regime"}
              showDetails={showBreakdown}
              onToggle={() => setShowBreakdown((s) => !s)}
            />

            <MonthlyScheduleCard rows={schedule} />
          </div>
        </div>
      </div>
    </main>
  );
}
