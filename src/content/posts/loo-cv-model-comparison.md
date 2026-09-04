---
title: "Comparing Model Structures With LOO-CV: The Difference Has a Standard Error"
author: Matthew Reda
pubDatetime: 2026-09-04T13:22:39Z
slug: loo-cv-model-comparison
draft: true
tags:
  - bayesian
  - statistics
  - marketing-mix-modeling
  - model-comparison
description: When you compare two Bayesian MMM structures using LOO-CV, the ELPD difference comes with a standard error — and if you ignore it, you're doing the same thing as calling p=0.06 a failure and p=0.04 a success.
---

Every marketing mix model involves structural choices before you ever see the data: geometric or Weibull adstock, Hill or logistic saturation, whether to include a lagged DMA-level price index as a control. These aren't knobs you tweak until the coefficients look plausible — or they shouldn't be. But even a properly pre-specified model requires that you choose a structure somewhere upstream, and at some point someone asks: how do you know which structure is better?

The right answer involves out-of-sample predictive accuracy. The wrong answer — which is what most people use — is in-sample fit. This post is about the right answer, specifically about `az.compare()` in ArviZ, and about a detail people almost always skip: **the ELPD difference between two models has a standard error, and it needs to be reported**.

## In-sample fit is useless for this

Adding parameters always helps in-sample. A Hill saturation curve with two shape parameters fits better than a concave logistic with one, on the same data, essentially by construction — it has more freedom to conform to what happened. AIC and BIC apply a penalty for parameters, but those penalties are derived under assumptions (large $n$, linear models, flat priors) that hold poorly for the short time series and informative priors in most MMMs.

What you actually want to know is: if I trained this model on 90% of the data and predicted the remaining 10%, which structure would make better predictions? That's the question LOO-CV answers, and it answers it without actually requiring you to do the expensive fit 10 separate times.

## What ELPD measures

Leave-one-out cross-validation evaluates each data point in turn as a held-out test: fit on everything else, score the held-out point under the posterior predictive. The quantity you sum up is the **expected log predictive density** (ELPD):

$$\text{ELPD} = \sum_{i=1}^{n} \log p(y_i \mid y_{-i})$$

where $p(y_i \mid y_{-i})$ is the posterior predictive density for observation $i$ given all the other observations. Higher is better; a model that assigns higher probability to each held-out point is a model that generalizes better.

Running LOO naively — actually refitting $n$ times — is prohibitively expensive for a weekly MMM with 3 years of data. ArviZ implements **Pareto-smoothed importance sampling LOO** (PSIS-LOO, from Vehtari, Gelman & Gabry 2017), which approximates the leave-one-out predictive density from a single fit by reweighting the posterior samples. It's cheap and accurate when the Pareto shape parameter $\hat{k}$ stays below 0.7; points with $\hat{k} > 0.7$ are flagged because the importance weights don't concentrate well and the approximation degrades. High-$\hat{k}$ observations are usually outliers or high-leverage points — themselves worth investigating on their own terms.

## Running the comparison

In PyMC + ArviZ, comparing two structural variants looks like this:

```python
import pymc as pm
import arviz as az

# Fit two model variants, produce InferenceData objects
with mmm_hill_saturation(data) as m1:
    trace_hill = pm.sample(1000, tune=1000, target_accept=0.9, idata_kwargs={"log_likelihood": True})

with mmm_logistic_saturation(data) as m2:
    trace_logistic = pm.sample(1000, tune=1000, target_accept=0.9, idata_kwargs={"log_likelihood": True})

# Compute LOO for each
loo_hill     = az.loo(trace_hill,     pointwise=True)
loo_logistic = az.loo(trace_logistic, pointwise=True)

# Compare
comparison = az.compare({"hill": trace_hill, "logistic": trace_logistic})
print(comparison)
```

The output DataFrame from `az.compare()` includes `elpd_loo`, `se`, and — the one most people ignore — `dse`, the standard error of the _difference_ between each model's ELPD and the best model's ELPD. It looks like:

```
              rank  elpd_loo    se   delpd    dse  warning
hill             0    -412.3  14.2     0.0    0.0    False
logistic         1    -415.1  14.5     2.8    3.6    False
```

The ELPD difference is 2.8. The SE on that difference is 3.6. These two models are statistically indistinguishable on predictive accuracy, and calling one "better" would be the same mistake as treating a p-value of 0.051 as categorically different from one of 0.049.

## Why the SE on the difference matters

