---
title: "Bayesian Brand Tracking, Honestly"
author: Matthew Reda
pubDatetime: 2026-06-17T13:00:00Z
slug: bayesian-brand-tracking
draft: false
tags:
  - bayesian
  - brand-tracking
  - pymc
  - statistics
description: Why weekly brand-tracker survey data needs a Binomial likelihood instead of raw percentages, what a small PyMC model actually buys you, and where partial pooling and state-space smoothing come next.
---

Brand-tracker data has a problem that no dashboard wants to admit: the weekly sample is small. You field 80 interviews in a market, 31 people say they'd consider the brand, and someone reads "38.75% consideration, up 4 points" off a slide as if the fourth decimal place means something. It doesn't. Next week you field 75 interviews, 27 say yes, and consideration "drops" to 36%. Nobody changed their mind. The dice did.

That jumpiness is not a measurement failure to be smoothed away with a trailing average. It's information about how little you actually know each week, and the right move is to model it instead of hiding it. That's what [BayesianBrandTracker](https://github.com/redam94/BayesianBrandTracker) is for. This post is about the small, honest version that exists today, and the larger version that doesn't yet.

## The case against raw percentages

A weekly tracking percentage is a ratio of two small numbers. Its sampling variance is roughly $p(1-p)/n$, which at $n=80$ and $p \approx 0.4$ gives a standard error near 5.5 points. So a "4-point move" is comfortably inside the noise floor. If you report the point estimate, you are reporting noise with a confident face.

The fix is to stop treating the percentage as the thing you observed and start treating it as a latent quantity you're trying to estimate. What you actually observed is a count: out of $n_t$ people sampled in week $t$, $y_t$ gave the positive answer. That's a binomial outcome, and binomial outcomes carry their own uncertainty for free if you let them.

## What the model does today

The current `BTModel` is deliberately plain. You hand it the name of the positive-outcome count, the name of the sample-size count, and a list of exogenous drivers. It builds a latent-probability model: Normal priors on the coefficients, a logit link, and a Binomial likelihood on the observed counts.

$$
y_t \sim \mathrm{Binomial}(n_t,\, p_t), \qquad \operatorname{logit}(p_t) = \alpha + x_t^\top \beta
$$

with weakly informative priors $\alpha \sim \mathcal{N}(0,1)$ and $\beta_j \sim \mathcal{N}(0,1)$. The logit link keeps $p_t$ in $(0,1)$ no matter what the linear predictor does, and the Binomial likelihood means a week with $n_t = 40$ contributes proportionally less than a week with $n_t = 400$ — the model already knows that small samples are weak evidence, because you told it the sample size.

Here is the actual PyMC, lifted from the repo:

```python
with pm.Model(coords=coords) as self.__model:
    # Priors
    beta = pm.Normal('beta', mu=0, sd=1, shape=len(self.exogenous_variables))
    alpha = pm.Normal('alpha', mu=0, sd=1)
    sigma = pm.HalfNormal('sigma', sd=1)

    # Likelihood
    mu = alpha + pm.math.dot(data[self.exogenous_variables].values, beta)
    p = pm.math.invlogit(mu)
    y = pm.Binomial('y', n=data[self.sample_size_name].values,
                    p=p, observed=data[self.positive_outcome_name].values)

    self.__trace = pm.sample(5000, tune=1000)
```

What you get out is a posterior over `p`, not a single number. So instead of "consideration is 38.75%," you get "consideration is somewhere in the 33–44% range, most likely around 39." Stakeholders adjust faster to honest ranges than to point estimates that quietly move every quarter, and a posterior interval is exactly that range, computed from the data rather than negotiated in a meeting.

A few honest caveats, because the file is honest about itself. The `sigma` prior is declared but doesn't yet feed the likelihood — it's scaffolding for an observation-noise term that isn't wired in. And `predict`, `evaluate`, `save`, and `load` are stubs. Right now this is a thing that fits and gives you a calibrated posterior on `p`. It is not yet a thing that forecasts next week or persists to disk. If you need those today, "we don't know yet" is a complete sentence.

## Where it goes next (roadmap, not reality)

The reason to build the simple version first is that the real target is harder, and you want the foundation calibrated before you add structure. Two extensions are on the roadmap, and neither is built yet.

First, **partial pooling across geographies**. Right now every market would be fit as if it shared one global $\alpha$ and $\beta$. But you usually track many markets, each with its own thin weekly sample. Hierarchical priors let each market have its own intercept drawn from a shared distribution:

$$
\alpha_g \sim \mathcal{N}(\mu_\alpha,\, \tau), \qquad
\operatorname{logit}(p_{g,t}) = \alpha_g + x_{g,t}^\top \beta
$$

That borrows strength: a market with 40 interviews this week gets pulled toward the cross-market mean, while a market with real signal keeps its local responsiveness. Pooling is how you get a usable weekly read out of samples that are individually too small to trust.

Second, **temporal smoothing via a state-space prior**. Consideration doesn't teleport week to week, so the latent level should be modeled as a random walk, $\theta_t = \theta_{t-1} + \varepsilon_t$, with the survey counts as noisy observations of it. That separates "the underlying level moved" from "the sample was unlucky," which is the entire job of a tracker.

Together those turn a per-week snapshot into a model that pools weak signal across geographies without flattening local movement. That's the direction. It is not the current state of the repo, and I'd rather say so than imply the smooth multi-market version already ships.

## Takeaway

If you run a tracker, swap your headline percentages for a Binomial-with-logit model before you do anything fancier — it's a dozen lines of PyMC, and it immediately replaces fake precision with an interval you can defend. Then resist the urge to ship a hierarchical state-space monster until the one-market version is calibrated and you actually trust its posteriors. Report what the data actually supports, and let the sample size speak. The code is at [github.com/redam94/BayesianBrandTracker](https://github.com/redam94/BayesianBrandTracker) if you want to start from the honest, small version.
