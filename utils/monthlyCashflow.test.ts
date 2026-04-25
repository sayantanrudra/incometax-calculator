import { describe, expect, it } from "vitest";
import { buildMonthlyCashflow, defaultVariableMonthMask } from "./monthlyCashflow";

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
    expect(sumTax).toBe(totalTax);
    expect(Math.round(sumGross)).toBe(totalCtc);
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
});
