---
title: "What Decades of Marketing-Mix Data Actually Tell Us"
author: Matthew Reda
pubDatetime: 2026-06-28T18:00:00Z
slug: what-decades-of-marketing-data-tell-us
draft: false
tags:
  - marketing-mix-modeling
  - econometrics
  - bayesian
  - measurement
description: Forty years of scanner data and split-cable experiments converge on a few numbers that are remarkably stable across brands and categories. Knowing them turns a media model from a free-for-all into something with priors.
---

If you fit marketing-mix models for a living, the most useful thing you can carry around isn't a technique — it's a handful of numbers. Decades of scanner-panel econometrics and split-cable field experiments have converged on empirical generalizations that hold up across brands, categories, and continents with almost suspicious consistency. They're the closest thing marketing science has to physical constants, and they're what separate a model with genuine priors from one that will happily fit whatever the deck needs it to say.

Let me lay out the three that matter most, where they come from, and the functional machinery that makes a modern Bayesian MMM encode them.

## Number one: advertising is weak, price is strong

The single most stabilizing fact in the literature is the gap between two elasticities.

**Short-run advertising elasticity ≈ 0.1.** Across the major meta-analyses — Assmus, Farley and Lehmann (1984) at 0.22, Sethuraman and Tellis (1991) at 0.10, the Lodish BehaviorScan split-cable tests at 0.13 — the central estimate for how a 1% bump in advertising moves short-run sales lands around a tenth of a percent. It's small. The long-run effect roughly doubles it once you account for carryover, but the headline is that advertising is a *weak* lever in the short term.

**Own-price elasticity ≈ −2.5.** Tellis (1988), Bolton (1989), Hamilton et al. across 100 UK markets — the meta-analytic consensus for price elasticity sits near $-2.5$. Demand is elastic, and price moves sales an order of magnitude harder than advertising does:

$$\frac{|\eta_{\text{price}}|}{|\eta_{\text{advertising}}|} \approx \frac{2.5}{0.1} = 25$$

That 25-to-1 ratio is the number I'd tattoo on the wrist of anyone about to argue that more TV will fix a volume problem a price change could solve. It also feeds directly into the classic Dorfman–Steiner result for the optimal advertising budget:

$$\frac{A^\*}{S^\*} = \frac{\eta_{\text{advertising}}}{|\eta_{\text{price}}|} = \frac{0.1}{2.5} = 4\%$$

Optimal ad spend is about 4% of sales for a typical packaged good. Not a coincidence that real categories cluster there.

## Number two: effects decay fast

The second generalization is about *time*. Advertising doesn't act once and vanish, nor does it last forever — it carries over with geometric decay. The foundational encoding is the Koyck model, which assumes the lag weights fall off as $\beta_1 \lambda^k$ and collapses an infinite distributed lag into one tidy regression:

$$Q_t = (1-\lambda)\beta_0 + \beta_1(1-\lambda)\,X_t + \lambda\, Q_{t-1} + v_t$$

The retention rate $\lambda$ is the whole story, and the half-life follows immediately:

$$t_{1/2} = \frac{\log 0.5}{\log \lambda}$$

The empirical surprise here is how *short* the memory is. Raw monthly retention estimates run $\lambda \approx 0.43$–$0.50$; correcting for the temporal-aggregation bias that Clarke (1976) identified pushes them to roughly $0.7$. Either way the half-life is on the order of a couple of months, and 90% of an advertising effect has dissipated within six to nine months. This is much faster than practitioner intuition, and it has a sharp implication: advertising effects need continuous feeding. Go dark and the stock drains quickly.

Modern Bayesian MMMs (the Google formulation in Jin et al., 2017) write this as a normalized adstock over a finite window with geometric weights $w_m(l) = \alpha_m^l$ — the discrete sibling of Koyck — or a *delayed* version $w_m(l) = \alpha_m^{(l-\theta_m)^2}$ when a channel's effect peaks a few weeks after the spend, as brand TV often does.

## Number three: response is curved

The third fact is that doubling spend doesn't double sales. Response saturates, and the shape of the saturation curve decides your whole flighting strategy. The workhorse is the Hill function, borrowed from pharmacology:

$$\text{Hill}(x; \mathcal{K}, \mathcal{S}) = \frac{1}{1 + (x/\mathcal{K})^{-\mathcal{S}}}$$

Two parameters carry the meaning. $\mathcal{K}$ is the half-saturation point — the spend at which you're halfway to the channel's ceiling. $\mathcal{S}$ is the shape: with $\mathcal{S} > 1$ you get an S-curve with a genuine threshold (a region of increasing returns before the bend), and with $\mathcal{S} \le 1$ you get pure diminishing returns from the first dollar.

That distinction isn't academic — it dictates how you should spend:

- **Concave response** (diminishing returns everywhere): spread spending *evenly*. Every extra dollar in a heavy period is worth less than the same dollar in a light one, so pulsing wastes money.
- **S-shaped response** (a threshold to clear): *pulse*. Below threshold you're buying nothing, so it pays to go dark sometimes and concentrate spend hard enough to clear the bend in the periods you're on.

A full MMM stacks these: adstock first to capture carryover, then Hill to capture saturation, summed across channels over a baseline:

$$y_t = \tau + \sum_{m=1}^{M} \beta_m\, \text{Hill}\!\big(\text{adstock}(x_{\cdot,m})\big) + \sum_c \gamma_c z_{t,c} + \epsilon_t$$

## Why this has to be Bayesian — and where the numbers come from

Here's the catch that makes the empirical generalizations more than trivia. A typical MMM dataset is two or three years of weekly data — maybe 150 rows — and you're asking it to identify several *nonlinear* parameters per channel: a retention rate, a half-saturation, a shape, a coefficient. There isn't enough information in the data to pin those down. Jin et al. show this starkly: with 60 years of simulated weekly data the parameters recover beautifully, but with a realistic two years the posteriors are *dominated by the priors*, and shape parameters come back biased by 20–30%.

That's not a bug to engineer around; it's the reason the field's empirical constants matter. When the data can't identify the curve, the honest move is to bring in an informative prior — and a 0.1 advertising elasticity, a $\lambda$ near 0.7, a half-saturation inside the observed spend range are exactly the priors that decades of other people's experiments have earned you. The flip side is a discipline: when your model "discovers" an advertising elasticity of 0.6 or a carryover half-life of two years, the prior is telling you it's far more likely your model is unidentified than that your brand broke physics.

The same humility applies downstream. ROAS and marginal ROAS should be computed across the full posterior, not from plugged-in posterior means, and in realistic samples the *optimal* media mix often comes back with bimodal, high-variance posteriors near the edges of the data. The practical reading: use these numbers to set channel *priorities*, not to defend a budget allocation to the dollar.

## The point

The reason to memorize advertising ≈ 0.1, price ≈ −2.5, half-life ≈ a couple of months, and "response saturates" isn't pedantry. It's that a model without these is a model that can be talked into anything, and a small, noisy dataset will let it. The empirical generalizations are the accumulated experimental evidence of an entire field, available to you as priors. Used that way, they turn the most over-fit exercise in analytics into something that occasionally tells you the truth.

---

*Synthesized from Hanssens, Parsons & Schultz (2001), *Market Response Models: Econometric and Time Series Analysis* (2nd ed.); Jin, Wang, Sun, Chan & Koehler (2017), "Bayesian Methods for Media Mix Modeling with Carryover and Shape Effects," Google Inc.; and the advertising/price elasticity meta-analyses of Assmus et al. (1984), Tellis (1988), and Sethuraman & Tellis (1991). Related: [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/).*
