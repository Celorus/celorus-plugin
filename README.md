# Celorus plugin

Celorus makes Milan, the agentic workspace for GTM teams. This plugin puts Milan inside the
AI you already use.

Win the room. Agents do the rest. Agents research, prepare, keep the CRM current and follow
up, so your time goes to the people you sell to. Milan opens your day and keeps what you owe
in front of you.

Every fact carries its source. Where the record is silent, the answer says "not available".
Where the web could not settle something, the page says "not established". Never an
estimate.

Built for SDRs, enterprise AEs, account managers, sales leaders and sales ops, on wealth
management, institutional sales, investment banking, cloud service provider and GTM tech
desks. The record covers India today, and more countries are being added.

Not sure where to start? Ask what Celorus can do.

## The agents, by job

| What | Job | What lands on your board |
|---|---|---|
| Milan, your workspace | Opens your day and keeps what you owe in front of you | One board: who to call first, why today, what you owe and by when |
| More like your best clients | Finds more like the clients you already sell to, people or companies | A list, each name with the reason it is on it |
| Word before the news | Tells you when a new name's moment arrives: a company going public, a fresh raise, a new director | An alert, with the source behind it |
| When a client is ready for more | Tells you what changed in an account you already hold that opens the next sale | The change, with its source and the opening line |
| Their coordinates, and the way in | Pinpoints who to reach, then finds the best way to them, starting with someone on your own desk | The path: who to ask, and what to say |

Nothing goes out without you. Agents prepare; you decide.

## Where each part runs

| | Claude Code (terminal, IDE, desktop Code tab) | Cowork (desktop app) | claude.ai chat, Claude Desktop, mobile |
|---|---|---|---|
| Milan, your workspace (the desk) | Yes. Needs Node.js 18 or newer on the machine; Claude offers to install it when it is missing. | Yes, when the task runs on your computer | Yes, on the hosted desk |
| The record | Yes | Yes | Yes |

## Milan, your workspace

Milan opens your day and keeps what you owe in front of you.

In Claude Code and Cowork, your **desk** is a folder named `celorus/` inside the folder you
work from: your call queues, a page for each person, family and firm you talk to, your call
notes, your follow-ups, your own notes. It is plain text, it is yours, and it stays on your
machine. In chat, your desk is the hosted desk: the same pages, made on the Celorus desk
server and kept in storage you or your firm connect for it, such as your own Google Drive. A **seat** is
one person's place on a desk; a **family** is the household a wealth desk sells to; the
**operator** is whoever sets a whole firm's desk up.

- **Set up my desk.** Five questions, and the desk appears. In Claude Code and Cowork,
  setup writes the `celorus/`
  folder, a few lines in your folder's `.gitignore`, and a one-line note of which seat you
  hold under `~/.celorus` on this machine. Later, the desk tools also write two hidden
  folders beside `celorus/`: `.obsidian/`, so the pages open as a vault, and `.celorus/`,
  where accepted calendar holds are kept. Nothing else, nowhere else. For a whole firm, the
  operator sets the desk up from the firm's private bundle; a single seat takes five minutes
  on its own.
- **Open my day.** What moved overnight, what is due today, and how soon each thing matters.
  On Claude Code the desk announces itself when a new session starts in a folder inside it
  (not when an old one is resumed). Everywhere else, say "open my day".
- **Who do I call first.** Today's calls in order, each with the reason in words: money in
  motion, a reason to call, handle with care.
- **Research this lead.** One pass over the web, every line labelled as a web finding with
  its source and date, and a "Not established" line for whatever it could not settle.
- **Log the call.** Who was there, what they said, what we said, what we owe by when, and a
  record to paste into your CRM.
- **What do I owe.** Every follow-up you promised, with its date. Tomorrow's "open my day"
  starts here. Where you have a calendar connector, a hold is proposed and created only on
  your say-so.
- **Ask the desk.** A question across the desk's own pages, answered from them.
- **Reach out.** A reach-out card, a call brief or a mail brief for one family, and a first
  mail draft, saved as a draft in your own mailbox through your mail connector, never sent.
- **Room brief.** Two to three pages from the desk before a meeting with one family.
- **Check my desk.** What needs attention on the desk, the generated views rebuilt, "who can
  introduce me to" answered from the desk's own pages, and two pages merged when they are one.
- **Team view and console.** For a head of lead generation: the team, the rollup, a seat's
  work list, a lead handed to a seat. The console can create or merge a CRM record, through
  your own CRM connector, only when you say so.
- **Overnight.** The day's conversations grow the family pages and every seat's morning brief.
- **Remove the desk.** What to delete, in order, and what stays because it is the firm's.
  The skill removes nothing itself.

## The record

