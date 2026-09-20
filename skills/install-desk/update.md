# Updating a desk

Read this when the person says "update my desk", or says yes to the line day-open shows when
the plugin's model is newer than the desk's. The steps below run in this order. Each one
checks whether it is already done and skips if so, so a second run changes nothing.

## Before anything changes

1. If the desk folder is a git repository, say so and commit everything first with the
   message `before update`. If it is not, offer a dated copy of the whole folder beside it,
   named `<folder>-before-update-<YYYY-MM-DD>`, and make it on a yes. The copy sits beside the
   desk, not in it, so taking it changes nothing on the desk. If they say no, stop and say
   why: steps 3 and 4 write `index.md` and `log.md` afresh, and the copy is the only place
   their old text is kept.
2. Check every stop below before writing anything: a page already sitting where a page would
   move (step 1), a desk whose stamps would have to be made up (step 2), a missing `log.md` or
   follow-ups queue, a follow-ups table whose columns neither layout writes or a row that does
   not hold as many cells as its columns name, a promise in a call's header that does not say
   what was promised (step 5), and a model or changes page that cannot be read. If one
   applies, stop, name the step, and say the desk is as it was. A later step can still stop,
   on a page whose header cannot be read or a changes page that names a word nothing holds:
   what keeps the desk as it was then is item 3, working every change out on a copy first. So
   never skip it, and if a step ever stops on the desk itself, say which pages had already
   changed rather than that nothing did.
3. Work out every change on a scratch copy first, and show the person the preview: one plain
   line per kind of change, then "N files change. Nothing is deleted: X pages before, Y
   after.", then each thing they must decide, each starting "Decide:". If nothing would
   change, the preview is one line, "No file changes: the desk is already up to date.", and
   the update ends there: nothing else runs, not even `check-desk`, which would write views
   and a log line on a desk the person was just told nothing would change. Change nothing
   until they say yes.

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
    `check-desk` does.
12. **Logging the update.** Only if something changed: one line under today's heading,
    `* <time> · <handle> · install-desk · updated the desk to model version <N> · yours`.

## After

If the desk is a git repository, commit with the message `update to model version <N>`. Run
`check-desk` and read its list out. The update never deletes a page and never sends anything.
If any step stops, say which step and why in one sentence, say the desk is as it was, and say
what would let it go on (for a page in the way, move or rename one of the two, then say
"update my desk" again). After a stop, `check-desk` does not run.
