---
name: day-open
description: >-
  Open the sales day from the desk workspace: what moved overnight, what is due today,
  what is on the clock. Use when someone says "open my day", "what changed", "did anyone
  reply", "what's due today", or at the start of the working day; the Celorus session
  bootstrap points here. Reads the desk's queues and, where the harness has them, the
  mailbox, calendar and CRM for replies and meetings; writes today's board. Runs with no
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
in `celorus/desk.md`); if neither exists, ask which seat this is and say that
`install-desk` can claim it for next time.

If `celorus/desk.md` is missing, the desk is layout 1, or a layout 2 desk whose desk.md is
lost; `celorus/index.md` tells them apart. If its header holds a nested `celorus` block, the
desk is on layout 1: read and write it as `../install-desk/layout-1.md` says, and say once
that "update my desk" moves it to layout 2. If its header holds only `okf_version: "0.2"`,
say once that `desk.md` is lost and should be restored from the copy taken before the last
update or from the desk's history, and open the day without the stamps.

If the desk is on layout 1, or the `model_version` in `celorus/desk.md` is lower than the one
in the plugin's `../install-desk/model/model.md`, put one line at the top of the board: "A newer desk model
is ready. Say "update my desk" to see what changes first." Never update from day-open.

## What you read

1. The most recent board in `celorus/today/`, for where the day left off.
2. `celorus/queues/follow-ups.md`: rows whose state is `due` and whose `by` date is today
   or earlier, both what we owe (`owed_by` `us`) and what is owed to us (`them`).
3. `celorus/queues/supplied.md`: rows whose state is `new`. `celorus/queues/book.md`: rows
   dated since the last board.
4. `celorus/signals/inbox/`: any file. It is empty until server-pushed signals land; when
   it is empty, say nothing about it.
5. The mailbox, through the harness's mail connector when one exists: for the accounts
   and people already on the desk (queued, named, in the book), read the threads in
   full, not just their headers. Connecting a source is the consent to read it. The
   scope is those accounts and never the whole mailbox.
6. The calendar and the CRM, through their connectors when they exist: today's events
   and the account's own rows, read in full, for the same accounts and no others.

What matters from those reads lands on the account's page as source-tagged lines, each
one dated and labelled with the source it came from, and removable in one operation.
The desk's files are yours: nothing read here is uploaded, and it never reaches
Celorus.

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
date: <date>
seat: <handle>
opened_at: "<HH:MM>"
sources_read: [queues/follow-ups.md, queues/supplied.md, queues/book.md, mail, calendar, crm]
sources_missing: []
---

# <weekday> <day> <month> <year>

## Moved overnight

- <Name> replied on <date>: <subject line>. · yours · <date>
- <N> new names on list <list id> (<date>).
- Nothing read: no mail connector on this harness.   (when there is none)

## Due today

- We owe <Name>: <what>, by <date>, from <the conversation page>. · yours · <date of the conversation>
- <Name> owes us: <what>, by <date>, from <the conversation page>. · yours · <date of the conversation>

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
- Run `check-desk` over the whole desk, and add one line at the end of "Due today":
  `- <N> things on the desk need attention: views/needs-attention.md. · yours · <date>`
  (leave the line out when N is 0).
- Append the day header row to `celorus/desk-log.md`:
  `| <date> | <handle> | day | · | · | open | new <N> · due <N> · meetings <N> | · | day-open |`.
  Run twice in one day and the board's first three blocks are refreshed in place, "Today's
  calls" and "Done" are left alone, and no second header row is written.
- Append one line to `celorus/log.md`, directly under today's heading `## <date>` (add it
  above the older days if missing), with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · day-open · wrote today/<date>.md · yours`.

## While you work

One plain progress line per step ("Reading the follow-up queue", "Looking for replies",
"Writing today's board"). Never name a tool, a file path or a connector's internals to
the user.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. Before its
first write, this skill calls `check_desk` once, so it knows the desk tools answer before
anything is written; a refusal is an answer. When a desk tool call cannot be made before
anything is written, because the tool is missing or it does not run, write nothing, say
exactly this sentence and stop, and never make the page or the answer from these
instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after this skill has written, say which pages were
written and stop; that sentence is never said then.

## With no account

This skill runs in full with no Celorus account: the queues, the mailbox, the calendar and
the CRM are all on the desk's side, each read through the harness's own connector.
Connecting adds nothing today; when server-pushed signals land they arrive in
`signals/inbox/` and appear under "Moved overnight".

## Never

- Never read a source for a name that is not on the desk: the scope is the queued,
  named and booked accounts, never the whole mailbox.
- Never upload what you read. It stays on the desk and never reaches Celorus.
- Never read mail from anyone not named in the queues or the last board.
- Never invent a reply, a meeting or a signal to fill an empty block.
- Never send anything.

**Next:** `triage`. When this skill is done, today's board has moved overnight, due today and on the clock.
