---
title: "What to Do When Your Geo Experiment Gets Contaminated"
author: Matthew Reda
pubDatetime: 2026-07-09T13:12:33Z
slug: geo-experiment-contamination-detection
draft: true
tags:
  - experimental-design
  - marketing-mix-modeling
  - bayesian
  - measurement
description: Geo experiments assume stationarity within the test window, but competitive promotions and mid-wave shocks break it silently. Here's how to detect contamination using Bayesian changepoint detection on the treatment-minus-control residual, and what to do when the alarm fires.
---

Every geo experiment rests on a bet you rarely make explicit: that nothing changes during the test window that differentiates treatment geos from control geos in a way unrelated to the treatment itself. Most of the time this holds well enough. Occasionally it doesn't, and when it fails, your posterior can look perfectly healthy — tight, converged, diagnostically clean — while describing the wrong causal quantity entirely.

Augur's continuous learning loop handles information decay *between* waves via the forgetting-rate equation in `loop.py` (Eq. 22: $\sigma^2_{\text{eff}}(t) = \sigma^2_{\text{post}} \cdot e^{\lambda t}$, $\lambda = \ln 2 / h$). But there's currently no guard against contamination *within* a wave. A technical audit of the continuous-learning math I ran recently (the source for this post) flagged this as Gap I — medium-to-high severity — and the fix is well-established in the geo-experiment literature. This post is the gap explained and the fix described.

## The assumption and when it breaks

The geo-experiment likelihood in Augur — and in all standard geo/holdout designs — identifies the treatment effect from the contrast between treatment and control geos over the test window. The causal reading requires that, absent the treatment, both groups would have followed the same trend. Vaver and Koehler (2011) and Kerman, Wang, and Vaver (2017) show that random geographic assignment of treatment/control makes this assumption hold for *common* shocks: a nationwide recession or platform-wide algorithm change hits both groups equally and cancels in the contrast.

What doesn't cancel is a *differential* shock — one that lands harder on the treatment geos than the control geos (or vice versa), for reasons unrelated to the campaign being tested. Real examples:

- A competitor runs a regional promotion in your treatment markets during the test window.
- A supply disruption or out-of-stock event hits specific geographies while the test is live.
- Your own organization runs an unlogged email or direct-mail campaign that overlaps geographically with the treatment group.
- A weather event, sporting event, or news cycle differentially shifts consumer behavior in treatment vs. control geos.

Any of these breaks the counterfactual. The control-based prediction of "what treatment geos would have done without the media" is now wrong, and your treatment-effect estimate absorbs the shock on top of (or instead of) the real media effect.

## Why it's hard to see

The insidious part is that standard posterior diagnostics don't catch this. $\hat{R}$, ESS, and divergence counts check whether the sampler mixed, not whether the data-generating assumption is intact. A contaminated readout folds into the likelihood and produces a tight, converged posterior — it just describes the wrong thing. If the shock was large and directionally aligned with the expected treatment effect, you'll get a suspiciously strong result. If it was large and directionally opposed, you'll get a suspiciously null one. In neither case does the posterior wave a flag.

## What to watch: the residual series

The right monitor is the **treatment-minus-control residual series** — or, more precisely, the observed series minus the control-based counterfactual. Under a correctly specified, stationarity-respecting model, this residual should look like low-autocorrelation noise after extracting the treatment-effect contribution. A regime change anywhere in the test window shows up as a shift in the mean or variance of this series at a specific point in time.

Two complementary detection tools:

### Bayesian online changepoint detection

Adams and MacKay (2007) give a clean algorithm for detecting changepoints in a scalar time series online — one observation at a time — by maintaining a posterior over the "run length" (time since the last regime change). At each new geo-week observation, you update:

$$P(r_t \mid y_{1:t}) \propto \sum_{r_{t-1}} P(y_t \mid y_{t-r_t:t-1}) \cdot P(r_t \mid r_{t-1}) \cdot P(r_{t-1} \mid y_{1:t-1})$$

