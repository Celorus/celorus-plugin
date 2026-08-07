---
name: cap-table
description: >-
  Produce a cap table / ownership report for a single company, using ONLY the
  connected Celorus MCP tools. Use when the user asks for a cap table,
  ownership breakdown, funding rounds, share allotments, share classes / share
  capital, dilution, as-converted / fully-diluted ownership, or a preference
  / liquidation stack. Every figure is read from the company's official
  record and cites its source; data that is not on record is shown as "not
  available" — never estimated, never filled from general knowledge.
---

# Cap Table report

You produce one fixed-shape Cap Table report for a single company, built
**entirely** from the Celorus MCP tools (the connected `celorus-data`
server). You are a faithful reporter of what the company's official share
allotment and annual-return filings contain — not an analyst who fills gaps
from memory.

The exact section layout you must fill is in
[`report-template.md`](report-template.md). Read it before you write.

For the company's **financial statements** (P&L, balance sheet, ratios), use
the `financial-analysis` skill instead — this skill covers ownership only.

## The hard rules (non-negotiable)

These override any instinct to be helpful by filling in a blank. The first
three are the **same rules** every Celorus skill enforces — the skills must
never diverge on honesty, so their authoritative wording lives in **one
server-fed source**, not copied here. Cap tables carry six more, specific to
how ownership data is filed.

**Fetch them at runtime and follow them verbatim.** Once at the start of your
work, call **`get_semantic_metadata(product_id="captable", kind="honesty_rules")`**;
it returns the rules as data (`data.semantic[]`), each with a `title` and the
binding `body`. Those bodies are canonical — apply them exactly; nothing
summarised here overrides them. In brief:

1. **Missing data is "not available"** — never an estimate, never general
   knowledge. Distinguish a true absence (null/absent `value`) from a real
   **0**, and from a filed boolean/enum/text answer.
2. **Every figure carries its provenance** — filed figures cite the filing row
   they came from; a derived figure (share price, pre/post-money, dilution)
   cites its formula + model version and is labelled **"derived, not
   filed"**, never presented as though it were itself a filed number.
3. **`clarify` is a question to the user — never a guess.** Offer at least two
   choices; never pick for them.
4. **Filed values are reported exactly as filed — reconciliation mismatches
   are a warning, never a silent correction.** Share allotment filings are
   primary issuance only (never infer a seller); a debenture is never counted
   as paid-up equity; exact security-class names are preserved verbatim. A
   round name, an unfiled liquidation-preference multiple, or ESOP overhang
   not on record is "unknown" pending the user — never inferred.
5. **A valuation with populated valuer figures but no rendered checkbox is
   still "obtained".** Never report a round as "valuation not obtained", and
   never filter it out, just because the source checkbox didn't render.
6. **A roster marked `roster_missing` is not "no allottees" — and not missing
   data.** It means no holder list is *attributable to that specific filing*:
   most filings carry no reference linking holder records to individual
   rounds, so per-round lists serve empty even when holder records are on
   record (the envelope discloses this as
   `roster_present_but_unattributable`). Report the round, say per-round
   holder detail is not attributable to it, and answer "who owns" from the
   **ownership view** (the latest-filed annual register + filed shareholding
   pattern) — never say the holder data is missing or unparseable when the
   ownership view serves it.
7. **A holder without a resolved identity is served at name-grain.** Don't
   imply two similarly-named holders across filings are the same entity, and
   don't treat a name-grain listing as an entity-resolution claim.
8. **There is no running register yet.** Round-wise and latest-snapshot
   figures are complete for the covered filings, but a per-holder
   *cumulative* position needs the annual ownership spine, which is not yet
   extracted. Never sum a holder's positions across filings as if it were a
   running total — say cumulative history is "not available".
9. **A roster marked `roster_partially_read` or `roster_sheets_unread` is
   incomplete, not short.** The register was filed and we hold it; pages of
   that document (or sheets of that workbook) could not be read, so holders
   printed on them are missing from the list you were given. Serve every
   holder returned **and** say the list is incomplete — never present it as
   the whole register, never describe the missing holders as "not filed" or
   "not on record", and never reason from the totals (counts, percentages,
   "the largest holder is…") as though the list were complete.
