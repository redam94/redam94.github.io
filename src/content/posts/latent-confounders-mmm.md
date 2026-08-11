---
title: "The Confounder Nobody Has a Column For"
author: Matthew Reda
pubDatetime: 2026-08-11T13:42:48Z
slug: latent-confounders-mmm
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - causal-inference
  - statistics
description: Economic health drives both ad spend and sales — but nobody has a column called "economic health." Here's the three-rung ladder for handling this latent confounder in an MMM, and the honest finding about what each rung actually buys.
---

Performance budgets go up when the business is doing well, and the business does well when the economy is doing well. That means paid search and performance social spend more in boom times — not because those channels drove the boom, but because the boom unlocked their budgets. When the economy contracts, the budgets get cut. Spend goes down. Sales go down. The MMM sees two variables moving together and calls it causation.

This is a confounding structure, not a modeling failure. The problem isn't that the model is bad at math; it's that there's a variable driving both sides of the regression that nobody put in the model. Call it `economic_health`. It doesn't have a column in the data warehouse. Nobody measures it directly. And if you ignore it, your performance channel coefficients are systematically inflated.

I've been working through this in the causal inference series inside [`mmm-framework`](https://github.com/redam94/mmm-framework), where I set up a synthetic world where economic health is the only slow confounder, then tried three progressively better approaches. The results are instructive — and not quite what I expected.

## What the naive model does

In the synthetic world, economic health simultaneously increases sales (people have more money) and pulls up performance spend (budgets track KPIs). A naive MMM with no economic controls attributed roughly nine times the true search effect to search. Display — a channel that was genuinely working — got crushed toward zero to compensate.

The model isn't wrong about the aggregate fit. It allocates the sales variance correctly across the full history. It's wrong about the _cause_. Search is credited for the macro tailwind it happened to ride.

One accidental partial fix: a linear trend term in the baseline absorbs the growth component of the economic cycle. If you include one, the search over-credit drops considerably. But you can't count on it. A trend is a slow-moving variable that happens to overlap with one feature of the confounder; it doesn't close the back-door.

## Rung B: indicators as controls

The standard response is to include macro indicators — GDP growth, consumer confidence, unemployment, retail sales — in the control set. This genuinely helps. In the same synthetic world, dropping four indicators into the model collapsed the search over-credit from ~9× to under 2×. That's a substantial improvement.

But it doesn't fix the problem. Each indicator is a _noisy proxy_ for the unobserved factor. As [measurement error in predictors](/posts/measurement-error-in-predictors/) covers, when you substitute a noisy proxy for the true underlying quantity, you get attenuation: the proxy absorbs only part of the confounder's variance, and the residual is still an open back-door. If four indicators together explain 80% of the economic factor's variance, the remaining 20% is still pushing your media coefficients in the wrong direction — and nothing in the model output tells you it's there.

## Rung C: modeling the measurement jointly

The cleaner approach is to make the latent factor explicit: a single economic health variable, estimated inside the same model as the MMM, with the macro indicators as its measurement model.

The `LatentFactorMMM` in `mmm-framework` does this. One AR(1) latent factor $F_t$ represents economic health over time. Each indicator is connected to $F_t$ via a loading and noise term:

$$\text{indicator}_{k,t} = \lambda_k F_t + \varepsilon_k$$

And $F_t$ enters the sales equation alongside media contributions. The whole thing — indicators, latent factor, and sales — fits in one NUTS run.

Two identification constraints matter:

**In-graph standardization.** The latent factor is normalized to mean 0, standard deviation 1 over the fit window, inside the PyMC graph. Without this, the factor's scale trades off against its loadings — a factor with twice the variance and half the loadings is observationally equivalent, and the sampler has no way to resolve them. Standardizing in-graph pins the scale.

**One positive loading.** Without a sign anchor, the factor can flip orientation. Positive loadings become negative, the factor runs backward, and the sampler happily visits both modes. Constraining the GDP loading to be positive (GDP growth tracks the economy) pins the orientation. Other loadings — including unemployment, which moves inversely — are free-signed and get the right direction from the data.

