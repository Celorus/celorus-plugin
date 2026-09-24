---
name: research-lead
description: >-
  Research a lead: a person, a family or a company, from the desk's queue or by name.
  Use when someone says "research this lead", "who is this", "what do we know about",
  "look up this company", "look up this person", or from triage. Runs the web register on
  the harness's own search, asks the record whether it holds a company, reads the record
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

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

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

**3a, the check.** For a company only: if a `celorus-check` connection is present in this
session, call its `check_record` tool once with the name and the kind `company`, unless the
desk's cache holds the case "On the record, counts not available" for it asked less than an
hour ago, or another case, "Not found" or "Clarify" for it asked less than a day ago, or holds
"Refused" and the time it may be asked again has not come, or "Could not read" asked less than
an hour ago, or the existing page already carries a `resource:` line. The cache is
`.celorus/cache/check-<slug>.md` under the desk folder ("Find the desk" above); with no
desk, no cache is read or written, and the check is asked at most once in this session. Here
`<slug>` is the cache key, not the page's slug (the canonical name): the name as asked,
lowercase, with every run of characters that are not letters or digits turned into one
hyphen. When step 2's web register found the company's registered name, ask the check with
that name. Before the notes are read, and whether or not a note holds, read the cache under
the key of the registered name step 2 found, and of a name the user chose from a "Clarify",
when either differs from the name the user asked: a case, or a "Not found" or "Clarify" when
no note holding under the asked name keeps that the company is on the Celorus record,
current under either answers as it would under its own key, and neither a note nor an ask
comes into it; a note that holds under either is read with the notes, by its own rule, and
nothing is asked. Read the current entry first: a case, "Not found" or "Clarify" under the
key is current for a day after it was asked, or for an hour when it is the case "On the
record, counts not available", and a current one answers before any note under that key,
however late the note was written. Only when nothing under the key is current are the notes
read, each only while it holds: a "Refused" until the time it may be asked again, a "Could
not read" for an hour after it was asked; a note whose time has passed is not read. When a
note holds, first read the other keys it records: a case, or a "Not found" or "Clarify" when
the note does not keep that the company is on the Celorus record, current under any of them
answers as it would under its own key, and the note is not read. When current entries under
more than one key disagree, a case answers before a "Not found" or a "Clarify", and
otherwise the latest asked answers. A "Refused" or "Could not read" entry is a note, not a
case and never a miss: it is read only by its own rule, never as a case. Writing a case,
"Not found" or "Clarify" under a key replaces any note under that key. Writing a note never
replaces a case: the case stays under the key beside the note. A held "Not found" is routed
as a fresh `not_found` (below). A note keeps that the company is on the Celorus record only
until a day after the kept case was asked, the time the note carries; after that day the
note keeps nothing, and while it still holds, the case is "The record was not asked by this
name", with the note's own line. A held "Refused" whose time has not come: say in one line
that the record was asked too often and when it may be asked again, when the note says that
time came from the refusal; otherwise say in one line that the record was asked too often
and to try again later, never naming the kept time. The case is "The record was not asked by
this name", or "On the record, counts not available" when the note keeps that the company is
on the Celorus record. A held "Could not read" asked less than an hour ago: ask nothing, say
in one line "the check could not read the record, asked at HH:MM" with the time it was
asked, and the case is "The record was not asked by this name", or "On the record, counts
not available" when the note keeps that the company is on the Celorus record; after the
hour, ask again. Every time kept in the cache, a case's, a "Refused" retry time, a "Could
not read" time and a "Not found" time, is an ISO 8601 timestamp with its offset. Ask through
the harness's connection, never through anything the plugin runs itself. It answers whether
the name is on the record and how much it holds: counts only, never a figure. The counts
pick the case and go no further. Write to the cache the case and the time it was asked, as
an ISO 8601 timestamp with its offset, and nothing else: never the counts. The case is one
of: "Depth on record" when the answer is `on_record` and the record holds returns the
company has filed (its count of returns filed is not zero); "Only the identity and the board
are on record" when it is `on_record` and the record holds none filed. An `on_record` answer
with null `counts` is the case "On the record, counts not available", kept as that case,
never as counts and never as "The record was not asked by this name", because the record was
asked and answered. Its missing counts are a failed read: the case is held on the desk for
an hour, not a day, and it is not the day's one answered ask. A `not_found` is written as
"Not found" with its time. Only a `not_found` is a miss; an error from the check never is.
If the check answers with an error in place of an answer (a read it could not make, a query
it will not take, or the ask refused as too many requests), that is a non-answer and not a
miss: say it as the check not answering, never as "not on the record" or as anything about
the company. If the check refuses the ask as too many requests, write "Refused" and the time
it may be asked again, as an ISO 8601 timestamp with its offset, noting whether that time
came from the refusal (when the refusal shows no wait, the time is a day after the refusal
and did not come from it) and whether the note keeps that the company is on the Celorus
record, with the time the kept case was asked when it keeps, and say in one line when it may
be asked again and what its limit is, in words, when the refusal shows them (its
`retry_after_s`, `limit` and `message`); otherwise say in one line that the record was asked
too often and to try again later. If it could not read the record, write "Could not read"
and the time it was asked to the cache, noting whether the note keeps that the company is on
the Celorus record, with the time the kept case was asked when it keeps, and say in one line
"the check could not read the record, asked at HH:MM" with the time it was asked. If it will
not take the query, keep nothing, and say in one line the check's own error words as it gave
them. The case is then "The record was not asked by this name". But a "Refused" or "Could
not read" written under a key that holds the case "On the record, counts not available"
asked less than a day ago keeps that the company is on the Celorus record, so a failed ask
does not lose that fact, and the case is then "On the record, counts not available". The six
record skills read and write this same cache under the same key and ask only when it holds
nothing current for that key, so on a desk a company has at most one answered ask a day, and
with no desk it is asked at most once a session. A failed read is held on the desk for an
hour and then asked again. Every entry is written under the key of the name the user asked,
under the key of the name the check was asked with when that differs, and under the key of
the check's canonical name when it gave one. A "Refused" or "Could not read" note also
records the other keys it was written under. A "Not found" entry also records the name the
check was asked with, and a fresh or held "Not found" is never said to the user as a case:
say the "not on the Celorus record yet" line below only when that recorded name is the
company's registered name, as the desk's own pages or this session's web register record it;
otherwise the case is "The name does not resolve". On `clarify`, show the user the candidate
names and ask which one is meant, and write "Clarify" with its time and those names, names
only and never a count. Within the day, a skill that finds it asks the user to choose among
those names without asking the check again; when a name is chosen and the check is asked for
it, write that case under the chosen name's key and the asked name's key. If the connection
is absent, skip this step silently.
For a person or a family, do not call the check while person lookups are deferred: it
answers `not_found` for every person, whether or not the record holds them, so the answer
says nothing about the person, and a family is its principals, each a person. Write nothing
to the cache for either.

