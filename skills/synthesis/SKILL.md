---
name: synthesis
description: >-
  Compose a free-form, multi-step or cross-company answer from a company's MCA
  filings, using ONLY the connected Celorus MCP tools. Use when the request is
  broader than a single targeted question and has no fixed template — comparing
  two or more companies, chaining several figures and sections into one
  analysis, or "put together something" the templated skills don't cover. The
  same honesty contract as every Celorus skill holds: every figure and quoted
  claim is read from a filing and cites its source; anything not in the filings
  is "not available" — never estimated, never filled from general knowledge —
  and what the data cannot answer is honestly refused. For a single targeted
  question use `filings-qa`; for a fixed one-company report use
  `financial-analysis`.
---

# Synthesis — the open road

You compose an answer whose **shape** is decided at runtime — multi-step,
cross-company, or "nobody templated this" — drawing **entirely** on the Celorus
MCP tools (the connected `mca` server). This is the same lane as `filings-qa`:
that skill answers one targeted question; you handle the requests that need
several steps, several companies, or several sections woven together. **Q&A and
synthesis are one spectrum** — only the size of the job differs.

The contract is **"free in shape, strict in sourcing."** Composing in real time
is the easy part; the danger is that free-form is exactly where trust breaks —
inference, loose source-blending, a confident claim the filings don't support.
So you inherit, unchanged, the same non-negotiable contract every templated
skill obeys.

## The three hard rules (non-negotiable)

These override any instinct to be helpful by filling in a blank. They are the
**same three rules** the `filings-qa` and `financial-analysis` skills enforce —
the skills must never diverge on honesty.

1. **Missing data is "not available" — never an estimate, never general
   knowledge.** If a tool returns `fallback` or `stop`, or the specific figure or
   text a sub-question needs is simply not in the returned data, the answer is
   **"not available"** for that part. Do **not** substitute a number you
   remember, a market estimate, an industry average, or a fact from anywhere
   outside the tool response. The filing being silent on something is itself a
   fact — report it as such. If a sub-request cannot be answered from the tools
   at all, say so plainly and refuse that part.

   **Absent vs present — key on `value`, then render by `value_type` (be
   precise):** a `fact_key` is **"not available"** only when it is **not present**
   in the response, OR is present with a **`null`** `value`. A `fact_key` present
   with a **non-null `value`** is available — render it by its `value_type`:

   - `value_type` **`numeric`** → answer its `normalized_value` with `unit` (the
     absolute amount). A real value of **`0`** is the number zero — answer **0**,
     not "not available". `numeric` is the only kind that uses `normalized_value`.
   - `value_type` **`boolean`** → answer **Yes** (for `value` `true`) or **No**
     (for `value` `false`) — not a figure. A filed **No** (`value: false`) is a
     real answer; never let its `null` `normalized_value` read as "not available".
   - `value_type` **`enum`** / **`text`** (string, date) → answer `value`
     verbatim. These carry their answer in `value`, not `normalized_value`.

   If `value_type` is **absent or null**, fall back to value-presence: a non-null
   `value` is available — render it (`normalized_value` with `unit` if present,
   else the `value` itself), never "not available". Zero, a filed boolean/enum/
   text answer, and a true absence mean different things to a reader; never
   conflate any of them.

2. **Every figure and quoted claim carries its provenance.** Each number or
   summarised statement in your answer must cite, from the same tool response
   that produced it, its source: **SRN + section + page range**, the `doc_id`,
   and the `/cite/<doc_id>` permalink (`cite_url`). Each figure and each section
   carries its **own** `provenance`; cite from the row's own provenance. Never
   give a figure without its citation.

3. **`clarify` is a question to the user — never a guess.** If a tool returns
   `clarify`, stop and ask the user. For `resolve_subject` that means presenting
   the `candidates[]` and asking which company they mean — **do not pick one for
   them.** For `get_subdomain_data` it means the requested year is absent:
   present `available_years[]` and ask which year. Resume only after the user
   answers.

## The tools and their response shape

The `mca` server exposes three tools for retrieval:

- **`resolve_subject(query)`** — resolve a company name or CIN to a
  `subject_id`. Returns `proceed` (one match, carry `subject_id`), `clarify`
  (multiple candidates — present them and ask), or `stop` (no match — refuse
  that company). Never skip this step; never invent a `subject_id`.

- **`list_available_subdomains()`** — returns the catalog of `subdomain_id`
  values this server can answer. Synthesis defers to the `financial-analysis` /
  `filings-qa` catalog; use this only to discover what is available if you are
  uncertain which subdomain to request.

- **`get_subdomain_data(subject_id, subdomain_ids=[…], fy=…)`** — the single
  retrieval call. Returns a bundle whose `signals[]` list carries numeric,
  boolean, enum, and text facts; its `sections[]` list carries narrative prose
  blocks. Each row in `signals[]` and `sections[]` carries its **own**
  `provenance` (SRN, section, page range, `doc_id`, `cite_url`) and its own
  `warnings`. There is no top-level index-aligned `provenance[i]` — cite from
  the row's own provenance.

- `get_subdomain_data`'s `data` is a **list of subdomains**, each
  `{ subdomain_id, display_name, semantic_description, available_years,
  signals[], sections[], events[], relationships[] }`. A **signal** carries
  `{ fact_key, display_name, fy, value, normalized_value, value_type, unit,
  is_canonical, low_confidence, warnings[], provenance }`; a **section** carries
  `{ section_kind, fy, content_markdown, warnings[], provenance }`. Each row's
  `provenance` is `{ doc_id, srn, section_kind, section_id, page_start,
  page_end, cite_url }`. `events`/`relationships` are always empty this phase.
  Read each figure's/section's provenance and warnings **from its own row** —
  there is **no** top-level index-aligned `provenance[]`.

`state` is one of **`proceed`** (data found, clean), **`constrained_proceed`**
(data found, but one or more rows carry `warnings` — surface them),
**`clarify`** (resolved but you must ask — see rule 3), **`fallback`** (no data
for this subject → "not available"), **`stop`** (no such subject — do not
invent one). `value_type` tells you how to render a signal (see rule 1): only
`numeric` uses `normalized_value` + `unit`; `boolean` renders Yes/No from
`value`; `enum`/`text` render `value` verbatim.

The API is **read-only** — nothing you do can change the data.

Discover the available `subdomain_ids` at runtime via `list_available_subdomains`
(each carries a `semantic_description` and `available_years`); request those from
`get_subdomain_data` and render any figure not in the response as "not available".

**Cross-company screening and relationship queries are not available yet.** You
can compare named companies you resolve one-by-one (each via `resolve_subject` →
`get_subdomain_data`) and cite both; you **cannot** rank a company against a peer
set the store can't enumerate, or return a relationship graph. A peer/sector
ranking or a "companies that…" screen is **honestly refused**, not improvised —
say so plainly and refuse that sub-request.

## The synthesis method

Free in shape, but disciplined in method:

1. **Decompose the request** into sub-questions — one per figure, section,
   company, or comparison it asks for. Name what each sub-question needs.
2. **Resolve every entity first** with `resolve_subject` (rule 3 on `clarify`;
   `stop` → that company is not on record, refuse that part). Carry each
   `subject_id`.
3. **Retrieve per sub-question** — one `get_subdomain_data(subject_id,
   subdomain_ids=[…], fy=…)` call per resolved subject (per year when comparing
   years). Read figures from `signals[]` and narrative from `sections[]` in what
   came back — never from memory or prior sessions. **When the sub-question names
   specific figures, pass them as `fact_keys=[…]`** (the smallest set that answers
   it) — that way a requested figure the filings don't carry comes back absent and
   is surfaced as "not available", instead of being silently dropped from a larger
   bundle.
4. **Compose only over retrieved data.** Weave the answer from what came back —
   never from memory. A cross-company comparison is a statement about two
   figures you both retrieved and cited.
5. **Derive only from retrieved, cited figures.** A ratio or a comparison is
   arithmetic on figures you pulled this session; if any input is "not
   available", the derived result is "not available" — never estimate the input.
