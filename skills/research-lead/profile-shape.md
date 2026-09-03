# The profile page

One page per person, family or company, at `celorus/people/<slug>.md`,
`celorus/families/<slug>.md` or `celorus/accounts/<slug>.md`. The frontmatter is an OKF
concept with every Celorus field under one `celorus:` block. The body follows the room
brief's running order, every section present.

## Frontmatter

```yaml
---
type: person                                       # person · family · account
title: <canonical name>
description: <one line: level, function, employer; the freshest event>
resource: https://app.celorus.com/subject/<id>     # only when the record holds the subject
tags: [supplied-L1, band-D]
timestamp: <now, ISO 8601 with offset>
celorus:
  slug: <slug>
  kind: person                                     # person · family · account
  segments: []                                     # the segments the record or the web support
  band: D                                          # a band, never a point estimate; absent when unknown
  readiness: 62                                    # coverage of the fields the brief needs, 0 to 100
  clock: money-in-motion                           # money-in-motion · reason-to-call · handle-with-care
  source_list: supplied-L1                         # or book · follow-up · inbound
  family: <family slug>                            # the family page, where one exists
  registers_used: [record, web, yours]
  research_minutes: 9
  last_touch: <date>
  as_of: <date>
  provenance: on-request
  citations:                                       # record register only; never rendered in the body
    - {claim: <short key>, ref: <the citation the tool returned>, as_of: <date>}
---
```

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

## What just happened

- <up to three dated events by salience, each with its liquidity direction> · <register> · <date>
- <a locked-until warning where value is illiquid>

## The angle

- Conviction: <stances, with the tier shown> · <register> · <date>
- Obligation: <dated commitments; the timing hook> · <register> · <date>
- Open with: <rapport topics at recurring or defining intensity only> · <register> · <date>

## Coordinates

- <social and web coordinates, in full, linked> · <register> · <date>
- <work and personal contact coordinates, masked exactly as rendered; stale where older than their window> · record · <as of>

## The door

- Not computed: the route needs the people plane.

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
  band says so.
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
- **Provenance on demand.** Citations live in the frontmatter and open when the desk asks
  where a fact came from; the body carries the register and the date on every line, and a
  `web` line also carries the word `unverified` and the source URL, in the form fixed in
  the skill.
- **Two registers, never blended.** A web line and a record line about the same fact sit
  on two lines; where they disagree the record wins and both are shown.
- **The desk's own facts** ("met him in March") are written under `yours`, dated, and
  never presented as a fact about the subject.

## An account page

Same frame, with the company's sections: what the record holds (the filings and years,
as counts) · record · <date of the check>, the web ladder's findings (events, funding,
leadership, disputes), the people
behind it linked to their pages, the KFI-style layout the record skills use where the
record was read, and "Not established" for the rest.
