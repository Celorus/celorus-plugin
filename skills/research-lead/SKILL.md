---
name: research-lead
description: >-
  Research a person, a family or a company and return a brief. Use when someone asks to
  research someone: "research <name>", "celorus, research <name>", "research
  <name> for me", "find out about <name>", "research this lead", "who is this", "what do we know
  about", "look up this company", "look up this person"; or names someone with an intent: "best
  way to sell <name> a service", "I am meeting <name> on Monday". A targeted question about a
  named company is `ask-company`'s, a full financial report is `financial-analysis`'s, and a cap
  table is `cap-table`'s, even when the ask says research or find out about. Where the server
  offers a research pack, asks for one instead; otherwise runs the web register on the harness's
  own search, reads the record when this session is signed in to it, and returns the brief, a
  profile page on a desk too, each line labelled by its class of truth. Free: the web register
  needs no sign-in, and writing the page asks for a free Celorus sign-in; a research pack is
  paid in credits.
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
  every copy of the page; it is never a number of yours. The brief, the desk's copy included,
  holds no figure from the web. No desk tool yet measures the minutes a research took, so this
  skill says and writes no minutes of its own (below).

## Find the desk, if there is one

The desk folder is the one named by `CELORUS_DESK`, or else the first folder found by
walking up from the working directory that holds a `celorus` entry of any kind: the walk
never passes that folder to reach a desk above, a folder whose entry is not a plain desk is
refused or named by the tools, and only when no such folder exists is there no desk. The seat is
`CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`. A desk is optional: nothing waits
on it. With no desk, still do the research and show the brief in the conversation, and invite
`install-desk` inside the line that nothing was written to the desk, which is not another offer; a page is written to disk only inside a desk. Inside a desk without a
seat, ask which seat this is, as its handle (the name of its page under `celorus/seats/`), never the
person's name, and write nothing until it is known; the brief does not wait for the seat.

If `celorus/desk.md` is missing, the desk is on layout 1: read and write it as
`../install-desk/layout-1.md` says, and say once that "update my desk" moves it to layout 2.

## Start the clock

Note the time you start, with its offset. The minutes from here to the written page are the
instrument the desk is measured with, and they are a number: until a desk tool measures them
from that start and the page's `timestamp`, the desk log's `minutes` cell is `·`, and you never
work the minutes out yourself or say a guess at them.

## The entrance: a name and an intent

Any ask that names a person or a company and carries an intent is research, with or without
Celorus or Milan addressed by name, on a desk or not:

- The research words: "research <name>", "find out about <name>", "who is <name>", "who is this",
  "what do we know about <name>", "research this lead", "look up this company", "look up this
  person". A lead handed on from triage is a research ask too, with no research word needed.
- The intent words: pitch, sell, approach, reach, meet, call, write to, introduce, prepare for,
  and their plain forms: "best way to sell <name> a service", "I am meeting <name> on Monday".

Decide the intent from the words: *pitch*, *meeting*, *call*, *write*, *introduction*, or *plain
research*. The meeting part of the brief is written for it. A name with no intent and no research
word gets the company's research, never a menu of reports.

A specific question about a named company's revenue, auditor, directors or financial year, or a
specific ask for a report or a cap table, is the record door's, on that ask alone: the reports
are part of company research and are never offered or listed.

## The flow: who, the pack, the sources, the brief

The steps below run together, with a desk or with no desk, and the brief is made in the same pass.

- **Who.** Resolve the name against the record when this session is signed in to it, and against
  the web where the record has nobody of that name. A lone candidate, or a "did you mean" list of
  other names, is taken as nobody, as the record step below says, and the work goes on. A lone
  candidate or a "did you mean" list never makes this step ask. Several candidates by the lead's
  name itself (letter case and spacing aside): show each by the name and city the candidates carry, and nothing more, and ask
  which; nothing else runs until the answer, not the pack, not the brief. This step comes before
  every other and asks straight away, unless the seller has already answered: the record gave no
  `typo_discovery` warning, every candidate carries a city, and the city the seller gave in their
  own words is the city of a candidate and of no other. For the web, show each person the search
  found by the name, the firm and the source. Nobody: say so in a line and run the web register on
  the name as given, marked as web throughout.
