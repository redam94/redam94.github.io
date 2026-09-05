---
title: "PSIS-LOO: The Predictive Check That Completes Your Bayesian MMM Workflow"
author: Matthew Reda
pubDatetime: 2026-09-05T13:12:37Z
slug: psis-loo-bayesian-mmm
draft: true
tags:
  - bayesian
  - statistics
  - marketing-mix-modeling
  - pymc
description: SBC checks whether your posterior recovers parameters — PSIS-LOO checks whether your model actually predicts. Here's what leave-one-out cross-validation measures, how to run it in ArviZ, and what high Pareto k̂ values are telling you about your MMM.
---

If you've read the posts on [simulation-based calibration](/posts/simulation-based-calibration/) and [R-hat diagnostics](/posts/read-the-diagnostics-first/), you've covered two legs of the Bayesian model evaluation triangle: whether your sampler converged, and whether your inference recovers parameters from simulated data. The third leg — whether your model actually predicts new observations well — is what Pareto-smoothed importance sampling leave-one-out cross-validation (PSIS-LOO) checks. Most MMM practitioners don't run it. They should.

## What SBC and LOO measure, and why they're not the same

SBC asks: if I generate data from my model and then fit the posterior, does the posterior recover the generating parameter? It tests the inference procedure against a known truth. If SBC passes, you know the estimation engine is working.

LOO-CV asks a different question: given what the model has already seen, how surprised is it by each new observation? It tests generalization. A model can pass SBC — correctly recover parameters from its own generated data — and still overfit badly to the observed time series, assigning confident posteriors that predict terribly out-of-sample.

For an MMM specifically, LOO matters because the model will eventually be used to predict the effect of a reallocation that hasn't happened yet. The in-sample fit, the posterior predictive distribution over historical data, is the wrong thing to evaluate: any sufficiently flexible model fits training data. The question is whether the model has learned something that generalizes, or whether it has memorized the path of the particular spend series and sales history you showed it.

## The math in one paragraph

PSIS-LOO approximates the leave-one-out predictive density:

$$\text{ELPD}_{\text{LOO}} = \sum_{t=1}^{T} \log p(y_t \mid y_{-t})$$

where $p(y_t \mid y_{-t})$ is the predictive density for observation $t$ after conditioning on all other observations. Computing this exactly requires fitting $T$ separate posterior distributions — one with each data point removed — which for an MCMC model is prohibitive. PSIS sidesteps this by reweighting the samples from the full posterior using importance sampling, then stabilizing those weights with a Pareto distribution fit. The result is a fast, single-fit estimate of the LOO predictive density.

ArviZ makes this two lines:

```python
import arviz as az

# trace is your fitted InferenceData object from PyMC
loo_result = az.loo(trace, pointwise=True)
print(loo_result)
```

The summary gives you the ELPD estimate and its standard error. The `pointwise=True` flag returns per-observation diagnostics, including the Pareto k̂ values you actually need to inspect.

## The Pareto k̂ diagnostic

The LOO approximation works when leaving out a single observation doesn't change the posterior much — meaning no single data point has outsized influence on the fit. The Pareto k̂ statistic measures this influence for each observation. Values fall into three practical buckets:

- **k̂ < 0.5**: good. The approximation is reliable.
- **0.5 ≤ k̂ < 0.7**: okay but worth monitoring.
- **k̂ ≥ 0.7**: the approximation is unreliable for that observation; the LOO estimate there is suspect and you should refit without that point to get the true LOO contribution.

The diagnostic code to see which observations are problematic:

```python
import matplotlib.pyplot as plt
import numpy as np

loo_pw = loo_result.pareto_k.values
t_index = np.arange(len(loo_pw))

fig, ax = plt.subplots(figsize=(12, 3))
ax.scatter(t_index, loo_pw, s=10, alpha=0.6, c=np.where(loo_pw > 0.7, "red", "steelblue"))
ax.axhline(0.7, color="red", linestyle="--", label="k̂ = 0.7 threshold")
ax.axhline(0.5, color="orange", linestyle="--", label="k̂ = 0.5 threshold")
ax.set_xlabel("Week index"); ax.set_ylabel("Pareto k̂")
ax.legend()
plt.tight_layout()
```

## What high k̂ values mean in an MMM context

