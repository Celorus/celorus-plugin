---
name: call-review
description: >-
  Review a sales call within a day of it, before any follow-up mail goes out: who was
  there, what they said, what we said, what we owe by when, and a CRM record to paste.
  Use when someone says "log the call", "review the call", "I just spoke to", pastes a
  voice note or drops a transcript into the desk's calls folder. Writes the call file,
  the register, the marks and the desk log. Runs with no Celorus account.
---

# Review the call

Buyers hand desks specifications and desks lose them. This skill keeps them: every
signal a person named goes to the register, every commitment gets a date, every figure
we quoted is written down with whether it was measured or estimated. The write-up comes
before the follow-up mail, always.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that contains `celorus/index.md`; the seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. Without a desk, say so in
one line and offer `install-desk`.

## What you read

- The desk's capture: a sixty-second voice note the harness transcribes, typed notes, or
  a transcript the desk dropped into `celorus/calls/`.
- The lead's page under `people/`, `families/` or `accounts/`.
- What we sent them: `celorus/drafts/` for this lead, and the last call file if any.
- `celorus/motion-spec.md`: `crm_fields`, the desk's own field names.

## The precondition, said out loud

A recording with timestamps and one channel per speaker can be reviewed minute by
minute. One without cannot: say which parts are not fillable (pace, who said what) rather
than guessing. An unrecorded call is summarised as the desk's own account and says so in
its first line. Nothing is ever quoted from a call that was not recorded.

## What you write

`celorus/calls/<date>-<slug>.md`:

```markdown
---
type: call
title: Call with <name>, <date>
description: <one line: the outcome>
timestamp: <now>
celorus:
  date: <date>
  lead: <slug>
  recorded: <true | false>
  timestamps: <true | false>
  speakers_separated: <true | false>
  commitments:
    - what: <the commitment>
      by: <date>
---

# Call with <name>

<Recorded with timestamps | Recorded without timestamps: pace not fillable | Unrecorded; this is the desk's own account.>

## Who was there

- <who came; who did not; whether anyone who could say yes was there>

## What they said

- Signals they named: <each one, in their words> · yours · <date>   (each goes to the register)
- What they already have: <incumbent tools, advisors>
- What they told us is unbuyable, in their words
- What they would judge us on, in their words

## What we said

- Figures quoted: <each figure, and whether it is measured, targeted or estimated>
- Commitments volunteered: <each, and whether it is policy>
- Contradictions with what we sent: <any>

## What we owe, by when

- <the commitment>, by <date>   (a date, or it is not a commitment)

## The CRM proposal

```text
<the desk's stage field>: <value>
<the desk's owner field>: <handle>
<the desk's last-touch field>: <date> call, <outcome>; <what was promised, by when>
```
```

The CRM proposal uses the desk's own field names from `crm_fields` and is written to be
pasted or dictated by the desk. It is never applied by this skill: the desk's CRM is the
desk's system, and write-back is not something the pack does.

Then:

- One row per named signal in `celorus/register.md`:
  `| <signal, in their words> | <name> | <date> | unbuilt | unreviewed |`.
- One row in `celorus/marks.md` when the seat gives a mark: `| <date> | <handle> | <slug> | <mark> | <why, in words> |`. `<mark>` is one of `pursue`, `ignore` or `wrong`.
- The call row in `celorus/desk-log.md`:
  `| <date> | <handle> | <slug> | <source from the page> | · | <action> | <outcome> | <mark or ·> | call-review |`.
  `<action>` is `call` or `meeting`; `<outcome>` is one of `reached`, `no-answer`, `meeting-set`, `met`, `declined` or `not-yet`.
- Move the lead's row to state `contacted` or `met` in `celorus/queues/supplied.md`.
- A line under "Done" on today's board.
- One line in `celorus/log.md`:
  `- <date> <time> · <handle> · call-review · wrote calls/<date>-<slug>.md · yours`.

A `|` in a free-text cell of the register row or the marks row is written as `/`.

Every line in the call file is the desk's own account and carries `yours` and the date
of the call; a figure the person quoted about themselves is `yours` too (the desk heard
it), never `record` and never `web`.

## The rule this skill enforces

The write-up precedes the follow-up. If a mail must go out the same evening, it thanks
them and commits to nothing until this file exists; then `follow-up` queues what was
promised, with its date.

## While you work

One plain progress line per step ("Reading the capture", "Pulling out what they named",
"Writing the call review"). Never name a tool or a path to the user.

## With no account

This skill runs in full with no Celorus account. It never calls the record; a call review
is the desk's own material.

## Never

- Never quote from a call that was not recorded; never guess at pace or attribution.
- Never apply the CRM proposal, never write to a CRM, never send anything.
- Never drop a signal the person named: it goes to the register even when it sounds
  unbuildable.
- Never let a commitment through without a date.

**Next:** `follow-up`. When this skill is done, the call file, the register rows and the CRM proposal exist.
