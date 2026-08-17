---
title: "Demeaning Versus Dividing: A Panel Normalization Trap"
author: Matthew Reda
pubDatetime: 2026-08-17T13:30:31Z
slug: panel-centering-demean-not-divide
draft: true
tags:
  - statistics
  - regression
  - panel-data
  - marketing-mix-modeling
description: In panel models, subtracting the group mean from your outcome is correct demeaning; dividing by it is a different transformation that biases your coefficients in a predictable, hard-to-notice way.
---

Here's a mistake I've seen made quietly in geo-level MMMs and multi-store panel regressions: someone wants to make units "comparable" before modeling, so they divide the outcome by its store-level mean. The model runs. The fit looks fine. The coefficients are biased by 30% and nothing in the standard output flags it.

## The setup

You have panel data — 20 stores, three years of weekly sales. You model log(sales) with random effects. Store effects are handled by the panel structure, but volume differences between stores span an order of magnitude, and it feels like you should normalize. The impulse is understandable. The execution matters.

For a panel outcome $y_{it}$ with $\bar{y}_i$ denoting the time-mean for unit $i$, there are two obvious choices:

**Subtraction (correct demeaning):**
$$\tilde{y}_{it} = y_{it} - \bar{y}_i$$

**Division (wrong):**
$$\tilde{y}_{it} = \frac{y_{it}}{\bar{y}_i}$$

Both remove the between-store level difference. Only one leaves your coefficients interpretable.

## What division actually does to your estimates

In the standard random-effects model,
$$y_{it} = \alpha + \beta X_{it} + a_i + \varepsilon_{it},$$
the coefficient $\beta$ describes how a one-unit change in $X_{it}$ shifts $y_{it}$ — which, in log-sales space, is a multiplicative effect on raw sales.

When you instead model $y_{it} / \bar{y}_i$, the effective coefficient on $X_{it}$ becomes $\beta / \bar{y}_i$ — rescaled by the store mean, which differs across stores. What the estimator returns is a weighted average of $\beta / \bar{y}_i$ across stores:

$$\hat\beta_{\text{div}} \approx \beta \cdot \mathbb{E}_i\!\left[\frac{1}{\bar{y}_i}\right]$$

This is not $\beta$. It's $\beta$ deflated by the harmonic-mean-like factor on the store means. The bias is proportional to how much store means vary — large stores with high $\bar{y}_i$ pull $1/\bar{y}_i$ toward zero and shrink the estimate.

In a simulation from my [common_regression_issues](https://github.com/redam94/common_regression_issues) framework — 20 stores, 156 weeks, two covariates with true log-scale coefficients $\beta_1 = -0.012$ and $\beta_2 = 0.074$ — you can verify this directly:

```python
# What the div-normed model is actually estimating
(betas[None, :] / y_train.groupby('store_id').mean().values[:, None]).mean(axis=0)
# array([-0.00995, 0.05979])
```

And that's almost exactly what the random-effects model reports when fed the divided outcome:

| Model | $\hat\beta_2$ | True $\beta_2$ |
|-------|:------------:|:--------------:|
| Standard log(sales) | 0.076 | 0.074 |
| Sub-normed: log(sales) $-$ $\bar{y}_i$ | 0.073 | 0.074 |
| Div-normed: log(sales) $/$ $\bar{y}_i$ | **0.052** | 0.074 |

The div-normed estimate for $\beta_2$ is off by ~30%. No sign flip, no inflated standard error, no convergence warning. If you hadn't run the comparison, you wouldn't know.

## The diagnostic that flags it

One number exposes this: the between-group $R^2$ from the panel model. A standard random-effects model decomposes variance into within-unit and between-unit components. The between $R^2$ measures how much of the store-to-store variation in the outcome the regressors explain.

When you divide the outcome by the store mean, you've removed essentially all between-store variance from the dependent variable by construction — the ratio $y_{it}/\bar{y}_i$ has the same mean (1.0) across all stores. The random-effects estimator looks for between-group signal and finds a flat surface. The result is a between $R^2$ reported as $-8.2 \times 10^{27}$.

That's not imprecision — it's a numerical implosion signaling that the transformation was structurally wrong. Any time you see a between $R^2$ with that character, check whether the outcome has been divided by a group-level statistic before modeling.

```python
model_div = lm.RandomEffects(y_div, X).fit()
print(model_div.variance_decomposition)
# Effects                   0.000000
# Residual                  0.013185
# Percent due to Effects    0.000000
# R-squared (Between):  -8.194e+27  ← this is the red flag
```

The sub-normed model, by contrast, produces the same variance decomposition and nearly identical coefficients as the standard model. Subtracting a constant from each store's time series doesn't change the within-unit regression at all, and the between $R^2$ is undefined (there's no residual between-group variation left) rather than catastrophic.

## Which approach to use

For log-transformed panel outcomes in an MMM or multi-store regression:

**Don't normalize the outcome at all.** Let the panel structure handle it. Random effects absorb store-level intercepts via $a_i$; fixed effects demean algebraically. The coefficients on time-varying predictors come out on the log-sales scale either way, which is what you want for ROAS or elasticity interpretation.

**If you must pre-process, subtract.** Demeaning by subtraction is mathematically equivalent to projecting out the store intercept before regression. Predictions require adding $\bar{y}_i$ back, but the slope estimates are unaffected.

**Division is for a different model.** Dividing by $\bar{y}_i$ is appropriate in multiplicative index-number models where you want to ask "how many times its typical level was Store $i$ at week $t$?" That's a valid question, but it's a different question, and the coefficients describe effects on a dimensionless ratio, not on log-sales.

The two operations look similar — both remove between-store level differences — but they differ in how they interact with the slope parameters. Subtraction is a location shift; division is a scale change that folds into the coefficient and produces a permanently attenuated estimate.

## A minimal working example

```python
import linearmodels as lm
import numpy as np

y = np.log(sales_panel)  # log-sales, indexed by (store_id, time_period)
store_mean = y.groupby('store_id').transform('mean')

y_sub = y - store_mean   # correct demeaning — coefficients unchanged
y_div = y / store_mean   # wrong normalization — coefficients biased toward zero

# Standard model
model_std = lm.RandomEffects(y, X).fit()

# Sub-normed (equivalent; add store_mean back for level predictions)
model_sub = lm.RandomEffects(y_sub, X).fit()

# Div-normed (biased; between R² will be nonsensically large and negative)
model_div = lm.RandomEffects(y_div, X).fit()

# Comparison
print("True betas:   ", true_betas)
print("Standard:     ", model_std.params[covariate_cols].values)
print("Sub-normed:   ", model_sub.params[covariate_cols].values)
print("Div-normed:   ", model_div.params[covariate_cols].values)
```

The bias from division is predictable, proportional to the store-mean variation, and invisible in the residual diagnostics. The fix is to not divide — or, if you did, to check the between $R^2$ before reporting the coefficients. A number like $-8 \times 10^{27}$ is not a rounding error. It's the model telling you that the transformation broke the variance structure it was designed to exploit.

---

_Simulation and analysis from [common_regression_issues](https://github.com/redam94/common_regression_issues), notebook `04_normalization_in_panel_models`. The within/between decomposition in panel data is covered from a different angle in [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/). Related: [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Measurement Error in Predictors](/posts/measurement-error-in-predictors/)._
