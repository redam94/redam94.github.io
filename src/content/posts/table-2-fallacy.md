---
title: "The Table 2 Fallacy: Your Control Variables Aren't What You Think"
author: Matthew Reda
pubDatetime: 2026-06-26T03:33:55Z
slug: table-2-fallacy
draft: true
tags:
  - causal-inference
  - regression
  - statistics
  - marketing-mix-modeling
description: Controlling for a variable to identify your treatment effect doesn't mean that variable's coefficient is causally interpretable — and confusing the two is surprisingly common.
---

There's a mistake I see all the time in applied work, and it's insidious because it looks like rigor. A researcher fits a multivariable regression, puts out a table with all the coefficients, and then writes a sentence like "controlling for X, we find Z has an effect of 0.3 on Y." The problem is that the coefficient on Z — the control variable — almost certainly doesn't mean what they think it means.

This is the Table 2 fallacy, named by Westreich and Greenland for the common epidemiological practice of reporting confounders in a second table alongside the exposure of interest. The short version: **including a variable in your adjustment set to identify one effect doesn't causally identify that variable's own effect on the outcome.**

## What Statistical Adjustment Actually Does

When you include a set of confounders $Z = \{z_1, z_2, \ldots\}$ in a regression alongside your treatment $X$, the goal is to close backdoor paths between $X$ and $Y$. Graphically, $Z$ blocks the confounding routes so that the remaining variation in $X$ is as-good-as-random with respect to $Y$.

That's enough to identify the causal effect of $X$. It says nothing about whether $Z$ is causally identified.

Think about what you'd need to interpret $Z$'s coefficient causally: you'd have to close *all the backdoor paths into Z* as well. But you probably didn't design your study around identifying $Z$. You may not even know what those paths are. The adjustment set you chose for $X$ is unlikely to serve double duty for every other variable in the model.

More concretely: if there's an unobserved confounder $U$ that affects both $Z$ and $Y$, the coefficient on $Z$ is biased. You can't see $U$, so you can't block that path, and your adjustment for $X$'s confounders doesn't help.

## A DAG Illustration

Consider a simple setup:

- $U$ is an unobserved confounder affecting both $Z$ and $Y$
- $Z$ is a measured confounder for $X$, also directly affecting $Y$
- $X$ is the treatment; $Y$ is the outcome

The DAG has paths: $X \leftarrow Z \rightarrow Y$, $Z \leftarrow U \rightarrow Y$, and $X \rightarrow Y$.

Conditioning on $Z$ closes the backdoor path $X \leftarrow Z \rightarrow Y$, identifying $X \rightarrow Y$. But the path $Z \leftarrow U \rightarrow Y$ is still open. The regression coefficient on $Z$ absorbs both the true $Z \rightarrow Y$ effect and the bias from $U$. It's not a valid causal estimate for $Z$, even though it's precisely what you needed to get a valid estimate for $X$.

## Why This Matters in Practice

I run into this most in marketing mix models, where it's tempting to read every coefficient as a "contribution." You include seasonality, competitor spend, and price as controls so that your media coefficients are clean. Then someone asks what the price elasticity is and you point to the price coefficient. Maybe it's fine, maybe it isn't — but the reasoning "we controlled for it, so it's identified" doesn't hold.

The same thing comes up in economics, political science, and public health. You can find published papers across all these fields where the discussion section happily interprets every row of the regression output as if each variable was the primary exposure in its own well-designed study. It's not.

## The Right Frame

There's a useful reframe here: the adjustment set is a cost you pay to identify the effect you care about. The variables in it are *instrumental* to that goal. Their coefficients may be meaningful descriptively, or they may not be — but interpreting them causally requires a separate justification, not just the fact that you included them.

Before reporting a coefficient from a control variable, ask:
- What are the confounders for *this* variable's effect on the outcome?
- Did my study design close those paths?
- Is there any unobserved variable that could be biasing this estimate?

If you can't answer those questions, the honest move is to report the coefficient descriptively ("we observe a negative association between price and sales, conditional on the other model inputs") without claiming a causal interpretation.

The treatment effect you designed your study around is the one you can defend. The nuisance parameters are there to serve it — they're not free additional findings.
