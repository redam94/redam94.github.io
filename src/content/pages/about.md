---
title: "About"
description: "Matthew Reda — Bayesian measurement scientist. Honest measurement, applied carefully, in service of better decisions."
---

I'm **Matthew Reda**, a Bayesian measurement scientist. I sit with marketing and
finance leaders, figure out what's actually being decided, and build the smallest
Bayesian system that can answer it honestly. Sometimes that's a sixty-line model.
Sometimes it's a year-long platform. Either way, the goal is the same: tell people
what the data supports, and — just as importantly — what it doesn't.

This blog is where I think out loud about that work: marketing mix modeling,
measurement, regression done carefully, and the occasional result that surprises
everyone, me included.

## How I got here

I studied physics at MIT, where I did undergraduate research on single-molecule
microscopy — STORM imaging, point-spread-function fitting, Bayesian deconvolution.
When every pixel starts as noise until you treat it as a measurement problem, you
develop a particular instinct: write the model down first, decide what would
falsify it, _then_ look at the data. Same instinct now, smaller microscopes and
bigger budgets.

Since then I've spent my career in measurement science:

- **Manager Data Science at Choreograph (now WPP Media), 2024–present** —
  building MMM and incrementality systems for portfolios in the high-eight-figure
  media-spend range, owning the methodology and the fitting infrastructure.
- **Measurement & Modeling at EssenceMediacom, 2022–2024** — hierarchical
  regression for brand health, and the start of a migration from frequentist
  regressions to fully Bayesian posteriors.

## What I believe about measurement

A few things I keep coming back to, and write about here:

- **Start with the decision, not the data.** A model exists to support a decision.
  If there's no decision on the table, there's no model — only homework.
- **Pre-specify, then commit.** Pick a likelihood, priors, and identification
  strategy _before_ you see the fit. Specification shopping is the fastest way to
  get an answer that flatters the brief and survives nothing.
- **It's almost always the data.** Most "modeling" problems are upstream data
  problems. Validate schema, coverage, and collinearity first.
- **Diagnose before reporting.** If $\hat{R}$, ESS, or divergences fail, the
  summary statistic is fiction — and a fiction shipped to a CFO is worse than no
  answer.
- **Report what the data supports.** HDIs, not point estimates. "We don't know
  yet" is a complete sentence.

## What I build

Most of my work is open source. A few of the projects I write about:

- **[mmm-framework](https://github.com/redam94/mmm-framework)** — a pre-specified
  Bayesian marketing mix modeling toolkit on PyMC. See
  [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/).
- **[atlas](https://github.com/redam94/atlas)** — budget optimization over any
  predictive model. See [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/).
- **[BayesInsight](https://github.com/redam94/BayesInsight)** — config-driven
  Bayesian modeling. See [Bayesian Models as Configuration](/posts/bayesian-models-as-configuration/).

There's a fuller tour of the work — methodology, projects, and how to engage — on
my **[portfolio](/portfolio/)**.

## Elsewhere

- **Portfolio:** [Bayesian measurement systems](/portfolio/)
- **GitHub:** [@redam94](https://github.com/redam94)
- **Email:** [m.reda94@gmail.com](mailto:m.reda94@gmail.com)

If you find a friend who lights up at the words "posterior predictive check," hire
them. In the meantime, thanks for reading.
