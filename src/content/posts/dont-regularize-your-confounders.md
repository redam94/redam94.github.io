---
title: "Don't Regularize Your Confounders"
author: Matthew Reda
pubDatetime: 2026-08-03T13:28:11Z
slug: dont-regularize-your-confounders
draft: true
tags:
  - bayesian
  - regression
  - causal-inference
  - marketing-mix-modeling
description: Horseshoe and spike-and-slab priors are a genuine improvement over stepwise selection — but applying them to confounders backfires. Shrinking a confounder's coefficient toward zero doesn't remove confounding bias; it amplifies it.
---

A follow-up question I get after people read [the post on Bayesian shrinkage for variable selection](/posts/variable-selection-mmm/) goes roughly like this: "Great, I replaced my stepwise regression with a horseshoe prior — I threw all my candidate variables in, let the posterior decide, done." And then they've applied the horseshoe to their price variable, their seasonality index, and their competitor spend flag alongside their media channels.

That's a mistake. Not a subtle one — the kind that can flip the direction of a treatment effect. The rest of this post is about why.

## The job description for shrinkage priors

Horseshoe, spike-and-slab, regularized horseshoe — these priors are designed for one specific job: **deciding which variables in a candidate set are signal and which are noise**. The mathematical intuition is that many coefficients should be exactly or approximately zero, and a few should be large. The prior encodes that belief, and the posterior either shrinks a coefficient to near-zero (noise) or lets it live away from zero (signal).

This is exactly the right tool for a set of candidate controls where you don't know in advance which ones matter — economic indicators, promotional flags, day-of-week effects, a hundred hypothesized drivers. Throw them all in, let the prior penalize the ones that don't earn their variance.

But that's a very specific use case. And it comes with a hidden assumption: **the variables in the candidate set don't need to be in the model for any reason other than their predictive signal on the outcome.**

Confounders break that assumption.

## Confounders aren't in the model for predictive signal

A confounder is a variable that causes both your treatment (media spend) and your outcome (sales). Seasonality drives both holiday media budgets and holiday sales. Price drives both promotional spend and consumer demand. A competitor's share of voice correlates with both your own spend and your own sales.

You include these variables not because they're good predictors of sales — though they are — but because leaving them out biases your media coefficients. The causal graph has a backdoor path $X \leftarrow Z \rightarrow Y$, and including $Z$ in the model closes it. That's what "controlling for $Z$" means.

Now apply a horseshoe prior to $Z$. When $Z$ has a moderate effect on $Y$ but is also collinear with $X$ (as confounders typically are), the posterior may shrink $Z$'s coefficient toward zero. Not to zero — but toward it. You are, in effect, choosing to adjust _less_ for the confounder than a flat prior would.

## Why partial adjustment is worse than no adjustment

Here's the math that makes this painful. In the simple linear case, when you omit a confounder $Z$ from a regression of $Y$ on $X$, the bias in $\hat{\beta}_X$ is:

$$\text{bias} = \frac{\text{Cov}(X, Z)}{\text{Var}(X)} \cdot \gamma$$

where $\gamma$ is the true coefficient of $Z$ on $Y$.

Notice what drives the bias: the **correlation between treatment and confounder**, and **the confounder's true effect on the outcome**. Not your model's estimated coefficient on $Z$ — the true parameter. Shrinking the estimated coefficient tells the model to partially ignore $Z$, but it has no effect on $\text{Cov}(X, Z)$ or $\gamma$. The backdoor path doesn't care that you applied a shrinkage prior. It's still open.

In fact, shrinking $Z$'s coefficient makes the situation strictly worse than a flat prior would. A flat prior lets the data determine how much to adjust; a horseshoe prior starts from a preference for zero and demands evidence to move away from it. For a confounder that's strongly correlated with your treatment, the collinearity means that evidence looks ambiguous — and the prior nudges the estimate toward the less-adjusting end.

The consequence in an MMM: your media coefficient absorbs the fraction of the confounder's influence that the regularized adjustment left behind. You've taken a bias problem and added a prior-induced blind spot on top of it.

