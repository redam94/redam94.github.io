---
title: "Your Priors Are Already Making Predictions. Check Them."
author: Matthew Reda
pubDatetime: 2026-09-06T13:14:18Z
slug: prior-predictive-simulation
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - pymc
  - statistics
description: Before MCMC ever runs, your priors define a complete distribution over the data. Prior predictive simulation makes that distribution visible — and in MMMs, it almost always reveals something worth fixing.
---

A common description of Bayesian inference goes like this: you have priors, you see data, you get a posterior. The prior is a starting point. MCMC is where the real work happens.

This framing understates what priors do. A prior over model parameters $\theta$ plus a likelihood $p(y \mid \theta)$ is already a complete generative model. You can sample $\theta$ from the prior and then generate data $y$ from the likelihood — before touching any real observations. The result is a **prior predictive distribution**: the distribution over data implied by your model before conditioning on anything.

Most people never look at it. In marketing mix models, that's a mistake.

## What prior predictive simulation is

The mechanics are simple. For a model with parameters $\theta$:

1. Draw $\theta^{(s)} \sim p(\theta)$
2. Generate $y^{(s)} \sim p(y \mid \theta^{(s)})$
3. Repeat for $s = 1, \ldots, S$

The resulting collection $\{y^{(s)}\}$ is a sample from the prior predictive. In PyMC, this is one call:

```python
import pymc as pm
import numpy as np
import matplotlib.pyplot as plt

with mmm_model:
    prior_pred = pm.sample_prior_predictive(samples=500, random_seed=42)

# Inspect the implied distribution of weekly sales
y_sim = prior_pred.prior_predictive["sales"].values.squeeze()
plt.figure(figsize=(10, 4))
plt.plot(y_sim[:50].T, alpha=0.1, color="steelblue")
plt.plot(y_sim.mean(axis=0), color="black", linewidth=2, label="prior predictive mean")
plt.xlabel("Week")
plt.ylabel("Simulated weekly sales")
plt.title("Prior predictive — 50 draws")
plt.tight_layout()
```

What you get is a bundle of simulated sales time series. Each one represents a plausible world under your model before it has seen any data.

## What to look for in an MMM

The prior predictive check asks: are these simulated series plausible? Not do they match the data — you haven't shown the model the data yet — but are they in a range you'd believe if you saw them in the wild?

For a marketing mix model, the failures I look for are:

**Negative or near-zero sales.** If a meaningful fraction of prior predictive draws produce negative revenue, your baseline prior is too diffuse or centered too low. A $\mathcal{N}(0, 10)$ prior on a log-scale baseline sounds uninformative but implies that roughly half the prior weight sits on negative sales after exponentiation — which is impossible.

**Sales many times larger than observed.** A log-normal with wide $\sigma$ can produce prior draws in the billions for a brand doing millions. The model hasn't "seen" the scale of the problem, and if the prior is diffuse enough, the sampler will spend time in those impossible regions during warmup.

**Individual channels claiming more than 100% of sales.** Sum the prior predictive channel contributions and check whether they can exceed total sales. If your media coefficient priors are uninformative and your saturation function can drive arbitrary contributions, the prior predictive will produce draws where TV alone "explains" 300% of sales. That's not a distribution over plausible effects; it's a prior that's incompatible with the likelihood in a way the sampler will struggle to navigate.

**Implausible ROAS.** From [decades of scanner-panel research](/posts/what-decades-of-marketing-data-tell-us/), the mean short-run advertising elasticity across channels is about 0.1. That implies ROAS values in the range of roughly 0.5–5 for typical packaged goods (higher for lower-margin categories, lower for brand TV). If the prior predictive ROAS distribution has significant mass at 50 or 0.001, the prior is not informed by what the field has learned. That's a choice you can make, but you should see it before fitting, not after.

A quick check:

```python
# Posterior predictive ROAS range from prior draws
beta_samples = prior_pred.prior["channel_coeff"].values.squeeze()
spend = x_media.mean(axis=0)           # average weekly spend per channel
sales = prior_pred.prior_predictive["sales"].values.squeeze().mean(axis=1)

roas_implied = (beta_samples * spend) / sales[:, np.newaxis]
print(f"Prior predictive ROAS range: {np.percentile(roas_implied, 5):.2f} – {np.percentile(roas_implied, 95):.2f}")
```

If that range spans orders of magnitude, tighten the priors or log-transform the coefficient parameterization.

