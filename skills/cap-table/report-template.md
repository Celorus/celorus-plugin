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
are a separate, not-yet-available layer (see §5).

### 1. Round-wise cap table (share allotments)

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
detail not available for this filing" instead of an empty table (rule 6). If
the round carries a filing-grain warning, note that this list is shared
across every round in the same filing.

| Holder | PAN | Share class | Shares held | Consideration paid | Grain | Provenance |
| --- | --- | --- | --- | --- | --- | --- |
| {holder_name} | {pan or "not available"} | {share_class} | {shares_held} | {amount_paid or "not available"} | {"resolved" if grain=="subject" else "name only — not an identity claim"} | {tag} |

### 2. Latest ownership snapshot (share capital by class)

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

### 3. As-converted / fully-diluted view

Each class from §2, expressed on an as-converted basis. Render "not
available (terms not yet extracted)" for any class whose as-converted share
count is null — never estimate a conversion ratio.

| Security class | As-converted shares | Note |
| --- | --- | --- |
| {security_class} | {as_converted_shares or "not available"} | {"terms not yet extracted" if null} |

### 4. Preference stack

The same classes in the filed snapshot order. Render "not available
(seniority not yet extracted)" for any class whose rank is null — never
guess an order.

| Rank | Security class | Note |
| --- | --- | --- |
| {rank or "not available"} | {security_class} | {"seniority not yet extracted" if null} |

### 5. Year-end ownership (annual spine) — not yet available

Three views need the annual ownership spine, which is not yet extracted:
year-end shareholding by category, year-end per-holder dilution, and
structure movement between snapshots (already visible between consecutive
rounds in §1). Render:

> Not available — {reason from the view}. Expected when: {available_when}.

Do not sum a holder's §1 positions across filings into a running total
(rule 8) — that is exactly what this section will serve once available.

---

### 6. Sources

List each distinct `cite_url` permalink seen, with its SRN — so every figure
traces back to its source filing (never a raw `s3://` path).
