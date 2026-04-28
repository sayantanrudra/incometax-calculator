import { describe, expect, it } from "vitest";
import { NEW_STANDARD_DEDUCTION, calculateTaxForRegime, compareTaxRegimes } from "./calculateTax";
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
  it("applies Section 87A rebate in new regime so taxable ₹10L pays no tax (FA 2025 slabs)", () => {
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
    expect(result.slabTax).toBe(40_000);
    expect(result.rebate87A).toBe(40_000);
    expect(result.surcharge).toBe(0);
    expect(result.cess).toBe(0);
    expect(result.totalTax).toBe(0);
  });

  it("computes old-regime slab tax for taxable ₹10L (no rebate, no surcharge)", () => {
    const totalCtc = 1_000_000 + 50_000;
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

    expect(result.taxableIncome).toBe(1_000_000);
    expect(result.slabTax).toBe(112_500);
    expect(result.rebate87A).toBe(0);
    expect(result.incomeTaxBeforeCess).toBe(112_500);
    expect(result.cess).toBe(4_500);
    expect(result.totalTax).toBe(117_000);
  });

  it("does not reduce new-regime taxable income by employer PF (round inputs)", () => {
    const baseInput = {
      fixedPay: 2_000_000,
      variablePay: 0,
      professionalTax: 0,
      ageGroup: "below60" as const,
      regime: "new" as const,
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    };
    const noPf = calculateTaxForRegime({ ...baseInput, employerPf: 0 });
    const withPf = calculateTaxForRegime({ ...baseInput, employerPf: 60_000 });
    expect(withPf.taxableIncome).toBe(noPf.taxableIncome);
    expect(withPf.totalTax).toBe(noPf.totalTax);
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

  it("zeros new-regime tax at taxable ₹7L (rebate u/s 87A within ₹12L threshold)", () => {
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

  it("zeros new-regime tax at taxable ₹12L (full ₹60k rebate on slab tax)", () => {
    const totalCtc = 1_200_000 + NEW_STANDARD_DEDUCTION;
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

    expect(result.taxableIncome).toBe(1_200_000);
    expect(result.slabTax).toBe(60_000);
    expect(result.rebate87A).toBe(60_000);
    expect(result.totalTax).toBe(0);
  });

  /** Finance Act 2025 new-regime slabs — high income, no rebate, no surcharge. */
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
    expect(result.slabTax).toBe(99_660);
    expect(result.rebate87A).toBe(0);
    expect(result.surcharge).toBe(0);
    expect(result.incomeTaxBeforeCess).toBe(99_660);
    expect(result.cess).toBe(3_986);
    expect(result.totalTax).toBe(103_646);
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

  it("does not reduce old-regime taxable income by employer PF (round inputs)", () => {
    const baseInput = {
      fixedPay: 2_000_000,
      variablePay: 0,
      professionalTax: 0,
      ageGroup: "below60" as const,
      regime: "old" as const,
      pluxeeExemption: 0,
      hraExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
    };
    const noPf = calculateTaxForRegime({ ...baseInput, employerPf: 0 });
    const withPf = calculateTaxForRegime({ ...baseInput, employerPf: 60_000 });
    expect(withPf.taxableIncome).toBe(noPf.taxableIncome);
    expect(withPf.totalTax).toBe(noPf.totalTax);
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

describe("in-hand parity (employer PF ignored end-to-end in tax math)", () => {
  const sharedBase = {
    fixedPay: 1_500_000,
    variablePay: 0,
    professionalTax: 0,
    ageGroup: "below60" as const,
    pluxeeExemption: 0,
    hraExemption: 0,
    oldRegimeDeductions: emptyOldDeductions,
    employerPf: 60_000,
  };

  it("new regime: tax & taxable income are unchanged by employer PF input", () => {
    const a = calculateTaxForRegime({ ...sharedBase, regime: "new" });
    const b = calculateTaxForRegime({ ...sharedBase, regime: "new", employerPf: 0 });
    expect(a.taxableIncome).toBe(b.taxableIncome);
    expect(a.totalTax).toBe(b.totalTax);
  });

  it("old regime: tax & taxable income are unchanged by employer PF input", () => {
    const a = calculateTaxForRegime({ ...sharedBase, regime: "old" });
    const b = calculateTaxForRegime({ ...sharedBase, regime: "old", employerPf: 0 });
    expect(a.taxableIncome).toBe(b.taxableIncome);
    expect(a.totalTax).toBe(b.totalTax);
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

  it("applies a lower 40% salary cap when switching from metro to non-metro (Rule 2A)", () => {
    const inputBase = {
      annualRentPaid: 400_000,
      annualHraReceived: 300_000,
      salaryForHra: 500_000,
    };
    const metro = computeHraExemption({ ...inputBase, isMetro: true });
    const nonMetro = computeHraExemption({ ...inputBase, isMetro: false });
    // Rent excess = 400k - 50k = 350k; metro cap 250k, non-metro cap 200k → binding caps differ.
    expect(metro).toBe(250_000);
    expect(nonMetro).toBe(200_000);
    expect(metro).toBeGreaterThan(nonMetro);
  });

  /** Plan dry-runs: rent-excess binds (metro toggle irrelevant); cap binds (metro > non-metro). */
  it("dry-run A: rent paid minus 10% salary binds so metro and non-metro match", () => {
    const input = {
      annualRentPaid: 240_000,
      annualHraReceived: 250_000,
      salaryForHra: 1_000_000,
    };
    expect(computeHraExemption({ ...input, isMetro: true })).toBe(140_000);
    expect(computeHraExemption({ ...input, isMetro: false })).toBe(140_000);
  });

  it("dry-run B: 40–50% salary cap binds so metro exemption exceeds non-metro", () => {
    const input = {
      annualRentPaid: 650_000,
      annualHraReceived: 480_000,
      salaryForHra: 1_000_000,
    };
    expect(computeHraExemption({ ...input, isMetro: true })).toBe(480_000);
    expect(computeHraExemption({ ...input, isMetro: false })).toBe(400_000);
  });

  it("dry-run C: lower Rule 2A salary (e.g. Basic+DA) lowers exemption vs inflated proxy salary", () => {
    const shared = { annualRentPaid: 650_000, annualHraReceived: 480_000, isMetro: true };
    const inflatedProxy = computeHraExemption({ ...shared, salaryForHra: 1_000_000 });
    const accurateBasis = computeHraExemption({ ...shared, salaryForHra: 600_000 });
    expect(inflatedProxy).toBe(480_000);
    expect(accurateBasis).toBe(300_000);
    expect(accurateBasis).toBeLessThan(inflatedProxy);
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

  it("old-regime taxable income is higher when HRA is computed from a lower Rule 2A salary basis", () => {
    const shared = { annualRentPaid: 650_000, annualHraReceived: 480_000, isMetro: true };
    const hraFromInflatedSalary = computeHraExemption({ ...shared, salaryForHra: 1_000_000 });
    const hraFromAccurateSalary = computeHraExemption({ ...shared, salaryForHra: 600_000 });
    const base = {
      fixedPay: 1_000_000,
      variablePay: 0,
      employerPf: 0,
      professionalTax: 0,
      ageGroup: "below60" as const,
      pluxeeExemption: 0,
      oldRegimeDeductions: emptyOldDeductions,
      regime: "old" as const,
    };
    const withInflatedHra = calculateTaxForRegime({ ...base, hraExemption: hraFromInflatedSalary });
    const withAccurateHra = calculateTaxForRegime({ ...base, hraExemption: hraFromAccurateSalary });
    expect(withAccurateHra.taxableIncome).toBeGreaterThan(withInflatedHra.taxableIncome);
  });
});
