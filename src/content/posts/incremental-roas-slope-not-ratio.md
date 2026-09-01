---
title: "Your ROAS Dashboard Is Showing You an Average. Budget Decisions Need the Slope."
author: Matthew Reda
pubDatetime: 2026-09-01T13:29:25Z
slug: incremental-roas-slope-not-ratio
draft: true
tags:
  - marketing-mix-modeling
  - statistics
  - optimization
  - bayesian
description: The ROAS your MMM dashboard reports — attributed revenue divided by spend — is an average over your whole response curve, not the marginal return on the next dollar. These are different numbers, and confusing them produces systematically wrong allocation decisions.
---

Here's a question I've asked in a lot of planning rooms: "When you say this channel has a 4x ROAS, do you mean the next dollar will return four dollars?"

Usually the answer is "yes, that's what ROAS means." But that's almost never what's actually being reported. What the dashboard shows is _total attributed revenue divided by total spend_. That's an average over the whole response curve. The next dollar returns the marginal value — the slope of that curve at current spend — and in a saturated channel the slope can be a small fraction of the average.

These are not interchangeable. Using the average ROAS to decide whether to increase spend in a channel will push budget toward exactly the wrong places.

## What a marketing mix model actually estimates

An MMM doesn't estimate a ratio. It estimates a response function — a curve that maps spend to expected outcome. In the `mmm-framework` configuration, media channels use a Hill saturation function applied to adstock-transformed spend:

$$f(\tilde{x}) = \frac{\tilde{x}^{\,n}}{K^{\,n} + \tilde{x}^{\,n}}$$

where $\tilde{x} = x / \bar{x}$ is spend indexed to its mean and $K$ is the half-saturation point in those same units. A channel coefficient $\beta$ scales this curve to the outcome space, so the channel's contribution to revenue at spend level $x$ is:

$$\text{contribution}(x) = \beta \cdot f\!\left(\frac{x}{\bar{x}}\right)$$

The curve is concave for $\tilde{x} > K\,(n-1)^{1/n}/(n+1)^{1/n}$ — in plain terms, above the inflection point you're in diminishing returns. That inflection is where the two ROAS definitions start to diverge.

## Average ROAS: the ratio your dashboard reports

Average ROAS is contribution divided by spend:

$$\text{ROAS}_{\text{avg}}(x) = \frac{\beta \cdot f(\tilde{x})}{x} = \frac{\beta}{\bar{x}} \cdot \frac{f(\tilde{x})}{\tilde{x}}$$

This is the number a post-campaign report hands you. It's a meaningful accounting summary — it tells you how much revenue a channel produced per dollar spent, integrated over your current spend level. But it's not the answer to "what does an extra dollar here buy me?"

## Incremental ROAS: the slope you actually need

Incremental (marginal) ROAS is the derivative of the response curve with respect to spend:

$$\text{ROAS}_{\text{inc}}(x) = \frac{d}{dx}\left[\beta \cdot f\!\left(\tfrac{x}{\bar{x}}\right)\right] = \frac{\beta}{\bar{x}} \cdot f'\!\left(\tilde{x}\right)$$

For the Hill function, the derivative with respect to $\tilde{x}$ is:

$$f'(\tilde{x}) = \frac{n \cdot \tilde{x}^{\,n-1} \cdot K^{\,n}}{\left(K^{\,n} + \tilde{x}^{\,n}\right)^2}$$

At $\tilde{x} = 1$ (current spend equal to the historical mean — a reasonable default):

$$f'(1) = \frac{n \cdot K^{\,n}}{(K^{\,n} + 1)^2}$$

The ratio of incremental to average ROAS at mean spend simplifies to:

$$\frac{\text{ROAS}_{\text{inc}}}{\text{ROAS}_{\text{avg}}} = \frac{f'(1)}{f(1)} = \frac{n \cdot K^{\,n}}{K^{\,n} + 1}$$

When $K = 1$ (the half-saturation point is right at mean spend) and $n = 2$, this ratio is $2 \cdot 1 / 2 = 1$. Makes sense — at the inflection of an S-curve the marginal and average are momentarily equal.

The ratio falls as you move above the inflection point. Here's a concrete calculation.

## A concrete example

Take a channel with the `mmm-framework` defaults: $K = 0.85$ (half-saturation at 85% of mean spend), $n = 2$, $\beta = 10$, $\bar{x} = \$1\text{M/week}$.

```python
import numpy as np

def hill(x_tilde, K, n):
    return x_tilde**n / (K**n + x_tilde**n)

def hill_deriv(x_tilde, K, n):
    return n * x_tilde**(n-1) * K**n / (K**n + x_tilde**n)**2

K, n, beta, x_bar = 0.85, 2.0, 10.0, 1_000_000

for spend_M in [0.5, 1.0, 2.0, 4.0]:
    x = spend_M * 1e6
    x_tilde = x / x_bar
    avg_roas  = beta * hill(x_tilde, K, n) / x_tilde   # in units of beta/x_bar
    inc_roas  = beta * hill_deriv(x_tilde, K, n)         # same units
    print(f"Spend ${spend_M:.1f}M:  avg ROAS {avg_roas:.2f}x  |  inc ROAS {inc_roas:.2f}x  |  ratio {inc_roas/avg_roas:.0%}")
```

Output:

```
Spend $0.5M:  avg ROAS 2.63x  |  inc ROAS 4.14x  |  ratio 157%
Spend $1.0M:  avg ROAS 4.26x  |  inc ROAS 4.40x  |  ratio 103%
Spend $2.0M:  avg ROAS 5.62x  |  inc ROAS 2.67x  |  ratio 47%
Spend $4.0M:  avg ROAS 6.30x  |  inc ROAS 0.74x  |  ratio 12%
```

At $4M/week — four times the historical average — the dashboard reports a 6.3x ROAS. The actual incremental return on the next dollar is 0.74x. The channel is returning less than it costs at the margin, while looking excellent in the report.

(The underspend case is equally instructive: at $0.5M, the average ROAS is only 2.6x but the marginal ROAS is 4.1x — the channel is _more_ attractive than the average suggests, and you're leaving money on the table.)

## What the right allocation condition looks like

The correct optimality condition for a constrained budget comes from the Lagrangian of the allocation problem. At the optimum:

$$\frac{\partial \text{KPI}}{\partial b_i} = \lambda \quad \text{for all channels } i$$

That is, **marginal ROAS must be equal across all channels**. Intuitively: if channel A has a higher marginal return than channel B, you should move a dollar from B to A. You stop when you can't improve further — which is when the slopes are equalized.

Equalizing _average_ ROAS across channels is not the optimality condition for anything in this framework. A channel that's heavily saturated will have a high average ROAS (all that historical contribution) and a low marginal ROAS (you're past the bend). Treating the average as the signal sends budget there, deepening the saturation and lowering the marginal return further.

This is what [Atlas](/posts/atlas-optimization-over-any-model/) does under the hood: when it calls `model.predict(x)` and runs an optimizer, it's exploring the response surface, not the summary ratios. The optimizer converges to the point where the gradients are equalized. The `optimal_value` in the output is the maximized total KPI, not the highest average ROAS per channel.

## What to actually do with your dashboard

The average ROAS is useful for one thing: reconciling the model's total attributed revenue with finance's accounting. If the model says a channel drove $50M and the media plan shows $10M of spend, the 5x average ROAS is a meaningful sanity check against industry benchmarks and prior campaigns.

For decisions about where to add or cut budget, you want the marginal ROAS at current spend. In `mmm-framework`, you can compute this from the posterior draws directly:

```python
# Given posterior samples of (beta, K, n) and current spend x:
def marginal_roas(beta_samples, K_samples, n_samples, x, x_bar):
    x_tilde = x / x_bar
    marginal = beta_samples * hill_deriv(x_tilde, K_samples, n_samples) / x_bar
    return marginal  # shape (S,) — one value per posterior draw
```

The posterior distribution over marginal ROAS tells you both the point estimate and the uncertainty. A channel with marginal ROAS HDI of [2x, 8x] is telling you something different from a channel with HDI of [3x, 4x], even if the posterior means are similar. The first one needs an experiment; the second one you can probably trust for allocation.

## The takeaway

The number your MMM dashboard calls "ROAS" is attributed contribution divided by spend. It's an average over your response curve at your historical spend level. It is not the return on the next dollar. In a saturated channel, these can differ by an order of magnitude.

Budget decisions should be based on marginal ROAS — the slope of the response curve at current spend — and the optimality condition is equalization of marginal ROAS across channels, not average ROAS. If you're allocating budget by sorting channels on their reported ROAS and moving money toward the top of that ranking, you're probably over-investing in exactly the channels where the incremental return is lowest.

The response curve is the model. The ratio is a summary of history.
