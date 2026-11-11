/**
 * Numbers copied from the worked example "Signal in the noise: a Bayesian
 * look at GW150914" (pymc-challenges E10). Nothing here is computed by this
 * site: each table below is a printed table on that page.
 */

/** Section 2.8: posterior mean and sd of the ringdown under three likelihoods. */
export type LikelihoodFit = {
  key: "exact" | "sigma1" | "sigma037";
  label: string;
  note: string;
  f: [number, number];
  tau: [number, number];
  ampH1: [number, number];
};

export const likelihoodFits: LikelihoodFit[] = [
  {
    key: "exact",
    label: "Exact covariance",
    note: "time domain, 2048 Hz",
    f: [246.97, 12.46],
    tau: [4.5, 1.19],
    ampH1: [1.23, 0.26],
  },
  {
    key: "sigma1",
    label: "Shortcut, σ = 1",
    note: "filtered, independent",
    f: [244.3, 13.73],
    tau: [2.85, 0.71],
    ampH1: [2.0, 0.44],
  },
  {
    key: "sigma037",
    label: "Shortcut, σ = 0.37",
    note: "filtered, independent",
    f: [243.34, 3.75],
    tau: [3.13, 0.31],
    ampH1: [1.83, 0.15],
  },
];

/**
 * Section 2.6: posterior median and 90% interval against the start time of
 * the ringdown window, in milliseconds after the peak strain.
 */
export type StartTimeRow = {
  offset: number;
  f: [number, number, number];
  tau: [number, number, number];
  snr: [number, number, number];
};

export const startTimeScan: StartTimeRow[] = [
  {
    offset: 0,
    f: [234.13, 223.84, 242.49],
    tau: [5.5, 4.22, 7.13],
    snr: [12.33, 10.74, 13.98],
  },
  {
    offset: 1,
    f: [233.41, 218.94, 244.48],
    tau: [5.38, 3.82, 7.6],
    snr: [9.73, 8.1, 11.36],
  },
  {
    offset: 3,
    f: [246.74, 228.16, 265.57],
    tau: [4.34, 2.86, 6.7],
    snr: [8.03, 6.4, 9.73],
  },
  {
    offset: 5,
    f: [278.31, 210.33, 358.93],
    tau: [2.29, 1.14, 4.93],
    snr: [5.6, 3.96, 7.16],
  },
  {
    offset: 7,
    f: [218.47, 155.89, 362.48],
    tau: [1.13, 0.46, 2.71],
    snr: [3.84, 2.34, 5.36],
  },
];

/** The start time the fit in the post uses. */
export const chosenOffset = 3;

/**
 * Section 2.6: the Kerr mode the page computes for a 68 solar-mass remnant
 * with spin 0.69, used there as the reference line.
 */
export const kerrReference = { f: 252, tau: 4.1 };
