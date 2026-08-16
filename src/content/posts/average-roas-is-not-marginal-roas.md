---
title: "Average ROAS Is Not Marginal ROAS"
author: Matthew Reda
pubDatetime: 2026-08-16T13:17:05Z
slug: average-roas-is-not-marginal-roas
draft: true
tags:
  - marketing-mix-modeling
  - optimization
  - bayesian
  - statistics
description: Attribution reports average ROAS; optimization needs marginal ROAS. With saturation, these diverge in ways that make your "best-performing" channel the first one to cut.
---

There's a number everyone reports and a number everyone should act on, and they are not the same number.

The number everyone reports is **average ROAS**: total attributed revenue divided by total spend for a channel. It's easy to compute, easy to explain, and it goes in the deck. The number everyone should act on is **marginal ROAS**: the additional revenue from the next dollar spent on that channel. It's a derivative, not a ratio. In any model that includes saturation — which every respectable MMM does — these two numbers diverge, sometimes dramatically.

The divergence matters because budget allocation lives in marginal territory. You're not deciding whether to spend anything on a channel; that ship has sailed. You're deciding whether to spend _more_ or _less_. The right frame is always marginal: what does the next dollar buy? Average ROAS answers a different question — roughly, "was this channel worth running at all?" — which is useful retrospectively but wrong for forward-looking allocation.

## The math, from a Hill curve

Take the standard Hill saturation function applied to (adstock-transformed) channel spend $x$:

$$f(x) = \frac{x^n}{x^n + \kappa^n}$$

with coefficient $\beta$ mapping the output to revenue units. The **average ROAS** at spend level $x$ is attributed revenue divided by spend:

$$\text{AROAS}(x) = \frac{\beta \cdot f(x)}{x}$$

The **marginal ROAS** is the derivative:

$$\text{MROAS}(x) = \beta \cdot f'(x) = \beta \cdot \frac{n\kappa^n x^{n-1}}{(x^n + \kappa^n)^2}$$

For the simplest concave case ($n = 1$, pure diminishing returns):

$$\text{AROAS}(x) = \frac{\beta}{x + \kappa}, \qquad \text{MROAS}(x) = \frac{\beta\kappa}{(x+\kappa)^2}$$

Their ratio:

$$\frac{\text{MROAS}(x)}{\text{AROAS}(x)} = \frac{\kappa}{x + \kappa}$$

This is always strictly less than 1 for any positive spend. The further $x$ exceeds $\kappa$ — the half-saturation point — the wider the gap. Spend at exactly $\kappa$ and marginal ROAS is half of average ROAS. Spend at twice $\kappa$ and the ratio drops to a third.

## A concrete example

Two channels, same model structure, same total budget.

**Channel A**: $\kappa = 100\text{k}$, current spend $x = 400\text{k}$. Spending four times past its half-saturation point. The Hill function returns $f(400) = 400/500 = 0.80$. Average ROAS is proportional to $0.80/400 = 0.002$. Marginal ROAS is proportional to $100/500^2 = 0.0004$.

**Channel B**: $\kappa = 300\text{k}$, current spend $x = 100\text{k}$. Well inside the linear region. $f(100) = 100/400 = 0.25$. Average ROAS is proportional to $0.25/100 = 0.0025$. Marginal ROAS is proportional to $300/400^2 = 0.001875$.

Channel B edges out A on average ROAS (0.0025 vs 0.002). But its marginal ROAS is nearly **five times higher** (0.001875 vs 0.0004). Every next dollar belongs in B. If you allocated by average ROAS you'd protect A, because it looks better in the table. If you allocated by marginal ROAS you'd cut A and grow B, which is what the math actually calls for.

## Computing both from a fitted PyMC model

```python
import numpy as np

def hill(x, kappa, n=1.0):
    return x**n / (x**n + kappa**n)

def hill_deriv(x, kappa, n=1.0):
    return n * kappa**n * x**(n - 1) / (x**n + kappa**n)**2

def average_roas(posterior_draws, spend):
    """Returns posterior distribution of AROAS — shape (S,)."""
    beta = posterior_draws["beta"]
    kappa = posterior_draws["kappa"]
    n = posterior_draws.get("n", np.ones_like(beta))
    return beta * hill(spend, kappa, n) / spend

def marginal_roas(posterior_draws, spend):
    """Returns posterior distribution of MROAS — shape (S,)."""
    beta = posterior_draws["beta"]
    kappa = posterior_draws["kappa"]
    n = posterior_draws.get("n", np.ones_like(beta))
    return beta * hill_deriv(spend, kappa, n)
```

Both return posterior distributions, not point estimates. The [uncertainty in those posteriors](/posts/adstock-saturation-identification/) is real — if the joint posterior over $(\alpha, \kappa)$ spans a ridge, your MROAS posterior will be wide, and allocation decisions should reflect that width, not collapse it to a mean.

## The budget allocation rule

The correct rule for allocating a constrained budget across channels under a nonlinear response model is to **equalize marginal ROAS across channels**. If you're maximizing total revenue subject to $\sum_m x_m = B$, the KKT conditions give:

$$\text{MROAS}_m(x_m^*) = \lambda \quad \text{for all channels } m$$

where $\lambda$ is the shadow price of the budget constraint. You don't solve this by ranking average ROAS and funding the top channels. You find the spend levels at which every channel returns equally at the margin.

This is exactly what [Atlas](/posts/atlas-optimization-over-any-model/) computes when it maximizes the objective against the budget constraint. Average ROAS doesn't enter the optimization at all — Atlas evaluates the response surface derivative, not the response-over-spend ratio. The optimizer is right; the deck is telling a different story.

## The diagnostic

The simplest check: for each channel, compute the ratio of current spend to the estimated half-saturation parameter, $x / \hat\kappa$. If that ratio exceeds 1, you're operating on the saturated side of the curve, and marginal ROAS is already below half of average ROAS. The further above 1 the ratio is, the more the deck is flattering you relative to what an additional dollar actually buys.

In practice I plot the marginal ROAS posterior at current spend for each channel alongside the average ROAS. Channels where the two are close (ratio near 1, spend near or below $\kappa$) are channels where attribution and optimization tell the same story. Channels where they diverge sharply are channels where the deck is actively misleading whoever reads it.

None of this requires throwing out the MMM or the attribution. It requires reading the output differently: average ROAS as backward-looking credit assignment, marginal ROAS as the forward-looking signal for where to put the next dollar. The attribution model answers "who gets credit for what happened." The marginal calculation answers "what should happen next." They're different questions. The number you report for the first shouldn't be the number you optimize on for the second.

---

_The Hill curve and adstock parameters behind this calculation are often jointly unidentified — see [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/). The Atlas optimizer implements the marginal-ROAS-equalization allocation described here — see [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/). The empirical priors on $\kappa$ and $\alpha$ are grounded in [What Decades of Marketing Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/). For how uncertainty in these parameters propagates into the allocation recommendation, see [False Precision in Reporting](/posts/false-precision-in-reporting/)._
