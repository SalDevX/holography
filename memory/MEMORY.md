# holography — Claude Memory

**Project:** python · 61 nodes
**Owner:** {{PROJECT_OWNER}} · {{LOCATION}} · {{TIMEZONE}}
**Location:** `/home/craftworkson/dev/holography`
**Stack:** python · none (generic)
**Status:** active

---

## Architecture

<!-- fill in via /memory-bootstrapper -->

### Key Components

| Component | File(s) | Notes |
|-----------|---------|-------|
| (run /memory-bootstrapper in Claude Code) | | |

### Data Flow

```
(run /memory-bootstrapper)
```

### Deploy / Build Pipeline

```
(run /memory-bootstrapper)
```

---

## Cascade / Fallback Systems

*(run /memory-bootstrapper)*

---

## Known Issues / Fragile

*(none yet — add as discovered)*

---

## Recent Fixes

*(populated by @memory-keeper after each commit)*

| Date | Commit | What |
|------|--------|------|
| 2026-05-14 | 0397f07 | README.md cut to ~80 lines; full content split into 6 new docs/ pages: architecture.md, how-it-works.md, examples.md, extending.md, cli.md, philosophy.md (includes known tradeoffs section) |
| 2026-05-14 | c4e49fb | .claude/settings.local.json: added allowlist entry `git -C ... add npm/cli.js npm/package.json npm/templates.json` to support /commit slash command workflow without permission prompts |
| 2026-05-14 | 9a44e52 | npm/cli.js: added /commit slash command template to _writeClaudeCommands(); uses context-only commit (no git reads); bin/commit -m "<summary>"; installed via init + updated via update; bump 1.0.28→1.0.29 |
| 2026-05-14 | 25bb99e | README.md: rendered AGENTS.md routing table and MEMORY_MAP.md example tables as native GitHub tables; removed raw pipe/markdown fences; added ✓ god-node marker; trimmed global invariants to blockquote |
| 2026-05-14 | 57480af | npm/cli.js: added _writeCommitScript(), _runUpdate(), _mergeDispatcherRoutes(); bin/commit + bin/commit-jsx-patch templates; holography update command; bump 1.0.26; graph: 64 nodes, 97 edges; _runUpdate() new god node (9 edges) |
| 2026-05-14 | a2ca249 | agents/tools-engineer.prompt + AGENTS.md: added missing god nodes _rule_mobile_desktop_parity() (3 edges) and _load_project_rules() (3 edges) — both in tools/validator.py; omitted from initial domain-agent build |
| 2026-05-14 | b34c354 | Created domain agents: agents/cli-engineer.prompt, agents/install-engineer.prompt, agents/tools-engineer.prompt; updated AGENTS.md routing table + dispatcher.prompt ownership map |
| 2026-05-14 | 9357366 | Added templates/agents/domain-agent-builder.prompt; replaced validator universal rules with 4 project rules (js/data.js guard, sftp logic gate, asset path consistency, mobile/desktop parity); meta_controller.py parity patch now includes "mobile"/"both"; bump 1.0.23; templates.json 57KB |
| 2026-05-14 | b4e40bc | cli.js: guard against graphify running on holography source repo itself |
| 2026-05-14 | 4b2d715 | Rewrote all .claude/commands/ descriptions: front-loaded purpose, ~60 chars; templates.json regenerated |
| 2026-05-14 | 9274a09 | npm/package.json: version bump to 1.0.16 |
| 2026-05-14 | 9a9ed01 | Restored tools/validator.py + tools/meta_controller.py; added _writeClaudeCommands(), _generateClaudeSettings(), _runClean() to cli.js; templates.json 33KB→48KB; holography clean surgical (removes settings.json + commands/ individually); bump 1.0.15 |

---

## Memory Modules

| File | Contents | Load when |
|------|----------|-----------|
| `memory/MEMORY.md` | Status, architecture, recent fixes | Every session |
| `memory/MEMORY_MAP.md` | Function/file ownership table | Every session |