**3b, with an account connected** (the `celorus-data` tools are present and answer): fetch
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

**3c, with no account:** pick the case the check found and say its value sentence in this
lane's wording (below), and nothing else from the record. Never a count, never a year,
never the list itself.

## Step 4: write the page

`profile-shape.md` is the contract; follow it section by section, every section present
even when it reads "Not established" (the Connections section excepted: with nothing to
prove, its heading stands with nothing under it). The path is `celorus/people/<slug>.md`,
`celorus/firms/<slug>.md`, or `celorus/families/<slug>.md` when `celorus/desk.md` names the
`wealth` pack or no pack; the slug is the canonical name, lowercase, hyphenated, and no other
page on the desk may already use it. A family is the page unit for a wealth desk: the family
page lists its principals, each with their own person page carrying `member_of`, and carries
the household aggregate only.

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

- Append the research row to `celorus/desk-log.md`:
  `| <date> | <handle> | <slug> | <source> | <minutes> | research | not-yet | · | research-lead |`.
  `<source>` is one of `supplied-<list>`, `supplied-ask-<date>`, `book`, `follow-up` or
  `inbound`.
- Update the lead's reason line on today's board if the research changed it.
- Mark the queue row `researched` in `celorus/queues/supplied.md`.
- Append one line to `celorus/log.md`, directly under today's heading `## <date>` (add the
  heading above the older days if missing), with `<time>` as two-digit `HH:MM`:
  `* <time> · <handle> · research-lead · wrote <the page's path under celorus/> · <registers used>`,
  one line for each page written.
- Run `check-desk` over the pages you wrote, and say its count in one line.

## When no account is connected

Say what the record can answer for this company, never what it says. No count, no
figure, no URL, on any lane. Pick the case the check found, then close with the
lane's own sentence.

| The case | The value sentence |
|---|---|
| Depth on record, no mandate known | Celorus can answer, from regulatory sources, how this company has been doing, what it owes and to whom, who owns it and who runs it. |
| The desk is a seller vetting a counterparty | Celorus can answer, from regulatory sources, whether this company can pay and any warning signs its auditor has flagged, and who owns and runs it. |
| The desk is a banker | Celorus can answer, from regulatory sources, who owns this company and who controls it, and what it owes and to whom. |
| Only the identity and the board are on record | Celorus can answer, from regulatory sources, who sits on this company's board and how many other boards each of them sits on. |
| On the record, counts not available | This company is on the Celorus record, and its counts are not available. Then the lane's close. |
| The name does not resolve | Nothing is written. No line, no ask. The page's "not established" section carries the miss. |
| The record was not asked by this name | The record was not asked by this name. Then the lane's close. |

The close, after the value sentence:

- **Claude Code, Cowork, Claude Desktop:** Connect Celorus to read it. The sign-in
  step is `/mcp`, then sign in.
- **Kimi Code:** Connect Celorus to read it. The sign-in step is the celorus-data
  connection.
- **Codex, ChatGPT:** Reading it needs a Celorus account connected to this plugin.
  Nothing more: no link, no price, no verb that promotes.

When the name resolves and the company is not on the record yet, the whole line is:

- **Claude lanes:** This company is not on the Celorus record yet. Connect Celorus to ask for it, and we will tell you when it is.
- **Codex, ChatGPT:** This company is not on the Celorus record yet. It can be added on request, and we will tell you when it is. Asking for it needs a Celorus account connected to this plugin.

For a person or a family, while person lookups are deferred, the case is "The record was not asked by this name".
A `not_found` for a person is never a miss: never write that the person is not on the
record, never route it to "The name does not resolve", and never put it in "Not
established" as a record miss. Never probe the check to learn whether the deferral has
lifted: a later release of this skill says so, and only then does a person with a board seat
on the record get the "Only the identity and the board are on record" case's sentence
(above). Never compose a new promise about a person.

## While you work

One plain progress line per step ("Reading what the desk already holds", "Searching the
web for the company", "Asking whether the record holds anything", "Writing the page").
Never name a tool, a stream or a path to the user.

## With no account

The web register runs in full, and the check runs for a company; the page is written with
`web` and `yours` lines and a full "Not established" section. Connecting adds the `record` register: the
figures, the documents, the people behind a company, each verbatim and cited.

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
