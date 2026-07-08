# Print & Export Rules

How Celorus artifacts leave the screen: browser print, PDF export, and press. Applies to `templates/html/report.html`, `marketing/one-pager.html`, and any collateral with an `@media print` block.

## Print stylesheet rules (already implemented in the templates)

1. **Canvas goes white in print.** Bone `#E9E7E0` is a *screen* decision; on paper, the stock itself supplies warmth. Printing bone wastes ink and muddies text. Cards keep hairline borders instead of background tints where possible.
2. **Petrol survives; charcoal areas shrink.** Accents, eyebrows, and rules stay petrol. Full-bleed charcoal sections (close/CTA) are reduced to a charcoal-bordered white block — a page of solid charcoal is a toner accident, not a brand moment.
3. **Chrome is hidden:** topbar, nav, progress bar, presenter notes, interactive controls (`display:none`).
4. **Page setup:** A4 default, 18–20mm margins, `@page` footer with page number + provenance line. US Letter tolerated (content column is narrower than both).
5. **No mid-component breaks:** `break-inside: avoid` on tiles, callouts, table rows, stat groups. Headings carry `break-after: avoid`.
6. **Links** print their visible text only (no URL expansion — citations already carry references in mono).

## PDF export — two sanctioned paths

| Path | When | Fidelity |
|---|---|---|
| **HTML template → browser print-to-PDF** (or headless: `playwright pdf`) | Default for reports, one-pagers | Full brand fonts, exact CSS |
| **`templates/office/make_pdf.py`** (reportlab) | Programmatic/pipeline generation at volume | Token colors exact; fonts fall back unless Plex/Source Serif TTFs are registered (see `FONTS` constant + TEMPLATES.md) |

Do not mix paths within one document family — pick per pipeline, not per document.

## Office fidelity

DOCX/XLSX/PPTX carry brand font *names*; machines without the fonts substitute silently (Calibri/Georgia). The faces are vendored in `brand/fonts/` (OFL) — install them on any authoring machine that produces customer-facing office files. PDFs are the exception: `make_pdf.py` registers and **embeds** the vendored TTFs automatically, so PDF is the format to ship when type fidelity must be guaranteed — send the print-to-PDF render alongside any office file that matters. Full state in `templates/TEMPLATES.md` §Office-fonts note.

## Press / offset (approximations — verify with the printer before a run)

| Token | Hex | CMYK approx |
|---|---|---|
| Petrol `accent` | `#155A6B` | C80 M16 Y0 K58 |
| Charcoal (text) | `#0B0B0D` | K100 (small text) / rich black C30 M20 Y20 K100 (areas) |
| Bone `canvas` | `#E9E7E0` | C0 M1 Y4 K9 — or unprinted warm stock, preferred |

No Pantone match is on file yet — flagged in RISKS.md. Petrol is the only color where a press mismatch is a brand failure; get it proofed first.
