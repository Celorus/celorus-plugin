---
name: check-desk
description: >-
  Run the desk tools' check over the desk and show what needs attention: a page of an unknown
  kind, a missing detail, a word on no list, a link to nothing, a connection with no proof, a
  guess drawn as a line, contact details on a person who was only named, a name with no
  source, two pages that may be the same, a layout slip. Rebuilds the generated views, answers
  "who can introduce me to <name>?" with the ranked paths over the desk's own pages, and merges
  two pages that are one, with an undo. Use when someone says "check my desk", "what needs
  attention", "rebuild the views", "who can introduce me to", "merge these two", or after any
  skill writes a page. It lists and never blocks, and never sends anything. Runs with no
  Celorus account.
---

# Check the desk

The check is the desk tools' `check_desk`: it reads the desk, runs every rule over it and
returns each finding as a row. This skill runs the check and shows the page. It lists; it
never blocks, never refuses another skill's write, and never changes a page except the page's
generated part.

## House rules

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

These hold over every section of this skill, the walk and the merge included. Where a section
below seems to ask for something they forbid, they win.

## Find the desk

The check finds the desk: the folder named by `CELORUS_DESK`, or else the first folder found
by walking up from the working directory that contains `celorus/index.md`. When it cannot, it
refuses and says what a desk is and how to name one: say its sentence, offer `install-desk`,
and stop. The seat is `CELORUS_SEAT` or the handle in `~/.celorus/seat-<desk_id>`, where
`desk_id` is the one the check returns. When the check returns layout 1, the desk has no
`celorus/desk.md`: say in one line that "update my desk" moves it to layout 2, and stop.

Without a seat, run the check without `record`, so it stays read-only, say its summary, and
write nothing: no view, no path page, no merge and no log line. Say that the seat is not known, and that
`CELORUS_SEAT` or `install-desk` sets it.

Whether the desk's files are all there is a different question: "check my desk setup" is
`install-desk`'s verify mode. This skill reads what the pages say.

## How much to check

- After another skill writes: call `check_desk` with `scope`, the pages it wrote; the check
  keeps the findings on those pages and on the pages they link. Where its rules stopped at the
  layout, its summary says the scope was not applied, and its findings are the whole check's.
- On "check my desk", and when `day-open` opens the day: call `check_desk` over the whole desk.

## Run the check and show the page

Call `check_desk` with `record: true`. The check is read-only unless asked to record, and a
hand run stamps only with `--record`; this skill asks, so a clean whole-desk check can write
its stamp. Tell the person not to save `desk.md` while the check records.
Its answer is the whole of what this skill knows about the desk's rules:

- `findings`: one row per finding, each with its `page`, its `rule` and its `message`.
- `rules`: the words of each rule, by its id, C01 to C16.
- `findings_by_rule`: how many rows each rule has.
- `summary`: the check's own sentence about the run.
- `pages_with_problems`: each page the check could not read, or whose stamps it could not
  read, with why and the remedy. A page with no header is not one of them; the rules say
  whether it should have one.
- `root`: the desk folder the check read, and `layout`, `desk` and `desk_id` from its stamps.
- `checked_with`: the lines the check wrote into `celorus/desk.md`, or null and the reason none
  is reported written. A whole-desk check asked to record writes two lines there, clean or not:
  `checked_with: <version>` and `checked_findings: <n>`. They say which release checked the
  desk and how many findings it listed, never that the desk is clean. They are the check's
  record of itself, not a change to the desk, so they take no log line. The stamp rewrites
  `desk.md` in place, the same file. When the stamp is not reported written, the reason says
  what happened and whether `desk.md`, or the file the stamp went into, was put back. When that
  file may not hold its old text, the answer carries that text in `previous_text`, and
  `previous_text_is_desk_md` says whose text it is: true when it is `desk.md`'s own, false when
  it is the earlier text of the file the stamp went into, which may no longer be `desk.md`. A
  failed stamp never fails the check: its findings stand either way.

The rules live in the desk tools and nowhere else. Never judge a page against a rule yourself,
never add, drop, merge or reword a row, and never count rows or pages: every number you say is
one the check returned. A refusal from the check names what it takes; say it, and ask for
that.

Then write `celorus/views/needs-attention.md` from the check's rows, as "What you write"
below says, and show that page from its path under the `root` the check returned, never
retyped into the answer.

One thing it does not do: when a row's message is `the model cannot be read from this page`,
the model cannot be read, so list the page and stop. Do not rebuild a view or write a path
page. Every view and every path page is written from the model, so they would otherwise be
written from words nobody wrote, and a wrong view is worse than yesterday's view. Say which
page, and that the views were left as they are.

