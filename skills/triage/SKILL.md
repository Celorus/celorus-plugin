---
name: triage
description: >-
  Order today's calls from the desk's queues: names supplied, follow-ups due, book
  moments. Use when someone says "who do I call first", "order my calls", "what's my
  list", "today's calls", or right after the day is opened. Every row carries its reason
  in words and its clock; handle-with-care rows are listed last and never get a pitch.
  Runs with no Celorus account.
---

# Today's calls

You turn the queues into one ordered list, and every row says why it is where it
is. A ranked output without its reasoning is a black box, and the desk will not act on a
black box.

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

- `book_query`, for the book moments of families on the desk: `owner` the seat's handle,
  `event_within_days` `6`, the days back from the tool's own day (its `query.today`;
  never your own clock), and `liquidity_only` `false`, so a
  change of role or any other signal is read as well as a liquidity event. Its rows carry each
  family's signal and last touch. Pass it `systems` as below. `book_query`'s `holes` are said
  as `desk_count`'s are: each `why` as it came.
- `desk_count`, for the seat's own rows of the day, with the seat's handle as `seat` and the view
  its role is counted by (the `role` in `celorus/seats/<handle>.md`): `view` `rm` for a seat whose
  role is `rm`; `view` `brief` for a seat whose role is `desk-head`, and `team_rollup` for the
  team; `view` `rep` only for a seat whose role is `rep`, an SDR. The desk's install writes a
  seat's role as one of `rep`, `rm`, `desk-head`, `operator` or `other`. `desk_count` has no view for an
  `operator` or `other` seat: for one, call no `desk_count`; work from `book_query` and the
  queues, and say no count for the seat.
- Pass `systems` only when a connector's rows already come in the desk's row shape, as the
  stand-in systems give them: each mail thread with its `seat`, `family` and `critical`, each
  message with its `from_seat`, each time in IST. Then pass them whole: never pick, drop, count
  or reorder a row yourself. Otherwise pass no `systems`, and say in one line that the connector
  was read but its rows are not counted. Never add, guess or convert a field to make a row fit:
  not a seat, a family, a `critical` flag, a `from_seat` or a time zone.
- Each answer's `holes` says why a part is not counted or not read, a connector not handed over
  or no family pages on the desk; say that `why` as it came.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- `desk_count` with `count` in place of `view` answers a part of the seat's day, for a seat of
  any role, `operator` and `other` among them. `count` `calls_for_today` answers the day's
  calls, already in order and already cut at the desk's cap. `count` `supplied_already_yours`
  answers the supplied names already yours: say it as the tool answers it, and where its
  `available` is `false`, say its `reason` as it came and nothing else from that answer. This
  skill writes the rows as answered and says no number of its own: it puts no row in order,
  makes no cut, moves no row between the lists, and writes no position number, only what the
  tool answered.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that holds a `celorus` entry of any kind: the walk
never passes that folder to reach a desk above, a folder whose entry is not a plain desk is
refused or named by the tools, and only when no such folder exists is there no desk. The seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. Without a desk, say so in
one line and offer `install-desk`. Without a seat, ask which seat this is, as its handle (the
name of its page under `celorus/seats/`), never the person's name, and write nothing until it
is known. Without today's board, run `day-open` first.

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

## What you read

- `celorus/queues/supplied.md`: rows in state `new`, `researched` or `contacted`.
- `celorus/queues/follow-ups.md`: rows in state `due` (by today or earlier) or `replied`.
- `celorus/queues/book.md`: rows dated within the last week.
- `celorus/today/<date>.md`: the first three blocks, as written by `day-open`.
- Each lead's page under `people/`, `families/` or `firms/` where one exists: its
  `clock`, `last_touch` and the freshest dated line under "What just happened". A
  `readiness` score on an older page is a number no tool gave: never say it.
