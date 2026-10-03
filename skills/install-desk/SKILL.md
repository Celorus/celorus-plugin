---
name: install-desk
description: >-
  Set up a Celorus desk: the workspace folder the workday skills read and write. Use
  when someone says "set up my desk", "install the desk", "create my Celorus workspace",
  "check my desk setup" or "refresh my desk setup", or when any workday skill finds no
  desk. Two modes: a single seat (five minutes, no account needed) and a whole desk (the
  operator, from the desk's private bundle). Also checks a desk's setup, or updates a desk
  to the newest model when someone says "update my desk". Runs entirely on the user's
  side: it never connects to Celorus and never sends anything anywhere.
---

# Install the desk

The desk tools' `scaffold_desk` sets the desk up: a visible `celorus/` folder in the desk
folder, in the Celorus structure, that every workday skill reads and writes. It is theirs:
inspectable, backed up their way, and it stays with them if the plugin is ever removed. A
hidden `.celorus/` beside it holds scratch that may be deleted at any time.
Deleting it also deletes this seat's snapshot key, and snapshots taken before then can no longer be checked.
This skill asks what the tool needs, calls it, and says what it made from its answer.

## House rules

These hold over every section of this skill, set-up, verify, refresh and update included.
Where a section below seems to ask for something they forbid, they win.

1. Numbers and rows come only from a tool. The model writes sentences and never counts.
2. A page is shown from the path the tool returns, never retyped.
3. A refusal names its valid values. A tool that cannot run says so in one sentence, and the skill stops.
4. Nothing is sent. A mail stops at a draft.
5. Every change ends in the desk's own history.
6. The seat must be known before anything is written.

## Four phrases, four modes

- **"set up my desk"** creates a desk. Seat mode by default; desk mode when the user says
  they are the operator or a private desk bundle is installed.
- **"check my desk setup"** verifies an existing desk and changes nothing. What the pages
  themselves say, a missing detail or a link to nothing, is "check my desk", which is
  `check-desk`.
- **"refresh my desk setup"** re-reads the desk bundle and rewrites the configuration
  files only (`motion-spec.md` and the role profiles inside it); it never touches a data
  file.
- **"update my desk"** moves a desk to the newest model, after a preview and one yes, and
  records `none on this desk` for a system the person says the firm has none of. It never deletes
  a page.

## Where the desk lives: the one path convention

1. If the environment variable `CELORUS_DESK` names a folder, that folder is the desk
   folder.
2. Otherwise walk up from the current working directory to the first folder that contains
   `celorus/index.md`. That is the desk folder.
3. Otherwise there is no desk. In set-up mode the desk folder is the one the person names,
   or the current working directory once they confirm it. In the other modes, say there is
   no desk here and offer to set one up.

Never write an absolute path inside the workspace. Every link is relative to `celorus/`.
The workspace carries a `desk_id`; the seat pointer is keyed on it, so the folder can be
moved, renamed or synced and every skill finds it again.

## Seat mode: ask only what is missing

Ask, one at a time, only what the person has not already said:

1. **Your role**: `rep` (an SDR, finding and supplying leads), `rm` (a relationship
   manager), `desk-head`, `operator`, or `other`. The relationship manager's day is the
   default profile.
2. **The desk's name, and your handle.** The handle is short, lowercase, no spaces; it
   names your seat file. This is the seat, and nothing is written before it is known.
3. **Where your book lives**: `crm-export` (a CRM export you will drop into `celorus/crm/`),
   `sheet`, or `typed` ("I will type names"). Never ask for the master list.
4. **Which systems this harness reaches**, role by role: mail, calendar, files, chat, crm,
   client book, product list. Test each connector by reading only the account name; never
   read a message, an event or a document during the test. For each role, keep the
   connector's name as the harness shows it and `connected` when the test answers, or
   `still to connect` when the test fails. Where the harness shows no connector for a role,
   ask the person the question below. Keep `none on this desk` only when they say the firm
   has no such system, and never guess it: a role not asked about stays `still to connect`.

   The set-up question, said with the role's own word (mail, calendar, files, chat, CRM,
   client book, product list), shown here for the CRM:
   "No CRM is connected here. Does the firm have one that is still to connect, or is there none on this desk?"

   Its answers: "The firm has a CRM; it is still to connect." / "The firm has no CRM: none on this desk."
5. **How long researching one lead takes you today, in minutes.** It is self-reported, and
   it is the "before" the desk log measures against.

