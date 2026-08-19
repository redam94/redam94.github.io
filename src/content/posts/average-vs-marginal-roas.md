---
title: "Average ROAS Is Not Marginal ROAS, and the Difference Runs Your Budget"
author: Matthew Reda
pubDatetime: 2026-08-19T13:21:24Z
slug: average-vs-marginal-roas
draft: true
tags:
  - marketing-mix-modeling
  - statistics
  - optimization
  - bayesian
description: Attribution outputs give you average ROAS; budget optimization needs marginal ROAS. Under saturation the two diverge badly, and confusing them systematically overspends on your most-saturated channels.
---

Every MMM I've worked on produces an attribution table. Rows are channels, columns are spend and attributed revenue, and the final column is ROAS: attributed revenue divided by spend. It's clean, it fits on a slide, and it is the wrong number for every budget decision you'll use it to make.

Not wrong in a nitpicky, theoretical way. Wrong in a way that reliably points you at the same channels twice — the ones you already spent the most on — and tells you to keep going.

## What attribution outputs

An attribution method — contribution scoring, Shapley, marginal contribution from an MMM posterior — takes the observed spend vector and distributes observed sales across channels. For channel $j$ with spend $s_j$, the attributed revenue is some function of the response curve evaluated at the actual spend level. The average ROAS is:

$$\text{ROAS}^{\text{avg}}_j = \frac{f_j(s_j)}{s_j}$$

where $f_j(\cdot)$ is the channel's response function. This is the slope of the line from the origin to the point on the response curve at your current spend. It's a sensible thing to measure for accounting purposes — how much did this channel "buy" us? — and a misleading thing to optimize against.

## What optimization needs

Budget optimization is asking a different question: given that I'm at spend $s_j$, what does one more dollar buy me? That's the derivative of the response function at current spend — the **marginal ROAS**:

$$\text{ROAS}^{\text{marg}}_j = f'_j(s_j) = \frac{\partial f_j}{\partial s_j}\bigg|_{s_j}$$

These coincide only when $f_j$ is linear (constant marginal returns). Once you add saturation — which every MMM worth running does — they diverge, and the gap is largest precisely where you've been spending the most.

## The Hill function makes this concrete

Take the Hill saturation used in [`mmm-framework`](/posts/adstock-saturation-identification/):

$$f(s) = \frac{s^n}{s^n + \kappa^n}$$