- **The pack.** Where the ask section below applies, it runs as it stands, under its own words, and
  the pack runs beside the rest; where it does not, nothing is said of it. The pack is asked for only
  when the ask carries a research word the entrance names, or is a lead handed on from triage. An ask
  that carries only an intent word runs the free flow, the web register, the record and the brief, and
  says nothing of the pack. It never holds the brief.
- **The sources, all of them.** The desk's own pages when there is a desk; the record, for the
  person's companies, read and not only the registry line; the web register; the pack's page when
  it has arrived. The web register always runs; its own step names the exceptions.
- **The brief,** as *The brief* below says. On a desk, the brief is also written as the lead's
  page, as the page-writing step below says, and what the desk holds feeds the brief and never
  replaces the run.

## Read the ask as a seller's

The person asking sells, and the lead is someone they may sell to. Read every ask that way:

- "Reach out for sales", "for business", "pitch to", "approach" or "sell to" means selling this
  seller's own offer to the lead. Research the lead for that: who they are, what their firm does
  and buys, what has just happened there, and who decides. Never read it as hiring the lead,
  offering them a job or a role, or asking them to sell for this seller, unless the ask says so
  in those words.
- Never ask how the seller knows the lead, why they are asking, or what the lead would do for
  them. The ask is the reason to research; the page shows what fits the seller's work.
- A name the desk's own records do not hold is not a reason to stop or to ask. Go on to the web
  register straight away, and search a name that may be misspelt as the web register says,
  before anything is asked.

## Step 1: what the desk already holds (`yours`)

Read the existing page if there is one, the queue row, the CRM export's row for this name
in `celorus/crm/` (name, employer, stage, owner, last touch; nothing else), and
`celorus/context/notes.md`. Every line from here is labelled `yours · <where it came from>
· <date>`. It is the desk's knowledge, never a fact about the subject. With no desk there is
nothing to read here and nothing to ask: go on. On a desk, what this step reads feeds the "you and
them" strip of the person part and the meeting part of the brief.

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
  this lead: no page, no desk-log row and no line in `log.md`. The brief is still made in the same pass,
  with the web register and the record. On a hosted desk the pack is kept on the desk, in that
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
- **Any other answer** (`no_lead_page`, `too_many_open`, `unavailable`, `bad_argument`, or a
  state this page does not name): say its `message` as it came, then run the web register and
  every step after it as they stand below. After a `celorus-data` call has come back with data
  in this session, `unavailable` and a state this page does not name are a tool that cannot
  run: say it, and the skill stops there, as the house rules say.

No answer of `research_ask` says whether this session is signed in to the record: the record
step's own calls decide that, as that step says. Never ask `research_ask` again on your own,
after any answer: another ask can make and charge another pack.

## Step 2: the web register

The web register always runs: with a desk or with no desk, signed in to the record or not, with a
pack asked for or not. The ask section keeps its own exceptions as it has them: after `payment_required`
the free path runs on the person's yes, and an answer that is a tool that cannot run stops the skill,
as the house rules say. It is part of the pass the ask starts, never a later ask.

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
the search summary, and says so. A figure from the web carries its URL and date in the long profile or is not
written at all, and the brief holds none.

When the web finds nobody by the name as the ask spelt it, or nobody by it who fits the firm,
the city or the role the ask or the desk gave, the name may be misspelt. Search again straight
away under its likely spellings (a letter dropped, repeated or swapped, a vowel changed, the
other common spellings of the name), each with the firm, the city or the role the ask or the desk
gave. Take a spelling's match only when it fits that firm, city or role, and say which spelling
found the person. When the ask and the desk gave none of them, show what the closest spelling
found (the name, the firm and the source) and ask whether it is the person, before anything is
written. Ask the seller for more only when no spelling finds anyone, and then ask for what would
find them (the firm, the city or the spelling), never how they know the person.

A company's own document on the web (an exchange announcement's attachment, a rating rationale,
an annual report) is slow to fetch and often will not open. Read an announcement from the
exchange's listing or the search summary, which carry its subject and its date, and ask for the
document only when a line needs what the document alone holds. When it does not open or does
not come back, never ask for it again or for another copy of it: write the line from the
listing, the search summary or the press that quotes the document, in full as
`- <the fact> · web · unverified · <source url> · <date read> · the document did not open`, with
any `· medium confidence` after it. Then go on; a document that did not come back never holds
the profile. Under "Not established", name each document that did not open, by its title and
date, and where its line came from instead.

