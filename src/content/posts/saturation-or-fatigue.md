---
title: "Saturation or Creative Fatigue? Your MMM Can't Tell the Difference"
author: Matthew Reda
pubDatetime: 2026-08-06T13:29:16Z
slug: saturation-or-fatigue
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - measurement
description: A concave response curve and a fading linear coefficient fit the same media data to within measurement error and recommend opposite budgets — and the mechanism that makes them indistinguishable is adstock.
---

There's a story that shows up in almost every annual marketing review: a channel's performance per dollar has been sliding. The room splits immediately into two camps.

The first camp says **diminishing returns**. You've climbed the concave part of the response curve, you're on the flat part, and the fix is to redeploy dollars somewhere steeper. The model backs this up: a Hill or logistic saturation function, clear curvature, marginal ROAS well below average ROAS.

The second camp says **creative fatigue**. The response curve hasn't changed shape, but the creative is worn out, the platform dynamics have shifted, and the channel's coefficient has been quietly drifting down. The fix is to refresh the creative or wind the channel down. A different model backs this up too: no saturation at all, a linear response, but a smoothly declining effectiveness parameter across the window.

Both camps have models. Both models fit the data. They can't both be right, and the weekly sales series cannot tell you which one is.

## Two models, one series

Write them side by side:

$$\text{A (static nonlinear):}\quad c_t = \beta\, S(a_t)$$
$$\text{B (linear + drift):}\quad c_t = \beta_t\, a_t$$

Model A is the standard MMM — a fixed coefficient multiplied by a concave saturation function $S$ applied to the adstocked spend $a_t$. Model B has no saturation at all, but the effectiveness $\beta_t$ drifts smoothly over time.

In the `mmm-framework` simulation I built for the [saturation identification docs](https://redam94.github.io/mmm-framework/blog-saturation-or-fatigue.html): 156 weeks, one channel, geometric adstock with 0.70 retention, realistic noise (R² near 0.87). One story is true by construction. Both families fit the series. Their predictive means never separate by more than half a residual standard deviation in any week. R² differs by 0.001. But they disagree by a factor of 2.3 on the single quantity a budget optimizer consumes: the ratio of marginal to average ROAS.

Model A says your next dollar is worth 43 cents on the dollar (you're on a flat curve). Model B says it's worth exactly what your previous dollars earned (linear response, marginal equals average). One model says to cut; the other says to hold. Both are statistically indistinguishable from the data you have.

## Why adstock is the culprit

This is not the ridge I wrote about in [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/). That post covers weak identification *within* a model family — the banana-shaped joint posterior of $(\alpha, \kappa, \beta)$ when all three trade off inside a single MMM. That failure announces itself: the posterior is wide, the pair-plot has a diagonal smear, the model tells you it doesn't know.

What happens between model families is the opposite. Inside model B, $\beta_t$ is well-identified given the specification. Inside model A, the saturation parameter is well-identified given the specification. Both posteriors are sharp. They're sharp about incompatible things, and nothing inside either fit is aware the other exists.

The mechanism is a single line of algebra. Set the two contributions equal and solve for the drifting coefficient:

$$\beta_t\, a_t = \beta\, S(a_t) \;\Rightarrow\; \beta_t = \beta\,\frac{S(a_t)}{a_t}$$

The quantity $S(a)/a$ is the **secant slope** — the average productivity of a dollar along the true concave curve at the current operating point. For any concave $S$ with $S(0)=0$, it falls strictly as $a$ rises. So when spend climbs, the secant slope falls, and model B interprets this mechanical movement along a curve as *fading effectiveness over time*. The fabricated fatigue story runs in whatever direction the media budget runs.

The reverse failure is symmetric and just as common: fit model A to a world with genuine creative fatigue (no saturation, truly declining coefficient), and the model invents a saturation curve steep enough to absorb the decline. It tells you marginal ROAS is 0.52 in a world where the true marginal is 1.00, and promises an efficiency gain from a budget cut that would deliver nothing.

The reason this conflation persists is adstock. Geometric adstock with retention $\alpha$ is:

$$a_t = \alpha\, a_{t-1} + x_t$$

That is the definition of an AR(1) process. It installs autocorrelation into the media regressor — the exact condition under which a static nonlinear response and a smooth drifting linear one become observationally equivalent. The device you add to capture carryover manufactures the regressor property that dissolves the saturation curve you then optimize against. Higher retention, more autocorrelation, more confusion. At $\alpha = 0.7$, the lag-1 autocorrelation of the adstocked series is already around 0.71.

The result — that nonlinear and time-varying effects are not identifiable from standard marketing mix data when the media regressor is autocorrelated — was established formally by Dew, Padilla & Shchetkina (2024). The secant-slope framing above is my compact restatement of the mechanism.

## What to do about it

Three things, in order of leverage:

**1. Fit both model families and check if they agree.** The `mmm-framework` exposes a time-varying media coefficient via `mmm_extensions` components. If model A and model B agree on marginal ROAS, your conclusion is robust to the family choice. If they disagree by more than a factor of two, you have a structural ambiguity that no amount of sampling resolves — and you should report both, not the one that fits the brief.

**2. Vary the spend schedule.** The two families separate wherever the autocorrelation breaks down: rapid, discontinuous spend variation is something a smooth $\beta_t$ can't track but a fixed $S(\cdot)$ can absorb. A planned escalation/de-escalation test — cutting spend by 50% for four weeks and then restoring it — generates week-to-week jumps that break the aliasing. This is a cheaper version of a geo experiment designed specifically to distinguish shape from drift.

**3. Anchor the coefficient.** A geo-lift test that pins $\beta$ with a calibration prior breaks the saturation-vs-fatigue symmetry from the other direction. Once the level is anchored by randomized evidence, the shape parameters are partially freed from absorbing the coefficient's drift. The `mmm_framework.calibration` module does exactly this: turn a geo result into a prior on $\beta$, which collapses the equifinality both within and across model families.

## The uncomfortable conclusion

Most MMMs commit to a saturation family upfront — exponential, Hill, root, or logistic — and fit it. The resulting posterior is tight. The resulting marginal ROAS recommendation goes into a budget deck. The meeting's second camp, the one that suspected creative fatigue, gets told the data prefers the curve.

It doesn't. The data is compatible with the curve and with the drift. The tight posterior is tight because you specified one family and excluded the other. The model can't tell you which story is true, and the diagnostics — R-hat, ESS, PPC — don't check for the story you didn't fit.

Reporting a marginal ROAS without stating which model family produced it, and whether the other family agrees, is reporting one of two equally-plausible numbers as if it were the answer. Sometimes the two families do agree. When they don't, that disagreement is the finding — and it's more honest than the single number was.

---

_The identification result is from Dew, Padilla & Shchetkina (2024), "Identification of Marketing Mix Models," available on SSRN. The secant-slope derivation is my own restatement of the mechanism. Full simulation code and an interactive figure are in the [mmm-framework documentation](https://redam94.github.io/mmm-framework/blog-saturation-or-fatigue.html). Related posts: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) covers the within-family ridge; [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/) covers geo-lift calibration._