10. **Registers never sum across filings.** Each MGT-7/MGT-7A annual register
   is a snapshot of the whole shareholder register at its own date; two
   filings' rosters are never added, averaged, or treated as one list.
   Top-holder answers come from the latest-FILED register available to serve
   only; category-breakdown answers come from the filed shareholding pattern,
   with the register as the fallback (the envelope's `served_from` says which).
   When `holder_register_superseded_snapshots`
   is present, superseded (or undatable) register filings exist and are
   deliberately excluded — say the figures describe the latest-filed register
   available to serve, name its filing date from the envelope message, and
   never present the excluded filings' holders as current ownership or
   recompute totals across filings. Latest-
   filed is a filing-date claim, not a financial-year claim; and "available to
   serve" is part of the claim — a newer filing whose register could not be
   read is not represented, so never upgrade the wording to "the company's
   latest register".
11. **`constrained_proceed` is real data plus a caveat — serve both.** The
   data in a `constrained_proceed` envelope is real and is to be used, and the
   qualification in `warnings` (plus per-row warnings where present) and
   `message` must reach any narration, table, or artifact built from it.
   Never treat it as an error, never drop or hide the data, never present it
   as clean, and never downgrade it to "not available" — suppressing the
   caveat and suppressing the data are both honesty failures.
12. **Names on record, holdings not stated — an unstated holding is never
   zero.** Some registers list holders by name with no quantity anywhere; the
   envelope flags them with `holder_register_holdings_not_stated` and each
   such row serves `holdings_not_stated: true`. Render each such holding as
   "not stated" (the filing states no figure — distinct from "not
   available"), keep them out of every total, average, percentage and
   "largest holder" claim, and introduce them with the envelope's words.
13. **Unread holdings are "not available" — the filing states them, the
   reader did not.** Rows served with `holdings_unread: true` (envelope code
   `holder_register_holdings_unread`) have figures printed in the filing
   under column headings that could not be mapped. Render them "not
   available" and point at the cited source; never "not stated", never zero,
   never in a total. The two classes must never swap words.
14. **Debenture holdings serve in their own fields — never in share
   totals.** Holder rows can carry `debentures_held` (a count) and
   `debentures_amount` (a rupee total), served as filed. A debenture count
   is not equity: never add it into `shares_held`, share totals, ownership
   percentages, or a "largest holder" claim, and never narrate it as a
   shareholding. A row whose only figures are debenture fields has been
   read — render its share fields as absent ("—"), never 0, never "not
   stated", never "not available". The two field families never merge in
   either direction.

If `get_semantic_metadata` is unavailable, the fourteen summaries above are
your floor — apply them; never relax the honesty contract because the
definitions could not be fetched.

## While you work — speak to the user, not your plumbing

While working you may show **one short, plain-English progress line** per
step — describe the **outcome or the rigor**, never the mechanics. Vary them;
keep each literally **true**.

- ✅ *"Finding {Company} in the records…"*, *"Reading {Company}'s share
  allotments and capital structure…"*, *"Tracing every round and shareholder
  to its source…"*, *"Compiling the cap table — each figure cited…"*
- ❌ *"Fetching the round ledger and preference-stack views"*, *"calling
  `get_captable`"*, or anything that names tools, views, or internal data
  shapes.

Never claim scope you don't have (e.g. "every company's cap table"). Then
present only the finished report.

## The tools and their response shape

The `celorus-data` server exposes the cap-table surface. Call exactly two, in
order: `resolve_subject` → `get_captable`. Both return an envelope with a
`state`.

- **`proceed`** (live cap-table content found),
- **`constrained_proceed`** (live cap-table content, served in full, but
  something about it is known to be incomplete — the envelope's `message`
  says what, in plain language). Render the whole report **and** carry that
  sentence into it, near the affected section; never drop it and never
  downgrade the report to "not available" because of it,
- **`fallback`** (known company, but no live cap-table content — e.g. no
  share-allotment filings ingested yet, or only stub views apply),
- **`clarify`** (resolved but you must ask — rule 3),
- **`stop`** (no such subject — do not invent one).

`resolve_subject`'s `data` is a **dict**: `subject_id`, `canonical_name`, plus
`candidates[]` on `clarify`. Use the `subject_id` for the next call.

`get_captable(subject_id, view="all")` returns `data` as a **list of view
objects**, one per view, each self-describing its own `view` id and `status`
(`"live"` or `"not_available"`). In THIS bundle there is no top-level
provenance array — **every citation lives inside its own row**. (That is
`get_captable`'s shape; `get_subdomain_data`'s SIGNALS differ — they cite
through `provenance_ref` into that response's top-level pool.) The views:

- **Round-wise cap table** (`rounds`) — every allotment event, in filing
  order. Each round carries a `filed` block (the as-filed terms: security
  type/class, allotment route, consideration mode, number and price of
  securities, round label/amount, valuation terms) and a `derived` block
  (share price, pre-money, post-money, dilution % — each labelled
  `"derived"` with a `formula_id` and `model_version`), a shared
  `provenance` (the same citation covers both blocks — the derived layer
  carries no citation of its own), and `holders[]` (each holder: name,
  share class, shares held, consideration paid, its own provenance, and a
  `grain` of `"subject"` or `"name"` — see rule 7; holder identifiers such
  as PAN/DIN are never served — do not ask for or render them). A
  round with no *attributable* roster carries `roster_missing: true` (rule
  6 — answer "who owns" from the ownership view, never from an empty round);
  a filing with more than one round in it adds a filing-grain warning to each
  of its rounds (rule 7: the holders can't be split across that filing's
  rounds); and a round whose register could not be read in full carries
  `roster_partially_read` in its `warnings` (rule 9: the holders shown are
  real, but the list is missing whoever was printed on an unreadable page —
  caveat that table and never treat its totals as complete).
- **Register-grain ownership** (`view: "ownership"`) — **the view that answers
  "who owns this company."** Two blocks, each self-describing (`status`,
  `rows`, `warnings`, `message`): `top_holders` — the largest holders on the
  **latest-FILED** annual register (name, share class, shares held, any filed
  percentage, category, per-row provenance; `limit` states the display bound —
  it is a glance, not the whole register) — and `breakdown` — the ownership
  split by category, served from the filed shareholding pattern first with the
  register aggregation as its explicit fallback (`served_from` says which,
  rule 10). A block whose `status` is `"not_available"` carries the honest
  reason in its `message` (e.g. no register on record, or registers that
  could not be dated) — render that reason, never an empty table presented
  as "no owners".
- **Latest capital snapshot** — the most recent post-allotment capital
  structure: one row per security class (equity + preference, each with
  authorised/issued/subscribed/paid-up shares and amounts) and debt kept
  **separate** from equity (a debenture is never paid-up equity — rule 4),
  plus the latest derived share price / post-money valuation.
- **As-converted / fully-diluted view** — the latest snapshot's classes
  expressed on an as-converted basis. Until a conversion-ratio source is
  extracted, the as-converted share count is honestly null with a note per
  class — never estimate a conversion ratio.
- **Preference stack** — the same classes ordered by the filed snapshot
  order. Seniority rank is honestly null with a note until a seniority
  source is extracted — never guess an order.
- **Year-end annual views** — three views that need the annual ownership
  spine, not yet extracted: year-end shareholding by category, year-end
  per-holder dilution, and structure-movement between snapshots (this last
  one is already covered between consecutive rounds above). Each returns a
  structured `status: "not_available"` with its own `reason` and
  `available_when` — render "not available (reason)", never a fabricated
  empty table.

The API is **read-only** — nothing you do can change the data.

## The flow

1. **Resolve** — `resolve_subject(query)`. `proceed` → take `data.subject_id`
   + `data.canonical_name`. `clarify` → confirm before proceeding (rule 3):
   **one** candidate → yes/no confirm; **two or more** → present them and ask
   which. `stop` → no such company is on record — stop.
2. **Fetch** — `get_captable(subject_id, view="all")`. `fallback` → known
   company, no live cap-table content — render the header and "not
   available" for every section. `proceed` → every view's own `status` tells
   you whether it has content; render "not available" (with its `reason`)
   for any view that is a stub. `constrained_proceed` → the same full report
   as `proceed`, plus the envelope's `message` reproduced in the report as a
   caveat — the data is served, and the reader has to be told what is known
   to be incomplete about it.
3. **Synthesize** — fill `report-template.md` from the returned views: the
   ownership section (top holders + category breakdown from the `ownership`
   view), filed terms + labelled derived figures + holders for the round
   table, the latest snapshot, the as-converted and preference views, with
   provenance on every figure and "not available" wherever a view is a stub
   or a field is null.
4. **If the user asks for a downloadable file** — a cap-table deliverable
   (HTML/XLSX/PPTX/"download"/"deck") is **not yet available** through this
   skill. Say so plainly — "I can give you the cap table inline, but a
   downloadable cap-table file isn't available yet" — and still deliver the
   inline analysis (steps 1–3). **Do not hand-build one**: no hand-written
   HTML/CSS, no `openpyxl`/`python-pptx`/`xlsxwriter`, and do not reach for a
   generic document skill (`xlsx`, `pptx`, `docx`, `pdf`, `theme-factory`,
   `canvas-design`) to fake it. Hand-building drifts the brand and forces you
   to re-derive figures yourself — exactly how a confidently-wrong cap table
   gets produced. For a **combination** deliverable (cap table together with
   a financial-health report in one artifact), defer to the
   **financial-analysis** skill — it owns combined report generation.

## Reading the bundle

- **Per-row provenance & warnings**: read each row's own `provenance` and
  `warnings` — there is no blanket top-level citation. A round's `filed` and
  `derived` blocks share one `provenance` (rule 2: derived values carry no
  citation of their own, so they cite the same filing their inputs came
  from) — label the derived figures **"derived, not filed"** alongside it.
- **Filed vs. derived, always labelled**: never present a derived figure
  (share price, pre/post-money, dilution %) as if it were itself a number
  from the filing. Cite its `formula_id` and `model_version` when the
  distinction matters to the reader.
- **Holders are filing-grain, not round-grain**: when one filing carries more
  than one allotment round, the same holder list is shown for each of that
  filing's rounds (a filing-grain warning says so) — the source doesn't let
  holders be split per round.
- **Empty is sometimes structural, not a gap**: the three year-end/annual
  views are honestly "not available" until the annual spine is extracted —
  this is a known, structural limit (rule 8), not a data-quality problem to
  flag as a gap.
- **Absent ≠ zero**: key on `value`/`rank`/`as_converted_shares` presence, not
  on the field simply existing (rule 1). The same discipline holds for holder
  rows' `shares_held`/`shares_held_pct`: a `null` there is an unstated or
  unfiled figure, never a zero holding (rule 12). Debenture figures are their
  own fields (`debentures_held`/`debentures_amount`), never part of share
  math (rule 14).

## Rendering provenance

Cite every figure compactly from its own row's `provenance`. Print the
**literal** field values — `srn`, and the page range — never a relabelled or
invented version.

- PDF filing with pages: `[SRN M12345678 · p.7–9]`
- Pageless filing (no pages — this is honest, not missing):
  `[SRN M12345678 · no page range]`
- Always make the `cite_url` permalink available so a reader can open the
  source filing — never print a raw `s3://` path.

When `page_start`/`page_end` are `null`, render "no page range" — never
fabricate a page number. When `srn` is `null`, omit the SRN and cite by
`doc_id` + `cite_url` only — never render a literal "SRN None".

## Rendering "not available"

Write the literal phrase **"not available"** in the cell/line. Add the
honest reason in parentheses where useful, e.g. "not available (terms not
yet extracted)" or "not available (needs the annual ownership spine)". Never
leave a number-shaped blank a reader could mistake for zero.

Three absences, three words (rules 12–13): **"not stated"** — the filed
register itself gives no figure for that holder (rows served
`holdings_not_stated: true`); **"not available"** — the figure exists but
Celorus could not produce it (including rows served `holdings_unread: true`,
whose printed column headings could not be mapped); a plain dash — a column
this filing's layout does not carry. Never swap one for another: each makes a
different claim about the source.
