---
name: celorus-design
description: Apply the Celorus design language when creating ANY Celorus-branded artifact — HTML pages, reports, decks, presentations, dashboards, status pages, forms, Word/DOCX documents, Excel/XLSX spreadsheets, PDFs, PPTX, banners, social images, emails, one-pagers, app UI, charts, or plugin views — internal or external. Triggers include - make/create/build/draft a Celorus report, dashboard, deck, doc, letter, spreadsheet, page, mockup, or any collateral for Celorus. Enforces token-bound styles (petrol/bone/charcoal), WCAG AA, provenance footers, honesty contract on data, and operator voice.
---

# Celorus Design Language

Celorus artifacts must be recognizably one family: **warm, institutional, audit-grade.** Bone
canvas (never pure white at page level), petrol `#155A6B` as the ONLY accent (`#3FA6BB` on dark
surfaces), charcoal `#0B0B0D` reserved for moments of weight, serif headings (Source Serif 4),
sans body (IBM Plex Sans), mono data (IBM Plex Mono), quiet borders, no gradients, no second
accent, no emoji as icons. Nothing shouts.

## Step 0 — prefer the live system

If the full design system is available — the `design-system/` folder at the Celorus workspace
root (sibling of every repo; canonical home: the `Celorus/design-system` repository) — STOP and
use it directly; it is fresher and complete. Read **`design-system/AGENTS.md`** (the binding
usage contract) and start from the template its routing table names. Templates live in
`design-system/templates/`, components in `design-system/components/`, brand in
`design-system/brand/`.

If the live system is NOT available, use the bundled snapshot in this skill and note in your
output that it was built from the skill snapshot.

## Route by what you're making

| Making | Start from / consume |
|---|---|
| Generic HTML artifact (report, doc, status page) | `templates/html/report.html` or `dashboard.html` + foundation block |
| **Command view** (ops command, control center, owner dashboard, weekly brief) | `templates/html/ops-command.html` — curated-rail anatomy; never render an index as a briefing |
| Slide deck (HTML) | `templates/html/deck.html` |
| Input/collection form | `templates/html/form.html` |
| **Financial Health report** | `templates/html/financial-health.html` — LOCKED anatomy; never improvise it |
| **Cap table** deliverable | `templates/html/cap-table.html` — PRD-true anatomy |
| **Q&A / synthesis answer** | `templates/html/synthesis-answer.html` (feedback hooks) |
| Charts, anywhere | `components/celorus-charts.js` (bundled: `assets/celorus-charts.js`) — see Charts below |
| XLSX / DOCX / PPTX | `templates/office/make_*.py` off `tokens.flat.json`; conventions below |
| PDF | HTML → print-to-PDF (default) or `make_pdf.py` (pipeline) — see Print & export |
| App UI (Next.js/Tailwind) | `tokens/dist/tailwind.preset.js` + `components/celorus-ui.css` + `components/gallery.html` |
| Plugin / embedded / chat-rendered / hosted-artifact view | Embedded surfaces rules below + `references/PLUGIN_SURFACES.md` |
| Marketing page / banner / email | `marketing/` (email is the ONE inline-hex surface — regenerate from tokens, never hand-edit) |

If the live templates are unreachable, reproduce the pattern from this skill's rules; say so in
the output.

## Building HTML artifacts (report, dashboard, deck, form, status page, one-pager)

1. Inline `assets/foundation-block.css` into a `<style>` tag (tokens, reset, type baseline,
   light + dark themes, legacy aliases). For data deliverables (figures, citations, status
   pills) also inline `assets/collateral.css`.
2. Bind every style to a CSS variable — `var(--semantic-*)` / `var(--component-*)` (primitives
   only where a template already does). **Never write a hex literal.** The variable vocabulary
   is in `references/TOKENS.md`; the most-used: `--semantic-color-bg-canvas` (page),
   `--semantic-color-bg-paper` (cards), `--semantic-color-fg-strong/default/muted`,
   `--semantic-color-border-default`, `--semantic-color-accent-default`,
   `--semantic-font-serif/sans/mono` (aliases `--canvas/--paper/--ink/--muted/--line/--brand/--serif/--sans/--mono`).
