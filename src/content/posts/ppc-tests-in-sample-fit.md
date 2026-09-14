---
title: "Posterior Predictive Checks Test In-Sample Fit — Not Predictive Performance"
author: Matthew Reda
pubDatetime: 2026-09-14T13:16:57Z
slug: ppc-tests-in-sample-fit
draft: true
tags:
  - bayesian
  - statistics
  - marketing-mix-modeling
  - regression
description: Passing every posterior predictive check is necessary but not sufficient. Here's what PPCs actually measure, why a flexible model can ace them and still fail at predicting the future, and the complementary test that covers the gap.
---

In a [recent post on simulation-based calibration](/posts/simulation-based-calibration/), I described the specific property SBC tests: whether the posterior recovers the truth in expectation across repeated simulated datasets. PPCs and SBC are both part of a healthy Bayesian workflow, and they're often mentioned in the same breath. But they're testing different things at different stages, and one of those things is more limited than people usually realize.

PPCs are in-sample tests. If you understand that sentence fully, the rest of this post is a footnote. If it sounds familiar but vague, read on.

## What PPCs test

The posterior predictive check works by drawing from the **posterior predictive distribution**:

$$y^{\text{rep}} \sim p(y^{\text{rep}} \mid y) = \int p(y^{\text{rep}} \mid \theta) \, p(\theta \mid y) \, d\theta$$

You draw parameter values from the posterior — the distribution conditioned on your observed data — and then simulate new data from the likelihood at those parameter values. You compare $y^{\text{rep}}$ to $y$ on some test statistic: the mean, variance, maximum, autocorrelation, whatever features of the data you care about.

The key phrase is "conditioned on your observed data." The posterior has already seen your data. Every draw from $p(\theta \mid y)$ is a parameter value that is, in some sense, compatible with the data you have. When $y^{\text{rep}}$ looks like $y$, all you've learned is that the model can regenerate data similar to what it was trained on. That's a real and useful check — model misspecification often produces $y^{\text{rep}}$ distributions that look nothing like $y$ — but it isn't a test of predictive performance.

## The overfitted trend

Here is the clearest example of the gap. An MMM with a very flexible trend component — a spline with many knots, or a Gaussian process with a short lengthscale — can fit historical sales almost exactly. The posterior predictive replicas are tight around the observed values. Every test statistic passes: mean, seasonal pattern, autocorrelation. All fine.

Now ask the model to forecast next quarter. The flexible trend it identified was partly overfitting to idiosyncratic noise in the historical period. Forecasts go off the rails — not because the sampler failed or the priors were uninformative, but because the model memorized rather than learned.

PPCs won't catch this. They're not designed to. They ask "does the model reproduce the data it was fit on?" The question you actually want answered — "how would this model have performed if you'd fit it two quarters ago and predicted forward?" — requires holding out future data.

## Forward-chaining cross-validation

The right complement to PPCs in a time series is **forward-chaining CV** (also called expanding-window or walk-forward validation). Instead of sampling $y^{\text{rep}}$ from the posterior trained on all the data, you:

1. Fit the model on $y_{1:T_0}$.
2. Predict $y_{T_0+1}, \ldots, y_{T_0+h}$.
3. Observe the actual values and compute a scoring rule — commonly expected log predictive density (ELPD) or RMSE.
4. Advance the window: fit on $y_{1:T_0+1}$, predict $y_{T_0+2}, \ldots, y_{T_0+h+1}$. Repeat.

The result is a held-out predictive accuracy score that reflects how well the model generalizes to future data, not how well it recapitulates the past.

This is also distinct from leave-one-out CV as ArviZ computes it via PSIS-LOO. PSIS-LOO approximates the predictive accuracy of leaving out _one observation at a time_ from the full dataset. In i.i.d. settings that's a useful proxy for out-of-sample performance. In a time series it isn't — adjacent observations are correlated, and a model trained on everything except $y_t$ can interpolate from $y_{t-1}$ and $y_{t+1}$ in a way that a genuine forecasting exercise can't.

```python
import arviz as az

# Fine for cross-sectional data. For time series, the LOO-per-observation
# framing lets the model interpolate rather than extrapolate.
loo_result = az.loo(trace, model)
# A Pareto k̂ > 0.7 flags observations too influential to leave out one at
# a time — but even clean k̂ values don't resolve the temporal correlation issue.
# For MMMs: compute rolling-window ELPD instead.
```

A Pareto $\hat{k} > 0.7$ is worth fixing, but fixing it doesn't give you a time-series-valid predictive score. The temporal structure requires a different approach.

## How this connects to the MMM workflow

The [gap-by-gap post](/posts/gap-by-gap-bayesian-updating/) describes the continuous-learning loop: fit the model through week $T-1$, predict week $T$, update with the observation. That prediction step _is_ forward-chaining CV, operationalized. Each gap produces a one-step-ahead forecast before the observation is incorporated, and the error on that forecast is the thing to monitor.

The post flags a specific diagnostic: if "recent periods are consistently off," parameters have drifted and the drift covariance $Q$ is too small. That's exactly forward-CV catching something that PPCs can't. The PPC uses the full posterior, including two years of historical data, to generate replicas — of course they look plausible. The gap-update prediction uses only the information available before week $T$, and its error is a clean signal of model health going forward.

In the `mmm-framework` continuous-learning framework, this distinction is built in. The gap update produces a prediction before the observation arrives; the in-sample fit produces replicas after. Both are computed, and both are useful for different purposes.

## What to do in practice

The full validation workflow, layered:

1. **PPCs as specification check.** If the model can't reproduce basic features of the observed data — distribution shape, seasonal pattern, autocorrelation — it's misspecified in ways that will get worse out-of-sample. Fix this first.

2. **SBC as calibration check.** If the rank histograms are non-uniform, your credible intervals are wrong regardless of what the PPCs showed. ([Detailed in the SBC post.](/posts/simulation-based-calibration/))

3. **Forward-chaining ELPD as predictive performance check.** Hold out the last $k$ periods, fit on the earlier data, score predictions against the holdout. Use rolling windows if you have the compute budget and want a distribution of scores across time.

4. **Watch the gap between fit and forecast.** An in-sample $R^2$ of 0.97 with a one-step-ahead RMSE that implies 15% forecast error is a model that memorized the past. The ratio is the signal.

PPCs catch real problems and you should run them. But they are the beginning of a validation workflow, not the end. The model that passes PPCs and fails forward-CV isn't validated — it's a model that learned the past and extracted the wrong lessons from it.

---

_Related: [Simulation-Based Calibration](/posts/simulation-based-calibration/) on testing whether the posterior recovers the truth under simulation. [Read the Diagnostics First](/posts/read-the-diagnostics-first/) on MCMC convergence checks. [The Gap-by-Gap Update](/posts/gap-by-gap-bayesian-updating/) on forward-CV in the continuous-learning loop. The `mmm-framework` gap update implements forward-CV prediction scoring natively._
