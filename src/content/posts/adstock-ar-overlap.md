---
title: "Two Carryovers Is One Too Many: The Adstock-AR(1) Overlap in Brand Funnel Models"
author: Matthew Reda
pubDatetime: 2026-07-19T13:13:23Z
slug: adstock-ar-overlap
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - brand-tracking
  - statistics
description: When a brand-awareness mediator has AR(1) dynamics, applying adstock to the media input creates two overlapping carryover mechanisms — producing an α↔ρ ridge the data can't resolve.
---

When I wrote about [adstock and saturation not being separately identified](/posts/adstock-saturation-identification/), the ridge was between the decay rate and the saturation shape — two transforms stacked on the same spend series, both trying to explain the same slow variation in sales. The fix was informative priors, dark periods, or spend variation that broke the degeneracy.

There's a closely related problem that shows up specifically in brand-funnel models, and it has a cleaner resolution. If you model brand awareness as a dynamic latent state — the right move, for reasons I'll get to — and you also apply adstock to the media inputs that drive it, you now have two carryover mechanisms in the same pathway. Both are geometric. Both produce slow-moving, autocorrelated signals. And the tracker data can't tell them apart.

## Two different things called "carryover"

Adstock captures one kind of carryover: the media effect itself lingers after spend stops. A TV flight airs in weeks 1–4 and awareness keeps rising through week 6, because it takes time for the message to saturate the audience. This is the mechanism adstock was designed to model — the geometric decay is in the *media effect*, not in the underlying population state.

AR(1) dynamics on a mediator capture something different: population-level persistence. Brand awareness is sticky not because the media is still running, but because people who knew the brand last week mostly still know it this week. This is a property of the *audience state*, independent of whether any media ran. If you run a burst campaign and go dark, adstock says the effect decays; AR(1) says the population who saw it mostly remembers.

Both are real phenomena. The problem is that both produce the same observable signature in weekly tracker data: slow, autocorrelated movement in the latent awareness level. With both in the model simultaneously:

$$z_t = \rho \cdot z_{t-1} + \beta \cdot \text{sat}\!\left(x^{\text{adstock}}_t\right) + \sigma \varepsilon_t$$

the model has to explain the slow variation in $z_t$ using *two* geometric decay parameters — $\alpha$ (the adstock retention rate) and $\rho$ (the AR(1) persistence). High $\alpha$ with lower $\rho$ can produce the same fitted awareness series as low $\alpha$ with higher $\rho$. That's a ridge in the $(\alpha, \rho)$ joint posterior — the same failure mode as $(\alpha, \beta)$ in a standard MMM, with the same consequence: both estimates are driven more by the priors than by the data.

