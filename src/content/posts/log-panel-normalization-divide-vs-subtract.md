---
title: "The One-Character Normalization Bug in Log-Linear Panel Models"
author: Matthew Reda
pubDatetime: 2026-08-14T14:14:35Z
slug: log-panel-normalization-divide-vs-subtract
draft: true
tags:
  - regression
  - panel-data
  - statistics
  - marketing-mix-modeling
description: Dividing a log-scale dependent variable by its unit mean looks like centering but silently rescales every coefficient by a unit-specific constant — and your model will never tell you it happened.
---

Here is a mistake I've caught more than once, including in my own code. You have a log-linear panel model. You want to remove unit-level baseline differences — stores, geographies, products — so you "normalize" the dependent variable to a common scale. The natural-feeling thing to do is divide each unit's log-revenue by that unit's average log-revenue. After all, you're normalizing to a unit mean of 1.

The result looks well-behaved. Residuals are smaller. The model fits. But the coefficients are wrong. Not noisy — _wrong_, in a direction that doesn't get better with more data.

The fix is one character: subtract instead of divide.

## The setup

Take a log-linear panel model with $N$ units observed over $T$ periods:

$$\log(y_{it}) = \alpha_i + \beta\, x_{it} + \varepsilon_{it}$$

$\alpha_i$ is a unit-specific intercept (a fixed or random effect). $\beta$ is the coefficient you care about — the effect of $x$ on log-sales. $\varepsilon_{it}$ is IID noise. You want to estimate $\beta$.

The motivation for normalizing the dependent variable is real: units differ enormously in baseline volume, and that baseline variance dominates if you don't account for it. Two sensible-sounding approaches:

**Subtract the unit mean:**
$$\tilde{y}_{it}^{\text{sub}} = \log(y_{it}) - \overline{\log(y)}_i$$

**Divide by the unit mean:**
$$\tilde{y}_{it}^{\text{div}} = \frac{\log(y_{it})}{\overline{\log(y)}_i}$$

These look symmetric. They're not.

## Why division is wrong

Substitute the true model into each transformation and see what the regression actually estimates.

**Subtraction.** Subtracting the unit mean is standard within-group demeaning:

$$\tilde{y}_{it}^{\text{sub}} = \log(y_{it}) - \overline{\log(y)}_i = \beta(x_{it} - \bar{x}_i) + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

The unit fixed effect $\alpha_i$ cancels out exactly. What's left is a regression of the within-unit deviation in log-sales on the within-unit deviation in $x$, with the coefficient still equal to $\beta$. Clean.

**Division.** Dividing by the unit mean gives:

$$\tilde{y}_{it}^{\text{div}} = \frac{\log(y_{it})}{\overline{\log(y)}_i} = \frac{\alpha_i}{\overline{\log(y)}_i} + \frac{\beta}{\overline{\log(y)}_i}\, x_{it} + \frac{\varepsilon_{it}}{\overline{\log(y)}_i}$$

The fixed effect hasn't been removed — it's been rescaled to $\alpha_i / \overline{\log(y)}_i$, which is still unit-specific. And the coefficient on $x_{it}$ is now $\beta / \overline{\log(y)}_i$, which is **different for every unit**.

When you run a random-effects or pooled model on the divided DV, the estimator treats that coefficient as constant across units and returns a weighted average of $\beta / \overline{\log(y)}_i$. That average is not $\beta$ unless all units happen to have identical log-scale baseline means — which they don't, which is why you were normalizing in the first place.

