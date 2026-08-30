---
title: "Don't Divide by the Group Mean: A Panel Regression Pitfall"
author: Matthew Reda
pubDatetime: 2026-08-30T13:13:34Z
slug: divide-vs-subtract-panel-normalization
draft: true
tags:
  - panel-data
  - regression
  - statistics
  - marketing-mix-modeling
description: When centering variables in panel regression, dividing by the group mean instead of subtracting it silently biases every coefficient — and the model still fits fine.
---

Panel data gives you two orthogonal sources of variance: the differences _between_ units and the changes _within_ them over time. Separating those cleanly requires subtracting each unit's mean from its observations — "demeaning." But there's a tempting wrong move sitting right next to the right one: dividing by the group mean instead of subtracting it. The two operations feel similar. They produce different models, and the divided version silently biases all your coefficients while the fit statistics look normal.

This is something I encountered while building the [common regression issues](https://github.com/redam94/common_regression_issues) tutorial series, and it's worth documenting precisely because it fails quietly.

## What the right transformation does

Suppose you're modeling log-sales $y_{it}$ across stores $i = 1, \ldots, N$ and time periods $t = 1, \ldots, T$. Each store has a stable level — bigger stores sell more — which you want to partial out so the coefficients reflect how _changes_ in media spend or promotions drive _changes_ in sales within a store. The correct within-transformation is:

$$\tilde{y}_{it} = y_{it} - \bar{y}_i$$

where $\bar{y}_i = \frac{1}{T}\sum_t y_{it}$ is that store's time-average. After subtracting, $\tilde{y}_{it}$ has zero mean for every store. Stable store effects are gone. The random-effects or fixed-effects model then regresses $\tilde{y}_{it}$ on (similarly demeaned) predictors and recovers within-unit slopes.

## The mistake: dividing instead

The wrong move is:

$$\tilde{y}_{it}^{\text{div}} = \frac{y_{it}}{\bar{y}_i}$$

This looks like "expressing sales as a fraction of the store's typical level," which sounds reasonable. It isn't. Dividing rescales each row by a store-specific constant, but it doesn't center the outcome. A big store's observations still sit at values near 1.0, and a small store's also sit near 1.0, but the _variance_ structure is different for every store, and the coefficients now pick up residual between-unit confounding that the subtraction would have removed.

More concretely: if the true generating model in log-space is

$$y_{it} = \mu_i + x_{it}^\top \beta + \varepsilon_{it}$$

then the subtract-normalized outcome $\tilde{y}_{it} = y_{it} - \bar{y}_i$ satisfies

$$\tilde{y}_{it} = (x_{it} - \bar{x}_i)^\top \beta + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

and a regression recovers $\beta$ cleanly. But the divide-normalized outcome satisfies

$$\tilde{y}_{it}^{\text{div}} = \frac{\mu_i + x_{it}^\top \beta + \varepsilon_{it}}{\bar{y}_i}$$

which is not a linear function of $x_{it}$ with the store effect removed. The store-level mean $\bar{y}_i$ appears in the denominator of every term, introducing store-specific scaling into all the slopes. The resulting estimate $\hat\beta^{\text{div}}$ is biased toward zero for stores with high average sales (because dividing by a large number deflates the outcome variation) and inflated for stores with low average sales.

## What this looks like in practice

In the simulated data from `common_regression_issues/nbs/04_normalization_in_panel_models.ipynb`, I generated weekly sales for 20 stores across 3 years with two continuous predictors (true betas: $\beta_1 = -0.012$, $\beta_2 = +0.074$).

Three variants of a random-effects model:

| Model                         | $\hat\beta_1$ | $\hat\beta_2$ |
| ----------------------------- | ------------- | ------------- |
| True values                   | −0.0124       | +0.0743       |
| Standard (no normalization)   | −0.0165       | +0.0764       |
| Subtract-normalized outcome   | −0.0140       | +0.0729       |
| **Divide-normalized outcome** | **−0.0085**   | **+0.0517**   |

The divide-normalized model recovers the wrong coefficients. The magnitude of both effects is compressed by roughly 30%. If you were making budget decisions based on the second covariate, you'd systematically underestimate its return. And the model doesn't tell you something is wrong: R-squared is in the same ballpark, significance patterns look similar, residuals appear normal.

The standard model and the subtract-normalized model both land near the truth. The difference between them is subtle — the standard model keeps the absolute store-level log-sales in the outcome, so the random-effects estimator explains more between-store variance. The subtract-normalized model pre-removes that variance and effectively forces the model to work on deviations, which slightly tightens the within-unit estimates.

## Why this keeps happening

The operation $y / \bar{y}$ shows up in MMM preprocessing pipelines all the time, framed as "normalization" or "indexing to baseline." Sometimes it's applied to an independent variable rather than the dependent variable. Sometimes it's applied before logging. Sometimes it's done to make variables more interpretable to stakeholders ("store 7 sold 1.08 times its average this week").

None of that is inherently wrong for visualizations or for unit-free interpretation. The mistake is running a regression on divide-normalized outcomes and expecting it to recover the same coefficients you'd get from a properly specified model. It doesn't, because the normalizing constant — the store mean — is itself a function of the data and is correlated with the predictors whenever the predictors have a between-unit component.

The clean rule: if your goal is to partial out stable unit effects so that regression coefficients reflect within-unit dynamics, the operation is **subtraction**, not division. Subtracting the unit mean is what fixed effects and demeaned random effects do internally; divide-normalizing the outcome before passing it to those estimators is not a shortcut to the same result.

## The practical check

If you're unsure which transformation your pipeline applied, look at the `variance_decomposition` from `linearmodels` or the between-unit R² from `statsmodels`:

```python
import linearmodels as lm

me_model = lm.RandomEffects(y_transformed, X)
fitted = me_model.fit()

print(fitted.variance_decomposition)
# Effects    0.000000  ← correct: subtract-normalized, unit effects absorbed
# Residual   0.010396
```

A subtract-normalized outcome, when passed to a random-effects model, should show near-zero variance attributed to entity effects — because you already removed them. If instead you see large entity-effect variance after "normalizing," your transformation didn't actually remove the unit-level component. That's the signal to check whether you divided when you should have subtracted.

The right thing to do with unit-level structure is to model it or remove it correctly. Dividing it away feels like the same move, but it isn't.

---

_Source: the `04_normalization_in_panel_models` notebook from [`common_regression_issues`](https://github.com/redam94/common_regression_issues). Related post: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/)._
