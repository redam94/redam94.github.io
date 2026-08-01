---
title: "The Mediator Trap: Why Adding Brand Tracking to Your MMM Doesn't Capture What It's Doing"
author: Matthew Reda
pubDatetime: 2026-08-01T13:15:27Z
slug: mediator-trap-brand-tracking
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - causal-inference
description: Adding brand consideration as a covariate in your sales regression blocks the indirect path from media to sales — here's the structural fix and how to handle monthly trackers in a weekly model.
---

Most marketing mix models I've built end up in one of two camps on brand tracking data. The first camp leaves awareness out entirely and treats media as a direct driver of sales. Clean, defensible, and it loses information about the mechanism. The second camp adds the tracker — monthly consideration scores, weekly awareness percentages — as an additional covariate alongside media spend, hoping the model will sort out how everything relates.

The second camp asks a different question than you think it's asking, and gets a misleading answer.

## What you're actually estimating when you add awareness as a covariate

When brand consideration $A_t$ is on the right-hand side of your sales regression alongside media spend $M_t$, you're asking the sampler to estimate the effect of $M_t$ on sales *holding consideration fixed*. That's the direct effect of media: the part that drives a purchase this week, through channels that don't pass through awareness.

The problem is that's usually not what you wanted. You wanted the **total effect** of media — the direct piece plus the part that works by building brand consideration, which then drives purchase down the line. Conditioning on $A_t$ in the regression closes the indirect path. The coefficient on media shrinks toward zero by exactly the fraction of media's total effect that operates through awareness.

This is the mediator problem. $A_t$ sits on the causal path from $M_t$ to $Y_t$, and conditioning on it in the regression blocks that path. It's the same structural mistake as controlling for the mechanism instead of the confounder — I described the general version in [The Table 2 Fallacy in MMMs](/posts/table-2-fallacy-in-mmm/), and the mediator case is a specific instance of it.

## Drawing the structure

Media affects sales through (at least) two distinct paths:

1. $M_t \to Y_t$ — the direct path: salience, in-period activation, immediate purchase response
2. $M_t \to A_t \to Y_t$ — the indirect path: brand building, consideration shift, future purchase probability

A traditional MMM estimates one coefficient that absorbs both paths together. That's useful for total ROAS but tells you nothing about *how* the channel is working or on what timescale. Adding $A_t$ as a covariate isolates path 1 but kills path 2 — you're optimizing the direct effect while declaring victory on the total.

The structural fix is to model both paths explicitly:

**Awareness stage** (how media shifts consideration):
$$A_t = \alpha_A + \gamma \cdot f(M_t) + \varepsilon_t^A$$

**Sales stage** (how awareness and media drive revenue):
$$Y_t = \alpha_Y + \delta \cdot f(M_t) + \beta \cdot A_t + \varepsilon_t^Y$$

Here $f(M_t)$ is the adstocked, saturated media term — the same transformation as in a standard MMM. The parameters:

- $\delta$ = **direct effect**: media's sales lift independent of awareness shifts
- $\gamma$ = **awareness elasticity**: how much media moves consideration
- $\beta$ = **consideration-to-sales conversion**: how much each point of consideration drives revenue
- $\gamma \beta$ = **indirect effect**: the brand-building contribution
- $\delta + \gamma \beta$ = **total effect** — what a traditional MMM estimates as one number

