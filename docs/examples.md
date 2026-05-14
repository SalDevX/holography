# holography — Real-world example

## marta-test

A polyglot project: Python + React e-commerce catalog with desktop, mobile, and FileMaker bridge.
holography installed in ~30 seconds. graphify found 141 nodes, 238 edges, 9 communities.

### AGENTS.md — routing table (auto-generated)

| Task | Agent |
|------|-------|
| ALL tasks — entry point (read first) | `agents/dispatcher.prompt` |
| Edit `desktop/` (2 files) | `agents/frontend-engineer.prompt` |
| Edit `js/` (6 files) | `agents/frontend-engineer.prompt` |
| Edit `mobile/` (2 files) | `agents/frontend-engineer.prompt` |
| Edit `shared/` (1 file) | `agents/frontend-engineer.prompt` |
| Edit `tools/` (2 files) | `agents/bridge-engineer.prompt` |
| Doc sync / MEMORY.md / MEMORY_MAP.md | `agents/memory-keeper.prompt` |
| Validate output before applying | `agents/validator.prompt` |
| FAIL escalation — retry loop | `agents/meta-controller.prompt` |

> God nodes: `fmt()` (12 edges · js/form.js), `_run_validator()` (11 · tests/smoke_test.py), `parse_csv_multi_row()` (10 · tools/fm_bridge.py)

---

### MEMORY_MAP.md — community sections (auto-generated)

**Community 3 — desktop/**

| File | Key functions | God node? |
|------|---------------|:---------:|
| `desktop/app.jsx` | `Header()`, `FilterBar()`, `ProductCard()`, `ProductGrid()`, `DetailPanel()`, `BottomBar()` | — |
| `js/form.js` | `fmt()`, `handleQty()`, `hasOverStock()`, `recalc()`, `getOrderedItems()`, `validate()` | ✓ |
| `shared/utils.js` | `cleanCatLabel()`, `toggleSet()`, `removeFromSet()`, `deriveShells()`, `deriveStones()` | — |

**Community 5 — mobile/**

| File | Key functions | God node? |
|------|---------------|:---------:|
| `mobile/app.jsx` | `IconGrid()`, `IconBag()`, `FilterSheet()`, `BottomSheet()`, `CatalogView()` | — |

**Community 6 — shared/**

| File | Key functions | God node? |
|------|---------------|:---------:|
| `shared/utils.js` | `cleanCatLabel()`, `toggleSet()`, `removeFromSet()`, `deriveShells()` | — |

---

### Terminal output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography v1.0.29
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
      .claude/settings.json — god nodes: fmt(), _run_validator(), parse_csv_multi_row(), ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography v1.0.29 installed in: /home/you/marta-test

  ✅ stack-detector    — done (graph-driven)
  ✅ framework-auditor — done (graph-driven)
  ✅ god-node-hunter   — done (graph-driven)
  ⏳ /memory-bootstrapper  Run after init — fills MEMORY.md with     human context (~2 min · 5 questions) (project)
  ⏳ /domain-agent-builder Run after /memory-bootstrapper — builds named domain agents from graph communities, creates
                              real ... (project)



  

  Open Claude Code and run:
    /memory-bootstrapper
  (~2 min · 5 questions · fills MEMORY.md with human context)

  Then commit:
    git add agents/ memory/ CLAUDE.md AGENTS.md bin/ tools/ .claude/
    git commit -m 'feat: install holography framework'

  Docs: https://github.com/SalDevX/holography
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Static fallback (graphify not installed):

```
[2/5] graphify — building code graph...
      WARN: graphify not found — install: uv tool install graphifyy
      Agents will use static fallback — no dynamic god-node injection.
```

Install continues. Run `/god-node-hunter` from Claude Code later to fill in god nodes from the graph.
