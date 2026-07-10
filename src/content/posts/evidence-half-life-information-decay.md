---
title: "Your Evidence Has a Half-Life"
author: Matthew Reda
pubDatetime: 2026-07-10T13:16:11Z
slug: evidence-half-life-information-decay
draft: true
tags:
  - bayesian
  - experimental-design
  - marketing-mix-modeling
  - statistics
description: A Bayesian model treats all historical data equally — which is correct in a static world and quietly wrong in a drifting one. Here's how to detect when old evidence has gone stale and what to do about it.
---

One thing I find quietly unsettling about long-running Bayesian experiments is how the system can be simultaneously correct and wrong. Correct in the sense that the sampler converged, the posteriors are narrow, the stopping rule says you're done. Wrong in the sense that the world moved while you were learning about the old one.

This came up sharply in the [gap-by-gap audit](https://redam94.github.io/mmm-framework/continuous-learning-math.html) of the Augur continuous-learning loop: one of the failure modes we had to document and guard against is that a loop refitting on all accumulated data with equal weight will, under drift, produce posteriors that are narrow AND wrong — a time-averaged view of the response curves delivered with the confidence of a large-$n$ estimate. The result looks like a healthy system. The $\hat{R}$ is fine. ENBS says stop. And the posterior is learning about a media landscape that no longer exists.

## The static model's silent failure

The standard Bayesian loop works by updating: after each wave, the posterior over all data so far becomes the prior for the next design,

$$p(\theta \mid h_t) \;\propto\; p(\theta)\prod_{k=1}^{t} p(y_k \mid \theta, \xi_k).$$

This is exactly right when $\theta$ is stable. Every wave borrows strength from the last; information accumulates coherently. The problem arrives when the true parameter $\theta_t$ drifts between waves — audiences shift, creative fatigues, a competitor enters. Then the likelihood terms on the right are products of observations from different parameter regimes. The posterior converges, but to a weighted average of those regimes, with the interval shrinking like $1/\sqrt{t}$ even as the truth moves away from the center.

The tell is expected regret. In a converging system, $\mathbb{E}[\text{regret}] = \mathbb{E}_\theta[v(a^\star(\theta), \theta) - v(\bar{a}, \theta)]$ should shrink toward zero across waves: as the posterior tightens, there's less profit on the table from parameter uncertainty. Under drift, it doesn't. The loop keeps seeing a wide spread of optimal allocations across posterior draws because the underlying parameter keeps moving. ENBS stays positive; the system keeps scheduling re-tests. This is, surprisingly, the correct behavior — the stopping rule is flagging the right thing even though it can't name the cause.

## Measuring staleness

The practical question is how to put a number on the decay rate. The `estimate_half_life` function in the framework does this with a simple moment estimator. Between consecutive waves $t$ and $t + \Delta t$, you have a before-wave posterior $(\mu_t, \sigma_t^2)$ and an after-wave posterior $(\mu_{t+1}, \sigma_{t+1}^2)$. The drift — the shift in the posterior mean — should look like:

$$\mathbb{E}\!\left[\left(\frac{\mu_{t+1} - \mu_t}{\sigma_t}\right)^{\!2}\right] = e^{\lambda \Delta t} - 1,$$

where $\lambda = \ln 2 / h$ is the decay rate and $h$ is the half-life (in weeks). If $\theta$ is genuinely stable, the expected scaled drift is zero; each wave's mean shift is just sampling noise, and $\hat\lambda \approx 0$ recovers full pooling. If $\theta$ is drifting at rate $\lambda$, the squared normalized shifts grow exponentially in the inter-wave gap.

Invert that: collect the per-parameter, per-wave $(|\text{shift}|, \sigma, \Delta t)$ triples, and solve for $\hat\lambda$. The half-life is $h = \ln 2 / \hat\lambda$. A model-free, two-number summary of how fast your posterior mean moves relative to its own uncertainty.

## The fix: discounting old evidence

Once you have an estimate of $h$, you can downweight old observations by inflating their observation noise:

$$\text{scale}(r) = \exp\!\bigl(0.5 \cdot \lambda \cdot \text{age}(r)\bigr),$$

where age is measured in weeks from the most recent row. In practice this means passing `discount_half_life=h` to the model's fit call. Newer observations count at full weight; older ones at reduced weight; the effective sample size saturates at $\sum_r \exp(-\lambda \cdot \text{age}(r))$ rather than growing without bound. The posterior keeps an honest variance floor and tracks the current regime instead of averaging over all past regimes.

Under genuine drift, discounting lets the expected regret behave correctly: it stops shrinking to zero, and ENBS keeps scheduling re-tests at the right cadence. Under a stable world ($\hat\lambda \approx 0$), discounting vanishes and you recover the full-pooling behavior. You don't have to commit in advance to which world you're in.

## Why not just the DLM?

The principled long-run alternative is a dynamic linear model (DLM) — explicitly tracking $\theta_t$ as a random walk rather than treating it as fixed. The West–Harrison DLM with a discount construction is exactly what likelihood discounting approximates in the static limit. The connection is tight: if you set $W_t = \frac{1-\delta}{\delta} C_{t-1}$ with $\delta = e^{-\lambda}$, the DLM Kalman update and the discounted static fit converge to the same expression at each wave (Ljung & Söderström 1983).

The DLM is the principled successor when you need a reportable trajectory — $\beta_t$ with time-resolved bands — rather than a recency-weighted estimate of "now." It also admits better inference: conditional on the activation shapes, the surface is linear in the time-varying effects, and the Kalman filter gives exact posteriors without MCMC for that block (Rao-Blackwellisation). For most current programs, discounting is the right starting point because the DLM adds implementation cost before you've established that drift is real and material.

## The practical checklist

Before concluding that a long-running program has "learned enough" and the ENBS is right to fire:

1. **Watch the regret trend.** If $\mathbb{E}[\text{regret}]$ is still oscillating rather than trending toward zero, drift is a plausible explanation before misspecification is.
2. **Compute the half-life.** Collect the per-wave posterior-mean shifts and run the moment estimator. If $h$ is in the range of a few months, evidence from two years ago is contributing at $2^{-24/h}$ relative weight — which may be near zero.
3. **Compare static vs. discounted fits.** If the posterior means shift materially when you switch on discounting, the old evidence was pulling the static fit off the current truth.
4. **Use `stop_patience=2`.** Two consecutive ENBS $\leq 0$ waves, not one, before halting. A single wave in a drifting world can be temporarily overconfident for the same reason misspecification can be: the model thinks it knows the answer, and the intervals are too tight to see the problem.

The uncomfortable version of this: a campaign that "worked" two years ago and a campaign that "works" today may have genuinely different response curves. The evidence accumulated from the old campaign is not wrong — it's just stale. Treating it as fully informative is a form of the same error as ignoring it completely. The half-life is the number that mediates that trade-off, and estimating it from the data is more honest than assuming it's infinite.

---

_The `estimate_half_life`, `discount_half_life`, and `run_closed_loop(stop_patience=N)` functions described here are in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `continuous_learning`. The West–Harrison DLM connection is formalized in West & Harrison (1997), §6.3, and in Ljung & Söderström (1983) on forgetting-factor RLS. Related posts: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [The Sequential-Stopping Worry Is a Frequentist Problem](/posts/bayesian-sequential-stopping-likelihood-principle/), [Simulation-Based Calibration](/posts/simulation-based-calibration/)._
