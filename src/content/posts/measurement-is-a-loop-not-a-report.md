---
title: "Measurement Is a Loop, Not a Report"
author: Matthew Reda
pubDatetime: 2026-06-28T06:45:00Z
slug: measurement-is-a-loop-not-a-report
draft: false
tags:
  - marketing-mix-modeling
  - measurement
  - tooling
  - bayesian
description: A marketing-mix model usually ships as a quarterly slide deck — a snapshot that's stale on arrival and impossible to interrogate. The more honest unit of measurement is a living workspace where evidence has a status and a shelf life.
---

The standard deliverable of marketing measurement is a slide deck. An analyst spends six weeks on a model, exports a decomposition chart and a table of ROIs, presents it, and the file goes to a shared drive to die. By the time anyone acts on it the data has moved, and the one thing nobody can do with a PDF is _ask it a question_ — "how sure are you about CTV?", "what would change this?", "is this still true?" The format itself enforces false confidence: every number on the slide looks equally solid because the deck has no way to show that one was experiment-backed and another was a guess.

I've come to think the deck is the actual problem — not the model behind it. Measurement is not a report you produce once; it's a loop you operate continuously. So the right software artifact isn't a chart export, it's a _workspace_ — one place to run the whole cycle, from the first data check to a calibrated budget decision, where every estimate carries its provenance and its expiration date. That conviction is what I've been building into Augur, the platform layer over [`mmm-framework`](https://github.com/redam94/mmm-framework), and it changes what measurement feels like to do.

## The loop, as an operating model

The cycle has six stages, and the point of naming them is that work is always described in terms of which stage it advances rather than as a one-off task:

- **Fit** — validate the data and fit the model, with honest uncertainty.
- **Find** — rank the unknowns by how much resolving them is worth, in bits and in dollars.
- **Run** — execute the highest-value pre-registered experiment.
- **Calibrate** — fold the result back in as a prior and refit.
- **Reallocate** — move budget on the sharpened estimate.
- **Re-evaluate** — watch for evidence going stale and schedule the re-test.

A report freezes you at "Fit" and calls it done. The loop treats that as stage one of six. ([The calibration math that connects Find → Run → Calibrate is its own post.](/posts/closing-the-loop-mmm-calibration/))

## Evidence tiers: making trustworthiness a first-class property

The single most useful idea I took from building this is that a metric's _trustworthiness_ deserves to be as visible as its value. Every channel estimate carries a tier:

- **Calibrated** — backed by a real experiment.
- **Running** — an experiment is in flight.
- **Model-only** — observational, untested, a hypothesis.
- **Stale** — it was calibrated once, but the evidence has aged out.

These aren't footnotes; they're encoded in color everywhere a number appears — the priority matrix, the coverage map, the budget lines. The effect on a conversation is dramatic. "Channel A is at 3.1 ROAS" becomes "Channel A is at 3.1, model-only, never tested" — and suddenly the room is talking about _what to test next_ instead of arguing about a point estimate nobody has earned. A slide can't do this. It flattens calibrated truth and untested guess into the same black ink.

## The discipline has to be built into the tool

Two claims are easy to _make_ and hard to _keep_ without software enforcing them, which is exactly why they belong in the platform rather than in a methodology PDF nobody rereads.

**Specifications lock before results are visible.** The whole defense against specification shopping is that you commit to the model before you see what it says about your channels. If that's a matter of analyst willpower, it erodes by Friday. If the workspace pre-registers the spec and timestamps it, the discipline survives contact with a stakeholder who doesn't like the TV number.

**Methods are pressure-tested on synthetic worlds with known ground truth.** Before a model is trusted on real data, it should have to recover the _right_ answer on simulated markets where the true ROI is known — including the nasty scenarios: unobserved confounding, multicollinearity, saturation misspecification, trend breaks. A model that can't recover planted answers on synthetic data has no business attributing your real budget. Published model versions are immutable and append-only, and every fit references the exact version it used — so a result is always reproducible back to the code that produced it.

This is the same theme as everything I write about measurement: [the honest version of the work is procedural](/posts/building-a-pre-specified-bayesian-mmm/), and procedures only hold if something other than good intentions enforces them.

## An assistant that does the loop, not just chats

The other shift is that the interface is conversational where it should be. Fitting a model, validating data, hunting outliers, computing experiment priorities, designing a geo-lift, recording its readout, applying the calibration — these are things you describe in plain language to a workspace that then _runs_ them, in a sandboxed kernel, with the code and tables collected so you can audit exactly what happened. The chat isn't a gimmick on top of the model; it's how you operate the loop without context-switching between a notebook, a BI tool, and a slide editor.

## Why the strange names

If you've seen the product you'll have noticed it doesn't call these screens "Dashboard" and "Experiments." It uses an augury lexicon — the dashboard is the **Orrery**, experiment design is **Auspices**, the modeling assistant is the **Oracle**, the cycle-over-cycle record is the **Chronicle**. The conceit is deliberate: a Roman augur read signs to decide whether an undertaking had favor _before_ acting, which is precisely what this whole apparatus does with causal evidence instead of birds. Every creative name pairs with a plain-language hint on first encounter, so it's a memory aid, not a riddle. Mostly it's a small daily reminder that the job is to read the evidence honestly before committing the budget — not to produce a confident-looking deck after the fact.

## The point

A report tells you what happened. A loop changes what you do next, and then checks whether it worked. The deck was never the deliverable; the contracting uncertainty is. Build the workspace so that the honest path — pre-register, test, calibrate, flag what's stale — is also the path of least resistance, and measurement stops being a thing you present and becomes a thing you operate.
