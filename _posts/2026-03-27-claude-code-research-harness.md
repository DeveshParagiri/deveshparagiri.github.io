---
layout: post
title: "Claude Code for Scientific Research: Setting Up an Autoresearch Harness"
date: 2026-03-27 12:00:00-0400
description: A comprehensive guide to installing Claude Code on macOS and Windows and configuring it as an autonomous research agent for computational science.
tags: ai, research, tools
categories: code
giscus_comments: false
published: true
pretty_table: true
toc:
  sidebar: left
related_posts: false
---

Most scientific computing still works the same way it did in 2005. You write a script. You run it. You stare at the output. You change a parameter. You run it again. If you're optimizing a model, you might wrap it in a loop, but the loop is dumb --- it searches the parameter space, not the formula space.

What if the loop could *reason*?

This post walks through how to set up **Claude Code** --- Anthropic's agentic AI coding tool --- and configure it as an **autoresearch harness** for scientific model development. The approach applies to any domain where you have parameterized models and observational benchmarks: climate models, pharmacokinetics, reactor simulations, epidemiological models, or anything else where formulas meet data.

---

### What Claude Code Actually Is

Claude Code is not a chatbot with a terminal bolted on. It's an **agent** that lives in your shell. When you launch it inside a project directory, it can:

- Read and write files on your filesystem
- Execute shell commands (Python, git, make, whatever you have)
- Search codebases with grep and glob patterns
- Launch parallel sub-agents for independent tasks
- Maintain persistent memory across sessions
- Access web documentation and APIs

It runs Claude Opus (Anthropic's most capable model) with a 1M token context window. That's enough to hold thousands of lines of source code, multiple rounds of experimental output, and a long research conversation simultaneously.

The important distinction: Claude Code doesn't just *answer questions about* your code. It *works on* your code. You tell it to optimize a module, and it reads the source, writes a test harness, runs experiments, analyzes results, and logs findings --- all within your actual filesystem.

---

### Installation: macOS

**Prerequisites:** macOS 12+ and Node.js 18+.

Check if Node is installed:

```bash
node --version
```

If not:

```bash
brew install node
```

Then install Claude Code globally:

```bash
npm install -g @anthropic-ai/claude-code
```

Verify:

```bash
claude --version
```

For scientific Python projects, I also recommend installing **uv** (a fast Python package manager that handles virtual environments and dependency resolution cleanly):

```bash
brew install uv
```

That's it. You now have the `claude` command available everywhere.

---

### Installation: Windows

Two options. For general use, native Windows works fine. For scientific computing with domain-specific libraries (NetCDF, HDF5, Cartopy, specialized solvers), **WSL2 is strongly recommended** --- these libraries install much more reliably on Linux.

#### Native Windows

Install Node.js from [nodejs.org](https://nodejs.org/) (LTS) or via winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then in PowerShell:

```powershell
npm install -g @anthropic-ai/claude-code
```

#### WSL2 (Recommended for Research)

```powershell
wsl --install
```

Restart. Then inside the Ubuntu terminal:

```bash
# Install Node via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install --lts

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Install uv for Python
curl -LsSf https://astral.sh/uv/install.sh | sh
```

WSL2 gives you a full Linux environment. File paths use forward slashes, your home is at `/home/username/`, and your entire scientific stack installs without the Windows-specific headaches.

---

### First Run

Navigate to your project and launch:

```bash
cd ~/Research/my-project
claude
```

On first launch, it opens a browser for authentication. Log in with your Anthropic account (or set `ANTHROPIC_API_KEY` in your environment if you have an API key). Once authenticated, you get a prompt:

```
~/Research/my-project (main)
>
```

Type natural language. Claude Code will ask permission before running commands or editing files.

#### Permission Modes

By default, Claude Code asks before every file edit and shell command. This is good for interactive work. For long autonomous runs (hundreds of optimization trials overnight), you can disable permission prompts:

```bash
claude --dangerously-skip-permissions
```

There's also a middle ground: configure `settings.json` to auto-allow specific tools while blocking dangerous ones:

<br>

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(uv run *)",
      "Bash(python *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)"
    ]
  }
}
```

<br>

This lets the agent read files and run Python freely, but blocks destructive operations.

---

### The Key Configuration File: CLAUDE.md

This is where the autoresearch harness lives. `CLAUDE.md` is a markdown file in your project root that tells Claude Code *how to work on your project*. Think of it as a persistent system prompt --- it's loaded at the start of every session, so the agent always knows your constraints, methodology, and project structure.

There are three levels:

<br>

| Location | Scope |
|----------|-------|
| `~/.claude/CLAUDE.md` | Global (all projects) |
| `~/.claude/projects/<hash>/CLAUDE.md` | Project-specific, private |
| `<project-root>/CLAUDE.md` | In-repo, shared via git |

<br>

For a research harness, the project-root `CLAUDE.md` is the critical one. Here's a generic template for model optimization work:

```markdown
# Model Optimization: Autoresearch Configuration

