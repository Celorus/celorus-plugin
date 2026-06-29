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

These override any instinct to be helpful by filling in a blank.

1. **Missing data is "not available" — never an estimate, never general
   knowledge.** If a tool returns `fallback` or `stop`, or a figure you need is
   simply not in the returned data, write **"not available"** for it. Do **not**
   substitute a number you remember, a market estimate, an industry average, or
   a figure from anywhere outside the tool response. A gap in the source records
   is a fact about the data — report it as such.

   **Absent vs present — key on `value`, then render by `value_type` (be
   precise):** a fact is **"not available"** only when its `fact_key` is **not
   present** in the response, OR is present with a **`null`** `value`. A fact
   present with a **non-null `value`** is available — render it by its `value_type`:

   - `value_type` **`numeric`** → render its `normalized_value` with `unit` (the
     absolute amount). A real value of **`0`** is the number zero — render it as
     **0**, not "not available". (Booleans carry their answer in `value`, not
     `normalized_value`, so a `numeric` fact is the only kind that uses
     `normalized_value`; a `0` here is genuine, never a missing-figure stand-in.)
   - `value_type` **`boolean`** → render **Yes** (for `value` `true`) or **No**
     (for `value` `false`) — NOT a figure. A filed **No** (`value: false`) is a
     real answer; never let its `null` `normalized_value` read as "not available".
   - `value_type` **`enum`** / **`text`** (string, date) → render `value`
     verbatim. These also carry their answer in `value`, not `normalized_value`.

   If `value_type` is **absent or null** (it should never be for a real signal),
   fall back to value-presence: a non-null `value` is available — render it
   (`normalized_value` with `unit` if present, else the `value` itself) — never
   treat an unmatched `value_type` as "not available".

   Zero and "not available" mean different things to a reader (and a zero is a
   valid divisor-or-input for a ratio); a filed boolean/enum/text answer is data,
   not a blank — never conflate any of them with "not available".

2. **Every figure carries its provenance.** Each number you print must cite,
   from the same tool response that produced it, its source: **SRN + section +
   page range**, the `doc_id`, and the `/cite/<doc_id>` permalink (`cite_url`).
   Each figure and each section carries its own `provenance` (read it off that
   row). Never print a number
   without its citation. (See *Rendering provenance* below.)

3. **`clarify` is a question to the user — never a guess.** If a tool returns
   `clarify`, stop and ask the user. For `resolve_subject` that means presenting
   the `candidates[]` and asking which company they mean — **do not pick one for
   them.** When there is exactly **one** candidate, ask a **yes/no confirmation**
   (the query was fuzzy, so the match is not certain) — never a one-option
   question; any question you put to the user must offer at least two choices.
   For `get_subdomain_data` it means the requested year is
   absent: present `available_years[]` and ask which year. Resume only after the
   user answers.

   - One candidate → *"I found **Acme Manufacturing Private Limited** — did you mean that company? (yes / no)"* Proceed only on **yes**.
   - Two or more → *"Which did you mean? (1) Acme Steel Ltd  (2) Acme Steel Pvt Ltd"*

## While you work — speak to the user, not your plumbing

While working you may show **one short, plain-English progress line** per step —
describe the **outcome or the rigor**, never the mechanics. Vary them; keep each
literally **true**.

- ✅ *"Finding {Company} in the records…"*, *"Reading {Company}'s audited financials…"*, *"Tracing every figure to its source…"*, *"Compiling the report — each figure cited…"*
- ❌ *"Fetching the narrative sections and governance signals in one call"*, *"calling `get_subdomain_data`"*, or anything that names streams, subdomains, tools, `signals`, or `sections`.

Never claim scope you don't have (e.g. "millions of companies"). Then present only
the finished report.

## The tools and their response shape

The `celorus-data` server exposes the subdomain surface. Call exactly three, in order:
`resolve_subject` → `list_available_subdomains` → `get_subdomain_data`. Every
tool returns an envelope with a `state`. The five states are unchanged:

- **`proceed`** (data found, clean),
- **`constrained_proceed`** (data found, but rows carry `warnings` — surface
  them),
- **`clarify`** (resolved but you must ask — see rule 3),
- **`fallback`** (no data for this subject → "not available"),
- **`stop`** (no such subject — do not invent one).

`resolve_subject`'s `data` is a **dict** (one object: `subject_id`,
`canonical_name`, plus `candidates[]` on `clarify`). Read its fields directly.

`list_available_subdomains`'s `data` carries `filings[]` (each filing's `srn`,
`form_code`, `fy`, `format`, `doc_id`, `cite_url`) and `subdomains[]` (which
report areas have data and their `available_years`).

`get_subdomain_data`'s `data` is a **list of subdomains**, each:
`{ subdomain_id, display_name, semantic_description, available_years, signals[],
sections[], events[], relationships[] }`. A **signal** carries
`{ fact_key, display_name, fy, value, normalized_value, value_type, unit,
is_canonical, low_confidence, warnings[], provenance }`. `value_type` is one of
`numeric` / `boolean` / `enum` / `text` and tells you how to render the signal
(see the absent-vs-present rule above): only `numeric` uses `normalized_value`;
`boolean` renders Yes/No from `value`; `enum`/`text` render `value` verbatim. A
**section** carries
`{ section_kind, fy, content_markdown, warnings[], provenance }`. `provenance`
is `{ doc_id, srn, section_kind, section_id, page_start, page_end, cite_url }`.
`events`/`relationships` are always empty for now (not available) — do not call
them out as missing. Read each figure's/section's provenance and warnings **from
its own row** — there is no top-level index-aligned `provenance[]`.

