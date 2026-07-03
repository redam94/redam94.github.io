---
title: "Three-Way Equifinality: Why Your MMM's Adstock and β Can't Both Be Right"
author: Matthew Reda
pubDatetime: 2026-07-03T13:10:21Z
slug: mmm-equifinality
draft: true
tags:
  - marketing-mix-modeling
  - bayesian
  - statistics
  - regression
description: In every additive MMM, adstock decay, saturation strength, and the media coefficient trade off against each other — producing identical fits from wildly different attributions. Here's what drives it, what it looks like in the posterior, and the only thing that actually resolves it.
---

Your MMM reports that TV has a 3-week carryover, a mid-strength saturation curve, and a ROAS of 1.4. It converged. R-hat is 1.00. The posterior predictive check looks reasonable. There's a good chance the decomposition is an artifact of your priors, not your data.

Three parameter groups sit inside every additive media term in an MMM:

$$\text{contribution}_t = \beta \cdot \text{sat}\!\left(\text{adstock}(x_t\,;\,\theta_{\text{adstock}})\,;\,\theta_{\text{sat}}\right)$$

$\beta$ controls the level — how much sales response per unit of media. $\theta_{\text{adstock}}$ controls the temporal shape — how long the effect carries and how quickly it decays. $\theta_{\text{sat}}$ controls the nonlinear compression — where diminishing returns start biting. By the structure of this equation, all three trade off. Identifying any one of them requires external information that observational spend history usually doesn't supply.

This is called **equifinality**: many combinations of $(\beta, \theta_{\text{adstock}}, \theta_{\text{sat}})$ produce nearly identical in-sample fits. The posterior can look sharp while the attribution is almost entirely a prior artifact.

## The first entanglement: normalized adstock and β

