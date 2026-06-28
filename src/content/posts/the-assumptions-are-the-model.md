---
title: "The Assumptions Are the Model"
author: Matthew Reda
pubDatetime: 2026-06-28T08:00:00Z
slug: the-assumptions-are-the-model
draft: false
tags:
  - statistics
  - causal-inference
  - regression
  - measurement
description: A model is a dumb number-crunching machine. Put data in, get numbers out — and unless something breaks loudly, those numbers look exactly as confident when your assumptions hold as when you've shredded them. The meaning was never in the arithmetic. It was in the assumptions.
---

A statistical model is a dumb number-crunching machine. You put data in one end and numbers come out the other, and unless something goes badly enough wrong to throw an error — a singular matrix, a chain that won't converge — it will _always_ give you numbers. Coefficients, intervals, p-values, a decomposition, a ranked list of drivers. The machine does not know what the numbers mean. It doesn't know whether they mean anything at all. It computed a function of your data and handed back the result, and the result looks identical whether or not it's worth the paper it's printed on.

That's the whole problem in one sentence: **the output carries no record of whether the assumptions that make it interpretable were true.** A coefficient estimated under conditions where it identifies a causal effect, and the same coefficient estimated under conditions where it identifies nothing, are printed in the same font, with the same number of decimal places, sitting inside intervals that look equally tight. The model is not lying to you. It can't lie, any more than a calculator can. It's just answering the question its arithmetic encodes, and you supplied the assumption that that question was the one you cared about.

## There is no warning light

When code has a bug, you usually find out. It crashes, or returns garbage so obvious you can't miss it, or fails a test. The failure is _loud_. Violated modeling assumptions are the opposite. They are the quietest failure mode in all of applied work, because the symptom of a violated assumption is **a perfectly normal-looking number.**

Multicollinearity doesn't print a warning; it just inflates your standard errors and flips a sign, and the flipped sign reads as a finding. An endogenous regressor doesn't announce itself; it just biases a coefficient, and the biased coefficient sits in a tidy 95% interval that excludes zero. A model fit to a violated exchangeability assumption still produces a posterior, and the posterior is just as narrow as one you'd trust. The interval is a statement about sampling variability _conditional on the model being right_. It has nothing to say about the model being wrong. So the one number people reach for to gauge confidence — the width of the interval — is silent on the failure mode that should actually scare them.

This is why "the model ran and the results look reasonable" is worth almost nothing as a check. Of course they look reasonable. Producing reasonable-looking numbers from any input is the one thing the machine is guaranteed to do.

## Three ways I've watched it happen

Abstractions are easy to nod along to, so let me make this concrete with three failures I've actually seen in production models — each one a case where the arithmetic was flawless and the interpretation was rubble.

**Random slopes read as per-geo causal effects.** Picture a hierarchical model across geographies. The dependent variable has been normalized _within each group_ — each geo's sales standardized against that geo's own mean and spread. Then random slopes are estimated and read off geo by geo: "this market responds more than that one; here's a different causal effect per region." It's a compelling story and the numbers cooperate beautifully. But a slope here is in units of _within-geo-normalized_ sales per unit predictor. A geo with low internal variance had its sales divided by a small number, which mechanically inflates its slope. So a "bigger" coefficient can mean nothing more than "this market is internally stable" — the normalization is doing the talking, not the media. Worse, when the predictor is a _national-level_ variable that moves identically across every geo, there's almost no within-geo signal to identify a geo-specific response at all; what you're reading as heterogeneity is mostly shrinkage and noise wearing a costume. The model will hand you fifty distinct slopes regardless. It has no way to tell you that the differences between them aren't real. (This is the [within-versus-between trap](/posts/within-between-persons/) wearing geographic clothes: a coefficient that silently blends two questions and lets you read whichever one flatters the deck.)

