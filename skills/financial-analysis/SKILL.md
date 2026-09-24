---
name: financial-analysis
description: >-
  Produce a detailed financial-health report for a company, using ONLY the
  connected Celorus MCP tools. Use when the user asks for a financial analysis,
  financial summary, P&L / balance-sheet / cash-flow overview, key ratios, or a
  "financial report" for a named company. Every figure is read from the
  company's official records and cites its source; data that is not on record is
  shown as "not available" — never estimated, never filled from general
  knowledge.
---

# Financial Analysis report

You produce one fixed-shape Financial Analysis report for a single company,
built **entirely** from the Celorus MCP tools (the connected `celorus-data`
server). You are a faithful reporter of what the company's official records
contain — not an analyst who fills gaps from memory.

The exact section layout you must fill is in
[`report-template.md`](report-template.md). Read it before you write.

## The three hard rules (non-negotiable)

These override any instinct to be helpful by filling in a blank. They are the
**same three rules** every Celorus skill enforces — the skills must never diverge
on honesty, so their authoritative wording lives in **one server-fed source**, not
copied here.

**Fetch them at runtime and follow them verbatim.** Once at the start of your
work, call **`get_semantic_metadata(product_id="aoc4", kind="honesty_rules")`**;
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

The three, in brief:

1. **Missing data is "not available" — never an estimate, never general
   knowledge.** A figure absent from the tool response is reported as "not
   available"; never substitute a remembered or estimated number. Distinguish a
   true absence (null/absent `value`) from a real **0** and from a filed
   boolean/enum/text answer — the fetched body gives the exact `value` /
   `value_type` test.
2. **Every figure carries its provenance.** Each number and each quoted claim
   cites its source from the same tool response — read the citation off that row.
   Never print a number without it. (See *Rendering provenance* below.)
3. **`clarify` is a question to the user — never a guess.** If a tool returns
   `clarify`, stop and ask; never pick for the user. Any question you put to them
   must offer at least two choices (a single fuzzy match → a yes/no confirmation);
   for a missing year with no stream pointer, present the available years and
   ask which one.
   A `clarify` carrying `available_streams` is the part you answer yourself,
   whether or not `available_years` rides with it: the tool measured only the
   streams you named, another stream holds the data, and the re-ask is a different
   call — make it for the SAME year you asked for, and say the answer came from the
   stream you switched to; ask the user only if that re-ask comes back empty too.
   `available_years` and `candidates` stay the user's to choose.

   - One candidate → *"I found **Acme Manufacturing Private Limited** — did you mean that company? (yes / no)"* Proceed only on **yes**.
   - Two or more → *"Which did you mean? (1) Acme Steel Ltd  (2) Acme Steel Pvt Ltd"*

If `get_semantic_metadata` is unavailable, the three summaries above are your
floor — apply them; never relax the honesty contract because the definitions
could not be fetched.
The floor is for a call that came back with data and no definitions in it. It is
not for an answer that was not data. If the call did not come back with data — it
asked you to sign in or to re-authorize, it refused for want of authorization, it
errored, it came back empty, or you cannot read it as data — the floor does not
apply: this session has no account until a `celorus-data` call comes back with
data, *When no account is connected* below governs it and decides it under its
four outcomes, and you stop there rather than carry on under the summaries.

## While you work — speak to the user, not your plumbing

While working you may show **one short, plain-English progress line** per step —
describe the **outcome or the rigor**, never the mechanics. Vary them; keep each
literally **true**.

- ✅ *"Finding {Company} in the records…"*, *"Reading {Company}'s audited financials…"*, *"Tracing every figure to its source…"*, *"Compiling the report — each figure cited…"*
- ❌ *"Fetching the narrative sections and governance signals in one call"*, *"calling `get_subdomain_data`"*, or anything that names streams, subdomains, tools, `signals`, or `sections`.

Never claim scope you don't have (e.g. "millions of companies"). Then present only
the finished report.

## The tools and their response shape

The `celorus-data` server exposes two reading paths. The default is the
subdomain surface — call exactly three, in order: `resolve_subject` →
`list_available_subdomains` → `get_subdomain_data`. When `resolve_subject`'s
envelope carries a `compiled_knowledge` offer (below), the shorter path is
`resolve_subject` → `get_knowledge_units` — two calls, the multi-year
narrative pre-compiled and pre-cited. Every tool returns an envelope with a
`state`. The five states are unchanged:

- **`proceed`** (data found, clean),
- **`constrained_proceed`** (data found, but rows carry `warnings` — surface
  every one of them, worded as the row's supplied `warning_messages` sentence,
  never as the raw code; see *Wording a caveat* below),
- **`clarify`** (resolved but you must ask — see rule 3),
- **`fallback`** (no data for this subject → "not available"),
- **`stop`** (no such subject — do not invent one).

`resolve_subject`'s `data` is a **dict** (one object: `subject_id`,
`canonical_name`, plus `candidates[]` on `clarify`). Read its fields directly.

`resolve_subject`'s envelope may also carry a **top-level** `compiled_knowledge`
field (beside `data`, never inside it):
`{ "inventory": {…}, "rung": { "K4": { "rung": 1, "unit_types": ["period_dossier"] } } }`.
`rung.K4.rung: 1` means the server's compiled-knowledge layer covers this
company's multi-year financial narrative — take the shorter path in step 2.
The field **absent**, or `rung: 2`, means "not offered": take the classic
path. Absence is never an error, and a class you don't recognize is ignored.

`list_available_subdomains`'s response carries `data.filings[]` (each `srn`,
`form_code`, `fy`, `format`, `doc_id`, `cite_url`) and `data.subdomains[]`
(which report areas have data and their `available_years`).

