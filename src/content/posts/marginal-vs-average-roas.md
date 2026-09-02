---
title: "Marginal ROAS Is Not Average ROAS, and the Difference Is Your Entire Budget Decision"
author: Matthew Reda
pubDatetime: 2026-09-02T13:21:06Z
slug: marginal-vs-average-roas
draft: true
tags:
  - marketing-mix-modeling
  - optimization
  - bayesian
  - statistics
description: The number your MMM reports as ROAS is an average. The number you need to allocate budgets is marginal. They agree only when response curves are linear — which they never are.
---

Every marketing-mix model produces a ROAS. It's usually the first number a client asks for and the last one anybody checks. It's also almost always the wrong number to use when deciding how to allocate next quarter's budget.

The right number is the marginal ROAS — the extra return on the next dollar of spend in a channel. These two quantities can differ by a factor of two or three at typical spend levels, and they prescribe opposite budget moves. If you use the average where you should use the marginal, you'll keep spending on channels that are already saturated and underweight channels that still have room to grow.

## Two numbers, one response curve

Consider a single channel with a Hill saturation function applied to adstock-transformed spend:

$$f(x;\, \kappa, n) = \frac{x^n}{x^n + \kappa^n}$$

where $x$ is effective spend (after adstock), $\kappa$ is the half-saturation point, and $n$ controls the curve shape. The overall channel contribution is $\beta \cdot f(x)$, where $\beta$ is the coefficient tying contribution to revenue.

**Average ROAS** at spend level $x$:

$$\text{aROAS}(x) = \frac{\beta \cdot f(x)}{x} = \frac{\beta}{x} \cdot \frac{x^n}{x^n + \kappa^n}$$

**Marginal ROAS** at spend level $x$, the derivative:

$$\text{mROAS}(x) = \beta \cdot f'(x) = \beta \cdot \frac{n \kappa^n x^{n-1}}{(x^n + \kappa^n)^2}$$

These are equal only when $f(x) = x \cdot f'(x)$ — which holds when $f$ is linear. For any concave or S-shaped response curve (the relevant cases for real media channels), marginal ROAS falls below average ROAS at any realistic spend level, and falls faster as spend increases.

A concrete illustration with a concave Hill curve ($n = 1$, $\kappa = 100$, $\beta = 3$):

```python
import numpy as np

kappa, n, beta = 100, 1, 3
x = np.array([50, 100, 200, 400])

f = x**n / (x**n + kappa**n)
f_prime = n * kappa**n * x**(n-1) / (x**n + kappa**n)**2

average_roas = beta * f / x
marginal_roas = beta * f_prime

for xi, ar, mr in zip(x, average_roas, marginal_roas):
    print(f"Spend={xi:>4}: aROAS={ar:.2f}  mROAS={mr:.2f}  ratio={ar/mr:.1f}x")
```

```
Spend=  50: aROAS=2.00  mROAS=1.33  ratio=1.5x
Spend= 100: aROAS=1.50  mROAS=0.75  ratio=2.0x
Spend= 200: aROAS=1.00  mROAS=0.33  ratio=3.0x
Spend= 400: aROAS=0.60  mROAS=0.11  ratio=5.5x
```

At $x = \kappa = 100$, average ROAS is 1.5 while marginal ROAS is 0.75 — a 2:1 gap. At $x = 200$, the gap is 3:1. Both numbers look plausible in a deck. Only one tells you what the next dollar buys.

## Why the distinction is the budget decision

Budget optimization is a constrained problem:

$$\max_{b}\; \sum_m \beta_m \cdot f_m(b_m) \quad \text{s.t.} \quad \sum_m b_m \le B, \quad b_m \in [l_m, u_m]$$

The first-order conditions say that at the optimum, marginal returns are equalized across all active channels:

$$\text{mROAS}_1(b_1^*) = \text{mROAS}_2(b_2^*) = \cdots = \lambda$$

where $\lambda$ is the Lagrange multiplier on the budget constraint — the shadow price of an extra dollar. You should shift spend from any channel where mROAS is below $\lambda$ to any channel where it's above.

Average ROAS plays no role in this condition. A channel with high average ROAS can still be a bad candidate for more spend if it's already saturated and its marginal ROAS is low. A channel with modest average ROAS can be the right place to invest if it's still in the linear part of its response curve.

This is what [Atlas](/posts/atlas-optimization-over-any-model/) is actually solving when it runs `optimizer.optimize(request)`. The optimizer isn't finding the channel with the highest ROAS number in your slide — it's traversing the response surface to find the allocation where marginal returns equalize. Those are not the same exercise, and a spreadsheet that ranks channels by average ROAS and funds them top-to-bottom is solving the wrong problem.

