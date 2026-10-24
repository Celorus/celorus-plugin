---
name: day-open
description: >-
  Open the sales day from the desk workspace: what moved overnight, what is due today,
  what is on the clock. Use when someone says "open my day", "what changed", "did anyone
  reply", "what's due today", "show my brief for tomorrow", or at the start of the working
  day; the Celorus session bootstrap points here. Reads the desk's queues and, where the
  harness has them, the mailbox, calendar and CRM for replies and meetings; writes today's
  board. Free; each change it makes to the desk asks for a free Celorus sign-in before it is made.
---

# Open the day

You answer the first question of the day: what moved overnight, who replied, what is due,
what is on the clock. Then you hand the day to `triage` for the ordered list. This is the
console's "working today" lane written as a file: moved overnight, due from your queue,
done.

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

- `desk_count` answers the seat's day: `view` `brief` for the morning brief, with the seat's
  handle as `seat`. The view is the one the seat's role is counted by (the `role` in
  `celorus/seats/<handle>.md`): `view` `brief` for a seat whose role is `rm`, `desk-head` or
  `rep`, and `team_rollup` as well for a `desk-head` seat's team. The desk's install writes a
  seat's role as one of `rep`, `rm`, `desk-head`, `operator` or `other`, and an SDR seat's is `rep`.
  `desk_count` has no view for an `operator` or `other` seat: for one, call no `desk_count` and
  draw no brief; work from `book_query` and the queues, and say no count for the seat.
- Pass `systems` only when a connector's rows already come in the desk's row shape, as the
  stand-in systems give them: each mail thread with its `seat`, `family` and `critical`, each
  message with its `from_seat`, each time in IST. Then pass them whole (`calendar`, `mail`,
  `crm`, `chat`): never pick, drop, count or reorder a row yourself. Otherwise pass no
  `systems`, and say in one line that the connector was read but its rows are not counted. Never
  add, guess or convert a field to make a row fit: not a seat, a family, a `critical` flag, a
  `from_seat` or a time zone.
- Each of the answer's `holes` says why a part is not counted, a connector not handed over or no
  family pages on the desk; say that `why` as it came, in one line, inside the block it would
  have fed.
- A day the seat says in words ("tomorrow", "Tuesday") is never made into a date by you, from
  your own clock or from the desk's today: no desk tool takes a day in words yet. Leave `date`
  out for the desk's today and read the `date` `desk_count` answers; for any other day, ask the
  seat for it as a date and pass that as `date`, like 2026-09-21. For a seat no view counts, call
  `book_query` with no `date` instead and read the day from its `query.today`.
- `render_view` with `view` `morning-brief`, through `make`, draws the seat's brief as a page.
- `check_desk` answers what on the desk needs attention.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- No desk tool yet counts the new names on a supplied list, the follow-ups due, or the day's
  events for a desk without family pages. Until one does, name those rows in words and give
  no number for them: never count them yourself.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that holds a `celorus` entry of any kind: the walk
never passes that folder to reach a desk above, a folder whose entry is not a plain desk is
refused or named by the tools, and only when no such folder exists is there no desk. If neither
exists, say in one line that there is no desk here, offer `install-desk`, and stop. The
seat is `CELORUS_SEAT`, or the handle in `~/.celorus/seat-<desk_id>` (the `desk_id` is
in `celorus/desk.md`); if neither exists, ask which seat this is, as its handle (the name of
its page under `celorus/seats/`), never the person's name, write nothing until it is known,
and say that `install-desk` can claim it for next time. When the person asks for another
seat's day, use that seat.

If `celorus/desk.md` is missing, the desk is layout 1, or a layout 2 desk whose desk.md is
lost; `celorus/index.md` tells them apart. If its header holds a nested `celorus` block, the
desk is on layout 1: read and write it as `../install-desk/layout-1.md` says, and say once
that "update my desk" moves it to layout 2. If its header holds only `okf_version: "0.2"`,
say once that `desk.md` is lost and should be restored from the copy taken before the last
update or from the desk's history, and open the day without the stamps.

If the desk is on layout 1, or the `model_version` in `celorus/desk.md` is lower than the one
in the plugin's `../install-desk/model/model.md`, put one line at the top of the board: "A newer desk model
is ready. Say "update my desk" to see what changes first." Never update from day-open. On a
seat's graph, skip this check and say nothing of it: the desk server does not keep an update
there for now, and the board is the overnight's.

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
6. The calendar, the CRM and chat, through their connectors when they exist: today's
   events, the account's own rows and the messages that name the account, read in full,
   for the same accounts and no others.

