---
title: "The Gaussian Surrogate Problem in Bayesian Experimental Design"
author: Matthew Reda
pubDatetime: 2026-08-12T13:31:49Z
slug: laplace-eig-approximation-boed
draft: true
tags:
  - bayesian
  - experimental-design
  - information-theory
  - marketing-mix-modeling
description: The nested Monte Carlo estimator for expected information gain comes with a documented O(1/M) bias. The Laplace closed-form surrogate that replaces it does not — but it has one too.
---

In an [earlier post](/posts/designing-experiments-to-maximize-information/) I wrote about the arc from Lindley's 1956 objective to policies that design experiments in real time. The villain of that arc is the nested expectation at the heart of expected information gain (EIG): the marginal likelihood $p(y \mid \xi)$ sits inside a log, requiring an inner Monte Carlo that makes the whole estimator biased at rate $O(1/M)$ — and when you optimally split a compute budget $C = NM$ across outer and inner samples, you're stuck with mean-squared error converging at $O(C^{-1/3})$ rather than the ordinary $O(C^{-1/2})$.

That's the problem the [Augur continuous-learning loop](https://github.com/redam94/mmm-framework) was designed to escape. Instead of nested Monte Carlo, the framework uses a Gaussian/Laplace approximation of the posterior to get a closed-form EIG:

$$\mathrm{EIG}_{\mathrm{Laplace}}(\xi) = \frac{1}{2}\log\det(\Sigma_{\text{prior}}) - \frac{1}{2}\log\det(\Sigma_{\text{post}}) = \frac{1}{2}\log\det\left(\Sigma_{\text{post}}^{-1}\Sigma_{\text{prior}}\right)$$

The posterior precision under the Laplace linearization is $\Sigma_{\text{post}}^{-1} = \Sigma_{\text{prior}}^{-1} + \Lambda(\xi)$, where $\Lambda(\xi)$ is the Fisher-information matrix of the response surface at the current posterior mean. You compute this once, take the log-determinant, and you have a cheap surrogate for the true EIG. No inner loop, no $C^{-1/3}$ wall.

Here is the thing I noticed while auditing the framework's continuous-learning documentation: the NMC estimator's $O(1/M)$ bias is stated explicitly in the derivation. The Laplace surrogate's error is not stated at all. But it has one.

## What the Laplace error actually is

When you linearize the response surface at the posterior mean $\mu$ and assume the resulting Gaussian approximation is close to the true posterior, you're discarding everything past the second-order Taylor expansion of the log-likelihood. The error in the EIG comes from those higher-order terms — how curved the response surface is away from $\mu$.

The good news is that this error is well-characterized. Long, Scavino, Tempone & Wang (2013) showed that the Laplace EIG error vanishes proportionally to $O(1/M)$ in the effective number of independent measurements $M$ — which in the geo-experiment context is roughly $\sum_c w_c$, the total replication weight across test cells. The bound is smallest exactly where the framework has the most data: many cells, long test windows, large geo panels. In that regime the Gaussian surrogate and the true EIG converge.

The bad news is the mirror image: when $M$ is small, or when the posterior has meaningful skew or multimodality, the error can be large. And there's a specific situation in the channel-interaction model where skew is not just possible but expected: a negative synergy parameter $\gamma_{cc'} < 0$ creates a ridge in the joint posterior of $\beta_c$ and $\gamma_{cc'}$ that the Gaussian approximation can't capture. The closed-form EIG will look fine while the true posterior has a tail the surrogate misses.

## How to detect it

The diagnostic is Pareto-smoothed importance sampling (PSIS), which provides the $\hat{k}$ statistic as a byproduct. The idea: treat the Gaussian surrogate as an importance proposal for the true posterior, and let the PSIS machinery tell you how good the approximation is. If $\hat{k} \leq 0.7$, the surrogate is reliable for the posterior's typical draws; if $\hat{k} \geq 0.7$, the approximation is missing mass in important regions and the EIG number it produces is suspect.

In code this is straightforward once you have the NUTS posterior draws from the current wave:

```python
import arviz as az
import numpy as np
from scipy.stats import multivariate_normal

def surrogate_pareto_k(nuts_draws: np.ndarray, mu: np.ndarray, cov: np.ndarray) -> float:
    """
    Compute PSIS k-hat of the Gaussian surrogate against NUTS draws.
    nuts_draws: (S, D) array of posterior samples
    mu, cov: Gaussian surrogate parameters
    Returns k-hat; flag if >= 0.7.
    """
    log_w = multivariate_normal.logpdf(nuts_draws, mean=mu, cov=cov)
    # az.psislw expects log weights (unnormalized), returns smoothed log-weights and k-hat
    _, k_hat = az.psislw(-log_w)   # negative because az.psislw expects -log q / log p ratio
    return float(k_hat)
```

The NUTS posterior is already computed each wave as part of the knowledge-gradient fallback path. You're not paying extra for the diagnostic — you're using draws you have.

## When it fires, and what to do

The failure mode I'd expect most often in an MMM context is exactly the negative-synergy ridge. Channels like paid search and performance-max share inventory and cannibalize each other's marginal conversions; a posterior over $\gamma_{\text{search, pmax}}$ that's forced to be negative will often have a skewed shape the Gaussian can't represent well. The EIG surrogate will look confident about which experimental design maximizes information, but that confidence may be based on a mischaracterized posterior.

When $\hat{k} \geq 0.7$, the right response is to fall back to the knowledge-gradient acquisition, which prices experimental designs by direct simulation (sampling fantasy outcomes under the posterior and refitting) rather than by the closed-form approximation. This is slower — the knowledge gradient requires a posterior update per fantasy draw — but it doesn't assume the posterior is Gaussian. The fallback path already exists in the framework; the gap was only that no diagnostic told you when to use it.

## The asymmetry is worth fixing

The reason this matters is that the NMC estimator's bias is prominently documented — it's one of the first things stated about it, with exact constants. The Laplace surrogate's error, which is the actual estimator in production, has no analogous statement. That asymmetry is a credibility problem: a framework that's precise about the error of its slow backup but silent about the error of its primary path has its documentation priorities backwards.

The fix is straightforward: state the $O(1/M)$ Laplace error bound alongside the $O(1/M)$ NMC bound, add the $\hat{k}$ diagnostic as a per-wave check, and wire the automatic fallback when it fires. Everything needed — the NUTS draws, the Gaussian fit, the PSIS code — is already in the stack.

---

_The Laplace EIG error bound is from Long, Scavino, Tempone & Wang (2013), "Fast estimation of expected information gains for Bayesian experimental designs based on Laplace approximations," CMAME 259, 24–39; the non-repeatable extension is Long, Motamed & Tempone (2015), arXiv:1502.07873. The PSIS k-hat diagnostic is from Vehtari, Simpson, Gelman, Yao & Gabry (2024), "Pareto Smoothed Importance Sampling," JMLR. This post is informed by a technical audit of the mmm-framework continuous-learning documentation. Related posts: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [The Gap-by-Gap Update](/posts/gap-by-gap-bayesian-updating/), [The Sequential-Stopping Worry Is a Frequentist Problem](/posts/bayesian-sequential-stopping-likelihood-principle/)._
