/* global React, PosteriorFigure */
const { useState, useEffect, useMemo } = React;

const FEATURED_PROJECTS = [
  {
    tag: "Flagship · Open source",
    slug: "redam94/mmm-framework",
    title: "MMM Framework",
    blurb:
      "A production Bayesian Marketing Mix Modeling toolkit on PyMC-Marketing, with a FastAPI service and React Studio. Pre-specified, partially pooled, and honest about uncertainty — designed to hold up under finance and audit review.",
    stack: ["PyMC", "FastAPI", "React", "Pydantic", "uv"],
    status: "active",
    href: "https://redam94.github.io/mmm-framework/",
    repo: "https://github.com/redam94/mmm-framework",
    site: true,
    featured: true,
    figure: "posterior",
  },
  {
    tag: "In progress · Personal site",
    slug: "second-brain.mattreda.pro",
    title: "Second Brain",
    blurb:
      "My public notebook — reading notes, model derivations, half-finished essays on measurement, and the references I keep losing in private bookmarks. Currently moving from GitHub Pages to its own domain.",
    stack: ["Quarto", "Markdown", "Cloudflare"],
    status: "active",
    href: "https://second-brain.mattreda.pro/",
    repo: "https://github.com/redam94/second-brain",
    site: true,
  },
  {
    tag: "Consulting · Client",
    slug: "epochlag.com",
    title: "Epoch Lag",
    blurb:
      "A social-media app where I'm building the ML pipelines, the admin dashboard, and the underlying infrastructure. Recommendation, ranking, and moderation models on one side; the operator tools to monitor and tune them on the other.",
    stack: ["Python", "ML pipelines", "FastAPI", "Infra"],
    status: "active",
    href: "https://www.epochlag.com/",
    site: true,
  },
  {
    tag: "Writing · Pedagogy",
    slug: "redam94/common_regression_issues",
    title: "Common Regression Issues",
    blurb:
      "A short, opinionated tour of the regression failure modes I see most often in marketing measurement — collinearity, leakage, omitted variables, the works — with worked examples and what to do instead.",
    stack: ["Quarto", "Python", "statsmodels"],
    status: "active",
    href: "https://redam94.github.io/common_regression_issues/",
    repo: "https://github.com/redam94/common_regression_issues",
    site: true,
  },
  {
    tag: "Research",
    slug: "redam94/haruspex",
    title: "Haruspex",
    blurb:
      "Diagnostics-first wrapper around posterior fits — automatic R̂ / ESS / divergence reports plus targeted prior-pushforward checks before you trust a summary.",
    stack: ["Python", "ArviZ", "Polars"],
    status: "active",
    href: "https://github.com/redam94/haruspex",
  },
  {
    tag: "Tooling",
    slug: "redam94/atlas",
    title: "Atlas",
    blurb:
      "Schema-validated Master Flat File ingest for marketing data — the unsexy plumbing that decides whether your model is recoverable at all.",
    stack: ["Python", "Pandera", "DuckDB"],
    status: "active",
    href: "https://github.com/redam94/atlas",
  },
  {
    tag: "Research",
    slug: "redam94/BayesInsight",
    title: "BayesInsight",
    blurb:
      "Decision-theoretic reporting layer: turns posterior draws into expected-value, regret, and budget-shift recommendations leadership can actually act on.",
    stack: ["Python", "PyMC", "Streamlit"],
    status: "draft",
    href: "https://github.com/redam94/BayesInsight",
  },
  {
    tag: "Brand health",
    slug: "redam94/BayesianBrandTracker",
    title: "Bayesian Brand Tracker",
    blurb:
      "Hierarchical state-space model for brand-tracker survey data — pools weak weekly signal across geographies without losing local responsiveness.",
    stack: ["PyMC", "NumPyro", "Streamlit"],
    status: "active",
    href: "https://github.com/redam94/BayesianBrandTracker",
  },
  {
    tag: "Agentic systems",
    slug: "redam94/posterior-agent",
    title: "Posterior Agent",
    blurb:
      "An LLM-driven interrogator that sits on top of a fitted MMM. Ask 'what happens if we cut TV by 30% in Q3?' and it queries the posterior, runs the counterfactual, and returns a calibrated answer with HDIs — not a hallucination.",
    stack: ["Python", "PyMC", "LangGraph", "FastAPI"],
    status: "draft",
    href: "https://github.com/redam94",
  },
];