In a marketing mix model, high-k̂ observations are leverage points: weeks where the model is so sensitive to that observation that removing it would meaningfully shift the posterior. In practice, these cluster around a few patterns I see regularly:

**Holiday and promotional spikes.** A week where spend is two standard deviations above normal, paired with a sales spike, is doing a lot of identification work. The saturation curve and channel coefficients are partly calibrated to fit that point. Remove it and the posterior shifts.

**Structural breaks.** A COVID lockdown week, a competitor exit, a distribution change. The model tries to fit it with its existing functional form, can't fully, and that single observation ends up leveraged in the posterior.

**Adstock carry-forward interactions.** Because adstock means this week's spend enters the next week's prediction as well, a week with unusual spend isn't just influential for its own prediction — it's influential for several subsequent predictions too. Standard PSIS-LOO treats observations as conditionally independent given the parameters, which is approximately true for short adstock tails but breaks down for longer ones.

This last point is worth being explicit about: in an MMM with strong adstock, the "true" LOO predictive density for observation $t$ should condition on $y_{1:t-1}$ while leaving out $y_t$ — a leave-future-out (LFO) approach rather than strict LOO. LFO is available in ArviZ (`az.loo()` with `method='laplace'` or manual implementation) but requires more care. For most practical purposes, the high-k̂ flags from standard PSIS-LOO are still a useful diagnostic for where the model is relying heavily on single observations, even if the ELPD value itself is slightly distorted.

## Using ELPD to compare models

Beyond flagging influential observations, the ELPD sum is a principled model comparison tool. Compare two architectures — say, a Hill saturation curve versus a Michaelis-Menten, or a model with a quarterly seasonal trend versus a Fourier-basis seasonality — by running LOO on each and comparing their ELPDs:

```python
loo_hill = az.loo(trace_hill)
loo_mm = az.loo(trace_mm)
az.compare({"hill": trace_hill, "michaelis_menten": trace_mm}, ic="loo")
```

The comparison includes a standard error on the ELPD difference, so you can assess whether the improvement is meaningful. A model with more parameters will fit training data better — that's guaranteed — but it won't necessarily have a higher ELPD, because the LOO estimate penalizes overfit automatically through the held-out prediction.

This is the right way to answer "does adding saturation improve the model?": not by checking whether the saturated model fits better (it always will), but by checking whether it predicts better.

## Where LOO fits in the workflow

The full Bayesian workflow I run on any new model structure:

1. Write the generative story; check with prior predictive simulation.
2. Run SBC: verify rank histograms are approximately uniform.
3. Fit on real data; check MCMC diagnostics (R-hat, ESS, divergences).
4. **Run PSIS-LOO**: check ELPD and flag high-k̂ observations.
5. Run posterior predictive checks on the flagged observations specifically.
6. Calibrate against experimental lift tests.

Step 4 belongs after the MCMC checks and before you report. The MCMC diagnostics confirm the sampler; SBC confirms the estimator; LOO confirms the predictions. All three can pass or fail independently.

The most common finding in step 4, in my MMM work, is a cluster of high-k̂ weeks around the largest promotional events and the periods with the most unusual media mix. That's not a failure — it's the model telling you where it's most sensitive. The right response is to look at those weeks, understand why they're leveraged, and decide whether the model's assumptions hold there. If a holiday week is driving the saturation curve estimate, you want to know that before you use the curve to plan next year's budget.

LOO won't tell you whether your model is causally identified. It won't replace SBC or MCMC diagnostics. What it tells you, precisely, is how surprised your model is by its own data — and in applied forecasting and attribution, that's a property worth checking before you ship the result.

---

_PSIS-LOO was introduced formally in Vehtari, Gelman & Gabry (2017), "Practical Bayesian model evaluation using leave-one-out cross-validation and WAIC," Statistics and Computing 27(5). The ArviZ implementation is documented at [python.arviz.org](https://python.arviz.org). Leave-future-out cross-validation for time series is in Bürkner, Gabry & Vehtari (2020), "Approximate leave-future-out cross-validation for Bayesian time series models," Journal of Statistical Computation and Simulation. Related posts: [Simulation-Based Calibration](/posts/simulation-based-calibration/), [Read the Diagnostics First](/posts/read-the-diagnostics-first/), [All Models Are Wrong, So Make Yours Generative](/posts/generative-mmm-honest-iteration/)._
