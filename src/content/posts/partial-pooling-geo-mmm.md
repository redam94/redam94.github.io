---
title: "No Pool, Full Pool, Partial Pool: The Only Three Choices in a Geo MMM"
author: Matthew Reda
pubDatetime: 2026-07-30T13:17:31Z
slug: partial-pooling-geo-mmm
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - hierarchical-models
  - statistics
description: When your MMM spans multiple geographies, you have exactly three options for handling geo-level variation in channel ROAS — and only one of them is statistically honest.
---

When you have media and sales data across 50 DMAs or 20 countries, the temptation is to either collapse everything to one national model or fit 50 separate models. Neither is right. The hierarchical middle path — partial pooling — is what makes geo-level MMMs work, and understanding why requires seeing where the other two fail.

## The three estimators

Say you have geos $g = 1, \ldots, G$, and for each geo you want to estimate channel $c$'s ROAS: call it $\beta_{gc}$.

**No pooling.** Fit a separate model per geo. Each $\beta_{gc}$ is estimated from geo $g$'s data alone. Result: unbiased in each geo in expectation, but high variance in sparse geos. A test market with 18 months of weekly data has about 78 observations. After you've used them to fit baseline, seasonality, price, and eight media channels, the ROAS posteriors are wide. Not wrong in direction — just too uncertain to be useful, and prone to extreme estimates from noise.

**Complete pooling.** Run one national model, ignoring geo. Each geo's ROAS is implicitly set to the national average. Result: low variance, but biased wherever the geo actually differs from average. Your Chicago ROAS and your rural Tennessee ROAS are forced to the same number even when the market structure is genuinely different. Complete pooling is the no-pool model with one giant geo.

**Partial pooling.** Give each geo its own parameter, but connect them with a shared prior:

$$\beta_{gc} \sim \mathcal{N}(\mu_c,\, \tau_c)$$

The hyperparameters $\mu_c$ (global mean ROAS for channel $c$) and $\tau_c$ (spread of geo-level ROAS around that mean) are estimated from the data — you're not setting them by hand. This is the hierarchical model. It produces a shrinkage estimator: each geo-level estimate is pulled toward $\mu_c$ by an amount determined by how much evidence that geo has.

## The shrinkage factor

In the Gaussian limit, the posterior mean for geo $g$'s coefficient is approximately:

$$\hat\beta_{gc} \approx (1 - B_{gc})\,\bar\beta_{gc}^{\text{MLE}} + B_{gc}\,\hat\mu_c$$

where $\bar\beta_{gc}^{\text{MLE}}$ is the no-pool (geo-only) estimate and

$$B_{gc} = \frac{\sigma_g^2 / n_g}{\sigma_g^2 / n_g + \tau_c^2}$$

is the **shrinkage factor**. When $n_g$ is small — a sparse geo, a small test market — the observation variance dominates and $B_{gc} \to 1$: the estimate is pulled almost entirely toward the global mean. When $n_g$ is large — a dense metro with three years of weekly data — $B_{gc} \to 0$: the estimate is driven by the geo's own data. Exactly what you want.

The classical result (Stein, 1956) is that for three or more groups, the shrinkage estimator always dominates the no-pool estimator under squared-error loss. Not in some geos, not sometimes — always, in expectation. You're not trading bias for variance as a matter of taste; you're strictly reducing total expected error.

## What to pool and what not to

Not every parameter benefits from the same pooling structure.

**Pool channel ROAS.** Media efficiency varies by geo — regional TV costs differ, urban digital competition differs — but not arbitrarily. The prior $\beta_{gc} \sim \mathcal{N}(\mu_c, \tau_c)$ says geos share a distribution but not a single value. Right degree of freedom.

**Pool saturation curve shapes cautiously.** The Hill curve's shape parameter $\kappa$ can plausibly vary by market structure. A per-channel hyperprior on $\kappa$ works, but with a wider $\tau$ than you'd use for ROAS — you want the data to be able to express real heterogeneity without being collapsed to a national curve.

**Don't pool baseline or seasonality.** Market-to-market baseline demand reflects structural differences — population, income, competitor presence. Pulling these toward a global mean is subtly dangerous: it can route baseline differences into the media coefficients, which is the partial-pooling version of the [Table 2 problem](/posts/table-2-fallacy-in-mmm/). Keep baseline intercepts geo-specific, or explain the variation with geo-level covariates rather than absorbing it.