## The chain from empirical constants to priors to predictions

In [What Decades of Marketing-Mix Data Actually Tell Us](/posts/what-decades-of-marketing-data-tell-us/), I laid out the field's empirical anchors: short-run advertising elasticity ≈ 0.1, half-life ≈ a couple of months, response saturates. These constants exist to inform priors — but the prior predictive simulation is how you check whether your parameterization actually encodes them.

A common gap: you set a Beta(7, 3) prior on the weekly adstock retention rate (centered near 0.7, appropriate for TV at weekly grain), but the adstock transformation and the saturation function interact in ways that produce a prior predictive ROAS distribution far from the empirical range. Setting a prior on $\lambda$ is not the same as setting a prior on ROAS. The prior predictive simulation shows you the implied ROAS — the quantity you actually care about — by propagating $\lambda$ through the full generative model.

This is why the prior predictive check is genuinely upstream of [Simulation-Based Calibration](/posts/simulation-based-calibration/). SBC asks whether the model recovers $\theta$ from data generated under the model. But if the prior predictive produces implausible data in the first place, SBC tests recovery under a broken generative model. The right order is:

1. **Prior predictive simulation**: Do the simulated data look like plausible marketing time series?
2. **Simulation-Based Calibration**: Can the model recover parameters from the data it generates?
3. **Fit on real data**: Run MCMC on the actual observations.
4. **Posterior predictive check**: Does the fitted model reproduce the real data's structure?
5. **Diagnostics**: Are $\hat{R}$, ESS, and divergences healthy?

Practitioners often jump straight to step 3 and then run step 5 as a final sanity check. Steps 1 and 2 are the pre-flights that tell you whether the engine is configured correctly before takeoff.

## What failure modes look like

A few specific patterns I've seen in MMM prior predictive simulations:

**The baseline dominance failure.** Baseline and media priors are each weakly informative, but the baseline is parameterized so it can absorb nearly all of sales. The prior predictive shows most simulated series with near-zero media contributions and a wildly varying baseline. The model will be fine fitting on data — it'll just find a similar solution to whatever the analyst had in mind — but the prior predictive has revealed that the model has almost no prior belief that media matters at all.

**The saturation cliff.** Half-saturation priors that are too wide allow draws where the half-saturation point is many times larger than the observed spend range. In those draws, the saturation function is nearly linear across the entire observed range, and the model can't identify any curvature. Prior predictive draws under these parameters produce a flat response with no diminishing returns — which is incompatible with decades of evidence.

**The adstock explosion.** A $\mathcal{U}(0, 1)$ prior on retention rate has significant mass near 1. At $\lambda = 0.98$, a channel's adstock takes over a year to decay to 5% — a half-life of 35 weeks. Prior predictive draws under those parameters produce channels that appear to influence sales for months after a campaign ends, with almost no seasonal variation and no response to spend fluctuations, because everything is averaged over a long window. That's not a model of marketing; it's a model of long-memory processes with occasional media labels.

In each case, the fix is upstream of MCMC: tighten or reparameterize the prior. Not because the sampler fails on these specifications — it may mix cleanly — but because you haven't actually encoded your beliefs about how marketing works. You've encoded a model that will happily fit whatever the data contains, which sounds good until you remember that the whole point of a prior is to constrain the posterior toward plausible configurations.

## The bottom line

Before you run MCMC, run the prior predictive. Look at the simulated time series. Check that the implied ROAS, baseline fraction, and carryover durations are in ranges you'd defend to a client. If they aren't, you haven't finished specifying the model — you've only specified its mathematical form.

The prior predictive simulation costs nothing. It runs in seconds. It's the cheapest test in the Bayesian workflow and the one most likely to catch a misspecification before you've committed an hour of sampler time to it.

---

_Prior predictive simulation is step 2.1 in Gelman et al. (2020), "Bayesian Workflow," arXiv:2011.01808, which frames it as an essential calibration step before MCMC. The empirical constants used to evaluate prior predictive plausibility come from the marketing literature surveyed in [What Decades of Marketing-Mix Data Actually Tell Us](/posts/what-decades-of-marketing-data-tell-us/). Related: [Simulation-Based Calibration: The Missing Test in Your Bayesian Workflow](/posts/simulation-based-calibration/), [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/), [Read the Diagnostics First](/posts/read-the-diagnostics-first/)._
