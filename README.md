# Celorus plugin — decision-ready financial intelligence on companies

Install the **Celorus** plugin to get grounded, cited financial intelligence on a
company inside Claude — a detailed financial-health report, or a straight answer
to a specific question. Every figure is read from the company's official records
and cites its source.

**The plugin reads; it never invents.** Every number is read from a source record
and cites where it came from. When a fact isn't on record, the answer says
**"not available"** — never an estimate, never model guesswork.

## What you get

- **Financial Analysis** — a detailed financial-health report for a company.
- **Cap Table** — a company's ownership and capital structure: funding rounds,
  share classes, dilution, and the latest ownership snapshot.
- **Ask about a company** — ask a specific question and get a grounded, cited
  answer.
- **Synthesis** — a free-form, cross-company answer when the question doesn't
  fit a fixed template.

Reports are rendered in the Celorus house style, and every figure links back to
its source.

## Install

How you install depends on which Claude surface you use.

### Claude Code (CLI / IDE) — full plugin

In an interactive `claude` session (a terminal or your IDE):

```text
/plugin marketplace add Celorus/celorus-plugin
/plugin install celorus@celorus
/reload-plugins
```

Then run `/mcp`, select the **celorus-data** server, and sign in (see *Authentication*).
The marketplace and the plugin are both named `celorus`, hence `celorus@celorus`.

### Cowork (web or desktop) — full plugin

1. Open **Customize → Plugins** and find the **Personal plugins** section.
2. Click **+ → Add marketplace**, choose **Add from a repository**, and enter:

   ```text
   Celorus/celorus-plugin
   ```

3. Install the **celorus** plugin from the newly added marketplace.
4. Sign in to the **celorus-data** connector when prompted (see *Authentication*).

### claude.ai (web) and Claude Desktop — chat apps

The chat apps install plugins from the built-in **Customize → Plugins → Browse
plugins** catalog. Until Celorus is listed there, connect the Celorus
**connector** directly to start using the tools right away:

1. Open **Customize → Connectors** and click **+ / Add custom connector**.
2. Enter the URL **`https://app.celorus.com/mcp`** and click **Connect**.
3. Sign in when prompted (see *Authentication*).

This connects Claude to the live Celorus data and the branded financial summary.
The full plugin — connector plus the guided report skills — is available today in
Claude Code and Cowork, and is coming to the chat catalog.

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

After authenticating, run `/mcp` (Claude Code) and confirm the **celorus-data**
server is connected. Then ask for a **Financial Analysis** report on a company, or
ask a **specific question** about one.

## Read-only by design

The Celorus API runs under a read-only login — nothing a report does can change
the underlying data.

---

> This repository is **generated** — it mirrors the published plugin from Celorus.
> Do not edit it directly; changes are overwritten by the next sync.
