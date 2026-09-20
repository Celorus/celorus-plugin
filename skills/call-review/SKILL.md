---
name: call-review
description: >-
  Review a sales call within a day of it, before any follow-up mail goes out: who was
  there, what they said, what we said, what we owe by when, and a CRM record to paste.
  Use when someone says "log the call", "review the call", "I just spoke to", pastes a
  voice note or drops in a transcript. Writes the conversation page, proposes pages and
  connections for who and what was named, and writes the register, the marks and the desk
  log. Runs with no Celorus account.
---

# Review the call

Buyers hand desks specifications and desks lose them. This skill keeps them: every
signal a person named goes to the register, every commitment gets a date, every figure
we quoted is written down with whether it was measured or estimated, and every person and
firm named becomes a page the desk can find again. The write-up comes before the follow-up
mail, always.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that contains `celorus/index.md`; the seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. Without a desk, say so in
one line and offer `install-desk`.

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

## What you read

- The desk's capture: a sixty-second voice note the harness transcribes, typed notes, or
  a transcript the user pastes or points you to.
- The page of whoever the call was about, under `celorus/people/`, `celorus/families/` or
  `celorus/firms/`, and the pages of the people and firms the call named.
- What we sent them: their pages under `celorus/sent/`, `celorus/drafts/` for them, and the
  newest page under `celorus/conversations/` whose `about` links them.
- `celorus/motion-spec.md`: `crm_field_stage`, `crm_field_owner` and `crm_field_last_touch`,
  the desk's own field names.
- `celorus/desk.md`: the pack and `named_only_contact_details`.

## The precondition, said out loud

A recording with timestamps and one channel per speaker can be reviewed minute by
minute. One without cannot: say which parts are not fillable (pace, who said what) rather
than guessing. An unrecorded call is summarised as the desk's own account and says so in
its first line. Nothing is ever quoted from a call that was not recorded.

## What you write

`celorus/conversations/<date>-<about>-<what>.md`, where `<about>` is the file name of the page
the call was about and `<what>` is one or two words (`intro`, `pricing`, `follow-up`):

```markdown
---
type: conversation
title: <Call | Meeting> with <name>, <date>
description: <one line: the outcome>
timestamp: <now>
date: <date>
channel: <call | meeting | mail | message>
about: "[[<the person, family or firm it was about>]]"
attended: ["[[<slug>]]", "[[<seat handle>]]"]
named: ["[[<slug>]]"]
recorded: <true | false>
timestamps: <true | false>
speakers_separated: <true | false>
---

# <Call | Meeting> with <name>

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

- <what>, by <date>.

## What they owe us, by when

- <what>, by <date>.

## The CRM proposal

```text
<the desk's stage field>: <value>
<the desk's owner field>: <handle>
<the desk's last-touch field>: <date> call, <outcome>; <what was promised, by when>
```
```

Both promise sections hold one line per promise, `- <what>, by <date>.`, which `follow-up`
queues: what we owe under the first, what they owe us under the second. Keep both headings; a
section with no promise stays empty under its heading.

`about`, `attended` and `named` are held in the page and never drawn: they are the only links in
a conversation page's header, and the page has no `## Connections` section. The connections the
call named go on the person and firm pages, as the next section says.

The CRM proposal uses the desk's own field names from those three keys and is written to be
pasted or dictated by the desk. It is never applied by this skill: the desk's CRM is the
desk's system, and write-back is not something the pack does.

## Who and what was named

After the write-up, list every person and firm named in the conversation, and every family on a
wealth desk or a desk with no pack, in one numbered proposal:

1. **Match.** Look for a page with the same title or alias. One match that `not_same_as` does
   not rule out: propose linking it. More than one, or a near match such as a first name
   alone: ask "same person?" for that name (for a firm, "same firm?"), naming each
   candidate's firm and last conversation. Never merge on your own.
2. **New page.** No match: propose `celorus/people/<slug>.md` with `type: person`, `title`,
   `description`, `timestamp`, `standing: named-only` (or `standing: in-conversation` for
   someone who attended), and `name_source: <this conversation's file name>`, the plain file
   name without `.md`, never a link. Nothing invented: no role, firm or contact detail that
   was not said. A firm named with no page gets `celorus/firms/<slug>.md` with `type`,
   `title`, `description` and `timestamp` only. Every new page has a body of its title and a
   `## Connections` heading, with nothing under it when nothing was said.
