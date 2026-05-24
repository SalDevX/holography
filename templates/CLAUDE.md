# Session Start
Before any task, read in order:

1. `memory/MEMORY.md` — project status, architecture, recent fixes
2. `memory/MEMORY_MAP.md` — file/function ownership and god nodes
3. **REQUIRED: Read `agents/dispatcher.prompt` and emit a ROUTE block before executing any task**
4. Read ONLY the agent prompt(s) specified in the ROUTE block

Read `graphify-out/GRAPH_REPORT.md` only when tracing unknown cross-file dependencies.

## Before Every Task

A task is any user message that produces a code read, proposal, or diff — including "go", "ok", "continue", and follow-up corrections within the same session.

**Required before every task — not just session start:**
- Read `agents/dispatcher.prompt`
- Emit a ROUTE block
- Read ONLY the agent prompt(s) named in the ROUTE block

Routing from a previous task does not carry forward. Each task gets a fresh ROUTE block.

## Before Applying Any Diff

Run `agents/validator.prompt` rules for all touched files
- PASS → apply diff
- FAIL → meta-controller intercepts (see `agents/meta-controller.prompt`)
  - attempt 2: patch + retry same agent
  - attempt 3: cumulative patch + retry
  - 3× FAIL → stop, report written to `logs/` — human review required

## After Every Code Change

Run: `graphify update .` — plain bash command, NOT the graphify skill, zero API cost
Update `memory/MEMORY.md` Recent Fixes (2-week rolling window)
Update `memory/MEMORY_MAP.md` if new functions added
Run: `python3 -m pytest tests/smoke_test.py -v` — all tests must pass

## graphify
Run `graphify update .` as a plain bash command after modifying any code file (AST-only, no API cost).
Do NOT use the Skill tool for graphify. Just: Bash("graphify update .")

@AGENTS.md
