---
layout: distill
title: "Extending the Autoresearch Loop"
date: 2026-05-01 01:00:00-0400
description:
tags: ai, research, earth-science, autoresearch
categories: code
giscus_comments: false
published: true
pretty_table: true
typograms: true
bibliography: 2026-05-01-autoresearch-paradigm-fire.bib

toc:
  - name: What this post covers
  - name: The actual problem we were attacking
  - name: Extending the loop, two layers of search
  - name: Method and results
  - name: Key lessons
  - name: Setup advice
  - name: Where this paradigm still falls short

_styles: >
  table {
    border-collapse: collapse !important;
    width: 100% !important;
    margin: 1.5rem 0 !important;
  }
  table th,
  table td {
    border-bottom: 1px solid rgba(128, 128, 128, 0.3) !important;
    padding: 0.5rem 0.75rem !important;
    text-align: left !important;
  }
  table th {
    border-bottom: 2px solid rgba(128, 128, 128, 0.5) !important;
  }

---

Autoresearch as a *thing* has shipped. Karpathy's autoresearch <d-cite key="karpathy2026autoresearch"></d-cite> popularized a small, working loop where an LLM agent edits a training script, runs it for five minutes, checks validation loss, and keeps or reverts the change. DeepMind's AlphaEvolve <d-cite key="deepmind2026alphaevolve"></d-cite> applied the same shape to algorithm discovery in production, evolving programs that get scored by automatic correctness and quality metrics. Anthropic's Automated Alignment Researcher <d-cite key="anthropic2026aar"></d-cite> ran parallel agents on weak-to-strong supervision experiments, scored by performance-gap-recovered on a held-out set. Across these three, the action space is code edits and the verifier is a fast automatic metric. Sakana AI's AI Scientist v2 <d-cite key="yamada2026sakanav2"></d-cite> stretches the shape further: it edits full manuscripts (hypotheses, code, figures, prose) and its terminal verifier is human peer review at workshop level, not an automatic score.

