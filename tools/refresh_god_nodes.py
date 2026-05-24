#!/usr/bin/env python3
"""
tools/refresh_god_nodes.py
Zero-API god-node table refresh. Reads graphify-out/graph.json and patches
the God Nodes table in AGENTS.md with current edge counts.

Run automatically by bin/commit (step 8) if this file exists.
Run manually: python3 tools/refresh_god_nodes.py [--threshold N]

Exit codes: 0 = success or skipped  1 = error
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GRAPH_JSON   = PROJECT_ROOT / "graphify-out" / "graph.json"
AGENTS_MD    = PROJECT_ROOT / "AGENTS.md"

DEFAULT_THRESHOLD = 6


def load_graph() -> tuple[list[dict], list[dict]]:
    if not GRAPH_JSON.exists():
        print("[refresh_god_nodes] graphify-out/graph.json not found — skipping", file=sys.stderr)
        sys.exit(0)
    with open(GRAPH_JSON) as f:
        g = json.load(f)
    return g.get("nodes", []), g.get("links", [])


def compute_god_nodes(nodes: list[dict], links: list[dict], threshold: int) -> list[dict]:
    """Return nodes at or above threshold, sorted by edge count descending."""
    edge_count: Counter = Counter()
    for link in links:
        edge_count[link.get("source", "")] += 1
        edge_count[link.get("target", "")] += 1

    node_map = {n["id"]: n for n in nodes}
    god_nodes = []
    for nid, deg in edge_count.most_common():
        if deg < threshold:
            break
        n = node_map.get(nid, {})
        god_nodes.append({
            "name":  n.get("label", nid),
            "edges": deg,
            "file":  n.get("source_file", "—"),
        })
    return god_nodes


def build_table_rows(god_nodes: list[dict]) -> str:
    rows = []
    for g in god_nodes:
        name = f"`{g['name']}`"
        rows.append(f"| {name} | {g['edges']} | `{g['file']}` | — | |")
    return "\n".join(rows)


def patch_agents_md(god_nodes: list[dict], threshold: int) -> None:
    if not AGENTS_MD.exists():
        print("[refresh_god_nodes] AGENTS.md not found — skipping", file=sys.stderr)
        sys.exit(0)

    content = AGENTS_MD.read_text()

    table_start = re.search(
        r"(\| Node \| Edges \| File \| Owner \| Notes \|\n\|[-| ]+\|\n)",
        content,
    )
    if not table_start:
        print("[refresh_god_nodes] God Nodes table not found in AGENTS.md — skipping", file=sys.stderr)
        sys.exit(0)

    header_end = table_start.end()
    rest = content[header_end:]
    table_rows_match = re.match(r"((?:\|.+\|\n?)*)", rest)
    old_rows_end = header_end + (table_rows_match.end() if table_rows_match else 0)

    new_rows = build_table_rows(god_nodes)
    new_content = content[:header_end] + new_rows + "\n" + content[old_rows_end:]
    AGENTS_MD.write_text(new_content)
    print(f"[refresh_god_nodes] AGENTS.md updated — {len(god_nodes)} god nodes (≥{threshold} edges)")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD,
                   help=f"Minimum edge count to qualify as a god node (default: {DEFAULT_THRESHOLD})")
    args = p.parse_args()

    nodes, links = load_graph()
    god_nodes = compute_god_nodes(nodes, links, args.threshold)
    if not god_nodes:
        print(f"[refresh_god_nodes] no nodes with ≥{args.threshold} edges found")
        sys.exit(0)
    patch_agents_md(god_nodes, args.threshold)


if __name__ == "__main__":
    main()
