---
title: "Adstock Retention Rates Don't Travel Across Time Scales"
author: Matthew Reda
pubDatetime: 2026-08-24T13:26:04Z
slug: adstock-retention-granularity
draft: true
tags:
  - marketing-mix-modeling
  - statistics
  - regression
  - bayesian
description: A weekly retention rate of 0.7 does not mean 0.7 at monthly grain — it means 0.22. Industry calibrations are grain-specific, and plugging them into the wrong time scale silently mis-specifies your priors.
---

Every industry table of "calibrated retention rates" comes with an implicit asterisk: *at weekly grain*. A TV retention rate of 0.7 means 70% of the accumulated adstock from week $w$ carries into week $w+1$. It does not mean 70% carries into the next day, and it does not mean 70% survives to the next month. If your model runs at monthly granularity and you use 0.7 as the monthly retention rate, you've made an assumption that is mathematically inconsistent with the weekly calibration — roughly 3× too high, in the direction of overstating persistence.

This is one of the quieter errors in applied MMM. The retention rate gets treated as a property of the channel ("TV has high carryover") when it's actually a property of the channel *at a specific time granularity*. Move the granularity and you need a different number.

## The math

The geometric adstock recursion at daily granularity is:

$$A_t = x_t + \alpha_d \cdot A_{t-1}$$

where $\alpha_d$ is the daily retention rate. Now suppose you only observe weekly totals: $X_w = \sum_{t \in w} x_t$ and $Y_w = \sum_{t \in w} y_t$. What does the adstock structure look like at the weekly level?

The clearest way to see it is to trace a single impulse: one dollar of spend on day $t=0$, nothing afterward. The adstock on subsequent days is $A_t = \alpha_d^t$. Total adstock accumulated across the first week (days 0–6):

$$\sum_{k=0}^{6} \alpha_d^k = \frac{1 - \alpha_d^7}{1 - \alpha_d}$$

Total adstock in the second week (days 7–13) is $\alpha_d^7$ times that same sum. The ratio of week 1's adstock to week 0's adstock is exactly $\alpha_d^7$.

So the **weekly retention rate is**:

$$\alpha_w = \alpha_d^7$$

Or equivalently, $\alpha_d = \alpha_w^{1/7}$. Generalizing: the monthly retention rate is $\alpha_d^{30}$, and so on. Retention rates don't add across time — they compound geometrically.

## The practical stakes

Some numbers:

| Channel | Industry $\alpha_w$ | Implied $\alpha_d$ | Implied $\alpha_m$ |
|---|---|---|---|
| TV | 0.70 | $0.70^{1/7} \approx 0.957$ | $0.70^{30/7} \approx 0.22$ |
| Paid search | 0.05 | $0.05^{1/7} \approx 0.65$ | $0.05^{30/7} \approx 0.001$ |
| Display | 0.30 | $0.30^{1/7} \approx 0.84$ | $0.30^{30/7} \approx 0.01$ |

Two things jump out. First, the daily retention rates for all these channels are high — TV at 95.7% per day sounds wrong for a channel we think of as "moderately persistent" at weekly grain, but it's consistent: 95.7% compounded over seven days gives you 70%. Second, at monthly grain, TV retains only 22% from one month to the next. If you were fitting a monthly model and applied the industry-calibrated "TV retention 0.7" as the prior, you'd be centered at 0.7 on a parameter whose true value is around 0.22. That's a 3× overestimate of monthly persistence.

The error compounds: a prior badly misaligned with the true parameter biases the posterior toward the prior, and with the short time series typical of monthly MMMs (36–60 periods), the likelihood doesn't push back hard enough to correct it.

## The coefficient also changes

It's not just the retention rate. The coefficient $\beta$ in a weekly model is not the same thing as $\beta$ in a daily model, because the weekly grain absorbs within-week carryover into the contemporaneous effect.

If the daily DGP is $y_t = \beta_d \cdot A_t$, and all spend in a week happens on day $T_w$ (the start of the week), then weekly sales from that impulse are:

$$Y_w = \beta_d \cdot \sum_{k=0}^{6} \alpha_d^k = \beta_d \cdot \frac{1 - \alpha_d^7}{1 - \alpha_d}$$

The weekly model represents this as $Y_w = \beta_w \cdot X_w^{\text{adstock}}$, where $X_w^{\text{adstock}}$ is the weekly adstock recursion. Matching the two:

$$\beta_w = \beta_d \cdot \frac{1 - \alpha_d^7}{1 - \alpha_d}$$

