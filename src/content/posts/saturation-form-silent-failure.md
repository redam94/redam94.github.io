---
title: "The Wrong Saturation Curve Fails Silently"
author: Matthew Reda
pubDatetime: 2026-07-31T13:18:41Z
slug: saturation-form-silent-failure
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - regression
description: When your saturation functional form is wrong, R-hat stays green, divergences stay at zero, and the PPC passes — while attribution is off by 65%. Here's the failure mode and how to catch it.
---

When you built your MMM, you chose a saturation function. Maybe you thought about it carefully, maybe you took the library default. Either way, the curve is in there, and it's making a structural claim about how spend converts to sales — a claim your standard diagnostics cannot interrogate.

This is the failure I want to be precise about. Not because it's exotic, but because the [`mmm-framework`](https://github.com/redam94/mmm-framework) stress tests produce a clean, measured case of it: swap the saturation family, watch all checks stay green, and see attribution move by tens of percentage points.

## What saturation does

An adstock transform spreads media spend across time. Saturation maps accumulated exposure to a response index. The chain is:

$$\text{contribution}_t = \beta \cdot f\!\left(x^{\text{adstock}}_t\right)$$

where $f(\cdot)$ is the saturation curve. The shape of $f$ determines how the model interprets spend at different levels — and how it attributes sales between channels operating in different spend regimes.

## Two families, one important difference

The `mmm-framework` supports several saturation forms. The two that matter most here are:

**Logistic (1-exp):**

$$f(x) = 1 - e^{-\lambda x}$$

This is a concave function: the marginal response is highest at $x = 0$ and falls monotonically. Every dollar of spend is assumed to be operating somewhere on the diminishing-returns slope, starting from the very first dollar. The slope at the origin is $\lambda$ — the steepest point on the curve. There's no threshold, no region of approximately linear response, no lag before diminishing returns kick in.

**Hill (two-parameter):**

$$f(x) = \frac{x^n}{x^n + \kappa^n}$$

With $n = 1$ this is Michaelis-Menten — concave, similar shape to logistic. With $n > 1$, it's a true S-shape: slope at the origin is zero, the curve builds through a linear-ish region, reaches an inflection point at $\kappa$, then saturates. That linear warm-up region is a genuine threshold — a spend range where additional exposure produces approximately proportional response before diminishing returns emerge.

These are different claims about how advertising works. The logistic family says "you're always on the diminishing-returns slope." The Hill family with $n > 1$ says "there's a minimum effective spend before the response really kicks in." Both are sometimes right. They cannot both be right for the same channel on the same data.

## The failure mode, with numbers

If the true response has an S-shape and you fit a concave-only form, the model cannot express the threshold region. It must force all the spend-response observations onto a curve that starts steep at the origin. The optimizer will find a $\lambda$ that makes the in-sample fit look acceptable. The posterior predictive check will pass. R-hat will be under 1.02. Divergences will be zero.

The attribution will be wrong.

