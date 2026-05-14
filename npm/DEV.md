# holography — npm Package Maintenance

## Auth setup

Create or edit `~/.npmrc` and add your token:

```
//registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
```

Or set it inline for the session:

```bash
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
```

Verify you are logged in:

```bash
npm whoami
```

---

## Pre-publish checklist

Run from `~/dev/holography/`:

```bash
# 1. Bundle templates + bootstrap.sh into npm/
node install.js

# 2. Fix any auto-fixable package.json issues
npm pkg fix

# 3. Dry-run to see exactly what will be published
npm pack --dry-run

# 4. Inspect the tarball (optional)
npm pack
tar -tzf holography-*.tgz
rm holography-*.tgz
```

---

## Publish

```bash
cd ~/dev/holography/npm
npm publish --access public
```

Verify it landed:

```bash
npm info holography
npx holography --version
```

---

## Version bumping

```bash
# Patch: 1.0.0 → 1.0.1  (bug fix, no new features)
npm version patch

# Minor: 1.0.0 → 1.1.0  (new feature, backwards compatible)
npm version minor

# Major: 1.0.0 → 2.0.0  (breaking change)
npm version major
```

Each command updates `package.json`, commits the change, and creates a git tag.

Then push + publish:

```bash
git push && git push --tags
cd npm && npm publish --access public
```

---

## Testing before publish

Test the packed tarball locally in any temp project:

```bash
cd /tmp && mkdir test-holography && cd test-holography
git init
npx /path/to/holography/npm/holography-1.0.0.tgz init --dry-run
```

Or after publish, test the live package:

```bash
cd /tmp && mkdir test-holography && cd test-holography
git init
npx holography@latest init --dry-run
```

---

## Deprecating a version

```bash
npm deprecate holography@"1.0.0" "Use 1.0.1 instead — fixes X"
```

---

## Unpublish (72-hour window only)

```bash
npm unpublish holography@1.0.0
```

After 72 hours, a version cannot be unpublished — only deprecated.

---

## Update bundled assets

When templates, bootstrap.sh, or tool files change:

```bash
# Re-run bundler from project root
cd ~/dev/holography
node install.js

# Commit the updated npm/templates.json and npm/bootstrap.sh
git add npm/templates.json npm/bootstrap.sh
git commit -m "chore: rebundle templates for vX.X.X"
```

---

## Key files

| File | Purpose |
|------|---------|
| `npm/package.json` | Package manifest — version, bin, files |
| `npm/cli.js` | `npx holography` entry point |
| `npm/bootstrap.sh` | Bundled bash installer (offline scaffold) |
| `npm/templates.json` | Bundled templates (offline fallback) |
| `npm/README.md` | npmjs.org page content |
| `install.js` | Pre-publish bundler — run before every publish |
