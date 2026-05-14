# holography — Extending the system

## Adding domain agents

The recommended path is `/domain-agent-builder` — it reads your graph communities, proposes
groupings, waits for your confirmation, then creates named agents with real file ownership and
updates the AGENTS.md routing table automatically.

To create one manually:

```bash
cp agents/domain-agent.prompt.example agents/your-feature.prompt
```

Fill in four sections:
- `## AGENT OWNERSHIP` — exact files this agent controls, one per line
- `## GOD NODES IN YOUR DOMAIN` — from the god nodes table in AGENTS.md
- `## KEY RULES` — the 3–5 invariants most likely to be violated in this domain
- `## COMMON TASKS` — the 5–8 most frequent real tasks (specific to your project, not generic)

Add a routing row to AGENTS.md:

```markdown
| Edit `your-feature/` (N files) | `agents/your-feature.prompt` |
```

---

## Custom validator rules

Create `tools/validator_rules.py` — auto-loaded by `tools/validator.py` if present. The helpers
`files_in_diff`, `added_lines`, `removed_lines`, and `PROJECT_ROOT` are injected automatically.

```python
# tools/validator_rules.py

def rule_no_direct_data_edit(diff):
    for line in added_lines(diff):
        if "DO NOT EDIT" in line:
            return False, "Rule 1: edited auto-generated file directly"
    return True, ""

def rule_deploy_dry_run_gate(diff):
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

---

## Customizing the meta-controller

`tools/meta_controller.py` is installed into your project and is yours to edit. Customize:

- `CATEGORIES` — your project's failure categories
- `SIGNAL_TO_CATEGORY` — keywords that map error output to categories
- `_PATCHES` — prompt patches to apply per category per attempt
- `_PARAMS` — model overrides per category per attempt

`npx holography update` overwrites `tools/meta_controller.py` with the latest version. If you've
customized it, either pin your changes or move your rules to `tools/validator_rules.py` (which
update never touches).

---

## Running the retry loop directly

```bash
bin/meta-controller --task "refactor validate() to handle multi-row CSV"
bin/meta-controller --task "add dark mode to ProductGrid()" --dry-run
echo "fix sftp timeout" | bin/meta-controller
```
