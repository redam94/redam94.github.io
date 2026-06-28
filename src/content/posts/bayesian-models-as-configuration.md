---
title: "Bayesian Models as Configuration"
author: Matthew Reda
pubDatetime: 2026-06-20T13:00:00Z
slug: bayesian-models-as-configuration
draft: false
tags:
  - bayesian
  - pymc
  - measurement
  - tooling
description: Treating a Bayesian marketing-mix model as declarative configuration — variables, transforms, normalization, and priors in JSON — so a malformed input file fails validation before you fit instead of after you've shipped the wrong number.
---

Most of the bad numbers I've shipped were not the model's fault. The model did exactly what I told it to. The problem was that I told it the wrong thing, or fed it a file that quietly disagreed with itself, and I didn't find out until someone in finance asked why a market we don't operate in had a media coefficient. Validate the data first — it's almost always the data.

That experience is the whole reason I like the design behind [BayesInsight](https://github.com/redam94/BayesInsight), a config-driven Bayesian modeling framework I've been building. The bet it makes is simple: the model _specification_ should be data, not code. You declare your variables, transforms, normalization, and priors as JSON, you declare what your input data is allowed to contain as JSON, and the fitting machinery is a separate thing that consumes both. The payoff is that a malformed model fails loudly at parse time instead of silently at inference time.

## Three files, one model

A model in this framework is a folder. There's an MFF (Master Flat File) CSV — long-format rows of `Geography, Product, Outlet, Campaign, Creative, Period, VariableName, VariableValue`. There's a `metadata.json` describing what that CSV is _allowed_ to contain. And there's a `model_def.json` describing the model itself.

The metadata is the contract for your input:

```json
{
  "metadata": {
    "allowed_geos": [
      "DE",
      "FR",
      "KR",
      "AU",
      "UK",
      "MX",
      "CA",
      "BR",
      "JP",
      "US"
    ],
    "allowed_products": ["Laptops", "Desktops", "Phones", "Tablets", "Watches"],
    "allowed_outlets": ["Total"],
    "allowed_campaigns": ["Total"],
    "allowed_creatives": ["Total"],
    "necessary_variables": null,
    "periodicity": "Weekly",
    "row_ids": ["Geography", "Product", "Period"]
  }
}
```

This is not documentation. It's enforced. When you load the MFF, a Pydantic `model_validator` runs `check_metadata`, which pivots the data and asserts every value in `Geography`, `Product`, `Outlet`, `Campaign`, and `Creative` is a subset of what's allowed. A stray `"USA"` where the contract says `"US"` raises `Only {...} are allowed found {'USA'}` and stops. Because `periodicity` is `"Weekly"`, `check_date_alignment` also confirms every `Period` falls on the same weekday — the classic "someone's export used Sunday-anchored weeks and yours uses Monday" bug, caught before it becomes a silent misalignment. Most "modeling" problems are upstream data problems, and this is the framework refusing to let one through.

## The model is declarative too

The interesting part is that the _model_ gets the same treatment. Each entry in `model_def.json` declares a variable's type — one of `control`, `exog`, `base`, `media`, `none` — plus its transform, normalization, and prior. Here's a real control variable:

```json
{
  "variable_name": "Promotion_Total_Total_Total",
  "variable_type": "control",
  "deterministic_transform": { "functional_form": "linear", "params": null },
  "normalization": "Global Standardize",
  "coeff_prior": {
    "coeff_dist": "Normal",
    "coeff_params": { "mu": 0.0, "sigma": 0.5 }
  },
  "random_coeff_dims": ["Geography", "Product"]
}
```

Nothing here is procedural. `Global Standardize` means the column is centered and scaled before it enters the linear predictor, so a standardized control contributes

$$\beta \cdot \frac{x - \mu}{\sigma}$$

to the latent response. The practical reason to declare it this way — which the framework's own comments push you toward — is that with every non-media regressor standardized, the intercept becomes the average response when there's no media spend, and the sampler is better conditioned. `random_coeff_dims` declares partial pooling across geographies and products without you writing a single `pm.Normal`.

Media variables carry more declared structure — an `adstock` and a `media_transform`:

```json
{
  "variable_name": "media_var_0_Total_Total_Total",
  "variable_type": "media",
  "adstock": "delayed",
  "media_transform": "hill",
  "coeff_prior": {
    "coeff_dist": "LogNormal",
    "coeff_params": { "mu": -2.9957, "sigma": 0.2624 }
  },
  "media_transform_prior": {
    "type": "Hill",
    "K_ave": 0.85,
    "K_std": 0.6,
    "n_ave": 1.5,
    "n_std": 1.2
  }
}
```

That `"hill"` string resolves to a saturation curve on mean-indexed spend $\tilde{x} = x / \bar{x}$:

$$f(\tilde{x}) = \frac{\tilde{x}^{\,n}}{K^{\,n} + \tilde{x}^{\,n}}$$

and `"delayed"` adstock convolves spend with a delayed-geometric kernel $w_l \propto \alpha^{(l-\theta)^2}$ so the carryover peaks at lag $\theta$ rather than immediately. The `LogNormal` coefficient prior keeps the media effect positive by construction. You chose all of this in JSON before you saw a single trace plot — which is exactly the point. Pre-specify the model. Then commit.

## Why pre-specification is the feature

The reason I care about this more than I care about any particular sampler is that configuration is reviewable in a way code isn't. A `model_def.json` is a complete, diffable record of every modeling decision: which variables are media, what got standardized, what priors you committed to. A reviewer who doesn't read PyMC can still read it. You can put it under version control and watch a model change across quarters. And because the spec is separated from the fitting, the same JSON reproduces the same model — no buried notebook cell deciding your prior at runtime.

I want to be honest about where this is rough. The framework is young. `time_transform` is declared but not implemented; the comments admit only `none` and `Global Standardize` normalization really work today; and there's a whole `experimental/` directory — optimizers, side models, a Poisson process — that is exactly as load-bearing as the word "experimental" suggests. Treat the config schema as the stable surface and that directory as a notebook pile.

The takeaway I'd actually act on: before you write any model code, write the contract. Put the allowed geos, the periodicity, and the required variables in a file, and make loading fail when the data violates it. You will catch more wrong numbers there — at the door — than you ever will staring at a posterior that looks plausible because it was built on a file you never checked.
