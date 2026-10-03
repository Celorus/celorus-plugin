---
name: console
description: >-
  Show a seat's console, its work list for the day, and act on a row of it: make a family a
  prospect, put a proposed meeting on the calendar, or write the grow-the-book line for one
  family. Use when someone says "show my console", "my work list", "what's on my list",
  "make them a prospect", "add it to the calendar", or "write the grow-the-book line for the
  Lakeview family". Draws the page from the desk tools' counts; never sends anything.
---

# The console

A seat's console is its work list for the day, drawn as a page: every number and row on it is
counted by the desk tools, and the sentences are yours.

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
- Before writing a line for a page, read `celorus/context/tone.md` and
  `celorus/context/never-say.md` once in this chat, and follow them.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- To show a page: `render_view(...)` answers with a `path` and a `page`. Show the file at
  `path` as it is, in the harness's own way of showing a file. The page is built already, so
  do not edit, retype or restyle it, and do not load a design skill for it. Without `desk`, the
  `path` is relative to the desk folder. Then say one line about what the page shows, naming it
  by `page`. A path is never read aloud. If the harness cannot show a file, say the `page` in
  one line.

## Know the seat and its page

Find the seat as `day-open` does. If it is not known, ask which seat this is, as its handle
(the name of its page under `celorus/seats/`), never the person's name, and write nothing
until it is known. Remember it for the rest of the chat, and switch when the person says they
are another seat now.

The seat's `role` in `celorus/seats/<handle>.md` names its console: a seat whose role is `rep`
is counted by `view` `rep` and drawn as `rep-console`; a seat whose role is `rm` is counted by
`view` `rm` and drawn as `rm-console`. For a `desk-head` seat, or anyone asking to see another
seat's console as the desk head, use the `team-view` skill. No view counts an `operator` or
`other` seat: say so in one line and stop.

## Show the console

1. Call `desk_count(view="rep", seat=...)` or `desk_count(view="rm", seat=...)`. Pass
   `systems` only when a connector's rows already come in the desk's row shape, as the
   stand-in systems give them; then pass them whole, and never pick, drop, count or reorder a
   row yourself. Otherwise pass no `systems`. Each of the answer's `holes` says why a part is
   not counted: say that `why` as it came, in one line.
2. The console carries no written summary: its numbers and rows say what to do first, so write
   none. For a seat whose role is `rm`, write `upsell`: for each row in `blocks.grow_the_book`,
   one line keyed by the family's page name, naming the signal and the product that fits it
   and why now; if the row says `needs_connection`, write "Connect the product list to see what
   fits."
3. Call `render_view(view="rep-console", seat=...)` or
   `render_view(view="rm-console", seat=..., prose={"upsell": {...}})` with the same `systems`,
   and show the page.

## Acting on a row

Every count and render in this section passes the same `systems` the page on screen drew, or
none if it drew none. This rule holds wherever this skill counts again after a write through a
connector. Count again with the same `systems` the page drew, plus the one row the write made,
added to the list it belongs to: the event the calendar's create answered goes into
`calendar.events`, and the record the CRM's create answered goes into `crm.records`. Nothing
else in `systems` changes, and nothing is read or written again for the count. If the page drew
no rows for that system, or the connector's answer does not give the row in the desk's row
shape, count with the page's `systems` unchanged, and say the change is made in that system but
this page does not show it. Never say a row left or arrived that the count does not show.

**Make a family a prospect** ("make them a prospect"):
1. `family_facts(family=<the family's page name>)` for the decision maker, their firm and role,
   and the family's city.
2. Create the record through the harness's CRM connector: the decision maker's name, company,
   designation and city, the seat as its owner, and the family's page name as the desk's
   reference. Its answer's id is the new record. If there is no CRM connector, or it refuses,
   say so in one line and stop: nothing was written.
3. `log_action(at=<now, with its offset>, seat=..., family=<the family's page name>, action="prospect-created", outcome="CRM record <id> created")`,
   then `desk_sync(...)`, as "Save to the desk's history" says.
   If log_action refuses the outcome, say in one line that the record is made in the CRM and the
   desk did not record it, in the refusal's words, and stop. Never change an id to make the line
   pass.
4. Count and render the console again as the rule above says: the page's `systems`, with the
   new record added to `crm.records` and the activities as drawn:
   `desk_count(view=..., seat=..., systems=...)`, then
   `render_view(view=..., seat=..., systems=...)` for a seat whose role is `rep`, or
   `render_view(view=..., seat=..., systems=..., prose={"upsell": {...}})` with the prose you
   wrote for a seat whose role is `rm`, and show it. The page counts afresh as it renders, so a
   number is never carried over from the last page or worked out in your head. Say: "The CRM
   record is made."

**The grow-the-book line for one family** (a seat whose role is `rm`):
1. `family_facts(family=<the family's page name>)`: its signals, what it holds, and the
   products that fit.
2. Write one line: the signal and its date, the product that fits and why now. No figure.
3. `render_view(view="rm-console", seat=..., prose={"upsell": {...}})` again, with that
   family's `upsell` line replaced and the rest kept, and show it.

**Who a record in the CRM is** ("who is <name> in the CRM?"):
1. The CRM is read only for a person on the desk, as "Never" says. The person belongs to the
   family on a row: the family this chat last acted on, or the one the person names. If
   neither is known, ask which family, and read nothing until it is.
   `family_facts(family=<the family's page name>)` names its people. If the name asked about
   is not one of them, say in one line that this name is not on the desk, so the CRM is not
   read for it, and stop.
