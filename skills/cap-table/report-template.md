# Cap Table report — fixed shape

Fill this exact section order. This is the format asset for the `cap-table`
skill — the skill (SKILL.md) drives the tools and fills these sections. Every
figure is either **filed** (as filed, with its own provenance) or **derived**
(computed server-side, labelled "derived, not filed" with its `formula_id` +
`model_version`) — never blend the two without the label. Any value absent
(null, or the view is a structural stub) is **"not available"**.

Provenance tag convention: `[SRN <srn> · <pages|no page range>]`, with the
`cite_url` permalink as a footnote.

---

## Cap Table — {canonical_name}

**Company:** {canonical_name} · **Subject ID:** {subject_id}

> If `get_captable` returned `stop`: do not render a report — no such company
> is on record.
> If `get_captable` returned `fallback`: "No live cap-table content is on
> record for this company yet." Then still render the section headers below
> with "not available".

Fill each section from the matching view in the `get_captable` response —
match by the view's own `view` id, not a remembered catalog. A view whose
`status` is `"not_available"` renders its `reason` in place of the section
content.

### 0. Header & scope

Identity + subject ID. Note that this report covers share-allotment events
and the latest post-allotment capital structure; year-end annual positions
are a separate, not-yet-available layer (see §6).

### 1. Ownership — who holds the company (latest annual register)

From the `ownership` view — **this section, not §2's per-round lists, answers
"who owns this company"** (rule 6). If the view's `status` is
`"not_available"`, render its `reason` here and move on; if a single block's
`status` is `"not_available"`, render that block's `message` in its place —
never an empty table presented as "no owners".

**Top holders** (`top_holders.rows` — the largest holders on the latest-FILED
annual register; `limit` is a display bound, not the whole register —
rule 10):

| Holder | Share class | Shares held | Holding % | Category | Provenance |
| --- | --- | --- | --- | --- | --- |
| {holder_name} | {share_class} | {shares_held — "not stated" if holdings_not_stated, "not available" if holdings_unread} | {shares_held_pct or "not available"} | {holder_category or "not available"} | {tag} |

**Ownership by category** (`breakdown.rows`; state which source served, from
`served_from` — rule 10). **The two sources have different row shapes — pick
the matching table, never force one into the other:**

If `served_from.basis` is `"filed"` (the shareholding pattern — rows carry
`holder_group` + `capital_kind`, and per-category holder counts are NOT
stated in the pattern, so there is no Holders column to render):

| Group | Category | Capital kind | Shares held | Holding % |
| --- | --- | --- | --- | --- |
| {holder_group} | {holder_category} | {capital_kind} | {total_shares_held or "not available"} | {total_shares_held_pct or "not available"} |

Note under the table: "Holder counts are stated in the filing only at the
promoter/public group level, not per category." Percentages are per capital
kind and group — do not sum them across rows into one total.

If `served_from.basis` is `"aggregated_from_register"`:

| Category | Holders | Shares held | Holding % |
| --- | --- | --- | --- | 
| {holder_category} | {holder_count or "not available"} | {total_shares_held or "not available"} | {total_shares_held_pct or "not available"} |

Carry every warning `message` on the view or its blocks into this section
(rules 9–11): superseded snapshots, unreadable pages/sheets, holdings not
stated/unread.

### 2. Round-wise cap table (share allotments)

Every filed allotment round, earliest first, each with its filed terms, its
labelled derived figures, and its holders.

| Round (date · SRN) | Security class | Securities allotted | Consideration | Filed round amount | Provenance |
| --- | --- | --- | --- | --- | --- |
| {date_of_allotment} · {source_srn or "no SRN"} | {security_class} | {num_securities} | {consideration_mode} | {round_amount or "not available"} | {tag} |

**Derived for this round** (label every line "derived, not filed"):

| Figure | Value | Formula | Provenance |
| --- | --- | --- | --- |
| Share price | {share_price or "not available"} | {formula_id} · {model_version} | {tag, same as the round above} |
| Pre-money valuation | {pre_money or "not available"} | … | … |
| Post-money valuation | {post_money or "not available"} | … | … |
| Dilution | {dilution_pct or "not available"} | … | … |