## The distinction that matters: confounders vs. precision controls

The practical fix is to think clearly about why each variable is in the model before choosing a prior for it.

**Confounders** are variables you include to close a backdoor path. Their coefficient needs to be estimated honestly — not shrunken. In an MMM, these typically include:

- Seasonality (holiday flags, day-of-week, week-of-year)
- Price and promotional depth
- Competitor activity where you have data
- Macro indicators (unemployment, consumer confidence) that affect both spend and demand
- Distribution or availability metrics

Give these weakly informative, non-shrinking priors. A $\text{Normal}(0, \sigma)$ with a reasonably large $\sigma$ is fine. The goal is to let the data speak about how much to adjust without imposing a preference for "less adjustment."

**Precision controls** are variables you include because they absorb residual variance and sharpen the estimates of the things you care about — but they don't sit on a backdoor path into your treatment. These could be region-specific trend break indicators, special event flags, or auxiliary metrics that aren't causally upstream of spend. These are appropriate candidates for regularization. If they have no real signal, the prior correctly shrinks them; if they do, it lets them stand.

**Media variables** (your treatments) are a separate category. You're not regularizing them to zero — you're regularizing toward a prior distribution that encodes your beliefs about plausible ROI ranges. The horseshoe isn't the right tool here; informed half-Normal or Beta priors on adstock rates and saturation parameters are.

## Where this shows up in mmm-framework

In `mmm-framework`, the separation between confounder and precision-control priors is explicit in the model specification. The `confounders` argument takes variables whose coefficients get standard Normal priors (possibly tightened by domain knowledge, but not toward zero). The `candidate_controls` argument takes variables eligible for horseshoe shrinkage. They're passed separately, and the prior architecture treats them differently, because the model specification needs to know the difference even if the data don't announce it.

The reason this distinction matters at the software level: without it, it's easy for a framework user to dump everything into one bucket and let the prior "figure it out." The prior can't figure it out. The prior has no way to know that price is causally upstream of spend. That's a modeling decision, and it needs to be made before the MCMC runs.

## The diagnostic

If you suspect your current model is over-shrinking a confounder, there's a useful check. Refit the model with that variable pulled out of the shrinkage prior and given a flat Normal prior. Compare:

1. The posterior on your media coefficients between the two fits
2. The posterior on the confounder's coefficient — did it want to be away from zero?

If the media coefficients shift and the confounder's posterior clusters away from zero under the flat prior, you were under-adjusting. The horseshoe was doing the work of confounding for you.

The diagnostic matters because shrinkage-induced confounding fails quietly. Your model converges. Your $\hat{R}$ statistics look fine. The ROAS estimates look reasonable. The only signature is a coefficient that was nudged slightly toward zero and, behind it, a media attribution that's slightly too high for the channels that correlate with omitted-variable-driven periods of high sales. That's exactly the shape of failure that ends up in a budget recommendation.

## The underlying principle

Regularization is a tool for epistemic uncertainty: "I don't know which of these variables matter, so I'll let the data update toward sparsity." Confounders aren't an epistemic question in that sense — you include them because your causal understanding of the system tells you they must be there. Applying an epistemic-uncertainty tool to a causal-structure decision is a category error, and the category error shows up in your posteriors.

Pre-specify which variables are confounders and which are candidates before you see the data. Write it down. That decision is an assumption, and [as I keep arguing](/posts/the-assumptions-are-the-model/), assumptions are the entire intellectual content of the analysis. The prior architecture you choose to enforce them is just the arithmetic.

---

_Source: the confounder/precision-control distinction is documented explicitly in [`mmm-framework`](https://github.com/redam94/mmm-framework)'s model specification API. The bias formula for omitted-variable bias is standard; see Angrist & Pischke (2009), \_Mostly Harmless Econometrics_, ch. 3. Related posts: [The Illusion of Significance](/posts/variable-selection-mmm/) on p-value selection, [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/) on identification, [The Assumptions Are the Model](/posts/the-assumptions-are-the-model/) on why the modeling decision matters.\_
