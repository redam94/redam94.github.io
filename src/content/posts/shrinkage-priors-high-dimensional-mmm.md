---
title: "When You Have Fifteen Channels and Two Years of Data: Shrinkage Priors in MMM"
author: Matthew Reda
pubDatetime: 2026-09-13T13:13:57Z
slug: shrinkage-priors-high-dimensional-mmm
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - regression
  - statistics
description: Flat priors on fifteen channel coefficients invite overfitting and unstable attribution. The Bayesian answer is a shrinkage prior — here's how to choose one and what the posterior tells you.
---

Suppose you're building an MMM with fifteen media channels, two years of weekly data, and a handful of macro controls. That's 104 observations, perhaps fifteen media coefficients to estimate, and a likelihood that's essentially happy to explain away everything given enough flexibility. If you put wide, flat priors on every channel coefficient, you'll get fitted values that hug the data and attribution numbers that shift dramatically when you swap out a single control variable.

This isn't a computational problem. It's an inferential one. More parameters relative to observations means more posterior mass spread over combinations that fit the data but contradict each other and your business intuition. The [collinearity post](/posts/collinearity-cant-separate/) covers this in the context of correlated predictors; the problem here is compound: collinearity _and_ model complexity pulling in the same direction.

The standard frequentist response is stepwise selection: fit, drop the insignificant channels, report the survivors. The problems with this are well-known — it selects on noise, the retained set depends on the order of elimination, and the reported standard errors are wrong for variables that survived selection. The Bayesian response is more coherent: put a **shrinkage prior** on the channel coefficients that encodes the belief that most channels probably have small effects, and let the data pull the posteriors away from zero for the channels that genuinely earn it.

## Three choices on a spectrum

Think of shrinkage priors as a spectrum from soft to aggressive.

**Normal (Ridge)** — the gentlest option. Place a $\mathcal{N}(0, \sigma_\beta^2)$ prior on each channel coefficient. This penalizes large values softly; all coefficients are pulled toward zero, but proportionally — a coefficient twice as large is penalized twice as much. In the `mmm-framework` [pre-specification workflow](/posts/building-a-pre-specified-bayesian-mmm/), you're already doing this implicitly any time you place a HalfNormal or Normal prior on channel contributions. The question is just how tight.

**Laplace (LASSO)** — the Bayesian LASSO places a Laplace prior on coefficients: $p(\beta_j) \propto \exp(-|\beta_j| / \lambda)$. The Laplace has heavier tails near zero and sharper peak at zero than the Normal. In a maximum-a-posteriori sense this produces exact zeros; in full Bayesian inference you get posteriors that are concentrated near zero rather than exactly zero. Useful when you genuinely believe several channels contribute nothing and you want the model to concentrate mass there.

**Horseshoe** — the most principled and currently recommended choice for sparse regression. The horseshoe prior (Carvalho, Polson & Scott, 2010) is:

$$\beta_j \mid \lambda_j, \tau \sim \mathcal{N}(0, \lambda_j^2 \tau^2), \quad \lambda_j \sim \text{Half-Cauchy}(0, 1), \quad \tau \sim \text{Half-Cauchy}(0, \tau_0)$$

The local scale $\lambda_j$ is channel-specific: channels that have signal in the data get large $\lambda_j$ and escape shrinkage; channels with no signal get small $\lambda_j$ and are pulled toward zero. The global scale $\tau$ controls the overall sparsity. The name comes from the shape of the shrinkage profile — it's nearly flat for large signals (the horseshoe bends away from zero) and nearly complete near zero (the horseshoe grips tightly). This is the key distinction from Ridge: a strong signal channel escapes Ridge shrinkage only weakly, but escapes horseshoe shrinkage almost entirely.

## PyMC implementation

In PyMC, the regularized horseshoe (Piironen & Vehtari, 2017) is the practical choice over the vanilla Cauchy-tailed version, because the half-Cauchy tails can cause pathological geometry in NUTS. The regularized version replaces the Cauchy with a truncated Normal, controlled by a slab variance $c^2$:

