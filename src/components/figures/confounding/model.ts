/**
 * Numbers quoted in the sensitivity-analysis post, and the two formulas it
 * states (Cinelli & Hazlett 2020). Every figure in this folder draws from
 * here, so nothing on screen comes from outside the post.
 */

/** Regression with demographics and prior earnings. */
export const estimate = 1572;
export const tStat = 2.82;
export const dof = 16159;

/** Implied by the estimate and its t statistic. */
export const se = estimate / tStat;

/** |bias| = se · √df · √( R²y · R²d / (1 − R²d) ), both R² as fractions. */
export function bias(r2d: number, r2y: number): number {
  return se * Math.sqrt(dof) * Math.sqrt((r2y * r2d) / (1 - r2d));
}

/** Partial R² a confounder needs on both sides to cut the estimate by q. */
export function robustnessValue(q = 1): number {
  const f = (q * Math.abs(tStat)) / Math.sqrt(dof);
  return 0.5 * (Math.sqrt(f ** 4 + 4 * f ** 2) - f ** 2);
}

/** Estimate left after a confounder with the same partial R² on both sides. */
export function adjusted(r2: number): number {
  return estimate - bias(r2, r2);
}

/**
 * Outcome-side partial R² at which a confounder with treatment-side r2d
 * leaves exactly `target` dollars. Inverts the bias formula.
 */
export function contour(target: number, r2d: number): number {
  const f = (estimate - target) / (se * Math.sqrt(dof));
  return (f * f * (1 - r2d)) / r2d;
}

/** "$1,572" or "−$757", with a real minus sign. */
export function dollars(value: number): string {
  const rounded = Math.round(value);
  const body = `$${Math.abs(rounded).toLocaleString("en-US")}`;
  return rounded < 0 ? `−${body}` : body;
}

/** "2.2%" from 0.0219. */
export function percent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
