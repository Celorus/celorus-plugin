---
type: model-changes
title: Changes in model version 1
description: What "update my desk" does to a desk made before the model
shelf: open
model_version: 1
from_layout: 1
to_layout: 2
renames_folder:
- accounts -> firms
- calls -> conversations
renames_type:
- account -> firm
- call -> conversation
adds_folder: [research, sent, learnings, learnings/themes, rules, model, views, merges]
adds_file: [desk.md, rules/rulebook.md, model/own-words.md]
renames_word: []
adds_list: [channel, learning_status, promise_status, proof, rule_origin, source, standing, tie_basis]
---

# Changes in model version 1

The desk gains a model: the kinds of thing it holds, the connections between them, and the
words each list allows. Nothing on the desk is deleted.

- The folder `accounts` becomes `firms`, and `calls` becomes `conversations`.
- Page headers become flat. The details stay the same; only the nesting goes. A detail with
  no flat shape is kept word for word under `## Kept by the update` on its page.
- A new page, `desk.md`, holds the stamps `index.md` used to hold. `index.md` is rewritten to
  the short form, and its old text is in the copy taken before the update.
- The log is grouped under one heading per day.
- Promises written on conversation pages join the follow-ups queue once, with who owes them.
- A family named on a person page becomes a guessed connection, never a link, to confirm.
- A page of a kind that draws connections gains an empty `## Connections` heading.