2. Search the CRM for that name through the harness's CRM connector: a read, and nothing else.
   If there is no CRM connector, or it refuses, say so in one line and stop.
3. Say what the connector returned: each record by its id, with the fields it gave, in its
   words. If it returned none, say so. Never say which record is the person, which is the
   family's, or that two records are one person: say only what the connector returned, and
   the person decides. Nothing is written, on the desk or in the CRM.

**Merge two records in the CRM** ("merge them", of records "Who a record in the CRM is" returned in this chat):
1. This merges records in the CRM, never pages on the desk, and only records
   "Who a record in the CRM is" returned in this chat. If it returned none in this chat,
   "merge them" is not this step: two pages on the desk that are one are merged as
   `check-desk` says in "Merge two pages". Say so in one line, and stop.
2. The two records are ones that lookup returned for one family, named by their ids; records it
   returned for two families are never merged here. If it returned more than two and the person
   has not said which, ask. Ask which record stays unless the person has said; never choose it
   yourself, and never say the two are one person.
3. Where the CRM connector has no merge of its own, say this one line: "The CRM connector has
   no merge, so both records stay as they are." Write nothing, and stop. Never make a merge
   some other way: no record is edited, moved or deleted in its place.
4. Merge the two through the harness's CRM connector, ONE call: the record that stays and the
   one merged into it, with the seat as who asked where the connector takes it. If it
   refuses, say so in one line and stop.
5. Say what the connector answered, in its words: the record kept, by its id, and what it says
   of the other. The page on screen does not show the merge.
6. Only after the connector has answered the merge, and with the family the lookup read the CRM for:
   `log_action(at=<now, with its offset>, seat=..., family=<the family's page name>, action="crm-merged", outcome="CRM record <the kept id> kept, <the other id> merged into it")`,
   then `desk_sync(...)`, as "Save to the desk's history" says.
   If log_action refuses the outcome, say in one line that the merge is made in the CRM and the
   desk did not record it, in the refusal's words, and stop. Never change an id to make the line
   pass.

## The hold: put a proposed meeting on the calendar

("add it to the calendar", "add it to the calendar at eleven on Thursday")

1. The meeting is a row of `blocks.to_calendar` in the count you just read. If that block has
   no row, there is no proposed meeting: say so in one line and stop, writing nothing. If there
   is more than one row and the person did not name the family, ask which. If they asked for a
   time and named none, ask for it. A day said in words ("Thursday") is counted from the `date`
   that count answered, which is the desk's today, never from your own clock.
2. The time is the `start` and `end` of the row's `hold`. For a time the person names, change
   only `start`, to that time on the day they said, and `end`, to one hour after unless they
   said how long; times carry `+05:30`.
3. Nothing is double-booked, and the check is the engine's, never yours. Read that day first,
   through the harness's calendar connector: the hold's seat's own calendar and that day alone,
   never another's and never a listing of calendars. Then
   `propose_hold(seat=..., about=<the row's family, as its page name>, start=..., end=..., day=<the day the listing was for>, events=...)`,
   with every event the listing gave, each as its start and end alone. When the listing came
   back empty, pass an empty list and say so:
   `propose_hold(seat=..., about=..., start=..., end=..., day=..., events=..., listing_empty=true)`.
   A clash or a time not said is refused, and the refusal says why: say what it said, ask for
   another time, and never move the time yourself. Create nothing until `propose_hold` has
   answered a hold.
4. Create the event through the harness's calendar connector, ONE call, straight after, and
   only as `propose_hold` answered it: its title, start and end exactly, on the seat's own
   calendar, with NO guest, since a guest is an invitation mailed and nothing is sent. The
   calendar guard lets only that hold through, and only for a few minutes: a create it refuses
   is never tried another way. Where the connector's create names them, the event carries the
   row's `family`, as its page name, and its `kind` as `meeting`: the count knows a proposal is
   on the calendar only by an event with that family and a kind of `meeting` or `hold`. Name
   the seats in the event's description, one line each, `seat: <handle>` for each of the
   hold's `attendees` that is a seat, and nothing else: the family's people are never written
   on the calendar. If the calendar is not connected or refuses, say one plain line, "The
   calendar did not take the meeting this time.", and never try it again.
5. Count and render the page again as "Acting on a row" says for a count after a write: the
   page's `systems`, with the event the create answered added to `calendar.events`, and every
   proposal as drawn:
   `desk_count(view=..., seat=..., systems=...)` then
   `render_view(view=..., seat=..., systems=...)`. If the page on screen is the morning brief,
   count and render the brief instead, as `day-open` does. Say the row has left only if the new
   count no longer holds it. If it still does, say the meeting is on the calendar but still on
   the page, because the count could not match the event to that row. Other proposals stay
   on the page. Never adjust a number by hand.
6. `desk_sync(...)`, as "Save to the desk's history" says. The meeting is on the calendar, not
   on the desk, so there will usually be nothing to commit: say the meeting is on the calendar
   and there was nothing on the desk to save. Never write to the desk just to have something
   to save.

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

- Never send anything: no mail, no invitation, no message.
- Never count, total or rank a row yourself, and never type a number onto a page.
- Never read a connector for anyone who is not on the desk.
