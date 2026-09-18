---
type: model-kind
title: 'Celorus KF™ Core: conversation'
shelf: open
kind: conversation
group: happened
folder: conversations
packs: []
must_have:
- date
- channel
- about
usual:
- attended
- named
- recorded
- timestamps
- speakers_separated
connections:
- attended -> person or seat, held in the page, never drawn
- named -> person or firm or family, held in the page, never drawn
- about -> person or firm or family, held in the page, never drawn
field_lists:
- channel <- channel
---

# Celorus KF™ Core: conversation

Group: what happened. Pages live in `conversations/`.

Must carry: `date`, `channel`, `about`.

May carry: `attended`, `named`, `recorded`, `timestamps`, `speakers_separated`.

- `attended -> person or seat, held in the page, never drawn`
- `named -> person or firm or family, held in the page, never drawn`
- `about -> person or firm or family, held in the page, never drawn`
