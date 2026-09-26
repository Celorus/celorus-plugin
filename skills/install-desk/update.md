# Updating a desk

Read this when the person says "update my desk", or says yes to the line day-open shows when
the plugin's model is newer than the desk's. The update is the desk tools' `update_desk`,
never done by hand: it runs the steps below in this order, each one checks whether it is
already done and skips if so, so a second run changes nothing. If the desk tools cannot run,
say "The desk tools are not running on this machine, so I cannot do this. Nothing was
changed." and stop.

## Before anything changes

1. If the desk folder is a git repository, say so and commit everything first with the
   message `before update`. If it is not, offer a dated copy of the whole folder beside it,
   named `<folder>-before-update-<YYYY-MM-DD>`, and make it on a yes. The copy sits beside the
   desk, not in it, so taking it changes nothing on the desk. If they say no, stop and say
   why: steps 3 and 4 write `index.md` and `log.md` afresh, and the copy is the only place
   their old text is kept.
2. Call `update_desk` with the seat's `handle`, and `apply` left out. It works out every
   change on a scratch copy and changes nothing on the desk. It checks every stop below before
   writing anything: a link (a file or folder that points somewhere else) as `.gitignore`, as
   `celorus/` or anywhere under it, since the update never writes through one; a page already
   sitting where a page would move (step 1), a desk whose stamps would have to be made up
   (step 2), a missing `log.md` or follow-ups queue, a follow-ups table whose columns neither
   layout writes or a row that does not hold as many cells as its columns name, a promise in a
   call's header that does not say what was promised (step 5), and a model or changes page
   that cannot be read. When one applies it refuses, names the step or the link, and ends
   "Nothing was changed.": say its sentence and stop. A later step can still stop, on a page
   whose header cannot be read or a changes page that names a word nothing holds: what keeps
   the desk safe then is this preview on a copy, which meets the same stop first, names the
   step, and ends "Nothing was changed." too, since only its copy had changed. So never skip
   it.
3. Show the person the answer's `preview` as it came: one plain line per kind of change, then
   "N files change. Nothing is deleted: X pages before, Y after.", then each thing they must
   decide, each starting "Decide:". If nothing would change, the preview is one line,
   "No file changes: the desk is already up to date.", and then
   the update ends there: nothing else runs, not even `check-desk`, which would write views
   and a log line on a desk the person was just told nothing would change. Change nothing
   until they say yes. On a yes, call `update_desk` again with the same `handle`,
   `apply: true`, and the preview's `plan` as it came. The update then works the plan out
   again and runs only if it is the one the person saw; if the desk changed since, it refuses,
   changing nothing, and you preview again and ask again. Every number you say is one the tool
   returned.

## The steps

1. **Moving folders.** `accounts/` becomes `firms/`, `calls/` becomes `conversations/`. If a
   page already sits where a page would move, stop before writing anything and name both
   pages. Add any folder the desk lacks, with an empty `.gitkeep`.
2. **Writing desk.md.** Skip this step if `desk.md` exists. Copy the stamps from the
   `celorus:` block in the old `index.md` header: the desk's id and name, the seats, and the
   chain with `check-desk` added. Write the other keys as `scaffold.md` writes them, with
   `layout_version: 2` and `model_version: 0` until step 10 stamps it. If `desk.md` is
   missing and `index.md` holds no `celorus:` block, the desk is a layout 2 desk that lost
   its `desk.md`: stop with "desk.md is missing and index.md holds no stamps; restore desk.md
   from the copy taken before the update". If the block holds no `desk_id` or no name, stop
   too. The update never makes a stamp up.
3. **Rewriting index.md.** Skip this step if the `index.md` header has `okf_version: "0.2"` and
   no `celorus:` block: the stamps have already moved out, and anything else the person put in
   their own `index.md` is theirs to keep. Otherwise write the short form from `scaffold.md`.
   The old text is in the copy taken before the update.
4. **Regrouping the log.** Skip this step if `log.md` already opens with `# Log`. Otherwise
   write `# Log`, then one `## <date>` heading per day, newest first. Each old line
   `- <date> <time> · ...` becomes `* <time> · ...` under its day. A line that does not read
   as a log line is kept under today's heading as `* 00:00 · kept by the update · <the line>`.
