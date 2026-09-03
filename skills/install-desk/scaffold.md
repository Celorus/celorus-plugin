# The scaffold

Templates for every file `install-desk` writes. Placeholders: `{{desk}}` the desk's name,
`{{desk_id}}` the minted id, `{{handle}}` the seat handle, `{{role}}` one of `rm`,
`desk-head`, `operator`, `other`, `{{book_source}}` one of `crm-export`, `sheet`, `typed`,
`{{mail}}`, `{{calendar}}`, `{{drive}}` each `true` or `false`, `{{baseline}}` the
self-reported minutes per lead, `{{now}}` the ISO 8601 timestamp with offset, `{{date}}`
and `{{time}}` the same moment as a date and a clock time.

## `.gitignore` (at the desk folder root; append the line if the file exists)

```text
.celorus/
```

## `celorus/index.md`

```markdown
---
type: index
title: {{desk}}
description: The desk workspace for {{desk}}; start here
okf_version: "0.1"
timestamp: {{now}}
celorus:
  desk_id: {{desk_id}}
  desk: {{desk}}
  layout_version: 1
  seats: [{{handle}}]
  chain: [day-open, triage, research-lead, call-review, follow-up]
---

# {{desk}}

This folder is the desk's workspace. It is yours: inspectable, backed up your way, and it
stays with you if the plugin is ever removed. The workday skills read and write it; every
write is one line in `log.md`.

## How to open the day

Say **"open my day"**. On Claude Code the desk announces itself when a session starts; on
other harnesses the words do the same. The chain is day-open, then triage, then
research-lead for each lead that needs a page, then call-review after each call, then
follow-up, and tomorrow's day-open reads the follow-up queue first.

## The layout

- `desk-log.md`: one row per lead-action; the measurement instrument.
- `motion-spec.md`: what a lead is here, the clocks, the caps, the roles.
- `register.md`: signals buyers named, with build and compliance status.
- `marks.md`: pursue, ignore or wrong, one row per mark.
- `queues/`: `supplied.md`, `follow-ups.md`, `book.md`.
- `today/`: one board per day.
- `people/`, `families/`, `accounts/`: one page per lead.
- `calls/`, `briefs/`, `drafts/`, `reviews/`: the day's records.
- `seats/`: one file per seat.
- `context/`: tone, never-say, notes, brand. Client context; never mixed with sourced facts.
- `crm/`: the tagged export, never the master list; remove the folder to remove the CRM.
- `signals/inbox/`: server-pushed signals, when that lands.
```

## `celorus/log.md`

```markdown
---
type: log
title: Log
description: One line per write, newest first
timestamp: {{now}}
---

- {{date}} {{time}} · {{handle}} · install-desk · wrote the scaffold · yours
```

## `celorus/desk-log.md`

```markdown
---
type: desk-log
title: Desk log
description: One row per lead-action; the measurement instrument the month-2 gate reads
timestamp: {{now}}
celorus:
  columns: [date, seat, lead, source, minutes, action, outcome, mark, by]
  baseline_source: self-reported
  blank: "·"
---

| date | seat | lead | source | minutes | action | outcome | mark | by |
|---|---|---|---|---|---|---|---|---|
```

## `celorus/motion-spec.md` (seat mode; desk mode fills every field from the bundle)

```markdown
---
type: motion-spec
title: Motion spec
description: What a lead is on this desk, the clocks, the caps, the roles
timestamp: {{now}}
celorus:
  lead_definition: a person or family we could open a conversation with this quarter
  clocks: [money-in-motion, reason-to-call, handle-with-care]
  caps:
    calls_per_day: 8
    openers_per_day: 3
  roles:
    rm:
      entry: day-open
      cadence: daily
    desk-head:
      entry: desk-view
      cadence: daily
    operator:
      entry: weekly-review
      cadence: weekly
  crm_fields:
    stage: Stage
    owner: Owner
    last_touch: Last Activity
  charter_version: 0
  bundle_version: 0
---

# Motion spec

A lead here is a person or family we could open a conversation with this quarter. The
three clocks order the day: money in motion first, then a reason to call; handle with care
is listed last and never gets a pitch. Caps are the desk's own. Role profiles name where
each role's day starts. Edit this file by hand or refresh it from the desk bundle.
```

