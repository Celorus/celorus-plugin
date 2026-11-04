# The sample

The one page `scaffold_desk` writes when the set-up asks for the sample (`sample` true; seat
mode asks for it): a made-up morning, so the first "open my day" on a new desk shows what a day
looks like. Placeholder: `{{now}}` the set-up's moment, as in `scaffold.md`. The meeting is
"tomorrow" in words, never a date, so the page holds true on whatever day it is first shown.

The page sits in `celorus/.sample/`, a folder whose name starts with a dot. The desk tools pass
over every page under such a name: no count, view, check, update or change sent to the desk
server reads it, so the sample never enters a figure of the desk. Every line of it says it is a
sample, and no person, firm or meeting on it is real. Deleting the folder removes it; nothing
else reads it.

## `celorus/.sample/morning.md`

```markdown
---
type: sample
title: A morning on the sample desk
description: Made up, to show how a morning looks. No person, firm or meeting here is real.
timestamp: {{now}}
---

# A morning on the sample desk

Sample: everything on this page is made up, to show how a morning on your desk looks. No person,
firm or meeting here is real, and nothing here is counted on your desk.

## Coming up

- Sample: tomorrow, 11:00 IST, a meeting with Meera Sample, finance head of Sample Spinning
  Mills (made up). Before it: what the firm last filed, and the note you promised her.

## To reach today

- Sample: Arjun Sample, managing director of Sample Spinning Mills (made up). Why today: the
  firm opened a second plant last month.
- Sample: Meera Sample, finance head of Sample Spinning Mills (made up). Why today: confirm
  tomorrow's meeting.

## What you owe

- Sample: the note you promised Meera Sample, due before tomorrow's meeting.
```
