---
title: "Dividing by the Group Mean Is Not the Same as Subtracting It"
author: Matthew Reda
pubDatetime: 2026-09-07T13:23:27Z
slug: panel-divide-vs-demean
draft: true
tags:
  - statistics
  - regression
  - panel-data
  - marketing-mix-modeling
description: A common preprocessing shortcut in panel models — dividing each unit's values by its group mean — looks like demeaning but quietly corrupts your coefficients in a predictable direction.
---

I've seen this mistake in production models more than once, and it's the kind of bug that's nearly impossible to catch by looking at output. The model converges, residuals look reasonable, R² is good, and the coefficients are positive and plausible. They're also wrong.

The mistake: normalizing a panel dependent variable by **dividing** each unit's values by its group mean, instead of **subtracting** the group mean. Both operations produce a residual that looks "demeaned." Only one actually demeans. The other quietly distorts every coefficient in a systematic, predictable direction.

## The two operations aren't the same model

Say you have log-sales for 20 stores over 156 weeks. You want to remove store-level baseline differences — different cities, different foot traffic — so the regression captures within-store variation.

**Subtraction (correct demeaning):**

$$\tilde{y}_{it} = \log y_{it} - \overline{\log y}_{i\cdot}$$

This shifts each store's series to be centered at zero. The model for the demeaned outcome recovers $\beta$ — the within-unit relationship between the predictor and the outcome — because subtracting a constant from the outcome shifts the intercept and leaves the slope untouched. The units are commensurable across every store.

**Division (the wrong version):**

$$\hat{y}_{it} = \frac{\log y_{it}}{\overline{\log y}_{i\cdot}}$$

This also produces a series hovering near 1, which looks similar. But watch what happens to the model. Call $\mu_i = \overline{\log y}_{i\cdot}$. The divided outcome satisfies:

$$\frac{\log y_{it}}{\mu_i} = \frac{\alpha_i}{\mu_i} + \frac{\beta}{\mu_i} X_{it} + \frac{\varepsilon_{it}}{\mu_i}$$

The slope is now $\beta / \mu_i$ — it depends on the store's own baseline log-sales. When you pool across stores, you estimate a weighted average of $\beta / \mu_i$ across units, not $\beta$ itself. And since $\mu_i$ varies — large stores have higher baseline log-sales than small ones — the pooled estimate is biased whenever store size and predictor effect are correlated. The direction is predictable: larger stores (bigger $\mu_i$) contribute smaller slopes to the average, so the pooled estimate is pulled toward zero.

## What it looks like in practice

My [common regression issues](https://github.com/redam94/common_regression_issues) repo (notebook 04) has a synthetic example with exactly this structure:
- 20 stores, 156 weeks
- A trend and annual seasonality in log-sales
- Two covariates with known true log-scale effects: $\beta_1 = -0.012$, $\beta_2 = 0.074$

Three random-effects models on the same data, differing only in how the dependent variable is prepared:

| Model | True $\beta_1$ | $\hat\beta_1$ | True $\beta_2$ | $\hat\beta_2$ | R² (Between) |
|---|---|---|---|---|---|
| Standard (log-sales) | −0.012 | −0.017 | 0.074 | 0.076 | 0.007 |
| Subtract-normalized | −0.012 | −0.014 | 0.074 | 0.073 | −1.3 × 10²⁸ |
| Divide-normalized | −0.012 | −0.009 | 0.074 | 0.052 | −8.2 × 10²⁷ |

Two things stand out immediately.

**The coefficients are attenuated in the divide-normalized model.** Both estimates are pulled toward zero — by about 30% for $\beta_2$ (0.052 vs. 0.074). This is not random noise or small-sample variance. It's the unit-rescaling bias I described above: dividing by $\mu_i$ introduces a per-store slope compression, and the pooled estimate averages those compressed slopes.

**The between-R² goes to astronomical negative values in both normalized models.** An R² of $-10^{28}$ is not a confidence issue; it's a diagnostic alarm. The model is fitting a quantity that's been transformed into incomparable units across stores, then trying to compare stores to each other. The between-variation estimate has lost its meaning. Standard R² on the log-scale model is 0.007 — small, because a log-scale random-effects model doesn't explain much between-unit variance once you've absorbed store effects — but at least it's interpretable. $-8 \times 10^{27}$ is the statistic telling you it can't compute what you asked for.

## Why this keeps happening

The intuition behind dividing is usually "I want to put all my stores on the same scale." Store A does 1,000 units a week; store B does 100,000. If I divide by the mean, both series oscillate around 1.0 and they feel comparable.

The problem is that this indexing changes *what the model is estimating*. Dividing by $\mu_i$ rescales the slope too — and rescales it differently for each store. You're not adding a neutral preprocessing step; you're changing the model's functional form. The pooled slope is no longer a single $\beta$; it's an average of $\beta / \mu_i$ across stores, which equals $\beta$ only if all $\mu_i$ are identical (which they're not — that's why you wanted to normalize).

Subtraction doesn't have this problem. Shifting the dependent variable by a constant shifts the intercept and leaves the slope untouched:

$$(\log y_{it} - \mu_i) = (\alpha_i - \mu_i) + \beta X_{it} + \varepsilon_{it}$$

The slope is still $\beta$ for every store. The normalization absorbed the baseline; the coefficient is intact.

A quick sanity check: fit your model on raw log-sales and on your normalized version, and compare the within-R² and coefficient magnitudes. A safe normalization changes the intercept structure; a bad one changes the slopes. If the slopes move appreciably across the two versions, the normalization is acting as part of the model, not as a neutral preprocessing step.

## This is a modeling choice, not a cleaning step

The framing I find useful: there is no such thing as neutral data preparation in a regression. Every transformation of the dependent variable — log, difference, normalization, indexing — is a choice about what quantity the model is estimating, and "divide vs. subtract" is not a stylistic preference. It's a structural difference with a derivable formula for the resulting bias.

This is the same principle as [the assumptions are the model](/posts/the-assumptions-are-the-model/): the model doesn't know you intended to demean. It estimates the model you gave it, which is the model implied by the preprocessing you applied. "Divide by the group mean" and "subtract the group mean" look nearly identical in a pipeline, produce residuals that look nearly identical visually, and give you very different inference. The output won't warn you. The coefficients will look plausible. The bias is structural and it computes quietly.

In geo-level MMMs, store-level sales models, and panel regressions of any kind: normalize your dependent variable by **subtracting** the unit mean, not dividing by it. If the thing you actually want is "sales as a fraction of the unit's baseline" — a ratio interpretation — then say so explicitly and interpret the model accordingly, knowing that the slopes now measure relative-to-baseline effects rather than absolute log-scale effects. What you can't do is use the ratio transformation and then read the coefficients as if they were the absolute log-scale effects. The model is not that.

---

_The divide-vs-subtract demonstration is in notebook 04 of [`common_regression_issues`](https://github.com/redam94/common_regression_issues). Related: [The Within-Between Distinction in Panel Regressions](/posts/within-between-persons/) on what within-unit variation actually estimates, [The Assumptions Are the Model](/posts/the-assumptions-are-the-model/) on how preprocessing shapes inference, and [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/) for a similar attenuation pattern with a different root cause._
