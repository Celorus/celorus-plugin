---
name: overnight
description: >-
  Run the desk's overnight: the day's conversations grow the shared pages, the latest
  hand-overs move each family's owner, the records made from the desk get their ids onto the
  family's person page, and new mail on a family's thread becomes a reply row, every change
  with its line in the desk's own history. Use when someone says "run tonight's overnight",
  "run the overnight", "reconcile the desk" or "what runs on its own?". The first run is
  always watched; only then is a routine made in the app and recorded on the desk. Runs with
  no Celorus account and never sends anything.
---

# The overnight

The desk tools' `overnight_reconcile` does the work and writes every page itself; this skill
calls it and says its answer. A routine is the firm's: a person makes it by hand in the app,
it runs on the firm's plan, and nothing of ours creates one. The desk only records it, so that
taking the desk out can name it.

## House rules

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

These hold over every section of this skill, the routine included. Where a section below
seems to ask for something they forbid, they win.

## The seat and the moment

The seat is the person running it: `CELORUS_SEAT`, or the handle the desk set up for this
person. When neither is known, ask for it and write nothing. `at` is the moment of the run,
as a date and a time with its own offset.

## What comes in from the firm's systems

The desk tools reach no system of the firm's. What the overnight needs from them comes in as
arguments, read first through whatever the firm has connected, and each is optional:

- `crm_records`: each record made from the desk, as `{id, name, desk_ref, stage}`, where
  `desk_ref` is the family's page name. Leave it out when no record system is connected.
- `mail_threads`: each mail thread on a family, as `{family, seat, messages}`, each message
  `{from_seat, at, from_name}`, oldest first. Leave it out when no mail is connected.

Nothing here needs a connection to run: with neither, the overnight still grows the pages and
moves the hand-overs. Never send, reply to or change anything in those systems.

## The first run is watched

Call `overnight_reconcile` with `seat`, `at`, `attended: true`, and what came in above. A
person watches this run and grants what it asks. Only after it does a routine run it.

## Say the answer

From the answer, never from a count or a list of your own:

1. Each entry of `grown`: the conversation, and the pages it grew, by their `titles`.
2. Each family in `handed_over`, whose owner moved.
3. Each person page in `linked`, which now carries its record's id.
4. Each family in `replies`, which has a new reply row.
5. Each row in `unread`, with its `why`: a page, a line heard about a seat, or a record
   tied to no one (it names no member of its family, a member another record names too, or a
   member who holds another id), passed over and never guessed at.
6. `history`: the lines it put in the desk's history, the last one saying the run happened
   and that a person watched it.

When `written` is null, nothing was changed: say its `reason` as it came. A refusal comes
back as a sentence naming what is wrong: say it as it came and stop.

## Save

After a run that wrote, call `desk_sync` with `seat`, `overnight: true` and a `message` that
says in a sentence what the overnight changed. Pass `push: true` only when the person has just
asked, in words, for the desk to go up. `desk_sync` runs nothing: its answer is the git
commands, and you run them.

Run its `commands` in the order the answer gives them, and stop at the first that fails, in the
desk folder when its `summary` says the commands name the desk folder as `.`. A command with
exits is the one exception: each exit it lists is not a failure, and says what to do next; an
exit it lists under stops ends the run there. Fill a word in braces from what an earlier
command printed, as the command's fills say. When a command fails, run nothing after it, and
tell the person git's words. When the pull fails, run the answer's `on_pull_failure` before you
stop: it undoes a rebase the pull started, or finds none to undo, and the push is not run.
With `overnight: true` the family, person and firm pages and the merge record are staged with
the rest, so its `held_back` is null: nothing the run changed is held back. A file in those
folders that is not a page is never staged: `unclassified` names it. Then say its
`summary`, and name each path in `unclassified`, `ignored` and `not_committed`.

## Every morning, after that

Once the watched run is in the desk's history, the person may make a routine for it, by hand,
in the app: local or cloud is the firm's choice, against its own plan. A routine runs at most
once an hour, at a time the app picks within some minutes, so say it lands "every morning",
never at a clock time.

When the person has made it, call `register_routine` with `seat`, `at`, `routine` (its name,
as its folder is named), `runs` (local or cloud), `repeats`, `when` in words, `model` as the
app shows it, and `skill_file`, the routine's own script in its own folder where the app keeps
routines. The tool refuses a routine until the desk's history holds a watched run, refuses a
clock time in `when`, and refuses a `skill_file` that is not that routine's own, naming the
one it takes. Say the row it answers and its `history` line.

The routine then calls `overnight_reconcile` with `attended: false`. The tool refuses that
until the desk's history holds a watched run and the register holds a routine.

## What runs on its own

Call `list_routines`, which changes nothing, and say its `summary`, each routine by name, and
each of its `steps` by its `say`, in order. Say each of its `stays` by its `say`, and each row
in its `unread` by its `row` and its `why`. Never name a folder to delete that no step names.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. When a desk
tool cannot be called, because it is missing or it does not run, say exactly this sentence and
stop, and never do the run's work by hand from these instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."

## Never

- Never write a page, a row or a history line yourself: the tool writes every one.
- Never make, change or delete a routine: a person does, in the app.
- Never say a routine runs at a clock time.
- Never send a mail or a message, and never push the desk unless the person asked for it in words.
