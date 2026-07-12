---
title: "EIG in Closed Form: The Speed, the Error, and the k̂ Diagnostic"
author: Matthew Reda
pubDatetime: 2026-07-12T13:13:29Z
slug: laplace-eig-khat-diagnostic
draft: true
tags:
  - bayesian
  - experimental-design
  - information-theory
  - marketing-mix-modeling
description: The Augur loop replaces Monte Carlo EIG with a closed-form Laplace surrogate — faster by orders of magnitude, but its approximation error is undocumented. The error is bounded and reassuring, and a one-line k̂ check tells you when to trust it.
---

The Augur continuous-learning loop scores experimental designs without running MCMC per candidate. The mechanism is a closed-form EIG surrogate — half the log-determinant of the prior-to-posterior precision ratio — and it's what makes sequential Bayesian design practical at the cadence of weekly geo experiments. Without it, scoring a dozen candidate wave configurations takes hours. With it, milliseconds.

But there is an asymmetry in how the two EIG estimators are documented. The Monte Carlo estimator (which Augur also ships as a reference implementation) carries an explicit error statement: O(1/M) bias in the number of observations, O(C^{-1/3}) RMSE wall from the nested estimator structure. The Laplace surrogate has no analogous statement anywhere in the math docs. You know exactly how wrong the expensive path is. You don't know how wrong the cheap one is.

This post fills that gap: what the Laplace error actually is, when it is small enough to trust, and the one diagnostic that tells you when the surrogate has drifted too far from the truth.

## The two estimators

Augur's response surface is a Hill-saturated model with cross-channel interaction terms:

$$R(s; \theta) = \sum_c \beta_c f_c(s_c) + \sum_{c < c'} \gamma_{cc'} f_c(s_c) f_{c'}(s_{c'})$$

where $f_c(x) = x^{\alpha_c} / (\kappa_c^{\alpha_c} + x^{\alpha_c})$ is the per-channel Hill activation and $\gamma_{cc'}$ carries the sign of channel synergy or cannibalization.

The **Monte Carlo EIG** (Nested Monte Carlo) is the reference estimator:

$$\widehat{\mathrm{EIG}}(\xi) = \frac{1}{M} \sum_{m=1}^M \log p(y_m \mid \xi, \theta_m) - \log \frac{1}{M} \sum_{m'=1}^M p(y_m \mid \xi, \theta_{m'})$$

This has documented bias O(1/M) and variance O(1/M). It's exact in the limit but requires O(M²) likelihood evaluations — too slow to score many candidate designs per wave.

The **Laplace EIG** linearizes the response surface at the posterior mean $\mu$, treats the posterior as Gaussian, and collapses everything to a matrix determinant:

$$\mathrm{EIG}_{\text{Laplace}}(\xi) = \tfrac{1}{2} \log \det\!\left(I + \Sigma \,\Lambda(\xi)\right)$$

where $\Lambda(\xi) = \sigma^{-2} \sum_c w_c (g_c - \bar{g})(g_c - \bar{g})^\top$ is the Fisher information of the proposed design (with $g_c$ the gradient of $R$ with respect to parameters at each cell center, residualized on the intercept direction). No samples, no inner loop — one matrix multiplication and a determinant. The speed ratio is roughly three to four orders of magnitude.

## The error, and why it is reassuring

Long, Scavino, Tempone & Wang (2013) showed that the Laplace EIG error is O(1/M) in the *effective replication* — the number of independent observations feeding the posterior. In Augur's geo holdout design that is $M = \sum_c w_c$ where $w_c$ is the cell weight (geos × test-weeks per cell). The leading error term is the third-order Taylor remainder of $R$ evaluated at the posterior mean, scaled by the posterior covariance.

The implication is quietly reassuring: the Laplace error and the NMC bias decay at the same rate. Both are O(1/M). The cheap surrogate is most reliable exactly when you have the most data — which is also when design decisions carry the most dollars (later waves, where you are choosing whether to continue testing a high-stakes channel or stop). Long, Motamed & Tempone (2015) extend the bound to non-repeatable experiments closer to the geo holdout structure and confirm the same rate: *"if M is large, the expected information gain can be estimated by Laplace approximation with a diminishing error asymptotically proportional to M⁻¹ ... the error also decreases when the number of [measurement sites] and the measurement time increase."* Replace "measurement sites" with "geos" and the analogy is direct.

The less reassuring implication: in early waves, when M is small and the posterior is wide, both estimators are noisy. The NMC estimator's error is visible and quantified in the docs. The Laplace error is there but undocumented. That asymmetry is the gap worth closing.

## When it fails: posterior geometry

The O(1/M) bound assumes the posterior is *approximately Gaussian* — which is another way of saying the Laplace approximation is good. Three things make it fail.

**Non-linear saturation at the operating point.** The Hill activation is nearly linear at low spend fractions and sharply concave near saturation. If the operating allocation sits on a high-curvature part of the curve, the local linearization driving the Laplace EIG is a poor description of the posterior surface. The fitted posterior can have significant skew; the moment-matched Gaussian misses mass in the tails and mis-estimates the EIG.