## Step 3: the record

**3b, signed in to the record** (the `celorus-data` tools are present and answer): fetch
the honesty rules once with `get_semantic_metadata` (product `aoc4`, kind
`honesty_rules`) and follow them verbatim (a person's `clarify` that the seller's own words
already answer is read as below); then
`resolve_subject` with the name, and with the spelling the web register found the person under
when it differs (for a person, with `subject_kind_hint` `Person`, and the `city` and `company`
only where the seller's own words give them, in this ask or in their answer to a question this
skill asked, not where the web or the desk alone gives them, and never invented, and when the
web found the person under another spelling, every answer under the ask's spelling is set
aside; on `clarify` for a company, ask the user which candidate, never pick); for a company,
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

When `resolve_subject` answers `clarify` for a person and `candidates[]` holds several people
whose `canonical_name` is the lead's name itself (letter case and spacing aside), and the seller has not already answered the question as below, the Who step has asked which, or asks now when the web's spelling
brought them, and the work waits for the answer. The record is then read for the person the answer
names, by the `subject_id` its candidate carried, without asking `resolve_subject` again; an
answer that names none of them is taken as nobody. In every other case of a person's `clarify`, do
not stop the work to ask. The lead's name here is the spelling the web register found the person
under, when the web found them, and the ask's spelling otherwise. The seller has already answered the question when the answer
carries no `typo_discovery` warning, `candidates[]` holds several people whose `canonical_name`
is the lead's name itself (letter case and spacing aside), every candidate carries a `city`,
and the city the seller gave in their own words, in this ask or in their answer to a question
this skill asked, is the `city` of a candidate and of no other. A city the web found or the desk
holds is not the seller's answer. Then take that person, as the
seller's own answer and never as a guess, and say so in the reply in these terms, with the city
the seller gave in place of "the city": "You gave the city; of the people with this name, only
this person is there." In the same reply, name each other person on the list by the name and city
`candidates[]` returned and nothing else, and say that a word from the seller, such as "the
other" or the other's city, moves the profile to them; a word that fits several of them is asked
about again, with their names and cities. Under `## Watch out`, write the same, the city again in
place of "the city":
`- You gave the city; of the people with this name, only this person is there, and this page follows them; the others by this name on the record are <list> · record · <date>`,
where `<list>` names each other person by the name and city `candidates[]` returned and nothing
else.

Any other person `clarify` (a "did you mean" list of other names, a lone candidate): take
none.
Write no record line about the person, finish the profile from the desk and the web, say under
"Not established" that the record did not settle which person this is, and at the profile's
close show the candidates by the name and city `candidates[]` returned, and no city where it gave
none, and ask in the chat, never on the page, which is the lead, if any. On the answer, read the record for that person by the
`subject_id` its candidate carried, without asking `resolve_subject` again, and add its lines in
place of the line under "Not established" that the record did not settle which person this is.

On a word that moves the profile to another person, research again from the start, reading the
record for that person by the `subject_id` its candidate carried, without asking
`resolve_subject` again, and write the page anew in its place. The rule below that updates a
page which exists does not apply here: of the page before, keep only its `type`, `title`,
`name_source` and `not_same_as`, and write every other header field and every line below the
header for that person. A firm page this skill wrote only to give the person before an employer
is named to the seller in a line, as theirs to keep or remove.

When the seller's word comes after the `subject_id` has left this conversation, ask
`resolve_subject` again with the lead's name and that person's `city`, the record's own city for
the person the seller named; the limit above on where a lookup's `city` comes from is for the
lookup before the seller's word, not for this lookup. Take a candidate only
when the answer carries no `typo_discovery` warning, that person had a `city`, and it is the
`city` of a candidate whose `canonical_name` is the lead's name itself (letter case and spacing
aside) and of no other. A `proceed` is that person only when its `canonical_name` is the lead's
name (letter case and spacing aside) and `get_person_profile` on its `subject_id` gives that
person's `city`. Otherwise take none, say so, and show the candidates by name and city again.

