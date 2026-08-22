---
title: "Subtract, Don't Divide: A Panel Normalization Pitfall That Biases Your ROI Estimates"
author: Matthew Reda
pubDatetime: 2026-08-22T13:13:20Z
slug: panel-normalization-subtract-dont-divide
draft: true
tags:
  - regression
  - panel-data
  - marketing-mix-modeling
  - statistics
description: When you normalize a log-transformed panel outcome by dividing instead of subtracting the unit mean, you introduce bias that can halve your estimated coefficients — a common mistake in geo and store-level models.
---

Panel regression on sales data almost always starts with a log transform. Sales are strictly positive, multiplicatively structured, and span very different baseline levels across units — geos, stores, product categories. Taking logs is correct. The problem shows up one step later, when you try to remove the unit-level baseline effect.

There are two natural-seeming ways to do it. You can subtract the unit mean from each observation:

$$\tilde{y}_{it} = \log(y_{it}) - \overline{\log(y_i)}$$

Or you can divide:

$$\tilde{y}_{it}^{\text{div}} = \frac{\log(y_{it})}{\overline{\log(y_i)}}$$

The second version shows up in practice whenever someone wants to "index" each unit's sales to its own baseline — a unit at 1.0 is at its average, below 1.0 is below, above 1.0 is above. It feels like normalization. It isn't. It biases your covariate estimates, sometimes by a factor of two or more.

## Why subtracting works

The standard log-linear panel model is:

$$\log(y_{it}) = \alpha_i + x_{it}^\top \beta + \epsilon_{it}$$

where $\alpha_i$ is a unit-specific intercept capturing everything that differs across units but is stable over time — store size, geo population, brand awareness. Taking the within-unit mean across time periods gives:

$$\overline{\log(y_i)} = \alpha_i + \bar{x}_i^\top \beta + \bar{\epsilon}_i$$

Subtracting:

$$\log(y_{it}) - \overline{\log(y_i)} = (x_{it} - \bar{x}_i)^\top \beta + (\epsilon_{it} - \bar{\epsilon}_i)$$

The unit fixed effect $\alpha_i$ cancels completely. The remaining regression is clean: the slope $\beta$ is identified off within-unit variation in $x$, and OLS (or a random-effects estimator) recovers it without bias from unit heterogeneity. This is the Mundlak-Chamberlain equivalence — what fixed-effects estimation actually does.

## Why dividing doesn't

Now try the same algebra with division:

$$\frac{\log(y_{it})}{\overline{\log(y_i)}} = \frac{\alpha_i + x_{it}^\top \beta + \epsilon_{it}}{\alpha_i + \bar{x}_i^\top \beta + \bar{\epsilon}_i}$$

The numerator and denominator both contain $\alpha_i$. There is no cancellation. What you end up with is a dependent variable that is a ratio with the unit mean in the denominator, and that denominator is correlated with your predictors through $\bar{x}_i^\top \beta$. Regressing predictors onto a variable that mixes them into both the numerator and denominator of the outcome is a form of ratio bias — and it attenuates your estimates.

The direction and magnitude depend on the data, but the bias isn't random noise. It is systematic attenuation toward zero.

## A concrete look at the bias