In the [earlier blog](/blog/2026/autoresearch-earth-system-models/) I described applying this loop to the Ecosystem Demography model (ED v3.0) <d-cite key="ma2022ed"></d-cite>, the land model I work on at the [Global Ecology Lab](https://gel.umd.edu). ED contributes vegetation, carbon, and disturbance dynamics to the Global Carbon Budget <d-cite key="friedlingstein2025gcb"></d-cite> through the TRENDY <d-cite key="sitch2024trendy"></d-cite> model intercomparison. That post covered the initial experiment. This one is about what we learned from spending several months on ED's fire submodel, and how the paradigm had to change to handle it.

## What this post covers

Fire forced us to adapt the autoresearch loop into a shape it does not have in the ML-benchmark setting. The search space covers functional form (grounded in fire ecology) and parameters simultaneously. The verifier is a multi-channel observational benchmark with per-region breakdowns and residual maps, not a loss curve. The post walks through the fire problem, the two-layer extension that fell out of the work, the result, and where we think the paradigm transfers and where it still breaks.

## The actual problem we were attacking

ED's fire submodel predicts *burned area*, the fraction of each grid cell that burns each month, validated against satellite-derived GFED4.1s burned-area maps <d-cite key="vanderwerf2017gfed"></d-cite>. The original formulation is rudimentary, structurally unchanged for years. On the ILAMB benchmark <d-cite key="collier2018ilamb"></d-cite> for TRENDY v14 it scores 0.4774 Overall, rank 23 out of 24 models. CLM6.0 <d-cite key="lawrence2019clm"></d-cite>, the strongest competitor in the same intercomparison, scores 0.6606.

Fire is one of the largest interannual contributors to the global carbon balance. Savanna and tropical-deforestation fires alone emit on the order of 2 GtC/yr <d-cite key="vanderwerf2017gfed"></d-cite>. A weak fire submodel propagates errors into ED's vegetation, soil-carbon, and emissions trajectories that feed every Global Carbon Budget cycle. So fixing fire was a real ask from the lab, and autoresearch had to extend to handle it.

Most physical-science domains share this shape. The literature defines the form space, multiple partial observational verifiers each capture a different facet of the truth, and the goal is loosely specified at the start. The lessons here are meant as thought vectors for anyone working in a similar setting.

## Extending the loop, two layers of search

The Karpathy loop searches over code. That works when the script is small and the loss is fast. In our setting the form space and the parameter space have very different structures and need very different search methods.

The form space is vast. Fire ecology has decades of literature with hundreds of candidate mechanisms across at least four named functional regimes (productivity-limited, fuel-limited, ignition-limited, weather-driven) <d-cite key="bowman2009firearth"></d-cite> <d-cite key="archibald2013synergistic"></d-cite>, and any working model is some combination, adaptation, or extension of those mechanisms rather than a single canonical form. The parameter space is continuous, ten to thirty dimensional, and explored well by Bayesian optimization. Asking an LLM to choose sigmoid slopes is wasteful. Asking Optuna to choose between a Pausas-Ribeiro fuel hump <d-cite key="pausas2013fire"></d-cite> and a van der Werf intermediate-productivity term <d-cite key="vanderwerf2008climate"></d-cite> is incoherent. So the loop splits into two layers.

The LLM agent handles form-layer search. It searches over combinations of mechanisms drawn from fire ecology, sometimes taking a published form as is, sometimes adapting one to fit the rest of the formula, sometimes inventing a new term. The constraint is ecological grounding: whatever shows up has to be explainable and verifiable against the literature. Pausas-Ribeiro fuel hump for fuel-limited regimes. van der Werf intermediate-productivity hypothesis for monthly GPP gating. Archibald air-temperature ignition sigmoid <d-cite key="archibald2010relative"></d-cite>. Krawchuk hyperarid suppression <d-cite key="krawchuk2009global"></d-cite>. Mix and match, depending on what the residuals say.

Optuna handles parameter-layer search. Once a form is fixed, TPE <d-cite key="bergstra2011tpe"></d-cite> finds best parameters in 500 to 2500 trials. The agent never touches numeric hyperparameters. Optuna never touches forms.

```typograms
+----------+     +-----------+     +-----------+     +---------+
|   Form   |     | Parameter |     |           |     | Shapley |
|  Layer   +---->|   Layer   +---->| Benchmark +---->| Ablate  |
|  (LLM)   |     |  (Optuna) |     |           |     |         |
+----------+     +-----------+     +-----------+     +----+----+
     ^                                                    |
     |                  feedback                          |
     '----------------------------------------------------'
```

The two layers then recurse. Each form candidate gets fit by Optuna, scored by the real benchmark, and the result feeds back to the agent for the next form iteration. After our 8-mechanism formula (Model A) hit 0.66 Overall, the natural next question was which of those eight mechanisms were actually carrying weight.

The simple version of this question is ablation: remove one piece of your model, refit, and measure how much the score drops. If nothing changes, it was not contributing. The problem is that in a multiplicative formula, contributions are conditional. Mechanism A might look useless when B is present, but critical when B is absent, because they encode overlapping signals. Removing one mechanism at a time misses these interactions entirely, and running every possible subset (full combinatorial ablation) scales as $$2^N$$, which is intractable past about ten components.

The Shapley value <d-cite key="shapley1953"></d-cite> <d-cite key="lundberg2017shap"></d-cite> is the fix. Originally from cooperative game theory, it averages each mechanism's marginal contribution over every possible subset of the other mechanisms. For 8 mechanisms that means $$2^8 = 256$$ subsets, each of which gets its own Optuna fit. Expensive (about 220 minutes for us), but the result is a single number per mechanism that accounts for all the ways it interacts with everything else.

What the Shapley decomposition revealed was that our explicit fuel-biomass hump contributed only 5 percent of the total, because monthly GPP was already carrying the productivity signal that fuel was supposed to carry. Without this step we would have shipped that redundancy and never known. We dropped five mechanisms, refit the remaining three, and the smaller 12-parameter model (Model C) scored higher than the 8-mechanism version. Any autoresearch loop that composes mechanisms needs something like this. The question is always "is this piece actually doing work, or is another piece already covering for it?"

## Method and results

We reproduced the official ILAMB benchmark for the TRENDY v14 reference models locally, then scored our offline ED with the same harness and inputs from a prior ED run. Full reproduction lives in the [repository](https://github.com/DeveshParagiri/ed-autoresearch). Model C, the 3-mechanism, 12-parameter form, scored 0.6713 Overall, rank 1 out of 24.

| Rank | Model | Bias | RMSE | Seasonal | Spatial | Overall |
|-----:|---|---:|---:|---:|---:|---:|
| 1 | ED Model C (ours) | 0.728 | 0.506 | 0.846 | 0.771 | 0.6713 |
| 2 | CLASSIC | 0.738 | 0.507 | 0.782 | 0.797 | 0.6665 |
| 3 | CLM6.0 | 0.759 | 0.474 | 0.758 | 0.838 | 0.6606 |
| 4 | CLM-FATES | 0.725 | 0.525 | 0.802 | 0.707 | 0.6568 |
| 11 | ED stock | 0.681 | 0.489 | 0.439 | 0.290 | 0.4774 |

## Key lessons

Three things bit us during this work that I think generalize to any autoresearch project outside the ML-benchmark setting.

The first is that the optimizer will fit whatever you feed it, including your bugs. Our offline pipeline computed an "accumulated dryness" input through a Python function with two quiet bugs that zeroed it across most of the Sahel and savanna, where most fire actually happens. Optuna fit Model C to this broken input and scored rank 1 anyway. We caught it only when Lei plugged Model C into a coupled ED run and got values 2000x off. We fixed the input, retrained, and every parameter shifted by 5 to 10x, but Model C still won. The functional form is what generalizes across deployments. Parameters are slack the formula uses to absorb whatever input you hand it. Validate your inputs as seriously as you validate your outputs.

The second is that the benchmark is not the goal. Same incident, second lesson. Our offline pipeline applied a post-hoc rescale that the benchmark rewarded but the real coupled run could not absorb. The optimizer had learned to depend on the rescale. Removing it barely moved the offline score but the coupled-run mismatch disappeared. Every autoresearch result needs a validation channel the optimizer never sees. For us it was the coupled port into ED. For other domains it might be a deployment test, an out-of-distribution evaluation, or a downstream user who consumes your output differently than the benchmark does.

The third is that single-scalar metrics get gamed silently. ILAMB has multiple aggregation conventions for combining its component scores into one Overall number. Early on I picked the one where Model C beat CLM6.0 by 0.04. The native aggregation gave a margin of 0.005. Same components, different headline. Lei caught it by reminding me to look at the maps and the components, not just the aggregate. Track the full vector of component scores. Look at residual maps. Hold out years that the optimizer never saw.

## Setup advice

A few practical notes for anyone setting up a similar loop.

Pin down what "better" means before you start. Every autoresearch loop optimizes toward something, and if that something is vague, you will re-litigate it mid-run. We did, three times. Write down the exact metric, the exact split, the exact baseline, and what counts as a win.

Use a stack of evaluations, not a single number. One scalar rewards gaming. Multiple independent views of the same result (component breakdowns, spatial or distributional checks, held-out subsets) make it much harder for the optimizer to find a shortcut that technically improves the score without improving the thing you care about.
## Where this paradigm still falls short

Everything above describes autoresearch *given a frame*. A literature-bounded form space, a multi-channel verifier, a clear goal. All of the current systems assume the frame exists.

The hard part of science is choosing the frame. Which mechanisms even belong in the search space? Which observational target captures what you actually care about? These questions do not have automatic verifiers and the search space for them is not bounded.

The field is converging on this bottleneck. A 25,000-run study by Schmidgall and collaborators <d-cite key="schmidgall2026illusion"></d-cite> measured that the base LLM explains roughly 41 percent of the variance in research outcomes while scaffolding contributes about 1.5 percent, and refutation-driven belief revision shows up in only 26 percent of agent traces. Sakana's own paper notes that AI Scientist v2's template-free mode underperforms the template-based mode <d-cite key="yamada2026sakanav2"></d-cite>. Agents grind well within a frame and badly without one. Schwartz <d-cite key="schwartz2026vibephysics"></d-cite> put it directly: *"The bottleneck is not creativity. LLMs are profoundly creative. They simply lack a sense of which paths might be fruitful before walking them."*

I am working on this problem with [my friend](https://adithyasrini.com/). More on that when we have something to show.