- **Financial Analysis.** A detailed financial-health report: profit and loss, balance
  sheet, cash flow, and the key ratios, each figure cited.
- **Cap Table.** Ownership and capital structure: funding rounds, share classes, dilution,
  and the latest ownership snapshot.
- **Ask about a company.** A specific, targeted question answered from the record, with
  the source attached.
- **The people behind the company.** Directors and leadership as the record has them.
- **Compare across companies.** A free-form answer when the question is broader than one
  report.
- **Branded dashboard.** A scannable, Celorus-styled financial summary rendered inline
  where your tool supports it, with a plain-text fallback where it does not.
- **House style.** Reports, decks and documents the plugin helps you make come out in the
  Celorus style, with every figure's source kept.

<!-- entitled-accounts:begin -->
### Entitled accounts

For asset and wealth management firms, and any desk whose work turns on people as well as
companies, an entitled account adds:

- **Leads.** Find more of whom you sell to. Celorus reads public listings about people, such
  as committee and trust seats, business lists, alumni and industry bodies and professional
  registers, and gives each lead its signal and date. Every lead carries the source it came
  from.
- **Roles and holdings.** On a person's profile: the director and key managerial roles they
  hold, and the shares they hold in those companies, as the record states them. Each line
  has its company and source, and its date where the record gives one. Old roles and
  holdings are marked stale.

A figure that is not on the record reads "not available". We never estimate one.

Entitled access is off by default. Celorus switches it on one account at a time, after the
desk signs the entitlement terms.

What we hold about people, and how anyone can ask, correct, object or be removed: write to
grievance@celorus.com.
<!-- entitled-accounts:end -->

## The honesty contract

- **Read, never invent.** Every record figure comes from a source record; every web line
  says it is from the web, unverified, with its source and date.
- **Cited to the source.** Each record claim carries where it came from, so you can check it.
- **"Not available", never a guess.** Absent data is shown as not available, not filled in
  from general knowledge.
- **Read-only.** The connection runs under a read-only login. Nothing a report does can
  change the underlying data.
- **The desk stays on your side.** In Claude Code and Cowork, the desk tools write only
  inside your desk folder and
  the places named above under *Set up my desk*. They never send mail: a mail draft is saved
  in your own mailbox for you to send. They write to your CRM only through your own CRM
  connector, from the console, when you ask. If your desk sits in a git repository, the
  desk tools commit their own changes to it as they go, under your git identity, and they
  pull from or push to its remote only when you ask for that in words. The desk engine
  cannot reach the network at all; it blocks its own network access when it starts. A
  change a desk tool makes is made on the Celorus desk server, through the plugin's link.
- **What reaches Celorus.** In Claude Code and Cowork, from the desk, only what a desk
  tool's change sends: the link sends the Celorus desk server the desk pages that change
  needs and the change's own details, such as a brief's notes, over your signed-in
  connection, and writes back the pages it answers, keeping no copy of them. Reading the
  desk sends nothing, and
  neither does a page written by hand. In chat, the Celorus desk server reads and writes the
  hosted desk's pages in the storage you or your firm connected. On Google Drive, that permission covers
  only the files the desk server makes, and you can remove it in your Google account. The
  record tools send the question you ask over your signed-in connection. The plugin carries no tracker and reports no usage.
- **What reaches Claude.** Whatever a skill reads to answer you goes to Claude as any
  conversation does: your desk pages, and your mail, calendar and CRM once you connect
  them. The plugin adds no processor of its own.

## The mail and calendar guard

In Claude Code and Cowork, when a desk is installed, the plugin checks every call Claude
makes to a Gmail or Google Calendar connector against the desk before it runs. In chat
there is no such guard: it is a program on your machine. A mail search must name at least one
person's or family's address from the desk's pages, a draft may go only to addresses on
those pages, no call may name an address from outside them, and a calendar hold goes only
on your own calendar at a time you stated. A call outside that shape is refused with one
line saying why, and nothing is called. The guard runs on your machine, reads the desk's
pages at that moment only, and keeps nothing. In a folder with nothing named `celorus`
above it, the guard stands aside and says so. Any file or folder named exactly `celorus`
above your working folder marks a desk, as does a `Celorus/` or `CELORUS/` folder holding
an `index.md`, and a desk the tools cannot read makes the guard refuse rather than stand
aside, so keep that name for desks alone.

## What the desk tools refuse, and what they leave to you

This is about the desk tools on your own computer, in Claude Code and Cowork.

- **They run as you.** The desk tools run with your own file rights, on the desk folder you
  name. When a tool writes a page, it stops before its first change if a page it must touch is
  a link, not a file, or cannot be read. It writes a real file inside your desk, never through
  a link.
- **What they leave to you.** The tools do not guard against another program on your machine
  changing the desk while a call runs. That is the same trust you give any program that runs
  as you.