The bias is systematic: if units have log-scale means above 1 (common when you're working in log-units of a large quantity), the denominator inflates and every coefficient is shrunken toward zero. The direction is predictable. The magnitude depends on the cross-unit distribution of $\overline{\log(y)}_i$.

## What the simulation shows

A simulation study in my [common_regression_issues](https://github.com/redam94/common_regression_issues) repo demonstrates this concretely on 20 synthetic stores, 156 weeks of weekly data, and two covariates with known true effects $\beta_1 = -0.012$ and $\beta_2 = 0.074$.

Three random-effects models, identical in everything except the DV transformation:

| Model                          | $\hat\beta_1$ | $\hat\beta_2$ | Between $R^2$            |
| ------------------------------ | ------------- | ------------- | ------------------------ |
| Standard (no DV normalization) | $-0.017$      | $0.076$       | $0.007$                  |
| Sub-normalized                 | $-0.014$      | $0.073$       | $-1.3\times 10^{28}$     |
| **Div-normalized**             | **$-0.0085$** | **$0.052$**   | **$-8.2\times 10^{27}$** |

The sub-normalized model produces coefficient estimates close to the truth (the negative between-$R^2$ is an artifact of a partially-transformed DV — the model is still estimating $\beta$ correctly from within-unit variation). The div-normalized model underestimates both coefficients by 25–30%.

Notice the between-$R^2$ for both normalized models: negative values in the billions. That's a flag that the model structure is misspecified relative to the transformation — the normalization has eaten the between-unit information without correctly removing the fixed effect. The standard model reports a small but positive between-$R^2$ of $0.007$ because the random-effects estimator is at least trying to use both sources of variation.

## The right way to do it in Python

If you want to work with a demeaned DV in a panel model:

```python
import pandas as pd
import numpy as np
import linearmodels as lm

# Assume df has columns: unit_id, time_period, log_sales, x1, x2
# Compute the correct transformation
unit_mean_log = df.groupby('unit_id')['log_sales'].transform('mean')

# Right: subtract
df['log_sales_sub'] = df['log_sales'] - unit_mean_log

# Wrong: divide
# df['log_sales_div'] = df['log_sales'] / unit_mean_log  # don't do this

df = df.set_index(['unit_id', 'time_period'])
X = sm.add_constant(df[['x1', 'x2']])
model = lm.RandomEffects(df['log_sales_sub'], X)
result = model.fit()
```

Note: if you want a proper fixed-effects estimator that demeans both sides, use `lm.PanelOLS` with `entity_effects=True` on the un-transformed DV and let the estimator handle the demeaning. The sub-normalized DV approach (demeaning only the outcome) is a partial transformation that still estimates $\beta$ correctly because the random effects absorb the remaining baseline shift — but it's cleaner to let the panel estimator do the demeaning automatically.

## Why this comes up in marketing

In marketing data, log-scale baselines vary enormously. A national brand's log-weekly-revenue might average 14; a regional brand's might average 10. If you're building a geo-level or store-level panel and someone normalizes by dividing the log-DV by the unit average — perhaps to make the data "unit-comparable" before modeling — you get the bias described above.

The sign of the bias is predictable (shrinkage toward zero) and won't raise any standard diagnostics. R-hat is fine. ESS is fine. The posterior looks narrow and plausible. The true coefficients are sitting 25% above what the model reports, and no diagnostic will tell you.

The same logic applies in any log-linear model where you're tempted to normalize by a group average: brand index models, geo-level MMMs, store-level regression. The moment you divide a log-transformed quantity by its group mean, the coefficient on every predictor becomes unit-scaled.

## The practical discipline

Before applying any DV normalization, ask what the transformation implies for the coefficient of interest. Write it out: what does $\beta$ estimate after you apply this transformation?

For subtraction: $\beta$ still estimates the effect of $x$ on log-sales. Correct.
For division: $\beta$ now estimates the effect of $x$ on log-sales-relative-to-unit-log-mean, which is a unit-scaled hybrid that doesn't have a clean causal interpretation.

The difference is one character in code. In Python it's the difference between `-` and `/` on the normalization line. The model won't catch it. The fit statistics won't catch it. The only way to catch it is to work through what the transformation does to your estimand before you run the regression.

This is documented more fully — with synthetic data generation and full model comparisons — in the [normalization notebook](https://github.com/redam94/common_regression_issues/blob/main/nbs/04_normalization_in_panel_models.ipynb) in the `common_regression_issues` repo.

---

_Grounded in the `04_normalization_in_panel_models` notebook from [common_regression_issues](https://github.com/redam94/common_regression_issues). Related posts: [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/), [Collinearity Doesn't Break Your Model — It Tells You What Your Data Can't Separate](/posts/collinearity-cant-separate/)._
