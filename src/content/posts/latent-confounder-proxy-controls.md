---
title: "Your Controls Are Noisy Proxies: The Latent Confounder Problem in MMMs"
author: Matthew Reda
pubDatetime: 2026-07-16T13:12:41Z
slug: latent-confounder-proxy-controls
draft: true
tags:
  - marketing-mix-modeling
  - causal-inference
  - bayesian
  - statistics
description: Adding economic indicators to your MMM helps with confounding — but only partially. When your controls are noisy proxies for an unobserved driver, errors-in-variables attenuation keeps the backdoor partly open.
---

Most MMM practitioners know that economic conditions can confound media-spend estimates. The economy hums, the client gets confident, the budget gets topped up, and sales rise — all at the same time. Leave it uncontrolled and your paid search coefficient absorbs some of the economy's work.

The standard response is to add controls: GDP growth, consumer confidence, unemployment, retail sales indices. Four columns in the model instead of one missing variable. VIF tables look manageable, the coefficients stabilize, and the confounding problem is considered solved.

It isn't. Not fully. And understanding why matters for how you'd report — and how much you'd trust — the channel ROIs that come out the other side.

## The confounder you can't see

In the `mmm-framework` causal notebook series, this is formalized through **Veranda Home**, a fictional home and garden retailer. Its world has one latent driver called "economic health" — an AR(1) process that nobody has a column for. Economic health drives both Veranda's performance-linked media budget (spend goes up when things are good) and its sales (people buy patio furniture when they feel flush).

That's a textbook backdoor path: `economic health → spend → sales` and `economic health → sales` simultaneously. If you condition on nothing, every channel that co-moves with the economy absorbs some of the economy's credit.

The standard response — adding four noisy indicators of economic health as controls — gets the diagram right but not the numbers. Here's why.

## The problem with proxy controls

The four indicators (GDP growth, consumer confidence, unemployment, retail sales) are each a noisy measurement of the true latent confounder. Formally:

$$X_k = \lambda_k \cdot f + \varepsilon_k, \qquad \varepsilon_k \sim \mathcal{N}(0, \sigma_k^2)$$

where $f$ is the true economic health factor, $\lambda_k$ is the loading, and $\varepsilon_k$ is indicator-specific noise. None of the four measures is the confounder — each carries its own noise, and unemployment runs in the opposite direction.

When you add these four columns directly to the regression, you're doing [errors-in-variables regression](/posts/measurement-error-in-predictors/) on the controls. The indicators collectively span much of the confounder's variance, so adding them helps — the naive bias collapses by roughly a factor of four. But the residual bias doesn't go to zero. The part of economic health that the indicators don't capture — the gap between what four noisy surveys measure and the true latent driver — stays in the error term, and some of it lands on the media coefficients.

The key point is that this failure is invisible in the model output. The coefficients look stable. The credible intervals look reasonable. There's no diagnostic in the red. What's missing is not a computational failure; it's information that the data simply doesn't contain.

## Three ways to handle it

The `causal_04` notebook runs three specifications on the same synthetic world and grades each against the sealed ground truth:

**Rung A — ignore it.** No economic controls. Naive performance-linked budget creates a clear backdoor. Search and social look artificially strong; a competitor going dark in a bad quarter looks like an organic win.

**Rung B — indicators as controls.** Add all four series to the control set. This is the standard practitioner move, and it genuinely helps. Bias on the search coefficient drops from ~80% to ~20% relative error in the notebook's world. Not perfect, but the model at least knows something is going on.

**Rung C — model the measurement.** Represent economic health as a latent variable explicitly and estimate it inside the same PyMC graph, using the four indicators as its measurement block. The latent factor enters the sales equation directly, not through the four proxies.

```python
with pm.Model():
    # The latent economic health factor (AR process)
    factor_innovations = pm.Normal("factor_innovations", 0, 1, shape=T)
    rho = pm.Beta("rho", 2, 2)
    factor = pm.Deterministic(
        "factor",
        pt.extra_ops.scan(
            fn=lambda innov, prev: rho * prev + pt.sqrt(1 - rho**2) * innov,
            sequences=factor_innovations,
            outputs_info=[pt.zeros(())],
        )[0],
    )
    # Standardize in-graph so loadings don't trade off against factor variance
    factor_std = (factor - factor.mean()) / (factor.std() + 1e-6)

    # Measurement block: each indicator is a noisy signal of the factor
    loadings_raw = pm.Normal("loadings_raw", 0, 1, shape=4)
    # First loading constrained positive to pin orientation
    loadings = pm.Deterministic(
        "loadings",
        pt.concatenate([pt.abs(loadings_raw[:1]), loadings_raw[1:]]),
    )
    indicator_sigma = pm.HalfNormal("indicator_sigma", 1, shape=4)
    for k, (indicator_obs, name) in enumerate(zip(indicators_observed, indicator_names)):
        pm.Normal(name, loadings[k] * factor_std, indicator_sigma[k], observed=indicator_obs)

    # Media model uses the latent factor, not the noisy proxies
    beta_media = pm.Normal("beta_media", 0, 0.5, shape=n_channels)
    beta_econ = pm.Normal("beta_econ", 0, 1)
    mu = beta_econ * factor_std + (transformed_media * beta_media).sum(axis=-1) + ...
    pm.Normal("sales", mu, pm.HalfNormal("sigma", 1), observed=sales_obs)
```