The ELPD values themselves have standard errors because they're sums over $n$ independent leave-one-out scores, each with its own variance. The SE on the _difference_ is computed from the pointwise differences — $\text{ELPD}_i^{(1)} - \text{ELPD}_i^{(2)}$ — which properly accounts for the fact that the two models are evaluated on the same data points and are therefore correlated. The formula is:

$$\text{SE}(\Delta\text{ELPD}) = \sqrt{n \cdot \text{Var}\!\left(\text{elpd}_i^{(1)} - \text{elpd}_i^{(2)}\right)}$$

A conventional threshold: if $|\Delta\text{ELPD}| < 2 \cdot \text{SE}(\Delta\text{ELPD})$, the models are within noise and you shouldn't claim one is better. If the gap is large and clearly outside 2 SE, the better-predicting model has a genuine edge.

In practice, with a typical 2–3 year weekly MMM on national data, $n \approx 100$–$160$. You don't have a lot of observations to work with, and ELPD differences of 5–10 points are often within the noise. The structure comparison is genuinely hard with short series, which is exactly why SBC — testing whether the structure recovers parameters under simulation — matters alongside LOO-CV. ([Simulation-Based Calibration](/posts/simulation-based-calibration/) and LOO-CV are complements, not substitutes: SBC checks whether your inference is correct; LOO-CV checks whether your predictions generalize.)

## What LOO-CV cannot tell you

A model that predicts sales better is not necessarily the model with the correct ROAS. These are different things.

An overfit or badly-identified model can have good predictive accuracy in-sample and reasonable LOO accuracy if the misidentification is consistent — for instance, if a confounded variable predicts sales well across the board even though it's picking up a third factor neither you nor the model can see. The [Table 2 fallacy in MMMs](/posts/table-2-fallacy-in-mmm/) is a case in point: a model that keeps an endogenous variable in as a predictor might predict sales better (the variable is correlated with sales!) while also misattributing the effect.

LOO-CV is a predictive criterion. It optimizes generalization, not identification. The causal interpretation of your channel coefficients still requires the identification argument — the assumptions about what you controlled for, what path is open, what is exchangeable. LOO-CV can tell you "these two structures generalize equally well"; it cannot tell you which one is estimating the causal effect you care about. For that, you still need [holdout validation against experiments](/posts/closing-the-loop-mmm-calibration/).

## How to use this in practice

The workflow I've landed on:

1. **Pre-specify candidate structures.** Declare two or three plausible model families before fitting — different adstock forms, different saturation functions — based on prior reasoning, not on peeking at the coefficients. This is the same pre-specification discipline as [building a properly-specified MMM](/posts/building-a-pre-specified-bayesian-mmm/), applied to the structure selection step.

2. **Fit each, compute LOO.** Use `idata_kwargs={"log_likelihood": True}` in `pm.sample()` so the log likelihood is saved in the InferenceData object. Check the $\hat{k}$ diagnostics — any flags above 0.7 deserve investigation. If many points flag, PSIS-LOO is unreliable and you should either use moment matching or refit with actual LOO for the flagged observations.

3. **Report the SE.** When reporting which structure you selected, show the ELPD difference and its SE. If it's within 2 SE, say the models are equivalent on predictive grounds and you selected based on other criteria (interpretability, computational cost, prior domain knowledge). Don't dress up noise as a finding.

4. **Validate against experiments.** LOO-CV picks the structure that generalizes best. Experiment holdout validates that the coefficients mean what you think they mean. Both checks are necessary; neither substitutes for the other.

The comparison tool is genuinely useful. It catches obvious failures — a model that severely overfits, a structural assumption that misses a systematic pattern — and it keeps you from selling a structural choice as principled when it was actually just eyeballing coefficients. But the uncertainty on the comparison is part of the result, not an afterthought. If you're reporting a 3-point ELPD gap without its standard error, you're not reporting a comparison — you're reporting a number that looks like one.

---

_LOO-CV and the PSIS approximation are described in Vehtari, Gelman & Gabry (2017), "Practical Bayesian model evaluation using leave-one-out cross-validation and WAIC," \_Statistics and Computing_ 27(5). ArviZ's `az.compare()` and `az.loo()` implement this; see [the ArviZ docs](https://python.arviz.org/en/stable/api/generated/arviz.compare.html) for the full API. Related posts: [Simulation-Based Calibration](/posts/simulation-based-calibration/) on checking inference correctness, [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/) on pre-specifying structure before fitting, and [Wiring Your MMM to Experiments](/posts/closing-the-loop-mmm-calibration/) on validating coefficients against holdout data.\_
