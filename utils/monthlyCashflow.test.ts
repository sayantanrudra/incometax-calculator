import { describe, expect, it } from "vitest";
import { buildMonthlyCashflow, defaultVariableMonthMask, FY_MONTH_LABELS } from "./monthlyCashflow";

describe("buildMonthlyCashflow", () => {
  it("splits variable across selected months and total tax matches FY tax", () => {
    const mask = defaultVariableMonthMask();
    const totalTax = 120_000;
    const fixed = 1_000_000;
    const variable = 200_000;
    const totalCtc = fixed + variable;
    const rows = buildMonthlyCashflow({
      fixedPayAnnual: fixed,
      variablePayAnnual: variable,
      variableMonthSelected: mask,
      totalCtc,
      totalTaxAnnual: totalTax,
    });
    const sumTax = rows.reduce((s, r) => s + r.tax, 0);
    const sumGross = rows.reduce((s, r) => s + r.gross, 0);
    const sumNet = rows.reduce((s, r) => s + r.netAfterTax, 0);
    expect(sumTax).toBe(totalTax);
    expect(Math.round(sumGross)).toBe(totalCtc);
    expect(sumNet).toBe(Math.round(Math.max(0, totalCtc - totalTax)));
    const sep = rows.find((r) => r.month.startsWith("Sep"));
    expect(sep?.highlight).toBe(true);
    expect(sep?.gross).toBeGreaterThan(fixed / 12);
  });

  it("tax in a variable month exceeds a prior base month (TDS reprojects on variable income)", () => {
    const mask = defaultVariableMonthMask();
    const rows = buildMonthlyCashflow({
      fixedPayAnnual: 1_000_000,
      variablePayAnnual: 200_000,
      variableMonthSelected: mask,
      totalCtc: 1_200_000,
      totalTaxAnnual: 180_000,
    });
    const aug = rows.find((r) => r.month === "Aug");
    const sep = rows.find((r) => r.month.startsWith("Sep"));
    expect(sep!.tax).toBeGreaterThan(aug!.tax);
  });

  it("post-variable base months stay tighter than pre-variable months due to catch-up TDS", () => {
    const mask = defaultVariableMonthMask();
    const rows = buildMonthlyCashflow({
      fixedPayAnnual: 1_000_000,
      variablePayAnnual: 200_000,
      variableMonthSelected: mask,
      totalCtc: 1_200_000,
      totalTaxAnnual: 180_000,
    });
    const aug = rows.find((r) => r.month === "Aug");
    const oct = rows.find((r) => r.month === "Oct");
    expect(oct!.tax).toBeGreaterThan(aug!.tax);
    expect(oct!.netAfterTax).toBeLessThan(aug!.netAfterTax);
  });

  it("subtracts payroll cash-out each month so net does not rise when tax falls to zero", () => {
    const noVariableMask = FY_MONTH_LABELS.map(() => false);
    const fixed = 1_200_000;
    const payroll = 60_000;
    const rows = buildMonthlyCashflow({
      fixedPayAnnual: fixed,
      variablePayAnnual: 0,
      variableMonthSelected: noVariableMask,
      totalCtc: fixed,
      totalTaxAnnual: 0,
      annualPayrollCashOut: payroll,
    });
    expect(rows[0].tax).toBe(0);
    expect(rows[0].gross).toBe(100_000);
    expect(rows[0].netAfterTax).toBe(95_000);
    const sumNet = rows.reduce((s, r) => s + r.netAfterTax, 0);
    expect(sumNet).toBe(fixed - payroll);
  });

  it("reconciles FY net sum to targetAnnualNetTakeHome when passed", () => {
    const noVariableMask = FY_MONTH_LABELS.map(() => false);
    const fixed = 1_200_000;
    const tax = 50_000;
    const payroll = 60_000;
    const target = Math.round(fixed - tax - payroll);
    const rows = buildMonthlyCashflow({
      fixedPayAnnual: fixed,
      variablePayAnnual: 0,
      variableMonthSelected: noVariableMask,
      totalCtc: fixed,
      totalTaxAnnual: tax,
      annualPayrollCashOut: payroll,
      targetAnnualNetTakeHome: target,
    });
    expect(rows.reduce((s, r) => s + r.netAfterTax, 0)).toBe(target);
  });
});
