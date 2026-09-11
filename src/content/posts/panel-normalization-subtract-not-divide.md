---
title: "Subtract, Don't Divide: The Normalization Mistake That Biases Panel Models"
author: Matthew Reda
pubDatetime: 2026-09-11T13:17:15Z
slug: panel-normalization-subtract-not-divide
draft: true
tags:
  - statistics
  - regression
  - panel-data
  - marketing-mix-modeling
description: Dividing a panel outcome by its unit mean looks like sensible normalization but produces attenuated, biased coefficients — here's why, and what to do instead.
---

Multi-unit panel data — sales across a hundred stores, revenue across geo markets, brand metrics across countries — all share the same structural problem: each unit has its own level. Store A sells ten times what Store B sells. If you just pool the data and run a regression, the unit intercepts swamp everything else and your covariates of interest fight for crumbs of residual variance.

The right response is to demean: subtract each unit's mean from its time series so you're estimating effects from within-unit variation, not across-unit differences in scale. I've written about the [within vs. between distinction](/posts/within-between-persons/) before. What I want to talk about here is a specific misapplication I've seen a number of times — one I've been documenting in my [`common_regression_issues`](https://github.com/redam94/common_regression_issues) work — that looks like demeaning but isn't.

The mistake is dividing by the unit mean instead of subtracting it.

## The two normalizations

Say $y_{it}$ is log sales for unit $i$ at time $t$, and $\bar y_i$ is that unit's time-average. The two approaches:

$$\text{Subtract: } \tilde y_{it} = y_{it} - \bar y_i$$

$$\text{Divide: } \tilde y_{it} = \frac{y_{it}}{\bar y_i}$$

They look similar. You're doing something with the unit mean in both cases. But they are not equivalent, and the division version doesn't actually remove the unit effect. It rescales it.

## Why division is wrong

Start from the simplest model in log space:

$$y_{it} = \mu_i + \beta x_{it} + \varepsilon_{it}$$

where $\mu_i$ is the unit-level intercept (the log-scale baseline for unit $i$), $\beta$ is what you want, and $x_{it}$ is some time-varying covariate.

The unit mean is $\bar y_i = \mu_i + \beta \bar x_i + \bar\varepsilon_i$. Subtraction gives:

$$y_{it} - \bar y_i = \beta(x_{it} - \bar x_i) + (\varepsilon_{it} - \bar\varepsilon_i)$$

Clean. The unit intercept $\mu_i$ vanished exactly, and you're left with within-unit variation in $x$ explaining within-unit variation in $y$. The coefficient $\beta$ is identified.

Division gives something different. When $\mu_i \gg \beta \bar x_i$ — the baseline level dominates, which is typical — you can write:

$$\frac{y_{it}}{\bar y_i} \approx 1 + \frac{\beta(x_{it} - \bar x_i)}{\mu_i}$$

The apparent coefficient on $x_{it}$ is now $\beta / \mu_i$. Units with larger baselines suppress their own contribution to the coefficient estimate. If you pool across units with different $\mu_i$ values, the result is a biased weighted average, and the bias is always toward zero — classic attenuation.

The unit effect didn't disappear; it ended up in the denominator, silently distorting every coefficient it touches.

## What the simulation shows

In the [`common_regression_issues` notebook on panel centering](https://github.com/redam94/common_regression_issues), I ran a simulation with 20 stores, 156 weeks of data, and two covariates whose true effects on log-sales are:

$$\beta_1 = -0.0124, \qquad \beta_2 = +0.0743$$

Three versions of the same random-effects model:

| Approach                    | $\hat\beta_1$ | $\hat\beta_2$ |
| --------------------------- | ------------- | ------------- |
| True                        | −0.0124       | +0.0743       |
| Standard (no normalization) | −0.0165       | +0.0764       |
| Subtract group mean         | −0.0140       | +0.0729       |
| **Divide by group mean**    | **−0.0085**   | **+0.0517**   |

The standard random-effects model and the subtraction normalization both recover the true betas to within noise. The division normalization is off by about 30% on both — and the attenuation is systematic, not random. Every time you run this on data with heterogeneous unit baselines, the div-normalized coefficients will be smaller than the truth.

In code, the difference is a single character:

```python
y_train = np.log(sales)  # log-scale outcome

# Correct demeaning
y_demeaned = y_train - y_train.groupby('store_id').mean()

# Incorrect "normalization" — DO NOT do this
y_div_normed = y_train / y_train.groupby('store_id').mean()
```

The incorrect version passes basic sanity checks. The time series still look centered. $R^2$ is still reasonable. The coefficients are positive and plausible. The only thing wrong is that they're wrong.

## Why this matters in MMM

In a geo-level MMM — the standard setup for measuring media effects across markets — the "units" are geos. Sales volumes differ by an order of magnitude between a major DMA and a small market. If you divide each market's sales by that market's mean before fitting, you're implicitly telling the model that a 10% increase in San Francisco is worth the same as a 10% increase in Boise. That's fine if it's true. But the model should tell you that, not the normalization step. Encoding it in the preprocessing removes the variation that would let the market-level intercepts absorb the scale difference properly.

More concretely: if the media budget is proportional to market size, then media spend and market baseline are correlated. Dividing by the baseline creates a spurious interaction between your treatment variable (spend) and the denominator (baseline), and the coefficient you recover is attenuated in exactly the direction that makes your media look less effective than it is.

Subtract, and the market size goes into a market-level random effect, where it belongs. Divide, and it ends up tangled with your coefficient estimates.

## What to do instead

The standard approaches, in order of preference:

1. **Proper demeaning** (subtract unit mean): use `y_it - ȳ_i` for the dependent variable. Equivalent to a fixed-effects transformation; unit intercepts are absorbed exactly.

2. **Random effects model on the untransformed outcome**: let the model estimate unit-level random intercepts, and don't touch the dependent variable at all. This is what I've shown as the "standard" case above — it works, and it correctly attributes between-unit variance to the unit effects rather than mangling it into the coefficients.

3. **Log transformation, then random effects**: when sales values span orders of magnitude, take logs first (to stabilize variance and put effects on a proportional scale), then fit unit intercepts. Logging is not demeaning — it's a variance-stabilizing transform, and it's correct regardless. Then let the model handle the unit-level differences.

What not to do: divide. Not by the unit mean, not by the category total, not by some index — unless you have an explicit model for why you want the outcome to be in ratio form and you've worked through what it does to your estimands.

## Catching the mistake

The diagnostic I find most useful: run both versions and compare the coefficients. If division consistently shrinks your estimates (it will, when units have heterogeneous baselines), you're seeing the attenuation. Between-unit $R^2$ is another tell: the division-normalized model in the simulation had a between-unit $R^2$ that was effectively negative — a number that can't make sense for a properly specified model.

Panel normalization is one of those decisions that feels like plumbing — something you do once before the real modeling starts. But the specific operation you choose at that step propagates directly into every coefficient you report. Subtraction is the operation that does what you think you're doing. Division is a different operation with a different answer.

---

_Simulation and model fits are from the [normalization in panel models notebook](https://github.com/redam94/common_regression_issues/blob/main/nbs/04_normalization_in_panel_models.ipynb) in my [`common_regression_issues`](https://github.com/redam94/common_regression_issues) repository. Related reading: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/) for the within/between distinction, and [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/) for the related attenuation mechanism on the predictor side._