3. **Theme activation.** The foundation block ships both themes but dark only activates via a
   `data-theme="dark"` attribute; it does NOT react to `prefers-color-scheme` by itself. Every
   HTML artifact must include this bridge so the OS preference works AND an explicit host stamp
   wins:
   ```html
   <script>
   (function(){var r=document.documentElement;
     if(!r.getAttribute('data-theme')){r.setAttribute('data-theme',
       matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
   })();
   </script>
   ```
   Verify the artifact in BOTH themes before finishing.
4. **Fonts.** Standalone files may `@import` the Google Fonts set (Source Serif 4, IBM Plex
   Sans, IBM Plex Mono). CSP-sandboxed FULL-PAGE hosts (the claude.ai artifact viewer) block
   font CDNs — there, inline `assets/embedded-fonts.css` (live system:
   `tokens/dist/embedded-fonts.css`; data-URI latin+₹ subsets, ~270KB) into the first
   `<style>` so the real brand faces render. Only truly embedded Tier-2 surfaces (small
   iframes, chat widgets) skip the payload and ride the token fallback stacks
   (Georgia / system-ui / monospace) instead.
5. Page skeleton (standalone pages only; embedded surfaces differ — see below): charcoal topbar
   with the wordmark (`assets/celorus-mono-white.svg`, height 22px, width auto) + a meta tag
   line; sections open **eyebrow → h2** (uppercase 10.5px letter-spaced petrol label with a
   22px 2px petrol rule, then a serif headline — at most one phrase recolored petrol via
   `<em>`); footer carries the provenance line:
   `Generated by Celorus · <date> · sources cited inline`.
6. Wordmark on light backgrounds: `assets/celorus-primary.svg` (petrol). On charcoal:
   `celorus-mono-white.svg`. Favicon: `assets/celorus-favicon.svg`; where a host only accepts
   an emoji favicon (claude.ai artifacts), pick one emoji and keep it stable — the in-page
   favicon rule applies to standalone files only. **Never re-type the wordmark in a font**; if
   the SVGs can't be embedded, write CELORUS in the serif as a clearly-flagged draft substitute.
7. Interactive elements keep visible focus (`:focus-visible` ring is in the foundation block).
   Never signal state by color alone — pair color with a word or icon shape (status pills carry
   the word plus a currentColor dot).

## Charts

Never hand-pick chart colors. Use `assets/celorus-charts.js` (Chart.js v4 theme): it reads the
live CSS custom properties at runtime via getComputedStyle, so charts follow light/dark
automatically. Call `celorusChartDefaults(Chart)` once, take series colors from
`celorusChartPalette()`, and re-apply (or re-instantiate) after any theme toggle — Chart.js
does not watch CSS. Gridlines = `--semantic-color-border-default`, axis text =
`--semantic-color-fg-muted`. Meaning is never carried by hue alone: label the series.

## Hosted & embedded surfaces — decide the tier FIRST

Full contract in `references/PLUGIN_SURFACES.md`. Two tiers, and picking wrong kills the brand:

- **Tier 1 — full-page hosted artifact** (claude.ai artifact viewer, any hosted single-file
  page that owns the whole tab): this is a STANDALONE page. Keep the charcoal topbar, raised
  sheet, eyebrow→h2 rhythm and editorial scale, and inline `assets/embedded-fonts.css`
  (Step 4). Do NOT apply the compact rules here — a full-page artifact with stripped chrome
  reads as a pale cousin of the collateral, not as Celorus.
- **Tier 2 — truly embedded** (plugin panels, iframes, chat-rendered widgets, ≤480px cards):
  the host owns the window. **No charcoal topbar or sticky chrome** — identity is ONE wordmark
  placed once (header corner or footer); theme follows the host (the Step-3 bridge); fonts
  degrade gracefully; compact spacing (section padding 24px not 60px), single column ≤480px,
  touch targets ≥44px, body never below 13px, h2 max 22px.

The provenance line ships on BOTH tiers — no exceptions anywhere in the system. When almost
nothing is allowed (markdown-only chat), the brand is carried by mono data values, uppercase
eyebrow-style labels, the provenance line, and operator voice.

## Building office files (XLSX / DOCX / PPTX)

