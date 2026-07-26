---
title: "Three Notions of Coverage and What It Means When They Disagree"
author: Matthew Reda
pubDatetime: 2026-07-26T13:13:38Z
slug: three-coverage-tests-bayesian
draft: true
tags:
  - bayesian
  - statistics
  - marketing-mix-modeling
  - diagnostics
description: "Coverage" has three distinct meanings in a Bayesian MMM workflow. They can give opposite answers for the same model, and the disagreement pattern is more diagnostic than any single number.
---

You fit a Bayesian MMM, run the sampler, and get 90% credible intervals on your channel coefficients. The question is: do those intervals actually contain the true parameter 90% of the time?

The honest answer is: it depends on what you mean by "the true parameter" and "90% of the time." There are three distinct things that sentence can mean, they can give different answers for the same model, and the disagreement pattern is more informative than any single number.

## The three things "coverage" means

**Predictive coverage** asks: when I sample from the posterior predictive distribution and compare to my observed data, do the implied intervals cover what I actually measured? This is what posterior predictive checks measure. It tests whether the model is consistent with the data — necessary, but nowhere near sufficient for anything stronger.

**Engine calibration** (what [simulation-based calibration](/posts/simulation-based-calibration/) tests) asks: if I draw a parameter value from the prior, generate data from the model at that value, and fit the posterior — where does the prior draw land in the posterior's rank distribution? If the answer is uniformly distributed, the inference engine is calibrated in the statistical sense: averaged over the model's own prior, every interval has its nominal coverage.

**Fixed-truth recovery coverage** asks: if I fix the parameters at a specific value $\theta^*$ and simulate many datasets from the model, how often do the fitted posteriors contain $\theta^*$? This is closest to what practitioners usually intend when they ask "does the 90% interval work."

These three are not the same thing. A model can pass all three, or any subset of them.

## When they disagree

The *pattern* of disagreement tells you specifically what's wrong.

**SBC passes, fixed-truth recovery fails.** This is prior–data conflict at a specific $\theta^*$. An informative prior pulls every posterior toward itself. When $\theta^*$ sits in the prior's tail — far from where the prior concentrates probability — the interval is confidently displaced. SBC cannot catch this because it draws truths *from* the prior; a truth the prior disfavors is rarely tested. If you have external evidence (an incrementality test, a meta-analytic estimate) that the true ROAS for a channel sits well below your prior's center, fixed-truth recovery around that value will fail even when SBC looks clean. The fix is to revisit the prior, not the sampler.

**Both pass, but the model misses an external answer key.** You fit on synthetic data with a planted ground truth and the intervals don't cover it — yet SBC rank histograms were flat and fixed-truth recovery passed when using the model's own prior draws as truth. This is structural failure: misspecification, confounding, or estimand mismatch. More data makes this *worse*, not better. The model concentrates on a pseudo-truth and a tighter interval around the wrong value looks like confidence. I documented the confounding version of this failure in [More Data, More Confident, Still Wrong](/posts/more-data-more-confident-still-wrong/) — as sample size grows, coverage on a confounded control variable collapses to zero. The mechanism here is identical; the model thinks it knows, and "knowing" harder is the problem.

**Predictive coverage fine, parameter coverage broken.** The PPCs are clean. The model fits the observed data well. But the decomposition — which channels are responsible for how much — is uncertain in a way the intervals don't admit, or it's systematically wrong. This is the weak-identification pattern: the model captures the marginal data distribution while remaining genuinely uninformed about the latent structure. This is the same failure I described in [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/): good in-sample fit, real ambiguity in the parameter decomposition that only surfaces if you specifically test it. The model fitted the data. It didn't identify the parameters.

## Reading the failure patterns

Here's how I read the patterns in practice:

| Pattern | Diagnosis |
|---|---|
| Low coverage, `z_spread >> 1`, no systematic bias | Approximate fit (MAP or mean-field ADVI). Intervals too narrow. Refit with NUTS. |
| Low coverage, `z_spread >> 1`, large bias | Prior–data conflict. The prior is centered away from where the data points. |
| Good self-simulation coverage, bad against external truth | Structural: misspecification or confounding. More data won't help. |
| ~100% coverage, `z_spread << 1` | Conservative. Weak identification. Intervals are honest but too wide to act on. |

Here `z_spread` is the standard deviation of `(posterior mean − θ*) / posterior sd` across repeated simulations. If it's near 1, the intervals are appropriately wide; much above 1 means they're overconfident; well below 1 means you're being overly conservative.

The last row is often treated as a success. In the statistical sense it's not a failure, but intervals so wide that every allocation looks equally plausible aren't useful for decisions. The right response is to collect better data — dark periods to identify adstock, spend-level variation to identify saturation, or experimental calibration to anchor the coefficient level.

## Running this in the `mmm-framework`

The framework's diagnostics module has three tools that map directly to the three notions:

```python
from mmm_framework.diagnostics import (
    run_posterior_predictive_checks,   # predictive coverage
    run_calibration_check,             # engine calibration / SBC
    run_recovery_coverage,             # fixed-truth recovery
)

# Check whether intervals cover the posterior mean in repeated simulations
cov = run_recovery_coverage(model, truth="posterior_mean", n_sims=40)
print(cov.summary())   # per-parameter coverage at 50/80/90/95% with Monte Carlo intervals
cov.worst()            # the target with the lowest 90% coverage
```

The `summary()` output gives empirical coverage rates alongside a bias-vs-width decomposition. The pattern in those two numbers almost always points at a specific failure mode — and "90% HDI covered the truth 50% of the time" is an unambiguous finding, not a rounding issue, at `n_sims=40` (the probability of getting that result by chance at true 90% coverage is around $10^{-8}$).

## What this changes about the workflow

Run all three checks, and understand what each one is — and is not — certifying:

1. **Prior predictive** — before fitting. Does the model generate plausible data?
2. **SBC** — on the architecture. Does the inference engine recover parameters from self-generated data?
3. **Fixed-truth recovery** — at parameter values you actually care about. Do the intervals work *there*, not just averaged over the prior?
4. **Posterior predictive** — after fitting. Is the fitted model consistent with the real data?
5. **External calibration** — against holdout experiments or synthetic ground truth with a planted answer key.

A clean SBC is not a substitute for external calibration. A clean PPC is not a substitute for SBC. They're asking genuinely different questions, and each can fail in a way the others won't catch.

The number I watch most carefully: if a 90% credible interval covers the truth fewer than 70% of the time in a fixed-truth recovery test at the posterior mean, I treat it the same way I treat an $\hat{R}$ above 1.01 — [a hard stop before the results leave my screen](/posts/read-the-diagnostics-first/). The posterior *looks* like a posterior. It's just not landing where it should. That's worth understanding before you present a channel decomposition to anyone.

---

*Source: the diagnostics framework in `mmm_framework.diagnostics.coverage` and `mmm_framework.diagnostics.sbc`, documented in `technical-docs/coverage-diagnostics.md` in the [`mmm-framework`](https://github.com/redam94/mmm-framework) repo. Related: [Simulation-Based Calibration](/posts/simulation-based-calibration/), [Read the Diagnostics First](/posts/read-the-diagnostics-first/), [More Data, More Confident, Still Wrong](/posts/more-data-more-confident-still-wrong/), [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/).*
