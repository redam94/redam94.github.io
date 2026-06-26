/* global React */
const { useEffect, useRef, useState } = React;

// Animated posterior-distribution figure for the hero.
// Renders a smooth bell with shaded 50% / 94% HDI bands and a gently drifting mean.
function PosteriorFigure({ variant = "posterior" }) {
  const W = 560, H = 380;
  const PAD = { l: 40, r: 24, t: 36, b: 56 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const loop = (now) => {
      setT(((now - start) / 1000) % 16);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Smooth ambient drift parameters
  const driftMu = 0.35 * Math.sin((t / 16) * Math.PI * 2);          // ±0.35
  const driftSigma = 1 + 0.06 * Math.sin((t / 16) * Math.PI * 2 + 1); // ~1±0.06

  // Three posterior densities (channels), olive + clay + slate
  const densities = [
    { mu: 1.6 + driftMu, sigma: 0.62 * driftSigma, color: "var(--olive-700)", band: "var(--olive-300)", band2: "var(--olive-200)", label: "Channel A" },
    { mu: -0.4 + driftMu * 0.6, sigma: 0.5 * driftSigma, color: "var(--clay)", band: "var(--clay-soft)", band2: "var(--clay-soft)", label: "Channel B", faded: true },
    { mu: 2.6 + driftMu * 0.4, sigma: 0.45 * driftSigma, color: "var(--slate)", band: "var(--slate-soft)", band2: "var(--slate-soft)", label: "Channel C", faded: true },
  ];

  const xMin = -2.5, xMax = 5;
  const xScale = (x) => PAD.l + ((x - xMin) / (xMax - xMin)) * innerW;
  // density of normal
  const pdf = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

  // compute global yMax for normalization
  let yMax = 0;
  densities.forEach(d => { yMax = Math.max(yMax, pdf(d.mu, d.mu, d.sigma)); });
  const yScale = (y) => PAD.t + innerH - (y / yMax) * (innerH - 8);

  const buildPath = (mu, sigma) => {
    const N = 120;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N;
      const y = pdf(x, mu, sigma);
      d += (i === 0 ? "M" : "L") + xScale(x).toFixed(2) + "," + yScale(y).toFixed(2) + " ";
    }
    return d;
  };
  const buildArea = (mu, sigma, lo, hi) => {
    const N = 80;
    let d = "M" + xScale(lo).toFixed(2) + "," + yScale(0).toFixed(2) + " ";
    for (let i = 0; i <= N; i++) {
      const x = lo + ((hi - lo) * i) / N;
      const y = pdf(x, mu, sigma);
      d += "L" + xScale(x).toFixed(2) + "," + yScale(y).toFixed(2) + " ";
    }
    d += "L" + xScale(hi).toFixed(2) + "," + yScale(0).toFixed(2) + " Z";
    return d;
  };

  // x-axis ticks
  const ticks = [-2, -1, 0, 1, 2, 3, 4];

  if (variant === "forest") return <ForestPlot />;
  if (variant === "trace") return <TracePlot />;

  const main = densities[0];
  const hdi94 = [main.mu - 1.96 * main.sigma, main.mu + 1.96 * main.sigma];
  const hdi50 = [main.mu - 0.674 * main.sigma, main.mu + 0.674 * main.sigma];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Posterior distribution of channel coefficients">
      {/* zero line */}
      <line x1={xScale(0)} x2={xScale(0)} y1={PAD.t} y2={PAD.t + innerH}
            stroke="var(--ink-200)" strokeWidth="1" strokeDasharray="3 3" />

      {/* faded other channels (just outlines) */}
      {densities.slice(1).map((d, i) => (
        <path key={i} d={buildPath(d.mu, d.sigma)} fill="none" stroke={d.color} strokeWidth="1.25" opacity="0.42" />
      ))}

      {/* main: 94% HDI band */}
      <path d={buildArea(main.mu, main.sigma, hdi94[0], hdi94[1])} fill="var(--olive-200)" />
      {/* 50% HDI band on top */}
      <path d={buildArea(main.mu, main.sigma, hdi50[0], hdi50[1])} fill="var(--olive-300)" />
      {/* main outline */}
      <path d={buildPath(main.mu, main.sigma)} fill="none" stroke="var(--olive-700)" strokeWidth="1.6" />
      {/* posterior mean */}
      <line x1={xScale(main.mu)} x2={xScale(main.mu)}
            y1={yScale(pdf(main.mu, main.mu, main.sigma))} y2={PAD.t + innerH}
            stroke="var(--olive-800)" strokeWidth="1.5" />

      {/* HDI tick markers at base */}
      <g>
        {[hdi94[0], hdi94[1]].map((x, i) => (
          <line key={i} x1={xScale(x)} x2={xScale(x)} y1={PAD.t + innerH - 4} y2={PAD.t + innerH + 4} stroke="var(--olive-700)" strokeWidth="1.2"/>
        ))}
      </g>

      {/* x-axis */}
      <line x1={PAD.l} x2={PAD.l + innerW} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="var(--ink-200)" />
      {ticks.map(tk => (
        <g key={tk}>
          <line x1={xScale(tk)} x2={xScale(tk)} y1={PAD.t + innerH} y2={PAD.t + innerH + 4} stroke="var(--ink-300)" />
          <text x={xScale(tk)} y={PAD.t + innerH + 16} textAnchor="middle"
                fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-400)">{tk}</text>
        </g>
      ))}
      <text x={PAD.l + innerW / 2} y={H - 12} textAnchor="middle"
            fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-400)" letterSpacing="2">
        β · COEFFICIENT (LOG-LIFT)
      </text>

      {/* legend / annotations */}
      <g transform={`translate(${PAD.l + 12}, ${PAD.t + 8})`}>
        <rect x="0" y="0" width="14" height="10" fill="var(--olive-300)" />
        <text x="20" y="9" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-500)">94% HDI</text>
        <rect x="80" y="0" width="14" height="10" fill="var(--olive-200)" />
        <text x="100" y="9" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-500)">50% HDI</text>
      </g>

      {/* mean callout */}
      <g transform={`translate(${xScale(main.mu) + 8}, ${yScale(pdf(main.mu, main.mu, main.sigma)) - 4})`}>
        <text fontFamily="var(--font-mono)" fontSize="10" fill="var(--olive-800)" fontWeight="600">
          μ = {main.mu.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}

