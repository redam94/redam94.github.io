---
title: "Posterior Predictive Checks in MMM: Generating Realistic Data Isn't Enough"
author: Matthew Reda
pubDatetime: 2026-09-10T13:18:54Z
slug: posterior-predictive-checks-mmm
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - pymc
description: Passing R-hat and SBC certifies your sampler and your inference procedure. A posterior predictive check is supposed to certify your model. But the standard PPC for an MMM can pass convincingly while the channel attribution is completely wrong.
---

In the [simulation-based calibration post](/posts/simulation-based-calibration/) I listed the workflow step by step: prior predictive check, SBC, fit on real data, MCMC diagnostics, **posterior predictive checks**, experimental calibration. That fifth step — PPCs — gets the bullet point without the explanation. This post is the explanation.

The reason it needs one: a PPC for an MMM is not the same animal as a PPC for a hierarchical regression or a logistic classifier. In those settings, "does the model generate data that looks like my observations?" is a meaningful test. In an MMM, it isn't — or at least it isn't nearly enough. A model can replicate the observed sales series to the last digit while getting every channel attribution completely wrong. The PPC has to be designed to probe the claim you're actually making.

## What a standard PPC checks

The mechanics are well-known. You draw a parameter vector $\theta^{(s)}$ from the posterior, simulate an outcome $\tilde{y}^{(s)}$ from the likelihood at those parameters, and ask whether $\tilde{y}^{(s)}$ looks statistically similar to the data $y$ you actually observed. In ArviZ:

```python
import arviz as az
import matplotlib.pyplot as plt

with model:
    ppc = pm.sample_posterior_predictive(trace)

az.plot_ppc(ppc, observed=True)
```

If the observed line sits comfortably inside the envelope of simulated series, the standard PPC passes. The model can generate data that looks like your data. What does that tell you?

In a time-series model like an MMM, quite a lot — and not nearly enough. "Looks like" means the model has captured the right level, the right variance, the right seasonality. It means the priors and likelihood are in the right ballpark. It does not mean the model has attributed the sales to the right causes.

## Why passing the standard PPC isn't sufficient

An MMM has many degrees of freedom. Baseline, trend, seasonality, price, promotional calendar, and several media channels all compete to explain the same series. A model can fit the target series tightly by, say, absorbing true TV effect into the baseline trend, while reporting TV's coefficient as near-zero. If TV spend and the trend move together — which they often do, because advertisers increase TV budgets in growth periods — the posterior has no lever to distinguish them. Both the "TV drives sales" story and the "TV correlates with baseline growth" story generate realistic-looking sales series. The PPC can't tell them apart.

