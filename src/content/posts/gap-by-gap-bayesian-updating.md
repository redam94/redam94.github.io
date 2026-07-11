---
title: "The Gap-by-Gap Update: How Augur's Continuous-Learning Loop Stays Current"
author: Matthew Reda
pubDatetime: 2026-07-11T13:11:08Z
slug: gap-by-gap-bayesian-updating
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - measurement
description: When an MMM runs in production, new data arrives every week. The math of incorporating each new "gap" of data — without overfitting to it, without forgetting what came before, and without a full refit — is the core of Augur's continuous-learning design.
---

The [sequential-stopping post](/posts/bayesian-sequential-stopping-likelihood-principle/) covers when the Augur loop decides to run another geo experiment. The [closing-the-loop post](/posts/closing-the-loop-mmm-calibration/) covers how an experiment's result gets folded back in as a prior. Neither covers what happens between experiments — when new observational data arrives week after week and the model just needs to stay current. That's what this post is about.

## The gap problem

An MMM in production isn't fit once. Every period — every week, every month — another row of data lands: new media spend, new sales, new covariates. You have choices about what to do with it.

**Refit from scratch.** Take all the data up to now, run the full MCMC, replace the old posterior. This is always correct. It's also expensive. A production MMM with a couple of years of weekly data and decent convergence requirements takes 10–30 minutes to fit. Doing that every week is a significant compute budget, and it means the model is always a week stale while the fit runs.

**Posterior-as-prior update.** Use last period's posterior as the prior for this period's fit. Add only the new data to the likelihood. This is the sequential Bayesian update and it's mathematically equivalent to the full refit — *under one condition I'll get to in a moment*.

The second option is what Augur uses between experiment waves, and it's the approach I'll dig into here.

## The math of a single gap

Say you've fit through week $T-1$. The joint posterior over your model parameters $\theta$ — adstock rates, saturation curves, channel coefficients, baseline — is $p(\theta \mid y_{1:T-1})$. Week $T$ produces data $y_T$. The update is just Bayes:

$$p(\theta \mid y_{1:T}) = \frac{p(y_T \mid \theta)\, p(\theta \mid y_{1:T-1})}{p(y_T \mid y_{1:T-1})}$$

The denominator is a normalizing constant. The right-hand side says: the old posterior is the new prior, and the new likelihood $p(y_T \mid \theta)$ sharpens it. Nothing surprising. The key insight is that the likelihood of the new week's data is a function only of the model parameters and that week's inputs — there's no interaction with older observations once you've absorbed them into the posterior. This is the **Markov property of the sequential update**: history is captured by the current posterior, not by the raw data.

In the Gaussian linear case this simplifies to a precision-additive update (the same one from [closing-the-loop](/posts/closing-the-loop-mmm-calibration/)). For the full nonlinear MMM with adstock and saturation, there's no closed form, but you can approximate it: use the previous posterior draws as a particle filter, reweight by $p(y_T \mid \theta^{(s)})$ for each particle $s$, and resample.

## The condition it fails: parameter drift

Here's the condition I deferred. The sequential update is equivalent to a full refit *when the model is stationary* — when the data-generating process at week $T$ is governed by the same $\theta$ as at week $T-1$.

That is often not true in marketing. Brand equity shifts. Creative effectiveness decays. A competitor enters. Price elasticity changes. The "true" ROAS for paid search this quarter is not the "true" ROAS from two years ago, and a posterior that contains the full history of stationary data is going to be much too confident — it will have pooled two years of evidence into a tight interval around a value that has since moved.

This is the **gap problem** properly stated: each new period is a gap in the assumption of stationarity.

The fix is to model the drift explicitly. Instead of treating $\theta$ as fixed across time, treat it as a random walk:

$$\theta_t = \theta_{t-1} + \eta_t, \qquad \eta_t \sim \mathcal{N}(0,\, Q)$$

where $Q$ is the **drift covariance** — a hyperparameter that says how fast the parameters wander. The gap-by-gap update then follows a Kalman-filter-like logic:

1. **Predict** (inflate the posterior by the drift): take $p(\theta \mid y_{1:T-1})$ and convolve it with $\mathcal{N}(0, Q)$. This widens the distribution to account for the drift that happened between $T-1$ and $T$:

   $$p(\theta_T \mid y_{1:T-1}) = \int p(\theta_T \mid \theta_{T-1})\, p(\theta_{T-1} \mid y_{1:T-1})\, d\theta_{T-1}$$

2. **Update** (sharpen by the new observation): apply the Bayes step from the previous section using the prediction-inflated prior.

The drift covariance $Q$ controls the memory of the model. A small $Q$ (slow drift) means old data is heavily weighted and the model changes slowly. A large $Q$ (fast drift) means recent data dominates and the model forgets quickly. Setting $Q$ is a modeling decision that has to be grounded in domain knowledge — "how fast do ROAS values actually change in this category?" — or, better, learned from held-out periods by cross-validating prediction accuracy.

