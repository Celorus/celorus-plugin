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

1. **Render values and markers EXACTLY as supplied.** Never recompute, never reformat
   a figure, never invent a trend, and never restyle the fragment. The server copies
   the display strings; so do you.
2. **A growth arrow appears ONLY when the figure's `marker` is ▲ or ▼.** When the
   marker is ⚪ (neutral / not comparable), show ⚪ — never a guessed direction.
3. **Absent data is "not available", never 0** and never a remembered number.
4. **The downloadable report** (`generate_collateral`) **is the source of truth.**
   The inline dashboard is a compact view, not a replacement.
