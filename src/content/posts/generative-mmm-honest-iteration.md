---
title: "All Models Are Wrong, So Make Yours Generative"
author: Matthew Reda
pubDatetime: 2026-06-28T06:15:00Z
slug: generative-mmm-honest-iteration
draft: false
tags:
  - bayesian
  - marketing-mix-modeling
  - measurement
  - causal-inference
description: If you can't run your model forward to simulate data, you don't understand it. Generative modeling turns that test into a workflow — and exposes the gap between a model that fits and a model that's right.
---

George Box's line — "all models are wrong, but some are useful" — gets quoted so often it's lost its teeth. People use it as a shrug, a way to excuse a model they can't defend. I read it as a demand. If every model is wrong, then the only thing worth arguing about is _which wrongness you chose and whether it's the right wrongness for the decision in front of you_. A marketing-mix model that's wrong in a way that misattributes demand to media is useless. A simpler one that's wrong in ways that don't touch the decision is fine. The craft is in picking your errors deliberately.

The discipline that makes this possible is **generative modeling**, and it comes with a sharp test of understanding: _can you run the model forward to simulate data you haven't seen?_ If you can't generate plausible fake sales from your model, you don't actually understand what it claims about the world. That test, taken seriously, reorganizes the whole workflow.

## Tell the generative story first

Before any data, write the story of how the numbers come to exist. For an MMM it goes roughly:

1. There's a baseline level of sales that would happen with no marketing at all.
2. That baseline moves over time — trend and seasonality.
3. Media lifts sales _above_ baseline.
4. Those lifts carry over (adstock) and saturate (diminishing returns).
5. The outside world intrudes — weather, the economy, competitors.
6. What you observe is the sum, plus noise.

$$\text{sales}_t = \text{baseline}_t + \sum_m \text{media-effect}_{m,t} + \text{external}_t + \varepsilon_t$$

This isn't decoration. It's a commitment to a data-generating process, and it forces every assumption into the open — what saturates, what carries over, what's confounded by what. A model you can write as a generative story is a model whose wrongness you can inspect. A black box that emits a ROAS is not.

## Two checks the story buys you

Once the model can generate data, two diagnostics fall out almost for free, and they bracket the fit on either side.

**Prior predictive checks** run _before_ you touch the data. Sample parameters from your priors, push them through the generative process, and look at the sales it invents. Does it ever produce negative sales? Lifts ten times larger than your whole category? If your priors imply nonsense before the data arrives, the data won't save you — they'll just be overruled by a likelihood fighting an absurd prior. Fix the story.

**Posterior predictive checks** run _after_ fitting. Generate replicated datasets from the posterior and ask whether they look like reality — the right distribution, the right seasonal shape, the right occasional spike. If the model can't reproduce the data it was trained on, it certainly can't be trusted to reason about counterfactuals.

This whole arc — question, story, prior check, fit, diagnostics, posterior check, revise — is a cycle, and where you re-enter it matters more than people admit.

## Honest iteration versus specification shopping

Here is the line that separates science from self-deception, because both involve changing the model after you've started.

**Legitimate iteration is diagnostic-driven.** You revise because the sampler diverged, because the posterior predictive check failed on a feature you care about, because domain knowledge told you a structure was missing. The trigger is a problem with the _model_, surfaced before you looked at the answer.

**Specification shopping is result-driven.** You revise because the coefficient came back the wrong sign, because a channel wasn't "significant," because the ROAS missed the number the deck needed. The trigger is the _answer_, and steering toward an answer across many specifications is how you harvest the one where noise happened to help. Pick the best of $N$ specifications and your estimate carries a systematic upward bias — the winner's curse — and it won't replicate.

The defense is pre-specification: commit to the structure before the results are visible, and label every later change as planned or exploratory. Same idea as [the Table 2 fallacy](/posts/table-2-fallacy/), one level up — there the trap is misreading a coefficient; here it's choosing the model that produces the coefficient you wanted.

## The part nobody wants to hear: fitting well is not enough

Now the uncomfortable truth that generative checking alone can't fix. **A model can pass every posterior predictive check and still be causally wrong.** It can reproduce your sales history beautifully — distribution, seasonality, spikes, all of it — while systematically crediting the wrong channels. Posterior predictive adequacy tells you the model captured the _joint behavior of the observed data_. It says nothing about whether the _decomposition_ into "this channel caused that" is right, because many different attributions can fit the same aggregate curve equally well.

I find the framework's internal stress tests sobering on exactly this point: across sixteen synthetic scenarios with known ground truth, **eight produced material attribution errors while the computational diagnostics looked perfectly healthy.** Convergence was fine. $\hat{R}$ was fine. Posterior predictive checks passed. And the channel ROIs were wrong. If you only ever validate against the data the model was fit on, half the time you'd never know.

That's why the generative workflow has to end somewhere outside itself — in **external validation**: a geo-lift test, a randomized holdout, real experimental evidence that the observational fit can be checked against. Fit quality is necessary and nowhere near sufficient. The strongest thing you can say about a purely observational MMM is that it's a well-specified hypothesis.

## The identification contract

The way I've tried to make this honest rather than hand-wavy is to write down the identification assumptions explicitly — the conditions under which the model's causal claim actually holds — and to label each one _testable_ or _untestable_. Seven of them, stated up front, pressure-tested against a public scorecard. It's not glamorous. But "here are the seven things that must be true for this number to mean what I say it means, and here's which ones I can check" is a far more defensible artifact than a tight credible interval with no provenance.

## What to take from this

Start with the simplest model whose generative story you believe. Add complexity only when a diagnostic _demands_ it, never because the answer disappointed you. Check the priors before the data and the predictions after. And then — knowing that a perfect fit can still be a perfect lie about attribution — go test the thing against an experiment.

All models are wrong. The generative ones are at least wrong _out loud_, where you can see it.
