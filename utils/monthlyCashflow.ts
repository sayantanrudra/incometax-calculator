/** FY month order: April through March (Indian FY). */
export const FY_MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

export type FyMonthLabel = (typeof FY_MONTH_LABELS)[number];

export interface MonthlyCashflowRow {
  month: string;
  gross: number;
  tax: number;
  netAfterTax: number;
  highlight: boolean;
}

export interface BuildMonthlyCashflowParams {
  fixedPayAnnual: number;
  variablePayAnnual: number;
  /** Length 12; index aligns with `FY_MONTH_LABELS`. */
  variableMonthSelected: boolean[];
  totalCtc: number;
  totalTaxAnnual: number;
}

const countSelected = (mask: boolean[]) => mask.filter(Boolean).length;

const roundCurrency = (value: number) => Math.round(value);

/**
 * Blends (a) even time-based accrual of annual tax and (b) cumulative gross share of the year.
 * Monthly TDS = increase in that blended liability curve, so variable months pull more withholding
 * while later “base” months can stay a bit higher than pure gross-share — closer to employer re-projection behaviour.
 * Totals still match `totalTaxAnnual` (last month absorbs rounding).
 */
const TDS_TIME_BLEND = 0.26;

/**
 * Spreads variable pay across selected FY months (equal split).
 * Monthly tax is derived from a cumulative liability curve (see `TDS_TIME_BLEND`), not gross ÷ CTC alone.
 */
export const buildMonthlyCashflow = (params: BuildMonthlyCashflowParams): MonthlyCashflowRow[] => {
  const { fixedPayAnnual, variablePayAnnual, variableMonthSelected, totalCtc, totalTaxAnnual } = params;
  const fixedMonthly = Math.max(0, fixedPayAnnual) / 12;
  const selected = countSelected(variableMonthSelected);
  const perVariableHit =
    selected > 0 && variablePayAnnual > 0 ? variablePayAnnual / selected : 0;
  const highlightVariableMonths = selected > 0 && selected < FY_MONTH_LABELS.length;

  const grosses = FY_MONTH_LABELS.map((label, index) => {
    const highlight = highlightVariableMonths && Boolean(variableMonthSelected[index]);
    const gross = fixedMonthly + (highlight ? perVariableHit : 0);
    return { label, index, highlight, gross };
  });

  if (totalCtc <= 0 || totalTaxAnnual <= 0) {
    return grosses.map(({ label, highlight, gross }) => ({
      month: highlight ? `${label} · variable` : label,
      gross,
      tax: 0,
      netAfterTax: gross,
      highlight,
    }));
  }

  let cumGross = 0;
  let prevLiability = 0;
  const rawTaxes: number[] = [];

  for (let i = 0; i < 12; i++) {
    cumGross += grosses[i].gross;
    const monthIndex = i + 1;
    const liability =
      totalTaxAnnual *
      (TDS_TIME_BLEND * (monthIndex / 12) + (1 - TDS_TIME_BLEND) * (cumGross / totalCtc));
    rawTaxes.push(Math.max(0, liability - prevLiability));
    prevLiability = liability;
  }

  const taxesRounded = rawTaxes.map((t) => roundCurrency(t));
  const sumRounded = taxesRounded.reduce((a, b) => a + b, 0);
  const drift = roundCurrency(totalTaxAnnual) - sumRounded;
  taxesRounded[11] += drift;

  return grosses.map(({ label, highlight, gross }, i) => {
    const tax = taxesRounded[i];
    return {
      month: highlight ? `${label} · variable` : label,
      gross,
      tax,
      netAfterTax: Math.max(0, gross - tax),
      highlight,
    };
  });
};

export const defaultVariableMonthMask = (): boolean[] =>
  FY_MONTH_LABELS.map((m) => m === "Sep" || m === "Mar");