**Unstandardized coefficients compared as if they were effect sizes.** Leave the predictors on their native scales — dollars of spend next to a 0/1 holiday flag next to a price index — and the raw coefficients are in incommensurable units. A small number on a large-scale variable and a large number on a small-scale variable tell you nothing, by comparison, about which lever matters more. Yet the coefficients line up in a single column and get ranked, and "ranked coefficient" silently becomes "ranked importance." The arithmetic is correct to the last digit. The comparison it invites is meaningless. (Scale also quietly distorts the estimates themselves once you add [measurement error in the predictors](/posts/measurement-error-in-predictors/) — another violation that returns a confident, attenuated number with no warning.)

**P-values repurposed as a variable selector.** Fit the full model, drop everything with $p > 0.05$, refit, and report what survives — with its p-values, standard errors, and intervals presented as though they still mean what the textbook says. They don't. A p-value's normative properties — its calibration, its Type I error guarantee — are defined for a _single pre-specified test_, not for the survivor of a search that conditioned on significance. Selecting on significance and then reporting significance is circular: you kept the variables that looked strong _by chance_ and then used the same inflated statistics as evidence they're strong. The machine prints $p = 0.012$ either way. It has no field for "but this one survived a selection process that voided its guarantees." I've written about [why this breaks MMMs specifically](/posts/variable-selection-mmm/); the general lesson is that a statistic detached from the procedure that justifies it is just a number that happens to be between 0 and 1.

In all three cases nothing _broke_. No error, no crash, no diagnostic in the red. The model did exactly what it was built to do, and what it was built to do was compute — not to notice that the assumptions licensing the interpretation had been violated.

## The assumptions are the actual deliverable

Here is the reframe that I think matters. We talk as if the model is the thing we build and the assumptions are fine print attached to it. It's backwards. The arithmetic — least squares, MCMC, whatever — is a commodity; any library does it. The _assumptions_ are the entire intellectual content of the analysis. They are what turn a number into a claim. "This coefficient is the causal effect of spend" is not something the data told you; it's something _you_ asserted, by way of an identification argument, an exchangeability assumption, a choice of adjustment set, a scale, a functional form. The model just carried your assertion through the arithmetic and handed it back numerically.

Which means when you present results, the assumptions are not the caveat slide at the end. They _are_ the finding. A reported effect is exactly as credible as the weakest assumption it rests on, and no more — and since the number looks the same either way, the assumption is the _only_ place the credibility actually lives. This is the real argument for [pre-specifying the whole model](/posts/building-a-pre-specified-bayesian-mmm/) before you see the results: not bureaucratic discipline, but the recognition that once the confident-looking numbers are on the screen, no one — including you — can tell by looking whether they earned their confidence.

So, concretely:

- **Write the assumptions down before the model runs**, and write them as claims you'd defend, not hedges you'd hide. What identifies this effect? What has to be true for this coefficient to mean what I'll say it means? If you can't state it, you don't have a finding, you have a number.
- **Check the assumptions you can check, and flag the ones you can't.** Exchangeability, the adjustment set, the scale of comparison, the independence of the selection step from the inference. Most of these aren't testable from the data alone — which is the point. They're assumptions, not outputs.
- **Report sensitivity, because the interval won't.** Refit under the defensible alternatives — a different baseline, a different scaling, a different control set. If the answer moves, _that range is your real result_, and it's information the within-model interval structurally cannot give you.
- **Distrust the clean number most.** The output looking authoritative is not evidence the assumptions held. It's the default behavior of the machine, and it's exactly what a catastrophic violation also looks like.

The model will give you a number. It will always give you a number; that's the easy part, and it was never the part that mattered. Whether that number means anything was decided before the machine ever ran — in the assumptions you made, stated or not, checked or not. Those assumptions are the model. The rest is arithmetic.

---

_Related: [The Illusion of Significance](/posts/variable-selection-mmm/) on p-value selection, [The Effect You're Looking For Isn't in Your Panel Data](/posts/within-between-persons/) on within-versus-between effects, [Measurement Error in Predictors](/posts/measurement-error-in-predictors/) on attenuation, and [Building a Pre-Specified Bayesian MMM](/posts/building-a-pre-specified-bayesian-mmm/) on committing to assumptions before the numbers arrive._
