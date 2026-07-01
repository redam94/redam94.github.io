---
title: "More Data, More Confident, Still Wrong: The Table 2 Problem at Scale"
author: Matthew Reda
pubDatetime: 2026-07-01T13:12:08Z
slug: more-data-more-confident-still-wrong
draft: true
tags:
  - causal-inference
  - statistics
  - simulation
  - bayesian
description: A simulation study showing that as sample size grows, coverage rates for confounded control-variable coefficients collapse toward zero — the Table 2 fallacy gets worse with more data, not better.
---

One of the arguments I sometimes hear against worrying about the [Table 2 Fallacy](/posts/table-2-fallacy/) is that it's a small-sample problem. "We have a decade of weekly data." "We have a panel across 200 geographies." Surely the estimates converge. More data should tighten up the intervals and get us closer to the truth.

This is exactly backwards. A simulation study by A. Jordan Nafa (2022) makes the direction of failure precise: as sample size grows, coverage rates for confounded control-variable coefficients collapse toward zero. With 2,500 observations, the 90% credible interval covers the true value of a confounded control variable about 1% of the time. With 10,000 observations — four times the data — coverage is 0%. More data, tighter intervals, further from truth.

## What the simulation measures

The data-generating process has an exposure $X$, an outcome $Y$, measured confounders $\{Z, W, L, J\}$, and unobserved confounders $\{U, V\}$.

Conditioning on $\{Z, L, W, J\}$ closes the backdoor paths from $X$ to $Y$ — that identification works. But $Z$ has its own unobserved backdoor: $Z \leftarrow U \rightarrow Y$. The adjustment set you chose for $X$ does nothing for $Z$. It was built to identify $X$.

The question Nafa's simulation asks: if you fit a Bayesian regression with all these variables and read off $Z$'s coefficient, how often does your 90% credible interval contain $Z$'s true causal effect? The simulation runs 500 replications per condition across three sample sizes.

## The results

| $n$ | Coverage, $Z$ confounded | Coverage, $Z$ unconfounded |
|-----|--------------------------|---------------------------|
| 2,500 | 1% | 93% |
| 5,000 | 1% | 91% |
| 10,000 | 0% | 90% |

The treatment effect on $X$ recovers cleanly in both conditions — around 89–91% coverage throughout. The $X$ coefficient is what the study was designed to identify, and the adjustment set closes its backdoor paths. The $Z$ coefficient collapses when $Z$ is confounded, and collapses harder as the sample grows. Meanwhile, the unconfounded version of $Z$ tracks nominal coverage across all three sample sizes.

This is not a rounding issue. At 10,000 observations, the 90% credible interval for the confounded $Z$ coefficient fails to cover the truth essentially every time.

## Why more data makes it worse

A credible interval has two components: width (proportional to $1/\sqrt{n}$) and centering (determined by what the estimator converges to). As $n \to \infty$, the interval shrinks to a point — but it shrinks around the probability limit of the estimator, not around the truth.

For a confounded coefficient, the probability limit is not the true causal effect. It's the true effect plus a fixed bias term:

$$\hat\beta_Z \xrightarrow{p} \beta_Z^{\text{true}} + \underbrace{\frac{\text{Cov}(U, Z)}{\text{Var}(Z \mid \text{others})} \cdot \gamma_U}_{\text{bias, does not shrink with }n}$$

The bias doesn't depend on sample size. It's a structural feature of the data-generating process — $U$ exists, it moves $Z$ and $Y$, and you can't close that path because $U$ is unobserved. As $n$ grows, your interval collapses around a wrong number with increasing precision.

At small $n$, the interval was wide enough to accidentally cover the truth some fraction of the time. At large $n$, it's too tight to get lucky. A 1% coverage rate at 2,500 observations becomes 0% at 10,000 observations because the narrow interval can no longer straddle the distance between the biased estimate and the true value. The false precision is the problem.

## A PyMC version

The original simulation runs in Stan. Here is the core structure in PyMC for anyone who wants to reproduce it in Python:

```python
import pymc as pm
import numpy as np

rng = np.random.default_rng(42)

def generate_data(n, delta_u=1.0):
    """delta_u=1.0 confounds Z via U; delta_u=0.0 removes the confound."""
    U = rng.normal(size=n)
    V = rng.normal(size=n)
    W = 0.5 * U + rng.normal(size=n)
    L = 0.5 * U + 0.5 * V + rng.normal(size=n)
    J = 0.5 * V + rng.normal(size=n)
    Z = 0.5 * W + 0.5 * L + delta_u * U + rng.normal(size=n)
    logit_theta = 0.5 * Z + 0.3 * W + 0.3 * J + 0.3 * L
    X = rng.binomial(1, 1 / (1 + np.exp(-logit_theta)))
    Y = 0.5 + 1.0 * X + 0.5 * Z + 0.4 * L + 0.3 * W + 0.4 * J + U + V + rng.normal(0, 0.5, n)
    return dict(X=X, Y=Y, Z=Z, W=W, L=L, J=J)

def fit_coverage(n, delta_u=1.0, n_reps=200, ci=0.90):
    covered = {"X": 0, "Z": 0}
    true_vals = {"X": 1.0, "Z": 0.5}
    tail = (1 - ci) / 2

    for _ in range(n_reps):
        d = generate_data(n, delta_u)
        with pm.Model():
            a = pm.Normal("a", 0, 2.5)
            bX = pm.Normal("bX", 0, 2.5)
            bZ = pm.Normal("bZ", 0, 2.5)
            bW = pm.Normal("bW", 0, 2.5)
            bL = pm.Normal("bL", 0, 2.5)
            bJ = pm.Normal("bJ", 0, 2.5)
            sig = pm.HalfNormal("sig", 1)
            mu = a + bX*d["X"] + bZ*d["Z"] + bW*d["W"] + bL*d["L"] + bJ*d["J"]
            pm.Normal("Y", mu=mu, sigma=sig, observed=d["Y"])
            tr = pm.sample(500, tune=500, progressbar=False, chains=4)
        for v, bv in [("X", "bX"), ("Z", "bZ")]:
            draws = tr.posterior[bv].values.flatten()
            lo, hi = np.quantile(draws, [tail, 1 - tail])
            if lo <= true_vals[v] <= hi:
                covered[v] += 1

    return {v: covered[v] / n_reps for v in covered}
```

Run `fit_coverage(n=2500, delta_u=1.0)` versus `fit_coverage(n=2500, delta_u=0.0)` and you'll see the divergence in the coverage table. The treatment coefficient `bX` holds at ~90% in both conditions. The `bZ` coverage collapses in the confounded case and tracks nominal in the clean case.

## What this means for large marketing datasets

Marketing data is often large. Three years of weekly national data. Geo-level panels across 200 DMAs. Individual-level impression tracking. This gets presented as a strength, and for media estimation it is one — more data tightens your channel ROI posteriors. But for the control variables in the same model, the simulation says the opposite.

Price is the clearest case, because [price is almost always endogenous in an MMM](/posts/table-2-fallacy-in-mmm/). Promotional calendars, competitor reactions, demand shocks — the unobserved variable that moves both price and sales is structural. Your adjustment set was built to close backdoors into media, not into price. At three years of weekly data (~150 observations), your price coefficient already has a 90% CI that looks clean and is almost certainly wrong. At ten years (~520 observations), the interval is tighter and the coverage is lower.

None of this is an argument against running large models or collecting more data. It is an argument against reading columns in a table as if every row represents a research design. The media channels are what you designed the study to identify. The controls are the cost of that identification. The sample size doesn't change which coefficients have a valid causal interpretation — it just makes the false precision more convincing on the ones that don't.

[Nafa's conclusion](https://www.ajordannafa.com/blog/2022/statistical-adjustment-interpretation/) is worth repeating: "Big data is not a substitute for experimental design or causal reasoning." If anything, it's a reason to be more careful. A wide interval on a small-sample confounded estimate might still cover the truth by accident. A narrow interval on a large-sample confounded estimate won't.

---

_Grounded in Nafa (2022), "These Are Not the Effects You Are Looking For," ajordannafa.com/blog/2022/statistical-adjustment-interpretation/. Coverage simulation design follows Nafa's original; the PyMC port is my own. Related: [The Table 2 Fallacy](/posts/table-2-fallacy/), [Your MMM's Control Coefficients Are Not Findings](/posts/table-2-fallacy-in-mmm/), [The Assumptions Are the Model](/posts/the-assumptions-are-the-model/)._
