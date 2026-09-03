---
title: "Don't Divide Where You Should Subtract: A Panel Centering Pitfall"
author: Matthew Reda
pubDatetime: 2026-09-03T13:22:11Z
slug: panel-centering-divide-vs-subtract
draft: true
tags:
  - regression
  - panel-data
  - statistics
  - marketing-mix-modeling
description: Dividing panel data by the unit mean instead of subtracting it changes the model completely — producing coefficients scaled by each unit's baseline and biased predictions when you back-transform.
---

Panel data gets normalized all the time, and most of the time it's done correctly. But there's one specific mistake I keep seeing — in client code, in open-source MMM pipelines, and in my own early notebooks — that looks completely innocuous and produces subtly wrong answers. The mistake is dividing by the unit mean instead of subtracting it.

The [within-between post](/posts/within-between-persons/) covers what the model is estimating — within vs. between effects. This is about a narrower thing: a specific implementation choice that accidentally changes the interpretation of every coefficient in the model.

## The setup

Suppose you have panel data: multiple stores, observed weekly over two years, and you want to estimate the effect of a covariate (say, a promotion flag or a price variable) on sales. Store 1 has a hundred times the sales volume of Store 10. You're working in log-scale, so the relationship is multiplicative, which is standard for count-like outcomes.

You want to remove store-level baseline differences so the model focuses on within-store variation. The standard approach is to demean: subtract each store's mean log-sales from its observations. That's the fixed-effects within-estimator, and it wipes out all time-invariant store-level factors — size, location, demographics, everything.

Someone on the team has a different idea: instead of subtracting the mean, divide by it. The argument is that this "normalizes" each store relative to its own baseline. The outcome is now dimensionless, ranging around 1.0 instead of around the store's mean. Seems harmless.

It isn't.

## What each transformation actually does

Let's write it out. Define $y_{it} = \log(\text{sales}_{it})$, and let $\bar{y}_i = \frac{1}{T}\sum_t y_{it}$ be store $i$'s mean log-sales. The true model is:

$$y_{it} = \alpha_i + \beta \, x_{it} + \varepsilon_{it}$$

where $\alpha_i$ is the store fixed effect and $\beta$ is the covariate effect we want.

**Subtract**: $y_{it}^{\text{sub}} = y_{it} - \bar{y}_i$

This produces the standard within-estimator. The store effect $\alpha_i$ is constant over time, so it cancels:

$$y_{it}^{\text{sub}} = \beta(x_{it} - \bar{x}_i) + (\varepsilon_{it} - \bar\varepsilon_i)$$

Regressing $y_{it}^{\text{sub}}$ on $x_{it}$ (or $(x_{it} - \bar{x}_i)$) recovers $\beta$. This is the within-unit slope you wanted.

**Divide**: $y_{it}^{\text{div}} = y_{it} / \bar{y}_i$

Substituting in the model:

$$y_{it}^{\text{div}} = \frac{\alpha_i + \beta \, x_{it} + \varepsilon_{it}}{\bar{y}_i} = \frac{\alpha_i}{\bar{y}_i} + \frac{\beta}{\bar{y}_i} \, x_{it} + \frac{\varepsilon_{it}}{\bar{y}_i}$$

The covariate now has coefficient $\beta / \bar{y}_i$ — different for every store. If you pool across stores and fit a single $\hat\beta_{\text{div}}$, you're estimating a weighted average of $\beta / \bar{y}_i$ across stores. That's not $\beta$. It's $\beta$ rescaled by the harmonic mean (approximately) of the unit means — a quantity with no interpretable meaning.

More importantly: when stores have different baseline log-sales, the bias is different for every store. Large stores (high $\bar{y}_i$) push the pooled coefficient toward zero; small stores push it up. The model is estimating a different quantity than you intended, and the amount of distortion is invisible unless you check against ground truth.

## In code

The three approaches look nearly identical in Python, which is part of the problem:

```python
import numpy as np

log_sales = np.log(sales)  # shape: (n_stores, n_periods)
store_mean = log_sales.mean(axis=1, keepdims=True)

# Correct: subtract
y_sub = log_sales - store_mean       # additive within-unit deviation

# Wrong: divide
y_div = log_sales / store_mean       # rescales by store mean — changes the model

# Also wrong (half right): only centering the outcome, not the predictors
y_sub_only = y_sub                   # predictor x_it still uncentered
```

In a `linearmodels` random-effects model, fitting `y_div` instead of `y_sub` will look identical — same formula, same function call, same output format. The coefficients will be different numbers, but nothing flags the mistake. You only catch it if you simulate with known ground truth and check recovery, which is what the `common_regression_issues` notebook does.

## The back-transform compounds the error

The damage doesn't stop at the coefficient. When you want predictions on the original sales scale, you have to invert the normalization. For the subtracted version, that means adding back the store mean in log-space: $\exp(\hat{y}_{it}^{\text{sub}} + \bar{y}_i)$. Straightforward.

For the divided version, you'd multiply: $\exp(\hat{y}_{it}^{\text{div}} \cdot \bar{y}_i)$. But the model has estimated $\beta / \bar{y}_i$, not $\beta$. So the prediction is:

$$\exp\!\left(\frac{\hat\beta_{\text{div}}}{\bar{y}_i} \cdot \bar{y}_i \cdot x_{it}\right) = \exp(\hat\beta_{\text{div}} \cdot x_{it})$$

You've accidentally cancelled the store mean from the prediction. But the store mean is still embedded in the intercept term — now incorrectly scaled — so the final predictions have store-level baseline errors that compound with the covariate bias.

In practice this shows up as predictions that are systematically too high for small stores and too low for large stores, or vice versa, depending on how the pooling interacted with the store mean distribution. The fit can look decent on training data because the random effects soak up some of the residual bias. It falls apart on out-of-sample stores or when the store mean distribution shifts.

## Why people reach for division

The intuition behind division is that you're making each store's outcome dimensionless — expressing it as a fraction of its typical level rather than as an absolute log-sales number. This is a reasonable thing to want. Percentage-change models are common and often interpretable.

The problem is that dividing log-sales by mean log-sales doesn't give you percentage changes from the mean. Log-ratios give you percentage changes: $\log(y_{it}) - \log(\bar{y}_i) = \log(y_{it} / \bar{y}_i)$. That's the subtract transformation. The divide transformation gives you a ratio of log quantities, which doesn't have a clean economic or statistical interpretation.

If you genuinely want a model where the coefficient represents a percent-of-baseline effect, the right structure is still subtractive — applied before exponentiation. What you get is:

$$\frac{y_{it}}{\bar{y}_i} = \exp(y_{it} - \bar{y}_i)$$

So on the log scale, subtract is always the right tool. Division of log quantities belongs almost nowhere in a normal regression workflow.

## The check

The fast diagnostic: simulate data with known coefficients, run your normalization, fit the model, and check whether the recovered coefficients match the ground truth. This is a lightweight version of [simulation-based calibration](/posts/simulation-based-calibration/) applied to the normalization step specifically, not just to the sampler.

```python
# Quick recovery check
true_beta = 0.5
# ... simulate y from alpha_i + true_beta * x + eps ...

# Fit both
beta_sub = fit_model(y_sub, x)
beta_div = fit_model(y_div, x)

print(f"True: {true_beta:.3f}")
print(f"Subtract: {beta_sub:.3f}")   # should be close
print(f"Divide:   {beta_div:.3f}")   # will be off
```

If the div coefficient is roughly `true_beta / mean(store_mean_log_sales)`, you've confirmed the bias. In real data where you don't know ground truth, check whether the predicted scale back-transforms correctly to the observed sales range, stratified by store size. Bias tends to be monotone in baseline.

The fix is one character: replace `/` with `-`.

---

_This post is based on notebook `04_normalization_in_panel_models.ipynb` from the [common_regression_issues](https://github.com/redam94/common_regression_issues) repo. The within/between conceptual framing is in [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/). The argument for always simulating to check recovery is in [Simulation-Based Calibration](/posts/simulation-based-calibration/)._