Fitting both equations jointly, with both the awareness observations and the sales observations informing the shared parameters, is what the [`mmm-framework`](https://github.com/redam94/mmm-framework) extension module implements as a `NestedModel`. You declare the mediator and its observation type; the two-equation structure follows.

## The partial observation problem

Here's where implementation gets interesting. Brand tracking surveys rarely match the temporal resolution of the MMM. The model runs weekly; the tracker fields monthly, or bi-weekly, or quarterly. You have $A_t$ for a handful of weeks, not all of them.

The naive response is to interpolate — fill the gaps with the nearest observed value or a smooth trend, and hand the completed series to the sales regression. This is better than nothing and worse than it looks: interpolated values are treated as observed data, and the uncertainty in the unobserved gaps disappears from the model.

The right structure is a state-space model for awareness. Between survey waves, the latent consideration level $A_t^*$ evolves as a random walk:

$$A_t^* = A_{t-1}^* + \eta_t, \qquad \eta_t \sim \mathcal{N}(0, \sigma_\eta^2)$$

On weeks when the tracker is fielded, you observe it with Binomial noise (the observation model I covered in [Bayesian Brand Tracking, Honestly](/posts/bayesian-brand-tracking/)):

$$y_t^{\text{tracker}} \sim \text{Binomial}(n_t,\, \text{logistic}(A_t^*)) \quad \text{when tracker is fielded}$$

On non-tracker weeks, the state propagates forward without an observation update. The sales model then conditions on the posterior latent level $A_t^*$ rather than a hand-filled series. The uncertainty in unobserved weeks gets propagated correctly.

In PyMC, the skeleton looks like this:

```python
with pm.Model():
    sigma_awareness = pm.HalfNormal("sigma_awareness", 0.1)
    awareness_latent = pm.GaussianRandomWalk(
        "awareness_latent", sigma=sigma_awareness, shape=T
    )

    # Tracker observation model — only on fielded weeks
    tracker_idx = np.where(tracker_fielded)[0]
    p_tracker = pm.Deterministic(
        "p_tracker", pm.math.invlogit(awareness_latent[tracker_idx])
    )
    _ = pm.Binomial(
        "tracker_obs",
        n=n_interviews[tracker_idx],
        p=p_tracker,
        observed=positive_responses[tracker_idx],
    )

    # Awareness stage: media shifts the latent state
    gamma = pm.Normal("gamma_awareness", 0, 0.5)
    awareness_driven = awareness_latent + gamma * adstocked_media

    # Sales stage: direct and awareness-mediated effects
    delta = pm.Normal("delta_direct", 0, 0.5)
    beta_awareness = pm.Normal("beta_awareness", 0, 0.5)
    mu_sales = delta * adstocked_media + beta_awareness * awareness_driven + baseline
    _ = pm.Normal("sales", mu=mu_sales,
                  sigma=pm.HalfNormal("sigma_sales", 1), observed=revenue)
```

This is more to fit, but you get two things back that a traditional model can't provide: a posterior over the latent awareness trajectory (useful on its own for brand monitoring), and a decomposition of media's effect into the portion that goes through brand and the portion that doesn't.

There's also a third option the mmm-framework makes explicit: a **latent mediator**, where you have *no* tracker data at all but believe the awareness pathway exists based on domain knowledge. You can include a latent state that evolves as a function of media inputs and use the temporal patterns in the sales response to partially constrain its contribution. The identification is weaker than when you have survey data, but representing the pathway explicitly is still better than forcing all media response into the direct channel — it reflects what you believe about the mechanism, and the wide posteriors you get tell you honestly what the data can and can't pin down.

## What it means for ROAS and planning

Separating direct from indirect effects changes how you measure and how you optimize. A channel with a large direct effect pays off within the current period — its ROAS is well-measured by a short geo lift test and responds quickly to budget changes. A channel with a large indirect effect builds slowly and decays slowly — its ROAS depends on the awareness trajectory you're willing to attribute to it, and a two-week geo test will systematically understate it.

If you report a total media effect but claim "we measured this with a geo-experiment," you're attributing the brand-building portion of the lift to a window almost certainly too short to capture it. Knowing the split between $\delta$ and $\gamma\beta$ tells you which measurement approach is appropriate for each channel, and how to frame budget reallocation conversations that mix brand and activation objectives.

## When the extra structure is worth it

Not every MMM needs two equations. If your tracker data is sparse and noisy, your media channels operate mostly on short timescales (performance digital, promotional events), and the business question is purely about in-period ROAS, the nested model adds degrees of freedom that the data can't fill. You'll get wide, uninformative posteriors on $\gamma$ and $\beta$ separately, even if their product $\gamma\beta$ is sensible.

The cases where this structure pays for itself: categories where brand salience genuinely governs purchase timing (insurance, finance, high-consideration CPG), campaigns running long enough for awareness to shift measurably, and conversations where you need to separately defend brand-building versus activation budgets. Those conversations require separate estimates of the two paths. You can't back them out from a single-equation MMM after the fact, and you can't derive them honestly by adding awareness as a covariate.

---

_Nested and mediated model support is in the [`mmm-framework`](https://github.com/redam94/mmm-framework) extension module. The brand tracker observation model (Binomial likelihood, small-sample handling) is covered in [Bayesian Brand Tracking, Honestly](/posts/bayesian-brand-tracking/). Measurement error in noisy covariates — related but distinct from the mediator problem — is in [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/). The general principle of not conditioning on mediators is the [Table 2 Fallacy](/posts/table-2-fallacy/)._
