/**
 * Numbers printed in the population pharmacokinetics worked example (E64),
 * and the one-compartment formula the figures evaluate. Nothing here is
 * fitted at build time: the values are copied from the example's outputs.
 */

/**
 * One-compartment model with first-order absorption, in the expm1 form the
 * example uses so that it stays accurate on both sides of ka = ke.
 * Units: cl in L/h/kg, v in L/kg, ka in 1/h, t in hours, dose in mg/kg.
 */
export function concentration(
  cl: number,
  v: number,
  ka: number,
  t: number,
  dose: number
): number {
  const ke = cl / v;
  const delta = ka - ke;
  return (
    (((dose * ka) / v) * Math.exp(-ke * t) * -Math.expm1(-delta * t)) / delta
  );
}

/** Posterior medians for the typical subject, and the example's 4.5 mg/kg. */
export const typical = { cl: 0.04, v: 0.464, ka: 1.504, dose: 4.5 };

/** Subject 5: the least-squares fit and its mirror image, as printed. */
export const subject5 = {
  dose: 5.86,
  ka: 1.47,
  ke: 0.088,
  v: 0.49,
  mirrorV: "0.030",
  rss: "13.4682",
};

/** Plasma volume quoted in the example, in L/kg. */
export const plasmaVolume = 0.04;

/** Subject 1's half-life in hours: 5%, 50% and 95% posterior quantiles. */
export const halfLife = {
  population: [5.257, 7.959, 12.001],
  twoSamples: [8.436, 11.352, 15.736],
};

/**
 * Held-out validation, averaged over the twelve subjects. The text fields
 * are the roundings the example itself reports.
 */
export const validation = [
  {
    label: "90% width of clearance",
    unit: "L/h/kg",
    population: 0.041,
    twoSamples: 0.021,
    populationText: "0.041",
    twoSamplesText: "0.021",
  },
  {
    label: "Mean abs. error after 4 h",
    unit: "mg/L",
    population: 0.853,
    twoSamples: 0.417,
    populationText: "0.85",
    twoSamplesText: "0.42",
  },
  {
    label: "Mean abs. error, all times",
    unit: "mg/L",
    population: 1.337,
    twoSamples: 1.105,
    populationText: "1.34",
    twoSamplesText: "1.11",
  },
];

export type Knowledge = "population" | "twoSamples" | "fullProfile";

/**
 * Best dose for subject 1 at each dosing interval and state of knowledge,
 * with its probability of target attainment (whole interval in 10-20 mg/L).
 */
export const regimens: {
  every: number;
  best: Record<Knowledge, { dose: number; pta: number }>;
}[] = [
  {
    every: 6,
    best: {
      population: { dose: 275, pta: 0.504 },
      twoSamples: { dose: 175, pta: 0.838 },
      fullProfile: { dose: 175, pta: 0.925 },
    },
  },
  {
    every: 8,
    best: {
      population: { dose: 350, pta: 0.324 },
      twoSamples: { dose: 225, pta: 0.706 },
      fullProfile: { dose: 225, pta: 0.878 },
    },
  },
  {
    every: 12,
    best: {
      population: { dose: 500, pta: 0.062 },
      twoSamples: { dose: 350, pta: 0.346 },
      fullProfile: { dose: 325, pta: 0.456 },
    },
  },
];
