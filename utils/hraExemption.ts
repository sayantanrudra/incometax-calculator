/** Section 10(13A): exempt HRA is the least of actual HRA, rent minus 10% of salary, and 50% / 40% of salary (metro / non-metro). */

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