This is the warning that the [`mmm-framework`'s `StructuralNestedMMM`](https://github.com/redam94/mmm-framework) bakes in explicitly:

> Adstock × AR warning: building an AR1/RW mediator with `apply_adstock=True` on its channels warns — two nearly-interchangeable geometric carryovers create an α↔ρ ridge.

## What the ridge looks like

The covariance is negative and strong. A joint posterior plot of $(\alpha, \rho)$ from a model with both mechanisms active will show a long, negatively-sloped ellipse — exactly the shape you get in the $(\alpha, \beta)$ ridge in a plain MMM. The marginal distributions on each parameter are wide; the individual point estimates are not pinned by the data.

[Simulation-Based Calibration](/posts/simulation-based-calibration/) surfaces this clearly. Draw from the priors, simulate tracker data, fit, compute ranks. For $\alpha$ and $\rho$, the rank histograms will be non-uniform — typically an arch or shifted pattern depending on which mechanism dominates in the simulated data. The sampler converges. R-hat is fine. The posteriors are wrong.

The failure is not in the MCMC; it's in the model structure. Two parameters are trying to explain the same thing, and the data — weekly survey counts from a tracker with $n_t \approx 80$ interviews — doesn't contain nearly enough information to separate them.

## The design rule: pick one carryover mechanism per pathway

The resolution is to choose exactly one carryover mechanism for each pathway in the model, based on what is being modeled:

- **Media → AR(1) mediator** (e.g. TV → brand awareness): use AR(1) dynamics on the mediator, no adstock on the input. The AR(1) state handles all carryover — media spend this week lifts the state, which then persists via ρ. Applying adstock on top would be double-counting.

- **Media → direct sales** (e.g. paid search): use adstock as usual. There is no latent state to carry the effect, so the decay must be in the spend series.

In PyMC, an awareness mediator following this rule looks like:

```python
with pm.Model():
    # Saturation only — no adstock applied to channels routing through AR(1) mediators
    kappa_tv = pm.HalfNormal("kappa_tv", sigma=spend_tv.mean())
    sat_tv = spend_tv / (spend_tv + kappa_tv)          # logistic, simplified

    # AR(1) awareness state — non-centered parameterization
    rho = pm.Beta("rho_awareness", alpha=6, beta=2)    # strongly persistent prior
    sigma_innov = pm.HalfNormal("sigma_innov", sigma=0.3)
    eps = pm.Normal("eps_awareness", mu=0, sigma=1, shape=T)

    beta_tv = pm.HalfNormal("beta_tv_on_awareness", sigma=1.0)
    level = pm.Normal("level_awareness", mu=0, sigma=2)

    # AR(1) recursion (simplified; see mmm-framework for the Toeplitz implementation)
    innovations = beta_tv * sat_tv + sigma_innov * eps
    z = level + pt.extra_ops.cumsum(rho ** pt.arange(T)[:, None] * innovations)

    # Binomial tracker observation
    p = pm.Deterministic("awareness_p", pm.math.invlogit(z))
    obs = pm.Binomial(
        "tracker_obs", n=n_interviewed, p=p, observed=y_tracker
    )
```

The AR(1) persistence is now fully identified by the tracker observations — the binomial likelihood pins the *level* of the latent state (as I covered in [Bayesian Brand Tracking](/posts/bayesian-brand-tracking/)), and the *dynamics* are identified by how fast the state moves relative to the innovations. There's no second decay parameter competing with ρ.

## Why this matters for how you read the model

The choice between adstock and AR(1) is not just a technical modeling decision — it implies a different theory of how media works.

**Adstock-only (no AR(1) mediator)**: Carryover is in the media effect. When spend stops, the effect decays at rate α. If α = 0.7 (a typical TV prior), the effect is roughly halved every three weeks. This is the "media effect echo" story — the campaign is gone, but the audience's response hasn't fully dissipated.

**AR(1) mediator (no adstock)**: Carryover is in the population state. When spend stops, the state persists at rate ρ, because most people who were aware last week are still aware this week. If ρ = 0.9 (consistent with brand awareness tracking), the state has a 10-week half-life that's entirely independent of the media cadence.

These imply different things about the value of dark periods. High α (adstock model) says dark periods are costly — the echo fades. High ρ (AR(1) model) says short dark periods are cheap — the state doesn't decay much in a few weeks. If you have both mechanisms and they're confused, you can't answer the "what if we go dark for a month?" question reliably.

## The latent demand problem, briefly

There's one more confounder worth flagging in brand-funnel models: if a latent demand trend drives *both* consideration and sales (people's underlying category interest is up, so they notice media more and they also buy more), leaving it out creates a spurious mediated path. The model sees consideration rising with sales and attributes causation to a common cause. This is the back-door through the mediator, and the remedy — a shared latent factor constrained to enter both the mediator equation and the outcome equation — is precisely what the `StructuralNestedMMM` is built to handle. But that's a post for another day.

## Takeaway

Adstock and AR(1) are both legitimate carryover models, designed for different mechanisms. Adstock belongs on the spend series when carryover is a property of the media effect. AR(1) belongs on the mediator state when carryover is a property of the audience. Applying both to the same pathway creates a parameter ridge that tracker data won't resolve, produces posteriors driven by priors rather than evidence, and quietly ruins the strategic interpretation of your model.

Pick one. Commit to the story it tells. Then the model can actually answer questions about flighting strategy instead of averaging over two confounded theories of carryover.

---

_This post is grounded in the design of [`mmm-framework`'s `StructuralNestedMMM`](https://github.com/redam94/mmm-framework) (see `technical-docs/structural-nested-mmm.md`, §4.1 and §4.3). Related posts: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) covers the α↔β ridge in a plain MMM. [Bayesian Brand Tracking, Honestly](/posts/bayesian-brand-tracking/) covers the binomial observation model. [Simulation-Based Calibration](/posts/simulation-based-calibration/) is the test that surfaces ridge failures._
