# Layout 1, frozen

A desk without `celorus/desk.md` is on layout 1, one model version behind. It keeps working:
every workday skill reads and writes it in the shapes below, and says once per session that
"update my desk" moves it to layout 2 without losing a page. This file does not change. It is
deleted when model version 2 ships.

## Where things are

- The desk's stamps: `celorus/index.md`, under `celorus:`, as `desk_id`, `desk`,
  `layout_version: 1`, `seats` and `chain`.
- Pages about people and companies: `celorus/people/<slug>.md`, `celorus/families/<slug>.md`
  and `celorus/accounts/<slug>.md`, with `type` `person`, `family` or `account`.
- Call write-ups: `celorus/calls/<date>-<slug>.md`, with `type: call`.
- There is no `desk.md`, `firms/`, `conversations/`, `research/`, `sent/`, `learnings/`,
  `rules/`, `model/`, `views/` or `merges/`.

## Headers

Every detail except `type`, `title`, `description`, `resource`, `tags` and `timestamp` sits
under one block, `celorus:`, nested as the skill wrote it:

- a person, family or account page: `slug`, `kind`, `segments`, `band`, `readiness`, `clock`,
  `source_list`, `family`, `registers_used`, `research_minutes`, `last_touch`, `as_of`,
  `provenance`, and `citations` as a list of claim, ref and as_of;
- a call: `date`, `lead`, `recorded`, `timestamps`, `speakers_separated`, and `commitments` as a
  list of what and by;
- a board: `date`, `seat`, `opened_at`, `sources_read`, `sources_missing`;
- a seat: `handle`, `role`, `book_source`, `connectors` holding `mail`, `calendar` and `drive`,
  `baseline_minutes_per_lead`, `baseline_source`.

There are no connection details and no proof lines. Do not add them to a layout 1 desk.

## Queues and the log

- `queues/follow-ups.md` has five columns, `| who | what | by | from | state |`, where `from`
  names `calls/<date>-<slug>.md`. States: `due`, `replied`, `done`, `dropped`.
- `follow-up` reads a call's promises from the `commitments` list in its header.
- `log.md` has a header (`type: log`) and one line per write, newest first:
  `- <date> <time> · <handle> · <skill> · wrote <path> · <register>`.

## What waits for layout 2

`check-desk` does not run, no view is written, and `call-review` proposes no page for a person
who was only named.
