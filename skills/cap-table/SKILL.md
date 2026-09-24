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
allotment and annual-return records contain — not an analyst who fills gaps
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
summarised here overrides them.

**That first call is also the sign-in test.** It is the first thing this skill asks
of the server, so its answer is what tells you whether this session has an account
at all. Data coming back is what settles it, and nothing else does. If the answer is
not data — it asks you to sign in or to re-authorize, it refuses for want of
authorization, it errors, it comes back empty, or you cannot read it as data — stop
there and follow *When no account is connected* below, which decides it under its
four outcomes: the tools being listed does not mean the account behind them is
authorized, and every tool here sits behind the same sign-in, so calling a second
one only spends a second refusal.

In brief:

1. **Missing data is "not available"** — never an estimate, never general
   knowledge. Distinguish a true absence (null/absent `value`) from a real
   **0**, and from a filed boolean/enum/text answer.
2. **Every figure carries its provenance** — filed figures cite the row
   they came from; a derived figure (share price, pre/post-money, dilution)
   cites its formula + model version and is labelled **"derived, not
   filed"**, never presented as though it were itself a filed number.
3. **`clarify` is a question to the user — never a guess.** Offer at least two
   choices; never pick for them. A `clarify` carrying `available_streams` is the part you
   answer yourself, whether or not `available_years` rides with it: the tool measured
   only the streams you named, another stream holds the data, and the re-ask is a
   different call — make it for the SAME year you asked for, and say the answer came
   from the stream you switched to; ask the user only if that re-ask comes back empty
   too. `available_years` and `candidates` stay the user's to choose.
4. **Filed values are reported exactly as filed — reconciliation mismatches
   are a warning, never a silent correction.** Share allotment documents are
   primary issuance only (never infer a seller); a debenture is never counted
   as paid-up equity; exact security-class names are preserved verbatim. A
   round name, an unfiled liquidation-preference multiple, or ESOP overhang
   not on record is "unknown" pending the user — never inferred.
5. **A valuation with populated valuer figures but no rendered checkbox is
   still "obtained".** Never report a round as "valuation not obtained", and
   never filter it out, just because the source checkbox didn't render.
6. **A roster marked `roster_missing` is not "no allottees" — and not missing
   data.** It means no holder list is *attributable to that specific document*:
   most documents carry no reference linking holder records to individual
   rounds, so per-round lists serve empty even when holder records are on
   record (the envelope discloses this as
   `roster_present_but_unattributable`). Report the round, say per-round
   holder detail is not attributable to it, and answer "who owns" from the
   **ownership view** (the latest-filed annual register + filed shareholding
   pattern) — never say the holder data is missing or unparseable when the
   ownership view serves it.
7. **A holder without a resolved identity is served at name-grain.** Don't
   imply two similarly-named holders across documents are the same entity, and
   don't treat a name-grain listing as an entity-resolution claim.
8. **There is no running register yet.** Round-wise and latest-snapshot
   figures are complete for the documents covered, but a per-holder
   *cumulative* position needs the annual ownership spine, which is not yet
   extracted. Never sum a holder's positions across documents as if it were a
   running total — say cumulative history is "not available".
9. **A roster marked `roster_partially_read` or `roster_sheets_unread` is
   incomplete, not short.** The register was filed and we hold it; pages of
   that document (or sheets of that workbook) could not be read, so holders
   printed on them are missing from the list you were given. Serve every
   holder returned **and** say the list is incomplete — never present it as
   the whole register, never describe the missing holders as "not filed" or
   "not on record", and never reason from the totals (counts, percentages,
   "the largest holder is…") as though the list were complete.
