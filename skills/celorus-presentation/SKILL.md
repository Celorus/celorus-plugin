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
of the server, so its answer is what tells you whether this session has an account
at all. Data coming back is what settles it, and nothing else does. If the answer is
not data — it asks you to sign in or to re-authorize, it refuses for want of
authorization, it errors, it comes back empty, or you cannot read it as data — stop
there and follow *When no account is connected* below, which decides it under its
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
apply: this session has no account until a `celorus-data` call comes back with
data, *When no account is connected* below governs it and decides it under its
four outcomes, and you stop there rather than carry on under the summaries.

## When no account is connected

**A listed tool is not a connected account.** The `celorus-data` tools can all be
listed, and the panel can report the server connected, while the account behind
them is not authorized: a sign-in that has aged out leaves every tool in place and
every call refused. Tool-list membership is therefore silent on exactly the case
this section exists to catch, and neither it nor the word "connected" is the test.

The test is a call. This session has an account when a `celorus-data` call comes
back with data, and not before, so the first call this skill makes is what settles
it. Its answer is binding:

- **Data comes back.** The account is connected. Carry on.
- **The call asks you to sign in or to re-authorize, or refuses for want of
  authorization.** The account is not connected, whatever the tool list or the
  panel says. Stop on that first answer: do not call again, do not try a different
  tool to see whether that one works, and do not attempt the report or the answer.
  Every tool here sits behind the same sign-in, so a second call only spends a
  second refusal to learn what the first one already said.
- **No `celorus-data` tool is there to call.** The account is not connected either,
  and there is nothing here to attempt.
- **Anything else: an error, an empty answer, or a reply you cannot read as one of
  the three above.** It settles nothing, and it is not an account; do not read it as
  one. Make one more `celorus-data` call and let its answer decide, under these
  same four outcomes. That is the last call: if the second answer is also
  unreadable, treat this session as having no account, stop there, and do not
  attempt the report or the answer.

Never fill what you could not read from memory or the web; a web answer is
`research-lead`'s job and it carries the web register's label.

Say what the record can answer for this company, never what it says. No count, no
figure, no URL, on any lane. Pick the case the check found, then close with the
lane's own sentence.

**Where the case comes from.** This holds for a company only. For a person or a family there is no
check and no cache: the check defers persons, so the case is "The record was not asked".
For a company, take the first of these that applies:

- **The desk's cache.** The cache is `.celorus/cache/check-<slug>.md` under the desk folder,
  found as `research-lead`'s "Find the desk" says: the folder named by `CELORUS_DESK`, or else
  the nearest folder up from the working directory that holds `celorus/index.md`. Here
  `<slug>` is the cache key, not a page's slug: the name as asked, lowercase, with every run
  of characters that are not letters or digits turned into one hyphen. With no desk, no cache
  is read or written, and the check is asked at most once in this session. Read the notes
  first, each only while it holds: a "Refused" until the time it may be asked again, a "Could
  not read" for an hour after it was asked; a note whose time has passed is not read. A
  "Refused" or "Could not read" entry is a note, not a case and never a miss: it is read only
  by its own rule, never as a case. Writing a case, "Not found" or "Clarify" under a key
  replaces any note under that key. Writing a note never replaces a case: the case stays under
  the key beside the note. When the cache holds "Refused" and the time it may be asked again
  has not come, ask nothing, say in one line that the record was asked too often and when it
  may be asked again, when the note says that time came from the refusal; otherwise say in one
  line that the record was asked too often and to try again later, never naming the kept time.
  The case is "The record was not asked", or "On the record, counts not available" when the
  note keeps that the company is on the Celorus record. When it holds "Could not read"
  asked less than an hour ago, ask nothing, say in one line "the check could not read the
  record, asked at HH:MM" with the time it was asked, and the case is "The record was not
  asked", or "On the record, counts not available" when the note keeps that the company is on
  the Celorus record; after the hour, ask again. When the cache holds a case other than "On
  the record, counts not available" asked less than a day ago, or that case asked less than an
  hour ago, use that case, ask nothing, and say when it was checked, in words (for example:
  checked today, at ten past two); after that hour, ask again. When it holds "Not found" asked
  less than a day ago, ask nothing, and route it as a fresh `not_found` (below). When it holds
  "Clarify" asked less than a day ago, ask nothing and ask the user to choose among its names.
