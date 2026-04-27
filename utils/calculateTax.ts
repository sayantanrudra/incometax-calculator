export type AgeGroup = "below60" | "60to80" | "80plus";
export type TaxRegime = "old" | "new";

export interface TaxBreakdownItem {
  label: string;
  lowerLimit: number;
  upperLimit: number | null;
  rate: number;
  taxableAmount: number;
  tax: number;
}

export interface OldRegimeDeductionsInput {
  deduction80C: number;
  deduction80D: number;
  deduction80CCD1B: number;
  deduction80DD: number;
  deduction80E: number;
  deduction80EEB: number;
  deduction80G: number;
  deduction80GGA: number;
  deduction80U: number;
  deduction80TTA: number;
  deduction80TTB: number;
}

export interface TaxCalculationInput {
  fixedPay: number;
  variablePay: number;
  employerPf: number;
  professionalTax: number;
  ageGroup: AgeGroup;
  regime: TaxRegime;
  pluxeeExemption: number;
  /** Section 10(13A); applied only when regime is old (pass 0 for new). */
  hraExemption: number;
  oldRegimeDeductions: OldRegimeDeductionsInput;
}

export interface TaxComparisonInput {
  fixedPay: number;
  variablePay: number;
  employerPf: number;
  professionalTax: number;
  ageGroup: AgeGroup;
  oldRegimeDeductions: OldRegimeDeductionsInput;
  pluxeeExemptions?: Partial<Record<TaxRegime, number>>;
  /** Precomputed 10(13A) exempt amount; old regime only. */
  hraExemption?: number;
}

export interface TaxComputation {
  regime: TaxRegime;
  totalCtc: number;
  standardDeduction: number;
  employerPfDeduction: number;
  professionalTaxDeduction: number;
  pluxeeExemption: number;
  hraExemption: number;
  chapterVIADeductions: number;
  totalExemptions: number;
  taxableIncome: number;
  slabTax: number;
  rebate87A: number;
  rebateMarginalRelief: number;
  surcharge: number;
  surchargeMarginalRelief: number;
  /** Income tax + surcharge, before 4% health & education cess (Form 16 “tax on income” line). */
  incomeTaxBeforeCess: number;
  cess: number;
  totalTax: number;
  monthlyNetInHand: number;
  breakdown: TaxBreakdownItem[];
}

export interface TaxComparisonResult {
  oldRegime: TaxComputation;
  newRegime: TaxComputation;
  bestRegime: TaxRegime;
  savings: number;
}

interface TaxSlab {
  lowerLimit: number;
  upperLimit: number | null;
  rate: number;
  label: string;
}

interface RebateRule {
  threshold: number;
  maxRebate: number;
}

interface SurchargeBracket {
  threshold: number;
  rate: number;
}

interface PreCessTaxResult {
  slabTax: number;
  rebate87A: number;
  rebateMarginalRelief: number;
  surcharge: number;
  surchargeMarginalRelief: number;
  totalBeforeCess: number;
}

/** Old regime ₹50k standard deduction (Section 16); new regime uses `NEW_STANDARD_DEDUCTION`. */
const OLD_STANDARD_DEDUCTION = 50_000;
/** Salaried / pension standard deduction under Section 16 (new regime). */
export const NEW_STANDARD_DEDUCTION = 75_000;
export const MAX_GROSS_INCOME = 100_000_000;
export const MAX_80C_DEDUCTION = 150_000;
export const MAX_80D_DEDUCTION = 100_000;
export const MAX_OTHER_DEDUCTION = 1_000_000;
export const MAX_80CCD1B_DEDUCTION = 50_000;
export const MAX_80DD_DEDUCTION = 125_000;
export const MAX_80EEB_DEDUCTION = 150_000;
export const MAX_80U_DEDUCTION = 125_000;
export const MAX_80TTA_DEDUCTION = 10_000;
export const MAX_80TTB_DEDUCTION = 50_000;
export const MAX_PROFESSIONAL_TAX = 50_000;
export const MAX_EMPLOYER_PF = 500_000;

const HEALTH_EDUCATION_CESS_RATE = 0.04;

