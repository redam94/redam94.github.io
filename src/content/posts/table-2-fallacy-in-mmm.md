---
title: "Your MMM's Control Coefficients Are Not Findings"
author: Matthew Reda
pubDatetime: 2026-06-28T05:00:00Z
slug: table-2-fallacy-in-mmm
draft: false
tags:
  - marketing-mix-modeling
  - causal-inference
  - regression
  - measurement
description: In a marketing-mix model you add seasonality, price, and competitor spend so your media coefficients come out clean. Then someone reads those control coefficients as insights. That's the Table 2 fallacy, and in an MMM it comes with two extra ways to get burned.
---

Every marketing-mix model has two kinds of variables in it, and the model does not tell them apart. There are the variables you're paid to measure — the media channels, the things someone might reallocate budget across. And there are the controls: seasonality, price, distribution, competitor activity, holidays, a baseline trend, maybe weather or a macro index. You put the controls in so that the _media_ coefficients come out clean. Then the model hands you a single table where every coefficient looks equally authoritative, and somebody — often you, in front of a client — starts reading the control coefficients as if each one were a finding.

I wrote about [the Table 2 fallacy](/posts/table-2-fallacy/) in general terms: including a variable to identify one effect does not causally identify _that variable's_ effect. MMMs are where I see it do the most damage, because the format actively encourages it. The decomposition waterfall, the "contribution" chart, the baseline-versus-incremental split — all of these present every term in the model with the same visual authority, and a coefficient that exists only to clean up someone else's estimate gets promoted to a strategic insight. Worse, the MMM setting layers two extra hazards on top of the generic fallacy. Let me take all three in order.

## Hazard one: confounding controls absorb everything you didn't model

Start with the controls you added to close backdoor paths. Seasonality is the classic one. Demand is higher in Q4, _and_ media plans spend more in Q4, so without a seasonal control the media coefficient would absorb the Christmas lift and you'd massively over-credit advertising. Putting seasonality in is exactly right — for the media estimate.

But now look at what the seasonality coefficient itself is carrying. It's soaking up _every_ unmodeled thing that moves with the calendar: weather, holidays, competitor seasonality, your own promo calendar, demand shocks, category trends. It was never designed to isolate the causal effect of "the season" on sales, and there's no intervention it corresponds to — you can't run more December. The coefficient is a sponge, and reading it as "seasonality drives X% of sales" treats a sponge as a measurement.

Price is the sharpest version of this, because price in an MMM is usually _endogenous_. Think about the data-generating process: you cut price in response to soft demand, or you raise it when the product is hot, or promotions bundle a price cut with display and feature at the same time. The price you observe is partly a _reaction_ to the sales you're trying to explain. Formally, if there's an unobserved demand shock $U$ that moves both price $Z$ and sales $Y$,

$$Z \leftarrow U \rightarrow Y$$

then conditioning on the media confounders does nothing to close that path, and the price coefficient is biased by however much $U$ matters. The adjustment set you chose to identify _media_ was never built to identify _price_. So the elasticity your MMM reports for price is, in general, not the thing decades of careful pricing research ([≈ −2.5](/posts/what-decades-of-marketing-data-tell-us/)) actually measured — those came from designs built to identify price, with instruments or experiments, not from a media model that happened to have price on the right-hand side.

The general rule: a control's coefficient is only causally interpretable if you closed the backdoor paths into _that_ variable. You almost never did. You closed the paths into media and stopped, because media is what the study was for.

## Hazard two: variance-reduction controls compete with media for the same variance

The second hazard is specific to how MMMs get built, and it's subtler because the controls in question are often perfectly _valid_ — they're just being read wrong.

You add some controls not to fight confounding but to soak up residual variance and tighten your media estimates. A baseline trend, a paydays dummy, a weather index. Even when one of these is a legitimate precision control, two things are true at once. First, its coefficient is still not a finding — "precision control" is a job description, not a causal claim, and the same backdoor logic from hazard one applies. Second, and this is the part that bites in practice: **if the control is correlated with media, it doesn't just absorb noise — it competes with media for credit.**