- `celorus/motion-spec.md`: the lead definition, the `clocks` and `cap_calls_per_day`.
- `celorus/crm/`: the export's name column, for the dedupe.
- A list the user describes as bought or scraped is never queued or ordered: say so in one
  line and leave its names off the day.

## The dedupe

A supplied name that also appears in the book (a row in `queues/book.md`, or a name in
the CRM export) is already the desk's. The desk tool leaves it off the list and names it
under `already_yours` of `calls_for_today`, with what matched. Mark the row of each name
there `already-yours` in `queues/supplied.md`, and name it on the board, in words and with no
number: "Already yours, so left off today's list: <each name>." This is the desk's own
feature: it never calls a client as if they were new.

## The order

The order and the cut are the desk tool's. Call `desk_count` with `count` `calls_for_today`
and the seat's handle as `seat`, and no `view`. It answers the day's calls under `today`, in
order, the rows past the desk's cap under `later_today`, in order, and the handle-with-care
rows under `handle_with_care`. Write `today` from the top as it came. Below it write
`later_today`, under a line saying these rows are past the day's cap. Write
`handle_with_care` last, each row with its reason: no pitch, no draft, no opener, and the
row says what care means.

Each row is a lead with every reason it has. Write the row from its fields and from nothing
else: the name from `title`; the clock from `clock`; the reason from `what_just_happened`
and from the rows under `follow_up`, `reply`, `supplied` and `book_moment`, every kind the
row carries; the source from `source`; the page from `page_as_of`, or, where `no_page` is
`true`, the words the row shape below gives a lead with no page. Where `no_clock` or
`clock_not_listed` holds words, say them as they came.

`cap_calls_per_day` in `motion-spec.md` is the desk's cap on a day's calls, and the tool makes
the cut there: `cap` is the cap it read. Where the desk sets no cap the tool can use, `cap`
is `null`, `later_today` is empty and `no_cut` holds a sentence: say that sentence as it
came and list every row, and no number is said for the cap.

The order of clocks is the desk's list of clocks in `motion-spec.md`. Where the tool cannot
read a list there, `no_clocks` holds a sentence: say that sentence as it came.

Where `no_seat` holds rows, write them after the rest, under a line saying these rows are
nobody's yet: no seat is named for them, so they are on no seat's day. Write each from its
fields as any other row. A row there whose clock is handle-with-care gets no pitch, no draft
and no opener.

## Every row

```markdown
- **<Name>** · <clock in words> · <the reason: what happened, when, and why that puts them here today> · Source: <supplied-<list id> | book | follow-up | inbound> · <no page yet; research first | page as of <date>>
```

Rows are in order from the top, one bullet each, with no position number.

The reason is words, never a score. A supplied name with no page reads "no page yet;
research first" and stays on the list: research is the first call's preparation.

## What you write

- The "Today's calls" block of `celorus/today/<date>.md`, replacing "Ordered by triage."
  and, below the list, the names already yours.
- State changes in `celorus/queues/supplied.md`: `already-yours` from the dedupe;
  `researched` once a page exists.
- One line in `celorus/log.md`, directly under today's heading `## <date>` (add the heading
  above the older days if missing) and above the day's earlier lines, newest first as the desk
  tools write them, with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · triage · wrote today/<date>.md (today's calls) · yours`.

No row in `desk-log.md`: the research row and the call row come from the skills that do
those things.

## While you work

One plain progress line per step ("Reading the queues", "Checking the book for names
already yours", "Ordering today's calls"). Never name a tool or a path to the user.

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

## With no account

This skill runs in full with no Celorus account. The register label on every line it
writes is `yours`: the order is the desk's own reading of its own queues.

## Never

- Never invent a reason, an event or a date to justify a rank.
- Never present a handle-with-care row as a prospect or attach a pitch to it.
- Never skip the dedupe.
- Never send anything.

**Next:** `research-lead`, on the first row that has no page yet or whose page is older than its clock allows (a day for money in motion, a week for a reason to call, a month otherwise).
