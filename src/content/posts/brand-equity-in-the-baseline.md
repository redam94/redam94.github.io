---
title: "Brand Equity Lives in the Baseline: Why Weekly MMMs Under-Credit Brand Building"
author: Matthew Reda
pubDatetime: 2026-07-24T13:17:10Z
slug: brand-equity-in-the-baseline
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - measurement
  - statistics
description: A weekly MMM captures activation and short-term carryover well, but long-term brand equity gets absorbed into the baseline — credited to "base demand," not to the channels that built it. Here's the math of the gap and three honest paths forward.
---

I've watched this happen more times than I can count. A CMO sits in front of an MMM output. TV has a mediocre ROAS. Paid search and retargeting look great. The optimization runs, TV budget gets cut, performance gets more. The model wasn't wrong, exactly — it just measured the wrong thing. Or rather, it measured the right things over the wrong horizon.

This is the single most consequential way a weekly MMM misleads. And it's structural, not a bug you can patch with a better prior.

## What a weekly MMM actually measures

An MMM decomposes sales into contributions from media, price, promotions, seasonality, and a base. For media, the contribution of channel $j$ at week $t$ is:

$$\text{contribution}_{jt} = \beta_j \cdot f_j\!\left(x^{\text{adstock}}_{jt}\right)$$

where $f_j$ is a saturation function and $x^{\text{adstock}}$ is the adstock-transformed spend. The adstock captures carryover — advertising memory that echoes across subsequent weeks. But it does so through a window: `l_max` lags, typically four to thirteen weeks, after which the kernel weight drops below a threshold and gets zeroed out.

So what the model actually captures for any channel is:

1. **Activation.** The response that lands the same week spend runs — the week-0 adstock weight.
2. **Carryover.** The tail: the adstock-decayed response over the next few weeks, summed to the window edge.

Both are short-term to medium-term. Even a generous carryover window rarely reaches a full quarter.

## Why brand gets absorbed into base

Long-term brand equity — mental availability, pricing power, baseline demand growth driven by sustained media pressure — operates on a horizon of twelve to thirty-six months or more. Binet & Field's long-run analysis and the Nielsen / Analytic Partners brand meta-analyses consistently find that the _total_ media effect (short-term activation plus long-run brand building) is roughly 1.5–2× the short-term effect alone, with the multiplier heavier for brand-building channels like TV, video, OOH, and sponsorships.

A weekly model fit on one to two years of data has neither the span nor the functional form to see that horizon. The slow drift in base demand that TV spending built up over eighteen months looks, to a weekly model, like an intercept shift. It gets credited to "base" — the residual after media, price, and promotions are accounted for — not to the channel that caused it.

The consequence is directional and consistent: **brand-heavy channels are systematically under-credited.** Their ROAS appears lower than it actually is because a portion of their effect is invisible to the model's timescale. Performance channels — paid search, retargeting, affiliate — have shorter feedback loops and show up nearly entirely within the model's window, so their measured ROAS is closer to their true ROAS. The optimizer then does exactly what you'd expect given those numbers.

## What the model can honestly report

There is a real, model-derived number worth reporting: the **immediate vs. carryover split** within the adstock window. The `mmm-framework` computes this from the fitted decay weights:

```python
# From reporting/helpers/longterm.py
immediate_pct = weight[0] / sum(weights)
carryover_pct = 1 - immediate_pct
effective_weeks = sum(1 for w in weights if w >= 0.01 * sum(weights))
```

This tells you how long the _measured_ effect keeps working — whether a channel's effect lands mostly in week 0 or spreads across several weeks. A channel with `effective_weeks = 1` is pure activation; one with `effective_weeks = 8` has substantial carryover and likely some brand-building character.

But this is answering "how long does the modeled effect persist?" — not "how large is the brand equity effect?" Those are different questions, and conflating them is how you get to confident but wrong strategic recommendations. The `LongTermSection` in the framework reports this split under a prominently labeled caveat that explicitly names the gap.

## Three honest paths forward

None of these is a magic fix, but each partially addresses the blind spot.

**1. The structural funnel.** If you're running brand trackers (awareness, consideration, preference), build a model where media moves brand metrics, and brand metrics move sales. This routes the brand-building effect through a measured intermediate rather than letting it vanish into base. The joint latent-variable approach — fitting the tracker model and the sales model simultaneously, as I described in [measurement error in predictors](/posts/measurement-error-in-predictors/) — means the sales model sees the full posterior uncertainty over brand health, not just a plug-in mean.

The structural funnel captures more of the long-term effect, but only up to the brand tracker's own measurement horizon. Effects beyond the tracker's history still escape.

**2. Long-window geo experiments.** A geo-level holdout test that continues reading for two to four quarters after the flight ends — not just two weeks — can capture persistence that weekly observational data can't. That long-window readout becomes a calibration prior on the channel's total effect, which can be materially larger than its short-term effect. This is an expensive test to design and run, but it's the only way to get experimental evidence of the long-term response.

**3. An explicit multiplier, labeled as an assumption.** The round-number approach: take the model's short-term ROAS for a brand channel and scale it by a multiplier grounded in the published literature — Binet & Field's category averages, or Analytic Partners' brand meta-analysis. The `mmm-framework` supports a `long_term_multiplier` parameter in `ReportConfig` that applies this scaling in a clearly-labeled scenario section, never presented as a model output. The default is `2.0` (the midpoint of the 1.5–2× range), and the recommendation is to replace it with evidence from your category.

A multiplier is not a measurement. It's a stated assumption — which makes it more honest than the alternative, which is to silently treat the long-term effect as zero. The key is that the label does its job: the scenario section of the report has to be unambiguous that this number is an external assumption, not something the data said.

## The honest conclusion

A weekly MMM is a measurement tool with a known timescale limitation. Within that timescale — activation and short-to-medium carryover — it works. Beyond it, it's silent by design, and the silence gets misread as "brand doesn't work."

Before cutting a brand channel based on MMM output, ask: what's the adstock window? Is the effective carryover period measured in weeks or in months? Is there a structural funnel or a long-window experiment that could make the brand path visible? If the answers are "six weeks," "weeks," and "no," then the ROAS on that channel is a lower bound, not a full accounting.

The model's job is to tell you what the data supports. The gap between what it supports and what's true is just as important — and it should be in the report.

---

_Grounded in the mmm-framework [`long-term-brand-effects.md` technical doc](https://github.com/redam94/mmm-framework) and the `reporting/helpers/longterm.py` implementation. External references: Binet & Field, "The Long and the Short of It" (IPA, 2013); Analytic Partners, "ROI Genome" (2021); Nielsen, "Evaluate the Impact of Your Marketing with Brand Analytics" (2022). Related: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Noisy Covariates Bias Your Coefficients Toward Zero](/posts/measurement-error-in-predictors/), [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/)._
