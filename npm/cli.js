#!/usr/bin/env node
/**
 * holography CLI — npx holography init
 *
 * Installs the full agent framework into any project root.
 * Node is used only as a thin launcher — the real work is bash + claude.
 *
 * Commands:
 *   npx holography init          — full 6-step install
 *   npx holography init --dry-run — show what would happen, no writes
 *   npx holography --help
 *   npx holography --version
 */

"use strict";

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------------------------------------------------------------------------
// Bundled template loader (injected by install.js at publish time)
// ---------------------------------------------------------------------------

function _loadBundledTemplates() {
  const bundlePath = path.join(__dirname, "templates.json");
  if (!fs.existsSync(bundlePath)) return null;
  try { return JSON.parse(fs.readFileSync(bundlePath, "utf8")); }
  catch { return null; }
}


// ---------------------------------------------------------------------------
// Version + help
// ---------------------------------------------------------------------------

const PKG = require("./package.json");

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(PKG.version);
  process.exit(0);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
holography v${PKG.version} — Claude Code agent framework installer

Usage:
  npx holography init            Install the full agent framework into the current directory
  npx holography init --dry-run  Preview what would be installed without writing anything
  npx holography --help          Show this message
  npx holography --version       Show version

What 'npx holography init' does (6 steps):
  1. stack-detector  — detect tech stack, configure routing table
  2. Scaffold        — create agents/ memory/ bin/ logs/ tests/ docs/ with templates
  3. framework-auditor — map all files and functions into MEMORY_MAP.md
  4. memory-bootstrapper — fill MEMORY.md interactively (8 questions max)
  5. god-node-hunter — identify god nodes from graphify or grep fallback
  6. Summary         — print next steps

Requirements:
  - Must be run from a project root (any language)
  - 'claude' CLI must be in PATH (Claude Code)
  - git is recommended but not required
  - graphify is recommended but not required (pip install graphify-cli)
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Validate command
// ---------------------------------------------------------------------------

const command = process.argv[2];

