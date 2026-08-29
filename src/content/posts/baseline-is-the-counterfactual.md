---
title: "The Baseline Is Your Counterfactual"
author: Matthew Reda
pubDatetime: 2026-08-29T13:14:03Z
slug: baseline-is-the-counterfactual
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - time-series
description: How you model trend and seasonality in an MMM determines what your counterfactual "no media" world looks like — and therefore every media attribution number the model produces.
---

One topic I've flagged as consistently under-examined in my [common regression issues](https://github.com/redam94/common_regression_issues) framework is how to deal with trending and seasonal time series. In MMM work, this comes up constantly and the answer practitioners reach for is almost always too shallow: "we added Fourier terms," or "we included a trend variable." That's not wrong. But it papers over a question that actually matters: _what is the baseline, and what does it mean?_

The baseline of an MMM is not a nuisance term to be controlled away. It's the model's answer to the counterfactual question: **what would sales have been if no media had run?** Every bit of variance that your baseline absorbs is variance you've decided cannot be attributed to media. Every bit it fails to absorb gets credited to whichever channel happened to be running at the time. The baseline is where most of the measurement action happens, and most practitioners leave it on default settings.

## Why it's a counterfactual, not a control

In [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/) I wrote about how seasonality is a confounder — it drives both media spend and sales, so a model that ignores it credits media for the seasonal lift. The fix is to adjust for seasonality. But _how_ you adjust determines what you're actually claiming.

A Bayesian MMM has a structure something like:

$$y_t = \underbrace{f(\text{trend}_t, \text{season}_t)}_{\text{baseline}} + \underbrace{\sum_k g_k(\text{spend}_{k,t})}_{\text{media contribution}} + \epsilon_t$$

The baseline $f$ is your model of "what sales would have been at time $t$ with zero media." The media contribution $g_k$ is what each channel adds on top. These two quantities compete for the variance in $y_t$. If the baseline is flexible enough to absorb everything, the media coefficients collapse to zero. If the baseline is too rigid, media gets credit for whatever the baseline can't explain — including genuine seasonality it should have absorbed.

There is no specification of $f$ that is neutral. Every choice embeds a prior on what the counterfactual world looks like.

## Three baseline approaches and what each assumes

**Polynomial trend + Fourier seasonality** is the most common choice and the most dangerous when used uncritically. You add a time index (linear trend) and a handful of sine/cosine pairs at annual frequency. This assumes: (1) the trend is globally linear or polynomial, and (2) the seasonal pattern is the same every year — same amplitude, same phase, forever.

Neither is usually true over a marketing dataset of 3–5 years. The pandemic moved holiday shopping to November. Category growth accelerates and slows. New competition changes baseline volumes. A Fourier model with fixed coefficients will fit a seasonal pattern from 2019–2023 and apply it as-is to 2024, and then the residual — the part the rigid baseline can't explain — gets pushed onto whatever media was running at the time.

**Fourier terms with time-varying amplitudes** are a better approximation. Instead of fixed Fourier coefficients $a_k, b_k$, you allow them to evolve:

$$\text{season}_t = \sum_{k=1}^{K} \bigl[ a_k(t) \cos(2\pi k t / 52) + b_k(t) \sin(2\pi k t / 52) \bigr]$$

where $a_k(t)$ and $b_k(t)$ follow random walks. This lets the model learn that Q4 was stronger in some years than others, rather than forcing a single average. In PyMC:

```python
import pymc as pm
import numpy as np

with pm.Model() as tvs_model:
    # Random-walk amplitudes for first Fourier harmonic
    sigma_a = pm.HalfNormal("sigma_a", 0.1)
    a_innov = pm.Normal("a_innov", 0, sigma_a, shape=T)
    a = pm.Deterministic("a", pt.cumsum(a_innov))

    # Similarly for b
    sigma_b = pm.HalfNormal("sigma_b", 0.1)
    b_innov = pm.Normal("b_innov", 0, sigma_b, shape=T)
    b = pm.Deterministic("b", pt.cumsum(b_innov))

    t = np.arange(T)
    seasonality = a * np.cos(2 * np.pi * t / 52) + b * np.sin(2 * np.pi * t / 52)
```

**Gaussian process baselines** are the most flexible option: you model the entire baseline as a smooth latent function, with a kernel that encodes how fast it's allowed to vary. A Matérn or squared-exponential kernel with a long length-scale enforces slow drift; shorter length-scales allow faster movement.

