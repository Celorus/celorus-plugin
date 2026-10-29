---
name: research-lead
description: >-
  Research a lead: a person, a family or a company, from the desk's queue or by name.
  Use when someone says "research this lead", "who is this", "what do we know about",
  "look up this company", "look up this person", or from triage. Runs the web register on
  the harness's own search, reads the record when this session is signed in to it,
  and writes one profile page in the desk workspace (on a
  hosted desk, shows it in the chat) with every line labelled by which class of truth it is. Free: the web register runs on this machine
  without signing in, and writing the page asks for a free Celorus sign-in before it is made.
---

# Research a lead

The manual digging each lead takes is the drudgery this skill removes.
You produce one page the day can reuse, in the house format, with every line carrying
its register: `record`, `web` or `yours`. What the web could not establish is listed at
the end, plainly, because that list is the honest close and it is what the record holds.

## House rules

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

These hold over every section of this skill. Where a section below seems to ask for something
they forbid, they win.

Until a `celorus-data` call has come back with data in this session, a `celorus-data`
answer that is not data (a sign-in ask, a refusal, an error, an empty or unreadable
reply), and a session with no `celorus-data` tool to call, are not a tool that cannot
run: the record step's not-signed-in branch and *When this session is not signed in to
the record* below decide them, and the web register still runs. After data has come back,
the rule on a tool that cannot run holds for every `celorus-data` call, as it does for
every tool these do not govern.

The web register only reads, so it runs signed in or not. The page this skill writes waits: it
is written only after `celorus-link`'s `sign_in` answers that this computer is signed in to
Celorus, as *Signing in* below says.

## The tools this skill calls

- `family_facts`, for a family already on the desk: its people, their pages and CRM ids, and
  what the desk already holds on it, so step 1 starts from the desk's own facts.
- `check_desk`, over the pages written, at the end.
- The record's tools, as step 3 says: every figure from the record is the one
  its tool returned, verbatim.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- A figure from the web is the source's, written with its URL and date, and keeps that mark in
  every copy of the page; it is never a number of yours. No desk tool yet measures the minutes a research took, so this skill says and
  writes no minutes of its own (below).

## Find the desk

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that holds a `celorus` entry of any kind: the walk
never passes that folder to reach a desk above, a folder whose entry is not a plain desk is
refused or named by the tools, and only when no such folder exists is there no desk. The seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. With no desk, still do the
research and present the page in the conversation, then offer `install-desk`; a page is
written to disk only inside a desk. Inside a desk without a seat, ask which seat this is, as
its handle (the name of its page under `celorus/seats/`), never the person's name, and write
nothing until it is known.

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

## Start the clock

Note the time you start, with its offset. The minutes from here to the written page are the
instrument the desk is measured with, and they are a number: until a desk tool measures them
from that start and the page's `timestamp`, the desk log's `minutes` cell is `·`, and you never
work the minutes out yourself or say a guess at them.

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

**3b, signed in to the record** (the `celorus-data` tools are present and answer): fetch
the honesty rules once with `get_semantic_metadata` (product `aoc4`, kind
`honesty_rules`) and follow them verbatim; then `resolve_subject` with the name (on
`clarify`, ask the user which candidate, never pick); for a company,
`list_available_subdomains` and then `get_subdomain_data` for what the page needs (the
identity, the freshest events, the people behind it); for a person, `get_people` on the
employer where known and `get_person_profile`. Every figure verbatim as the tool gives it.
Each record line reads `<the fact> · record · <as of>`; its citation goes into the
header's `sources` list and opens only when the desk asks where a fact came from; a proof line
under `## Connections` also ends with it (R24), written as a link of the label the tool returned
to the address it returned, `[<label>](<address>)`, so the views can tell the citation from the
tier word beside it, and as the label alone when the tool returned no address (R35).
Bands only; masked coordinates exactly as rendered; the tier shown on anything the record
did not file.

**3c, not signed in to the record:** say "The record was not asked by this name." and the
lane's close, as *When this session is not signed in to the record* below words them, and
nothing else from the record. Never a count, never a year, never the list itself.

## Step 4: write the page

This step changes the desk: write the page only after `sign_in` answers that you are signed in,
as *Signing in* below says. Until it does, write nothing.

On a seat's graph, a hosted desk, this step writes no page: a page written new by hand never
reaches the firm, and no desk tool keeps a profile yet. Show the whole profile in the chat
instead, in the shape `profile-shape.md` gives, every line labelled as it says, a web line in
full with its URL and the word `unverified`, and say plainly to the person: on a hosted desk the
profile shows here in the chat and is not kept on the desk yet, so it will not be there to open
later. On any other desk:

`profile-shape.md` is the contract; follow it section by section, every section present
even when it reads "Not established" (the Connections section excepted: with nothing to
prove, its heading stands with nothing under it). The path is `celorus/people/<slug>.md`,
`celorus/firms/<slug>.md`, or `celorus/families/<slug>.md` when `celorus/desk.md` names the
`wealth` pack or no pack; the slug is the canonical name, lowercase, hyphenated, and no other
page on the desk may already use it. A family is the page unit for a wealth desk: the family
page lists its principals, each with their own person page carrying `member_of`, and carries
only the household figures a connected record tool answers, each with its source.

Before writing a new person page, look for a person page with the same title or alias. If one
exists and neither lists the other in `not_same_as`, ask "same person?", naming each page's firm
and last conversation, and write nothing until the answer. On "no", add the other page's file
name, without `.md`, to a `not_same_as` list on both.

A person page says where the name came from in `name_source`. A name the user gave in the ask
itself is `supplied-ask-<date>`; an inbound lead's `name_source` is the conversation page of the
mail or call that brought it, written before the person page (R26). If the user describes the
list a name came from as bought or scraped, write no page for it and say why in one line.

Every connection in the header gets its one proof line under `## Connections`, the word fixed
by where it came from, as `profile-shape.md` says: `shown` or `said`. A guess is never in the
header, so a `guessed` line stands on its own under `## Connections` with nothing in the header
above it; `check-desk` lists a header connection whose only proof line is a guess as C07.

Before writing a new firm page, look for a firm page with the same title or alias. If one
exists and neither lists the other in `not_same_as`, ask "same firm?", naming each page's last
conversation, and write nothing until the answer; on "no", add each file name to the other's
`not_same_as`.

When the person works or worked at a firm that has no page, write `celorus/firms/<slug>.md` with `type`,
`title`, `description` and `timestamp` only, and a body of the title and an empty
`## Connections` heading, so the link points at something. Never put a new firm in the account
role.

If a page exists, update it: keep every older line the new read did not contradict, show
a contradiction on two lines with the record winning, bump `timestamp`, and add to
`registers_used`.

Then:

On a seat's graph, none of the following is written: not the research row, not the queue's state and not the lines in `log.md`, since a page changed by hand stops the next pull. Say in the chat that the lead was researched. On any other desk:

- Append the research row to `celorus/desk-log.md`:
  `| <date> | <handle> | <slug> | <source> | · | research | not-yet | · | research-lead |`.
  `<source>` is one of `supplied-<list>`, `supplied-ask-<date>`, `book`, `follow-up` or
  `inbound`. The `minutes` cell is `·`, as "Start the clock" says.
- Update the lead's reason line on today's board if the research changed it.
- Mark the queue row `researched` in `celorus/queues/supplied.md`: the row whose `lead` is the
  page's slug, written bare or as `[[<slug>]]`. With no such row, change nothing there.
- Append one line to `celorus/log.md`, directly under today's heading `## <date>` (add the
  heading above the older days if missing) and above the day's earlier lines, newest first as
  the desk tools write them, with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · research-lead · wrote <the page's path under celorus/> · <registers used>`,
  one line for each page written.
- Call `check_desk` with `scope` naming the pages you wrote, and say its `summary` in one line,
  as it came: never a count of your own.

## When this session is not signed in to the record

Never say what the record holds. No count, no figure, no URL, on any lane. For a company, a
person or a family, say "The record was not asked by this name.", then close with the lane's
own sentence:

- **Claude Code, Cowork, Claude Desktop:** Connect Celorus to read it. The sign-in
  step is `/mcp`, then sign in.
- **Kimi Code:** Connect Celorus to read it. The sign-in step is the celorus-data
  connection.
- **Codex, ChatGPT:** Reading it needs a Celorus account connected to this plugin.
  Nothing more: no link, no price, no verb that promotes.

For a person or a family, never write that they are not on the record, and never put them in
"Not established" as a record miss: the record was not asked by this name. Never compose a new promise
about a person.

## While you work

One plain progress line per step ("Reading what the desk already holds", "Searching the
web for the company", "Reading the record", "Writing the page", or on a hosted desk
"Showing the profile here").
Never name a tool, a stream or a path to the user.

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

- Never state a web figure as a record figure, or blend the two in one line.
- Never write a point estimate of anyone's wealth; a band or nothing.
- Never unmask a contact coordinate; social and web coordinates in full, work and
  personal contact coordinates masked exactly as the tool renders them.
- Never infer a family relationship, a community or anything protected from a surname, a
  locality or a co-appearance; never name or profile a minor.
- Never fill from memory or general knowledge; "Not established" is the honest line.
- Never send anything.

**Next:** `room-brief` when a meeting with this lead is on the clock and `reach-out` when the desk asks for an opener; otherwise back to `triage`'s list. When this skill is done, the lead's page exists and a research row is in the desk log; on a hosted desk, the profile was shown in the chat and nothing was kept.
