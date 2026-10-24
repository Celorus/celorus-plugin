---
name: reach-out
description: >-
  Get a seat ready to reach one family: the reach-out card, the lighter summary card, or a
  first mail draft to someone in the family, saved as a draft and never sent. Use when someone
  says "make the reach-out card for the Lakeview family", "make the summary card for them",
  "a call brief", "a mail brief", or "draft the mail to Asha, don't send it".
---

# Reach out

The page a seat reads before a first call or mail to a family: who they are, the signal and
why now, the first two sentences, and what not to say.

## House rules

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

These hold over every section of this skill. Where a section below seems to ask for something
they forbid, they win.

## How you work

- Every number and every row comes from a tool. You write the sentences around them. Never
  count, total or rank anything yourself, and never change a number a tool gave. Say no number
  you have not read from a tool's answer in this chat, and describe no page you have not
  rendered in this chat.
- Short sentences. The reason first, then the ask. Never write a figure about anyone's wealth,
  and never in an opener.
- Names, not page names: say "the Lakeview family" and "Asha Lakeview", using the `titles` a
  tool returns. Where a tool asks for a family, a person or a seat, pass its page name or the
  seat's handle, never the name.
- Every desk tool finds the desk itself: leave `desk` out, and say a refusal about the desk as
  it came.
- Nothing is sent. A mail stops at a draft, and you say it is a draft.
- Before writing an opener or a mail, read `celorus/context/tone.md` and
  `celorus/context/never-say.md` once in this chat, and follow them.
- A tool that refuses says what is wrong and what the valid values are. Read the refusal,
  correct the call and try again. Never work around a refusal, never invent a value it did not
  list, and never write the change some other way.
- To show a page: `render_view(...)`, made through `make`, answers with a `path` and a `page`. Show the file at
  `path` as it is, in the harness's own way of showing a file. The page is built already, so
  do not edit, retype or restyle it, and do not load a design skill for it. Without `desk`, the
  `path` is relative to the desk folder. Then say one line about what the page shows, naming it
  by `page`. A path is never read aloud. If the harness cannot show a file, say the `page` in
  one line.

## The reach-out card

1. Know the seat, as its handle, and the family, as its page name. Find the seat as `day-open`
   does; if it is not known, ask which seat this is, as its handle, and write nothing until it
   is known. Call `family_facts(family=<the family's page name>)`. If it refuses, say what it
   says and ask which family they mean.
2. Write the prose:
   - `who_and_why`: two to three lines. Who they are, the signal and its date, and why now.
   - `opener`: the first two sentences of the call or the mail. Start from the reason: a route
     in (who knows them, where we met) or the signal. Address the person the routes point to;
     say who decides if it is someone else.
   - `avoid`: one to three things not to say, from the facts and the never-say page. The page
     adds the wealth-figure line itself.
3. Through `make`, call `render_view(view="reach-out-card", seat=..., family=..., prose={...})` and show the
   page.

## The summary card, the lightest page

A family has three pages: the summary card, the reach-out card and the room brief. Each page
shows the three with its own lit.

1. Know the seat and the family, as for the card. Through `make`, call
   `render_view(view="summary-card", seat=..., family=...)` with no prose: the card is who, the
   bracket, why now and a contact, all read off the family's page. Show it, and say one line
   at most.

## A mail draft, only when asked

1. Find the person's CRM record in the facts, and their email address through the harness's
   CRM connector. If there is no CRM connector, or the record carries no address, say so in one
   line and stop.
2. Write five to eight short lines in the seat's voice: the reason first, one ask (fifteen
   minutes on a call this week), signed with the seat's name. No figure, nothing the never-say
   page rules out.
3. Save it as a DRAFT through the harness's mail connector, ONE call, with the address, the
   subject and the body, and nothing else. It is never sent: nothing here sends, replies or
   forwards. Say: "Saved as a draft in your mailbox. Not sent." If there is no mail connector,
   or it refuses, say one plain line instead, "The mailbox did not take the draft this time.
   Nothing was sent.", and never try it again. Log nothing on the desk: the desk's log counts
   mail that was sent, and this was not.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. When a desk
