---
name: research-lead
description: >-
  Research a lead: a person, a family or a company, from the desk's queue or by name.
  Use when someone says "research this lead", "who is this", "what do we know about",
  "look up this company", "look up this person", or from triage. Runs the web register on
  the harness's own search, asks the record whether it holds anything, reads the record
  when an account is connected, and writes one profile page in the desk workspace with
  every line labelled by which class of truth it is. Runs with no Celorus account.
---

# Research a lead

Fifteen to thirty minutes of manual digging per lead is the drudgery this skill removes.
You produce one page the day can reuse, in the house format, with every line carrying
its register: `record`, `web` or `yours`. What the web could not establish is listed at
the end, plainly, because that list is the honest close and it is what the record holds.

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that contains `celorus/index.md`; the seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. With no desk, still do the
research and present the page in the conversation, then offer `install-desk`; a page is
written to disk only inside a desk.

## Start the clock

Note the time you start. The minutes from here to the written page go into the desk log
as `minutes`. This number is the instrument the desk is measured with; keep it honest,
and never round it down.

## Step 1: what the desk already holds (`yours`)

Read the existing page if there is one, the queue row, the CRM export's row for this name
in `celorus/crm/` (name, employer, stage, owner, last touch; nothing else), and
`celorus/context/notes.md`. Every line from here is labelled `yours · <where it came from>
· <date>`. It is the desk's knowledge, never a fact about the subject.

## Step 2: the web register

Use the harness's own search and fetch tools, on the user's own subscription. If this
session has no search tool, say so in one line and go to step 3; never fill the gap from
memory, and never estimate.

Follow `source-ladder.md`: the company ladder for a company, the people ladder for a
person or a family, top to bottom, stopping when the page's sections are filled or the
ladder is exhausted. Every web line reads:

```markdown
- <the fact> · web · unverified · <source url> · <date read>
```

Two independent sources or the line ends `· medium confidence`. One aggregator is never
enough for a title or a role. A profile page that will not fetch is used only through
the search summary, and says so. A figure from the web carries its URL and date or is not
written at all.

## Step 3: the record

**3a, the check.** If a `celorus-check` connection is present in this session, call its
`check_record` tool once with the name and the kind (`company` or `person`), unless
`.celorus/cache/check-<slug>.md` holds an answer less than a day old or the existing page
already carries a `resource:` line. It answers whether the name is on the record and how
much it holds: counts only, never a figure. Write the answer to
`.celorus/cache/check-<slug>.md` with the time. If the connection is absent, skip this
step silently.

**3b, with an account connected** (the `celorus-data` tools are present and answer): fetch
the honesty rules once with `get_semantic_metadata` (product `aoc4`, kind
`honesty_rules`) and follow them verbatim; then `resolve_subject` with the name (on
`clarify`, ask the user which candidate, never pick); for a company,
`list_available_subdomains` and then `get_subdomain_data` for what the page needs (the
identity, the freshest events, the people behind it); for a person, `get_people` on the
employer where known and `get_person_profile`. Every figure verbatim as the tool gives it.
Each record line reads `<the fact> · record · <as of>`; its citation goes into the
frontmatter `citations` list and opens only when the desk asks where a fact came from.
Bands only; masked coordinates exactly as rendered; the tier shown on anything the record
did not file.

**3c, with no account:** say the counts line from the check, if there was one, in this
lane's wording (below), and nothing else from the record. Y is the number of entries in
the check's list of years, never the list itself.

## Step 4: write the page

`profile-shape.md` is the contract; follow it section by section, every section present
even when it reads "Not established". The path is `celorus/people/<slug>.md`,
`celorus/families/<slug>.md` or `celorus/accounts/<slug>.md`; the slug is the canonical
name, lowercase, hyphenated. A family is the page unit for a wealth desk: the family page
lists its principals, each with their own person page, and carries the household
aggregate only.

If a page exists, update it: keep every older line the new read did not contradict, show
a contradiction on two lines with the record winning, bump `timestamp`, and add to
`registers_used`.

Then:

- Append the research row to `celorus/desk-log.md`:
  `| <date> | <handle> | <slug> | <source> | <minutes> | research | not-yet | · | research-lead |`.
  `<source>` is one of `supplied-<list>`, `book`, `follow-up` or `inbound`.
- Update the lead's reason line on today's board if the research changed it.
- Mark the queue row `researched` in `celorus/queues/supplied.md`.
- Append one line to `celorus/log.md`:
  `- <date> <time> · <handle> · research-lead · wrote people/<slug>.md · <registers used>`.

## When no account is connected

Say the counts line once, after the web register, in the wording of the lane you are
running on, and nothing more:

- **Claude Code, Cowork, Claude Desktop:** The record holds N filings across Y years for this company. Connect Celorus (run `/mcp` and sign in) to read them.
- **Kimi Code:** The record holds N filings across Y years for this company. Connect Celorus (sign in through the celorus-data connection) to read them.
- **Codex, ChatGPT:** The record holds N filings across Y years for this company. Reading them needs a Celorus account connected to this plugin.

For a person the first sentence reads "The record holds N filings naming this person."
When no check ran, the line reads "The record was not asked." When the check found nothing,
it reads "This name is not on the record."

## While you work

One plain progress line per step ("Reading what the desk already holds", "Searching the
web for the company", "Asking whether the record holds anything", "Writing the page").
Never name a tool, a stream or a path to the user.

## With no account

The web register and the check run in full; the page is written with `web` and `yours`
lines and a full "Not established" section. Connecting adds the `record` register: the
figures, the filings, the people behind a company, each verbatim and cited.

## Never

- Never state a web figure as a record figure, or blend the two in one line.
- Never write a point estimate of anyone's wealth; a band or nothing.
- Never unmask a contact coordinate; social and web coordinates in full, work and
  personal contact coordinates masked exactly as the tool renders them.
- Never infer a family relationship, a community or anything protected from a surname, a
  locality or a co-appearance; never name or profile a minor.
- Never fill from memory or general knowledge; "Not established" is the honest line.
- Never send anything.

**Next:** `room-brief` when a meeting with this lead is on the clock and `draft-opener` when the desk asks for an opener (until those skills are installed, say the brief or the opener is written by hand from this page); otherwise back to `triage`'s list. When this skill is done, the lead's page exists and a research row is in the desk log.
