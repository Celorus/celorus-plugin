---
name: research-lead
description: >-
  Research a lead: a person, a family or a company, from the desk's queue or by name. Use when
  someone asks to research or find out about a named company, person or family: "research
  <name>", "celorus, research <name>", "research <name> for me", "find out about <name>",
  "research this lead", "who is this", "what do we know about", "look up this company", "look
  up this person", or from triage. A targeted question about a named company is
  `ask-company`'s, a full financial report is `financial-analysis`'s, and a cap table is
  `cap-table`'s, even when the ask says research or find out about. Where the server offers a
  research pack, asks for one instead; otherwise runs the web register on the harness's own
  search, reads the record when this session is signed in to it, and writes one profile page in
  the desk workspace with every line labelled by which class of truth it is. Free: the web
  register needs no sign-in, and writing the page asks for a free Celorus sign-in; a research
  pack is paid in credits.
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
- `research_ask`, when this session has it, as *Before the web register: ask for a research
  pack* says. That section, not the rule on a refusal below, says what follows each of its
  answers, and this skill never asks it again on its own.
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

## Before the web register: ask for a research pack

The server judges whether this seat may have a research pack; this skill never reads a plan.
When `research_ask` is among this session's tools and the desk is a seat's graph, by the test
*Where the desk's pages are* gives, ask it for this lead before the web register, with these
arguments and no others:

- `about`: the stem of the lead's page on the desk, or, when the lead has no page yet, the slug
  its page would take, as the page-writing step below says.
- `name`: the lead's name as the desk writes it.
- `context`: only when the person gave a note on who the lead is, and only that note, with no
  contact detail and no personal identifier in it. With no such note, leave `context` out.

Then go by the answer's `state`, and for a refusal by its `reason`:

- **No `research_ask` in this session, a desk that is not a seat's graph or no desk, or a refusal
  for `not_offered` or `no_account`:** run the web register and every step after it as they
  stand below, and say nothing of the ask.
- **`asked`:** say that the research pack is being made, that its page will appear in the
  folder the answer's `appears_at` names (`celorus/shared/research/`), and that the link's
  `pull` brings it to this desk after the research run has written it. Write nothing by hand for
  this lead: no page, no desk-log row and no line in `log.md`. The web register, the record and
  the page below are not done for it. On a hosted desk the pack is kept on the desk, in that
  folder.
- **`unsettled`:** say its `message` as it came, with the folder its `appears_at` names, then run
  the web register and every step after it as they stand below. Before this lead is asked for
  again, call `celorus-link`'s `pull` and look in that folder for its page; ask again only on the
  person's word, after that look.
- **`payment_required`:** say these, in this order:
  - "Nothing was asked and nothing was charged: this research pack needs more credits than this
    seat can spend now."
  - When `reason` is `seat_limit`: "This seat has reached its spending limit for this billing
    month. The limit starts again next billing month; a recharge does not change it." Nothing
    from the reply follows it.
  - For any other `reason`: "Balance: {balance} credits. Needed: {needed} credits, for this pack
    and any still being made.", with the reply's `balance` and `needed` in their places. Where
    the reply carries no whole `balance`, leave out its sentence; where it carries no whole
    `needed`, leave out the sentence that begins "Needed:". Then, when the reply carries
    `upgrade`: "To buy credits, move to a paid plan on the pricing page.", and not the recharge
    line. Otherwise, when its `recharge` names the `account` page: "Recharge on your account
    page."

  Then offer to research this lead now on the free path, the web register and the steps after
  it, and run it on the person's yes. Say no price and no link, never "make the change again",
  and never ask again on your own.
- **Any other answer** (`too_many_open`, `unavailable`, `bad_argument`, or a state this page
  does not name): say its `message` as it came, then run the web register and every step after
  it as they stand below. After a `celorus-data` call has come back with data in this session,
  `unavailable` and a state this page does not name are a tool that cannot run: say it, and the
  skill stops there, as the house rules say.

No answer of `research_ask` says whether this session is signed in to the record: the record
step's own calls decide that, as that step says. Never ask `research_ask` again on your own,
after any answer: another ask can make and charge another pack.

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
later. A hosted desk keeps the record card all the same, for a company lead: made as *The
record card* below says, the desk server writes it on the firm page by day, making the page new
when the desk has none. On any other desk:

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

**The record card, for a company lead only.** When the lead is a company and the record was
read, signed in to it, put the record's card on its firm page: through `make`, call
`write_firm_card` with `seat`, the seat's handle; `firm`, the firm page's file name without
`.md` (with no firm page yet, the slug as above, after the "same firm?" check); and `company`,
the company's name as the lead gives it, and nothing else. The desk server reads the record for
the card itself and writes it on the firm page, making the page new when the desk has none. On
any desk but a seat's graph, write the firm page by hand before the call, as above, so the card
lands on it. The card says the day the record was read. Show the firm page from the path the
answer gives; never retype the card, and never add a record line of your own to it. When this
session is not signed in to the record, make no card: nothing from the record is said then.

For a person lead or a family lead, make no card. Say only that the record card is not
established for a person, and nothing more: the card makes no lookup by a person's name, no list
of candidates and no comparison of names, and it is never made for the firm a person works at in
the person's place.

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

One plain progress line per step ("Reading what the desk already holds", "Asking for a
research pack", "Searching the web for the company", "Reading the record", "Writing the page", or on a hosted desk
"Showing the profile here").
Never name a tool, a stream or a path to the user, except the folder a research pack appears
in and the link's pull that brings it.

## When the desk tools cannot run

`celorus-desk` is the local server this plugin starts on this machine, and it serves the desk
tools. Before its first write, this skill calls `check_desk` once, so it knows the desk tools
answer before anything is written; a refusal is an answer. When a desk tool is missing or not
running before the skill's writing starts, nothing is written and the skill's whole reply is the
sentence below; no page or answer is made from this skill's text in place of the tools:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after the skill has written, the skill names the pages it
wrote and ends there; that sentence is never said then.

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
computer.". When it answers a page to open instead, show the person its link in full, as a line of its own
(the answer's `show_the_person` line), change nothing, and call `sign_in` again when they have signed in. Any
other answer: say it as it came, and change nothing. That answer is the link's own reading of
the sign-in it keeps on this computer: a sign-in ended on the desk server reads as signed in until a change, a pull or a seed made through the link is answered otherwise, and the desk server still checks
every change made through `make`.

A step that names a desk tool and `make` changes the desk on the desk server: call
`celorus-link`'s `make` with `tool`, that tool's name, and `arguments`, the tool's own
arguments as the step gives them, `desk` included. The desk server makes the change and the
link writes its pages into the desk; never write those pages by hand, and never make the
change another way. Say each answer in its own words, except the line that ends a made change
and begins `Written on this desk through the link:`. Show that line exactly as the tool wrote it, on a
line of its own, and never fold it into other words, shorten it or leave it out: it is how the seller
sees what was written. Follow these as they say:

- "You are not signed in to Celorus through the link, or the sign-in has ended.": call
  `sign_in`, show the person the link it answers in full, as a line of its own, and when
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

**Next:** `room-brief` when a meeting with this lead is on the clock and `reach-out` when the desk asks for an opener; otherwise back to `triage`'s list. When this skill is done, the lead's page exists and a research row is in the desk log; on a hosted desk, the profile was shown in the chat and not kept, and for a company lead, when this session is signed in to the record, the record card is on its firm page. When a research pack was asked for, nothing was written by hand, and the pack's page reaches the desk with the link's pull after the research run has written it.