5. **Queueing promises.** The follow-ups queue gains `owed_by` as its first column; every old
   row is ours, so it says `us`, and its `from` path names the new folder. A promise written
   in a call's header joins the queue once, as `us`, the call's lead, what was promised, by
   when, the conversation page, `due`, wherever that page sits: a call filed in a folder of
   its own is read too, because step 6 takes the promise out of its header. A promise with no
   date joins with the date left blank, and the preview says how many did; no date is made up.
   If the table has columns neither layout writes, or a row holds fewer cells than its columns
   name, stop and say so; never guess which column is which. Only the queue's own table is
   rewritten: the person's writing below it, and any other table, stay as they are.
6. **Flattening headers.** On every page whose header has a `celorus:` block, or whose type
   is `account` or `call`, lift each detail out of the block to the top level, as
   `layout-1.md` and the scaffold describe. `account` becomes `firm`, and `call` becomes
   `conversation` with `channel: call`; a call's `lead` becomes `about: "[[<lead>]]"`, and
   its `commitments` leave the header, since step 5 put them in the queue. `slug` and `kind`
   are not lifted, because the file name and `type` already say them; a context page's
   `kind` becomes `context_kind`. The four nested blocks
   (`caps`, `roles`, `crm_fields`, `connectors`) flatten all the way down, as the scaffold's
   motion spec and seat file write them: `roles: {rm: {entry: x}}` is `role_rm_entry: x`.
   `citations` become `sources`: each citation's `ref` (or `url`) is its `resource`, and its
   other details stay beside it. A citation with neither is kept as the next line says.
   - A family named on a person becomes a guessed line under `## Connections`, never a link:
     `- member_of <the family's title> · guessed · yours · <as_of> · carried from layout 1,
     confirm`. The heading is added once.
   - A page of a kind that draws connections, as the model says, gains an empty
     `## Connections` heading if it has none.
   - A detail whose name is already taken with a different value, and a nested detail with no
     flat shape, goes under `## Kept by the update` word for word, as
     `- celorus.<name>: <value>`, the value written as JSON on one line. Nothing else is
     dropped.
   - A header line the update does not change is kept exactly as it was written.
7. **Repointing paths.** Every `accounts/<page>.md` and `calls/<page>.md` in any page now
   says `firms/` or `conversations/`, whatever the page is called and however deep it sits:
   step 1 moves `calls/old/A_Call.md` too, so the links to it move with it. A web address is
   the person's words, not a path on this desk, so anything holding `://` is left exactly as
   it was written, up to the next space or line break.
8. **Renaming words.** For each changes page newer than the desk, rename the words it lists
   on every page and in the desk's own words. If the new word is already one of the desk's
   own words, leave the pages alone, add the old word as an own word meaning the new one, and
   ask the person which meaning the desk keeps.
9. **Writing the model pages and settings.** Copy the plugin's model pages into `model/`
   (never the changes pages), the pack pages if the desk has a pack, any missing required
   page from `scaffold.md`, any missing Obsidian setting from `obsidian.md` exactly as it is
   written there, and any missing `.gitignore` line. Never overwrite a setting the person
   changed. When a setting is added, the preview says to shut Obsidian before saying yes, since
   Obsidian writes over its settings when it closes. The seat file is the person's to claim:
   the update never writes one.
10. **Stamping the versions.** Set `model_version`, and `pack` and `pack_version` when there
    is a pack, in `desk.md`.
11. **Rebuilding the views.** Only if something changed: write the views and the sent lists as
    `render_views` does.
12. **Logging the update.** Only if something changed: one line under today's heading,
    `* <time> · <handle> · install-desk · updated the desk to model version <N> · yours`.

## After

The answer names each file it changed in `changed`, and `model_version` is the version the desk
now stands at. Say its `summary`, and each of its `flags` in a sentence. If the desk is a git
repository, commit with the message `update to model version <N>`. Run `check-desk` and read
its list out. The update never deletes a page and never sends anything. If any step stops,
say which step and why in one sentence, and then what the stop says about the desk: when it
ends "Nothing was changed.", say the desk is as it was; when it names files the desk "has
already changed" (only an apply that stopped part-way on the desk itself does), name them as
it lists them, say what it says of `log.md` (that it records where the update stopped, or
that it could not be written), and never say the desk is as it was. Then say what would let it go on (for a page
in the way, move or rename one of the two, then say "update my desk" again; after a part-way
stop, the copy or commit taken before the update holds every page as it was). After a stop,
`check-desk` does not run.
