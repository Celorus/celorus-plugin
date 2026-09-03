---
name: triage
description: >-
  Order today's calls from the desk's three queues: names supplied, follow-ups due, book
  moments. Use when someone says "who do I call first", "order my calls", "what's my
  list", "today's calls", or right after the day is opened. Every row carries its reason
  in words and its clock; handle-with-care rows are listed last and never get a pitch.
  Runs with no Celorus account.
---

# Today's calls

You turn the three queues into one ordered list, and every row says why it is where it
is. A ranked output without its reasoning is a black box, and the desk will not act on a
black box.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that contains `celorus/index.md`; the seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. Without a desk, say so in
one line and offer `install-desk`. Without today's board, run `day-open` first.

## What you read

- `celorus/queues/supplied.md`: rows in state `new`, `researched` or `contacted`.
- `celorus/queues/follow-ups.md`: rows in state `due` (by today or earlier) or `replied`.
- `celorus/queues/book.md`: rows dated within the last week.
- `celorus/today/<date>.md`: the first three blocks, as written by `day-open`.
- Each lead's page under `people/`, `families/` or `accounts/` where one exists: its
  `clock`, `last_touch`, `readiness` and the freshest dated line under "What just
  happened".
- `celorus/motion-spec.md`: the lead definition, the clocks and `caps`.
- `celorus/crm/`: the export's name column, for the dedupe.

## The dedupe

A supplied name that also appears in the book (a row in `queues/book.md`, or a name in
the CRM export) is already the desk's. Mark its row `already-yours` in
`queues/supplied.md`, leave it off the list, and count it on the board: "N of the M
supplied names are already yours." This is the desk's own feature: it never calls a
client as if they were new.

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
date, then book moments. Stop at `caps.calls_per_day` from `motion-spec.md`; the rest go
under "Later today" in the same block, in the same order.

## Every row

```markdown
1. **<Name>** · <clock in words> · <the reason: what happened, when, and why that puts them here today> · Source: <supplied-<list id> | book | follow-up | inbound> · <no page yet; research first | page as of <date>>
```

The reason is words, never a score. A supplied name with no page reads "no page yet;
research first" and stays on the list: research is the first call's preparation.

## What you write

- The "Today's calls" block of `celorus/today/<date>.md`, replacing "Ordered by triage."
  and, below the numbered list, the dedupe count and "Later today" when there is one.
- State changes in `celorus/queues/supplied.md`: `already-yours` from the dedupe;
  `researched` once a page exists.
- One line in `celorus/log.md`:
  `- <date> <time> · <handle> · triage · wrote today/<date>.md (today's calls) · yours`.

No row in `desk-log.md`: the research row and the call row come from the skills that do
those things.

## While you work

One plain progress line per step ("Reading the queues", "Checking the book for names
already yours", "Ordering today's calls"). Never name a tool or a path to the user.

## With no account

This skill runs in full with no Celorus account. The register label on every line it
writes is `yours`: the order is the desk's own reading of its own queues.

## Never

- Never invent a reason, an event or a date to justify a rank.
- Never present a handle-with-care row as a prospect or attach a pitch to it.
- Never skip the dedupe.
- Never send anything.

**Next:** `research-lead`, on the first row that has no page yet or whose page is older than its clock allows (a day for money in motion, a week for a reason to call, a month otherwise).