3. **Connections.** For each connection said in the conversation (who works where, who worked
   where, who knows whom, who introduced whom), propose the header link on the page the
   connection starts from, and its line under that page's `## Connections`:
   `- <connection> [[<target>]] · said · yours · <date> · in [[<this conversation>]] · said by [[<speaker>]]`.
   On a recorded conversation, add the words exactly as the transcript has them, `· "<words>"`,
   after the conversation link. On an unrecorded one, never quote. A connection someone hinted
   at, or said they were not sure of, is a guess:
   `- <connection> <target in plain words> · guessed · yours · <date> · <why>`, with no header
   link. When a guess already on a page is now said, propose replacing the guessed line. An
   introduction offered and not yet made is a promise, not a connection. Proof lines go on the
   person and firm pages, never on the conversation page.
4. **This conversation's header.** `attended` and `named` list every page confirmed.

Show the whole proposal once and ask for one answer: yes to all, or the numbers to change or
drop. Write only what the person confirms. On "not the same" for a pair, add each file name to
the other's `not_same_as`. On "same person" for a name with no page of its own, its lines go on
the page it matched. On "same person" for two pages that both exist, merge them as
`check-desk` says in "Merge two pages".

A person known only because someone named them carries no email, phone or address while
`named_only_contact_details` in `celorus/desk.md` is `false`, even when the conversation said
one.

## The register, the queues and the log

- One row per named signal in `celorus/register.md`:
  `| <signal, in their words> | <name> | <date> | unbuilt | unreviewed |`.
- One row in `celorus/marks.md` when the seat gives a mark: `| <date> | <handle> | <slug> | <mark> | <why, in words> |`. `<mark>` is one of `pursue`, `ignore` or `wrong`.
- The call row in `celorus/desk-log.md`:
  `| <date> | <handle> | <slug> | <source from the page> | · | <action> | <outcome> | <mark or ·> | call-review |`.
  `<action>` is `call` or `meeting`; `<outcome>` is one of `reached`, `no-answer`, `meeting-set`, `met`, `declined` or `not-yet`.
- Move the lead's row to state `contacted` or `met` in `celorus/queues/supplied.md`.
- A line under "Done" on today's board.
- One line in `celorus/log.md`, directly under today's heading `## <date>` (add the heading
  above the older days if missing), with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · call-review · wrote <the page's path under celorus/> · yours`,
  one line for each page written: the conversation page first, then each person and firm page.
- Run `check-desk` over the pages you wrote, and say its count in one line.

A `|` in a free-text cell of the register row or the marks row is written as `/`.

Every line under "Who was there", "What they said" and "What we said" is the desk's own account
and carries `yours` and the date of the call; a figure the person quoted about themselves is
`yours` too (the desk heard it), never `record` and never `web`. The promise lines keep the shape
`follow-up` reads, `- <what>, by <date>.`, with nothing after the date.

## The rule this skill enforces

The write-up precedes the follow-up. If a mail must go out the same evening, it thanks
them and commits to nothing until this page exists; then `follow-up` queues what was
promised, with its date.

## While you work

One plain progress line per step ("Reading the capture", "Pulling out what they named",
"Writing the call review", "Matching who was named"). Never name a tool or a path to the user.

## With no account

This skill runs in full with no Celorus account. It never calls the record; a call review
is the desk's own material.

## Never

- Never quote from a call that was not recorded; never guess at pace or attribution.
- **Sending, in three classes.** A draft, with the collateral attached, is free and ships:
  write it and hand it over. A write to your own calendar or CRM, on your explicit yes, is free;
  the calendar hold already ships, and a CRM write waits on the connector, so it stays
  a proposal until then. A send to a third party is out until an approval rail exists:
  this skill never sends one.
- Never drop a signal the person named: it goes to the register even when it sounds
  unbuildable.
- Never let a commitment through without a date.
- Never merge two pages on your own, and never write a page the person did not confirm.

**Next:** `follow-up`. When this skill is done, the conversation page, the pages it named, the register rows and the CRM proposal exist.
