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

You scaffold the desk workspace: a visible `celorus/` folder in the desk folder, in the
Celorus structure, that every workday skill reads and writes. It is theirs: inspectable,
backed up their way, and it stays with them if the plugin is ever removed. A hidden
`.celorus/` beside it holds scratch that may be deleted at any time.

Four phrases, four modes:

- **"set up my desk"** creates a desk. Seat mode by default; desk mode when the user says
  they are the operator or a private desk bundle is installed.
- **"check my desk setup"** verifies an existing desk and changes nothing. What the pages
  themselves say, a missing detail or a link to nothing, is "check my desk", which is
  `check-desk`.
- **"refresh my desk setup"** re-reads the desk bundle and rewrites the configuration
  files only (`motion-spec.md` and the role profiles inside it); it never touches a data
  file.
- **"update my desk"** moves a desk to the newest model, after a preview and one yes. It
  never deletes a page.

## Where the desk lives: the one path convention

1. If the environment variable `CELORUS_DESK` names a folder, that folder is the desk
   folder.
2. Otherwise walk up from the current working directory to the first folder that contains
   `celorus/index.md`. That is the desk folder.
3. Otherwise there is no desk. In set-up mode the current working directory becomes the
   desk folder once the user confirms it (never a home directory and never a system
   folder; if the working directory is one of those, ask for a folder). In the other two
   modes, say there is no desk here and offer to set one up.

Never write an absolute path inside the workspace. Every link is relative to `celorus/`.
The workspace carries a `desk_id`; the seat pointer (below) is keyed on it, so the folder
can be moved, renamed or synced and every skill finds it again.

## Seat mode: five questions, one at a time

1. **Your role**: relationship manager, desk head, operator, or other. The relationship
   manager's day is the default profile.
2. **The desk's name, and your handle.** The handle is short, lowercase, no spaces; it
   names your seat file.
3. **Where your book lives**: a CRM export you will drop into `celorus/crm/`, a
   spreadsheet, or "I will type names". Record the answer. Never ask for the master list.
4. **Which connectors this harness has**: mail, calendar, drive. Test each by reading only
   the account name; record true or false per connector. Never read a message, an event
   or a document during the test.
5. **How long researching one lead takes you today, in minutes.** Record it as
   self-reported. It is the "before" the desk log measures against.

Then confirm the desk folder and write the scaffold.

## What you write (seat mode)

Every file in `scaffold.md`, with the answers filled in, in this order: `.gitignore` at the
desk folder root (add the two lines; create the file if absent), then under `celorus/`:
`index.md`, `desk.md`, `log.md`, `desk-log.md` (header only), `motion-spec.md`, `register.md`,
`marks.md`, `queues/supplied.md`, `queues/follow-ups.md`, `queues/book.md`,
`seats/<handle>.md`, `context/tone.md`, `context/never-say.md`, `context/notes.md`,
`crm/README.md`, `rules/rulebook.md`, `model/own-words.md`, then the model pages (the
scaffold's "The model pages"), and the empty folders the scaffold names.

Then the Obsidian settings. Obsidian rewrites its own settings when it closes, so before
writing them say that Obsidian must be shut, and wait until the person says it is. Write the
four files in `obsidian.md`, byte for byte, and run `check-desk` over the whole desk once, so
`views/` holds its three pages from the first day.

Every page header is flat: each detail at the top level, never under a block. A connection
is a quoted link by name, `works_at: "[[<slug>]]"`.

Mint the `desk_id` as `d-` followed by eight random lowercase letters or digits. Every
`timestamp` is now, in ISO 8601 with the local offset. Then write the seat pointer: the
file `~/.celorus/seat-<desk_id>` in the user's home folder, holding the handle on one
line. It is the only thing the pack keeps outside the desk folder, and it is per machine
on purpose: a pointer inside a synced desk would follow the desk to every machine.

Finish with the first line of `log.md`, under the heading `## <date>`:
`* <time> · <handle> · install-desk · wrote the scaffold · yours`. The register
label `yours` marks what came from the desk itself; nothing here came from the web or
the record. Every later line goes directly under its day's heading, and a new day's
heading goes above the older ones.

## Desk mode: the operator

The four acts of the Workday Install. Act 1, the Setting, happened in the room and
produced the desk's Signal Charter; the operator carries it in the private desk bundle, a
plugin named `celorus-<desk>` installed on this desk's seats only. Act 2, the Join, is the
connectors and the export: their mail, calendar and drive through the harness's own
connectors; their CRM as a tagged export in `celorus/crm/`; their brand tokens in
`celorus/context/brand/`. Act 3, the Install, is this skill.

1. Read the desk bundle's skill. From it take the lead definition, the clocks, the caps,
   the allocation rules, the role profiles, the CRM field map, the vocabulary, the
   compliance lines and the bundle version. If no bundle is installed, say so and fall
   back to seat mode's questions for this one seat.
2. Write `motion-spec.md` from the bundle (its `charter_version` and `bundle_version`
   copied from the bundle); seed `register.md` with the Charter's signals, each with
   `build: unbuilt` and `compliance: unreviewed` unless the bundle says otherwise; seed
   `context/never-say.md` with the compliance lines.
3. Ask each seat the five questions in turn, or let the operator answer for them, and
   write one `seats/<handle>.md` per seat; write this machine's seat pointer.
4. Everything else exactly as seat mode.

"Refresh my desk setup" repeats steps 1 and 2 only, bumps `timestamp` on the two files,
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
  `model/own-words.md`, and `.gitignore` carrying `.celorus/` and
  `celorus/.obsidian/workspace*.json`;
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

## Update mode: "update my desk"

Follow `update.md` in this skill's folder exactly: take a commit or a dated copy first, show
the preview, change nothing until the person says yes, then run the steps in order. It never
deletes a page and never sends anything. If a step stops, name the step and say the desk is
as it was.

## Say at the end (set-up and refresh)

- Where the desk is and which seat this machine holds.
- How to open the day on this harness: on Claude Code the desk announces itself at
  session start; everywhere else, say "open my day".
- The schedule recipe for this harness, which you describe and never set yourself: a
  scheduled task or routine at 07:15 that runs "open my day" and, where a mail connector
  exists, mails the board to the seat. A seat with no scheduler opens the day by hand.
- What you could not connect, one line each, and that nothing was invented to cover it.

## With no account

This skill runs in full with no Celorus account and never calls the Celorus tools.
Connecting adds nothing to the install.

## Never

- Never ask for, copy or store the client master list; the CRM is an export the desk
  chooses, removable by deleting `celorus/crm/`.
- Never read a message, an event or a document while testing a connector.
- Never write outside the desk folder except the one seat pointer.
- Never overwrite a data file on refresh; never delete anything in verify.
- Never send anything anywhere.

**Next:** `day-open`. When this skill is done the scaffold exists and `log.md` has its first line.
