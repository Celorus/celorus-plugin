# The scaffold

Templates for every file `install-desk` writes. Placeholders: `{{desk}}` the desk's name
(where it sits inside double quotes, write a `"` in the name as `\"` and a `\` as `\\`),
`{{desk_id}}` the minted id, `{{handle}}` the seat handle, `{{role}}` one of `rm`,
`desk-head`, `operator`, `other`, `{{book_source}}` one of `crm-export`, `sheet`, `typed`,
`{{mail}}`, `{{calendar}}`, `{{drive}}` each `true` or `false`, `{{baseline}}` the
self-reported minutes per lead, `{{now}}` the ISO 8601 timestamp with offset, `{{date}}`
and `{{time}}` the same moment as a date, `YYYY-MM-DD`, and a 24-hour clock time, `HH:MM`.
`{{model_version}}` the `model_version` in this skill's `model/model.md`, `{{pack}}` and
`{{pack_version}}` the pack name and version from the desk bundle's `model/pack.md`, or `""`
and `0` when there is no bundle.

## `.gitignore` (at the desk folder root; if the file exists, append each line it lacks)

```text
.celorus/
celorus/.obsidian/workspace*.json
```

## `celorus/index.md`

```markdown
---
okf_version: "0.2"
---

# {{desk}}

This folder is the desk's workspace. It is yours: inspectable, backed up your way, and it
stays with you if the plugin is ever removed. Who the desk is, its stamps and its switches
are in `desk.md`. The workday skills read and write this folder; every write is one line in
`log.md`.

## How to open the day

Say **"open my day"**. On Claude Code the desk announces itself when a session starts; on
other harnesses the words do the same. The chain is day-open, then triage, then
research-lead for each lead that needs a page, then call-review after each call, then
follow-up, and tomorrow's day-open reads the follow-up queue first.

## The layout

- `desk.md`: who the desk is, the layout and model versions, the pack, the switches.
- `log.md`: one line per write, under the day's heading, newest day first.
- `desk-log.md`: one row per lead-action; the measurement instrument.
- `motion-spec.md`: what a lead is here, the clocks, the caps, the roles.
- `register.md`: signals buyers named, with build and compliance status.
- `marks.md`: pursue, ignore or wrong, one row per mark.
- `queues/`: `supplied.md`, `follow-ups.md` (what we owe and what is owed to us), `book.md`.
- `today/`: one board per day.
- `people/`, `families/`, `firms/`: one page per person, family or firm. A page with a stage,
  a kind of relationship and an owner is an account; the page never moves.
- `conversations/`, `briefs/`, `research/`, `sent/`: what happened and what we made.
- `learnings/`, `learnings/themes/`, `rules/rulebook.md`: what we learned.
- `drafts/`, `reviews/`: the day's working records.
- `seats/`: one file per seat.
- `context/`: tone, never-say, notes, brand. Client context; never mixed with sourced facts.
- `crm/`: the tagged export, never the master list; remove the folder to remove the CRM.
- `signals/inbox/`: server-pushed signals, when that lands.
- `model/`: a readable copy of the desk model, and `own-words.md`, the desk's added words.
- `views/`: generated pages: the pipeline, who knows whom, what needs attention, and one page
  for each "who can introduce me to" question asked.
- `.obsidian/`: generated Obsidian settings: a colour for each kind; the graph opens on
  people, families, firms and seats.
- `merges/`: both originals of every merge, so a merge can be undone.
```

## `celorus/desk.md`

```markdown
---
type: desk
title: "{{desk}}"
description: Who this desk is, its stamps and its switches
timestamp: {{now}}
desk: "{{desk}}"
desk_id: {{desk_id}}
layout_version: 2
model_version: {{model_version}}
pack: {{pack}}
pack_version: {{pack_version}}
named_only_contact_details: false
seats: ["{{handle}}"]
chain: [day-open, triage, research-lead, call-review, follow-up, check-desk]
---

# {{desk}}

`named_only_contact_details` stays `false` until the desk head turns it on: while it is off,
a person known only because someone named them carries no email, phone or address.
```

## `celorus/log.md`

```markdown
# Log

## {{date}}

* {{time}} · {{handle}} · install-desk · wrote the scaffold · yours
```

## `celorus/desk-log.md`

```markdown
---
type: desk-log
title: Desk log
description: One row per lead-action; the measurement instrument the month-2 gate reads
timestamp: {{now}}
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
lead_definition: a person or family we could open a conversation with this quarter
clocks: [money-in-motion, reason-to-call, handle-with-care]
cap_calls_per_day: 8
cap_openers_per_day: 3
role_rm_entry: day-open
role_rm_cadence: daily
role_desk_head_entry: desk-view
role_desk_head_cadence: daily
role_operator_entry: weekly-review
role_operator_cadence: weekly
crm_field_stage: Stage
crm_field_owner: Owner
crm_field_last_touch: Last Activity
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
description: What we owe and what is owed to us, and when
timestamp: {{now}}
queue: follow-ups
---

| owed_by | who | what | by | from | state |
|---|---|---|---|---|---|
```

## `celorus/queues/book.md`

```markdown
---
type: queue
title: Book moments
description: The desk's own moments, from the export or typed
timestamp: {{now}}
queue: book
---

| lead | moment | date | source |
|---|---|---|---|
```

## `celorus/seats/{{handle}}.md`

```markdown
---
type: seat
title: "{{handle}}"
description: The seat file for handle {{handle}}
timestamp: {{now}}
handle: "{{handle}}"
role: {{role}}
book_source: {{book_source}}
connector_mail: {{mail}}
connector_calendar: {{calendar}}
connector_drive: {{drive}}
baseline_minutes_per_lead: {{baseline}}
baseline_source: self-reported
---

# Seat: {{handle}}

Role: {{role}}. Book: {{book_source}}. Baseline: {{baseline}} minutes per lead,
self-reported at install on {{date}}.

## Connections
```

## `celorus/context/tone.md`

```markdown
---
type: context
title: Tone
description: How this desk writes; client context, never a fact about a subject
timestamp: {{now}}
context_kind: tone
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
context_kind: never-say
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
context_kind: notes
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
context_kind: crm
---

# The CRM export

No export has been dropped here yet. When one is, it is a tagged export chosen by the desk,
never the master list: the fields the desk wants joined (names, employer, stage, owner, last
touch). Name it `export-<date>.csv`. Every line the pack derives from it carries
`source: crm-export-<date>`. To remove the CRM, delete this folder; every derived line
reads "no CRM joined" at the next open.
```

## `celorus/rules/rulebook.md`

```markdown
---
type: rulebook
title: Rulebook
description: The desk's ratified rules, generated from the learnings
timestamp: {{now}}
---

# Rulebook

No rules yet. A learning the desk ratifies adds its rule here.
```

## `celorus/model/own-words.md`

```markdown
---
type: own-words
title: Our own words
description: Words and details this desk added, each matched where the list asks for it
timestamp: {{now}}
own_words: []
own_details: []
---

# Our own words

Add a word to a pack list as `<list>: <your word> -> <the pack word it means>`, for example
`stage: first-coffee -> <the pack stage it means>`. Add a word to a desk-only list (product,
territory, team) as `<list>: <word>`. Add an extra detail as `<kind>: <detail name>`. Never a
new kind of page and never a new kind of connection. The checker lists any word it cannot
match.
```

## The model pages

Copy every page in this skill's `model/` folder into `celorus/model/`, byte for byte, except
the `changes-v<N>.md` pages. In desk mode, also copy every page in the desk bundle's `model/`
folder (the pack). Never edit a copied page; an update replaces it.

## The empty folders

`celorus/today/`, `celorus/people/`, `celorus/families/`, `celorus/firms/`,
`celorus/conversations/`, `celorus/briefs/`, `celorus/research/`, `celorus/sent/`,
`celorus/learnings/`, `celorus/learnings/themes/`, `celorus/drafts/`, `celorus/reviews/`,
`celorus/context/brand/`, `celorus/signals/inbox/`, `celorus/merges/`, `celorus/views/`,
each holding an empty `.gitkeep`.

## The seat pointer (outside the desk folder)

`~/.celorus/seat-{{desk_id}}`, one line: `{{handle}}`.
