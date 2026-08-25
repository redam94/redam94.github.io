---
title: "Your Platform Dashboard Isn't Lying—It's Answering a Different Question"
author: Matthew Reda
pubDatetime: 2026-08-25T13:24:32Z
slug: platform-roas-different-question
draft: true
tags:
  - marketing-mix-modeling
  - measurement
  - causal-inference
  - statistics
description: Platform-reported ROAS and MMM incremental ROAS measure fundamentally different things. The gap between them is not a calibration problem—it's two different questions being answered correctly.
---

The conversation goes like this, often in the third meeting after the MMM results are in: someone from the media team opens the platform dashboard and points at the search campaign's reported ROAS of 4.2x. The MMM estimates 1.7x. Someone asks which one is right.

Both of them are right. They're answering different questions.

Getting this straight is not a small semantic point. If you use platform ROAS to drive budget allocation, you will systematically over-invest in channels that benefit most from organic demand — the same demand that would have arrived without the spend. If you use MMM estimates without understanding what they measure, you will either distrust them or misapply them. The distinction matters.

## What platform ROAS measures

Platform ROAS — whether it's Google Ads, Meta, or any channel's native reporting — is an **attribution accounting identity**. It takes observed conversions, assigns them to touchpoints by some rule (last click, data-driven, view-through, or any combination), and divides attributed revenue by spend:

$$\text{Platform ROAS} = \frac{\text{attributed revenue}}{\text{spend}}$$

Nothing in this formula is counterfactual. It doesn't ask "what would have happened without this spend?" It asks "which revenue do we assign to this spend?" The attribution model decides the assignment. The ROAS follows mechanically.

This is not a flaw — it's a feature of what platform reporting is designed to do: give media buyers a signal about which campaigns and creatives are attracting converting customers. It's an activity signal, not a causal one.

The trouble starts when the number gets copy-pasted into a budget discussion where the question is actually causal: "if we spend an extra dollar here, how much more revenue do we get?"

## What MMM ROAS measures

An MMM estimates a **counterfactual effect**. The coefficient on a media channel answers the question: holding everything else constant, if we increase spend by one unit, how does observed outcome change? In the Bayesian MMM the formal object is the partial derivative of expected outcome with respect to spend, evaluated at the observed spend level and integrated over posterior uncertainty:

$$\text{iROAS} = \mathbb{E}_\theta\!\left[\frac{\partial \hat{y}}{\partial x_{\text{channel}}}\right]$$

With saturation curves, this is not a constant — iROAS is a function of spend level. The first dollar into a channel is more valuable than the millionth, and the MMM captures that by estimating where on the saturation curve current spend sits. As I described in [adstock and saturation identification](/posts/adstock-saturation-identification/), pin-pointing that location is itself an identification problem; the iROAS posterior carries that uncertainty honestly.

The counterfactual question is not "who gets credit for conversions that happened?" but "what revenue would we have lost if we hadn't spent this?" These are different numbers, and there is no reason to expect them to agree.

## A concrete example

A retailer runs $1M of paid search in a month. Platform attribution reports $4.2M in revenue attributed to that campaign — a 4.2x ROAS. A geo holdout test cuts paid search in a set of matched markets while leaving others untouched. The control markets, which saw no paid search, have essentially the same branded search volume and similar conversion rates during the test period.

What this tells you: most of the $4.2M in attributed revenue would have arrived anyway. Customers who were going to search for the brand directly got intercepted by a paid ad, clicked it, converted, and were credited to the campaign. The ad captured a conversion already in flight.

The MMM sees the variation in search spend across weeks and geographies and asks: in periods when search spend was higher, did total revenue go up? By how much, after controlling for seasonality, promotions, and everything else in the model? The estimated incremental effect: 1.7x. For every dollar in search, $1.70 in revenue that wouldn't have arrived otherwise.

The gap between 4.2x and 1.7x is organic demand being attributed to paid search. Neither number is wrong. The 4.2x is the correct answer to "what revenue did platform attribution assign to search?" The 1.7x is the correct answer to "what revenue did search actually cause?"

## Why the gap varies

The size of the gap is not random — it tracks predictable features of the channel.

**Brand search** captures mostly intent that already exists. If your brand has high organic search volume and strong direct navigation, brand search campaigns intercept that demand rather than create it. Platform attribution credits every branded click; the MMM finds little incremental signal because spend doesn't predict revenue beyond what baseline and brand equity already explain (see [brand equity in the baseline](/posts/brand-equity-in-the-baseline/)). The gap is large.

**Cold-audience prospecting** has a smaller gap. When you're running reach campaigns to audiences with no prior brand awareness, the ROAS is lower, view-through attribution is fuzzy, and the actual incremental effect can exceed what platform ROAS implies — especially when the MMM picks up lagged effects through adstock.

**The ratio of the two numbers is itself informative.** A channel where platform ROAS is 6x and MMM iROAS is 0.8x is not a measurement error — it's telling you that almost all of the attributed revenue was organic. A channel where platform ROAS is 2x and MMM iROAS is 1.8x is one where the attribution is genuinely tracking something causal. Platform ROAS divided by iROAS gives a rough estimate of the "organic capture rate" for a channel, which turns out to be a useful planning metric once you stop treating the discrepancy as a problem to explain away.

## The geo holdout as arbitrator

The MMM estimate has posterior uncertainty — the width of the iROAS distribution reflects identification limitations like collinearity and short time series, as I described in [collinearity can't separate](/posts/collinearity-cant-separate/). Platform ROAS has none of that uncertainty in its reported number, but the certainty is spurious: it's arithmetic, not inference.

The arbitrator is the controlled experiment. A geo holdout that removes a channel in matched markets gives a direct observation of the counterfactual. As I described in [closing the loop with MMM calibration](/posts/closing-the-loop-mmm-calibration/), the lift from the holdout enters as a prior update on the channel coefficient, pulling the posterior toward the experimental estimate:

```python
# After a geo holdout estimating lift ~ N(mu_lift, sigma_lift)
# Update the MMM's channel coefficient prior
with mmm_model:
    # Replace the channel prior with a posterior-informed one
    beta_search = pm.Normal("beta_search",
                            mu=mu_lift,      # from holdout
                            sigma=sigma_lift) # from holdout uncertainty
```

When holdout iROAS is much closer to the MMM estimate than to the platform number, the platform ROAS was primarily capturing organic demand. When it falls between them, both had partial information and the truth is somewhere in the middle.

## The allocation implication

This is why the distinction matters for budget decisions. The [Atlas optimization](/posts/atlas-optimization-over-any-model/) that drives allocation uses the MMM's marginal effects — specifically, the derivative of expected outcome with respect to spend at each channel, optimized across the portfolio. Allocating by platform ROAS instead would systematically shift budget toward brand search and other high-attribution, low-incrementality channels: channels that look excellent in the dashboard precisely because they capture demand that was going to convert regardless.

The frame I find most useful when explaining this to a media team: **platform ROAS measures who the customer touched on the way to buying; MMM iROAS measures whether the touch caused the purchase.** Attribution answers the first question. Causal inference answers the second. The first question is useful for operational decisions — which campaign creative is performing, which audience segments are engaging. The second is the only question that tells you where the next dollar goes.

The 4.2x isn't wrong. It's just not what you needed to know.

---

_Related: [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/), [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/), [Atlas: Budget Optimization Over Any Model](/posts/atlas-optimization-over-any-model/), [Adstock and Saturation Identification](/posts/adstock-saturation-identification/). The iROAS estimation framework is part of [`mmm-framework`](https://github.com/redam94/mmm-framework)._
