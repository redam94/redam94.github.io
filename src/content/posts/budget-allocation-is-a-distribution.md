---
title: "The Optimal Budget Is a Distribution, Not a Number"
author: Matthew Reda
pubDatetime: 2026-09-16T13:11:33Z
slug: budget-allocation-is-a-distribution
draft: true
tags:
  - bayesian
  - optimization
  - marketing-mix-modeling
  - decision-making
description: When your MMM is Bayesian, the optimal budget allocation is a posterior too — and reporting a single "optimal" number throws away exactly the information your stakeholders need.
---

There's a pattern I've seen in nearly every MMM engagement that goes all the way through to optimization. The team fits a Bayesian model, samples a posterior with proper Rhat and ESS, argues carefully about priors, and then — when it's time to answer "what should we spend?" — takes the posterior mean of each channel's response curve, feeds those means into a numeric optimizer, and reports a single allocation table.

The single-number allocation isn't wrong in the way a mis-specified likelihood is wrong. It's wrong in a subtler way: it takes a model that was carefully honest about what it doesn't know, and strips that honesty out right before the decision.

## The optimizer runs over a posterior

When your MMM has a posterior over channel response curves, the optimization objective is itself a random variable. Let $b = (b_1, \ldots, b_K)$ be the spend allocation across $K$ channels, and let $R(b, \theta)$ be the revenue function at allocation $b$ under model parameters $\theta$. The Bayesian statement is:

$$\theta \sim p(\theta \mid y)$$

So the revenue at any allocation $b$ is a draw from the posterior predictive:

$$R(b) \sim p(R \mid b, y) = \int p(R \mid b, \theta)\, p(\theta \mid y)\, d\theta$$

The optimal allocation under draw $\theta^{(s)}$ is:

$$b^*_s = \arg\max_b \; R(b, \theta^{(s)}) \quad \text{s.t. constraints}$$

Run this for each of $S$ posterior samples and you get $S$ optimal allocations — a posterior over optima. The standard approach computes $b^*$ from the posterior mean of $\theta$, which is none of those $S$ allocations; it's a different, arguably worse thing.

## What the posterior over optima looks like

Here's a sketch in Python using [Atlas](https://github.com/redam94/atlas):

```python
from atlas.core.optimizer import BudgetOptimizer
import numpy as np

optimal_allocations = []

for theta_draw in posterior_draws:  # shape: (S, D) posterior samples
    model_at_draw = mmm.with_parameters(theta_draw)
    optimizer = BudgetOptimizer(model=model_at_draw, total_budget=B)
    b_star = optimizer.optimize(constraints=budget_constraints)
    optimal_allocations.append(b_star)

optimal_allocations = np.array(optimal_allocations)  # (S, K)
```

`optimal_allocations[:, k]` is the posterior distribution over the optimal spend for channel $k$. On a typical two-year weekly MMM with reasonable uncertainty, you'll often find that the 90% interval on the optimal search spend spans 15–25% of total budget, and the optimal for a mid-tier channel might range from zero (cut it entirely) to a significant allocation depending on the draw.

That range is real information. Collapsing it to a point is a choice that needs justification, not a default.

## The two things the interval tells you

### Which channels have stable allocations

Some channels have tight posterior intervals on their optimal spend. These are channels where the model is confident enough that the optimizer's answer doesn't move much across draws. If paid search is "between 28% and 33% of budget" across the full posterior, that's a stable recommendation. You can act on it without waiting for more data.

Other channels have wide intervals. "Connected TV optimal spend: 5%–35% of budget" is telling you the model doesn't know what to do with that channel, because the posterior over its response curve is wide. The right response is not to pick a number from the middle of that interval. It's to either run an experiment to reduce the uncertainty, or consciously decide how much to stake on a coin flip.