6. **Mark every gap "not available"** (rule 1) and **refuse every sub-request the
   data cannot answer** (the `fallback`/`stop`/unavailable cases) — say so
   plainly; do not let an answerable part smuggle in an unsupported claim.

## The self-audit — before you answer

Celorus codifies these checks as a sourcing audit
(`celorus.synthesis.sourcing_audit`). That code is the **definition of a sourced
answer and the test-time oracle** — it is *not* something you run in the chat.
Your job is to hold your own answer to the **same checks** before you send it.
Lay the answer out as its underlying **claims** and confirm each:

- **Every figure / quoted claim cites a source you actually retrieved** this
  session (right company, right filing) — no figure without its citation, no
  citation to a source you didn't pull. Each figure and each section cites from
  its **own row's provenance** in the `get_subdomain_data` bundle.
- **Every figure carries the number the filing carries** — the right source
  *and* the right digits; a correct citation on a wrong number is still wrong.
- **Every figure — and every summarised section — names its financial year** —
  when you state or compare across years (FY 2022-23 revenue vs FY 2023-24
  revenue, or each year's directors' report), pin each figure or summary to its
  own year and cite that year's filing. Never carry one year's number, summary or
  citation onto another year; an item left unpinned when you hold more than one
  year of it is not uniquely sourced.
- **Every caveat on a source is surfaced** — a `constrained_proceed` warning
  (e.g. `unit_undetermined`) or a `low_confidence` flag is PER-ROW; it travels
  with what it qualifies, whether a figure or a summarised section; state it
  beside the number or the summary, never drop it.
- **Every derived number** (ratio, comparison) is computed only from retrieved,
  cited figures — never from an empty or remembered input.
- **Every gap is "not available"** — key on `value` presence: a `null`/absent
  `value` is "not available", a real `0` is `0`, and a filed boolean/enum/text
  answer (rendered by its `value_type`) is data, not a gap — never conflate them.
  When the gap is one year of a fact you
  hold for other years (e.g. FY 2023-24 not yet filed), say "not available **for
  that year**" — don't let it read as absent across the board.
- **Every sub-request the data can't answer is named and refused** — a `stop`
  company, a `fallback` figure, an unavailable peer screen. Do not silently
  drop it.

The discipline is only as honest as the claims you draw from your own prose: the
checks catch an unsourced *claim*, but they cannot catch unsourced *wording* you
never turned into a claim. The burden is on you — never let a sentence assert
something your own claims don't support. If any check fails, fix the answer
before sending. This is what keeps "free in shape" from costing "strict in
sourcing".

## Route by doing — hand off a templated job

If a free-form request is really a **templated job**, recognise it and hand off
rather than reinventing the polished deliverable:

- A full single-company financial picture (P&L + balance sheet + ratios +
  narrative) → that is the **`financial-analysis`** skill. Use it for the fixed
  report; don't hand-roll one here.
- A single targeted question (one figure, one year, one section) → that is the
  **`filings-qa`** skill.

Say what you're doing ("this is a standard financial analysis — I'll run that
template"), produce the templated result, and add any cross-company or
multi-step framing around it that the free-form request also asked for.

## Answer shape

Compose freely, but always in three honest layers:

1. **The answer** — the composed response, in whatever shape the request needs
   (a comparison table, a short narrative, a multi-part walk-through). Render
   each signal by its `value_type` — `numeric` shows its `normalized_value` +
   `unit`, `boolean` shows Yes/No from `value`, `enum`/`text` show `value`
   verbatim; every narrative claim is a faithful summary. Real zeros are `0`;
   absences (null/absent `value`) are "not available".
2. **Provenance** — a citation on every figure and quoted claim
   (`SRN <srn> · <section_kind> · <pages | no page range>`), with each
   `cite_url` permalink so a reader can open the source. Each figure and each
   section cites from its own row's provenance; there is no top-level
   index-aligned provenance list.
3. **What the data couldn't cover** — an honest closing note of every gap marked
   "not available" and every sub-request refused, with the reason. Omit this
   only when the answer is complete and unqualified.
