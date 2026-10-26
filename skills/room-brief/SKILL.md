---
name: room-brief
description: >-
  Write the room brief for one family before a meeting: two to three pages from the desk,
  saved there and shown as a page. Use when someone says "make the room brief for the
  Lakeview family", "brief me for the 16:30", or "what do I need for tomorrow's meeting with
  them". Every fact comes from the desk and says where it came from; never sends a mail or a
  message, and a change made through `make` sends the Celorus desk server the desk pages it
  needs.
---

# The room brief

The brief a seat takes into a family's meeting: who is in the family, what matters to them,
what to bring and what not to say, each fact from the desk with where it came from.

## House rules

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

These hold over every section of this skill. Where a section below seems to ask for something
they forbid, they win.

## How you work

- Every number and every row comes from a tool. You write the sentences around them. Never
  count, total or rank anything yourself, and never change a number a tool gave. Say no number
  you have not read from a tool's answer in this chat, and describe no page you have not
  rendered in this chat.
- Short sentences. The reason first, then the ask. Never write a figure about anyone's wealth,
  and never in an opener.
- Names, not page names: say "the Lakeview family" and "Asha Lakeview", using the `titles` a
  tool returns. Where a tool asks for a family, a person or a seat, pass its page name or the
  seat's handle, never the name.
- Every desk tool finds the desk itself: leave `desk` out, and say a refusal about the desk as
  it came.
- Before writing a brief, read `celorus/context/tone.md` and `celorus/context/never-say.md`
  once in this chat, and follow them.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- To show a page: `render_view(...)`, made through `make`, answers with a `path` and a `page`. Show the file at
  `path` as it is, in the harness's own way of showing a file. The page is built already, so
  do not edit, retype or restyle it, and do not load a design skill for it. Without `desk`, the
  `path` is relative to the desk folder. Then say one line about what the page shows, naming it
  by `page`. A path is never read aloud. If the harness cannot show a file, say the `page` in
  one line.

## Make the brief

1. Know the seat, as its handle, and the family, as its page name. Find the seat as `day-open`
   does; if it is not known, ask which seat this is, as its handle, and write nothing until it
   is known. The brief is for a seat whose `role` in `celorus/seats/<handle>.md` is `rm`.
2. Call `family_facts(family=<the family's page name>)`. Today is the `date` that
   `desk_count(view="brief", seat=...)` answers with no `date`, the desk's today, never your
   own clock: count it before the calendar is read. Then read the seat's calendar for today and
   the seven days after through the harness's calendar connector, to find the meeting's day and
   time; with no calendar connector, ask for the meeting's day. Read the conversation pages the
   facts list, each at `celorus/conversations/<its page name>.md`.
3. Write the brief in these sections, in this order: "The meeting", "Who is in the family",
   "Wealth and where it came from", "What matters to this family", "Other associations",
   "What to bring", "What not to say". Two to three pages. Every fact comes from the facts or a
   conversation page, with where it came from in plain words ("on the call of 21 Sep", "from
   the register"). Where the desk does not know, write "Not known yet." No figure about their
   wealth.
4. Through `make`, `write_brief(at=<now, with its offset>, seat=..., family=..., kind="room", sections=[{"heading": ..., "paragraphs": [...]}], meeting_on=<YYYY-MM-DD>)`.
   A brief this seat already made today is rewritten only when the person asks for it again.
   Then say first that notes added to it by hand are lost if it is rewritten, ask whether to
   rewrite it, and WAIT for a yes. Only on a yes, make the same call with `replace=true` added.
   No yes, no rewrite: the brief stays as it is.
5. Through `make`, `render_view(view="room-brief", seat=..., family=..., prose={"sections": <the same sections>})`
   and show the page.
6. `desk_sync(...)`, as "Save to the desk's history" says.

## Save to the desk's history

A change to the desk ends with `desk_sync(seat=..., message=...)`, as the seat who asked, with a
one-line message saying what changed. It runs nothing: it answers the git commands. Read its
`summary` and do as it says. Run its `commands` in order, in the desk folder, filling each word
in braces from what an earlier command printed, as that command's fills say. An exit a command
lists is not a failure: do what that exit says. An exit it lists under stops ends the run
there: run nothing more, and tell the person its words. Any other exit is a failure: stop at
the first that fails, run nothing after it, and say git's words. When the pull fails, run the
answer's `on_pull_failure` command, which undoes a rebase the pull started or finds none to
undo, and never run the push; then stop, and say the pull's words. Say a commit is on this
machine only when this run's commit step made one: a commit this run made exists on this
machine, and when nothing was staged the commit was skipped and there is none. After the commit, run its `held_back` command and name each page it lists as held
back: only the overnight commits the family, people and firm pages. When nothing was staged,
say there was nothing to commit, and never say a change was saved when none was. Pass
`push=true` only when the person has just asked, in words, for the desk to go up.

On a seat's graph (`celorus/desk.md` says `layout_version: 3`), skip `desk_sync`: a change is
kept in the seat's storage by `make`, and git sends nothing from a graph, so `desk_sync`
refuses one.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. When a desk
tool call cannot be made before this skill has written anything, because the tool is missing
or it does not run, write nothing, say exactly this sentence and stop, and never make the page
or the answer from these instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after this skill has written, here or through a connector,
say what was written and where, and stop; that sentence is never said then.

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

- Never send anything: the brief is for the seat, not the family.
- Never write a fact the desk does not hold, and never a figure about anyone's wealth.
- Never count, total or rank a row yourself.
