---
title: "Hierarchical Priors for Multi-Market MMMs: Let the Data Decide How Much to Pool"
author: Matthew Reda
pubDatetime: 2026-08-27T13:25:06Z
slug: hierarchical-mmm-partial-pooling
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - regression
description: When the same brand runs across twenty markets, the right MMM isn't twenty separate models or one pooled model — it's a hierarchical model that learns how much to pool from the data itself.
---

When you run an MMM for a national brand, the data usually lives in geo slices: markets, regions, DMAs. The tempting options are fitting one model to all of them pooled together, or fitting a separate model per market. Both are wrong for predictable reasons, and the right answer is a third thing that most practitioners skip.

## The two extremes and why they fail

**Fully pooled**: one model, all markets stacked together, single set of channel coefficients. The model assumes New York and Omaha have the same TV ROI, the same saturation curve, the same adstock dynamics. If the markets are genuinely heterogeneous — and they usually are — you get biased estimates for everyone, and the markets with the most data dominate the fit.

**Completely separate**: twenty models, each fitted independently on whatever data that geo has. In a single market you might have 2–3 years of weekly data, maybe 120–160 rows. I already showed in [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) that this is barely enough to pin down a single channel's response curve even with informative priors. With twenty parameters per market and 120 rows, you're fitting noise. The separately-fitted models will look plausible market-by-market and be useless for comparison or aggregation.

Both extremes make the same kind of mistake: they assume a fixed degree of heterogeneity and commit to it. The pooled model assumes zero heterogeneity. The separate models assume the markets are so different that sharing no information is correct. Neither is true.

## Partial pooling: let the data figure it out

A hierarchical model takes a middle path. Instead of fixing the market-level coefficients at one shared value or estimating them completely independently, it treats them as draws from a common distribution — and learns that distribution from the data.

For a single channel's coefficient $\beta_m$ in market $m$, the structure is:

$$\beta_m \sim \mathcal{N}(\mu_\beta,\, \sigma_\beta^2)$$
$$\mu_\beta \sim \mathcal{N}(0.5,\, 0.5^2), \qquad \sigma_\beta \sim \text{HalfNormal}(0.3)$$

The hyperparameters $(\mu_\beta, \sigma_\beta)$ are learned from all markets jointly. $\mu_\beta$ is the "global" coefficient — the best estimate for a generic market in this portfolio. $\sigma_\beta$ is the market-to-market variation. When $\sigma_\beta$ is small, the markets really do look alike and the model pools aggressively. When $\sigma_\beta$ is large, markets are genuinely different and the model respects that.

What makes this properly Bayesian — rather than just a random-effects regression — is that the uncertainty in $(\mu_\beta, \sigma_\beta)$ propagates into every market-level estimate. Small markets get more shrinkage; large markets resist it. The shrinkage is calibrated to the data rather than imposed by the analyst.

In PyMC the setup is:

```python
import pymc as pm

with pm.Model(coords={"market": market_ids}) as hierarchical_mmm:
    # Hyperpriors on the channel coefficient distribution
    mu_beta = pm.Normal("mu_beta", mu=0.5, sigma=0.5)
    sigma_beta = pm.HalfNormal("sigma_beta", sigma=0.3)

    # Non-centered parameterization for sampler health
    beta_offset = pm.Normal("beta_offset", mu=0, sigma=1, dims="market")
    beta = pm.Deterministic("beta", mu_beta + sigma_beta * beta_offset, dims="market")

    # ... adstock transform, saturation function, baseline per market ...

    pm.Normal("obs", mu=mu_t, sigma=sigma_obs, observed=sales_data)
```

The non-centered parameterization (`beta_offset` scaled by `sigma_beta`) is not optional. The centered version produces funnel-shaped geometries in the posterior that make NUTS struggle — divergences pile up near $\sigma_\beta \approx 0$ and the sampler can't explore the lower region of market variation. Non-centering is standard practice for hierarchical models and it's the default in the [`mmm-framework`](https://github.com/redam94/mmm-framework) templates.

## What the shrinkage tells you

After fitting, the posterior on $\sigma_\beta$ gives you something genuinely useful: a calibrated answer to "how much do my markets differ on this channel?" A tight posterior near zero means the channel ROI is stable across the portfolio — one allocation strategy fits everywhere. A wide posterior means markets are heterogeneous — optimizing nationally with a single set of weights is going to leave money on the table in half your geos.

The market-level estimates $\beta_m$ shrink toward $\mu_\beta$ in proportion to how little data each market contributes. A well-measured large market ends up close to its separately-estimated coefficient. A small market with sparse data gets pulled toward the portfolio average. This is usually the right thing to do: you shouldn't trust a noisy 120-row fit to place a rural DMA far from the typical market.

The diagnostic I find most useful is plotting the posterior means of $\beta_m$ against the market's sample size, and overlaying the raw separate-model estimates. Small markets will show clear shrinkage toward $\mu_\beta$; large markets will be nearly unchanged. If a small market is _not_ shrinking much, look at the posterior on $\sigma_\beta$ — the model is saying the market genuinely looks unusual, which is worth investigating before trusting.

## Connection to pre-specification

The hierarchical structure changes the pre-specification workflow from [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/). The market-level prior $\mathcal{N}(\mu_\beta, \sigma_\beta^2)$ is now itself inferred, not fixed. What you pre-specify are the hyperpriors — your beliefs about the _distribution_ of market-level effects across the portfolio.

The empirical constants from [What Decades of Marketing-Mix Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/) still anchor $\mu_\beta$: a 0.1 advertising elasticity and 0.7 adstock retention are still your best baseline for a generic market. But $\sigma_\beta$ needs a separate judgment call: how heterogeneous are your markets expected to be? A grocery brand operating across similar metro areas has a defensible argument for a tight prior on $\sigma_\beta$. A brand spanning urban and rural DMAs, or operating in both Spanish-language and English-language media markets, should allow more spread.

That judgment belongs in the pre-specification document, not in a post-hoc sensitivity analysis. "Our markets are more alike than different" is a modeling assumption with consequences — it should be stated before you see the fit, alongside the same commitment you make to adstock and saturation parameters.

## Why aggregation is the real payoff

The practical difference shows up at the moment you roll market-level estimates into a portfolio ROAS. If you fit separate models per market and then weight-average the ROAS estimates, you're treating each market's noisy estimate as equally trustworthy. The small markets contribute wildly uncertain numbers that can swing the aggregate. Hierarchical partial pooling gives you a better-calibrated aggregate because the small-market estimates have already been regularized.

It also gives you a principled answer to "what should we expect in a new market?" A hierarchical model answers immediately: the predictive distribution for a new market is $\mathcal{N}(\mu_\beta, \sigma_\beta^2)$ — the global average with portfolio-width uncertainty. A portfolio of separate models gives you nothing — there's no defined "typical market" to generalize from.

The pooling question isn't whether markets are identical — they're not. It's whether sharing information makes the estimates better. For channel coefficients in a brand portfolio running the same creative and media mix, the answer is almost always yes.

---

_The non-centered parameterization for hierarchical models is covered in Betancourt & Girolami (2015), "Hamiltonian Monte Carlo for Hierarchical Models." For why short MMM time series demand informative priors in the first place, see [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) and [What Decades of Marketing-Mix Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/). The pre-specification workflow is in [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/)._