This is where MMM attribution quietly becomes a modeling choice rather than a measurement. Your brand spends heavily in Q4; sales lift in Q4; you also have a seasonal control that lifts in Q4. The model now has to divide the Q4 lift between "media" and "season," and it does so based on whatever subtle timing differences and prior assumptions you fed it. Specify the baseline as a flexible spline and it eats more of the lift, shrinking media ROI. Specify it as a stiff linear trend and media keeps the credit. Same data, same media, and your reported ROAS swings — not because you learned anything about media, but because of how you parameterized a _control_.

So the danger here is doubled. You can't read the control's coefficient as a contribution, and the control is silently shaping the media contribution you _can_ read. The honest discipline is to recognize that the baseline-versus-incremental split is partly identified by assumption, pre-specify those assumptions before you see the ROAS, and report how sensitive the media numbers are to the baseline spec. (This is one more reason I argue for [pre-specifying the whole model](/posts/building-a-pre-specified-bayesian-mmm/) — the baseline is exactly the knob that specification-shopping turns.)

## Hazard three: the controls you add can bias the media estimate you care about

The first two hazards are about misreading control coefficients. The third is worse, because it corrupts the numbers you actually trust.

There's a folk belief in applied modeling that controls are free — that adding more of them can only help, by closing more paths or explaining more variance. It isn't true. Cinelli, Forney, and Pearl's "crash course in good and bad controls" lays out the taxonomy cleanly: some controls reduce bias, some are neutral, and some _introduce_ bias. Throwing variables in to "reduce variance" without checking which kind they are is how you damage your media estimates.

Two failure modes show up constantly in MMMs:

- **Mediators (post-treatment controls).** Your media drives website visits, and website visits drive sales. Visits feel like a great variance-reducing control — they're correlated with everything. But visits sit _on the causal path_ from media to sales. Control for them and you subtract off the very mechanism through which media works, biasing the media effect toward zero. You've controlled away your own answer.
- **Colliders.** Condition on a variable that is a common _effect_ of media and some other driver of sales, and you open a non-causal path that wasn't there before — manufacturing a spurious media correlation out of nothing. "It improved the fit" is not evidence the control was harmless; a collider improves fit while actively biasing you.

The lesson is that a control earns its place by a causal argument about what it is — confounder, mediator, collider, or competitor for variance — not by whether it tightens the $R^2$ or shrinks an interval. "Reduce variance" is a perfectly good reason to add a variable and a perfectly terrible reason to skip asking what that variable _is_.

## What to actually do

None of this is an argument against controls. You need them; an MMM without seasonality and price is worse, not purer. It's an argument against reading them as more than they are. Concretely:

- **Designate, up front, which coefficients you'll defend causally.** In an MMM that's the media channels you built identification around. Everything else is nuisance machinery serving those estimates, and should be labeled as such on the chart.
- **Report controls descriptively, not causally.** "Conditional on the other inputs, sales are negatively associated with price" is honest. "Our price elasticity is −1.8" implies a study you didn't run.
- **Classify every control before it goes in.** Is it a confounder, a precision control, a mediator, or a collider? The last two stay out. Write the reason down.
- **Stress-test the baseline.** Because controls and media compete for the same variance, refit under a few defensible baseline specifications and report how much your media ROAS moves. If it moves a lot, that range _is_ your finding.
- **Stop handing out decompositions that imply every term is a lever.** A waterfall that puts "seasonality contribution" next to "TV contribution" in the same units invites exactly the misreading this whole post is about.

The media effects are the ones you designed the model to identify and the ones you can defend. The controls are the price you paid to get them — not a second set of free findings stapled to the bottom of the table.

---

_Companion to [The Table 2 Fallacy](/posts/table-2-fallacy/). The good/bad control taxonomy follows Cinelli, Forney & Pearl (2022), "A Crash Course in Good and Bad Controls," Sociological Methods & Research; the price-endogeneity and baseline-identification points draw on Hanssens, Parsons & Schultz (2001) and Jin et al. (2017)._