## Install

The quickest way: paste this into Claude, Codex or your own agent.

```text
Install the Celorus plugin from github.com/Celorus/celorus-plugin for me, end to end. If you can run commands on this computer, do it yourself. In Claude Code, run `claude plugin marketplace add Celorus/celorus-plugin`, then `claude plugin install celorus@celorus`. In any other agent, add the MCP server https://app.celorus.com/mcp to your own settings. If you can't run commands, walk me through adding a custom connector at https://app.celorus.com/mcp in this app's settings, one step at a time. When it's done, tell me if I need to restart, then let's start with "open my day".
```

Where your assistant can run commands, it installs Celorus itself. Where it can't, it walks
you through one settings step. To do it by hand, follow the steps below.

The connector is a standard MCP endpoint over OAuth, so it is not tied to one tool. The
marketplace and the plugin are both named `celorus`, hence `celorus@celorus`.

In Claude Code and Cowork, the plugin needs Node.js 18 or newer (the LTS from nodejs.org): it starts its two local
servers with the `node` command. Without Node.js the app shows only a warning triangle and
"Reconnect" beside them. When Node.js is missing, Claude says so at the start of a session and
offers to install it for you; it installs it only when you say yes. On a company computer that
does not allow installs, it gives you one sentence to send to your IT team. To do it by hand
instead, install the LTS from nodejs.org. Either way, after installing Node.js, quit and reopen
the app: one that was already running does not see the new install, on Windows especially.

### Claude Code (CLI, IDE, or the desktop app's Code tab)

In an interactive `claude` session, add the marketplace and install the plugin:

```text
/plugin marketplace add Celorus/celorus-plugin
/plugin install celorus@celorus
```

The install panel reloads the plugin itself; run `/reload-plugins` only if it says to. The
desk needs Node.js 18 or newer on the machine, which Claude offers to install when it is missing; the record does not. To start the day, say
"set up my desk". For the record, run `/mcp`, select the **celorus-data** server, and sign
in (see *Authentication*).

### Cowork (desktop app)

1. Open **Customize, then Plugins**, and select **Add marketplace**.
2. Enter `Celorus/celorus-plugin` and install the **celorus** plugin from it.
3. Sign in to the **celorus-data** connector (see *Authentication*). The desk runs when the task runs on your computer.

### claude.ai chat and Claude Desktop

1. Open **Customize, then Plugins**, then **Add, then Add marketplace**, and enter
   `Celorus/celorus-plugin`. Install the **celorus** plugin from it. You get the skills
   and the connector; in chat, your desk is the hosted desk.
2. Connect **celorus-data** from the plugin's **Connectors** tab and sign in (see
   *Authentication*).

If your plan does not let you add a marketplace, or you only want the record, add the
connector alone: **Customize, then Connectors, then Add custom connector**, with the URL
**`https://app.celorus.com/mcp`**. On Team and Enterprise plans an Owner adds it from the
organization's settings.

## Authentication (OAuth)

The connector signs in with **OAuth 2.0**. There is **no API key**. You sign in with your
own Celorus account; Claude runs the browser sign-in and stores your token, and your
credentials never touch this repository.

- **Endpoint:** `https://app.celorus.com/mcp`
- **Transport:** streamable HTTP, OAuth 2.0
- **Nothing to paste.** If a client asks for an OAuth **client ID**, leave it blank, or
  choose to register automatically; Celorus supports dynamic client registration, so your
  client registers itself.

Don't have an account yet? Write to **tech@celorus.com**.

## Verify it connected

After signing in, run `/mcp` (in Claude Code) and confirm the **celorus-data** server is
connected. Then ask for a **Financial Analysis** report on a company, or ask a
**specific question** about one, and check that every figure comes back with its source: a
labelled source naming the document, the section and the page.

## When something does not work

- **"The desk tools are not running on this machine."** The local desk program did not
  start. On Claude Code, check that Node.js 18 or newer is installed (Claude offers to install it
  when it is missing; or install the LTS from nodejs.org yourself) and run `/mcp` to see
  whether **celorus-desk** is listed. In chat there is no local desk program; your desk there is the hosted desk.
- **Claude says there is no desk here.** In chat, connect the hosted desk's storage first.
  In Claude Code and Cowork, your working folder is not inside a desk. Open
  Claude from the folder that holds `celorus/`, or say "set up my desk".
- **"Refused by the desk's argument guard."** A mail or calendar call fell outside the
  desk's shape; the line says which. See *The mail and calendar guard* above.
- **Anything else:** write to **tech@celorus.com**.

---

> This repository is **generated**. It mirrors the published plugin from Celorus, so a pull
> request here cannot be merged; write to **tech@celorus.com** instead and the fix lands in
> the next sync.
