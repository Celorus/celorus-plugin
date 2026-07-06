# Financial Analysis report — fixed shape

Fill this exact section order. Render each signal by its `value_type` (SKILL.md
rule 1): a `numeric` figure is `normalized_value` + `unit`; a `boolean` is Yes/No
from `value`; an `enum`/`text` answer is `value` verbatim — each with a provenance
tag. Any fact absent (`value` null or not present) is **"not available"** (rule 1).
This is the format asset for the `financial-analysis` skill — the skill (SKILL.md)
drives the tools and fills these sections.

Provenance tag convention (rule 2): `[SRN <srn> · <section_kind> · <pages|no page range>]`,
with the `cite_url` permalink as a footnote.

---

## Financial Analysis — {canonical_name}

**Company:** {canonical_name} · **Subject ID:** {subject_id}
**Source record:** {form_code} for FY {fy} · **SRN:** {srn} · **Format:** {format}
**Document:** {cite_url}

> If `list_available_subdomains` returned `fallback`: "No data is on record
> for this company — the financial sections below are not available." Then still
> render the section headers with "not available".

> If `get_subdomain_data` returned `constrained_proceed`: add a line here — "⚠
> Data caveat: rows below carry warnings: {warnings}. The affected figures are
> shown with this caveat." — and repeat the caveat beside the affected row.

Fill each block from the matching section in the `get_subdomain_data` response —
match by the section's own `display_name` / `section_kind`, not a remembered
catalog. Render "not available" only for structurally-expected headline lines
(revenue / PAT / total assets); silently omit empty optional layers.

### 0. Header & scope

Identity, FY, form/format, SRN, `cite_url`; note standalone/consolidated scope.
*(from `list_available_subdomains.filings`)*

### 1. Financial snapshot

Headline KPI lines — revenue, PBT, PAT, total assets, net worth — each with its
provenance tag. *(from the `signals` stream)*

These headline figures are sourced from **signals**. Any headline not present as
a signal is "not available" in this snapshot (it may still appear in the full
statement tables in §2–4). *(Multi-period comparison is deferred — the report
shows the selected FY.)*

| Line | Amount | Provenance |
| --- | --- | --- |
| Revenue from operations | {value or "not available"} | {tag} |
| Profit before tax (PBT) | … | … |
| Profit after tax (PAT) | … | … |
| Total assets | … | … |
| Net worth | … | … |

### 2. Statement of profit & loss (FY {fy})

Full per-row table from the `content_markdown` of the profit-and-loss section,
current + prior where present; the mapped signals are the citable anchors.

| Line | Current | Prior | Provenance |
| --- | --- | --- | --- |
| … (every row of the P&L statement face) | … | … | {tag} |

### 3. Balance sheet (FY {fy})

Grouped (equity & liabilities, assets), current + prior, from the
`content_markdown` of the balance-sheet section; mapped signals are the citable
anchors.

| Line | Current | Prior | Provenance |
| --- | --- | --- | --- |
| … (every row of the balance-sheet face) | … | … | {tag} |

### 4. Cash flow (FY {fy})

Operating / investing / financing + net, from the `content_markdown` of the
cash-flow section, with provenance. Render **"not available"** only when the
filing carries no cash-flow section.

| Activity | Amount | Provenance |
| --- | --- | --- |
| Net cash from operating activities | {value or "not available"} | {tag} |
| Net cash from investing activities | … | … |
| Net cash from financing activities | … | … |
| Net increase / (decrease) in cash | … | … |

### 5. Key ratios (FY {fy})

Ratios arrive **server-computed** alongside the figures (in the inline summary and
the downloadable report). Render the supplied ratio value, or "not available" when
an input is absent — never compute or estimate one yourself. Show each ratio's
standard calculation for the reader's transparency, with the input figures' own
provenance.

| Ratio | Calculation | Result |
| --- | --- | --- |
| PAT margin | PAT ÷ Revenue from operations | {result or "not available"} |
| PBT margin | PBT ÷ Revenue from operations | … |
| Return on assets | PAT ÷ Total assets | … |
| Total borrowings | Long-term + short-term borrowings | … |
| Net cash vs borrowings | Cash & equivalents − total borrowings | … |
| Current ratio | Current assets ÷ current liabilities | {result, or "not available"} |
| Debt-to-equity | Total borrowings ÷ total equity | {result, or "not available"} |

### 6. Financial indebtedness

Borrowings split (long-term / short-term, secured / unsecured) + net debt /
(net cash), from the borrowings note.

| Line | Amount | Provenance |
| --- | --- | --- |
| Long-term borrowings | {value or "not available"} | {tag} |
| Short-term borrowings | … | … |
| Total borrowings | … | … |
| Net debt / (net cash) | … | … |

### 7. Notes & group highlights

Summarise faithfully from `content_markdown`, each claim with its own
provenance:

- **Provisions & contingent liabilities** ({tag}): {summary, or "not available"}
- **Related-party transactions** ({tag}): {summary, or "not available"}
- **Group structure** — subsidiaries / associates / JVs, holding / parent
  ({tag}): {summary, or "not available"}
- **Significant accounting policies** ({tag}): {summary, or "not available"}

**Notable this year** and **connections** are supplementary layers (SKILL.md
*Weaving in events and relationships*) — one short line each, only when the
bundle carries them, each with its own provenance tag. Omit either line
entirely when its layer is empty; never render "not available" here.

- **Notable this year** ({tag}): {one-line summary of a notable event — e.g. a
  new charge, an officer change — only if present}
- **Connections** ({tag}): {one-line summary of a holding or directorship —
  only if present}

### 8. Auditor's report & governance

The section that lives only in the attachment. Opinion type, going concern,
emphasis-of-matter / key audit matters, and CARO / secretarial / CAG findings
where present. Summarise faithfully with provenance.

- **Auditor's opinion** ({tag}): {opinion type + basis, or "not available"}
- **Going concern / emphasis of matter / KAM** ({tag}): {summary, or "not available"}
- **CARO / secretarial / CAG** ({tag}): {summary, or "not available"}

**Governance & audit flags** — the filed Yes/No answers (signals; `value_type`
`boolean` → render Yes/No from `value`, "not available" if the flag is absent —
never blank). Match each flag by its `display_name` and render with its provenance
tag.

| Flag | Yes / No | Provenance |
| --- | --- | --- |
| CSR applicable (Sec 135) | {Yes/No or "not available"} | {tag} |
| AGM held within due date | … | … |
| Cost records maintained (Sec 148) | … | … |
| Secretarial audit applicable (Sec 204) | … | … |
| Auditor qualification | … | … |
| Going-concern / material uncertainty | … | … |
| Default in loan repayment — CARO | … | … |
| Fraud reported by auditor | … | … |
| Has subsidiary company | … | … |

### 9. Results walk-through

YoY movements + balance-sheet structure — **arithmetic and filing facts only**,
no inferred intent. Each statement traces to a figure or section already cited
above.

---

### 10. Sources

List each distinct `cite_url` permalink seen, with its SRN — so every figure
traces back to its source filing (never a raw `s3://` path).
