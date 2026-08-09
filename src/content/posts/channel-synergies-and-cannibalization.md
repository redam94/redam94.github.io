---
title: "Channels Don't Add Up: Measuring Media Synergies and Cannibalization"
author: Matthew Reda
pubDatetime: 2026-08-09T13:16:53Z
slug: channel-synergies-and-cannibalization
draft: true
tags:
  - marketing-mix-modeling
  - experimental-design
  - bayesian
  - statistics
description: Standard MMMs assume media channels contribute independently. That's a modeling choice, not a fact — and when PMax steals Search's clicks or Reddit seeds demand that Search converts, the additive assumption quietly biases your ROAS and your allocations.
---

Every marketing-mix model I've seen in production makes the same silent assumption: channels add up. The model predicts sales as the sum of a TV contribution, a paid-search contribution, a social contribution, and a baseline. Each channel has its own response curve — adstock followed by saturation — but those curves are evaluated independently and the results are summed. The cross-channel terms are just... zero.

That's a modeling choice, not a data finding. And for some channel pairs it's almost certainly wrong.

## Two real patterns of non-additivity

**Cannibalization.** Performance Max and Branded Search compete for the same intent signal. When someone types your brand name after seeing a PMax ad, Google can serve either the PMax result or the organic/branded-search result. If you're buying both, you're bidding against yourself in some fraction of auctions. Mathematically, the marginal value of an extra dollar in PMax is lower when you're already spending heavily on Branded Search, because some of that PMax dollar is just capturing traffic that Branded Search would have caught anyway. The joint response is *less* than the sum of the individual responses.

**Complementarity.** Reddit and Search can tell the opposite story. Reddit drives upper-funnel demand — people encounter your brand during content consumption and develop intent they didn't have before. That intent then converts through Search. So the marginal value of Search spend is *higher* when you're also running Reddit: more people are in the market because of it. The joint response exceeds the sum of the individual responses.

Neither of these patterns violates any law of nature. They're just the normal mechanics of how advertising works across a funnel, and ignoring them in the model has consequences.

## The math: one extra term per channel pair

An additive multi-channel response surface looks like:

$$R(s) = \sum_c \beta_c \cdot f_c(s_c)$$

where $s_c$ is (adstocked, normalized) spend on channel $c$, $f_c$ is the Hill saturation function, and $\beta_c$ is the channel ceiling. Everything is independent by construction.

Adding first-order interactions is one extra term per pair:

$$R(s) = \sum_c \beta_c \cdot f_c(s_c) + \sum_{c < c'} \gamma_{cc'} \cdot f_c(s_c) \cdot f_{c'}(s_{c'})$$

The interaction coefficient $\gamma_{cc'}$ carries the sign of the relationship. Positive means complementarity — both channels being active is worth more than either alone. Negative means cannibalization — doubling down on both wastes money relative to concentrating on either one.

The saturation functions $f_c \in [0,1]$ keep the interaction term scaled sensibly. The cross-partial $\partial^2 R / \partial s_c \partial s_{c'}$ equals $\gamma_{cc'} \cdot f_c'(s_c) \cdot f_{c'}'(s_{c'})$ — a function of current spend levels. This means the interaction effect is bigger when both channels are in their sensitive (pre-saturation) range, which is exactly when it matters most for budget decisions.

## Why normal data can't identify this

Here's the catch. Fitting $\gamma_{cc'}$ requires variation in the **joint allocation** of two channels — cases where spend on both channels moved together, moved in opposite directions, and moved independently. Time-series MMM data almost never provides this. In practice, budget decisions are correlated: when you increase PMax you often increase Search; when you cut one you cut both. The co-movement means the interaction term is nearly collinear with the main effects, and the posterior on $\gamma$ tracks the prior more than the data.

The only way to cleanly identify the cross-partial is experimental: you need geo or audience holdouts where the joint allocation is *deliberately designed* to provide the required variation.

The design that works is a **central composite design (CCD)** adapted for the channel space. For each channel pair you want to identify:

- **Axial cells**: move one channel up while holding the other at baseline (this identifies the main effects and their gradients)
- **Off-axis cells**: move both channels jointly in the same and opposite directions (this identifies the cross-partial — the $+\delta, +\delta$ and $+\delta, -\delta$ conditions)
- **Shutoff cells**: set one channel to zero while holding others at baseline (this breaks the collinearity between $\beta_c$ and $\gamma_{cc'}$ terms)

Without the off-axis cells, $\gamma$ is not identified. Without the shutoff cells, the $\beta / \gamma$ trade-off doesn't resolve. This isn't a technicality — if you run a standard two-arm geo test (one geo with PMax up, one control), you learn the main effect of PMax under the status-quo Search allocation. You learn nothing about how PMax and Search interact.

## What you can and can't trust

When this design is run and the model is fit, the results are not equally trustworthy across all parameters. From working through this in [`mmm-framework`'s geo response surface module](https://github.com/redam94/mmm-framework):

**Signs recover robustly.** In synthetic data recovery tests, the correct sign of $\gamma_{cc'}$ recovers across a wide range of prior specifications, sample sizes, and design variations. If the model says cannibalization and the truth is cannibalization, that qualitative conclusion survives.

**Magnitudes are prior-sensitive.** The magnitude of $\gamma_{cc'}$ moves significantly as you vary the prior scale. Doubling the prior scale can shift the posterior mean by 30–50% without changing the sign. The magnitude should be flagged as "sign-reliable, magnitude-assumed" in any decision briefing.

**Not all pairs are equally identifiable.** A channel that can't be geo-randomized — a walled garden where the platform controls assignment — can have its main effect estimated from natural variation but its interactions with other channels are prior-dominated. The practical response is to include the channel with a tight, near-zero prior on its interactions and flag those parameters as assumed.

```python
# Sketch of how sign-informed priors encode prior knowledge per channel pair
PAIR_SIGNS = {
    ("pmax", "search"):  "neg",   # shared-intent cannibalization
    ("pmax", "reddit"):  "weak",
    ("search", "reddit"): "pos",  # demand-gen complementarity
    ("search", "amazon"): "weak",
    ("reddit", "amazon"): "pos",
}

# Prior families per sign:
# "neg"  → gamma ~ -HalfNormal(scale)     : sign-constrained negative
# "pos"  → gamma ~  HalfNormal(scale)     : sign-constrained positive
# "weak" → gamma ~  Normal(0, scale)      : weakly informative
# "zero" → gamma ~  Normal(0, 0.05*scale) : nearly zero (walled garden)
```

Run a **prior sensitivity audit** on every $\gamma$ parameter: refit at `scale ∈ {0.4×, 1×, 2.5×}` and report how much the posterior mean shifts. If it shifts by more than the posterior standard deviation, the parameter is prior-dominated and shouldn't drive a hard budget decision.

## Why this changes allocations

The practical consequence of ignoring interactions is that marginal ROAS estimates for each channel are biased at the allocation you're currently running — and the bias is systematic.

If PMax and Search genuinely cannibalize, the model that treats them as additive over-attributes contribution to one of them (whichever happens to be correlated with overall demand in the training data) and under-attributes to the other. When you then optimize against those inflated ROAS numbers, you end up pushing spend toward one channel past the point where the joint marginal return goes negative.

If Search and Reddit genuinely complement, the additive model attributes their shared effect to whichever channel moved first in the time series. The model can report a mediocre ROAS for Reddit and a strong one for Search even when the correct interpretation is "Reddit is generating the demand that Search is converting — neither is doing it alone."

The allocation math changes once you admit interactions. Optimal allocation under an interactive response surface is a joint optimization: you can't maximize each channel's contribution independently. The optimal PMax spend depends on Search spend, and vice versa. You need the joint surface.

## The honest version

Most production MMMs don't include interaction terms, and for a specific reason: they're not identified from observational data, and fitting them anyway against time-series data just adds noise and instability to the main effects. That's a legitimate concern.

The honest version of this isn't "add interactions to your MMM." It's: **the additive assumption is an assumption, and if your channel mix includes pairs that plausibly cannibalize or complement, you should run the experiment that would actually identify the interaction**. Until you do, you don't have ROAS estimates for those channels — you have ROAS estimates under an untested additivity assumption, and the confidence interval on those estimates doesn't include the uncertainty from the assumption itself.

That's the quiet cost of the additive model. Not that it's wrong in some abstract sense, but that the number it prints is more confident than it should be about a thing it was never designed to measure.

---

_The geo response surface design and the $\gamma$ parameterization are implemented in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `geo_rsm/`. The CCD design and channel demotion logic are in `geo_rsm/design.py`; the prior-sensitivity audit is in `geo_rsm/planner.py`. Related posts: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/)._
