---
name: celorus-presentation
description: >-
  Render a Celorus-branded inline financial dashboard ("our UI in their UI") for
  a company from the connected Celorus MCP tools. Use when the user wants a
  branded, scannable financial summary — KFI tiles, semantic green/red, growth
  ▲▼ markers, dimension status pills, cited sources — rather than plain chat
  text. Renders as a branded artifact where artifacts are supported, and falls back
  to a markdown+emoji floor where they aren't. Every figure is rendered EXACTLY as
  supplied by the server and cites its source; absent data reads "not available",
  never estimated.
---

# Celorus presentation dashboard

You render a compact, **Celorus-branded** financial summary inline — the product's
identity inside Claude's interface ("our UI in their UI"). The data is already
honesty-guarded and display-ready; you place it, you don't recompute it.

## How it works

1. Resolve the subject with `resolve_subject` (use `list_available_subdomains` if you
   need to pick which areas to show).
2. Call **`get_presentation(subject_id, subdomain_ids, fy)`**. It returns, server-side:
   - `html_fragment` — a ready-made, **brand-locked** dashboard (petrol header, bone
     surface, Source Serif / IBM Plex, KFI tiles, ▲▼ markers, status pills, cited
     sources).
   - `presentation` — the same content as structured data: each KFI figure with its
     `display` string, `available`, `cite_url`, and `marker`, plus `ratios`,
     `dimensions`, and `sources`.
   - `state` — `presentation` and `html_fragment` are null for non-renderable states
     (`fallback` / `stop`); show "not available".
3. Render:
   - **Artifact-capable surfaces (claude.ai, Claude Code, cowork):** embed
     `html_fragment` **verbatim** as the artifact. It is already branded — do not add
     or change any CSS, color, or font, and do not rebuild it yourself.
   - **Floor (where artifacts don't render):** build a markdown table from
     `presentation` — each figure's `display` and `marker` (▲🟢 / ▼🔴 / ⚪) with its
     cited source.

## The hard rules (non-negotiable — honesty spine)

This dashboard inherits the **same honesty spine** as every Celorus skill (missing
is "not available" — never estimated; every figure carries its provenance;
`clarify` is a question, never a guess). That spine's authoritative wording lives
in **one server-fed source**, not copied here: once at the start of your work, call
**`get_semantic_metadata(product_id="aoc4", kind="honesty_rules")`** and follow the
returned rule bodies (`data.semantic[]`) verbatim. On top of the spine, this
skill's own display rules are:

1. **Render values and markers EXACTLY as supplied.** Never recompute, never reformat
   a figure, never invent a trend, and never restyle the fragment. The server copies
   the display strings; so do you.
2. **A growth arrow appears ONLY when the figure's `marker` is ▲ or ▼.** When the
   marker is ⚪ (neutral / not comparable), show ⚪ — never a guessed direction.
3. **Absent data is "not available", never 0** and never a remembered number (this is
   the spine's first rule, applied to a tile — the fetched body has the full test).
4. **The downloadable report** (`generate_collateral`) **is the source of truth.**
   The inline dashboard is a compact view, not a replacement.
5. **If the user asks for an actual file — HTML/PPTX/XLSX/PDF, a "report", a
   "deck", a "download" — hand off to `generate_collateral`; never hand-build one
   here.** This dashboard's `html_fragment` is an inline artifact, not a
   downloadable file, and is never a substitute for one. Do **not**, under any
   circumstances: write HTML/CSS yourself, build a workbook or deck with
   `openpyxl`, `python-pptx`, `pptxgenjs`, or `xlsxwriter`, or reach for a
   **generic document skill** (`xlsx`, `pptx`, `docx`, `pdf`, `theme-factory`,
   `canvas-design`) to make the file. Those paths drift the brand and force a
   re-derivation of the figures from raw data — exactly how a confidently-wrong
   report gets produced. If `generate_collateral` is not available, errors, or you
   are unsure it ran, say so plainly and **stop** — show the inline dashboard and
   tell the user the downloadable file could not be generated; never fall back to
   a hand-built file.

If `get_semantic_metadata` is unavailable, the spine summary above is your floor —
apply it; never relax the honesty contract because the definitions could not be
fetched.