## What you read

The check reads the desk itself. The walk and the views below read these pages of it:

- `celorus/desk.md`: `pack`, and the switch `named_only_contact_details`.
- `celorus/model/model.md`: the kinds, the system types, the details every page carries, the
  account details, and `field_lists` (which detail takes its words from which list).
- Each `celorus/model/kind-<kind>.md`: its folder, its must-have and usual details, its pack
  if any.
- `celorus/model/connections.md`: `draws`, the connections that draw a line between two pages;
  `proof_required`, the connections that need a proof line; and `connections`, one entry per
  connection naming the kinds at its ends, `<connection>: <kind> -> <kind>, ...`. Read all
  three from the desk's own copy, never from anywhere else, and read them from that page's
  **header**: the page repeats the same entries as a list further down for whoever is reading
  it, and the header is the one the desk runs on. Where the two disagree the header wins and
  `check-desk` lists the page under layout, because a model page saying two things is the page
  to fix, not a choice to make.
- Each `celorus/model/list-<name>.md`: the words; for `stage`, `spine_steps`.
- `celorus/model/own-words.md`: the desk's own words, `<list>: <word> -> <pack word>` for a
  pack list and `<list>: <word>` for a desk-only list.
- Every other page under `celorus/`, except `model/`, `views/` and `merges/`.

A proof line sits under a page's `## Connections` heading:
`- <connection> [[<target>]] · <shown | said> · <register> · <date> · ...`, or for a guess
`- <connection> <target in plain words> · guessed · <register> · <date> · <why>`.

A proof line is a Markdown list item, so its bullet is a dash and one plain space. A dash
followed by any other blank is not a list item, and a line that is indented is a worked example
rather than a proof line - `check-desk` turns both away and says so, rather than passing over
them in silence. After the bullet the line is the person's own text, and a blank in the
person's text is any blank at all: a word processor and a phone keyboard produce no-break, en,
hair and ideographic spaces without being asked, Markdown renders them all as one space, and a
rule the person cannot see is not a rule they can follow. So when you READ a desk: the
connection word, then one or more blanks, then the target; and around each middle dot, accept
whatever blanks sit around the dot, including none. A dot inside `[[...]]` is part of a file
name and never a separator. When you WRITE one, write the dash with one plain space after it
and each separator as a middle dot with one plain space either side.

Read the heading the way Markdown reads it. Up to three plain spaces may stand before the
`##`, and four make it a code block; after the `##` there is one or more plain spaces or tabs,
because `##` followed by any other blank is not a heading at all and the person sees that line
unstyled; then the heading's text, then optionally blanks and a closing run of hashes. The text
is what is left once every blank at either end is gone, whatever kind of blank it is, and it is
`Connections` exactly, case and all. The section runs to the next heading of level one or two;
a `###` inside it stays inside. So `## Connections ` with a trailing space, `##  Connections`
and `## Connections ##` are all the section, because a person cannot tell them from it - and
`### Connections`, `## connections` and `## Connections and proof` are each a different
heading, because a person can see that they are.

## What you write

