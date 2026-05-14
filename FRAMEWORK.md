# holography — Neural Agent Infrastructure Framework

**Version:** 1.0.0  
**Origin:** Extracted from reel-engine (automated short-form video pipeline)  
**Proven on:** Python media pipeline + HTML/JS + FileMaker hybrid project  
**Install:** `npx holography init`

---

## What This Is

A portable infrastructure layer that makes Claude Code immediately:
- **Context-aware** — knows the codebase before the first prompt
- **Memory-persistent** — what was learned in session 1 is present in session 100
- **Risk-topology-conscious** — knows which nodes are god nodes before any edit
- **Routing-disciplined** — every prompt hits a dispatcher before any agent acts

This is not documentation. It is infrastructure. The difference: infrastructure runs.

---

## Phase 1 — Archaeological Dig: Component Analysis

### CLAUDE.md
**Problem solved:** Claude Code has no project context on session start. Every session begins cold.  
**Reasoning pattern:** Mandatory read sequence — memory first, routing second, action third.  
**Breaks if missing:** Claude operates on assumptions. Context collapses after 3 turns. God nodes are touched silently.  
**How it knows:** `@AGENTS.md` is an include directive — AGENTS.md is injected automatically. All other files are read per behavioral instruction.  
**Key mechanism:** The REQUIRED gate: `REQUIRED: Read agents/dispatcher.prompt and emit a ROUTE block before executing any task.`

### AGENTS.md
**Problem solved:** Claude needs a lightweight routing table always in context — not a 400-line dispatcher read per message.  
**Reasoning pattern:** Summary-first architecture. AGENTS.md = the index. dispatcher.prompt = the engine. AGENTS.md is always loaded; dispatcher is read on demand.  
**Breaks if missing:** Routing degrades to Claude's best guess. God nodes are unknown. Cross-agent conflicts surface silently.  
**How it knows:** Always injected via `@AGENTS.md` in CLAUDE.md. Updated by @memory-keeper after every commit.

### agents/dispatcher.prompt
**Problem solved:** Ambiguous tasks get routed to the wrong agent, causing ownership violations and silent cross-contamination.  
**Reasoning pattern:** Parse → identify files → map to agent → check god nodes → check cross-agent → emit ROUTE block. No execution. No code. Only routing.  
**Breaks if missing:** God nodes are touched without audit. Cross-agent conflicts aren't flagged. Validator rules aren't pre-identified.  
**Key mechanism:** The ROUTE block is a contract. Every agent downstream reads it and knows its scope.

### agents/validator.prompt + tools/validator.py
**Problem solved:** Agents produce plausible-but-wrong output. Without a gate, bad diffs hit disk.  
**Reasoning pattern:** Project-specific safety rules encoded as static diff analysis. Runs on every diff before disk write. Output is PASS/FAIL/RETRY_WITH/FIX_HINT — no prose.  
**Breaks if missing:** Rule violations accumulate silently. The deployment equivalent of merge-without-review.  
**Key mechanism:** The retry ladder — failure maps to a model suggestion, not just a stop. `RETRY_WITH: claude-sonnet-4-6` keeps the loop alive cheaply.

### agents/meta-controller.prompt + tools/meta_controller.py + bin/meta-controller
**Problem solved:** Single-shot agent calls fail on complex tasks. There's no recovery loop without human intervention.  
**Reasoning pattern:** Outcome-aware retry. Meta-controller doesn't know the task — it knows the failure category and what patch reduces that failure category. Patches are cumulative across attempts.  
**Breaks if missing:** Every validator FAIL requires human debugging. Compound failures (ffmpeg config drift, cross-agent conflicts) never auto-resolve.  
**Architecture:**
```
task → agent → validator → PASS (done)
                         → FAIL → meta-controller → patch → agent (attempt 2)
                                                  → FAIL → patch+patch → agent (attempt 3)
                                                  → FAIL → ESCALATE → logs/ → human
```

### memory/MEMORY.md
**Problem solved:** Session continuity. What was discovered, fixed, and decided in past sessions is invisible to new sessions.  
**Reasoning pattern:** Living document. Updated after every commit by @memory-keeper. Contains: architecture, cascade systems, known issues, recent fixes (2-week window), pending work.  
**Breaks if missing:** Each session re-derives everything. Repeated mistakes. No accumulated project intelligence.  
**What it enables:** Without MEMORY.md, the project's pipeline architecture would need to be re-explained every session. God node edge counts would be unknown. Parity rules would be forgotten and parallel interfaces would diverge within 3 sessions.

