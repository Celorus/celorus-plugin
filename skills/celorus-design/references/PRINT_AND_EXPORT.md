# Print & Export Rules

How Celorus artifacts leave the screen: browser print, PDF export, and press. Applies to `templates/html/report.html`, `marketing/one-pager.html`, and any collateral with an `@media print` block.

## Print stylesheet rules (already implemented in the templates)

1. **Canvas goes white in print.** Cream `#EBF1EC` is a *screen* decision; on paper, the stock itself supplies the body. Printing cream wastes ink and muddies text. Cards keep hairline borders instead of background tints where possible.
2. **Petrol survives; deep-teal areas shrink.** Accents, eyebrows, and rules stay petrol. Full-bleed charcoal sections (close/CTA) are reduced to a deep-teal-bordered white block — a page of solid deep-teal is a toner accident, not a brand moment.
3. **Chrome is hidden:** topbar, nav, progress bar, presenter notes, interactive controls (`display:none`).
4. **Page setup:** A4 default, 18–20mm margins, `@page` footer with page number + provenance line. US Letter tolerated (content column is narrower than both).
5. **No mid-component breaks:** `break-inside: avoid` on tiles, callouts, table rows, stat groups. Headings carry `break-after: avoid`.
6. **Links** print their visible text only (no URL expansion — citations already carry references in mono). **A web line is the one exception** (K9, the data honesty contract): on paper and in every PDF it prints its link, its date read and the word web as text. Its citation is a `.cite-web` line: the word web and the date read are text in the line, and the link's `href` is the page's full `https` address. On a page that loads `collateral.css`, print writes that address after the link's text. On a page that does not load it, the address is written out as text in the line. A link, the cite icon (`.cite-ic`) or the citation card (`.cite-modal`) is never the only place a web line's mark appears: print hides the icon and the card, and a printed link is only its text.

## PDF export — two sanctioned paths

| Path | When | Fidelity |
|---|---|---|
| **HTML template → browser print-to-PDF** (or headless: `playwright pdf`) | Default for reports, one-pagers | Full brand fonts, exact CSS |
| **`templates/office/make_pdf.py`** (reportlab) | Programmatic/pipeline generation at volume | Token colors exact; fonts fall back unless Plex/Source Serif TTFs are registered (see `FONTS` constant + TEMPLATES.md) |

Do not mix paths within one document family — pick per pipeline, not per document.

## A web line on each path

A web line carries its link, its date read and the word web as text in every copy, or it does not go down that path (K9).

| Path | How a web line's mark travels |
|---|---|
| **Browser print**, to paper or to PDF | The `.cite-web` line prints as text: the word web, the link's text, the date read, and the address (written by `collateral.css`, or written out in the line where the page does not load it). |
| **Headless PDF** (`playwright pdf`) | The same, since `page.pdf()` renders the print stylesheet by default. Never switch a page that carries a web line to screen media before the PDF. |
| **`make_pdf.py`** | It draws a fixed report with no citation field, so a web line does not go there. |
| **Office files** (`make_xlsx.py`, `make_docx.py`, `make_pptx.py`) | Their citation column, footnotes and slide notes carry record citations (`SRN · section · pages`) and have no web field, so a web line does not go there through the generators. One added by hand carries its address written out, its date read and the word web as text in the same cell, paragraph or slide body, never only in a hyperlink, a comment or the speaker notes. |
| **Paged documents** (`templates/documents/`, headless Chromium) | `doc.css` has no `.cite-web` rule and prints no link's address, so a web line's source line (`.doc-src`) writes its address out as text, with its date read and the word web. Sales collateral carries no source lines (`templates/documents/DOCUMENTS.md` section 11, ruled 22 Oct 2026, item 6), so a web line does not go there. |
| **Press / offset** | It prints from the PDF, so it carries what the PDF carries. |

## Office fidelity

DOCX/XLSX/PPTX carry brand font *names*; machines without the fonts substitute silently (Calibri/Georgia). The faces are vendored in `brand/fonts/` (OFL) — install them on any authoring machine that produces customer-facing office files. PDFs are the exception: `make_pdf.py` registers and **embeds** the vendored TTFs automatically, so PDF is the format to ship when type fidelity must be guaranteed — send the print-to-PDF render alongside any office file that matters. Full state in `templates/TEMPLATES.md` §Office-fonts note.

## Press / offset (approximations — verify with the printer before a run)

| Token | Hex | CMYK approx |
|---|---|---|
| Petrol `accent` | `#155A6B` | C80 M16 Y0 K58 |
| Deep teal (text on dark, dark surfaces) | `#051212` | K93 (small text) / rich black C30 M20 Y20 K100 (areas) |
| Cream `canvas` | `#EBF1EC` | C2 M0 Y2 K5 — or unprinted stock, preferred |

No Pantone match is on file yet — flagged in RISKS.md. Petrol is the only color where a press mismatch is a brand failure; get it proofed first.
