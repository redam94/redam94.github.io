---
title: "Optional Stopping Is a Frequentist Problem — With One Honest Caveat"
author: Matthew Reda
pubDatetime: 2026-07-06T13:13:18Z
slug: optional-stopping-likelihood-principle
draft: true
tags:
  - bayesian
  - statistics
  - experimental-design
  - marketing-mix-modeling
description: Evaluating a Bayesian stopping rule every wave is not frequentist optional stopping — the likelihood principle guarantees it. The real risk is something else entirely.
---

While auditing the math behind the continuous-learning loop in [`mmm-framework`](https://github.com/redam94/mmm-framework), I catalogued nine candidate gaps in its mathematical foundations. Eight were real. One — the concern about optional stopping — turned out to be a misconception so common it's worth a standalone post, because it also points at where the *actual* risk lives.

## The setup: ENBS, evaluated every wave

The continuous-learning loop runs geo-experiments sequentially. After each wave it computes the **Expected Net Benefit of Sampling** (ENBS): the expected profit gain from running one more wave, minus the cost of that wave. If ENBS ≤ 0, the program stops; the next experiment wouldn't earn back its cost.

The audit question was: if you're evaluating a stopping statistic every wave, doesn't that create optional stopping bias? Shouldn't there be O'Brien–Fleming corrections, alpha-spending, or some frequentist penance for peeking repeatedly?

The answer is no — but *why* not is the important part.

## What optional stopping actually is

Optional stopping is a **frequentist** problem. If you run a null-hypothesis significance test repeatedly and stop as soon as $p < 0.05$, your actual false-positive rate is much higher than 5%. Why? Because you're selecting the stopping time based on the test result, and each additional peek creates another chance for a random exceedance. The alpha-spending machinery — O'Brien–Fleming boundaries, Pocock corrections, sequential probability ratio tests — exists to return the error rate to the nominal level by "spending" the significance budget across planned looks.

This is a genuine problem, and the methods are well-developed. It just doesn't apply here.

## The likelihood principle

The relevant result is the **likelihood principle**: the information in an experiment's data is fully contained in the likelihood function evaluated at the observed data. The stopping rule — when you stopped and why — is not part of the likelihood. Therefore, Bayesian posteriors, which are functions of the likelihood via Bayes' theorem, don't depend on the stopping rule.

Edwards, Lindman, and Savage (1963) stated it plainly: *"the rules governing when data collection stops are irrelevant to data interpretation, and it is entirely appropriate to collect data until a point has been proven or disproven."* Berger and Wolpert (1988) gave the authoritative formal treatment. Rouder (2014) confirmed it by simulation — Bayesian quantities maintain correct long-run calibration regardless of when the analyst chose to stop.

The intuition isn't mysterious. When you update a Bayesian posterior on wave $n$'s data, you get the same posterior whether you planned from the start to run exactly $n$ waves or decided to stop after seeing wave $n-1$'s result. The data are the data; the posterior depends on the data and the prior. The stopping decision contributes nothing to the likelihood given the data you've observed.

Concretely: ENBS is a **decision-theoretic** stopping rule, not a significance test. The question isn't "did the test statistic exceed a threshold?" — a question whose answer changes as you look more. It's "is the expected return on one more experiment positive?" — a question grounded in the current posterior's honest assessment of remaining uncertainty. There is no $\alpha$ to inflate.

## Where the real risk lives

Here's the caveat that matters: the likelihood principle's immunity to stopping rules holds under a **correctly specified model**. Your posterior is stopping-rule invariant if your posterior accurately represents your uncertainty. If your model is wrong — if posteriors are narrow and biased — then the ENBS you compute from those beliefs is wrong too. Stopping early based on it is a real error. It's just not an *optional stopping* error. It's a *misspecification* error.

The misspecification study in `nbs/continuous_learning.ipynb §14` shows exactly this failure: under non-Hill response surfaces, credible intervals can be confidently tight while the recommended allocation is materially off. An overconfident posterior computes an artificially low ENBS — potentially triggering an early stop before a subsequent wave would have detected the error.

The cure for frequentist optional stopping is frequentist corrections. The cure for misspecification is model diagnosis: posterior predictive checks, [simulation-based calibration](/posts/simulation-based-calibration/), and experimental calibration against holdout results. These are different problems with different solutions.

## The practical guard

The framework's response is `stop_patience`:

```python
# mmm_framework/continuous_learning/loop.py
consecutive_stops = consecutive_stops + 1 if stop else 0
if consecutive_stops >= stop_patience or wave == max_waves - 1:
    break
```

With `stop_patience=2`, the loop requires two consecutive ENBS ≤ 0 evaluations before exiting. One wave that reads low — from a temporarily overconfident or misspecified posterior — cannot end the program alone. The parameter is a guard against **misspecification**, not against optional stopping. The distinction is in the docstring deliberately:

> Evaluating ENBS every wave is NOT frequentist optional stopping — a Bayesian expected-value rule is stopping-rule-invariant under the likelihood principle — but that invariance assumes a correctly specified model, and the misspecification study shows intervals can be narrow *and* wrong. `stop_patience=2` is the cheap belt-and-suspenders guard.

Two consecutive readings at ≤ 0 is much harder to fake under a temporarily overconfident posterior than one. It's not a statistical test. It's a robustness heuristic for a known model weakness.

## What about frequentist clients?

Occasionally a client or audit function demands a bounded false-stop rate — not a Bayesian concern, but a real organizational one. The modern tool for this is an **anytime-valid confidence sequence** (Ramdas, Grünwald, Vovk & Shafer 2023), which offers valid inference under continuous monitoring on an arbitrary, including adversarial, stopping time. This is categorically different from alpha-spending, which controls error rates only on a pre-registered look schedule. If a sequentially monitored system ever needs a frequentist guarantee, confidence sequences are the right technology — not O'Brien–Fleming.

## The point

The optional stopping concern is reasonable: it's a genuine failure mode in frequentist sequential testing, and the frequentist literature earns its complexity there. But a Bayesian expected-value stopping rule isn't frequentist testing, and conflating them leads to applying the wrong fix.

What *is* a real risk is misspecification. "Our stopping rule doesn't have an optional stopping problem" is only the first sentence. The second sentence is: it still has a model problem. Run [SBC before fitting on real data](/posts/simulation-based-calibration/), check posterior predictive coverage, calibrate against experiments, and set `stop_patience=2`. The likelihood principle handles the optional stopping concern. You handle the rest.

---

*Grounded in a gap-by-gap audit of the continuous-learning math in [`redam94/mmm-framework`](https://github.com/redam94/mmm-framework). Key references: Edwards, Lindman & Savage (1963), "Bayesian statistical inference for psychological research," Psychological Review 70(3); Berger & Wolpert (1988), The Likelihood Principle, IMS Lecture Notes 6; Rouder (2014), "Optional stopping: No problem for Bayesians," Psychonomic Bulletin & Review 21(2); Ramdas, Grünwald, Vovk & Shafer (2023), "Game-Theoretic Statistics and Safe Anytime-Valid Inference," Statistical Science 38(4). Related: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Simulation-Based Calibration](/posts/simulation-based-calibration/).*
