---
title: "Your Model Converged. Your Inference Is Calibrated. Your Likelihood Might Still Be Wrong."
author: Matthew Reda
pubDatetime: 2026-09-09T13:22:14Z
slug: posterior-predictive-checks-mmm
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - pymc
description: Posterior predictive checks test something neither R-hat nor SBC do — whether the model's generative process actually matches the data. Here's what that looks like in a marketing mix model and why it keeps humbling me.
---

There's a hierarchy of tests I run before trusting a fitted model. [R-hat, ESS, and divergences](/posts/read-the-diagnostics-first/) answer one question: did the sampler converge? [Simulation-Based Calibration](/posts/simulation-based-calibration/) answers a second: does the inference recover parameters correctly when the data comes from the model? Both can pass while a third question goes unasked: **does the model's generative process actually describe how the data was produced?**

That third question is what posterior predictive checks (PPCs) answer, and it's the one I most consistently underinvest in early in a project.

## What PPCs actually test

A PPC asks: if I draw parameters from the posterior and then simulate new data from the likelihood, does that simulated data look like the data I actually observed?

In PyMC this is two lines after sampling:

```python
with model:
    idata = pm.sample(1000, tune=1000, target_accept=0.9)
    pm.sample_posterior_predictive(idata, extend_inferencedata=True)
```

Then:

```python
import arviz as az
az.plot_ppc(idata, observed=True, num_pp_samples=200)
```

The resulting plot overlays the distribution of simulated datasets (thin lines or a shaded band) against the observed data (a thick line). If the generative model is good, they look roughly the same. If the likelihood is misspecified, you'll see systematic differences — and they'll be informative ones.

The key point is what this *doesn't* check. SBC tests whether $p(\theta \mid y)$ correctly recovers $\theta^*$ when $y$ was generated at $\theta^*$. PPCs test whether $p(\tilde{y} \mid \theta)$ — the posterior predictive distribution — matches the actual $y$. The first is about inference correctness. The second is about likelihood correctness. A model can pass SBC and fail PPCs: well-calibrated inference from a misspecified generative process.

## The three failure modes I see most often in MMMs

**Fat tails in the outcome.** Weekly sales data is rarely Gaussian. Promotions create spikes. Stockouts create dips. A Normal likelihood says these tails should be thin. The PPC will show the observed distribution overhanging the simulated one on both ends — the actual data has more extreme weeks than the model thinks it should. The fix is usually a Student-t likelihood:

```python
nu = pm.HalfNormal("nu", sigma=10.0)   # degrees of freedom
sales_obs = pm.StudentT("sales_obs", nu=nu, mu=mu, sigma=sigma, observed=revenue)
```

Two or three degrees of freedom can absorb a lot of promotional variance that a Normal can't. You can check with a targeted PPC:

```python
# Compare observed vs. predicted extreme weeks
obs_max = idata.observed_data["sales_obs"].values.max()
ppc_max = idata.posterior_predictive["sales_obs"].values.max(axis=-1)
print(f"Observed max: {obs_max:.0f}")
print(f"PPC 95th percentile of max: {np.percentile(ppc_max, 95):.0f}")
```

If the observed max is above the 95th percentile of simulated maxima, the Normal likelihood is telling you the data is implausibly extreme. It isn't — your likelihood is.

**Autocorrelated residuals.** An MMM that doesn't fully capture seasonality will leave structure in the residuals. Plot `az.plot_ppc(idata, kind="cumulative")` and look for the observed data consistently leading or lagging the simulated band in a pattern. You can also plot residuals over time directly:

```python
ppc_mean = idata.posterior_predictive["sales_obs"].mean(dim=["chain", "draw"]).values
residuals = revenue - ppc_mean
plt.plot(dates, residuals)
plt.axhline(0, linestyle="--")
```

A sine-wave pattern in the residuals is seasonality the model doesn't know about. A slow drift is structural change the adstock + saturation model isn't capturing. Neither will show up in R-hat. Both are visible here in ten seconds.

**Zero-spend weeks look different.** If a channel has dark periods — weeks of zero spend — the PPC can reveal that the model is generating those weeks incorrectly. The effective exposure goes to zero, but if the saturation curve or baseline is misspecified, the predicted sales in those weeks will be systematically off. Condition the PPC on zero-spend weeks and check the coverage:

```python
zero_spend_mask = spend_data == 0
obs_zero = revenue[zero_spend_mask]
ppc_zero = idata.posterior_predictive["sales_obs"].values[..., zero_spend_mask]
# Check: are zero-spend obs inside the 90% PPC interval?
lower = np.percentile(ppc_zero, 5, axis=(0, 1))
upper = np.percentile(ppc_zero, 95, axis=(0, 1))
coverage = np.mean((obs_zero >= lower) & (obs_zero <= upper))
print(f"Coverage in zero-spend weeks: {coverage:.1%}")
```

If coverage is well below 90%, your baseline or adstock decay is misspecified for dark periods.

## The workflow position

In the standard Bayesian workflow I run for MMM projects:

1. Write the generative story; check with **prior predictive simulation**.
2. Run **SBC**: verify rank histograms are approximately uniform.
3. Fit on real data.
4. Check **MCMC diagnostics** (R-hat, ESS, divergences).
5. Run **posterior predictive checks**.
6. Calibrate against experimental lift tests.

PPCs live at step 5, after the sampler checks but before calibration. The reason is that MCMC diagnostics can only tell you "the sampler converged to *some* distribution." PPCs tell you whether that distribution is generating data that resembles reality. If they fail, you go back and fix the likelihood before spending time on experiment calibration — because calibrating an experiment against a misspecified model is just compounding errors.

## What to do when PPCs fail

The failure mode points to the fix. Fat tails → heavier-tailed likelihood (Student-t, skew-normal). Autocorrelated residuals → more flexible seasonality (Fourier terms, holiday indicators, a GP over time). Structural bias in zero-spend weeks → check baseline specification and adstock initial conditions. In my experience, "the PPC looks bad" almost always traces to a specific modeling choice that has an obvious correction once you look at the failure pattern.

What PPCs don't tell you is whether the correction improves causal identification. A Student-t likelihood might produce a better-looking PPC while doing nothing to resolve the adstock-saturation ridge. That's why PPCs and SBC are complementary, not substitutes — the former checks the generative surface, the latter checks whether you can traverse it correctly.

## The one number I check first

If I can only run one quick check before diving into the full PPC suite, I run:

```python
az.plot_bpv(idata, hdi_prob=0.94)
```

The Bayesian p-value plot shows, for each observation, the probability that a posterior-predictive replicate is less than or equal to the observed value. Under a correct model, these should be roughly uniform. A clump near 0 or 1 means the model consistently predicts too high or too low for specific observations. It's the same uniformity check as SBC, but applied to the observation predictive rather than the parameter posterior — and it takes about two seconds to compute.

The sampler converging is table stakes. Inference being calibrated is necessary but not sufficient. The generative process describing reality is what the posterior predictive check is there to confirm — and it's the step I've most often seen skipped in MMMs that later failed their experimental calibration.

---

*Posterior predictive checks are step 6 of the Bayesian workflow in Gelman et al. (2020), "Bayesian Workflow," arXiv:2011.01808. The ArviZ functions used here are documented at [arviz-devs.github.io](https://python.arviz.org). Related posts: [Simulation-Based Calibration](/posts/simulation-based-calibration/) on rank-based calibration checks, [Read the Diagnostics First](/posts/read-the-diagnostics-first/) on MCMC convergence, [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/) on experimental validation after fitting.*
