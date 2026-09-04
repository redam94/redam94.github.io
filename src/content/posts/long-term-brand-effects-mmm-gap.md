---
title: "Your MMM Puts Long-Term Brand Effects in the Wrong Column"
author: Matthew Reda
pubDatetime: 2026-07-15T13:12:11Z
slug: long-term-brand-effects-mmm-gap
draft: true
tags:
  - marketing-mix-modeling
  - measurement
  - bayesian
  - causal-inference
description: Weekly MMMs systematically under-credit brand-building channels because effects that play out over years get absorbed into the model's baseline — here's the math, the strategic consequence, and what it would take to actually measure it.
---

Every marketing-mix model I've seen produces a decomposition that looks something like this: media channels contribute some fraction of sales, controls and seasonality contribute another, and everything left over is called "base." The number that drives decisions is the per-channel ROAS — and brand-building channels like TV, OOH, and sponsorship almost always land at the bottom of that list.

I've watched this pattern produce a specific strategic recommendation at the end of every other engagement: pull from brand and reallocate to paid search and lower-funnel performance. The math says so. The model has spoken.

The math is wrong, in a systematic and predictable direction. Here's why.

## What a weekly MMM actually measures

A weekly MMM captures two things per channel:

1. **Activation** — the effect that lands in the same week spend runs. The week-0 weight in the adstock kernel.
2. **Carryover** — the tail of the adstock function over the next few weeks.

Even with a generous adstock window — say, 13 weeks — the model can only see effects that show up within a quarter of the spend. The contribution timeline looks like this:

$$\text{contribution}_t = \beta_m \cdot \text{sat}\!\left(\sum_{l=0}^{L} w_l \, x_{t-l}\right)$$

where $w_l = \alpha^l$ and $L$ is the window length. For a TV channel with a retention rate of $\alpha = 0.7$ — a reasonable estimate from the [empirical literature](/posts/what-decades-of-marketing-data-tell-us/) — the remaining weight after 13 weeks is $0.7^{13} \approx 0.010$. By the end of a quarter, you're carrying less than 1% of the original stimulus. Functionally zero.

That's the measured effect. What it misses is the effect that brand advertising has been accumulating for years.

## Where the long-term effect goes

Brand advertising does something a weekly adstock can't see: it builds **mental availability** — the probability that the brand comes to mind in a buying moment. This is not a weekly effect. It compounds over years of consistent media exposure and decays on a horizon of 12–36 months or more, much slower than any activation or carryover.

In the weekly model, this slow-moving accumulated equity shows up as a gradually rising baseline. The intercept, the trend component, the seasonal baseline — these are the model's catch-all for everything not explained by the media regressors and controls. Long-term brand equity that took three years of TV to build shows up as "base."

The model isn't wrong about the data. The activation and carryover effects it found are real. The problem is interpretation: **the model attributes years of compounded brand investment to a number it calls "base" and then hands the CMO a per-channel ROAS that is systematically missing the largest part of brand media's value.**

The result is predictable. Performance channels (paid search, retargeting) act in the current week and their full effect is visible in the data. Brand channels (TV, OOH, brand video) act over years and most of their effect is invisible. The ROAS comparison is not apples-to-apples; it's apples to a partial apple.

## The identifiable part: activation vs. carryover

There is a part of the long-term question the weekly model can answer honestly: among the *measured* effects, how much is immediate versus how long does it persist? The `mmm-framework` surfaces this as a carryover split:

```python
# From reporting/helpers/longterm.py
immediate_pct = w[0] / sum(w)      # weight at lag 0
carryover_pct = 1 - immediate_pct  # weight at lags 1..L
effective_weeks = sum(1 for wt in w if wt >= 0.01 * sum(w))
```

For TV with $\alpha = 0.7$ over a 13-week window:

| Metric | Value |
|---|---|
| Week-0 weight | 30% of total |
| Carryover (weeks 1–13) | 70% of total |
| Effective weeks (≥1% weight) | ~7 |

So 70% of TV's *measured* effect is carryover, not immediate. That's worth reporting — it answers "how long does the effect we can see keep running?" But it's silent about what happens after week 13. The long-horizon brand equity effect is a different question with a different answer, and the two should not be conflated.

## The magnitude of the gap

Here's a rough quantification. The Binet & Field meta-analyses of IPA Effectiveness Award entries, and corroborating work from Analytic Partners, consistently find that the total long-run effect of advertising is roughly **1.5–2× the short-run measured effect** for brand-heavy channels. Call it a multiplier of 2.

