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
- To show a page: `render_view(...)` answers with a `path` and a `page`. Show the file at
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
3. Call `render_view(view="reach-out-card", seat=..., family=..., prose={...})` and show the
   page.

## The summary card, the lightest page

A family has three pages: the summary card, the reach-out card and the room brief. Each page
shows the three with its own lit.

1. Know the seat and the family, as for the card. Call
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

## Never

- Never send anything: a mail stops at a draft, and you say it is a draft.
- Never write a figure about anyone's wealth, and never in an opener.
- Never write to an address the desk's CRM does not hold.
