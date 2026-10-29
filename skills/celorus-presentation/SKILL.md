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

**First, fetch the honesty spine.** Once at the start of your work, call
**`get_semantic_metadata(product_id="aoc4", kind="honesty_rules")`** and follow the
returned rule bodies (`data.semantic[]`) verbatim; *The hard rules* below says what
they cover and why nothing summarised there overrides them.

**That first call is also the sign-in test.** It is the first thing this skill asks
of the server, so its answer is what tells you whether this session is signed in to the record at all. Data coming back is what settles it, and nothing else does. If the answer is
not data — it asks you to sign in or to re-authorize, it refuses for want of
authorization, it errors, it comes back empty, or you cannot read it as data — stop
there and follow *When this session is not signed in to the record* below, which decides it under its
four outcomes: the tools being listed does not mean the account behind them is
authorized, and every tool here sits behind the same sign-in, so calling a second
one only spends a second refusal.

Then, with the spine in hand:

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
in **one server-fed source**, not copied here: *How it works* opens by fetching it,
and the returned rule bodies (`data.semantic[]`) are binding exactly as they stand.
A line from the web may stand beside the answer only on its own line, with its
link, its date and the mark `web` (rule 1 of the honesty rules); it never takes
the place of "not available".

On top of the spine, this skill's own display rules are:

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
The floor is for a call that came back with data and no definitions in it. It is
not for an answer that was not data. If the call did not come back with data — it
asked you to sign in or to re-authorize, it refused for want of authorization, it
errored, it came back empty, or you cannot read it as data — the floor does not
apply: this session is not signed in to the record until a `celorus-data` call comes back with
data, *When this session is not signed in to the record* below governs it and decides it under its
four outcomes, and you stop there rather than carry on under the summaries.

## When this session is not signed in to the record

**A listed tool is not a sign-in.** The `celorus-data` tools can all be
listed, and the panel can report the server connected, while the account behind
them is not authorized: a sign-in that has aged out leaves every tool in place and
every call refused. Tool-list membership is therefore silent on exactly the case
this section exists to catch, and neither it nor the word "connected" is the test. Signing in to the desk with `celorus-link`'s `sign_in` is not the test either: it does not sign this session in to the record.

The test is a call. This session is signed in to the record when a `celorus-data` call comes back with data, and not before, so the first call this skill makes is what settles
it. Its answer is binding:

- **Data comes back.** The record is signed in. Carry on.
- **The call asks you to sign in or to re-authorize, or refuses for want of
  authorization.** The record is not signed in, whatever the tool list or the
  panel says. Stop on that first answer: do not call again, do not try a different
  tool to see whether that one works, and do not attempt the report or the answer.
  Every tool here sits behind the same sign-in, so a second call only spends a
  second refusal to learn what the first one already said.
- **No `celorus-data` tool is there to call.** The record is not signed in either,
  and there is nothing here to attempt.
- **Anything else: an error, an empty answer, or a reply you cannot read as one of
  the three above.** It settles nothing, and it is not a sign-in; do not read it as one. Make one more `celorus-data` call and let its answer decide, under these
  same four outcomes. That is the last call: if the second answer is also
  unreadable, treat this session as not signed in to the record, stop there, and do not
  attempt the report or the answer.

Never fill what you could not read from memory or the web; a web answer is
`research-lead`'s job and it carries the web register's label.

Never say what the record holds. No count, no figure, no URL, on any lane. For a company, a
person or a family, say "The record was not asked by this name.", then close with the lane's
own sentence:

- **Claude Code, Cowork, Claude Desktop:** Connect Celorus to read it. The sign-in
  step is `/mcp`, then sign in.
- **Kimi Code:** Connect Celorus to read it. The sign-in step is the celorus-data
  connection.
- **Codex, ChatGPT:** Reading it needs a Celorus account connected to this plugin.
  Nothing more: no link, no price, no verb that promotes.