If your MMM reports TV ROAS = 1.5x, the implied full-lifecycle ROAS (accounting for unmeasured long-term effects) would be closer to 3.0x. If paid search reports ROAS = 2.5x and that's nearly all activation (very short half-life, mostly measured), the actual comparison is 3.0 (TV, full) versus ~2.5–2.6 (search, mostly measured). The channel ranking reverses.

I want to be clear that 2× is not an estimate from this model — it's an **external assumption** drawn from the meta-analytic literature. The honest use of it is as a scenario, explicitly labeled, not as a model output. The `mmm-framework` handles this with an opt-in `long_term_multiplier` parameter on the report config: when set, the section shows a clearly-labeled scenario with the assumption documented. It will not silently inflate a ROAS number and present it as a model output.

This is the same epistemic principle I've written about in [false precision](/posts/false-precision-in-reporting/) and [the assumptions are the model](/posts/the-assumptions-are-the-model/): a number that is an assumption dressed as an estimate is more dangerous than admitting the gap.

## A partial fix: the structural funnel

There is one architecture that partially captures the brand path within the model: a **structural funnel**. If you have brand-tracker survey data — weekly awareness and consideration — you can build a mediated model:

$$\text{media} \rightarrow \text{awareness} \rightarrow \text{consideration} \rightarrow \text{sales}$$

where each arrow is modeled explicitly. Media that moves awareness, which later moves sales, gets credited to the channel through the funnel rather than absorbed into base. The consideration→sales path is the part of the long-term brand effect that *is* identified by the data, because you have a direct measurement of the intermediate state.

This is the approach in `mmm_extensions/models/structural.py` and it's what I described in the [measurement error in predictors post](/posts/measurement-error-in-predictors/) as the reason to model the tracker properly rather than plugging in raw percentages. If the intermediate quantities are measured with error and you don't model that error, you introduce attenuation bias on the media coefficients. The structural funnel helps — but only up to the funnel's own measurement window. What happens to consideration six months from now because of the brand you built today is still outside the model.

## What data would actually fix this

To measure long-term brand effects in the model rather than assuming them from a multiplier, you need:

1. **Long history.** Two to three years of weekly data is the minimum for separating a slow-building brand trend from a coincidental baseline drift. One year of data can't see the difference.

2. **Brand-tracker surveys that span the full period.** Weekly awareness and consideration from a continuous survey, not just a periodic pulse check. The structural funnel is only as long as your tracker history.

3. **Long-window experiments.** A standard geo lift test run for four weeks tells you activation. A geo test run for four quarters — with the treatment region exposed to brand media and the control region held dark, then both read for a further six months — tells you persistence. These tests exist; they're just expensive.

4. **An explicit long-term term in the model.** A brand-equity latent variable, fit to the tracker data, with a very long decay constant. This is technically and conceptually hard, but it's the only way the model itself captures what otherwise gets left in base.

In practice, most clients have one year of data and no long-window experiments. The honest response in that situation is not to report a full-lifecycle ROAS as if you estimated it — it's to report the short-term measured ROAS, name the long-term gap explicitly, and present the meta-analytic scenario as an assumption the client should weigh against their own prior.

## What this means in practice

If you're reading an MMM that reports brand-building channels with low ROAS and performance channels with high ROAS, ask these questions before acting:

- What is the adstock window? If it's 4–8 weeks, the model has structurally no way to see effects that persist beyond that.
- What is in "base"? Is the base growing over time? If so, some of that growth is probably long-term brand equity.
- Is there a long-term multiplier applied, and if so, is it labeled as an assumption?
- Is there a structural funnel? If the model routes media through awareness and consideration, the brand path is partially captured.

A model that passes all four checks is being honest about what it measures. A model that hands you a clean ROAS table with no caveats is hiding the question, not answering it.

The channels that look worst in the short run are often the ones building the baseline that makes everything else work. Cutting them fixes the ROAS table and breaks the brand — and you won't see it in the data for a year.

---

*The carryover split and long-term scenario reported here are implemented in `mmm-framework` under `reporting/helpers/longterm.py` and `LongTermSection`. The meta-analytic multiplier range (1.5–2×) draws on Binet & Field, *The Long and the Short of It* (IPA, 2013) and Analytic Partners' ROI Genome work (2021). Related posts: [What Decades of Marketing Data Tell Us](/posts/what-decades-of-marketing-data-tell-us/) covers short-run advertising elasticity and carryover decay rates. [Measurement Error in Predictors](/posts/measurement-error-in-predictors/) covers the structural-funnel attenuation problem.*
