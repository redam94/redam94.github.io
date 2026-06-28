---
title: "Wiring Your MMM to Your Experiments"
author: Matthew Reda
pubDatetime: 2026-06-28T06:30:00Z
slug: closing-the-loop-mmm-calibration
draft: false
tags:
  - marketing-mix-modeling
  - bayesian
  - experimental-design
  - measurement
description: Most teams run MMMs and geo-lift experiments as separate silos, then argue about which to trust. The better move is to wire them into a loop — the model picks the experiments, the experiments calibrate the model — and watch the uncertainty contract.
---

Most organizations that do serious marketing measurement own two instruments that don't talk to each other. The marketing-mix model produces tidy ROIs for every channel, every week — tidy, and quietly suspect, because it's observational. The geo-lift experiment produces a causally clean estimate for one channel, occasionally — clean, and noisy, and sometimes flatly contradicting the model. Faced with two numbers that disagree, teams do the worst possible thing: they pick the one they like.

The fix is to stop treating them as rivals and wire them into a single loop. The model tells you _which experiment is worth running_. The experiment _calibrates the next model_. Run it a few cycles and the uncertainty on your highest-stakes channels contracts on purpose instead of by luck. This post is the mechanics of that wiring.

## Two kinds of "worth knowing"

Before you run anything, you have to rank what to learn — and there are two genuinely different notions of value here that people constantly conflate.

**Epistemic value — expected information gain (EIG)** — asks how much an experiment would shrink your uncertainty about a channel's effect, full stop. It rewards high-variance channels regardless of how much you spend on them.

**Instrumental value — expected value of information (EVOI)** — asks how much that uncertainty is _costing you in dollars_: how often resolving it would actually flip a budget decision. A workhorse channel at 30% of spend with moderate variance has far higher EVOI than a boutique channel at 1% of spend with wild variance, even though the boutique channel wins on EIG.

You need both, and they sort channels into a 2×2:

- **High EIG, high EVOI** — run it now.
- **High EIG, low EVOI** — run it to build calibration infrastructure, eventually.
- **Low EIG, high EVOI** — watch it, but there's little to learn.
- **Low EIG, low EVOI** — leave it alone.

Testing your most _uncertain_ channel and testing your most _consequential_ channel are different strategies. The matrix keeps you from mistaking one for the other.

## The update is just precision, added

The reason this loop is tractable rather than a vague aspiration is the Bayesian conjugate update, which is almost suspiciously simple. The MMM posterior on a channel becomes the prior. The experiment supplies a likelihood. Combine them and, in the Gaussian case, **precisions add**:

$$\sigma_{\text{post}}^{-2} = \sigma_0^{-2} + \sigma_e^{-2}$$

Inverse variance is precision, and it's additive — so whichever source is more precise pulls the combined estimate harder toward itself. The liberating consequence: an experiment doesn't have to be precise in absolute terms. It only has to be _more precise than your prior at the margin_. A sloppy experiment on a channel you know nothing about can move your beliefs more than a pristine experiment on a channel you've already pinned down.

That also tells you experiments have sharply diminishing returns. Expected information gain for a channel works out to

$$\mathrm{EIG} = \tfrac{1}{2}\log\!\left(1 + \frac{\sigma^2}{\sigma_{\text{exp}}^2}\right)$$

— a signal-to-noise ratio inside a log. Going from a 1× to a 4× precision ratio buys you about a bit. Going from 4× to 16× buys you _one more_. Pouring budget into making an already-good experiment four times tighter is almost always worse than spending it on a channel you haven't touched.

## Why you should run two or three tests, not eight

There's a structural reason to keep experiment programs small, and it's not just budget. The information from a _portfolio_ of experiments is **submodular** — each added test contributes less than it would have in isolation, because the tests partly inform each other. Submodularity is exactly the condition under which greedy selection is near-optimal: the classic Nemhauser–Wolsey–Fisher result guarantees that just picking the top-scoring experiments one at a time captures at least 63% of what the optimal portfolio would. So you don't need a sophisticated combinatorial optimizer. Rank by EIG and EVOI, run the top two or three this cycle, and stop. The fourth and fifth tests are usually buying scraps.

## Calibration: turn the experiment into a prior

When the readout lands, the principled way to fold it in is the **soft prior**: the experiment's posterior becomes the MMM's prior on that channel for the next fit.

$$p(\theta_k) \;\leftarrow\; p(\tau_k \mid \hat{y}_k)$$

The word _soft_ is load-bearing. The tempting shortcut — plug the experiment's point estimate in as a fixed, known parameter — throws away its standard error and stamps false confidence onto everything downstream. Keep the experiment's uncertainty; let precision-weighting do its job. The genuinely hard part is the unit conversion: a geo-lift speaks in incremental outcome-per-dollar, the MMM coefficient lives in its own scale, and mapping cleanly between them is where the real work hides.

A nice property of doing it this way: most production geo-lift estimators are frequentist — difference-in-differences with two-way fixed effects, synthetic control, augmented synthetic control. They feed straight in. A point estimate and its standard error _are_ a Gaussian likelihood:

$$\hat{\beta}_k \mid \theta_k \sim \mathcal{N}\!\left(\theta_k,\ \mathrm{SE}_k^2\right)$$

Your stakeholders keep seeing confidence intervals and p-values; the model sees a precision-weighted posterior. Same numbers, two correct readings. Nobody has to switch tools or religion.

## Evidence has a shelf life

A calibration is not forever. Markets drift, creative fatigues, competitors move, and a channel you nailed a year ago is a channel you now only _think_ you know. So the effective uncertainty on a calibrated channel grows back over time:

$$\sigma_{k,\text{eff}}^2(t) = \sigma_{k,\text{post}}^2 \cdot \exp(\lambda_{\text{decay}}\, t)$$

with faster decay for volatile digital (re-test in 6–12 months) and slower for stable broadcast (18–24 months). Re-experimentation should fire when the uncertainty balloons past a threshold — on a schedule tied to how fast that channel's evidence ages, not the calendar. A channel you deprioritized three cycles ago can climb back to the top of the matrix simply because its evidence went stale.

## Why bother: it compounds

The payoff isn't any single sharper number; it's the trajectory. Each cycle, the model points at the most valuable unknown, an experiment resolves it, the posterior tightens, and budget slides toward the channels you can now defend. Across a representative five-channel portfolio over five quarterly cycles, the framework's simulations show weekly misallocation cost falling by roughly 92% and decision efficiency climbing about 25 points — on about three experiments per cycle, because submodularity caps the useful number.

This is the loop I keep coming back to in this work: the model decides what's worth testing ([prioritization is an information-theoretic problem](/posts/designing-experiments-to-maximize-information/)), the experiment decides what's true, and the result makes the next model better. Neither instrument is trustworthy alone. Wired together, they get less wrong every quarter — which is the most you can honestly ask of measurement. (It only works if the model was [pre-specified and honest](/posts/building-a-pre-specified-bayesian-mmm/) to begin with; a spec-shopped model calibrated against an experiment just launders the bias.)
