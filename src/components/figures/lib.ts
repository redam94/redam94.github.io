/**
 * Small build-time helpers for post figures. Figures are Astro components
 * that compute their geometry here and render plain SVG, so they work
 * without client JavaScript.
 */

export type Point = [number, number];

/** Linear scale from a data domain to a pixel range. */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  return (value: number) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

export function linspace(start: number, end: number, count: number): number[] {
  return Array.from(
    { length: count },
    (_, i) => start + ((end - start) * i) / (count - 1)
  );
}

export function range(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** Round to one decimal for compact SVG output. */
export const f1 = (value: number) => Math.round(value * 10) / 10;

/** "M x y L x y …" through the given points. */
export function linePath(points: Point[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${f1(x)} ${f1(y)}`)
    .join(" ");
}

/** Closed band between an upper and a lower curve that share x positions. */
export function areaPath(upper: Point[], lower: Point[]): string {
  return `${linePath(upper)} ${linePath([...lower].reverse()).replace("M", "L")} Z`;
}

/** Deterministic uniform generator, so every build draws the same figure. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws built on a uniform generator (Box-Muller). */
export function gaussian(uniform: () => number): () => number {
  return () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
}

export function normalPdf(x: number, mean = 0, sd = 1): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Geometry for an arrow from a to b that stops short of both ends (for
 * example at the edge of a node circle). Returns the shaft path and the
 * points of the arrowhead polygon.
 */
export function arrowGeom(
  a: Point,
  b: Point,
  padStart = 0,
  padEnd = 0,
  head = 9
): { shaft: string; head: string } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const start: Point = [a[0] + ux * padStart, a[1] + uy * padStart];
  const tip: Point = [b[0] - ux * padEnd, b[1] - uy * padEnd];
  const base: Point = [tip[0] - ux * head, tip[1] - uy * head];
  const half = head * 0.45;
  const left: Point = [base[0] - uy * half, base[1] + ux * half];
  const right: Point = [base[0] + uy * half, base[1] - ux * half];
  return {
    shaft: linePath([start, base]),
    head: [tip, left, right].map(([x, y]) => `${f1(x)},${f1(y)}`).join(" "),
  };
}
