/**
 * Shared numbers and build-time helpers for the Hawkes figures.
 *
 * Two kinds of content live here. The simulation and the kernel maths are
 * computed at build time from the formulas in the post. Everything under
 * "Results" is copied from printed outputs of the worked example (E65).
 */

// ---------- Simulation: a Hawkes process by its branching representation ----------

export type HawkesParams = {
  /** Background rate mu, events per unit time. */
  background: number;
  /** Branching ratio n: expected direct children per event. */
  branching: number;
  /** Mean delay of the exponential triggering kernel. */
  scale: number;
};

/** The demo parameters of the worked example's first figure. */
export const demo: HawkesParams = {
  background: 0.2,
  branching: 0.8,
  scale: 0.3,
};

export type HawkesEvent = { t: number; generation: number };

/** Poisson draw by multiplying uniforms (fine for the small means used here). */
export function poissonDraw(mean: number, uniform: () => number): number {
  const limit = Math.exp(-mean);
  let count = 0;
  let product = uniform();
  while (product > limit) {
    count += 1;
    product *= uniform();
  }
  return count;
}

/** Homogeneous Poisson process on [0, horizon]: sorted event times. */
export function simulatePoisson(
  uniform: () => number,
  rate: number,
  horizon: number
): number[] {
  const count = poissonDraw(rate * horizon, uniform);
  return Array.from({ length: count }, () => uniform() * horizon).sort(
    (a, b) => a - b
  );
}

/**
 * Background events first, then the children of every event, generation by
 * generation. Children that would fall after the horizon are dropped.
 */
export function simulateHawkes(
  uniform: () => number,
  params: HawkesParams,
  horizon: number
): HawkesEvent[] {
  const events: HawkesEvent[] = simulatePoisson(
    uniform,
    params.background,
    horizon
  ).map(t => ({ t, generation: 0 }));
  for (let i = 0; i < events.length; i++) {
    const parent = events[i];
    const children = poissonDraw(params.branching, uniform);
    for (let k = 0; k < children; k++) {
      const delay = -params.scale * Math.log(1 - uniform());
      const t = parent.t + delay;
      if (t < horizon) events.push({ t, generation: parent.generation + 1 });
    }
  }
  return events.sort((a, b) => a.t - b.t);
}

/**
 * The conditional intensity mu + sum of (n / scale) exp(-(t - t_j) / scale)
 * as a list of [t, lambda] points with an exact vertical jump at each event.
 */
export function intensityPoints(
  times: number[],
  params: HawkesParams,
  horizon: number,
  gridCount: number
): [number, number][] {
  const jump = params.branching / params.scale;
  const sorted = [...times].sort((a, b) => a - b);
  const grid = Array.from(
    { length: gridCount },
    (_, i) => (horizon * i) / (gridCount - 1)
  );
  const points: [number, number][] = [];
  let excited = 0;
  let clock = 0;
  let next = 0;
  for (const t of grid) {
    while (next < sorted.length && sorted[next] <= t) {
      const at = sorted[next];
      excited *= Math.exp(-(at - clock) / params.scale);
      points.push([at, params.background + excited]);
      excited += jump;
      points.push([at, params.background + excited]);
      clock = at;
      next += 1;
    }
    excited *= Math.exp(-(t - clock) / params.scale);
    clock = t;
    points.push([t, params.background + excited]);
  }
  return points;
}

// ---------- The Omori-Utsu kernel as a mixture of exponentials ----------

/** Posterior means of the ETAS fit with Mc(t), from the summary table. */
export const kernel = { c: 0.0014, p: 1.1649 };

/** log s nodes of the worked example: -25 to 14 in steps of 0.5 (79 nodes). */
export const logNodes = Array.from({ length: 79 }, (_, i) => -25 + 0.5 * i);
const nodeStep = 0.5;

/** Lanczos approximation of log Gamma(x) for x > 0. */
export function logGamma(x: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
  ];
  let series = 1.000000000190015;
  coefficients.forEach((value, i) => {
    series += value / (x + 1 + i);
  });
  const shifted = x + 5.5;
  return (
    (x + 0.5) * Math.log(shifted) -
    shifted +
    Math.log((2.5066282746310005 * series) / x)
  );
}

export const omori = (x: number, c: number, p: number) => Math.pow(x + c, -p);

/** One term of the mixture: rate s_k and weight w_k = h s_k^p exp(-s_k c) / Gamma(p). */
export function mixtureTerms(c: number, p: number) {
  return logNodes.map(u => {
    const rate = Math.exp(u);
    const weight = Math.exp(
      p * u - rate * c - logGamma(p) + Math.log(nodeStep)
    );
    return { u, rate, weight };
  });
}

// ---------- Results copied from the worked example ----------

/** Posterior of the branching ratio, ETAS with Mc(t). */
export const branchingPosterior = {
  median: 0.7,
  lo: 0.45,
  hi: 1.19,
  shareAtOrAboveOne: 0.12,
};

/** Seven-day forecast table, issued 24 hours after the M7.1. */
export const forecasts = [
  {
    key: "etas",
    label: "ETAS with Mc(t)",
    median: 230,
    lo: 151,
    hi: 566,
    pM5: "0.76",
    pM71: "0.012",
  },
  {
    key: "naive",
    label: "Naive ETAS",
    median: 284,
    lo: 123,
    hi: 29547,
    pM5: "0.92",
    pM71: "0.117",
  },
  {
    key: "exp",
    label: "Exponential Hawkes",
    median: 5,
    lo: 1,
    hi: 33,
    pM5: "0.08",
    pM71: "0.001",
  },
] as const;

/** What the held-out week contained. */
export const observedWeek = { m3: 191, m4: 12, largest: "M4.9" };
