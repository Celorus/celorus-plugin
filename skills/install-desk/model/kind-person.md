---
type: model-kind
title: 'Celorus KF™ Core: person'
shelf: open
kind: person
group: world
folder: people
packs: []
must_have:
- standing
- name_source
usual:
- works_at
- role_title
- worked_at
- knows
- introduced_by
- member_of
- role_in_deal
- not_same_as
connections:
- works_at -> firm, draws a line
- worked_at -> firm, draws a line
- knows -> person, draws a line
- introduced_by -> person, draws a line
- member_of -> family, draws a line
field_lists:
- standing <- standing
- role_in_deal <- role_in_deal
---

# Celorus KF™ Core: person

Group: the world. Pages live in `people/`.

Must carry: `standing`, `name_source`.

May carry: `works_at`, `role_title`, `worked_at`, `knows`, `introduced_by`, `member_of`, `role_in_deal`, `not_same_as`.

- `works_at -> firm, draws a line`
- `worked_at -> firm, draws a line`
- `knows -> person, draws a line`
- `introduced_by -> person, draws a line`
- `member_of -> family, draws a line`
