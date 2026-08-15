---
title: "Dividing by the Group Mean Is Not Demeaning"
author: Matthew Reda
pubDatetime: 2026-08-15T13:18:09Z
slug: panel-division-normalization-pitfall
draft: true
tags:
  - statistics
  - regression
  - panel-data
  - marketing-mix-modeling
description: When centering panel data, subtracting the group mean and dividing by it look equivalent but aren't — one removes the unit baseline cleanly, the other scales your coefficients by an unknown quantity and breaks between-unit inference.
---

There's a normalization step in panel regression that looks innocuous, can be framed as "standardizing relative to baseline," and produces wrong answers that still pass a vibe check. I've seen it in client code, in academic notebooks, and honestly in a few of my own early experiments. The step is dividing the dependent variable by its group mean instead of subtracting it.

This is documented in my [`common_regression_issues`](https://github.com/redam94/common_regression_issues) work on centering misadventures in panel models, and it's worth laying out precisely why it fails and what the failure looks like.

## Why you'd want to "normalize by baseline"

The motivation is understandable. You have panel data — say, 20 stores measured weekly over three years. Each store has a very different baseline sales volume: Store 3 sells 10× what Store 17 does. You want to control for those differences and focus on within-store dynamics.

The correct move is **demeaning**: subtract each unit's average from each observation. But sometimes the reflex is to divide instead — "let's express each observation relative to its store's average, like an index." That sounds like normalization. It is not demeaning, and the difference has real consequences.

## The math of what each transformation does

Suppose the true model on log-sales is:

$$y_{it} = \mu_i + X_{it}\beta + \varepsilon_{it}$$

where $\mu_i$ is a time-invariant store effect, $X_{it}$ is a covariate (say, a promotion index), and $\beta$ is the coefficient you want.

**Sub-norm (correct):** subtract the store's time-average $\bar{y}_i = \mu_i + \bar{X}_i\beta + \bar{\varepsilon}_i$:

$$y_{it} - \bar{y}_i = (X_{it} - \bar{X}_i)\beta + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

The store effect $\mu_i$ cancels exactly. The regression on this demeaned outcome recovers $\beta$ cleanly, because the only thing varying across time within each store is the covariate deviation and noise.

**Div-norm (wrong):** divide by the store's time-average instead:

$$\frac{y_{it}}{\bar{y}_i} = \frac{\mu_i + X_{it}\beta + \varepsilon_{it}}{\mu_i + \bar{X}_i\beta + \bar{\varepsilon}_i}$$

When the baseline $\mu_i$ is large relative to the covariate contribution — which it is for any variable with a substantial store-level intercept — the denominator is dominated by $\mu_i$, and this simplifies to approximately:

$$\frac{y_{it}}{\bar{y}_i} \approx 1 + \frac{(X_{it} - \bar{X}_i)\beta}{\mu_i}$$

The slope you recover from the div-normed outcome is not $\beta$. It's roughly $\beta / \mu_i$ — which varies _by store_. The pooled estimate you get out of a random-effects model is then something like the average of $\beta / \mu_i$ across stores: the true effect divided by the average group mean.

In simulated panel data with two covariates ($\beta_1 \approx -0.012$, $\beta_2 \approx 0.074$) and 20 stores, the div-norm model recovers approximately $-0.009$ and $0.052$ — about 75–80% of the true values, with the shrinkage matching the inverse of the average group-mean log-sales. The standard model (sub-norm) recovers $-0.014$ and $0.073$: noisier, but in the right ballpark. The div-norm coefficients are consistently smaller and the attenuation is proportional to the baseline scale, not to noise — which means it doesn't look like classical attenuation bias and there's no obvious signal from residuals alone.

## The diagnostic that actually catches it

The tell is the **between-$R^2$**. After fitting a random-effects model, most packages decompose explained variance into within-unit and between-unit components. The within-$R^2$ measures how well the model tracks variation over time inside each unit. The between-$R^2$ measures how well it tracks variation in unit-level averages across units.

For a correctly centered model, both should be positive and reasonable. For a div-normed model, the between-$R^2$ goes astronomically negative — in the simulation above, it comes back at approximately $-8 \times 10^{27}$.

That's not a rounding error. A negative between-$R^2$ means your model predicts unit-level averages _worse_ than a horizontal line through the grand mean would. The div-norm transformation has made the unit-level intercepts uninterpretable, because the "normalization" left behind store-level variation that the model can no longer explain coherently.

```python
# Quick diagnostic in linearmodels
from linearmodels import RandomEffects

model = RandomEffects(y_div_normed, X).fit()

print(model.variance_decomposition)
# Effects                   0.000000
# Residual                  0.013185
# Percent due to Effects    0.000000

# Check R-squared decomposition
print(model.rsquared_between)  # If this is negative or astronomical in magnitude,
                                # you've likely div-normed when you meant to sub-norm
```

The within-$R^2$ stays healthy — the model still tracks within-store time-series dynamics adequately. That's why this mistake passes a surface-level fit check. The pathology is in the between dimension, which most diagnostics don't surface prominently.

## The panel version of a familiar problem

I wrote about a related issue in the [within-between-persons post](/posts/within-between-persons/): the coefficients you get from a panel model depend heavily on _which_ source of variation you're using to estimate them. A pooled model blends within-unit and between-unit effects; a demeaned model isolates within-unit; and a div-normed model produces something that corresponds to neither. It's a within-unit estimate, approximately, but scaled by the inverse of the unit baseline — a quantity you probably don't care about.

The fix is always sub-norm. If you want to express outcomes relative to a baseline, demean in the log-scale: subtract the group mean of log-sales, not divide by it. If you want a multiplicative scaling (each period expressed as a ratio to the store average), that's a valid transformation for _visualization_, but it changes the model you're fitting. The coefficients from a model on ratio-to-average are not the same as the coefficients from a model on log-sales with store fixed effects, and you shouldn't report them as if they were.

## The one-line check

Before trusting a panel model's coefficients, ask: what did I do to control for unit-level baselines, and did I subtract or divide?

If the answer is divide, refit with subtraction and compare the coefficients. If they move, the div-norm was doing something real — and what it was doing was quietly scaling your effects by a quantity you didn't intend.

The between-$R^2$ won't save you automatically. Check it anyway.

---

_The centering misadventures described here are documented in the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) repo, notebook `04_normalization_in_panel_models.ipynb`. Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/)._
