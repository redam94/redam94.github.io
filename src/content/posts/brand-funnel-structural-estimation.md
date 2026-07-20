---
title: "The Brand Funnel Is a Structural Equation System, Not a Pipeline"
author: Matthew Reda
pubDatetime: 2026-07-20T13:17:09Z
slug: brand-funnel-structural-estimation
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - causal-inference
  - statistics
description: Chaining awareness → consideration → sales as sequential models introduces three compounding biases. Here's why joint estimation is the right structure, what specifically breaks when you chain, and what the joint model actually requires.
---

The brand funnel — TV lifts awareness, awareness builds consideration, consideration drives sales — is how most marketers think about upper-funnel media. It sounds like a pipeline: step one feeds step two feeds step three. So the natural modeling instinct is to treat it as one: fit an awareness model, extract posterior means, plug them into a consideration model, extract those posterior means, plug them into the sales model.

This is the wrong structure. It's not wrong in the sense of "imprecise" or "we could do slightly better." It's wrong in the sense that it answers three different questions than the ones you thought you were asking, and the errors compound.

## Problem 1: Plug-in means lose uncertainty

This one I covered in detail in the [measurement-error post](/posts/measurement-error-in-predictors/), so I'll be brief. When you take the posterior mean of your weekly awareness estimate and treat it as an observed predictor in the consideration model, you discard its uncertainty. The downstream model believes it knows awareness exactly. The reliability ratio for a brand tracker running 80 weekly interviews is often below 0.5 — meaning you recover less than half of the true awareness effect in the consideration equation. The bias is not random. It's systematic, directional, and determined by the noise floor of the tracker.

The fix people try — "I'll use the posterior mean, which is already shrunk" — is strictly better than raw percentages but still wrong. Posterior means are point summaries. Variance gets swallowed at the plug-in step, and the downstream model has no way to recover it.

## Problem 2: Demand is a back-door through the mediator

This one is more subtle. Suppose there is an unobserved demand trend — a growing category, a competitor's stumble, a macro confidence uptick. This trend raises consideration and raises sales, independently of any media. If neither model accounts for this factor, the demand signal leaks into the consideration → sales path: high-demand periods have high consideration and high sales, and the consideration coefficient absorbs some of that covariation. Part of what looks like a consideration effect is actually shared demand.

In DAG terms, **demand → consideration** and **demand → sales** is a back-door path through the mediator. Closing it requires explicitly modeling the latent demand factor — and because it enters both the consideration equation and the sales equation, the two can't be fit separately. They share a latent variable that has to be estimated jointly.

