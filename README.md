# Celorus plugin

**The trusted-context layer on companies. Cited intelligence for the decisions you
make, in whatever harness you use.**

Ask for a full financial-health report, a cap table, or a straight answer to a
specific question, and get it back grounded and cited. Every figure is read from
the company's official records and carries its source. The plugin reads; it never
invents.

When a fact is not on record, the answer says **"not available"**. Never an
estimate, never model guesswork. That honesty is the whole point: you can act on
what comes back because you can trace every number to where it came from.

## What you get

- **Financial Analysis.** A detailed financial-health report for a company:
  profit and loss, balance sheet, cash flow, and the key ratios, each figure
  cited.
- **Cap Table.** A company's ownership and capital structure: funding rounds,
  share classes, dilution, and the latest ownership snapshot.
- **Ask about a company.** A specific, targeted question answered from the
  record, with the source attached. What the data cannot answer, it says so.
- **Synthesis.** A free-form, cross-company answer when the question is broader
  than one report: compare companies, chain several figures together, put
  together something the fixed reports do not cover.
- **Branded dashboard.** A scannable, Celorus-styled financial summary rendered
  inline where your tool supports it, with a plain-text fallback where it does
  not.
- **Celorus design language.** Anything the plugin helps you make, a report, a
  deck, a document, a dashboard, a spreadsheet, or a PDF, comes out in the
  Celorus house style, with provenance kept intact.

Not sure where to start? Just ask what Celorus can do, or name a company, and the
plugin points you to the right deliverable.

## The honesty contract

Every Celorus skill holds the same line, so you never have to wonder whether a
number is real:

- **Read, never invent.** Every figure comes from a source record.
- **Cited to the source.** Each claim carries where it came from, so you can
  check it.
- **"Not available", never a guess.** Absent data is shown as not available, not
  filled in from general knowledge.
- **Read-only.** The connection runs under a read-only login. Nothing a report
  does can change the underlying data.

## Install

The connector is a standard MCP endpoint over OAuth, so it is not tied to one
tool. The full plugin installs on the Claude surfaces below today.

### Claude Code (CLI or IDE)

In an interactive `claude` session, add the marketplace and install the plugin:

```text
/plugin marketplace add Celorus/celorus-plugin
/plugin install celorus@celorus
/reload-plugins
```

Then run `/mcp`, select the **celorus-data** server, and sign in (see
*Authentication*). The marketplace and the plugin are both named `celorus`, hence
`celorus@celorus`.

### Cowork (web or desktop)

1. Open **Customize, then Plugins**, and find the **Personal plugins** section.
2. Click **+**, choose **Add marketplace**, then **Add from a repository**, and
   enter:

   ```text
   Celorus/celorus-plugin
   ```

3. Install the **celorus** plugin from the marketplace you just added.
4. Sign in to the **celorus-data** connector when prompted (see *Authentication*).

### claude.ai (web) and Claude Desktop

The chat apps install plugins from the built-in **Customize, then Plugins, then
Browse plugins** catalog. Until Celorus is listed there, connect the Celorus
**connector** directly to start using the tools right away:

1. Open **Customize, then Connectors**, and click **Add custom connector**.
2. Enter the URL **`https://app.celorus.com/mcp`** and click **Connect**.
3. Sign in when prompted (see *Authentication*).

This connects to the live Celorus data and the branded financial summary. The full
plugin, the connector plus the guided report skills, is available today in Claude
Code and Cowork, and is coming to the chat catalog.

## Authentication (OAuth)

The connector signs in with **OAuth 2.0**. There is **no API key**. You sign in
with your own invited Celorus account; Claude runs the browser sign-in and stores
your token, and your credentials never touch this repository.

- **Endpoint:** `https://app.celorus.com/mcp`
- **Transport:** streamable HTTP, OAuth 2.0
- The OAuth **client ID** shipped in `.mcp.json` is a public client identifier. It
  is not a secret.

Don't have an account yet? Write to **tech@celorus.com** for an invite.

## Verify it connected

After signing in, run `/mcp` (in Claude Code) and confirm the **celorus-data**
server is connected. Then ask for a **Financial Analysis** report on a company, or
ask a **specific question** about one, and check that every figure comes back with
its source.

---

> This repository is **generated**. It mirrors the published plugin from Celorus.
> Do not edit it directly; changes are overwritten by the next sync. Questions:
> **tech@celorus.com**.