The factor's uncertainty propagates into the sales equation directly, because they share the same posterior. There's no plug-in step where you throw away the posterior variance of the latent factor.

## The honest result

Here's the part I want to linger on, because it's genuinely interesting: **on point error for media coefficients, rungs B and C essentially tie.**

Four indicators used as plain controls span about as much of the economic factor's variance as the one-factor model extracts from them. The latent factor approach doesn't meaningfully reduce the point estimate error relative to the proxy-controls approach.

So why bother with rung C? Three reasons, and they're real ones:

**Honest uncertainty propagation.** When you plug the noisy indicators in as plain regressors, the sales model treats them as if they were the true confounder. It doesn't know they're noisy. The credible intervals on media coefficients are systematically too narrow — they reflect uncertainty given the factor is known exactly, when it isn't. The latent factor model carries the factor's estimation uncertainty into the media posteriors, because they share the same graph. The intervals are wider, and they're right.

**A recoverable, named object.** Rung C produces "economic health, weekly, with credible bands" — something you can plot, share with a CFO, extend with new indicators next year, or compare against an external macro index. Rung B produces four regression coefficients on proxy series. Neither output is obviously better than the other as a business communication, but only one of them is something you can test: does the factor correlate with an economist's recession index? Does it move before the sales effects we'd expect? The latent factor can be falsified. Four control coefficients on derived indicators mostly can't.

**A composable architecture.** The measurement block — `indicator_k = loading_k × factor + noise` — composes naturally with everything else the mmm-framework supports: mediated pathways (brand consideration as an intermediate), calibration priors from geo experiments, structural nesting. When you bolt on a mediator or a lift test, the economic health factor stays properly separated. When you chain noisy controls, those same extensions start trading off against the controls in ways that are hard to reason about.

## What neither rung buys

The critical thing to flag: both B and C leave essentially the same residual bias floor. The floor is the part of economic health that the four indicators simply don't cover — variance in the true latent confounder that doesn't show up in any observable series you have.

That floor is not a modeling failure. It's a fundamental limit of what your data contains. No specification change closes it. No better software closes it. The only thing that can identify what's below that floor is variation in media spend that's orthogonal to the economy — which is what a pre-registered geo experiment provides. ([The experiment calibration math is its own post.](/posts/closing-the-loop-mmm-calibration/))

This is what I mean when I write that the model and the experiment are two halves of one instrument. The model gets you from "complete ignorance" to "residual bias floor." The experiment is what you run at the floor.

## The practical upshot

If you have decent economic indicators available, add them as controls. Rung B's error reduction (roughly 4× in the notebook) is real and worth the effort. The confounding problem doesn't require a latent factor model to be substantially addressed.

Reach for the latent factor architecture when:
- You need honest uncertainty propagation into media coefficients for downstream decisions (budget optimization, expected-value calculations, experiment prioritization)
- You want a reusable economic health factor you can track over time and validate externally
- You're already fitting a structural model with mediators or calibration priors, and the indicators as plain controls are creating collinearity problems

And in either case, report the residual bias floor explicitly. If your economic indicators explain 60–70% of the confounder's variance, tell the reader what the other 30–40% means for your media coefficient estimates. "We controlled for macro conditions using these four series" is incomplete without acknowledging what those series don't measure.

Proxy controls are useful. They're not the same thing as controlling for what you actually meant to control for.

---

*This post draws directly from `causal_04_latent_confounders.ipynb` in the [`mmm-framework`](https://github.com/redam94/mmm-framework) causal series, which runs three specifications on the same synthetic Veranda Home world and grades them against a sealed truth. The errors-in-variables perspective is developed more formally in [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/). The experiment that closes the bias floor is covered in [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/). The identification constraint (standardize-in-graph, positive first loading) is essential for the latent factor model to sample correctly — see the notebook for the full derivation.*