**Valuation (if obtained)** — render as obtained whenever valuer fields are
populated, even if the source checkbox didn't render (rule 5): valuer name,
method, per-share value, date, and whether the issue price was below the
valuer's price.

**Holders in this round** — if `roster_missing` is true, write "holder
detail is not attributable to this specific filing — see §1 Ownership for who
holds the company" instead of an empty table (rule 6; never "not available"
or "unparseable" — the holder records are on record and §1 serves them). If
the round carries a filing-grain warning, note that this list is shared
across every round in the same filing. If the round carries a
`roster_partially_read` warning, still render every holder returned, and put
this line immediately above the table (rule 9):

> **This holder list is incomplete.** Part of the shareholder register filed
> with this round could not be read — some pages of the source document are
> unreadable, so any holders listed on those pages are missing here. Read the
> register in full in the cited source filing.

If the round instead carries a `roster_sheets_unread` warning (a spreadsheet
register with sheets that were not read), still render every holder returned,
and put this line immediately above the table (rule 9 applies the same way):

> **This holder list is incomplete.** The shareholder register filed with this
> round is a workbook with sheets that could not be read, so any holders listed
> on those sheets are missing here. Read the register in full in the cited
> source filing.

A round can carry both warnings; show both lines, pages first.

Never write or imply that the company filed nothing further, that the missing
holders are "not on record", or that this is the whole register.

| Holder | Share class | Shares held | Consideration paid | Grain | Provenance |
| --- | --- | --- | --- | --- | --- |
| {holder_name} | {share_class} | {shares_held} | {amount_paid or "not available"} | {"resolved" if grain=="subject" else "name only — not an identity claim"} | {tag} |

### 3. Latest capital snapshot (share capital by class)

The most recent post-allotment capital structure, as of {as_of_srn}.

| Security class | Kind | Authorised | Issued | Subscribed | Paid-up | Provenance |
| --- | --- | --- | --- | --- | --- | --- |
| {security_class} | Equity / Preference | {authorised_shares} | {issued_shares} | {subscribed_shares} | {paidup_shares} | {tag} |

**Debt** (kept separate from equity — a debenture is never paid-up equity):

| Instrument | Convertible? | Units | Outstanding amount | Issue date | Maturity | Provenance |
| --- | --- | --- | --- | --- | --- | --- |
| {instrument_kind} | {Yes/No} | {num_units} | {outstanding_amount} | {date_of_issue or "not available"} | {maturity_year or "not available"} | {tag} |

**Derived, as of this snapshot** (label "derived, not filed"): latest share
price, latest post-money valuation — each with its `formula_id` or "not
available".

### 4. As-converted / fully-diluted view

Each class from §3, expressed on an as-converted basis. Render "not
available (terms not yet extracted)" for any class whose as-converted share
count is null — never estimate a conversion ratio.

| Security class | As-converted shares | Note |
| --- | --- | --- |
| {security_class} | {as_converted_shares or "not available"} | {"terms not yet extracted" if null} |

### 5. Preference stack

The same classes in the filed snapshot order. Render "not available
(seniority not yet extracted)" for any class whose rank is null — never
guess an order.

| Rank | Security class | Note |
| --- | --- | --- |
| {rank or "not available"} | {security_class} | {"seniority not yet extracted" if null} |

### 6. Year-end ownership (annual spine) — not yet available

Three views need the annual ownership spine, which is not yet extracted:
year-end shareholding by category, year-end per-holder dilution, and
structure movement between snapshots (already visible between consecutive
rounds in §2). Render:

> Not available — {reason from the view}. Expected when: {available_when}.

Do not sum a holder's §2 positions across filings into a running total
(rule 8) — that is exactly what this section will serve once available.

---

### 7. Sources

List each distinct `cite_url` permalink seen, with its SRN — so every figure
traces back to its source filing (never a raw `s3://` path).
