/**
 * Bayesian quadrature with a squared-exponential kernel and a Gaussian
 * measure, a TypeScript port of the NumPy routine in the post
 * (probabilistic-numerics-computation-as-inference). Runs at build time.
 */

/** Gaussian density parameterised by variance, as in the post's norm_pdf. */
export function normPdfVar(x: number, mean: number, variance: number): number {
  return (
    Math.exp((-0.5 * (x - mean) ** 2) / variance) /
    Math.sqrt(2 * Math.PI * variance)
  );
}

/** Lower Cholesky factor of a symmetric positive definite matrix. */
function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const lower: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0)
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k++) sum -= lower[i][k] * lower[j][k];
      lower[i][j] = i === j ? Math.sqrt(sum) : sum / lower[j][j];
    }
  }
  return lower;
}

/** Solve (L Lᵀ) x = b given the lower factor L. */
function choleskySolve(lower: number[][], b: number[]): number[] {
  const n = b.length;
  const z = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= lower[i][k] * z[k];
    z[i] = sum / lower[i][i];
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = z[i];
    for (let k = i + 1; k < n; k++) sum -= lower[k][i] * x[k];
    x[i] = sum / lower[i][i];
  }
  return x;
}

const dot = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + value * b[i], 0);

export type Quadrature = {
  nodes: number[];
  values: number[];
  /** Posterior mean of the integral. */
  mean: number;
  /** Posterior standard deviation of the integral. */
  sd: number;
  /** Posterior mean and standard deviation of the integrand at x. */
  at: (x: number) => { mean: number; sd: number };
};

/**
 * Posterior on F = E[f(x)], x ~ N(mu, sigma²), under f ~ GP(0, θ² N(x; x', lam²)).
 * The scale θ² is the maximum-likelihood estimate, exactly as in the post.
 */
export function bayesianQuadrature(
  f: (x: number) => number,
  nodes: number[],
  lam = 1,
  mu = 0,
  sigma = 1
): Quadrature {
  const n = nodes.length;
  const values = nodes.map(f);
  const gram = nodes.map((a, i) =>
    nodes.map((b, j) => normPdfVar(a, b, lam ** 2) + (i === j ? 1e-10 : 0))
  );
  const lower = cholesky(gram);
  const kernelMean = nodes.map(x => normPdfVar(x, mu, lam ** 2 + sigma ** 2));
  const priorVar = 1 / Math.sqrt(2 * Math.PI * (2 * sigma ** 2 + lam ** 2));

  const weights = choleskySolve(lower, kernelMean);
  const alpha = choleskySolve(lower, values);
  const theta2 = dot(values, alpha) / n;
  const variance = theta2 * (priorVar - dot(weights, kernelMean));

  const at = (x: number) => {
    const k = nodes.map(node => normPdfVar(x, node, lam ** 2));
    const reduction = dot(k, choleskySolve(lower, k));
    const pointVar = theta2 * (normPdfVar(0, 0, lam ** 2) - reduction);
    return { mean: dot(k, alpha), sd: Math.sqrt(Math.max(pointVar, 0)) };
  };

  return {
    nodes,
    values,
    mean: dot(weights, values),
    sd: Math.sqrt(Math.max(variance, 0)),
    at,
  };
}

/**
 * Reference value of E[f(x)], x ~ N(mu, sigma²), by composite Simpson on
 * mu ± 10 sigma. Stands in for the post's 200-point Gauss-Hermite rule.
 */
export function referenceExpectation(
  f: (x: number) => number,
  mu = 0,
  sigma = 1,
  panels = 20000
): number {
  const a = mu - 10 * sigma;
  const h = (20 * sigma) / panels;
  let sum = 0;
  for (let i = 0; i <= panels; i++) {
    const x = a + i * h;
    const coefficient = i === 0 || i === panels ? 1 : i % 2 === 1 ? 4 : 2;
    sum += coefficient * f(x) * normPdfVar(x, mu, sigma ** 2);
  }
  return (sum * h) / 3;
}

/** The two integrands used in the post. */
export const response = (x: number) => 1 / (1 + Math.exp(-2 * (x - 0.5)));
export const oscillating = (x: number) => Math.exp(-(Math.sin(3 * x) ** 2));
