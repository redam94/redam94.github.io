/**
 * Build-time simulations for the schematic figures. None of this is LIGO
 * data: the series are drawn from a fixed seed and a made-up noise spectrum,
 * chosen so the mechanism is visible.
 */
import { gaussian, range, rng } from "../lib";

/* ---------- Whitening a coloured series ---------- */

const SAMPLES = 256;
/** Frequency bins 1 … SAMPLES/2 - 1. The mean and the Nyquist bin are left out. */
const BINS = range(SAMPLES / 2 - 1).map(i => i + 1);

/**
 * Noise power in frequency bin k, relative to a white floor of 1: a loud
 * low-frequency plateau that rolls off into a quiet band.
 */
function noisePower(k: number): number {
  return 1 + 60000 / (1 + Math.pow(k / 4, 6));
}

type Coefficients = { cos: number[]; sin: number[] };

/** Sum of sinusoids over the bins. */
function synthesise({ cos, sin }: Coefficients): number[] {
  return range(SAMPLES).map(t =>
    BINS.reduce((sum, k, i) => {
      const angle = (2 * Math.PI * k * t) / SAMPLES;
      return sum + cos[i] * Math.cos(angle) + sin[i] * Math.sin(angle);
    }, 0)
  );
}

/** Discrete Fourier coefficients of a series on the same bins. */
function analyse(series: number[]): Coefficients {
  const project = (wave: (angle: number) => number) =>
    BINS.map(
      k =>
        (2 / SAMPLES) *
        series.reduce(
          (sum, value, t) =>
            sum + value * wave((2 * Math.PI * k * t) / SAMPLES),
          0
        )
    );
  return { cos: project(Math.cos), sin: project(Math.sin) };
}

/** Divide (or multiply) every bin by the square root of its noise power. */
function weight(coefficients: Coefficients, power: number): Coefficients {
  const apply = (values: number[]) =>
    values.map((value, i) => value * Math.pow(noisePower(BINS[i]), power));
  return { cos: apply(coefficients.cos), sin: apply(coefficients.sin) };
}

/**
 * A short burst that sweeps up in frequency, peaks, and rings down. The
 * shape is only meant to look like a chirp; it is not a waveform model.
 */
function burst(peakAt: number, amplitude: number): number[] {
  let phase = 0;
  return range(SAMPLES).map(t => {
    const before = t <= peakAt;
    const envelope = before
      ? Math.exp((t - peakAt) / 28)
      : Math.exp(-(t - peakAt) / 7);
    const cyclesPerSample = before
      ? 0.07 + 0.09 * Math.exp((t - peakAt) / 30)
      : 0.16;
    phase += 2 * Math.PI * cyclesPerSample;
    return amplitude * envelope * Math.cos(phase);
  });
}

export type WhiteningDemo = {
  samples: number;
  /** Coloured noise plus the burst: what the instrument records. */
  raw: number[];
  /** The burst alone, in the same units as the raw series. */
  signal: number[];
  /** The raw series with every frequency divided by its noise level. */
  whitened: number[];
  /** The burst alone after the same division. */
  whitenedSignal: number[];
  /** First and last sample of the span where the burst is non-negligible. */
  window: [number, number];
};

export function whiteningDemo(seed: number): WhiteningDemo {
  const normal = gaussian(rng(seed));
  // Coefficient sd that gives the white series unit variance.
  const sd = 1 / Math.sqrt(BINS.length);
  const white: Coefficients = {
    cos: BINS.map(() => normal() * sd),
    sin: BINS.map(() => normal() * sd),
  };
  const peakAt = 168;
  const template = analyse(burst(peakAt, 5));

  const signal = synthesise(template);
  const noise = synthesise(weight(white, 0.5));
  const whitenedSignal = synthesise(weight(template, -0.5));
  const whiteNoise = synthesise(white);

  return {
    samples: SAMPLES,
    raw: noise.map((value, t) => value + signal[t]),
    signal,
    whitened: whiteNoise.map((value, t) => value + whitenedSignal[t]),
    whitenedSignal,
    window: [peakAt - 80, peakAt + 24],
  };
}

/* ---------- Whitening with a covariance matrix ---------- */

type Matrix = number[][];

/** Lower-triangular Cholesky factor of a symmetric positive-definite matrix. */
function cholesky(matrix: Matrix): Matrix {
  const n = matrix.length;
  const lower: Matrix = range(n).map(() => range(n).map(() => 0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k += 1) sum -= lower[i][k] * lower[j][k];
      lower[i][j] = i === j ? Math.sqrt(sum) : sum / lower[j][j];
    }
  }
  return lower;
}

/** Inverse of a lower-triangular matrix by forward substitution. */
function invertLower(lower: Matrix): Matrix {
  const n = lower.length;
  const inverse: Matrix = range(n).map(() => range(n).map(() => 0));
  for (let column = 0; column < n; column += 1) {
    for (let i = column; i < n; i += 1) {
      let sum = i === column ? 1 : 0;
      for (let k = column; k < i; k += 1)
        sum -= lower[i][k] * inverse[k][column];
      inverse[i][column] = sum / lower[i][i];
    }
  }
  return inverse;
}

function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map(row =>
    range(b[0].length).map(j =>
      row.reduce((sum, value, k) => sum + value * b[k][j], 0)
    )
  );
}

function transpose(matrix: Matrix): Matrix {
  return matrix[0].map((_, j) => matrix.map(row => row[j]));
}

export type CovarianceDemo = {
  size: number;
  /** Noise covariance: the same autocovariance along every diagonal. */
  covariance: Matrix;
  /** Inverse of the Cholesky factor of the covariance. */
  whitener: Matrix;
  /** whitener · covariance · whitenerᵀ, which is the identity. */
  whitened: Matrix;
};

/**
 * A small stationary covariance with a slowly decaying, oscillating
 * autocovariance (noise dominated by a ringing line), its whitening matrix,
 * and the covariance after whitening.
 */
export function covarianceDemo(size: number): CovarianceDemo {
  const autocovariance = (lag: number) =>
    (lag === 0 ? 0.08 : 0) +
    Math.pow(0.88, lag) * Math.cos(0.8 * Math.PI * lag);
  const covariance = range(size).map(i =>
    range(size).map(j => autocovariance(Math.abs(i - j)))
  );
  const whitener = invertLower(cholesky(covariance));
  const whitened = multiply(
    multiply(whitener, covariance),
    transpose(whitener)
  );
  return { size, covariance, whitener, whitened };
}
