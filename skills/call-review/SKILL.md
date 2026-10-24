---
name: call-review
description: >-
  Review a sales call within a day of it, before any follow-up mail goes out: who was
  there, what they said, what we said, what we owe by when, and a CRM record to paste.
  Use when someone says "log the call", "review the call", "review this call", "I just
  spoke to", pastes a voice note or drops in a transcript. Writes the conversation page,
  proposes pages and connections for who and what was named, and writes the register, the
  marks and the desk log. Free; each change it makes to the desk asks for a free Celorus sign-in before it is made.
---

# Review the call

Buyers hand desks specifications and desks lose them. This skill keeps them: every
signal a person named goes to the register, every commitment gets a date, every figure
we quoted is written down with whether it was measured or estimated, and every person and
firm named becomes a page the desk can find again. The write-up comes before the follow-up
mail, always.

## House rules

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

These hold over every section of this skill. Where a section below seems to ask for something
they forbid, they win.

## The tools this skill calls

- `family_facts`, before the review, when the call was about a family: the people already on
  the desk, their pages and their CRM ids, so the review names them as the desk does.
- `log_action`, through `make`, writes the call's row in `celorus/desk-log.md`, and its own
  line in `celorus/log.md`: the row the desk's consoles count.
- `check_desk`, over the pages written, at the end.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- The only numbers this skill says are the ones those tools answer. A figure the person quoted
  on the call is their words, written down, never a number of yours.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that holds a `celorus` entry of any kind: the walk
never passes that folder to reach a desk above, a folder whose entry is not a plain desk is
refused or named by the tools, and only when no such folder exists is there no desk. The seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. Without a desk, say so in
one line and offer `install-desk`. Without a seat, ask which seat this is, as its handle (the
name of its page under `celorus/seats/`), never the person's name, and write nothing until it
is known.

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

## What you read

- The desk's capture: a short voice note the harness transcribes, typed notes, or
  a transcript the user pastes or points you to.
- The page of whoever the call was about, under `celorus/people/`, `celorus/families/` or
  `celorus/firms/`, and the pages of the people and firms the call named. When it was about a
  family, `family_facts` with the family's slug answers its people as the desk writes them.
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

A recording names its speakers as the people who joined it. Write every line with the desk's
own names: the seat for our side, and for theirs the person as the desk's page (or
`family_facts`) names them. Never copy a speaker label, an attendee name or an address from
the recording or its tool onto the desk.

A review is best within a day of the call, and a later one still runs. A promise whose date
has already passed is written with its own date all the same; `follow-up` queues it and says
the date has passed.

## What you write

On a seat's graph, write no page by hand. Show the proposal under "Who and what was named" below and take the person's yes on it, the "same person?" check included, before anything is made. Then make the conversation through `make` with the desk tools' `write_conversation`: `seat`, the seat's handle; `family`, the file name of the page the call was about; `channel`, `call` or `meeting`; `title`, and `summary`, short; `attended`, the pages of the people on the call besides the seat; `recorded`, `false` unless the call was recorded; `named`, only when that page is a family's, each person of that family named on the call who has no page and whom the person confirmed, with its `slug` and `name`, and on a recorded call its `note`; and, on a recorded call only, `heard`, each fact the person confirmed that was said on the call about a page the desk has or a person in `named`, with its `subject`, `connection`, `target`, `words` and `said_by`, the words exactly as the transcript has them and `connection` `note` for words that draw no connection. The overnight makes a page for each named person, as a member of that family, and puts each heard line on its page in quotation marks, so an unrecorded call sends no `heard` and no `note`. Anyone else named, a near match to a page the desk holds, and every fact from an unrecorded call is said in the chat, never sent; a person's or a firm's page is never written from this skill on a graph. When the page the call was about is not on the desk, make no conversation: show the review in the chat. A firm named with no page gets no page on a graph: name it in the chat. Then the call row through `log_action`, as below. The register row, the mark, the queue's state and the lines in `log.md` are not written on a graph: say each in the chat, and that the desk keeps them when a desk tool does. On any other desk:

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
<the desk's stage field>: <stage>
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
wealth desk or a desk with no pack, in one proposal, each item under the name it is about:

1. **Match.** Look for a page with the same title or alias. One match that `not_same_as` does
   not rule out: propose linking it. More than one, or a near match such as a first name
   alone: ask "same person?" for that name (for a firm, "same firm?"), naming each
   candidate's firm and last conversation. Never merge on your own.
