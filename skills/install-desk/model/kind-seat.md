---
type: model-kind
title: 'Celorus KF™ Core: seat'
shelf: open
kind: seat
group: us
folder: seats
packs: []
must_have:
- handle
- role
- book_source
- connector_mail
- connector_calendar
- connector_drive
- baseline_minutes_per_lead
- baseline_source
usual:
- knows
- introduced_by
connections:
- knows -> person, draws a line
- introduced_by -> person, draws a line
field_lists: []
---

# Celorus KF™ Core: seat

Group: us. Pages live in `seats/`.

Must carry: `handle`, `role`, `book_source`, `connector_mail`, `connector_calendar`, `connector_drive`, `baseline_minutes_per_lead`, `baseline_source`.

May carry: `knows`, `introduced_by`.

- `knows -> person, draws a line`
- `introduced_by -> person, draws a line`
