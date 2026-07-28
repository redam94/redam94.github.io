---
title: "When TV Primes Search: Synergy, Cannibalization, and MMM Identification"
author: Matthew Reda
pubDatetime: 2026-07-28T13:22:43Z
slug: channel-synergy-identification
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - causal-inference
description: Standard MMMs are additive by design — every channel contributes independently. When channels interact, the model has no mechanism to say so. Here's what a synergy term looks like, why sign is more trustworthy than magnitude, and what it takes to actually identify it.
---

Every standard MMM assumes, structurally, that channels don't talk to each other. TV's contribution to sales and paid search's contribution to sales add up independently. The model has no mechanism to say "TV flights make paid search work harder" or "brand display and performance social are stealing the same attention." It just adds.

That assumption is almost certainly wrong for some channel pairs. The question is whether the data can tell you which pairs and by how much — or whether you're just encoding a prior belief with a regression wrapper.

## The additive assumption

A typical MMM predicts the outcome as:

$$\mu_t = \text{baseline}_t + \sum_c \beta_c \cdot \text{sat}_c(\text{adstock}_c(x_{c,t}))$$

Each channel's contribution is a scalar coefficient times its transformed spend. The sum. That's it. There's no term that captures "when TV is high and paid search is also high, the combined effect is larger than the sum." The function is linear in its transformed inputs.

This is fine for channels that genuinely operate in separate mechanisms — brand TV and promotional email, say. It's probably wrong for channels that share a consumer journey. TV creates awareness and intent; search captures it. If TV is pulsed off, paid search sometimes goes up (more direct traffic, fewer branded searches), sometimes goes down (less primed intent). Neither pattern is expressible in an additive model.

## What an interaction term adds

The simplest extension adds a bilinear term for a named channel pair:

$$\mu_t = \text{baseline}_t + \sum_c \beta_c \cdot s_c(x_{c,t}) + \sum_{(i,j)} \beta_{ij} \cdot s_i(x_{i,t}) \cdot s_j(x_{j,t})$$

where $s_c(\cdot) = \text{sat}_c(\text{adstock}_c(\cdot)) \in [0, 1]$ is the channel's saturated response (so the term is naturally bounded and doesn't blow up as spend grows). A positive $\beta_{ij}$ says the two channels together deliver more than their independent contributions sum to — synergy. A negative $\beta_{ij}$ says they cannibalize.

In `mmm-framework`, you declare this explicitly:

```python
from mmm_framework.config import ChannelInteraction

config = (
    ModelConfigBuilder()
    .with_channel_interactions(
        ChannelInteraction(
            channel_a="TV",
            channel_b="Search",
            expected_sign="positive",   # HalfNormal prior — only lifts
            prior_sigma=0.3,
        ),
        ChannelInteraction(
            channel_a="Display",
            channel_b="Social",
            expected_sign="any",        # Normal prior — could go either way
            prior_sigma=0.3,
        ),
    )
    .build()
)
```

`expected_sign` encodes a structural belief. TV → Search is a halo story — you believe TV intent-primes branded search clicks, so "positive" is right. Display and paid social might be complementary or they might be fighting for the same scroll — "any" is honest. The prior shrinks the interaction toward zero by default, which is correct: without strong evidence, the additive model should be the posterior center.

The interaction contribution is reported as a separate component ("Synergy / Interactions") in the decomposition waterfall, not credited to either channel. That matters for attribution: a TV×Search synergy isn't earned by TV alone or Search alone — it's the joint behavior. Allocating it to either channel overstates that channel's standalone value.

## The identification problem

Here's the uncomfortable part. In observational data, channels that interact tend to move together. TV flights during peak season; branded search volume also peaks during peak season. The interaction term $s_i \cdot s_j$ is highly collinear with $s_i$ and $s_j$ separately, because when either one is high the other usually is too.

The consequence is that the regression can't cleanly distinguish "TV contribution + Search contribution" from "synergy contribution." In the posterior, $\beta_{TV}$, $\beta_{Search}$, and $\beta_{TV \times Search}$ form a ridge. Many combinations fit the data nearly equally. The prior is then doing most of the work — whatever $\beta_{ij}$ estimate you get is heavily shaped by `prior_sigma`, not the likelihood.

This is not a model failure; it's the correct Bayesian statement. The model is telling you it doesn't know. The practical implication is that **sign is more trustworthy than magnitude**. If you have a strong prior that TV primes search, and the posterior supports $\beta_{ij} > 0$, that's evidence in the direction you expected. The size of the estimate — how much synergy — is unlikely to be well-identified without variation you didn't have.

A stress test on a synthetic world with a planted $\beta_{TV \times Search} > 0$ confirms the sign recovery but not tight magnitude recovery. That's the right bar to hold yourself to.

## What actually identifies a synergy

To properly identify the interaction term, you need the channels to vary *independently* in a way that isolates the joint effect from the main effects. In practice that means:

- **Independent geo holdouts.** Run TV in some markets and not others, independent of your search budget. The interaction varies across markets as a function of the TV condition, not just correlated with overall activity level.
- **Staggered flight timing.** If TV flights and search budgets sometimes coincide and sometimes don't — by design, not accident — the regression can separate "both on," "only TV," "only search," and "neither."
- **Experiment over the interaction directly.** Fix search at two levels, then vary TV across those cells. A $2 \times 2$ geo design with both variables toggled is expensive but gives you exactly what observational data never provides: uncorrelated variation.

Without something like this, the synergy term's magnitude is controlled by the prior. The sensible thing to do — and what the shrink-to-zero default in `mmm-framework` does — is treat the prior as a regularizer that keeps the interaction from explaining variance it doesn't deserve credit for. The posterior might say $\beta_{ij} = 0.08$ with a wide interval; take the wide interval seriously and resist the temptation to build media plans around the point estimate.

## What this means for planning

If you can't identify the interaction, should you still include it? Probably, for a few reasons. First, not including it doesn't mean it doesn't exist — an omitted interaction whose true effect is positive will bias whichever main-effect channel happens to be more correlated with the product term. Second, the reporting separation prevents the synergy from being credited to either channel's ROAS, which is the right thing to do even if the magnitude is uncertain. Third, the prior-mean-zero default means you've done no harm to the additive baseline — the interaction term collapses toward zero unless the data pushes it away.

The mistake is using a posterior interaction estimate with a 90% CI that spans zero as if it's a confirmed finding. "We verified that TV primes search" requires the variation to make that case. A posterior that just recovered your prior is not verification.

---

_The `ChannelInteraction` feature, identifiability caveats, and the planted-synergy stress test are documented in `technical-docs/cross-channel-synergy.md` and `tests/test_channel_interactions.py` in the [mmm-framework](https://github.com/redam94/mmm-framework). Related posts: [Adstock and Saturation Are Not Separately Identified](/posts/adstock-saturation-identification/), [Collinearity: When the Data Can't Separate What You Asked It To](/posts/collinearity-cant-separate/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/)._