## Why this matters for ENBS

The Augur stopping rule ([covered here](/posts/bayesian-sequential-stopping-likelihood-principle/)) fires when

$$\text{ENBS}(\xi) = \mathbb{E}[\text{regret}] \cdot \text{margin} \cdot \text{population} - \text{cost}(\xi) \leq 0$$

The expected regret term depends on the posterior's spread over optimal allocations. If the gap-by-gap update doesn't inflate the posterior by the drift term, the posterior is artificially tight — and ENBS fires prematurely. The model "knows" the ROAS with false confidence, stops running experiments, and then makes allocation decisions based on stale parameters it thinks are fresh.

This is the failure mode the gap-by-gap audit is designed to catch: **ENBS going to zero for the wrong reason**. Not because you've genuinely converged, but because the drift inflation wasn't applied and the posterior quietly shrank to false precision.

The practical check is to monitor the posterior predictive error on the most recent few periods separately from the full-sample fit. If the model fits historical data well but the most recent weeks are consistently off, parameters have drifted and $Q$ is too small.

```python
# Rough sketch of the gap-by-gap update step in Augur
def gap_update(posterior_draws: np.ndarray, new_data: dict, Q: np.ndarray) -> np.ndarray:
    """
    posterior_draws: (S, D) array of S samples over D parameters from previous period
    new_data: dict of week-T inputs and observed outcome
    Q: (D, D) drift covariance
    """
    # Step 1: predict — inflate each draw by drift noise
    drift = np.random.multivariate_normal(np.zeros(Q.shape[0]), Q, size=posterior_draws.shape[0])
    predicted_draws = posterior_draws + drift

    # Step 2: update — reweight by likelihood of new observation under each draw
    log_weights = np.array([log_likelihood(theta, new_data) for theta in predicted_draws])
    log_weights -= log_weights.max()  # numerical stability
    weights = np.exp(log_weights)
    weights /= weights.sum()

    # Resample (systematic resampling keeps particle diversity)
    indices = systematic_resample(weights)
    return predicted_draws[indices]
```

This is a bootstrap particle filter step. In practice, Augur's full update also handles the adstock state — the carry-forward of media spend from previous weeks — which is itself a latent variable that gets propagated through the gap, not just the static parameters.

## The three numbers you need to set

Operationally, the gap-by-gap update requires three things you have to decide in advance:

1. **The drift covariance $Q$**. Per-parameter diffusion rates. For stable parameters like baseline and seasonality, this is small. For dynamic parameters like channel ROI, it should reflect the empirical rate of change observed in hold-out validation or from historical refits.

2. **The resampling schedule**. After reweighting, particle degeneracy accumulates — a handful of particles end up with all the weight and the approximation collapses. Resample whenever the effective sample size (ESS $= 1 / \sum_s w_s^2$) drops below a threshold, typically 50% of the total particle count.

3. **The full-refit interval**. Even with a well-tuned particle filter, periodic full refits are worth running to guard against accumulated approximation error. Augur uses full refits at experiment wave boundaries (when a new geo result is being incorporated anyway), rather than on a fixed calendar — because that's when the posterior is most likely to have shifted significantly.

## The payoff

The gap-by-gap update is what makes "continuous learning" mean something more than "we refit it a lot." It's the mechanism that keeps the model honest between experiments — propagating belief updates from weekly data, accounting for parameter drift, and keeping the ENBS stopping rule correctly calibrated. Without it, the calibration loop from [closing-the-loop](/posts/closing-the-loop-mmm-calibration/) degrades: the experiments still run and update the priors, but the model's confidence between waves reflects yesterday's market, not today's.

The audit is straightforward in practice: for each gap, check that (1) the drift inflation happened, (2) ESS stayed above threshold, and (3) the posterior predictive error on recent periods is in line with older periods. If recent periods are systematically worse, the drift term needs to be larger. If ESS collapsed, you need to resample more aggressively. Both failures are visible in the diagnostics; neither requires a full re-derivation to catch.

This is the unsexy part of the continuous-learning loop that doesn't make it into the high-level description. The experiments are the story. The gap-by-gap update is the plumbing. Both have to work.

---

*The ENBS stopping rule is in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `planner.expected_regret`. The gap-by-gap update builds on work in particle filtering (Doucet & Johansen, 2011, "A Tutorial on Particle Filtering and Smoothing") and sequential Bayesian updating (Raftery et al., 2010, "Online Prediction Under Model Uncertainty via Dynamic Model Averaging"). Related posts: [The Sequential-Stopping Worry Is a Frequentist Problem](/posts/bayesian-sequential-stopping-likelihood-principle/), [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/), [Simulation-Based Calibration](/posts/simulation-based-calibration/).*
