---
title: "Subtract, Don't Divide: How Normalization Breaks Panel Regression"
author: Matthew Reda
pubDatetime: 2026-07-25T13:12:48Z
slug: subtract-dont-divide-panel-normalization
draft: true
tags:
  - regression
  - panel-data
  - marketing-mix-modeling
  - statistics
description: When running a panel regression across stores or markets, "normalizing" sales by dividing by the unit mean seems sensible — but it silently corrupts your coefficients in a way that subtraction never does.
---

Panel regression models — multi-store MMMs, hierarchical geo models, any setup with the same units observed repeatedly — almost always start with a data-prep step. The raw sales numbers span an order of magnitude across stores. Someone suggests normalizing them so the model isn't dominated by the biggest units. That instinct is fine. The question is whether you normalize by **dividing** or by **subtracting**.

They sound equivalent. They are not. Dividing by the unit mean produces biased, uninterpretable coefficients. Subtracting it — classical demeaning — preserves the linear structure and gives you exactly what you were after. This is a specific, fixable error I've documented in the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) notebook on centering in panel models, and it shows up often enough in practice that it's worth walking through carefully.

## The setup

Suppose you have log-sales across $i = 1, \ldots, N$ stores and $t = 1, \ldots, T$ time periods. The true data-generating process is:

$$\log Y_{it} = \mu_i + \mathbf{X}_{it}^\top \boldsymbol{\beta} + \varepsilon_{it}$$

where $\mu_i$ is a store-level fixed effect (baseline), $\mathbf{X}_{it}$ holds time-varying covariates (media spend, price, promotions), $\boldsymbol{\beta}$ is the coefficient vector you want to estimate, and $\varepsilon_{it}$ is mean-zero noise.

A standard fixed-effects (within-group) estimator recovers $\boldsymbol{\beta}$ by **subtracting** each store's time-mean from both sides:

$$\log Y_{it} - \bar{Y}_i = (\mathbf{X}_{it} - \bar{\mathbf{X}}_i)^\top \boldsymbol{\beta} + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

where $\bar{Y}_i = \frac{1}{T}\sum_t \log Y_{it}$. The store fixed effects $\mu_i$ cancel algebraically. What remains is a clean regression of within-store deviations on within-store covariate deviations, and the coefficients $\boldsymbol{\beta}$ are identified from within-unit variation only. This is why the [within-between distinction](/posts/within-between-persons/) matters: the fixed-effects estimator answers "when store $i$'s media spend is above its own average, are sales above the store's own average?" — not "do high-spending stores have higher sales?"

## What dividing does instead

The div-normalized version replaces the log-sales dependent variable with:

$$\tilde{Y}_{it} = \frac{\log Y_{it}}{\bar{Y}_i}$$

This looks harmless — it's just a rescaling, right? Let's substitute the true model:

$$\tilde{Y}_{it} = \frac{\mu_i + \mathbf{X}_{it}^\top \boldsymbol{\beta} + \varepsilon_{it}}{\bar{Y}_i}$$

Expand the denominator: $\bar{Y}_i = \mu_i + \bar{\mathbf{X}}_i^\top \boldsymbol{\beta} + \bar{\varepsilon}_i$.

Now this gets messy fast. The numerator and denominator both contain $\boldsymbol{\beta}$, and they interact nonlinearly. If you fit a linear regression on $\tilde{Y}_{it}$, your coefficient vector is not $\boldsymbol{\beta}$. It is some store-specific rescaling of it:

$$\hat{\boldsymbol{\beta}}_{\text{div}} \approx \frac{\boldsymbol{\beta}}{\bar{Y}_i}$$

But $\bar{Y}_i$ varies by store. Every store is implicitly working on a different scale. When you average across stores — which is what pooling the regression does — you get a weighted muddle of store-specific rescaled effects. The estimates you pull out don't correspond to any single quantity in the underlying model.

In code, the difference is one character:

```python
# Wrong — div-normalized DV
y_div = log_sales / log_sales.groupby("store_id").transform("mean")

# Right — subtraction-demeaned DV
y_sub = log_sales - log_sales.groupby("store_id").transform("mean")
```

Both look like "centering." One is. One isn't.

## The second mistake: centering only the dependent variable

There's a related pitfall that's subtler. Suppose you correctly subtract the store mean from log-sales — but you don't demean the independent variables. The model you're fitting is:

$$(\log Y_{it} - \bar{Y}_i) = \mathbf{X}_{it}^\top \boldsymbol{\gamma} + u_{it}$$

where $\mathbf{X}_{it}$ still contains its original level, not its within-store deviation. This isn't the fixed-effects estimator. It still includes between-store variation in the X variables. The coefficient $\boldsymbol{\gamma}$ is a blend of within- and between-unit effects — the same blend problem I described in [the within-between post](/posts/within-between-persons/), just now wearing demeaned clothing.

The fix is symmetric centering: subtract the unit mean from both sides.

```python
store_mean_y = log_sales.groupby("store_id").transform("mean")
store_mean_X = X.groupby("store_id").transform("mean")

y_demeaned = log_sales - store_mean_y
X_demeaned = X - store_mean_X
```

This is what a proper within-group fixed-effects model does. The linearmodels package in Python does it internally when you specify `EntityEffects`:

```python
from linearmodels import PanelOLS

model = PanelOLS(
    dependent=y,        # log-sales, not pre-demeaned
    exog=X,             # raw covariates, not pre-demeaned
    entity_effects=True # the library does the demeaning correctly
)
result = model.fit()
```

Letting the library handle the demeaning is less error-prone than pre-processing manually — and it correctly handles the degrees-of-freedom adjustment that comes from removing the unit means.

## Why this bites MMMs specifically

Multi-market MMMs often work in log-space for good reasons: it respects the positivity constraint on sales, puts percentage changes on the same scale regardless of market size, and gives the adstock and saturation transformations a natural home. But working in log-space amplifies the divide-versus-subtract distinction.

If market A has mean log-sales of 10 and market B has mean log-sales of 6, div-normalization is dividing market A's coefficients by 10 and market B's by 6. The same media coefficient becomes 0.1 in A and 0.17 in B — not because the effect differs, but because the normalization does. A pooled estimate across markets now carries whatever weights happened to fall out of the regression, which is nobody's definition of "the effect of media on sales."

The sub-normalization mistake leads to a model that's implicitly asking two different questions at once: "what do high-spending markets look like?" and "when does a market spend more than usual, what happens?" Both questions are legitimate, but blending them into one coefficient obscures the answer to either.

## How to check your model

Three quick diagnostics when you inherit a panel regression:

1. **Look at how the dependent variable was constructed.** If the code says `/ group_mean`, flag it. If it says `- group_mean`, check that X was also demeaned.

2. **Check whether the library is doing the demeaning or the pre-processing is.** If the data goes into the model already demeaned, verify that both Y and X were treated the same way.

3. **Simulate from a known DGP.** Generate data with known coefficients, run the model, check that you recover them. If div-normalization is in the pipeline, the recovered coefficients will be scaled down by roughly $1/\bar{Y}$ — a small but systematic miss that's hard to catch without the ground truth. (SBC at the model-architecture level, [as I've written about](/posts/simulation-based-calibration/), catches exactly this class of failure.)

The data-prep step feels like boilerplate. It isn't. Subtract the unit mean from both the outcome and the covariates, let a fixed-effects estimator do it for you, or use a Bayesian hierarchical model that places a prior over unit effects rather than algebraically eliminating them. Just don't divide. The coefficients you get back aren't the ones you wanted.

---

_The centering and normalization examples here are from the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) notebooks, specifically the panel normalization notebook. The within-between decomposition is covered in [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/). The simulation-based check for model correctness is in [Simulation-Based Calibration: The Missing Test in Your Bayesian Workflow](/posts/simulation-based-calibration/)._
