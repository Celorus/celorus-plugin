---
name: follow-up
description: >-
  Queue what comes back to me, and when: every commitment from a call review becomes a
  row with a date, and tomorrow's open reads it first. Use when someone says "what do I
  owe", "queue a follow-up", "remind me to", "mark that done", or right after a call is
  reviewed. Proposes a calendar hold where a connector exists, on the user's say-so, and
  never sends anything. Runs with no Celorus account.
---

# Follow-ups

The queue is the memory of the day. A commitment with a date in it comes back on the
right morning; a commitment without one is lost. This skill owns
`celorus/queues/follow-ups.md`.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that contains `celorus/index.md`; the seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. Without a desk, say so in
one line and offer `install-desk`.

## What you read

- The `commitments` list in the newest call file under `celorus/calls/`, or the one the
  user names.
- `celorus/queues/follow-ups.md` as it stands.
- The user's own words when they ask to queue, close or drop something.

## What you write

One row per commitment in `celorus/queues/follow-ups.md`:

```markdown
| <slug> | <what, in the words of the call file> | <date> | calls/<date>-<slug>.md | due |
```

A `|` in the commitment text is written as `/`; the table is parsed by the bootstrap.

The five columns are `who | what | by | from | state`. States: `due` (open, comes back
on its date), `replied` (they came back first; `day-open` sets this), `done` (the seat did
it), `dropped` (the seat let it go, with why in `what`). A row is never deleted; it flips
state, so the queue is also the record.

Then:

- Where a calendar connector exists, offer a hold on the `by` date and create it only when
  the user says yes. Where none exists, say so in one line.
- Update `timestamp` in the queue's frontmatter.
- One line in `celorus/log.md`:
  `- <date> <time> · <handle> · follow-up · wrote queues/follow-ups.md · yours`.

Every row is the desk's own commitment and carries the register `yours` by construction;
nothing in this file is a fact about a subject.

## Closing and dropping

"Mark that done" flips the row to `done` and adds a row to `celorus/desk-log.md`:
`| <date> | <handle> | <slug> | follow-up | · | <action> | done | · | follow-up |`.
`<action>` is `mail`, `call` or `none`, whichever closed it.
"Drop that" flips it to `dropped` and writes why into `what`, after the original text.

## While you work

One plain progress line per step ("Reading the commitments", "Queuing the follow-ups").
Never name a tool or a path to the user.

## With no account

This skill runs in full with no Celorus account and never calls the record.

## Never

- Never send a mail, a message or a calendar invitation; a hold on the seat's own
  calendar, created on their yes, is the most this skill does.
- Never queue a commitment without a date; ask for one.
- Never delete a row.

**Next:** `day-open`, tomorrow, which reads this queue first. The day's terminal state: the workspace updated.