## What This Project Is
LLM-driven structural and parametric optimization of [your model].
We systematically improve each parameterized module by testing
alternative formula structures against observational benchmarks.

## Interpretability Constraints (CRITICAL)
1. Every proposed formula must map to a named physical mechanism
2. No black-box approximators (neural nets, GPs as surrogates
   for the model itself)
3. All math must be expressible in basic operations
   (exp, log, pow, trig, conditionals)
4. Must be portable back to the model's native language
5. Structural changes must have justification from the literature

## How to Run Code
Use `uv run` for all Python execution.

## Methodology Per Module
1. Read the source to extract the parameterized formula
2. Build a standalone Python replica (~1s per evaluation)
3. Evaluate baseline against observations
4. Diagnose WHERE and WHY the model fails (not just that it fails)
5. Define structural search axes (alternative formula forms)
6. Run structural search with default parameters
7. Run Bayesian optimization on the best structure
8. Validate: holdout data, spatial/temporal diagnostics
9. Generate replacement code for the original model

## Logging
Log all results to experiments/<module>/progress.md.
State the physical mechanism BEFORE testing any formula variant.
```

Without this file, every new session starts from zero. With it, the agent immediately knows the constraints, methodology, and expectations.

**This is the single most important thing you configure.** The quality of your CLAUDE.md directly determines the quality of the agent's work.

---

### The Memory System

Claude Code has persistent memory that carries across conversations. It's stored as markdown files in `~/.claude/projects/<project-hash>/memory/`.

There are four types:

<br>

| Type | What It Stores | Example |
|------|---------------|---------|
| **user** | Your expertise, preferences | "Experienced modeler, prefers terse output" |
| **feedback** | Corrections to behavior | "Don't rush phases --- 500+ trials each" |
| **project** | Ongoing work context | "Module B depends on Module A via shared param X" |
| **reference** | Where to find things | "Validation data requires registration, takes 3 days" |

<br>

You can explicitly ask Claude Code to remember things:

```
> Remember that the validation dataset requires institutional access
> Remember that Prof. X prefers results in zonal-mean format
```

Or it learns implicitly. If you correct it ("no, don't use mocked data --- test against real outputs"), it saves that as feedback and applies it in future sessions.

Each memory is a small markdown file with YAML frontmatter:

```markdown
---
name: methodology-preferences
description: Thorough work with physical grounding required
type: feedback
---

Every formula variant must have a stated mechanism BEFORE testing.
Statistical improvement without physical explanation is not acceptable.

**Why:** The key insight from early experiments was structural ---
formula structure matters more than parameter tuning. Expect the
same diagnostic depth for each module.