const METHOD = [
  {
    num: "01",
    title: "Start with the decision, not the data.",
    body: "Before any modeling, get clear on what's actually being decided: the budget that'll move, the threshold someone has to cross, the trade-off on the table. The model exists to support that. Nothing more, definitely nothing less.",
  },
  {
    num: "02",
    title: "Pre-specify the model. Then commit.",
    body: "Pick a likelihood, priors, and identification strategy before you see the fit. Specification shopping is the fastest way to get an answer that flatters the brief and survives nothing.",
  },
  {
    num: "03",
    title: "Validate the data first — it's almost always the data.",
    body: "Schema, coverage, zero-spend stretches, collinearity. Most 'modeling' problems are upstream data problems. Most overconfident answers are too.",
  },
  {
    num: "04",
    title: "Diagnose before reporting.",
    body: "R̂ < 1.01, ESS > 400, no divergent transitions. If diagnostics fail, the summary statistic is fiction — and a fiction shipped to a CFO is worse than no answer.",
  },
  {
    num: "05",
    title: "Report what the data actually supports.",
    body: "HDIs, not point estimates. Sign uncertainty visible. 'We don't know yet' is a complete sentence. Stakeholders adjust faster to honest ranges than to point estimates that quietly move every quarter.",
  },
  {
    num: "06",
    title: "Tie every number to a decision — or cut it.",
    body: "Posterior draws turn into expected ROI, regret of cutting a channel, probability the budget shift beats status quo. If a chart doesn't change anyone's behavior, it's decoration. Decoration is fine; just don't bill for it.",
  },
];

const EXPERIENCE = [
  // { period: "2024 — present", role: "Stats consulting", org: "Matthew Reda · Stats", blurb: "Solo practice. Bayesian MMM, brand-tracker measurement, and decision-grade reporting for in-house analytics teams. Source on GitHub; engagements ship code, not slides." },
  {
    period: "2024 — present",
    role: "Senior Measurement Scientist",
    org: "Choreograph (now WPPMedia)",
    blurb:
      "Built MMM and incrementality systems for portfolios in the high-eight-figure media-spend range. Owned methodology and fitting infrastructure.",
  },
  {
    period: "2022 — 2024",
    role: "Measurement & Modeling",
    org: "EssenceMediacom",
    blurb:
      "Hierarchical regression for brand health. Started the migration from frequentist regressions to fully Bayesian posteriors.",
  },
  {
    period: "2012 — 2016",
    role: "S.B. Physics",
    org: "Massachusetts Institute of Technology",
    blurb:
      "Undergraduate research on Stochastic Optical Reconstruction Microscopy (STORM) — single-molecule localization, point-spread-function fitting, and Bayesian deconvolution.",
  },
];