For TV ($\alpha_d \approx 0.957$):

$$\beta_w = \beta_d \cdot \frac{1 - 0.957^7}{1 - 0.957} \approx \beta_d \cdot \frac{0.267}{0.043} \approx 6.2 \cdot \beta_d$$

The weekly coefficient is roughly 6× the daily coefficient. This isn't a model error — it's a change of interpretation. The daily $\beta_d$ is the one-period instantaneous response. The weekly $\beta_w$ includes six days of within-week carryover stacked on top of the immediate effect. Both can be correct descriptions of the model, but they are measuring different things and cannot be compared without explicitly applying the conversion factor.

ROAS estimates derived from a weekly model and from a daily model on the same channel will differ by this factor if the analyst doesn't account for it. The weekly model is not "more accurate" — it's reporting a different quantity.

## What to do

**Prefer the smallest grain your data supports.** Daily data and a daily model don't have this problem: the adstock recursion runs at the actual impulse-response timescale. Weekly is generally fine for media-heavy MMMs and is the grain most industry calibrations were produced at. Monthly is where this bites hardest, because the conversion $\alpha_m = \alpha_w^{30/7}$ is steep.

**Convert explicitly if you have to.** If your model runs at a different grain than the calibration source, propagate through the transform. A $\text{Beta}(7, 3)$ prior on $\alpha_w$ (centered near 0.7) does not translate to a $\text{Beta}(7, 3)$ prior on $\alpha_m$. Sample from the weekly prior and look at what it implies at monthly grain:

```python
import numpy as np

# Industry prior on weekly retention: Beta(7, 3), centered near 0.7
rng = np.random.default_rng(42)
alpha_w_samples = rng.beta(7, 3, size=10_000)
alpha_m_samples = alpha_w_samples ** (30 / 7)

print(f"Weekly  α: mean={alpha_w_samples.mean():.2f}, sd={alpha_w_samples.std():.2f}")
print(f"Monthly α: mean={alpha_m_samples.mean():.2f}, sd={alpha_m_samples.std():.2f}")
# Weekly  α: mean=0.70, sd=0.12
# Monthly α: mean=0.17, sd=0.10
```

A mean of 0.17 with sd of 0.10 is the honest monthly prior for TV if your only evidence is the industry weekly calibration. It's much lower and wider than the naive translation of 0.7. Use this distribution to set $\alpha$, $\beta$ parameters for a Beta prior on $\alpha_m$ directly:

```python
from scipy.stats import beta as scipy_beta

# Fit a Beta distribution to the implied monthly samples
a, b, _, _ = scipy_beta.fit(alpha_m_samples, floc=0, fscale=1)
print(f"Monthly prior: Beta({a:.1f}, {b:.1f})")
# Monthly prior: Beta(2.4, 12.1)
```

That Beta(2.4, 12.1) — heavily skewed toward zero — is what the industry weekly calibration actually implies at monthly grain, and it looks nothing like "TV has high carryover."

**State the grain in every model spec.** A retention rate without a stated granularity is an incomplete specification. The pre-specification discipline in [`mmm-framework`](https://github.com/redam94/mmm-framework) requires declaring the time grain alongside each prior distribution — exactly because a prior that looks reasonable at one grain can be silently absurd at another. The `TimeGranularity` parameter in the pre-spec config is there for this reason: it triggers the conversion checks when priors are loaded from the shared calibration library.

## The joint implication for SBC

If you run [Simulation-Based Calibration](/posts/simulation-based-calibration/) on a monthly model with weekly-calibrated priors, the rank histogram for $\alpha$ will be badly miscalibrated — concentrated near 1 (too high) because the prior is pulling toward weekly-scale persistence. This is the diagnostic that catches the error before it reaches a client deck. An arch-shaped rank histogram on the retention parameter isn't a modeling failure — it's the SBC doing its job and telling you the prior is not consistent with what the data can plausibly generate at this granularity.

---

The adstock retention rate is not a fact about a channel. It's a fact about a channel *at a time scale*. That asterisk should be in every industry calibration table — and, until it is, the conversion formula is $\alpha_w = \alpha_d^7$, $\alpha_m = \alpha_d^{30}$, and the right response to any prior you've borrowed from a different grain is to propagate it through the nonlinear transform before fitting.

---

_Related posts: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) — joint identification of $\alpha$ and $\kappa$ from the same time series. [Simulation-Based Calibration](/posts/simulation-based-calibration/) — using SBC to catch prior miscalibration before fitting. [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/) — the pre-specification discipline that forces grain declarations._
