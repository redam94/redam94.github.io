---
title: "Adstock and Saturation Are Not Separately Identified"
author: Matthew Reda
pubDatetime: 2026-07-02T13:12:17Z
slug: adstock-saturation-identification
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - regression
description: Adstock and saturation are the two transforms at the heart of every MMM response curve — and the data almost never identifies them separately. Here's the ridge in the posterior and what it means for your media strategy.
---

Every marketing-mix model rests on two structural transforms, stacked in sequence: an adstock function that spreads the effect of media spending across time, and a saturation function that bends the relationship between exposure and response. Get them right and the model is a reasonable hypothesis about how media works. Get them wrong — or, more precisely, fail to notice that you can't tell them apart — and you end up with confident ROAS numbers that depend more on which combination you assumed than on anything in the data.

This is not an exotic failure. It's the structural default.

## The two transforms, briefly

**Adstock** captures the fact that advertising has memory. A TV flight doesn't stop influencing sales the week it airs; awareness lingers. The geometric form is a one-parameter recurrence:

$$x^{\text{adstock}}_t = x_t + \alpha \, x^{\text{adstock}}_{t-1}$$

where $\alpha \in [0, 1)$ is the retention rate. High $\alpha$ means long carryover — the campaign echoes for weeks. Low $\alpha$ means the effect is mostly immediate.

**Saturation** captures diminishing returns — the hundredth GRP buys less incremental awareness than the first. A common form is the Hill function:

$$f(x) = \frac{x^n}{x^n + \kappa^n}$$