10. **Registers never sum across documents.** Each annual register
   is a snapshot of the whole shareholder register at its own date; two
   documents' rosters are never added, averaged, or treated as one list.
   Top-holder answers come from the latest-FILED register available to serve
   only; category-breakdown answers come from the filed shareholding pattern,
   with the register as the fallback (the envelope's `served_from` says which).
   When `holder_register_superseded_snapshots`
   is present, superseded (or undatable) register documents exist and are
   deliberately excluded — say the figures describe the latest-filed register
   available to serve, name when it was filed from the envelope message, and
   never present the excluded documents' holders as current ownership or
   recompute totals across documents. Latest-
   filed is a claim about when it was filed, not a financial-year claim; and "available to
   serve" is part of the claim — a newer document whose register could not be
   read is not represented, so never upgrade the wording to "the company's
   latest register".
11. **`constrained_proceed` is real data plus a caveat — serve both.** The
   data in a `constrained_proceed` envelope is real and is to be used, and the
   qualification in `warnings` (plus per-row warnings where present) and
   `message` must reach any narration, table, or artifact built from it.
   **Word it in plain language, never as the raw `warnings` code.** A code is
   internal machinery, and a bare token printed beside a named company's
   holdings reads to that company as a fault in its own record even when it is
   not one. Several cap-table codes also carry a parametrized tail (a section
   id, or filed-vs-issued figures) that is meaningless to a reader.
   **Where a `message` is supplied, write that sentence.** Do not assume one is
   there: the envelope usually carries a `message`, an ownership block sometimes
   does, and the round-wise, capital, as-converted and preference views commonly
   serve their codes with none. Where there is no supplied sentence, say the
   caveat in your own plain words — several of the rules above describe what
   these caveats mean, and where none does, say plainly that the figure carries
   a qualification and point the reader to the cited source. What you must never
   do is print the token, and what you must never do is stay silent: an
   awkwardly-worded caveat is a small cost, a caveat that silently vanishes is
   an honesty failure.
   Never treat it as an error, never drop or hide the data, never present it
   as clean, and never downgrade it to "not available" — suppressing the
   caveat and suppressing the data are both honesty failures.
12. **Names on record, holdings not stated — an unstated holding is never
   zero.** Some registers list holders by name with no quantity anywhere; the
   envelope flags them with `holder_register_holdings_not_stated` and each
   such row serves `holdings_not_stated: true`. Render each such holding as
   "not stated" (the register states no figure — distinct from "not
   available"), keep them out of every total, average, percentage and
   "largest holder" claim, and introduce them with the envelope's words.
13. **Unread holdings are "not available" — the register states them, the
   reader did not.** Rows served with `holdings_unread: true` (envelope code
   `holder_register_holdings_unread`) have figures printed in the register
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
15. **Registry capital sits beside filed capital — a second record, never a
   restatement.** The company register's own authorised / paid-up /
   subscribed capital serve on the cap-table door alongside the filed
   figures, as their own rows labelled "(registry)" and cited "per registry master
   data, captured <date>". Report each on its own line. Never merge, average
   or sum a registry figure with a filed one, never present one as
   superseding the other, and never call a difference between them a
   reconciliation break or a fault in the record — the register's authorised
   and subscribed capital cover every class of share while the filed ones on
   record are equity only, so the register's figure is routinely the larger.
   Registry and filed paid-up capital are both company-level totals: a
   difference there is a difference of date, so say which is as at when.

16. **A charge amount is a secured limit, not debt — charges never total.**
   Secured-lending charges serve one row per charge, each with its own amount
   and its own citation, on the lender & charge-holder subdomain. Never total,
   rank or aggregate charge amounts, and never present a summed figure as the
   company's borrowing or secured debt: the amount is the limit the charge is
   registered against, not money drawn. Report per-charge amounts, and report
   each figure as recorded — the source asserts no unit, so never stamp a
   currency onto it or rescale it. Where a charge says the lender is not
   disclosed, say "lender not disclosed" — never "Others", never a guess — and
   still report the charge in full. A lender becomes a named entity by one of
   two routes — the record states its company number, or the resolution pass
   matched the name exactly — and the row says which; report a resolved lender
   as resolved, not as filed. Otherwise it is a name on record and must not be
   read as, or matched to, a similarly-named company. On a company's own lender
   page the resolved evidence rides under `holding_resolution` instead, because
   there the named counterparty is the borrower — check both keys. When a row's named
   counterparty carries a registry status that is anything other than active,
   give that status with the name and do not say the company currently holds or
   owes the charge — an amalgamated, dissolved, struck-off or liquidating
   company held it in its time. Test for "not active" rather than matching a
   list of words, since the register's wording is open; but do not read a
   non-active status as "defunct" either — some values describe a live company,
   so report the status and drop the present-tense claim, not the reverse.

If `get_semantic_metadata` is unavailable, the sixteen summaries above are
your floor — apply them; never relax the honesty contract because the
definitions could not be fetched.
The floor is for a call that came back with data and no definitions in it. It is
not for an answer that was not data. If the call did not come back with data — it
asked you to sign in or to re-authorize, it refused for want of authorization, it
errored, it came back empty, or you cannot read it as data — the floor does not
apply: this session has no account until a `celorus-data` call comes back with
data, *When no account is connected* below governs it and decides it under its
four outcomes, and you stop there rather than carry on under the summaries.

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
- **`fallback`** (known company, but no live **filed** cap-table content —
  e.g. no share-allotment documents ingested yet, or only stub views apply.
  It speaks about the filed views, never about the record: the registry
  capital view can be live underneath it, and the envelope's `message` says
  which case this is — reproduce it),
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

- **Round-wise cap table** (`rounds`) — every allotment event, in the order
  filed. Each round carries a `filed` block (the as-filed terms: security
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
  a document with more than one round in it adds a document-grain warning to each
  of its rounds (rule 7: the holders can't be split across that document's
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
- **Annual capital structure by year** (`view: "annual_capital"`) — the
  **annual return's own** share-capital structure, one snapshot per financial
  year, oldest first: per class, authorised/issued/subscribed/paid-up shares
  and amounts exactly as filed. Reach for this rather than the latest capital
  snapshot whenever the question is about **authorised** capital, or about any
  year other than the most recent. Two things only this view can tell you: a
  company that files annual returns but no allotments has **no** latest
  snapshot at all (that one reads the allotment lane), and a share class the
  company **authorised but never issued** — real, and common for preference
  capital — appears in no other view. A year that had more than one annual
  return filed serves the **later-filed** one and says so in its `warnings`
  (a superseded snapshot is disclosed, never summed and never silently
  dropped — rule 10's discipline). `not_available` with its reason when no
  annual return is on record.
- **Year-end shareholding by category** (`view: "v2"`) — per financial year,
  the annual return's own promoter/public split by class, plus the
  form-level shareholder counts, exactly as filed. Use it for "who owned
  what at year end" and for how the shareholder base changed year on year.
  Years with no annual return filed are simply **absent** — never a
  zero-filled year.
- **Capital-structure movement by year** (`view: "v7"`) — per financial
  year, per class, opening → movement (by cause) → closing, as filed on the
  annual return. This is the filer's own account of what moved and why, so
  prefer it over inferring movement by differencing two snapshots. Same
  absence rule: an unfiled year does not appear.
- **Year-end per-holder dilution** (`view: "v3"`) — **not available.** A
  per-holder position at each year end needs an annual ownership spine that
  is not extracted (rule 8). It returns a structured
  `status: "not_available"` with its `reason` and `available_when` — render
  "not available (reason)", never a fabricated empty table, and never build
  it yourself by summing a holder's round positions.
- **Registry capital** (`view: "registry_capital"`) — the company register's
  own authorised / subscribed / paid-up capital, served as the last element of
  `data` on a `view="all"` call and selectable on its own. These are rule 15's
  "(registry)" rows: a second record beside the filed figures, never a
  restatement of them and never cap-table coverage — no share classes,
  allotments, holders or rounds stand behind them. Every row carries its own
  citation inline and its own capture date; cite them "per registry master
  data, captured <date>"; where a row carries no capture date the whole clause
  becomes "per registry master data, capture date unknown" — never "captured
  null", never an empty date. Take each row's display name from
  the envelope's `fact_key_labels` (e.g. "Authorised capital (registry)") —
  never name one yourself. This view can be live while every filed view is
  `not_available` and the envelope state is `fallback`. That state means no
  *filed cap-table* content — never that the company has filed nothing, since
  it may have filed other forms, and never that the record holds nothing.

The API is **read-only** — nothing you do can change the data.

## The flow

1. **Resolve** — `resolve_subject(query)`. `proceed` → take `data.subject_id`
   + `data.canonical_name`. `clarify` → confirm before proceeding (rule 3):
   **one** candidate → yes/no confirm; **two or more** → present them and ask
   which. `stop` → no such company is on record — stop.
2. **Fetch** — `get_captable(subject_id, view="all")`. `fallback` → known
   company, no filed cap-table content — render the header; then, if the
   registry capital view is live, its rows as rule 15's "(registry)" lines
   cited "per registry master data, captured <date>"; then "not available"
   for every filed section, with that view's own `reason` where it carries
   one; reproduce the
   envelope's `message` — it says which case this is. `proceed` → every
   view's own `status` tells you whether it has content; render "not available" (with its `reason`)
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
  citation of their own, so they cite the same row their inputs came
  from) — label the derived figures **"derived, not filed"** alongside it.
- **Filed vs. derived, always labelled**: never present a derived figure
  (share price, pre/post-money, dilution %) as if it were itself a number
  from the record. Cite its `formula_id` and `model_version` when the
  distinction matters to the reader.
- **Holders are document-grain, not round-grain**: when one document carries more
  than one allotment round, the same holder list is shown for each of that
  document's rounds (a document-grain warning says so) — the source doesn't let
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

- A document on record, with pages: `[SRN M12345678 · p.7–9]`
- A pageless document on record (no pages — this is honest, not missing):
  `[SRN M12345678 · no page range]`
- Always make the `cite_url` permalink available so a reader can open the
  source document — never print a raw `s3://` path.

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
this document's layout does not carry. Never swap one for another: each makes a
different claim about the source.

## When no account is connected

**A listed tool is not a connected account.** The `celorus-data` tools can all be
listed, and the panel can report the server connected, while the account behind
them is not authorized: a sign-in that has aged out leaves every tool in place and
every call refused. Tool-list membership is therefore silent on exactly the case
this section exists to catch, and neither it nor the word "connected" is the test.

The test is a call. This session has an account when a `celorus-data` call comes
back with data, and not before, so the first call this skill makes is what settles
it. Its answer is binding:

- **Data comes back.** The account is connected. Carry on.
- **The call asks you to sign in or to re-authorize, or refuses for want of
  authorization.** The account is not connected, whatever the tool list or the
  panel says. Stop on that first answer: do not call again, do not try a different
  tool to see whether that one works, and do not attempt the report or the answer.
  Every tool here sits behind the same sign-in, so a second call only spends a
  second refusal to learn what the first one already said.
- **No `celorus-data` tool is there to call.** The account is not connected either,
  and there is nothing here to attempt.
- **Anything else: an error, an empty answer, or a reply you cannot read as one of
  the three above.** It settles nothing, and it is not an account; do not read it as
  one. Make one more `celorus-data` call and let its answer decide, under these
  same four outcomes. That is the last call: if the second answer is also
  unreadable, treat this session as having no account, stop there, and do not
  attempt the report or the answer.

Never fill what you could not read from memory or the web; a web answer is
`research-lead`'s job and it carries the web register's label.

Say what the record can answer for this company, never what it says. No count, no
figure, no URL, on any lane. Pick the case the check found, then close with the
lane's own sentence.

**Where the case comes from.** This holds for a company only. For a person or a family there
is no check and no cache: the check defers persons, so the case is "The record was not asked
by this name".
For a company, take the first of these that applies:

- **The desk's cache.** The cache is `.celorus/cache/check-<slug>.md` under the desk folder,
  found as `research-lead`'s "Find the desk" says: the folder named by `CELORUS_DESK`, or else
  the nearest folder up from the working directory that holds `celorus/index.md`. Here
  `<slug>` is the cache key, not a page's slug: the name as asked, lowercase, with every run
  of characters that are not letters or digits turned into one hyphen. With no desk, no cache
  is read or written, and the check is asked at most once in this session. Read the current
  entry first: a case, "Not found" or "Clarify" under the key is current for a day after it
  was asked, or for an hour when it is the case "On the record, counts not available", and a
  current one answers before any note under that key, however late the note was written. Only
  when nothing under the key is current are the notes read, each only while it holds: a
  "Refused" until the time it may be asked again, a "Could not read" for an hour after it was
  asked; a note whose time has passed is not read. When a note holds, first read the other
  keys it records: a case, or a "Not found" or "Clarify" when the note does not keep that the
  company is on the Celorus record, current under any of them answers as it would under its
  own key, and the note is not read. When current entries under more than one key disagree, a
  case answers before a "Not found" or a "Clarify", and otherwise the latest asked answers. A
  "Refused" or "Could not read" entry is a note, not a case and never a miss: it is read only
  by its own rule, never as a case. Writing a case, "Not found" or "Clarify" under a key
  replaces any note under that key. Writing a note never replaces a case: the case stays under
  the key beside the note. When the cache holds a case other than "On the record, counts not
  available" asked less than a day ago, or that case asked less than an hour ago, use that
  case, ask nothing, and say when it was checked, in words (for example: checked today, at ten
  past two); after that hour, read the notes, and ask again only when none holds. When it
  holds "Not found" asked less than a day ago, ask nothing, and route it as a fresh
  `not_found` (below). When it holds "Clarify" asked less than a day ago, ask nothing and ask
  the user to choose among its names. A note keeps that the company is on the Celorus record
  only until a day after the kept case was asked, the time the note carries; after that day
  the note keeps nothing, and while it still holds, the case is "The record was not asked by
  this name", with the note's own line. When the cache holds "Refused" and the time it may be
  asked again has not come, ask nothing, say in one line that the record was asked too often
  and when it may be asked again, when the note says that time came from the refusal;
  otherwise say in one line that the record was asked too often and to try again later, never
  naming the kept time. The case is "The record was not asked by this name", or "On the
  record, counts not available" when the note keeps that the company is on the Celorus record.
  When it holds "Could not read" asked less than an hour ago, ask nothing, say in one line
  "the check could not read the record, asked at HH:MM" with the time it was asked, and the
  case is "The record was not asked by this name", or "On the record, counts not available"
  when the note keeps that the company is on the Celorus record; after the hour, ask again.
- **The check.** Else, when a `celorus-check` connection is present in this session, ask its
  `check_record` tool once, through that connection, with the name and the kind `company`, and
  write the case and the time it was asked to the cache, never the counts. Before asking with
  a name other than the one the user asked, read the cache under that name's key too: an entry
  current there answers, a note that holds there is read by its own rule, and either way
  nothing is asked. Every time kept in the cache, a case's, a "Refused" retry time, a "Could
  not read" time and a "Not found" time, is an ISO timestamp with its offset; the spoken form
  is for display only. One answered ask per company per day on this desk, however many record
  skills run on it: the cache is what holds that ration. A failed read is held on the desk for
  an hour and then asked again. If the check answers with an error in place of an answer (a
  read it could not make, a query it will not take, or the ask refused as too many requests),
  that is a non-answer and not a miss: say it as the check not answering, never as "not on the
  record" or as anything about the company. If the check refuses the ask as too many requests,
  write "Refused" and the time it may be asked again to the cache, noting whether that time
  came from the refusal (when the refusal shows no wait, the time is a day after the refusal
  and did not come from it). Say in one line when it may be asked again and what its limit is,
  in words, when the refusal shows them (its `retry_after_s`, `limit` and `message`);
  otherwise say in one line that the record was asked too often and to try again later. If it
  could not read the record, write "Could not read" and the time it was asked to the cache,
  and say in one line "the check could not read the record, asked at HH:MM" with the time it
  was asked. If it will not take the query, keep nothing, and say in one line the check's own
  error words as it gave them. The case is then "The record was not asked by this name". But a
  "Refused" or "Could not read" written under a key that holds the case "On the record, counts
  not available" asked less than a day ago keeps that the company is on the Celorus record, so
  a failed ask does not lose that fact, and the case is then "On the record, counts not
  available".
- **Neither.** Else, and only then, the case is "The record was not asked by this name".

Nothing the plugin runs itself asks the check: the ask goes through the harness's
connection, never through a script, a hook or the engine.

The cache holds a case, "Not found" or "Clarify", each with its time, and never a count. It
also holds two notes and no other error from the check: "Refused", with the time it may be
asked again and whether that time came from the refusal, and "Could not read", with the time
it was asked. Each note also carries whether it keeps that the company is on the Celorus
record, with the time the kept case was asked when it keeps. "Depth on record": the check
answered `on_record` and the record holds returns the company has filed. "Only the identity
and the board are on record": it answered `on_record` and the record holds none filed. An
`on_record` answer with null `counts` is the case "On the record, counts not available", kept
as that case, never as counts and never as "The record was not asked by this name", because
the record was asked and answered: say the value sentence of that case's row in the table
below. Its missing counts are a failed read: the case is held on the desk for an hour, not a
day, and it is not the day's one answered ask. A `not_found` is kept as "Not found", and a
kept one is routed exactly as a fresh one. Only a `not_found` is a miss; an error from the
check never is. Every entry is written under the key of the name the user asked, under the key
of the name the check was asked with when that differs, and under the key of the check's
canonical name when it gave one. A "Refused" or "Could not read" note also records the other
keys it was written under. A "Not found" entry also records the name the check was asked with,
and a fresh or held "Not found" is never said to the user as a case: say the "not on the
Celorus record yet" line below only when that recorded name is the company's registered name,
as the desk's own pages or this session's web register record it; otherwise the case is "The
name does not resolve". On `clarify`, show the user the candidate names and ask which one is
meant, and write "Clarify" with its time and those names, names only and never a count. Within
the day, a skill that finds it asks the user to choose among those names without asking the
check again; when a name is chosen and the check is asked for it, write that case under the
chosen name's key and the asked name's key. On "Depth on record", the desk's mandate picks the
row: a seller vetting a counterparty or a banker reads its own row.

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
