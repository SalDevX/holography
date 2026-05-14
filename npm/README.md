# holography


"A thread through your codebase, session after session, so nothing is ever lost in the maze."

Agent framework for Claude Code. Wires dispatcher, validator, meta-controller, and memory into any project in one command.

```bash
npx holography init
```

---

## What it installs

```
your-project/
├── CLAUDE.md                    ← session-start protocol (Claude Code reads this first)
├── AGENTS.md                    ← routing table + god nodes (always in context)
├── agents/
│   ├── dispatcher.prompt        ← entry point — routes every task to the right agent
│   ├── validator.prompt         ← diff validation rules
│   ├── meta-controller.prompt   ← retry loop logic (3 attempts, escalate to human)
│   ├── memory-keeper.prompt     ← post-commit memory update
│   ├── framework-auditor.prompt ← maps codebase on install
│   ├── memory-bootstrapper.prompt ← interactive MEMORY.md fill
│   ├── stack-detector.prompt    ← detects tech stack
│   ├── god-node-hunter.prompt   ← identifies high-risk nodes from graph
│   └── domain-agent.prompt.example ← template for your own agents
├── memory/
│   ├── MEMORY.md                ← project status, architecture, recent fixes
│   └── MEMORY_MAP.md            ← file/function ownership table
├── bin/
│   └── meta-controller          ← retry loop entry point (python3)
├── tools/
│   ├── validator.py             ← static diff validator (pluggable rules)
│   └── meta_controller.py       ← retry logic library
├── logs/                        ← meta-controller failure reports
└── docs/setup/                  ← memory-keeper hook documentation
```

---

## How it works

**Two-layer routing:**

1. `AGENTS.md` — always injected into Claude Code context via `@AGENTS.md` in CLAUDE.md. Lightweight routing table. Claude can answer simple questions from this alone without reading anything else.

2. `agents/dispatcher.prompt` — read on every task. Full routing engine: god node detection, cross-agent audit gates, validator rule map.

**Validator gate:**

Every code diff passes through `tools/validator.py` before being applied to disk. Project-specific rules live in `tools/validator_rules.py` (auto-loaded if present). Four universal fallback rules apply if not:

- No debug statements in production code
- No hardcoded secrets
- Test files must not be deleted
- No destructive git commands

**Meta-controller retry loop:**

On validator FAIL, `bin/meta-controller` intercepts:
- Attempt 2: apply patch strategy for the failure category, retry same agent
- Attempt 3: cumulative patches, retry
- 3× FAIL: write report to `logs/`, require human review

Failure categories: `data_integrity`, `deploy`, `parity`, `cross_agent`

**Memory system:**

`memory/MEMORY.md` and `memory/MEMORY_MAP.md` are read at the start of every session. The post-commit hook (installed by `holography init`) runs `@memory-keeper` after every commit to keep them current.

---

## Install steps

`npx holography init` runs 6 steps:

| Step | What happens |
|------|-------------|
| 1. stack-detector | Detects tech stack (Python/JS/TS/Go/Rust), configures routing table |
| 2. Scaffold | Creates all directories and copies templates |
| 3. framework-auditor | Maps every file and function into MEMORY_MAP.md |
| 4. memory-bootstrapper | Asks 8 questions, fills MEMORY.md interactively |
| 5. god-node-hunter | Finds high-risk nodes (graphify or grep fallback) |
| 6. Summary | Prints next steps |

**Requirements:**
- `claude` CLI in PATH ([Claude Code](https://claude.ai/code))
- `git` (recommended — for post-commit hook)
- `graphify` (recommended — `pip install graphify-cli` — for god node detection)

**Works without graphify:** god-node-hunter falls back to grep-based edge counting.

---

## After install

**Add domain agents:**

```bash
cp agents/domain-agent.prompt.example agents/your-feature.prompt
# Edit it — fill in AGENT OWNERSHIP, GOD NODES IN YOUR DOMAIN, KEY RULES, COMMON TASKS
# Add a routing row to AGENTS.md
```

**Run smoke tests:**

```bash
python3 -m pytest tests/smoke_test.py -v
```

**Commit:**

```bash
git add agents/ memory/ CLAUDE.md AGENTS.md bin/ tools/
git commit -m 'feat: install holography framework'
```

**Open Claude Code:** The session-start protocol in CLAUDE.md activates immediately. Claude will read MEMORY.md → MEMORY_MAP.md → dispatcher.prompt before every task.

---

## Pluggable validator rules

Create `tools/validator_rules.py` to replace the universal fallback rules:

```python
# tools/validator_rules.py
# Injected with: files_in_diff, added_lines, removed_lines, PROJECT_ROOT

def rule1_no_direct_data_edit(diff):
    """Auto-generated files must not be edited directly."""
    for line in added_lines(diff):
        if "DO NOT EDIT" in line:
            return False, "Rule 1: edited auto-generated file directly"
    return True, ""

def rule2_deploy_dry_run_gate(diff):
    """Deploy scripts require a dry-run step."""
    for f in files_in_diff(diff):
        if "deploy" in f or "sync" in f:
            if not any("dry-run" in l or "dry_run" in l for l in added_lines(diff)):
                return False, "Rule 2: deploy change without dry-run gate"
    return True, ""

RULES = [rule1_no_direct_data_edit, rule2_deploy_dry_run_gate]

RETRY_WITH = {
    "Rule 1": "human",
    "Rule 2": "claude-sonnet-4-6",
}
```

---

## CLI reference

```
npx holography init              Full 6-step install
npx holography init --dry-run    Preview — no files written
npx holography --help            Show help
npx holography --version         Show version
```

```
bin/meta-controller --task "your task"         Run agent retry loop
bin/meta-controller --task "task" --dry-run    Preview retry plans
echo "task" | bin/meta-controller              Stdin mode
```

---

## Publish checklist (npmjs.org)

- [ ] Bump version in `package.json`
- [ ] `bootstrap.sh` copied into `npm/` (so it's bundled with the npm package)
- [ ] All templates fetched from GitHub if `bootstrap.sh` not present (inline scaffold in `cli.js`)
- [ ] `npm login` with SalDevX account
- [ ] `npm publish --access public` from `npm/` directory
- [ ] Tag release: `git tag v1.0.0 && git push --tags`
- [ ] Update README badges with npm version shield
- [ ] Test: `npx holography@latest init --dry-run` in a temp directory

---

## License

MIT
