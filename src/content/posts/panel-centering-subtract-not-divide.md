---
title: "Subtract, Don't Divide: The Centering Mistake That Biases Geo-Level Models"
author: Matthew Reda
pubDatetime: 2026-09-12T13:09:55Z
slug: panel-centering-subtract-not-divide
draft: true
tags:
  - panel-data
  - regression
  - statistics
  - marketing-mix-modeling
description: When removing store- or geo-level baseline heterogeneity, dividing the outcome by its group mean produces biased coefficients with a different interpretation — subtracting is always the right operation and the difference is not small.
---

If you run a geo-level MMM — or any panel model where the units vary widely in size — you eventually run into the problem of baseline heterogeneity. A geo that accounts for 15% of national sales is in the same regression as a geo that accounts for 0.3% of national sales. Their raw outcome values live on completely different scales. The natural impulse is to normalize them.

What you do next matters more than most people realize.

## Two ways to "remove" a group mean

Suppose your outcome is $y_{it}$ — log sales in geo $i$ at time $t$ — and you want to strip out each geo's level so the regression is driven by within-geo variation. Two operations look superficially similar:

**Subtraction (demeaning):**

$$\tilde{y}_{it}^{\text{sub}} = y_{it} - \bar{y}_i$$

**Division (ratio normalization):**

$$\tilde{y}_{it}^{\text{div}} = \frac{y_{it}}{\bar{y}_i}$$

Both operations put all geos on a more comparable scale. Both remove the between-geo average. They produce very different models.

## Why division changes what the coefficient means

Write the outcome model as:

$$y_{it} = \alpha_i + \beta x_{it} + \varepsilon_{it}$$

where $\alpha_i$ is a geo-specific baseline and $\beta$ is the slope you want. Take expectations over time within geo $i$:

$$\bar{y}_i = \alpha_i + \beta \bar{x}_i + \bar{\varepsilon}_i \approx \alpha_i + \beta \bar{x}_i$$

**If you subtract the mean:**

$$y_{it} - \bar{y}_i = \beta(x_{it} - \bar{x}_i) + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

The $\alpha_i$ drops out entirely. $\beta$ still means what you want it to mean: a one-unit within-geo increase in $x$ is associated with a $\beta$-unit increase in $y$.

**If you divide by the mean:**

$$\frac{y_{it}}{\bar{y}_i} = \frac{\alpha_i + \beta x_{it} + \varepsilon_{it}}{\alpha_i + \beta \bar{x}_i}$$

This doesn't simplify cleanly. The $\alpha_i$ doesn't cancel — it's baked into the denominator. The effective coefficient you're estimating is:

$$\beta^{\text{div}}_i \approx \frac{\beta}{\alpha_i + \beta \bar{x}_i} = \frac{\beta}{\bar{y}_i}$$

The "coefficient" in your divided model is now unit-specific. It's $\beta$ divided by geo $i$'s mean sales level. When you run a pooled regression on the divided outcome, you're averaging these unit-specific slopes in some implicit, data-weighted way — and the result is not $\beta$.

## Simulation evidence

The [centering analysis](https://github.com/redam94/common_regression_issues) uses 20 stores across 156 weeks, with two covariates (true betas: $-0.012$ and $+0.074$) on top of store-level random effects, trend, and seasonality. Three models are fit: one on the raw log outcome, one on the subtraction-demeaned outcome, and one on the division-demeaned outcome.

| Model | Covariate 1 (true: −0.012) | Covariate 2 (true: +0.074) |
|---|---|---|
| Standard (no centering) | −0.017 | +0.076 |
| Subtraction-demeaned | −0.014 | +0.073 |
| Division-demeaned | −0.009 | +0.052 |

The division model recovers neither the true parameter nor a useful approximation to it. Its covariate 2 estimate (+0.052) is 30% below the true value — and more tellingly, the "correct" answer for the divided-space model isn't +0.074 either. It's the true beta divided by the mean log sales, averaged across stores, which comes out to about +0.060. The division model can't even recover the right answer for the question it's actually asking.

The between-group $R^2$ for the division model is $-8.2 \times 10^{27}$. That number isn't a typo. Division has scrambled the model's ability to relate the predictions back to between-unit variation in the original space — because the denominator ($\bar{y}_i$) is itself varying across units in a way the regression doesn't account for.

## Why the mistake is easy to make

Division looks like a natural generalization of log-normalization. If your outcome is already in log space, dividing by the group log-mean and subtracting the group log-mean give the same result only if the log-mean equals $\log(\text{geometric mean})$ — and your centering is applied symmetrically to both $y$ and $x$. In practice, modelers often:

1. Apply the centering only to $y$, not $x$ — leaving a mismatch between the outcome scale and the predictor scale.
2. Divide because it "feels like" indexing to 100, which is a familiar reporting convention.
3. Mistake a roughly constant ratio across time for evidence the division is working correctly — when in fact the constant ratio is just the trend dominating.

None of these produce valid estimates of the within-unit effect.

## The right way to handle geo-level heterogeneity

There are a few defensible approaches, and they're not equivalent:

**Subtract the geo mean from log outcome (and from each log predictor if appropriate).** This is the fixed-effects or demeaning estimator. It removes the group intercept and produces a pure within-unit slope. As the [within-between post](/posts/within-between-persons/) covers, this comes at a cost: you've thrown away the between-geo variation entirely, so time-invariant predictors become unidentified and you can no longer use between-geo differences to identify cross-sectional effects.

```python
y_demeaned = np.log(sales) - np.log(sales).groupby('geo_id').mean()
x_demeaned = x - x.groupby('geo_id').mean()
# now regress y_demeaned on x_demeaned
```

**Use a hierarchical model with geo-level random intercepts.** The random effects estimator keeps the between-geo variation in the likelihood, using it to partial the intercepts toward their pooled mean. This is efficient when you believe the geo effects are drawn from a common distribution — a defensible assumption in a geo-level MMM where each geo is one market in the same national economy.

**Model geo size directly.** If you're working in log-log space, the geo baseline $\alpha_i$ is a fixed effect on the intercept. Including a geo indicator variable (or its Bayesian equivalent, a geo-level random intercept prior) handles heterogeneity without touching the outcome transformation.

What you should not do: divide the outcome by the geo mean and then fit a standard mixed-effects model as if it were a demeaned outcome. The pooled random-effects regression doesn't know you've done something nonlinear to the outcome, and it can't correct for the resulting bias in the slope.

## In practice

The subtraction-demeaned model and the standard random-effects model (no centering transformation, just a random intercept) both recover the true parameters well in this simulation. The division-demeaned model does not.

Before running a panel model on marketing data, the question to ask is not "have I normalized the outcomes?" but "have I correctly isolated within-unit variation?" Normalization is not the same as demeaning, and the shape of the bias from division is not easy to intuit from the output — the coefficients look reasonable, the intervals are tight, and the in-sample fit may even improve because the division has removed a lot of variance. What's gone is the correct interpretation.

The fix is one line of code. The mistake is hard to notice once it's in.

---

_Grounded in [common\_regression\_issues](https://github.com/redam94/common_regression_issues), notebook `04_normalization_in_panel_models.ipynb` (Matthew Reda, 2025). Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Measurement Error in Predictors](/posts/measurement-error-in-predictors/)._