Read `assets/tokens.flat.json` and take EVERY color and size from it (`light.*` keys for
colors, `print.*` for pt sizes). Brand fonts with fallbacks: Source Serif 4 → Georgia/Times,
IBM Plex Sans → Calibri/Helvetica, IBM Plex Mono → Consolas/Courier. Conventions: petrol
header rows with white text, bone alternating rows, charcoal cover band with petrol accent
rule, mono for all data values, page-number + provenance footer. In the live system, generate
via `templates/office/make_xlsx.py`, `make_docx.py`, `make_pptx.py` instead of restyling by hand.

## Print & export (PDF)

Two sanctioned paths — pick per pipeline, never mix within one document family: HTML template →
browser/headless print-to-PDF (default; full fidelity), or `templates/office/make_pdf.py`
(programmatic volume). Print rules (full text in `references/PRINT_AND_EXPORT.md`): the bone
canvas goes WHITE on paper; petrol survives, full-bleed charcoal blocks shrink to
charcoal-bordered white; chrome hidden; A4 with 18–20mm margins; `break-inside: avoid` on
tiles/callouts/rows; the `@page` footer keeps page number + provenance.

## Data honesty contract (any artifact carrying figures)

Figures cite their source (for MCA data: `SRN · section · page`). Derived values are visibly
marked "computed". Missing data renders as a designed "— not available" state — never a guess
and never 0 (a real 0 is the number). Filed values render exactly as filed with a scale note
("figures as filed, INR Lakh"). Indian conventions (full table in `references/LOCALIZATION.md`):
lakh/crore grouping `₹##,##,##0` (`L`/`Cr` in tight tiles), non-INR figures use standard
thousands grouping, dates `DD Mon YYYY`, timestamps 24h IST, fiscal years in the product-live
form `FY 2023-24`, identifiers (CIN/DIN/PAN/SRN) in mono, never line-broken. When conforming
existing copy, apply voice/date sweeps to PROSE ONLY — never inside URLs, hrefs, file paths, or
identifiers (a blanket date sweep corrupts links that embed ISO dates).

## Voice

Operator register (full reference: `references/VOICE.md`): plain, specific, confident. No em
dashes, no hedges ("might", "perhaps", "we believe"), no marketing superlatives, vary sentence
length. Headlines state a verdict, not a topic.

## Snapshot provenance & regeneration

The bundled snapshot was cut from `Celorus/design-system` on **08 Jul 2026**:
`assets/foundation-block.css` + `assets/embedded-fonts.css` + `references/TOKENS.md` ← `tokens/dist/`, `assets/collateral.css`
← `templates/html/`, `assets/tokens.flat.json` ← `tokens/dist/`, logos ← `brand/logos/`,
`assets/celorus-charts.js` ← `components/`, `references/{VOICE,LOCALIZATION,PLUGIN_SURFACES,PRINT_AND_EXPORT}.md`
← `brand/` + `guides/`. To refresh: re-copy those files (they must diff IDENTICAL to the live
system), update this date, and rebuild the package:
`cd design-system/skill && zip -rX ../celorus-design.skill celorus-design`.

## Self-check before finishing

- Zero hex literals outside the pasted token block and official SVG assets
  (`grep -E '#[0-9A-Fa-f]{3,8}'` — GitHub issue refs like `#NNN` are false positives).
- Bone page, petrol-only accent, eyebrow→h2 sections, serif/sans/mono in their roles.
- BOTH themes verified (the data-theme bridge present; dark actually renders).
- Charts (if any) read tokens at runtime — no hand-picked colors.
- Provenance footer present; figures cited; "not available" designed, not guessed.
- No em dashes in artifact copy; sweeps did not touch URLs or identifiers.
- Composition, not just tokens: standalone/Tier-1 pages open charcoal topbar → eyebrow→h2
  sections; a command view keeps a curated rail (≤10 items) above the fold with detail
  collapsed below; stat values render serif at display scale, never mono-small.
- Fonts are real wherever the surface allows: Tier-1 hosted artifacts inline
  `assets/embedded-fonts.css`; PDF/office paths use the vendored `brand/fonts/` TTFs.
- Would it sit next to another Celorus artifact and read as the same company? If unsure, fix.
