---
title: "Why You Should Subtract the Group Mean, Not Divide by It"
author: Matthew Reda
pubDatetime: 2026-08-05T13:29:49Z
slug: divide-vs-subtract-centering
draft: true
tags:
  - statistics
  - regression
  - panel-data
  - marketing-mix-modeling
description: Dividing by the group mean and subtracting the group mean look similar but estimate completely different quantities — here's why the divide approach quietly corrupts your coefficients.
---

I've seen the same mistake in panel regressions enough times that I started writing it up in my [common regression issues](https://github.com/redam94/common_regression_issues) work. It shows up most often in retail and geo-level media models, where someone wants to remove store- or region-specific scale effects before fitting. The instinct is reasonable. The execution is often wrong in a specific way: **dividing by the group mean instead of subtracting it**.

They look similar. They are not the same model. One of them is a fixed-effects estimator. The other is a ratio transformation that creates heterogeneous effective coefficients that cannot be consistently recovered.

## What subtracting does

Start with a standard log-linear panel model:

$$\log y_{it} = \alpha_i + \beta \, x_{it} + \varepsilon_{it}$$

where $\alpha_i$ is a store- or geo-specific intercept (the fixed effect), $x_{it}$ is your predictor — media spend, price, whatever — and $\beta$ is the common effect you want.

Fixed-effects demeaning subtracts the time-mean of each unit:

$$\log y_{it} - \overline{\log y}_i = \beta \,(x_{it} - \bar{x}_i) + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

where $\overline{\log y}_i = \frac{1}{T}\sum_t \log y_{it}$. The store-specific intercept $\alpha_i$ drops out exactly, leaving a clean within-unit regression. The coefficient you estimate is $\beta$ — the same $\beta$ for all stores, the quantity you want.

This is textbook. The key detail is that the mean is taken **of the logged outcome**, not of the raw outcome.

## What dividing does

The ratio approach normalizes differently. Instead of subtracting $\overline{\log y}_i$, it computes:

$$z_{it} = \frac{\log y_{it}}{\overline{\log y}_i}$$

and runs the regression on $z_{it}$ instead. This looks like it's doing the same thing — adjusting for the unit's average — but the model it fits is:

$$\frac{\log y_{it}}{c_i} = \alpha'_i + \beta' \, x_{it} + \varepsilon'_{it}$$

where $c_i = \overline{\log y}_i$ is a unit-specific constant. Multiplying through by $c_i$:

$$\log y_{it} = c_i\,\alpha'_i + c_i\,\beta' \, x_{it} + c_i\,\varepsilon'_{it}$$

Look at what happened to the slope. The coefficient of $x_{it}$ on $\log y$ is not $\beta'$ — it is $c_i \cdot \beta'$. Each store has its own effective coefficient, scaled by that store's average log-sales. A high-volume store (large $c_i$) contributes a large effective coefficient; a low-volume store contributes a small one.

The estimator $\hat{\beta}'$ is a precision-weighted average of $\beta / c_i$ across stores, not an estimate of $\beta$ itself. To recover $\beta$ you would need to know each $c_i$ and apply an inverse-weighting correction — but by that point you've introduced a source of heterogeneity the model didn't account for and the standard errors no longer mean what they claim.

The technical term for what you've done is create **ratio-normed dependent variable**, and the pathology it induces is exactly what my [`common_regression_issues`](https://github.com/redam94/common_regression_issues) notebook 04 ("Centering in Panel Models") calls "between-signal erasure": the normalization absorbs the between-unit scale information you actually need to identify the common-$\beta$ estimand.

## An additional wrinkle: log of mean vs. mean of log

There is a related mistake where the normalization divides raw sales by the unit's _raw_ mean before logging:

$$\tilde{y}_{it} = \frac{y_{it}}{\bar{y}_i}, \qquad z_{it} = \log \tilde{y}_{it} = \log y_{it} - \log \bar{y}_i$$

This one is at least doing subtraction in log-space — so it preserves the additive structure. But $\log \bar{y}_i \neq \overline{\log y}_i$ because the log is concave; Jensen's inequality tells you:

$$\overline{\log y}_i \leq \log \bar{y}_i$$

So even this "divide-then-log" version is subtracting the wrong constant. The gap between $\log \bar{y}_i$ and $\overline{\log y}_i$ grows with the within-unit variance of $y$ — in stores with lumpy sales, the error is larger.

## In the mmm-framework

This exact prohibition shows up in my [`mmm-framework`](https://github.com/redam94/mmm-framework) documentation. From the data contract section of the continuous-learning implementation guide:

> "Spend is divided by a global per-channel reference constant (e.g. each channel's median or a fixed planning spend)… The reference is a _fixed constant per channel_, never a cluster-specific mean — dividing by per-geo means induces the ratio/between-signal-erasure pathology and is prohibited."

The same principle applies to the outcome. The outcome is kept in natural units — never normalized, centered, or logged — so that incrementality and marginal ROAS stay interpretable and the KKT funding-line algebra holds. The geo-specific baseline is handled through a random intercept (`a_geo`) in the likelihood, not through a pre-transformation of the data.

## Seeing it in practice

Here is a minimal Python demonstration using `linearmodels` random effects:

```python
import numpy as np
import linearmodels as lm

# log_y: (N, T) log-sales panel, X: design matrix
log_y = np.log(sales_data)  # (N, T)

# Correct: subtract the unit mean of log(y)
log_y_demean = log_y - log_y.mean(axis=1, keepdims=True)

# Wrong: divide by the unit mean of log(y)
log_y_ratio   = log_y / log_y.mean(axis=1, keepdims=True)

# Fit both
model_correct = lm.RandomEffects(log_y_demean.flatten(), X)
model_wrong   = lm.RandomEffects(log_y_ratio.flatten(),   X)

print(model_correct.fit().params)  # recovers true β
print(model_wrong.fit().params)    # recovers a weighted average of β/c_i — wrong
```

In simulation, `model_correct` recovers the true coefficient. `model_wrong` recovers something close to $\beta / \text{(harmonic mean of } c_i)$, and that ratio changes with the distribution of store sizes in your data. The wrong model's answer is not just biased — it's a different quantity entirely.

## What to do instead

The prescription is simple: in any log-linear panel model, **subtract the within-unit mean of the log-transformed outcome** (fixed-effects demeaning), or include unit fixed effects explicitly and let the estimator partial them out. Do not divide. Do not normalize raw levels before logging.

If you want to scale the outcome for numerical reasons — keeping parameters O(1) — divide by a **global constant** (the grand mean, a fixed reference value, or the median across all units and periods). A global constant factors out of the likelihood cleanly and doesn't change what the coefficients estimate; a unit-specific mean does not.

The same rule applies to predictors: a fixed global scaling of $x$ is fine and often recommended; normalizing by the unit's mean changes the coefficient interpretation and is usually a mistake.

Wide posteriors on a coefficient after correct demeaning are the honest answer — the data may not separate the store-specific and time-varying effects cleanly. That is not a reason to reach for a normalization that tightens the intervals by misspecifying the model. It's a reason to get more variation in the data, or to say "we don't know" more loudly.

---

_The normalization pitfall is notebook 04 ("Centering in Panel Models") in [`common_regression_issues`](https://github.com/redam94/common_regression_issues). The mmm-framework prohibition on dividing by geo means is in the data contract section of `assets/continous_learning.md`. Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/)._
