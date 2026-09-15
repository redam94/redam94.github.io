---
title: "When Seasons Look Like Media Effects"
author: Matthew Reda
pubDatetime: 2026-09-15T13:15:00Z
slug: seasonality-confounders-in-mmm
draft: true
tags:
  - marketing-mix-modeling
  - statistics
  - regression
  - bayesian
description: Unmodeled seasonal patterns in sales data can be absorbed into media coefficients, producing inflated ROAS estimates that evaporate the moment you control for seasonality properly.
---

Most marketing datasets have two things in common: sales are higher in Q4, and media spend is also higher in Q4. If your model doesn't know about holidays, it learns "more media → more sales" — which is technically true but picks up seasonality, not incrementality. You get a high ROAS, it survives all the standard checks, and it's wrong.

This is seasonality confounding. It's one of the most common sources of inflated ROAS estimates I see in practice, and it's insidious because the model fits well and the numbers feel plausible.

## The mechanism

Say you're running a brand campaign that ramps up in November and December. Sales also ramp up then. A naive MMM with a linear media term estimates a large positive coefficient — the model is explaining the right direction at roughly the right magnitude. The problem is that the coefficient is doing double duty: it's estimating media incrementality _and_ absorbing the seasonal component of sales that you didn't separately control for.

If you were to cut all media spend in November, your model predicts sales would fall by the full seasonal amount. In practice, they'd fall much less — most of the Q4 lift is demand, not media. But the model has no way to know that, because you never gave it a Q4 without media.

Formally, let $s_t$ be the true seasonal component of log-sales (unobserved, peaks in November) and $m_t$ be media spend (also higher in Q4 because your media team follows demand). The truth is:

$$y_t = \alpha + \beta_{\text{media}}\,m_t + s_t + \varepsilon_t$$

If you omit $s_t$, you fit:

$$y_t = \alpha + \hat\beta_{\text{media}}\,m_t + \varepsilon_t$$

Since $s_t$ and $m_t$ are positively correlated, the estimator converges to:

$$\hat\beta_{\text{media}} \xrightarrow{p} \beta_{\text{media}} + \frac{\text{Cov}(m_t,\, s_t)}{\text{Var}(m_t)}$$

The second term is the omitted-variable bias. It's positive whenever media spend and the seasonal pattern co-move — which they almost always do, because media planning follows the demand cycle.

## What it looks like in practice

In three years of weekly national data with a Q4 seasonal lift of 25% and media spend that rises 30% in November–December, you can inflate the media coefficient by 40–60%. The model fits well (high $R^2$, narrow posteriors), the ROAS looks reasonable, and nothing in the standard diagnostics waves a flag. The bias is invisible unless you separately control for seasonality.

The diagnostic I find most useful is simple: plot residuals over time. If you see a recurring seasonal pattern in the residuals — systematically higher in Q4, lower in Q1–Q2 — then seasonality is being absorbed into something else in your model (probably media, baseline, or both). Residuals from a well-specified model should look like noise across all calendar periods.

## Two ways to control for seasonality

**Fourier terms.** Add sine/cosine pairs at the annual frequency (52-week period) and harmonics:

$$f_k(t) = \left[\sin\!\left(\frac{2\pi k\,t}{52}\right),\; \cos\!\left(\frac{2\pi k\,t}{52}\right)\right], \quad k = 1,\ldots,K$$

Two to four pairs ($K = 2$–$4$) capture most meaningful seasonality without introducing too much flexibility. The model fits the Fourier coefficients alongside the media coefficients; the seasonal terms absorb the Q4 pattern and leave the media coefficient to explain the deviations within season.

```python
import numpy as np
import pymc as pm

K = 3  # Fourier pairs
t = np.arange(T)
fourier = np.column_stack([
    f(2 * np.pi * k * t / 52)
    for k in range(1, K + 1)
    for f in (np.sin, np.cos)
])  # shape (T, 2K)

with pm.Model():
    beta_s = pm.Normal("beta_s", 0, 0.5, shape=2 * K)
    seasonal = pm.Deterministic("seasonal", fourier @ beta_s)
    # ... media terms, baseline, etc.
    mu = baseline + media_contribution + seasonal
    pm.Normal("y", mu=mu, sigma=sigma, observed=log_sales)
```

**Gaussian process baseline.** A more flexible alternative: model everything that isn't media as a latent GP over time. The GP absorbs both trend and seasonality, leaving media terms to explain deviations from the smooth baseline. The tradeoff is that a flexible GP can absorb real media effects if the media patterns closely follow the seasonal shape — so the prior on the GP's length scale and amplitude matters.

## The Goldilocks problem

The other failure mode is the opposite of confounding: too many Fourier terms (or a too-flexible GP), and the seasonal control starts absorbing the media effect it was meant to free up. If your campaign always runs in Q4 and never in Q1, a sufficiently rich seasonal model can explain most of the variance that media should explain, pushing the media coefficient toward zero.

Too little seasonality → inflated ROAS. Too much → attenuated ROAS.

The right level of seasonal complexity is informed by prior knowledge ("our category has a sharp, well-known holiday peak, not a gradual one") and validated by checking whether the model's seasonal component looks like what you'd draw by hand from domain knowledge. Posterior predictive checks on held-out Q4 periods are particularly useful: a well-controlled seasonal model should predict the Q4 level plausibly even when you zero out the media inputs, because the seasonal terms carry the lift. A confounded model can only predict Q4 correctly when the inflated media coefficient is included.

## The pre-specification angle

This is also where [pre-specification](/posts/building-a-pre-specified-bayesian-mmm/) matters. If you decide on the number of Fourier pairs after seeing the residuals, you're doing seasonality model selection in a way that can either overfit (pick $K$ large enough to fit the residuals) or underfit (stop as soon as the residuals look "good enough" with a low $K$ that leaves more variance for the media coefficient). Pre-specifying the seasonality structure — including the number of Fourier pairs — before seeing the fit eliminates this degree of freedom.

The diagnostic — plot residuals by calendar week — is best run as a _post_-fit check on a pre-specified model, not as a search criterion for choosing model structure. The evidence from the data should update your next model; it shouldn't be optimized against in the current one.

---

_Seasonality confounding is among the time-series pitfalls addressed in [`common_regression_issues`](https://github.com/redam94/common_regression_issues) `nbs/03_trends_and_seasons.ipynb`. Related: [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/), [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/), [Simulation-Based Calibration](/posts/simulation-based-calibration/)._