```python
with pm.Model():
    rho = pm.Beta("rho", alpha=6, beta=2)       # high persistence
    eps = pm.Normal("eps", 0, 1, shape=T)
    # AR(1) factor, in-graph standardized
    F_raw = scan_ar1(rho, eps)                  # lower-triangular Toeplitz multiply
    F = pm.Deterministic("econ_health",
                         (F_raw - F_raw.mean()) / (F_raw.std() + 1e-6))

    # Measurement model
    lam_gdp  = pm.HalfNormal("lam_gdp", 1.0)   # anchor: positive
    lam_conf = pm.Normal("lam_conf", 0, 1)
    lam_unemp = pm.Normal("lam_unemp", 0, 1)   # expected negative
    lam_ret  = pm.Normal("lam_ret", 0, 1)

    pm.Normal("obs_gdp",  lam_gdp  * F, sigma_gdp,  observed=gdp_growth)
    pm.Normal("obs_conf", lam_conf * F, sigma_conf, observed=confidence)
    pm.Normal("obs_unemp",lam_unemp* F, sigma_unemp,observed=unemployment)
    pm.Normal("obs_ret",  lam_ret  * F, sigma_ret,  observed=retail)

    # Economic health enters the sales equation
    gamma = pm.Normal("gamma_econ", 0, 1)
    mu = baseline + media_contributions + gamma * F
    pm.Normal("sales", mu, sigma, observed=sales)
```

The media coefficients' posterior intervals now carry the factor's estimation uncertainty inside the same graph. No two-stage plug-in, no attenuation from discarding posterior variance.

## The honest result

In the recovery simulation, the three approaches produced these mean absolute relative errors on the confounded (chaser) channels:

| Rung | Approach               | Error |
| ---- | ---------------------- | ----- |
| A    | Ignore economic health | ~490% |
| B    | Indicators as controls | ~110% |
| C    | LatentFactorMMM        | ~115% |

Rung C doesn't win on point error. B and C essentially tie.

I'll sit with that. The four indicators together span enough of the economic factor's variance that the joint latent model doesn't dramatically outperform the proxies on recovering media coefficients. Both approaches bought roughly the same improvement over the naive baseline.

What rung C buys is something different:

**The measurement model.** The recovered factor correlated at 0.98 with the ground-truth economic health series. The loadings came back with the right magnitudes — including unemployment's negative sign, which a positive-constrained model would have reversed. Rung B produces four regression coefficients on noisy proxies; rung C produces an interpretable economic index with uncertainty.

**Honest propagation.** In rung B, the media intervals implicitly treat the indicators as the confounder itself. In rung C, the factor's estimation uncertainty flows into every media coefficient in the same posterior. The intervals mean different things — rung C's are wider and more honest about what's unresolved.

**A nameable series.** The posterior over $F_t$ is "economic health, weekly, with 90% interval" — something you can monitor, extend with new indicators, or compare against external data. It doesn't dissolve into the baseline after fitting.

## The floor that experiments break

Both rungs B and C leave a residual search bias. Rung C makes it legible: it lives in the part of the economic factor that the four indicators don't capture. No observational structure can reach variance that none of the proxies measure.

This residual is the price of an experiment. A geo holdout that randomizes search spend while the economy continues to move produces a causal estimate that's not confounded by economic health — because the intervention is uncorrelated with the confounder. The latent factor model names the problem clearly; it doesn't make the experiment unnecessary.

The takeaway I'd act on: before you drop macro indicators into your control set, ask whether you believe they span the confounder's variance, or just the part you happen to have data for. If the honest answer is "mostly," the joint latent approach gives you an explicit model of how much of the confounder is explained and how much residual bias might remain. That's worth more than a cleaner-looking coefficient table.

---

_This post is grounded in the causal inference series in [`mmm-framework`](https://github.com/redam94/mmm-framework) (`nbs/causal/causal_04_latent_confounders.ipynb`), where the synthetic world, recovery grades, and latent factor recovery numbers come from. Related posts: [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/) covers the attenuation mechanism in predictors. [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/) covers the broader confounding problem in MMMs. [Closing the Loop with MMM Calibration](/posts/closing-the-loop-mmm-calibration/) covers the experiment side._
