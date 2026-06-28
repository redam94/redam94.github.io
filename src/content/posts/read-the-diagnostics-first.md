---
title: "Read the Diagnostics First"
author: Matthew Reda
pubDatetime: 2026-06-28T13:06:04Z
slug: read-the-diagnostics-first
draft: true
tags:
  - bayesian
  - pymc
  - statistics
  - marketing-mix-modeling
description: R-hat, ESS, and divergences are not bureaucratic hurdles before you report a ROAS — they're the sampler telling you whether its output is valid. Here's what each one actually measures and what it reveals when it fails.
---

I have a rule I've kept since graduate school: if $\hat{R}$, ESS, or divergences fail, I do not report the number. Not "I add a caveat." I throw the result out and fix the model. The discipline sounds easy until you have a client presentation in three hours and the number looks plausible. That's exactly when it matters most.

The rule exists because MCMC output is not automatically a valid posterior sample. The algorithm can converge to the wrong place, mix badly between regions of the posterior, or fail to explore the tails — and every one of those failures produces a number you can put in a table. The diagnostics exist to catch the failure before the table reaches anyone who will act on it.

This post is a tour of the three diagnostics I check on every fit: $\hat{R}$, ESS, and divergences. What they actually measure, why each one fails in marketing models specifically, and what the failure usually means about the model rather than the sampler.

## $\hat{R}$: between-chain versus within-chain variance

The idea behind $\hat{R}$ (potential scale reduction factor) is simple. You run several chains from different starting points. If they've all converged to the same distribution, the variance of the parameter across chains should look like the variance within any one chain. If the chains are exploring different parts of the parameter space, between-chain variance is inflated relative to within-chain variance and $\hat{R} > 1$.

The old formula had a flaw: it only compared chains, not the early and late halves of each chain. A chain that is slowly drifting upward can look deceptively similar to other slowly-drifting chains. The fix — in Vehtari et al. (2021) and what ArviZ now computes — is the **split-$\hat{R}$**: split each chain in half, treat the halves as four (or more) pseudo-chains, and run the comparison on rank-normalized versions of all of them. Rank normalization handles pathological posteriors where the distribution is heavy-tailed enough that the ratio of variances loses meaning.

In practice: $\hat{R} < 1.01$ across all parameters. The old threshold of 1.1 is too permissive; with modern samplers and typical run lengths you should expect much closer to 1.

In an MMM, the parameters that most often push $\hat{R}$ above threshold are the adstock and saturation ones. The retention rate $\alpha$ and the half-saturation $\kappa$ are weakly identified on short, correlated time series — the posterior can be genuinely multimodal, with the sampler occasionally locking into one mode and refusing to cross the low-density valley to the other. An $\hat{R} > 1.01$ on an adstock parameter is usually the model telling you that your prior isn't tight enough to resolve the identification problem the data can't solve on its own. The answer is not to rerun with more samples. It's to review the prior.

## ESS: how many independent samples do you actually have?

Sequential MCMC draws are autocorrelated. The sample at step $t$ is similar to the sample at step $t-1$, so two thousand correlated draws carry less information than two thousand independent ones. Effective sample size (ESS) is the number of independent draws that would give the same estimation precision as your actual chain.

There are two versions you should check:

- **Bulk ESS** — precision in the center of the distribution. Governs how well you know the posterior mean, and roughly how reliable the 50% interval is.
- **Tail ESS** — precision in the tails. Governs the quality of HDIs, which is almost always what you're reporting.

Tail ESS is the one people ignore and the one that matters most for intervals. A model can have bulk ESS of 2000 and tail ESS of 60, which means your 94% HDI is estimated from the equivalent of 60 independent samples. That's not an interval; it's a rough sketch.

ArviZ's `az.summary()` reports both:

```python
import arviz as az

trace = model.fit(draws=2000, tune=1000, chains=4)
summary = az.summary(trace, hdi_prob=0.94)
# columns: mean, sd, hdi_3%, hdi_97%, mcse_mean, mcse_sd, ess_bulk, ess_tail, r_hat
print(summary[summary["ess_tail"] < 400])
```

The `ess_tail < 400` filter is a reasonable default alarm. If any parameter triggers it, you're not done sampling — or the geometry of the posterior is making the sampler work very hard. Long autocorrelation in an MMM is usually a sign of near-collinearity between media channels or between a channel and a control variable. The sampler is wandering because the posterior ridge runs diagonally and each step moves slowly along it. Diagnosing which parameters co-move tells you where to look.

