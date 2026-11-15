# Celorus plugin

Milan, by Celorus, in the AI tool you already use. Milan finds your next clients, tells you
when to call and why, plans your day, and gets you ready for every meeting. Agents prepare;
nothing goes out without you.

For sales teams on wealth management, institutional sales, investment banking, cloud service
provider and GTM tech desks. India today, with more countries being added.

See [celorus.com](https://celorus.com/?utm_source=github&utm_medium=plugin-readme&utm_campaign=plugin-page).

## What to ask

- "Open my day": what moved overnight, and who to call first and why.
- "Research this lead": who they are and why now, each line with its source.
- "Log the call": what was said, what you owe and by when, and a note for your CRM.
- "What do I owe": every follow-up you promised, with its date.
- "Brief me for my meeting": two to three pages on the client before you walk in.
- "What can Celorus do?": when you are not sure where to start.

Every fact carries its source. Where the source is silent, Milan says "not available" and
never guesses.

<!-- entitled-accounts:begin -->
### Entitled accounts

A firm with entitled access also gets leads and, on a person's profile, the roles and holdings the record shows. Celorus switches it on one firm at a time, after the firm signs the entitlement terms. For data we hold about a person, write to grievance@celorus.com.
<!-- entitled-accounts:end -->

## Install

Paste this into Claude, Codex or your own AI tool:

```text
Install the Celorus plugin from github.com/Celorus/celorus-plugin for me, end to end. If you can run commands on this computer, do it yourself. In Claude Code, run `claude plugin marketplace add Celorus/celorus-plugin`, then `claude plugin install celorus@celorus`. In any other agent, add the MCP server https://app.celorus.com/mcp to your own settings. If you can't run commands, walk me through adding a custom connector at https://app.celorus.com/mcp in this app's settings, one step at a time. When it's done, tell me if I need to restart, then let's start with "open my day".
```

Or by hand.

### Claude Code

In an interactive `claude` session:

```text
/plugin marketplace add Celorus/celorus-plugin
/plugin install celorus@celorus
```

To start the day, say "set up my desk". Then sign in to celorus-data: run `/mcp`, select it, and follow the prompt.

### Cowork

1. Open **Customize, then Plugins**, and select **Add marketplace**.
2. Enter `Celorus/celorus-plugin` and install the **celorus** plugin from it.
3. Sign in to the celorus-data connector.

### Claude Desktop and claude.ai

1. Open **Customize, then Plugins**, then **Add, then Add marketplace**, and enter
   `Celorus/celorus-plugin`. Install the **celorus** plugin from it.
2. Connect **celorus-data** from the plugin's **Connectors** tab and sign in.

To add only the connector, use **Customize, then Connectors, then Add custom connector** with
`https://app.celorus.com/mcp`. On Team and Enterprise plans, an Owner adds it from the
organization's settings.

### Signing in

Sign in with your Celorus account, through Google or email. There is no API key.

Milan's workspace runs in Claude Code and Cowork, on your own computer. It needs Node.js 18 or
newer, and Claude offers to install it.

### Updating

In Claude Code (the CLI, an IDE, or the desktop app's Code tab), take a newer version by
selecting **Update** on the Celorus plugin in the plugin list. If **Update** is greyed out, or
the plugin's menu has no **Update** at all, Claude Code's copy of the marketplace is behind.
Bring that copy up to date first, then select **Update**:

- On Windows, in PowerShell: `git -C "$env:USERPROFILE\.claude\plugins\marketplaces\celorus" pull`
- On a Mac: `git -C ~/.claude/plugins/marketplaces/celorus pull`

Removing the plugin and installing it again does not move the version: it installs the same
older copy.

## Your data

Your workspace is plain text on your own computer. Milan never sends a mail, changes your CRM
or books a meeting without your say-so.

The plugin carries no tracker. With your Celorus account connected, the workday skills on a
desk on your own computer send one line as each run ends: which skill ran, how it ended,
the desk's id and the plugin version, never what the run read or wrote. Set
`pulse: off` in your desk's `celorus/motion-spec.md` to stop it. A desk we host for your
firm does not send it yet.

What reaches Celorus and your AI tool is at [celorus.com/trust](https://celorus.com/trust)
and [celorus.com/privacy](https://celorus.com/privacy).

## Help

tech@celorus.com. For data we hold about a person: grievance@celorus.com.

---

> This repository is **generated**. It mirrors the published plugin from Celorus, so a pull
> request here cannot be merged; write to **tech@celorus.com** instead and the fix lands in
> the next sync.
