# {{PROJECT_NAME}} — Claude Memory

**Project:** {{PROJECT_DESCRIPTION}}
**Owner:** {{PROJECT_OWNER}} · {{LOCATION}} · {{TIMEZONE}}
**Location:** `{{PROJECT_PATH}}`
**Stack:** {{STACK}}
**Status:** {{STATUS}}

---

## Architecture

{{ARCHITECTURE_DESCRIPTION}}

### Key Components

| Component | File(s) | Notes |
|-----------|---------|-------|
{{ARCHITECTURE_TABLE}}

### Data Flow

```
{{DATA_FLOW_DIAGRAM}}
```

### Deploy / Build Pipeline

```
{{DEPLOY_PIPELINE}}
```

---

## Cascade / Fallback Systems

{{CASCADE_SYSTEMS}}

---

## Known Issues / Fragile

{{KNOWN_ISSUES}}

---

## Recent Fixes

*(populated by @memory-keeper after each commit)*

| Date | What | File |
|------|------|------|
| {{DATE}} | holography framework installed | full agent layer |

---

## Memory Modules

| File | Contents | Load when | Budget |
|------|----------|-----------|--------|
| `memory/MEMORY.md` | Status, architecture, recent fixes | Every session | ≤70 lines |
| `memory/MEMORY_MAP.md` | Function/file ownership table | Every session | ≤95 lines |
| `memory/MEMORY_CHANGELOG.md` | Append-only fix history | On demand — recent fix context only | unlimited |
| `memory/MEMORY_INTELLIGENCE.md` | Rationale, gotchas, imperative patterns | On demand — before touching flagged areas | unlimited |
| `memory/MEMORY_REFERENCE.md` | Schemas, deploy modes, lookup tables | On demand — when verifying a spec | unlimited |