function ForestPlot() {
  const W = 560, H = 380, PAD = { l: 100, r: 30, t: 32, b: 40 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const channels = [
    { name: "tv_spend",      mean: 0.42, lo: 0.18, hi: 0.71 },
    { name: "youtube_spend", mean: 0.31, lo: 0.12, hi: 0.55 },
    { name: "search_brand",  mean: 0.27, lo: 0.16, hi: 0.42 },
    { name: "search_nb",     mean: 0.18, lo: 0.05, hi: 0.34 },
    { name: "social_paid",   mean: 0.11, lo: -0.03, hi: 0.28 },
    { name: "ooh",           mean: 0.06, lo: -0.05, hi: 0.18 },
    { name: "podcast",       mean: -0.04, lo: -0.18, hi: 0.10 },
  ];
  const xMin = -0.3, xMax = 0.85;
  const xScale = (x) => PAD.l + ((x - xMin) / (xMax - xMin)) * innerW;
  const ticks = [-0.2, 0, 0.2, 0.4, 0.6, 0.8];
  const rowH = innerH / channels.length;
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf, s = performance.now();
    const tick = (n) => { setT(((n - s) / 1000) % 8); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Forest plot of channel coefficients">
      <text x={PAD.l} y={20} fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-400)" letterSpacing="2">CHANNEL COEFFICIENTS · 94% HDI</text>
      {/* zero line */}
      <line x1={xScale(0)} x2={xScale(0)} y1={PAD.t} y2={PAD.t + innerH} stroke="var(--ink-300)" strokeDasharray="3 3" />
      {channels.map((c, i) => {
        const y = PAD.t + i * rowH + rowH / 2;
        const drift = 0.012 * Math.sin((t / 8) * Math.PI * 2 + i * 0.7);
        const lo = c.lo + drift, hi = c.hi + drift, m = c.mean + drift;
        const isNeg = m < 0;
        return (
          <g key={c.name}>
            <text x={PAD.l - 12} y={y + 4} textAnchor="end"
                  fontFamily="var(--font-mono)" fontSize="11" fill="var(--ink-600)">{c.name}</text>
            <line x1={xScale(lo)} x2={xScale(hi)} y1={y} y2={y}
                  stroke={isNeg ? "var(--rust)" : "var(--olive-600)"} strokeWidth="2" />
            <line x1={xScale(lo)} x2={xScale(lo)} y1={y - 5} y2={y + 5} stroke={isNeg ? "var(--rust)" : "var(--olive-600)"} strokeWidth="1.3" />
            <line x1={xScale(hi)} x2={xScale(hi)} y1={y - 5} y2={y + 5} stroke={isNeg ? "var(--rust)" : "var(--olive-600)"} strokeWidth="1.3" />
            <circle cx={xScale(m)} cy={y} r="4" fill={isNeg ? "var(--rust)" : "var(--olive-700)"} stroke="var(--canvas)" strokeWidth="1.5" />
          </g>
        );
      })}
      <line x1={PAD.l} x2={PAD.l + innerW} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="var(--ink-200)" />
      {ticks.map(tk => (
        <g key={tk}>
          <line x1={xScale(tk)} x2={xScale(tk)} y1={PAD.t + innerH} y2={PAD.t + innerH + 4} stroke="var(--ink-300)" />
          <text x={xScale(tk)} y={PAD.t + innerH + 18} textAnchor="middle"
                fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-400)">{tk.toFixed(1)}</text>
        </g>
      ))}
    </svg>
  );
}

