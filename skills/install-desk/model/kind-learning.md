---
type: model-kind
title: 'Celorus KF™ Core: learning'
shelf: open
kind: learning
group: learned
folder: learnings
packs: []
must_have:
- learning_status
- bucket
usual:
- from
- about
- themes
- rule
- origin
connections:
- about -> person or firm or family, held in the page, never drawn
- from -> conversation, held in the page, never drawn
- themes -> theme, held in the page, never drawn
field_lists:
- learning_status <- learning_status
- bucket <- learning_bucket
- origin <- rule_origin
---

# Celorus KF™ Core: learning

Group: what we learned. Pages live in `learnings/`.

Must carry: `learning_status`, `bucket`.

May carry: `from`, `about`, `themes`, `rule`, `origin`.

- `about -> person or firm or family, held in the page, never drawn`
- `from -> conversation, held in the page, never drawn`
- `themes -> theme, held in the page, never drawn`