**Negative-synergy ridges.** Cannibalization terms ($\gamma_{cc'} < 0$) create a non-log-concave geometry in the posterior: the cross-partial of the log-likelihood changes sign across parameter space, and the Hessian can be indefinite away from the MAP. A Gaussian fit at the MAP misses the ridge structure entirely. The Augur math docs acknowledge that Thompson sampling is non-concave when $\gamma_{cc'} < 0$; that same non-log-concavity is precisely what breaks the Gaussian EIG surrogate.

**Small M, early waves.** With few geos or a short test window, the posterior is wide and its shape is driven as much by the prior as by the data. The Laplace approximation to a prior-dominated posterior has both large absolute error (the quadratic approximation spans a region where the true log-density is highly non-quadratic) and large relative error (high baseline uncertainty means the EIG ranking is noisy regardless of which estimator you use).

## The k̂ diagnostic

The fix is a one-line validity check that uses something already computed every wave: the NUTS posterior samples.

The idea (Vehtari, Simpson, Gelman, Yao & Gabry 2024): use the Gaussian moment-match $q(\theta) = \mathcal{N}(\mu, \Sigma)$ as an importance proposal for the true posterior $p(\theta \mid y)$. Compute Pareto-smoothed importance weights $w_s \propto p(\theta_s) / q(\theta_s)$ for each NUTS draw $\theta_s$. The Pareto-k̂ statistic summarizes whether these weights have a well-behaved tail. If k̂ ≤ 0.7, the Gaussian is a reliable proposal and the closed-form EIG ranking is trustworthy. If k̂ > 0.7, the Gaussian is missing mass — the surrogate is unreliable for this wave.

```python
import numpy as np
from scipy.stats import multivariate_normal
import arviz as az

def check_laplace_surrogate(mcmc, params: list[str]) -> dict:
    """
    Check whether the Gaussian moment-match (Laplace surrogate) is a
    reliable importance proposal for the NUTS posterior.

    k̂ > 0.7 means the closed-form EIG ranking is unreliable;
    fall back to the NUTS-refit knowledge gradient for this wave.
    """
    samples = mcmc.get_samples()
    draws = np.stack(
        [np.array(samples[p]).flatten() for p in params], axis=-1
    )  # shape: (n_draws, n_params)

    mu  = draws.mean(0)
    cov = np.cov(draws.T) + 1e-6 * np.eye(len(params))  # jitter for stability
    log_q = multivariate_normal.logpdf(draws, mean=mu, cov=cov)

    # potential_energy = -log p(θ|y) up to an additive constant
    log_p = -np.array(
        mcmc.get_extra_fields()["potential_energy"]
    ).flatten()

    _, khat = az.psislw(log_p - log_q)
    return {"khat": float(khat), "reliable": float(khat) < 0.7}
```

The NUTS sampler already computes potential energy — that is the negative log-joint — so this adds no extra fitting cost. It runs on the posterior samples you already have.

Run it over the parameters the EIG ranking is most sensitive to: the saturation shape parameters (`kappa`, `alpha`) and the interaction terms where negative synergy is possible. If k̂ clears 0.7 on any of them, the closed-form EIG ordering for that wave should be spot-checked against the NUTS-refit knowledge gradient before committing to the next design.

## What to do when k̂ fires

The check is not a reason to abandon the Laplace surrogate. It is a diagnostic that tells you when to invoke the fallback.

**k̂ ≤ 0.7**: proceed with the closed-form EIG ranking. The Gaussian moment-match is a reliable proposal; the error is in the expected O(1/M) regime.

**k̂ > 0.7**: that wave's posterior geometry is non-Gaussian enough that the surrogate may mis-rank designs. Fall back to the NUTS-refit knowledge gradient for that wave's candidate designs — expensive (one NUTS pass per fantasy), but the fallback should fire rarely and only when it matters.

**k̂ > 0.7 firing repeatedly across consecutive waves**: the posterior is telling you something structural. Most likely you are near a saturation boundary or a strong cannibalization ridge. That is a signal to widen the experimental design (increase `delta`), include the shutoff cells that break β/γ collinearity, or revisit whether the Hill surface is the right response model. Beck, Dia, Espath, Long & Tempone (2018) offer an intermediate option — a Laplace-importance-sampling correction that reduces the systematic error floor while keeping much of the speed advantage — worth considering if the full NUTS-refit KG is too slow for your experimental cadence.

## Making it routine

The diagnostic belongs in the per-wave checklist alongside R̂ and ESS — not as a blocking gate, but as a surfaced flag:

```python
# After fitting each wave's posterior
khat_result = check_laplace_surrogate(
    mcmc, params=["kappa", "alpha"]
)
if not khat_result["reliable"]:
    logger.warning(
        f"Laplace surrogate k̂={khat_result['khat']:.2f}: "
        "EIG ranking may be unreliable. Running KG fallback."
    )
    # invoke NUTS-refit KG for this wave's candidate designs
```

The underlying problem was the asymmetry in documentation: both estimators have O(1/M) error, but only one of them said so. Adding an explicit error statement — *"the Laplace EIG error scales like the third-order Taylor remainder of R about the posterior mean, O(1/M) in the effective geo-week count"* — and shipping the k̂ check as part of standard diagnostics converts a latent assumption into a monitored guarantee.

---

_Source material: gap-by-gap audit of the [Augur Continuous Learning Math](https://github.com/redam94/mmm-framework) documentation (mmm-framework v0.1.0, July 2026), specifically Gaps A and B. Key references: Long, Scavino, Tempone & Wang (2013), "Fast estimation of expected information gains for Bayesian experimental designs based on Laplace approximations," CMAME 259, 24–39; Long, Motamed & Tempone (2015), arXiv:1502.07873; Beck, Dia, Espath, Long & Tempone (2018), CMAME 334, 523–553; Vehtari, Simpson, Gelman, Yao & Gabry (2024), "Pareto Smoothed Importance Sampling," JMLR (arXiv:1507.02646). Related posts: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/), [The Sequential-Stopping Worry Is a Frequentist Problem](/posts/bayesian-sequential-stopping-likelihood-principle/)._
