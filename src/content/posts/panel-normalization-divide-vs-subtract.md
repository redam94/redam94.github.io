---
title: "Divide vs. Subtract: The Panel Normalization Mistake That Biases Your Coefficients"
author: Matthew Reda
pubDatetime: 2026-08-23T13:12:53Z
slug: panel-normalization-divide-vs-subtract
draft: true
tags:
  - regression
  - panel-data
  - statistics
  - marketing-mix-modeling
description: In panel models on log-scale data, dividing the outcome by the group mean instead of subtracting it silently rescales each unit's contribution, biasing pooled coefficients toward zero in a way that looks completely reasonable.
---

I've written before about the [within-versus-between distinction](/posts/within-between-persons/) in panel data — how a pooled regression blends two conceptually different effects and hands you neither one cleanly. That post is about model structure. This one is about a more mundane mistake that I've seen in the wild a handful of times: normalizing the dependent variable the wrong way before fitting, and not noticing because the results still look plausible.

The mistake is choosing division over subtraction when demeaning the outcome. On the surface they both "remove the group mean." Under the hood, in a log-scale panel model, they're doing entirely different things to your coefficients.

## The setup

Say you have a panel: stores observed over weekly time periods, with log-scale sales as the outcome. You want to control for store-fixed effects without absorbing variation you care about. The standard move — and the right one — is to subtract each store's average log-sales from its log-sales observations:

$$\tilde{y}_{it} = \log(y_{it}) - \overline{\log(y)}_i$$

Call this "subtraction normalization." After demeaning, each store's time series is centered at zero, the store-level intercepts are removed, and the remaining variation is purely within-store.

The wrong move — division normalization — looks like this:

$$\tilde{y}_{it}^{\text{div}} = \frac{\log(y_{it})}{\overline{\log(y)}_i}$$

Both operations produce a zero-mean time series per store (the division version has a mean of 1 in ratio terms, but you can center it). The difference is what they do to the scale of the residuals and, critically, to the coefficient estimates you recover.

## Why division biases your coefficients

In the correctly demeaned model, the coefficient $\beta$ on a covariate $x_{it}$ has the standard log-scale interpretation: a one-unit increase in $x_{it}$ is associated with a $\beta$ change in log-sales (roughly a $100\beta\%$ change in sales). Every store contributes observations where the DV is in the same units — log-sales deviations.

In the division-normalized model, the DV for store $i$ at time $t$ is $\log(y_{it}) / \mu_i$, where $\mu_i = \overline{\log(y)}_i$ is that store's mean log-sales. The coefficient you're actually estimating in store $i$'s implicit regression is:

$$\beta_{\text{div}} \approx \frac{\beta_{\text{true}}}{\mu_i}$$

Stores with high mean log-sales (large $\mu_i$) effectively shrink the DV more, so they contribute data points that "look like" a smaller effect. When you pool across all stores to fit a single coefficient, you're estimating a weighted average of $\beta_{\text{true}} / \mu_i$ across stores — not $\beta_{\text{true}}$ itself.

Concretely: suppose the true coefficient on a covariate is $+0.074$. A store with mean log-sales of 1.3 effectively contributes an implied coefficient of $0.074 / 1.3 \approx 0.057$. A store with mean log-sales of 0.8 contributes $0.074 / 0.8 = 0.093$. Pool them and you get something in between — biased relative to the truth in a direction and magnitude that depends on the distribution of $\mu_i$ across your panel.

## What the numbers show

I ran this on simulated panel data from the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) project — 20 stores, 156 weekly periods, known ground-truth coefficients. Three model variants:

| Model | Covariate coefficient | Truth |
|---|---|---|
| Standard random-effects (log DV) | 0.076 | 0.074 |
| Subtraction-normalized DV | 0.073 | 0.074 |
| Division-normalized DV | 0.052 | 0.074 |

The standard and subtraction models recover the truth closely. The division model reports 0.052 when the answer is 0.074 — a ~30% attenuation. That's not sampling noise; it's structural. The $R^2$ and $F$-statistic in the division model look healthy (0.63 vs. 0.77 for the correct model), the standard errors are reasonable, and the coefficient is correctly signed. Nothing in the diagnostics would make you stop and ask questions.

This is the same flavor of problem as [measurement error in predictors](/posts/measurement-error-in-predictors/): the bias is directional, predictable, and invisible to the usual checks.

## Why it comes up in practice

In geo-level MMMs, it's common to want to express sales as an index relative to each geo's baseline — "how much above or below normal was this geo this week?" The natural operation feels like division: $\text{sales}_{it} / \overline{\text{sales}}_i$. If you do this in levels before taking logs, you end up with $\log(\text{sales}_{it} / \overline{\text{sales}}_i) = \log(\text{sales}_{it}) - \log(\overline{\text{sales}}_i)$, which is exactly right — that's subtraction on the log scale.

But if you take logs first and then divide — `log(sales) / mean(log(sales))` — you get the biased version. A small order-of-operations error. The two pipelines feel equivalent and produce outcomes that look similar (both center each geo's time series), but the second quietly multiplies your effective response by $1/\mu_i$ before fitting.

A related version: normalizing by the store-level standard deviation of log-sales rather than the mean. This is often reasonable for standardizing a regression, but if you apply it only to the dependent variable and not to both sides of the equation, you change what your coefficients mean in a store-specific way and reintroduce the same cross-unit heterogeneity you were trying to remove.

## The fix

Demean on the log scale by subtraction:

```python
import numpy as np

log_sales = np.log(sales)
store_mean_log = log_sales.groupby("store_id").transform("mean")

# Correct
demeaned = log_sales - store_mean_log

# Wrong (appears similar but biases coefficients)
# demeaned_wrong = log_sales / store_mean_log
```

If you want to work in levels and express the DV as an index, divide by the arithmetic mean (not the mean of logs): $\text{sales}_{it} / \overline{\text{sales}}_i$, then take logs. The division happens before the log transform, which means it becomes a subtraction after it.

A useful sanity check: fit the model on two normalizations and compare coefficients. If they agree closely, you haven't introduced a store-scale bias. If they differ materially — especially if the division version is consistently lower — you're probably in the wrong regime.

## The broader point

Normalization feels like plumbing. It's the step before the interesting modeling work, so it gets less scrutiny than prior choices or likelihood specifications. But on log-scale panel data, how you center units is a modeling decision with direct consequences for the slope estimates you trust. Dividing vs. subtracting is not a style choice — it's a choice about what question you're answering, and one of those choices answers it wrong.

The within-between post is about choosing the right model structure for the question you want to answer. This post is the earlier check: before you even get to model structure, make sure your normalization hasn't quietly rescaled some units and silently biased the answer.

---

_The simulation data and modeling code for this post are from the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) project (`nbs/04_normalization_in_panel_models.ipynb`). Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/)._
