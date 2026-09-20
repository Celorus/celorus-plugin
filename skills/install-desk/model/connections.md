---
type: model
title: 'Celorus KF™ Core: connections'
shelf: open
connections:
- 'works_at: person -> firm, draws a line'
- 'worked_at: person -> firm, draws a line'
- 'part_of: firm -> firm, draws a line'
- 'knows: person or seat -> person, draws a line'
- 'introduced_by: person or seat or firm or family -> person, draws a line'
- 'member_of: person -> family, draws a line'
- 'attended: conversation -> person or seat, held in the page, never drawn'
- 'named: conversation -> person or firm or family, held in the page, never drawn'
- 'about: conversation or brief or research or sent or learning -> person or firm or family, held in the page, never drawn'
- 'sent_to: sent -> person or firm or family, held in the page, never drawn'
- 'for_conversation: brief -> conversation, held in the page, never drawn'
- 'from: learning -> conversation, held in the page, never drawn'
- 'themes: learning -> theme, held in the page, never drawn'
draws:
- works_at
- worked_at
- part_of
- knows
- introduced_by
- member_of
proof_required:
- works_at
- worked_at
- part_of
- knows
- introduced_by
- member_of
---

# Celorus KF™ Core: connections

A connection in a page header is a quoted link by name. Each connection named in `proof_required` also has one line in the page's `## Connections` section saying how we know it: shown, said or guessed. A guessed connection is never in the header and never a link; it names the other end in plain text.

Only a relationship draws a line. A connection held in the page is kept for the reader and the checker and never draws: it is never written as a header link on a person, firm, family or seat page.

- `works_at`: person -> firm, draws a line
- `worked_at`: person -> firm, draws a line
- `part_of`: firm -> firm, draws a line
- `knows`: person or seat -> person, draws a line
- `introduced_by`: person or seat or firm or family -> person, draws a line
- `member_of`: person -> family, draws a line
- `attended`: conversation -> person or seat, held in the page, never drawn
- `named`: conversation -> person or firm or family, held in the page, never drawn
- `about`: conversation or brief or research or sent or learning -> person or firm or family, held in the page, never drawn
- `sent_to`: sent -> person or firm or family, held in the page, never drawn
- `for_conversation`: brief -> conversation, held in the page, never drawn
- `from`: learning -> conversation, held in the page, never drawn
- `themes`: learning -> theme, held in the page, never drawn
