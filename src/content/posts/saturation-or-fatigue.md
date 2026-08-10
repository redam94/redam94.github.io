---
title: "Saturation or Fatigue? Your MMM Can't Tell the Difference"
author: Matthew Reda
pubDatetime: 2026-08-10T13:34:15Z
slug: saturation-or-fatigue
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - identification
description: A channel's ROAS has been sliding for years. Your MMM says it's saturated; cut the budget and efficiency rises. A different MMM says the creative is wearing out; fix the channel. Both models fit identically. Here's why, and what breaks the tie.
---

A channel's contribution per dollar has been falling for two years. There are exactly two stories you can tell about that.

The first is **diminishing returns**: the response curve is concave, spend has climbed onto the flat part, and the fix is to move dollars somewhere with a steeper slope. The second is **declining effectiveness**: the channel itself is getting worse — worn creative, a maturing platform, an auction that has turned against you — and the fix is to repair or wind down the channel.

Different diagnoses. Different levers. Potentially millions of dollars in different directions.

Here's the problem: both stories fit your data. Not approximately — to within 0.001 of R², week by week, indistinguishable. And they disagree by more than 2× on the single number the budget optimizer runs on: marginal-to-average ROAS.

## Two models, one series

Write the models side by side. Both use the same baseline, the same adstocked media variable $a_t$, and explain the same KPI. They differ in one place:

$$\text{Model A (saturation):}\quad c_t = \beta\, S(a_t)$$

$$\text{Model B (drift):}\quad c_t = \beta_t\, a_t$$

Model A is the standard MMM: a fixed coefficient in front of a concave saturation function. Model B has no curvature at all — the response is linear in spend, but effectiveness $\beta_t$ drifts smoothly across the window.

These two models are **observationally equivalent** on a typical media time series. No amount of data of the same kind separates them, because they make different predictions only under spend schedules the data has never contained.

## The aliasing has an exact form

Set the two contributions equal and solve for what the drift model is actually estimating:

$$\beta_t\, a_t = \beta\, S(a_t) \quad\Longrightarrow\quad \beta_t = \beta\,\frac{S(a_t)}{a_t}$$

The quantity $S(a)/a$ is the **secant slope** of the response curve — average return per unit of spend at the current operating point. For any concave $S$ with $S(0) = 0$, this falls strictly as spend rises.

Everything follows from that identity. A channel being scaled up walks rightward along the curve; its secant slope falls; the drift model reports that effectiveness is declining. A channel being wound down walks leftward; its secant slope rises; the drift model reports that the channel is *getting better*. The "trajectory" is the response curve, re-indexed by the calendar and read as if it were a trend.

