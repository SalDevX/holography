# holography

[![npm version](https://img.shields.io/npm/v/holography.svg)](https://www.npmjs.com/package/holography)
[![license](https://img.shields.io/npm/l/holography.svg)](LICENSE)
[![built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-8A2BE2)](https://claude.ai/code)

> *"Holography is Ariadne's thread — through your codebase, session after session, so nothing is ever lost in the maze."*

A CLI that installs a production-grade Claude Code agent framework into any project.
One command. The framework knows your codebase before the first prompt.

```bash
npx holography init
```

---

## Table of Contents

- [The problem](#the-problem)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [The one manual step](#the-one-manual-step)
- [Claude Code slash commands](#claude-code-slash-commands)
- [What you get](#what-you-get)
- [Real-world example](#real-world-example-marta-test)
- [Terminal output](#terminal-output)
- [Extending the system](#extending-the-system)
- [npx holography clean](#npx-holography-clean)
- [CLI reference](#cli-reference)
- [Philosophy](#philosophy)

---

## The problem

Claude Code is stateless between sessions. You close the window, context is gone. Three sessions of
architecture mapping, god node identification, and ownership rules — gone. Next session starts cold
and re-derives everything.

Holography installs the infrastructure that holds state across sessions: `MEMORY.md` loaded before
every task, `MEMORY_MAP.md` telling Claude which functions belong to which domain, a dispatcher that
routes every task to the right agent, a validator that gates every diff before it hits disk, and a
post-commit hook that keeps memory current automatically.

This is not documentation that eventually drifts. It is infrastructure that runs.

---

## Prerequisites

Install these before running `npx holography init`:

**1. Node.js ≥ 16**
```bash
node --version   # must be ≥ 16
```

**2. git**
```bash
git --version
```
The post-commit hook requires a `.git` directory. If none exists, holography runs `git init` automatically.

**3. Python ≥ 3.9 + venv**

The validator, meta-controller, and bin/meta-controller are all Python. `set[str]` type hints in
`tools/validator.py` require Python 3.9+.

```bash
python3 --version   # must be ≥ 3.9
```

For Python or polyglot projects, holography warns if no `.venv` is found:

```
⚠️  No Python venv found.
   Create one before running agents:
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
```

**4. graphify** *(required for the dynamic system)*

graphify runs AST analysis on your code and produces `graphify-out/graph.json` — the source of truth
for god nodes, community structure, file/function maps, and routing tables. Without it, holography
installs in static fallback mode: templates write with placeholder data, god nodes are empty, routing
tables have no community context.

```bash
uv tool install graphifyy   # note: package name is graphifyy (double-y)
graphify --version
```

Alternative (pip):
```bash
pip install graphifyy
```

**5. Claude Code CLI**

Required for the post-commit hook (`claude --dangerously-skip-permissions`). The hook checks if
`claude` is in PATH and skips gracefully if not — but you want it there.

```bash
claude --version
```
Install: [claude.ai/code](https://claude.ai/code)

---

## Install

```bash
cd your-project
npx holography init
```

### What happens automatically (5 steps, ~30 seconds)

**[1/5] git** — Finds `.git` or runs `git init` + an empty initial commit.

**[2/5] graphify** — Runs `graphify update .` on your codebase. Parses `graphify-out/graph.json`
to extract:
- God nodes (functions with ≥6 edges or betweenness ≥0.01)
- Community structure (Louvain clustering of your call graph)
- File → function map (every source file and its top-level symbols)

This data drives everything downstream. If graphify is not found, a WARN is printed and install
continues with static fallback — templates write with `{{GOD_NODES_TABLE}}` and routing
placeholders instead of real data.

**[3/5] stack-detector** — Reads file extensions, `package.json`, `requirements.txt`,
`pyproject.toml`, `go.mod`, `Cargo.toml`. Detects language, frameworks, entry points, test command.
No prompting.

**[4/5] scaffold** — Creates `agents/`, `memory/`, `bin/`, `logs/`, `tools/`, `docs/setup/`.
Runs `bootstrap.sh` to install `bin/meta-controller` and `.git/hooks/post-commit`. Writes all
framework files from bundled templates with real graph data injected.

**Existing files are not overwritten.** Re-running holography after customizing your agents is safe.

**[5] `.claude/settings.json`** — Writes PreToolUse/PostToolUse hooks that inject god node context
into Claude's context on every file read/write. Hooks fire on `Glob`, `Grep`, `Edit`, `Write`,
`Create`, `MultiEdit`.

---

## The one manual step

```
Open Claude Code in this project.
Type: /memory-bootstrapper
```

~5 questions, ~2 minutes. The memory-bootstrapper asks what it cannot determine from code:
project purpose, owner, current status, primary failure points, deploy pipeline. Every other section
of `MEMORY.md` was already filled from the graph.

After that:

```bash
git add agents/ memory/ CLAUDE.md AGENTS.md bin/ tools/ .claude/
git commit -m 'feat: install holography framework'
```

The post-commit hook fires. `@memory-keeper` runs. Memory updates from your first real commit.

---

## Claude Code slash commands

After `npx holography init`, these commands are available directly in Claude Code:

```
/memory-bootstrapper     ← required step 1 after init
/domain-agent-builder    ← required step 2 after memory-bootstrapper
/god-node-hunter         ← re-run any time after big refactors
/framework-auditor       ← re-map files/functions on demand
/memory-keeper           ← manual memory sync without a commit
```

They live in `.claude/commands/` as plain markdown files — Claude Code picks them up automatically.
Use them any time, not just during the initial setup. Run `/god-node-hunter` after a major refactor
to refresh the god node table. Run `/framework-auditor` when you add a new domain. Run
`/memory-keeper` when you need MEMORY.md updated without waiting for a commit.

### /domain-agent-builder

Run after `/memory-bootstrapper`. Reads graph communities,
proposes domain agent groupings, waits for confirmation,
then creates named agents with real file ownership and
updates AGENTS.md routing table and dispatcher.prompt.
This is the step that gives Claude Code real project structure —
who owns what, what god nodes to protect, what tasks belong where.

---

## What you get

```
your-project/
├── CLAUDE.md                        ← session start protocol — Claude reads this first, every session
├── AGENTS.md                        ← routing table + god nodes — always in Claude's context via @include
├── agents/
│   ├── dispatcher.prompt            ← task router — every task hits this before any agent acts
│   ├── validator.prompt             ← diff validation gate
│   ├── meta-controller.prompt       ← retry strategist (3 attempts, escalate to human)
│   ├── memory-keeper.prompt         ← post-commit memory updater
│   ├── framework-auditor.prompt     ← bootstrap: maps codebase on first install
│   ├── memory-bootstrapper.prompt   ← bootstrap: fills MEMORY.md interactively
│   ├── stack-detector.prompt        ← bootstrap: reconfigures routing for stack changes
│   ├── god-node-hunter.prompt       ← bootstrap: re-identifies god nodes from graph
│   └── domain-agent.prompt.example  ← template for your own domain agents
├── memory/
│   ├── MEMORY.md                    ← project status, architecture, recent fixes (2-week window)
│   └── MEMORY_MAP.md                ← file/function/god-node ownership table
├── bin/
│   └── meta-controller              ← retry loop CLI (Python 3, calls claude -p)
├── tools/
│   ├── validator.py                 ← static diff validator (4 universal rules + pluggable)
│   └── meta_controller.py           ← retry loop library (FailBlock, MetaController, RetryPlan)
├── .claude/
│   ├── settings.json                ← Claude Code hooks (PreToolUse/PostToolUse)
│   └── commands/
│       ├── memory-bootstrapper.md   ← /memory-bootstrapper slash command
│       ├── god-node-hunter.md       ← /god-node-hunter slash command
│       ├── framework-auditor.md     ← /framework-auditor slash command
│       └── memory-keeper.md         ← /memory-keeper slash command
├── .git/hooks/
│   └── post-commit                  ← calls claude as @memory-keeper after every commit
├── logs/                            ← meta-controller failure reports (timestamped .md files)
└── docs/setup/                      ← memory-keeper hook documentation
```

### How Claude Code uses this each session

`CLAUDE.md` enforces a mandatory read sequence before any action:

```
1. memory/MEMORY.md          ← project status, architecture, what broke last week
2. memory/MEMORY_MAP.md      ← file/function ownership, god node locations
3. agents/dispatcher.prompt  ← emit a ROUTE block — no action without one
4. agents/<routed>.prompt    ← only the agent(s) named in the ROUTE block
```

`AGENTS.md` is always injected via `@AGENTS.md` in CLAUDE.md — it's the lightweight routing index
that fits in context without reading the full dispatcher.

### How every diff is validated

```
task → agent → diff
                ↓
         tools/validator.py
                ↓
          PASS → applied
          FAIL → meta-controller
                      ↓
               attempt 2: apply category patch, retry
               attempt 3: cumulative patches, retry
               3× FAIL: write report → logs/ → stop, human required
```

Failure categories and their automatic patches:
- `data_integrity` → escalate to human (generated file edited directly)
- `deploy` → add dry-run step before live execution
- `parity` → deliver all affected views in one diff
- `cross_agent` → demote secondary agent to read-only

### How memory stays current

The post-commit hook — installed in `.git/hooks/post-commit` by `bootstrap.sh` — runs:

```bash
claude --dangerously-skip-permissions \
    "You are @memory-keeper. Read agents/memory-keeper.prompt.
     Run: git diff HEAD~1 HEAD --name-only && git log -1 --format='%s %b'
     Read graphify-out/GRAPH_REPORT.md if it exists.
     Update memory/MEMORY.md Recent Fixes. Update memory/MEMORY_MAP.md if new functions added.
     Update relevant agents/*.prompt if new files added. Run graphify update . last.
     Be specific. No prose." 2>&1 | tee -a logs/memory-keeper.log
```

The hook silently skips if `claude` is not in PATH.

---

## Real-world example: marta-test

A polyglot project (Python + React): e-commerce catalog with desktop, mobile, and FileMaker bridge.
holography installed in ~30 seconds. graphify found 141 nodes, 238 edges, 9 communities.

### AGENTS.md — routing table (auto-generated)

```markdown
## Routing — which file to read

| Task | Read this file |
|------|----------------|
| ALL tasks — entry point (read first) | `agents/dispatcher.prompt` |
| Edit `desktop/` (2 files) | `agents/domain-agent.prompt.example` |
| Edit `js/` (6 files) | `agents/domain-agent.prompt.example` |
| Edit `mobile/` (2 files) | `agents/domain-agent.prompt.example` |
| Edit `shared/` (1 file) | `agents/domain-agent.prompt.example` |
| Edit `tools/` (2 files) | `agents/domain-agent.prompt.example` |
| Doc sync after commit / MEMORY.md / MEMORY_MAP.md | `agents/memory-keeper.prompt` |
| Validate any output before applying to disk | `agents/validator.prompt` |
| FAIL escalation from any agent — retry loop | `agents/meta-controller.prompt` |

## Global invariants — apply to every task, every agent

**Hard rules — never break:**
- Never modify god nodes without declaring in task description:
  `fmt()` (js/form.js, 12 edges), `_run_validator()` (tests/smoke_test.py, 11 edges),
  `parse_csv_multi_row()` (tools/fm_bridge.py, 10 edges)
- Run `graphify update .` after every code change (zero API cost — AST only)
- All tests must pass before merging: `python3 -m pytest tests/ -v`
- No bare `except:` — always catch specific exception types

## God Nodes — never touch without full cross-agent audit

Graph source: `graphify-out/GRAPH_REPORT.md` · 114 nodes · 199 edges · last run 2026-05-14

| Node | Edges | File | Owner | Notes |
|------|-------|------|-------|-------|
| `fmt()` | 12 | `js/form.js` | — | |
| `_run_validator()` | 11 | `tests/smoke_test.py` | — | |
| `parse_csv_multi_row()` | 10 | `tools/fm_bridge.py` | — | |
| `_make_diff()` | 10 | `tests/smoke_test.py` | — | |
| `parse_csv_single_row()` | 8 | `tools/fm_bridge.py` | — | |
```

### MEMORY_MAP.md — community sections (auto-generated)

```markdown
## Community 3 — desktop/

| File | Key functions | God node? | Notes |
|------|---------------|-----------|-------|
| `desktop/app.jsx` | `Header()`, `FilterBar()`, `ProductCard()`, `ProductGrid()`, `DetailPanel()`, `BottomBar()` | — | |
| `js/form.js` | `fmt()`, `handleQty()`, `hasOverStock()`, `recalc()`, `getOrderedItems()`, `validate()` | YES | |
| `shared/utils.js` | `cleanCatLabel()`, `toggleSet()`, `removeFromSet()`, `deriveShells()`, `deriveStones()` | — | |

## Community 5 — mobile/

| File | Key functions | God node? | Notes |
|------|---------------|-----------|-------|
| `mobile/app.jsx` | `IconGrid()`, `IconBag()`, `FilterSheet()`, `BottomSheet()`, `CatalogView()` | — | |

## Community 6 — shared/

| File | Key functions | God node? | Notes |
|------|---------------|-----------|-------|
| `shared/utils.js` | `cleanCatLabel()`, `toggleSet()`, `removeFromSet()`, `deriveShells()` | — | |
```

### .claude/settings.json — god-node-aware hooks (auto-generated)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Glob",
        "hooks": [{
          "type": "command",
          "command": "[ -f graphify-out/graph.json ] && echo '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"graphify graph loaded. God nodes: fmt(), _run_validator(), parse_csv_multi_row(), _make_diff(), parse_csv_single_row(). Read GRAPH_REPORT.md only when tracing unknown cross-file dependencies.\"}}' || true"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [{
          "type": "command",
          "command": "echo '{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"Code modified. After this task: run graphify update ., update memory/MEMORY.md Recent Fixes, update MEMORY_MAP.md if new functions added.\"}}'"
        }]
      }
    ]
  }
}
```

Every time Claude reads or writes a file, it sees the god node list in its context — before writing a
single line.

---

## Terminal output

What a successful install looks like on a polyglot project:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography v1.0.11
  Installing into: /home/you/marta-test
  Project name:    marta-test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] git — checking repository...
      .git found — OK

[2/5] graphify — building code graph...
      graphify update . — done
      141 nodes · 238 edges · 9 communities
      God nodes: fmt(), _run_validator(), parse_csv_multi_row(), _make_diff(), parse_csv_single_row()
      17 source files across 9 communities

[3/5] stack-detector — detecting tech stack...
      language: python · frameworks: react, babel
      type: polyglot · entry points: js/form.js, mobile/app.jsx

  ⚠️  No Python venv found.
     Create one before running agents:
     python3 -m venv .venv && source .venv/bin/activate
     pip install -r requirements.txt

[4/5] scaffold — writing project-aware framework...
      bin/meta-controller
      .git/hooks/post-commit — installed
      Wrote 15/15 framework files
      .claude/settings.json — god nodes: fmt(), _run_validator(), parse_csv_multi_row(), _make_diff(), parse_csv_single_row()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography v1.0.11 installed in: /home/you/marta-test

  ✅ stack-detector    — done (graph-driven)
  ✅ framework-auditor — done (graph-driven)
  ✅ god-node-hunter   — done (graph-driven)
  ⏳ memory-bootstrapper — one manual step remaining

  Open Claude Code in this project and run:
    "Run the memory-bootstrapper agent"
  (~2 min · 5 questions · fills MEMORY.md with human context)

  Then commit:
    git add agents/ memory/ CLAUDE.md AGENTS.md bin/ tools/ .claude/
    git commit -m 'feat: install holography framework'

  Docs: https://github.com/SalDevX/holography
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Static fallback (graphify not found):

```
[2/5] graphify — building code graph...
      WARN: graphify not found — install: uv tool install graphifyy
      Agents will use static fallback — no dynamic god-node injection.
      graphify-out/graph.json not found — using static fallback
```

Install continues. Templates are written with placeholder `{{GOD_NODES_TABLE}}` markers that the
`/god-node-hunter` agent can fill later from inside Claude Code.

---

## Extending the system

### Adding domain agents

```bash
cp agents/domain-agent.prompt.example agents/your-feature.prompt
```

Edit the copy. Fill in:
- `## AGENT OWNERSHIP` — exact files this agent controls
- `## GOD NODES IN YOUR DOMAIN` — from the god nodes table in AGENTS.md
- `## KEY RULES` — the 3–5 invariants most likely to be violated in this domain
- `## COMMON TASKS` — the 5–8 most frequent tasks

Add a routing row to AGENTS.md:
```markdown
| Edit `your-feature/` (N files) | `agents/your-feature.prompt` |
```

### Pluggable validator rules

Create `tools/validator_rules.py` — auto-loaded if present, overrides the 4 universal rules.
Helpers `files_in_diff`, `added_lines`, `removed_lines`, and `PROJECT_ROOT` are injected:

```python
# tools/validator_rules.py

def rule_no_direct_data_edit(diff):
    """Auto-generated files must not be edited directly."""
    for line in added_lines(diff):
        if "DO NOT EDIT" in line:
            return False, "Rule 1: edited auto-generated file directly"
    return True, ""

def rule_deploy_dry_run_gate(diff):
    """Deploy scripts require a dry-run step."""
    for f in files_in_diff(diff):
        if "deploy" in f or "sync" in f:
            if not any("dry-run" in l or "dry_run" in l for l in added_lines(diff)):
                return False, "Rule 2: deploy change without dry-run gate"
    return True, ""

RULES = [rule_no_direct_data_edit, rule_deploy_dry_run_gate]

RETRY_WITH = {
    "Rule 1": "human",
    "Rule 2": "claude-sonnet-4-6",
}
```

Run standalone:
```bash
git diff | python3 tools/validator.py
```

### Running the retry loop directly

```bash
bin/meta-controller --task "refactor validate() to handle multi-row CSV"
bin/meta-controller --task "add dark mode to ProductGrid()" --dry-run   # preview patches only
echo "fix sftp timeout" | bin/meta-controller
```

---

## npx holography clean

Removes everything holography installed. Prompts for confirmation. Leaves your source code untouched.

```bash
npx holography clean
# or
npx holography uninstall
```

**Removes:**
`agents/` `memory/` `bin/` `logs/` `docs/setup/` `graphify-out/`
`.claude/settings.json` `.claude/commands/`
`CLAUDE.md` `AGENTS.md` `tools/validator.py` `tools/meta_controller.py`

`.claude/` itself is removed only if it's empty after the above — preserving any other Claude Code
settings you had before installing holography.

**Does not touch:**
Your source code, `tests/`, the `tools/` directory itself (only the two holography-generated `.py`
files inside it).

---

## CLI reference

```
npx holography init                   Full install (5 steps)
npx holography init --dry-run         Preview — no files written, no graphify run
npx holography update                 Safe upgrade — updates infrastructure, never
                                      touches your agents or memory
npx holography update --dry-run       Preview what would change
npx holography upgrade                Alias for update
npx holography clean                  Remove holography from this project
npx holography uninstall              Alias for clean
npx holography --help
npx holography --version
```

```bash
# Zero-API commit wrapper (validate → stage → commit → graphify)
bin/commit -m "your message"
bin/commit -m "message" tools/file.py js/file.js   # specific files
bin/commit --all -m "message"                       # stage all including untracked
bin/commit --skip-validate -m "message"             # bypass validator gate

# Retry loop
bin/meta-controller --task "your task description"
bin/meta-controller --task "task" --dry-run      # print retry plans, no claude calls
echo "task description" | bin/meta-controller    # stdin

# Validator
git diff | python3 tools/validator.py
cat some.diff | python3 tools/validator.py
python3 tools/validator.py --help
```

---

## Philosophy

The whole system is built on one uncomfortable fact: **Claude Code is stateless**. Every session
starts with zero context. If that doesn't bother you yet, it will — usually around session 4 when
Claude silently touches a function that 8 other files depend on, and you spend an hour untangling it.

Holography's answer is to treat memory and topology as infrastructure, not documentation.
`MEMORY.md` and `MEMORY_MAP.md` aren't written for humans — they're loaded by Claude before every
session, formatted for machine consumption, maintained by a post-commit hook. If they're vague,
Claude is vague. If they drift, Claude operates on stale topology.

**The god node concept** is the most non-obvious piece. Not all functions are equally dangerous to
change. graphify runs AST analysis and produces edge counts and betweenness centrality scores.
`fmt()` in marta-test looks like a trivial formatter — but it has 12 edges, a betweenness score of
0.061, and connects communities 5, 6, 7, and 8. It's a cross-community bridge. A "simple formatting
fix" to it cascades across mobile, desktop, email, and summary views simultaneously. Without the
graph, you'd never know. Holography injects these nodes into Claude's context *before* it writes a
single line, on every file access.

**The validator → meta-controller loop** closes the last gap. Without a gate, wrong diffs hit disk.
With a gate and no retry logic, every FAIL requires you. The meta-controller pre-encodes what to do
for each failure category — deploy failures get a dry-run step added on retry, parity failures get
both views delivered together, cross-agent conflicts get the secondary agent demoted to read-only.
Common failure modes resolve automatically; rare ones escalate with a structured report.

**Six invariants the system is built on:**

1. **Read before act** — memory first, routing second, action third. No agent acts on the first message.
2. **Ownership is strict** — each agent has a closed file list. Cross-agent overlap is a routing
   decision made by the dispatcher, not an agent decision made by whoever got there first.
3. **The validator is the last line** — no diff hits disk without a PASS.
4. **Memory is infrastructure** — MEMORY.md and MEMORY_MAP.md degrade without maintenance.
   The post-commit hook is what keeps them alive, not discipline.
5. **God nodes are topology, not opinion** — edge counts and betweenness from the graph, not
   developer intuition or file size.
6. **Failure is a protocol, not an event** — structured retry loop, structured escalation report,
   nothing silent, nothing requiring immediate human intervention unless it exhausts the ladder.

---

## License

MIT

---

Built by SalDevX · Bali 🌊