## `celorus/register.md`

```markdown
---
type: register
title: Signal register
description: Signals buyers named, each with a build status and a compliance status
timestamp: {{now}}
---

| signal | named by | date | build | compliance |
|---|---|---|---|---|
```

## `celorus/marks.md`

```markdown
---
type: marks
title: Marks
description: pursue, ignore or wrong; one row per mark, with who and why
timestamp: {{now}}
---

| date | seat | lead | mark | why |
|---|---|---|---|---|
```

## `celorus/queues/supplied.md`

```markdown
---
type: queue
title: Names supplied
description: One row per name we supplied, by list
timestamp: {{now}}
celorus:
  queue: supplied
  lists: []
---

| lead | list | date | state |
|---|---|---|---|
```

## `celorus/queues/follow-ups.md`

```markdown
---
type: queue
title: Follow-ups
description: What comes back to me, and when
timestamp: {{now}}
celorus:
  queue: follow-ups
---

| who | what | by | from | state |
|---|---|---|---|---|
```

## `celorus/queues/book.md`

```markdown
---
type: queue
title: Book moments
description: The desk's own moments, from the export or typed
timestamp: {{now}}
celorus:
  queue: book
---

| lead | moment | date | source |
|---|---|---|---|
```

## `celorus/seats/{{handle}}.md`

```markdown
---
type: seat
title: {{handle}}
description: The seat file for handle {{handle}}
timestamp: {{now}}
celorus:
  handle: {{handle}}
  role: {{role}}
  book_source: {{book_source}}
  connectors:
    mail: {{mail}}
    calendar: {{calendar}}
    drive: {{drive}}
  baseline_minutes_per_lead: {{baseline}}
  baseline_source: self-reported
---

# Seat: {{handle}}

Role: {{role}}. Book: {{book_source}}. Baseline: {{baseline}} minutes per lead,
self-reported at install on {{date}}.
```

## `celorus/context/tone.md`

```markdown
---
type: context
title: Tone
description: How this desk writes; client context, never a fact about a subject
timestamp: {{now}}
celorus:
  kind: tone
---

# Tone

Write how this desk writes. Two or three lines are enough: sentence length, how you
address people, what you never open with, how you close.
```

## `celorus/context/never-say.md`

```markdown
---
type: context
title: Never say
description: Lines this desk does not use; client context
timestamp: {{now}}
celorus:
  kind: never-say
---

# Never say

- Any figure about the person's own wealth in an opener.
```

## `celorus/context/notes.md`

```markdown
---
type: context
title: Notes
description: What the desk wants the skills to know; client context
timestamp: {{now}}
celorus:
  kind: notes
---

# Notes

- Win stories, objection handling, anything the skills should know. Labelled as yours
  wherever it is used; never presented as a fact about a subject.
```

## `celorus/crm/README.md`

```markdown
---
type: context
title: The CRM export
description: Which export this is, when, which fields; how to remove it
timestamp: {{now}}
celorus:
  kind: crm
---

# The CRM export

No export has been dropped here yet. When one is, it is a tagged export chosen by the desk,
never the master list: the fields the desk wants joined (names, employer, stage, owner, last
touch). Name it `export-<date>.csv`. Every line the pack derives from it carries
`source: crm-export-<date>`. To remove the CRM, delete this folder; every derived line
reads "no CRM joined" at the next open.
```

## The empty folders

`celorus/today/`, `celorus/people/`, `celorus/families/`, `celorus/accounts/`,
`celorus/calls/`, `celorus/briefs/`, `celorus/drafts/`, `celorus/reviews/`,
`celorus/context/brand/`, `celorus/signals/inbox/`, each holding an empty `.gitkeep`.

## The seat pointer (outside the desk folder)

`~/.celorus/seat-{{desk_id}}`, one line: `{{handle}}`.
