---
title: "Coincidence Is Not Contribution"
author: Matthew Reda
pubDatetime: 2026-06-28T06:00:00Z
slug: coincidence-is-not-contribution
draft: false
tags:
  - marketing-mix-modeling
  - causal-inference
  - measurement
  - bayesian
description: A marketing-mix model answers a causal question — what would sales have been without this media — not "what moved together." Most MMMs quietly answer the easier question and dress it up as the hard one.
---

A marketing-mix model is asked a causal question and usually answers a correlational one. The question on the table is a counterfactual: _what would sales have been if we hadn't run this media?_ The number most MMMs actually produce is the answer to something far cheaper: _what moved together over the last two years?_ Those are not the same question, and the gap between them is where most marketing measurement quietly goes wrong.

I've been building [`mmm-framework`](https://github.com/redam94/mmm-framework) around a single uncomfortable premise: that the difference between coincidence and contribution is the entire job, and that almost everything else — fancier saturation curves, more channels, prettier dashboards — is decoration if you get that part wrong. This post is about what taking the causal question seriously actually demands.

## The cheap answer and why it's tempting

Suppose your paid search spend rises every December and so do sales. A correlational model happily credits search for the December lift. But search spend rises in December _because demand rises in December_ — the holiday is a confounder driving both. The honest counterfactual is that most of those sales would have happened anyway. Credit search for them and you'll over-fund it next year, starving a channel that was actually doing the work.

This is not an exotic failure. It's the default. Any variable that moves both your media plan and your sales — seasonality, promotions, distribution, price, a competitor going dark — biases the coefficient unless you've explicitly closed the path. The math doesn't know the difference between a channel that _caused_ sales and one that merely _accompanied_ them.

## Specification shopping: painting targets around arrows

The second failure is subtler and, I'd argue, more corrosive, because it looks like diligence. You fit a model. The TV coefficient comes back negative, which can't be right, so you add a control. Still off, so you change the adstock decay. Now the numbers "look right," so you stop. Each individual move was defensible. Collectively, you fired an arrow and painted the target around where it landed.

When you iterate on a specification until the results match your expectations, you are selecting, out of many possible models, the one whose _noise_ happened to flatter your priors. The reported uncertainty no longer means anything — it's conditioned on the outcome you steered toward. This is the same disease as p-hacking, and it inflates false positives just as reliably. (I've written about the regression-level version of this in [the Table 2 fallacy](/posts/table-2-fallacy/) and its [MMM-specific form](/posts/table-2-fallacy-in-mmm/).)

The structural fix is not a better model. It's a procedural commitment: **lock the specification before you see what it says about your channels.** Pre-register the likelihood, the priors, the controls, and the identification strategy; fit once; report the posterior. The discipline is the deliverable. (More on the mechanics in [building a pre-specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/).)

## Where variable selection is allowed — and where it isn't

There's one place this bites hard enough to deserve its own rule. Automated variable selection — stepwise regression, spike-and-slab, "let the model pick" — is fine for _precision controls_: nuisance regressors you include only to soak up residual variance. It is never acceptable for **confounders, mediators, or the media variables themselves**. Letting an algorithm decide whether to keep a confounder is specification shopping with a respectable name; drop a confounder and you reopen the backdoor path you needed closed. I've made this case at length in [variable selection in an MMM](/posts/variable-selection-mmm/), but the one-line version: selection is a variance tool, not an identification tool.

## What you actually need: a loop

If observational data can't, on its own, separate causation from coincidence — and it can't — then the only way to know whether a coefficient is real is to _test_ it. That's the part most MMM practice skips. The framework I'm building treats the model and the experiment as two halves of one instrument:

1. **Fit** the model and get channel ROIs _with_ honest uncertainty.
2. **Find** the channels where that uncertainty is most expensive, using expected information gain and the expected _value_ of information.
3. **Run** a pre-registered experiment — a geo lift, a matched-market test, budget-neutral flighting — on the highest-value unknown.
4. **Feed back** the experimental result as a prior, and refit.
5. **Reallocate** on the sharpened estimate.
6. **Re-evaluate** as the market drifts and old answers go stale.

The model proposes; the experiment disposes; the result makes the next model better. A coefficient that's been through this loop is _calibrated_. One that hasn't is _model-only_ — still useful, but flagged as a hypothesis, not a finding. ([The calibration math is its own post.](/posts/closing-the-loop-mmm-calibration/))

## On the competition, briefly

This frame clarifies where existing tools stop. Meta's Robyn generates a Pareto frontier of candidate models and asks the analyst to choose — which quietly hands specification shopping back to you. Google's Meridian does calibrated geo-MMM well but stops after the lift test, with no machinery for prioritizing the _next_ experiment or tracking when a calibration has decayed. PyMC-Marketing is excellent and is what I build _on_; the framework adds the guardrails around it — declared variable roles, refutation checks, and the experiment loop. None of this is a knock on good tools. It's a claim about where the unfinished work is.

## The point

Tight numbers are not true numbers. A model that reports a 3.1 ROAS with a hairline confidence interval, having never been tested against a real experiment, is more dangerous than one that honestly says "somewhere between 1.8 and 4.0, and here's the experiment that would narrow it." The job isn't to produce a confident number. It's to know which of your numbers you've earned the right to believe.

Coincidence is not contribution. Everything else is engineering.
