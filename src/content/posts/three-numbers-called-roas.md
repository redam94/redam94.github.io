---
title: "Three Numbers Called ROAS"
author: Matthew Reda
pubDatetime: 2026-07-21T13:14:53Z
slug: three-numbers-called-roas
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - decision-making
description: Contribution ROI, counterfactual ROI, and marginal ROAS are three distinct estimands. They don't agree, and using the wrong one for budget decisions is the most common quiet error in MMM reporting.
---

Every MMM report I've seen has a table with a column labeled "ROAS." What it almost never has is a label explaining which ROAS — because most practitioners don't realize there are three of them, or they know there are differences and have decided not to explain them to the client.

The differences matter. They don't agree numerically, they don't answer the same question, and the one most commonly reported is the least useful for the decision the whole analysis was supposed to support.

## The three estimands

### Contribution ROI (the dashboard number)

This is what most tools call ROAS without qualification. You take the in-model attribution — the portion of sales your model assigns to each channel — and divide by spend:

$$\text{Contribution ROI}_c = \frac{\sum_t \text{contribution}_{c,t}}{\sum_t \text{spend}_{c,t}}$$

The contribution is typically defined as the counterfactual decrease in the model's fitted value if you removed the transformed media input for channel $c$. In the [`mmm-framework`](https://github.com/redam94/mmm-framework), this lives as `channel_contributions` — a Deterministic node built into the computation graph from the saturation-weighted adstocked spend.

This number is backward-looking. It describes what share of sales over the observed window can be attributed to each channel. It's useful for brand-level decomposition ("how much of our sales came from media vs baseline?") and for explaining the past.

### Counterfactual ROI (the zero-out estimate)

A conceptually cleaner causal estimand: actually predict what would have happened if the channel had spent nothing, then compare to what did happen.

$$\text{Counterfactual ROI}_c = \frac{\hat{y}(\text{observed}) - \hat{y}(\text{spend}_c \to 0)}{\text{spend}_c}$$

This is stricter than the contribution ROI because it runs a full posterior predictive pass under the zero-spend intervention, rather than reading a Deterministic already in the graph. In my framework, this is the `counterfactual_roi` estimand and it's explicitly separated from `contribution_roi` because they're not the same number in general.

Why do they differ? Two reasons. First, adstock. The carryover effect of channel $c$'s spend in week $t$ bleeds into weeks $t+1, t+2, \ldots$ The contribution attribution captures this bleed; but when you zero out spend, the full carry-forward also zeros. The contribution metric reads the carryover at each step; the counterfactual metric zeros it at the source. Depending on the adstock structure, this can move the number 5–20%. Second, interaction terms: if the model includes cross-channel synergies, zeroing one channel affects others, and the counterfactual captures the full cascade.

For most additive models without interactions, contribution ROI and counterfactual ROI are close. But they're not identical, they're not the same number, and they answer subtly different questions.

### Marginal ROAS (the decision-relevant number)

Neither of the above tells you what the *next dollar* in channel $c$ would return. That's marginal ROAS:

$$\text{mROAS}_c = \frac{\hat{y}((1 + \epsilon) \cdot \text{spend}_c) - \hat{y}(\text{spend}_c)}{\epsilon \cdot \text{spend}_c}$$

In practice this is a finite-difference approximation at $\epsilon = 0.10$ (a 10% perturbation). The mmm-framework computes this as `marginal_roas` and uses paired random seeds so the Monte Carlo noise cancels in the difference.

This is the number that belongs in a budget optimization. If you're deciding whether to shift dollars from channel A to channel B, you need the marginal returns — the slope of the response curve at current spend — not the average return over the whole observed window. An average ROAS of 3.0 is consistent with a marginal ROAS of 0.8 at high spend levels once saturation bites.

## Why they diverge — and by how much

The gap between contribution ROI and marginal ROAS is largest when:
- Spend is high relative to the saturation point (you're deep on the curve)
- The observed spend level isn't the "average" level — there were peak flights where marginal return was low

To see the intuition, consider a simple Hill saturation with half-saturation $K$ and slope $n = 1$:

$$f(x) = \frac{x}{x + K}$$

Average attribution ROI at spend $x$ is proportional to $f(x)/x = 1/(x+K)$, which falls as $x$ grows. Marginal ROAS is proportional to $\partial f/\partial x = K/(x+K)^2$, which falls faster. At $x = K$ (the inflection point), average ROAS is $0.5/K$ while marginal ROAS is $0.25/K$. Marginal is already half of average, and the gap widens beyond that.

The practical implication: a channel with average contribution ROI of 4.0 might have marginal ROAS of 1.2 if it's running heavy and you're into the saturation zone. Using the 4.0 to justify increasing budget would be wrong. Using the 1.2 — compared to the opportunity cost of the marginal dollar — is the right framing.

## What to report, and when

| Estimand | Answers | When to use |
|----------|---------|-------------|
| Contribution ROI | What share of sales came from this channel? | Retrospective decomposition, brand-level summary |
| Counterfactual ROI | What would sales have been without this channel? | Causal attribution, holdout validation |
| Marginal ROAS | What does the next dollar in this channel return? | Budget allocation, scenario planning |

The table that belongs in a budget recommendation meeting is the marginal ROAS table, not the contribution ROI table. If you're presenting to a CFO who has to decide whether to increase the TV line by $2M, they need to know what that $2M returns at the margin — not what the historical average return on all TV spend has been.

Presenting the contribution ROI in that context is the numerical equivalent of telling someone the average speed of a road trip to justify their lead foot on the final hill. The number is real; it's just not the right number for the decision.

## A practical note on uncertainty

All three estimands carry posterior uncertainty, and they carry it differently. The marginal ROAS uncertainty is typically wider than the contribution ROI uncertainty because it's computing a ratio of small differences (a 10% perturbation of spend), which amplifies noise in the response curve. In the framework, the marginal ROAS uses `finite_percentile` HDI with filtering of non-finite draws precisely because the denominator can be small and the ratio can blow up in individual posterior samples.

When you're reporting all three — which I'd recommend in any serious output — show the HDI on each. A contribution ROI of 3.2 (HDI: 2.8–3.7) next to a marginal ROAS of 1.1 (HDI: 0.6–1.8) tells a much more complete story than either number alone: this channel has historically paid out, but the evidence that the next dollar pays is weak.

---

_The `mmm-framework` estimands system formalizes all three as named, serializable estimands — `contribution_roi`, `counterfactual_roi`, `marginal_roas` — with explicit bit-stability rules distinguishing `diff_of_means` vs `mean_of_samples` point rules and different HDI methods per estimand. Related posts: [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/), [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/), [False Precision in Reporting](/posts/false-precision-in-reporting/)._
