---
layout: post
title: Building Systems That Build Systems
date: 2025-11-25 11:59:00-0400
description:
tags: ai
categories: code
related_posts: false
giscus_comments: false
published: false
typograms: true
pseudocode: true
---

_On meta-systems, intermediate representations, and why agent simulation is a code generation problem_

> _In a [previous post](/blog/2025/entropy-01), I walked through how we built Entropy Architect's two-layer architecture by iterating from a fixed schema to dynamic discovery. This post examines why that architecture is actually a compiler pattern—and what that enables._

### **Why Most Agent Systems Fail at Scale**

---

The fundamental problem with agent-based modeling isn't technical, it's architectural. When you build a simulation framework, you're making an implicit bet about where complexity lives.

Traditional ABM frameworks like [NetLogo](https://www.netlogo.org/), [Mesa](https://mesa.readthedocs.io/latest/#), and [MASON](https://cs.gmu.edu/~eclab/projects/mason/) bet that complexity lives in agent behavior. They give you primitives for movement, interaction, decision-making. The schema is your problem. You either accept their generic template or write custom code for each population type.

This works fine for toy models. Predator-prey dynamics. Disease spread on networks. Conway's Game of Life. But the moment you try to model real human populations, Google employees, German surgeons, Netflix subscribers, or swing-state voters you hit a wall. The attributes that matter for a surgeon (Facharzt specialty, institutional rank, clinical tenure) have nothing to do with what matters for a voter (party affiliation, media diet, economic anxiety). You end up either forcing inappropriate schemas or maintaining parallel codebases.

The problem is premature binding. These systems force you to decide what an "agent" is before you know what population you're modeling. That's backwards.

---

### **Compiler Insight**

---

What if agent generation is actually a code generation problem?!

Think about how compilers work. You don't write x86 assembly for every program. You write high-level code (C++, Rust, Go), and the compiler generates machine code. The compiler is basically a meta-system, aka a system that builds systems.

The key insight: there's an intermediate representation (IR) between source code and machine code. LLVM IR, Java bytecode, WebAssembly. The IR is:

- **Portable** across backends
- **Inspectable** for debugging and optimization
- **Lower-level** than source but **higher-level** than machine code
- **Optimizable** without touching source or target

This separation of concerns is what makes modern software infrastructure work. Frontend compilers (Clang, rustc, javac) target the same IR. Backend optimizers work on IR without knowing the source language. Code generators produce machine code from IR without knowing what program it came from.

**So, what's the IR for agent populations?**

That's what we built.

---

### **Specs as Intermediate Representation**

---

Our architecture treats population generation as a compilation pipeline:

```typograms
Natural Language → Architect (LLM) → Spec (YAML) → Sampler (Math) → Agents
     (source)         (frontend)        (IR)        (backend)      (binary)
```

The spec is not documentation or a config file. It's now an executable IR: a portable, inspectable, optimizable representation of how to generate _any_ population.

Here's what makes it IR rather than just a YAML file:

**Self-contained execution semantics.** The spec doesn't reference external code. Everything needed to generate agents is encoded in data that describes transformations. When you write `strategy: conditional` with a distribution and modifiers, the sampler knows exactly what to do without consulting external logic.

**Semantic optimization potential**. Because dependencies are explicit in the sampling order, we can optimize execution in ways impossible with opaque Python classes. Parallelize independent attributes. Vectorize conditional sampling for batches. Cache expensive distributions. Detect circular dependencies at spec-load time, not during a production run with 50,000 agents.

**Multiple backend targets.** The sampler is swappable. Same spec, different execution strategies: CPU sampler with NumPy, GPU sampler with CuPy for massive populations, distributed sampler with Ray for cluster deployment, streaming sampler that generates agents on-demand without materialization. The spec doesn't change. Only the backend does. This is exactly how LLVM works: write Rust, compile to x86 or ARM. Same IR, different codegen.

**Inspectable and debuggable.** When agents behave strangely, you don't debug Python stack traces. You inspect the spec and validate sampling semantics. You can see that `adoption_likelihood` uses beta(2.0, 2.5), that the modifier `years_of_practice > 15` affects 62% of the population, that expected range is [0.15, 0.85] and actual samples fell within bounds. This is IR-level debugging—you're examining the compilation artifacts, not chasing type errors.

---

### **Why the Architect Must Be Separate**

---

The Architect Layer is the frontend compiler. It translates domain concepts ("German surgeons") into formal specifications that a generic sampler can execute.

Using LLMs directly to generate agents is a fool's errand. "_You are a 45-year-old German surgeon. You are skeptical of AI..._" This is like writing assembly by hand. It works for small programs but doesn't scale. You're coupling domain knowledge (what makes a surgeon) with execution (how to generate one).

Separation of concerns matters because the Architect knows domain semantics—surgeons have specialties, rank correlates with salary, institutional context shapes behavior. The spec encodes sampling logic—how to translate domain knowledge into distributions, modifiers, and dependencies. The sampler knows execution—how to efficiently generate 10,000 agents with proper correlations and variance.

This separation enables caching (generate base population spec once, reuse across scenarios), validation (check spec correctness before expensive sampling), composition (overlay scenario-specific attributes on cached base), and iteration (tweak spec manually, regenerate instantly). When you generate agents directly with LLMs, none of this is possible. Every generation is bespoke. No reuse, no inspection, no optimization.

---

### **The Base + Overlay Approach**

---

The two-layer architecture isn't just about efficiency. It's about correctly factorizing the problem.

Humans aren't monolithic. We have structural attributes that persist across contexts—age, training, socioeconomic position—and behavioral attributes that vary by scenario—price sensitivity for this product, risk tolerance for that decision. Traditional systems force you to decide upfront: is "tech comfort" a core attribute or a scenario attribute?

The answer is it depends on the population. For a general adult population, tech comfort might be structural, correlated with age and education. For German surgeons evaluating an AI diagnostic tool, tech comfort is behavioral—their response to _this specific technology_, not a general personality trait.

We don't make you choose. The Architect decides based on research. The base layer caches durable identity—age, specialty, institutional rank, salary. The overlay discovers scenario-specific traits—tech comfort, peer influence, adoption likelihood. Here's the key: the overlay sees the base schema during research (context injection), so it models dependencies correctly. When `adoption_likelihood` depends on `years_of_practice`, the system knows surgeons with over 15 years get a 0.8 modifier.

Think of it as compositional design. Base layer is the type system. Overlay is the program written against it. Sampler is the interpreter.

---

### **Conditional Distributions: The Type System for Variance**

---

The "Cool Grandpa" pattern solves something subtle: how do you encode trends without eliminating variance?

Deterministic functions create clones. If `risk_tolerance = 1.0 / age`, every 45-year-old behaves identically. Pure random sampling creates chaos—suddenly a 70-year-old surgeon is more risk-seeking than a 30-year-old.

What we observe in reality: distributions with conditional means. Older people are _on average_ more risk-averse, but there's individual variance within each age group.

The math is straightforward. Sample a base distribution for individual variance: `risk_tolerance ~ Beta(α, β)`. Apply conditional adjustment for population trend: multiply by 0.7 if age > 50.

Watch what happens. Sample from Beta(2.5, 2.5) → 0.62. Check condition: age 58 > 50 → true. Apply modifier: 0.62 × 0.7 = 0.434. Another 58-year-old might sample 0.48 initially, ending at 0.34. Individual variance preserved within the conditional distribution.

This isn't just mathematically correct—it's philosophically correct. We're modeling humans, not equations. Individual agency exists within structural constraints. A senior surgeon _can_ be tech-forward, it's just less likely than a junior one. Traditional ABM systems don't give you primitives for this. You either handcode it (losing generality) or accept clones and chaos (losing realism).

---

### **What This Enables**

---

Because the spec is portable IR, you can build tooling around it. Validators check for circular dependencies. Optimizers suggest better sampling strategies. Visualizers plot distributions before you generate a single agent. Debuggers trace why agent #4,281 got those specific values. Version control shows what changed between runs.

More importantly, you can build higher-order abstractions. Merge specs to compose populations. Interpolate between 2020 and 2024 demographics to model 2022. Perturb age distributions to simulate demographic shifts. These are operations on the IR, not the agents. Fast, deterministic, composable.

---

### **Why This Generalizes**

---

The pattern applies beyond simulation. Anytime you're generating structured, diverse data from high-level descriptions—synthetic training data for ML, test cases for software, procedural content for games, digital twins for organizations—you face the same problem.

Standard approach: write custom generators for each domain. Our approach: build an Architect that generates specs, build a Sampler that executes them. Separation of concerns. Portability. Inspectability. This is how you scale.

The architecture is live. Architect does LLM-driven research and generates YAML specs with base/overlay. Sampler implements three strategies—independent, derived, conditional—with topological sort. Specs are 100-200 lines, human-readable, version-controllable.

The specs we generate today will work with future samplers. GPU-accelerated, distributed, streaming. That's the promise of IR. You don't rewrite your C++ when you upgrade from x86 to ARM. You don't rewrite your population specs when you upgrade your sampling backend.

---

### **The Meta-System Pattern**

---

This isn't "a better way to generate agents." It's a different kind of system—one that generates systems.

Most engineers solve problems. Senior engineers build systems. We're building systems that build systems.

The LLM doesn't generate agents. It generates the specification. The specification generates the agents. That's the difference between tooling and infrastructure.

_Entropy is under active development._