## Divergences: the sampler hitting a wall

Hamiltonian Monte Carlo (HMC) and NUTS — which is what PyMC uses by default — explore the posterior by simulating a particle rolling around the log-probability surface. The simulation uses a fixed step size. When the surface curves sharply enough that the step overshoots and the simulated energy strays too far from the true energy, the transition is flagged as **divergent** and discarded.

Here's the crucial point: a divergent transition is _not_ a rejected proposal in the usual Metropolis-Hastings sense. It's a signal that the numerical integrator has failed, which means the trajectory that led there may have passed through regions of high posterior mass that the sampler is now refusing to count. The distribution of accepted samples after discarding divergences is not the posterior — it's some biased shadow of it. Even one divergence is a warning. Ten divergences during warmup is almost certainly fine; ten divergences in the post-warmup draws is a problem.

In PyMC, divergences show up in the trace object:

```python
# Number of divergences after warmup
n_divergent = trace.sample_stats["diverging"].values.sum()
print(f"Divergences: {n_divergent}")

# Pairplot to find where they cluster
az.plot_pair(trace, divergences=True, var_names=["alpha", "lam"])
```

The pairplot is the diagnostic I reach for first. Divergences cluster. They appear in a band or a corner of the parameter space — almost always the same corner — and that location tells you exactly what the problem is. In a hierarchical MMM with partial pooling across DMAs, divergences clustering near $\tau \approx 0$ (the group-level standard deviation) are the classic symptom of a funnel geometry. The model is trying to simultaneously be "there's no variation across geos" and "here's each geo's deviation," and the sampler can't navigate the narrow throat of the funnel with a fixed step size.

The canonical fix is **non-centered parameterization**:

```python
# Centered (prone to divergences in hierarchical models):
alpha_geo = pm.Normal("alpha_geo", mu=mu_alpha, sigma=tau, shape=n_geos)

# Non-centered (reparameterize so the sampler explores a simpler geometry):
alpha_offset = pm.Normal("alpha_offset", mu=0, sigma=1, shape=n_geos)
alpha_geo = pm.Deterministic("alpha_geo", mu_alpha + tau * alpha_offset)
```

Same model, different parameterization, flat geometry for the sampler. This is the most common fix for divergence problems in marketing models with multiple geographies or product hierarchies.

## What the diagnostics reveal about the model

The frame I find most useful: diagnostics are information about your model, not complaints about your sampler. A sampler that runs perfectly fine on a well-specified model and then throws divergences on yours is not having a bad day. It has found something genuinely difficult about the posterior, and the difficult thing is usually informative.

- **$\hat{R}$ fails** → multimodal or barely-identified posterior, often from an adstock parameter the data can't pin down. Review your prior; tighten it where you have domain knowledge.
- **Tail ESS is low** → slow mixing, often from collinearity or a ridge in the posterior. Check which parameters move together.
- **Divergences cluster** → bad geometry, most often funnel-shaped posteriors from hierarchical priors or extreme curvature from a tight likelihood fighting a diffuse prior. Non-centered parameterization or a better prior.

One thing I want to be clear about, because I've made the opposite mistake: **passing these diagnostics is necessary but not sufficient.** As I wrote in [the generative MMM post](/posts/generative-mmm-honest-iteration/), models that fail attribution badly can show perfectly healthy R-hat, ESS, and zero divergences. The diagnostics guarantee that your samples are a valid draw from _the posterior you specified_. Whether the posterior you specified reflects the causal structure of the world is a separate question, answered by posterior predictive checks and ultimately by experimental validation.

But failing the computational diagnostics — that's a hard stop. A coefficient with $\hat{R} = 1.08$ and tail ESS of 45 is not an estimate with a caveat. It's a number the sampler made up in a region it barely explored. Shipping it to a CFO isn't "reporting with appropriate uncertainty." It's reporting a fiction with confidence.

Run the diagnostics before you read the coefficients. The sampler is trying to tell you something.

---

_Synthesized from Vehtari, Gelman, Simpson, Carpenter & Bürkner (2021), "Rank-Normalization, Folding, and Localization: An Improved $\hat{R}$ for Assessing Convergence of MCMC," Bayesian Analysis 16(2); Betancourt (2017), "A Conceptual Introduction to Hamiltonian Monte Carlo," arXiv:1701.02434; and the ArviZ documentation on MCMC convergence diagnostics. Related: [Generative MMM and Honest Iteration](/posts/generative-mmm-honest-iteration/)._
