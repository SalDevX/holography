# holography — CLI reference

## npx holography

```
npx holography init                   Full install (5 steps, ~30 seconds)
npx holography init --dry-run         Preview — no files written, no graphify run
npx holography update                 Safe upgrade — overwrites infrastructure,
                                      never touches your agents or memory
npx holography update --dry-run       Preview what would change
npx holography upgrade                Alias for update
npx holography clean                  Remove holography from this project
npx holography uninstall              Alias for clean
npx holography --help
npx holography --version
```

### npx holography clean

Removes everything holography installed. Prompts for confirmation. Source code untouched.

**Removes:**
`agents/` `memory/` `bin/` `logs/` `docs/setup/` `graphify-out/`
`.claude/settings.json` `.claude/commands/`
`CLAUDE.md` `AGENTS.md` `tools/validator.py` `tools/meta_controller.py`

`.claude/` itself is removed only if empty after the above — any other Claude Code settings
you had before installing holography are preserved.

---

## bin/commit

Zero-API commit wrapper — no Claude calls, fully local. Runs: validate → stage → commit → graphify.

```bash
bin/commit -m "your message"                  # stage all tracked changes
bin/commit -m "message" tools/file.py         # specific files only
bin/commit --all -m "message"                 # include untracked (git add .)
bin/commit --skip-validate -m "message"       # bypass validator gate
bin/commit                                    # prompts for message interactively
```

Exit codes: `0` committed · `1` validator FAIL · `2` nothing to commit · `3` usage error

Inside Claude Code, `/commit` calls `bin/commit` with the message already known from context —
one Bash call, no re-reads of git state.

---

## bin/meta-controller

Retry loop CLI — calls `claude -p` up to 3 times with escalating patches.

```bash
bin/meta-controller --task "your task description"
bin/meta-controller --task "task" --dry-run      # print retry plans, no claude calls
echo "task description" | bin/meta-controller    # stdin
```

---

## tools/validator.py

Static diff validator. Reads from stdin, exits `0` (PASS) or `1` (FAIL).

```bash
git diff | python3 tools/validator.py
cat some.diff | python3 tools/validator.py
```

Output on FAIL:

```
STATUS: FAIL
REASON: Rule 2: deploy change without dry-run gate
RETRY_WITH: claude-sonnet-4-6
FIX_HINT: add a dry-run step before the live execution block
```
