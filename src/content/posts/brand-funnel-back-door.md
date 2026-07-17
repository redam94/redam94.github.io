---
title: "Your Brand Funnel Has a Back Door"
author: Matthew Reda
pubDatetime: 2026-07-17T13:13:36Z
slug: brand-funnel-back-door
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - causal-inference
  - statistics
description: Fitting awareness and sales in two sequential stages looks sensible but leaves a back door open — a latent demand factor that drives both the mediator and the outcome, and that sequential models can never close.
---

The workflow I see most often when brand health data enters a marketing mix model goes like this: fit a tracker model to the survey data, export the posterior mean as a weekly consideration time series, and plug that series into the MMM as a covariate. The logic sounds right — TV builds awareness, awareness drives consideration, consideration drives sales, so you need brand health in the model to properly decompose the TV effect. Get it in there, and the funnel is captured.

That causal story is correct. The execution has two distinct problems, and only one of them is commonly discussed.

## The attenuation problem you've probably heard of

Plugging a posterior mean into a downstream model throws away the uncertainty in the upstream estimate. The downstream model sees a precise number instead of a distribution, attenuates the consideration coefficient toward zero, and gives the illusion that funnel effects are smaller than they are. I covered the mechanics in [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/) — the reliability ratio $\lambda = \sigma_{x^*}^2 / (\sigma_{x^*}^2 + \sigma_u^2)$ tells you exactly how much of the true coefficient you're recovering, and for a weekly tracker with a sample of 80 it can be as low as 0.3.

The fix is to fit the tracker model and the sales model jointly, so the latent consideration level is a shared quantity constrained by both observation types simultaneously. No plug-in step, no variance swallowed at the seam.

That's real, and worth fixing. But there's a second problem that attenuation doesn't capture, and it's the one I want to focus on here.

## The back door

Suppose the true data-generating process looks like this:

- TV spend drives latent awareness, which accumulates into consideration, which drives sales
- A latent demand factor — category seasonality, macro conditions, whatever is making people want the product right now — also drives consideration (people are more brand-attuned during high-demand periods) and also drives sales directly

As a graph:

```
TV  ──────────→ awareness → consideration → sales
                                               ↑
latent demand ──→ consideration ───────────────┘
```

When you fit `sales ~ consideration + controls` in a second-stage model without ever modeling latent demand, the consideration coefficient picks up both the genuine mediated pathway and the back-door correlation — demand lifts consideration and lifts sales through its own direct path, and the model attributes that correlation to the funnel. The bias runs in a predictable direction: consideration looks more valuable than it is, because it's proxying demand.

This is not academic. If you use the model to evaluate TV investments — "TV → awareness → consideration → sales at this ROI" — and part of that ROI is demand-driven rather than TV-driven, you'll overestimate the funnel's contribution and misallocate against it when demand softens and consideration drops for reasons that have nothing to do with your media.

## Why AR(1) dynamics aren't adstock

There's a modeling subtlety that compounds the problem. In a standard MMM, media enters through an adstock transform: spend this week contributes to an exponentially-decaying *input* series, which then hits a saturation curve and adds to sales. Adstock is a transform on the media variable.

Population awareness doesn't work that way. Awareness is a *state*. Most people who were aware of the brand last week are still aware this week — they didn't forget over the weekend. The right model is an autoregressive process on the latent awareness level itself:

$$z_t = \rho \cdot z_{t-1} + \beta \cdot \text{sat}(\text{TV spend}_t) + \sigma \varepsilon_t$$

where $z_t$ is the logit-scale latent awareness level, $\rho \in [0, 1)$ is population persistence, and the Binomial tracker observes $p_t = \sigma(z_t)$. Media this week lifts the state; the state decays via $\rho$.

The two formulations produce different strategic implications. Adstock implies two identical TV flights have identical effects regardless of the baseline awareness level — the brand has no memory between campaigns. AR(1) dynamics imply the opposite: a dark period lets awareness decay; a flight from a high-awareness baseline produces less incremental lift. Neither is obviously correct for all brands, but they're not the same model, and defaulting to adstock because it's what the MMM already has is not a principled choice.