The `saturation_misspec` scenario in the `mmm-framework` [stress test suite](https://github.com/redam94/mmm-framework/blob/main/tests/synth/results/stress_matrix.md) runs exactly this: data generated under Hill with $n > 1$, model fit with logistic (1-exp). The results:

| channel | true contribution | estimated | relative error | in 90% CI |
| ------- | ----------------: | --------: | -------------: | :-------: |
| TV      | 2,658             | 4,397     | **+65%**       | ✗         |
| Search  | 3,868             | 4,294     | +11%           | ✓         |
| Social  | 3,106             | 4,767     | **+53%**       | ✗         |
| Display | 2,456             | 3,271     | +33%           | ✗         |

R-hat: 1.01. Divergences: 0. PPC: passes. Refutation: passes. This is a silent failure by the standard definition: the metrics that analysts act on are all green, and three of four channels are materially wrong.

The mechanism is straightforward once you see it. The concave curve must attribute *some* diminishing return to every unit of spend, including spend that was actually in the true response's linear region. Channels that operate predominantly in that region — where the Hill truth says "approximately proportional response" — get credited as if they were already deep into saturation. The model overestimates contributions across the board because it's reading linear-region spend as if it were diminishing-returns spend.

## Why the standard diagnostics can't see it

R-hat and ESS validate that the sampler converged to the posterior. It did. Posterior predictive checks test whether data simulated from the posterior looks like the observed data. It does — the logistic curve with a well-fitted $\lambda$ can approximate the in-sample aggregate relationship reasonably well, because the in-sample data doesn't contain clean holdout information about the curve's shape at the extremes. Refutation scores overall fit, not shape.

The functional form assumption is invisible to all of these because they evaluate fit, not cause. A model that fits well in-sample can still make a wrong structural claim about what the response curve looks like. This is the same point as [simulation-based calibration](/posts/simulation-based-calibration/): computational diagnostics certify the sampler, not the inference. You can have perfect MCMC and a systematically wrong posterior because the model you gave the sampler was misspecified.

## The diagnostic that can see it: response-curve bands

The right tool is the posterior response-curve band — the distribution of the fitted saturation curve $f(x; \theta_{\text{sat}})$ over your posterior samples, plotted against the actual range of spend your data covers.

```python
import numpy as np
import matplotlib.pyplot as plt
import arviz as az

# Posterior samples of lambda for a logistic-fit channel
lam_samples = trace.posterior["sat_lam_tv"].values.flatten()

# The adstocked, normalized spend range your data actually spans
x_range = np.linspace(0, 1.0, 200)

fig, ax = plt.subplots(figsize=(7, 4))
for lam in lam_samples[::5]:
    ax.plot(x_range, 1 - np.exp(-lam * x_range), alpha=0.04, color="steelblue")

# Mark where your data's spend actually sits
spend_p10 = np.percentile(tv_adstocked_normalized, 10)
spend_p90 = np.percentile(tv_adstocked_normalized, 90)
ax.axvspan(spend_p10, spend_p90, alpha=0.15, color="orange", label="data range (p10–p90)")

ax.set_xlabel("Normalized adstocked spend")
ax.set_ylabel("Saturation f(x)")
ax.set_title("Posterior response-curve band — TV")
ax.legend()
```

Look at where your data lives. If typical spend is concentrated in the range $[0, 0.3]$ and the posterior curve band is already curving over before $0.3$ — already showing strong diminishing returns at low spend — you're fitting a shape that says your channel is operating in saturation when the data might be entirely in the linear region. If there's any reason to believe there's a threshold (the channel doesn't do much below some minimum level), a strictly concave form cannot express that and you're misattributing.

When the `mmm-framework` test pivoted from logistic to Hill on the `saturation_misspec` scenario, response-curve band coverage of the true curve went from approximately 58% to 86%. The curve shape told the story the coefficient posteriors couldn't.

## What to do

**Default to Hill.** The Hill function — `SaturationConfig.hill()` in `mmm-framework` — includes the S-shape as a genuine possibility and gracefully degrades toward Michaelis-Menten when the posterior on $n$ sits near 1. The strictly concave forms (logistic, root, Michaelis-Menten) make a one-way bet that diminishing returns are immediate; Hill lets the data say otherwise.

**Anchor $\kappa$ to your spend range.** The [equifinality problem](/posts/adstock-saturation-identification/) means $\kappa$ (the half-saturation point) trades off against adstock decay and $\beta$. Setting `anchor_kappa_to_data=True` in the saturation config uses the observed normalized spend distribution to bound $\kappa$, preventing the optimizer from drifting the curve's elbow entirely outside the range your data covers. This is the most practically important guardrail.

**Plot the response-curve band.** Every model fit should include this plot — it takes roughly ten lines of code. If the posterior band is a tight family of curves that all tell the same structural story in your data's spend region, you're not getting information from the data that might distinguish families. If the band is wide over the relevant range, that's honest uncertainty about the curve's shape. The failure case is a tight band that confidently asserts a shape you haven't actually tested.

**Use LOO for model comparison.** `az.compare` with Pareto-smoothed LOO will sometimes distinguish saturation families when the data contains enough variation in spend levels. It won't always separate them — if your spend never varies enough to reveal the shape, LOO is as blind as everything else. But a clear LOO win for Hill over logistic is the quantitative signal to trust.

The saturation curve is the structural story your model tells about how media converts to response. It's worth a few minutes of actual thought — and a response-curve plot after every fit.

---

_The `saturation_misspec` scenario and stress matrix are in the [`mmm-framework` stress suite](https://github.com/redam94/mmm-framework/blob/main/tests/synth/results/stress_matrix.md). The full scenario runs in `nbs/stress/stress_01_carryover_and_shape.ipynb`. Related: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) covers the joint-identification problem. [Simulation-Based Calibration](/posts/simulation-based-calibration/) covers the pre-flight test that checks whether inference recovers parameters correctly. [Read the Diagnostics First](/posts/read-the-diagnostics-first/) covers what R-hat and divergences do and don't certify._
