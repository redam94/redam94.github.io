/**
 * Shared numbers for the hidden Markov model figures.
 *
 * Everything under "From the worked example" is copied from the printed
 * outputs of the pymc-challenges page E24. The toy trellis below it uses
 * those posterior means with five made-up counts, and is labelled as a
 * schematic wherever it is drawn.
 */

// ---------- From the worked example ----------

/** Length of the yearly earthquake series, 1900 to 2024. */
export const seriesYears = 125;

type Rate = { mean: number; lo: number; hi: number };

/** Two-state fit with ordered rates: posterior mean and 94% HDI. */
export const twoStateRates: Rate[] = [
  { mean: 10.85, lo: 9.11, hi: 12.33 },
  { mean: 14.77, lo: 13.08, hi: 16.31 },
];

/** Four-state fit: posterior mean and 94% HDI of each rate. */
export const fourStateRates: Rate[] = [
  { mean: 9.55, lo: 7.25, hi: 11.62 },
  { mean: 11.74, lo: 9.39, hi: 14.05 },
  { mean: 13.68, lo: 11.44, hi: 15.95 },
  { mean: 15.96, lo: 13.4, hi: 18.88 },
];

/** Divergent transitions reported for the two- and four-state fits. */
export const divergences = { two: 0, four: 32 };

/** Unordered two-state fit: mean of lam[0] and lam[1] in each chain. */
export const unorderedChainMeans: [number, number][] = [
  [13.0, 12.6],
  [13.2, 12.5],
  [14.8, 10.9],
  [14.8, 10.9],
];

/** Worst r_hat and smallest bulk ESS printed for each two-state fit. */
export const diagnostics = {
  unordered: { rhat: "1.35", ess: 9 },
  ordered: { rhat: "1.00", ess: 969 },
};

// ---------- Toy trellis (schematic) ----------

/** Posterior means of the ordered two-state fit: quiet first, busy second. */
export const toyRates = [twoStateRates[0].mean, twoStateRates[1].mean];
const stay = 0.89;
export const toyGamma = [
  [stay, 1 - stay],
  [1 - stay, stay],
];
export const toyDelta = [0.46, 0.54];

/** Five made-up yearly counts. They are not taken from the catalogue. */
export const toyCounts = [9, 11, 17, 16, 15];

/** One state path used to illustrate the generative story (0 quiet, 1 busy). */
export const toyPath = [0, 0, 1, 1, 1];

function logFactorial(n: number): number {
  let total = 0;
  for (let i = 2; i <= n; i++) total += Math.log(i);
  return total;
}

function poissonLogPmf(count: number, rate: number): number {
  return count * Math.log(rate) - rate - logFactorial(count);
}

function logSumExp(values: number[]): number {
  const top = Math.max(...values);
  return top + Math.log(values.reduce((sum, v) => sum + Math.exp(v - top), 0));
}

const states = [0, 1];

/** log p(count | state) for every year of the toy series. */
const toyLogEmis = toyCounts.map(count =>
  states.map(k => poissonLogPmf(count, toyRates[k]))
);

/** Forward variables on the log scale: toyLogAlpha[t][k]. */
export const toyLogAlpha: number[][] = [];
toyLogEmis.forEach((logEmis, t) => {
  toyLogAlpha.push(
    states.map(k =>
      t === 0
        ? Math.log(toyDelta[k]) + logEmis[k]
        : logEmis[k] +
          logSumExp(
            states.map(j => toyLogAlpha[t - 1][j] + Math.log(toyGamma[j][k]))
          )
    )
  );
});

/** log p(counts) from the forward recursion. */
export const toyLogLik = logSumExp(toyLogAlpha[toyLogAlpha.length - 1]);

/** The same quantity by brute force: one term per state path. */
function pathLogJoint(path: number[]): number {
  return path.reduce(
    (total, state, t) =>
      total +
      toyLogEmis[t][state] +
      (t === 0
        ? Math.log(toyDelta[state])
        : Math.log(toyGamma[path[t - 1]][state])),
    0
  );
}

export const toyPathCount = 2 ** toyCounts.length;
export const toyBruteLogLik = logSumExp(
  Array.from({ length: toyPathCount }, (_, code) =>
    pathLogJoint(toyCounts.map((_count, t) => (code >> t) & 1))
  )
);
