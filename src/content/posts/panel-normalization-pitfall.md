---
title: "Don't Divide by the Group Mean: The Normalization Mistake That Breaks Panel Models"
author: Matthew Reda
pubDatetime: 2026-08-18T13:18:34Z
slug: panel-normalization-pitfall
draft: true
tags:
  - statistics
  - regression
  - panel-data
  - marketing-mix-modeling
description: Dividing the dependent variable by its group mean looks like a reasonable normalization — it quietly produces biased coefficients and a nonsensical between-entity R-squared.
---

I've seen this one in the wild more than once, and it's the kind of mistake that looks completely reasonable at a glance. You have panel data — multiple stores, or geos, or brands — observed over time. The raw sales volumes differ enormously between entities, so you want to normalize them before fitting a regression. You divide each entity's sales series by that entity's average sales. Sensible, right? Scale everything to a common index, eliminate the level differences, proceed.

The problem is that dividing by the group mean is not the same as subtracting the group mean, and confusing the two produces badly biased coefficients. I documented this in detail in the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) notebook on panel normalization, and the simulation results are striking enough to be worth writing up plainly.

## The two operations aren't equivalent

In a standard random-effects or fixed-effects panel model, the canonical demeaning transformation for entity $i$ at time $t$ is:

$$\tilde{y}_{it} = y_{it} - \bar{y}_i$$

where $\bar{y}_i = \frac{1}{T}\sum_t y_{it}$ is entity $i$'s time-series mean. Subtracting the group mean removes the entity-level intercept and ensures you're fitting within-entity variation — the same idea I wrote about in [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/).

The alternative that breaks things is:

$$\tilde{y}_{it}^{\text{div}} = \frac{y_{it}}{\bar{y}_i}$$

This looks like a normalization to a common index (100 = entity average). In practice, it multiplies the dependent variable by the entity-specific factor $1/\bar{y}_i$ — a factor that varies by entity. When you then fit coefficients, those coefficients are implicitly weighted by each entity's mean scale, and the result is not the effect of $X$ on $Y$; it's the effect of $X$ on a distorted linear combination of $Y/\bar{Y}$ values that isn't recovering anything you wanted.

## What the simulation shows

In the notebook, I generated synthetic sales data for 20 stores over 156 weeks, with a log-linear data-generating process:

$$\log(\text{sales}_{it}) = \text{base}_i + \text{trend}_t + \text{seasonality}_t + \beta_1 X_{1,it} + \beta_2 X_{2,it} + \varepsilon_{it}$$

The true coefficients are $\beta_1 = -0.0124$ and $\beta_2 = 0.0743$. Then three models are fit:

1. **Standard random effects on log-sales** — the correct specification.
2. **Random effects on `log(sales) / group_mean`** — the division mistake.
3. **Random effects on `log(sales) - group_mean`** — subtraction, which is the right demeaning approach.

Results:

| Model | $\hat\beta_1$ | $\hat\beta_2$ | Between $R^2$ |
|---|---|---|---|
| True | −0.0124 | 0.0743 | — |
| Standard | −0.0165 | 0.0764 | 0.007 |
| Div-normed | **−0.0085** | **0.0517** | **−8.2 × 10²⁷** |
| Sub-normed | −0.0140 | 0.0729 | — |

The standard and subtraction-demeaned models both recover the true coefficients well. The division-normed model misses by a factor of roughly the inverse of the group means — which makes sense, because dividing by $\bar{y}_i$ on the left-hand side effectively scales $\beta$ by $1/\bar{y}_i$, and when you pool across stores with different mean sales, those scalings don't cancel cleanly.

The between $R^2$ of $-8.2 \times 10^{27}$ is the most dramatic symptom. A negative between $R^2$ doesn't mean the model is slightly off — it means the fitted values are farther from the observed means than just predicting the grand mean would be. The model is actively misleading about the cross-entity structure because it was built on a transformed variable that doesn't respect the entity scale.

## Why the coefficients are biased

If you work through the math with a single covariate for clarity, dividing $y_{it}$ by $\bar{y}_i$ is equivalent to fitting:

$$\frac{y_{it}}{\bar{y}_i} = \alpha + \beta^* X_{it} + \text{error}$$

The coefficient $\beta^*$ you recover is related to the true $\beta$ by:

$$\beta^* \approx \frac{1}{\bar{\bar{y}}} \beta$$

where $\bar{\bar{y}}$ is some (complicated) average of entity means. This works out to an approximately consistent estimate only if all entity means are equal — which defeats the entire point of normalizing in the first place. When entities differ in mean sales, as they almost always do, $\beta^*$ conflates the effect of $X$ with the cross-entity variation in mean scale.

Subtraction demeaning doesn't have this problem because adding a constant to $y_{it}$ doesn't change $\partial y_{it} / \partial X_{it}$. The slope is the slope regardless of the entity-level intercept. Multiplying $y_{it}$ by a constant does change the slope — and when that constant varies by entity, the slope estimates don't pool cleanly.

## In practice

The misapplication usually happens in multi-market MMM work, where analysts want to make TV spend in New York and TV spend in Denver comparable by normalizing both markets' sales to an index. The intuitive move is to divide. The correct move is either to work in log-sales (where the entity intercept becomes an additive constant that's absorbed by a fixed effect) or to explicitly include entity fixed effects and let the model handle the level differences.

A few concrete checks if you're in this situation:

1. **Look at the between $R^2$.** If it's negative, something has gone wrong with the entity-level structure. The model should at minimum do better than the grand mean on the cross-entity comparison.
2. **Compare coefficients from the normalized and unnormalized models.** If the division-normalized coefficients are smaller by a factor that roughly matches the inverse of average sales, you're seeing attenuation from the scaling problem.
3. **Try log-transforming instead.** In a log-linear model with entity fixed effects, you don't need to manually normalize at all — the fixed effects absorb the level differences and you recover within-entity elasticities directly.

The between-within distinction I wrote about [before](/posts/within-between-persons/) tells you which effect you're trying to estimate. This normalization pitfall is one layer below that: it's about making sure the thing you're fitting is the thing you think you're fitting before you even get to interpreting the coefficients.

---

_This is one of the misapplication patterns documented in the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) notebook series, specifically the panel normalization notebook. Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/)._