### memory/MEMORY_MAP.md
**Problem solved:** "Where is X defined?" costs 3-5 tool calls to answer. MEMORY_MAP eliminates the search.  
**Reasoning pattern:** File → function → god node status → owner. Read-only for most agents. Written by @memory-keeper. Updated when new functions are added.  
**Breaks if missing:** Agents read entire files to find one function. Context window fills with irrelevant code. God nodes are discovered by accident, after the damage.  
**What it enables:** Critical call chains (e.g. `validate() → process() → deliver()`) are extracted as hyperedges by graphify and documented in MEMORY_MAP before any agent touches them. Without this, a change to an upstream function would not flag its downstream dependents as risk.

### agents/memory-keeper.prompt
**Problem solved:** Memory becomes stale. New files are created, functions are renamed, god nodes gain/lose edges — and the memory files don't update.  
**Reasoning pattern:** Post-commit observer. Never writes production code. Reads git diff, reads graph report, updates only the 4 memory files. Runs after every commit via post-commit hook.  
**Breaks if missing:** Memory drifts within 2 weeks. MEMORY_MAP becomes a liability (wrong ownership, wrong edge counts). New team members (and new Claude sessions) operate on outdated topology.

### God Node Identification
**Problem solved:** Not all nodes are equal. A change to `fmt()` (8 edges, cross-community bridge) has 4× the blast radius of a change to `openLightbox()` (1 edge).  
**Reasoning pattern:**
1. Run graphify → get edge counts and betweenness centrality
2. Nodes with ≥6 edges or betweenness ≥0.01 → candidate god nodes
3. Cross-community bridges (high betweenness) → mandatory audit gate
4. Document in AGENTS.md with owner and note; add audit check in dispatcher.prompt
**Why this matters:** God nodes identified by graphify are routinely non-obvious. A utility function can look trivial yet be called by 4 communities through an intermediate file — making it a cross-community bridge. Without the graph, a "simple formatter change" silently breaks multiple subsystems simultaneously.

---

## Phase 2 — Reasoning Chain Reconstruction

### How a Holography Deployment Works

**Session 1: Audit**
- `npx holography init` runs stack-detector → identifies project type and entry points
- graphify maps the existing codebase → GRAPH_REPORT.md reveals node count, edge count, communities
- God nodes identified by edge count (≥6) and betweenness centrality (≥0.01)
- Architecture extracted into MEMORY.md, file/function ownership into MEMORY_MAP.md

**Session 2: Agent scaffold**
- AGENTS.md routing table built from the file inventory — not guessed
- Agent prompts written with ownership blocks derived from the file→function map in MEMORY_MAP.md
- Validator rules derived from risk topology: what are the N ways this project can fail silently?
  - Generated files that must not be hand-edited → Rule 1
  - Irreversible operations (deploy, destructive writes) without a dry-run gate → Rule 2
  - Silent data corruption paths (wrong paths, missing schema checks) → Rule 3
  - Parallel interface drift (mobile/desktop, API/UI parity) → Rule 4
- Rules come from the KNOWN ISSUES section of MEMORY.md and the god node audit

**Session 3: Graph-informed refinement**
- After agent system installed, graphify rebuilds (code-only scan, faster)
- New god nodes may surface that weren't visible before the install scan
- Critical call chains extracted as hyperedges and added to MEMORY_MAP.md
- Cross-community bridges identified (high betweenness) → audit gates added to dispatcher.prompt
- All agent prompts updated with the refined topology

**What MEMORY.md prevents:**
- Without the "known issues" section, silent failure modes are not encoded as validator rules
- The "fragile" section flags drift risks BEFORE any session adds features — they become rules

**What MEMORY_MAP.md prevents:**
- Co-equal god nodes (e.g. two functions with the same edge count) are both audited — not just the obvious one
- Critical call chains are visible before any agent touches an upstream node
- The "one agent writes both sides" anti-pattern is caught at dispatch time, not after the damage

**Where meta-controller proves critical:**
The patch strategy tables encode failure-mode knowledge that would otherwise require a human each time. By pre-encoding strategies per failure category:
- deploy failures → dry-run gate on retry
- parity failures → deliver all affected views in one diff
- cross-agent conflicts → secondary agent read-only on retry