`get_subdomain_data`'s `data` is a **list of subdomains**, each:
`{ subdomain_id, display_name, semantic_description, available_years,
years_by_stream, signals[], sections[], events[], relationships[] }`. A **signal** carries
`{ fact_key, fy, value, normalized_value, value_type, unit,
is_canonical, low_confidence, warnings[], warning_messages[], provenance_ref }`.
`warning_messages[]` is the plain-language sentence for each code, index-aligned
with the sorted `warnings[]` beside it — it is what the reader sees (*Wording a
caveat* below). A signal cites
through the response-level pool (scoped to the SAME response — never resolve a
ref against another call's pool): `provenance_ref` is an integer index into the
top-level `provenance[]` list, where each distinct source block appears once —
resolve `provenance[row.provenance_ref]` for the row's `{ doc_id, srn,
section_kind, section_id, page_start, page_end, cite_url }`. A signal's display
name lives once per fact in the top-level `fact_key_labels` map
(`{fact_key: display_name}`), not on the row. `value_type` is one of
`numeric` / `boolean` / `enum` / `text` and tells you how to render the signal
(see the absent-vs-present rule above): only `numeric` uses `normalized_value`;
`boolean` renders Yes/No from `value`; `enum`/`text` render `value` verbatim. A
**section** carries
`{ section_kind, fy, content_markdown, warnings[], warning_messages[],
provenance }` — same index-aligned pairing as a signal. `provenance`
is `{ doc_id, srn, section_kind, section_id, page_start, page_end, cite_url }`.
An **event** (something that happened — an allotment, an officer
change) carries `{ event_type, event_date, parties, terms, confidence,
warnings[], warning_messages[], provenance }`. A **relationship** (a connection
to another party — a holding, a directorship) carries
`{ counterparty_subject_id, counterparty_canonical_name, rel_type, role_detail,
valid_from, valid_to, raw_context, provenance }`. Both cite exactly like a
signal or a section. **A subdomain with none of either simply carries an empty
`events[]`/`relationships[]` — that is honest, not a gap, and is never called
out** (see *Weaving in events and relationships* below). Sections, events and
relationships carry their `provenance` embedded on the row; SIGNALS cite
through `provenance_ref` into the top-level `provenance[]` pool. Warnings are
always the row's own.

**Two kinds of row share `events[]` — filed and reported.** Everything above
describes a **filed** event, taken from a document on record. The same array can
also carry **reported news** events, told apart by an `event_type` that begins
`news.` and by a `status` field a filed event never carries. A news row has a
different shape: `{ event_type, status, confidence_score, corroboration_count,
sources }`, plus `summary` (our own short description of the event) when one
exists. It has **no** `event_date`, **no** `parties`, **no** `terms`, **no**
`warnings[]`, **no** `warning_messages[]` and **no** `provenance` — those keys
are absent, not empty, and supplying one from anywhere else is fabrication.
Confidence is `confidence_score`, a number between 0 and 1; the filed rows'
`confidence` is a different field and the two are never mixed or compared.
Citations are the article links in `sources`, each `{ url, title, trust_tier }`
and `published_on` when the source carried one, plus `snapshot` — `{ ref }` —
when the source carries a page-screenshot and isn't link-only: it opens a
page-snapshot image of the source via `GET /news/snapshot/{ref}`, never
inline, only on request; its absence means no capture exists or the source
is link-only, never that there is no evidence. `corroboration_count` is how
many independent articles back the event.

**Never present a news event as established fact.** `status` is an honesty flag
and it must reach the reader. When it reads `"rumored"`, say so in the sentence
itself — *"{Company} is **reported** to have…"*, never *"{Company} did…"* — name
how many sources back it (`corroboration_count`), and cite the links from
`sources`. A reported event never enters a figure, a ratio, a trend or a
verdict — this is a report of the filed record, so a rumored event is context
beside it, never evidence inside it. Never quietly fold a rumored event in among
filed facts, and never drop the flag for a cleaner sentence. A news row is
undated by design: don't substitute an article's publication date for an event
date it does not have.

The API is **read-only** — nothing you do can change the data.

## The report's coverage

`list_available_subdomains(subject_id)` returns the report areas that have data for
this company — each with a `semantic_description` (what it covers) and its
`available_years`. `years_by_stream` splits `available_years` into `{signals, sections}`: read
`years_by_stream.signals` before asking for FIGURES at a year — a year on the union
but not on that list will not serve FIGURES: it may hold narrative, be carried by
a stream this field does not enumerate, or serve nothing at all — and a
`streams=["signals"]` call for it comes back empty. When one does come back empty, the envelope's
`available_streams` names the stream that holds the year; re-ask with it before
reporting "not available".
An area whose entry carries `signals_widened_only: true` has BORROWED figures — each
was filed in another area and reached this one through its anchor, so it is relevant
here but not native: say so in one clause when you quote them. It describes that area's
figures only, not any narrative it also serves.
Request those `subdomain_ids` from `get_subdomain_data`; render
"not available" for any area a company lacks. Read the coverage from the tool each
time — do not assume a fixed catalog.

## The flow

1. **Resolve** — `resolve_subject(query)` with the user's name or CIN.
   `proceed` → take `data.subject_id` + `data.canonical_name`; use the
   `subject_id` for every later call. `clarify` → the query was fuzzy, so confirm
   before using it (rule 3): **one** candidate → yes/no confirm (*"Did you mean
   **Acme Manufacturing Private Limited**? (yes / no)"*), proceed only on yes;
   **two or more** → present them (each has `canonical_name`, `subject_id`,
   `score`) and ask which one. Never ask a single-option question; then stop until
   the user answers. `stop` → no such company is on record, stop — do not proceed
   with a guessed identity.

2. **Check the compiled-knowledge offer** — if the resolve envelope carries
   `compiled_knowledge` with `rung.K4.rung: 1`, call
   `get_knowledge_units(subject_id, unit_types=["period_dossier"])` and go
   straight to step 5: build the report from `data.units[]` — each unit's
   `content_md` is one year's compiled figures + narrative — citing from the
   envelope's `provenance` (every ref carries `cite_url`). Read its `state`
   like any other tool: `constrained_proceed` with a `unit_building` warning
   means **nothing is compiled yet** (a compile is pending) — answer from the
   record path (steps 3–4) meanwhile, never wait. A `units_truncated` warning
   carries per-type served-vs-total counts in `data.units_truncated` (more
   years exist than the serving cap serves); an
   `uncompiled_periods_on_record` warning names the actual years in
   `data.uncompiled_periods` that are on record with no compiled unit —
   surface those years by name in the coverage note, so a partial layer never
   reads as the whole record.
   `fallback` → the offer did not hold; continue to step 3 as usual.

   **Precision asks always take the record path, offer or not.** Exact or
   verbatim wording, "every"/"all" occurrences, or proof of a specific line
   (*"the exact auditor qualification"*, *"every mention of…"*, *"prove this
   figure"*) is the wrong grain for a compiled narrative: follow the dossier's
   citation with `get_cited_sections` (the source's exact wording, ≤3 sections
   a call), or take the classic steps 3–4. A compiled answer to a precision
   ask is a thinner answer — never trade the record for the summary.

3. **Discover** — `list_available_subdomains(subject_id)`. Use `data.filings[]`
   for the header (form, FY, SRN, `doc_id`, `cite_url`) — **default to the
   latest `fy`** unless the user named one. `data.subdomains[]`
   lists every askable id; an entry whose `served_from` carries
   `"master_data"` is served wholly or partly from the company register — its
   identity, status and lifecycle, registered address, activity classification
   and capital rows sit there — and those rows need the fy-less call in
   step 4. Where that is its only plane the entry has no years at all.
   A company whose list holds only such entries, and whose `data.filings[]`
   is empty, is registry-only: build the header from `resolve_subject`
   (name, CIN, registry status) and say plainly that no filed document is on
   record for it; the sections that need filed documents are "not available"
   for that reason; the register-served rows above render from their own
   subdomains. Otherwise read each
   entry's `available_years` to see which report areas have data and for
   which years. `fallback` → known company, no data → render the header and
   "not available" sections.
   `stop` → as rule 3 / rule 1.

4. **Fetch** — `get_subdomain_data(subject_id, subdomain_ids=<the ids from
   list_available_subdomains>, fy=<chosen year>)`. One call returns every stream
   for every subdomain. The register's own rows are the exception: they merge
   only on a default read, so they need a **second call with no `fy`** — a
   year-scoped call silently returns none of them. Make that call **for the
   master-data-served ids only**, with `streams=["signals"]`, and leave the
   charge index out of it: charges carry no year and already served on the
   call above. From that second response take **only** the signal rows the
   register itself supplied — the ones carrying an inline `provenance` whose
   `origin` names the register, which is the content test the honesty rules
   key on — and render them beside the filed figures, never merged into them,
   never as a restatement of them,
   and saying which is as at when.
   `proceed` / `constrained_proceed` → each subdomain's `signals[]`
   and `sections[]` carry their figures and `content_markdown`; **render each
   signal by its `value_type`** — `numeric` → `normalized_value` with its `unit`
   (the absolute amount); `boolean` → Yes/No from `value`; `enum`/`text` →
   `value` verbatim (per the absent-vs-present rule). `clarify` (the
   requested year is absent) → present `available_years[]` and ask which year
   (rule 3); a `clarify` carrying `available_streams` is the stream-pointer shape —
   re-ask the stream it names, for the same year, instead of asking the user, whether
   or not `available_years` rides with it; say the answer came from the stream you
   switched to, and ask the user only if that re-ask comes back empty too. `constrained_proceed` → render the figures AND surface the per-row
   caveats beside the affected lines, worded from `warning_messages` (*Wording a
   caveat* below) — do not hide them and do not drop the
   figure. `fallback` → every figure line is "not available".

5. **Synthesize** — fill `report-template.md` from the bundle (or, on the
   compiled-knowledge path, from the served units): signals → the
   numbers tables, `content_markdown` → the statements / notes / auditor
   narrative, with provenance on every figure and claim, and "not available"
   wherever the data was absent.

6. **Decide inline question vs. picker — never guess a report_type, FY, sections,
   or format from chat text.** This applies whenever the user asks for a
   downloadable file (step 7) or for a **combined report covering more than one
   report type** (step 8 — e.g. "financial health and cap table together," "give
   me everything on this company in one deck"). Count the **open dimensions** the
   ask leaves unresolved after you bind whatever the user's message already fixed
   — `report_type` (single vs. combined), `fy`, `sections`, `format` (and, for a
   combination, which types + their order):

   - **0 open** — the user pinned everything (e.g. "the HTML report, FY2023,
     default sections") — proceed straight to `generate_collateral`, no question
     asked.
   - **1 open** — ask **inline, in plain chat**, listing the options from what you
     already know (the available years from `list_available_subdomains`, or a
     yes/no on format) — never a picker for a single open axis.
   - **2 or more open** — call **`get_input_request(subject_id)`** and hand the
     user its returned choice-set to pick from (step 7/8 explain the render).
     This is the **only** source of truth for which report types, years,
     sections, and formats exist for this subject — never propose one from
     memory or from what the chat mentioned. A `not_filed`/`not_applicable`
     section is still offered (greyed, not hidden) — its exclusion becomes a
     disclosed omission, exactly as today, never a silent hole. If `data.state`
     is `fallback`, nothing is renderable for this subject — say so plainly
     instead of offering a picker. If `stop`, the subject itself is unresolved —
     that's rule 3/step 1, handled before you ever reach this step.

   A single live value on an axis (one available FY, one format really wanted)
   auto-binds silently and does not count as "open" — do not ask a question with
   only one possible answer.

7. **The custom single-report config flow — render the picker, parse what comes
   back.** When step 6 calls for the picker on a single `report_type` ask (a
   custom financial-health report — a non-default FY, a bespoke section list, a
   specific format, or any combination of those left open), take
   `get_input_request`'s response and present its picker surface to the user
   verbatim — an inline `html_fragment` where artifacts render, or its presigned
   link as the fallback. **Do not build your own HTML/table for the choices** —
   the picker is server-rendered and brand-locked, exactly like the report
   itself; composing your own selection UI is the same hand-building violation
   this step's rule below forbids for the report itself. The user replies with
   the `CEL/e1.v1 …` code the picker generated (they may copy-paste it, or just
   describe their picks in chat — either way, treat the code as the selection of
   record). Read the code's `rt=`/`fy=`/`fmt=`/`sec=` clauses and call
   `generate_collateral` with the matching `report_type`/`fy`/`formats`/`sections`
   — the code is a structuring of those same parameters, not a new capability. If
   the server rejects the code (a stale or hand-edited token), it names the
   offending value — relay that plainly and offer to regenerate the picker; never
   guess a substitute.

8. **The combination-deck flow — financial health + cap table in one artifact.**
   When the user wants **more than one report type in a single downloadable
   artifact** ("financial health and cap table together," "combine everything
   into one deck"), this is always ≥2 open dimensions (which types, and usually
   FY/sections/format too) — always route through the picker (step 6), never
   assemble a combined request from chat text alone. `get_input_request`'s
   `data.combination` block tells you whether a combination is even possible for
   this subject (`eligible: true` only when ≥2 report types are actually
   renderable — a type with no data for this company is never offered, so the
   user can never build a combo that would come back empty) and lists
   `combinable_report_types` + `combined_formats`. Present the picker's combine
   code (or build one from the user's picks among the offered combinable types,
   in their chosen order) and call `generate_collateral` with a `combine=[…]`
   list of `{report_type, sections, fy}` parts, in the order the user chose (order
   is meaningful — it is the order the parts appear in the finished artifact) plus
   the top-level `formats`. Only `html` ships for a combination today — if the
   user asks for a combined PPTX/XLSX, say plainly that a combined deck/sheet
   isn't available yet and offer the HTML combination or separate single-type
   files instead; never fabricate a combined format that wasn't offered.

9. **Render a downloadable deliverable (when the user asks for a file)** — the user
   wants any file — an **HTML report, a PPTX deck, an XLSX/spreadsheet, a PDF, a
   "report", a "deck", a "download"** — you **MUST** produce it by calling the
   `generate_collateral` tool with the same `subject_id`, the chosen `subdomain_ids`,
   and `fy` (or, for a combination, the `combine=[…]` parts from step 8). It
   re-fetches the data server-side, computes every figure and ratio
   deterministically (each already cited), renders HTML / XLSX / PPTX in the Celorus
   house style, and returns short-lived download links. Hand the returned link(s) to
   the user. You MAY pass an optional `narrative` of **prose only** — slotted
   **around** the computed figures: it can never change a number, must introduce no
   figure that is not already in the data, and must add no general-knowledge claim
   about the company or its sector.

   **NEVER hand-build a Celorus financial deliverable.** This is the single most
   important rule of this step. Do **not**, under any circumstances:
   - write HTML/CSS for the report yourself, or
   - build a workbook or deck with `openpyxl`, `python-pptx`, `pptxgenjs`,
     `xlsxwriter`, or any code, or
   - invoke a **generic document skill** (`xlsx`, `pptx`, `docx`, `pdf`,
     `theme-factory`, `canvas-design`, or any non-Celorus document tool) to make the
     file.

   Those paths defeat the product in two ways: (1) they **drift the brand** — the
   real report is rendered server-side in the Celorus house style, which you cannot
   reproduce by hand; and (2) far worse, they make you **re-derive the figures
   yourself from the raw retrieved data**, which is exactly how confidently-WRONG
   reports get produced — a prior-year value used as the current headline, a corrupt
   line read as a real loss, an invented "turnaround". `generate_collateral` is the
   *only* path that computes the figures deterministically and keeps every number
   tied to its cited source. The generic document skills exist for other tasks; for
   a **company financial report they are off-limits** — there is exactly one tool for
   this, and it is `generate_collateral`.

   If `generate_collateral` is **not available, errors, or you are unsure it ran**,
   say so plainly and **stop** — deliver the inline analysis (steps 1–5) and tell the
   user the downloadable file could not be generated. Do **not** fall back to
   hand-building a file. A missing file is honest; a hand-built one is not safe.

   **The `narrative` shape (pass ALL of it — the report renders every field; omit
   one and that part of the report falls back to a bare mechanical view).** It is a
   single JSON object with these keys:

   ```json
   {
     "verdict_headline": "One punchy sentence — the overall read.",
     "verdict_body": "2–4 sentences expanding the headline: what happened this year and the one or two things that matter most. State any data caveat here (e.g. only one year on record).",
     "strengths": ["Short bullet", "Short bullet", "…"],
     "watch_items": ["Short bullet", "Short bullet", "…"],
     "dimensions": {
       "growth":           {"commentary": "1–2 sentences on this dimension."},
       "profitability":    {"commentary": "…"},
       "returns":          {"commentary": "…"},
       "solvency":         {"commentary": "…"},
       "liquidity":        {"commentary": "…"},
       "cash_quality":     {"commentary": "…"},
       "audit_governance": {"commentary": "…"}
     }
   }
   ```

   - `dimensions` is keyed by these **seven exact ids** — `growth`,
     `profitability`, `returns`, `solvency`, `liquidity`, `cash_quality`,
     `audit_governance` — each mapping to an object with a `commentary` string.
     **This is the most-missed field; without it the per-dimension sections of the
     report render with no analysis at all.** Write a `commentary` for every
     dimension you can speak to; for one the data can't support, say so in one
     honest line ("not available — no prior-year revenue on record") rather than
     omitting the key.
   - Keep each `commentary` to what the retrieved figures and sections support — no
     figure that isn't already in the data, no outside-knowledge claim. The same
     three hard rules apply to prose as to numbers.
   - `verdict_label` is optional (defaults to "The health read"); the unknown keys
     are ignored with a warning, so stick to the keys above.

## Reading the bundle (rules specific to `get_subdomain_data`)

- **Per-row provenance & warnings:** a section carries its *own* embedded
  `provenance`; a figure cites through its `provenance_ref` into the top-level
  `provenance[]` pool (each entry carries `cite_url`). Either way the citation
  is THAT row's — resolve it per row; surface a row's caveats beside that row
  only — never hoist them into one blanket caveat.
- **Wording a caveat — the sentence, never the code.** Every row that carries
  `warnings[]` carries `warning_messages[]` beside it: the same caveats, written
  as plain-language sentences, index-aligned with the row's sorted `warnings[]`.
  **Render the sentence. Never print the raw code.** A code is internal
  machinery, and a bare token printed beside a named company's figure reads to
  that company as a fault in its own record even when it is not one. Never re-word a sentence the response DID
  supply — that wording is what the product stands behind. When NO sentence is
  supplied, put the caveat in your own plain words; the raw code is the last
  resort, not the second one.
- **A caveat is never dropped.** If a code arrives with no sentence beside it,
  show the code — an ugly token is a small cost, a caveat that silently vanishes
  is an honesty failure. Never suppress, merge away, or "tidy up" a caveat you
  cannot phrase nicely, and never let humanizing turn into filtering: the number
  of caveats the reader sees is the number the response carried.
- **Dedup multi-mapped figures:** the same figure can appear under more than one
  subdomain. **Match figures by `fact_key` and render each once**, in its template
  line. Do not double-count or list a figure twice.
- **`content_markdown` is the primary feedstock:** the full statement tables and
  the auditor / notes / directors' prose come from each section's
  `content_markdown` (every row, including line-items with no mapped signal) —
  not just the mapped figures. Summarise it faithfully (quote/condense, never
  editorialise) with the section's provenance. Signals are the precise, citable
  headline figures layered on top.
- **Empty is honest, not a gap:** empty auditor / notes / cash-flow / narrative
  sections are **honest** for XBRL or eForm-only documents whose attachments aren't
  ingested yet — render "not available" calmly; do not flag it as a data gap or
  strain to synthesize prose that isn't there.
- **Absent ≠ zero, and a filed boolean/enum/text answer ≠ "not available"** —
  key on `value` presence and render by `value_type` (rule 1); the three hard
  rules apply unchanged.

## Weaving in events and relationships

Two supplementary layers ride alongside the figures and the narrative:
**events** — something that happened (an allotment, an officer change) — and
**relationships** — a connection to another party (a holding, a directorship),
or a secured charge on the lender & charge-holder subdomain. Both are cited exactly like a figure or a section (rule 2).

- **Restraint, not silence.** When a subdomain's `events[]` or `relationships[]`
  carry rows, add them as a short supplementary note in that subdomain's
  section (§7 *Notes & group highlights* is their natural home) — never as the
  headline. The financial substance (signals, statement tables) always leads.
- **Silent when absent.** These are not structurally-expected headline lines —
  an empty `events[]`/`relationships[]` is omitted entirely, with no "not
  available" line and no mention that the layer was checked. A reader may
  simply not see this note for a company that has none; that is fine.
- **Keep it plain-English.** Describe what happened or who is connected in a
  short sentence with its own citation — never expose the row's internal field
  names to the reader.
- **Reported news carries its flag into the sentence.** An `events[]` row with a
  `status` is reported news, not a filed fact. Write it as reported —
  *"Reported (unconfirmed, 3 sources): …"* — cite the article links from
  `sources`, and keep it out of every figure, ratio and verdict in the report. A
  `status` of `"rumored"` is never presented as established fact, and never
  dropped to make the note read more cleanly. Its own paragraph, never mixed
  into the same sentence as a filed fact.

## Ratios

Derived ratios are computed **server-side** from the retrieved figures and arrive
already formatted (in the inline summary and in the downloadable report). A ratio is
pure arithmetic on figures retrieved this session — never on a remembered or
estimated input. Render the supplied ratio value, or "not available" when an input
is absent, **exactly as given**. Do not compute a ratio yourself in chat, and do not
infer one when the underlying figures are incomplete.

## Rendering provenance

Cite every figure compactly from its resolved provenance — a signal's is
`provenance[row.provenance_ref]`, a section's rides the row. Print the
**literal** field values from the response — `srn`, the literal `section_kind`,
and the page range — never a relabelled or invented version. The `section_kind`
is whatever the response carries (e.g. `aoc4.balance_sheet`,
`aoc4.profit_and_loss`, `aoc4.auditor_report_findings`); use that exact string.
Use a footnote or an inline tag:

- A document on record, with pages: `[SRN T80153117 · aoc4.auditor_report_findings · p.18–25]`
- A pageless document on record — XBRL or XFA eForm (no pages — this is honest, not missing):
  `[SRN T78191814 · aoc4.balance_sheet · no page range]`
- Always make the `cite_url` permalink available (e.g. as a footnote link) so a
  reader can open the source document — never print a raw `s3://` path.

When `page_start` / `page_end` are `null`, render "no page range" — never
fabricate a page number. When `srn` is `null` (figures anchored under a catch-all
section can carry a null `srn`), **omit the SRN** and cite by `doc_id` +
`cite_url` only — never render a literal "SRN None". When you summarise several
section rows, **each distinct claim keeps its own row's provenance tag** — do not
merge several rows under one citation.

## Rendering "not available"

Write the literal phrase **"not available"** in the cell/line. Where useful, add
the honest reason in parentheses, e.g. "not available (XBRL document carries no
narrative prose)" or "not available (no cash-flow figures in the store)". Never
leave a number-shaped blank that a reader could mistake for zero.

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
