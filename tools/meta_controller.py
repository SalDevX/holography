"""
holography — tools/meta_controller.py
Generic retry loop logic. Copy to your project root tools/ directory.

Consumed by bin/meta-controller. Not a CLI — import only.

Customize by editing:
    CATEGORIES          — your project's failure categories
    SIGNAL_TO_CATEGORY  — keywords that map error signals to categories
    _PATCHES            — patch strategies per category per attempt
    _PARAMS             — model override params per category per attempt
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"


# ---------------------------------------------------------------------------
# Failure categories — CUSTOMIZE FOR YOUR PROJECT
# ---------------------------------------------------------------------------

CATEGORIES = {"data_integrity", "deploy", "parity", "cross_agent"}

SIGNAL_TO_CATEGORY: dict[str, str] = {
    # data integrity
    "generated":    "data_integrity",
    "hand-edit":    "data_integrity",
    "Rule 1":       "data_integrity",
    # deploy
    "deploy":       "deploy",
    "dry-run":      "deploy",
    "upload":       "deploy",
    "ftp":          "deploy",
    "sftp":         "deploy",
    "Rule 2":       "deploy",
    # parity
    "parity":       "parity",
    "mobile":       "parity",
    "desktop":      "parity",
    "Rule 4":       "parity",
    # cross-agent
    "ownership":    "cross_agent",
    "boundary":     "cross_agent",
    "cross_agent":  "cross_agent",
}


def _infer_category(signal: str) -> str:
    for keyword, category in SIGNAL_TO_CATEGORY.items():
        if keyword.lower() in signal.lower():
            return category
    return "data_integrity"


# ---------------------------------------------------------------------------
# Patch strategy tables — CUSTOMIZE FOR YOUR PROJECT
# ---------------------------------------------------------------------------
# Each category has 3 entries: [attempt1_patches, attempt2_patches, attempt3_patches]
# attempt1 is always [] (first attempt has no patches applied yet)

_PATCHES: dict[str, list[list[str]]] = {
    "data_integrity": [
        [],
        ["escalate to human — generated file edited directly, intent unclear"],
        ["escalate to human — generated file edited directly, intent unclear"],
    ],
    "deploy": [
        [],
        ["include dry-run step before live execution"],
        ["minimum viable change — logging only, no new deploy logic this attempt"],
    ],
    "parity": [
        [],
        ["implement feature in both mobile and desktop views — deliver as single diff"],
        ["primary view stub: implement fully; add TODO in mobile view with full spec"],
    ],
    "cross_agent": [
        [],
        ["secondary agent reviews only — no code modifications"],
        ["escalate primary ownership — secondary agent is read-only"],
    ],
}

_PARAMS: dict[str, list[dict]] = {
    "data_integrity": [{}, {"_model_override": "human"}, {"_model_override": "human"}],
    "deploy":         [{}, {}, {}],
    "parity":         [{}, {}, {}],
    "cross_agent":    [{}, {}, {"_model_override": "claude-opus-4-7"}],
}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class FailBlock:
    rule: int
    category: str
    signal: str
    agent: str
    attempt: int
    file: str = ""

    @classmethod
    def from_text(cls, text: str, attempt: int = 1) -> "FailBlock":
        def _get(key: str) -> str:
            m = re.search(rf"^\s*{key}:\s*(.+)$", text, re.MULTILINE)
            return m.group(1).strip().strip('"') if m else ""

        rule_str = _get("rule")
        rule = int(rule_str) if rule_str.isdigit() else 0
        signal = _get("signal") or _get("REASON") or text[:200]
        category = _get("category") or _infer_category(signal)
        return cls(
            rule=rule,
            category=category if category in CATEGORIES else _infer_category(signal),
            signal=signal,
            agent=_get("agent"),
            attempt=attempt,
            file=_get("file"),
        )


@dataclass
class RetryPlan:
    attempt: int
    category: str
    change_agent: bool
    new_agent: str
    prompt_patches: list[str]
    param_patches: dict
    escalate_if_fail: bool
    notes: str

    def as_dict(self) -> dict:
        return {
            "attempt": self.attempt,
            "category": self.category,
            "change_agent": self.change_agent,
            "new_agent": self.new_agent,
            "prompt_patches": self.prompt_patches,
            "param_patches": self.param_patches,
            "escalate_if_fail": self.escalate_if_fail,
            "notes": self.notes,
        }


# ---------------------------------------------------------------------------
# MetaController
# ---------------------------------------------------------------------------

class MetaController:
    MAX_ATTEMPTS = 3

    def __init__(
        self,
        task: str,
        vertical: str = "",
        initial_fail_block: FailBlock | None = None,
    ) -> None:
        self.task = task
        self.vertical = vertical
        self.initial_fail_block = initial_fail_block
        self._attempt_log: list[dict] = []

    def build_retry_plan_for_attempt(self, fail: FailBlock, attempt: int) -> RetryPlan:
        cat = fail.category
        idx = min(attempt - 1, 2)
        patches = list(_PATCHES.get(cat, _PATCHES["deploy"])[idx])
        params = dict(_PARAMS.get(cat, _PARAMS["deploy"])[idx])
        change_agent = attempt == 3 and cat == "cross_agent"
        escalate = attempt >= self.MAX_ATTEMPTS
        return RetryPlan(
            attempt=attempt,
            category=cat,
            change_agent=change_agent,
            new_agent="@primary-engineer" if change_agent else "",
            prompt_patches=patches,
            param_patches=params,
            escalate_if_fail=escalate,
            notes=f"{cat} failure on attempt {attempt - 1}",
        )

    def run(
        self,
        agent_runner: Callable[[str, list[str], dict], str],
        validator: Callable[[str], tuple[bool, str, str | None]],
    ) -> dict:
        fail_block = self.initial_fail_block
        start_attempt = 2 if fail_block else 1

        for attempt in range(start_attempt, self.MAX_ATTEMPTS + 1):
            if fail_block:
                plan = self.build_retry_plan_for_attempt(fail_block, attempt)
                patches = plan.prompt_patches
                params = plan.param_patches
            else:
                patches, params = [], {}

            output = agent_runner(self.task, patches, params)
            passed, fail_text, retry_with = validator(output)

            self._attempt_log.append({
                "attempt": attempt,
                "patches": patches,
                "passed": passed,
                "signal": fail_text[:300] if fail_text else "",
            })

            if passed:
                return {"passed": True, "attempts": attempt, "report_path": None}

            if attempt < self.MAX_ATTEMPTS:
                fail_block = FailBlock.from_text(fail_text, attempt=attempt)

        report_path = self._write_report(fail_text)
        return {
            "passed": False,
            "attempts": self.MAX_ATTEMPTS,
            "report_path": str(report_path),
        }

    def _write_report(self, final_signal: str) -> Path:
        LOGS_DIR.mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
        path = LOGS_DIR / f"meta-controller-{ts}.md"
        lines = [
            "# Meta-Controller Failure Report",
            f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"**Task:** {self.task}",
            f"**Attempts:** {self.MAX_ATTEMPTS}",
            "",
            "## Attempt Log",
        ]
        for entry in self._attempt_log:
            lines += [
                f"\n### Attempt {entry['attempt']}",
                f"- Patches applied: {entry['patches'] or 'none'}",
                f"- Result: {'PASS' if entry['passed'] else 'FAIL'}",
                f"- Signal: {entry['signal'] or '—'}",
            ]
        lines += [
            "",
            "## Recommended Human Action",
            "Review the validator output above and apply the fix manually.",
            "",
            "## Raw Validator Output",
            f"```\n{final_signal}\n```",
        ]
        path.write_text("\n".join(lines))
        return path
