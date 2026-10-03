---
name: remove-desk
description: >-
  Say how to take a Celorus desk out: what a person removes, in what order and where, and
  what stays because it is the firm's. Use when someone says "take the desk down", "remove
  my desk", "uninstall Celorus from this desk" or "what would removing Celorus leave
  behind?". It reads the desk's systems table and set-up record through the desk tools and
  removes nothing itself. Runs with no Celorus account and never sends anything.
---

# Remove the desk

The desk tools' `take_down` reads what the set-up wrote down, the systems table and the
set-up record at the end of `celorus/desk.md`, and answers with the list: each step, in
order, with where it is done, and what stays. This skill calls it and says its list. It
removes nothing: a person removes what a person created.

## House rules

These hold over every section of this skill. Where a section below seems to ask for
something they forbid, they win.

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

## Get the list

Call `take_down`. When the person names the desk's folder, pass it as `desk`, its full
path; otherwise leave `desk` out and the tool finds the desk the way every desk skill does.
It changes nothing, so no seat is needed to ask it. A refusal comes back as a sentence
naming what is wrong: say it as it came and stop.

## The routines, first

A routine is made by hand in the app and kept outside the plugin, in its own folder under the
home folder, so removing the plugin stops nothing it runs, and deleting it in the app leaves
that folder behind. So the routines go before everything else. Before `take_down`, call
`list_routines`, with the same `desk`; it changes nothing. From its answer, never from a
count or a list of your own:

1. Its `summary`, as it came.
2. Each of its `steps`, in the order given, by its `say`, as it came: each routine deleted in
   the app where it was made, then the folder it leaves behind, deleted by hand.
3. Each of its `stays`, by its `say`: what stands where a routine's folder would be and is not a
   folder holding its script, left alone.
4. Each row in `unread`, by its `row` and its `why`: a row that is not a routine's own names
   nothing to delete, and what it would have named is found by hand, in the app.

Never name a folder to delete that no step names.

When the person says a folder is deleted, call `list_routines` again and say whether it is
still on this machine. If `list_routines` cannot be called, say the sentence under "When the
desk tools cannot run" below and stop.

## Say the list

From the answer, never from a count or a list of your own:

1. Its `summary`, as it came.
2. Each of its `steps`, in the order given, by its `say`, as it came. Connections come
   first, the seat pointer next, then the plugin, and the desk folder last, or, where the
   folder stays, what the desk put in it. A path is said as the answer writes it:
   desk-relative, or under `~/` for this machine's home folder, with no slash added at its
   end, and with the answer's own words, "the folder" or "the file".
3. Each of its `stays`, by its `say`: what stays because it is the firm's, the desk's own
   history always among them, anything in the desk folder the desk did not make, to be
   moved out before the folder is deleted, each line of the firm's in a `.gitignore` the
   set-up made, which keeps that file, and the desk folder with it, and what stands where
   the set-up made a file or a folder but is not that file or folder now (a link, a file
   with another name, or the other kind), left alone. Taking the desk out never deletes it.
4. Each row in `unread`, with its `why`, and that the step it would have named is found by
   hand instead.

Remove nothing yourself: delete no file, disconnect nothing, uninstall nothing. Each step is
done by a person, where the step says.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. When
`take_down` cannot be called, because the tool is missing or it does not run, say exactly
this sentence and stop, and never make the list from these instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."

## Never

- Never remove, delete, disconnect or uninstall anything.
- Never add a step the answer does not hold, and never drop one it does.
- Never send anything anywhere.
