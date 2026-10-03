---
name: room-brief
description: >-
  Write the room brief for one family before a meeting: two to three pages from the desk,
  saved there and shown as a page. Use when someone says "make the room brief for the
  Lakeview family", "brief me for the 16:30", or "what do I need for tomorrow's meeting with
  them". Every fact comes from the desk and says where it came from; never sends anything.
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
- To show a page: `render_view(...)` answers with a `path` and a `page`. Show the file at
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
4. `write_brief(at=<now, with its offset>, seat=..., family=..., kind="room", sections=[{"heading": ..., "paragraphs": [...]}], meeting_on=<YYYY-MM-DD>)`.
   A brief this seat already made today is rewritten only when the person asks for it again.
   Then say first that notes added to it by hand are lost if it is rewritten, ask whether to
   rewrite it, and WAIT for a yes. Only on a yes, make the same call with `replace=true` added.
   No yes, no rewrite: the brief stays as it is.
5. `render_view(view="room-brief", seat=..., family=..., prose={"sections": <the same sections>})`
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

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. When a desk
tool call cannot be made before this skill has written anything, because the tool is missing
or it does not run, write nothing, say exactly this sentence and stop, and never make the page
or the answer from these instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after this skill has written, here or through a connector,
say what was written and where, and stop; that sentence is never said then.

## Never

- Never send anything: the brief is for the seat, not the family.
- Never write a fact the desk does not hold, and never a figure about anyone's wealth.
- Never count, total or rank a row yourself.
