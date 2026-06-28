---
title: "Designing Experiments to Maximize Information"
author: Matthew Reda
pubDatetime: 2026-06-28T01:00:00Z
slug: designing-experiments-to-maximize-information
draft: false
tags:
  - bayesian
  - experimental-design
  - information-theory
  - measurement
description: There's a single objective that says what makes one experiment better than another — expected information gain. It's beautiful, it's principled, and it's a nightmare to compute. Here's the arc from Lindley in 1956 to policies that design experiments in real time.
---

Every experiment is a bet about where to look. You pick a dose, a price point, a question to ask, a stimulus to present — a _design_ — and the data you get back depends on it. Some designs teach you a lot; some teach you almost nothing. The question that organizes all of Bayesian experimental design is disarmingly simple: is there a single number that says how good a design is, _before you run it_?

There is. Dennis Lindley wrote it down in 1956, and the rest of the field is, to a first approximation, seventy years of learning how to actually compute it.

I keep coming back to this topic because it inverts the usual relationship between modeling and design. Most of us treat the experiment as fixed and obsess over the analysis. Bayesian optimal experimental design (BOED) treats the analysis as fixed — you're going to do Bayesian inference — and asks what data collection would make that inference sharpest. It's the difference between optimizing your reaction to the world and optimizing your questions to it.

## The objective: expected information gain

Lindley's idea was to measure an experiment by how much it shrinks your uncertainty about the parameters $\theta$ you care about. Start with prior $p(\theta)$, run design $\xi$, observe $y$, land at posterior $p(\theta \mid y, \xi)$. The information you gained is the drop in entropy from prior to posterior. You don't know $y$ in advance, so you average over what you might see:

$$\mathrm{EIG}(\xi) = \mathbb{E}_{p(y \mid \xi)}\big[\,\mathrm{H}[p(\theta)] - \mathrm{H}[p(\theta \mid y, \xi)]\,\big]$$

This single quantity is the whole game. The optimal design is just $\xi^\* = \arg\max_\xi \mathrm{EIG}(\xi)$.

What makes it satisfying is that EIG is exactly the **mutual information** between $\theta$ and $y$ under your model:

$$\mathrm{EIG}(\xi) = \mathbb{E}\left[\log \frac{p(\theta, y \mid \xi)}{p(\theta)\,p(y \mid \xi)}\right] = I_\xi(\theta; y)$$

It's symmetric, it's non-negative (an experiment can't hurt you on average — Lindley's first theorem), and it's additive across sequential experiments (his second theorem, which is the chain rule for information and the seed of every adaptive design). It also doesn't depend on the unknown true $\theta$, which is exactly where classical Fisher-information criteria get awkward — D-optimality and friends need you to plug in the very parameter you're trying to learn.

So we have a principled, model-based, parameter-free objective. Why isn't this the end of the story?

## The curse: a nested expectation

Look again at the marginal $p(y \mid \xi) = \mathbb{E}_{p(\theta)}[p(y \mid \theta, \xi)]$ sitting inside the log. To evaluate EIG you need an expectation over $y$, and inside it, for every $y$, another expectation over $\theta$ to get that marginal. It's **doubly intractable**: a nested expectation with no closed form.

The naive estimator draws $\theta_n$ and $y_n$ outer samples, then for each one draws $M$ fresh inner samples to approximate the marginal:

$$\hat\mu_{\mathrm{NMC}}(\xi) = \frac{1}{N}\sum_{n=1}^N \log \frac{p(y_n \mid \theta_{n,0}, \xi)}{\frac{1}{M}\sum_{m=1}^M p(y_n \mid \theta_{n,m}, \xi)}$$

This works, but it's slow and biased. Jensen's inequality makes the inner average biased by $O(1/M)$, and when you optimally split a budget $C = NM$ between outer and inner samples, the mean-squared error converges as

$$\mathrm{MSE} = O\!\left(C^{-1/3}\right)$$

