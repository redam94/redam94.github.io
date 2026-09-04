---
title: "The Confounder You Can't See: Latent Factors and the Macro Back-Door"
author: Matthew Reda
pubDatetime: 2026-07-22T13:16:55Z
slug: latent-confounders-macro-back-door
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - causal-inference
  - statistics
description: When economic health drives both your media spend and your sales, controlling for GDP and consumer confidence helps — but those indicators are noisy proxies for the real confounder, and the residual bias survives in silence.
---

When the economy is humming — jobs up, houses turning, consumer confidence high — discretionary categories sell more and brands top up their performance budgets because good quarters fund good spending. That simple fact makes economic health a textbook confounder for almost every marketing mix model ever fit: it drives both spend and sales, and if you don't account for it, its fingerprint spreads across your channel attribution.

The rub is that nobody has a column called `economic_health` in their data warehouse. What they have is a handful of noisy proxies: GDP growth, consumer confidence, unemployment (running backwards), retail composite. This post is about what each of the three obvious strategies for handling an invisible confounder actually buys you — and what it doesn't.

## Drawing the DAG first

The causal structure looks like this:

```
economic health ──► GDP, confidence, retail, unemployment  [noisy indicators]
economic health ──► spend
economic health ──► sales
spend ──► sales
```

The back-door path `spend ← economic health → sales` inflates channel coefficients in boom times and deflates them in downturns. A good year for Search isn't just because you spent more on it — consumers were already primed. A naive model can't separate those two things.

The indicators don't close this back-door on their own. They are noisy _measurements_ of economic health, not economic health itself. As the [measurement error post](/posts/measurement-error-in-predictors/) showed, noisy predictors attenuate coefficients by a reliability ratio $\lambda = \sigma_{x^*}^2 / (\sigma_{x^*}^2 + \sigma_u^2)$. The same logic applies here: noisy controls attenuate the de-confounding, leaving a residual back-door open.

## Three rungs of adjustment

**Rung A — ignore the confounder.** The naive MMM includes price and seasonality but no economic control. The back-door is fully open. In the `mmm-framework` causal notebook series (notebook 04), which tests on a synthetic world with sealed ground truth, Search gets credited roughly 9× its true causal effect. Display — which has a real effect in this world — is crushed toward zero to compensate. The fit statistics look fine. The model is wrong.

One aside worth flagging: including a linear trend partially de-confounds by accident. A trend absorbs the growth component of an economic cycle, partially blocking the back-door. That's why the "add a trend" advice isn't obviously wrong — it's a partial fix that doesn't announce itself as one.

**Rung B — include the indicators as controls.** The practitioner's default: add GDP growth, consumer confidence, unemployment, retail sales to the control set. This is genuinely better. The four indicators jointly span most of the factor's variance, and the attribution error shrinks by roughly 4×. Search goes from ~9× to ~2× its true effect.

But "~2× too high" is still wrong, and the posterior won't tell you. The indicators carry their own idiosyncratic noise, so by the reliability ratio argument, controlling for them doesn't fully block the back-door. A residual correlation between economic health and the model's error remains. It's invisible in the diagnostics.

**Rung C — model the measurement.** The proper fix is to model economic health as a latent variable inside the same PyMC graph as the sales equation. Instead of plugging GDP growth in as a fixed covariate, you let a latent AR(1) factor absorb the shared variance of the indicators, and that factor enters the sales model directly:

```python
with pm.Model():
    # Latent economic factor — AR(1) with high persistence
    rho = pm.Beta("factor_persistence", alpha=8, beta=2)  # prior ~ 0.9

    # mmm_framework.mmm_extensions uses a closed-form decay-matrix trick
    # to avoid scan: D[t, s] = rho^(t-s) for s <= t, so the state is
    # level + D @ innovations, evaluated as a matmul, not a loop.
    innovations = pm.Normal("factor_innovations", mu=0, sigma=0.3, shape=T)
    factor = level + ar1_decay_matrix(rho, T) @ innovations

    # Measurement model: each indicator observes the factor with its own noise.
    # Unemployment gets a negative loading — that's a parameter, not a constraint.
    loadings = pm.Normal("loadings", mu=0, sigma=1, shape=4)
    for i, indicator in enumerate(observed_indicators):
        pm.Normal(f"obs_{i}", mu=loadings[i] * factor, sigma=0.3, observed=indicator)

    # Sales model: factor de-confounds the media coefficients
    factor_effect = pm.Normal("factor_effect", mu=0, sigma=1)
    channel_betas = pm.HalfNormal("channel_betas", sigma=1, shape=n_channels)
    mu = factor_effect * factor + sum(
        channel_betas[c] * sat(adstock(spend[:, c])) for c in range(n_channels)
    ) + baseline_t
    pm.Normal("sales", mu=mu, sigma=pm.HalfNormal("sigma", 0.5), observed=y)
```

The critical difference from rung B: there's no two-stage plug-in. The uncertainty in the latent factor propagates into the channel coefficients because everything is estimated jointly. The posterior over `{factor, channel_betas, loadings}` is correctly correlated — higher factor uncertainty means wider channel posteriors.

## What rung C actually buys you

Here's the honest part. On point estimates of media effects, rung B and rung C often land in the same neighborhood. Both do most of the de-confounding work. The difference isn't always a dramatic shift in posterior means.

What rung C recovers that rung B cannot even express is the **measurement model itself**: the latent factor series (in the causal notebook, correlation with ground truth ≈ 0.98), the correctly-signed loadings including the negative one for unemployment, and posterior uncertainty on the channel coefficients that correctly reflects the residual factor uncertainty rather than treating the de-confounder as known.

The second thing rung C makes explicit: there is a **shared residual floor**. A minimum attribution error that no amount of latent-factor modeling closes. Media spend co-varies with economic conditions through channels the factor doesn't fully absorb — ad budgets are topped up in good quarters at a micro level too, and demand-driven creative decisions are invisible to any model. This residual floor is what **experiments** exist to break. The latent factor model tells you honestly how much attribution uncertainty is reducible by observational adjustment, and how much requires randomization.

## What this means in practice

If you're running an MMM on a category where macro conditions matter — and most categories do — the question isn't "should I include economic controls?" The answer is yes. The question is "am I controlling for the actual thing, or for a noisy measurement of it?"

Indicators as controls are worth including. They're better than nothing and they're cheap. But they carry a systematic bias your posterior won't announce. The latent factor approach is more expensive: bigger model, more parameters, more MCMC work, and you have to decide which indicators to include and how to pin the factor's scale (the `anchor` parameter in `mmm_framework.mmm_extensions.config.LatentFactorSpec` — the factor's sign and scale aren't identified without pinning one loading to the indicator with the densest signal).

The deeper point is this. A latent confounder isn't a reason to give up on observational measurement. It's a reason to model the confounder explicitly, report the uncertainty that remains after doing so, and use that remaining uncertainty to decide which experiment to run next. A model that says "I absorbed most of the economic back-door, but there's a residual floor" is more honest — and more actionable — than one that silently folds all the residual variance into channel attribution and presents it as if it were pinned.

---

_The `LatentFactorSpec` configuration and `build_latent_state` AR(1) implementation are in [`mmm_framework.mmm_extensions`](https://github.com/redam94/mmm-framework) (`mmm_extensions/config.py` and `mmm_extensions/components/latent_states.py`). The three-rung comparison comes from the Causal Inference in Practice notebook series (notebook 04 — "Latent Confounders") in the same repo, which tests against a synthetic world with a sealed answer key. Related posts: [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/), [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/), [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/)._
