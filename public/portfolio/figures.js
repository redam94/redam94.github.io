/* Portfolio figures: the hero ridgeline of repository activity and the
   small diagrams inside each project tile. No dependencies. */
(() => {
  "use strict";

  // Weekly commit counts per repository. Week 0 starts Monday 11 May 2026.
  // Snapshot taken 11 November 2026 from the GitHub commits API.
  const ACTIVITY = {
    start: "2026-05-11",
    weeks: 27,
    repos: [
      {
        id: "mmm-framework",
        label: "mmm-framework",
        weeks: [
          0, 3, 0, 37, 12, 45, 58, 33, 91, 29, 35, 48, 18, 11, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 2, 1,
        ],
      },
      {
        id: "redam94.github.io",
        label: "redam94.github.io",
        weeks: [
          0, 0, 0, 0, 0, 0, 35, 16, 6, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 3, 0, 1,
        ],
      },
      {
        id: "second-brain",
        label: "second-brain",
        weeks: [
          0, 1, 2, 1, 1, 6, 6, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 1, 1, 1,
          1, 1, 1, 1,
        ],
      },
      {
        id: "admin-dashboard",
        label: "admin-dashboard",
        weeks: [
          0, 0, 11, 0, 2, 0, 0, 0, 0, 2, 0, 0, 2, 5, 3, 0, 1, 0, 1, 0, 0, 1, 2,
          6, 0, 0, 0,
        ],
      },
      {
        id: "axiom",
        label: "axiom",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 69, 103, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0,
        ],
      },
      {
        id: "printing",
        label: "printing",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 7, 0, 0, 1, 0,
          0, 0, 0, 0,
        ],
      },
      {
        id: "modeling-api",
        label: "modeling-api",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          1172, 43, 0, 0, 0,
        ],
      },
      {
        id: "latent_var",
        label: "latent_var",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
          0, 0, 0, 0,
        ],
      },
      {
        id: "media-effectiveness-index",
        label: "media-effectiveness-index",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3,
          0, 1, 0, 0,
        ],
      },
      {
        id: "pymc-challenges",
        label: "pymc-challenges",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 16, 0, 0,
          0, 0, 58, 0,
        ],
      },
      {
        id: "ump",
        label: "ump",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 167, 0, 0,
        ],
      },
      {
        id: "brand_voi_sim",
        label: "brand_voi_sim",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 1, 0, 0,
        ],
      },
      {
        id: "propensity-modeling",
        label: "propensity-modeling",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 4, 0,
        ],
      },
      {
        id: "causal-vs-predictive-modeling",
        label: "causal-vs-predictive",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 7,
        ],
      },
      {
        id: "double-ml-explainer",
        label: "double-ml-explainer",
        weeks: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 15,
        ],
      },
    ],
  };

  const NS = "http://www.w3.org/2000/svg";
  const DAY = 86400000;

  const el = (name, attrs, parent) => {
    const node = document.createElementNS(NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  };

  const f1 = n => Math.round(n * 10) / 10;

  // Small seeded generator so every figure is the same on every load.
  const rng = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const gaussian = seed => {
    const r = rng(seed);
    return () =>
      Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  };

  const polyline = pts =>
    pts.map((p, i) => (i ? "L" : "M") + f1(p[0]) + " " + f1(p[1])).join("");

  /* ---------------- Hero ridgeline ---------------- */

  function ridgeline(host) {
    const plot = host.querySelector("[data-ridges]");
    const readout = host.querySelector("[data-readout]");
    if (!plot || !readout) return;

    const idle = readout.textContent.trim();
    const startDate = new Date(ACTIVITY.start + "T00:00:00Z");
    const peakAll = Math.max(...ACTIVITY.repos.flatMap(r => r.weeks));
    const fmt = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    const rows = ACTIVITY.repos.map(repo => {
      const total = repo.weeks.reduce((a, b) => a + b, 0);
      const peak = repo.weeks.indexOf(Math.max(...repo.weeks));
      const peakDate = new Date(startDate.getTime() + peak * 7 * DAY);
      const summary =
        repo.label +
        ", " +
        total.toLocaleString("en-US") +
        (total === 1 ? " commit" : " commits") +
        ", busiest in the week of " +
        fmt.format(peakDate);
      return { ...repo, summary };
    });

    let lastWidth = 0;
    let entered = false;

    function draw() {
      const W = Math.floor(plot.clientWidth);
      if (!W || W === lastWidth) return;
      lastWidth = W;

      const narrow = W < 640;
      const labelW = narrow ? 152 : 216;
      const sigma = narrow ? 0.7 : 0.45;
      plot.classList.toggle("is-narrow", narrow);
      const step = narrow ? 20 : 27;
      const amp = step * (narrow ? 3.2 : 4.6);
      const top = amp * 1.12;
      const H = top + step * (rows.length - 1) + 40;
      const plotW = W - labelW - 4;
      // One spare week on the right so the final week's ridge is not cut off.
      const span = ACTIVITY.weeks + 1;
      const xAt = week => labelW + (week / span) * plotW;

      plot.replaceChildren();
      const svg = el(
        "svg",
        { width: W, height: f1(H), viewBox: `0 0 ${W} ${f1(H)}` },
        plot
      );

      rows.forEach((row, i) => {
        const base = top + i * step;
        const pts = [];
        for (let t = -0.5; t <= span - 0.5 + 1e-9; t += 0.1) {
          let y = 0;
          for (let j = 0; j < row.weeks.length; j++) {
            if (!row.weeks[j]) continue;
            const v = Math.log1p(row.weeks[j]) / Math.log1p(peakAll);
            y += v * Math.exp(-0.5 * ((t - j) / sigma) ** 2);
          }
          pts.push([xAt(t + 0.5), base - y * amp]);
        }
        const curve = polyline(pts);

        const link = el("a", { href: "#" + row.id, "aria-label": row.summary });
        const ridge = el("g", { class: "ridge", style: `--i:${i}` }, link);
        el(
          "path",
          {
            class: "r-fill",
            d: `${curve}L${f1(xAt(span))} ${f1(base)}L${labelW} ${f1(base)}Z`,
          },
          ridge
        );
        el("path", { class: "r-stroke", d: curve }, ridge);
        const label = el(
          "text",
          {
            class: "r-label",
            x: labelW - 14,
            y: f1(base + 4),
            "text-anchor": "end",
          },
          link
        );
        label.textContent = row.label;
        el(
          "rect",
          {
            class: "r-hit",
            x: 0,
            y: f1(base - step / 2),
            width: W,
            height: step,
          },
          link
        );

        const on = () => {
          plot.classList.add("has-active");
          link.classList.add("is-active");
          readout.textContent = row.summary;
        };
        const off = () => {
          plot.classList.remove("has-active");
          link.classList.remove("is-active");
          readout.textContent = idle;
        };
        link.addEventListener("pointerenter", on);
        link.addEventListener("pointerleave", off);
        link.addEventListener("focus", on);
        link.addEventListener("blur", off);
        svg.appendChild(link);
      });

      // Month labels along the bottom.
      const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
      months.forEach((name, m) => {
        if (narrow && m % 2) return;
        const date = Date.UTC(2026, 5 + m, 1);
        const week = (date - startDate.getTime()) / (7 * DAY);
        const text = el(
          "text",
          { class: "r-axis", x: f1(xAt(week)), y: f1(H - 8) },
          svg
        );
        text.textContent = name;
      });
      if (!narrow) {
        const first = el(
          "text",
          { class: "r-axis", x: labelW, y: f1(H - 8) },
          svg
        );
        first.textContent = "May";
      }

      if (!entered) {
        entered = true;
        plot.classList.add("is-entering");
        window.setTimeout(() => plot.classList.remove("is-entering"), 2200);
      }
    }

    draw();
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(plot);
    else window.addEventListener("resize", draw);
  }

  /* ---------------- Tile figures ---------------- */

  // Arrow from the edge of one node to the edge of another.
  function arrow(svg, a, b, r, cls) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const x1 = a[0] + ux * r;
    const y1 = a[1] + uy * r;
    const x2 = b[0] - ux * (r + 3);
    const y2 = b[1] - uy * (r + 3);
    el(
      "path",
      { class: cls, d: `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}` },
      svg
    );
    const head = 8;
    const hx = x2 - ux * head;
    const hy = y2 - uy * head;
    el(
      "path",
      {
        class: cls.replace(" f-dash", ""),
        d: `M${f1(hx - uy * 4.5)} ${f1(hy + ux * 4.5)}L${f1(x2)} ${f1(y2)}L${f1(hx + uy * 4.5)} ${f1(hy - ux * 4.5)}`,
      },
      svg
    );
  }

  function node(svg, p, r, letter, opts = {}) {
    el(
      "circle",
      {
        class:
          (opts.accent ? "f-fill-accent " : "f-bg ") +
          (opts.dashed ? "f-muted f-dash" : "f-line"),
        cx: p[0],
        cy: p[1],
        r,
        style: opts.accent ? "stroke:none" : "",
      },
      svg
    );
    const text = el(
      "text",
      {
        class:
          "f-text" +
          (opts.accent ? " f-text-inverse" : "") +
          (opts.dashed ? " f-text-muted" : ""),
        x: p[0],
        y: p[1] + 5.5,
        "text-anchor": "middle",
      },
      svg
    );
    text.textContent = letter;
  }

  const FIGS = {
    posterior(svg, w, h) {
      const base = h - 34;
      const x0 = 36;
      const x1 = w - 36;
      const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / s;
      const post = x => 0.72 * pdf(x, 0.56, 0.062) + 0.28 * pdf(x, 0.65, 0.09);
      const prior = x => pdf(x, 0.46, 0.24);
      const N = 400;
      const xs = Array.from({ length: N + 1 }, (_, i) => i / N);
      const peak = Math.max(...xs.map(post));
      const sx = x => x0 + x * (x1 - x0);
      const sy = (f, x) => base - (f(x) / peak) * (base - 22);

      // Quantiles of the posterior, by cumulative sum.
      const mass = xs.map(post);
      const totalMass = mass.reduce((a, b) => a + b, 0);
      const q = p => {
        let acc = 0;
        for (let i = 0; i <= N; i++) {
          acc += mass[i] / totalMass;
          if (acc >= p) return xs[i];
        }
        return 1;
      };
      const band = (lo, hi, cls) => {
        const inside = xs.filter(x => x >= lo && x <= hi);
        const pts = inside.map(x => [sx(x), sy(post, x)]);
        el(
          "path",
          {
            class: cls,
            d: `${polyline(pts)}L${f1(sx(hi))} ${base}L${f1(sx(lo))} ${base}Z`,
          },
          svg
        );
      };

      el(
        "path",
        {
          class: "f-muted f-dash",
          d: polyline(xs.map(x => [sx(x), sy(prior, x)])),
        },
        svg
      );
      band(q(0.03), q(0.97), "f-soft");
      band(q(0.25), q(0.75), "f-mid");
      el(
        "path",
        { class: "f-line", d: polyline(xs.map(x => [sx(x), sy(post, x)])) },
        svg
      );
      const mean = q(0.5);
      el(
        "path",
        {
          class: "f-accent",
          d: `M${f1(sx(mean))} ${base}L${f1(sx(mean))} ${f1(sy(post, mean))}`,
        },
        svg
      );
      el("path", { class: "f-muted", d: `M${x0} ${base}L${x1} ${base}` }, svg);
      [0.03, 0.25, 0.75, 0.97].forEach(p => {
        const x = f1(sx(q(p)));
        el(
          "path",
          { class: "f-line", d: `M${x} ${base}L${x} ${base + 7}` },
          svg
        );
      });
    },

    cube(svg, w, h) {
      const nx = 12;
      const ny = 5;
      const kx = 0.94;
      const ky = 0.34;
      const a = Math.min((w - 40) / ((nx + ny) * kx), (h - 30) / 8.5);
      const gap = a * 1.4;
      const cx = w / 2 - ((nx - ny) * a * kx) / 2;
      const cy = h - 12 - (nx + ny) * a * ky;
      const iso = (x, y, z) => [
        cx + (x - y) * a * kx,
        cy + (x + y) * a * ky - z * gap,
      ];
      for (let z = 0; z < 3; z++) {
        for (let x = 0; x < nx; x++) {
          for (let y = 0; y < ny; y++) {
            const corners = [
              iso(x, y, z),
              iso(x + 1, y, z),
              iso(x + 1, y + 1, z),
              iso(x, y + 1, z),
            ];
            const top = z === 2;
            const cls =
              top && x === 7 && y === 2
                ? "f-fill-accent f-line"
                : top && (x === 7 || y === 2)
                  ? "f-mid f-line"
                  : "f-bg " + (top ? "f-line" : "f-muted");
            el("path", { class: cls, d: polyline(corners) + "Z" }, svg);
          }
        }
      }
      // Dashed guides tying the highlighted cell to the layers beneath it.
      [
        [7, 2],
        [8, 3],
      ].forEach(([x, y]) => {
        const p = iso(x, y, 2);
        const q = iso(x, y, 0);
        el(
          "path",
          {
            class: "f-accent f-dash",
            d: `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`,
            style: "stroke-width:1.25",
          },
          svg
        );
      });
    },

    dag(svg, w) {
      const Z = [w / 2, 48];
      const T = [w / 2 - 132, 164];
      const Y = [w / 2 + 132, 164];
      const U = [w / 2, 228];
      const r = 23;
      arrow(svg, Z, T, r, "f-line");
      arrow(svg, Z, Y, r, "f-line");
      arrow(svg, U, T, r, "f-muted f-dash");
      arrow(svg, U, Y, r, "f-muted f-dash");
      arrow(svg, T, Y, r, "f-accent");
      node(svg, Z, r, "Z");
      node(svg, T, r, "T");
      node(svg, Y, r, "Y");
      node(svg, U, r - 4, "U", { dashed: true });
    },

    seeingdoing(svg, w) {
      const r = 19;
      const draw = (cx, cut) => {
        const Z = [cx, 46];
        const T = [cx - 68, 150];
        const Y = [cx + 68, 150];
        if (cut) {
          const mx = (Z[0] + T[0]) / 2;
          const my = (Z[1] + T[1]) / 2;
          el(
            "path",
            {
              class: "f-muted f-dash",
              d: `M${f1(Z[0] - 12)} ${f1(Z[1] + 18)}L${f1(T[0] + 12)} ${f1(T[1] - 18)}`,
            },
            svg
          );
          el(
            "path",
            {
              class: "f-accent",
              d: `M${f1(mx - 11)} ${f1(my - 8)}L${f1(mx + 11)} ${f1(my + 8)}`,
            },
            svg
          );
        } else {
          arrow(svg, Z, T, r, "f-line");
        }
        arrow(svg, Z, Y, r, "f-line");
        arrow(svg, T, Y, r, cut ? "f-accent" : "f-line");
        node(svg, Z, r, "Z");
        node(svg, T, r, "T", { accent: cut });
        node(svg, Y, r, "Y");
        const caption = el(
          "text",
          {
            class: "f-text f-text-muted",
            x: cx,
            y: 218,
            "text-anchor": "middle",
          },
          svg
        );
        caption.textContent = cut ? "Doing: set T" : "Seeing: observe T";
      };
      draw(w * 0.26, false);
      draw(w * 0.74, true);
      el("path", { class: "f-muted", d: `M${w / 2} 30L${w / 2} 226` }, svg);
    },

    funnel(svg, w, h) {
      const n = gaussian(11);
      const u = rng(5);
      for (let i = 0; i < 520; i++) {
        const v = n() * 1.05;
        const x = n() * Math.exp(v * 0.9) * 34;
        const px = w / 2 + x;
        const py = h / 2 - v * 44;
        if (px < 14 || px > w - 14 || py < 10 || py > h - 10) continue;
        const divergent = v < -0.9 && u() < 0.55;
        el(
          "circle",
          {
            class: divergent ? "f-fill-accent" : "f-fill-muted",
            cx: f1(px),
            cy: f1(py),
            r: divergent ? 3 : 1.7,
          },
          svg
        );
      }
    },

    dml(svg) {
      const n = gaussian(23);
      const panel = (x0, residual) => {
        const x1 = x0 + 190;
        const y0 = 28;
        const y1 = 228;
        const pts = [];
        for (let i = 0; i < 90; i++) {
          const c = n();
          const d = residual ? n() * 0.9 : c * 0.9 + n() * 0.45;
          const y = 0.5 * d + (residual ? 0 : 1.6 * c) + n() * 0.5;
          pts.push([d, y]);
        }
        const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const slope =
          pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) /
          pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
        const sx = d => (x0 + x1) / 2 + d * 30;
        const sy = y => (y0 + y1) / 2 - y * 22;
        el(
          "path",
          { class: "f-muted", d: `M${x0} ${y0}L${x0} ${y1}L${x1} ${y1}` },
          svg
        );
        pts.forEach(p => {
          const px = sx(p[0]);
          const py = sy(p[1]);
          if (px < x0 + 4 || px > x1 - 4 || py < y0 + 4 || py > y1 - 4) return;
          el(
            "circle",
            { class: "f-fill-muted", cx: f1(px), cy: f1(py), r: 2.4 },
            svg
          );
        });
        const reach = residual ? 2.6 : 1.55;
        el(
          "path",
          {
            class: residual ? "f-accent" : "f-line",
            d: `M${f1(sx(-reach))} ${f1(sy(my - slope * reach))}L${f1(sx(reach))} ${f1(sy(my + slope * reach))}`,
          },
          svg
        );
      };
      panel(34, false);
      panel(256, true);
    },

    overlap(svg, w, h) {
      const mid = h / 2;
      const bins = 22;
      const bw = (w - 60) / bins;
      const beta = (x, a, b) => x ** (a - 1) * (1 - x) ** (b - 1);
      const exposed = [];
      const control = [];
      for (let i = 0; i < bins; i++) {
        const x = (i + 0.5) / bins;
        exposed.push(beta(x, 4.4, 2.3));
        control.push(beta(x, 2.2, 4.6));
      }
      const me = Math.max(...exposed);
      const mc = Math.max(...control);
      for (let i = 0; i < bins; i++) {
        const x = 30 + i * bw + 2;
        const he = (exposed[i] / me) * (mid - 26);
        const hc = (control[i] / mc) * (mid - 26);
        el(
          "rect",
          {
            class: "f-fill-accent",
            x: f1(x),
            y: f1(mid - 3 - he),
            width: f1(bw - 4),
            height: f1(he),
            rx: 2.5,
          },
          svg
        );
        el(
          "rect",
          {
            class: "f-fill-muted",
            x: f1(x),
            y: f1(mid + 3),
            width: f1(bw - 4),
            height: f1(hc),
            rx: 2.5,
          },
          svg
        );
      }
    },

    index(svg, w, h) {
      const n = gaussian(41);
      const weeks = 44;
      const mid = h / 2 + 18;
      const sx = i => 28 + (i / (weeks - 1)) * (w - 56);
      let v = 0;
      const pts = [];
      for (let i = 0; i < weeks; i++) {
        const drift = i > 34 ? (i - 34) * 0.42 : 0;
        v = 0.55 * v + n() * 0.55;
        pts.push([sx(i), mid - (v + drift) * 22]);
      }
      el(
        "rect",
        {
          class: "f-soft",
          x: 28,
          y: mid - 34,
          width: w - 56,
          height: 68,
          rx: 6,
        },
        svg
      );
      el(
        "path",
        { class: "f-muted f-dash", d: `M28 ${mid}L${w - 28} ${mid}` },
        svg
      );
      el("path", { class: "f-line", d: polyline(pts) }, svg);
      pts.slice(-7).forEach(p => {
        el(
          "circle",
          { class: "f-fill-accent", cx: f1(p[0]), cy: f1(p[1]), r: 4 },
          svg
        );
      });
    },

    ladder(svg, w) {
      const truth = w * 0.6;
      const centers = [-64, -40, -22, -10, -3];
      const halves = [176, 124, 84, 52, 28];
      el(
        "path",
        { class: "f-muted f-dash", d: `M${f1(truth)} 24L${f1(truth)} 236` },
        svg
      );
      centers.forEach((offset, i) => {
        const y = 48 + i * 41;
        const c = truth + offset;
        const last = i === centers.length - 1;
        const cls = last ? "f-accent" : "f-line";
        el(
          "path",
          {
            class: cls,
            d:
              `M${f1(c - halves[i])} ${y}L${f1(c + halves[i])} ${y}` +
              `M${f1(c - halves[i])} ${y - 7}L${f1(c - halves[i])} ${y + 7}` +
              `M${f1(c + halves[i])} ${y - 7}L${f1(c + halves[i])} ${y + 7}`,
          },
          svg
        );
        el(
          "circle",
          {
            class: last ? "f-fill-accent" : "f-fill-line",
            cx: f1(c),
            cy: y,
            r: 5,
          },
          svg
        );
      });
    },

    latent(svg, w, h) {
      const n = gaussian(73);
      const waves = 56;
      const sx = i => 26 + (i / (waves - 1)) * (w - 52);
      const z = i =>
        h / 2 +
        18 -
        i * 1.15 -
        26 * Math.sin(i / 8.5) -
        10 * Math.sin(i / 3.1 + 1);
      const upper = [];
      const lower = [];
      const line = [];
      for (let i = 0; i < waves; i++) {
        line.push([sx(i), z(i)]);
        upper.push([sx(i), z(i) - 17]);
        lower.unshift([sx(i), z(i) + 17]);
      }
      el(
        "path",
        { class: "f-soft", d: polyline(upper.concat(lower)) + "Z" },
        svg
      );
      for (let i = 0; i < waves; i++) {
        el(
          "circle",
          {
            class: "f-fill-muted",
            cx: f1(sx(i)),
            cy: f1(z(i) + n() * 24),
            r: 2.6,
          },
          svg
        );
      }
      el("path", { class: "f-accent", d: polyline(line) }, svg);
    },

    graph(svg) {
      const n = gaussian(97);
      const centers = [
        [112, 88],
        [318, 70],
        [214, 186],
        [392, 182],
      ];
      const nodes = [];
      centers.forEach((c, k) => {
        const count = 9 + (k % 2) * 2;
        for (let i = 0; i < count; i++) {
          nodes.push({
            x: i ? c[0] + n() * 40 : c[0],
            y: i ? c[1] + n() * 30 : c[1],
            k,
            hub: i === 0,
          });
        }
      });
      const edges = [];
      nodes.forEach((a, i) => {
        if (a.hub) return;
        const hub = nodes.findIndex(b => b.hub && b.k === a.k);
        edges.push([i, hub]);
        let best = -1;
        let bestD = Infinity;
        nodes.forEach((b, j) => {
          if (j === i || b.k !== a.k || b.hub) return;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        });
        if (best >= 0) edges.push([i, best]);
      });
      const hubs = nodes.map((b, j) => (b.hub ? j : -1)).filter(j => j >= 0);
      [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 3],
        [1, 3],
      ].forEach(([a, b]) => edges.push([hubs[a], hubs[b]]));
      edges.forEach(([a, b]) => {
        el(
          "path",
          {
            class: "f-muted",
            d: `M${f1(nodes[a].x)} ${f1(nodes[a].y)}L${f1(nodes[b].x)} ${f1(nodes[b].y)}`,
          },
          svg
        );
      });
      nodes.forEach(p => {
        el(
          "circle",
          {
            class: p.hub ? "f-fill-accent" : "f-fill-line",
            cx: f1(p.x),
            cy: f1(p.y),
            r: p.hub ? 7 : 3.4,
          },
          svg
        );
      });
    },

    part(svg, w, h) {
      const a = 30;
      const L = 6.4;
      const D = 4;
      const Hh = 1.5;
      const cx = w / 2 - ((L - D) * a * 0.866) / 2;
      const cy = h - 22 - (L + D) * a * 0.5;
      const iso = (x, y, z) => [
        cx + (x - y) * a * 0.866,
        cy + (x + y) * a * 0.5 - z * a,
      ];
      const loop = (pts, cls, extra) =>
        el(
          "path",
          { class: cls, d: polyline(pts) + "Z", style: extra || "" },
          svg
        );
      const rect = (z, inset) => [
        iso(inset, inset, z),
        iso(L - inset, inset, z),
        iso(L - inset, D - inset, z),
        iso(inset, D - inset, z),
      ];
      // Body: visible side faces, then the open top rim and inner floor.
      loop(
        [iso(0, D, 0), iso(L, D, 0), iso(L, D, Hh), iso(0, D, Hh)],
        "f-bg f-line"
      );
      loop(
        [iso(L, 0, 0), iso(L, D, 0), iso(L, D, Hh), iso(L, 0, Hh)],
        "f-bg f-line"
      );
      loop(rect(Hh, 0), "f-bg f-line");
      loop(rect(Hh, 0.28), "f-muted");
      // Screw bosses.
      [
        [0.75, 0.75],
        [L - 0.75, 0.75],
        [L - 0.75, D - 0.75],
        [0.75, D - 0.75],
      ].forEach(([x, y]) => {
        const p = iso(x, y, Hh);
        el(
          "ellipse",
          { class: "f-bg f-line", cx: f1(p[0]), cy: f1(p[1]), rx: 9, ry: 5.2 },
          svg
        );
        el(
          "ellipse",
          {
            class: "f-fill-line",
            cx: f1(p[0]),
            cy: f1(p[1]),
            rx: 3.4,
            ry: 2,
          },
          svg
        );
      });
      // Lid, lifted, with guides down to the body.
      const lift = Hh + 2.1;
      rect(lift, 0).forEach((p, i) => {
        const q = rect(Hh, 0)[i];
        el(
          "path",
          {
            class: "f-muted f-dash",
            d: `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`,
          },
          svg
        );
      });
      loop(rect(lift, 0), "f-soft f-accent");
    },

    console(svg, w) {
      const n = gaussian(131);
      const box = (x, y, bw, bh) =>
        el(
          "rect",
          { class: "f-muted", x, y, width: bw, height: bh, rx: 12 },
          svg
        );
      // Trend card.
      box(24, 22, 258, 104);
      let v = 0;
      const pts = [];
      for (let i = 0; i < 30; i++) {
        v = 0.7 * v + n() * 6 + 0.6;
        pts.push([42 + i * 7.7, 96 - v - i * 0.9]);
      }
      el("path", { class: "f-accent", d: polyline(pts) }, svg);
      // Two bar summaries.
      [22, 78].forEach((y, k) => {
        box(298, y, w - 322, 48);
        const widths = k ? [0.46, 0.74] : [0.82, 0.58];
        widths.forEach((frac, j) => {
          el(
            "rect",
            {
              class: j ? "f-fill-muted" : "f-fill-line",
              x: 312,
              y: y + 14 + j * 13,
              width: f1((w - 350) * frac),
              height: 6,
              rx: 3,
            },
            svg
          );
        });
      });
      // Thumbnail grid.
      const cols = 8;
      const size = (w - 48 - (cols - 1) * 10) / cols;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < cols; c++) {
          const picked = (r === 0 && c === 2) || (r === 1 && c === 5);
          el(
            "rect",
            {
              class: picked ? "f-soft f-accent" : "f-muted",
              x: f1(24 + c * (size + 10)),
              y: f1(142 + r * (size + 10)),
              width: f1(size),
              height: f1(size),
              rx: 8,
            },
            svg
          );
        }
      }
    },

    essay(svg, w) {
      const left = 56;
      const right = w - 56;
      const widths = [0.52, 1, 0.94, 1, 0.7, 0, 0, 1, 0.97, 0.88, 0.4];
      el(
        "rect",
        {
          class: "f-fill-line",
          x: left,
          y: 30,
          width: (right - left) * 0.46,
          height: 10,
          rx: 5,
        },
        svg
      );
      widths.forEach((frac, i) => {
        if (!frac) return;
        el(
          "rect",
          {
            class: "f-fill-muted",
            x: left,
            y: 62 + i * 16,
            width: f1((right - left) * frac),
            height: 5,
            rx: 2.5,
          },
          svg
        );
      });
      // The display equation in the middle of the page.
      const eq = el(
        "text",
        {
          class: "f-text",
          x: w / 2,
          y: 158,
          "text-anchor": "middle",
          style: "fill:var(--fig-accent);font-size:17px",
        },
        svg
      );
      eq.textContent = "p(θ | y) ∝ p(y | θ) p(θ)";
    },
  };

  function init() {
    document.querySelectorAll("[data-ridgeline]").forEach(ridgeline);
    document.querySelectorAll("svg[data-fig]").forEach(svg => {
      const draw = FIGS[svg.dataset.fig];
      if (!draw) return;
      const box = svg.viewBox.baseVal;
      draw(svg, box.width, box.height);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
