---
title: "LOO Cross-Validation Is the Wrong CV for Your MMM"
author: Matthew Reda
pubDatetime: 2026-08-04T13:23:51Z
slug: loo-wrong-cv-mmm
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - model-evaluation
description: Row-wise leave-one-out cross-validation on a weekly MMM trains on the future. On a 156-week simulation, blocking just two neighbors around the held-out week reverses which model wins — and the honest forward fold shows no difference at all.
---

Leave-one-out cross-validation is one of the default model comparison tools in Bayesian workflow, and for a lot of problems it's exactly right. For a marketing mix model fit to weekly data, it is quietly wrong in a way that systematically misleads you about which model is better.

Here's the short version: row-wise LOO on a time series doesn't actually hold the future out. It holds one week out while keeping every other week in — including the weeks immediately after it. If your baseline component learns from neighboring observations (and most flexible baselines do), the "held-out" prediction is being informed by data that a real forecaster would never have. You end up grading the model on a task it can't fail, and calling that model comparison.

## The mechanism

Say you're choosing between two baseline specifications:

- A **parametric baseline** — intercept plus linear trend plus seasonal harmonics, estimated from all 156 weeks simultaneously.
- A **local-level baseline** — a weekly random walk that can adapt to the data at each step.

Both have legitimate uses. But they interact with LOO in very different ways.

The parametric baseline fits a global function. Removing week 78 from the likelihood barely changes its estimate of the trend or the annual cycle — all the other weeks pin those global parameters. Its LOO prediction for week 78 is close to what it would have forecast cold.

The local-level baseline is different. At week 78, its estimate is almost entirely determined by weeks 77 and 79. When you drop week 78 from row-wise LOO, the training set still contains week 79. The model at week 78 is doing interpolation, not forecasting. It has access to data a forecaster would never hold.

The result: row-wise LOO flatters the flexible model relative to the parametric one, not because it fits better, but because it cheats less obviously.

## The simulation

I ran this on a controlled simulation: 156 weekly observations with three media channels through geometric adstock and a Hill saturation curve, an AR(1) residual with autocorrelation 0.6, and heteroskedastic noise on fifteen promotional weeks. Both candidate models are linear in their parameters with Gaussian priors, so every posterior is closed-form — no sampler involved, no importance sampling required. The only thing that varies across the rows in the table below is which weeks are available for training.

| Fold | Training weeks | Local-level elpd | Parametric elpd | Δelpd | SE | z |
|---|---|---|---|---|---|---|
| Leave-one-out (row-wise) | 155 | 49.9 | 58.6 | **+8.8** | 5.1 | +1.73 |
| Leave-3-out block | 153 | 65.8 | 64.1 | **−1.7** | 4.1 | −0.41 |
| Leave-5-out block | 151 | 73.1 | 66.4 | **−6.7** | 3.8 | −1.74 |
| Leave-future-out (1 step) | 52 to 103 | 58.2 | 57.7 | **−0.5** | 7.9 | −0.06 |

Δelpd is local-level minus parametric, so positive numbers favor the flexible baseline. Read the first row: row-wise LOO puts the local-level model ahead by 8.8 nats with a standard error of 5.1. The kind of gap that gets written into a slide deck as "the state-space specification fits materially better."

Now read the second row. Leave-3-out block drops the held-out week *and its two immediate neighbors* from the training set. The training set shrinks from 155 weeks to 153 — two observations out of 155. That is the only change. The verdict goes from +8.8 to −1.7 and changes sign. Nothing about the model, the data, or the scored weeks moved.

The honest forward fold — train on the first 52 weeks, forecast the next 52, roll forward — puts them 0.5 nats apart with a standard error of 7.9. That's nothing.

I repeated this across 20 independent simulated worlds. Row-wise LOO favored the local-level model in 12 of the 20 and the forward fold favored it in 4. The two schemes disagreed about the winner in 10 of 20. The bias in LOO was consistent in direction across all 20 worlds — it inflated the local-level model's apparent advantage by a median of 2.2 nats and never by less than 0.4 nats. A shift that keeps its sign across 20 worlds is a bias, and it points at the flexible model every time.

## Two hierarchies, two wrong folds

A geo MMM makes this worse because there are two hierarchies, not one.

Along the time axis, row-wise LOO is wrong for the reason above — it answers "can you interpolate a hole in a series you already have," not "can you forecast forward."

Along the geography axis, the question a per-geo model actually makes is whether partial pooling across markets is real — whether the model would have got a held-out market right from the others. That question requires leaving an entire DMA out of the training set and checking the out-of-sample prediction. Row-wise LOO on a geo panel drops one geo-week cell and keeps the same week in every other market and the same DMA in 155 other weeks. It answers neither the temporal nor the geographic question. It answers a third question — "can you interpolate a missing cell in a panel you already have" — which is not a question you'd pay a model to answer in production.

The correct folds for an MMM:

- **Temporal**: rolling origins — train on weeks $[0, T)$, forecast $[T, T + h)$, roll $T$ forward. The [`mmm-framework`](https://github.com/redam94/mmm-framework) implements this in `validation/backtest.py` as `rolling_origins` and `run_backtest`.
- **Geographic**: leave-one-group-out — hold out one DMA entirely and predict it from the rest.

These answer different business questions (next-quarter accuracy vs. market generalizability) and neither is approximated by row-wise LOO.

## What to do instead

If you're using ArviZ and already have LOO computed, `loo_pit` calibration plots and Pareto-$k$ values are still useful diagnostics even when the headline elpd is misleading — they identify which observations the model struggles with, which is real information. The scalar you're tempted to put in a table is the part to be skeptical of.

For model comparison proper:

```python
# Rolling-origin backtest — what's already in mmm-framework
# validation/backtest.py: rolling_origins / run_backtest
results = run_backtest(
    model=mmm,
    data=mff,
    cutoffs=range(52, 130, 4),   # train on [0, cutoff), forecast [cutoff, cutoff+4)
    horizon=4,
)
# Grade on CRPS or log-score on the held-out windows, not elpd_loo
```

The forward fold requires actual refits at each cutoff, which is slower than importance-sampling LOO. That's the honest cost. The alternative is a fast number that consistently picks the wrong model.

Row-wise LOO is not wrong in principle — it's wrong for the specific structure of a weekly time-series model. The fold has to match the inferential goal, and the inferential goal for an MMM is almost always "how does this model do in a quarter it has never seen," not "how does it patch gaps in data it has already absorbed."

---

_Grounded in research from the [`mmm-framework`](https://github.com/redam94/mmm-framework) docs, specifically `blog-loo-is-the-wrong-cv`. The simulation design follows `synth/dgp.py` and the backtest tooling lives in `validation/backtest.py`. Related: Bürkner, Gabry, and Vehtari (2020), "Approximate leave-future-out cross-validation for Bayesian time series models"; Gelman et al., Bayesian Workflow §6.3 on cross-validation for hierarchical models. Related posts: [Read the Diagnostics First](/posts/read-the-diagnostics-first/), [Simulation-Based Calibration](/posts/simulation-based-calibration/)._
