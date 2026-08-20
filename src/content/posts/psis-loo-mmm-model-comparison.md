---
title: "Comparing MMM Specifications Without Fishing: PSIS-LOO in Practice"
author: Matthew Reda
pubDatetime: 2026-08-20T13:23:07Z
slug: psis-loo-mmm-model-comparison
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - pymc
description: Leave-one-out cross-validation gives you a principled way to compare competing MMM specifications — but only if you use it to validate, not to shop.
---

You've pre-specified two MMM structures — picked priors, transforms, and likelihood before fitting, per the [pre-specification discipline](/posts/building-a-pre-specified-bayesian-mmm/). One uses geometric adstock with a Beta(2, 3) prior on the retention rate; the other uses a Weibull adstock form that lets the carryover peak after the exposure week before decaying. Both pass [SBC](/posts/simulation-based-calibration/). Both show healthy $\hat{R}$, ESS, and zero divergences. Both fit the training data plausibly. Which one do you use?

This is the model comparison problem, and it comes up constantly. The naive answer — compare in-sample $R^2$ or RMSE — fails immediately: any sufficiently flexible model wins, and a better fit to training data says nothing about whether the model is capturing the right mechanism. AIC and BIC are better, but they're derived under asymptotic assumptions that don't hold well for the nonlinear, weakly-identified transforms in a typical MMM. You need something that asks the right question: which model predicts new data better?

That tool is leave-one-out cross-validation. The ArviZ implementation — PSIS-LOO — makes it fast enough to be practical without refitting the model $T$ times.

## The right quantity: ELPD

The formal quantity is the **expected log predictive density (ELPD)**:

$$\text{ELPD} = \sum_{t=1}^{T} \log p(y_t \mid y_{-t})$$

where $p(y_t \mid y_{-t})$ is the posterior predictive density for observation $t$ under a model fit on everything _except_ observation $t$. Higher ELPD is better: the model assigned higher probability to what actually happened, when it didn't already know the answer.

Actually leaving one observation out and refitting — 104 times for a two-year weekly dataset — is computationally brutal. PSIS-LOO approximates each $p(y_t \mid y_{-t})$ from a single full-data posterior using importance sampling.

## PSIS-LOO: the shortcut and its diagnostic

The idea: for each observation $t$, the importance weight for draw $s$ is

$$w_t^{(s)} \propto \frac{1}{p(y_t \mid \theta^{(s)})}$$

— the reciprocal of the likelihood contribution that observation makes. Averaging the posterior predictive density weighted by $w_t^{(s)}$ approximates the leave-one-out density without refitting. Raw importance weights can blow up when a single observation is highly influential, so **Pareto-smoothed importance sampling** (PSIS) fits a generalized Pareto distribution to the largest weights and uses it to stabilize them.

The key diagnostic is the **Pareto-k value** for each observation — the fitted Pareto shape parameter:

- $k < 0.5$: approximation is reliable
- $0.5 \leq k < 0.7$: proceed carefully
- $k \geq 0.7$: approximation is unreliable; that observation is too influential

In ArviZ, this is straightforward:

```python
import arviz as az

# After fitting model_a and model_b with mmm-framework
loo_a = az.loo(trace_a, pointwise=True)
loo_b = az.loo(trace_b, pointwise=True)

# Check Pareto-k for influential observations
az.plot_khat(loo_a.pareto_k)

# Compare the two specifications
comparison = az.compare({"geometric_adstock": trace_a, "weibull_adstock": trace_b})
print(comparison)
# Key columns: elpd_loo, p_loo, elpd_diff, dse, warning
```

The column that matters most is `dse` — the standard error on the ELPD _difference_. A difference of 4 ELPD points with a `dse` of 8 is not a meaningful win. If the two models' ELPD estimates overlap within about two standard errors, the data can't distinguish them.

A cluster of observations with $k > 0.7$ is worth investigating independently: those are weeks the model finds unusually surprising given everything else. In an MMM this often means an event (a large promotion, a competitor launch, a data quality issue) that the model has no covariate to explain. That's a data problem, and fixing it usually helps both models.

## The time series problem

Standard LOO assumes the observations are approximately exchangeable — that predicting $y_t$ from $y_{-t}$ is a meaningful question. In a time series with adstock carryover, it isn't. Leaving out week 50 and predicting it from weeks 1–49 _and_ weeks 51–104 lets the model interpolate across the gap using future data, which is a much easier task than actual out-of-sample prediction.

Two approaches that are more honest for sequential MMM data:

**Block leave-out**: Leave out contiguous blocks of $L$ weeks rather than individual observations. This prevents the model from exploiting adstock carryover from adjacent weeks to fill the gap. A block of $L = 4$ to $L = 8$ weeks is large enough that the model has to genuinely predict rather than interpolate, while still giving enough blocks for a meaningful ELPD estimate.

**Forward-only holdout**: Hold out the most recent $H$ periods entirely and fit on everything before them. This matches the actual deployment problem — the model predicts the future, not a past gap — and there's no risk of data leakage from adjacent observations. The tradeoff is that you get one holdout-period ELPD estimate rather than $T$ pointwise ones, so the uncertainty on the comparison is higher.

In the `mmm-framework` workflow I use forward-only holdout as the primary check: split at the last 13 weeks, fit on the preceding data, measure log predictive density on the holdout. PSIS-LOO on the full series supplements it when I need more statistical power to separate two closely-matched specifications.

## Validate, don't shop

This is the most important rule about LOO in a pre-specified workflow: **use it to validate the pre-specified model, not to select between specifications you're fishing through**.

If you fit 12 adstock variants and keep the one with the highest ELPD, you've done specification shopping with extra steps. The comparison has been contaminated by selection — you've used the holdout data to choose the model, so it's no longer an honest holdout. The reported ELPD is now optimistic by an amount proportional to the number of models you tried.

LOO belongs at a specific step: after SBC (check that the inference is calibrated) and before experimental calibration (check the external lift tests). Its job is to answer one question: is this pre-specified model meaningfully better at predicting held-out observations than the baseline (trend + seasonality + controls, no media terms)? If yes, the media transforms are adding predictive signal. If not, the media effects are either too small to detect observationally, or the transforms are misspecified in a way that hurts prediction.

Comparing two pre-specified specifications is also legitimate — _if_ you committed to reporting whichever wins before looking at the comparison. The commitment is what keeps it honest.

## What LOO doesn't resolve

A better LOO score doesn't mean the model is capturing the right mechanism. As I covered in [adstock and saturation are not separately identified](/posts/adstock-saturation-identification/), two models can make essentially identical predictions in the observed spend range while implying opposite media strategies. The Weibull adstock model might out-predict the geometric one slightly while both models remain ambiguous about whether the carryover peaks at week 1 or week 3. LOO measures predictive accuracy; it doesn't resolve the identification problem.

So LOO is necessary but not sufficient, in the same way the MCMC diagnostics are. $\hat{R}$ and ESS tell you the sampler is valid; SBC tells you the inference recovers parameters; LOO tells you the model predicts. All three can pass while the model's structural assumptions — which channels are independent, whether saturation is concave or S-shaped, how fast adstock decays — are wrong in ways that only experimental calibration will reveal.

The sequence: write the model → prior predictive check → SBC → **LOO validation against baseline** → fit on real data → MCMC diagnostics → posterior predictive check → experimental calibration. LOO is one step, not the answer.

## When the models look equivalent

Often LOO tells you two specifications predict about the same. This happens when:

- The observed spend range doesn't expose the region where the two adstock forms diverge
- The holdout window is short enough that one quarter of data isn't statistically decisive
- The two transforms make effectively the same predictions at typical spend levels even though they'd differ at extrapolation

Equivalent LOO scores aren't a failure. They're the data saying it can't distinguish the two specifications in the predictive domain. The honest response is to report both posteriors, note that predictions agree, and document that the structural choice is uncertain. If the business decision is about budget levels within the observed range, that uncertainty may not matter. If the decision involves extrapolating to spend levels outside the data, it matters a great deal — and you should say so.

## Takeaway

PSIS-LOO is the predictive validation step that fits between SBC and experimental calibration. `az.loo()` gives you pointwise ELPD and Pareto-k; `az.compare()` gives you the inter-model comparison with standard errors. For time-series MMMs, use block leave-out or a proper forward holdout rather than observation-by-observation LOO. Check the Pareto-k values — a cluster above 0.7 points at problematic weeks worth investigating.

And use it to validate, not to shop. The discipline of pre-specifying the model is what makes the comparison honest; the comparison doesn't substitute for the discipline.

---

_LOO-CV and PSIS are introduced in Vehtari, Gelman & Gabry (2017), "Practical Bayesian model evaluation using leave-one-out cross-validation and WAIC," Statistics and Computing 27(5). ArviZ's `az.loo()` and `az.compare()` implement PSIS-LOO. Related: [Simulation-Based Calibration](/posts/simulation-based-calibration/) (the pre-fit check that complements LOO), [Read the Diagnostics First](/posts/read-the-diagnostics-first/), [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/)._
