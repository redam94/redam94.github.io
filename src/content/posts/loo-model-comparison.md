---
title: "LOO-CV Is How You Tell Whether Your MMM Specification Is Actually Better"
author: Matthew Reda
pubDatetime: 2026-09-08T13:19:33Z
slug: loo-model-comparison
draft: true
tags:
  - bayesian
  - statistics
  - marketing-mix-modeling
  - model-comparison
description: SBC tells you if your inference is correct; LOO cross-validation tells you if your model is predictively better. Here's how PSIS-LOO works, when it breaks, and how to use it to choose between competing MMM specifications.
---

At some point in any serious MMM project, you face a model comparison problem. Do you include brand equity as a control or leave it out? Does a Weibull adstock fit better than geometric? Is the saturation function a Hill curve or a log-linear? You have two (or five) candidate specifications and you need to say which one to use. How?

R-hat and ESS don't help — they tell you about convergence, not about which fitted model better describes the data. In-sample fit is worse: a more complex model almost always fits better in-sample, which is why adding parameters is not a method of model selection. The honest answer is out-of-sample predictive accuracy — how well does the model predict data it wasn't fit to?

Leave-one-out cross-validation (LOO-CV) is the principled operationalization of that idea in the Bayesian setting. The computational breakthrough that makes it practical is **Pareto-smoothed importance sampling** (PSIS-LOO), developed by Vehtari, Gelman, and Gabry. It's the model comparison tool I reach for in the `mmm-framework` workflow, and it belongs right after you've confirmed (via [SBC](/posts/simulation-based-calibration/)) that your candidate models are correctly calibrated.

## What LOO-CV measures

The quantity LOO-CV estimates is the **expected log pointwise predictive density** (ELPD):

$$\text{ELPD}_{\text{LOO}} = \sum_{i=1}^{n} \log p(y_i \mid y_{-i})$$

For each observation $y_i$, you compute the log probability of that observation under the posterior fitted to all the *other* data $y_{-i}$. Sum over all observations. A higher ELPD means better predictive accuracy — the model assigns higher probability to each held-out point, on average.

This is the right quantity because it measures *generalization*. It penalizes overfitting automatically: a model that memorized observation $i$ will have a very tight posterior over $y_i$ when it's included in the fit, but that overfit posterior will be overconfident in the wrong direction when $y_i$ is held out.

The naive implementation is also the expensive one: fit the model $n$ times, each time leaving one observation out. For a weekly MMM with two years of data — 104 observations — that's 104 full MCMC runs. Not practical.

## PSIS-LOO: the approximation that makes it fast

The trick is to approximate $p(y_i \mid y_{-i})$ using importance sampling on the existing full-data posterior draws, without any additional sampling.

The exact LOO posterior at point $i$ is proportional to the full posterior with the $i$-th likelihood factor removed:

$$p(\theta \mid y_{-i}) \propto p(\theta \mid y) \cdot \frac{1}{p(y_i \mid \theta)}$$

So each draw $\theta^{(s)}$ from the full posterior gets a raw importance weight $w_i^{(s)} = 1/p(y_i \mid \theta^{(s)})$, and the LOO predictive density is approximated by the weighted average:

$$p(y_i \mid y_{-i}) \approx \left(\frac{1}{S} \sum_{s=1}^S w_i^{(s)}\right)^{-1}$$

The problem with raw importance sampling is that the weights can have infinite variance when $p(y_i \mid \theta)$ is occasionally very small — the usual importance sampling catastrophe. PSIS fixes this by fitting a **generalized Pareto distribution** to the upper tail of the raw weights and using that fit to smooth and cap the extreme ones. This is both a stabilization and a diagnostic, because the Pareto shape parameter $\hat{k}$ tells you whether the smoothing was enough.

## The $\hat{k}$ diagnostic

The Pareto shape parameter $\hat{k}$ for observation $i$ is the key reliability indicator. The rule of thumb from Vehtari et al.:

| $\hat{k}$ | Reliability |
|---|---|
| $< 0.5$ | LOO estimate for this point is reliable |
| $0.5 – 0.7$ | Moderately reliable; use with some caution |
| $0.7 – 1.0$ | Unreliable; the observation is influential |
| $> 1.0$ | Very unreliable; refit without that point |

High $\hat{k}$ values flag **influential observations** — data points that individually have a large effect on the posterior. In a weekly MMM this usually means either (1) a seasonal spike the model didn't anticipate, (2) a promotional period with unusual spend levels, or (3) a media flight during a week with a major external shock. All three are worth investigating on their own terms, independently of which model wins.

In ArviZ, the whole workflow is two lines:

```python
import arviz as az

# Fit your model (PyMC example)
with mmm_model_a:
    trace_a = pm.sample(2000, tune=2000)
    trace_a = pm.compute_log_likelihood(trace_a)

loo_a = az.loo(trace_a, pointwise=True)
print(loo_a)
# loo    -312.4
# p_loo    18.3    # effective number of parameters
# n_samples  4000
# n_data_points  104
# warning   False
# loo_scale  log

# Any high k-hats?
az.plot_khat(loo_a)
```

