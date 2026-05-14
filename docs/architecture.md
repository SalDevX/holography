# holography — Architecture

## File tree

After `npx holography init`:

```
your-project/
├── CLAUDE.md                        ← session start protocol — read first, every session
├── AGENTS.md                        ← routing table + god nodes — injected via @include
├── agents/
│   ├── dispatcher.prompt            ← task router — every task hits this before any agent acts
│   ├── validator.prompt             ← diff validation gate
│   ├── meta-controller.prompt       ← retry strategist (3 attempts, then escalate to human)
│   ├── memory-keeper.prompt         ← post-commit memory updater
│   ├── framework-auditor.prompt     ← bootstrap: maps codebase on first install
│   ├── memory-bootstrapper.prompt   ← bootstrap: fills MEMORY.md interactively
│   ├── stack-detector.prompt        ← bootstrap: reconfigures routing for stack changes
│   ├── god-node-hunter.prompt       ← bootstrap: re-identifies god nodes from graph
│   └── domain-agent.prompt.example  ← template for your domain agents
├── memory/
│   ├── MEMORY.md                    ← project status, architecture, recent fixes (2-week window)
│   └── MEMORY_MAP.md                ← file/function/god-node ownership by community
├── bin/
│   ├── commit                       ← zero-API commit: validate → stage → commit → graphify
│   └── meta-controller              ← retry loop CLI (Python 3, calls claude -p)
├── tools/
│   ├── validator.py                 ← static diff validator (4 rules + pluggable)
│   └── meta_controller.py           ← retry loop library (FailBlock, MetaController, RetryPlan)
├── .claude/
│   ├── settings.json                ← PreToolUse/PostToolUse hooks (god node injection)
│   └── commands/
│       ├── memory-bootstrapper.md
│       ├── domain-agent-builder.md
│       ├── god-node-hunter.md
│       ├── framework-auditor.md
│       ├── memory-keeper.md
│       └── commit.md
├── .git/hooks/
│   └── post-commit                  ← runs @memory-keeper after every commit
├── logs/                            ← meta-controller failure reports (.md, timestamped)
└── docs/setup/                      ← memory-keeper hook documentation
```

---

## Install steps

`npx holography init` runs 5 steps automatically (~30 seconds):

**[1/5] git** — finds `.git` or runs `git init` + initial commit.

**[2/5] graphify** — runs `graphify update .` and parses `graphify-out/graph.json` to extract:
- God nodes (functions with ≥6 edges or betweenness ≥0.01)
- Community structure (Louvain clustering of your call graph)
- File → function map for every source file

If graphify is not installed, install continues in static fallback mode — templates write with
`{{GOD_NODES_TABLE}}` markers that `/god-node-hunter` can fill later from inside Claude Code.

**[3/5] stack-detector** — reads `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`,
`Cargo.toml`. Detects language, frameworks, entry points, test command. No prompting.

**[4/5] scaffold** — creates all directories, writes all framework files with real graph data
injected, installs `bin/meta-controller` and `.git/hooks/post-commit`.

Existing files are not overwritten. Re-running after customizing your agents is safe.

**[5/5] hooks** — writes `.claude/settings.json` with PreToolUse/PostToolUse hooks that inject
the god node list into Claude's context on every file read/write.

---

## How the pieces connect

```
CLAUDE.md  →  loads  →  MEMORY.md + MEMORY_MAP.md + AGENTS.md
                                        ↓
                             agents/dispatcher.prompt
                                        ↓
                             agents/<routed>.prompt
                                        ↓
                              tools/validator.py
                                ↓             ↓
                             PASS            FAIL
                              ↓               ↓
                          applied       meta-controller
                                             ↓
                                     retry (up to 3×)
                                             ↓
                                    logs/ failure report
```

Every session: memory first, routing second, action third, validator gate before disk.

---

## npx holography update

Updates infrastructure without touching your customized agents or memory:

**Always overwrites:** `tools/`, `.claude/commands/`, `bin/commit`, `bin/meta-controller`,
`.git/hooks/post-commit`

**Never touches:** `CLAUDE.md`, `AGENTS.md`, `memory/`, your domain agent prompts

```bash
npx holography update
npx holography update --dry-run   # preview what would change
```