/** Default tax rates for individuals / HUFs (old regime); age bands per Act — unchanged under FA 2025 for core slabs. */
const OLD_REGIME_SLABS: Record<AgeGroup, TaxSlab[]> = {
  below60: [
    { lowerLimit: 0, upperLimit: 250_000, rate: 0, label: "Up to Rs 2.5L" },
    { lowerLimit: 250_000, upperLimit: 500_000, rate: 0.05, label: "Rs 2.5L - Rs 5L" },
    { lowerLimit: 500_000, upperLimit: 1_000_000, rate: 0.2, label: "Rs 5L - Rs 10L" },
    { lowerLimit: 1_000_000, upperLimit: null, rate: 0.3, label: "Above Rs 10L" },
  ],
  "60to80": [
    { lowerLimit: 0, upperLimit: 300_000, rate: 0, label: "Up to Rs 3L" },
    { lowerLimit: 300_000, upperLimit: 500_000, rate: 0.05, label: "Rs 3L - Rs 5L" },
    { lowerLimit: 500_000, upperLimit: 1_000_000, rate: 0.2, label: "Rs 5L - Rs 10L" },
    { lowerLimit: 1_000_000, upperLimit: null, rate: 0.3, label: "Above Rs 10L" },
  ],
  "80plus": [
    { lowerLimit: 0, upperLimit: 500_000, rate: 0, label: "Up to Rs 5L" },
    { lowerLimit: 500_000, upperLimit: 1_000_000, rate: 0.2, label: "Rs 5L - Rs 10L" },
    { lowerLimit: 1_000_000, upperLimit: null, rate: 0.3, label: "Above Rs 10L" },
  ],
};

/**
 * Section 115BAC slabs as amended by Finance Act 2025 (FY 2025-26 / AY 2026-27 onward):
 * nil up to ₹4L, then 5% / 10% / 15% / 20% / 25% / 30% bands.
 */
const NEW_REGIME_SLABS: TaxSlab[] = [
  { lowerLimit: 0, upperLimit: 400_000, rate: 0, label: "Up to Rs 4L" },
  { lowerLimit: 400_000, upperLimit: 800_000, rate: 0.05, label: "Rs 4L - Rs 8L" },
  { lowerLimit: 800_000, upperLimit: 1_200_000, rate: 0.1, label: "Rs 8L - Rs 12L" },
  { lowerLimit: 1_200_000, upperLimit: 1_600_000, rate: 0.15, label: "Rs 12L - Rs 16L" },
  { lowerLimit: 1_600_000, upperLimit: 2_000_000, rate: 0.2, label: "Rs 16L - Rs 20L" },
  { lowerLimit: 2_000_000, upperLimit: 2_400_000, rate: 0.25, label: "Rs 20L - Rs 24L" },
  { lowerLimit: 2_400_000, upperLimit: null, rate: 0.3, label: "Above Rs 24L" },
];

const REBATE_RULES: Record<TaxRegime, RebateRule> = {
  old: { threshold: 500_000, maxRebate: 12_500 },
  /** Section 87A: resident new-regime rebate up to ₹60k when taxable income does not exceed ₹12L (FA 2025). */
  new: { threshold: 1_200_000, maxRebate: 60_000 },
};

const OLD_SURCHARGE_BRACKETS: SurchargeBracket[] = [
  { threshold: 5_000_000, rate: 0.1 },
  { threshold: 10_000_000, rate: 0.15 },
  { threshold: 20_000_000, rate: 0.25 },
  { threshold: 50_000_000, rate: 0.37 },
];