...the retry loop resolves common failure modes automatically, without human review.

---

## Phase 3 — The Design Philosophy

### Core Invariants

**1. Read before act.**  
CLAUDE.md enforces: memory first, routing second, action third. No agent acts on the first message.

**2. Ownership is strict.**  
Every agent has a closed file list. Cross-agent overlap is a routing decision, not an agent decision. The dispatcher owns the overlap decision.

**3. The validator is the last line.**  
No diff hits disk without a validator pass. The validator is project-specific — it encodes what "wrong" looks like for THIS project.

**4. Memory is infrastructure.**  
MEMORY.md and MEMORY_MAP.md are not documentation. They are runtime context that Claude loads before every session. They degrade if not maintained. The post-commit hook is what keeps them alive.

**5. God nodes are topology, not opinion.**  
God nodes are identified by graphify's edge count and betweenness centrality — not by developer intuition. The graph is the source of truth. The audit gate protects them.

**6. Failure is a protocol, not an event.**  
When the validator fails, the meta-controller fires. When the meta-controller exhausts retries, a structured report is written to logs/. No failure is silent. No failure requires immediate human intervention unless it escalates to `human` in the retry ladder.

### The Two-Layer Routing Architecture

```
AGENTS.md (always in context)          ← lightweight: file → agent table
    ↓ on complex/cross-agent task
agents/dispatcher.prompt (read on demand) ← full engine: god nodes, validator rules, ROUTE block
```

This prevents context bloat. Simple tasks route from AGENTS.md. Complex tasks read the dispatcher. The dispatcher never acts.

---

## Phase 4 — Bootstrap Agent Design

### framework-auditor
Runs on install. Reads the target project. Maps all files, functions, and god nodes.
Produces: populated MEMORY_MAP.md draft.

### memory-bootstrapper
Runs after framework-auditor. Asks targeted questions to fill MEMORY.md gaps.
Produces: populated MEMORY.md with architecture, known issues, stack, owner.

### stack-detector
Detects tech stack from file extensions, package.json, folder structure.
Selects appropriate agent templates. Configures AGENTS.md routing table.
Produces: configured AGENTS.md + CLAUDE.md.

### god-node-hunter
Reads the graphify-out/GRAPH_REPORT.md (or runs graphify if not present).
Computes betweenness centrality from edge counts. Flags god nodes.
Produces: god node table for AGENTS.md + audit gates in dispatcher.prompt.

---

## Install Flow

```bash
npx holography init
```

1. `stack-detector` → identifies project type
2. Scaffold: creates agents/, memory/, bin/, logs/, docs/setup/
3. `framework-auditor` → maps all files and functions
4. `god-node-hunter` → identifies god nodes from graphify
5. `memory-bootstrapper` → interactive Q&A to populate MEMORY.md
6. Writes configured CLAUDE.md + AGENTS.md
7. Installs post-commit hook
8. Prints: `holography installed. Run: python3 -m pytest tests/smoke_test.py -v`

---

## File Inventory

```
tools/agent-framework/
├── FRAMEWORK.md              ← this file
├── install.js               ← npm-compatible scaffold script
├── templates/
│   ├── CLAUDE.md             ← session start protocol (parameterized)
│   ├── AGENTS.md             ← routing table (parameterized)
│   ├── MEMORY.md             ← project status template
│   ├── MEMORY_MAP.md         ← ownership table template
│   └── agents/
│       ├── dispatcher.prompt
│       ├── validator.prompt
│       ├── meta-controller.prompt
│       ├── memory-keeper.prompt
│       ├── framework-auditor.prompt  ← bootstrap: maps new project
│       ├── memory-bootstrapper.prompt ← bootstrap: fills MEMORY.md
│       ├── stack-detector.prompt      ← bootstrap: detects tech stack
│       ├── god-node-hunter.prompt     ← bootstrap: flags god nodes
│       └── domain-agent.prompt.example ← template for custom agents
├── tools/
│   ├── validator.py          ← generic 4-rule diff validator
│   ├── meta_controller.py    ← retry loop logic (FailBlock, MetaController)
│   └── bootstrap.sh          ← shell installer (no npm required)
└── npm/
    ├── package.json
    ├── README.md
    └── cli.js                ← npx holography entry point
```
