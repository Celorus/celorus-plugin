"use strict";
// 0.19.0, the base's ruling R72 (K4a, c/5849012621): the fields of an answer that carry the
// desk, pinned by name and by how many values of each carried it over one run of K4a's cases
// (tests/desk_engine/rel019_no_path_answers.test.js). K4h (the base's ruling R102,
// c/5856613653): moved into the engine from tests/desk_engine/r72_fields.js, which now reads them
// from here, so the door screen (lib/door.js) and the tests read ONE list, never a retyped one. An
// absolute path may ride only in one of these fields, and only as an extension of the desk the
// caller passed.
//
// A field is named `<tool> <pointer>`, the pointer as keyed() and itemed() below spell it: a key, a
// nested key after a dot, and `[]` for a list's items.

// The desk as nothing acts on it: the `desk` passed, or the folder's name.
const ROOT = ["check_desk root", "render_views root", "who_can_introduce root", "update_desk root", "merge_pages root", "undo_merge root"];
// A path the model acts on: a page to show, or the folder a git command runs in. The count is how
// many values of the field carried the desk over one run of K4a's cases.
const ACT_ON = {
  "render_views views[].path": 3,
  "who_can_introduce page": 2,
  "merge_pages kept[].path": 1,
  "merge_pages changed[].path": 2,
  "merge_pages record.path": 1,
  "merge_pages views[].path": 3,
  "merge_pages path_pages[].path": 2,
  "undo_merge record.path": 1,
  "undo_merge restored[].path": 3,
  "undo_merge views[].path": 3,
  "undo_merge path_pages[].path": 1,
  "render_view path": 1,
  "write_conversation path": 1,
  "log_action path": 1,
  "add_follow_up path": 1,
  "assign_lead path": 1,
  "write_brief path": 1,
  // 9: the six before, the upstream check before the pull (0.19.0 K1c), the branch check after
  // the commit (K1d), and the remote's refresh before the upstream check (K1e); 62 since K1j (R96): each
  // command names the desk once, by its -C; 69 since K1k (R101 (B)): the one seat-pages check is
  // four index checks and, with push asked, two counts, a pick and a read; 72 since K1l (R107 (a)):
  // the HEAD count's pick and the push url and push rewrite reads; 76 since K1l-b (R111 (b)): the
  // count of the commits the pull would bring in, its pick, and the push url and push rewrite
  // reads before the pull, each naming the desk by its -C alone; 80 since K1l-d (R116 (3)): the
  // same count, pick and two reads again after the pull, on HEAD
  "desk_sync commands[].argv[]": 80,
  "desk_sync commands[].shell": 80,
  "desk_sync held_back.argv[]": 1,
  "desk_sync held_back.shell": 1,
  "desk_sync on_pull_failure.argv[]": 1,
  "desk_sync on_pull_failure.shell": 1,
};
const PINNED = {
  "check_desk root": 2,
  "render_views root": 1,
  "who_can_introduce root": 2,
  "update_desk root": 1,
  "merge_pages root": 1,
  "undo_merge root": 1,
  ...ACT_ON,
};

// K4e (the base's ruling R90 (2)): the fields that carry the desk in answers the drives reach and
// K4a's cases do not, found by the drives' absolute mode (each value, in every answer, extends the
// desk passed). Each is a page the model acts on, as its pinned sibling is: a path page to show
// (merge_pages path_pages[].path), a sent list to show, the log page an undo could not put back.
// They are named here, never counted in PINNED, whose counts are K4a's run. K4f-1 (the base's
// ruling R94 (3), c/5855142880): pinned by name and by count, as R72 said, the count being
// how many values of the field extended the desk over one absolute pass of the drives
// (refusal_drives.js run's `carried`, read by the walk, rel019_door_walk.walk.js).
const ACT_ON_DRIVEN = {
  "render_views path_pages[].path": 74,
  "render_views sent_lists[].path": 4,
  "undo_merge log_not_put_back[].path": 1,
};
// Every field an absolute path may ride in (absolute mode), as an extension of the desk.
const NAMED = new Set([...Object.keys(PINNED), ...Object.keys(ACT_ON_DRIVEN)]);

// A pointer one step down: a key of an object, and a list's items. The door screen (lib/door.js)
// and the tests' reading of an answer's leaves (tests/desk_engine/r72_fields.js leaves) both step
// by these two.
const keyed = (at, key) => (at ? `${at}.${key}` : key);
const itemed = (at) => `${at}[]`;

module.exports = { ROOT, ACT_ON, PINNED, ACT_ON_DRIVEN, NAMED, keyed, itemed };
