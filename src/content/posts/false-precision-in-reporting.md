---
title: "Stop Reporting ROI to Four Significant Figures"
author: Matthew Reda
pubDatetime: 2026-06-28T09:00:00Z
slug: false-precision-in-reporting
draft: false
tags:
  - statistics
  - measurement
  - communication
description: A point estimate written as 2.347 looks like you know the answer to a tenth of a percent. If your interval is ±10%, you don't — you know the first digit and you're guessing at the second. The decimal places are a confidence claim the model never made.
---

If your model's effect is uncertain to ±10% or worse, stop printing it as 2.347. Every digit you write down is a claim about precision, and three of those four are claims your model can't back. An ROI of "2.347x" says you've pinned the answer to a tenth of a percent. An interval of, say, 2.1 to 2.6 says you've pinned the _first digit_ and you're guessing at the second. Those two statements cannot both be on the slide, and the second one is the truth.

This is the cheapest mistake in measurement and one of the most common, because the extra digits cost nothing to produce. The machine computes 2.34719 whether or not any of it is meaningful — it [always returns a number](/posts/the-assumptions-are-the-model/), at full floating-point width, with no sense of how much of that width it earned. Rounding to the precision you actually have is a manual act of honesty, and skipping it is the default. So the default is false precision.

The reason it matters isn't pedantry about sig figs. It's that **digits are how numerate readers gauge confidence.** Show someone 2.3 and they hear "roughly two and a third." Show them 2.347 and they hear "we measured this carefully." You've made a claim about the quality of your evidence using nothing but trailing decimals, and if the underlying interval is ±10% that claim is false. The number didn't get more certain when you typed more of it; it just started lying about how certain it was.

The worst version — and the common one — is reporting the point estimate **with no interval at all.** A bare 2.347 is false precision with the evidence that would puncture it removed from the room. At least 2.347 (95% CI: 2.1–2.6) contains its own correction; a reader can see the spread swallow the trailing digits and discount them. Strip the interval and you've kept all the implied confidence and deleted the part that says how much to trust it. That's not simpler reporting. It's the same overstatement with the receipts hidden.

The fix is a one-liner you can adopt today:

- **Round the point estimate to the precision the interval supports.** If the interval spans 2.1–2.6, report 2.3 or 2.4, not 2.347. The last digit you write should be the first one that's actually uncertain — not the fifth.
- **Always carry the interval.** If you only have room for one number, the number is wrong; make room. A point estimate without a spread is an opinion wearing a lab coat.
- **Match the decimals to the design, not the printout.** A clean experiment might earn two sig figs; a correlational MMM with a wide posterior earns one, sometimes less. Let the uncertainty set the precision, never the float.

Reporting fewer digits feels like you're admitting weakness. You're not — you're declining to fake strength you don't have. The number 2.3 (±0.25) is a more impressive piece of work than 2.347, because it's _true_, and everyone competent in the room can tell the difference.

---

_Companion to [The Assumptions Are the Model](/posts/the-assumptions-are-the-model/): the interval is silent on whether your assumptions held, but at minimum it shouldn't be silent about the sampling uncertainty you do know how to quantify._
