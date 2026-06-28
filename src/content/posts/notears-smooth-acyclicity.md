---
title: "NO TEARS: How Acyclicity Became Differentiable"
author: Matthew Reda
pubDatetime: 2026-06-28T14:00:00Z
slug: notears-smooth-acyclicity
draft: false
tags:
  - causal-discovery
  - optimization
  - dags
  - structure-learning
description: Learning the structure of a causal graph from data used to be a combinatorial search over a space that grows superexponentially. One change of variables turned it into gradient descent.
---

For most of its history, learning a causal graph from data was a search problem, and a brutal one. You want the directed acyclic graph that best explains your data, but the number of DAGs on $d$ nodes grows _superexponentially_ — faster than $d!$, faster than $2^{d^2}$. So the field built clever heuristics: add an edge, check it doesn't create a cycle, score the result, greedily keep going. PC, GES, FGS — all variations on walking the discrete space one edge at a time, because you can't enumerate it and you can't differentiate it.

In 2018, Zheng, Aragam, Ravikumar, and Xing published a paper with a title that tells you exactly how the field felt about this: _DAGs with NO TEARS_. Their move was to stop searching the discrete space at all. They found a way to write "this graph is acyclic" as a smooth equation, and once you can do that, structure learning becomes continuous optimization. You can run a gradient-based solver. The whole thing is about fifty lines of Python.

I find this one of the cleaner examples of a recurring pattern in applied math: the hard part of a problem is often the _representation_, not the objective. Change how you encode the constraint and an intractable problem becomes a routine one.

## The problem, set up honestly

Assume a linear structural equation model. Each variable is a noisy linear function of its parents:

$$X_j = w_j^\top X + z_j, \quad j = 1, \ldots, d$$

The whole graph lives in a weighted adjacency matrix $W \in \mathbb{R}^{d \times d}$, where $w_{ij} \neq 0$ means there's an edge $i \to j$. Fitting the model is least squares with a sparsity penalty:

$$F(W) = \frac{1}{2n}\left\| \mathbf{X} - \mathbf{X}W \right\|_F^2 + \lambda \|W\|_1$$

That part is easy. The hard part is the constraint that $W$ has to encode a DAG:

$$\min_{W} F(W) \quad \text{s.t.} \quad W \text{ is acyclic}$$

"Acyclic" is the word doing all the damage. It's a combinatorial property of the _sign pattern_ of $W$, and optimizing subject to it is NP-hard. The classical approaches respect that and search; NOTEARS refuses to.

## The trick: counting cycles with a matrix exponential

Here is the idea, built up the way it actually works.

A directed graph with binary adjacency matrix $B$ has a cycle of length $k$ exactly when $\mathrm{tr}(B^k) > 0$ — the diagonal of $B^k$ counts closed walks of length $k$. So the graph is acyclic iff _every_ power has zero trace. Summing those traces gives a single number that's zero iff there are no cycles of any length. But raw powers of $B$ are numerically unstable and the sum doesn't obviously converge.

The fix is to borrow the weighting from the matrix exponential, $e^B = \sum_{k=0}^\infty B^k / k!$. The factorial denominators tame the series — it converges for _any_ square matrix — while preserving the "diagonal counts cycles" property. For a binary matrix:

$$\mathrm{tr}(e^B) = d \iff B \text{ is a DAG}$$

(The $d$ on the right is just the $k=0$ term, $\mathrm{tr}(I) = d$; every higher term must vanish.)

To extend this from binary to real, signed weights, they apply the Hadamard (elementwise) square $W \circ W$. The result is the centerpiece of the paper:

$$h(W) = \mathrm{tr}\!\left(e^{W \circ W}\right) - d = 0 \iff W \text{ is a DAG}$$

Why square the entries? Because without it, a two-cycle $1 \to 2 \to 1$ with weights $+1$ and $-1$ contributes $w_{12}\,w_{21} = -1$ to the trace, and a cycle could _cancel itself out_ numerically — you'd certify a cyclic graph as acyclic. Squaring forces every cyclic contribution strictly positive, so $h(W) > 0$ precisely when a cycle exists, and $h(W) = 0$ precisely when it doesn't. As a bonus, $h$ doesn't just test acyclicity — its value _quantifies_ how cyclic the graph is, which matters for the optimizer.

And it's smooth, with a gradient you can write in one line:

$$\nabla h(W) = \left(e^{W \circ W}\right)^\top \circ 2W$$

That's the whole conceptual payoff. The discrete constraint "is a DAG" has become a smooth equality constraint $h(W) = 0$ with a cheap gradient.

## From here it's just constrained optimization

Once the constraint is smooth, the rest is standard machinery. NOTEARS solves

$$\min_W F(W) \quad \text{s.t.} \quad h(W) = 0$$

with the augmented Lagrangian:

$$L^\rho(W, \alpha) = F(W) + \frac{\rho}{2}\,|h(W)|^2 + \alpha\, h(W)$$

You minimize over $W$ (L-BFGS, or a proximal quasi-Newton step when the $\ell_1$ term is on), bump the multiplier $\alpha \leftarrow \alpha + \rho\, h(W)$, raise the penalty $\rho$, and repeat. In practice it converges in **fewer than ten outer iterations**. A final hard-threshold step zeroes out tiny weights to round the near-DAG to an exact one. Each iteration costs $O(d^3)$ — the price of one matrix exponential.

The honest caveat: the constraint set $\{W : h(W) = 0\}$ is nonconvex, so you're only guaranteed a stationary point, not the global optimum. But the empirical results are reassuring. On 10-node graphs where an exact integer-programming solver can find the true global minimum, NOTEARS lands within $0.02$–$0.04$ of it in both score and parameter distance. Against FGS it's competitive on sparse graphs and _decisively better_ on dense, hub-heavy ones — exactly where edge-at-a-time greedy search struggles. And it's robust across Gaussian, Exponential, and Gumbel noise without being told which it's facing.

## The lesson that outlasts the method

NOTEARS isn't the last word — it assumes linearity, the $O(d^3)$ exponential is a bottleneck at scale, and a wave of follow-up work (DAG-GNN, GOLEM, NOCURL, and the nonlinear extensions) has pushed on every one of those limits. But the contribution that mattered wasn't a better search heuristic. It was a single equation:

$$h(W) = \mathrm{tr}(e^{W \circ W}) - d$$

that turned a property everyone treated as inherently combinatorial into something you can take a gradient of. When a problem feels intractable, it's worth asking whether the intractability lives in the problem or in the way you've written it down. Sometimes the entire difficulty is a bad change of variables away from disappearing.

---

_Based on Zheng, Aragam, Ravikumar & Xing (2018), "DAGs with NO TEARS: Continuous Optimization for Structure Learning," NeurIPS 31, [arXiv:1803.01422](https://arxiv.org/abs/1803.01422)._
