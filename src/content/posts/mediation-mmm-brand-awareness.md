---
title: "TV Isn't Weak — Its Effect Flows Through Awareness"
author: Matthew Reda
pubDatetime: 2026-07-04T13:10:33Z
slug: mediation-mmm-brand-awareness
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - causal-inference
  - statistics
description: When you add brand-awareness tracking to your MMM, TV's coefficient often collapses to near zero — not because TV stopped working, but because you just blocked its mechanism. Here's the mediation math and what to do instead.
---

Here's a failure mode I've watched happen at multiple organizations. The media team runs a marketing-mix model, sees a low coefficient on TV, and concludes the channel isn't pulling its weight. Someone proposes cutting the TV budget. Then, separately, the brand-tracking team reports that awareness is at an all-time high. The two teams argue past each other for a quarter before anyone notices the contradiction.

The contradiction dissolves once you look at what the model is actually doing. If you include brand awareness as a covariate alongside TV spend, you're conditioning on the mechanism through which TV works. You get a near-zero direct effect not because TV does nothing — because TV's effect goes through awareness, and you've already accounted for awareness. This is textbook mediation, and it's one of the places where the wrong model design produces the wrong conclusion, confidently.

## The causal path matters

Standard MMMs have a flat structure: each media channel has a coefficient, and the coefficient picks up everything that channel does to the outcome. That's fine when media operates on sales directly. But brand advertising doesn't usually work that way. TV builds awareness; awareness drives consideration and purchase. The path is:

$$\text{TV} \to \text{Awareness} \to \text{Sales}$$

If you add awareness as a linear predictor alongside TV, you're writing the model:

$$\text{Sales}_t = \delta_{\text{TV}} \cdot f(\text{TV}_t) + \gamma \cdot \text{Awareness}_t + \ldots$$

The term $\delta_{\text{TV}}$ is TV's **direct** effect — the share of TV's influence that doesn't flow through awareness. If brand-building advertising is what TV is for, that direct path may be small or zero. The total effect of TV, including what it contributed by building awareness, has been absorbed by the awareness coefficient. TV looks weak; awareness looks powerful; the channel doing the driving is invisible in the coefficient table.

This is exactly the bad-control problem from a causal standpoint. Awareness is a **mediator** on the TV → Sales path. Conditioning on a mediator blocks the path you're trying to measure. The coefficient you get isn't wrong per se — it's the right answer to a question you didn't mean to ask.

## The mediation decomposition

The right way to handle this is explicit mediation analysis. The total effect of TV on sales decomposes as:

$$\underbrace{\tau_c}_{\text{total}} = \underbrace{\delta_c}_{\text{direct}} + \underbrace{\sum_m \beta_{c \to m} \cdot \gamma_m}_{\text{indirect (via mediators)}}$$

where $\beta_{c \to m}$ is TV's effect on awareness and $\gamma_m$ is awareness's effect on sales. The **proportion mediated** is then:

$$\rho_c = \frac{\tau_c - \delta_c}{\tau_c}$$

A value near 1.0 means almost all of TV's effect flows through the mediator. A value near 0 means the effect is mostly direct.

The `mmm-framework` captures this in `NestedMMM`, which simultaneously fits the media → mediator pathway and the mediator → outcome pathway inside a single PyMC model. Both pathways are Bayesian, so the proportion-mediated statistic inherits proper posterior uncertainty — you get an HDI on $\rho_c$, not just a point estimate.

```python
from mmm_framework.mmm_extensions import NestedMMM, NestedModelConfig

config = NestedModelConfig(
    mediators=["awareness"],
    channels=["tv", "display", "search", "social"],
)

model = NestedMMM(
    X_media=media_data,
    y=sales,
    mediator_data={"awareness": awareness_index},
    channel_names=["tv", "display", "search", "social"],
    config=config,
)
model.fit(draws=1000, tune=1000)

effects = model.compute_mediated_effects()
for e in effects:
    print(f"{e.channel}: {e.proportion_mediated:.0%} mediated through awareness")
```

## What the Aurora demo shows

In the Aurora Coffee Co. synthetic dataset — built with a known ground truth so the model can be graded — TV and Display are almost fully mediated: $\rho_{\text{TV}} \approx 1.0$, $\rho_{\text{Display}} \approx 1.0$. Their effect in the data flows through awareness at nearly every step. A base MMM that controls for awareness rates both channels as weak. The `NestedMMM` recovers their true contribution and flags them as Aurora's brand engines.

This matters for budget decisions in an obvious way. If you attribute TV's value only to its direct effect on sales, you'll undervalue it — and the undervaluation gets worse the longer TV's mechanism operates on awareness rather than on immediate response. Brand channels have long-horizon effects. The awareness pathway is how that horizon shows up in the data.

## When to reach for this

The indication is any situation where:

- You have intermediate measurements between a media channel and the final KPI (brand tracking, consideration surveys, website sessions attributed to branded search)
- Including those intermediates as controls noticeably deflates a channel's coefficient
- You suspect the channel builds the brand rather than harvesting existing demand

The last point is the tell. Search is mostly demand-harvesting — it reaches people already in-market. TV and display are mostly demand-generating — they shape who enters the funnel. A base MMM that treats all channels symmetrically will struggle to see this distinction; a mediation model can surface it directly.

The practical check: fit the base model with and without awareness as a covariate. If TV's coefficient changes substantially when you add awareness, you have a mediation story worth telling. The change in coefficient isn't noise; it's your data's way of telling you that awareness is a real intermediary on the causal path, and that the path matters.

## The honest report

Mediation analysis doesn't produce simpler outputs — it produces more honest ones. Instead of a single ROAS per channel, you get a direct ROAS, an indirect ROAS, and a proportion-mediated estimate with uncertainty. That's three numbers instead of one, and they require more explanation. But the alternative — one confident number that answers the wrong question — is worse.

The sentence "TV's effect is 90% mediated through brand awareness" is actually more useful to a budget decision than "TV's coefficient is 0.3." The first tells you that cutting TV will degrade awareness, and degrading awareness will eventually degrade sales. The second just gives you a multiplier to plug into a spreadsheet.

---

_The `NestedMMM`, `MultivariateMMM`, and `CombinedMMM` extension models are part of [`mmm-framework`](https://github.com/redam94/mmm-framework). The Aurora Coffee Co. notebooks (especially `03_extended_mmm.ipynb`) ground the mediation math in a synthetic dataset with a known truth. For the bad-control framing, see the [Table 2 Fallacy in MMMs](/posts/table-2-fallacy-in-mmm/) post. The calibration loop that anchors base-model coefficients to geo-lift evidence is covered in [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/)._
