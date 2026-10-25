"use strict";
// The desk's sync table as the link holds it: each row a glob of a path from the seat's folder and
// its class (`shared`, `seat` or `overnight`), the first row that matches a path its class, as the
// engine's own table (engine/sync/sync.js TABLE, in its order) as the overnight's own commit reads
// it (`tableOf(true)`: a family, person or firm folder's row takes its pages alone, `*.md`; the
// base's word, c/6394834924 item 1). The link's seed sends from the
// seat's folder only a page a row keeps as `shared` or `overnight`: a page only this computer keeps
// (`seat`), and one no row names, never leave the laptop.
//
// The link's own copy, as data: what leaves the laptop is decided on the laptop, by the plugin
// version installed, never by a server's answer; and the link never loads the engine's sync
// module. tests/desk_engine/link_seed.test.js holds it equal to the engine's table as the
// overnight reads it, with the graph rows after its seat rows, each derived from the engine's row
// of the same kind folder (tests/desk_engine/graph_rows.js), and its matcher equal to that table's.
module.exports = Object.freeze([
  ["celorus/.views/**", "seat"],
  [".obsidian/**", "seat"],
  ["celorus/.obsidian/workspace*.json", "seat"],
  ["celorus/.obsidian/graph.json", "seat"],
  ["celorus/.obsidian/bookmarks.json", "seat"],
  ["celorus/.obsidian/app.json", "seat"],
  ["celorus/.obsidian/appearance.json", "seat"],
  ["celorus/.obsidian/snippets/**", "seat"],
  [".celorus/**", "seat"],
  ["**/.DS_Store", "seat"],
  // A seat's graph (layout 3, E10-B5, c/6393976583 rulings 1 and 3): a page sits in a part under its
  // layout 2 path, and keeps that path's class in both parts, as a page may move between them
  // (layout.js switchable). The CRM folder is personal whatever a page says (layout.js
  // PERSONAL_FOLDERS). A family, person or firm folder keeps its pages alone, *.md, as the
  // overnight's own commit reads its rows (sync.js NIGHTLY): an export beside them stays here.
  // team/ is the graph job's alone, in no row.
  ["celorus/shared/families/*.md", "overnight"],
  ["celorus/personal/families/*.md", "overnight"],
  ["celorus/shared/people/*.md", "overnight"],
  ["celorus/personal/people/*.md", "overnight"],
  ["celorus/shared/firms/*.md", "overnight"],
  ["celorus/personal/firms/*.md", "overnight"],
  ["celorus/shared/queues/*.md", "shared"],
  ["celorus/personal/queues/*.md", "shared"],
  ["celorus/shared/conversations/*.md", "shared"],
  ["celorus/personal/conversations/*.md", "shared"],
  ["celorus/shared/briefs/*.md", "shared"],
  ["celorus/personal/briefs/*.md", "shared"],
  ["celorus/shared/manner/*.md", "shared"],
  ["celorus/personal/manner/*.md", "shared"],
  ["celorus/shared/seats/*.md", "shared"],
  ["celorus/personal/seats/*.md", "shared"],
  ["celorus/shared/today/*.md", "shared"],
  ["celorus/personal/today/*.md", "shared"],
  ["celorus/shared/research/*.md", "shared"],
  ["celorus/personal/research/*.md", "shared"],
  ["celorus/shared/sent/*.md", "shared"],
  ["celorus/personal/sent/*.md", "shared"],
  ["celorus/shared/drafts/*.md", "shared"],
  ["celorus/personal/drafts/*.md", "shared"],
  ["celorus/shared/reviews/*.md", "shared"],
  ["celorus/personal/reviews/*.md", "shared"],
  ["celorus/personal/crm/README.md", "shared"],
  // Layout 2's rows, a graph's root pages among them. A family, person or firm folder keeps its
  // pages alone, as the overnight reads it: a file the converter puts beside them, the runner's
  // own (convert.js sharedByNoOne), never leaves the laptop.
  ["celorus/families/*.md", "overnight"],
  ["celorus/people/*.md", "overnight"],
  ["celorus/firms/*.md", "overnight"],
  ["celorus/merge-record.md", "overnight"],
  [".gitignore", "shared"],
  ["celorus/desk.md", "shared"],
  ["celorus/log.md", "shared"],
  ["celorus/desk-log.md", "shared"],
  ["celorus/scheduled.md", "shared"],
  ["celorus/index.md", "shared"],
  ["celorus/motion-spec.md", "shared"],
  ["celorus/register.md", "shared"],
  ["celorus/marks.md", "shared"],
  ["celorus/queues/*.md", "shared"],
  ["celorus/conversations/*.md", "shared"],
  ["celorus/briefs/*.md", "shared"],
  ["celorus/soul.md", "shared"],
  ["celorus/manner/*.md", "shared"],
  ["celorus/views/*.md", "shared"],
  ["celorus/merges/*/merge.md", "shared"],
  ["celorus/merges/*/before/*/*.md", "shared"],
  ["celorus/merges/*/after/*/*.md", "shared"],
  ["celorus/model/*.md", "shared"],
  ["celorus/context/*.md", "shared"],
  ["celorus/rules/*.md", "shared"],
  ["celorus/seats/*.md", "shared"],
  ["celorus/today/*.md", "shared"],
  ["celorus/research/*.md", "shared"],
  ["celorus/sent/*.md", "shared"],
  ["celorus/drafts/*.md", "shared"],
  ["celorus/reviews/*.md", "shared"],
  ["celorus/learnings/*.md", "shared"],
  ["celorus/learnings/themes/*.md", "shared"],
  ["celorus/crm/README.md", "shared"],
  ["celorus/.obsidian/core-plugins.json", "shared"],
  ["celorus/today/.gitkeep", "shared"],
  ["celorus/conversations/.gitkeep", "shared"],
  ["celorus/briefs/.gitkeep", "shared"],
  ["celorus/research/.gitkeep", "shared"],
  ["celorus/sent/.gitkeep", "shared"],
  ["celorus/learnings/.gitkeep", "shared"],
  ["celorus/learnings/themes/.gitkeep", "shared"],
  ["celorus/drafts/.gitkeep", "shared"],
  ["celorus/reviews/.gitkeep", "shared"],
  ["celorus/context/brand/.gitkeep", "shared"],
  ["celorus/signals/inbox/.gitkeep", "shared"],
  ["celorus/merges/.gitkeep", "shared"],
  ["celorus/views/.gitkeep", "shared"],
].map((row) => Object.freeze(row)));
