---
title: "Collinearity Doesn't Break Your Model — It Tells You What Your Data Can't Separate"
author: Matthew Reda
pubDatetime: 2026-06-30T13:08:48Z
slug: collinearity-cant-separate
draft: false
tags:
  - statistics
  - regression
  - marketing-mix-modeling
  - bayesian
description: A high VIF isn't a technical failure to fix — it's a signal that your data can't distinguish two effects. The right response is better data or informative priors, not variable deletion.
---

Collinearity shows up in nearly every marketing mix model I've worked on, and the response is almost always the same: look at the VIF table, panic when something clears 10, drop a variable or combine channels, and move on. The numbers stabilize. The problem is gone.

Except it isn't. The wide, unstable estimates were telling you something real about your data, and most of the "fixes" don't resolve that — they just hide it. This is one of the three core pitfalls in my [common regression issues](https://github.com/redam94/common_regression_issues) framework, and it's the one that's most frequently addressed in the wrong direction.

## What collinearity actually does

Collinearity is just correlation among predictors — usually partial correlation, meaning $X_j$ can be largely explained by the other predictors in the model. The VIF for variable $j$ formalizes this:

$$\text{VIF}_j = \frac{1}{1 - R_j^2}$$

where $R_j^2$ is the variance in $X_j$ explained by regressing it on everything else. A VIF of 10 means 90% of $X_j$'s variance is shared with the other predictors, and the variance on $\hat\beta_j$ is inflated by a factor of 10:

$$\text{Var}(\hat\beta_j) = \frac{\sigma^2}{S_{x_j}^2} \cdot \text{VIF}_j$$

That inflated variance shows up as wide confidence intervals, unstable estimates across model specs, and — the classic tell — sign flips when you add or remove a correlated predictor.

The common mental model is "the model is confused." A better one: **the data doesn't contain the variation needed to separate these effects, so no estimator can.** Least squares isn't confused; it's doing exactly what it should do with the available information. The uncertainty is the correct answer.

## The Bayesian version is more honest

In a Bayesian model, collinearity shows up in the posterior directly: you get wide marginal distributions on the correlated coefficients, and — if you actually look at the joint posterior — a strong negative correlation between them. The model is saying "TV or digital video could be doing the work; I can't tell from this data."

This is actually better than the frequentist output in one key respect. The frequentist interval is asymptotically valid but the finite-sample behavior under collinearity can be misleading. The Bayesian posterior is just the posterior — it's wide because the likelihood is flat in that direction, which is an honest description of the inferential problem. The joint posterior plot below is the picture:

```python
import arviz as az
import matplotlib.pyplot as plt

# After fitting with PyMC
az.plot_pair(trace, var_names=["beta_tv", "beta_digital_video"], kind="kde")
plt.title("Posterior joint distribution — note the correlation")
```

A long, tilted ellipse along the negative diagonal means the model is trading the two coefficients off against each other — one can be large only if the other is small. That's collinearity, and the picture is more informative than a single VIF number because it tells you the direction and magnitude of the ambiguity.

## The bad fixes

Most collinearity "fixes" make the problem disappear statistically while leaving the underlying ambiguity intact or creating a new one.

**Dropping one variable.** If you drop TV because it's collinear with digital video, one of two things happens. If TV was a confounder — a variable you needed to close a backdoor path — you've just reopened that path and biased the media estimates you care about. (I wrote about this failure mode in [Table 2 fallacy in MMMs](/posts/table-2-fallacy-in-mmm/).) If TV was a genuine channel, you've forced all the credit that was shared between them onto digital video. The VIF drops; the model assigns a confident ROAS to digital video; the confident ROAS is wrong.

**Aggregating channels.** Combining TV and digital video into "video" produces a stable estimate for the combined bucket — and loses the information you need to allocate between them. If the whole point of the MMM is to decide how to split the video budget, you've solved the statistical problem by eliminating the business question.

**Picking the channel with the better VIF.** This is variable selection conditional on noise. The variable with the slightly lower VIF got lucky on this dataset; on a different run of the same data-generating process, the other channel might win. You're selecting on sampling variability and reporting the winner as a finding.

## The two responses that actually work

**Design variation into the data.** Collinearity is a data problem, so the clean solution is more informative data. Specifically, variation that breaks the shared movement: a geo-level holdout where one channel goes dark while the other continues, a budget-flighting test where TV and digital video are deliberately uncorrelated across periods. The [`mmm-framework`](https://github.com/redam94/mmm-framework) is built around the assumption that the model and the experiment are part of the same loop — the model tells you where the uncertainty is most expensive, and the experiment is designed to resolve it. Collinearity in the posterior is exactly the kind of expensive uncertainty that should drive experiment selection. (I've written about designing experiments around expected information gain [here](/posts/designing-experiments-to-maximize-information/).)

**Bring in informative priors.** If external evidence — a lift test, a meta-analysis, industry benchmarks — constrains the plausible range of one channel's ROI, encode that as a prior. This is the Bayesian analog of instrumental variables: you're supplementing the observational data with information that exists outside the dataset and can break the collinearity. The key is that the prior must come from somewhere real. "We believe TV ROI is positive" is a prior; "we know from a controlled geo-test that TV ROI is 1.2–1.8" is a much more informative one, and it's the kind that actually resolves ambiguity rather than just shifting the posterior slightly.

## What to look for

A few practical diagnostics to run before panicking about the VIF table:

1. **Posterior correlation matrix.** For any pair of channel coefficients, plot the joint posterior. If it's a rotated ellipse rather than a circle, you have collinearity and you can see exactly which directions are ambiguous.

2. **Stability under prior perturbation.** Refit with slightly different priors on the collinear channels. If the estimates move a lot, the prior is doing most of the work — which means your data isn't resolving the question and you should say so.

3. **VIF as a pre-flight check, not a verdict.** A high VIF tells you to look at the posterior carefully; it doesn't tell you to drop the variable. The causal role of the variable — confounder, mediator, precision control, or channel of interest — determines whether it stays, not its VIF.

## The honest conclusion

Collinearity is your data telling you that it doesn't contain enough variation to tell two effects apart. That's real information, and suppressing it by dropping a variable or aggregating channels is worse than reporting the wide uncertainty honestly. Wide, correlated posteriors are the correct output when the data is uninformative about which variable is doing the work — not a failure to be fixed, but an accurate description of what you know.

The remedy is always upstream: get data with more variation, run experiments designed to break the correlation, or bring in prior information from sources that can. If you can't do any of those, the honest answer is a wide interval, and the honest report is "these two effects are not separately identified by this data."

That's an uncomfortable answer to give a client. It's the right one.

---

_Multicollinearity is the second of three core pitfalls covered in [common regression issues](https://github.com/redam94/common_regression_issues), alongside [measurement error in predictors](/posts/measurement-error-in-predictors/) and [the illusion of significance](/posts/variable-selection-mmm/). The mmm-framework approach to resolving collinearity through experimental design is described in [designing experiments to maximize information](/posts/designing-experiments-to-maximize-information/) and [closing the loop with MMM calibration](/posts/closing-the-loop-mmm-calibration/)._
