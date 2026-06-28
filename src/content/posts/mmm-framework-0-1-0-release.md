---
title: "mmm-framework 0.1.0 Is on PyPI"
author: Matthew Reda
pubDatetime: 2026-06-28T07:00:00Z
slug: mmm-framework-0-1-0-release
draft: false
featured: true
tags:
  - marketing-mix-modeling
  - bayesian
  - pymc
  - release
description: The first public release of mmm-framework — a Bayesian marketing-mix modeling library built on PyMC-Marketing, designed around methodological rigor instead of specification shopping. pip install mmm-framework.
---

The first public release of [`mmm-framework`](https://github.com/redam94/mmm-framework) is live on PyPI. It's the library I've been writing about across most of this blog — a Bayesian marketing-mix modeling framework built around one stubborn idea: that the hard part of measurement is separating [coincidence from contribution](/posts/coincidence-is-not-contribution/), and that the tooling should make the honest path the easy one.

```bash
pip install mmm-framework
```

`0.1.0`, Apache-2.0, Python 3.12+. [Docs here](https://redam94.github.io/mmm-framework/), source [on GitHub](https://github.com/redam94/mmm-framework).

## What it is

The framework builds on [PyMC-Marketing](https://www.pymc-marketing.io/) rather than reinventing it, and adds the guardrails I kept wishing for in production work: declared variable roles, refutation checks, and the discipline of pre-specifying a model before you see what it says about your channels. What's in this first release:

- **Bayesian MMM with full posterior uncertainty** — adstock carryover and saturation in a multiplicative specification, with honest credible intervals instead of a single flattering point estimate. Wide intervals are a feature; they tell you where to go [run an experiment](/posts/closing-the-loop-mmm-calibration/).
- **Bayesian _or_ frequentist inference** — fast modern samplers (`numpyro`, `nutpie`) for the full Bayesian treatment, with a frequentist path when you need it.
- **Variable-dimension and hierarchical panel data** — geo-week panels and other ragged structures handled natively, not bolted on.
- **Async model fitting** — a FastAPI + Redis + `arq` job layer so long fits run in the background instead of blocking, with models serialized to disk for reload and re-analysis.
- **Interactive visualization** — Plotly-based decomposition, saturation, and ROI views.

## The premise, briefly

If you've read the rest of this blog you know the argument. A marketing-mix model answers a causal question — _what would sales have been without this media?_ — and observational data alone can't fully answer it. So the framework is organized around [pre-specification](/posts/building-a-pre-specified-bayesian-mmm/), [generative modeling with real predictive checks](/posts/generative-mmm-honest-iteration/), and a [closed loop](/posts/measurement-is-a-loop-not-a-report/) where experiments calibrate the model rather than the model marking its own homework. The 0.1.0 library is the modeling core of that; the experiment-prioritization and calibration machinery is what I'm building on top.

## 0.1.0 means 0.1.0

This is an early release and I'm treating it as one. The API will move, some of the more experimental pieces (nested/mediated models, multivariate portfolio effects) are still settling, and I'd rather ship something honest than something that pretends to be 1.0. If you try it and something is wrong, [open an issue](https://github.com/redam94/mmm-framework/issues) — that feedback is exactly what a 0.1 is for.

If you do marketing measurement and you're tired of models that report tight numbers they haven't earned, give it a look.