where the run-length transition has a geometric hazard (constant probability of a changepoint at each step), and the predictive $P(y_t \mid y_{t-r_t:t-1})$ is updated conjugately within each run (a Normal-Gamma if you're modeling Gaussian residuals).

In practice, a spike in the posterior run-length distribution — mass suddenly concentrating on a short run length — is the alarm. The posterior probability of a changepoint at time $t$ is read directly from the run-length marginal. Fearnhead and Liu (2007) extend this to multiple simultaneous changepoints; for most geo-experiment windows (4–12 weeks), the single-changepoint version is sufficient.

Pragmatically: run this on the treatment-minus-control weekly residuals, with the run-length hazard set to match the typical mid-experiment shock frequency for your category. If the alarm fires, the timestamp tells you exactly where to censor.

### CausalImpact-style counterfactual divergence

Brodersen et al.'s CausalImpact (2015) fits a Bayesian structural time-series model to the pre-test period — capturing local trend, seasonality, and covariate relationships — and then projects it through the test window to build a counterfactual. The intervention effect is the observed series minus this counterfactual.

The contamination diagnostic is a secondary check: does the *control-group* series, post-treated as if it were a "held-out" series, stay inside its pre-period predictive intervals during the test window? A control series that diverges from its own counterfactual for no assigned reason is showing you a differential shock. The posterior predictive interval widening is the alarm.

This pairs naturally with the changepoint detector: changepoint detection runs in real time within the wave; the CausalImpact check runs at readout to audit the full window before folding the result into the posterior.

## What to do when the alarm fires

The contaminated segment violates the likelihood's generative assumptions, so the right response is not to average through it. Three options, roughly in order of preference:

1. **Censor the affected periods.** If the changepoint detector puts the break at week $t^*$, include only observations from the test start through $t^* - 1$ in the likelihood update for this wave. Accept a smaller effective sample; don't accept a biased one.

2. **Extend the wave.** If the shock was brief and clearly ended (a one-week competitor promotion, say), extend the test window to accumulate clean post-shock data. The posterior update uses only the clean segments.

3. **Repeat the wave.** If the contamination is severe enough that there isn't a clean segment long enough to be informative, flag the wave as unusable and re-run. The forgetting-rate mechanism in Augur's `loop.py` already handles the information-decay cost of waiting.

What you should not do: fold the contaminated readout into the posterior and call it done. The downstream cost is a miscalibrated posterior driving the ENBS stopping rule — the model may falsely converge ("we know enough about this channel") on the wrong parameter values, and ENBS fires prematurely because expected regret has collapsed. This is the exact misspecification failure mode I described in the [sequential stopping post](/posts/bayesian-sequential-stopping-likelihood-principle/).

## The gap in Augur

Augur's `diagnostics` output currently surfaces sampling diagnostics (R-hat, ESS, divergences) and model-fit statistics, but no within-wave stationarity guard. The `loop.py` structure makes the hook straightforward:

```python
# Pseudocode — what the stationarity guard would look like in loop.py
from bocpd import BayesianOnlineChangePointDetector  # or ruptures

residuals = observed_tc - control_counterfactual  # treatment minus control
detector = BayesianOnlineChangePointDetector(hazard=0.1)

break_flag = False
for t, r_t in enumerate(residuals):
    probs = detector.update(r_t)  # posterior over run-lengths
    if probs.changepoint_prob > 0.8:
        break_flag = True
        diagnostics["contamination_break_t"] = t

if break_flag:
    # Censor post-break observations or extend the wave
    ...
```

The contaminated readout then never enters `loop.update_posterior()`, which means it never corrupts the ENBS stopping criterion.

The key point the audit makes (and I'd agree with): the framework's randomized holdout design already does most of the work. Common shocks cancel in the treatment-minus-control contrast — you're protected against nationwide events by construction. The gap is specifically the *detection and censoring* step for differential shocks that the randomization doesn't cancel.

---

*This post is grounded in a technical audit I ran of the [Augur continuous-learning math documentation](https://github.com/redam94/mmm-framework/blob/main/technical-docs/continuous-learning.md) (Gap I: within-wave non-stationarity detection). Key references: Vaver & Koehler (2011), "Measuring Ad Effectiveness Using Geo Experiments," Google Research pub38355; Kerman, Wang & Vaver (2017), "Estimating Ad Effectiveness using Geo Experiments in a Time-Based Regression Framework," Google Research pub45950; Brodersen, Gallusser, Koehler, Remy & Scott (2015), "Inferring causal impact using Bayesian structural time-series models," Annals of Applied Statistics 9(1), 247–274; Adams & MacKay (2007), "Bayesian Online Changepoint Detection," arXiv:0710.3742. Related posts: [Designing Experiments to Maximize Information](/posts/designing-experiments-to-maximize-information/), [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/), [The Sequential-Stopping Worry Is a Frequentist Problem](/posts/bayesian-sequential-stopping-likelihood-principle/).*
