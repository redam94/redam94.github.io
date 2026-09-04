---
title: "The Economy Is in Your MMM Whether You Put It There or Not"
author: Matthew Reda
pubDatetime: 2026-07-14T13:11:48Z
slug: latent-confounder-mmm
draft: true
tags:
  - marketing-mix-modeling
  - causal-inference
  - bayesian
  - statistics
description: When the economy drives both your media budgets and your sales, every channel that tracks economic health gets over-credited. Here's what three rungs of adjustment actually buy you — and what none of them can.
---

Patio furniture is a discretionary purchase. When the economy hums — hiring up, consumer confidence up, houses turning over — a home goods brand sells more *and* spends more, because performance budgets get topped up in good quarters. Economic health is a textbook confounder: it drives both sides of every spend-sales correlation. Search spend and social spend rise with the business cycle; so do sales. A model that doesn't account for this gives Search credit for the boom.

Nobody has a column called `economic_health` in their data warehouse. What they have is a macro dashboard — GDP growth, consumer confidence, unemployment, retail sales — where each series partially reflects the underlying condition. And most practitioners do one of three things: ignore the whole problem, throw the indicators into the control set, or look for something more structural. I've been working through all three rungs in the [`mmm-framework`](https://github.com/redam94/mmm-framework) causal notebook series, and the results are more instructive — and more honest about their limits — than the usual MMM discussion.

## The DAG you're ignoring

The structure looks like this. Economic health is a latent variable. It causes each of the observable macro indicators (GDP, confidence, unemployment inversely, retail sales). It also causes media spend — because budgets track revenue and revenue tracks the economy — and it causes sales independently. Media spend causes sales too, but that's the causal path we actually care about.

The back-door path is: spend ← economic health → sales. Unless you block it, any regression of sales on spend will confound the two.

```
          [economic health]
         /    |    |     \
      gdp  conf  unemp  retail
         \                 /
          \               /
     spend ────────────► sales
```

Red edges in the diagram are the back-door. Spend and sales both dangle off the same unmeasured root.

## Rung A: ignore it

The naive MMM — no economic controls, just price and seasonality — does what you'd expect. On a simulated world where Search's true contribution is known, the naive model credits Search with roughly 9× its actual effect. Display, a channel that actually moved sales, gets crushed toward zero to compensate: the model borrows its share of variance to fund the overstatement on Search.