function TracePlot() {
  const W = 560, H = 380, PAD = { l: 36, r: 24, t: 28, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = (H - PAD.t - PAD.b) / 4;
  const chains = [
    { color: "var(--olive-700)" },
    { color: "var(--clay)" },
    { color: "var(--slate)" },
    { color: "var(--olive-400)" },
  ];
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf, s = performance.now();
    const tick = (n) => { setT(((n - s) / 1000) % 12); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // pseudo-random walk seeded per-chain
  const seriesPath = (seed, target) => {
    const N = 220;
    const phase = (t / 12) * Math.PI * 2;
    let d = "";
    let v = target;
    for (let i = 0; i <= N; i++) {
      // deterministic-ish noise using sin combos
      const noise = Math.sin(i * 0.31 + seed) * 0.18 + Math.sin(i * 0.097 + seed * 1.7 + phase) * 0.1 + Math.cos(i * 0.21 + seed * 0.6) * 0.07;
      v = v * 0.85 + (target + noise) * 0.15;
      const x = PAD.l + (i / N) * innerW;
      const y = PAD.t + innerH * 0.5 - v * (innerH * 0.45);
      d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    }
    return d;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Trace plot of MCMC chains">
      <text x={PAD.l} y={18} fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-400)" letterSpacing="2">MCMC TRACE · 4 CHAINS · R̂ = 1.003</text>
      <g>
        {chains.map((c, idx) => {
          const cy = PAD.t + innerH * 0.5;
          return (
            <g key={idx}>
              <line x1={PAD.l} x2={PAD.l + innerW} y1={cy} y2={cy} stroke="var(--ink-100)" />
              <path d={seriesPath(idx * 1.7 + 0.4, 0.3 + idx * 0.05)} fill="none" stroke={c.color} strokeWidth="1.1" opacity="0.85" />
              <text x={PAD.l + innerW + 6} y={cy + 3} fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-400)">c{idx+1}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

window.PosteriorFigure = PosteriorFigure;