The `p_loo` field is worth noticing: it's the LOO estimate of the effective number of parameters, analogous to the penalty term in AIC. A `p_loo` that's much larger than the nominal parameter count suggests the model is overfitting — some parameters are absorbing observation-specific noise rather than learning population-level structure.

## Comparing two MMM specifications

Here's where it gets useful. To compare model A (say, geometric adstock + Hill saturation) against model B (Weibull adstock + Hill saturation), you compute LOO for each and look at the difference in ELPD:

```python
# Fit both models, compute log likelihoods
with mmm_model_a:
    trace_a = pm.sample(2000, tune=2000)
    trace_a = pm.compute_log_likelihood(trace_a)

with mmm_model_b:
    trace_b = pm.sample(2000, tune=2000)
    trace_b = pm.compute_log_likelihood(trace_b)

loo_a = az.loo(trace_a)
loo_b = az.loo(trace_b)

comparison = az.compare({"geometric_adstock": loo_a, "weibull_adstock": loo_b})
print(comparison)
```

The comparison table shows the ELPD difference and its standard error. This is the key part: the standard error on the comparison accounts for the fact that both estimates share the same data points, and takes the per-point correlation into account. A difference of 4 ELPD units with a standard error of 6 is not a meaningful difference. A difference of 12 with a standard error of 3 is.

The rough rule I use: if the ELPD difference is more than 4 times its standard error ($\Delta \text{ELPD} / \text{SE} > 4$), the better model is meaningfully preferred. Below that threshold, treat the two models as equivalent from a predictive standpoint and prefer the simpler one.

## The time-series caveat

LOO-CV in its standard form assumes observations are exchangeable — leaving out observation $i$ doesn't create an information gap that breaks the model. For i.i.d. data, this is fine. For a time series, it isn't: leaving out week 30 while keeping weeks 29 and 31 is a form of interpolation, not a test of generalization.

What you actually want for a time series is **block holdout**: leave out a contiguous block of recent weeks — say, the last 8 or 12 weeks — fit the model on the remainder, and evaluate predictive accuracy on the held-out block. This is a true out-of-sample test that respects the temporal structure.

PSIS-LOO is still useful in the time series setting as a *relative* comparison across model specifications, even if the absolute ELPD values aren't externally interpretable. Two models evaluated on the same data with the same LOO approximation will have the same bias, so the difference in ELPD is still informative about which specification is better at that margin. But for the absolute question — "is this model good enough to use?" — block holdout on the most recent period is the more honest test.

In the `mmm-framework` workflow, I use both: PSIS-LOO for fast comparison across specifications during iteration, and a block holdout of the last quarter as a final sanity check before committing to a specification. The last quarter is especially useful because it's the most like the future you're actually forecasting into.

## What LOO doesn't tell you

LOO measures predictive accuracy for the outcome variable you modeled. It does not measure whether the channel attributions are correct.

A model that fits weekly revenue beautifully can still have wrong channel coefficients — because collinearity, measurement error, and the adstock-saturation ridge ([covered here](/posts/adstock-saturation-identification/)) all affect attribution without necessarily degrading aggregate prediction. LOO will not catch that. That's what [SBC](/posts/simulation-based-calibration/) is for: checking whether the inference procedure recovers parameters correctly, independent of how the model fits observed data.

The two tools answer different questions:
- **SBC**: Does this model architecture recover the right parameters when data are generated from it?
- **LOO**: Does this model specification predict the data better than that one?

You need both. A model can pass LOO but fail SBC (good in-sample prediction, wrong attribution structure). And a model can pass SBC but be predictively dominated by a simpler one (correctly calibrated but overparameterized). The order in my workflow: SBC first, to confirm the architecture works; LOO after, to choose between competing specifications that are all architecturally sound.

## The comparison is only valid if both models were pre-specified

One last thing that doesn't get said enough: LOO comparison is only meaningful if you committed to both candidate models *before* looking at the LOO scores. If you search over a large space of model variations and report the highest LOO, you've found a predictively good model on this dataset — and you've implicitly overfit to the data in the comparison itself. The effective degrees of freedom include all the specifications you tried, not just the one you reported.

The fix is the same as everywhere else in Bayesian analysis: pre-specify. Define the candidate specifications before you fit anything. Run LOO. Report the comparison. If you iterate based on LOO scores — tweaking a prior here, adding a control there — acknowledge in the report that the final specification was selected from an adaptive search, and treat the final LOO score as optimistic.

This is the same discipline behind the whole [`mmm-framework` pre-specification approach](/posts/building-a-pre-specified-bayesian-mmm/). The framework is pre-specified so that model comparison is a test, not a search. LOO is only honest in the same context.

---

*PSIS-LOO is due to Vehtari, Gelman & Gabry (2017), "Practical Bayesian model evaluation using leave-one-out cross-validation and WAIC," Statistics and Computing 27(5). The ArviZ implementation is at [python.arviz.org](https://python.arviz.org/en/stable/api/generated/arviz.loo.html). Related posts: [Simulation-Based Calibration](/posts/simulation-based-calibration/), [The Assumptions Are the Model](/posts/the-assumptions-are-the-model/), [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/).*
