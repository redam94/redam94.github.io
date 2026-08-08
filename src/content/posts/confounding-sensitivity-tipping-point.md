---
title: "The Tipping Point: How Much Unmeasured Confounding Would Flip Your MMM?"
author: Matthew Reda
pubDatetime: 2026-08-08T13:16:40Z
slug: confounding-sensitivity-tipping-point
draft: true
tags:
  - marketing-mix-modeling
  - causal-inference
  - bayesian
  - statistics
description: Every MMM rests on one assumption no dataset can check. The right question isn't whether unmeasured confounding exists — it almost certainly does. It's how much it would take to overturn your conclusion.
---

Every number in a marketing-mix model is a causal claim dressed in regression clothing. The confidence interval around a TV ROAS of 2.3 is telling you "we're pretty sure TV caused about 2.3× its spend in revenue." That claim rests on one load-bearing assumption: that no unmeasured common cause is simultaneously pushing up both your media budget and your KPI.

That assumption is almost certainly false to some degree. Budgets track demand signals. Brands spend more in Q4 because they expect Q4 to be strong anyway. A competitor going dark in one period correlates with budget rotations in a way no model can directly measure. The question to ask is not "is there unmeasured confounding?" — almost certainly yes — but "how much unmeasured confounding would it take to flip the conclusion I'm relying on?"

That's the tipping point. It's the number I now put in every MMM readout, and it changes how clients read the results more than almost anything else I report.

## The bias decomposition

The device is simple. Decompose the observed posterior on channel ROI into two parts:

$$\hat{\tau} = \tau + \beta$$

where $\tau$ is the true causal effect and $\beta$ is the bias from unobserved confounding — the extra ROAS the model attributes to TV because unobserved demand was also high when TV ran heavy. Instead of assuming $\beta = 0$, put a prior on it:

$$\beta \sim \mathcal{N}(\mu_\beta,\, \sigma_\beta^2)$$

Now compute $P(\tau > r)$ — the probability that the causal effect exceeds some reference value $r$ (usually break-even, often 0 for a medium measured on impressions) — marginalizing over the bias prior. The de-biased posterior is a Gaussian mixture over the fitted draws:

$$P(\tau > r) = \frac{1}{S}\sum_{s=1}^{S} \Phi\!\left(\frac{\hat\tau_s - \mu_\beta - r}{\sigma_\beta}\right)$$

This is exact, not Monte Carlo. For each posterior draw $\hat\tau_s$, the bias-adjusted draw $\tau_s = \hat\tau_s - \beta$ is a Gaussian with known mean and variance, and the CDF is closed form. The result is deterministic: no seed to reproduce, no sampling noise at small draw counts.

The **tipping point** is the value of $\mu_\beta$ at which $P(\tau > r)$ crosses your decision threshold (say, 0.50 for a coin-flip on the conclusion, or 0.90 for a high-credibility standard). Bisecting the closed-form CDF finds it exactly:

> _"TV's ROI would have to be overstated by more than 24% of its own size before it stops clearing break-even."_

That sentence is something a CFO can interrogate. "Is 24% plausible?" is a question with an answer. "Did we account for all confounders?" is not.

## The sensitivity surface

A single tipping point is a summary. The full picture is a sensitivity surface: the probability $P(\tau > r)$ over a grid of $(\mu_\beta, \sigma_\beta)$ commitments. It partitions the space of analyst positions into those that support the conclusion and those that don't.

A fragile channel has a surface where a small, plausible bias — say, 5–10% of the estimate — is enough to push $P(\tau > r)$ below threshold. A resilient channel's surface is flat over the plausible region: you'd need to believe in a large, systematic bias to change your mind. The width of that safe zone is your margin.

In `mmm-framework`, `bias_sensitivity_report` produces this surface as an array over a pre-specified grid, with the decision threshold plotted as a contour line. The visual is quick: is your channel's posterior comfortably inside the contour, or sitting right on the edge?

## The Cinelli–Hazlett benchmark

The tipping point is an argument, not a slider, only if you can say whether the required bias level is _plausible_. That's where the Cinelli–Hazlett omitted-variable-bias formula comes in.

The idea: take a covariate you _did_ measure — say, Price — and compute how strongly it correlates with both your spend and your outcome (its partial $R^2$ in each direction). Then use the formula to bound the bias a hypothetical unmeasured confounder would introduce if it were as strong as Price:

