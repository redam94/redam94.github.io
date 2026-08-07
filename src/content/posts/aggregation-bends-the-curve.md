---
title: "Aggregation Bends the Curve"
author: Matthew Reda
pubDatetime: 2026-08-07T13:34:16Z
slug: aggregation-bends-the-curve
draft: true
tags:
  - marketing-mix-modeling
  - statistics
  - regression
  - bayesian
description: Summing spend data before fitting a saturation curve makes the model fit better and report the marginal return wrong. Jensen's inequality explains it; the fix is upstream of the model.
---

Every MMM I've built starts the same way: pull the spend data, sum it to weekly national totals, fit the saturation curve. That's the standard pipeline. It's also quietly bending the answer — because coarser aggregation makes the fit look _better_ while making the marginal return _worse_.

The mechanism has a name: Jensen's inequality. It's been in the econometrics literature since the 1990s and shows up directly in marketing mix models. It's underappreciated.

## What aggregation does to a concave curve

A channel's true response is concave — each extra dollar buys a little less lift than the one before. Call that response $S(x)$, applied to micro-level spend $x$ (a day, a geo). The true aggregate effect across $M$ micro-units is:

$$R_{\text{true}} = \sum_{j=1}^{M} \beta\, S(x_j)$$

If you only observe the aggregate total $X = \sum_j x_j$, a model that applies the curve once computes:

$$\hat{R} = \hat\beta\, S(X) = M\hat\beta\, S\!\left(\bar x\right)$$

Jensen's inequality says that for any concave $S$:

$$\frac{1}{M}\sum_{j=1}^{M} S(x_j) \;\leq\; S\!\left(\bar x\right)$$

with equality only when every $x_j$ is identical. If spend varies across the units being summed — different days, different geographies — the true aggregate response is smaller than what the model computes. The model overstates the response at high spend and compensates by shifting the saturation curve: flatter $\hat\beta$ or a more saturated half-saturation point than the data actually supports.

Micro-level spend is never uniform. Weekdays outspend weekends. Promotional flights dwarf quiet weeks. The gap is always there.

## The paradox: better fit, worse margin

In a simulation using the `mmm-framework`'s own saturation function — one channel, true daily response, no adstock — aggregating from daily to 28-day grain produces this:

| Grain   | MAPE  | R²    | Marginal return bias |
| ------- | ----- | ----- | -------------------- |
| Daily   | 1.37% | 0.946 | ~0%                  |
| Weekly  | ~1.1% | ~0.96 | ~10%                 |
| Monthly | 0.48% | 0.974 | **−24.8%**           |

In-sample MAPE drops by two-thirds. R² goes up. Every metric in a standard model review improves. The marginal return at current spend — the number a budget optimizer uses to decide whether the next dollar goes to this channel — drifts 25% below truth, monotonically, with no diagnostic flagging it.

That's the trap: a model review flags a high MAPE as a warning. It doesn't flag an excellent MAPE as a symptom of the aggregation doing invisible work.

## Why average return survives but marginal doesn't

The average return (total response divided by total spend) floats around its true value across aggregation levels, without a consistent trend. The marginal return (slope of the fitted curve at the current operating point) deteriorates almost in a straight line.

Fitting the curve to reproduce the total response near the center of the data pins the _level_ tightly at the observed spend level — that's what MAPE measures. The _slope_ is a separate quantity, determined by how the curve bends to explain variation away from center. Aggregation degrades exactly that signal: folding heterogeneous micro-level draws into one number removes local curvature information before the model sees it.

Christen, Gupta, Porter, Staelin and Wittink (1997) established this for nonlinear scanner-data response curves. Same mechanism, same direction of bias. The MMM literature hasn't imported the result widely enough.

## Why your diagnostics don't catch it

Posterior predictive checks compare replicated data to observed data at the grain the model was trained on. If you trained on weekly national totals, the PPC checks weekly national totals. It cannot see a discrepancy that only exists at finer grain.

Simulation-based calibration verifies self-consistency within the model family. If the aggregation bias is baked into what "correctly specified" means for your dataset, the calibration loop never escapes the room to notice it.

The uncomfortable implication: coarser aggregation looks better in every review metric while silently moving the marginal estimate in a predictable direction. You could rationalize the monthly model as the cleaner one and be wrong about the margin without any warning signal.

## What to do

**Check within-cell heterogeneity before fitting.** Compute the coefficient of variation of spend across the micro-units summed into each reporting period. A channel with flat daily spend within weeks has little to worry about. A channel that alternates between flighted pushes and near-zero quiet periods has a real problem. One line of code, runs before the model.

**Prefer spatial disaggregation over temporal.** The `mmm-framework`'s `vary_media_by_geo` option (off by default) estimates per-geography effects under partial pooling. Turning it on reduces the spatial half of the collapse without touching the adstock retention rate. Going finer in _time_ is a genuine tradeoff: a channel with a two-week half-life has per-week retention of about 0.71, but loading daily data turns the same physical carryover into per-day retention of about 0.95. That high autocorrelation worsens the within-family identification problem covered in [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/). Spatial disaggregation sidesteps that tradeoff.

**Fit multiple aggregation levels and compare decisions, not fit statistics.** If the marginal return at current spend moves materially between a weekly and monthly model that both report excellent MAPE, the grain is doing more work than the functional form. That deserves a sentence in the report: "The marginal return estimate varies between X and Y across aggregation levels; we treat the finest available grain as the reference." That's an honest finding, not a modeling failure.

**Consider an analytical correction.** Christen et al. also built a debiasing method using within-cell dispersion statistics rather than disaggregated rows. If a vendor gives you aggregate spend plus a CV or min/max for the underlying distribution, you can correct for the Jensen's gap analytically. The `mmm-framework` doesn't implement this yet, but it's a natural addition that would sit alongside the saturation code already there.

## The pattern

A saturation curve is a model of how spend relates to sales at the level it was fed. If it was fed weekly national totals, it's a model of weekly national aggregates, and whether that faithfully represents channel economics depends on how evenly spend was distributed across what got summed. Most media plans are uneven by design.

The fix isn't a new model. It's a data design question: what level of disaggregation can you get, and does the cost of finer grain (higher autocorrelation, more parameters) outweigh the cost of coarser grain (aggregation bias in the margin)? That trade-off is real. But you can't make it honestly if you don't know it's there.

---

_The core result is Christen, Gupta, Porter, Staelin and Wittink (1997), "Using Market-Level Data to Understand Promotion Effects in a Nonlinear Model," Journal of Marketing Research 34(3). The aggregation bias literature traces to Robinson (1950), "Ecological Correlations and the Behavior of Individuals," American Sociological Review 15(3). The `mmm-framework`'s `vary_media_by_geo` option and `MFFConfig.frequency` setting are the two practical levers; the marginal return is computed in `planning/budget.py::compute_response_curves`. Related: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/)._