where $\kappa$ is the half-saturation point and $n > 0$ is the slope exponent. (I'll fold the channel coefficient $\beta$ into the comparison and keep it at 1 for simplicity.)

The average ROAS at spend $s$ is:

$$\text{ROAS}^{\text{avg}}(s) = \frac{f(s)}{s} = \frac{s^{n-1}}{s^n + \kappa^n}$$

The marginal ROAS is:

$$\text{ROAS}^{\text{marg}}(s) = f'(s) = \frac{n \kappa^n s^{n-1}}{(s^n + \kappa^n)^2}$$

These have different shapes and different rates of decay. To see the gap numerically, set $n = 2$ and $\kappa = 100$:

```python
import numpy as np
import matplotlib.pyplot as plt

kappa, n = 100, 2

def hill(s):
    return s**n / (s**n + kappa**n)

def avg_roas(s):
    return hill(s) / s

def marg_roas(s):
    return n * kappa**n * s**(n-1) / (s**n + kappa**n)**2

spend = np.linspace(10, 500, 500)

fig, ax = plt.subplots()
ax.plot(spend, avg_roas(spend), label="Average ROAS")
ax.plot(spend, marg_roas(spend), label="Marginal ROAS")
ax.axvline(kappa, color="gray", linestyle="--", label=f"Half-saturation (κ={kappa})")
ax.set_xlabel("Spend")
ax.set_ylabel("ROAS")
ax.legend()
plt.tight_layout()
```

At $s = \kappa = 100$, the average ROAS is 0.5/100 = 0.005 and the marginal ROAS is $2 \cdot 100^2 \cdot 100 / (2 \cdot 100^2)^2 = 0.0025$ — half the average. At $s = 300$ (three times the half-saturation point), the gap is worse: average ROAS is around 0.9/300 ≈ 0.003; marginal is around 0.0006. You're operating well into the flat part of the curve, but the average ROAS still looks reasonable because it's averaging over the cheap early units.

## Why the confusion runs your budget wrong

Say you have two channels with the same average ROAS of 2.0. A naive allocation rule says they're equivalent — give them equal marginal budgets. But if Channel A is at $s_A < \kappa_A$ (still in the steep part of the curve) and Channel B is at $s_B \gg \kappa_B$ (deep into saturation), their marginal ROAS values are very different. Channel A is still buying efficiently; Channel B is paying for a fraction of what average ROAS implies.

The optimum — where the constrained budget is actually maximized — requires equalizing **marginal** ROAS across channels, not average ROAS. This is the same condition as Lagrangian optimality:

$$f'_1(s_1^*) = f'_2(s_2^*) = \cdots = \lambda$$

where $\lambda$ is the shadow price of the budget constraint. When you optimize by equalizing average ROAS instead, you systematically overspend on channels that have been running long or hard — the ones with large $s/\kappa$ ratios — and underspend on channels that still have room to grow.

This is exactly the problem [Atlas](/posts/atlas-optimization-over-any-model/) is designed to avoid. The `contributions()` interface returns the attribution-based view; the optimizer doesn't use that to rank channels. It evaluates the response surface directly at each candidate allocation and uses the gradient to navigate toward the optimum, so it's implicitly following the marginal ROAS argument rather than the average ROAS shortcut.

## The reporting problem

The uncomfortable implication is that the number most stakeholders ask for — "what is TV's ROAS?" — is well-defined only for a given spend level, and it changes as spend changes. At $s = 50$, TV might have an average ROAS of 3.0. At $s = 300$, the average ROAS might be 1.8 and the marginal ROAS 0.6. These are not the same channel in any decision-relevant sense.

What I try to report instead:

1. **The response curve**, not a single ROAS number. A plot of $f_j(s)$ over the plausible spend range shows the full story — where the curve is steep, where it bends, where you're currently sitting. This is a posterior predictive quantity so you can show the uncertainty band alongside it.

2. **The marginal ROAS at current spend**, with an interval. One number, but the right one — and honest about what it covers.

3. **The breakeven spend** — the level at which marginal ROAS equals some hurdle rate (e.g., 1.0, or the blended cost of capital). Below that point, additional spend is profitable at the margin; above it, it isn't. This is a more useful number than average ROAS for anyone asking "should we cut or grow this channel?"

The posterior gives you all three as distributions, not point estimates. Wide intervals on the marginal ROAS curve are the correct answer when adstock and saturation are [jointly unidentified](/posts/adstock-saturation-identification/) from the data — they're telling you the curve shape is uncertain, not that the model failed.

## The one thing to fix before your next planning cycle

Before your next budget recommendation, look at the table of channel ROAS numbers and ask: are these average ROAS at current spend, or marginal ROAS at current spend? If the answer is average — which it almost always is — then the ranking you're using to shift budget isn't the ranking that reflects the actual return on the next dollar. The highest-average-ROAS channels often have the most accumulated spend and therefore the lowest marginal return. Moving budget toward them because the slide says so is the mechanism by which mature brands systematically over-invest in their biggest channels.

The fix is a five-line calculation once you have a fitted response curve. The optimizer then handles the rest.

---

_Related: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) covers why these response curves are hard to pin down from data alone. [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/) is the framework that optimizes against the full surface rather than a ROAS table. [False Precision in Reporting](/posts/false-precision-in-reporting/) covers the broader habit of reporting a number with more certainty than the data supports._
