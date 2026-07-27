---
title: "Don't Index Your Panel Data: The Centering Trap in Geo MMMs"
author: Matthew Reda
pubDatetime: 2026-07-27T13:29:10Z
slug: panel-indexing-centering-trap
draft: true
tags:
  - regression
  - marketing-mix-modeling
  - statistics
  - panel-data
description: Dividing geo-market sales by their time-average to "normalize" markets is not the same as subtracting the average — and the difference introduces coefficient bias that's easy to miss and hard to argue away.
---

When you're building a geo-level MMM across fifty or two hundred markets, the spread in raw sales volume is often enormous. A top-ten DMA might move five hundred times the volume of a rural micro-market. The instinct is to make them commensurable before fitting — to "index" each market's sales relative to itself.

The typical move: divide log sales by the market's log-sales average. Now every series floats around 1.0 instead of drifting across three orders of magnitude. It looks tidy. The model fits. And the coefficients are biased in a way that's subtle enough to miss and persistent enough to matter.

This post is the math behind that failure, and the two-line fix.

## The three ways to handle market size

Say your panel is $Y_{it}$ — log sales for market $i$ at week $t$. You have a predictor $X_{it}$ (media spend, indexed similarly). Three treatments of $Y$ circulate in practice:

**1. No normalization.** Fit the log model directly with market fixed effects:

$$\log Y_{it} = \alpha_i + \beta X_{it} + \varepsilon_{it}$$

The $\alpha_i$ absorbs each market's baseline level. This is the textbook panel-data answer.

**2. Sub-normalization (subtract the group mean).** Demean within each market:

$$\log Y_{it} - \bar{Y}_i = \beta (X_{it} - \bar{X}_i) + (\varepsilon_{it} - \bar{\varepsilon}_i)$$

where $\bar{Y}_i = T^{-1}\sum_t \log Y_{it}$. This is algebraically identical to the fixed-effects estimator — demeaning is exactly what the within-group transformation does. The coefficients are the same as in (1).

**3. Div-normalization (divide by the group mean).** This is the indexing move:

$$\frac{\log Y_{it}}{\bar{Y}_i} = \beta^{\text{div}} X_{it} + \varepsilon^{\text{div}}_{it}$$

These three transformations are not equivalent. (1) and (2) give the same $\beta$. (3) gives something different.

## Why division and subtraction aren't the same

Let $Z_{it} = \log Y_{it}$ and $\mu_i = \bar{Z}_i$ (the market's time-averaged log sales). Then:

- Sub-normalization produces $Z_{it} - \mu_i$ as the dependent variable
- Div-normalization produces $Z_{it} / \mu_i$ as the dependent variable

Now suppose the true model is:

$$Z_{it} = \mu_i + \beta X_{it} + \varepsilon_{it}$$

Under sub-normalization: $(Z_{it} - \mu_i) = \beta X_{it} + \varepsilon_{it}$. Run an OLS on this and you recover $\beta$. Clean.

Under div-normalization: $Z_{it} / \mu_i = 1 + \beta X_{it}/\mu_i + \varepsilon_{it}/\mu_i$. Run an OLS on this and you're fitting a model where the effective coefficient on $X_{it}$ is $\beta / \mu_i$ — rescaled by the market's log-sales average. If you then regress the div-normalized $Z/\mu_i$ on the original $X_{it}$ (not $X_{it}/\mu_i$), you recover $\hat\beta^{\text{div}} \approx \beta \cdot \mathbb{E}[1/\mu_i]$, which isn't $\beta$ unless every market has the same $\mu_i$.

Worse: markets with different average sales levels get implicitly downweighted in proportion to $\mu_i^{-1}$ relative to what fixed-effects OLS would do. Small markets (low $\mu_i$, small log-scale mean) get inflated influence on the estimate; large markets get deflated. The estimate you recover is a size-distorted weighted average of $\beta$ across markets, not the effect you want.

The figure in my [common regression issues notebook](https://github.com/redam94/common_regression_issues/blob/main/nbs/04_normalization_in_panel_models.ipynb) makes this concrete: on synthetic data with a known true coefficient, the div-normalized model produces estimates that are consistently off — and the direction and magnitude of the bias depend on the variance in market sizes, not on anything in the signal itself.

## The partial-centering trap

There's a second failure mode that often travels with the first: centering only the dependent variable, not the predictors.

If you demean $Y$ but leave $X$ uncentered, you're fitting:

$$Z_{it} - \mu_i = \beta X_{it} + \varepsilon_{it}$$

instead of the correct:

$$(Z_{it} - \mu_i) = \beta (X_{it} - \bar{X}_i) + \varepsilon_{it}$$

The bias here is more familiar — it's exactly the [within/between confound](/posts/within-between-persons/) I described in the Rohrer & Murayama post. When you don't remove the market-level mean of $X$, the coefficient $\beta$ is a blend of the within-market response (how this market's sales move when its own spend varies) and the between-market association (do markets with higher average spend also have higher average sales?). Whether those two effects agree depends on your data. In most geo panels they don't, because larger markets both spend more and sell more for reasons unrelated to media effectiveness.

The point is worth emphasizing: **partial centering — center Y but not X — doesn't give you fixed effects. It gives you a blend.** Fixed effects require demeaning both sides of the equation.

## What to do

The correct treatment for a geo panel with heterogeneous market sizes:

```python
import linearmodels as lm

# Log-transform and demean within market (fixed effects)
# linearmodels does this automatically via between_entity=False
model = lm.PanelOLS(
    dependent=np.log(df['sales']),
    exog=df[['spend', 'price', 'seasonality']],
    entity_effects=True,        # the demeaning
    time_effects=False,
)
result = model.fit(cov_type='clustered', cluster_entity=True)
```

In a Bayesian MMM, the equivalent is a hierarchical model where each market gets its own intercept (or a prior that pools intercepts toward a common mean). Either way, the market-level baseline is a parameter in the model, not something you pre-remove by hand — and certainly not something you pre-remove by dividing.

If you've already div-normalized because "that's how the data prep step worked," the fix is to go back upstream and replace the division with a subtraction. The change is one line. The coefficient implications can be large.

## The diagnostic

The notebook simulation compares div-normed, standard fixed-effects, and sub-normed models side by side on synthetic data where the true coefficients are known. The result is predictable once you understand the math: div-normed coefficients are consistently biased and the residual patterns are wrong — recent periods fit poorly in some markets because the size-distortion accumulates over time.

A quick field test on your own data: run the div-normed model and the properly-fixed-effects model on the same panel. If the estimated media coefficients differ by more than a few percent, the bias is meaningful. If they match, either your markets are unusually homogeneous in size or the media variable has very low variance relative to baseline, and the distortion is swamped by noise.

The deeper point: centering is not a preprocessing trick you can apply to just the dependent variable as a normalization step and then forget. It defines what question the model is answering. **Sub-normalization asks "how does this market's sales move when its own predictor moves?" Div-normalization asks something murkier** — a size-weighted, mean-distorted something that doesn't correspond to any estimand I'd want to report to a client.

---

_The synthetic data experiment behind this post is in my [common_regression_issues repository](https://github.com/redam94/common_regression_issues/blob/main/nbs/04_normalization_in_panel_models.ipynb) (`nbs/04_normalization_in_panel_models.ipynb`). The within/between conceptual foundation is in [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/). Related: [Collinearity Can't Separate What the Data Conflates](/posts/collinearity-cant-separate/), [The Table 2 Fallacy](/posts/table-2-fallacy/)._
