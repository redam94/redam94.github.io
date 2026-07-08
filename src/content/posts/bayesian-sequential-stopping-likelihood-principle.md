---
title: "The Sequential-Stopping Worry Is a Frequentist Problem (With a Bayesian Catch)"
author: Matthew Reda
pubDatetime: 2026-07-07T13:12:46Z
slug: bayesian-sequential-stopping-likelihood-principle
draft: false
tags:
  - bayesian
  - statistics
  - experimental-design
  - marketing-mix-modeling
description: The Augur continuous-learning loop peeks at results every wave and stops the moment further testing isn't worth it. That sounds like optional stopping — but under the likelihood principle, Bayesian decision-theoretic stopping rules are immune. The catch is model misspecification, not peeking.
---

When I explain how the Augur continuous-learning loop works, the first skeptical question is almost always a version of: "aren't you peeking?"

The loop runs a geo experiment, reads the results, updates the posterior, checks whether another wave is worth running, and if not, stops. That's sequential monitoring of a stopping statistic. And anyone who has spent time in A/B testing knows that sequential monitoring is how you inflate your false positive rate — which is why alpha-spending corrections (O'Brien-Fleming, Pocock, Lan-DeMets) exist in the first place.

The short answer is that the concern doesn't transfer. The longer answer is worth writing down, because the exception reveals the thing you actually should worry about.

## The frequentist problem