$$|\text{bias}| = \text{SE} \cdot \sqrt{df} \cdot \sqrt{\frac{R^2_{Y \sim Z \mid X} \cdot R^2_{D \sim Z \mid X}}{1 - R^2_{D \sim Z \mid X}}}$$

where $Z$ is the confounder, $D$ is the spend variable, $Y$ is the outcome, and $X$ is the full adjustment set. This bound holds with equality when $Z$ is a real omitted variable — it's not an approximation, it's a worst-case price for a confounder at a given strength.

The output is:

> _"A confounder as strong as Price implies 9% — well inside the 24% it would take."_

This is the benchmark. It converts "how strong is too strong?" into "is the required confounder stronger than things we know exist?" When the answer is "you'd need something 3× as strong as Price, and Price is the most correlated control in the model," the conclusion is resilient. When the answer is "you'd need something weaker than Holiday Dummy," it's fragile.

## Using this in practice

In the [`mmm-framework`](https://github.com/redam94/mmm-framework), this is wired into `validation/confounding_sensitivity.py`. The core call:

```python
from mmm_framework.validation.confounding_sensitivity import run_confounding_sensitivity

# After fitting the model
report = run_confounding_sensitivity(model)

# For each channel:
for channel, result in report.items():
    print(f"{channel}: tipping point = {result.tipping_point:.1%} of mean, "
          f"verdict = {result.verdict}")
    # verdict is one of: resilient | fragile | overturned | not_assessable
```

The Cinelli–Hazlett benchmark is computed automatically from the model's design matrix at the posterior-mean transform point:

```python
benchmarks = report.benchmark_bias_priors(model)
# Returns: {covariate: BiasPrior(mu=0, sigma=implied_bias_sigma)}
# Compare implied_sigma against each channel's tipping_point_sigma
```

One guard worth knowing: the benchmark uses OLS partial $R^2$ values, not Bayesian posterior widths. This is deliberate. Substituting a Bayesian posterior standard deviation breaks the algebraic identity — and in the dangerous direction, because informative positive-support priors on media make the posterior narrower than the likelihood warrants, which would make the implied bias look smaller and the conclusion look more robust. The OLS path preserves the identity.

## What "resilient" actually means

The vocabulary is intentional. The framework doesn't call a conclusion "robust" — it calls it "resilient." Resilient claims only that the conclusion survived the bias range actually scanned, not that confounding is absent or small. It's an argument about plausibility, not a guarantee.

A conclusion can be:

- **Overturned**: the unadjusted posterior doesn't even clear the threshold before any bias is applied.
- **Fragile**: the tipping point falls inside the range a plausible confounder could reach.
- **Resilient**: the tipping point exceeds what a confounder at benchmark strength would supply.
- **Not assessable**: the prior already clears the threshold, so the data didn't establish it to begin with.

The last category is the most uncomfortable one. If a channel clears break-even under the prior before seeing data, reporting "TV ROI is positive" as a finding from the model is not a finding at all — it was already believed. The framework flags this explicitly and refuses to quote a resilience score under 0.20 prior-to-posterior contraction.

## Why this belongs in the standard readout

The standard MMM readout lists channel ROAS values, credible intervals, contributions, and diagnostics. Everything in that readout is conditional on the identification assumption holding. The sensitivity analysis is the first number in the readout that addresses what happens if it doesn't.

The clients I've found most receptive to this aren't the ones who want reassurance. They're the ones who've been burned — who funded a channel for a year based on a model ROAS, ran an incrementality test, and found the lift was 40% of what the model said. The question they ask is "how could the model be so confident and so wrong?" The sensitivity surface is the answer: the conclusion was fragile, and nobody checked.

Running the tipping point doesn't protect you from unmeasured confounding. It tells you how much there would have to be for your conclusion to be wrong, and it gives you a benchmark for whether that's plausible. That's not certainty. But it's an argument you can have, which is more than a confident-looking ROAS with no sensitivity check gives you.

---

_The bias sensitivity engine is in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `diagnostics/bias_sensitivity.py` and `validation/confounding_sensitivity.py`. The Cinelli–Hazlett formula is from Cinelli, C. & Hazlett, C. (2020), "Making Sense of Sensitivity: Extending Omitted Variable Bias," Journal of the Royal Statistical Society, Series B, 82(1), 39–67. The Bayesian sensitivity framework follows Imbens (2003). Related posts: [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/), [The Assumptions Are the Model](/posts/the-assumptions-are-the-model/), [Closing the Loop with MMM Calibration](/posts/closing-the-loop-mmm-calibration/)._
