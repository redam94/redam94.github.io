---
title: "Bayesian Sequential Stopping Doesn't Need Alpha-Spending"
author: Matthew Reda
pubDatetime: 2026-07-05T13:11:24Z
slug: bayesian-sequential-stopping
draft: true
tags:
  - bayesian
  - statistics
  - measurement
  - experimental-design
description: Checking a Bayesian stopping criterion every week isn't "peeking" in the frequentist sense — the likelihood principle says so. The real sequential-testing risk is model misspecification, and that has a different fix.
---

The concern comes up every time someone sees a loop that checks a stopping criterion every week: isn't that just peeking? Doesn't looking at a test statistic repeatedly inflate your false-positive rate?

For frequentist significance tests, yes. For a Bayesian expected-value stopping rule, no — and the difference is worth being precise about, because getting it wrong either paralyzes a perfectly good adaptive system or, worse, imports a frequentist patch that solves a problem the Bayesian rule doesn't have.

I've been building continuous learning infrastructure for `mmm-framework` — a system called Augur that runs sequential geo experiments, updates a Bayesian response-surface posterior each wave, and stops when the **expected net benefit of sampling (ENBS)** drops to zero or below. A recent technical audit of the math raised the optional-stopping question. The audit's conclusion: it's mostly a misconception, and here's why that distinction matters.

## What the frequentist problem actually is

In a frequentist hypothesis test, you set a threshold $\alpha$ before you start and report a finding when $p < \alpha$. If you allow yourself to check $p$ at every new data point and stop whenever it crosses the threshold, your true false-positive rate explodes — with enough looks, you'll cross $\alpha$ by chance even if the null is true.

Alpha-spending — O'Brien-Fleming corrections, Pocock bounds — allocates your error budget across planned looks so the total probability of a false positive stays bounded. It's the right medicine for that disease.

But ENBS isn't p-value stopping. It isn't a test at all. It's a decision: *is the expected profit from another wave of experiments larger than the wave's cost?*

## The likelihood principle settles it

The relevant principle is old and direct. Edwards, Lindman, and Savage (1963) wrote:

> "The rules governing when data collection stops are irrelevant to data interpretation, and it is entirely appropriate to collect data until a point has been proven or disproven."

The formal statement is the **likelihood principle**: any inference based on a Bayesian posterior depends only on the data actually observed, not on the stopping rule that generated them. Berger and Wolpert's 1988 monograph gives the complete treatment; Rouder (2014) provides simulations that confirm Bayesian posteriors are invariant to the stopping rule in practice.

Why? Frequentist inference is calibrated over the sampling distribution — the probability the statistic would fall in a rejection region under hypothetical repetitions. The stopping rule shapes that distribution. Bayesian inference conditions on observed data via the likelihood $p(y \mid \theta, \xi)$; the stopping rule leaves no fingerprint there, so it leaves no fingerprint on the posterior.

ENBS stops when further sampling has negative expected value given the current posterior. That's a statement about the posterior *as it stands*. It has nothing to do with the distribution of outcomes under alternative stopping rules. Alpha-spending corrects frequentist calibration; it's category-confused when applied to a decision criterion.

## The real danger

That's the clean theoretical result. Here's the honest caveat: **it holds under correct model specification.** If your response-surface model is wrong — wrong functional form, wrong prior, stationarity violated mid-wave — the posterior isn't *the* posterior. It's a well-computed answer to the wrong question.

Augur's own misspecification study makes this concrete. A single-Hill surface fit to a mixture-saturation data-generating process produces narrow credible intervals that cover the true parameter only some of the time. In that setting, ENBS can signal "we're done" when the model is confident but not calibrated. The likelihood principle insulates you from alpha-spending problems; it doesn't insulate you from model error.

Two practical guards follow directly.

**Check the surrogate.** Augur's operational path replaces expensive Monte Carlo EIG with a closed-form Laplace approximation: $\tfrac12 \log\det\Sigma_{\text{prior}} - \log\det\Sigma_{\text{post}}$. This is fast but introduces error wherever the posterior is non-Gaussian — negative-synergy ridges, skewed saturation parameters, channels with almost no spend variation. The **Pareto-$\hat k$** diagnostic (Vehtari et al., 2024) is the right runtime check: use the Gaussian surrogate as an importance proposal against the NUTS posterior, and read off $\hat k$. If $\hat k \geq 0.7$, the surrogate is unreliable and the wave's acquisition decision should fall back to the NUTS-refit knowledge gradient.

```python
import arviz as az

# log_weights: log p_nuts(theta) - log q_gaussian(theta) for posterior draws
log_weights = log_nuts_density - log_gaussian_density
_, k_hat = az.psislw(log_weights)

if k_hat >= 0.7:
    # surrogate ordering unreliable — fall back to NUTS-refit KG for this wave
    kg_value = planner.knowledge_gradient(post, candidate_wave, B, value, refit_fn)
```

**Require consecutive stops.** If ENBS $\leq 0$ appears in one wave but the model might be misspecified, treat it the way you'd treat $\hat R$ barely above 1.01: a flag worth investigating, not a verdict. Requiring two consecutive ENBS $\leq 0$ waves is a low-cost robustness guard. It mostly costs one extra wave on the marginal case — a small price against stopping a learning loop prematurely because the model briefly got overconfident.

If you need a frequentist guarantee on the stopping decision — a bounded false-stop rate — the right tool isn't alpha-spending but an **anytime-valid confidence sequence** (Ramdas et al., 2023). These are continuously monitorable bounds that hold at any stopping time by design, not through budget allocation. They're the correct frequentist construction for sequential peeking, and they don't require you to pre-commit a number of looks.

## The broader pattern

The optional-stopping misconception belongs to a wider family: frequentist concerns imported into Bayesian settings where they don't belong. The concern isn't wrong in its original context — alpha-spending really does fix the peeking problem for $p$-values. Misapplying it to a decision rule leads you to over-engineer a solution to a problem you don't have, while potentially under-attending to the problems you do.

The real sequential-testing risks in a system like Augur are model misspecification and surrogate failure. Both are diagnosable — posterior predictive checks, [SBC](/posts/simulation-based-calibration/), Pareto-$\hat k$ monitoring — and both have concrete fixes that have nothing to do with alpha-spending.

The likelihood principle gives you freedom. Calibration is what earns it.

---

_Grounded in the technical audit of Augur's continuous-learning math (`redam94/mmm-framework`, July 2026). Key references: Edwards, Lindman & Savage (1963), "Bayesian statistical inference for psychological research," Psychological Review 70(3); Berger & Wolpert (1988), The Likelihood Principle, 2nd ed., IMS Lecture Notes–Monograph Series 6; Rouder (2014), "Optional stopping: No problem for Bayesians," Psychonomic Bulletin & Review 21(2); Ramdas, Grünwald, Vovk & Shafer (2023), "Game-Theoretic Statistics and Safe Anytime-Valid Inference," Statistical Science 38(4); Vehtari, Simpson, Gelman, Yao & Gabry (2024), "Pareto Smoothed Importance Sampling," JMLR. Related: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Simulation-Based Calibration](/posts/simulation-based-calibration/), [Read the Diagnostics First](/posts/read-the-diagnostics-first/)._
