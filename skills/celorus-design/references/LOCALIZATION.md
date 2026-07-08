# Localization, Numbers & RTL

Decisions on locale for a system whose primary market is Indian corporate intelligence, recorded so nobody re-litigates them silently.

## Decision: English-first, no RTL build-out now

The customer base (Indian finance/legal/consulting professionals) operates in English; no RTL-script market (Arabic/Hebrew) is on the roadmap. Building RTL support now is cost without a customer. **Recorded consequences:**

- Current v3 component CSS uses physical properties (`left/right`, `padding-left`). When an RTL market materializes, the refactor is mechanical: migrate to logical properties (`margin-inline-start`, `padding-inline`) and add `[dir="rtl"]` audits for the sidebar, table alignment, and the eyebrow rule. Budget roughly a component-library pass, not a redesign.
- New components written from now on **should prefer logical properties** where it costs nothing — it keeps the future refactor shrinking instead of growing.

## The real localization surface: numbers, currency, dates

For an audit-grade data product, formatting *is* correctness. These are binding conventions across app, collateral, and office outputs:

| Item | Convention | Example |
|---|---|---|
| Indian grouping | Lakh/crore grouping for INR contexts; Excel format `₹##,##,##0` (implemented in `make_xlsx.py`) | ₹12,45,67,890 |
| Words for scale | `lakh` / `crore` lowercase in prose; `L`/`Cr` in tight tiles | ₹4.2 Cr |
| Non-INR figures | Standard thousands grouping | $1,250,000 |
| Dates | `DD Mon YYYY` — unambiguous across US/UK readers | 07 Jul 2026 |
| Fiscal year | `FY25-26` (Indian April–March year) | FY25-26 |
| Timestamps | 24h IST with zone | 14:32 IST |
| All data values | Mono face (`--semantic-font-mono`), tabular where columns align | — |
| CIN/PAN/identifiers | Mono, never line-broken | U74999KA2020PTC134788 |

## If Hindi (or other Indic) UI ships

IBM Plex has first-party Devanagari: **IBM Plex Sans Devanagari** is the approved extension — same family, same weights, zero new brand decisions. Source Serif 4 has no Devanagari; headings in Hindi fall back to Plex Sans Devanagari SemiBold (weight carries the hierarchy where the serif can't). Mono data values remain Latin-digit IBM Plex Mono for auditability.
