---
title: "Adstock Is the Wrong Carryover Model for Brand Equity"
author: Matthew Reda
pubDatetime: 2026-07-23T13:17:23Z
slug: adstock-wrong-carryover-brand-equity
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - measurement
description: Applying adstock to a brand-equity mediator double-counts carryover with the latent state's AR(1) dynamics — creating a ridge the data can't resolve, and strategy recommendations that depend on which geometric kernel wins the posterior.
---

When you add a brand mediator to an MMM — routing TV through an awareness state on its
way to sales — the natural thing is to apply adstock to the media input, same as you
would for a direct-response channel. The problem is that adstock and the mediator's
latent state dynamics are both geometric carryover kernels, and two geometric kernels
doing the same job produce a ridge the data can't separate.

This isn't a theoretical concern. It's the reason the `StructuralNestedMMM` in
[mmm-framework](https://github.com/redam94/mmm-framework) defaults to turning adstock
_off_ for mediators with AR(1) or random-walk dynamics. The short version: carryover
in a brand funnel happens at the population-level equity stock, not at the media input
signal. Applying both mechanisms at once is double-counting.

## Two levels of carryover

For a direct-response channel like paid search, the carryover story is about the media
signal itself. Someone clicks an ad this week; they might purchase next week because of
it. The impression lingers at the individual level, decaying across exposures.
Geometric adstock with a short retention rate ($\alpha \approx 0.1$) models this
correctly — the exposure signal fades quickly.

For a brand equity state like awareness, the carryover story is different. A TV flight
this week raises the fraction of the population that is aware of the brand. Most of
those people will still be aware next week — not because they saw another ad, but
because awareness sticks. The _population-level stock_ carries over, largely independent
of the media signal that caused the initial lift.

These are different mechanisms, and they call for different models. The right model for
a brand equity state is an AR(1) latent state:

$$z_t = \rho \cdot z_{t-1} + \beta \cdot m_t + \sigma \varepsilon_t$$

where $z_t$ is the latent awareness level (on a standardized scale), $m_t$ is the
saturated media input this week, $\rho$ is the week-over-week persistence of the equity
stock, and $\sigma\varepsilon_t$ is innovation noise. A value like $\rho \approx 0.8$
reflects the fact that most people who were aware last week remain aware this week — the
stock decays slowly from its own inertia, not because of anything the media schedule does.

Carryover is already in the state equation. Adding adstock on top of $m_t$ introduces
a second geometric kernel with its own retention rate $\alpha$. Now you have two
nearly-interchangeable mechanisms:

- **High $\alpha$, low $\rho$**: the media signal lingers, but the awareness stock
  decays quickly.
- **Low $\alpha$, high $\rho$**: the media signal is immediate, but the stock
  accumulates and persists long after the campaign ends.

A sustained TV campaign produces similar fitted awareness trajectories under either
combination. The posterior stretches into a long $\alpha \leftrightarrow \rho$ ridge —
the same structural problem as the $\alpha \leftrightarrow \beta$ ridge in
[adstock/saturation identification](/posts/adstock-saturation-identification/), but now
inside the mediator's dynamics. The `mmm-framework` equifinality notes document this
as an explicit code-review finding: "building an AR1/RW mediator with `apply_adstock=True`
on its channels warns — two nearly-interchangeable geometric carryovers create an
α↔ρ ridge."

## In code

In PyMC, the AR(1) state for an awareness mediator — with no adstock on the media input
— looks roughly like this:

```python
import pymc as pm
import numpy as np

with pm.Model():
    # AR(1) persistence — prior favors high values for a durable brand stock
    rho = pm.Beta("rho_awareness", alpha=6, beta=2)

    # Media enters as saturated spend, NO adstock transform
    kappa = pm.HalfNormal("kappa_tv", sigma=spend_tv.mean())
    sat_tv = spend_tv / (spend_tv + kappa)   # saturation only

    # AR(1) state via non-centered innovation parameterization
    sigma_z = pm.HalfNormal("sigma_awareness", 0.3)
    eps = pm.Normal("eps_awareness", 0, 1, shape=T)

    beta_tv = pm.HalfNormal("beta_tv_awareness", 1.0)
    level = pm.Normal("level_awareness", 0, 2)

    z = pm.Deterministic("awareness_latent",
        level + pm.math.scan(
            fn=lambda m_t, eps_t, z_prev: rho * z_prev + beta_tv * m_t + sigma_z * eps_t,
            sequences=[sat_tv, eps],
            outputs_info=[0.0]
        )[0]
    )

    # Observation model: weekly survey counts pin the latent state's scale
    p = pm.Deterministic("awareness_prob", pm.math.invlogit(z))
    pm.Binomial("tracker_obs", n=n_interviews, p=p, observed=positives)
```

The `StructuralNestedMMM` in [mmm-framework](https://github.com/redam94/mmm-framework)
handles this automatically via its `MediatorSpec` config. Setting
`dynamics=MediatorDynamics.AR1` resolves `apply_adstock` to `False` by default — the
AR(1) recursion supplies all carryover and there's no adstock kernel to compete with it.
Forcing `apply_adstock=True` raises a warning and creates the ridge described above.

The scale of $z_t$ is identified by the tracker observations. With a Binomial
measurement (weekly survey counts with varying sample size $n_t$), the logistic link
$p = \sigma(z)$ pins both the location and scale of the latent state absolutely. This
is what makes $\beta_\text{tv}$ identifiable at all: the survey data constrains where
$z_t$ has to be, and that constraint propagates back to the media coefficient. The
same argument applies to ordered Likert surveys (consideration scores): the cutpoints
anchor the state's scale through the multinomial observation model.

A fully latent mediator — one with no observed tracker data — doesn't anchor its own
scale, which means the media→mediator coefficient and the mediator→sales coefficient
are only identified through their product. You haven't added a structural layer; you've
reparameterized a direct effect.

## What this means for strategy

The practical consequence shows up in how you interpret the campaign's persistence. With
adstock on the media input and no AR(1) state, the modeled effect decays at the rate
of the media signal: stop spending on TV and the fitted awareness contribution decays
within a few weeks.

With AR(1) state dynamics and no adstock, the modeled effect decays at the state's
persistence rate. A burst of TV builds an awareness stock; that stock lingers at a rate
determined by $\rho$, not by the ad schedule. A high-$\rho$ stock justifies a burst
strategy — you build durable equity that doesn't need constant media to maintain. A
low-$\rho$ stock means always-on is more efficient.

Since $\alpha$ and $\rho$ trade off against each other when both are in the model, the
strategy recommendation from an adstock-on-AR1 specification depends more on where the
posterior randomly lands on the ridge than on what the data actually supports. The
[adstock-saturation identification post](/posts/adstock-saturation-identification/)
makes this point for the $(\alpha, \kappa)$ tradeoff; the $(\alpha, \rho)$ version
inside a structural mediator is the same problem at a different level of the model.

The fix is the same as always: decide in advance which carryover mechanism belongs in
your model, and instantiate only that one. For a brand equity mediator, the mechanism
is population-level state persistence. Use AR(1), drop the adstock, and let the tracker
data do the job of pinning the latent state. For a direct-response channel feeding
sales directly — no mediator — adstock on the media input remains the right model.

The two mechanisms are not interchangeable. They describe carryover at different levels
of the causal chain, and conflating them doesn't give you both; it gives you neither,
plus a ridge.

---

_The `StructuralNestedMMM` architecture — including the AR(1) state model, Binomial
and ordered Likert measurement models, and latent demand factors — is implemented in
[mmm-framework](https://github.com/redam94/mmm-framework) under
`mmm_extensions/models/structural.py`. The equifinality note that prompted this post
lives at `technical-docs/methodology/equifinality.md`. Related posts: [Adstock and
Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/),
[Bayesian Brand Tracking](/posts/bayesian-brand-tracking/), [Noisy Covariates Bias
Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/)._