**How to apply:** Before any optimization, state the physical
mechanism. After optimization, do diagnostic analysis. Only then
move on.
```

The memory system means the agent gets *better* the more you work with it. By session ten, it knows your preferences, your project's quirks, and your methodology as well as a collaborator would.

---

### The Autoresearch Pattern

This is the core idea. Traditional model calibration treats the formula as fixed and searches for better parameter values. Autoresearch treats the formula *itself* as a search variable.

The search space has two dimensions:

**Structural space** --- the set of alternative formula forms for a given process. For example, a temperature response function might be:

<br>

| Structure | Formula | Origin |
|-----------|---------|--------|
| Q10 | $$r_0 \cdot Q_{10}^{(T-T_{ref})/10}$$ | van't Hoff (1898) |
| Arrhenius | $$A \cdot e^{-E_a / RT}$$ | Arrhenius (1889) |
| Lloyd-Taylor | $$r_0 \cdot e^{E_0(1/T_0 - 1/T)}$$ | Lloyd & Taylor (1994) |
| Bell curve | $$r_0 \cdot e^{-((T-T_{opt})/\sigma)^2}$$ | Ratkowsky (1983) |

<br>

Each of these encodes a different physical assumption about how the process responds to temperature. Q10 assumes exponential growth forever. Lloyd-Taylor captures enzyme denaturation near freezing. The bell curve allows a high-temperature decline. These are *structurally* different, not just parametrically different.

**Parameter space** --- the continuous parameters within each structure (the $$Q_{10}$$, $$E_a$$, $$T_{opt}$$, etc.).

The key insight: **searching the structural space is where the value is.** Parameter optimization within a wrong structure gives marginal gains. Switching to the right structure is the breakthrough.

An LLM is uniquely suited to the structural search because it can:
1. Read the existing model code and understand what each formula computes
2. Compare model output against observations and reason about *why* they disagree
3. Draw on the scientific literature to propose alternative structures
4. Explain the physical mechanism behind each proposal

No hyperparameter optimizer can do steps 1--4. That's what makes this different from AutoML.

---

### The Autoresearch Loop

Here's the loop in practice:

**1. Extract** --- The agent reads the model source code and identifies the parameterized formula for a given process module.

**2. Replicate** --- It builds a standalone Python replica of that formula. This replica takes the same inputs, produces the same outputs, and runs fast (~1 second per global evaluation). Speed matters because you'll run hundreds of trials.

**3. Benchmark** --- Evaluate the baseline formula against observational data. Compute spatial correlation, bias, RMSE, or whatever metrics matter for your domain. This is the "before" picture.

**4. Diagnose** --- This is the critical step. The agent doesn't just report "correlation is low." It asks *where* and *why*:
- Where geographically (or temporally, or across regimes) does the model fail worst?
- What's the relationship between the error and the input variables?
- Does the formula structure make physical sense given the observed patterns?
- What does the literature say about alternative approaches?

For example, if a model predicts that some process scales monotonically with a driver variable, but observations show it peaks at intermediate values, the agent identifies this as a *structural* mismatch --- no amount of parameter tuning on a monotonic function will produce a peak.

**5. Propose** --- Based on the diagnosis, the agent generates alternative formula structures. Each must have a named physical mechanism and ideally a literature reference. The alternatives are organized along **structural axes** --- independent dimensions of the formula's assumptions.

For a decomposition rate, the axes might be:
- **Axis 1:** Temperature response (Q10 vs Arrhenius vs Lloyd-Taylor vs bell curve)
- **Axis 2:** Moisture response (linear vs log-parabolic vs Michaelis-Menten)
- **Axis 3:** Substrate interaction (independent pools vs priming effects)

Each axis has 3--5 options. The full combinatorial space is small enough to enumerate (unlike a continuous parameter space), and each combination has a clear physical interpretation.

**6. Optimize** --- For each structural combination, run Bayesian parameter optimization. We use [Optuna](https://optuna.org/)'s TPE (Tree-structured Parzen Estimator), which handles mixed categorical-continuous spaces well and is practical at budgets of 300--500 trials. The objective is your benchmark metric (or a multi-metric composite).

**7. Validate** --- The winning formula is checked against:
- Holdout data or time periods not used in optimization
- Regime-level diagnostics (does it work across all conditions, or just on average?)
- Parameter interpretation (do the fitted values make physical sense?)
- Comparison with published values from independent studies

**8. Deliver** --- The agent generates replacement code in the model's native language (C++, Fortran, Julia, whatever), using the original variable names and calling conventions.

---

### Structural Search vs Parameter Search: Why It Matters

Consider a concrete example. A model uses this formula for some rate process:

$$\text{rate} = a \cdot x \cdot y$$

where $$x$$ and $$y$$ are driver variables. You optimize $$a$$ against observations and get r = 0.3. You add more parameters:

$$\text{rate} = a \cdot x^b \cdot y^c$$

Now you optimize $$(a, b, c)$$ and get r = 0.35. Progress, but limited.

The LLM reads the observations and diagnoses: "the rate peaks at intermediate $$x$$, but the formula is monotonically increasing in $$x$$ for all positive $$b$$. The literature suggests a hump-shaped response (Process X saturates at high $$x$$ due to Mechanism Y)."

It proposes:

$$\text{rate} = a \cdot x^b \cdot e^{-c \cdot x} \cdot f(y)$$

This structure *can* produce a peak. Optimization finds the best $$(a, b, c)$$ and achieves r = 0.65. The improvement came from changing the formula shape, not from adding more free parameters.

This is the autoresearch pattern: **the LLM diagnoses the structural mismatch, and the optimizer finds the parameters.** Neither alone is sufficient.

---

### Project Structure

Here's how to organize a research project for autoresearch:

```
my-project/
  data/
    observations/       # Benchmark datasets
    model-source/       # Original model code (read-only reference)
    model-output/       # Simulation results (the "before" picture)
  src/
    modules/            # Python replicas of model components
    evaluation/         # Metrics and scoring functions
    optimization/       # Bayesian optimization orchestrator
    data_loaders/       # Dataset loading utilities
  experiments/          # Per-module results, logs, Optuna DBs
  CLAUDE.md             # Agent instructions (the harness config)
  CONTEXT.md            # Full project state for session handoff
  WRITEUP.md            # Technical documentation
  pyproject.toml        # Python dependencies