That $-1/3$ is the villain of the story. Ordinary Monte Carlo gives you $C^{-1/2}$; the nesting costs you a third of your exponent. Every dollar of compute buys far less than it should, and it gets worse as designs get higher-dimensional.

## The escape: amortize the inner problem

The breakthrough — Foster et al. in 2019 — was to stop recomputing the inner integral from scratch for every outcome. Instead, _learn a function_ that approximates the troublesome quantity once, then reuse it everywhere. This turns the multiplicative cost into an additive one and recovers the $O(T^{-1/2})$ rate.

The cleanest version is the **Barber–Agakov bound**. Train an amortized inference network $q_p(\theta \mid y, \xi)$ to approximate the posterior, and you get a guaranteed lower bound on EIG:

$$\mathcal{L}(\xi) = \mathbb{E}_{p(y, \theta \mid \xi)}\left[\log \frac{q_p(\theta \mid y, \xi)}{p(\theta)}\right] \le \mathrm{EIG}(\xi)$$

with equality exactly when $q_p$ matches the true posterior; the gap is the expected KL between them. There's a dual that approximates the _marginal_ instead and gives you an upper bound — useful because you can sandwich the true EIG between a lower and upper estimate. And there's a contrastive variant (VNMC, later ACE/PCE) that's the only one guaranteed to converge to the true EIG even when your approximating family doesn't contain the posterior — it just needs enough contrastive samples.

Which one to reach for comes down to a couple of clean rules: approximate a distribution over $\theta$ when $\theta$ is lower-dimensional than $y$, approximate over $y$ when it's the other way around; use the marginal/contrastive forms when you have an explicit likelihood and the posterior/implicit forms when you don't. The contrastive bounds, it turns out, are the same InfoNCE bounds people use in representation learning — BOED and contrastive self-supervision are solving the same estimation problem from opposite ends.

## The payoff: designing in real time

Here's where it stops being an estimation story and becomes a control story. The 2020 follow-up folded the EIG estimate and the design itself into a _single_ stochastic-gradient loop — instead of pricing each candidate design and handing it to an outer optimizer, you take gradients with respect to $\xi$ directly and ascend. That scales to designs with hundreds of dimensions, where grid search and Bayesian optimization simply fall over. On a 400-dimensional regression design it roughly doubled the information of the best baseline; on a 100-dimensional molecular docking problem it beat human experts.

The final move, and my favorite, is **Deep Adaptive Design**. In a sequential experiment, the textbook loop is design → observe → re-infer the posterior → design again. The re-inference is expensive and the greedy step is myopic — it grabs the most informative _next_ question without regard to the ones after it. DAD trains a policy network $\pi_\phi$ _offline_ that maps the history of an experiment straight to the next design:

$$\xi_t = \pi_\phi(h_{t-1}), \qquad h_{t-1} = \{(\xi_k, y_k)\}_{k < t}$$

trained to maximize the _total_ information gain over the whole sequence. Because EIG is additive, optimizing the total is automatically non-myopic. And at deployment there's no inference and no optimization — a single forward pass picks the next question. You can run an adaptive experiment in real time on a phone.

## What I take from it

The arc here is one I find genuinely instructive. Lindley handed us the _right_ objective in 1956 and it sat largely unused for decades, not because anyone doubted it but because nobody could compute it at the scales that mattered. The progress since hasn't been about finding a better objective — it's been about the unglamorous, essential work of estimation: spotting that a nested expectation is the bottleneck, amortizing the inner problem, turning a pricing loop into a gradient, and finally compiling the whole design process into a learned policy.

It's a useful reminder for applied work generally. The bottleneck between a principled idea and a usable tool is almost never the principle. It's the estimator.

---

_Synthesized from Lindley (1956), Foster et al. (2019, NeurIPS) "Variational Bayesian Optimal Experimental Design," Foster et al. (2020, AISTATS) "A Unified Stochastic Gradient Approach," and Rainforth, Foster, Ivanova & Bickford Smith (2023), "Modern Bayesian Experimental Design," Statistical Science 38(1)._
