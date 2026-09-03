---
name: install-desk
description: >-
  Set up a Celorus desk: the workspace folder the workday skills read and write. Use
  when someone says "set up my desk", "install the desk", "create my Celorus workspace",
  "check my desk setup" or "refresh my desk setup", or when any workday skill finds no
  desk. Two modes: a single seat (five minutes, no account needed) and a whole desk (the
  operator, from the desk's private bundle). Runs entirely on the user's side: it never
  connects to Celorus and never sends anything anywhere.
---

# Install the desk

You scaffold the desk workspace: a visible `celorus/` folder in the desk folder, in the
Celorus structure, that every workday skill reads and writes. It is theirs: inspectable,
backed up their way, and it stays with them if the plugin is ever removed. A hidden
`.celorus/` beside it holds scratch that may be deleted at any time.

Three phrases, three modes:

- **"set up my desk"** creates a desk. Seat mode by default; desk mode when the user says
  they are the operator or a private desk bundle is installed.
- **"check my desk setup"** verifies an existing desk and changes nothing.
- **"refresh my desk setup"** re-reads the desk bundle and rewrites the configuration
  files only (`motion-spec.md` and the role profiles inside it); it never touches a data
  file.

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

Every file in `scaffold.md`, with the answers filled in, in this order: `.gitignore` at
the desk folder root (add the line `.celorus/`; create the file if absent), then under
`celorus/`: `index.md`, `log.md`, `desk-log.md` (header only), `motion-spec.md`,
`register.md`, `marks.md`, `queues/supplied.md`, `queues/follow-ups.md`,
`queues/book.md`, `seats/<handle>.md`, `context/tone.md`, `context/never-say.md`,
`context/notes.md`, `crm/README.md`, and the folders `today/`, `people/`, `families/`,
`accounts/`, `calls/`, `briefs/`, `drafts/`, `reviews/`, `context/brand/` and
`signals/inbox/`, each holding an empty `.gitkeep`.

Mint the `desk_id` as `d-` followed by eight random lowercase letters or digits. Every
`timestamp` is now, in ISO 8601 with the local offset. Then write the seat pointer: the
file `~/.celorus/seat-<desk_id>` in the user's home folder, holding the handle on one
line. It is the only thing the pack keeps outside the desk folder, and it is per machine
on purpose: a pointer inside a synced desk would follow the desk to every machine.

Finish with the first line of `log.md`:
`- <date> <time> · <handle> · install-desk · wrote the scaffold · yours`. The register
label `yours` marks what came from the desk itself; nothing here came from the web or
the record.

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
and appends one line to `log.md`.

## Verify mode: "check my desk setup"

Report, and change nothing:

- the desk folder found, and how (the variable or the walk);
- each required file present or missing: `index.md`, `log.md`, `desk-log.md`,
  `motion-spec.md`, `register.md`, `marks.md`, the three queues, the three context files,
  `crm/README.md`, and `.gitignore` carrying `.celorus/`;
- `index.md` carries `okf_version: "0.1"`, and `layout_version: 1` with a non-empty
  `desk_id` under `celorus:`;
- every markdown file under `celorus/` opens with frontmatter that has a non-empty `type`
  and a `timestamp`;
- every `type` is one of the desk's known types: `index`, `log`, `desk-log`,
  `motion-spec`, `register`, `marks`, `queue`, `board`, `person`, `family`, `account`,
  `call`, `brief`, `draft`, `review`, `seat`, `context`;
- the header of `desk-log.md` is exactly
  `| date | seat | lead | source | minutes | action | outcome | mark | by |`;
- the header of `queues/follow-ups.md` is exactly `| who | what | by | from | state |`;
- the seat pointer for this machine exists and names a seat file that exists;
- no absolute path anywhere under `celorus/`.

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