```

The `experiments/` directory accumulates results over time. Each module gets a subdirectory with progress logs, optimized parameters, and diagnostic plots.

---

### Running Sessions

#### Interactive Mode

```bash
cd ~/Research/my-project
claude
```

```
> Read CONTEXT.md to get up to speed, then start working on the
> temperature response module. Read the source code, build a Python
> replica, evaluate the baseline against observations, and diagnose
> why the model fails at high latitudes.
```

The agent works through each step, reporting back at each stage. You can steer, correct, or redirect at any point.

#### Autonomous Overnight Runs

```bash
claude --dangerously-skip-permissions
```

```
> Run the complete temperature response optimization:
> 1. Test all 4 structural alternatives with default params
> 2. Test all 3 moisture coupling options
> 3. Run 500 Optuna trials on the best structural combination
> 4. Do diagnostic analysis (by regime, by input range)
> 5. Write up results with physical interpretation of all params
> Log everything to experiments/temperature/progress.md.
> I'll review in the morning.
```

The agent will run for hours, writing progress logs as it goes.

---

### Advanced Features

#### Sub-Agents for Parallel Work

Claude Code can spawn sub-agents that work independently:

```
> In parallel:
> 1. Agent 1: Literature review on Arrhenius vs Lloyd-Taylor for
>    this process class
> 2. Agent 2: Spatial analysis of the model's bias broken down
>    by regime
> 3. Agent 3: Sensitivity analysis of the current formula to
>    each parameter
```

Three agents spin up concurrently. The main agent synthesizes their results.

#### Skills and Slash Commands

Claude Code supports slash commands for common operations:

- `/commit` --- Stage and commit with a well-formatted message
- `/research <topic>` --- Structured research with source verification
- `/pdf <file>` --- Read and analyze PDF files (great for papers)

#### MCP Servers

The Model Context Protocol lets you connect Claude Code to external tools. For research, the most useful built-in MCP is **Context7**, which fetches current documentation for libraries:

```
> What's the current API for Optuna's TPESampler?
> Does xarray support weighted spatial averaging natively?
```

Instead of relying on potentially outdated training data, Context7 fetches the actual current docs.

#### IDE Integration

Claude Code also works inside VS Code and JetBrains IDEs:

- **VS Code:** Install "Claude Code" from the marketplace. Opens in the sidebar.
- **JetBrains:** Install the "Claude Code" plugin. Opens in the tool window.

The IDE gives you inline diffs and visual feedback, which is nice for code review. But for long research sessions, the CLI is more powerful.

---

### Tips From Experience

**Write a thorough CLAUDE.md.** This is the highest-leverage thing you can do. Spend an hour on it. Include your methodology, constraints, data quirks, and what "good" looks like. Every sentence saves minutes in every future session.

**Enforce interpretability constraints explicitly.** Without constraints, the LLM will optimize for the metric. It will find formulas that improve your score by doing things that make no physical sense. The constraint that every formula must "map to a named mechanism" is what produces useful science rather than curve fitting.

**Search structures before parameters.** This is the central lesson. Configure your workflow to require structural exploration before parameter optimization. The biggest improvements come from changing the formula shape, not from finding better coefficients within a fixed shape.

**Maintain a CONTEXT.md.** For complex projects, keep a single file that describes the full project state: what's been done, what's next, what data is available, and what the known problems are. Start each session by pointing the agent to it.

**Use memory for corrections.** When the agent does something wrong, correct it. It saves the correction as persistent feedback and applies it in future sessions. After a few sessions, it knows your preferences as well as a colleague.

**Log everything.** Tell the agent to write progress logs as it works. You want provenance: what was tried, what worked, what failed, and why. This is your lab notebook.

**Use git.** Have the agent commit after each completed phase. This gives you rollback points and a clean audit trail.

**Be specific about "done."** Instead of "optimize the model," say "run 300 trials on the Lloyd-Taylor structure, evaluate against [dataset], report the top 5 results with their parameter values and physical interpretation, and log to experiments/module/progress.md."

---

### Common Gotchas

**Shell state doesn't persist.** Each Bash command runs in a fresh shell. Environment variables and `cd` don't carry over between commands. Use absolute paths or chain commands with `&&`.

**Large data files.** Don't ask the agent to "read" a multi-GB binary file. Ask it to write a Python script that loads and analyzes the data. The agent reads code and text output, not raw binary.

**Coordinate conventions.** If you work with gridded data, document your coordinate conventions in CLAUDE.md. Different datasets use different orientations, units, and reference frames. Silent mismatches produce silently wrong results.

**Permission fatigue.** In default mode, the agent asks permission for every action. This is correct for exploratory work but painful for optimization runs. Use the permission configuration to auto-allow safe operations.

**Overfitting to the benchmark.** The agent will try to maximize whatever metric you give it. Use held-out validation, regime-level diagnostics, and parameter sanity checks. If the optimized $$Q_{10}$$ is 47.3, something went wrong --- document reasonable parameter bounds in your CLAUDE.md.

---

### Closing Thoughts

The autoresearch pattern --- LLM reads model code, diagnoses structural failures against observations, proposes mechanism-grounded alternatives, optimizes parameters, validates --- applies anywhere you have:

1. A parameterized model with known formula structure
2. Observational or experimental benchmarks to evaluate against
3. A requirement that improvements remain interpretable

The LLM's value is not in finding better parameters. It's in *diagnosing structural problems* --- mismatches between the equation's assumptions and what the data actually shows. These are the problems that persist for years because the formulas were inherited from foundational papers and never questioned.

Claude Code provides the infrastructure to make this practical: persistent context via CLAUDE.md, filesystem access, code execution, and the ability to run for hours without supervision. The memory system makes the agent cumulative --- it learns your methodology and preferences over time.

Set it up. Write a good CLAUDE.md. Enforce your constraints. Let it research.