In the [`mmm-framework`](https://github.com/redam94/mmm-framework) structural model, a shared demand factor is declared as an AR(1) latent process with high persistence ($\rho \sim \mathrm{Beta}(8, 2)$ — near unit-root). It enters the consideration equation and the sales equation simultaneously, with sign anchored at whichever mediator has the larger measured signal (anchoring at a small loading lets a "reflected" factor escape to the cost-free zero mode — this is a failure that shows up as split-chain $\hat{R} \approx 1.75$ and kills the recovery). Without this shared factor, the consideration → sales coefficient is a confounded mixture of causal and demand-driven covariation, and there is no post-hoc way to separate them.

## Problem 3: AR(1) dynamics and adstock are redundant

Brand awareness is persistent. Someone aware of your brand this week will almost certainly be aware next week — memory carries. Modeling this correctly means the awareness equation has its own state carryover:

$$z_t = \ell + \rho(z_{t-1} - \ell) + \beta_\text{TV} \cdot \text{sat}(\text{TV}_t) + \sigma\varepsilon_t$$

with $\rho \sim \mathrm{Beta}(6, 2)$, typically landing in the 0.85–0.97 range. Media moves the awareness state in the week it airs; the state then decays slowly back toward the baseline level $\ell$ as memory fades.

Here's the trap: if you also apply geometric adstock to TV before it enters this equation, you have two stacked carryover mechanisms. Adstock spreads the media signal forward with decay parameter $\alpha$; the AR(1) state also accumulates and spreads with persistence $(1 - \rho)^{-1}$. A long adstock with weak AR persistence looks almost identical to a short adstock with strong AR persistence over a typical 100-week series. The joint posterior over $(\alpha, \rho)$ is a ridge — the same problem as [adstock and saturation identification](/posts/adstock-saturation-identification/), just one level up the funnel.

The right choice is to pick one source of carryover per equation. When a mediator has AR(1) dynamics, the media entering it should arrive without adstock — the state handles memory. In the `mmm-framework` structural model, this is resolved by default: `apply_adstock=False` for any mediator with AR(1) or random-walk dynamics, so the adstock decay parameter is never built for that equation (a dead free parameter sampling its prior without touching the likelihood is worse than no parameter).

## The joint model

Structurally, the brand funnel becomes a system of equations over latent states, connected through the shared demand factor:

```python
with pm.Model() as funnel_model:
    # Latent demand factor — shared across consideration and sales
    rho_D = pm.Beta("rho_D", alpha=8, beta=2)
    D_raw = pm.AR("D_raw", rho=rho_D, sigma=1.0, shape=T, init_dist=pm.Normal.dist(0, 1))
    D = pm.Deterministic("demand", (D_raw - D_raw.mean()) / (D_raw.std() + 1e-6))

    # Awareness — AR(1) latent state, binomial observation (no adstock)
    rho_aw = pm.Beta("rho_aw", alpha=6, beta=2)
    sigma_aw = pm.HalfNormal("sigma_aw", sigma=0.3)
    beta_tv = pm.HalfNormal("beta_tv", sigma=1.0)
    level_aw = pm.Normal("level_aw", mu=0, sigma=2)

    innovations_aw = pm.Normal("innov_aw", mu=0, sigma=1, shape=T)  # non-centered
    z_aw = level_aw + pm.math.cumsum(rho_aw ** pm.math.arange(T)[::-1] *
                                      (beta_tv * sat_tv + sigma_aw * innovations_aw))
    p_aw = pm.math.sigmoid(z_aw)
    pm.Binomial("awareness_obs", n=n_t, p=p_aw, observed=awareness_counts)

    # Consideration — static equation, awareness enters as p_aw (population share aware)
    w_aw = pm.HalfNormal("w_aw", sigma=1.0)
    w_dem_co = pm.Normal("w_dem_consideration", mu=0, sigma=1.0)
    z_co = w_aw * p_aw + w_dem_co * D + ...  # display, price controls, etc.
    # Ordered Likert observation via cumulative-logit multinomial
    ...

    # Sales — consideration and demand enter directly
    gamma = pm.HalfNormal("gamma_consideration", sigma=1.0)
    w_dem_y = pm.HalfNormal("w_dem_sales", sigma=1.0)  # sign anchor
    mu_sales = alpha_y + gamma * pm.math.sigmoid(z_co) + w_dem_y * D + beta_search * sat_search
    pm.Normal("sales", mu=mu_sales * y_std + y_mean, sigma=pm.HalfNormal("sigma_y", sigma=1.0),
              observed=revenue)
```

Every mediator pins its own scale through its measurement model. The binomial likelihood pins the awareness latent state absolutely — the logit link and observed counts fix both the location and scale of $z_\text{awareness}$, which is a stronger anchor than Gaussian standardization (the log-odds scale is not free to drift because every period's count evidence constrains it). The ordered Likert likelihood pins consideration through the cutpoints. Because each mediator is identified through its own measurement model, the media → mediator coefficients are identified by the mediator data, not by whatever residual variance the sales model didn't absorb elsewhere.

## The identifiable total effect

One more subtlety: because of the sigmoid links and AR(1) gains, the total effect of TV on sales is not simply $\beta_\text{TV} \times w_\text{aw} \times \gamma_\text{consideration}$. That product is approximately right only when the awareness state is well within the linear region of the sigmoid and the AR gain is small. At $\rho = 0.9$, the steady-state AR gain is $1/(1-0.9) = 10$ — applying the linearized formula to a 4-week geo test would overstate the identified effect by a factor of roughly 3.

The correct estimand is a counterfactual: set TV spend to zero in the posterior, rerun the full forward model with innovations held fixed (the same demand shocks, different media), and compare the resulting sales to the observed. This is what the `mmm-framework` structural model's `get_mediation_effects()` computes — exact posterior draws under the intervention, not a coefficient product. It's more expensive, but it's the right number.

## When this matters

If your brand tracker runs weekly, your awareness model fits an AR(1) state, your consideration depends partly on awareness, and you have an uncontrolled demand trend — that's most national MMMs with upper-funnel media. Sequential chaining in that context systematically attenuates the awareness → consideration link, confounds the consideration → sales link with shared demand, and double-counts carryover if you adstock media that already enters a dynamic state.

The joint model is more work to specify. You have to choose a likelihood for each mediator, its dynamics, which controls enter which equations, and where the latent factors go. But each of those choices is a question the sequential pipeline was making implicitly — and usually making in the wrong direction. Making them explicit is an improvement, not an overhead.

---

_The `StructuralNestedMMM` implementation in the [`mmm-framework`](https://github.com/redam94/mmm-framework) covers this pattern, including AR(1) mediator dynamics, ordered and binomial likelihoods, shared latent factors, and exact counterfactual effects. The brand tracking foundations are in [Bayesian Brand Tracking, Honestly](/posts/bayesian-brand-tracking/). The plug-in attenuation problem is worked through in detail in [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/)._
