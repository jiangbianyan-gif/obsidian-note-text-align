# Submitting Note Text Align to the community directory

This is the checklist for the first submission. It is written from the rules the
directory actually enforces (read from
`obsidianmd/obsidian-developer-docs`, `Community directory/`), not from memory.

## 1. Repository

- Public GitHub repository: `jiangbianyan-gif/obsidian-note-text-align`.
- Root contains `manifest.json`, `main.js`, `styles.css` (the three files Obsidian
  downloads), plus the source of truth for everything else.
- `manifest.json` sits at the **root**, and the repo name should relate to the
  plugin id (`note-text-align`).

## 2. Metadata rules that are checked

| Rule | Where it is enforced here |
|---|---|
| `id`: lowercase letters, digits and hyphens; must not contain `obsidian`; must not end with `plugin`; unique in the directory | currently `note-text-align` |
| `name`: Basic Latin only, no emoji, must not contain "Obsidian" or "Plugin" | currently `Note Text Align` |
| `description`: max 250 characters, ASCII, ends with a period, no marketing fluff | 219/250 |
| `version` must equal the release tag exactly | `1.0.0` |
| `versions.json` maps the plugin version to the minimum app version | `{"1.0.0": "1.5.0"}` |
| Command IDs must not repeat the plugin ID | they are `align-*` and `doctor` |
| `package.json` / `package-lock.json` versions must match `manifest.json` | checked by `tools/check-manifest.mjs` |
| No Node built-ins, no network calls, no telemetry, no obfuscation | `install.sh` aside, `main.js` requires only `obsidian`; asserted in `test/note.test.js` |

All of the above run locally:

```bash
npm run verify
```

`minAppVersion` is `1.5.0`: the plugin uses `processFrontMatter`,
`metadataCache.getFileCache`, `editor-menu` and `MenuItem.setSubmenu()` — all long
standing, and `setSubmenu` is present in the app bundle as far back as the 1.5
line. Nothing here needs a newer version.

## 3. Release

The workflow (`.github/workflows/release.yml`) verifies, attests and publishes.
Run it from **Actions → Release → Run workflow** with the version field **blank**
(blank means "read `manifest.json`"), or push a tag equal to the version.

- Tag must be exactly the version, **without a leading `v`**.
- Release assets: `main.js`, `manifest.json`, `styles.css` — the committed bytes,
  never rebuilt or renamed. `npm run build` asserts exactly this, and the
  directory re-checks it as *Build verification*.
- The release is created by `github-actions[bot]`, with a build attestation
  (the directory recommends — but does not require — provenance).

## 4. What the scanner looks at

Four groups: **manifest**, **release assets**, **source code**, **build
verification**. Every item is rated error / warning / recommendation / pass.
Only **errors** block installation; warnings and recommendations do not.

Known items and how they are handled:

- *Build verification* needs a build script whose name the directory recognises
  (`build`, `build:plugin`, or `compile`) — `package.json` has
  `"build": "node tools/build.mjs"`, and it is idempotent: it validates the
  payload and never rewrites the committed bytes.
- The directory installs dependencies (`npm ci`) before running that script, so
  `package.json` and `package-lock.json` must agree. There are no dependencies,
  which keeps this instant.
- *CSS lint* flags the `has` pseudo-class as a warning. `styles.css` does not use
  it (and does not even spell it out in comments, so the raw-text scan stays
  clean).

## 5. Submission form

- Repository URL: `https://github.com/jiangbianyan-gif/obsidian-note-text-align`
- Name / description / author: copy them from `manifest.json`.
- License: MIT (the repo has a `LICENSE` file — a missing or unrecognised license
  is a warning).
- Desktop only: **no** (`isDesktopOnly: false`).

## 6. After the first release

Every new release is scanned automatically. To force a check instead of waiting
for the periodic one: the entry page → **...** menu → **Check for new releases**
/ **Request review**. Fixing anything requires a **new version + a new release**;
pushing code alone does not trigger a re-scan.

## 7. Relationship to Canvas Node Align

Note alignment existed in `canvas-node-align` up to and including 2.3.0. From
`canvas-node-align` 2.3.1 that part was removed and lives here instead. Both READMEs
point at each other, and this plugin still reads the old `cta-note-*` class names
so notes aligned earlier keep their alignment.
