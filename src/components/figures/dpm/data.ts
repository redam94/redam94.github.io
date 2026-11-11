/**
 * Numbers copied from the worked example E26 (Dirichlet process mixtures)
 * at https://redam94.github.io/pymc-challenges/examples/E26_dirichlet_process_mixtures.html
 * Each block names the printed output or table it comes from.
 */

/** Sample size of the enzyme data ("enzyme: 245 people"). */
export const N_PEOPLE = 245;

/** Truncation of the main fit ("T = 20"). */
export const T_MAIN = 20;

/**
 * Section 4 table: posterior probability of each count, for counts 2 to 16.
 * Rows "K_occ", "w > 0.02" and ">= 5 people".
 */
export const countValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const occupiedProb = [
  0.0, 0.01, 0.1, 0.16, 0.2, 0.16, 0.1, 0.11, 0.07, 0.03, 0.03, 0.02, 0.01,
  0.01, 0.0,
];
export const weightyProb = [
  0.0, 0.06, 0.36, 0.33, 0.15, 0.07, 0.02, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0,
];
export const fivePeopleProb = [
  0.0, 0.05, 0.35, 0.31, 0.19, 0.07, 0.03, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0,
];

/** Section 2 printout: prior of the occupied count under alpha ~ Gamma(2, 1). */
export const gammaPrior = { median: 9, low: 2, high: 21 };

/**
 * Section 5 printout: posterior median and 90% interval of the occupied
 * count, and the mean of the last stick-breaking weight, for each fit. The
 * learned-alpha last weight is the "w_T: mean 2.6e-04" line of section 3.
 */
export type Fit = {
  label: string;
  sub: string;
  /** Fixed concentration, or null when alpha ~ Gamma(2, 1) is learned. */
  alpha: number | null;
  truncation: number;
  median: number;
  low: number;
  high: number;
  lastWeight: string;
  verdict: string;
  bites: boolean;
};

export const fits: Fit[] = [
  {
    label: "α = 0.2",
    sub: "fixed, T = 20",
    alpha: 0.2,
    truncation: 20,
    median: 4,
    low: 2,
    high: 6,
    lastWeight: "4.8 × 10⁻¹⁸",
    verdict: "fine",
    bites: false,
  },
  {
    label: "α ~ Gamma(2, 1)",
    sub: "learned, T = 20",
    alpha: null,
    truncation: 20,
    median: 7,
    low: 4,
    high: 12,
    lastWeight: "2.6 × 10⁻⁴",
    verdict: "fine",
    bites: false,
  },
  {
    label: "α = 5",
    sub: "fixed, T = 20",
    alpha: 5,
    truncation: 20,
    median: 14,
    low: 10,
    high: 18,
    lastWeight: "0.017",
    verdict: "biting",
    bites: true,
  },
  {
    label: "α ~ Gamma(2, 1)",
    sub: "learned, T = 5",
    alpha: null,
    truncation: 5,
    median: 5,
    low: 4,
    high: 5,
    lastWeight: "0.23",
    verdict: "biting hard",
    bites: true,
  },
];

/**
 * Section 3 tables for the main fit: R-hat and bulk ESS of alpha and the
 * first seven component means (the az.summary table), and of the label-free
 * quantities (the log density line and the density at five points).
 */
export type Diagnostic = { label: string; rhat: number; ess: number };

export const labelled: Diagnostic[] = [
  { label: "mu[0]", rhat: 1.09, ess: 32.38 },
  { label: "mu[1]", rhat: 1.1, ess: 29.54 },
  { label: "mu[2]", rhat: 1.36, ess: 9.29 },
  { label: "mu[3]", rhat: 1.2, ess: 17.07 },
  { label: "mu[4]", rhat: 1.03, ess: 117.23 },
  { label: "mu[5]", rhat: 1.02, ess: 347.08 },
  { label: "mu[6]", rhat: 1.01, ess: 509.17 },
];

export const labelFree: Diagnostic[] = [
  { label: "alpha", rhat: 1.03, ess: 105.31 },
  { label: "log density", rhat: 1.02, ess: 181 },
  { label: "density at 0.15", rhat: 1.0, ess: 1132.64 },
  { label: "density at 0.3", rhat: 1.0, ess: 1864.22 },
  { label: "density at 0.8", rhat: 1.0, ess: 1358.96 },
  { label: "density at 1.3", rhat: 1.0, ess: 1245.22 },
  { label: "density at 2.0", rhat: 1.02, ess: 504.99 },
];
