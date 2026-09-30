# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 — 2026-09-30

First release.

Note body alignment used to be part of **Canvas Node Align** (2.x), where it sat
next to the Canvas card alignment. It is a separate concern with a separate
mechanism, so it now lives in its own plugin. Each plugin does one thing.

**Added**

- **Horizontal alignment for Markdown note bodies**: left / centre / right /
  justify, plus *clear*.
- **Right-click entry**: inside a note → **笔记对齐** → pick a position. The one
  currently in effect is ticked, read from the note's own frontmatter.
- **Command palette entries**: `笔记正文：左对齐 / 居中 / 右对齐 / 两端对齐 / 清除对齐`.
- The value is written to the note's `cssclasses` frontmatter (`nta-*`) through
  `processFrontMatter`, so other frontmatter fields, tags and aliases are
  untouched, and other `cssclasses` entries written by the user are preserved.
- **Stretch the last line** setting: `justify` does not stretch the final line by
  convention, which makes a one-sentence paragraph look identical to
  left-alignment; this stretches it too.
- A **self-check** command that reports the version, whether the right-click
  submenu is supported, which note is active and what alignment it carries.

**Notes**

- Notes are reached through the `editor-menu` event, which only fires where there
  is an editor — Live Preview and Source mode. Reading view still works through
  the command palette. (This is also why Canvas Node Align never showed anything
  in a note: it registers `canvas:*` events, a completely different set.)
- Class names written by Canvas Node Align 2.x (`cta-note-*`) are still read, and
  the stylesheet still carries rules for them, so previously aligned notes keep
  working. Setting an alignment again rewrites the class to the new `nta-*` prefix.
- Writing frontmatter is guarded by a `.md` extension check: editing a Canvas card
  also opens an editor, and that path can report the `.canvas` file, where YAML
  frontmatter would corrupt the file.
