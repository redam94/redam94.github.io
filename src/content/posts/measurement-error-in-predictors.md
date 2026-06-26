---
title: "Noisy Covariates Bias Your Coefficients Toward Zero"
author: Matthew Reda
pubDatetime: 2026-06-26T13:05:37Z
slug: measurement-error-in-predictors
draft: true
tags:
  - statistics
  - regression
  - bayesian
  - marketing-mix-modeling
description: When a predictor in your regression is measured with error, its coefficient shrinks toward zero in a predictable, quantifiable way — here's the math and the Bayesian fix.
---

Here's a thing I've noticed in applied regression work: we obsess over the outcome side of the model. We check residuals, worry about heteroskedasticity, argue about priors. But then we quietly assume that every variable on the right-hand side is measured exactly, as if the thing labeled "brand consideration" in column C is the true latent consideration level, not a small-sample noisy estimate of it.

It isn't. And the consequence is systematic: your coefficients for noisy predictors are biased toward zero. Always. The direction is guaranteed; the magnitude depends on how noisy.

## The math

Call the true (unobserved) quantity $x^*$ and what you actually measured $x = x^* + u$, where $u \sim \mathcal{N}(0, \sigma_u^2)$ is measurement noise independent of $x^*$ and of the outcome $y$.

You want to estimate $\beta$ in:

$$y = \alpha + \beta x^* + \varepsilon$$

But you run OLS on $x$ instead of $x^*$. The classical result is that OLS gives:

$$\hat\beta_{\text{OLS}} \xrightarrow{p} \beta \cdot \underbrace{\frac{\sigma_{x^*}^2}{\sigma_{x^*}^2 + \sigma_u^2}}_{\lambda}$$

The term $\lambda$ is the **reliability ratio** — always between 0 and 1. If the signal variance $\sigma_{x^*}^2$ is large relative to the noise variance $\sigma_u^2$, you're fine; $\lambda \approx 1$. If noise dominates signal, $\lambda$ collapses and your estimate is badly attenuated. The bias isn't random — it's deterministic and directional.

## Why brand tracking data is a case study in this

In an [earlier post](../bayesian-brand-tracking/) I wrote about why weekly brand trackers need a Binomial likelihood rather than raw percentages. The short version: at $n = 80$ weekly interviews and $p \approx 0.4$, the standard error on the raw percentage is about 5.5 points. That's the noise floor for a single week.

Now suppose the true underlying consideration level moves 3–5 points over a quarter in response to media. Small signal, larger noise. Plugging raw consideration percentages into a marketing mix model and expecting the coefficient on consideration to be meaningful is optimistic.

The attenuation factor in that scenario is roughly:

$$\lambda = \frac{(3.5)^2}{(3.5)^2 + (5.5)^2} \approx 0.29$$

You'd expect to recover about 29 cents of every dollar of true effect. That's not noise around the right answer — it's a different, systematically wrong answer. And it will look plausible. Small positive coefficient, reasonable standard error, passes a vibe check. It's just not the thing you wanted to estimate.

This shows up in the [`common_regression_issues`](https://github.com/redam94/common_regression_issues) work as one of the most underappreciated pitfalls in applied regression: independent variable measurement error doesn't make your model noisy, it makes it biased.

## The naive fixes don't work

The tempting first response is "I'll smooth the tracker first." A 4-week moving average reduces $\sigma_u^2$ by roughly a factor of 4, which helps. But you still have a noisy predictor; $\lambda$ improves but doesn't hit 1. And now you've introduced serial correlation you haven't modeled.

The second tempting response: "I'll plug in the posterior mean from the tracker model." This is strictly better than raw percentages — the Bayesian posterior mean for $p$ already shrinks toward the prior and incorporates the sample size properly. But it still throws away the posterior uncertainty. You're telling the downstream model "I know consideration exactly this week" when the whole point of building a tracker was to quantify exactly how much you don't.

Using a posterior mean as a plug-in point is the Bayesian version of the same mistake. Variance gets swallowed at the plug-in, and the sales model downstream has no way to recover it.

## What actually works

The cleanest solution is to treat measurement error as part of the joint model. In PyMC, that means representing the true consideration level as a latent variable shared between the tracker observation model and the sales model:

```python
with pm.Model():
    # Latent true consideration level (e.g. a random walk)
    x_star = pm.GaussianRandomWalk("x_star", sigma=0.1, shape=T)

    # Tracker observation model: count data is noisy evidence of x_star
    p_t = pm.Deterministic("p_t", pm.math.invlogit(x_star))
    y_tracker = pm.Binomial("y_tracker", n=n_interviews, p=p_t, observed=positives)

    # Sales model: x_star (not x_raw) is the covariate
    alpha = pm.Normal("alpha", 0, 1)
    beta = pm.Normal("beta", 0, 0.5)
    mu_sales = alpha + beta * x_star + ...  # other terms
    sales = pm.Normal("sales", mu=mu_sales, sigma=pm.HalfNormal("sigma", 1), observed=revenue)
```

Now the posterior over $x^*$ is constrained by both the tracker data and the sales data simultaneously. The sales regression knows exactly how uncertain the latent consideration level is, because it's sharing that uncertainty with the measurement model. There's no attenuation because there's no plug-in step where you throw away variance.

This is more expensive — you're fitting one joint model instead of two sequential ones. But it's the right answer. The [`mmm-framework`](https://github.com/redam94/mmm-framework) supports extended model architectures for exactly this kind of mediated pathway (brand consideration as an intermediate between media and sales), and fitting them jointly rather than chaining outputs is precisely how the framework avoids the attenuation problem.

If you genuinely can't fit everything jointly, the second-best option is to draw many posterior samples from the tracker model and pass each one through the downstream model, then summarize the resulting distribution of coefficients. That's the Bayesian analog of a correction-factor approach, without needing to know $\sigma_u^2$ analytically.

## What to watch for

A few practical indicators that measurement error is hurting you:

- You're using a derived metric (brand tracker %, share-of-voice index, panel extrapolate) as a covariate, and the derivation itself involves a small-sample estimate.
- The coefficient on that variable is positive and plausible but notably smaller than you'd expect from prior research or experimental evidence.
- Smoothing the variable a bit makes the coefficient grow — a strong sign that noise was suppressing it.

The third one is the diagnostic I find most useful. If your coefficient doubles when you 4-week-smooth the input, you're almost certainly looking at attenuation, not a modeling improvement.

## Takeaway

Noisy predictors don't produce noisy coefficients. They produce biased ones, systematically toward zero, by an amount determined by the ratio of signal variance to total variance. Brand tracking data, panel extrapolates, and any other small-sample-derived metric are common culprits in marketing models.

The Bayesian fix is to model the measurement process, not ignore it: represent the true quantity as a latent variable and let the tracker observations and the outcome observations jointly constrain it. If that's too expensive, propagate posterior draws rather than posterior means.

"We included brand consideration as a covariate" sounds rigorous. "We treated a noisy survey estimate as if it were exact" doesn't — but it's the same sentence, depending on what you actually put in the model.
