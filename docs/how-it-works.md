# holography — How it works

## Session protocol

`CLAUDE.md` enforces a mandatory read sequence before any action:

```
1. memory/MEMORY.md          ← project status, architecture, what broke last week
2. memory/MEMORY_MAP.md      ← file/function ownership, god node locations
3. agents/dispatcher.prompt  ← emit a ROUTE block — no action without one
4. agents/<routed>.prompt    ← only the agent(s) named in the ROUTE block
```

`AGENTS.md` is always in context via `@AGENTS.md` in `CLAUDE.md` — it's the lightweight routing
index (god nodes table + routing table) that fits in context without reading the full dispatcher.

---

## Diff gate

Every diff goes through the validator before it touches disk:

```
agent produces diff
        ↓
tools/validator.py
        ↓
     PASS → diff applied
     FAIL → meta-controller intercepts
                 ↓
         attempt 2: apply category patch, retry same agent
         attempt 3: cumulative patches, retry
         3× FAIL → write report to logs/ → stop, human required
```

Failure categories and their automatic patches:

| Category | Patch on attempt 2 | Patch on attempt 3 |
|----------|-------------------|-------------------|
| `data_integrity` | escalate to human | escalate to human |
| `deploy` | add dry-run step | logging only, no new deploy logic |
| `parity` | deliver mobile + desktop together | primary view full, TODO stub in secondary |
| `cross_agent` | secondary agent read-only | escalate primary ownership |

---

## Memory lifecycle

The post-commit hook — installed in `.git/hooks/post-commit` — runs after every commit:

```bash
claude --dangerously-skip-permissions \
    "You are @memory-keeper. Read agents/memory-keeper.prompt.
     Run: git diff HEAD~1 HEAD --name-only && git log -1 --format='%s %b'
     Read graphify-out/GRAPH_REPORT.md if it exists.
     Update memory/MEMORY.md Recent Fixes. Update memory/MEMORY_MAP.md if new functions added.
     Update relevant agents/*.prompt if new files added. Run graphify update . last.
     Be specific. No prose." 2>&1 | tee -a logs/memory-keeper.log
```

The hook silently skips if `claude` is not in PATH — run `/memory-keeper` manually to sync.

`MEMORY.md` keeps a 2-week rolling window of recent fixes. Older entries are pruned by
`@memory-keeper` to keep the file compact enough to load efficiently every session.

---

## God node injection

`.claude/settings.json` installs two hooks that fire on every file access:

**PreToolUse (Glob/Grep/Read)** — injects the god node list before Claude reads anything:
```
graphify graph loaded. God nodes: fmt(), _run_validator(), parse_csv_multi_row() ...
Read GRAPH_REPORT.md only when tracing unknown cross-file dependencies.
```

**PostToolUse (Edit/Write/MultiEdit)** — reminds Claude of the post-change protocol:
```
Code modified. After this task: run graphify update ., update memory/MEMORY.md Recent Fixes,
update MEMORY_MAP.md if new functions added.
```

---

## bin/commit

`bin/commit` is a local Python script — no Claude API calls, zero token cost:

```
validate (tools/validator.py on current diff)
    ↓ PASS
stage (git add -u, or specific files, or git add .)
    ↓
commit (git commit -m "message")
    ↓
graphify update .
```

Run it directly in the terminal: `bin/commit -m "your message"`

Inside Claude Code, `/commit` calls `bin/commit` with the message already known from context —
one Bash call, no re-reads of git state.