const ENGAGEMENTS = [
  {
    num: "Service · 01",
    title: "Decision framing",
    body: "Two weeks. I sit with your marketing, finance, and analytics leaders, map the decisions actually on the table, and write the measurement plan that would credibly support each one. Often the most valuable output is the model we agree not to build.",
    points: [
      "Stakeholder interviews",
      "Decision → measurement map",
      "Written plan + readout",
    ],
  },
  {
    num: "Service · 02",
    title: "Build a measurement system",
    body: "Six- to twelve-week engagements: schema, ingest, Bayesian model, decision layer. You get the repo, the FastAPI service, and an analyst trained to run it. Every output ties back to a decision the business made up front.",
    points: [
      "Data ingest + validation",
      "Bayesian MMM or brand tracker",
      "Decision-grade reporting",
    ],
  },
  {
    num: "Service · 03",
    title: "Embedded statistician",
    body: "Quarterly retainer. I sit alongside your in-house analytics team — methodology calls, code review, and the difficult conversations with stakeholders about what the posterior actually says (and what it doesn't).",
    points: ["Methodology calls", "Code review", "Honest stakeholder readouts"],
  },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={"nav" + (scrolled ? " scrolled" : "")}>
      <div className="nav-inner">
        <a className="nav-brand" href="#top">
          <span className="mark">mmm</span>
          <span className="person">Matthew Reda</span>
        </a>
        <div className="nav-links">
          <a href="#methodology">Methodology</a>
          <a href="#projects">Projects</a>
          <a href="#repos">GitHub</a>
          <a href="#engage">Engage</a>
          <a className="nav-cta" href="#contact">
            Get in touch
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero({ heroVariant }) {
  const [seed, setSeed] = useState(0);
  const reroll = () => setSeed(s => s + 1);

  return (
    <section className="hero" id="top">
      <div className="hero-grid">
        <div>
          <div className="hero-eyebrow">
            Statistics in the service of decisions · occasionally the truth
            surprises everyone
          </div>
          <h1>
            Honest measurement, applied carefully, in service of{" "}
            <em>better business decisions</em> — and the occasional{" "}
            <em>oh huh</em>.
          </h1>
          <p className="hero-lede">
            I'm{" "}
            <strong style={{ color: "var(--fg)", fontWeight: 500 }}>
              Matthew Reda
            </strong>
            . I sit with marketing and finance leaders, figure out what's
            actually being decided, and build the smallest Bayesian system that
            can answer it. Sometimes that's a 60-line model. Sometimes it's a
            year-long platform. Always honest about what we know and what we
            don't.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#projects">
              See the work
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <a
              className="btn btn-ghost"
              href="https://github.com/redam94"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
              </svg>
              redam94 on GitHub
            </a>
          </div>

          <div className="hero-meta">
            <div className="hero-meta-item">
              <div className="label">Based</div>
              <div className="value">Remote · US East</div>
            </div>
            <div className="hero-meta-item">
              <div className="label">Discipline</div>
              <div className="value">Bayesian measurement</div>
            </div>
            <div className="hero-meta-item">
              <div className="label">Stack</div>
              <div className="value">PyMC · FastAPI · React</div>
            </div>
            <div className="hero-meta-item">
              <div className="label">Availability</div>
              <div className="value">
                Q3 — one engagement, taking applications
              </div>
            </div>
          </div>
        </div>
        <div className="hero-figure">
          <div className="hero-figure-title">
            {heroVariant === "forest"
              ? "fig. 01 · forest plot · 94% hdi"
              : heroVariant === "trace"
                ? "fig. 01 · mcmc trace · 4 chains"
                : "fig. 01 · posterior · β coefficient"}
          </div>
          <PosteriorFigure variant={heroVariant} key={seed} />
          <div className="hero-figure-caption">
            <span>R̂ 1.003</span>
            <span>ESS 4,180</span>
            <span>4 × 1,000 draws</span>
          </div>
          <button
            className="hero-figure-roll"
            onClick={reroll}
            title="Refit the model"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
            </svg>
            refit
          </button>
        </div>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    <section id="methodology" className="section-paper-2">
      <div className="container-wide">
        <div className="section-eyebrow">§ 01 — How I work</div>
        <h2 className="section-title">
          Understand the decision. Apply statistics carefully. Report honestly.
          Repeat.
        </h2>
        <p className="section-lede">
          The work doesn't start with a model — it starts with a half-hour
          conversation about what the business is actually trying to decide.
          Everything below is downstream of that. Six commitments, and one rule:
          if the answer's boring, that's still the answer.
        </p>
        <div className="about-grid" style={{ marginTop: "var(--space-7)" }}>
          <div className="about-prose">
            <p>
              <strong>
                Most measurement work fails before any model is fit.
              </strong>{" "}
              A team commissions a study to answer a question nobody's actually
              going to act on, or builds a dashboard for a decision that gets
              made on instinct anyway. The first thing I do on any engagement is
              sit with the people who own the budget, the P&L, and the brief —
              and figure out which decision actually moves if the answer comes
              back differently. Sometimes the right call is to not build the
              model at all. (The invoice is smaller; the relationship is
              better.)
            </p>
            <div className="pull">
              "The model exists to support a decision. If there's no decision,
              there's no model — only homework."
            </div>
            <p>
              <strong>Then I apply statistics carefully and honestly.</strong>{" "}
              Pre-specify the likelihood, validate the data, fit the model,
              check the diagnostics, report with HDIs. The training is from
              biophysics at MIT — single-molecule STORM imaging, where every
              pixel is noise until you treat it as a measurement problem. Same
              instinct, smaller microscopes: write the model down first, decide
              what would falsify it, then look at the data.
            </p>
            <p>
              <strong>
                Honest reporting is the long-run business outcome.
              </strong>{" "}
              Stakeholders trust ranges that hold up. Finance trusts numbers
              that survive audit. Analysts trust code they can read. The
              compounding effect of telling clients what you actually know — and
              what you don't — is the biggest thing I have to offer. The Python
              tools, the agentic systems, the FastAPI services are how that
              compounding gets shipped. Also: I genuinely enjoy this. If you
              find a friend who lights up at the words "posterior predictive
              check," hire them.
            </p>
          </div>
          <ol className="method-list">
            {METHOD.map(m => (
              <li className="method-card" key={m.num}>
                <span className="method-num">{m.num}</span>
                <div className="method-body">
                  <h4>{m.title}</h4>
                  <p>{m.body}</p>
                </div>
                <span style={{ width: 1 }}></span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ProjectFigure({ kind }) {
  // Tiny inline figures for project cards
  if (kind === "posterior") {
    return (
      <svg
        viewBox="0 0 280 80"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="pg1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--olive-300)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--olive-300)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M0,80 C40,80 60,30 110,18 C160,8 180,72 220,76 C250,78 270,80 280,80 Z"
          fill="url(#pg1)"
        />
        <path
          d="M0,80 C40,80 60,30 110,18 C160,8 180,72 220,76 C250,78 270,80 280,80"
          stroke="var(--olive-700)"
          fill="none"
          strokeWidth="1.4"
        />
        <line
          x1="110"
          x2="110"
          y1="18"
          y2="80"
          stroke="var(--olive-800)"
          strokeWidth="1.2"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }
  return null;
}

function Projects() {
  return (
    <section id="projects">
      <div className="container-wide">
        <div className="section-eyebrow">§ 02 — Selected work</div>
        <h2 className="section-title">
          A small surface, maintained carefully — plus a few weekend
          experiments.
        </h2>
        <p className="section-lede">
          Most of these started as a Sunday notebook and graduated. A few are
          still cooking. All open source — clone them, break them, file an
          issue.
        </p>
        <div className="projects-grid">
          {FEATURED_PROJECTS.map(p => (
            <a
              className={"project-card" + (p.featured ? " featured" : "")}
              key={p.slug}
              href={p.href}
              target="_blank"
              rel="noreferrer"
            >
              <div className="project-head">
                <div>
                  <div className="project-tag">{p.tag}</div>
                  <h3 className="project-title">{p.title}</h3>
                  <div className="project-slug">{p.slug}</div>
                </div>
                <span
                  className={
                    "project-status " +
                    (p.status === "archive"
                      ? "archive"
                      : p.status === "draft"
                        ? "draft"
                        : "")
                  }
                >
                  {p.status === "archive"
                    ? "archived"
                    : p.status === "draft"
                      ? "draft"
                      : "active"}
                </span>
              </div>
              {p.featured && (
                <div className="project-figure">
                  <ProjectFigure kind="posterior" />
                </div>
              )}
              <p className="project-blurb">{p.blurb}</p>
              <div className="project-stack">
                {p.stack.map(s => (
                  <span className="stack-chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="project-foot">
                <span>
                  {p.site
                    ? p.slug.includes("/")
                      ? "redam94.github.io → site"
                      : p.slug + " → site"
                    : "github.com/" + p.slug}
                </span>
                <span className="project-arrow">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                  >
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Repos() {
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(
      "https://api.github.com/users/redam94/repos?per_page=100&sort=updated",
      {
        headers: { Accept: "application/vnd.github+json" },
      }
    )
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => {
        if (cancelled) return;
        const filtered = data
          .filter(r => !r.fork && !r.archived)
          .sort(
            (a, b) =>
              b.stargazers_count - a.stargazers_count ||
              new Date(b.pushed_at) - new Date(a.pushed_at)
          )
          .slice(0, 9);
        setRepos(filtered);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallback = [
    {
      name: "mmm-framework",
      description: "Bayesian Marketing Mix Modeling toolkit on PyMC-Marketing.",
      language: "Python",
      stargazers_count: "—",
      html_url: "https://github.com/redam94/mmm-framework",
    },
    {
      name: "haruspex",
      description: "Diagnostics-first wrapper for posterior fits.",
      language: "Python",
      stargazers_count: "—",
      html_url: "https://github.com/redam94/haruspex",
    },
    {
      name: "atlas",
      description: "Master Flat File ingest with schema validation.",
      language: "Python",
      stargazers_count: "—",
      html_url: "https://github.com/redam94/atlas",
    },
    {
      name: "BayesInsight",
      description: "Decision-theoretic reporting over posterior draws.",
      language: "Python",
      stargazers_count: "—",
      html_url: "https://github.com/redam94/BayesInsight",
    },
    {
      name: "BayesianBrandTracker",
      description: "Hierarchical state-space brand-tracker model.",
      language: "Python",
      stargazers_count: "—",
      html_url: "https://github.com/redam94/BayesianBrandTracker",
    },
    {
      name: "pymc-marketing-search",
      description: "Tiny search over PyMC-Marketing source and docs.",
      language: "Python",
      stargazers_count: "—",
      html_url: "https://github.com/redam94/pymc-marketing-search",
    },
  ];

  const list = repos || (error ? fallback : null);

  return (
    <section id="repos" className="section-paper-2">
      <div className="container-wide">
        <div className="section-eyebrow">§ 03 — GitHub</div>
        <h2 className="section-title">
          Recent activity, pulled live — and yes, I commit on Sundays.
        </h2>
        <p className="section-lede">
          The most recently updated public repositories, fetched the moment this
          page loads. If something looks half-finished, that's because it
          probably is.
        </p>
        <div className="repos">
          {list
            ? list.map(r => (
                <a
                  className="repo-card"
                  key={r.name}
                  href={r.html_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="repo-name">{r.name}</div>
                  <div className="repo-desc">
                    {r.description || "No description."}
                  </div>
                  <div className="repo-foot">
                    <div className="repo-lang">
                      <span className="lang-dot"></span>
                      <span>{r.language || "—"}</span>
                    </div>
                    <div className="repo-stars">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 17.3 5.8 21l1.6-7-5.4-4.6 7.1-.6L12 2l2.9 6.8 7.1.6-5.4 4.6 1.6 7z" />
                      </svg>
                      {r.stargazers_count ?? "—"}
                    </div>
                  </div>
                </a>
              ))
            : // skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <div className="repo-card" key={i} style={{ opacity: 0.5 }}>
                  <div className="repo-name">loading…</div>
                  <div className="repo-desc"> </div>
                  <div className="repo-foot">
                    <span>—</span>
                    <span>—</span>
                  </div>
                </div>
              ))}
        </div>
        <div className="repos-meta">
          <span>
            {repos
              ? `Showing ${repos.length} of github.com/redam94`
              : error
                ? "live fetch unavailable · showing cached"
                : "Fetching latest…"}
          </span>
          <a href="https://github.com/redam94" target="_blank" rel="noreferrer">
            All repositories →
          </a>
        </div>
      </div>
    </section>
  );
}

function Experience() {
  return (
    <section id="experience">
      <div className="container">
        <div className="section-eyebrow">§ 04 — Curriculum</div>
        <h2 className="section-title">
          From single-molecule blinks to media spend — same posterior, bigger
          budget.
        </h2>
        <p className="section-lede">
          MIT biophysics, then a half a decade in measurement science. The
          throughline: take uncertainty seriously, write the model down first,
          ship code, sleep well.
        </p>
        <div style={{ marginTop: "var(--space-7)" }}>
          {EXPERIENCE.map(e => (
            <div className="cv-strip" key={e.period}>
              <div className="cv-period">{e.period}</div>
              <div>
                <h3 className="cv-role">
                  {e.role} · <span className="cv-org">{e.org}</span>
                </h3>
                <p className="cv-blurb">{e.blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Engage() {
  return (
    <section id="engage" className="section-inverse">
      <div className="container-wide">
        <div className="section-eyebrow">§ 05 — How to engage</div>
        <h2 className="section-title">
          Three ways to work together — each starts with a conversation.
        </h2>
        <p className="section-lede" style={{ color: "var(--olive-200)" }}>
          I take a small number of engagements at a time. Every one starts with
          the same question: what is the business actually trying to decide, and
          what would honest measurement of it look like? The deliverables are
          downstream of that. The conversation is free.
        </p>
        <div className="engage-grid">
          {ENGAGEMENTS.map(e => (
            <div className="engage-card" key={e.num}>
              <div className="num">{e.num}</div>
              <h3>{e.title}</h3>
              <p>{e.body}</p>
              <ul>
                {e.points.map(p => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact">
      <div className="container-wide">
        <div className="contact-block">
          <div>
            <div className="section-eyebrow" style={{ margin: 0 }}>
              § 06 — Contact
            </div>
            <h2 style={{ marginTop: "var(--space-3)" }}>
              Tell me what you're trying to decide.
            </h2>
            <p>
              The best engagements start with a question, not a model. Send a
              short note about the decision on the table — the budget shift, the
              threshold, the trade-off — and what's currently being used to
              support it. I'll tell you whether honest measurement can move the
              needle, or whether you should save the budget and buy your team
              lunch instead.
            </p>
          </div>
          <div className="contact-channels">
            <a className="contact-channel" href="mailto:mattreda@mattreda.pro">
              <span>mattreda@mattreda.pro</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <a
              className="contact-channel"
              href="https://github.com/redam94"
              target="_blank"
              rel="noreferrer"
            >
              <span>github.com/redam94</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <a
              className="contact-channel"
              href="https://www.linkedin.com/in/matthew-reda"
              target="_blank"
              rel="noreferrer"
            >
              <span>linkedin.com/in/matthew-reda</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <span>
          © 2026 Matthew Reda · Built in the open ·{" "}
          <a href="https://github.com/redam94" target="_blank" rel="noreferrer">
            Source
          </a>
        </span>
        <span>Honest numbers, shipped as code. No spinners.</span>
      </div>
    </footer>
  );
}

// ---- Tweaks panel ----
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  shade: "forest",
  accent: "clay",
  heroVariant: "posterior",
  showExperience: true,
}; /*EDITMODE-END*/

function App() {
  const [tweaks, setTweak] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  useEffect(() => {
    document.body.dataset.shade = tweaks.shade;
    document.body.dataset.accent = tweaks.accent;
  }, [tweaks.shade, tweaks.accent]);

  const TP = window.TweaksPanel,
    TS = window.TweakSection,
    TR = window.TweakRadio,
    TT = window.TweakToggle,
    TSel = window.TweakSelect;

  return (
    <>
      <Nav />
      <Hero heroVariant={tweaks.heroVariant} />
      <Methodology />
      <Projects />
      <Repos />
      {tweaks.showExperience && <Experience />}
      <Engage />
      <Contact />
      <Footer />
      {TP && (
        <TP>
          <TS label="Olive shade" />
          <TR
            label="Shade"
            value={tweaks.shade}
            options={["sage", "forest", "grove"]}
            onChange={v => setTweak("shade", v)}
          />
          <TS label="Accent" />
          <TR
            label="Accent"
            value={tweaks.accent}
            options={["clay", "rust", "slate", "amber"]}
            onChange={v => setTweak("accent", v)}
          />
          <TS label="Hero figure" />
          <TR
            label="Variant"
            value={tweaks.heroVariant}
            options={["posterior", "forest", "trace"]}
            onChange={v => setTweak("heroVariant", v)}
          />
          <TS label="Sections" />
          <TT
            label="Show experience"
            value={tweaks.showExperience}
            onChange={v => setTweak("showExperience", v)}
          />
        </TP>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App />);