if (command !== "init") {
  console.error(`holography: unknown command '${command || ""}'`);
  console.error("Run: npx holography --help");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

const projectRoot = process.cwd();
const projectName = path.basename(projectRoot);

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  holography v${PKG.version}`);
console.log(`  Installing into: ${projectRoot}`);
console.log(`  Project name:    ${projectName}`);
if (dryRun) console.log(`  Mode:            DRY RUN — no files will be written`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

function checkBin(name) {
  const r = spawnSync("which", [name], { encoding: "utf8" });
  return r.status === 0;
}

if (!checkBin("claude")) {
  console.error("ERROR: 'claude' not found in PATH.");
  console.error("Install Claude Code: https://claude.ai/code");
  process.exit(1);
}

const hasGit = fs.existsSync(path.join(projectRoot, ".git"));
const hasGraphify = checkBin("graphify");

if (!hasGit) {
  console.warn("WARN: No .git directory found. Post-commit hook will not be installed.");
  console.warn("      Run 'git init' first if you want automatic memory updates.\n");
}
if (!hasGraphify) {
  console.warn("WARN: graphify not found. God node detection will use grep fallback.");
  console.warn("      Install: pip install graphify-cli\n");
}

// ---------------------------------------------------------------------------
// Locate bootstrap.sh — bundled next to this file at install time
// ---------------------------------------------------------------------------

function findBootstrapSh() {
  // When installed via npm, bootstrap.sh is published alongside cli.js
  const local = path.join(__dirname, "bootstrap.sh");
  if (fs.existsSync(local)) return local;

  // Development: running from within the reel-engine tools/ tree
  const dev = path.join(__dirname, "..", "tools", "bootstrap.sh");
  if (fs.existsSync(dev)) return dev;

  return null;
}

const bootstrapSh = findBootstrapSh();

// ---------------------------------------------------------------------------
// Step 1 — stack-detector (via claude -p)
// ---------------------------------------------------------------------------

console.log("[1/6] stack-detector — detecting tech stack...");

if (dryRun) {
  console.log("      [dry-run] would run: claude -p --dangerously-skip-permissions <stack-detector prompt>");
} else {
  const stackPrompt = `You are @stack-detector. Analyze the project at ${projectRoot}.
Detect the tech stack from file extensions, package.json, requirements.txt, pyproject.toml, go.mod, Cargo.toml.
Output ONLY a STACK_REPORT block:
STACK_REPORT:
  primary_language: <python|javascript|typescript|go|rust|ruby|other>
  frameworks: <comma-separated list or none>
  stack_type: <python-pipeline|html-js-python|react-nextjs|python-api|polyglot|generic>
  test_command: <exact command to run tests>
  entry_points: <comma-separated main files>
No prose. Stack report only.`;

  const r = spawnSync(
    "claude",
    ["-p", "--dangerously-skip-permissions", stackPrompt],
    { encoding: "utf8", cwd: projectRoot, timeout: 60000 }
  );

  if (r.status === 0 && r.stdout) {
    console.log("      " + r.stdout.trim().split("\n").join("\n      "));
  } else {
    console.warn("      stack-detector did not return a report — continuing with generic stack");
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Scaffold (bootstrap.sh or inline)
// ---------------------------------------------------------------------------

console.log("\n[2/6] Scaffolding directory structure and templates...");

if (dryRun) {
  console.log("      [dry-run] would create: agents/ memory/ bin/ logs/ tests/ docs/setup/");
  console.log("      [dry-run] would copy: CLAUDE.md AGENTS.md MEMORY.md MEMORY_MAP.md");
  console.log("      [dry-run] would install: agents/*.prompt bin/meta-controller tools/validator.py");
} else if (bootstrapSh) {
  const r = spawnSync("bash", [bootstrapSh], {
    encoding: "utf8",
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, PATH: process.env.PATH },
  });
  if (r.status !== 0) {
    console.error("ERROR: bootstrap.sh failed");
    process.exit(1);
  }
} else {
  // Inline minimal scaffold when bootstrap.sh not found (npm-only install)
  console.log("      bootstrap.sh not found — running inline scaffold...");
  _inlineScaffold(projectRoot, projectName);
}

// ---------------------------------------------------------------------------
// Step 3 — framework-auditor
// ---------------------------------------------------------------------------

console.log("\n[3/6] framework-auditor — mapping files and functions...");

if (dryRun) {
  console.log("      [dry-run] would run: claude -p --dangerously-skip-permissions <framework-auditor prompt>");
} else {
  const auditorPrompt = `You are @framework-auditor for the project at ${projectRoot}.
Read agents/framework-auditor.prompt for full instructions.
Run the 6-step audit procedure.
Write results directly to memory/MEMORY_MAP.md — replace the {{DOMAIN_SECTIONS}} placeholder with real data.
No prose output. Just write the files.`;

  console.log("      Running framework-auditor (this may take 30-60s)...");
  const r = spawnSync(
    "claude",
    ["--dangerously-skip-permissions", auditorPrompt],
    { encoding: "utf8", cwd: projectRoot, stdio: "inherit", timeout: 120000 }
  );
  if (r.status !== 0) {
    console.warn("      framework-auditor exited non-zero — MEMORY_MAP.md may be incomplete");
  }
}

// ---------------------------------------------------------------------------
// Step 4 — memory-bootstrapper (interactive)
// ---------------------------------------------------------------------------

console.log("\n[4/6] memory-bootstrapper — filling MEMORY.md interactively...");
console.log("      (8 questions max — answer in Claude Code after install)");

if (dryRun) {
  console.log("      [dry-run] would run: claude --dangerously-skip-permissions <memory-bootstrapper prompt>");
} else {
  const bootstrapperPrompt = `You are @memory-bootstrapper for the project at ${projectRoot}.
Read agents/memory-bootstrapper.prompt for full instructions.
Ask the user the 8 questions interactively.
Write the completed MEMORY.md when done.`;

  // memory-bootstrapper is interactive — run attached to stdio
  const r = spawnSync(
    "claude",
    ["--dangerously-skip-permissions", bootstrapperPrompt],
    { encoding: "utf8", cwd: projectRoot, stdio: "inherit", timeout: 300000 }
  );
  if (r.status !== 0) {
    console.warn("      memory-bootstrapper exited non-zero — MEMORY.md may need manual completion");
  }
}

// ---------------------------------------------------------------------------
// Step 5 — god-node-hunter
// ---------------------------------------------------------------------------

console.log("\n[5/6] god-node-hunter — identifying god nodes...");

if (dryRun) {
  console.log("      [dry-run] would run: graphify update . && claude -p <god-node-hunter prompt>");
} else {
  if (hasGraphify) {
    console.log("      Running graphify update ...");
    spawnSync("graphify", ["update", "."], {
      encoding: "utf8",
      cwd: projectRoot,
      stdio: "inherit",
    });
  }

  const hunterPrompt = `You are @god-node-hunter for the project at ${projectRoot}.
Read agents/god-node-hunter.prompt for full instructions.
${hasGraphify ? "graphify has been run — read graphify-out/GRAPH_REPORT.md for node data." : "graphify is not installed — use grep-based detection (Step 2 of the detection procedure)."}
Write god node table to AGENTS.md.
Add ★ markers to memory/MEMORY_MAP.md.
Add audit gates to agents/dispatcher.prompt.
No prose. Write the files.`;

  console.log("      Running god-node-hunter...");
  const r = spawnSync(
    "claude",
    ["--dangerously-skip-permissions", hunterPrompt],
    { encoding: "utf8", cwd: projectRoot, stdio: "inherit", timeout: 120000 }
  );
  if (r.status !== 0) {
    console.warn("      god-node-hunter exited non-zero — AGENTS.md god nodes table may be incomplete");
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Summary
// ---------------------------------------------------------------------------

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography installed in: ${projectRoot}
${dryRun ? "\n  DRY RUN complete — no files were written.\n" : ""}
  Next steps:

  1. Review the generated files:
       CLAUDE.md        ← session start protocol (edit if needed)
       AGENTS.md        ← routing table + god nodes (verify)
       memory/MEMORY.md ← project status (complete if TBD values remain)
       memory/MEMORY_MAP.md ← file ownership (review ★ markers)

  2. Add domain-specific agents:
       cp agents/domain-agent.prompt.example agents/your-agent.prompt
       Add a row to the routing table in AGENTS.md

  3. Run smoke tests:
       python3 -m pytest tests/smoke_test.py -v

  4. Commit the agent system:
       git add agents/ memory/ CLAUDE.md AGENTS.md bin/ tools/
       git commit -m 'feat: install holography framework'

  5. Open the project in Claude Code:
       The session-start protocol in CLAUDE.md activates immediately.

  Docs: https://github.com/SalDevX/holography
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// ---------------------------------------------------------------------------
// Inline scaffold fallback (when bootstrap.sh not bundled)
// ---------------------------------------------------------------------------

function _inlineScaffold(root, name) {
  const date = new Date().toISOString().slice(0, 10);
  const dirs = [
    "agents", "memory", "bin", "logs", "tests", "tools", "docs/setup",
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  console.log("      Created: " + dirs.join("  "));

  const bundlePath = path.join(__dirname, "templates.json");
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

  const files = [
    { key: "CLAUDE.md",    local: "CLAUDE.md",           section: "templates" },
    { key: "AGENTS.md",    local: "AGENTS.md",           section: "templates" },
    { key: "MEMORY.md",    local: "memory/MEMORY.md",    section: "templates" },
    { key: "MEMORY_MAP.md",local: "memory/MEMORY_MAP.md",section: "templates" },
    { key: "validator.py", local: "tools/validator.py",  section: "tools" },
    { key: "meta_controller.py", local: "tools/meta_controller.py", section: "tools" },
  ];

  const agentTemplates = [
    "dispatcher", "validator", "meta-controller", "memory-keeper",
    "framework-auditor", "memory-bootstrapper", "stack-detector", "god-node-hunter",
  ];
  for (const a of agentTemplates) {
    files.push({ key: `agents/${a}.prompt`, local: `agents/${a}.prompt`, section: "templates" });
  }

  let written = 0;
  for (const f of files) {
    const dst = path.join(root, f.local);
    if (fs.existsSync(dst)) continue;
    const content = bundle[f.section][f.key];
    if (!content) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const substituted = content
      .replace(/\{\{PROJECT_NAME\}\}/g, name)
      .replace(/\{\{DATE\}\}/g, date);
    fs.writeFileSync(dst, substituted);
    written++;
  }
  console.log(`      Wrote ${written}/${files.length} template files from local bundle`);
}
