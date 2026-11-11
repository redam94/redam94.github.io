/**
 * Textbook facts about the Dirichlet process used by the figures. Nothing
 * here is fitted to data.
 */

/**
 * Weights from breaking a unit stick with the given fractions. The last
 * weight takes whatever is left, as in a truncated stick-breaking prior.
 */
export function stickWeights(fractions: number[]): number[] {
  let left = 1;
  const weights = fractions.map(fraction => {
    const weight = fraction * left;
    left -= weight;
    return weight;
  });
  return [...weights, left];
}

/**
 * Exact prior distribution of the number of occupied clusters among n draws
 * from a Dirichlet process with concentration alpha. In the Chinese
 * restaurant representation observation i opens a new cluster with
 * probability alpha / (alpha + i - 1), independently, so the count is a sum
 * of independent Bernoulli variables. Returns pmf[k] = P(K_n = k).
 */
export function occupiedPrior(alpha: number, n: number): number[] {
  let pmf = [1];
  for (let i = 1; i <= n; i += 1) {
    const open = alpha / (alpha + i - 1);
    const next = new Array<number>(pmf.length + 1).fill(0);
    pmf.forEach((mass, k) => {
      next[k] += mass * (1 - open);
      next[k + 1] += mass * open;
    });
    pmf = next;
  }
  return pmf;
}

/** Smallest k whose cumulative probability reaches p. */
export function quantile(pmf: number[], p: number): number {
  let total = 0;
  for (let k = 0; k < pmf.length; k += 1) {
    total += pmf[k];
    if (total >= p) return k;
  }
  return pmf.length - 1;
}