The symmetric failure is just as common and gets less attention. In a world with no saturation whatsoever — a genuinely linear channel whose creative is actually fading — the static MMM has no way to represent the fade. So it spends its only flexibility on the curvature parameter and invents a saturation curve. At the numbers from `synth.dgp.make_time_varying_beta` in [`mmm-framework`](https://github.com/redam94/mmm-framework), that invented curve is steep enough to report a marginal-to-average ratio of 0.52 in a world where the true ratio is exactly 1.0, and to promise a 16% efficiency gain from a budget cut that would change nothing.

## Adstock is the culprit

This aliasing requires autocorrelation in the media regressor, and that's the uncomfortable part: you install that autocorrelation yourself, deliberately, every time you apply geometric adstock.

Geometric adstock with retention $\alpha$ is:

$$a_t = x_t + \alpha\, a_{t-1}$$

That's an AR(1) process driven by weekly spend. If spend were white noise, the adstocked series would have lag-1 autocorrelation of exactly $\alpha$ — not an approximation, the recursion itself. At $\alpha = 0.70$ (unremarkable for weekly TV), the adstocked regressor sits at $\rho \approx 0.70$. At $\alpha = 0.85$, it reaches $\rho \approx 0.79$. A 156-week window at $\rho = 0.80$ carries about 18 weeks' worth of independent information about the media variable — not three years' worth.

This is worth sitting with. The device introduced to capture carryover manufactures the exact regressor property that dissolves the shape you were going to optimize against. [Adstock and saturation already trade off within a single model](/posts/adstock-saturation-identification/); this is a second, different failure that sits one level up. That post's ridge is inside Model A. This one is between Model A and Model B, and it's invisible inside either fit.

## The diagnostics that won't save you

I know the instinct: reach for R-hat, posterior predictive checks, LOO-CV. None of them help here.

**Convergence diagnostics** are silent by construction. Both models are well-specified and mix cleanly. A clean fit is evidence that the sampler worked, not that the family is right.

**Posterior predictive checks** pass both. They must — the two families produce nearly identical predictive distributions on the observed spend path. That's what "observationally equivalent" means.

**LOO-CV is nearly indifferent, and honestly so.** The two families' predictive performance diverges only where future spend departs from historical patterns. A predictive criterion cannot resolve a question the predictions don't encode.

**Priors regularize the wrong thing.** A tight prior on innovation scale does shrink toward a constant $\beta$, but that's a belief about drift, not evidence about it. Two teams with different priors get confidently different answers from identical data, and neither posterior is wide enough to reveal that this happened.

The one diagnostic worth running is to **compare decisions, not fits**. If the marginal-to-average ROAS ratio, the recommended budget direction, and the "is this channel dying" verdict all move materially between two specifications with indistinguishable R², you haven't learned which is right. You've learned your data doesn't contain the answer — which is a finding, and one that should be reported.

## What breaks the tie

The aliasing is an identification problem, not an estimation problem. More data of the same kind doesn't help; better samplers don't help. The fix has to come from the design of the data.

The two families differ precisely in what they predict under spend schedules the historical window never visited. So the resolution is to go visit one. Dew, Padilla and Shchetkina (2024) reach the same conclusion: the conflation is avoided by designing experiments that manipulate spending in ways that pin down model form.

Two requirements, and they're independent:

1. **Distinct spend levels.** You learn the shape of $S$ by observing the response at several points along it. One on/off contrast identifies a coefficient at a point; it doesn't identify the curve.
2. **Dwell time above the adstock washout.** A channel with retention $\alpha$ needs roughly $\ln(0.05)/\ln(\alpha)$ weeks to wash out to 5%: about 9 weeks at $\alpha = 0.7$, 14 at $\alpha = 0.8$. Block length shorter than that and adstock smooths away most of the designed contrast before it reaches the response curve — the same arithmetic that governs [spacing sequential geo tests](/posts/closing-the-loop-mmm-calibration/).

In `mmm-framework`, `planning.design.flighting_design(levels=…, block_weeks=…)` generates a budget-neutral schedule, and `planning.identification.structural_identification` scores how much a candidate schedule would contract the saturation parameter posterior. It refuses to claim the saturation curve is identified unless the design offers at least three distinct in-support spend levels.

A budget-neutral multi-level schedule is the cheapest instrument available: it doesn't change the annual budget, just the distribution across weeks. The cost is real — flighting through low weeks sacrifices some contribution during those weeks — but it's a short-term cost paid for a long-term identification gain. Price it honestly rather than waving it through as free.

One more heuristic worth running: check the autocorrelation of your adstocked regressors before you trust any response curve. A channel whose adstocked series sits above $\rho \approx 0.8$ should be treated as having a prior-driven saturation estimate until an experiment says otherwise. And a falling $\beta_t$ trajectory plotted next to a rising spend plan should be labeled as a secant-slope trajectory — not creative wear-out — unless the fade is tied to something real like a creative change or a competitive entry.

The model will give you a saturation curve either way. The question is whether it earned that shape or whether adstock handed it to you for free.

---

_Source material: [`mmm-framework`](https://github.com/redam94/mmm-framework) docs (blog-saturation-or-fatigue.html), and Dew, Padilla & Shchetkina (2024), "Your MMM is Broken: Identification of Nonlinear and Time-varying Effects in Marketing Mix Models," arXiv:2408.07678. Related posts: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/) (the within-family ridge — a different problem), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Closing the Loop: MMM Calibration with Experiments](/posts/closing-the-loop-mmm-calibration/)._
