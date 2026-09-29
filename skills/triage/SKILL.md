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
  seat's role as one of `rm`, `desk-head`, `operator` or `other`. `desk_count` has no view for an
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
- No desk tool yet orders the day's calls, cuts them at the desk's cap, or counts the supplied
  names already yours. Until one does, this skill orders the rows in words, names every row,
  and says no number of its own: no count of names, no position number, no cut made by
  counting rows.

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
the CRM export) is already the desk's. Mark its row `already-yours` in
`queues/supplied.md`, leave it off the list, and name it on the board, in words and with no
number: "Already yours, so left off today's list: <each name>." This is the desk's own
feature: it never calls a client as if they were new.

## The order

Three clocks, in this order, from each lead's page or, with no page, from the queue row:

1. **money in motion**: a dated event on the page inside its window (a sale, a listing, a
   payout, an allotment; the page names it).
2. **a reason to call**: a reply, a due follow-up, a book moment, a supplied name with a
   page, a change of role.
3. **handle with care**: a flag on the page (distress on the record, a suppression, a line
   in `context/never-say.md` that names them). Listed last, with the reason. No pitch, no
   draft, no opener, and the row says what care means.

Within a clock: due follow-ups by their date, then replies, then supplied names by list
date, then book moments. A reply is a row of `queues/follow-ups.md` in state `replied`. A
lead that stands in two queues is one row, placed by the first of them in that order, with
both reasons. A lead with no clock on its page, or with no page, goes under a reason to call.

`cap_calls_per_day` in `motion-spec.md` is the desk's cap on a day's calls. Cutting the list
there is a count of rows, and no desk tool makes that cut yet, so the list is not cut: every
row is listed, in order, and no number is said for the cap.

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
