#!/usr/bin/env python3
"""
holography — tools/validator.py
Generic static diff validator. Copy to your project root tools/ directory.

Project-specific rules go in tools/validator_rules.py (auto-loaded if present).
Fallback: 4 universal rules that apply to any project.

Usage:
    git diff | python3 tools/validator.py
    cat some.diff | python3 tools/validator.py
    python3 tools/validator.py --help
"""

import importlib.util
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Helpers (used by rules)
# ---------------------------------------------------------------------------

def files_in_diff(diff: str) -> set[str]:
    return {m.group(1) for m in re.finditer(r"^--- a/(.+)$", diff, re.MULTILINE)}


def added_lines(diff: str) -> list[str]:
    return [
        line[1:]
        for line in diff.splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]


def removed_lines(diff: str) -> list[str]:
    return [
        line[1:]
        for line in diff.splitlines()
        if line.startswith("-") and not line.startswith("---")
    ]


# ---------------------------------------------------------------------------
# Universal fallback rules (override in validator_rules.py)
# ---------------------------------------------------------------------------

def _rule_no_debug_in_production(diff: str) -> tuple[bool, str]:
    """No debug/print statements added to production code."""
    debug_patterns = (
        "import pdb", "pdb.set_trace()", "debugger;",
        "console.log(", "print(f\"DEBUG", "print('DEBUG",
    )
    for line in added_lines(diff):
        for pattern in debug_patterns:
            if pattern in line:
                return False, f"Universal Rule 1: debug statement added — {pattern!r}"
    return True, ""


def _rule_no_hardcoded_secrets(diff: str) -> tuple[bool, str]:
    """No secrets, tokens, or passwords added to code."""
    secret_patterns = re.compile(
        r'(?i)(password|secret|api_key|token|passwd)\s*=\s*[\'"][^\'"]{6,}[\'"]'
    )
    for line in added_lines(diff):
        if secret_patterns.search(line):
            return False, "Universal Rule 2: hardcoded secret detected in diff"
    return True, ""


def _rule_tests_not_deleted(diff: str) -> tuple[bool, str]:
    """Test files must not be deleted."""
    for line in diff.splitlines():
        if line.startswith("--- a/") and ("test" in line.lower() or "spec" in line.lower()):
            path = line[6:]
            if path not in files_in_diff(diff):
                return False, f"Universal Rule 3: test file deleted — {path}"
    return True, ""


def _rule_no_force_push_commands(diff: str) -> tuple[bool, str]:
    """No force push or destructive git commands added."""
    dangerous = ("git push --force", "git push -f", "git reset --hard", "rm -rf")
    for line in added_lines(diff):
        for cmd in dangerous:
            if cmd in line:
                return False, f"Universal Rule 4: dangerous command added — {cmd!r}"
    return True, ""


UNIVERSAL_RULES = [
    _rule_no_debug_in_production,
    _rule_no_hardcoded_secrets,
    _rule_tests_not_deleted,
    _rule_no_force_push_commands,
]

UNIVERSAL_RETRY = {
    "Universal Rule 1": "claude-sonnet-4-6",
    "Universal Rule 2": "human",
    "Universal Rule 3": "human",
    "Universal Rule 4": "human",
}


# ---------------------------------------------------------------------------
# Project-specific rules loader
# ---------------------------------------------------------------------------

def _load_project_rules() -> tuple[list, dict]:
    """
    Load project-specific rules from tools/validator_rules.py if it exists.
    The file must define:
        RULES: list of callables (diff: str) -> (bool, str)
        RETRY_WITH: dict mapping rule prefix to model slug
    """
    rules_path = PROJECT_ROOT / "tools" / "validator_rules.py"
    if not rules_path.exists():
        return UNIVERSAL_RULES, UNIVERSAL_RETRY

    spec = importlib.util.spec_from_file_location("validator_rules", rules_path)
    mod = importlib.util.module_from_spec(spec)

    # Expose helpers so validator_rules.py can import them
    mod.files_in_diff = files_in_diff
    mod.added_lines = added_lines
    mod.removed_lines = removed_lines
    mod.PROJECT_ROOT = PROJECT_ROOT

    try:
        spec.loader.exec_module(mod)
        rules = getattr(mod, "RULES", UNIVERSAL_RULES)
        retry = getattr(mod, "RETRY_WITH", UNIVERSAL_RETRY)
        return rules, retry
    except Exception as e:
        print(f"[VALIDATOR] warning: failed to load validator_rules.py — {e}", file=sys.stderr)
        return UNIVERSAL_RULES, UNIVERSAL_RETRY


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    if "--help" in sys.argv:
        print(__doc__)
        return 0

    diff = sys.stdin.read()

    if not diff.strip():
        print("[VALIDATOR] PASS — no diff to validate")
        print("\nSTATUS: PASS\nREASON: empty diff\nRETRY_WITH: none\nFIX_HINT: none")
        return 0

    rules, retry_map = _load_project_rules()
    failures = []

    for rule_fn in rules:
        passed, reason = rule_fn(diff)
        if not passed:
            failures.append(reason)
            print(f"[VALIDATOR] {reason}", file=sys.stderr)

    if failures:
        first = failures[0]
        rule_key = first.split(":")[0].strip()
        retry = retry_map.get(rule_key, "claude-sonnet-4-6")
        print(f"\nSTATUS: FAIL")
        print(f"REASON: {first}")
        print(f"RETRY_WITH: {retry}")
        print(f"FIX_HINT: see reason above")
        return 1

    passed_ids = ", ".join(f.__name__.lstrip("_rule_") for f in rules)
    print(f"[VALIDATOR] PASS — {passed_ids}")
    print(f"\nSTATUS: PASS\nREASON: all {len(rules)} rules passed\nRETRY_WITH: none\nFIX_HINT: none")
    return 0


if __name__ == "__main__":
    sys.exit(main())