This is the same identification problem I wrote about in [collinearity can't separate](/posts/collinearity-cant-separate/) and [adstock and saturation are not separately identified](/posts/adstock-saturation-identification/). The standard PPC is testing whether the model explains variation; it's not testing whether it explains variation through the right mechanisms.

## Three PPCs that actually probe attribution

### 1. Holdout period PPC

Fit the model on the first 80% of your time series. Then use the posterior to predict the remaining 20% — the holdout period — and check whether the predicted distribution covers the actual observations.

```python
train_t = int(0.8 * T)
y_train, y_hold = y[:train_t], y[train_t:]
X_train, X_hold = X[:train_t], X[train_t:]

# Fit on training window, predict holdout
with mmm_model(X_train, y_train):
    trace_train = pm.sample(draws=2000, tune=1000)
    holdout_ppc = pm.sample_posterior_predictive(
        trace_train, var_names=["obs"],
        extend_inferencedata=False,
        predictions=True,
        coords={"obs_id": range(train_t, T)}
    )

# Check coverage
predicted_interval = az.hdi(holdout_ppc["predictions"]["obs"], hdi_prob=0.94)
coverage = np.mean(
    (y_hold >= predicted_interval["lower"]) & (y_hold <= predicted_interval["higher"])
)
print(f"Holdout 94% HDI coverage: {coverage:.2%}")
```

Target is approximately 94%. Systematic under-coverage means the model is overconfident or missing something real in the holdout period. Over-coverage means the posterior is too diffuse to be useful.

The holdout PPC is especially useful for catching models that have fit seasonal structure as media effect, or vice versa. A model that confounds the two will fail badly when it tries to predict a period with a different media-to-seasonality mix.

### 2. Channel-ablation PPC

This is the test I find most revealing. Zero out one channel's spend in the posterior predictive simulation — hold all other inputs fixed — and ask whether the predicted sales drop makes sense.

```python
def ablation_ppc(trace, X_observed, channel_col, **kwargs):
    X_ablated = X_observed.copy()
    X_ablated[channel_col] = 0.0  # remove the channel

    # With original spend
    with mmm_model(X_observed, y=None):
        ppc_full = pm.sample_posterior_predictive(trace)

    # With channel zeroed
    with mmm_model(X_ablated, y=None):
        ppc_ablated = pm.sample_posterior_predictive(trace)

    contribution = (
        ppc_full["obs"].mean(axis=(0, 1))
        - ppc_ablated["obs"].mean(axis=(0, 1))
    )
    return contribution.sum()  # total contribution over the period

tv_contribution = ablation_ppc(trace, X, channel_col="tv_spend")
print(f"TV counterfactual contribution: {tv_contribution:,.0f}")
```

The ablation PPC forces you to operationalize "contribution" as the counterfactual: what would sales be if this channel had been zero? That's the right definition. The coefficient alone doesn't give you this, because the adstock and saturation transforms mean the relationship between spend and effect is nonlinear and time-lagged.

Sanity-check the result against prior domain knowledge: if the model says TV accounts for 60% of sales on a brand that only spends 10% of its budget on TV, that's a flag. The PPC doesn't automatically resolve it — you need external evidence — but it surfaces the claim for scrutiny. Without this check, the attribution number lives in a table and nobody notices it's implausible.

### 3. Residual structure check

Plot the posterior predictive residuals $e_t = y_t - \mathbb{E}[\tilde{y}_t \mid \theta]$ against each channel's spend. If the model has correctly attributed the channel's effect, the residuals should show no correlation with that channel's spend.

```python
posterior_mean = ppc["obs"].mean(axis=(0, 1))
residuals = y - posterior_mean

fig, axes = plt.subplots(1, len(media_channels), figsize=(4 * len(media_channels), 3))
for ax, channel in zip(axes, media_channels):
    ax.scatter(X[channel], residuals, alpha=0.4)
    ax.axhline(0, color="red", linestyle="--")
    ax.set_xlabel(channel)
    ax.set_ylabel("Residual")
    corr = np.corrcoef(X[channel], residuals)[0, 1]
    ax.set_title(f"r = {corr:.2f}")

plt.tight_layout()
```

A positive residual correlation with channel $k$ means the model is under-attributing $k$: when $k$ is high, sales are higher than the model predicts. A negative correlation means over-attribution. Both are signals to investigate — though as with the ablation PPC, the residual pattern tells you something is off, not what the right answer is.

## The limits of what PPC can tell you

A posterior predictive check is still an in-model check. It asks: given the model and the data, is the model's forward simulation consistent with itself? What it can't do is tell you whether the model's causal claims are true.

The ablation PPC is a step closer to causal because it interrogates the counterfactual. But it's still drawing on the model's own posterior — a model that has conflated TV with baseline growth will confidently predict that removing TV would have little effect, and the ablation PPC will show a small drop, which looks fine. Nothing internal to the model can catch this.

That's why the final step in the workflow is experimental validation — the [closing-the-loop](/posts/closing-the-loop-mmm-calibration/) logic of geo-lift tests calibrating the MMM's channel posteriors. PPCs filter out models that can't replicate their own data; experiments filter out models that can replicate data but have the wrong causal story. Both filters are necessary. Neither is sufficient alone.

## The order matters

Here's the specific failure mode I've seen in practice. A team runs R-hat, ESS, divergences — everything passes. They run a standard in-sample PPC — the line sits inside the envelope. They report the attribution numbers. The client runs a geo holdout for the top channel, and the lift is half what the model said.

Walking back from that failure: the in-sample PPC passed because the model had good marginal fit. The holdout PPC — which wasn't run — would have shown that the model's prediction interval on a period with different spend was much too wide, or systematically off in a direction that correlated with that channel's weight.

The order I now run these:
1. Standard in-sample PPC — is the model in the right universe?
2. Holdout period PPC — does it predict rather than just fit?
3. Residual structure check — is there left-over variation correlated with channels?
4. Channel-ablation PPC — does the counterfactual contribution pass the sniff test?
5. Experimental calibration — is the causal claim consistent with randomized evidence?

Steps 1–4 you can do without running a single experiment. They're not free — the holdout check costs you 20% of your data for estimation, which matters if you're already data-limited — but they catch the class of failures that live inside the posterior and that R-hat and ESS were never designed to find.

PPCs are not a bureaucratic checkpoint. They're the part of the workflow where you ask whether the model you've built is generating a plausible description of reality, before you hand the attribution numbers to someone who will act on them.

---

_The posterior predictive check framework for Bayesian models is laid out in Gelman et al. (2020), "Bayesian Workflow," arXiv:2011.01808. The use of counterfactual (ablation) checks for causal attribution follows the potential-outcomes framing in Pearl (2009), Causality, §4. The holdout validation approach for time-series models is standard in forecasting; see Hyndman & Athanasopoulos (2021), Forecasting: Principles and Practice, §3.4. Related posts: [Simulation-Based Calibration](/posts/simulation-based-calibration/), [Read the Diagnostics First](/posts/read-the-diagnostics-first/), [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/), [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/)._
