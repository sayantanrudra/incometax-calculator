import { describe, expect, it } from "vitest";
import {
  HEALTH_EDUCATION_CESS_RATE,
  NEW_STANDARD_DEDUCTION,
  calculateTaxForRegime,
  compareTaxRegimes,
} from "./calculateTax";
import { computeHraExemption } from "./hraExemption";

const emptyOldDeductions = {
  deduction80C: 0,
  deduction80D: 0,
  deduction80CCD1B: 0,
  deduction80DD: 0,
  deduction80E: 0,
  deduction80EEB: 0,
  deduction80G: 0,
  deduction80GGA: 0,
  deduction80U: 0,
  deduction80TTA: 0,
  deduction80TTB: 0,
};

describe("calculateTaxForRegime", () => {
  it("applies cess as 4% of pre-cess tax for a mid-bracket new-regime salary", () => {
    const totalCtc = 1_075_000;
    const result = calculateTaxForRegime({
      fixedPay: totalCtc,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60",
      regime: "new",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.standardDeduction).toBe(75_000);
    expect(result.taxableIncome).toBe(1_000_000);
    expect(result.slabTax).toBe(50_000);
    expect(result.rebate87A).toBe(0);
    expect(result.surcharge).toBe(0);
    const preCess = result.totalTax - result.cess;
    expect(result.cess).toBe(Math.round(preCess * HEALTH_EDUCATION_CESS_RATE));
    expect(result.totalTax).toBe(52_000);
  });

  it("zeros tax at old-regime rebate threshold (taxable ₹5L)", () => {
    const totalCtc = 550_000;
    const result = calculateTaxForRegime({
      fixedPay: totalCtc,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60",
      regime: "old",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.taxableIncome).toBe(500_000);
    expect(result.slabTax).toBe(12_500);
    expect(result.rebate87A).toBe(12_500);
    expect(result.totalTax).toBe(0);
  });

  it("applies new-regime rebate so taxable ₹7L pays no tax", () => {
    const totalCtc = 775_000;
    const result = calculateTaxForRegime({
      fixedPay: totalCtc,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60",
      regime: "new",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.taxableIncome).toBe(700_000);
    expect(result.totalTax).toBe(0);
  });

  /** FY 2024-25 new-regime slabs (Budget 2024): 3–7L @ 5%, 7–10L @ 10%, etc. — regression for Form 16 alignment. */
  it("matches expected new-regime tax for taxable ₹14,64,399 (no rebate, no surcharge)", () => {
    const taxable = 1_464_399;
    const totalCtc = taxable + NEW_STANDARD_DEDUCTION;
    const result = calculateTaxForRegime({
      fixedPay: totalCtc,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60",
      regime: "new",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.taxableIncome).toBe(taxable);
    expect(result.slabTax).toBe(132_880);
    expect(result.rebate87A).toBe(0);
    expect(result.surcharge).toBe(0);
    expect(result.incomeTaxBeforeCess).toBe(132_880);
    expect(result.cess).toBe(5_315);
    expect(result.totalTax).toBe(138_195);
  });

  it("does not apply professional tax deduction in new regime", () => {
    const result = calculateTaxForRegime({
      fixedPay: 1_000_000,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 5000,
      ageGroup: "below60",
      regime: "new",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.professionalTaxDeduction).toBe(0);
  });

  it("applies professional tax deduction in old regime", () => {
    const result = calculateTaxForRegime({
      fixedPay: 1_000_000,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 5000,
      ageGroup: "below60",
      regime: "old",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.professionalTaxDeduction).toBe(5000);
  });

  it("computes surcharge above ₹50L taxable (new regime) with non-negative components", () => {
    const totalCtc = 52_000_000;
    const result = calculateTaxForRegime({
      fixedPay: totalCtc,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60",
      regime: "new",
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    });

    expect(result.taxableIncome).toBeGreaterThan(50_000_000);
    expect(result.surcharge).toBeGreaterThan(0);
    expect(result.surchargeMarginalRelief).toBeGreaterThanOrEqual(0);
    expect(result.rebate87A).toBeGreaterThanOrEqual(0);
    expect(result.rebateMarginalRelief).toBeGreaterThanOrEqual(0);
    expect(result.totalTax).toBeGreaterThan(0);
  });
});

describe("compareTaxRegimes", () => {
  it("runs both regimes with same inputs when Pluxee omitted", () => {
    const input = {
      fixedPay: 1_200_000,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 2400,
      ageGroup: "below60" as const,
      oldRegimeDeductions: emptyOldDeductions,
    };

    const a = compareTaxRegimes(input);
    const b = compareTaxRegimes({ ...input, pluxeeExemptions: { old: 0, new: 0 } });

    expect(a.oldRegime.totalTax).toBe(b.oldRegime.totalTax);
    expect(a.newRegime.totalTax).toBe(b.newRegime.totalTax);
    expect(["old", "new"]).toContain(a.bestRegime);
  });
});

describe("computeHraExemption", () => {
  it("uses rent paid in excess of 10% of salary when that is the binding limit (non-metro)", () => {
    const exempt = computeHraExemption({
      annualRentPaid: 100_000,
      annualHraReceived: 200_000,
      salaryForHra: 400_000,
      isMetro: false,
    });
    expect(exempt).toBe(60_000);
  });

  it("uses 50% of salary cap in metro when rent excess and HRA are higher", () => {
    const exempt = computeHraExemption({
      annualRentPaid: 500_000,
      annualHraReceived: 400_000,
      salaryForHra: 600_000,
      isMetro: true,
    });
    expect(exempt).toBe(300_000);
  });
});

describe("calculateTaxForRegime HRA", () => {
  it("reduces old-regime taxable income by HRA exemption only for old regime", () => {
    const base = {
      fixedPay: 1_000_000,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60" as const,
      pluxeeExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    };
    const without = calculateTaxForRegime({ ...base, regime: "old", hraExemption: 0 });
    const withHra = calculateTaxForRegime({ ...base, regime: "old", hraExemption: 100_000 });
    const newWithHra = calculateTaxForRegime({ ...base, regime: "new", hraExemption: 100_000 });

    expect(withHra.hraExemption).toBe(100_000);
    expect(withHra.taxableIncome).toBe(without.taxableIncome - 100_000);
    expect(newWithHra.hraExemption).toBe(0);
    expect(newWithHra.taxableIncome).toBeGreaterThan(withHra.taxableIncome);
  });
});