2. **New page.** No match: propose `celorus/people/<slug>.md` with `type: person`, `title`,
   `description`, `timestamp`, `standing: named-only` (or `standing: in-conversation` for
   someone who attended), and `name_source: <this conversation's file name>`, the plain file
   name without `.md`, never a link. Nothing invented: no role, firm or contact detail that
   was not said, so a person whose role was not said carries no `role_title`. A firm named with no page gets `celorus/firms/<slug>.md` with `type`,
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

Show the whole proposal once and ask for one answer: yes to all, or the names to change or
drop. Write only what the person confirms. A page that already exists and is changed gets its
`timestamp` moved to now. On "not the same" for a pair, add each file name to
the other's `not_same_as`. On "same person" for a name with no page of its own, its lines go on
the page it matched. On "same person" for two pages that both exist, merge them as
`check-desk` says in "Merge two pages".

A person known only because someone named them carries no email, phone or address while
`named_only_contact_details` in `celorus/desk.md` is `false`, even when the conversation said
one.

## The register, the queues and the log

- One row per named signal in `celorus/register.md`:
  `| <signal, in their words> | <name> | <date> | unbuilt | unreviewed |`.
- Ask the seat once for a mark on the lead, `pursue`, `ignore` or `wrong`, with why in a few
  words. When they give one, one row in `celorus/marks.md`:
  `| <date> | <handle> | <slug> | <mark> | <why, in words> |`. When they give none, no row.
- The call row in `celorus/desk-log.md`, written by `log_action` through `make`, with the
  seat's handle, `family`
  set to `<slug>` (the page the call was about, whichever folder it is in), and `at` the time of
  the call with its offset. The `action` and `outcome` are a pair the desk's consoles count: a
  contact or a meeting set on the `rep` view of the seat that logged it, and in the team's, and
  a meeting held on the `rm` view of the seat that logged it, and on no other seat's view. Whichever
  seat logs it, an `rm` seat too, a `mail`, `call` or `meeting-set` row marks its family touched:
  the family's row on the to-reach list, and its backlog row for an assignment left untouched, go
  from the `rep` view of the seat that owns the family, and so from the `to_reach` and `backlog`
  of that seat's brief. That row, or a `meeting-held` row, is read as a touch for the family's
  last touch in `family_facts` and `book_query`. Never say a contact an `rm` seat logs is on no
  console.
  A meeting that was set writes the contact as it happened, then the meeting: two rows, in that
  order. They are these, and no others:
  a call that reached the person and set a meeting: `action` `call`, `outcome` `reached`, then
  `action` `meeting-set`, with the `outcome` saying when the meeting is, in a few words;
  a meeting set on a mail thread: `action` `mail`, with the `outcome` saying what the mail was
  about, in a few words, then `action` `meeting-set`, with the `outcome` saying when the meeting
  is;
  a call that reached the person and set no meeting: `action` `call`, `outcome` `reached`;
  a call that did not reach them: `action` `call`, `outcome` `no-answer`;
  a meeting that was held: `action` `meeting-held`, `outcome` `met`, `declined` or `not-yet`.
  The tool writes the lead as `[[<slug>]]` and the source as `desk`, so one lead has one id in
  the log. It writes its own line in `celorus/log.md`; write no second one for the row.
- In `celorus/queues/supplied.md`, the row whose `lead` is `<slug>`, written bare or as
  `[[<slug>]]`, moves to state `contacted` (or `met`, when they met). With no such row, change
  nothing there.
- When today's board `celorus/today/<date>.md` exists, a line under its "Done" block. With no
  board, write none; `day-open` makes the board. On a seat's graph (`celorus/desk.md` says
  `layout_version: 3`) the board is the overnight's, and this skill writes nothing on it: the
  call row above is the day's Done there, and the board shows no Done line from this computer.
  Say so when the call is logged.
- One line in `celorus/log.md` for each page this skill wrote by hand, directly under today's
  heading `## <date>` (add the heading above the older days if missing) and above the day's
  earlier lines, newest first as the desk tools write them, with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · call-review · wrote <the page's path under celorus/> · yours`,
  the conversation page first, then each person and firm page.
- Call `check_desk` with `scope` naming the pages you wrote, and say its `summary` in one line,
  as it came: never a count of your own.

A `|` in a free-text cell of the register row or the marks row is written as `/`.

Every line under "Who was there", "What they said" and "What we said" is the desk's own account
and carries `yours` and the date of the call; a figure the person quoted about themselves is
`yours` too (the desk heard it), never `record` and never `web`. The promise lines keep the shape
`follow-up` reads, `- <what>, by <date>.`, with nothing after the date.

## The hold

