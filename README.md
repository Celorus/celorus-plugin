# Celorus plugin — connect Claude to live MCA-filing data

Install the **Celorus** plugin to connect Claude to the Celorus service — a live,
read-only API over Indian MCA company filings — and get grounded financial
reports and filings answers, every figure cited to its source.

**The plugin reads; it never invents.** Every number in a report is read from a
filing and cites where it came from. When a fact is not in the filings, the
report says **"not available"** — never an estimate, never model guesswork.

## What you get

- **Financial Analysis** — a structured financial-health report for a company.
- **Filings Q&A** — ask a specific question about a company's filings and get a
  grounded, cited answer.

Reports are rendered in the Celorus house style, and every figure links back to
the source filing.

## Install

### claude.ai (web) and Claude Desktop

1. Open **Customize → Plugins** (web) or the Plugins panel (Desktop).
2. Add the marketplace and install the plugin:

   ```text
   /plugin marketplace add Celorus/celorus-plugin
   /plugin install celorus
   ```

3. Connect the **mca** connector and sign in when prompted (see *Authentication*).

### Claude Code (CLI / IDE)

```text
/plugin marketplace add Celorus/celorus-plugin
/plugin install celorus
```

Then run `/mcp`, select the **mca** server, and authenticate.

## Authentication (OAuth)

The connector signs in with **OAuth 2.0** — there is **no API key**. You sign in
with your own invited Celorus account; Claude runs the browser sign-in and stores
your token. Your credentials never touch this repository.

- **Endpoint:** `https://app.celorus.com/mcp`
- **Transport:** streamable HTTP, OAuth 2.0
- The OAuth **client ID** shipped in `.mcp.json` is a *public* client identifier —
  it is not a secret.

Don't have an account yet? Contact your Celorus representative for an invite.

## Verify it connected

After authenticating, run `/mcp` (Claude Code) and confirm the **mca** server is
connected. Then ask for a **Financial Analysis** report on a company, or ask a
**specific question** about a company's filings.

## Read-only by design

The Celorus API runs under a read-only login — nothing a report does can change
the underlying data.

---

> This repository is **generated** — it mirrors the published plugin from Celorus.
> Do not edit it directly; changes are overwritten by the next sync.
