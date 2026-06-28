---
title: "You Are Your Relationships: The Yoneda Lemma"
author: Matthew Reda
pubDatetime: 2026-06-28T17:00:00Z
slug: yoneda-you-are-your-relationships
draft: false
tags:
  - category-theory
  - mathematics
  - abstraction
  - machine-learning
description: "Category theory's most famous lemma says something almost philosophical: an object is completely determined by its relationships to everything else. The same idea quietly powers embeddings, interfaces, and most good abstraction."
---

There's a piece of category theory that gets quoted so often it's become a slogan: *an object is determined by its relationships*. It sounds like something from a self-help book. It's actually a precise theorem — the Yoneda lemma — and once it clicks, you start seeing it everywhere: in how word embeddings work, in why interfaces beat implementations, in what it even means to define something abstractly.

I want to walk through what it actually says, because the slogan undersells how concrete and useful the underlying idea is.

## Stop looking inside the object

Mathematics is full of objects you'd normally define by their internals: a group is a set with an operation, a vector space is a set with addition and scaling. The Yoneda perspective flips this. Instead of asking *what is inside* an object $A$, it asks *how does everything else map into $A$*.

For each object $A$ in a category, collect all the morphisms into it. This bundle is a functor, written $H_A = \mathcal{A}(-, A)$, that sends any object $B$ to the set of arrows $B \to A$. Think of it as $A$'s complete relationship profile: every way every other object can "see" $A.$ A functor that looks like this — that *is* one of these hom-bundles — is called **representable**.

The claim the slogan is gesturing at is that this profile contains everything. If two objects have naturally isomorphic profiles, $H_A \cong H_{A'}$, then the objects themselves are isomorphic, $A \cong A'$. You never had to open them up. The view from outside, from all angles at once, was complete.

## The lemma itself

The Yoneda lemma is sharper and, the first time you see it, a little startling. Take any set-valued functor $X$ and any object $A$. Then:

$$[\mathcal{A}^{\mathrm{op}}, \mathbf{Set}](H_A, X) \;\cong\; X(A)$$

Read the left side carefully. A natural transformation $H_A \Rightarrow X$ is an *enormous* object — a whole coherent family of functions, one for every object $B$, all of them commuting with every morphism in the category. It looks like infinite data. The lemma says that entire infinite family is pinned down by a *single element* of the set $X(A)$. The bijection is almost insultingly simple: a natural transformation $\alpha$ corresponds to $\alpha_A(1_A)$ — you just feed it the identity arrow on $A$ and see where it goes. Everything else is forced.

That's the technical heart: maps *out of* a representable functor are determined by one element. All the apparent freedom collapses, because the naturality conditions — the requirement that everything commute — leave no room for arbitrary choices. Fix where the identity lands and the rest of the infinite family is determined.

## Cayley's theorem, all grown up

Apply the lemma to the case where $X$ is itself another hom-bundle and you get the **Yoneda embedding**. It says morphisms $A \to B$ in your category correspond *exactly* to natural transformations $H_A \Rightarrow H_B$:

$$\mathcal{A}(A, B) \;\cong\; [\mathcal{A}^{\mathrm{op}}, \mathbf{Set}](H_A, H_B)$$

In plain terms: nothing is lost when you replace each object by its relationship profile and each arrow by the induced map of profiles. The whole category sits faithfully inside its category of profiles. This is the categorical version of Cayley's theorem — the one that says every group is a group of permutations. Yoneda generalizes it: every category is, up to faithful embedding, a category of set-valued functors. You can always trade objects for the structured shadows they cast on everything else, and recover them perfectly.

A clean corollary falls out: anything defined by a **universal property** — products, limits, free groups, tensor products — is unique up to a *unique* isomorphism. A universal property is exactly a statement that some functor is representable, and the representing object, being its relationship profile, is pinned down with no wiggle room. There's no "choosing between equally good products." The property determines the object.

## Where you've already met this

The reason I find Yoneda worth caring about outside pure math is that the same move — *define a thing by its relationships, not its substance* — is the engine behind ideas we use constantly.

**Word and graph embeddings.** "You shall know a word by the company it keeps." An embedding doesn't capture some essence of a word; it records the word's relationships to contexts, and that's enough to recover meaning, analogy, and similarity. An embedding is, quite literally, a slice of a word's Yoneda profile — its pattern of relationships projected onto a fixed set of probes. The reason embeddings work at all is the reason Yoneda works: a thing's relational footprint determines the thing.

**Interfaces over implementations.** When you program against a type's API rather than its internals, you're betting that the relationship profile — what you can do with the type, how it composes with everything else — is what matters, and that two implementations with the same profile are interchangeable. That bet is the Yoneda lemma in software-engineering clothes. "Program to an interface" is "an object is its morphisms."

**Abstraction in general.** Every good abstraction — a protocol, a specification, a contract — defines a concept by how it interacts rather than what it's made of. Yoneda is the formal statement that this is *legitimate*: you lose nothing by specifying an object purely through its relationships, because the relationships were always the whole story.

## The takeaway

The Yoneda lemma compresses to one sentence — *maps out of a representable functor are determined by a single element* — and unfolds into something that feels almost philosophical: identity is relational. An object's substance is a fiction we can do without; its pattern of relationships is the real content, and that pattern determines it completely.

Most of us already operate this way without the license. We trust an API without reading the source, we trust an embedding without asking what a word "really" is, we define the abstract thing by its behavior. Yoneda is the theorem that says this instinct is not a convenient shortcut. It's exactly right.

---

*Synthesized from notes on the Yoneda lemma, representable functors, and the Yoneda embedding, following Leinster's *Basic Category Theory* and Riehl's *Category Theory in Context*.*
