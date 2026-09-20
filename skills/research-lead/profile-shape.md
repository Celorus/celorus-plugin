# The profile page

One page per person, family or firm, at `celorus/people/<slug>.md`,
`celorus/families/<slug>.md` or `celorus/firms/<slug>.md`. Every detail sits at the top of the
header, never under a block. The body follows the room brief's running order, every section
present.

## Frontmatter

```yaml
---
type: person                                       # person · family · firm
title: <canonical name>
description: <one line: level, function, employer; the freshest event>
resource: https://app.celorus.com/subject/<id>     # only when the record holds the subject
tags: [supplied-l1, band-D]
timestamp: <now, ISO 8601 with offset>
standing: researched                               # person only: in-conversation · researched · named-only
name_source: supplied-l1                           # person only, a plain file name without `.md`, never a link: supplied-<list, lowercase> · supplied-ask-<date> · book · crm-export-<date> · <conversation file name; for an inbound lead, the mail or call that brought it>
works_at: "[[<firm slug>]]"                        # person only, when shown or said, never a guess; with its line under Connections
worked_at: "[[<firm slug>]]"                       # person only, a firm they have left; the same rule as works_at
role_title: <title>                                # person only
not_same_as: [<file name without .md>]             # plain file names, never links; see "same person?" in the skill
member_of: "[[<family slug>]]"                     # person only, on a wealth desk or a desk with no pack
segments: []                                       # the segments the record or the web support
band: D                                            # a band, never a point estimate; absent when unknown
readiness: 62                                      # coverage of the fields the brief needs, 0 to 100
clock: money-in-motion                             # money-in-motion · reason-to-call · handle-with-care
source_list: supplied-l1                           # or book · follow-up · inbound
registers_used: [record, web, yours]
research_minutes: 9
last_touch: <date>
as_of: <date>
provenance: on-request
sources:                                           # record register only; never rendered in the body, except at the end of a record proof line
  - {resource: <the citation the tool returned>, claim: <short key>, as_of: <date>}
---
```

`supplied-ask-<date>` is the name the user gave you in the ask itself, on that date, when it
came from no list, book, export or conversation page.

## Body

A `web` line is always written in full: `· web · unverified · <source url> · <date read>`.
The short form `· <register> · <date>` below stands for `record` and `yours` lines.

```markdown
# <canonical name>

## Why they matter

- <level, function, employer, tenure; the trajectory in one line> · <register> · <date>
- Wealth band: <band> (<confidence>) · record · <as of>            (bands only)
- Made it through: <the top two composition sources, as percentages> · record · <as of>

## Background

- <qualification, institution, year> · <register> · <date>

As of the day researched.

## What just happened

- <up to three dated events by salience, each with its liquidity direction> · <register> · <date>
- <a locked-until warning where value is illiquid>

## The angle

- Conviction: <stances, with the tier shown> · <register> · <date>
- Obligation: <dated commitments; the timing hook> · <register> · <date>
- Open with: <rapport topics at recurring or defining intensity only> · <register> · <date>

## Connections

- works_at [[<firm slug>]] · shown · record · <date> · [<the label the tool returned>](<the address the tool returned>)
- works_at [[<firm slug>]] · shown · web · <date> · <url> · unverified
- works_at [[<firm slug>]] · shown · yours · <date> · crm-export-<date>
- works_at [[<firm slug>]] · said · yours · <date> · <what you told the desk, in a few words>
- worked_at <firm in plain words> · guessed · <register> · <date> · <why we think so>

## Coordinates

- <social and web coordinates, in full, linked> · <register> · <date>
- <work and personal contact coordinates, masked exactly as rendered; stale where older than their window> · record · <as of>

## The door

- From your desk: ask "who can introduce me to <name>?" for the paths over your own pages. Through the record: not computed; that route needs the people plane and your book.

## Watch out

- <advisor relationships, a recent deployment, flags, a suppression> · <register> · <date>

## Not established

- <what the web could not establish and the record was not read for, by name>

## Provenance

Every claim traceable on request.
```

## Rules

- **Bands only.** A wealth figure is a band. A point estimate is never written, whatever a
  tool returned.
- **The tier is shown** for anything below `demonstrated`: `stated`, `reported`,
  `affiliated` on the line. Nothing rests on an `inferred_weak` fact alone. A modelled
  band says so. A `record` line carries `record` or `registered`; those two tiers are
  the record register's own and never appear on a `web` line.
- **Coordinates.** Social and web in full and linked; work and personal contact
  coordinates masked exactly as the tool renders them and never unmasked here; a reveal
  is an audited event through the connected tools. The desk's own contact rails stay in
  `celorus/crm/` and are linked, never copied.
- **The family is the page unit.** A family page lists the principals, each linked to a
  person page, and carries the household aggregate and the composition split only.
  Declaration-only relatives are never itemised, never given a page, never given
  coordinates. A minor is never named.
- **Never from inference.** No line infers a family relationship, a community or anything
  protected from a surname, a locality or a co-appearance.
- **Provenance on demand.** Citations live in the header's `sources` list and open when the
  desk asks where a fact came from; the body carries the register and the date on every
  line, and a `web` line also carries the word `unverified` and the source URL, in the form
  fixed in the skill; a `record` proof line under `## Connections` also ends with its
  citation, as the tool returned it (R24). Write that citation as a link,
  `[<the label the tool returned>](<the address the tool returned>)`, so the desk's views can
  tell it from the tier word beside it and show it as the place the fact came from (R35). When
  the tool returned no address, write the label alone: the views then show no source for that
  line, which is honest, and the citation is on this page either way.
- **Two registers, never blended.** A web line and a record line about the same fact sit
  on two lines; where they disagree the record wins and both are shown.
- **The desk's own facts** ("met him in March") are written under `yours`, dated, and
  never presented as a fact about the subject.

## The Connections section

Write the heading on every profile page, even when there is nothing to put under it yet.
Connection lines are read under `## Connections` and nowhere else, so a page without the
heading is a page the "who can introduce me" walk never looks at - `check-desk` lists it
(C14), and a question the desk finds no path for hedges until the heading is there.

Under it, one proof line for each connection in the header, and one for each connection you
inferred and no source showed. The proof word is fixed by where the connection came from:

- `shown` when the record or a web page shows it. A `record` line ends with the citation the
  tool returned, written as a link, `[<label>](<address>)`, or as the label alone when the tool
  gave no address (R35); a `web` line carries the page's url and ends `unverified`.
- `shown` with the register `yours` when the desk's own CRM export shows it. The line ends with
  the export's file name, `crm-export-<date>`, which is its citation; never `said` for the
  export (R25).
- `said` when the user told the desk in the ask. The register is `yours`, and the line ends
  with what they told the desk, in a few words.
- `guessed` for anything you inferred. The other end is in plain words, never a link, and a
  guess is never in the header; the line ends with why you think so.

Never `shown` for what the record or the page did not literally show. A proof line keeps the
order above even for the web, with the date straight after the register; the long web form
under "Body" is for the other sections. With nothing to prove, leave the section empty under
its heading; never write "Not established" here, since every line under the heading is read
as a proof line. A connection you inferred, and no source showed, is a `guessed` line.

## A firm page

Same frame, with the company's sections: what the record holds (the documents and years,
as counts) · record · <date of the check>, the web ladder's findings (events, funding,
leadership, disputes), the people
behind it linked to their pages, the KFI-style layout the record skills use where the
record was read, and "Not established" for the rest.