const NEW_SURCHARGE_BRACKETS: SurchargeBracket[] = [
  { threshold: 5_000_000, rate: 0.1 },
  { threshold: 10_000_000, rate: 0.15 },
  { threshold: 20_000_000, rate: 0.25 },
  { threshold: 50_000_000, rate: 0.25 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundCurrency = (value: number) => Math.round(value);

const getSlabsForRegime = (regime: TaxRegime, ageGroup: AgeGroup) =>
  regime === "old" ? OLD_REGIME_SLABS[ageGroup] : NEW_REGIME_SLABS;

const calculateBreakdown = (taxableIncome: number, slabs: TaxSlab[]): TaxBreakdownItem[] =>
  slabs.map((slab) => {
    const slabEnd = slab.upperLimit ?? taxableIncome;
    const taxableAmount = Math.max(0, Math.min(taxableIncome, slabEnd) - slab.lowerLimit);

    return {
      ...slab,
      taxableAmount,
      tax: taxableAmount * slab.rate,
    };
  });

const calculateSlabTax = (taxableIncome: number, slabs: TaxSlab[]) =>
  calculateBreakdown(taxableIncome, slabs).reduce((sum, item) => sum + item.tax, 0);

const getStandardDeduction = (regime: TaxRegime) =>
  regime === "old" ? OLD_STANDARD_DEDUCTION : NEW_STANDARD_DEDUCTION;

const getChapterVIADeductions = (
  regime: TaxRegime,
  deductions: OldRegimeDeductionsInput,
  ageGroup: AgeGroup,
) => {
  if (regime !== "old") {
    return 0;
  }

  const deduction80C = clamp(deductions.deduction80C, 0, MAX_80C_DEDUCTION);
  const deduction80D = clamp(deductions.deduction80D, 0, MAX_80D_DEDUCTION);
  const deduction80CCD1B = clamp(deductions.deduction80CCD1B, 0, MAX_80CCD1B_DEDUCTION);
  const deduction80DD = clamp(deductions.deduction80DD, 0, MAX_80DD_DEDUCTION);
  const deduction80E = clamp(deductions.deduction80E, 0, MAX_OTHER_DEDUCTION);
  const deduction80EEB = clamp(deductions.deduction80EEB, 0, MAX_80EEB_DEDUCTION);
  const deduction80G = clamp(deductions.deduction80G, 0, MAX_OTHER_DEDUCTION);
  const deduction80GGA = clamp(deductions.deduction80GGA, 0, MAX_OTHER_DEDUCTION);
  const deduction80U = clamp(deductions.deduction80U, 0, MAX_80U_DEDUCTION);
  const deduction80TTA =
    ageGroup === "below60" ? clamp(deductions.deduction80TTA, 0, MAX_80TTA_DEDUCTION) : 0;
  const deduction80TTB =
    ageGroup !== "below60" ? clamp(deductions.deduction80TTB, 0, MAX_80TTB_DEDUCTION) : 0;

  return (
    deduction80C +
    deduction80D +
    deduction80CCD1B +
    deduction80DD +
    deduction80E +
    deduction80EEB +
    deduction80G +
    deduction80GGA +
    deduction80U +
    deduction80TTA +
    deduction80TTB
  );
};

const getRebateComputation = (
  regime: TaxRegime,
  taxableIncome: number,
  slabTax: number,
) => {
  const rule = REBATE_RULES[regime];

  if (taxableIncome <= rule.threshold) {
    return {
      rebate87A: Math.min(slabTax, rule.maxRebate),
      rebateMarginalRelief: 0,
      taxAfterRelief: Math.max(0, slabTax - Math.min(slabTax, rule.maxRebate)),
    };
  }

  const excessIncome = taxableIncome - rule.threshold;
  const marginalRelief = Math.max(0, slabTax - excessIncome);
  const taxAfterRelief = slabTax - marginalRelief;

  return {
    rebate87A: 0,
    rebateMarginalRelief: marginalRelief,
    taxAfterRelief,
  };
};

const getSurchargeBrackets = (regime: TaxRegime) =>
  regime === "old" ? OLD_SURCHARGE_BRACKETS : NEW_SURCHARGE_BRACKETS;

const findApplicableSurchargeBracket = (regime: TaxRegime, taxableIncome: number) => {
  const brackets = getSurchargeBrackets(regime);

  return brackets.reduce<SurchargeBracket | null>(
    (selected, bracket) => (taxableIncome > bracket.threshold ? bracket : selected),
    null,
  );
};

const computePreCessTax = (
  regime: TaxRegime,
  ageGroup: AgeGroup,
  taxableIncome: number,
  memo = new Map<number, PreCessTaxResult>(),
): PreCessTaxResult => {
  const roundedTaxableIncome = roundCurrency(taxableIncome);

  if (memo.has(roundedTaxableIncome)) {
    return memo.get(roundedTaxableIncome)!;
  }

  const slabs = getSlabsForRegime(regime, ageGroup);
  const slabTax = calculateSlabTax(roundedTaxableIncome, slabs);
  const rebateComputation = getRebateComputation(regime, roundedTaxableIncome, slabTax);
  const applicableBracket = findApplicableSurchargeBracket(regime, roundedTaxableIncome);

  let surcharge = 0;
  let surchargeMarginalRelief = 0;
  let totalBeforeCess = rebateComputation.taxAfterRelief;

  if (applicableBracket) {
    const rawSurcharge = rebateComputation.taxAfterRelief * applicableBracket.rate;
    const rawTotal = rebateComputation.taxAfterRelief + rawSurcharge;
    const thresholdTax = computePreCessTax(
      regime,
      ageGroup,
      applicableBracket.threshold,
      memo,
    ).totalBeforeCess;
    const maxAllowedTax = thresholdTax + (roundedTaxableIncome - applicableBracket.threshold);

    totalBeforeCess = Math.min(rawTotal, maxAllowedTax);
    surcharge = Math.max(0, totalBeforeCess - rebateComputation.taxAfterRelief);
    surchargeMarginalRelief = Math.max(0, rawTotal - totalBeforeCess);
  }

  const result = {
    slabTax: roundCurrency(slabTax),
    rebate87A: roundCurrency(rebateComputation.rebate87A),
    rebateMarginalRelief: roundCurrency(rebateComputation.rebateMarginalRelief),
    surcharge: roundCurrency(surcharge),
    surchargeMarginalRelief: roundCurrency(surchargeMarginalRelief),
    totalBeforeCess: roundCurrency(totalBeforeCess),
  };

  memo.set(roundedTaxableIncome, result);
  return result;
};

export const calculateTaxForRegime = (input: TaxCalculationInput): TaxComputation => {
  const fixedPay = clamp(input.fixedPay, 0, MAX_GROSS_INCOME);
  const variablePay = clamp(input.variablePay, 0, MAX_GROSS_INCOME);
  const totalCtc = fixedPay + variablePay;
  const employerPfDeduction = clamp(input.employerPf, 0, MAX_EMPLOYER_PF);
  const professionalTaxDeduction =
    input.regime === "old" ? clamp(input.professionalTax, 0, MAX_PROFESSIONAL_TAX) : 0;
  const standardDeduction = Math.min(getStandardDeduction(input.regime), totalCtc);
  const chapterVIADeductions = getChapterVIADeductions(
    input.regime,
    input.oldRegimeDeductions,
    input.ageGroup,
  );
  const pluxeeExemption = clamp(input.pluxeeExemption, 0, totalCtc);
  const hraExemption =
    input.regime === "old" ? clamp(input.hraExemption ?? 0, 0, totalCtc) : 0;
  const totalExemptions =
    standardDeduction +
    employerPfDeduction +
    professionalTaxDeduction +
    chapterVIADeductions +
    pluxeeExemption +
    hraExemption;
  const taxableIncome = Math.max(0, totalCtc - totalExemptions);
  const taxBeforeCess = computePreCessTax(input.regime, input.ageGroup, taxableIncome);
  const incomeTaxBeforeCess = roundCurrency(taxBeforeCess.totalBeforeCess);
  const cess = roundCurrency(incomeTaxBeforeCess * HEALTH_EDUCATION_CESS_RATE);
  const totalTax = roundCurrency(incomeTaxBeforeCess + cess);
  const breakdown = calculateBreakdown(taxableIncome, getSlabsForRegime(input.regime, input.ageGroup));
  const monthlyNetInHand = Math.max(0, totalCtc - totalTax) / 12;

  return {
    regime: input.regime,
    totalCtc: roundCurrency(totalCtc),
    standardDeduction: roundCurrency(standardDeduction),
    employerPfDeduction: roundCurrency(employerPfDeduction),
    professionalTaxDeduction: roundCurrency(professionalTaxDeduction),
    pluxeeExemption: roundCurrency(pluxeeExemption),
    hraExemption: roundCurrency(hraExemption),
    chapterVIADeductions: roundCurrency(chapterVIADeductions),
    totalExemptions: roundCurrency(totalExemptions),
    taxableIncome: roundCurrency(taxableIncome),
    slabTax: taxBeforeCess.slabTax,
    rebate87A: taxBeforeCess.rebate87A,
    rebateMarginalRelief: taxBeforeCess.rebateMarginalRelief,
    surcharge: taxBeforeCess.surcharge,
    surchargeMarginalRelief: taxBeforeCess.surchargeMarginalRelief,
    incomeTaxBeforeCess,
    cess,
    totalTax,
    monthlyNetInHand: roundCurrency(monthlyNetInHand),
    breakdown,
  };
};

export const compareTaxRegimes = (input: TaxComparisonInput): TaxComparisonResult => {
  const hra = input.hraExemption ?? 0;
  const oldRegime = calculateTaxForRegime({
    fixedPay: input.fixedPay,
    variablePay: input.variablePay,
    employerPf: input.employerPf,
    professionalTax: input.professionalTax,
    ageGroup: input.ageGroup,
    oldRegimeDeductions: input.oldRegimeDeductions,
    pluxeeExemption: input.pluxeeExemptions?.old ?? 0,
    hraExemption: hra,
    regime: "old",
  });
  const newRegime = calculateTaxForRegime({
    fixedPay: input.fixedPay,
    variablePay: input.variablePay,
    employerPf: input.employerPf,
    professionalTax: input.professionalTax,
    ageGroup: input.ageGroup,
    oldRegimeDeductions: input.oldRegimeDeductions,
    pluxeeExemption: input.pluxeeExemptions?.new ?? 0,
    hraExemption: 0,
    regime: "new",
  });
  const bestRegime = oldRegime.totalTax <= newRegime.totalTax ? "old" : "new";
  const savings = Math.abs(oldRegime.totalTax - newRegime.totalTax);

  return {
    oldRegime,
    newRegime,
    bestRegime,
    savings,
  };
};