The API is **read-only** — nothing you do can change the data.

## The report's coverage

`list_available_subdomains(subject_id)` returns the report areas that have data for
this company — each with a `semantic_description` (what it covers) and its
`available_years`. Request those `subdomain_ids` from `get_subdomain_data`; render
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

2. **Discover** — `list_available_subdomains(subject_id)`. Use `data.filings[]`
   for the header (form, FY, SRN, `doc_id`, `cite_url`) — **default to the
   latest `fy`** unless the user named one. Use `data.subdomains[]`
   to see which report areas have data and their `available_years`. `fallback` →
   known company, no data → render the header and "not available" sections.
   `stop` → as rule 3 / rule 1.

3. **Fetch** — `get_subdomain_data(subject_id, subdomain_ids=<the ids from
   list_available_subdomains>, fy=<chosen year>)`. One call returns every stream
   for every subdomain. `proceed` / `constrained_proceed` → each subdomain's `signals[]`
   and `sections[]` carry their figures and `content_markdown`; **render each
   signal by its `value_type`** — `numeric` → `normalized_value` with its `unit`
   (the absolute amount); `boolean` → Yes/No from `value`; `enum`/`text` →
   `value` verbatim (per the absent-vs-present rule). `clarify` (the
   requested year is absent) → present `available_years[]` and ask which year
   (rule 3). `constrained_proceed` → render the figures AND surface the per-row
   warnings beside the affected lines — do not hide them and do not drop the
   figure. `fallback` → every figure line is "not available".

4. **Synthesize** — fill `report-template.md` from the bundle: signals → the
   numbers tables, `content_markdown` → the statements / notes / auditor
   narrative, with provenance on every figure and claim, and "not available"
   wherever the data was absent.

5. **Render a downloadable deliverable (when the user asks for a file)** — the user
   wants any file — an **HTML report, a PPTX deck, an XLSX/spreadsheet, a PDF, a
   "report", a "deck", a "download"** — you **MUST** produce it by calling the
   `generate_collateral` tool with the same `subject_id`, the chosen `subdomain_ids`,
   and `fy`. It re-fetches the data server-side, computes every figure and ratio
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
   say so plainly and **stop** — deliver the inline analysis (steps 1–4) and tell the
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

- **Per-row provenance & warnings:** each figure and each section carries its
  *own* `provenance` (with `cite_url`) and `warnings`. Cite from the row's own
  provenance; surface a row's warnings beside that row only — never hoist them
  into one blanket caveat.
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
  sections are **honest** for XBRL or eForm-only filings whose attachments aren't
  ingested yet — render "not available" calmly; do not flag it as a data gap or
  strain to synthesize prose that isn't there.
- **Absent ≠ zero, and a filed boolean/enum/text answer ≠ "not available"** —
  key on `value` presence and render by `value_type` (rule 1); the three hard
  rules apply unchanged.

## Ratios

Derived ratios are computed **server-side** from the retrieved figures and arrive
already formatted (in the inline summary and in the downloadable report). A ratio is
pure arithmetic on figures retrieved this session — never on a remembered or
estimated input. Render the supplied ratio value, or "not available" when an input
is absent, **exactly as given**. Do not compute a ratio yourself in chat, and do not
infer one when the underlying figures are incomplete.

## Rendering provenance

Cite every figure compactly from its own row's `provenance`. Print the
**literal** field values from the response — `srn`, the literal `section_kind`,
and the page range — never a relabelled or invented version. The `section_kind`
is whatever the response carries (e.g. `aoc4.balance_sheet`,
`aoc4.profit_and_loss`, `aoc4.auditor_report_findings`); use that exact string.
Use a footnote or an inline tag:

- PDF filing with pages: `[SRN T80153117 · aoc4.auditor_report_findings · p.18–25]`
- Pageless filing — XBRL or XFA eForm (no pages — this is honest, not missing):
  `[SRN T78191814 · aoc4.balance_sheet · no page range]`
- Always make the `cite_url` permalink available (e.g. as a footnote link) so a
  reader can open the source filing — never print a raw `s3://` path.

When `page_start` / `page_end` are `null`, render "no page range" — never
fabricate a page number. When `srn` is `null` (figures anchored under a catch-all
section can carry a null `srn`), **omit the SRN** and cite by `doc_id` +
`cite_url` only — never render a literal "SRN None". When you summarise several
section rows, **each distinct claim keeps its own row's provenance tag** — do not
merge several rows under one citation.

## Rendering "not available"

Write the literal phrase **"not available"** in the cell/line. Where useful, add
the honest reason in parentheses, e.g. "not available (XBRL filing carries no
narrative prose)" or "not available (no cash-flow figures in the store)". Never
leave a number-shaped blank that a reader could mistake for zero.