A linear trend term partially helps (it absorbs the economy's drift component), which is why the industry default of always including a trend is less wrong than nothing. But it's an accidental partial de-confounder. Don't count on it.

## Rung B: indicators as controls

The practitioner's standard move: include all four macro indicators in the control set. This genuinely works — in the simulated world, it reduces the Search over-credit by roughly a factor of four. That's meaningful. If you're using indicators as controls and not doing rung A, you're in better shape than most.

But look at what survives. The indicators are noisy proxies for the underlying factor, not the factor itself. Each one has idiosyncratic measurement error — consumer confidence surveys have sampling variance; retail sales are revised; unemployment is seasonally adjusted using assumptions. A control variable measured with error attenuates its own coefficient ([I wrote about this in the measurement error post](/posts/measurement-error-in-predictors/)). But more importantly, when you use a noisy proxy in place of the true confounder, you don't close the back-door path — you narrow it. Some of the confounder's variance passes through the proxy into the regression; the rest leaks through the residual and onto the media coefficients.

The result: Search's estimate is still materially inflated, and nothing in the model output tells you so. Wide intervals from the naive model at least announce their uncertainty. Rung B's intervals are tighter — they just happen to be tight around the wrong number, for reasons the model can't surface.

## Rung C: model the measurement jointly

The third approach builds the measurement structure explicitly. A `LatentFactorMMM` adds a latent AR(1) economic health factor to the PyMC graph, with four observation equations — one per indicator:

$$\text{indicator}_{kt} = \lambda_k \cdot \text{factor}_t + \varepsilon_{kt}$$

The factor enters the sales equation directly, replacing the four noisy proxies with the latent quantity they're all measuring. Crucially, factor and media model are estimated in the same graph — not as a two-stage plug-in. The uncertainty about the factor propagates into every media coefficient through the posterior. If the factor is poorly recovered in some weeks, that uncertainty widens the media intervals for those weeks.

Two identification constraints matter here. First, the realized factor is **standardized in-graph** — otherwise its variance trades off against the loadings and the sampler collapses to a degenerate solution. Second, one loading (GDP growth, the anchor) is constrained positive; all others are free. This is what lets the model recover unemployment's *negative* loading correctly — a model that forced positive loadings everywhere would break on this world.

In practice, on the simulated brand, the posterior recovers the factor's trajectory with correlation 0.98 to the true economic health series and all four loading signs correctly (positive for GDP, confidence, retail; negative for unemployment).

## The honest finding: B and C tie on point error

Here's what I find most instructive about this exercise. On the simulated world, rungs B and C produce essentially the same media point estimates. Both reduce the naive Search over-credit by roughly the same factor of four. If you only care about getting the ROAS number closer to truth, either approach gets you there — and rung B is simpler to implement and explain.

So why ever build a latent factor model?

What rung C buys is not accuracy in the narrow sense. It buys four things rung B cannot provide:

1. **The measurement model is itself a causal claim.** The factor loadings are graded against the underlying truth. The model is saying: "GDP growth loads at +0.7, unemployment at −0.4, and here are the posterior intervals." That's a falsifiable statement about the structure of the confounder — something you could update next year with new indicators, test against external economic indices, or hand to an economist to critique.

2. **A nameable series.** Rung C produces "economic health, weekly, with uncertainty" — a series the CFO can look at, that you can extend with new data, that becomes a monitoring dashboard in its own right. Rung B produces four regression coefficients on noisy controls. Nothing you can reuse.

3. **Honest uncertainty propagation.** When the factor is uncertain, the media intervals widen to reflect that. Rung B treats the four noisy proxies as if they were the exact confounder values — which overstates precision in the media coefficients.

4. **Compositional structure.** Once you have a factor model, it composes with everything else the causal framework does: mediators, calibration, decay over time. The indicators-as-controls approach doesn't extend that way.

## What neither rung buys: the residual floor

Both approaches leave a residual bias in Search's estimate. On the simulated world, it's smaller than rung A but still material. The reason is that the four indicators, collectively, don't perfectly capture economic health — there's variance in the true factor that's missing from all of them. No regression structure, however sophisticated, can absorb a confounder it can't see.

This is the residual floor: bias you can name (it's the part of economic health the indicators don't measure), but can't remove through adjustment alone. The only way through it is experimental evidence — a geo holdout, a budget dark period — that creates spend variation *independent* of the economic cycle. An experiment where Search spend goes dark in some markets and stays on in others, during a period of stable macroeconomic conditions, breaks the confounding by construction.

This is why the calibration loop ([closing the loop](/posts/closing-the-loop-mmm-calibration/)) matters for latent-confounder worlds in a way it doesn't for collinearity worlds. In a collinear world, experiments resolve parameter ambiguity. In a latent-confounder world, experiments remove a bias that no amount of structural modeling can reach. Both problems look like wide posteriors; they have different fixes.

## What this implies for model building

If your media spend is meaningfully correlated with business cycles — and for most brands, it is — you have a latent confounder problem by default. The question isn't whether to address it, it's which rung you're on.

Rung A is where most models live. The upgrade to rung B (macro indicators as controls) is cheap, meaningful, and substantially better. The upgrade to rung C is worth doing when you want the measurement model to be first-class — when the economic health factor is something you want to monitor, update, and use across multiple models.

And then there's the experiment, which is the only thing that actually closes the residual back-door. Both B and C leave it open. That's not a critique of the statistical machinery — it's an honest statement about what observational adjustment can and can't do.

---

*The latent-factor structure is built in the [`mmm-framework`](https://github.com/redam94/mmm-framework) causal notebook series, specifically notebook 04 (`causal_04_latent_confounders.ipynb`). The `LatentFactorMMM` implementation lives in `mmm_extensions/models`. Related posts: [Coincidence Is Not Contribution](/posts/coincidence-is-not-contribution/), [Measurement Error in Predictors](/posts/measurement-error-in-predictors/), [Closing the Loop: MMM Calibration](/posts/closing-the-loop-mmm-calibration/).*
