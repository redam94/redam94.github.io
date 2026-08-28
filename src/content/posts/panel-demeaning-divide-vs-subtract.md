---
title: "Dividing by the Group Mean Is Not Demeaning"
author: Matthew Reda
pubDatetime: 2026-08-28T13:25:05Z
slug: panel-demeaning-divide-vs-subtract
draft: true
tags:
  - regression
  - panel-data
  - statistics
  - marketing-mix-modeling
description: In a log-scale panel model, subtracting the unit mean and dividing by it look similar but estimate fundamentally different quantities — and the division version biases your coefficients.
---

Here's a mistake I've seen more than once, including in my own early work. You have store-level or geo-level sales data, you log-transform it, and then you want to "normalize" across units so that a big-volume New York store doesn't dominate a small-volume rural one. A natural move: divide each store's log-sales by that store's average log-sales. That gives you a dimensionless index centered near 1, which _feels_ like you've removed the store-level baseline. You haven't. You've done something subtly but consequentially different — and the coefficients you get back are not the ones you wanted.

This is documented in my [`common_regression_issues`](https://github.com/redam94/common_regression_issues) work, in the centering and normalization notebook. The math is clean enough to walk through in a post.

## The setup

Say you have $N$ stores, $T$ periods. The data-generating process is:

$$\log S_{it} = \mu_i + \beta X_{it} + \varepsilon_{it}$$

where $\mu_i$ is a store-specific baseline (the "fixed effect"), $X_{it}$ is a covariate (say, media spend), and $\beta$ is the coefficient you want. You don't observe $\mu_i$; you need to remove it from the estimation.

The classical move is **within-unit demeaning** (the fixed-effects estimator): subtract each unit's time-average from both sides.

$$\log S_{it} - \overline{\log S}_i = \beta (X_{it} - \bar X_i) + (\varepsilon_{it} - \bar\varepsilon_i)$$

where $\overline{\log S}_i = \frac{1}{T}\sum_t \log S_{it}$. The $\mu_i$ drops out exactly, and OLS on the demeaned data recovers $\beta$ consistently.

## The wrong version: divide by the group mean

Now suppose instead you define:

$$\tilde y_{it} = \frac{\log S_{it}}{\overline{\log S}_i}$$

and fit a panel model to $\tilde y_{it}$. What does this regress on?

Plugging in the DGP:

$$\tilde y_{it} = \frac{\mu_i + \beta X_{it} + \varepsilon_{it}}{\overline{\log S}_i} = \frac{\mu_i}{\overline{\log S}_i} + \frac{\beta}{\overline{\log S}_i} X_{it} + \frac{\varepsilon_{it}}{\overline{\log S}_i}$$

If you then apply fixed effects (subtracting the unit mean of $\tilde y$, which absorbs the $\mu_i/\overline{\log S}_i$ term), you're left with a regression of the form:

$$(\tilde y_{it} - \bar{\tilde y}_i) = \frac{\beta}{\overline{\log S}_i}(X_{it} - \bar X_i) + \tilde\varepsilon_{it}$$

The coefficient you recover is $\hat\beta_{\text{div}} \approx \beta / \overline{\log S}_i$ — and since $\overline{\log S}_i$ varies by store, **this estimated coefficient is store-specific**. Average it across stores and you get a weighted average of $\beta/\overline{\log S}_i$ values, which is _not_ $\beta$ unless every store has the same baseline volume (in which case you didn't need to normalize in the first place).

In the simulation from the `common_regression_issues` notebook, you can verify this directly:

```python
# True betas: shape (K_products,)
# y_train: store × time log-sales, so groupby gives per-store mean log-sales
store_means = y_train.groupby("store_id").mean()

# The div-normed model estimates beta / store_mean for each store
recovered_betas = true_betas[None, :] / store_means.values[:, None]
recovered_betas.mean(axis=0)  # Not equal to true_betas
```

To recover $\beta$ from the div-normed model you'd need to multiply each store's coefficient back by $\overline{\log S}_i$. But that's not what gets reported, and most standard panel model outputs don't give you per-store coefficients — they give you one pooled number, which is the wrong weighted average.

## Why it feels plausible

The confusion arises because in _non-log_ space, dividing by the store mean and subtracting the store mean are doing qualitatively similar things: they both put units on comparable scales. But log-scale transforms multiplication into addition — that's the whole point of log-transforming. Dividing in log-space is therefore not the same as subtracting in log-space; it's equivalent to taking a _ratio of exponents_ back in the original scale.

Concretely: $\log S_{it} - \overline{\log S}_i$ tells you how many log-units this period deviates from the store's average. That's the within-unit deviation. $\log S_{it} / \overline{\log S}_i$ tells you what _multiple_ of the store's log-average this period is — a dimensionless rescaling that mixes the level and the variation in a way that's hard to interpret.

## What to use instead

**Standard demeaning (subtract):** Just use $\log S_{it} - \overline{\log S}_i$ as your within-transformed outcome, or equivalently include store fixed effects and let the software do the demeaning. This recovers $\beta$ without bias.

**Raw log-scale with fixed effects:** Fit on $\log S_{it}$ directly, with a dummy or factor for each store. Same estimand, same answer.

Both approaches work. The div-normed version doesn't, and the failure is not random noise — it's a systematic scaling bias whose direction depends on which stores have higher or lower average volume.

## The diagnostic

If you've already fit a div-normed model and want to know whether this matters: compare the within-$R^2$ of the div-normed model to a properly demeaned model. If they differ noticeably, your normalization is doing work beyond baseline removal. Also check whether your coefficient estimates grow or shrink with store volume — that's the fingerprint of $\beta/\overline{\log S}_i$ leaking through.

And if someone hands you a panel model where the dependent variable is described as "normalized" or "indexed," ask exactly how. Subtract or divide makes a coefficient difference you can't recover without going back to the raw data.

---

_Source material: [common_regression_issues](https://github.com/redam94/common_regression_issues), notebook `04_normalization_in_panel_models.ipynb`. Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/)._
