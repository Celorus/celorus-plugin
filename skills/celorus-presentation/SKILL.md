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
2. Call **`get_presentation(subject_id, subdomain_ids, fy, include_html: true)`**
   on artifact-capable surfaces — the fragment is render-path opt-in (the server
   default is data-only: without the parameter `html_fragment` comes back null and
   no brand marks ship). On a floor-only surface (artifacts don't render), OMIT
   `include_html` — you will build the markdown floor from `presentation` anyway,
   and the ~20 KB of brand SVG would be paid and discarded. It returns, server-side:
   - `html_fragment` — a ready-made, **brand-locked** dashboard (petrol header, bone
     surface, Source Serif / IBM Plex, KFI tiles, ▲▼ markers, status pills, cited
     sources).
   - `presentation` — the same content as structured data: each KFI figure with its
     `display` string, `available`, `cite_url`, and `marker`, plus `ratios`,
     `dimensions`, and `sources`.
   - `state` — `presentation` and `html_fragment` are both null for non-renderable
     states (`fallback` / `stop`); show "not available". A null `html_fragment`
     with a NON-null `presentation` just means the call was data-only (no
     `include_html: true`) — not a failure; render the floor or re-call with the
     parameter.
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

## When no account is connected

If the `celorus-data` tools are not in this session's tool list, do not attempt the
report or the answer, and never fill it from memory or the web; a web answer is
`research-lead`'s job and it carries the web register's label.

Say what the record can answer for this company, never what it says. No count, no
figure, no URL, on any lane. Pick the case the check found, then close with the
lane's own sentence. This skill runs no check of its own. Unless `research-lead` has
already checked this name in this session, the case is "The record was not asked".

| The case | The value sentence |
|---|---|
| Depth on record, no mandate known | Celorus can answer, from regulatory sources, how this company has been doing, what it owes and to whom, who owns it and who runs it. |
| The desk is a seller vetting a counterparty | Celorus can answer, from regulatory sources, whether this company can pay and any warning signs its auditor has flagged, and who owns and runs it. |
| The desk is a banker | Celorus can answer, from regulatory sources, who owns this company and who controls it, and what it owes and to whom. |
| Only the identity and the board are on record | Celorus can answer, from regulatory sources, who sits on this company's board and how many other boards each of them sits on. |
| The name does not resolve | Nothing is written. No line, no ask. The page's "not established" section carries the miss. |
| The record was not asked | The record was not asked. Then the lane's close. |

The close, after the value sentence:

- **Claude Code, Cowork, Claude Desktop:** Connect Celorus to read it. The sign-in
  step is `/mcp`, then sign in.
- **Kimi Code:** Connect Celorus to read it. The sign-in step is the celorus-data
  connection.
- **Codex, ChatGPT:** Reading it needs a Celorus account connected to this plugin.
  Nothing more: no link, no price, no verb that promotes.

When the name resolves and the company is not on the record yet, the whole line is:

- **Claude lanes:** This company is not on the Celorus record yet. Connect Celorus to ask for it, and we will tell you when it is.
- **Codex, ChatGPT:** This company is not on the Celorus record yet. It can be added on request, and we will tell you when it is. Asking for it needs a Celorus account connected to this plugin.
