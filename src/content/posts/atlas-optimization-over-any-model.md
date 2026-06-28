---
title: "Atlas: Budget Optimization Over Any Model"
author: Matthew Reda
pubDatetime: 2026-06-23T13:00:00Z
slug: atlas-optimization-over-any-model
draft: false
tags:
  - optimization
  - marketing-mix-modeling
  - python
  - decision-making
description: A fitted model predicts response; it doesn't hand you the best budget. Atlas is a model-agnostic framework that turns any predictive model into constraint-respecting spend recommendations.
---

There's a quiet handoff in every measurement project that nobody puts on the slide. You spend three months fitting a marketing mix model, you cross-validate it, you argue about priors, you finally get response curves you trust. And then someone asks the only question that mattered the whole time: "So what should we spend?"

The model does not answer that. A fitted model gives you $\text{KPI}(b)$ — the expected outcome for a budget allocation $b$. It does not give you the $b$ that's best, and it certainly doesn't give you the best $b$ that also respects a total budget, channel floors, and the rule that legal won't let you cut the brand campaign below a number. That second step — turning a response surface into a decision under constraints — is a separate problem, and it's the one that actually changes behavior. [Atlas](https://github.com/redam94/atlas) exists to do that step well, and to do it the same way every time.

## The handoff is the hard part

Stated plainly, the budgeting problem is a constrained optimization:

$$\max_{b} \; \mathbb{E}[\,\text{KPI}(b)\,] \quad \text{s.t.} \quad \sum_i b_i \le B,\;\; b_i \in [l_i, u_i]$$

That's the easy version. In practice $\text{KPI}(b)$ is non-convex because response curves saturate, you have multiple KPIs that disagree with each other, and the constraints are business rules nobody wrote as math ("at least 25% to digital," "don't touch print this quarter"). You can solve this by hand in a spreadsheet, evaluating scenarios one at a time, and people do. It's slow, it's inconsistent between analysts, and the "optimum" you land on is mostly an artifact of where you got bored.

The thing I want to push back on is treating the optimizer as a reporting flourish — a prettier allocation chart bolted onto the model. It isn't. The optimizer _is_ the decision. Everything upstream is in service of it.

## Model-agnostic on purpose

Atlas's central design choice is that it doesn't care what your model is. It talks to predictive models through a narrow interface — give it a `predict`, and it can optimize over you. From `atlas.core.interfaces`:

```python
class AbstractModel(ABC):
    @abstractmethod
    def predict(self, x: xr.Dataset) -> xr.DataArray:
        """Generate predictions from input data."""

    @abstractmethod
    def contributions(self, x: xr.Dataset) -> xr.Dataset:
        """Calculate feature contributions for the given input."""
```

Wrap an XGBoost model, a scikit-learn pipeline, a Bayesian MMM, or a remote API behind that contract and the optimizer treats them identically. This matters less for elegance and more for consistency: when the ML team and the econometrics team feed the same optimizer, their budget recommendations are comparable instead of being two incommensurable artifacts produced by two different spreadsheets. The README lists the optimization backends — SciPy, Optuna, and (on the roadmap) CVXPY — sitting behind the same factory so you can swap a gradient method for a Bayesian search without rewriting the problem.

## What the API actually looks like

Here's the shape of a run, from the README's quick start. You build a model, build an optimizer, and hand the optimizer a request that carries the bounds and constraints:

```python
from atlas import OptimizationService, ModelFactory, OptimizerFactory
from atlas.config import ConfigurationManager

model = ModelFactory.create(model_type="xgboost", config=config.model)
optimizer = OptimizerFactory.create(
    optimizer_type="optuna", model=model, config=config.optimizer
)

request = OptimizationRequest(
    bounds={
        "digital_marketing": (100_000, 500_000),
        "tv_advertising": (50_000, 300_000),
        "print_media": (20_000, 100_000),
    },
    constraints={
        "total_budget": 750_000,
        "min_digital_percentage": 0.3,
        "max_traditional_percentage": 0.5,
    },
)

result = optimizer.optimize(request)
print(f"Optimal allocation: {result.optimal_budget}")
print(f"Expected outcome: {result.optimal_value}")
```

The `bounds` are the $[l_i, u_i]$ box on each channel; the `constraints` are the $\sum_i b_i \le B$ and the percentage rules. The result comes back as an `OptimizationResult` carrying `optimal_budget` and `optimal_value` — the allocation and what the model thinks it buys you. Note what's _not_ in this snippet: any opinion about how the model was fit. That's the point.

Constraints in Atlas are first-class objects, not afterthoughts. In the worked marketing example shipped in the repo, they're declared explicitly with types — an `EQUALITY` constraint pinning total spend, a `BOUNDS` constraint per channel, and an `INEQUALITY` enforcing a digital floor:

```python
Constraint(
    name="total_budget",
    type=ConstraintType.EQUALITY,
    function=lambda b: b.total(),
    value=1_000_000,
)
```

That a "spend exactly the budget" rule and a "feasible region per channel" rule are the same kind of object is what keeps the recommendations honest. A recommendation that violates a constraint isn't an aggressive recommendation; it's a wrong one.

## Multiple KPIs, because real goals conflict

Revenue, brand awareness, and customer acquisition do not move together, and pretending they do is how you end up optimizing a number nobody asked for. Atlas handles this with explicit weighting — the `MultiObjectiveOptimizer` in the examples takes a list of objectives and the weights you're willing to trade them off at:

```python
optimizer = MultiObjectiveOptimizer(
    model=mmm_model,
    objectives=["revenue", "brand_awareness", "customer_acquisition"],
    weights=[0.5, 0.3, 0.2],
)
```

I like that the trade-off is a parameter you have to type out. It forces the conversation about what you actually value to happen in the open, before the optimizer runs, instead of being smuggled in as a modeling default.

## The payoff is consistency, not magic

The repo claims "10x faster scenario evaluation vs. manual methods," and I'll quote it as exactly that — Atlas's own claim, not an independent benchmark I ran. But speed isn't the part I'd sell. The part I'd sell is that the path from model to recommendation is the same every time: same constraint objects, same optimizer interface, same result type, whether the model underneath is an MMM or a gradient-boosted tree behind an API. Reproducible decisions beat fast wrong ones.

The takeaway: before your next planning cycle, write the budget decision as a constrained objective — total $B$, the box $[l_i, u_i]$, the rules that are non-negotiable — and put that in front of stakeholders _before_ you tune the model. If your optimizer can't express a constraint someone cares about, you've found the real gap, and it was never in the response curve. That's the work. The allocation chart is just what falls out at the end.