The honesty rule that `clarify` is a question, and `resolve_subject`'s own word that a person
is never picked for the user, stand as they are. In the case above the seller has already
answered the question in their own words, and the later find by city follows a word from the
seller; neither is a pick. Every other person `clarify` is still a question to the user, asked
at the profile's close, in the chat, never a guess; a company `clarify` is asked straight away, as
above.

**3c, not signed in to the record:** say "The record was not asked by this name." and the
lane's close, as *When this session is not signed in to the record* below words them, and
nothing else from the record. Never a count, never a year, never the list itself.

For a person, the record is read for the person's companies, not only the registry line: each
company the person is named in, the roles over time, and the company's own values as its tool
returns them. The person's companies are listed from the record and the web together, each line
with its chip, and the values stay the record's.

## The brief

Every research answer returns the brief: a seller's brief of the person or the company, filled from
`assets/person-brief.html` beside this page and rendered through the collateral path of `celorus-design`:
that skill's fonts and tokens go into the template's empty style tags when the page is rendered, as
the template says. When the mark's bytes cannot be read from the `celorus-design` skill's assets,
leave the mark out and never draw an approximation. Show it in the chat, as an artifact where the
assistant can show an artifact and as
text only where it cannot. It needs no desk and no sign-in to be made. Where `assets/person-brief.html` cannot
be read, make the brief from the frame below and say so in a line. On a seat's graph, where the
page-writing step below writes no page, the brief is what the chat shows, and the long profile that
step describes is added beside it only when the person asks for it.

These rules hold for every copy of the brief: the page filled from the template, the artifact shown
in the chat, and any page built from the frame below. Some values come from the web and the page
opens in the seller's browser. Every value put in the brief is escaped for HTML (`&`, `<`, `>`, `"`
and `'` as entities) and is never written as markup. Every slot is text except the chip slot, which
takes only a chip shape the template's comment on source chips shows; the link and the site's name inside a chip are values like any other, escaped. A link from the web is trimmed
of spaces at both ends and compared without regard to case, and goes into an href only when it then
begins with `https://` or `http://`. Any other link, such as `javascript:`, `data:` or `vbscript:`, or
a link that opens with a tab or another control character, gets the template's chip with no link: a
span of class `src` holding `web ·` and the site's name, escaped. Web text never goes
inside a tag, an attribute other than that href, a style or a script. Each mark goes into its img as a
`data:` URI of the file's own bytes, because the page loads nothing from outside. The CSP line and the
script under it are copied exactly as they are. The page's policy guards only a page that opens as its
own document. In a chat artifact the host puts the page inside its own frame and the policy does not
apply, so the escaping rule above is the guard there, and it is never skipped.

The reader is a salesperson who gives the page a minute before a meeting. The frame is fixed and the
fill adapts to what is known: a person's full work history, another person's directorships over
time. The parts, in this order, each answering a question and holding to the budget its section
carries in the template (`data-budget`):

- **Top card:** who am I meeting, and when and where.
- **In one breath:** who, why now, open with, ask for; written from the parts below and from nothing
  else.
- **The person:** who they are and where you left it; on a desk, the "you and them" strip: met when,
  what they said, what is still open.
- **The company that matters here:** why this company, what it does, how it is doing.
- **What is happening:** why meet now, in dated lines.
- **Your meeting:** what is in it for you, a line to open with, what to say, be careful, the ask.
- **Milan's offer:** what Milan can do next, in a line of its own, the reply's last line as the end order below says,
  and left off the page when anything follows the brief in the chat.

For a company, the person part is replaced by the people who matter here, in a paragraph, and the
rest of the frame stands. Rules under the frame:

- Each line carries a chip, small and muted: desk, record, or web with the site's name. A chip is
  never a document name, a reference code or a page; the sources stay at the backend, and a company
  page, where it was written, holds them.
- Figures come only from the record, exactly as the record gives them, and the web gives no figure.
  No web figure appears in any copy of the brief, the desk's page included.