The views are written by the desk tools' `render_views`, never by hand. Call it with the seat's
`handle` and `now`, the moment in ISO 8601 with a `T` between the date and the time and the
local offset (leave `now` out for this machine's clock). It rebuilds, each page whole:

- `celorus/views/needs-attention.md`, `# Needs attention`: one row per finding of a whole-desk
  check, each the rule's words, the page and the message as the check wrote them, in the order
  the check returned them; with nothing found, `Nothing to look at.`
- `celorus/views/pipeline.md`: every page in the account role, by step and stage.
- `celorus/views/who-knows-whom.md`: every connection on the desk's pages with how we know it,
  one hop, and the guesses to confirm listed apart, never drawn.
- On each person, firm or family page that a sent page is `about`, the part between
  `<!-- generated:sent -->` and `<!-- /generated:sent -->` under `## Sent`: one line per sent
  item, newest first. Nothing else on the page changes.

Each view carries `generated_by: celorus-plugin <version> render_views` in its header and says
"Generated; edit the pages, never this view." A name with no page on the desk is written plain,
never as a link, since a link to a page that is not there offers to make an empty one. Its rows
fall in the same order every time, so a rebuild over an unchanged desk changes only the moment.

It does not write a path page: a `path-to-<file name>.md` page is written as "Who can introduce
me to someone" says. When a model page cannot be read, it refuses and names that page, and
writes nothing: say its sentence and stop.

A cited line ends ` · from <path>:<line>`, or ` · from <path>:<first>-<last>` for a block of
lines printed whole, where `<path>` is read from the desk folder. The check lists a cited line
that is not there, and a `<path>` that leaves the desk folder, by `..` or through a link, which
it never reads. A `<path>` ending `@<commit>` names a file as it was at that commit, after a
switch removed it; the check does not read those yet, and needs-attention says how many there
are in its own sentence.

Its answer names each page it wrote with its `path`: show needs-attention from that path, never
retyped. `findings` is how many rows needs-attention holds, and `citations_checked` and
`citations_not_checked` are how many cited lines the check read and how many it could not.
Every number you say is one it returned.

It ends the change with one line in `celorus/log.md`, directly under today's heading
`## <date>`: `* <time> · <handle> · check-desk · wrote views · yours`, and returns that line as
`logged`. The register label `yours` marks that every line here came from the desk itself. Never
write the views or the log line yourself.

A refusal names what the tool takes, a seat the desk has or a moment it can read: say it, ask
for that, and change nothing.

## Who can introduce me to someone

The walk is the desk tools' `who_can_introduce`. This skill asks the question and shows the
page; it never walks the desk itself, never counts a path or a hop, and never writes or rewords
a line of the page.

When someone asks "who can introduce me to <name>?", and the seat is known, call
`who_can_introduce` with `to`, the name as it was said. The tool finds the page whose file
name, title or alias it is, walks the desk's own pages, writes
`celorus/views/path-to-<file name>.md` whole, and answers with:

- `page`: the page it wrote. Show that page from this path, never retyped into the answer.
- `summary`: its own sentence about the page. Say it as it came.
- `paths_found`, `paths_kept`, `paths_folded` and `paths_shown`: the numbers, when the person
  asks for one. Say them as the tool gave them.
- `to` and `title`: the page the question was about.

A refusal names what it takes. Where two pages share the name, the refusal lists their file
names: ask which one, and call again with that file name as `to`. Where the desk's model cannot
be read, say the refusal, write nothing, and stop.

The tool writes only its own page, and never through a link. Where `celorus`, `celorus/views` or
the page's path is a link, a folder or another kind of file, or a page already there was not
written by `who_can_introduce`, it refuses by the page's name and writes nothing: say the
refusal as it came, and stop; never move or rename that page yourself. A page it wrote before
is rewritten in place. Where that write fails, the refusal says the page was restored, or that
it may be incomplete with its previous text after it: say it as it came, and show that text
from the refusal, never retyped.

What the person reads on the page, so you can talk about it without changing it: the paths
from a seat, or someone they are in conversation with, shortest and surest first, five at
most. Each hop is a sentence that says every recorded fact between its two pages, each with its
own proof. A longer route through the same people, such as one through a firm they both worked
at, is said on the hop it explains rather than printed as a second path. One drawing at the end
shows every hop the page keeps, and every name on it opens its page.

With no path, the page says one of these lines, as the tool wrote it:

```text
No page named <file name> is on this desk.
```

```text
Nothing on this desk connects a seat, or someone you are in conversation with, to [[<file name>]].
```

```text
No path was found from a seat, or someone you are in conversation with, to [[<file name>]]. Some lines on this desk were not walked, so this is not the same as nothing connecting them. `check-desk` lists what it can see.
```

```text
No path was found from a seat, or someone you are in conversation with, to [[<file name>]] in three hops. There may be a longer one this page does not walk.
```

Where the page says some lines were not walked, run the check and show what it lists; do not
say why yourself.

Log it as `* <time> · <handle> · check-desk · wrote path-to-<file name> · yours` under the day's
heading. If Obsidian asks before it shows diagrams, the choice is the person's; the words
above the diagram hold every path.

This page covers the desk's own pages only. It never reads outside the desk folder and
never claims a path it cannot show a proof line for.

## Merge two pages

On "merge <page> into <page>", "merge these two", "these are the same", or "same person" from
`call-review`, call the desk tools' `merge_pages` with `keep`, the file name of the page that
stays, `merge`, the file name of the other, and the seat's `handle` (and `now`, as for the
views). The merge is the tool's, never done by hand.

It refuses, and changes nothing, when the two are one page, when they are of different kinds,
when either names the other in `not_same_as`, when two pages share a file name it was given,
when a page it needs is on the desk but its header cannot be used, and when a merge of this pair
was cut before its last step. A refusal says which: for a page it cannot use, where the page is
and the mend that fits its state; for a cut merge, the record to undo first. Say it as it came,
and stop. When the other page is not on the desk and a standing record under `celorus/merges/`
names it as merged, the answer's `already_merged` is true and nothing changed: say it was merged
already.

