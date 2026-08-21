---
title: "Turning Literature Into Priors"
author: Matthew Reda
pubDatetime: 2026-08-21T13:24:36Z
slug: turning-literature-into-priors
draft: true
tags:
  - bayesian
  - marketing-mix-modeling
  - statistics
  - pymc
description: Knowing that advertising elasticity is about 0.1 from the meta-analyses doesn't tell you what to put in your PyMC model. Here's the principled path from a literature number to a calibrated prior distribution.
---

I've said it in [a few places on this blog](/posts/what-decades-of-marketing-data-tell-us/): marketing science has given us a surprisingly stable set of numbers. Short-run advertising elasticity around 0.1. Price elasticity around −2.5. These are genuine priors, in the sense that they represent real accumulated evidence about how markets work.

But there's a gap between knowing a number from the literature and encoding it correctly in a PyMC model. "Advertising elasticity is about 0.1" is not a distribution. It doesn't tell you what family to use, how wide to make the tails, or — critically — what quantity in your particular model the number even applies to. I've watched analysts who know all the meta-analyses perfectly well still put `pm.Normal("roas", 0, 10)` in their models because the mapping from fact to prior felt murky. It doesn't have to be. Here's the procedure I use.

## Step 1: Get the parameterization straight

Before you choose a distribution, you need to know what quantity in your model the literature number applies to.

In a **log-log model** — where both sales and spend are log-transformed — the coefficient on log(spend) is the elasticity directly. If the literature says elasticity ≈ 0.1, your coefficient prior can be centered there:

$$\log(\text{sales}_t) = \alpha + \beta \cdot \log(\text{spend}_t) + \cdots$$

Here $\beta$ is the elasticity and a prior like $\beta \sim \mathcal{N}(0.1,\, 0.05)$ is a direct translation.

But most MMMs — including [mmm-framework](https://github.com/redam94/mmm-framework) — don't operate in log-log space. They apply a saturation transform to the (possibly adstocked) spend and then add the contribution to sales:

$$\text{sales}_t = \text{baseline}_t + \gamma \cdot f(\text{spend}_t) + \cdots$$

In this parameterization $\gamma$ is not the elasticity — it's the marginal contribution at the scale of spend and sales. ROAS (return on ad spend) is the derived quantity: $\text{ROAS} \approx \gamma \cdot f'(\text{spend}) \cdot \bar{\text{spend}} / \bar{\text{sales}}$. The literature number connects to ROAS, not to $\gamma$ directly, so you need to reason about ROAS and then back out what that implies for $\gamma$ given typical spend and sales levels.

The lesson: identify the model quantity first. Then figure out what the literature implies about it.

## Step 2: Pick a distribution family

Once you know what you're placing a prior on, pick a family appropriate to its support and shape.

- **ROAS**: always positive, typically right-skewed (most channels have modest returns; a few have very high ones). A **log-normal** or **half-normal** works well. I prefer log-normal because it stays bounded away from zero with a long right tail.
- **Adstock decay rate** $\alpha \in [0, 1)$: bounded on both sides. A **Beta** prior is the natural choice. TV typically carries over for several weeks, so a Beta(5, 3) — centered around 0.6 — is a reasonable starting point for a TV channel.
- **Saturation half-saturation** $\kappa$ (the spend level at 50% of max response): always positive, often spanning several orders of magnitude across categories. A **log-normal** over $\kappa$ in the scale of typical weekly spend is usually sensible.
- **Short-run elasticity** in a log-log model: positive and small, concentrated near zero. A **half-normal** with $\sigma = 0.1$ puts about 95% of mass below 0.2, consistent with the Sethuraman–Tellis evidence.

## Step 3: Parameterize from quantile beliefs

Don't start from distribution parameters. Start from beliefs about quantiles and solve backward. It's much easier to elicit "I'm 90% confident TV ROAS is between 0.5 and 6, with a median around 2" than to guess that $\mu = 0.7$ and $\sigma = 0.6$ on the log scale.

```python
from scipy import stats
import numpy as np

# Beliefs: median ROAS ≈ 2, 5th percentile ≈ 0.5, 95th percentile ≈ 6
# For LogNormal(mu, sigma): median = exp(mu), so mu = log(2)
# Solve for sigma such that P(ROAS < 0.5) ≈ 0.05

mu_ln = np.log(2.0)  # ≈ 0.693

# P(LogNormal < 0.5) = P(Normal < (log(0.5) - mu) / sigma) = 0.05
# => (log(0.5) - mu) / sigma = -1.645
# => sigma = (mu - log(0.5)) / 1.645
sigma_ln = (mu_ln - np.log(0.5)) / 1.645

lnorm = stats.lognorm(s=sigma_ln, scale=np.exp(mu_ln))
print(f"sigma_ln = {sigma_ln:.3f}")
print(f"5th pct: {lnorm.ppf(0.05):.2f}, median: {lnorm.ppf(0.50):.2f}, 95th pct: {lnorm.ppf(0.95):.2f}")
# sigma_ln = 0.841
# 5th pct: 0.50, median: 2.00, 95th pct: 8.00

import pymc as pm

with pm.Model():
    roas_tv = pm.LogNormal("roas_tv", mu=mu_ln, sigma=sigma_ln)
    # The 95th percentile is slightly above 6 — close enough.
    # The important thing is the prior is grounded in a stated belief.
```

Run this check on every parameter. The discipline of stating your quantile beliefs before setting parameters catches absurdities early: a prior that implies TV could single-handedly account for 20× your actual baseline sales is one you'd notice immediately.

## Step 4: Verify with a prior predictive check

After parameterizing, push prior samples through the full model and look at the simulated sales. Do they span the range of plausible weekly revenue? Are they ever negative? Are they ever 100× your historical average? As I noted in [the generative modeling post](/posts/generative-mmm-honest-iteration/), if the priors imply nonsense before the data arrives, the data won't fix it — the likelihood will just fight the prior instead of learning from the data.

```python
with my_mmm_model:
    prior_samples = pm.sample_prior_predictive(samples=500)

import arviz as az
az.plot_ppc(prior_samples, group="prior")
```

The check takes two minutes and has saved me from embarrassing priors more than once.

## The payoff

The reason this machinery matters most in MMM is exactly the situation [the adstock/saturation post](/posts/adstock-saturation-identification/) describes: adstock and saturation are jointly hard to identify from observational weekly data. When the likelihood is flat — when many parameter combinations explain the data about equally — the prior becomes the deciding factor. A flat prior hands the choice to noise. An informed prior, grounded in decades of marketing experiments, hands it to accumulated evidence instead.

Informative priors are not a way to confirm what you already believe. They're a way to make sure that when the data can't settle a question, the answer comes from real evidence rather than from whichever corner of parameter space the sampler happened to wander into.

The literature did the experiments. Use the results.

---

_The empirical regularities referenced here — advertising elasticity ≈ 0.1, price elasticity ≈ −2.5 — are drawn from the meta-analyses covered in [What Decades of Marketing-Mix Data Actually Tell Us](/posts/what-decades-of-marketing-data-tell-us/). Prior specification in mmm-framework is introduced in [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/). The prior predictive check technique is part of the generative workflow in [All Models Are Wrong, So Make Yours Generative](/posts/generative-mmm-honest-iteration/)._
