# holography

[![npm version](https://img.shields.io/npm/v/holography.svg)](https://www.npmjs.com/package/holography)
[![license](https://img.shields.io/npm/l/holography.svg)](LICENSE)
[![built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-8A2BE2)](https://claude.ai/code)

> Topology-aware operational memory for Claude Code.

A CLI that installs persistent context infrastructure into any project — graph-aware routing, file ownership, and a validator gate that keeps Claude from touching what it shouldn't.

```bash
npx holography init
```

---

## The problem

Claude Code is stateless between sessions. Every session starts cold — the architecture you mapped, the dangerous functions you identified, the ownership rules you built up — re-derived from scratch.

Holography installs the infrastructure that survives restarts: memory files loaded before every task, a routing table that tells Claude who owns what, and a validator that gates every diff before it hits disk.

---

## The non-obvious part: god nodes

reel-engine is a content pipeline: FFmpeg video assembly, LLM script generation, beat sync, publishing to YouTube and Instagram, and SQLite state tracking — 60+ files, thousands of lines.

Open a fresh session, and an agent sees files — not topology.

`Config` looks harmless: just a settings dataclass.

The graph says otherwise: x edges across x communities.

[![explore the reel-engine graph — 1,235 nodes · 2,139 edges](https://img.shields.io/badge/explore%20the%20reel--engine%20graph-1%2C235%20nodes%20·%202%2C139%20edges-6E40C9?style=for-the-badge)](https://cdn.cosmic-energy-daily.com/graph/graph.html)

Every stage depends on it — clip fetching, audio sync, prompt generation, publishing, state tracking.

Rename `cfg.max_clip_duration` to `cfg.clip_duration_max`, and four pipeline stages silently fall back to defaults. No exception. No failed test. Just incorrect video lengths shipped downstream.

Without the graph, an agent would never know `Config` is a god node.

Holography injects that structural risk into context before a single line is edited.

---

## Install

**Prerequisites:** Node 16+, git, Python 3.9+, Claude Code CLI

```bash
# AST analysis engine (required for dynamic mode)
uv tool install graphifyy   # note: package name is graphifyy (double-y)

cd your-project
npx holography init
```

Then open Claude Code and run `/memory-bootstrapper` — 5 questions, ~2 minutes. It fills the parts of `MEMORY.md` that can't be derived from code: project purpose, deploy pipeline, current status.

See [docs/architecture.md](docs/architecture.md) for the full install walkthrough and file tree.

---

## Slash commands

After `npx holography init`, these are available in Claude Code:

```
/memory-bootstrapper     ← required first step after init
/domain-agent-builder    ← required second step
/god-node-hunter         ← re-run after big refactors
/framework-auditor       ← re-map files/functions on demand
/memory-keeper           ← manual memory sync without a commit
/commit                  ← near-zero-cost commit using current context
```

---

## What you get

A structured agent team wired to your codebase: a dispatcher that routes every task, a validator that gates every diff, a meta-controller that retries failures automatically, a post-commit hook that keeps memory current, and domain agents with explicit file ownership.

→ [docs/architecture.md](docs/architecture.md) — full file tree and what each piece does

---

## Honest limitations

- **Graph state goes stale.** `graphify update .` must run after refactors. The post-commit hook handles this — but a large rename without a commit will produce stale routing context until the next run.
- **Validator rules are generic by default.** The four installed rules are starting points. Your project's real invariants need to be written in `tools/validator_rules.py`.
- **Ownership requires upfront thought.** Strict ownership surfaces ambiguity at the dispatcher. Overlapping file lists between agents produce routing conflicts that need manual resolution.
- **The post-commit hook requires `claude` in PATH.** It skips silently otherwise — run `/memory-keeper` manually to sync.

---

## Docs

- [Architecture](docs/architecture.md) — full file tree, install walkthrough, how each piece connects
- [How it works](docs/how-it-works.md) — session protocol, diff gate, memory lifecycle
- [Real-world example](docs/examples.md) — marta-test (Python + React, 141 nodes, 9 communities)
- [Extending](docs/extending.md) — domain agents, custom validator rules, retry loop
- [CLI reference](docs/cli.md) — all commands and scripts
- [Philosophy](docs/philosophy.md) — design rationale and known tradeoffs

---

## License

MIT

---

Built by SalDevX · Bali 🌊