## The PyMC sketch

The [`mmm-framework`](https://github.com/redam94/mmm-framework)'s `HierarchicalConfigBuilder` wraps this structure with a fluent API. Underneath, the model is:

```python
import pymc as pm

with pm.Model(coords={"geo": geos, "channel": channels}) as hierarchical_mmm:
    # Hyperpriors — learned from data across all geos
    mu_roas = pm.Normal("mu_roas", 0, 1, dims="channel")
    tau_roas = pm.HalfNormal("tau_roas", 0.5, dims="channel")

    # Geo-level ROAS drawn from shared distribution.
    # Non-centered parameterization avoids funnel geometry when tau is small.
    z_roas = pm.Normal("z_roas", 0, 1, dims=("geo", "channel"))
    beta = pm.Deterministic("beta", mu_roas + z_roas * tau_roas, dims=("geo", "channel"))

    # Geo-specific baselines — not pooled
    alpha = pm.Normal("alpha", 0, 2, dims="geo")

    # Simplified sales model (real model includes adstock, saturation, seasonality)
    mu = alpha[geo_idx] + (beta[geo_idx] * media_spend).sum(axis=-1)
    sigma = pm.HalfNormal("sigma", 1)
    pm.Normal("sales", mu=mu, sigma=sigma, observed=sales)
```

Two implementation details matter:

1. **Non-centered parameterization.** Writing $\beta_{gc} = \mu_c + z_{gc} \cdot \tau_c$ where $z_{gc} \sim \mathcal{N}(0,1)$ decouples the sampler geometry from the correlation between hyperparameters and geo-level draws. Without it, NUTS gets stuck in a funnel when $\tau_c$ is small — exactly the regime where sparse geos are being heavily shrunk.

2. **Prior scale on $\tau_c$.** The `HalfNormal(0.5)` here encodes a prior belief that geo-level ROAS varies by ±50% around the national mean. Calibrate this to what you believe about cross-geo heterogeneity in your category, and check the posterior — if $\tau_c$ posteriors pile up near zero, the data isn't supporting the geo variation you assumed.

## The calibration payoff

The geos that benefit most from partial pooling are exactly the geos where you'd run geo holdout experiments: small markets, recent entrants, markets with unusual media mixes. A partial-pool ROAS estimate for a 12-geo holdout is tighter and less prone to extremes than a no-pool estimate, which means the incrementality read is better calibrated against what you'll observe.

This connects to the [closing-the-loop](/posts/closing-the-loop-mmm-calibration/) workflow. If your no-pool geo ROAS is implausible — off by 3× because 78 observations gave you a noisy posterior — the calibration prior from an experiment has to move something extreme. Partial pooling narrows the starting point so the experiment's evidence is sharpening an already-reasonable belief, not rescuing a noise spike.

The framework's synthetic-data-world feature is the right tool for checking the pooling structure: generate data from a known ground truth with specified cross-geo ROAS heterogeneity, fit the hierarchical model, and verify that the posterior over $\tau_c$ correctly identifies the spread you put in. If the synthetic world recovers the national ROAS distribution but gets individual geos wrong, $\tau_c$ is shrinking too hard and the prior needs to be wider.

National media analysis always pooled. Geo analysis that pretends each market is its own universe always separated. The hierarchical estimator is the only one that lets the data decide how much the geos resemble each other — and in a high-eight-figure spend portfolio, that decision belongs to the evidence, not to the model specification.

---

_Grounded in the `mmm-framework`'s [`HierarchicalConfigBuilder`](https://github.com/redam94/mmm-framework) and the partial-pooling structure described in its README. Mathematical foundation: Stein (1956), "Inadmissibility of the usual estimator for the mean of a multivariate normal distribution"; James & Stein (1961). Non-centered parameterization: Papaspiliopoulos, Roberts & Sköld (2007), "A general framework for the parametrization of hierarchical models." Related posts: [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/), [Your MMM's Control Coefficients Are Not Findings](/posts/table-2-fallacy-in-mmm/), [Variable Selection in MMM](/posts/variable-selection-mmm/)._
