# Celorus plugin

**Sales intelligence on Indian companies and the people behind them: the sales workday,
and every record figure cited to its source.**

Two doors. **The day**: open it, order today's calls with the reason for each, research a
lead in one pass, review the call, queue the follow-up. The desk's context stays in a
folder on your own side, and the workday skills run with no account at all. **The
record**: a financial-health report, a cap table, the people behind a company, or a
straight answer to a specific question, every figure read from the official record and
carrying its source. The plugin reads; it never invents.

When a fact is not on record, the answer says **"not available"**. When the web could not
establish something, the page says **"not established"**. Never an estimate, never model
guesswork. That honesty is the whole point: you can act on what comes back because you
can trace every line to where it came from.

Built for the people who carry the deal: the rooms where the margin of error is near zero
and the year gets decided.

## The day (no account needed)

- **Set up my desk.** Five questions, and a `celorus/` folder appears where you work: your
  queues, your pages, your call reviews, your follow-ups, your notes. It is yours, and it
  stays yours.
- **Open my day.** What moved overnight, what is due today, what is on the clock.
- **Who do I call first.** Today's calls in order, each with the reason in words and its
  clock: money in motion, a reason to call, handle with care.
- **Research this lead.** One pass over the web, labelled as web findings with the source
  and the date, and a "Not established" line for whatever it could not settle.
- **Log the call.** Who was there, what they said, what we said, what we owe by when, and
  a record to paste into your CRM.
- **What do I owe.** The follow-up queue tomorrow's open reads first.

On Claude Code the desk announces itself when a session starts. Everywhere else, say
"open my day".

## The record (account)

- **Financial Analysis.** A detailed financial-health report: profit and loss, balance
  sheet, cash flow, and the key ratios, each figure cited.
- **Cap Table.** Ownership and capital structure: funding rounds, share classes, dilution,
  and the latest ownership snapshot.
- **Ask about a company.** A specific, targeted question answered from the record, with
  the source attached.
- **The people behind the company.** Directors and leadership as the record has them.
- **Synthesis.** A free-form, cross-company answer when the question is broader than one
  report.
- **Branded dashboard.** A scannable, Celorus-styled financial summary rendered inline
  where your tool supports it, with a plain-text fallback where it does not.
- **Celorus design language.** Anything the plugin helps you make comes out in the Celorus
  house style, with provenance kept intact.

Not sure where to start? Ask what Celorus can do.

## The honesty contract

- **Read, never invent.** Every record figure comes from a source record; every web line
  says it is from the web, unverified, with its source and date.
- **Cited to the source.** Each record claim carries where it came from, so you can check it.
- **"Not available", never a guess.** Absent data is shown as not available, not filled in
  from general knowledge.
- **Read-only.** The connection runs under a read-only login. Nothing a report does can
  change the underlying data.
- **Yours stays yours.** The desk folder never leaves your side; the plugin never sends
  mail, never writes to your CRM, and carries no tracker.
- **One question before you sign in.** When the research skill asks whether a name is on
  the record, that check is free and anonymous, and it logs the question asked, the
  record's answer and the time, nothing about you.

## What the desk tools refuse, and what they leave to you

- **They run as you.** The desk tools run with your own file rights, on the desk folder you
  name. When a tool writes a page, it stops before its first change if a page it must touch is
  a link, not a file, or cannot be read. When a tool writes a page, it writes a real file inside
  your desk, never through a link.
- **What they leave to you.** The tools do not guard against another program on
  your machine changing the desk while a call runs. That is the same trust you give any
  program that runs as you.

## Install

The connector is a standard MCP endpoint over OAuth, so it is not tied to one tool. The
full plugin installs on the Claude surfaces below today.

### Claude Code (CLI or IDE)

In an interactive `claude` session, add the marketplace and install the plugin:

```text
/plugin marketplace add Celorus/celorus-plugin
/plugin install celorus@celorus
/reload-plugins
```

The day works from here with no sign-in: say "set up my desk". For the record, run
`/mcp`, select the **celorus-data** server, and sign in (see *Authentication*). The
marketplace and the plugin are both named `celorus`, hence `celorus@celorus`.

### Cowork (web or desktop)

1. Open **Customize, then Plugins**, and find the **Personal plugins** section.
2. Click **+**, choose **Add marketplace**, then **Add from a repository**, and enter:

   ```text
   Celorus/celorus-plugin
   ```

3. Install the **celorus** plugin from the marketplace you just added.
4. Sign in to the **celorus-data** connector when you want the record (see
   *Authentication*).

### claude.ai (web) and Claude Desktop

The chat apps install plugins from the built-in **Customize, then Plugins, then Browse
plugins** catalog. Until Celorus is listed there, connect the Celorus **connector**
directly to use the record:

1. Open **Customize, then Connectors**, and click **Add custom connector**.
2. Enter the URL **`https://app.celorus.com/mcp`** and click **Connect**.
3. Sign in when prompted (see *Authentication*).

## Authentication (OAuth)

The connector signs in with **OAuth 2.0**. There is **no API key**. You sign in with your
own Celorus account; Claude runs the browser sign-in and stores your token, and your
credentials never touch this repository.

- **Endpoint:** `https://app.celorus.com/mcp`
- **Transport:** streamable HTTP, OAuth 2.0
- **Nothing to paste.** If a client asks for an OAuth **client ID**, leave it blank;
  Celorus supports dynamic client registration, so your client registers itself.

Don't have an account yet? Write to **tech@celorus.com**.

## Verify it connected

After signing in, run `/mcp` (in Claude Code) and confirm the **celorus-data** server is
connected. Then ask for a **Financial Analysis** report on a company, or ask a
**specific question** about one, and check that every figure comes back with its source.

---

> This repository is **generated**. It mirrors the published plugin from Celorus. Do not
> edit it directly; changes are overwritten by the next sync. Questions:
> **tech@celorus.com**.
