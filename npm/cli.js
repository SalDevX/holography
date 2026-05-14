#!/usr/bin/env node
/**
 * holography CLI — npx holography init
 *
 * Installs a project-aware Claude Code agent framework.
 * Reads graphify-out/graph.json to dynamically shape agents,
 * routing tables, god node lists, and MEMORY_MAP.md.
 *
 * Commands:
 *   npx holography init            — scaffold the framework
 *   npx holography init --dry-run  — preview, no writes
 *   npx holography clean           — remove everything holography installed
 *   npx holography uninstall       — alias for clean
 *   npx holography --help
 *   npx holography --version
 */
"use strict";

const { execSync, spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Bundled template loader
// ---------------------------------------------------------------------------
function _loadBundledTemplates() {
  const p = path.join(__dirname, "templates.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

// ---------------------------------------------------------------------------
// Version + help
// ---------------------------------------------------------------------------
const PKG = require("./package.json");

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(PKG.version); process.exit(0);
}
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
holography v${PKG.version} — Claude Code agent framework installer

Usage:
  npx holography init            Scaffold a project-aware agent framework
  npx holography init --dry-run  Preview without writing anything
  npx holography clean           Remove everything holography installed
  npx holography --help          Show this message
  npx holography --version       Show version

What 'npx holography init' does:
  1. Ensure git repo exists (git init if missing)
  2. Run graphify to build code graph → source of truth for all agents
  3. Parse graph.json: files, functions, god nodes, communities
  4. Write project-aware framework — agents, routing tables, MEMORY_MAP.md,
     .claude/settings.json all injected with real data from the graph

After install, open Claude Code — it reads CLAUDE.md immediately and
routes through the agent system. No manual config required.

Requirements:
  - Run from a project root (any language)
  - graphify strongly recommended: uv tool install graphifyy
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------
const command = process.argv[2];

function _syncConfirm(prompt) {
  process.stdout.write(prompt);
  const buf = Buffer.alloc(8);
  const n = fs.readSync(0, buf, 0, 8, null);
  return buf.slice(0, n).toString().trim().toLowerCase() === "y";
}

if (command === "clean" || command === "uninstall") {
  const root = process.cwd();
  console.log(`\n  Project: ${root}\n`);
  if (!_syncConfirm("Remove holography from this project? (y/n) ")) {
    console.log("Cancelled."); process.exit(0);
  }
  _runClean(root);
  process.exit(0);
}

if (command !== "init") {
  console.error(`holography: unknown command '${command || ""}'`);
  console.error("Run: npx holography --help");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Init — preflight
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
  return spawnSync("which", [name], { encoding: "utf8" }).status === 0;
}

// ---------------------------------------------------------------------------
// Step 1 — git check
// ---------------------------------------------------------------------------
console.log("[1/5] git — checking repository...");
if (dryRun) {
  console.log("      [dry-run] would check/init git repo");
} else {
  _ensureGit(projectRoot);
}

// ---------------------------------------------------------------------------
// Step 2 — graphify (analysis pass — runs BEFORE holography files exist)
// ---------------------------------------------------------------------------
console.log("\n[2/5] graphify — building code graph...");
let graph = null;
if (dryRun) {
  console.log("      [dry-run] would run: graphify update .");
  console.log("      [dry-run] would parse: graphify-out/graph.json");
} else {
  const hasGraphify = checkBin("graphify");
  if (!hasGraphify) {
    console.warn("      WARN: graphify not found — install: uv tool install graphifyy");
    console.warn("      Agents will use static fallback — no dynamic god-node injection.");
  } else {
    _runGraphify(projectRoot);
  }
  graph = _parseGraph(projectRoot);
  if (graph) {
    const { nodeCount, edgeCount, communityCount } = graph.stats;
    console.log(`      ${nodeCount} nodes · ${edgeCount} edges · ${communityCount} communities`);
    if (graph.godNodes.length) {
      console.log(`      God nodes: ${graph.godNodes.slice(0, 5).map(g => g.name).join(", ")}`);
    }
    console.log(`      ${graph.allFiles.length} source files across ${graph.communities.length} communities`);
  } else {
    console.log("      graphify-out/graph.json not found — using static fallback");
  }
}

// ---------------------------------------------------------------------------
// Step 3 — stack-detector
// ---------------------------------------------------------------------------
console.log("\n[3/5] stack-detector — detecting tech stack...");
let stack;
if (dryRun) {
  console.log("      [dry-run] would detect language, frameworks, entry points");
  stack = { language: "unknown", frameworks: "none", stackType: "generic", testCommand: "none", entryPoints: "none" };
} else {
  stack = _detectStack(projectRoot, graph ? graph.allFiles : null);
  console.log(`      language: ${stack.language} · frameworks: ${stack.frameworks}`);
  console.log(`      type: ${stack.stackType} · entry points: ${stack.entryPoints}`);

  const stackIsPython = stack.language === "python" || stack.language === "polyglot";
  if (stackIsPython) {
    const venvExists = fs.existsSync(path.join(projectRoot, ".venv"))
      || fs.existsSync(path.join(projectRoot, "venv"));
    if (!venvExists) {
      const hasReqs = fs.existsSync(path.join(projectRoot, "requirements.txt"));
      console.warn("\n  ⚠️  No Python venv found.");
      console.warn("     Create one before running agents:");
      console.warn("     python3 -m venv .venv && source .venv/bin/activate");
      console.warn(`     ${hasReqs ? "pip install -r requirements.txt" : "pip install pytest"}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 4 — scaffold
// ---------------------------------------------------------------------------
console.log("\n[4/5] scaffold — writing project-aware framework...");
if (dryRun) {
  console.log("      [dry-run] would create: agents/ memory/ bin/ logs/ tests/ docs/setup/ .claude/");
  console.log("      [dry-run] would write: CLAUDE.md AGENTS.md agents/*.prompt");
  console.log("      [dry-run] would write: memory/MEMORY.md memory/MEMORY_MAP.md (real files + functions)");
  console.log("      [dry-run] would write: tools/validator.py tools/meta_controller.py");
  console.log("      [dry-run] would write: .claude/settings.json (real god nodes injected)");
  console.log("      [dry-run] would write: .claude/commands/ (4 slash commands: /memory-bootstrapper /god-node-hunter /framework-auditor /memory-keeper)");
  console.log("      [dry-run] would install: bin/meta-controller .git/hooks/post-commit");
} else {
  // Directories
  for (const d of ["agents", "memory", "bin", "logs", "tests", "tools", "docs/setup"]) {
    fs.mkdirSync(path.join(projectRoot, d), { recursive: true });
  }

  // bootstrap.sh — dirs, bin/meta-controller, post-commit hook, graphify re-run
  const bootstrapSh = _findBootstrapSh();
  if (bootstrapSh) {
    const r = spawnSync("bash", [bootstrapSh], {
      encoding: "utf8", cwd: projectRoot, stdio: "inherit",
      env: { ...process.env },
    });
    if (r.status !== 0) console.warn("      WARN: bootstrap.sh exited non-zero");
  }

  // Write all framework files with dynamic data from graph
  const bundle = _loadBundledTemplates();
  if (!bundle) { console.error("ERROR: templates.json not found"); process.exit(1); }
  _writeFramework(projectRoot, projectName, stack, graph, bundle);

  // .claude/settings.json — god-node-aware hooks
  const godNodes = graph ? graph.godNodes : [];
  _generateClaudeSettings(projectRoot, godNodes);
  const gnNames = godNodes.length
    ? godNodes.slice(0, 5).map(g => g.name).join(", ")
    : "(none — run /god-node-hunter in Claude Code)";
  console.log(`      .claude/settings.json — god nodes: ${gnNames}`);

  // .claude/commands/ — slash command shortcuts for Claude Code
  _writeClaudeCommands(projectRoot);
  console.log(`      .claude/commands/ — /memory-bootstrapper /god-node-hunter /framework-auditor /memory-keeper`);
}

// ---------------------------------------------------------------------------
// Step 5 — summary
// ---------------------------------------------------------------------------
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography v${PKG.version} installed in: ${projectRoot}
${dryRun ? "\n  DRY RUN complete — no files were written.\n" : ""}
  ✅ stack-detector    — done (graph-driven)
  ✅ framework-auditor — done (graph-driven)
  ✅ god-node-hunter   — done (graph-driven)
  ⏳ memory-bootstrapper — one manual step remaining

  Open Claude Code in this project and run:
    "Run the memory-bootstrapper agent"
  (~2 min · 5 questions · fills MEMORY.md with human context)

  Then commit:
    git add agents/ memory/ CLAUDE.md AGENTS.md bin/ tools/ .claude/
    git commit -m 'feat: install holography framework'

  Docs: https://github.com/SalDevX/holography
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

// ---------------------------------------------------------------------------
// Git — ensure repo exists
// ---------------------------------------------------------------------------
function _ensureGit(root) {
  if (fs.existsSync(path.join(root, ".git"))) {
    console.log("      .git found — OK");
    return;
  }
  console.log("      .git not found — running: git init");
  try {
    execSync("git init", { cwd: root, encoding: "utf8", stdio: "pipe" });
    execSync('git commit --allow-empty -m "chore: init"', { cwd: root, encoding: "utf8", stdio: "pipe" });
    console.log("      git init + empty commit — done");
  } catch (e) {
    console.warn(`      WARN: git init failed — ${e.message.split("\n")[0]}`);
  }
}

// ---------------------------------------------------------------------------
// Graphify — analysis pass
// ---------------------------------------------------------------------------
function _runGraphify(root) {
  try {
    execSync("graphify update .", { cwd: root, encoding: "utf8", stdio: "pipe" });
    console.log("      graphify update . — done");
    return true;
  } catch (e) {
    console.warn(`      WARN: graphify update . failed — ${e.message.split("\n")[0]}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// graph.json parser — source of truth for all dynamic data
// ---------------------------------------------------------------------------
function _parseGraph(root) {
  const graphPath  = path.join(root, "graphify-out", "graph.json");
  const reportPath = path.join(root, "graphify-out", "GRAPH_REPORT.md");
  if (!fs.existsSync(graphPath)) return null;

  let g;
  try { g = JSON.parse(fs.readFileSync(graphPath, "utf8")); }
  catch { return null; }

  const nodes    = g.nodes || [];
  const rawEdges = g.edges || g.links || [];

  // Edge count per node id (undirected — count both ends)
  const edgeCounts = {};
  for (const e of rawEdges) {
    const s = typeof e.source === "string" ? e.source : (e.source && e.source.id) || "";
    const t = typeof e.target === "string" ? e.target : (e.target && e.target.id) || "";
    if (s) edgeCounts[s] = (edgeCounts[s] || 0) + 1;
    if (t) edgeCounts[t] = (edgeCounts[t] || 0) + 1;
  }

  // fileMap: source_file → [function labels]
  // Each node is a single symbol (file-level node or function node)
  // Function nodes have labels ending with "()"
  const fileMap = {};
  for (const n of nodes) {
    if (!n.source_file) continue;
    if (!fileMap[n.source_file]) fileMap[n.source_file] = [];
    if (n.label && n.label.includes("(")) fileMap[n.source_file].push(n.label);
  }

  // God nodes — parse GRAPH_REPORT.md (graphify already ranked these)
  const godNodes = [];
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, "utf8");
    const section = report.match(/## God Nodes[^\n]*\n([\s\S]*?)(?=\n##|$)/);
    if (section) {
      for (const m of section[1].matchAll(/^\d+\.\s+`([^`]+)`\s*-\s*(\d+)\s*edge/gm)) {
        if (godNodes.length >= 8) break;
        const name  = m[1];
        const edges = parseInt(m[2], 10);
        const node  = nodes.find(n => n.label === name || n.norm_label === name.toLowerCase());
        godNodes.push({ name, file: node ? node.source_file || "" : "", edges });
      }
    }
  }
  // Fallback: compute from edge counts if GRAPH_REPORT.md didn't parse
  if (!godNodes.length) {
    nodes
      .filter(n => n.label && n.label.includes("(") && n.source_file)
      .sort((a, b) => (edgeCounts[b.id] || 0) - (edgeCounts[a.id] || 0))
      .slice(0, 8)
      .forEach(n => godNodes.push({ name: n.label, file: n.source_file, edges: edgeCounts[n.id] || 0 }));
  }

  // Community groupings: communityId → Set of source_files
  const commFiles = {};
  for (const n of nodes) {
    if (n.source_file == null || n.community == null) continue;
    if (!commFiles[n.community]) commFiles[n.community] = new Set();
    commFiles[n.community].add(n.source_file);
  }
  const communities = Object.entries(commFiles)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, files]) => ({ id: Number(id), files: [...files].sort() }));

  // All unique source files from the graph
  const allFiles = [...new Set(nodes.map(n => n.source_file).filter(Boolean))].sort();

  // Stats (prefer GRAPH_REPORT.md's own numbers)
  let stats = { nodeCount: nodes.length, edgeCount: rawEdges.length, communityCount: communities.length };
  if (fs.existsSync(reportPath)) {
    const rep = fs.readFileSync(reportPath, "utf8");
    const sm  = rep.match(/## Summary\s*\n- (\d+) nodes[^\d]+(\d+) edges[^\d]+(\d+) communit/);
    if (sm) stats = { nodeCount: +sm[1], edgeCount: +sm[2], communityCount: +sm[3] };
  }

  return { fileMap, godNodes, allFiles, communities, stats };
}

// ---------------------------------------------------------------------------
// bootstrap.sh locator
// ---------------------------------------------------------------------------
function _findBootstrapSh() {
  const local = path.join(__dirname, "bootstrap.sh");
  if (fs.existsSync(local)) return local;
  const dev = path.join(__dirname, "..", "tools", "bootstrap.sh");
  if (fs.existsSync(dev)) return dev;
  return null;
}

// ---------------------------------------------------------------------------
// Stack detector — uses graph.allFiles when available, find otherwise
// ---------------------------------------------------------------------------
function _detectStack(root, knownFiles) {
  let allFiles = knownFiles;
  if (!allFiles) {
    try {
      const out = execSync(
        "find . -maxdepth 4 -type f" +
        " -not -path '*/.git/*' -not -path '*/node_modules/*'" +
        " -not -path '*/__pycache__/*' -not -path '*/graphify-out/*' | sort",
        { encoding: "utf8", cwd: root }
      );
      allFiles = out.trim().split("\n").filter(Boolean).map(f => f.replace(/^\.\//, ""));
    } catch { allFiles = []; }
  }

  const hasFile = (pat) => allFiles.some(f => pat instanceof RegExp ? pat.test(f) : f === pat || f.endsWith(`/${pat}`));
  const findAll = (pat) => allFiles.filter(f => pat instanceof RegExp ? pat.test(f) : path.basename(f) === pat);
  function readFirst(name) {
    const hit = allFiles.find(f => f === name || f.endsWith(`/${name}`));
    if (!hit) return "";
    try { return fs.readFileSync(path.join(root, hit), "utf8"); } catch { return ""; }
  }

  const pkgFiles = findAll("package.json").filter(f => !f.includes("node_modules"));
  let rootPkg = null;
  const allDeps = {};
  for (const pf of pkgFiles) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(root, pf), "utf8"));
      if (pf === "package.json") rootPkg = p;
      Object.assign(allDeps, p.dependencies || {}, p.devDependencies || {});
    } catch {}
  }

  const jsxFiles = findAll(/\.jsx$/);
  const tsxFiles = findAll(/\.tsx$/);
  const pyFiles  = findAll(/\.py$/);
  const hasBabel = hasFile(/babel\.config\./);
  const hasTs    = hasFile(/\.tsx?$/) || hasFile("tsconfig.json");

  let language = "other";
  const frameworks = [];
  let stackType = "generic";
  let testCommand = "";
  const entryPoints = [];

  if (pkgFiles.length) language = hasTs ? "typescript" : "javascript";
  if (pyFiles.length)  language = pkgFiles.length ? "polyglot" : "python";
  if (hasFile("go.mod"))     language = language === "other" ? "go"   : language;
  if (hasFile("Cargo.toml")) language = language === "other" ? "rust" : language;
  if (hasFile("Gemfile"))    language = language === "other" ? "ruby" : language;

  if (jsxFiles.length || tsxFiles.length || allDeps["react"]) { frameworks.push("react"); stackType = "react"; }
  if (allDeps["next"])    { frameworks.push("next");    stackType = "react-nextjs"; }
  if (hasBabel)             frameworks.push("babel");
  if (allDeps["express"]) { frameworks.push("express"); if (stackType === "generic") stackType = "node-api"; }
  if (allDeps["fastify"]) { frameworks.push("fastify"); if (stackType === "generic") stackType = "node-api"; }
  if (allDeps["vue"])     { frameworks.push("vue");     stackType = "vue"; }

  if (pyFiles.length) {
    const pyDeps = readFirst("requirements.txt") + readFirst("pyproject.toml");
    if (/fastapi/i.test(pyDeps))          { frameworks.push("fastapi"); if (stackType === "generic") stackType = "python-api"; }
    if (/\bflask\b/i.test(pyDeps))        { frameworks.push("flask");   if (stackType === "generic") stackType = "python-api"; }
    if (/django/i.test(pyDeps))           { frameworks.push("django");  if (stackType === "generic") stackType = "python-api"; }
    if (/torch|tensorflow/i.test(pyDeps)) { frameworks.push("ml");      if (stackType === "generic") stackType = "ml-pipeline"; }
    if (/ffmpeg/i.test(pyDeps))           { frameworks.push("ffmpeg");  if (stackType === "generic") stackType = "media-pipeline"; }
    if (language === "polyglot") stackType = "polyglot";
  }

  if (rootPkg?.scripts?.test)    testCommand = rootPkg.scripts.test;
  else if (pyFiles.length)       testCommand = "python3 -m pytest tests/ -v";
  else if (hasFile("go.mod"))    testCommand = "go test ./...";
  else if (hasFile("Cargo.toml"))testCommand = "cargo test";
  else if (hasFile("Gemfile"))   testCommand = "bundle exec rspec";

  const epCandidates = [
    "index.html", "index.jsx", "index.tsx", "index.js",
    "app.jsx", "app.tsx", "App.jsx", "App.tsx",
    "main.py", "app.py", "src/main.py", "src/app.py",
  ];
  for (const ep of epCandidates) {
    const hit = allFiles.find(f => f === ep || f.endsWith(`/${ep}`));
    if (hit && !entryPoints.includes(hit)) entryPoints.push(hit);
  }
  for (const f of pyFiles.slice(0, 20)) {
    try {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      if (/if __name__\s*==\s*['"]__main__['"]/.test(src) && !entryPoints.includes(f))
        entryPoints.push(f);
    } catch {}
  }
  if (!entryPoints.some(e => /\.(jsx|tsx)$/.test(e))) {
    const shallow = [...jsxFiles, ...tsxFiles].filter(f => f.split("/").length <= 3);
    entryPoints.push(...shallow.slice(0, 3));
  }

  return {
    language,
    frameworks: frameworks.join(", ") || "none",
    stackType,
    testCommand: testCommand || "none",
    entryPoints: [...new Set(entryPoints)].slice(0, 5).join(", ") || "none",
  };
}

// ---------------------------------------------------------------------------
// Framework writer — all template files with dynamic data injected
// ---------------------------------------------------------------------------
function _writeFramework(root, name, stack, graph, bundle) {
  const date = new Date().toISOString().slice(0, 10);
  const ctx  = _buildContext(name, date, stack, graph, root, bundle);

  const tpls  = bundle.templates || {};
  const tools = bundle.tools || {};

  const files = [
    [tpls["CLAUDE.md"],                         "CLAUDE.md"],
    [tpls["AGENTS.md"],                         "AGENTS.md"],
    [tpls["MEMORY.md"],                         "memory/MEMORY.md"],
    [tpls["MEMORY_MAP.md"],                     "memory/MEMORY_MAP.md"],
    [tools["validator.py"],                     "tools/validator.py"],
    [tools["meta_controller.py"],               "tools/meta_controller.py"],
    [tpls["agents/dispatcher.prompt"],          "agents/dispatcher.prompt"],
    [tpls["agents/validator.prompt"],           "agents/validator.prompt"],
    [tpls["agents/meta-controller.prompt"],     "agents/meta-controller.prompt"],
    [tpls["agents/memory-keeper.prompt"],       "agents/memory-keeper.prompt"],
    [tpls["agents/framework-auditor.prompt"],   "agents/framework-auditor.prompt"],
    [tpls["agents/memory-bootstrapper.prompt"], "agents/memory-bootstrapper.prompt"],
    [tpls["agents/stack-detector.prompt"],      "agents/stack-detector.prompt"],
    [tpls["agents/god-node-hunter.prompt"],     "agents/god-node-hunter.prompt"],
    [tpls["agents/domain-agent.prompt.example"],"agents/domain-agent.prompt.example"],
  ];

  let written = 0;
  for (const [src, dst] of files) {
    if (!src) continue;
    const dest = path.join(root, dst);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, _applyContext(src, ctx));
    written++;
  }
  console.log(`      Wrote ${written}/${files.filter(([s]) => s).length} framework files`);
}

// ---------------------------------------------------------------------------
// Context builder — all substitutions, derived from graph + stack
// ---------------------------------------------------------------------------
function _buildContext(name, date, stack, graph, root, bundle) {
  const godNodes    = graph ? graph.godNodes    : [];
  const fileMap     = graph ? graph.fileMap     : {};
  const communities = graph ? graph.communities : [];
  const stats       = graph ? graph.stats       : { nodeCount: 0, edgeCount: 0 };

  const topGod    = godNodes[0];
  const tools     = bundle ? (bundle.tools || {}) : {};

  return {
    "{{PROJECT_NAME}}":         name,
    "{{PROJECT_DESCRIPTION}}":  _desc(stack, graph),
    "{{DATE}}":                 date,
    "{{STACK}}":                `${stack.language} · ${stack.frameworks} (${stack.stackType})`,
    "{{STATUS}}":               "active",
    "{{PROJECT_PATH}}":         root,
    "{{ROUTING_TABLE_ROWS}}":   _routingRows(fileMap, communities),
    "{{ROUTING_TABLE}}":        _dispatcherTable(fileMap, communities),
    "{{HARD_RULES}}":           _hardRules(godNodes, stack),
    "{{NODE_COUNT}}":           String(stats.nodeCount),
    "{{EDGE_COUNT}}":           String(stats.edgeCount),
    "{{GOD_NODES_TABLE}}":      _godNodesTable(godNodes),
    "{{CRITICAL_PATHS}}":       _criticalPaths(godNodes),
    "{{DOMAIN_SECTIONS}}":      _domainSections(fileMap, godNodes, communities),
    "{{GOD_NODE_QUICK_REF}}":   _godNodeQuickRef(godNodes),
    "{{VALIDATOR_RULE_MAP}}":   _validatorRuleMap(stack),
    // Extracted from bundled tools at install time
    "{{VALIDATOR_RULES}}":      _extractValidatorRules(tools["validator.py"] || ""),
    "{{PATCH_STRATEGY_TABLES}}":_extractPatchStrategyTables(tools["meta_controller.py"] || ""),
    // god-node-hunter.prompt audit gate examples — filled with top god node
    "{{FN}}":                   topGod ? topGod.name : "(god node)",
    "{{FILE}}":                 topGod ? (topGod.file || "unknown") : "(file)",
    "{{OWNER}}":                "@domain-agent",
    // Dispatcher ROUTE block format examples
    "{{PRIMARY_AGENT}}":        "domain-agent",
    "{{FILE_LIST}}":            stack.entryPoints || "...",
    "{{NODE}}":                 topGod ? topGod.name : "(god node)",
    "{{N}}":                    topGod ? String(topGod.edges) : "0",
    "{{DOMAIN_A}}":             _domainLabel(communities, 0),
    "{{DOMAIN_B}}":             _domainLabel(communities, 1),
    // MEMORY.md — leave interactive placeholders as-is; fill in what we know
    "{{PROJECT_OWNER}}":        "{{PROJECT_OWNER}}",
    "{{LOCATION}}":             "{{LOCATION}}",
    "{{TIMEZONE}}":             "{{TIMEZONE}}",
    "{{ARCHITECTURE_DESCRIPTION}}": "<!-- fill in via /memory-bootstrapper -->",
    "{{ARCHITECTURE_TABLE}}":   "| (run /memory-bootstrapper in Claude Code) | | |",
    "{{DATA_FLOW_DIAGRAM}}":    "(run /memory-bootstrapper)",
    "{{DEPLOY_PIPELINE}}":      "(run /memory-bootstrapper)",
    "{{CASCADE_SYSTEMS}}":      "*(run /memory-bootstrapper)*",
    "{{KNOWN_ISSUES}}":         "*(none yet — add as discovered)*",
  };
}

function _applyContext(template, ctx) {
  let out = template;
  for (const [k, v] of Object.entries(ctx)) out = out.split(k).join(v);
  return out;
}

// Extract validator rules from bundled validator.py source → markdown table
function _extractValidatorRules(src) {
  if (!src) return "*(see tools/validator.py for rule definitions)*";

  // Parse rule functions: def _rule_NAME(diff...) -> ...: \n    """DOCSTRING"""
  const ruleFns = [];
  const fnRe = /def (_rule_\w+)\([^)]*\)[^:]*:\s*\n\s+"""([^"]+)"""/g;
  let m;
  while ((m = fnRe.exec(src)) !== null) ruleFns.push({ fn: m[1], doc: m[2].trim() });

  // Parse UNIVERSAL_RETRY: "Universal Rule N": "model"
  const retryMap = {};
  const retryRe = /"(Universal Rule \d+)":\s*"([^"]+)"/g;
  while ((m = retryRe.exec(src)) !== null) retryMap[m[1]] = m[2];

  if (!ruleFns.length) return "*(see tools/validator.py for rule definitions)*";

  const rows = ruleFns.map((r, i) => {
    const id    = `Universal Rule ${i + 1}`;
    const retry = retryMap[id] || "claude-sonnet-4-6";
    return `| ${id} | ${r.doc} | \`${retry}\` |`;
  });

  return [
    "| Rule | Description | Retry |",
    "|------|-------------|-------|",
    ...rows,
    "",
    "Project-specific rules: add `tools/validator_rules.py` (auto-loaded, overrides universal rules).",
  ].join("\n");
}

// Extract patch strategy tables from bundled meta_controller.py source → markdown table
function _extractPatchStrategyTables(src) {
  if (!src) return "*(see tools/meta_controller.py — _PATCHES dict)*";

  // Match each category block: "name": [ [], ["attempt2"], ["attempt3"], ]
  const rows = [];
  const catRe = /"(\w+)":\s*\[\s*\[\],\s*\["([^"]+)"\],\s*\["([^"]+)"\],?\s*\]/g;
  let m;
  while ((m = catRe.exec(src)) !== null) {
    rows.push(`| \`${m[1]}\` | ${m[2]} | ${m[3]} |`);
  }

  if (!rows.length) return "*(see tools/meta_controller.py — _PATCHES dict)*";

  return [
    "| Category | Attempt 2 patch | Attempt 3 patch |",
    "|----------|----------------|-----------------|",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Dynamic content builders
// ---------------------------------------------------------------------------

function _desc(stack, graph) {
  const parts = [];
  if (stack.language !== "other") parts.push(stack.language);
  if (stack.frameworks !== "none") parts.push(stack.frameworks);
  // Only add stackType if it adds information beyond what frameworks already captures
  const fwList = stack.frameworks.split(", ");
  if (stack.stackType !== "generic" && !fwList.includes(stack.stackType)) {
    parts.push(stack.stackType);
  }
  if (graph && graph.stats.nodeCount) parts.push(`${graph.stats.nodeCount} nodes`);
  return parts.join(" · ") || "software project";
}

function _domainLabel(communities, idx) {
  const c = communities[idx];
  if (!c || !c.files.length) return idx === 0 ? "frontend" : "backend";
  return c.files[0].split("/")[0] || `domain-${idx}`;
}

// AGENTS.md routing table rows
function _routingRows(fileMap, communities) {
  const dirGroups = _groupByDir(Object.keys(fileMap));
  if (!Object.keys(dirGroups).length) {
    return "| Edit source files | `agents/domain-agent.prompt.example` |";
  }
  return Object.entries(dirGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, files]) =>
      `| Edit \`${dir}/\` (${files.length} file${files.length !== 1 ? "s" : ""}) | \`agents/domain-agent.prompt.example\` |`
    )
    .join("\n");
}

// dispatcher.prompt routing table
function _dispatcherTable(fileMap, communities) {
  const dirGroups = _groupByDir(Object.keys(fileMap));
  if (!Object.keys(dirGroups).length) {
    return "| All source files | @domain-agent |";
  }
  return Object.entries(dirGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, files]) => {
      const exts = [...new Set(files.map(f => path.extname(f)).filter(Boolean))].slice(0, 3).join(", ");
      return `| \`${dir}/\` (${exts || "misc"}, ${files.length} files) | @domain-agent |`;
    })
    .join("\n");
}

// God nodes table for AGENTS.md
function _godNodesTable(godNodes) {
  if (!godNodes.length) {
    return "| (none yet) | — | — | — | Run /god-node-hunter in Claude Code |";
  }
  return godNodes.slice(0, 8)
    .map(g => `| \`${g.name}\` | ${g.edges} | \`${g.file || "unknown"}\` | — | |`)
    .join("\n");
}

// Hard rules — derived from god nodes + stack
function _hardRules(godNodes, stack) {
  const rules = [];
  if (godNodes.length) {
    const top3 = godNodes.slice(0, 3).map(g => `\`${g.name}\` (${g.file || "?"}, ${g.edges} edges)`).join(", ");
    rules.push(`- Never modify god nodes without declaring in task description: ${top3}`);
  }
  rules.push("- Run `graphify update .` after every code change (zero API cost — AST only)");
  if (stack.testCommand && stack.testCommand !== "none") {
    rules.push(`- All tests must pass before merging: \`${stack.testCommand}\``);
  }
  if (stack.language === "typescript") rules.push("- No `any` casts without an explanatory comment");
  if (stack.language === "python" || stack.language === "polyglot") {
    rules.push("- No bare `except:` — always catch specific exception types");
  }
  return rules.join("\n") || "- Run `graphify update .` after every code change";
}

// Critical paths summary for AGENTS.md
function _criticalPaths(godNodes) {
  if (!godNodes.length) return "*(Run /god-node-hunter to identify critical paths)*";
  const g = godNodes[0];
  return `### Critical Path\n\n\`${g.name}\` (${g.file || "?"}) has ${g.edges} edges — changes cascade across the graph.\nDeclare in task description before writing. Full cross-agent audit required.`;
}

// MEMORY_MAP.md domain sections — grouped by community, real functions from graph
function _domainSections(fileMap, godNodes, communities) {
  const godSet = new Set(godNodes.map(g => `${g.name}|${g.file}`));

  function tableRows(files) {
    return files.map(file => {
      const fns   = (fileMap[file] || []).slice(0, 6).map(f => `\`${f}\``).join(", ") || "—";
      const isGod = (fileMap[file] || []).some(fn => godSet.has(`${fn}|${file}`)) ? "YES" : "—";
      return `| \`${file}\` | ${fns} | ${isGod} | |`;
    }).join("\n");
  }

  if (communities.length) {
    return communities.map(({ id, files }) => {
      const dirs = files.map(f => f.includes("/") ? f.split("/")[0] : "(root)");
      const topDir = Object.entries(
        dirs.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {})
      ).sort(([,a],[,b]) => b - a)[0]?.[0] || "";
      return `## Community ${id} — ${topDir ? topDir + "/" : `Community ${id}`}\n\n| File | Key functions | God node? | Notes |\n|------|---------------|-----------|-------|\n${tableRows(files)}`;
    }).join("\n\n");
  }

  // Fallback: group by directory
  const dirGroups = _groupByDir(Object.keys(fileMap));
  return Object.entries(dirGroups).sort(([a],[b])=>a.localeCompare(b)).map(([dir, files]) =>
    `## ${dir}/\n\n| File | Key functions | God node? | Notes |\n|------|---------------|-----------|-------|\n${tableRows(files)}`
  ).join("\n\n") || "*(no source files detected — run /framework-auditor in Claude Code)*";
}

// God node quick reference for dispatcher.prompt
function _godNodeQuickRef(godNodes) {
  if (!godNodes.length) return "| (none yet — run /god-node-hunter) | — |";
  const byFile = {};
  for (const g of godNodes.slice(0, 8)) {
    if (!byFile[g.file]) byFile[g.file] = [];
    byFile[g.file].push(g.name);
  }
  return Object.entries(byFile)
    .map(([file, fns]) => `| \`${file}\` | ${fns.map(f => `\`${f}\``).join(", ")} |`)
    .join("\n");
}

// Validator rule map for dispatcher.prompt
function _validatorRuleMap(stack) {
  const rows = [
    "| rule-no-direct-data-edit | `data/`, `*.csv`, `*.json` (data files) |",
    "| rule-test-coverage       | `tests/`, `*.test.*`, `*.spec.*` |",
    "| rule-doc-sync            | `*.md`, `docs/` |",
  ];
  if (stack.language === "python" || stack.language === "polyglot") {
    rows.push("| rule-type-annotations    | `*.py` |");
  }
  if (stack.language === "typescript") {
    rows.push("| rule-no-any              | `*.ts`, `*.tsx` |");
  }
  return rows.join("\n");
}

// Group file paths by top-level directory
function _groupByDir(files) {
  const groups = {};
  for (const f of files) {
    const dir = f.includes("/") ? f.split("/")[0] : "(root)";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(f);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// .claude/settings.json — god-node-aware PreToolUse / PostToolUse hooks
// ---------------------------------------------------------------------------
function _generateClaudeSettings(root, godNodes) {
  const godNodeStr = godNodes.length
    ? godNodes.slice(0, 5).map(g => g.name).join(", ")
    : "(none yet — run /god-node-hunter in Claude Code)";

  const preMsg  = `graphify graph loaded. God nodes: ${godNodeStr}. Read GRAPH_REPORT.md only when tracing unknown cross-file dependencies.`;
  const postMsg = "Code modified. After this task: run graphify update ., update memory/MEMORY.md Recent Fixes, update MEMORY_MAP.md if new functions added.";

  const preCmd  = `[ -f graphify-out/graph.json ] && echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"${preMsg}"}}' || true`;
  const postCmd = `echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"${postMsg}"}}'`;

  const settings = {
    hooks: {
      PreToolUse: [
        { matcher: "Glob", hooks: [{ type: "command", command: preCmd }] },
        { matcher: "Grep", hooks: [{ type: "command", command: preCmd }] },
      ],
      PostToolUse: [
        { matcher: "Edit",      hooks: [{ type: "command", command: postCmd }] },
        { matcher: "Write",     hooks: [{ type: "command", command: postCmd }] },
        { matcher: "Create",    hooks: [{ type: "command", command: postCmd }] },
        { matcher: "MultiEdit", hooks: [{ type: "command", command: postCmd }] },
      ],
    },
  };

  fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(root, ".claude", "settings.json"), JSON.stringify(settings, null, 2));
}

