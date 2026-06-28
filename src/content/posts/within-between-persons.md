---
title: "The Effect You're Looking For Isn't in Your Panel Data"
author: Matthew Reda
pubDatetime: 2026-06-28T16:00:00Z
slug: within-between-persons
draft: false
tags:
  - causal-inference
  - longitudinal
  - panel-data
  - statistics
description: A between-person association and a within-person effect can differ in size or even flip sign. Most longitudinal models silently estimate a blend of the two, and the model you reach for decides which question you're actually answering.
---

Here's a fact that should make you nervous about a lot of published longitudinal research. Suppose you find that more talkative people are happier. Run the numbers across people and the association is solidly positive. Now follow individuals over time and ask: on the days _you_ talk more than usual, are _you_ happier? The answer can be negative. Same variables, same data, opposite sign.

This isn't a paradox or a trick. It's the within-person versus between-person distinction, and Julia Rohrer and Kou Murayama's 2023 paper — pointedly titled _These Are Not the Effects You Are Looking For_ — argues it's one of the most consequential things people get wrong about panel data. The trouble is that the default models don't make you choose which effect you want. They quietly hand you a blend and let you read it as whichever one flatters your hypothesis.

## Two effects hiding in one coefficient

Take any predictor measured repeatedly on the same people, $X_{it}$, and split it into two pieces:

$$X_{it} = \underbrace{\bar{X}_i}_{\text{between: person } i\text{'s average}} + \underbrace{(X_{it} - \bar{X}_i)}_{\text{within: } i\text{'s deviation from it}}$$

These pieces answer genuinely different questions. The **between-person** slope asks how people who _differ in their typical X_ differ in their typical Y. The **within-person** slope asks how a single person's Y moves when _their own X_ swings above or below their personal baseline.

A naive pooled regression doesn't estimate either one. It estimates a variance-weighted average of both:

$$\hat\beta_{\text{naive}} = \lambda\,\beta_{\text{between}} + (1 - \lambda)\,\beta_{\text{within}}$$

where $\lambda$ depends on how much of your variance in $X$ is between people versus within them. When the two effects agree, the blend is harmless. When they disagree — and there's no law of nature saying they shouldn't — the blend is a number that corresponds to no real-world quantity. This is Simpson's paradox living inside your longitudinal model.

The talkativeness example makes the mechanism concrete. Extraversion is a stable trait: extroverts are habitually more talkative _and_ habitually happier, which drives a strong positive between-person association. But within one person, the days you talk more than usual might be the days you're forcing it — networking events, obligations, nerves — and on those days you're a little less happy. The between effect is $+0.3$; the within effect is $-0.2$. A pooled model can report the positive blend and bury the negative truth about how talking affects _you_.

## What each model actually estimates

Once you see the split, the standard longitudinal models stop looking interchangeable and start looking like answers to different questions.

**Fixed-effects models** estimate the within-person effect, full stop. Demeaning each person against their own average,

$$Y_{it} - \bar{Y}_i = \beta_{\text{within}}\,(X_{it} - \bar{X}_i) + (u_{it} - \bar{u}_i),$$

algebraically deletes everything that's constant within a person. That's the model's superpower: every stable confounder — genetics, personality, upbringing, anything time-invariant — vanishes _whether or not you measured it_. It's also the model's blind spot. Fixed effects do nothing about _time-varying_ confounders. A stressful week that lifts both today's X and today's Y still contaminates the estimate, because that confounder isn't constant within the person. Demeaning is not a confounding cure-all; it's a confounding-_specific_ tool.

**Cross-lagged panel models (CLPM)** chase a different quarry: does past X predict future Y, holding past Y fixed? The classic specification,

$$Y_{it} = \alpha + \beta_{\text{cross}}\,X_{i,t-1} + \phi\,Y_{i,t-1} + \epsilon_{it},$$

looks like it's modeling dynamics, but it has a notorious flaw — it doesn't separate stable traits from genuine over-time effects. The trait-level fact that extroverts are both talkative and happy leaks straight into the cross-lagged coefficient, so it conflates _who people are_ with _how they change_. The fix is the **random-intercept CLPM**: give each person latent intercepts $\mu_{X,i}$ and $\mu_{Y,i}$ that soak up the stable trait levels, leaving the cross-lagged paths to describe within-person dynamics. It's the best of both — fixed-effects-style control of stable confounders plus the ability to model reciprocal effects over time.

The uncomfortable common thread: none of them handle time-varying confounders. That's not a failure of any one model; it's a property of observational longitudinal data. More waves of data don't rescue you from a confounder that moves with your treatment.

## Estimand first, model second

The deepest point in Rohrer and Murayama isn't any particular model — it's the order of operations. Don't pick a longitudinal model because it looks sophisticated or because your field expects it. Start by writing down the **estimand**: the precise causal quantity you want, in potential-outcomes terms. _What_ intervention, on _whom_, measured _when_?

- "What is the contemporaneous within-person effect of X, assuming no time-varying confounders?" → fixed effects.
- "What is the within-person lagged effect, net of stable traits?" → random-intercept CLPM.
- "What is the average causal effect of an intervention?" → a randomized between-person comparison, and you may not need longitudinal data at all.

That last one deserves emphasis, because it cuts against a reflex. Between-person data from a _randomized_ experiment recovers an average causal effect cleanly; randomization is what buys you exchangeability, not the panel structure. Within-person data is genuinely powerful — it kills an entire class of stable confounders for free, and it's the only way to ask individual-level and dynamic questions — but it is not automatically _more_ causal than a clean experiment. It's a different question with different assumptions.

There's also a subtler trap Rohrer and Murayama flag: psychological "treatments" are often ill-defined. Inducing high talkativeness via personality, social pressure, or a researcher's prompt are different manipulations with potentially different downstream effects, which quietly violates the consistency assumption that makes a causal effect well-defined in the first place. If you can't say which version of the treatment you mean, the estimand isn't fully specified yet.

## The practical discipline

When I see a panel-data regression now, the first question I ask isn't about standard errors or fit. It's: _which effect is this coefficient — within, between, or a blend?_ Most of the time the honest answer is "a blend, and nobody decided that on purpose."

The remedy is cheap. Decompose your predictor into within and between components and put both in the model, so the two slopes are estimated separately instead of averaged into mush. Then check that the effect you report is the one your question actually asked for. Choosing the model before you've named the estimand is how you end up with a precisely estimated answer to a question you never meant to pose.

---

_Based on Rohrer & Murayama (2023), "These Are Not the Effects You Are Looking For: A Guide to Causal Inference in Longitudinal Data," Advances in Methods and Practices in Psychological Science 6(1); with Hamaker, Kuiper & Grasman (2015) on the RI-CLPM and Mundlak (1978) on the within/between decomposition. Related: [the Table 2 fallacy](/posts/table-2-fallacy/)._
