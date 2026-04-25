/** FY month order: April through March (Indian FY). */
export const FY_MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

export type FyMonthLabel = (typeof FY_MONTH_LABELS)[number];

export interface MonthlyCashflowRow {
  month: string;
  gross: number;
  tax: number;
  netAfterTax: number;
  highlight: boolean;
  postVariableCatchup: boolean;
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

const FY_MONTHS = FY_MONTH_LABELS.length;

/**
 * Spreads variable pay across selected FY months (equal split).
 * Monthly tax follows a payroll-style re-projection:
 * projected annual tax to date - tax already deducted, then spread across months remaining.
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
      postVariableCatchup: false,
    }));
  }

  let cumulativeGross = 0;
  let taxDeductedSoFar = 0;
  const rawTaxes: number[] = [];

  for (let i = 0; i < FY_MONTHS; i++) {
    const monthNumber = i + 1;
    const monthsRemaining = FY_MONTHS - i;
    cumulativeGross += grosses[i].gross;
    const projectedAnnualGross = (cumulativeGross / monthNumber) * FY_MONTHS;
    const projectedAnnualTax =
      totalTaxAnnual * (projectedAnnualGross / totalCtc);
    const taxDueByProjection = Math.max(0, projectedAnnualTax - taxDeductedSoFar);
    const monthlyTds = taxDueByProjection / monthsRemaining;
    rawTaxes.push(Math.max(0, monthlyTds));
    taxDeductedSoFar += monthlyTds;
  }

  const taxesRounded = rawTaxes.map((t) => roundCurrency(t));
  const sumRounded = taxesRounded.reduce((a, b) => a + b, 0);
  const drift = roundCurrency(totalTaxAnnual) - sumRounded;
  taxesRounded[FY_MONTHS - 1] += drift;
  const firstVariableIndex = grosses.findIndex((month) => month.highlight);
  const preVariableBaseTax = firstVariableIndex > 0 ? taxesRounded[firstVariableIndex - 1] : null;

  return grosses.map(({ label, highlight, gross }, i) => {
    const tax = taxesRounded[i];
    const postVariableCatchup =
      firstVariableIndex >= 0 &&
      preVariableBaseTax !== null &&
      i > firstVariableIndex &&
      !highlight &&
      tax > preVariableBaseTax;
    return {
      month: highlight ? `${label} · variable` : label,
      gross,
      tax,
      netAfterTax: Math.max(0, gross - tax),
      highlight,
      postVariableCatchup,
    };
  });
};

export const defaultVariableMonthMask = (): boolean[] =>
  FY_MONTH_LABELS.map((m) => m === "Sep" || m === "Mar");
