#!/usr/bin/env node
/**
 * holography install.js — pre-publish bundler
 *
 * Run this from tools/agent-framework/ before `npm publish`:
 *   node install.js
 *
 * What it does:
 *   1. Copies tools/bootstrap.sh → npm/bootstrap.sh   (so npx holography works offline)
 *   2. Bundles all templates into npm/templates.json   (embedded fallback for cli.js)
 *   3. Validates the npm/ directory is publish-ready
 *   4. Prints a publish checklist
 *
 * After running this, publish with:
 *   cd npm && npm publish --access public
 */

"use strict";

const fs = require("fs");
const path = require("path");

const FRAMEWORK_DIR = __dirname;
const NPM_DIR = path.join(FRAMEWORK_DIR, "npm");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg)  { console.log(`[holography] ${msg}`); }
function warn(msg) { console.warn(`[holography] WARN: ${msg}`); }
function err(msg)  { console.error(`[holography] ERROR: ${msg}`); process.exit(1); }

function readFileOr(p, fallback = "") {
  try { return fs.readFileSync(p, "utf8"); }
  catch { return fallback; }
}

function collectDir(dir, base = dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel  = path.relative(base, full);
    if (entry.isDirectory()) {
      Object.assign(result, collectDir(full, base));
    } else {
      result[rel] = fs.readFileSync(full, "utf8");
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 1 — Copy bootstrap.sh into npm/
// ---------------------------------------------------------------------------

log("Step 1/3 — Copying bootstrap.sh into npm/...");

const bootstrapSrc = path.join(FRAMEWORK_DIR, "tools", "bootstrap.sh");
const bootstrapDst = path.join(NPM_DIR, "bootstrap.sh");

if (!fs.existsSync(bootstrapSrc)) {
  warn("tools/bootstrap.sh not found — npm/bootstrap.sh will not be bundled");
  warn("cli.js will fall back to fetching templates from GitHub at install time");
} else {
  fs.copyFileSync(bootstrapSrc, bootstrapDst);
  // Ensure executable bit preserved
  try {
    fs.chmodSync(bootstrapDst, 0o755);
  } catch {
    // Windows — ignore
  }
  log(`  Copied → npm/bootstrap.sh`);
}

// ---------------------------------------------------------------------------
// Step 2 — Bundle templates into npm/templates.json
// ---------------------------------------------------------------------------

log("Step 2/3 — Bundling templates into npm/templates.json...");

const templatesDir = path.join(FRAMEWORK_DIR, "templates");
const toolsDir     = path.join(FRAMEWORK_DIR, "tools");

const bundle = {
  _generated: new Date().toISOString(),
  _source: "tools/agent-framework",
  templates: {},
  tools: {},
};

// Collect templates/
bundle.templates = collectDir(templatesDir, templatesDir);
log(`  Bundled ${Object.keys(bundle.templates).length} template files`);

// Collect tools/ (validator.py, meta_controller.py — not bootstrap.sh)
const toolFiles = ["validator.py", "meta_controller.py"];
for (const f of toolFiles) {
  const p = path.join(toolsDir, f);
  if (fs.existsSync(p)) {
    bundle.tools[f] = fs.readFileSync(p, "utf8");
    log(`  Bundled tools/${f}`);
  } else {
    warn(`tools/${f} not found — skipping`);
  }
}

const bundlePath = path.join(NPM_DIR, "templates.json");
fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
log(`  Written → npm/templates.json (${Math.round(fs.statSync(bundlePath).size / 1024)}KB)`);

// ---------------------------------------------------------------------------
// Update cli.js to use bundled templates when available
// Inject a bundled-templates code path into _inlineScaffold
// ---------------------------------------------------------------------------

const cliPath = path.join(NPM_DIR, "cli.js");
const cliContent = readFileOr(cliPath);

if (!cliContent.includes("templates.json")) {
  // Patch the _inlineScaffold function to prefer bundled templates
  const patch = `
// ---------------------------------------------------------------------------
// Bundled template loader (injected by install.js at publish time)
// ---------------------------------------------------------------------------

function _loadBundledTemplates() {
  const bundlePath = path.join(__dirname, "templates.json");
  if (!fs.existsSync(bundlePath)) return null;
  try { return JSON.parse(fs.readFileSync(bundlePath, "utf8")); }
  catch { return null; }
}
`;

  // Insert after the requires block (after last require statement)
  const insertAfter = `const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");`;

  if (cliContent.includes(insertAfter)) {
    const patched = cliContent.replace(insertAfter, insertAfter + "\n" + patch);
    fs.writeFileSync(cliPath, patched);
    log("  Patched cli.js with bundled template loader");
  } else {
    warn("cli.js require block not found — skipping patch (cli.js already patched or structure changed)");
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Validate npm/ directory
// ---------------------------------------------------------------------------

log("Step 3/3 — Validating npm/ publish readiness...");

const required = [
  "package.json",
  "cli.js",
  "README.md",
];

let valid = true;
for (const f of required) {
  const p = path.join(NPM_DIR, f);
  if (fs.existsSync(p)) {
    log(`  ✓ npm/${f}`);
  } else {
    warn(`  ✗ npm/${f} — MISSING`);
    valid = false;
  }
}

const optional = ["bootstrap.sh", "templates.json"];
for (const f of optional) {
  const p = path.join(NPM_DIR, f);
  if (fs.existsSync(p)) {
    log(`  ✓ npm/${f} (optional, bundled)`);
  } else {
    log(`  — npm/${f} (optional, not bundled — will fetch from GitHub at install time)`);
  }
}

// Validate package.json
const pkg = JSON.parse(readFileOr(path.join(NPM_DIR, "package.json"), "{}"));
const missing = [];
if (!pkg.name)    missing.push("name");
if (!pkg.version) missing.push("version");
if (!pkg.bin)     missing.push("bin");
if (!pkg.license) missing.push("license");

if (missing.length) {
  warn(`package.json missing fields: ${missing.join(", ")}`);
  valid = false;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  holography pre-publish bundle ${valid ? "READY" : "INCOMPLETE"}

  Publish checklist:
  ${valid ? "✓" : "✗"} npm/package.json  — ${pkg.name || "??"}@${pkg.version || "??"}
  ${fs.existsSync(path.join(NPM_DIR, "bootstrap.sh"))  ? "✓" : "—"} npm/bootstrap.sh   — offline scaffold
  ${fs.existsSync(path.join(NPM_DIR, "templates.json")) ? "✓" : "—"} npm/templates.json — bundled templates

  To publish:
    cd npm
    npm login           ← SalDevX account
    npm publish --access public

  To test before publishing:
    cd npm
    npm pack            ← creates holography-x.x.x.tgz
    npx ./holography-x.x.x.tgz init --dry-run

  To tag release:
    git tag v${pkg.version || "1.0.0"} && git push --tags
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

if (!valid) process.exit(1);
