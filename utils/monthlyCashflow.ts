/** FY month order: April through March (Indian FY). */
export const FY_MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

export type FyMonthLabel = (typeof FY_MONTH_LABELS)[number];

export interface MonthlyCashflowRow {
  month: string;
  gross: number;
  tax: number;
  /** Gross minus estimated TDS minus a twelfth of annual payroll cash-out (flexi, EPF, PT, LWF, other). */
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
  /** Annual amounts not paid as bank salary (Pluxee/flexi, EE PF, PT, LWF, other); spread evenly across FY months. */
  annualPayrollCashOut?: number;
  /**
   * When set, monthly net columns are adjusted so their FY sum matches this value (same as headline in-hand × 12).
   * Omit to derive from `totalCtc - totalTaxAnnual - annualPayrollCashOut`.
   */
  targetAnnualNetTakeHome?: number;
}

const countSelected = (mask: boolean[]) => mask.filter(Boolean).length;

const roundCurrency = (value: number) => Math.round(value);

const FY_MONTHS = FY_MONTH_LABELS.length;

/** Split a whole-rupee annual total across FY months so the parts sum exactly to `total`. */
const splitAnnualAcrossMonths = (total: number, months: number): number[] => {
  const t = Math.max(0, roundCurrency(total));
  const base = Math.floor(t / months);
  const remainder = t - base * months;
  return Array.from({ length: months }, (_, i) => (i === months - 1 ? base + remainder : base));
};

/**
 * Spreads variable pay across selected FY months (equal split).
 * Monthly tax follows a payroll-style re-projection:
 * projected annual tax to date - tax already deducted, then spread across months remaining.
 */
export const buildMonthlyCashflow = (params: BuildMonthlyCashflowParams): MonthlyCashflowRow[] => {
  const {
    fixedPayAnnual,
    variablePayAnnual,
    variableMonthSelected,
    totalCtc,
    totalTaxAnnual,
    annualPayrollCashOut = 0,
    targetAnnualNetTakeHome,
  } = params;
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

  const payrollByMonth = splitAnnualAcrossMonths(annualPayrollCashOut, FY_MONTHS);

  const reconcileMonthlyNetsToAnnualTarget = (rows: MonthlyCashflowRow[]): MonthlyCashflowRow[] => {
    const derivedTarget = Math.max(0, totalCtc - totalTaxAnnual - annualPayrollCashOut);
    const targetSum = roundCurrency(
      targetAnnualNetTakeHome !== undefined ? targetAnnualNetTakeHome : derivedTarget,
    );
    const sumNet = rows.reduce((s, r) => s + r.netAfterTax, 0);
    const drift = targetSum - sumNet;
    if (rows.length === 0 || drift === 0) {
      return rows;
    }
    const next = rows.map((r, i) =>
      i === rows.length - 1 ? { ...r, netAfterTax: Math.max(0, r.netAfterTax + drift) } : r,
    );
    return next;
  };

  if (totalCtc <= 0) {
    return reconcileMonthlyNetsToAnnualTarget(
      grosses.map(({ label, highlight, gross }, i) => ({
        month: highlight ? `${label} · variable` : label,
        gross,
        tax: 0,
        netAfterTax: Math.max(0, roundCurrency(gross) - payrollByMonth[i]),
        highlight,
        postVariableCatchup: false,
      })),
    );
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

  const rows = grosses.map(({ label, highlight, gross }, i) => {
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
      netAfterTax: Math.max(0, roundCurrency(gross - tax - payrollByMonth[i])),
      highlight,
      postVariableCatchup,
    };
  });

  return reconcileMonthlyNetsToAnnualTarget(rows);
};

export const defaultVariableMonthMask = (): boolean[] =>
  FY_MONTH_LABELS.map((m) => m === "Sep" || m === "Mar");
