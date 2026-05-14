# {{PROJECT_NAME}} — Claude Memory

**Project:** {{PROJECT_DESCRIPTION}}
**Owner:** {{OWNER}} · {{LOCATION}} · {{TIMEZONE}}
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

| File | Contents | Load when |
|------|----------|-----------|
| `memory/MEMORY.md` | Status, architecture, recent fixes | Every session |
| `memory/MEMORY_MAP.md` | Function/file ownership table | Every session |