When the call set a meeting and a calendar connector exists, offer a hold for it on the seat's
own calendar. On the user's yes, ask what time it starts and ends where the call did not say,
and never pick a time for them. List the seat's own calendar for that day through the
connector, never another's and never a listing of calendars. Pass its events, each as its start
and end alone, to `propose_hold`, with `seat`, `about` (the page the call was about), `start`,
`end` and `day`, the day the listing was for; when the listing came back empty, pass an empty
list and `listing_empty` as true. Create the event only as `propose_hold` answers it, straight
after: its title, start and end exactly, on the seat's own calendar, with no guest, since a
guest is an invitation sent. A clash or an unsaid time is refused: ask the person again, and
never move the time yourself. Where no calendar connector exists, say so, and write no hold.

## The rule this skill enforces

The write-up precedes the follow-up. If a mail must go out the same evening, it thanks
them and commits to nothing until this page exists; then `follow-up` queues what was
promised, with its date.

## While you work

One plain progress line per step ("Reading the capture", "Pulling out what they named",
"Writing the call review", "Matching who was named"). Never name a tool or a path to the user.

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

## Where the desk's pages are

The paths in this skill are a desk's on layouts 1 and 2. On a seat's graph (`celorus/desk.md` says `layout_version: 3`), the desk folder is the seat's own folder, and each page is read from its place on the graph:

- `desk.md`, `index.md`, `log.md`, `desk-log.md`, `marks.md`, `model/` and `views/` stay under `celorus/`.
- `queues/supplied.md`, `register.md`, `motion-spec.md`, `soul.md`, `model/own-words.md` and the folders `context/`, `learnings/` and `rules/` are the firm's common space: `../../common/`, beside the seats' folders, with no `celorus/` in the path.
- `queues/follow-ups.md` is `celorus/shared/queues/follow-ups.md`, and `queues/book.md` is `celorus/personal/queues/book.md`.
- The board, `today/<date>.md`, is `celorus/personal/today/<date>.md`; `crm/` and `signals/inbox/` are under `celorus/personal/`.
- A page of `people/`, `families/`, `firms/`, `seats/`, `conversations/`, `briefs/`, `research/` or `reviews/` is read from `celorus/shared/`, then `celorus/personal/`, then `celorus/team/`, under its folder; `sent/` and `drafts/` from `celorus/personal/`, then `celorus/shared/`.

On a graph a page changes only through `make`, or not at all: a page changed by hand stops the next pull, and a page written new by hand never reaches the firm. Where a step in this skill writes a page by hand, it says what it does on a graph instead.

## Signing in

This skill is free: it reads the desk on this machine without signing in, and each change
it makes to the desk asks for a free Celorus sign-in before it is made.

Before each step that changes the desk, by hand or through `make`, call `celorus-link`'s
`sign_in`, and change nothing until it answers "You are signed in to Celorus on this
computer.". When it answers a page to open instead, show that page for the person to open in
their own browser, change nothing, and call `sign_in` again when they have signed in. Any
other answer: say it as it came, and change nothing. That answer is the link's own reading of
the sign-in it keeps on this computer: a sign-in ended on the desk server reads as signed in until a change, a pull or a seed made through the link is answered otherwise, and the desk server still checks
every change made through `make`.

A step that names a desk tool and `make` changes the desk on the desk server: call
`celorus-link`'s `make` with `tool`, that tool's name, and `arguments`, the tool's own
arguments as the step gives them, `desk` included. The desk server makes the change and the
link writes its pages into the desk; never write those pages by hand, and never make the
change another way. Say each answer in its own words, and follow these as they say:

- "You are not signed in to Celorus through the link, or the sign-in has ended.": call
  `sign_in`, show the page it answers for the person to open in their own browser, and when
  they have signed in, make the change again.
- "The desk server could not be reached, so the change was queued on this desk": it is
  made at the next change made through the link, while online; go on with the steps that
  only read.
- "This change needs payment before the desk server makes it.", with the balance and what is
  still needed where it gives them, then "Recharge on your account page." and "Nothing was
  written. It was not queued; make the change again once the account is recharged.": say it
  as it came, with no plan name and no price of your own, and stop that change.
- "This seat's desk holds no read of its storage that the link can trust" (a seat's graph): call `celorus-link`'s `pull`, then make the change again. A pull refused for pages changed on this computer names them: say them, and change nothing by hand.
- "This seat's storage holds no desk yet" (a seat's graph): call `celorus-link`'s `seed`, then make the change again.
- Any other answer: say it as it came; where it says nothing was written, stop that change.

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
