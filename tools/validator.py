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
    """Files present in a diff via --- a/ headers. Does not catch new files (use files_touched_in_diff)."""
    return {m.group(1) for m in re.finditer(r"^--- a/(.+)$", diff, re.MULTILINE)}


def files_touched_in_diff(diff: str) -> set[str]:
    """Files touched in a diff via +++ b/ headers. Includes new files where source side is /dev/null."""
    return {m.group(1) for m in re.finditer(r"^\+\+\+ b/(.+)$", diff, re.MULTILINE)}


def added_lines(diff: str) -> list[str]:
    return [
        line[1:]
        for line in diff.splitlines()
        if line.startswith("+") and not line.startswith("+++")
    ]


def added_lines_for_file(diff: str, filename: str) -> list[str]:
    """Added lines scoped to a specific file's hunks only."""
    result = []
    in_file = False
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            in_file = line[6:] == filename
        elif line.startswith("--- ") or line.startswith("+++ "):
            pass
        elif in_file and line.startswith("+"):
            result.append(line[1:])
    return result


def removed_lines(diff: str) -> list[str]:
    return [
        line[1:]
        for line in diff.splitlines()
        if line.startswith("-") and not line.startswith("---")
    ]


# ---------------------------------------------------------------------------
# Universal fallback rules (override in validator_rules.py)
# ---------------------------------------------------------------------------

def _rule_no_direct_data_js_edit(diff: str) -> tuple[bool, str]:
    """js/data.js is generated — must not be edited directly."""
    if "js/data.js" in files_in_diff(diff):
        return False, "Rule 1: js/data.js edited directly — changes must go through the data pipeline"
    return True, ""


def _rule_sftp_deploy_logic_gate(diff: str) -> tuple[bool, str]:
    """tools/sftp_sync.py must not gain new logic — comment-only changes are allowed."""
    if "tools/sftp_sync.py" not in files_in_diff(diff):
        return True, ""
    for line in added_lines(diff):
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return False, "Rule 2: tools/sftp_sync.py has a logic change — run dry-run gate first"
    return True, ""


def _rule_asset_path_consistency(diff: str) -> tuple[bool, str]:
    """Asset filenames referenced in diffs must exist on disk in assets/."""
    asset_pattern = re.compile(r"[\w\-]+\.(jpg|jpeg|png|gif|webp)", re.IGNORECASE)
    assets_dir = PROJECT_ROOT / "assets"
    for line in added_lines(diff):
        for m in asset_pattern.finditer(line):
            fname = m.group(0)
            if not (assets_dir / fname).exists():
                return False, f"Rule 3: asset not found on disk — {fname}"
    return True, ""


def _rule_mobile_desktop_parity(diff: str) -> tuple[bool, str]:
    """Desktop UI changes must be paired with a matching mobile change in the same diff."""
    touched = files_touched_in_diff(diff)
    has_desktop = any(f.endswith(".html") or f.startswith("desktop/") for f in touched)
    has_mobile = any(f.startswith("mobile/") for f in touched)
    if has_desktop and not has_mobile:
        return False, "Rule 4: desktop UI changed without matching mobile update — deliver both in one diff"
    return True, ""


UNIVERSAL_RULES = [
    _rule_no_direct_data_js_edit,
    _rule_sftp_deploy_logic_gate,
    _rule_asset_path_consistency,
    _rule_mobile_desktop_parity,
]

UNIVERSAL_RETRY = {
    "Rule 1": "human",
    "Rule 2": "claude-sonnet-4-6",
    "Rule 3": "claude-sonnet-4-6",
    "Rule 4": "claude-sonnet-4-6",
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
    mod.files_touched_in_diff = files_touched_in_diff
    mod.added_lines = added_lines
    mod.added_lines_for_file = added_lines_for_file
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