This directly connects to the [Expected Net Benefit of Sampling](/posts/bayesian-sequential-stopping-likelihood-principle/) framework. Wide allocation intervals mean the expected benefit of learning more before deciding is high. Tight intervals mean you can act now. The allocation distribution is a cheap way to compute something close to ENBS without the full decision-theoretic machinery.

### Which allocations are robust

The posterior optimal is a distribution, but the decision is a single action. The useful question is: what single allocation is the most robust across that distribution?

One answer is the allocation that maximizes expected revenue:

$$\bar{b} = \arg\max_b \; \mathbb{E}_\theta[R(b, \theta)]$$

This is different from the allocation that maximizes revenue at the posterior mean of $\theta$. For nonlinear response curves, Jensen's inequality guarantees they're not the same, and the difference can be material near the saturation shoulder of a curve.

A second answer is the minimax-regret allocation: the one that minimizes the worst-case gap between what you got and what the optimal allocation for the realized $\theta$ would have gotten. This is more conservative and is useful when your stakeholders are more worried about catastrophic underperformance than about average performance.

In practice, for most MMM allocation problems, the expected-revenue-maximizing allocation is the right default. But computing it requires actually integrating over the posterior, not plugging in point estimates.

## What to report instead

Instead of:

> **Recommended allocation**: Search 31%, Social 19%, Display 11%, TV 22%, Other 17%

Report:

> **Search**: 28–34% (stable — act now)
> **TV**: 14–30% (wide — high value of additional measurement before next upfront)
> **Social**: 16–22% (moderate)
> **Display**: 7–14% (moderate)
>
> The expected-revenue-maximizing allocation (averaging over model uncertainty) is: Search 31%, Social 19%, Display 10%, TV 23%, Other 17%. The total expected revenue at this allocation is $X with a 90% predictive interval of [$Y, $Z].

The second table tells the same story as the first, but also tells you which channels are settled and which ones should be on the measurement agenda.

This framing translates directly into a conversation marketers can have: "We know where to put search. We don't know where to put TV. Here's what it would cost us to run an experiment to find out, and here's what we expect to gain."

## The mmm-framework implementation

[`mmm-framework`](https://github.com/redam94/mmm-framework) generates posterior predictive response curves as part of its standard output — each channel's response curve is sampled across the full posterior, not summarized at the mean. The [`atlas`](https://github.com/redam94/atlas) optimizer accepts an `AbstractModel` interface, which means you can wrap a posterior draw and run the optimizer against it directly.

The gap is at the reporting layer. Right now the default Atlas output is a single allocation from the expected-value optimization. Adding a posterior sweep — running the optimizer $S$ times across posterior samples and summarizing the resulting distribution — is a planned feature. In the meantime the pattern above (loop over `posterior_draws`, run `optimizer.optimize` at each draw) gives you the distribution manually, at the cost of $S$ optimizer runs. For a typical MMM with $S = 1000$ posterior draws and a fast optimizer, this is a few minutes of compute.

## The implicit decision

Every time you report a point allocation from a Bayesian model, you're implicitly making a decision theory choice: you're acting as if the posterior mean parameters were true, discarding the spread. That's risk-neutral optimization under point estimates, and it systematically underweights channels where the uncertainty is high and the upside is meaningful.

If that's the decision your stakeholders want to make, make it explicitly. Say: "We're optimizing at the posterior mean, here's the width of the posterior over optima, and here's our rationale for not doing a full expected-value optimization." That's a complete and defensible answer.

What isn't defensible is treating the optimization as if the Bayesian posterior were a nuisance that ends at the fitting stage. The posterior is the product. The allocation is one application of it, and it should carry the uncertainty all the way to the slide.

---

_Related: [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/), [The Sequential-Stopping Worry Is a Frequentist Problem](/posts/bayesian-sequential-stopping-likelihood-principle/), [False Precision in Reporting](/posts/false-precision-in-reporting/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/). The decision-theoretic machinery behind expected-value optimization under parameter uncertainty draws on Berger (1985) "Statistical Decision Theory and Bayesian Analysis," Chapter 4._
