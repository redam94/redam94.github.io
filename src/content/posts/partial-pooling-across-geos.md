---
title: "Partial Pooling Across Geos: Why Your Markets Should Share What They Know"
author: Matthew Reda
pubDatetime: 2026-08-26T13:30:45Z
slug: partial-pooling-across-geos
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - hierarchical-models
description: Fitting independent MMMs per geo overfit small markets; a single pooled model hides real regional variation. Hierarchical partial pooling is the Bayesian solution — markets share information where they can and diverge where they must.
---

At Choreograph I often work with MMMs that span a dozen or more geos — DMAs, states, countries, depending on the client's go-to-market structure. Every time, the same question comes up early: do we fit one model per market, or one model for everything?

Both answers are wrong. Not useless — wrong in specific, predictable ways. The Bayesian version of "neither" is partial pooling, and if you're not using it you're either inventing precision in your small markets or burying real variation in your large ones.

## The two bad options

**Completely separate models.** You fit one MMM per geo, each with its own coefficients for every channel. In a DMA with 200 weeks of data and decent spend variation, this works fine — the data can actually identify the parameters. But in a smaller market — 80 weeks, a few spends, most weeks at the same budget level — the posterior on the TV coefficient is going to be wide and noisy. You can't tell TV from baseline from luck. You report the estimate anyway, because you need an answer, and the number is either suspiciously high or suspiciously low compared to every other market. The model was honest; it's just that there wasn't enough data to estimate the thing you asked for.

**Single pooled model.** Treat geography as a fixed effect or ignore it entirely — one set of coefficients for all markets. The posterior is tight because you have all the data together. But if TV is genuinely more efficient in high-income DMAs, or digital video saturation kicks in earlier in dense urban markets, that variation disappears into the single estimate. The model is wrong in a more confident way than the separate models were.

## The Bayesian solution: a prior over the markets

Partial pooling treats each market's parameters not as independent unknowns, but as draws from a shared group distribution. The channel coefficient for market $g$ is:

$$\beta_g \sim \mathcal{N}(\mu_\beta,\, \sigma_\beta^2)$$

where $\mu_\beta$ (the group mean) and $\sigma_\beta$ (how much markets vary from each other) are themselves estimated from the data. This is a hierarchical prior — parameters that govern parameters.

The update logic is automatic: a small market with noisy data can't move far from $\mu_\beta$ on its own, so it's pulled toward the group estimate (shrinkage). A large market with many informative observations moves the posterior substantially away from $\mu_\beta$ in the direction its data supports. The amount of pooling is determined by $\sigma_\beta$ relative to the within-market posterior uncertainty — not by you deciding in advance which markets to trust.

In PyMC this is a few extra lines:

```python
import pymc as pm
import numpy as np

n_geos = len(geo_ids)

with pm.Model() as hierarchical_mmm:
    # Group-level hyperpriors
    mu_tv    = pm.Normal("mu_tv", mu=0.3, sigma=0.2)   # informed by literature
    sigma_tv = pm.HalfNormal("sigma_tv", sigma=0.1)

    # Geo-level TV coefficients, non-centered for sampler efficiency
    z_tv  = pm.Normal("z_tv", 0, 1, shape=n_geos)
    beta_tv = pm.Deterministic("beta_tv", mu_tv + z_tv * sigma_tv)

    # ... adstock, saturation, baseline terms per usual ...

    # Likelihood uses geo-indexed beta_tv[geo_idx]
    mu = beta_tv[geo_idx] * saturated_adstocked_tv + baseline[geo_idx]
    pm.Normal("sales", mu=mu, sigma=sigma_obs, observed=revenue)
```

The non-centered parameterization (`z_tv * sigma_tv`) is important — when $\sigma_\beta$ is small, the centered version produces funnel-shaped geometry that makes NUTS miserable. This is the same pattern described in the PyMC documentation for hierarchical models, and it's one of the first things I check when R-hat fails on geo-level parameters.

## What shrinkage actually does

The shrinkage toward $\mu_\beta$ is not a bug or an arbitrary regularization. It's the correct Bayesian update when you're uncertain whether a geo's deviation from the group is real signal or noise.

Think of it this way. If a small market's data suggests a TV ROAS of 3.2 while every other market sits between 1.0 and 1.6, partial pooling asks: is the 3.2 real, or did a few lucky weeks of high TV spending coincide with a seasonal lift? The posterior on $\sigma_\beta$ quantifies how much cross-geo variation you've actually observed. If $\sigma_\beta$ is small — markets really are similar — the 3.2 gets pulled hard toward the group mean. If $\sigma_\beta$ is large — markets genuinely vary — the outlier estimate survives, because the prior is now wide enough to accommodate it.

This is the right answer. It's what you'd tell a client if they asked: "our New Mexico DMA shows a TV ROAS of 3.2 — should we reallocate the national budget there?" You'd want to know how much you trust that number. Partial pooling makes that trust explicit rather than pretending you have a firm estimate when you don't.

## Practical implications

**Geo-level holdouts are most informative in mid-size markets.** The very large markets are already well-identified by their own data; you don't need a holdout to get a good coefficient estimate. The very small markets won't move much regardless — they're borrowing from the group. The mid-size markets — enough data to have an opinion, not so much that shrinkage is irrelevant — are where a geo holdout returns the highest expected information relative to cost. This maps directly to the ENBS logic from [designing experiments to maximize information](/posts/designing-experiments-to-maximize-information/): run the experiment where the posterior uncertainty is most expensive to leave unresolved.

**The group estimate is what goes in the optimizer.** When running budget optimization with [atlas](/posts/atlas-optimization-over-any-model/) across a mixed portfolio, the right input for small-market geos is the posterior for their geo-level $\beta_g$ — not the noisy marginal for that geo alone, not the national average. The hierarchical model produces the right thing automatically.

**Divergences on $\sigma_\beta$ near zero are a diagnostic.** If $\sigma_\beta$ keeps drifting toward zero and you're seeing divergences, your geos are genuinely homogeneous in that channel and you might not need the hierarchy at all — a single pooled coefficient is appropriate. The data is telling you the pooling structure isn't earning its complexity.

## The honest tradeoff

Hierarchical models aren't free. They add parameters, require the non-centered reparameterization, and take longer to fit. For a single-geo model, or a two-geo comparison, the overhead isn't worth it. The structure pays for itself when you have five or more geos with meaningful variation in data quality — that's when the shrinkage is doing real work and the alternative (separate models) is producing numbers you'd be embarrassed to defend in a room with skeptics.

The meta-point is the same as in [pre-specification](/posts/building-a-pre-specified-bayesian-mmm/): the model structure is a claim about how the world works. "Each geo is an independent data-generating process" is a strong claim. "Each geo's parameters are drawn from a shared distribution" is usually more defensible, and the posterior on $\sigma_\beta$ tells you whether you were right to assume it.

---

_The non-centered parameterization for hierarchical models is described in Betancourt & Girolami (2015), "Hamiltonian Monte Carlo for Hierarchical Models," and is standard practice in PyMC. The ENBS framework for geo experiment selection is in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `planner.expected_regret`. Related posts: [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/)._
