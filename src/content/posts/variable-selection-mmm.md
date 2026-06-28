---
title: "The Illusion of Significance: Why p-value Variable Selection Breaks Marketing Mix Models"
author: Matthew Reda
pubDatetime: 2026-06-27T13:05:22Z
slug: variable-selection-mmm
draft: false
tags:
  - statistics
  - marketing-mix-modeling
  - bayesian
  - regression
description: Stepwise regression produces overconfident models with biased estimates — here's why that matters for MMM, and how Bayesian shrinkage priors fix the problem without breaking your causal identification.
---

Most marketing mix models I've seen use something like stepwise regression: fit the full model, look at the t-statistics, drop anything that isn't significant at p < 0.05, report what's left. The selection step is usually undocumented. Sometimes it's done by the framework automatically. Either way, the implicit logic is "if it's significant, it matters; if it isn't, it doesn't."

That logic is wrong in a specific, consequential way I call the illusion of significance — a topic I go through in detail in my [common regression issues resource](https://github.com/redam94/common_regression_issues). The short version: statistical selection based on p-values produces overconfident models with biased estimates. In an MMM context, where the wrong coefficient drives a real budget reallocation, that matters.

## What selection bias actually does to your estimates

The problem stated plainly: you have 30 candidate control variables — competitor spend, price indices, promotion flags, economic indicators. You plan to fit the model with all of them and drop anything below the significance threshold. The expected number of false positives under the null is 0.05 × 30 = 1.5, before any genuine signal. You'll keep noise, and you'll keep it with confidence.

But the bias problem is worse than the false-positive problem. The estimates you _retain_ are biased upward. When you condition on |t| > 1.96, you keep only the draws that cleared the threshold. A coefficient that's truly 0.0 but happened to be estimated at 0.3 due to sampling noise survives; the same coefficient estimated honestly at 0.1 gets cut. The retained estimates aren't random draws from the coefficient distribution — they're censored from below. This is sometimes called the winner's curse, and it means your kept coefficients systematically overstate the true effects.

The downstream result: a model that looks precise because you trimmed the noisy variables, but whose surviving coefficients are inflated and whose intervals don't mean what they claim. If those coefficients feed a budget optimization (and they always do), you're optimizing against a surface that was shaped by which effects happened to be large enough to survive a noise threshold this time.

## Bayesian shrinkage as the fix

The Bayesian alternative doesn't select variables at all. It includes all plausible candidates and lets the posterior decide how much weight to put on each one.

The main workhorse is the **horseshoe prior**. For each coefficient $\beta_j$, you place:

$$\beta_j \mid \lambda_j, \tau \sim \mathcal{N}(0,\, \tau^2 \lambda_j^2), \qquad \lambda_j \sim C^+(0,1), \qquad \tau \sim C^+(0,\, \tau_0)$$

The local scale $\lambda_j$ lets genuine signals stay large while noise gets shrunk toward zero. The global scale $\tau$ governs overall sparsity — you can set $\tau_0$ based on a prior belief about how many controls genuinely matter. You never threshold. A variable that's mostly noise gets a posterior centered near zero with a tight interval; a real effect stays where the data put it.

The **spike-and-slab** is more explicit about selection:

$$p(\beta_j) = (1 - \pi) \cdot \delta_0(\beta_j) + \pi \cdot \mathcal{N}(\beta_j \mid 0, \sigma^2)$$

Here $\pi$ is the prior inclusion probability. The posterior inclusion probability (PIP) for each variable is then a direct probabilistic answer to "how much does the data support including this?" — compared to the p-value, which answers the entirely different question of "how often would I see an effect this large if the true effect were zero?" PIPs are calibrated; p-values after selection are not.

Both the horseshoe and spike-and-slab (plus a Bayesian LASSO for uniform shrinkage) are available in the [`mmm-framework`](https://github.com/redam94/mmm-framework) variable selection module. You declare the prior in the channel or variable config, and the sampler handles the rest.

## The causal constraint you cannot skip

Here is the part that trips people up, and that the `mmm-framework` docs call out explicitly: **shrinkage priors belong on precision control variables, not on confounders.**

This is not a minor caveat. If you put a horseshoe prior on a confounder and the data is noisy, the posterior may shrink that coefficient toward zero — which is functionally the same as removing the variable from the model. A confounder you exclude is a confounder that biases your treatment estimates. The shrinkage that's helping you with noise is actively hurting your identification.

The distinction you need to make up front:

- **Confounder**: a variable you include because excluding it would bias your media coefficients. Seasonality driving both TV spend and sales is the classic example. This variable must be in the model. Use a weakly-informative Normal prior that reflects your beliefs about the plausible range. Do not allow shrinkage to zero.
- **Precision control**: a variable that explains variance in the outcome but whose exclusion wouldn't bias the things you care about — maybe an economic index that's uncorrelated with campaign planning. Here a horseshoe or spike-and-slab prior is appropriate.

This maps back to the point I made in [The Table 2 Fallacy](/posts/table-2-fallacy/): the reason a variable is in your model should determine how you treat it. Variables that are there to close backdoor paths need to stay put. Variables that are there to reduce noise can be regularized. Treating both the same — either by running stepwise selection on everything, or by running horseshoe prior on everything — gets the causal question wrong.

## What to write in your pre-spec

Before you look at data, for each candidate variable, answer two questions:

1. Would excluding this variable bias my channel coefficients? If yes, it's a confounder. Put it in unconditionally with a sensible informative prior.
2. Is it a plausible predictor that might reduce noise but isn't needed for identification? If yes, it's a precision control. Run a shrinkage prior and let the posterior decide.

That separation belongs in the pre-specification — in the config before you fit, not in a post-hoc "we dropped non-significant variables" footnote. If you can't write down why each candidate is in the model before you see the results, you're not doing variable selection. You're doing outcome-conditional model building with extra steps.

The illusion of significance isn't primarily a statistical failure. It's a specification failure: the selection strategy wasn't written down, wasn't justified, and couldn't be reviewed. Fix the process, and the statistics mostly fix themselves.