// ---------------------------------------------------------------------------
// .claude/commands/ — slash command shortcuts for Claude Code
// ---------------------------------------------------------------------------
function _writeClaudeCommands(root) {
  const commandsDir = path.join(root, ".claude", "commands");
  fs.mkdirSync(commandsDir, { recursive: true });

  const commands = {
    "memory-bootstrapper.md": "Run the memory-bootstrapper agent from agents/memory-bootstrapper.prompt — fills MEMORY.md with human context (~2 min · 5 questions)",
    "god-node-hunter.md":     "Run the god-node-hunter agent from agents/god-node-hunter.prompt — identifies high-risk nodes from graphify-out/graph.json",
    "framework-auditor.md":   "Run the framework-auditor agent from agents/framework-auditor.prompt — maps all files and functions, updates MEMORY_MAP.md",
    "memory-keeper.md":       "Run the memory-keeper agent from agents/memory-keeper.prompt — syncs MEMORY.md and MEMORY_MAP.md after recent changes",
  };

  for (const [fname, body] of Object.entries(commands)) {
    const dest = path.join(commandsDir, fname);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, body);
  }
}

// ---------------------------------------------------------------------------
// Clean — remove everything holography wrote, leave project files alone
// ---------------------------------------------------------------------------
function _runClean(root) {
  const targets = [
    "agents", "memory", "bin", "logs", "docs/setup", "graphify-out",
    ".claude/settings.json", ".claude/commands",
    "CLAUDE.md", "AGENTS.md", "tools/validator.py", "tools/meta_controller.py",
  ];

  console.log("");
  let removed = 0;
  for (const t of targets) {
    const full = path.join(root, t);
    if (!fs.existsSync(full)) continue;
    try {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`  removed  ${t}`);
      removed++;
    } catch (e) {
      console.warn(`  WARN: could not remove ${t} — ${e.message}`);
    }
  }

  // Remove docs/ if now empty
  const docsDir = path.join(root, "docs");
  if (fs.existsSync(docsDir) && fs.readdirSync(docsDir).length === 0) {
    try { fs.rmdirSync(docsDir); console.log("  removed  docs/ (empty)"); } catch {}
  }

  // Remove .claude/ if now empty (may still contain user's own settings)
  const claudeDir = path.join(root, ".claude");
  if (fs.existsSync(claudeDir) && fs.readdirSync(claudeDir).length === 0) {
    try { fs.rmdirSync(claudeDir); console.log("  removed  .claude/ (empty)"); } catch {}
  }

  console.log(`\n  Done — removed ${removed} item${removed !== 1 ? "s" : ""}. Original project files untouched.`);
}
