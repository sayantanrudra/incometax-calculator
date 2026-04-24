/**
 * Section 10(13A) read with Rule 2A of Income-tax Rules, 1962:
 * exempt HRA is the least of (1) actual HRA received, (2) rent paid minus 10% of salary,
 * (3) 50% of salary where accommodation is in Delhi, Mumbai, Kolkata, or Chennai, else 40%.
 * Salary = Basic + DA (to the extent forming part of retirement benefits) + prescribed commission;
 * callers pass an annual salary figure (e.g. fixed pay as Basic proxy).
 */

export interface HraExemptionInput {
  annualRentPaid: number;
  annualHraReceived: number;
  /** Salary for the 10% / 40–50% caps (often Basic+DA); annual fixed pay is a common proxy. */
  salaryForHra: number;
  isMetro: boolean;
}

const RENT_EXCESS_RATE = 0.1;
const METRO_SALARY_CAP_RATE = 0.5;
const NON_METRO_SALARY_CAP_RATE = 0.4;

export const computeHraExemption = (input: HraExemptionInput): number => {
  const rent = Math.max(0, input.annualRentPaid);
  const actualHra = Math.max(0, input.annualHraReceived);
  const salary = Math.max(0, input.salaryForHra);
  const rentExcess = Math.max(0, rent - RENT_EXCESS_RATE * salary);
  const salaryCapRate = input.isMetro ? METRO_SALARY_CAP_RATE : NON_METRO_SALARY_CAP_RATE;
  const salaryCap = salaryCapRate * salary;
  const exempt = Math.min(actualHra, rentExcess, salaryCap);
  return Math.round(Math.max(0, exempt));
};
