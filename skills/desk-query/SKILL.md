---
name: desk-query
description: >-
  Ask the desk a question across its book that its own counts answer, such as which families
  had a liquidity event and no touch in a month. Use when someone says "which families in
  Asha's book had a liquidity event this quarter and no touch in 30 days?", "how many
  prospects does Asha have?", or "who has not been touched this month?". The answer is the
  tool's rows, never a count of your own; never sends anything.
---

# Ask the desk

A question across the book, answered by one desk tool: the count first, then one line for
each family, then the question as the tool read it, so the person can check it.

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
  you have not read from a tool's answer in this chat.
- Short sentences. Never write a figure about anyone's wealth.
- Names, not page names: say "the Lakeview family", using the `titles` a tool returns. Where a
  tool asks for a family or a seat, pass its page name or the seat's handle, never the name.
- Every desk tool finds the desk itself: leave `desk` out, and say a refusal about the desk as
  it came.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, and never invent a value it did
  not list.
- This skill writes nothing on the desk.

## Ask the desk

1. Turn the question into `book_query(...)` arguments: `owner` (a seat's handle; a seat's book
   is `owner` that seat with `relationship` client), `relationship` (client, prospect or
   introducer), `event_since` (a day, as YYYY-MM-DD), `no_touch_days`, and `liquidity_only`
   (true when they say liquidity event, sale, listing, IPO or exit; false otherwise). A period
   said in words ("this quarter", "this month") is never made into a date by you: pass
   `event_within_days` when the person gives a number of days, and otherwise ask for the first
   day as a date.
2. Call
   `book_query(owner=..., relationship=..., event_since=..., no_touch_days=..., liquidity_only=...)`,
   or with a number of days,
   `book_query(owner=..., relationship=..., event_within_days=..., no_touch_days=..., liquidity_only=...)`,
   leaving out each argument the question does not name.
3. Answer with the count first, then one line for each family: the signal and its date, and
   the days since the last touch, all from the tool. A row whose `never_touched` is true is
   said in those words, not as a number of days. Then say the query in words, from the answer's
   `query` ("clients owned by Asha, a liquidity signal since 1 July, no touch in over 30
   days"), so they can check it. Each of the answer's `holes` says why a part is not read: say
   that `why` as it came, in one line.
4. If they ask why a family is in or out, use `family_facts(family=<the family's page name>)`.
   Offer the next step: a room brief (the `room-brief` skill) or a reach-out card (the
   `reach-out` skill) for one of them.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. When a desk
tool call cannot be made before this skill has written anything, because the tool is missing
or it does not run, write nothing, say exactly this sentence and stop, and never make the page
or the answer from these instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after this skill has written, here or through a connector,
say what was written and where, and stop; that sentence is never said then.

## Never

- Never send anything.
- Never count, total or rank a row yourself: the count is the tool's.
- Never turn a period in words into a date yourself.
