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

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

## What you read

- The sections `## What we owe, by when` and `## What they owe us, by when` of the newest page
  under `celorus/conversations/`, or of the one the user names. Each line reads
  `- <what>, by <date>.`
- `celorus/queues/follow-ups.md` as it stands.
- The user's own words when they ask to queue, close or drop something.

## What you write

One row per promise in `celorus/queues/follow-ups.md`, `us` for what we owe and `them` for what
is owed to us; `<slug>` is the file name the conversation's `about` links:

```markdown
| <us or them> | <slug> | <what, in the words of the conversation page> | <date> | conversations/<file>.md | due |
```

Before anything is compared or written, every `|` in the promise's words becomes `/`, since the
table is parsed by the bootstrap; the compare and the row both use those rewritten words, so a
second run matches the row the first one wrote. A row whose `owed_by`, `who`, `by` and `from`
already stand in the queue, with a `what` equal to the promise's words or, on a `dropped` row,
beginning with them, is not written again, whatever its state, so running twice changes nothing
and a dropped promise stays dropped.

The six columns are `owed_by | who | what | by | from | state`. States: `due` (open, comes back
on its date), `replied` (they came back first; `day-open` sets this), `done` (it happened),
`dropped` (let go, with why in `what`). A row is never deleted; it flips state, so the queue is
also the record.

Then, when this run wrote at least one row:

- Where a calendar connector exists, offer a hold on the `by` date and create it only when
  the user says yes. Where none exists, say so in one line.
- Update `timestamp` in the queue's frontmatter.
- One line in `celorus/log.md`, directly under today's heading `## <date>` (add the heading
  above the older days if missing), with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · follow-up · wrote queues/follow-ups.md · yours`.

A queuing run that wrote no row changes no file.

Every row is the desk's own commitment and carries the register `yours` by construction;
nothing in this file is a fact about a subject.

## Closing and dropping

"Mark that done" flips the row to `done` and adds a row to `celorus/desk-log.md`:
`| <date> | <handle> | <slug> | follow-up | · | <action> | done | · | follow-up |`.
`<action>` is `mail`, `call` or `none`, whichever closed it.
"Drop that" flips it to `dropped` and writes why into `what`, after the original text, with any
`|` written as `/`.

## While you work

One plain progress line per step ("Reading the commitments", "Queuing the follow-ups").
Never name a tool or a path to the user.

## With no account

This skill runs in full with no Celorus account and never calls the record.

## Never

- **Sending, in three classes.** A draft, with the collateral attached, is free and ships:
  write it and hand it over. A write to your own calendar or CRM, on your explicit yes, is free;
  the calendar hold already ships, and a CRM write waits on the connector, so it stays
  a proposal until then. A send to a third party is out until an approval rail exists:
  this skill never sends one.
- Never queue a commitment without a date; ask for one.
- Never delete a row.

**Next:** `day-open`, tomorrow, which reads this queue first. The day's terminal state: the workspace updated.