What matters from those reads lands on the account's page as source-tagged lines, each
one dated and labelled with the source it came from, and removable in one operation.
The desk's files are yours. What is read here leaves this computer only in a change made
through `make`, which sends the Celorus desk server the desk pages it needs, these lines among
them, the connectors' rows it is handed (`systems`), and the brief's gists.

## Which sources the desk has

The day's sources are the calendar, mail, the CRM and chat. Before anything is read, look
through the tools this session holds and find each source by what a tool does, never by a
tool's or a server's name: a tool that lists or reads calendar events is the calendar; a tool
that searches or reads mail threads is mail; a tool that searches or reads contact, account or
deal records is the CRM; a tool that reads channel or direct messages is chat. A connector may
sit under a name that says nothing of what it does, and it is found all the same. The plugin
brings none of these connectors: they are the ones this seat's harness has connected.

A tool found this way is admitted as its source only when either of these holds:

- The desk's systems table (below) names its connector for that source's role. The table
  vouches for it, and it is admitted, even when its data is a stand-in.
- The table does not name it, and it reads the seat's own account: the calendar, mail, CRM or
  chat the seat itself connected.

Never admit this plugin's own tools as a source when the table does not name them: they read the
record or the desk, never the seat's account. Never admit a tool the table does not name when
its own description, or its server's, says its data is synthetic, a stand-in or a demo.

The systems table is read for its `connector` and for its `state`, and the uses never mix. Its
`connector` column admits a tool: a tool whose connector the table names for the role is
admitted, as above. Its `state` column never blocks a read: an admitted tool is read whether the
row says `connected` or `still to connect`, since a system connected after set-up still reads
`still to connect` there.

This look comes before the table's state: an admitted tool is read, whatever the row's state
says. When its read succeeds, the source is read. When its read fails, the source is present but
unreadable, with the reason the connector gave, as it came.

Only when the session holds no admitted tool for a source does the systems table say what the
desk has. It is the table
the set-up wrote at the end of `celorus/desk.md`, under `## Systems`, with the columns `role`,
`connector` and `state`: its `connector` is the name the harness showed at set-up, or `·` where
it showed none, and its `state` is `connected` or `still to connect`, or `none on this desk`.
The table is what the set-up recorded; afterwards the update changes only a row's `state`, from
`still to connect` to `none on this desk`, where the person said the firm has no such system.
Read it for the source's role (`calendar`, `mail`, `crm` or `chat`):

- A row that names a connector, `connected` or `still to connect`: the source is present but
  unreadable, in these words: "recorded at set-up as <its name>, no tool in this session reads
  it", with the name as the row gives it.
- A row whose `connector` is `·` and whose `state` is `still to connect`: the desk has none.
- A row whose `state` is `none on this desk`: the desk has none, said in its role's words alone:
  "no calendar on this desk", "no mail on this desk", "no CRM on this desk" or "no chat on this
  desk", with no sentence after it, so its Sources line is "- CRM: no CRM on this desk." for a
  CRM row. The set-up or the update wrote that state only on the person's word that the firm
  has no such system.
- No row for the role: the desk has none.
- No systems table in `desk.md` at all, as on a desk set up before the table, or no `desk.md`:
  the desk has none.

A source the desk has none of, other than a row `none on this desk`, is said as "no calendar on
this desk", "no mail on this desk", "no CRM on this desk" or "no chat on this desk", followed by
this sentence, as it is: "If the
desk has such a system, connect it in your account's connectors; then say "check my desk
setup" to see it listed as connected."

When the table's row for the role has `·` as its `connector` and `still to connect` as its
`state`, that sentence is followed by this sentence, as it is: "If the firm has none, say
"update my desk" to record that." It follows no other case: not a role with no row, not a desk
with no systems table, and never a row recorded `none on this desk`.

So every source is in the state that fits it, and in no other: read; none on this desk; or
present but unreadable, with the reason. The board's `## Sources` block (below) names the
calendar, mail, the CRM and chat on every board, each in its state: absence is said, never left
out. A source that is not read is also said in one line inside the block it would have fed, in
the same words. Never say that a source the desk does not have could not be read, and never
invent a reply or a meeting.

In the board's header, `sources_read` holds the queue files and each source read (`calendar`,
`mail`, `crm`, `chat`), and `sources_missing` holds only the sources present but unreadable. A
source the desk has none of is in neither.

## The morning brief