There's also an identification hazard in stacking both: an adstock decay $\alpha$ and an AR(1) persistence $\rho$ on the awareness state are nearly interchangeable geometric carryovers. Applying adstock to the media input *and* AR(1) to the latent state that media drives creates a ridge between the two decay parameters with no experiment that naturally separates them. In the [`mmm-framework`](https://github.com/redam94/mmm-framework) `StructuralNestedMMM`, the rule is explicit: when a mediator has AR(1) or random-walk dynamics, the channels feeding it enter without adstock. The state supplies all the carryover; the media input provides only the impulse.

## The joint solution

The fix for both problems — the measurement-error attenuation and the latent demand back door — is to fit the whole funnel in one model:

```python
with pm.Model():
    # Latent demand factor: AR(1), shared across consideration and sales
    rho_d = pm.Beta("rho_d", alpha=8, beta=2)   # prior on high persistence
    eps_d = pm.Normal("eps_d", 0, 1, shape=T)
    demand = pm.Deterministic(
        "demand",
        pm.math.dot(
            pt.tril(pt.ones((T, T))) * rho_d ** pt.abs_(
                pt.arange(T)[:, None] - pt.arange(T)[None, :]
            ),
            eps_d,
        ),
    )

    # Awareness: AR(1) driven by TV, observed via Binomial tracker
    rho_aw = pm.Beta("rho_aw", alpha=6, beta=2)
    beta_tv = pm.HalfNormal("beta_tv", sigma=1.0)
    sat_tv = tv_spend / (tv_spend + pm.HalfNormal("kappa", sigma=tv_spend.mean()))
    # ... AR(1) scan over awareness latent state ...

    # Consideration: driven by awareness + demand, observed via Binomial
    gamma_aw = pm.HalfNormal("gamma_aw", sigma=1.0)   # positive causal path
    w_demand_c = pm.Normal("w_demand_c", 0, 1.0)       # demand → consideration

    # Sales: driven by consideration + demand + direct channels
    gamma_c = pm.HalfNormal("gamma_c", sigma=1.0)
    w_demand_y = pm.HalfNormal("w_demand_y", sigma=1.0)  # demand → sales (positive anchor)
```

Two identification decisions matter most here.

**Every measured mediator pins its own scale.** The consideration tracker is a Binomial model — the logit link and the per-week sample size anchor the latent consideration state absolutely. Without this anchor, the model is free to rescale the latent state and compensate in the coefficient product, leaving the decomposition of the funnel indeterminate. The tracker forces the latent level to match the observed probability, which pins the coefficient sizes.

**The latent demand factor must enter a measured mediator, not just the outcome.** A factor identified only through the outcome residual is effectively an unidentified noise absorber — the model can't tell whether the residual is demand-driven or just unexplained variance. Putting demand in both the consideration equation and the sales equation means the observed consideration series must be consistent with the factor's trajectory. The consideration data anchors the factor, which in turn lets the model genuinely separate "sales are high because consideration is high" from "sales are high because demand is high."

## What the joint model gives you that the sequential one doesn't

Running the full joint model is more expensive and requires you to think carefully about which common-cause factors exist and where to anchor their signs. That's real work.

What you get back is a decomposition you can actually trust: the mediated contribution of consideration to sales is net of the back-door demand path, not confounded with it. The TV attribution doesn't include the demand-driven awareness that would have occurred with or without the campaign. When you set budgets based on that decomposition, you're arguing about the causal effect of media on brand health and from brand health to sales — not a mixture of that and a latent factor that has nothing to do with your decisions.

The two-stage approach gives you a number that's fast to produce and easy to explain. It's just not the number you wanted.

---

_The measurement-error attenuation problem in chained models is covered in [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/). The brand tracker likelihood that pins the mediator scale is in [Bayesian Brand Tracking, Honestly](/posts/bayesian-brand-tracking/). The `StructuralNestedMMM` that implements the joint model — including AR(1) mediator dynamics, Binomial/Ordered observation families, and shared latent factors — is in the [mmm-framework](https://github.com/redam94/mmm-framework) under `mmm_extensions/models/structural.py`._
