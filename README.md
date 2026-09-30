# Note Text Align

Set the alignment of a **Markdown note body** — left / centre / right / justify —
from the editor's right-click menu or the command palette. Stock Obsidian has no
setting for this at all.

- Right-click inside a note → **笔记对齐** → pick a position. The one currently in
  effect is ticked; *clear* is ticked when the note has none.
- Command palette → **笔记正文：左对齐 / 居中 / 右对齐 / 两端对齐 / 清除对齐**.

The alignment is written to the note's own frontmatter:

```yaml
---
cssclasses: [nta-center]
---
```

Nothing in the body is touched, the value shows up in the **Properties** panel,
and deleting that line (or running *clear*) reverts it.

## Where it applies

| Surface | Right-click entry | Alignment takes effect |
|---|---|---|
| Live Preview (editing) | ✅ | ✅ both the editing layer and the rendered layer |
| Source mode | ✅ | ✅ |
| Reading view | — (no editor there) | ✅ use the command palette instead |
| Note embedded in a Canvas card | — | Handled by **Canvas Node Align** instead (see below) |

## Why horizontal only

A Canvas card needs vertical alignment (top / middle / bottom) because it has a
fixed height and its text can be shorter. A note does not: it starts at the top
and scrolls, so "centre a whole note vertically" would just move the scroll
position. This plugin therefore offers the four horizontal values only.

## Settings

- **Stretch the last line** — by convention `justify` does *not* stretch the final
  line, and a one-sentence paragraph in any language then looks identical to
  left-alignment. Turning this on stretches that line too (`text-align-last:
  justify`). Off by default; most long paragraphs do not need it.

## Companion plugin

- **[Canvas Node Align](https://github.com/jiangbianyan-gif/obsidian-canvas-node-align)**
  — alignment inside Canvas: card bodies, group / edge / file-name labels, the
  nine-grid right-click panel, vertical position. It also covers the text of a
  note *while it is embedded in a card*.
- This plugin only handles a note opened on its own. Each plugin owns its own
  surface, so they do not fight.

## Known limitations

- Uninstalling the plugin leaves `nta-*` in the note's `cssclasses`; with the
  stylesheet gone the text falls back to left-aligned. Delete the property to
  clean up.
- If a note was aligned with **Canvas Node Align 2.x**, its old `cta-note-*` class
  is still recognised (and the stylesheet still has rules for it). Pick a position
  once in that note and it is rewritten to `nta-*`.
- Alignment applies to the note's text, not to embedded images, tables or code
  blocks — those follow their own layout.
- A class name you write yourself that shares the `nta-` prefix but is not one of
  the four positions is left alone.

## Install

Community plugins → search for **Note Text Align** (after the directory review),
or copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/note-text-align/` and enable it in
*Settings → Community plugins*.

## Development

```
main.js          plugin source (ES2017, no bundler, no dependencies)
styles.css       alignment rules
test/note.test.js        92 assertions: frontmatter read/write, class-name contract,
                         stylesheet guards, and wiring guards for the menu event
test/build.test.mjs      tests the release tooling itself
tools/build.mjs          `npm run build` — validates the payload the directory checks
tools/check-manifest.mjs metadata rules, run locally before every release
```

```bash
npm test          # both test files
npm run build     # the same command the community directory runs
npm run verify    # metadata + build + tests
```

## Privacy

No network access, no telemetry, no reading of note contents. The only thing it
writes is one `cssclasses` entry in the frontmatter of the note you asked it to
change.

## License

MIT