- **The check.** Else, when a `celorus-check` connection is present in this session, ask its
  `check_record` tool once, through that connection, with the name and the kind `company`, and
  write the case and the time it was asked to the cache, never the counts. Every time kept in
  the cache, a case's, a "Refused" retry time, a "Could not read" time and a "Not found" time,
  is an ISO timestamp with its offset; the spoken form is for display only. One answered ask
  per company per day on this desk, however many record skills run on it: the cache is what
  holds that ration. A failed read is held on the desk for an hour and then asked again. If
  the check answers with an error in place of an answer (a read it could not make, a query it
  will not take, or the ask refused as too many requests), that is a non-answer and not a
  miss: say it as the check not answering, never as "not on the record" or as anything about
  the company. If the check refuses the ask as too many requests, write "Refused" and the time
  it may be asked again to the cache, noting whether that time came from the refusal (when the
  refusal shows no wait, the time is a day after the refusal and did not come from it). Say in
  one line when it may be asked again and what its limit is, in words, when the refusal shows
  them (its `retry_after_s`, `limit` and `message`); otherwise say in one line that the record
  was asked too often and to try again later. If it could not read the record, write "Could
  not read" and the time it was asked to the cache, and say in one line "the check could not
  read the record, asked at HH:MM" with the time it was asked. If it will not take the query,
  keep nothing, and say in one line the check's own error words as it gave them. The case is
  then "The record was not asked". But a "Refused" or "Could not read" written under a key
  that holds the case "On the record, counts not available" asked less than a day ago keeps
  that the company is on the Celorus record, so a failed ask does not lose that fact, and the
  case is then "On the record, counts not available".
- **Neither.** Else, and only then, the case is "The record was not asked".

Nothing the plugin runs itself asks the check: the ask goes through the harness's
connection, never through a script, a hook or the engine.

The cache holds a case, "Not found" or "Clarify", each with its time, and never a count. It
also holds two notes and no other error from the check: "Refused", with the time it may be
asked again and whether that time came from the refusal, and "Could not read", with the time
it was asked. Each note also carries whether it keeps that the company is on the Celorus
record. "Depth on
record": the check answered `on_record` and the record holds returns the company has filed.
"Only the identity and the board are on record": it answered `on_record` and the record holds
none filed. An `on_record` answer with null `counts` is the
case "On the record, counts not available", kept as that case, never as counts and never as
"The record was not asked", because the record was asked and answered: say the value sentence
of that case's row in the table below. Its missing counts are a failed read: the case is held
on the desk for an hour, not a day, and it is not the day's one answered ask. A `not_found`
is kept as "Not found", and a kept one is routed exactly as a fresh one. Only a `not_found`
is a miss; an error from the check never is. Every entry is written
under the key of the name the user asked, under the key of the name the check was asked with
when that differs, and under the key of the check's canonical name when it gave one. A "Not
found" entry also records the name the check was asked with, and a fresh or held "Not found"
is never said to the user as a case: say the "not on the Celorus record yet" line below only
when that recorded name is the company's registered name, as the desk's own pages or this
session's web register record it; otherwise the case is "The name does not resolve". On
`clarify`, show the user the candidate names and ask which one is meant, and write "Clarify"
with its time and those names, names only and never a count. Within the day, a skill that
finds it asks the user to choose among those names without asking the check again; when a name
is chosen and the check is asked for it, write that case under the chosen name's key and the
asked name's key. On "Depth on record", the desk's mandate picks the row: a seller vetting a
counterparty or a banker reads its own row.

| The case | The value sentence |
|---|---|
| Depth on record, no mandate known | Celorus can answer, from regulatory sources, how this company has been doing, what it owes and to whom, who owns it and who runs it. |
| The desk is a seller vetting a counterparty | Celorus can answer, from regulatory sources, whether this company can pay and any warning signs its auditor has flagged, and who owns and runs it. |
| The desk is a banker | Celorus can answer, from regulatory sources, who owns this company and who controls it, and what it owes and to whom. |
| Only the identity and the board are on record | Celorus can answer, from regulatory sources, who sits on this company's board and how many other boards each of them sits on. |
| On the record, counts not available | This company is on the Celorus record, and its counts are not available. Then the lane's close. |
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
