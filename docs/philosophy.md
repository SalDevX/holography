# holography — Design rationale

## The core problem

Claude Code is stateless. Every session starts with zero context. The first few sessions this is
manageable — the codebase is fresh in your head. Around session 4 or 5, Claude silently touches a
function that 8 other files depend on, and you spend an hour untangling it. Not because Claude made
an error, but because it had no way to know.

Holography's position: memory and topology are infrastructure, not documentation. They need to be
machine-formatted, automatically maintained, and loaded before every action — not written for humans
and consulted occasionally.

---

## Why topology matters

Not all functions are equally dangerous. File size and module structure give rough signals. The call
graph gives precise ones: edge counts (how many callers), betweenness centrality (how critical the
function is to cross-community information flow).

A function with 12 edges and betweenness 0.061 connecting 4 communities is categorically different
from a function with 1 caller in the same module. The graph makes this explicit and present — not
derivable from a filename, not inferred from a comment, injected before the first action.

---

## Why strict ownership works — and where it breaks down

Strict file ownership per agent reduces the surface area of any single change. When an agent can
only modify its own files, cross-cutting changes become visible: they require explicit routing
decisions through the dispatcher, not silent overlap.

The limitation: strict ownership requires upfront thought. If your agents' file lists weren't
designed carefully — if they overlap, or if a file genuinely serves two domains — routing decisions
become manual. The system surfaces ambiguity; it doesn't resolve it.

Partial ownership (a file that legitimately belongs to two agents) is handled by the dispatcher
routing to both agents explicitly. The edits must be atomic. There's no automatic merge.

---

## The validator gate

The gate catches structural violations before they hit disk: editing auto-generated files, deploy
changes without dry-run gates, UI changes without platform parity, cross-agent file access.

It doesn't catch semantic errors or logical bugs — only the pattern violations you've encoded as
rules. The four installed rules are starting points. A project's real invariants are specific to
that project and need to be written by the team that knows what's gone wrong before.

---

## The retry loop

The meta-controller pre-encodes what to do for each failure category. Common failure modes resolve
automatically. Rare ones escalate with a structured report rather than silently failing or requiring
immediate intervention.

It doesn't handle genuine ambiguity well. If a task requires a judgment call about which agent
should own a file, the retry loop will exhaust its attempts and escalate. That's intentional —
ambiguity about ownership is a human decision.

---

## Known tradeoffs

**Graph state vs. reality.** The graph reflects the codebase at the time `graphify update .` last
ran. A large refactor without a commit produces stale routing context. The post-commit hook
mitigates this — but isn't immune to mid-session drift.

**Emergent coupling.** The graph detects structural coupling via AST edges. Semantic coupling —
two functions that don't call each other but must change together for behavioral reasons — is
invisible to static analysis. `MEMORY_MAP.md` is where you record this manually.

**Memory drift.** `MEMORY.md` and `MEMORY_MAP.md` degrade without the post-commit hook. If
`claude` isn't in PATH, the hook silently skips and memory maintenance becomes manual discipline.

**The graph is a snapshot, not a guarantee.** Edge counts and betweenness scores tell you the
structure at analysis time. Rapid iteration, feature branches, and unreferenced dead code all
produce noise. The graph is a strong signal, not an authoritative oracle.
