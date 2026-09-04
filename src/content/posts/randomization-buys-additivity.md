---
title: "Randomization Buys Additivity: Why Geo Experiments Can Use Simpler Models Than Your MMM"
author: Matthew Reda
pubDatetime: 2026-07-08T13:11:26Z
slug: randomization-buys-additivity
draft: true
tags:
  - marketing-mix-modeling
  - causal-inference
  - bayesian
  - experiment-design
description: In a randomized geo experiment, an additive response surface estimates the right thing without bias — even when the true effects are multiplicative. Here is why, and when the guarantee breaks down.
---

The standard marketing mix model is multiplicative. Media effects scale with baseline demand — a bigger season lifts revenue from TV and from search by a factor proportional to how much the market is already spending. The usual form is something like $y_t = \text{baseline}(t) \cdot \prod_c \text{effect}_c(s_{ct})$, or equivalently, additive in log space. If you fit an additive model on observational data when the truth is multiplicative, the misattribution lands in your media coefficients and biases your ROI estimates. That is a real problem and the multiplicative structure is the right response to it.

But I've been building a model-free geo-experiment loop in the [mmm-framework](https://github.com/redam94/mmm-framework) — called the continuous-learning module — that fits a purely additive response surface:

$$R(s) = \sum_c \beta_c f_c(s_c) + \sum_{c < c'} \gamma_{cc'} f_c f_{c'}$$

And I keep getting the question: if your MMM needs to be multiplicative, why does your experiment loop get to be additive?

The short answer is that randomization does the work multiplicativity was doing in the observational model. Let me make that precise.

## Why observational MMMs need multiplicativity

In an observational time series, spend is correlated with baseline demand. Budgets chase seasons: TV spend is higher in Q4 not because someone decided to test it but because December drives more revenue and the budget follows it. Under the multiplicative truth $y_t = a_t \cdot (1 + r(s_t))$, if you fit the additive model $y_t = a + R(s_t)$, the seasonal covariation between $a_t$ and $s_t$ flows into your $R$ estimates — the media coefficients absorb some of the baseline variation because the two are correlated in the data. The bias is structural. More data makes it worse, not better, by shrinking intervals around the wrong number (I wrote about a closely related version of this in [More Data, More Confident, Still Wrong](/posts/more-data-more-confident-still-wrong/)).

The multiplicative model resolves this by explicitly modeling the interaction between baseline and effect. Now the media coefficient captures only the fractional lift; the seasonal scaling is handled separately.

## What randomization changes

In a designed geo experiment, budget allocation is randomized across geographies. Each geo is assigned to a spending cell — some go dark, some run at the status quo, some get a lift — and the assignment is shuffled so that cell assignment is independent of the geo's baseline demand.

By construction, $E[a_g \mid \text{cell}] = \bar{a}$ for every cell. Under the multiplicative truth, the cell means are:

$$E[y \mid \text{cell } c] = \bar{a} \cdot (1 + r(s_c))$$

which is $\bar{a} + \bar{a} \cdot r(s_c)$ — exactly what an additive surface estimates. The quantity $\bar{a} \cdot r(s)$ is the population-average incremental response at spend level $s$, and it is exactly what the allocator needs to optimize: how much incremental KPI does spend $s$ generate on average across the market?

Randomization breaks the spend-baseline correlation that made multiplicativity necessary. Misspecification no longer produces bias in the decision-relevant estimand. Instead it shows up as **heteroskedastic noise**: in geos larger than average, the residual around the additive fit is $\left(a_g - \bar{a}\right) \cdot r(s)$, which grows with both the geo size deviation and the treatment effect. You get efficiency loss (wider posterior uncertainty), not systematic bias in the funded allocation.

Two design choices in the module directly address this efficiency cost. **CUPED adjustment** removes the geo-level baseline variation from the outcome before fitting — absorbing the dominant part of the $a_g$ spread and making the residuals closer to homoskedastic. **Student-t likelihood** stops the large-residual geos from exerting disproportionate influence on the surface, the same way it handles outliers anywhere else.

## The γ term captures the leading multiplicative cross-effect

If the true DGP composes channels multiplicatively,

$$y = a \cdot \prod_c (1 + \rho_c f_c(s_c))$$

expanding to second order gives:

$$y \approx a \cdot \left(1 + \sum_c \rho_c f_c + \sum_{c < c'} \rho_c \rho_{c'} f_c f_{c'} + O(f^3)\right)$$

The cross-term $\sum_{c < c'} \rho_c \rho_{c'} f_c f_{c'}$ is exactly the $\gamma_{cc'} f_c f_{c'}$ block in the additive surface, with $\gamma_{cc'} = \bar{a} \cdot \rho_c \rho_{c'}$. A multiplicative world doesn't sit outside the model class — it shows up as positive synergies between channels. The third-order and higher terms are material only when several channels are simultaneously deep in saturation, which is outside the experimental trust region anyway.

## When the guarantee breaks down

Randomization is the load-bearing assumption. Three situations stress it:

**Very unequal geo sizes with per-geo allocation targets.** The additive surface recovers the population-average response. If you need per-geo funding decisions and effects scale with geo size, a common $R$ misallocates. The module allocates a national mix, not per-geo — that constraint is a feature when it holds, a warning sign when it doesn't.

**Wide intensity ranges.** The additive surface is a local approximation that the loop re-centers on each wave. At large perturbations ($\pm 100\%$ or more from status quo), the first-order linearity argument weakens and the re-centering doesn't fully compensate. The practical guidance: trust the funded-set ranking more than channel-by-channel magnitudes at wave edges.

**Rate or share KPIs.** Conversion rate, awareness share, click-through rate — these are bounded outcomes that compose multiplicatively or logistically by nature. The additive surface can locally approximate, but the observation family is also wrong. This is a likelihood-and-link problem, not just an effect-scale problem.

## A diagnostic to run before committing

Before assuming the additive surface is adequate on a real program, there is a cheap check. Split geos into baseline terciles using the pre-period mean KPI (already computed for CUPED). Within each tercile, compute the designed contrast: the mean outcome in high-spend cells minus the mean in shutoff or low-spend cells. Under the additive truth, the lift should be flat across terciles. Under multiplicative truth, it should scale with the tercile baseline.

More precisely: report the slope of $\text{lift}_T / \text{lift}_{\text{pooled}}$ against $\bar{a}_T / \bar{a}_{\text{pooled}}$ with a bootstrap confidence interval. Slope near zero means the additive surface is not just defensible but preferred (fewer parameters, no new identification burden). Slope near one means effects scale with baseline and the proportional-effects variant warrants investigation.

## The punchline

The MMM's "media must be multiplicative" instinct is about confounded observational data. Budgets chase seasons; spend and baseline move together; omitting their interaction biases the coefficients. In a designed geo experiment, randomization removes that confounding by construction. The additive surface then estimates the decision-relevant quantity — population-average incremental response — without bias. Misspecification becomes a noise problem rather than a bias problem, and the loop's re-centering makes it manageable across waves.

This is the same broader principle I keep running into in causal inference: when you randomize, you get to be simpler. The assumptions your observational model needed to be correct are now handled by design. The model can focus on estimation rather than confounding adjustment.

---

_Source material: the `continuous_learning` module of [mmm-framework](https://github.com/redam94/mmm-framework), particularly `technical-docs/continuous-learning-multiplicative-effects.md`, which develops the argument in detail. Related posts: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [More Data, More Confident, Still Wrong](/posts/more-data-more-confident-still-wrong/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/)._
