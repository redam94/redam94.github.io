---
title: "Cannibalization and Complementarity: The Interaction Terms Your MMM Is Skipping"
author: Matthew Reda
pubDatetime: 2026-07-18T13:12:07Z
slug: channel-interactions-mmm
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - experimental-design
  - statistics
description: Standard MMMs treat channels as independent — but pmax cannibalizes branded search and Reddit amplifies Amazon. Here's how to model those interactions, why they're hard to identify, and what to do when a channel can't be randomized.
---

Every marketing mix model I've built starts from the same structural assumption: channels contribute independently. TV adds its effect; search adds its effect; pmax adds its effect — and the total is the sum. That's a convenient assumption and it's usually wrong, and the way it's wrong matters for how you allocate budget.

Some channels cannibalize each other. Pmax and branded search share inventory: when pmax is active and bidding aggressively on branded queries, it competes with your own search campaigns for the same clicks. Running more pmax doesn't just add revenue on top of search — it partially absorbs search's contribution. The net effect is smaller than the sum of the parts.

Other channels complement each other. Demand-gen channels like Reddit or YouTube surface intent; conversion channels like search and Amazon harvest it. Reddit spend this week can lift search conversions next week — not because Reddit directly converts, but because it primed the funnel. Here the net effect is *larger* than the sum.

Neither of these dynamics shows up in a main-effects-only model. The coefficients look fine. The attribution adds up to the observed sales. But the ROAS estimates are wrong in a specific direction: channels that cannibalize each other will look more valuable than they are in isolation, because the model attributes their shared effect to each independently.

## The math

The response surface in the Augur continuous-learning framework ([`mmm-framework`](https://github.com/redam94/mmm-framework)) makes this explicit. Per geo-week, the incremental response to a spend vector $s \in \mathbb{R}^K$ is:

$$f_c(s_c) = \frac{s_c^{\alpha_c}}{\kappa_c^{\alpha_c} + s_c^{\alpha_c}} \qquad \text{(Hill saturation, bounded in [0,1])}$$

$$\text{incremental}(s) = \sum_c \beta_c f_c(s_c) + \sum_{c < c'} \gamma_{cc'} f_c(s_c) f_{c'}(s_{c'})$$

The $\gamma_{cc'}$ parameters are the interaction terms. When $\gamma_{cc'} > 0$, two active channels together produce more than the sum of their separate contributions — complementarity. When $\gamma_{cc'} < 0$, they compete — cannibalization. A main-effects-only model is the special case $\gamma_{cc'} = 0$ for all pairs, an assumption that's rarely checked.

## The prior carries domain knowledge

You often know the *sign* of an interaction before the model runs, even if you can't estimate the magnitude from data alone. That's precisely what sign-informed priors are for:

```python
PAIR_SIGNS = {
    ("pmax", "search"):  "neg",   # shared inventory → cannibalization, γ ≤ 0
    ("pmax", "reddit"):  "weak",
    ("pmax", "amazon"):  "zero",  # negligible relationship
    ("search", "reddit"): "pos",  # demand-gen + harvest → complementarity, γ ≥ 0
    ("search", "amazon"): "weak",
    ("reddit", "amazon"): "pos",  # same complementarity logic
}
```

With those signs established, the priors are:

| Sign label | Prior on $\gamma$ |
|------------|-------------------|
| `neg` | $-\text{HalfNormal}(\sigma_\gamma)$ — constrained non-positive |
| `pos` | $\text{HalfNormal}(\sigma_\gamma)$ — constrained non-negative |
| `zero` | $\mathcal{N}(0,\, 0.05\sigma_\gamma)$ — tightly regularized to near-zero |
| `weak` | $\mathcal{N}(0,\, \sigma_\gamma)$ — weakly informative, sign unknown |

The prior scale $\sigma_\gamma$ (around 0.8 in the reference implementation) is the most consequential knob: too tight and a real synergy gets crushed toward zero; too diffuse and the interaction terms absorb main-effect signal. Which brings up the identification problem.

## You need the right experimental design

Here's the uncomfortable part: main-effect experiments don't identify interaction terms. If you design your geo experiment by varying each channel in isolation — pmax up in geo A, search up in geo B, Reddit up in geo C — you can estimate each $\beta_c$ cleanly, but $\gamma_{cc'}$ stays prior-dominated. You never observe what happens when two channels move jointly.

The central-composite design in the framework solves this by adding **off-axis cells**: geo clusters where *two* channels are varied simultaneously. These are the only cells that expose $\partial^2 R / \partial s_c \partial s_{c'}$, the second partial derivative that $\gamma$ is identified from. Without them, the interaction posterior is essentially the prior.

There's a second, subtler problem: if you omit the off-axis cells *and* the shutoff cells (where one channel is set to zero), the interaction terms can absorb main-effect signal and attenuate the $\beta$ estimates. You end up with main effects that are too small and interaction effects that are prior-dominated — wrong in both directions.

## What to do with channels that can't be randomized

Some channels simply can't be varied in a geo experiment. Amazon is the canonical example: a walled garden with national-level bidding, no geo override, no holdout mechanism. You can't run Amazon down in a set of DMAs while leaving it up elsewhere.

The right response is to demote those interaction terms explicitly:

```python
# Demote Amazon: its interactions become prior-dominated
pair_signs = demote_channel(base_pair_signs, "amazon")
probe_pairs = probe_pairs_excluding("amazon")  # no off-axis cells for amazon

design = central_composite(center, delta, probe_pairs)
```

Amazon's main effect — $\beta_{\text{amazon}}$ — can still be estimated from the pre-period baseline and temporal variation. Its interactions with other channels ($\gamma_{\text{amazon}, c'}$) become prior-dominated, which is honest: you don't have the experimental leverage to identify them. Flag those parameters in the output and don't report their magnitudes as data-driven.

## Prior sensitivity is non-optional

Because interaction magnitudes are weakly identified even with a good design, prior sensitivity checks are not optional. Refit at $\sigma_\gamma \in \{0.4, 0.8, 1.6\}$ and see how much each $\gamma$ moves. Parameters whose posteriors track the prior are telling you what the design can't resolve; parameters that stabilize across priors are telling you what it can.

The sign of $\gamma$ recovers robustly in most cases — the domain-informed direction is enough to get that right. The *magnitude* is often prior-sensitive, especially for weakly probed pairs. Report sign-reliable, magnitude-assumed wherever that distinction applies.

## The practical upshot

Dropping interaction terms is a modeling choice with a cost. If pmax genuinely cannibalizes branded search, a main-effects model will overstate both their individual ROASes, the combined ROAS will look better than it is, and the optimization will recommend over-investing in both. The interaction isn't just a technical correction — it's the term that tells you you're double-counting.

The fix requires two things: an experimental design with off-axis cells that actually identify the interactions, and priors whose signs reflect what you know before the data. Those two ingredients — designed variation plus encoded domain knowledge — are exactly how the mmm-framework approaches the problem, and neither is a default in most off-the-shelf MMM tools.

---

*The response surface and sign-informed interaction priors described here are implemented in [`mmm-framework`](https://github.com/redam94/mmm-framework) under `geo_rsm/model.py`, with the experimental design in `geo_rsm/design.py`. The central-composite geo design and off-axis cell logic are described in detail in `assets/continous_learning.md` in the same repo. Related posts: [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/), [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/).*
