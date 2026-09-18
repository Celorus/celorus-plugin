---
type: model-kind
title: 'Celorus KF™ Core: sent'
shelf: open
kind: sent
group: made
folder: sent
packs: []
must_have:
- sent_on
- sent_to
- about
- sent_kind
- file
usual:
- channel
connections:
- about -> person or firm or family, held in the page, never drawn
- sent_to -> person or firm or family, held in the page, never drawn
field_lists:
- sent_kind <- sent_kind
- channel <- channel
---

# Celorus KF™ Core: sent

Group: what we made. Pages live in `sent/`.

Must carry: `sent_on`, `sent_to`, `about`, `sent_kind`, `file`.

May carry: `channel`.

- `about -> person or firm or family, held in the page, never drawn`
- `sent_to -> person or firm or family, held in the page, never drawn`