On a desk with family pages, the seat's day is also a page, for a seat whose role a view
counts. Call `desk_count` with `view` `brief`, the seat, the day and `systems` where the rows fit
the desk's shape (above), and read `desk_count.numbers` and its rows. Then, through `make`,
call `render_view` with `view`
`morning-brief`, the same seat, day and `systems`, and `prose` with
only `gists`: for each mail thread in the brief's critical mail, keyed by its id, one text of
two short sentences, what they asked and what a reply needs. The page carries no written summary: its numbers and
rows say the day, so write none. Show the page from the `path` the render answers, as it is,
never retyped or restyled, and say one line about what it shows. That `path` is a full path only
when the render was called with `desk`; without `desk` it is relative to the desk folder
(above), so publish or open the page from there. Close with one line: the
first thing to do this morning, and why.

## What you write

On a seat's graph (`celorus/desk.md` says `layout_version: 3`), the overnight on the desk
server writes the day's board, at `celorus/personal/today/<date>.md`: read it and show it, and
never write it by hand. With no board there yet, say that the overnight has not
written today's board, and go on. On any other desk, this skill writes the board:

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
sources_read: [queues/follow-ups.md, queues/supplied.md, queues/book.md, calendar, chat]
sources_missing: [mail]
---

# <weekday> <day> <month> <year>

## Moved overnight

- <Name> replied on <date>: <subject line>. · yours · <date>
- New names on list <list id> (<date>): <each name, in the list's order>.
- Nothing read: mail present but unreadable: recorded at set-up as <its name>, no tool in this session reads it.   (when the desk has it and it cannot be read)
- Nothing read: no mail on this desk.   (when the desk has none)

## Due today

- We owe <Name>: <what>, by <date>, from <the conversation page>. · yours · <date of the conversation>
- <Name> owes us: <what>, by <date>, from <the conversation page>. · yours · <date of the conversation>

## On the clock

- <HH:MM> <event title> with <names>; page: `people/<slug>.md` where one exists.

## Sources

- Calendar: read.
- Mail: present but unreadable: recorded at set-up as <its name>, no tool in this session reads it.
- CRM: no CRM on this desk. If the desk has such a system, connect it in your account's connectors; then say "check my desk setup" to see it listed as connected.
- Chat: read.

## Today's calls

Ordered by triage.

## Done

```

The example's sources show each state: the calendar and chat read, mail present but
unreadable and so in `sources_missing`, and no CRM on this desk, in neither list.

Every line under "Moved overnight", "Due today" and "On the clock" is the desk's own
knowledge and carries the register label `yours` with the date. A reply is a fact about
the desk's mailbox, not about the subject.

Then:

On a seat's graph, this skill changes nothing by hand: it marks no follow-up `replied`, writes no day row in `desk-log.md` and no line in `log.md`, since a page changed by hand stops the next pull. It names each reply in the chat instead, and says the desk keeps it when a desk tool does. On any other desk:

- In `celorus/queues/follow-ups.md`, a row whose person replied gets state `replied`.
  The row stays; `follow-up` decides what comes next.
- Call `check_desk` over the whole desk, and when its `findings` are not empty, add one line
  at the end of "Due today" with its `summary` as it came:
  `- <the check's summary>: views/needs-attention.md. · yours · <date>`.
  Leave the line out when `findings` is empty. Never count the findings yourself.
- Append the day header row to `celorus/desk-log.md`:
  `| <date> | <handle> | day | · | · | open | opened | · | day-open |`.
  The outcome says no number until a desk tool counts the day's new names, due follow-ups and
  events. Run twice in one day and the board's first three blocks are refreshed in place,
  as is its sources block; "Today's calls" and "Done" are left alone, and no second header row
  is written. A board written earlier with no `## Sources` block has the block added after
  "On the clock", and its `sources_read` and `sources_missing` are set to agree with it.
- Append one line to `celorus/log.md`, directly under today's heading `## <date>` (add it
  above the older days if missing) and above the day's earlier lines, newest first as the
  desk tools write them, with `<time>` as two-digit `HH:MM`:
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

- Never read a source for a name that is not on the desk: the scope is the queued,
  named and booked accounts, never the whole mailbox.
- Never upload what you read anywhere but through `make`. The Celorus desk server sees only
  what a change made through `make` sends it: the desk pages that change needs, and the
  arguments the step gives it, such as the brief's gists.
- Never read mail from anyone not named in the queues or the last board.
- Never invent a reply, a meeting or a signal to fill an empty block.
- Never send anything.

**Next:** `triage`. When this skill is done, today's board has moved overnight, due today and on the clock.
