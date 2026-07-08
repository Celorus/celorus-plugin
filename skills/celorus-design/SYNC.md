# SYNC — this folder is a mirror, not a source

Source of truth: the `Celorus/design-system` repository, `skill/celorus-design/`.
Never edit files here directly — they will be overwritten by the next sync and the
edit is lost to every other consumer of the skill.

To update (after a design-system change merges):

```bash
rsync -a --delete --exclude SYNC.md ../design-system/skill/celorus-design/ \
  engineering/plugin/skills/celorus-design/
```

Then verify the mirror is exact and bump the plugin version (clients never refresh
otherwise — standing rule for any `engineering/plugin/**` change):

```bash
diff -rq -x SYNC.md engineering/plugin/skills/celorus-design ../design-system/skill/celorus-design
# edit engineering/plugin/.claude-plugin/plugin.json → "version"
```

Drift here is exactly how client-facing collateral quietly falls off the design
system (found 08 Jul 2026: this mirror was a stale v1.0 missing LOCALIZATION.md,
PLUGIN_SURFACES.md, PRINT_AND_EXPORT.md and celorus-charts.js while internal
sessions ran v1.1).