Working from my [common regression issues](https://github.com/redam94/common_regression_issues) framework, here is a minimal simulation with 20 stores, 156 weekly periods, and two covariates with true coefficients $\beta_1 = -0.012$ and $\beta_2 = 0.074$.

```python
import numpy as np
import pandas as pd
import statsmodels.api as sm
import linearmodels as lm

# After generating the panel data, form three outcome variants
y_log = np.log(train_df['sales'])
store_means = y_log.groupby('store_id').mean()

y_standard = y_log                                  # raw log-sales
y_sub = y_log - y_log.groupby('store_id').transform('mean')  # subtract mean
y_div = y_log / y_log.groupby('store_id').transform('mean')  # divide by mean

# Fit random-effects models
X = sm.add_constant(train_df[['seasonal_control', 'trend', 'covariate_1', 'covariate_2']])

results = {}
for name, y in [('standard', y_standard), ('subtract', y_sub), ('divide', y_div)]:
    model = lm.RandomEffects(y, X)
    results[name] = model.fit()
```

Fitted coefficients for the two covariates:

| Model | $\hat\beta_1$ (true: −0.012) | $\hat\beta_2$ (true: 0.074) |
|---|---|---|
| Standard (log-sales) | −0.017 | 0.076 |
| Subtract (correct) | −0.014 | 0.073 |
| Divide (wrong) | **−0.009** | **0.052** |

The subtract model recovers both coefficients within noise of the truth. The divide model systematically understates both — the attenuated $\hat\beta_2$ is about 30% below the true value. If you were using this model to estimate media ROI, you would conclude the channel is roughly a third less effective than it actually is.

Note also the between R-squared for the divide model: it comes out astronomically negative (`-8e+27`), which is a diagnostic red flag. R-squared can be negative for predictions on held-out groups when the model's variance decomposition is wrong, but not-a-number magnitudes indicate that the normalization has destroyed the between-unit information entirely.

## The intuition

Think about what the two operations do geometrically. Subtraction shifts each unit's time series to have mean zero in log space — it removes a level difference without touching the shape. Division rescales each unit's time series so it has mean one — it removes the level difference by warping the scale. That warping changes the units of the dependent variable in a way that's different for each unit, based on $\overline{\log(y_i)}$. Large-baseline units get their outcomes compressed; small-baseline units get them expanded. Your covariates aren't affected the same way, so the regression is now solving a problem where the dependent variable has been distorted by a factor that correlates with the regressors.

In log space the unit effect is additive — which means it belongs in the subtraction. Multiplying log-quantities is not meaningful in the same way; that's equivalent to exponentiating a product, which is a geometric mean of ratios. There's nothing wrong with geometric-mean indexing as a display choice, but it's not the right transformation to feed a regression that assumes an additive model structure.

## Practical implications for geo MMM

In geo-level marketing mix models the baseline volume varies enormously across geos. A tier-1 DMA might run 100× the sales volume of a small market. This is exactly the setting where the "index to baseline" impulse is strongest — people want each geo's time series on a comparable scale.

The correct way to do this without biasing the model is to control for geo fixed effects or random effects on the log scale, not to divide the dependent variable by the geo mean. If you want the model's fitted values to be interpretable as "percent of baseline," recover that _after_ fitting by adding back the unit effect estimates. Don't pre-divide the outcome and expect the regression to do the right thing.

The [within-between post](/posts/within-between-persons/) covers why you need to choose between within-unit and between-unit effects before picking a model. This is the same principle applied one step earlier: before you transform the outcome, be clear about what structure you're trying to remove, and use the operation that actually removes it.

## The quick check

If you're unsure whether a normalization is valid for your panel model, fit the same model on the untransformed and transformed dependent variable and compare:

1. Do the covariate estimates agree in sign and rough magnitude?
2. Is the between R-squared plausible (not astronomically negative)?
3. Does the variance decomposition assign meaningful weight to unit effects?

Divide-normalized models routinely fail all three. Subtract-normalized models agree with the standard model because they are, algebraically, the same model — they just put the unit effect into the random-effects estimator rather than the residual.

The choice between subtract and divide sounds like a trivial implementation detail. In geo and store-level panels with large baseline heterogeneity, it's the difference between recovering the truth and reporting numbers that are 20–30% systematically wrong.

---

_Analysis grounded in my [common regression issues](https://github.com/redam94/common_regression_issues) framework, specifically `04_normalization_in_panel_models.ipynb`. The simulation uses 20 stores × 156 periods with two covariates; the divide-model attenuation is robust across random seeds. Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Measurement Error in Predictors](/posts/measurement-error-in-predictors/)._