```python
import pymc as pm
import numpy as np

with pm.Model() as mmm_sparse:
    # Global shrinkage: set tau_0 based on expected fraction of nonzero channels
    # p0 = prior guess at number of active channels; n = number of observations
    p0, n = 5, 104
    sigma = pm.HalfNormal("sigma", sigma=1.0)
    tau_0 = (p0 / (15 - p0)) * (sigma / np.sqrt(n))
    tau = pm.HalfNormal("tau", sigma=tau_0)

    # Slab variance for active channels
    c2 = pm.InverseGamma("c2", alpha=2, beta=2)

    # Local scale (channel-specific)
    lam = pm.HalfNormal("lam", sigma=1.0, shape=15)

    # Regularized horseshoe: blend local Cauchy with slab
    lam_tilde = pm.Deterministic(
        "lam_tilde", pm.math.sqrt(c2 * lam**2 / (c2 + tau**2 * lam**2))
    )

    # Channel coefficients — all positive (ROAS > 0)
    beta_raw = pm.Normal("beta_raw", 0, 1, shape=15)
    beta = pm.Deterministic("beta", pm.math.abs_(beta_raw) * lam_tilde * tau)

    # ... adstock, saturation, baseline, likelihood as usual
```

The `tau_0` calculation is a principled starting point from Piironen & Vehtari: set it to expect roughly `p0` active channels out of fifteen. This is the prior you want to articulate honestly — "I think about five of these fifteen channels have meaningful effects" — rather than the implicit prior you get from wide Normals, which is "all fifteen channels are equally plausible at any scale."

## What the posterior looks like

The key diagnostic is the distribution of $\lambda_j$ values. A channel that the data supports should have a posterior $\lambda_j$ concentrated well above zero; a channel with no signal should have $\lambda_j$ concentrated near zero. Plot the posterior medians of $\beta_j$ against the posterior medians of $\lambda_j$ and you'll see a rough separation: a cluster near zero (the "dead" channels, heavily shrunk) and a few points out in the tail (channels earning their attribution).

This is more informative than a VIF table or a p-value table. It tells you not just "this coefficient is small" but "the model is actively pulling this coefficient to zero, and here's how confidently." The posterior width on the surviving channels is honest — they've earned their signal against the shrinkage.

A useful complement is to compare the horseshoe posterior against a wide-Normal prior posterior for the same model. Channels that shrink substantially under horseshoe but not under Normal are the ones where the data has been fitting noise; channels that are stable across both are genuinely identified.

## Why this fits the pre-specification workflow

One thing I emphasize in the [pre-specified Bayesian MMM post](/posts/building-a-pre-specified-bayesian-mmm/) is that priors should be committed to before fitting. The shrinkage prior is entirely compatible with this: you're declaring, before you see the posterior, that you believe the effect landscape is sparse. The horseshoe's `p0` parameter is your prior on sparsity, and it should be set by domain knowledge ("for a brand in this category with this channel mix, roughly how many channels typically drive independent effects?") rather than by what makes the ROAS look good.

What you don't want to do is fit with flat priors, notice that several channels have suspiciously large or erratic estimates, and then retroactively add shrinkage. That's the Bayesian equivalent of dropping variables after seeing the coefficients — specification search by another name.

The honest pre-specification question is: do I believe this media mix genuinely has fifteen distinct, independently contributing channels? If your honest answer is "probably not — there's TV, digital video, and several social channels that probably operate similarly and might not all be separable," then the horseshoe prior encodes that belief in a principled way, and the posterior will confirm or challenge it.

## The practical payoff

In my experience with large channel-count MMMs, shrinkage priors do two things that flat priors don't:

1. **They stabilize attribution.** When you add or remove a control variable, channel attributions under a horseshoe prior move less than under flat priors. The shrinkage is doing some of the work of regularization that would otherwise be left to the data, which isn't informative enough to do it alone.

2. **They make the uncertainty honest.** A channel with a horseshoe posterior concentrated near zero doesn't get reported as "ROAS = 0.3, so it's technically positive." It gets reported as "the model doesn't find evidence for this channel, posterior is concentrated below 0.5× with a long tail." That's a different conversation with a client than "this channel has a low ROAS," and it's the right one.

The [`mmm-framework`](https://github.com/redam94/mmm-framework) model architecture is designed to make the prior declarations explicit and swappable — the adstock and saturation priors are configured, not baked in. Adding a horseshoe prior on channel contributions is the same kind of decision: declare it, reason about it, commit to it.

Wide, flat priors are not neutral. They're a strong prior that every channel effect is equally plausible at any scale, and in a sparse world they're wrong. When you have fifteen channels and two years of data, the question isn't whether to regularize — it's whether to do it explicitly or by accident.

---

_The regularized horseshoe prior is introduced in Piironen & Vehtari (2017), "Sparsity information and regularization in the horseshoe and other shrinkage priors," Electronic Journal of Statistics 11(2). The original horseshoe is Carvalho, Polson & Scott (2010), "The horseshoe estimator for sparse signals," Biometrika 97(2). Collinearity among predictors is covered in [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/). The pre-specification discipline this fits into is described in [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/)._
