---
title: "Average ROAS Is a History. Marginal ROAS Is a Decision."
author: Matthew Reda
pubDatetime: 2026-08-02T13:14:16Z
slug: marginal-vs-average-roas
draft: true
tags:
  - marketing-mix-modeling
  - statistics
  - optimization
  - bayesian
description: Average ROAS tells you how efficiently you spent money in the past. Marginal ROAS tells you what the next dollar is worth. They can disagree — badly — and optimizing from the wrong one sends budget to the wrong place.
---

Here's a slide I've seen in a lot of marketing reports. Two channels. Channel A has a 5× average ROAS. Channel B has a 2.4× average ROAS. The recommendation: lean into A, pull back on B. Clean story. Wrong answer.

The channel with the higher average ROAS is probably the one that's been getting the most budget for the longest time — which means it's the one most likely to be sitting in the flat tail of its saturation curve. The next dollar into that channel might be worth almost nothing. The channel with the "weaker" average ROAS might be the one where more spend would actually do something.

This is the marginal ROAS problem, and it's one of the things `mmm-framework`'s budget optimizer is specifically designed to handle.

## Two different numbers, one table

Average ROAS is a historical accounting. For a channel that received spend $s$ and drove incremental contribution $C$:

$$\text{Average ROAS} = \frac{C}{s}$$

It answers: "Given everything we spent, what did we get back?" Useful for accountability. Not useful for deciding where the next dollar goes.

Marginal ROAS is a derivative:

$$\text{Marginal ROAS} = \frac{dC}{ds}$$

It answers: "If we spend one more dollar here right now, how much do we get back?" That's the question that matters for allocation.

They're only equal when the response curve is linear — constant returns per dollar regardless of how much you spend. Response curves in real marketing are not linear. They saturate.

## Where the divergence comes from

The core model in `mmm-framework` uses an exponential saturation transform applied after adstock:

$$f(x) = 1 - e^{-\lambda x}$$

Here $x$ is the adstocked spend and $\lambda$ controls how quickly the channel saturates. The channel's contribution is $\beta \cdot f(x)$.

From this the two ROAS figures are:

$$\text{Average ROAS} = \frac{\beta \cdot (1 - e^{-\lambda s})}{s}$$

$$\text{Marginal ROAS} = \beta \cdot \lambda \cdot e^{-\lambda s}$$

Average ROAS starts high and declines slowly as spend grows — the numerator is bounded by $\beta$ but the denominator keeps growing. Marginal ROAS starts at $\beta \lambda$ (the initial slope) and decays exponentially toward zero. At high spend, marginal ROAS collapses well before average ROAS does.

Concretely. Say Search has parameters $\beta = 8$, $\lambda = 3$, and is running at $s = 1.5$ (in millions). Its saturation factor is $1 - e^{-4.5} \approx 0.989$ — nearly fully saturated. Average ROAS: $8 \times 0.989 / 1.5 \approx 5.3$×. Marginal ROAS: $8 \times 3 \times e^{-4.5} \approx 0.26$×. 

The dashboard says 5.3×. The next dollar is worth 0.26×. Those are not close, and the gap is the shape of the curve, not noise.

Now put Social in the same table: $\beta = 3$, $\lambda = 1$, running at $s = 0.5$. Average ROAS: $\approx 2.4$×. Marginal ROAS: $3 \times 1 \times e^{-0.5} \approx 1.8$×. Average ROAS says Search is more than twice as productive. Marginal ROAS says the next dollar into Social is roughly seven times more valuable than the next dollar into Search.

## What optimal allocation actually requires

The condition for an optimal unconstrained allocation — the one that maximizes total contribution for a fixed budget — is that marginal ROAS is equal across all channels:

$$\frac{dC_A}{ds_A} = \frac{dC_B}{ds_B} = \cdots$$

If they're not equal, you can increase total output by shifting budget from the lower-marginal channel to the higher-marginal one. You keep shifting until they equalize. This is the standard result from calculus-based optimization, and it's why the `budget.py` optimizer uses a greedy marginal allocation — repeatedly assigning a small increment to whichever channel has the highest marginal contribution per dollar at its current spend level:

```python
def _greedy_allocate(curves, spend_grid, total_budget, lo_spend, hi_spend, n_steps=400):
    """Allocate by repeatedly giving the next increment to the highest-marginal channel.
    Exact for concave (saturating) response curves."""
    alloc = lo_spend.copy()
    step = (total_budget - alloc.sum()) / n_steps

    for _ in range(n_steps):
        gains = [marginal(c, alloc[c]) if alloc[c] + step <= hi_spend[c] else -inf
                 for c in range(n_channels)]
        alloc[argmax(gains)] += step
    return alloc
```

Note what this is optimizing *against*: not which channel has the highest average ROAS, but which has the highest marginal return right now given current allocation. As spend increases in a channel, its marginal return falls and eventually other channels become better uses of the next increment.

## Uncertainty about the margin

There's a second complication. Even if you believe average ROAS numbers from your MMM, marginal ROAS at a specific spend level is more sensitive to model structure. The [adstock/saturation identification post](/posts/adstock-saturation-identification/) covers why these parameters are often weakly identified — different combinations of decay rate, saturation shape, and coefficient $\beta$ can produce nearly identical fits while implying very different response curve slopes.

This is why the `mmm-framework` optimizer runs the greedy allocation separately for each posterior draw and reports a distribution of optimal allocations, not a point estimate. The question isn't just "where should the budget go?" but "how confident are we in that answer?" A tight posterior over allocations means the model is decisive; a wide one means different plausible parameterizations prefer different channels, and a test is worth running before committing.

The lifecycle notebooks track this explicitly: a "reallocation with a confidence band" is different from a reallocation with a point estimate. The band is the honest answer.

## The practical upshot

A few things to do differently:

**Don't use average ROAS to rank channels for incremental budget.** Average ROAS ranks historical efficiency. It rewards channels that were efficient early and have been spending heavily since. Marginal ROAS ranks what happens to the *next* dollar.

**Check where each channel sits on its curve.** If a channel's spend is in the flat upper range of its saturation function — close to the asymptote — its marginal ROAS is near zero regardless of what the average looks like. The diagnostic: if doubling the spend barely changes predicted contribution, you're saturated.

**Equalize marginal ROAS, not average ROAS.** The efficient budget is the one where you can't improve total output by moving a dollar from one channel to another. That happens when marginal returns are equal. Average returns being equal is a coincidence, not an optimum.

Average ROAS is how you explain last quarter. Marginal ROAS is how you defend next quarter's plan.

---

_The budget optimizer is in `mmm_framework.planning.budget` — `compute_response_curves` samples the posterior spend-response curves and `_greedy_allocate` finds the allocation. The lifecycle notebook series (`nbs/lifecycle/`) walks through the full prioritize → design → calibrate → allocate loop on a synthetic brand with known ground truth. Related posts: [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/), [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Closing the Loop: MMM Calibration from Experiments](/posts/closing-the-loop-mmm-calibration/)._
