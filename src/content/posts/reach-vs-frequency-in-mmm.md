---
title: "Reach vs. Frequency: The Planning Question Your Impressions Column Can't Answer"
author: Matthew Reda
pubDatetime: 2026-07-29T13:19:05Z
slug: reach-vs-frequency-in-mmm
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - measurement
description: An impressions column collapses two distinct things — how many distinct people you reached and how often you reached each one. A volume MMM can't answer the reach-vs-frequency question; here's the model, the math, and what identification actually requires.
---

Every week a standard MMM ingests a column of impressions for each media channel and produces a ROAS. It's clean, fast, and answers a useful question about aggregate spend efficiency. But there's a planning question it structurally cannot answer: **should I spend the next dollar on more reach or more frequency?**

This isn't a data quality issue. It's a model specification issue. Two campaigns with exactly the same impression count can have very different effects if one reaches a million people once and the other reaches 200,000 people five times. A single impressions column collapses these into the same number, so the model never sees the difference.

## Why it matters

The 3+ frequency threshold is one of the oldest observations in advertising effectiveness research: marginal returns to additional exposures diminish, and at high enough frequency per person you're mostly wasting money on people who've already been moved as much as they're going to be moved. Getting someone from 0 to 1 exposure is worth far more than getting them from 8 to 9.

A volume MMM doesn't model this. Its saturation curve captures diminishing returns on _aggregate spend_, but that's a different thing. Spend saturation reflects what happens when you've bought up the easy inventory and marginal slots are less efficient. Frequency saturation reflects what happens when any individual person has seen your ad too many times. These can happen independently — you can have spend saturation without frequency wearout (if you have high reach and low frequency), or frequency wearout without spend saturation (if you've concentrated many exposures on a narrow audience).

The planning question "more reach or more frequency?" requires separating the two. A volume model can't.

## The model

For channels with reach and frequency data — TV, YouTube, programmatic — `mmm-framework` supports a reach-frequency specification:

$$\text{effective\_reach}_t = \text{reach}_t \cdot g\!\left(\text{frequency}_t\right)$$

$$\text{contribution}_t = \beta \cdot f\!\left(\text{adstock}\!\left(\text{effective\_reach}_t\right)\right)$$

The channel's media column becomes **reach** (distinct audience reached per period), and frequency enters as a control variable that modulates how effective that reach is. The function $g$ maps average frequency to a per-period gain in $(0, 1]$. This effective reach then flows through the channel's normal adstock and saturation pipeline, so $\beta$ and all downstream numbers — contributions, decomposition, marginal ROAS — keep their usual meaning.

Two shapes are available for $g$:

**Exponential** (the default):

$$g(f) = 1 - e^{-k f}$$

This is monotone and always positive: every additional exposure helps, but each one helps less than the last. It asymptotes to 1, meaning there's a ceiling on how much effective reach you can extract from a given audience regardless of how many times you expose them. This is the conservative choice — it encodes the view that frequency is always useful but subject to strong diminishing returns.

**Hill** (S-shaped):

$$g(f) = \frac{f^s}{f^s + h^s}$$

This models a **minimum effective frequency** threshold: at low frequency, the curve is nearly flat — exposures are largely wasted — before it kicks in and rises steeply. The half-saturation parameter $h$ is the frequency at which you've recovered half the possible effectiveness. This shape is appropriate when you have evidence that ads need to accumulate before they register — a complex message, a category where mental availability builds slowly, or a premium product where purchase consideration takes several touchpoints to activate.

In `mmm-framework`:

```python
from mmm_framework.config import ReachFrequencyConfig, FrequencyResponse

model_config = (
    ModelConfigBuilder()
    .with_reach_frequency(
        ReachFrequencyConfig(
            channel="TV",
            frequency_column="Frequency",  # avg frequency, derived as impressions / reach
            response=FrequencyResponse.EXPONENTIAL,
        )
    )
    .build()
)
```

If you only have impressions and reach, you can derive `frequency = impressions / reach` and supply it as the control column.

## What the model reports

The fit registers the **effective frequency** threshold: for the exponential shape, the average exposures at which effectiveness reaches 90% of its asymptote; for the Hill shape, the half-saturation frequency $h$. The reporting surface surfaces this as a concrete planning number:

> _"Effectiveness plateaus around N average exposures — beyond this, spend the next dollar on reach, not frequency."_

That number is the model's answer to the planning question. If your current plan delivers 6 average exposures and the effective frequency is 3, a large portion of your impressions are past the point of meaningful return. The reallocation prescription follows: shift budget from frequency (fewer GRPs to the same audience) to reach (broader distribution at lower per-person frequency).

## The identification caveat — and it's a real one

The frequency curve is only identified by **frequency variation that is not collinear with reach**. This is the catch.

In practice, reach and frequency often move together. A bigger TV buy reaches more people _and_ hits each person more often. If the correlation is high, $k$ and $\beta$ trade off in exactly the same way that adstock and the channel coefficient trade off in a volume model — the posterior spreads across a ridge of equally-plausible combinations. The frequency-saturation curve is weakly identified, and the prior is doing most of the work.

The fix is the same fix as for any identification problem in MMM: design variation that moves the thing you want to measure independently of everything else. A media plan that varies frequency while holding reach approximately constant — or a geo test that runs high-reach/low-frequency in some markets and low-reach/high-frequency in others — manufactures the variation the model needs. Without that variation, treat the effective-frequency number as directional (the sign of the difference from your current plan is more trustworthy than the magnitude), and confirm a reach-vs-frequency reallocation with an experiment.

One technical note: MAP fits (as opposed to full NUTS) systematically bias the decay parameter $k$ downward, just as they bias saturation parameters in the base model. If you're using the effective-frequency threshold to make a real reallocation decision, fit with NUTS so the posterior uncertainty on $k$ is honest before you trust the threshold number.

## The honest use case

The reach-frequency model earns its complexity when two conditions hold: (a) you have actual reach data (not just impressions), and (b) your plan genuinely varies reach and frequency over time or across markets. When those conditions aren't met, the frequency curve is prior-dominated and the model is more complicated without being more informative.

When they do hold, the effective-frequency threshold is one of the more actionable numbers a media model can produce. It translates a statistical finding — the frequency-saturation curve — directly into a budget decision: how many times is enough, and what to do with the spend that's going past that threshold.

---

_Grounded in the `mmm-framework` [`reach-frequency-modeling.md` technical doc](https://github.com/redam94/mmm-framework/blob/main/technical-docs/reach-frequency-modeling.md) and the `ReachFrequencyConfig` implementation in `mmm_framework/config`. The distinction between spend saturation and frequency saturation is covered in the media planning literature (notably Ephron & Klein's work on recency planning). Related: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Brand Equity Lives in the Baseline](/posts/brand-equity-in-the-baseline/), [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/)._