- Give dates and values as the tools gave them; never write a span of time, an age or a tenure
  that the writer reckons from them, as the house rules say. A promise the desk's notes leave open
  is said with the date it was made and as still open, never by how long ago that was or how late
  it is.
  Rows a tool returned are given by name: say who the directors are, and never a word such as
  sole or only about them, nor about the companies or the years the record covers.
- The company part's tiles hold only values the record gives, each with the record chip; with none,
  leave the tiles out and say so in a plain line. Never a web value, never a tile stamped record
  for something the record did not give.
- A part nothing answers says so in a plain line: never padded, never dropped, never filled from
  general knowledge.
- A web match that cannot be tied to the person confirmed at the top is never merged into the
  person part. It sits apart under "be careful", in a box that says it may be a different person.
- A path to a person is a name and a relation, never a contact detail: board colleagues, family,
  advisors, past companies and schools, each line with its chip. Contact details stay walled.
- The meeting part and the breath cite only what the parts above hold; they never introduce a fact.
- A lead whose clock is handle-with-care (the lead's page says it in `clock`, and the desk's clocks
  are listed in `motion-spec.md`, which is where triage reads it) gets the person, company and event
  parts only: no opener, no ask and no pitch, no offer of a pitch, a draft or an opener, and a plain
  line saying the lead is a handle-with-care row and so is not pitched.
- The footer says what the brief was built from. It names the company page only where it was
  written, on a desk. With no desk, the sources are given in the chat as a short list under
  "Where this came from", never on the page, in the place the end order below gives it, before the
  offer line.
- The page names no report and no product, and gives Milan no pronoun.
- The template holds the frame to what fits the page: add no part, go past no part's budget, and
  keep depth off the page: it stays behind the company page on a desk; with no desk it is left out
  of the page, and its sources are named in the "Where this came from" list.

A pitch ask (or an ask for the mail, the call opener or the meeting brief) returns the brief and the
pitch in the same pass, with no later ask. The pitch is a piece beside the brief, a page at most; it
cites the brief and only the brief; where the brief is thin it says what it rests on and what it
lacks and never writes a generic pitch; it is a draft and is never sent. When the ask is research
alone, the meeting part holds the angle and the reply ends with the offer.

Every research answer ends with the offer line: one line, one next step it can do now from the
intent (a curated pitch, the mail, the meeting brief, the introduction path, whichever fits), never
blocking and never a menu. Offer only a step that will run in this session as it stands: no record
depth when this session is not signed in to the record, no pack where the flow says nothing of
it and no pack without credits, and never a verb that promotes the plan. The offer never waits on a
question: it names a step that can be taken now from what the seller has already said, and asks the
seller for nothing but a yes, never for a date, a name or a choice.

The end order is set here and nowhere else. The reply shows the brief; then, with no desk or when
the desk tools cannot run, the "Where this came from" list and the line that nothing was written to
the desk, whose invitation to set up a desk stays inside that line and is not another offer; then
the offer line, last, and not repeated. Where anything follows the brief in the chat (that list and line, or what the page-writing step
says on a desk), the offer line is said after it, last, and not inside the brief's page. For a handle-with-care lead the pitch
above is not written and the offer line offers none of it, as the rule under the frame says.

## Step 4: write the page

This step changes the desk: write the page only after `sign_in` answers that you are signed in,
as *Signing in* below says. Until it does, write nothing.

On a desk, the brief is also written as the lead's page, in the shape below, and the desk's history
gets its line. With no desk, nothing is written to disk.

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

The brief does not wait for the desk tools. That sentence is the reply to a request to write the
desk's own pages. A research ask is answered with the brief, which needs none of them, and, with no desk,
or when the desk tools cannot run, a line saying that nothing was written to the desk, in the place *The
brief* gives it.

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

**Next:** after the brief, and the reply's last line, the offer line, as *The brief* sets out, comes `room-brief` when a meeting with this lead is on the clock and `reach-out` when the desk asks for an opener; otherwise back to `triage`'s list. When this skill is done, the lead's page exists and a research row is in the desk log; on a hosted desk, the profile was shown in the chat and not kept, and for a company lead, when this session is signed in to the record, the record card is on its firm page. When a research pack was asked for, nothing was written by hand, and the pack's page reaches the desk with the link's pull after the research run has written it.
