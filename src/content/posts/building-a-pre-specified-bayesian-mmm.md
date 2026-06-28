---
title: "Building a Pre-Specified Bayesian MMM"
author: Matthew Reda
pubDatetime: 2026-06-26T04:00:00Z
slug: building-a-pre-specified-bayesian-mmm
draft: false
tags:
  - bayesian
  - marketing-mix-modeling
  - pymc
  - measurement
description: Most marketing mix models are tuned until the numbers flatter the brief. Here's the case for pre-specifying the model instead, and how mmm-framework builds the discipline into its API.
---

Most marketing mix models are not estimated. They are negotiated.

The workflow looks like science: load the data, fit a model, look at the channel coefficients. But then the adstock decay gets nudged because TV "should" carry over longer. A control gets added because the trend looked off. The saturation curve gets swapped because diminishing returns kicked in too early. Each move is individually defensible. Collectively, they are how you arrive at an answer that confirms what the deck already said.

I built [`mmm-framework`](https://github.com/redam94/mmm-framework) — it's [on PyPI](https://pypi.org/project/mmm-framework/) with [hosted docs](https://redam94.github.io/mmm-framework/) — around the opposite premise. Pre-specify the likelihood, the priors, and the identification strategy. Fit once. Report the posterior. Then go validate it against something the model didn't see. The whole framework is organized to make that the path of least resistance.

## Why specification shopping is worse than it looks

The problem isn't that analysts are dishonest. It's that iterating on a specification until results "look right" quietly inflates the false-positive rate and produces intervals that don't mean what they claim. When you adjust lags, decay rates, and controls in response to the coefficients you see, the reported uncertainty no longer reflects the actual uncertainty — it reflects the subset of specifications that survived your eyeballing. Your 90% interval has been conditioned on the outcome.

Specification shopping is the fastest way to get an answer that flatters the brief and survives nothing.

The fix is procedural, not statistical. You commit to the model before you see what it says about your channels. Pre-specification reduces researcher degrees of freedom, Bayesian inference gives you genuine uncertainty through the posterior instead of a point estimate dressed up with a standard error, and holdout or experimental validation tells you whether the thing generalizes. None of these is novel. The contribution is wiring them together so the disciplined path is also the convenient one.

## What you pre-specify

A marketing mix model is a few well-understood transforms stacked under a likelihood. The framework makes each one an explicit, declared choice rather than a knob you twist mid-analysis.

**Adstock** captures carryover — the fact that a flight of advertising keeps working after it airs. The geometric form is a one-parameter recurrence:

$$x^{\text{adstock}}_t = x_t + \alpha \, x^{\text{adstock}}_{t-1}, \qquad \alpha \in [0, 1)$$

where $\alpha$ is the retention rate and `l_max` caps how many periods back the carryover reaches. You declare a prior on $\alpha$; you don't hand-pick it because the curve looked nicer at 0.6.

**Saturation** captures diminishing returns — the tenth GRP buys less than the first. The default `BayesianMMM` uses the concave logistic form:

$$f(x) = 1 - e^{-\lambda x}$$

with the half-saturation point at $\ln 2 / \lambda$. When you genuinely believe in an S-shape (slow start, then acceleration), there's a Hill alternative,

$$f(x) = \frac{x^{n}}{x^{n} + \kappa^{n}}$$

which is hyperbolic at $n = 1$ and S-shaped for $n > 1$. The point is that the shape is a hypothesis you commit to, not a free parameter you fish with.

In practice you assemble these through fluent builders, so the specification reads like the model card it should be:

```python
from mmm_framework import (
    ModelConfigBuilder,
    MediaChannelConfigBuilder,
    BayesianMMM,
)

config = (
    ModelConfigBuilder()
    .with_kpi("sales", log_transform=True)
    .with_media_channel(
        MediaChannelConfigBuilder()
        .with_name("tv")
        .with_adstock(alpha_prior=(1, 3), l_max=8)   # Beta(1,3): short carryover prior
        .with_saturation(lam_prior=(1, 2))
        .build()
    )
    .with_seasonality(yearly=True, n_fourier=2)
    .with_trend(trend_type="linear")
    .build()
)

model = BayesianMMM(X_media=..., y=..., channel_names=..., config=config)
results = model.fit(draws=2000, tune=1000, chains=4, nuts_sampler="numpyro")
```

That config object _is_ the pre-registration. It exists before `fit()` runs. Trend can be linear, piecewise, B-spline, or a Gaussian process; seasonality is Fourier harmonics you choose up front. Everything that would otherwise be a mid-analysis temptation is a field you set while you can still be honest about it.

## Hierarchy instead of one knob per geography

If you have DMAs or stores or products, you don't fit them independently (too noisy) and you don't pool them into one national number (too biased). You partial-pool: each unit gets its own coefficients, shrunk toward a shared distribution by an amount the data decides.

```python
config = (
    ModelConfigBuilder()
    .with_kpi("transactions")
    .with_hierarchical(
        HierarchicalConfigBuilder()
        .with_geo_dimension("dma")
        .with_partial_pooling(True)
        .build()
    )
    # ... channels ...
    .build()
)
```

This is where Bayesian machinery earns its keep. The thin-data DMAs borrow strength from the rest; the data-rich ones stay close to their own evidence. You get one coherent model with honest per-geo uncertainty instead of fifty fragile regressions.

## Contributions with intervals, because the point estimate is the least interesting number

When the model is fit, the question is "what did each channel contribute, and how sure are we?" The framework computes counterfactual contributions across the full posterior:

```python
contributions = model.compute_contributions()
print(contributions.mean_contributions)
print(contributions.hdi_contributions)   # 94% highest-density intervals
```

HDIs, not point estimates. A channel whose contribution interval comfortably spans zero is a channel you cannot responsibly claim is working — and the model says so, instead of handing you a single number that begs to be put in a slide. The same posterior drives scenario planning: budget-reallocation simulations come out as distributions of outcomes, not a single optimized line that pretends the future is deterministic.

For harder questions — does media work _through_ brand awareness, do promotions on one SKU cannibalize another — the `mmm_extensions` module adds nested mediated pathways (Media → Awareness → Sales), multivariate outcomes with LKJ-priored correlated errors, and cross-product halo and cannibalization effects. Same discipline, more structure: you declare the causal graph before you fit it, including which channels are even allowed to build awareness.

## How the discipline ships

A method nobody can run is a method nobody uses. So the framework wraps the library in a FastAPI agent API (`mmm_framework.api.main:app`, fits run in-process) and a React studio that walks through data upload, config building, fitting, and results. That surface matters because it makes the _configuration_ a visible, sharable artifact — the specification gets reviewed before the fit, which is exactly when review is worth anything. But it's plumbing. The discipline is the point; the UI just lowers the cost of practicing it.

## The takeaway

Before your next model, write the spec down — priors, transforms, controls, and the holdout window — and have someone who isn't invested in the answer read it. Then fit it once and report what comes out. If the answer's boring, that's still the answer. A model you can't shop is a model someone can actually trust.