Alpha spending is a solution to a real problem in frequentist sequential testing. A standard p-value test at level α is calibrated for a single look at the data: if you look 5 times instead of once, your false-positive rate isn't 5% anymore — it's closer to 23% for a two-sided test at α = 0.05, and it gets worse as you add looks. The fix is to spend α across planned looks (O'Brien-Fleming spends it slowly and conservatively; Pocock spends it uniformly; Lan-DeMets lets you adjust the schedule).

All of that machinery is solving one specific problem: maintaining a calibrated bound on the probability of *rejecting the null when it's true*, across the sequence of tests. The machinery exists because the p-value under repeated testing doesn't mean what a single-test p-value means.

The stopping rule in Augur isn't a p-value test. It's a decision-theoretic criterion:

$$\text{ENBS}(\xi) = \underbrace{\mathbb{E}[\text{regret}] \cdot \text{margin} \cdot \text{population}}_{\text{value of resolving uncertainty}} - \underbrace{\text{cost}(\xi)}_{\text{wave cost}}$$

Stop when $\max_\xi \text{ENBS}(\xi) \leq 0$ — i.e., when no experiment design would pay for itself. This is an expected-utility comparison, not a null-hypothesis test. There is no null to falsely reject.

## Why the likelihood principle matters here

The immunity of Bayesian posteriors to the stopping rule is formalized by the **likelihood principle**, which Edwards, Lindman, and Savage laid out in 1963. The core statement: *all information about the parameter $\theta$ that is contained in the data is captured by the likelihood function* $p(y \mid \theta)$, evaluated at the observed $y$. Crucially, this does not depend on the stopping rule that determined when you collected $y$.

More precisely: if two datasets have proportional likelihoods — the same data, whether you stopped at $n = 40$ by design or because the last observation happened to be interesting — a Bayesian posterior treats them identically. The stopping rule is ancillary to the inference.

Berger and Wolpert (1988) formalized the argument and its implications in careful detail. Rouder (2014) ran simulations to demonstrate it empirically — showing that the interpretation of Bayes factors and posterior quantities is stable whether you stop on a schedule or stop when you feel like it. Frequentist error rates, by contrast, are definitionally about the sampling procedure, so they can't be invariant to stopping.

For ENBS specifically: the stopping criterion is a function of the posterior (via `E[regret]`, which is the spread of optimal allocations across posterior draws), so it inherits the likelihood principle's invariance. Every wave, you're asking: *given what I now believe, is another experiment worth running?* Nothing about that question depends on how many times you've asked it.

## The actual catch: model misspecification

Here is where the honest answer has to go further.

The likelihood principle holds under a correctly specified model. If your posterior is miscalibrated — if you've assigned prior distributions that pull the posterior systematically away from the truth — then ENBS can fire when it shouldn't. Your expected regret will go to zero not because you've learned the right answer but because your model has converged to a wrong one with false confidence.

This is a failure mode I've documented in the [SBC post](/posts/simulation-based-calibration/) and the [generative modeling post](/posts/generative-mmm-honest-iteration/): R-hat and ESS look healthy, the chains have mixed, and the posteriors are narrow — and the attribution numbers are wrong. SBC catches miscalibration exactly because it doesn't just check whether the sampler converged; it checks whether the posterior recovers the truth *in expectation*.

The implication for sequential stopping: a miscalibrated model is one where the stopping rule fires for the wrong reason. You've resolved your posterior uncertainty, but the uncertainty itself was underestimated. ENBS ≤ 0 in a miscalibrated model reads as "we know enough" when the honest answer is "we know nothing and our intervals are too tight to see it."

The fix is the same one that applies everywhere in Bayesian workflow: test the model before trusting the inference.

1. **SBC before deployment.** Run simulation-based calibration on the model structure once, before fitting on real data. If rank histograms are non-uniform for the decision-pivotal parameters (the ones ENBS cares about), fix the model. [More on how to run this.](/posts/simulation-based-calibration/)

2. **Prior predictive checks.** Before each wave, check that the model's prior-predictive distribution is consistent with the plausible range of outcomes. A prior that's wildly out of range for the observed data is a symptom of the misspecification that will corrupt the stopping decision.

3. **A conservative stopping guard.** If the model hasn't been stress-tested against misspecification — which is honest about any first deployment — requiring two consecutive ENBS ≤ 0 waves before halting is a reasonable belt-and-suspenders. It guards against the corner case where a single bad wave drives a spuriously tight posterior and a premature stop. It's not theoretically necessary, but it's practically defensible.

This last point deserves emphasis. A Bayesian stopping rule that's correctly specified genuinely doesn't need alpha spending. Demanding two consecutive waves is *not* the Bayesian equivalent of alpha spending — it's misspecification insurance, a different concern entirely.

## What this changes in practice

The frequentist-sequential-testing toolbox — interim analyses, alpha budgets, information fractions — is built around maintaining a bound on the probability of a wrong conclusion under repeated sampling. If you're running an ENBS-based Bayesian loop with a well-calibrated model, that toolbox is solving the wrong problem.

The right questions to ask about the stopping decision are Bayesian ones:
- Is the model calibrated? (SBC, prior predictive checks, posterior predictive checks)
- Does ENBS account for all sources of uncertainty that could flip the allocation? (Check whether `E[regret]` collapses at a plausible rate as data accumulates)
- Is there a misspecification scenario where the posterior gets confident but wrong? (Stress-test the priors on the most weakly identified parameters — [adstock and saturation](/posts/adstock-saturation-identification/) in the media case)

If the answer to the first is yes and the third is no, you can stop when ENBS says stop. Not because we're ignoring the possibility of error, but because we've moved the work to the right place: validating the model's calibration rather than correcting a calibrated statistic for peeking.

The optional-stopping worry is a frequentist worry about a frequentist procedure. The Bayesian version of that worry is: *does your posterior mean what you think it means?* That's the harder question, and unlike alpha spending, there's no formula that answers it for you.

---

*The ENBS stopping rule and the continuous-learning loop are implemented in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `planner.expected_regret`. The likelihood principle result is stated precisely in Edwards, Lindman & Savage (1963), "Bayesian statistical inference for psychological research," Psychological Review 70(3), 193–242, and formalized in Berger & Wolpert (1988), The Likelihood Principle, 2nd ed. The simulation-based confirmation is in Rouder (2014), "Optional stopping: No problem for Bayesians," Psychonomic Bulletin & Review 21(2), 301–308. Related posts: [Simulation-Based Calibration](/posts/simulation-based-calibration/), [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/).*