The problem with GPs is that flexibility cuts both ways. A GP with a short length-scale can absorb any pattern, including the media contribution itself. If your digital video spend and your GP baseline are both free to move week over week, the posterior will be indifferent between "digital video drove the lift in week 37" and "the baseline happened to be higher that week" — you've manufactured the exact ambiguity collinearity creates, except now it's structural rather than accidental.

The resolution is the same as for collinearity: informative priors on at least one side, or experimental variation that breaks the degeneracy. If you've run geo holdouts, those constrain the media coefficient enough that the GP baseline can be flexible without absorbing the effect. Without them, a flexible baseline and uninformed media priors are not separately identified.

## Prior predictive checks on the baseline

Before you fit any real data, check that your baseline specification produces plausible counterfactual worlds. A prior predictive check on $f$ alone — with all media contributions zeroed out — tells you whether your baseline model can generate the sales trajectories you'd expect to see in a world without advertising.

```python
with baseline_model:
    # Sample only from the baseline, zero out media terms
    prior_samples = pm.sample_prior_predictive(samples=200)

import matplotlib.pyplot as plt
import arviz as az

fig, ax = plt.subplots(figsize=(12, 4))
for i in range(50):
    ax.plot(
        prior_samples.prior_predictive["baseline"][0, i],
        alpha=0.2, color="steelblue"
    )
ax.set_title("Prior predictive: baseline only (no media)")
ax.set_xlabel("Week")
ax.set_ylabel("Sales")
```

If the baseline prior generates trajectories that span several orders of magnitude, or trends that imply 50% year-over-year growth, the prior is doing violence to the data before the fit even starts. The prior should express genuine uncertainty about baseline behavior — not uniform uncertainty over the entire positive real line.

## What to watch in the posterior

After fitting, two diagnostics are specific to baseline-media tension:

**Posterior correlation between baseline and media coefficients.** Just as [collinearity between channels](/posts/collinearity-cant-separate/) shows up as a tilted ellipse in the joint posterior, baseline-media collinearity shows up as a negative correlation between the baseline level and a media coefficient: the model is trading them off. If a higher baseline can explain the data equally as well as a larger media coefficient, both will be uncertain in a correlated way.

```python
az.plot_pair(
    trace,
    var_names=["baseline_level", "beta_paid_search"],
    kind="kde"
)
```

**Sensitivity to baseline specification.** Refit with a slightly different baseline — replace the polynomial trend with a Fourier trend, or change the GP length-scale — and compare the media attribution. If the media coefficients shift materially across reasonable baseline choices, you don't have a finding; you have a range that should be reported. Wide sensitivity under baseline perturbation is the structural uncertainty equivalent of [false precision in reporting](/posts/false-precision-in-reporting/).

## The practical checklist

Before shipping a baseline specification, I run through four questions:

1. **Does the prior predictive generate plausible counterfactual sales?** Plot 200 baseline draws with no media. They should look like a real category — right order of magnitude, plausible seasonality amplitude, trend rates consistent with what you know about category growth.

2. **Does the baseline absorb clearly non-media structure?** Fit the model and plot the residuals. If residuals have obvious seasonal spikes, the baseline is underpowered. If media coefficients are near-zero and the baseline is doing everything, the baseline is overpowered.

3. **What's the posterior correlation between baseline components and key media coefficients?** A strong negative correlation is the signal of an identification problem. The resolution is more informative priors on media (from lift tests), not a more flexible baseline.

4. **How sensitive is attribution to baseline choice?** Try two or three defensible alternatives. If the answer is stable, report it. If it isn't, report the range.

## The uncomfortable conclusion

The counterfactual question — what would sales have been without media? — is answered by the baseline, not by the media coefficients. Most of the scrutiny in MMM reviews falls on the media side: are the adstock curves right, is the saturation function appropriate, are the ROIs in range? Almost none of it falls on the baseline, which is doing at least as much work.

A model with a well-specified baseline and simple media terms will outperform one with elaborate media transforms sitting on a badly-specified counterfactual. The baseline is not the scaffolding — it's the answer to the question everyone actually cares about, stated in a form that just happens to be harder to look at directly.

---

_Trends and seasonality as a regression challenge are part of my [common regression issues](https://github.com/redam94/common_regression_issues) framework. The identification problem between baseline and media is the temporal analog of [collinearity between channels](/posts/collinearity-cant-separate/). The causal framing of seasonality as a confounder is in [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/). Prior predictive checks are discussed in the [Bayesian MMM pre-specification post](/posts/building-a-pre-specified-bayesian-mmm/) and [Simulation-Based Calibration](/posts/simulation-based-calibration/)._