Most frameworks — including [mmm-framework](https://github.com/redam94/mmm-framework) — normalize the adstock kernel by default. The decay weights are rescaled to sum to 1:

$$\tilde{w}_k = \frac{w_k}{\sum_{j=0}^{L} w_j}, \quad \text{adstock}_t = \sum_{k=0}^{L} \tilde{w}_k\, x_{t-k}$$

The motivation is sensible: normalization means $\beta$ can be interpreted as "total response per unit of weight-averaged spend," independent of how many lag periods you're using. The unintended consequence is that the kernel's *level* is stripped off and absorbed into $\beta$. A high-decay kernel (most weight on earlier weeks) and a low-decay kernel (weight spread across many weeks) produce different weighted-spend series after normalization, and $\beta$ compensates.

Concretely: the same sales trajectory can be reproduced by

- High decay ($\alpha = 0.8$), lower $\beta = 1.2$
- Low decay ($\alpha = 0.3$), higher $\beta = 2.1$

with nearly indistinguishable in-sample fit. The likelihood surface is flat along this direction. Since $\alpha$ and $\beta$ typically get independent priors, nothing in the model prefers one combination. You're reading back the prior when you report the decay estimate.

## The second entanglement: carryover and saturation

The saturation function compresses high-spend periods and expands low-spend periods — it's a nonlinear smoother. Long adstock carryover does something structurally similar: it spreads and smooths the raw spend series before saturation sees it. As a result, a long-carryover + weak-saturation combination can produce nearly the same fitted time series as a short-carryover + strong-saturation combination.

There's a third, subtler entanglement: a flexible trend can absorb slow-moving media effects. If the model trend is loose enough to rise and fall on quarterly timescales, it will absorb part of any gradual long-run media contribution — pulling $\beta$ toward zero while the trend component explains what the media was actually doing. The media coefficient looks small and stable; the trend looks informative; neither is what you think it is.

## This is a model-class property, not a framework bug

Robyn, Meridian, LightweightMMM, and every other additive carryover+saturation MMM share this structure. It's not a PyMC quirk or an implementation choice. The [stress-test series](https://github.com/redam94/mmm-framework/tree/main/nbs) I've been running against mmm-framework makes the failure mode measurable: across 16 synthetic worlds with known causal ground truth, 8 produced silent failures — material attribution errors with R-hat $\leq$ 1.02 and zero divergences. Several of those failures trace to carryover or saturation misspecification. On the carryover-shape world (true delayed Weibull decay vs. geometric-8 baseline), median ROAS error ran at 88% while every diagnostic looked clean.

That number is worth sitting with. A model that is wrong about attribution by nearly 100% on average, with no computational signal that anything is amiss.

What is well-identified by the observational data is the fitted **total** media contribution over a period — the sum $\sum_t \text{contribution}_t$. What is not identified is the decomposition into "how long it lasts" vs. "how nonlinear it is" vs. "how big the coefficient is." If you only need to know that TV contributed roughly $X$ million in revenue over the quarter, equifinality is a nuisance. If you're reporting "TV's peak response decays over 5 weeks with saturation half-point at 200 GRPs" — those numbers reflect the prior, not the data.

## What the posterior looks like

The diagnostic is the joint posterior. Plot the samples from $(\alpha, \beta)$ for a single channel:

```python
import arviz as az
import matplotlib.pyplot as plt

# After fitting with PyMC
az.plot_pair(
    trace,
    var_names=["alpha_tv", "beta_tv"],
    kind="kde",
    divergences=True,
)
plt.title("Joint posterior: TV decay × TV coefficient")
```

If you see a long tilted ellipse — one parameter high, the other low, negatively correlated — the data cannot separate them. The joint posterior is the honest picture that the marginals hide. A tight marginal on $\alpha$ and a tight marginal on $\beta$, but a joint posterior that's a diagonal stripe, means you have two unknowns and one equation. The prior is deciding the split.

You can also check directly in the mmm-framework via the channel diagnostics:

```python
from mmm_framework.validation.channel_diagnostics import run_channel_diagnostics

report = run_channel_diagnostics(fitted_model, trace)
print(report.parameter_correlation_summary)
```

A large negative correlation between a channel's $\alpha$ (adstock) and $\beta$ is the signature. If it's close to $-1$, the data has nothing to say about the split.

## The fix hierarchy

**1. Calibration — the real fix.** A geo-lift or incrementality test that anchors $\beta$ (the level of the channel's response per dollar) collapses the trade-off. Once the level is pinned by randomized evidence, the likelihood has a clear preference over the remaining decay and saturation parameters — now they must explain the *dynamics* of the effect, not just its scale. This is the mechanism the [`mmm_framework.calibration`](https://github.com/redam94/mmm-framework) module exploits: an informative prior on $\beta$ from an experiment turns weakly-identified nuisance shape parameters into something the data can speak to.

This is also the only fix that addresses the dominant confounder — unobserved demand. The carryover and saturation entanglement is a weak-identification problem; the confounding problem is a bias problem. Experiment calibration addresses both simultaneously, which is why it sits at the top of the hierarchy and the other two remedies don't.

**2. Data-anchored half-saturation bounds.** If you're using a Hill saturation curve, the half-saturation parameter $\kappa$ can drift well outside the range your data actually covers — the model is extrapolating the curve's position to regions of spend it never observed. Bounding $\kappa$ to the empirical support of the adstocked spend series prevents this:

```python
from mmm_framework.config import SaturationConfig

sat_cfg = SaturationConfig(
    saturation_type="hill",
    **SaturationConfig.compute_kappa_bounds_from_data(
        adstocked_spend, percentiles=(0.1, 0.9)
    )
)
```

This doesn't resolve the $\alpha$-vs-$\beta$ entanglement — that requires calibration — but it stops the saturation curve from drifting to a position the data can't evaluate.

**3. Weakly-informative priors on decay.** Tightening the adstock decay prior toward plausible ranges (e.g., geometric decay $\alpha \in [0.1, 0.7]$ for most channels, with brand advertising extending higher) reduces the effective range of the trade-off without eliminating it. This is better than diffuse priors; it's not identification.

## What to report and what not to

The practical takeaway is about what you present in a model readout.

**Reasonably identified (report with HDIs):** total channel contribution over a period, marginal ROAS, budget optimization recommendations from a well-calibrated model.

**Weakly identified unless calibrated (report cautiously, with caveats):** per-channel ROAS when no experiment has pinned the level, channel-level trend decomposition.

**Prior artifacts (do not report as findings):** per-channel adstock decay parameters, saturation half-saturation or steepness parameters, unless the channel has been experimentally calibrated and the joint posterior shows the parameters separated from the level coefficient.

This isn't an argument against fitting adstock and saturation — the transformation is structurally necessary and the model needs it to fit the data. It's an argument against reading off the shape parameters as if they were measurements. A narrow posterior on TV's decay rate most likely means your prior was informative, not that the data revealed the shape of TV's carryover. The width of that posterior tells you how tight the prior was. The joint posterior tells you whether the data contributed anything to the split.

The parameters are not findings. The total is. Keep the distinction visible in every deck you ship.

---

_Equifinality in additive carryover+saturation models is documented in the [mmm-framework technical docs](https://github.com/redam94/mmm-framework/blob/main/technical-docs/methodology/equifinality.md) and surfaced empirically in the stress-test series (`nbs/stress_01_carryover_and_shape.ipynb`). The calibration remedy is covered in [Wiring Your MMM to Your Experiments](/posts/closing-the-loop-mmm-calibration/). The joint-posterior diagnostic pattern appears in [Collinearity Doesn't Break Your Model](/posts/collinearity-cant-separate/). The silent-failure pattern — correct convergence diagnostics, wrong attribution — is the same failure mode described in [Simulation-Based Calibration](/posts/simulation-based-calibration/)._