tool call cannot be made before this skill has written anything, because the tool is missing
or it does not run, write nothing, say exactly this sentence and stop, and never make the page
or the answer from these instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after this skill has written, here or through a connector,
say what was written and where, and stop; that sentence is never said then.

## Where the desk's pages are

The paths in this skill are a desk's on layouts 1 and 2. On a seat's graph (`celorus/desk.md` says `layout_version: 3`), the desk folder is the seat's own folder, and each page is read from its place on the graph:

- `desk.md`, `index.md`, `log.md`, `desk-log.md`, `marks.md`, `model/` and `views/` stay under `celorus/`.
- `queues/supplied.md`, `register.md`, `motion-spec.md`, `soul.md`, `model/own-words.md` and the folders `context/`, `learnings/` and `rules/` are the firm's common space: `../../common/`, beside the seats' folders, with no `celorus/` in the path.
- `queues/follow-ups.md` is `celorus/shared/queues/follow-ups.md`, and `queues/book.md` is `celorus/personal/queues/book.md`.
- The board, `today/<date>.md`, is `celorus/personal/today/<date>.md`; `crm/` and `signals/inbox/` are under `celorus/personal/`.
- A page of `people/`, `families/`, `firms/`, `seats/`, `conversations/`, `briefs/`, `research/` or `reviews/` is read from `celorus/shared/`, then `celorus/personal/`, then `celorus/team/`, under its folder; `sent/` and `drafts/` from `celorus/personal/`, then `celorus/shared/`.

On a graph a page changes only through `make`, or not at all: a page changed by hand stops the next pull, and a page written new by hand never reaches the firm. Where a step in this skill writes a page by hand, it says what it does on a graph instead.

## Signing in

This skill is free: it reads the desk on this machine without signing in, and each change
it makes to the desk asks for a free Celorus sign-in before it is made.

Before each step that changes the desk, by hand or through `make`, call `celorus-link`'s
`sign_in`, and change nothing until it answers "You are signed in to Celorus on this
computer.". When it answers a page to open instead, show that page for the person to open in
their own browser, change nothing, and call `sign_in` again when they have signed in. Any
other answer: say it as it came, and change nothing. That answer is the link's own reading of
the sign-in it keeps on this computer: a sign-in ended on the desk server reads as signed in until a change, a pull or a seed made through the link is answered otherwise, and the desk server still checks
every change made through `make`.

A step that names a desk tool and `make` changes the desk on the desk server: call
`celorus-link`'s `make` with `tool`, that tool's name, and `arguments`, the tool's own
arguments as the step gives them, `desk` included. The desk server makes the change and the
link writes its pages into the desk; never write those pages by hand, and never make the
change another way. Say each answer in its own words, and follow these as they say:

- "You are not signed in to Celorus through the link, or the sign-in has ended.": call
  `sign_in`, show the page it answers for the person to open in their own browser, and when
  they have signed in, make the change again.
- "The desk server could not be reached, so the change was queued on this desk": it is
  made at the next change made through the link, while online; go on with the steps that
  only read.
- "This change needs payment before the desk server makes it.", with the balance and what is
  still needed where it gives them, then "Recharge on your account page." and "Nothing was
  written. It was not queued; make the change again once the account is recharged.": say it
  as it came, with no plan name and no price of your own, and stop that change.
- "This seat's desk holds no read of its storage that the link can trust" (a seat's graph): call `celorus-link`'s `pull`, then make the change again. A pull refused for pages changed on this computer names them: say them, and change nothing by hand.
- "This seat's storage holds no desk yet" (a seat's graph): call `celorus-link`'s `seed`, then make the change again.
- Any other answer: say it as it came; where it says nothing was written, stop that change.

## Never

- Never send anything: a mail stops at a draft, and you say it is a draft.
- Never write a figure about anyone's wealth, and never in an opener.
- Never write to an address the desk's CRM does not hold.