where $\kappa$ is the half-saturation point (the spend level at which you're half-way to the ceiling) and $n > 1$ produces an S-shape. In the `mmm-framework` [pre-specification workflow](/posts/building-a-pre-specified-bayesian-mmm/), you declare both $\alpha$ and $\kappa$ as prior distributions before fitting — the point being to commit to a hypothesis about the response curve rather than to fish for one after you see the ROAS.

Both steps are sensible. The problem is what happens when you try to estimate them together from the same time series.

## The ridge

The full model chains these transforms:

$$\text{sales}_t = \beta \cdot f\!\left(x^{\text{adstock}}_t\right) + \text{baseline}_t + \varepsilon_t$$

where $\beta$ is an overall channel coefficient, $f(\cdot)$ is the saturation function applied to the adstock-transformed spend, and baseline absorbs seasonality and controls. The parameters you're estimating jointly include $(\alpha, \kappa, \beta)$ — and they do not live in independent dimensions of the likelihood.

The problem is easy to see when you hold $\kappa$ fixed and vary $\alpha$. A higher retention rate means more effective exposure accumulates — the adstock series is larger on average. To fit the same sales data, $\beta$ has to be smaller. A lower retention rate means the effective exposure is smaller — and $\beta$ has to be larger to compensate. These tradeoffs trace a ridge in the $(\alpha, \beta)$ joint posterior:

```python
import pymc as pm
import numpy as np

# Illustrate the ridge: flat prior on alpha produces a wide, correlated posterior
spend = np.array(...)   # weekly media spend data
sales = np.array(...)   # weekly sales

with pm.Model() as ridge_model:
    alpha = pm.Beta("alpha", alpha=1, beta=1)       # flat: no information
    beta  = pm.HalfNormal("beta", sigma=1.0)
    kappa = pm.HalfNormal("kappa", sigma=spend.mean())

    # Geometric adstock via scan
    adstocked, _ = pm.scan(
        fn=lambda s_prev, x: x + alpha * s_prev,
        sequences=[spend],
        outputs_info=[np.float64(0.0)],
    )

    # Hill saturation (n=1 for simplicity)
    saturated = adstocked / (adstocked + kappa)

    baseline = pm.Normal("baseline", mu=sales.mean(), sigma=sales.std())
    sigma    = pm.HalfNormal("sigma", sigma=sales.std())
    pm.Normal("sales_obs", mu=beta * saturated + baseline, sigma=sigma, observed=sales)

    trace = pm.sample(1000, tune=1000, target_accept=0.9)

# The joint posterior of (alpha, beta) will be a long, tilted ellipse
# az.plot_pair(trace, var_names=["alpha", "beta"], kind="kde")
```

If you run this and look at `az.plot_pair(trace, var_names=["alpha", "beta"])`, you'll see a long, negatively-sloped ellipse — the same shape as collinearity between two correlated predictors. [Collinearity in the covariate space](/posts/collinearity-cant-separate/) and a ridge in the transform parameter space are the same inferential problem: the data isn't informative enough to separate two effects, so the posterior stretches across a manifold of equally-plausible combinations.

The same ridge exists between $\kappa$ and $\beta$. A smaller half-saturation point means saturation kicks in sooner, so $\beta$ needs to be smaller to hit the same sales level. A larger $\kappa$ means you're still in the linear part of the curve over your typical spend range, and $\beta$ has to carry more weight. These trade off too.

## Why this matters for media planning

If the ridge were just a statistical nuisance — wide intervals you had to report — it would be annoying but manageable. The problem is that different points along the ridge imply qualitatively different strategies.

**High $\alpha$, lower $\beta$**: Most of the media effect is carryover. A burst campaign that airs for four weeks continues paying off for months. The optimal strategy is concentrated flighting with long dark periods to let the carryover accumulate.

**Low $\alpha$, higher $\beta$**: The effect is mostly immediate. A burst dies quickly and doesn't pay off afterward. The optimal strategy is always-on, lower-intensity spend that keeps the stimulus present every week.

These are not small differences in budget allocation. They're opposite media philosophies — and they can fit the same historical data equally well. A model that's ambiguous about $\alpha$ is ambiguous about whether you should burst or flatten, regardless of how confident it looks about your aggregate ROAS.

[Simulation-Based Calibration](/posts/simulation-based-calibration/) surfaces this exactly: "A retention rate that fails with an arch distribution is a parameter your model is too confident about... A half-saturation parameter that fails with a bias is one where the likelihood surface has a systematic asymmetry." Both failure modes can coexist in the same model — adstock overconfident in one direction, saturation biased in another, the product plausible to the diagnostics.

## What breaks the ridge

Three things can separate these parameters:

**Dark periods.** A week of zero spend is maximally informative about adstock: you can observe how fast sales revert to baseline with no new stimulus. If you always spend on a channel, the adstock series never decays to zero in the data and you can't see the decay rate. Budget blackout periods — even planned, short ones — are genuinely informative, not just wasted weeks.

**Variation in spend levels.** Saturation is only visible when you spend across a wide range — ideally including both the linear region and the zone where the curve bends. If your spend always sits in roughly the same bucket, the saturation curve is extrapolated rather than identified. Flighting tests that deliberately vary spend levels — including spending well below and above the typical range — let the curve shape speak.

**Informative priors from domain knowledge.** This is the most practically accessible lever. Industry evidence consistently puts TV adstock in the range of 0.5–0.8 retention per week; paid search is closer to 0.0–0.1; social falls in between. These aren't made up. They come from controlled holdout studies and category-level meta-analyses. Encoding them as a Beta prior on $\alpha$ narrows the ridge without forcing the model to a single point. The posterior still reflects what's uncertain; it just uses the prior to orient the ridge toward plausible values. ([What Decades of Marketing Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/) summarizes the calibrated decay ranges by channel type.)

## The honest output

If you run SBC on an MMM with flat priors on $\alpha$ and $\kappa$ and a typical short media time series, the rank histograms for both parameters will be non-uniform — often in opposite directions. The practical takeaway isn't "this model is broken." It's: these parameters require prior information, and that prior information should be declared explicitly and attributed to its source rather than baked in silently through a "reasonable-looking" point estimate.

The joint posterior of $(\alpha, \kappa)$ is the finding. Not the marginal means, but the shape and orientation of the ridge — which tells you what combinations of carryover and saturation the data can and can't rule out. A model that reports a single retention rate and a single half-saturation constant without showing the joint distribution is hiding the uncertainty that actually governs the strategy recommendation.

Committing to an $\alpha$ before fitting — as the `mmm-framework` [pre-specification discipline](/posts/building-a-pre-specified-bayesian-mmm/) requires — is not a limitation. It's the acknowledgment that this parameter needs to come from somewhere, and it's better for that somewhere to be the literature than to be the number that happened to give you the ROAS the deck needed.

---

_Related: [Simulation-Based Calibration](/posts/simulation-based-calibration/) covers how to test whether your model recovers these parameters under simulation. [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/) shows how `mmm-framework` handles adstock and saturation as declared prior distributions. [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/) covers the same structural problem in the predictor space._
