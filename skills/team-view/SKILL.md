---
name: team-view
description: >-
  Show the desk head the team: the rollup, who is doing what, another seat's console, and
  where the desk stands at this moment as a snapshot; and hand a lead to a seat. Use when
  someone says "show the team", "the rollup", "who is doing what", "assign the Lakeview family
  to Asha", "show Asha's console", "show me where the desk stands", or "take the snapshot
  again after the calls". Draws the page from the desk tools' counts; never sends a mail or a
  message, and a change made through `make` sends the Celorus desk server the desk pages it
  needs.
---

# The team view

The desk head's view of the team: the week's funnel, a row for each seat, and the families
with a signal and no owner, all counted by the desk tools.

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
- The day is the desk's today unless the person names another day; pass other days as `date`
  in YYYY-MM-DD.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- To show a page: `render_view(...)`, made through `make`, answers with a `path` and a `page`. Show the file at
  `path` as it is, in the harness's own way of showing a file. The page is built already, so
  do not edit, retype or restyle it, and do not load a design skill for it. Without `desk`, the
  `path` is relative to the desk folder. Then say one line about what the page shows, naming it
  by `page`. A path is never read aloud. If the harness cannot show a file, say the `page` in
  one line.

## Know the seat

Find the seat as `day-open` does. If it is not known, ask which seat this is, as its handle
(the name of its page under `celorus/seats/`), never the person's name, and write nothing
until it is known. This view is the desk head's: the seat is one whose `role` in
`celorus/seats/<handle>.md` is `desk-head`. For any other seat's own console, use the
`console` skill.

## Show the team

1. Call `team_rollup()`; it counts the desk as it stands on this machine.
2. Through `make`, call `render_view(view="lead-gen")` with no prose and show the page. It carries no written
   summary: its funnel, rows and exceptions say the week.

## Assign a lead

1. Only the desk head hands out leads. If the seat that asked is not one whose `role` in
   `celorus/seats/<handle>.md` is `desk-head`, say so in one line, "Only the desk head hands out
   leads, and this seat is not the desk head.", write nothing, and stop.
2. Through `make`, `assign_lead(at=<now, with its offset>, by_seat=<the handle of the seat that asked>, family=<the family's page name>, to_seat=<the seat's handle>, list_name="new signals")`.
   The assignment is recorded under the seat that asked, never under another seat's handle.
3. `desk_sync(...)`, as "Save to the desk's history" says.
4. Through `make`, `render_view(view="lead-gen")` again and show it: the page counts afresh as it renders, so
   a number is never carried over from the last page or worked out in your head.

## Where the desk stands

The snapshot is the same desk as the team view, stamped with the moment it is taken: the
week's funnel and where it stalls, a row for each seat, and what became of every lead handed
to a seat whose role is `rm`. Call `render_snapshot()` with no prose and show the
page. Every number on it is counted from the records the desk kept while the work was done, so
type none of them and work none of them out. The desk holds one week and the page says so:
never say how it compares with another week, because there is no other week to read. Asked
for it again later in the day, take it again the same way: render it again, so the new page is
stamped with its own moment.

## Another seat's console

Through `make`, call `render_view(view="rep-console", seat=...)` for a seat whose role is `rep`, or
`render_view(view="rm-console", seat=...)` for one whose role is `rm`, with no prose. For an
`rm` seat whose `sentences` is `none`, call `desk_count(view="rm", seat=...)`, write `upsell`
as the `console` skill does, and call
`render_view(view="rm-console", seat=..., prose={"upsell": {...}})` again with it. Show the
page and say which row came from an assignment, if any.

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

- Never send anything: no mail, no invitation, no message.
- Never count, total or rank a row yourself, and never type a number onto a page.
- Never compare the week with another week.