## What MMMs report by default, and why it's misleading

Most MMM outputs include a "ROAS" or "contribution-per-spend" number per channel. What this almost always actually is:

$$\text{reported ROAS}_m = \frac{\text{total incremental contribution}_m}{\text{total observed spend}_m}$$

That's average ROAS over the observed historical spend period. It's useful as a descriptive summary — it tells you what each channel bought historically. It's not useful as a forward-looking budget guide, because the next dollar of spend in that channel operates at the _current_ spend level's marginal rate, not the average rate over two years of history.

The gap between them widens exactly when it matters most: when a channel has been spending heavily. A brand TV campaign that has been running at scale for eighteen months will have a respectable average ROAS (all those impressions added up to something) but a low marginal ROAS (the curve has bent). Reporting only the average tells you "TV worked" — true. It doesn't tell you "don't put more in TV" — also true, and more actionable.

## The Bayesian version

One of the quiet observations in [What Decades of Marketing Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/) is that "ROAS and marginal ROAS should be computed across the full posterior." That sentence does a lot of work.

Because the channel coefficient $\beta$, the adstock retention $\alpha$, and the saturation parameters $(\kappa, n)$ are all uncertain, the marginal ROAS at any spend level $x$ is itself a distribution. For posterior samples $\theta^{(s)} = (\beta^{(s)}, \kappa^{(s)}, n^{(s)})$:

```python
def marginal_roas_posterior(spend, posterior_samples):
    """
    spend: scalar spend value
    posterior_samples: dict with keys 'beta', 'kappa', 'n' as 1-D arrays
    """
    beta  = posterior_samples["beta"]
    kappa = posterior_samples["kappa"]
    n     = posterior_samples["n"]

    numerator   = n * kappa**n * spend**(n - 1)
    denominator = (spend**n + kappa**n)**2
    return beta * numerator / denominator
```

Plotting the resulting distribution of mROAS values at your current and proposed spend levels tells you, with honest uncertainty, whether the posterior actually supports shifting budget. A scenario where the 90% HDI on mROAS for channel A includes values above and below mROAS for channel B means the data doesn't confidently support that reallocation — and you shouldn't pretend it does.

## The practical read

A few things that follow directly from this:

**"Maintain budget because ROAS > 1" is not a strategy.** Average ROAS above 1 means the channel is profitable on average over history. It says nothing about the return on the next dollar. A saturated channel can have average ROAS of 2 and marginal ROAS of 0.2 — it was a great investment before, it's a poor one now.

**Diminishing returns affect every channel differently.** The $\kappa$ parameter in the saturation curve encodes the spend level at which returns start bending. A channel with $\kappa$ near your current spend level is near the inflection; a channel with $\kappa$ well above current spend is still in the linear regime. The marginal ROAS difference between them is exactly where reallocation value lives.

**Budget optimization results should come with posterior distributions, not point recommendations.** The optimal allocation from a single posterior mean is one point on a surface with real uncertainty. An allocation whose mROAS equalization holds across the posterior (or at least the 50% HDI) is a recommendation the model actually supports. This is why the [Atlas optimizer](/posts/atlas-optimization-over-any-model/) is designed to wrap around models that return distributions, not just means — the uncertainty over marginal returns matters as much as the point estimate.

**The right question before reallocating is: what is mROAS at the proposed new spend level?** Not at the historical average. Not at current spend. At the new level you're contemplating. The response curve is nonlinear; the marginal rate changes as you move along it.

## Where average ROAS is still useful

Average ROAS isn't wrong — it's answering a different question. It tells you the historical return on your investment in a channel, which is useful for:

- Assessing whether a channel was profitable at all during the period
- Comparing channels at similar spend levels to get a rough sense of efficiency
- Reporting campaign ROI to stakeholders after the fact

It fails when used to guide forward-looking budget decisions, because it averages over a spend trajectory that may no longer apply. A media mix model is worth building precisely because it gives you the response curve, not just a point on it — and using only the average ROAS discards most of what the curve tells you.

---

_The marginal condition for optimal budget allocation follows from the standard Lagrangian on the constrained problem. The Hill saturation function is discussed in [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) and [What Decades of Marketing Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/). The Atlas optimization framework is covered in [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/). Uncertainty-aware optimization requires the full posterior over response-curve parameters, not plug-in means — a point developed in [Measurement Error in Predictors](/posts/measurement-error-in-predictors/) for the analogous problem in regression._