When it merges, it writes the record `celorus/merges/<date>-<kept>-<other>/merge.md` first, with
a copy of every page it changes under `before/` and under `after/`, then writes the kept page,
every page whose links to the other page it pointed at the kept page, and every page whose
generated sent list the merge changes, and deletes the other page last, so a merge cut short at
any point leaves a record to undo it from, and its undo puts back every page it changed. The kept page keeps
every header line it had and gains the other page's title in `aliases`, each detail it lacked,
and the other page's lines under its own `## Connections` and `## Coordinates`; the rest of the
other page goes under `## From the merged page <title>`, a value the two disagree on first. It
then rebuilds the views, as "What you write" says, and ends the change with one line in
`celorus/log.md`: `* <time> · <handle> · check-desk · merged <other> into <kept> · yours`.

Then say what the merge could not put right, one sentence for each of these three answers that
is not empty, and nothing when all three are:

- `still_named`: each line that still names the other page, as `<path>:<line>`, read after the
  merge: a line holding its bare file name, and a link to it the merge left as written. A merge
  points `[[links]]` at the kept page and only those, so a queue row or a desk-log row keyed by
  the bare file name goes on naming a page that no longer opens, and nothing else ever says so.
  A link it cannot find as written (a header value spelled with an escape) is left too, never
  guessed at; a link inside a fenced block is text, not a link, and is left out. Name each line
  with its path and line number, so the person can go to it.
- `points_at_itself`: each line of the kept page the merge turned into a link to itself, as
  `<line>: <the line>`. Say where it is.
- `named_only_holds_details`: true when the kept page is a named-only person who now holds
  contact details. Say so, and that C08 is the rule that will report it.

Change none of them yourself: a queue row may want repointing or closing, a line pointing at
its own page may want deleting or rewriting, and a `standing` is a claim about a relationship
that only the person can make. Name a rule only if you have run the check and seen it. When the
answer's `views_not_rebuilt` is a sentence, say it.

On "undo the merge of <other> into <kept>", or "undo that merge", call `undo_merge` with the
seat's `handle` and one of: `kept` and `merged`, the pair's file names, for that pair's newest
standing record; `record`, the record's folder name under `celorus/merges/`; or neither, for the
newest standing record of all. It checks every path the record names before it puts one back,
and when a page changed since the merge, or a path is not one it may write, it names it and
changes nothing. Otherwise it puts back every page the record names from `before/`, and nothing
else. `celorus/log.md` is the desk's history, so the undo never holds it to the record: it puts
back only the log lines the merge rewrote, matched one line at a time, and keeps every other line,
including lines logged since. A rewritten line whose place is in doubt (its day holds more or
fewer lines that read the same than the merge left) is not put back: the
answer's `log_not_put_back` names it by path and time, and its `summary` says what happened to
`celorus/log.md`; say it. A folder swapped for a link during the undo stops it at that write,
naming what was already changed; say it as it came. It marks the record
`undone:` with the moment, rebuilds the views and ends the change with one line in
`celorus/log.md`:
`* <time> · <handle> · check-desk · undid the merge of <other> into <kept> · yours`.
Say which pages it put back, from its answer's `restored`.

## Say at the end

After a check: the check's `summary`, as it returned it, and the page, shown from its path.
Name a rule by its words from `rules`, with the number `findings_by_rule` gives it, never a
number of your own. When `checked_with` names lines the check wrote, say so in one sentence.
Whenever `checked_with` carries `previous_text` (text, not null), whatever its reason says, say
the reason as it came and show `previous_text` as it came. When `previous_text_is_desk_md` is
true, it is `desk.md`'s previous text, and the person can put it back into `desk.md`. When it is
false, say it is the earlier text of the file the stamp went into, which may no longer be
`desk.md`, and never suggest writing it over `desk.md`: that could overwrite a newer save. Never
write desk.md yourself.
After a path: the first path in words, who knows whom and how we know it, and where the page
is. Never read out a named-only person's contact details.

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

This skill runs in full with no Celorus account and never calls the Celorus tools.
Connecting adds nothing to the check.

## Never

- Never block, undo or refuse another skill's write, and never change a page's own lines to
  fix a finding. List it; the person fixes it, or says "fix it" for one row. A merge changes
  pages only when the person asks for it, as "Merge two pages" says.
- Never judge a page against a rule yourself, and never count: rows and numbers come from the
  check.
- Never draw a guess as a line, on a page, in a view or in a path.
- Never send anything, and never read outside the desk folder.

**Next:** `day-open` tomorrow puts the count from `views/needs-attention.md` on the board.