Then confirm the desk folder, as the full path the tool needs.

## What you write (seat mode)

`scaffold_desk` writes the desk, and nothing is written by hand. It writes the Obsidian
settings too, and Obsidian rewrites its own settings when it closes, so before calling it
say that Obsidian must be shut, and wait until the person says it is. It writes the four
files in `obsidian.md` byte for byte, with every file in `scaffold.md`.

Call `scaffold_desk` with:

- `desk`: the desk folder's full path;
- `name`: the desk's name, as the person said it;
- `seats`: this seat first, as `handle`, `role`, `book_source` and `baseline_minutes`;
- `systems`: one row per role asked about, as `role`, `connector` (the name as the harness
  shows it) and `state`; a role left out is written `still to connect`;
- `now`: the moment, in ISO 8601 with a `T` between the date and the time and the local
  offset (leave it out for this machine's clock).

A refusal comes back as a sentence naming what is wrong, ending "Nothing was written.":
say it as it came and ask again for the one answer it names. Never try another folder, role
or value of your own, and never write the desk some other way.

The tool writes every page of the scaffold with the answers filled in, the model pages, the
empty folders, the systems table and the set-up record at the end of `celorus/desk.md`, and
this machine's seat pointer. It writes the first line of `log.md` itself, under the heading
`## <date>`: `* <time> · <handle> · install-desk · wrote the scaffold · yours`. The register
label `yours` marks what came from the desk itself; nothing here came from the web or the
record.

Then call `render_views` with the same `desk`, the seat's `handle` and `now`, so `views/`
holds its three pages from the first day.

## Desk mode: the operator

The four acts of the Workday Install. Act 1, the Setting, happened in the room and
produced the desk's Signal Charter; the operator carries it in the private desk bundle, a
plugin installed on this desk's seats only. Act 2, the Join, is the connectors and the
export: their systems through the harness's own connectors; their CRM as a tagged export in
`celorus/crm/`; their brand tokens in `celorus/context/brand/`. Act 3, the Install, is this
skill.

1. Read the desk bundle's skill. From it take the lead definition, the clocks, the caps,
   the allocation rules, the role profiles, the CRM field map, the vocabulary, the
   compliance lines, the pack's name and version, and the bundle version. If no bundle is
   installed, say so and fall back to seat mode's questions for this one seat.
2. Ask each seat seat mode's questions in turn, or let the operator answer for them. Call
   `scaffold_desk` once, with every seat (this machine's first), the systems, and `pack`
   and `pack_version` from the bundle.
3. Write `motion-spec.md` from the bundle (its `charter_version` and `bundle_version`
   copied from the bundle); seed `register.md` with the Charter's signals, each with
   `build: unbuilt` and `compliance: unreviewed` unless the bundle says otherwise; seed
   `context/never-say.md` with the compliance lines. Write one line to `log.md`, under the
   day's heading, saying the bundle was applied.
4. Everything else exactly as seat mode.

"Refresh my desk setup" repeats steps 1 and 3 only, bumps `timestamp` on the two files,
and writes one line to `log.md`, under the day's heading.

## Verify mode: "check my desk setup"

Report, and change nothing. First read `celorus/desk.md`. If it is missing, the desk is
layout 1, or a layout 2 desk whose desk.md is lost; `index.md` tells them apart. If its
header holds a nested `celorus` block, the desk is on layout 1, one version behind: say so
in one line, check it against `layout-1.md` in this skill's folder, and say that "update my
desk" moves it to layout 2 without losing a page. If its header holds only
`okf_version: "0.2"`, `desk.md` is lost: say so in one line, and say to restore it from the
copy taken before the last update or from the desk's history; "update my desk" stops rather
than make its stamps up. Otherwise:

- the desk folder found, and how (the variable or the walk);
- each required file present or missing: `index.md`, `desk.md`, `log.md`, `desk-log.md`,
  `motion-spec.md`, `register.md`, `marks.md`, the three queues, the three context files,
  `crm/README.md`, `rules/rulebook.md`, `model/model.md`, `model/connections.md`,
  `model/own-words.md`, and `.gitignore` carrying `.celorus/`,
  `celorus/.obsidian/workspace*.json` and `celorus/.views/`;
- `index.md` has a header holding only `okf_version: "0.2"`; `log.md` has no header: it
  holds `# Log`, then `## YYYY-MM-DD` day headings with lines `* HH:MM · ...` under them;
- `desk.md` carries `layout_version: 2`, a `model_version`, and a non-empty `desk` and `desk_id`;
- every other markdown file under `celorus/` opens with a header that has a non-empty `type`,
  and a `timestamp` outside `model/` and `views/`;
- outside `model/`, `views/` and `merges/`, every `type` is a kind named by a
  `kind-<kind>.md` page in `model/`, or one of the system types listed in `model/model.md`;
- outside those three folders, no header holds a nested value (a list of plain words,
  or of quoted links, is fine), except `sources`;
- the header of `desk-log.md` is exactly
  `| date | seat | lead | source | minutes | action | outcome | mark | by |`;
- the header of `queues/follow-ups.md` is exactly `| owed_by | who | what | by | from | state |`;
- the seat pointer for this machine exists and names a seat file that exists;
- no absolute path anywhere under `celorus/`.

What was still to connect at the set-up is read from the systems table, never from a count of
your own: call `take_down`, which changes nothing, and say its `not_connected` roles. The table
is what the set-up recorded, not what is connected now: say so, in those words. A role the
harness shows connected now is said connected, never still to connect. A desk set up before
the systems table has none, and its answer says so.

## Update mode: "update my desk"

Follow `update.md` in this skill's folder exactly: take a commit or a dated copy first, show
the preview, change nothing until the person says yes, then run the steps in order. It never
deletes a page and never sends anything. If a step stops, name the step and say the desk is
as it was.

## Say at the end (set-up and refresh)

From `scaffold_desk`'s answer, never from a count of your own:

- Its `summary`, as it came: the desk, the seat this machine holds, what it made, what is
  connected and what is still to connect. A page is named by the desk-relative path the
  answer gives, from `written`, and a path outside the desk folder is never said.
- Each role in `still_to_connect`, one line each, and that nothing was invented to cover it.
- Each role in `none_on_this_desk`, on its own line, as the desk has none of it: for the CRM,
  "no CRM on this desk". Never say it among what is still to connect.
- How to open the day on this harness: on Claude Code the desk announces itself at
  session start; everywhere else, say "open my day".

Then say that the rest of the setup is Celorus's to do, not the firm's. Our people do it
with the desk, it is part of what we deliver, and it runs in this order. Say it as this
list, in these words:

1. The plugin, installed with the plain install command in a terminal. The slash command
   opens a manager and applies nothing when it is closed.
2. The folder's settings, covering every server the desk will use, so no permission prompt
   appears. A connection added later without its entry is a prompt in front of whoever is
   watching.
3. The record, signed in before it is needed. Nobody should watch a sign-in.
4. The transcript tool, connected, and its tools added to the same settings.
5. The calendar, connected, with the working rule that comes with it: every meeting goes on
   the calendar, because nothing off the calendar can be recorded.
6. The routines, made by hand in the app. Nothing of ours creates a routine: a person sets
   it up once, and it runs itself afterwards. Local or cloud is the firm's choice, against
   its own plan. Our person sits through the first run and grants what it asks, because a
   routine runs unattended only after that.
7. The vault: what stays out of the sidebar, and the colours.
8. What was scheduled, written down on the desk's register, one row for each routine, so
   it can be found and removed later.

Taking the desk out is `remove-desk`: it lists what to remove, in order, and removes
nothing itself.

## When the desk tools cannot run

The desk tools are the `celorus-desk` server this plugin starts on this machine. Before its
first write, this skill calls `check_desk` once, so it knows the desk tools answer before
anything is written; a refusal is an answer. When a desk tool call cannot be made before
anything is written, because the tool is missing or it does not run, write nothing, say
exactly this sentence and stop, and never make the page or the answer from these
instructions instead:
"The desk tools are not running on this machine, so I cannot do this. Nothing was changed."
If a desk tool call cannot be made after this skill has written, say which pages were
written and stop; that sentence is never said then.

## With no account

This skill runs in full with no Celorus account and never calls the Celorus tools.
Connecting adds nothing to the install.

## Never

- Never ask for, copy or store the client master list; the CRM is an export the desk
  chooses, removable by deleting `celorus/crm/`.
- Never read a message, an event or a document while testing a connector.
- Never write outside the desk folder; the one seat pointer is the tool's to write.
- Never overwrite a data file on refresh; never delete anything in verify.
- Never send anything anywhere.

**Next:** `day-open`. When this skill is done the scaffold exists and `log.md` has its first line.
