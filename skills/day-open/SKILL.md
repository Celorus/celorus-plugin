---
name: day-open
description: >-
  Open the sales day from the desk workspace: what moved overnight, what is due today,
  what is on the clock. Use when someone says "open my day", "what changed", "did anyone
  reply", "what's due today", or at the start of the working day; the Celorus session
  bootstrap points here. Reads the desk's queues and, where the harness has them, the
  mailbox and calendar for replies and meetings; writes today's board. Runs with no
  Celorus account.
---

# Open the day

You answer the first question of the day: what moved overnight, who replied, what is due,
what is on the clock. Then you hand the day to `triage` for the ordered list. This is the
console's "working today" lane written as a file: moved overnight, due from your queue,
done.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that contains `celorus/index.md`. If neither
exists, say in one line that there is no desk here, offer `install-desk`, and stop. The
seat is `CELORUS_SEAT`, or the handle in `~/.celorus/seat-<desk_id>` (the `desk_id` is
in `celorus/index.md`); if neither exists, ask which seat this is and say that
`install-desk` can claim it for next time.

## What you read

1. The most recent board in `celorus/today/`, for where the day left off.
2. `celorus/queues/follow-ups.md`: rows whose state is `due` and whose `by` date is
   today or earlier.
3. `celorus/queues/supplied.md`: rows whose state is `new`. `celorus/queues/book.md`: rows
   dated since the last board.
4. `celorus/signals/inbox/`: any file. It is empty until server-pushed signals land; when
   it is empty, say nothing about it.
5. The mailbox, through the harness's mail connector when one exists: search only for
   replies from the people named in the follow-up queue and in the last board's
   "Today's calls" block, since the last board's timestamp. Read sender, date and subject
   line only.
6. The calendar, through the harness's calendar connector when one exists: today's
   events; title, time and attendee names only.

When a connector is absent, say so in one line inside the block it would have fed, and
list it in the board's `sources_missing`. Never invent a reply or a meeting.

## What you write

`celorus/today/<date>.md`, with this frontmatter and these blocks:

```markdown
---
type: board
title: <date>
description: The day's board
timestamp: <now>
celorus:
  date: <date>
  seat: <handle>
  opened_at: "<HH:MM>"
  sources_read: [queues/follow-ups.md, queues/supplied.md, queues/book.md, mail, calendar]
  sources_missing: []
---

# <weekday> <day> <month> <year>

## Moved overnight

- <Name> replied on <date>: <subject line>. · yours · <date>
- <N> new names on list <list id> (<date>).
- Nothing read: no mail connector on this harness.   (when there is none)

## Due today

- <Name>: <what>, by <date>, from <the call file>. · yours · <date of the call>

## On the clock

- <HH:MM> <event title> with <names>; page: `people/<slug>.md` where one exists.

## Today's calls

Ordered by triage.

## Done

```

Every line under "Moved overnight", "Due today" and "On the clock" is the desk's own
knowledge and carries the register label `yours` with the date. A reply is a fact about
the desk's mailbox, not about the subject.

Then:

- In `celorus/queues/follow-ups.md`, a row whose person replied gets state `replied`.
  The row stays; `follow-up` decides what comes next.
- Append the day header row to `celorus/desk-log.md`:
  `| <date> | <handle> | day | · | · | open | new <N> · due <N> · meetings <N> | · | day-open |`.
  Run twice in one day and the board's first three blocks are refreshed in place, "Today's
  calls" and "Done" are left alone, and no second header row is written.
- Append one line to `celorus/log.md`:
  `- <date> <time> · <handle> · day-open · wrote today/<date>.md · yours`.

## While you work

One plain progress line per step ("Reading the follow-up queue", "Looking for replies",
"Writing today's board"). Never name a tool, a file path or a connector's internals to
the user.

## With no account

This skill runs in full with no Celorus account: the queues, the mailbox and the calendar
are all on the desk's side. Connecting adds nothing today; when server-pushed signals
land they arrive in `signals/inbox/` and appear under "Moved overnight".

## Never

- Never copy a mail body or a calendar description into the workspace; write marks
  (replied, met, due), not content.
- Never read mail from anyone not named in the queues or the last board.
- Never invent a reply, a meeting or a signal to fill an empty block.
- Never send anything.

**Next:** `triage`. When this skill is done, today's board has moved overnight, due today and on the clock.
