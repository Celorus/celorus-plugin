"use strict";
// The desk tools of the generated views, the merge and the update: render_views, merge_pages,
// undo_merge and update_desk. lib/tools.js lists them beside the check, so both doors serve
// them. Each checks the moment and the seat before it writes anything (house rule 6), and ends
// its change with a line in the desk's own log.md (house rule 5); a refusal changes nothing.

const fs = require("node:fs");
const path = require("node:path");
const { readDesk, PAGE_UNREAD } = require("../lib/desk.js");
const V = require("../check/values.js");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot, refuseLinkedFolders } = require("../lib/linkedroot.js");
const { pluginVersion } = require("../lib/version.js");
const { checkPages } = require("../check/rules.js");
const { ModelUnreadable, loadDeskModel } = require("../check/model.js");
const { renderViews, renderSentBlocks, sentBlocksAfter, VIEWS } = require("./views.js");
const { mergePages, undoMerge, octal, modesSaid } = require("../merge/merge.js");
const { previewUpdate, applyUpdate, UpdateStopped } = require("../update/update.js");
const H = require("../update/history.js");
const { pathPage } = require("../paths/index.js");
const { writePathPage, owned } = require("../paths/write.js");

// The registry's helpers, read when a tool runs: lib/tools.js lists these tools, so it is still
// loading when this file is.
function registry() {
  return require("../lib/tools.js");
}

const DESK = {
  type: "string",
  description:
    "The desk folder (the one holding celorus/index.md), as a full path. Leave it out to use " +
    "CELORUS_DESK, or the desk found above the working folder when this server knows it.",
};
const HANDLE = {
  type: "string",
  description:
    "The seat making this change: the file name of one of the desk's seat pages, as desk.md " +
    "lists it. The seat must be known before anything is written; a seat the desk does not " +
    "have is refused, naming the ones it does.",
};
const NOW = {
  type: "string",
  description:
    "The moment of the change, in ISO 8601 with a T between the date and the time and the " +
    "local offset, as 2026-09-03T10:00:00+05:30. Leave it out to use this machine's clock.",
};

// The desk, its reading, and the moment and seat of a change, each checked before any write.
// The desk folder is resolved through any link once, here at the door, so every path a tool
// compares is a resolved one.
function change(tool, args, allowed) {
  const { deskFor, onlyArguments } = registry();
  onlyArguments(tool, args, allowed);
  const moment = H.momentOf(args.now);
  const desk = fs.realpathSync(deskFor(args.desk, { writes: true }));
  // A celorus/, celorus/views/ or celorus/log.md that is a link is refused here, before anything
  // is read for writing (lib/linkedroot.js).
  refuseLinkedRoot(desk);
  const read = readDesk(desk);
  const seats = H.seatsOf(checkPages(read.pages), read.stamps || null);
  const handle = H.heldSeat(args.handle, seats);
  // celorus/ resolved too, as the merge resolves it: every write checks that its folder is the
  // one it was given.
  let celorus = path.join(read.root, "celorus");
  try {
    celorus = fs.realpathSync(celorus);
  } catch {
    // A desk with no celorus/ folder is refused by the tool that needs one.
  }
  return { read, root: read.root, celorus, moment, handle };
}

function unreadableModel(err) {
  return `${err.message} cannot be read, so the views are not rebuilt. check-desk lists it.`;
}

// Runs a tool's writes. `already` lists what the tool had changed before them, and `fn` pushes
// each path it writes onto the list it is given. Any stop at a write (a folder swapped for a
// link, a page that cannot be written, or any other error) ends them there, refusing with
// exactly what had changed, desk-relative paths and error codes only; a page a failed write may
// have left incomplete is listed too, and its previous text ends the answer. A refusal of the
// tool's own (a path page's, say) after a write says the same, never that nothing was changed.
// `log`, when given, writes the change's line in log.md: after `fn`, and at a stop after a write
// too (house rule 5), which the answer then says.
function guarded(celorus, already, fn, log = null) {
  const wrote = [];
  let done;
  try {
    done = fn(wrote);
  } catch (err) {
    throw stopSaid(celorus, [...already, ...wrote], err, log);
  }
  if (log === null) return done;
  try {
    return [done, log()];
  } catch (err) {
    const refusal = stopSaid(celorus, [...already, ...wrote], err, null);
    // log.md written with the line, then not closed: the change is logged, and the answer says so.
    if (err instanceof H.NotClosed) H.sayBeforeTail(refusal, " Logged the change in log.md.");
    throw refusal;
  }
}

// A path page's refusal that left the page maybe incomplete (paths/write.js): the page's previous
// text, which the refusal ends with as its tail, after a blank line. Null for any other refusal.
function tornPage(err) {
  return err instanceof Refusal && typeof err.tail === "string" && err.tail.startsWith("\n\n") && err.message.endsWith(err.tail)
    ? err.tail.slice(2)
    : null;
}

// The refusal of a stop inside guarded, `changed` being what had changed before it.
function stopSaid(celorus, changed, err, log) {
  let refusal;
  let all;
  let left = [];
  if (err instanceof Refusal) {
    // A path page left maybe incomplete (writeViews marks it with `rel`) is changed too, and its
    // previous text is carried as an item of its own, as update_desk carries it.
    const previous = typeof err.rel === "string" ? tornPage(err) : null;
    const torn = previous === null ? [] : [err.rel];
    if (!changed.length && !torn.length) return err;
    refusal = err;
    all = [...changed, ...torn];
    if (previous !== null) refusal.previous_text = previous;
    // Its own words say nothing was changed, as they are for a call it stops first; here a write
    // came before it, so the answer says what was instead.
    const tail = typeof err.tail === "string" && err.message.endsWith(err.tail) ? err.tail : "";
    const body = err.message.slice(0, err.message.length - tail.length);
    const nothing = ` ${H.NOTHING}`;
    if (body.endsWith(nothing)) err.message = body.slice(0, -nothing.length) + tail;
    H.sayBeforeTail(err, ` Already changed: ${all.join(", ")}.`);
  } else {
    const rel = err instanceof H.NotOwnFolder ? path.relative(celorus, err.file).split(path.sep).join("/") : null;
    const said = rel === null ? `A write stopped (${H.codeOf(err)})` : err.told(rel);
    // What the up-front check left behind (a probe's spare, a folder it made) is changed too.
    left = rel === null ? [] : err.leftBehind().map((abs) => err.shown(abs, rel));
    // A page left maybe incomplete, or written and then not closed (NotClosed), is changed too.
    const also = H.previousTail(err, rel) || err instanceof H.NotClosed ? [rel] : [];
    all = [...changed, ...also, ...left];
    refusal = new Refusal(
      `${said}, so nothing more was written. ` + (all.length ? `Already changed: ${all.join(", ")}.` : H.NOTHING),
    );
    H.endWithTail(refusal, H.previousTail(err, rel));
    if (H.previousTail(err, rel)) refusal.previous_text = err.previous;
  }
  // What the call itself had written, before what the up-front check left behind.
  if (log !== null && all.length) loggedAtStop(refusal, log, all.slice(0, all.length - left.length));
  return refusal;
}

// The change's log line written at a stop after a write, and said in `refusal`, before any
// previous text that ends it: log.md is never left without a line for a change made. `changed`
// is what the call had written, paths under celorus/ (a folder with its trailing slash): when it
// holds no page, only a folder the up-front check made, the change was not made, so no line is
// written, and the answer says so.
function loggedAtStop(refusal, log, changed) {
  if (!changed.some((rel) => !rel.endsWith("/"))) {
    H.sayBeforeTail(refusal, " No page was written, so log.md was not written.");
    return;
  }
  try {
    log();
    H.sayBeforeTail(refusal, " Logged the change in log.md.");
  } catch (err) {
    if (err instanceof H.NotClosed) {
      H.sayBeforeTail(refusal, ` Logged the change in log.md, but log.md could not be closed (${err.code}).`);
    } else if (typeof err.previous === "string") {
      H.sayBeforeTail(refusal, " log.md may be incomplete; its previous text is in the answer.");
      H.endWithTail(refusal, H.previousTail(err, "log.md"));
      refusal.log_previous_text = err.previous;
    } else {
      H.sayBeforeTail(refusal, ` log.md could not be written to say so (${H.codeOf(err)}).`);
    }
  }
}

// The change's log line at a stop the merge or the undo met at one of its own page writes
// (merge/merge.js writing), before guarded runs: as loggedAtStop writes it, unless the page that
// stop left maybe incomplete (`torn`) is log.md itself, which is then not written over again.
function logAtStop(log) {
  return (refusal, torn, changed) => {
    if (torn === "log.md") H.sayBeforeTail(refusal, " log.md may be incomplete, so the change's line was not written in it.");
    else loggedAtStop(refusal, log, changed);
  };
}

// Paths under celorus/ as the files a tool writes.
function filesOf(celorus, rels) {
  return rels.map((rel) => path.join(celorus, ...rel.split("/")));
}

// The pages writeViews rewrites in place, then log.md, which every tool here writes last, as
// paths under celorus/: the three views and each sent list in `sentRels`. The one list both
// writeViews' own check and the up-front check of merge_pages and undo_merge (viewsAfterChange)
// are read from.
function viewRewrites(sentRels) {
  return [...VIEWS.map((name) => `views/${name}`), ...sentRels, "log.md"];
}

// For merge_pages and undo_merge (their `after`): the pages the views rebuilt after the change
// and its log line rewrite, read off the desk as the change will leave it, so they are checked
// with the change's own pages before its first write. The path pages join them as render_views
// asks them (writeViews), before log.md: every entry pathPagesOf would refuse or ask, and every
// path page it may rewrite, since a change to any page can change what any path page says; one
// whose header does not name who_can_introduce as its writer is refused there, before the first
// write. pathPagesOf is asked whatever the model, since viewsAfter asks it again after the
// change's own writes: its refusal of such a page, and each entry it asks, stop the change here
// even when the model cannot be read. A model that cannot be read leaves the views, the sent
// lists and the path pages unwritten (viewsAfter), so then those entries and log.md.
function viewsAfterChange(celorus, tool) {
  return (read, written, removed) => {
    const paths = pathPagesOf(read, celorus, null, tool);
    try {
      loadDeskModel(celorus);
    } catch (err) {
      if (!(err instanceof ModelUnreadable)) throw err;
      return [...paths.ask, "log.md"];
    }
    const rewrites = viewRewrites(Object.keys(sentBlocksAfter(read, written, removed)));
    return [...rewrites.slice(0, -1), ...paths.ask, ...paths.all, ...rewrites.slice(-1)];
  };
}

// A path page's file name under views/, as who_can_introduce names it (paths/index.js).
const PATH_PAGE = /^path-to-.+\.md$/u;

// The path pages render_views rebuilds (the base's ruling R9, row 1.1 as R37 corrects it): each
// views/path-to-*.md already on the desk, from the `path_to` its header names, as the checker's
// oracle rebuilt them; an absent path page is never written. Worked out before any write, from
// the desk as the call found it (`read`), with who_can_introduce's own page (pathPage) and at the
// call's moment, so each is byte for byte the page that tool writes for that target then.
// - `rebuild`: { rel, text } for each page whose text changes; `same`: each page already current,
//   left as it is.
// - `ask`: each entry that is not a plain file (a link, a folder, a pipe), or that the reader
//   could not read: it goes into the up-front check with the pages to write, which refuses it
//   by name before the first write.
// - `all`: every plain path page `rebuild` or `same` holds, by its rel.
// A plain page whose header names no `path_to` is left alone, as the oracle left it. One whose
// header names a `path_to` but not who_can_introduce as its writer is refused here, since that
// tool never writes over a page it did not write (paths/write.js); the refusal names `tool`, the
// call it stops. With `moment` null no page is worked out: `ask` and `all` alone, for a change's
// up-front check before the change is made (viewsAfterChange).
function pathPagesOf(read, celorus, moment, tool = "render_views") {
  const dir = path.join(celorus, "views");
  const out = { rebuild: [], same: [], ask: [], all: [] };
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return out; // no views folder yet: no path page to rebuild; the up-front check makes it
  }
  const byRel = new Map(read.pages.map((page) => [page.rel, page]));
  for (const name of names.filter((n) => PATH_PAGE.test(n)).sort()) {
    const rel = `views/${name}`;
    const file = path.join(dir, name);
    let st;
    try {
      st = fs.lstatSync(file);
    } catch {
      out.ask.push(rel);
      continue;
    }
    const page = byRel.get(rel);
    if (!st.isFile() || !page || page.problem === PAGE_UNREAD) {
      out.ask.push(rel);
      continue;
    }
    // As the oracle read it: `path_to` when the header is a mapping and the value is true to
    // Python, as Python's str() writes it.
    const target = V.isMapping(page.head) ? page.head.path_to : undefined;
    if (!V.truthy(target)) continue;
    const bytes = fs.readFileSync(file);
    if (!owned(bytes)) {
      throw new Refusal(
        `${rel} is on the desk and its header does not say generated_by: celorus-plugin <version> ` +
          `who_can_introduce, so ${tool} did not write over it. Move or rename that page, then ask ` +
          `again. ${H.NOTHING}`,
      );
    }
    out.all.push(rel);
    if (moment === null) continue;
    const text = pathPage(read, V.show(target), moment).text;
    if (Buffer.from(text, "utf8").equals(bytes)) out.same.push(rel);
    else out.rebuild.push({ rel, text });
  }
  return out;
}

// Writes the three views and the sent lists, then the path pages in `paths` (pathPagesOf, for
// render_views and, through viewsAfter, for a merge and an undo), pushing each onto `wrote`.
// Returns what was written, as paths under celorus/. Every page it will rewrite, and log.md
// after it, is opened first (H.ahead over viewRewrites, the path pages with them), so a page
// that cannot be written stops it before its first write; a folder that check made (views/, when it was not there) is pushed onto `wrote`
// first, so a later stop names it. A path page is written by who_can_introduce's own writer
// (paths/write.js); a stop there is named with what was already changed by guarded, which every
// caller runs this in.
function writeViews(celorus, root, moment, wrote = [], paths = { rebuild: [], ask: [] }) {
  const built = renderViews(root, moment);
  const sent = renderSentBlocks(root);
  const rewrites = viewRewrites(Object.keys(sent));
  const upFront = [...rewrites.slice(0, -1), ...paths.ask, ...paths.rebuild.map((p) => p.rel), ...rewrites.slice(-1)];
  // A page it writes under a folder inside celorus/ that is a link refuses the call first, in the
  // linked root's words (lib/linkedroot.js).
  refuseLinkedFolders(celorus, upFront);
  for (const dir of H.ahead(H.asThemselves(filesOf(celorus, upFront)))) {
    wrote.push(H.folderShown(path.relative(celorus, dir).split(path.sep).join("/")));
  }
  for (const name of VIEWS) {
    H.writePage(path.join(celorus, "views", name), built.views[name]);
    wrote.push(`views/${name}`);
  }
  for (const [rel, text] of Object.entries(sent)) {
    H.writePage(path.join(celorus, ...rel.split("/")), text);
    wrote.push(rel);
  }
  for (const { rel, text } of paths.rebuild) {
    try {
      writePathPage(root, `celorus/${rel}`, text);
    } catch (err) {
      // A path page the write may have left incomplete: its refusal ends with the page's previous
      // text (paths/write.js, its tail), and the stop names the page as changed (stopSaid).
      if (tornPage(err) !== null) err.rel = rel;
      throw err;
    }
    wrote.push(rel);
  }
  return {
    views: VIEWS.map((name) => `views/${name}`),
    sent: Object.keys(sent),
    paths: paths.rebuild.map((p) => p.rel),
    findings: built.findings,
    citations: built.citations,
  };
}

// The views after a merge or an undo: rebuilt with every path page, as render_views rebuilds
// them, from the desk as the change left it (read again here, after the change's own writes), or
// the one sentence that says why not. Its entries were asked before the change's first write
// (viewsAfterChange); writeViews asks the ones it writes again.
function viewsAfter(celorus, root, moment, wrote, tool) {
  try {
    const paths = pathPagesOf(readDesk(root), celorus, moment, tool);
    return { ...writeViews(celorus, root, moment, wrote, paths), not_rebuilt: null };
  } catch (err) {
    if (!(err instanceof ModelUnreadable)) throw err;
    return { views: [], sent: [], paths: [], not_rebuilt: unreadableModel(err) };
  }
}

// The path pages a change rebuilt, named, as a sentence of its answer; nothing when none.
function pathPagesSaid(rels) {
  if (!rels.length) return "";
  const them = rels.length === 1 ? "it" : "them";
  return `Rebuilt ${plural(rels.length, "path page", "path pages")} as who_can_introduce writes ${them}: ${rels.join(", ")}. `;
}

function withPaths(celorus, rels) {
  return rels.map((rel) => ({ page: rel, path: path.join(celorus, ...rel.split("/")) }));
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function renderViewsTool(args = {}) {
  const c = change("render_views", args, ["desk", "handle", "now"]);
  let same = [];
  // The log line goes through guarded, so a stop after the first view is written logs it too.
  const [wrote, logged] = guarded(
    c.celorus,
    [],
    (so) => {
      try {
        const paths = pathPagesOf(c.read, c.celorus, c.moment);
        same = paths.same;
        return writeViews(c.celorus, c.root, c.moment, so, paths);
      } catch (err) {
        if (err instanceof ModelUnreadable) throw new Refusal(`${unreadableModel(err)} ${H.NOTHING}`);
        throw err;
      }
    },
    () => H.logChange(c.celorus, c.moment, c.handle, "check-desk", "wrote views"),
  );
  const cited = wrote.citations;
  const rebuilt = wrote.paths.length
    ? ` Rebuilt ${plural(wrote.paths.length, "path page", "path pages")} as who_can_introduce writes ${wrote.paths.length === 1 ? "it" : "them"}.`
    : "";
  const current = same.length
    ? ` ${plural(same.length, "path page was", "path pages were")} already current and left as ${same.length === 1 ? "it was" : "they were"}.`
    : "";
  return {
    tool: "render_views",
    plugin_version: pluginVersion(),
    root: c.root,
    views: withPaths(c.celorus, wrote.views),
    sent_lists: withPaths(c.celorus, wrote.sent),
    path_pages: withPaths(c.celorus, wrote.paths),
    path_pages_unchanged: withPaths(c.celorus, same),
    findings: wrote.findings,
    citations_checked: cited.checked,
    citations_not_checked: cited.notChecked,
    logged,
    summary:
      `Wrote the three views, and rewrote ${plural(wrote.sent.length, "sent list", "sent lists")} that changed; ` +
      `needs-attention holds ${plural(wrote.findings, "row", "rows")}.` +
      (cited.notChecked
        ? ` ${plural(cited.notChecked, "citation names", "citations name")} a file at a commit, ` +
          "which the check does not read yet, so they were not checked."
        : "") +
      rebuilt +
      current +
      " Logged the change in log.md.",
  };
}

function mergePagesTool(args = {}) {
  const c = change("merge_pages", args, ["desk", "keep", "merge", "handle", "now"]);
  for (const key of ["keep", "merge"]) {
    if (typeof args[key] !== "string" || !args[key]) {
      throw new Refusal(`${key} is the file name of a page on the desk, without .md, as text. ${H.NOTHING}`);
    }
  }
  const log = () => H.logChange(c.celorus, c.moment, c.handle, "check-desk", `merged ${args.merge} into ${args.keep}`);
  const done = mergePages(c.root, args.keep, args.merge, c.moment, {
    sent: true,
    after: viewsAfterChange(c.celorus, "merge_pages"),
    atStop: logAtStop(log),
  });
  if (done.alreadyMerged) {
    return {
      tool: "merge_pages",
      plugin_version: pluginVersion(),
      root: c.root,
      already_merged: true,
      summary: `${args.merge} was merged already, as a record under merges/ says. ${H.NOTHING}`,
    };
  }
  const [views, logged] = guarded(
    c.celorus,
    done.wrote,
    (so) => viewsAfter(c.celorus, c.root, c.moment, so, "merge_pages"),
    log,
  );
  return {
    tool: "merge_pages",
    plugin_version: pluginVersion(),
    root: c.root,
    already_merged: false,
    kept: withPaths(c.celorus, [done.changed.find((rel) => path.posix.basename(rel, ".md") === args.keep)].filter(Boolean)),
    changed: withPaths(c.celorus, done.changed),
    removed: done.removed,
    record: withPaths(c.celorus, [done.record])[0],
    still_named: done.stillNamed,
    points_at_itself: done.pointsAtItself,
    named_only_holds_details: done.namedOnlyHoldsDetails,
    views: withPaths(c.celorus, views.views),
    path_pages: withPaths(c.celorus, views.paths),
    views_not_rebuilt: views.not_rebuilt,
    logged,
    summary:
      `Merged ${args.merge} into ${args.keep}: ${plural(done.changed.length, "page changed", "pages changed")}, ` +
      `${done.removed} removed, the record at ${done.record}. ` +
      (views.not_rebuilt || `The views are rebuilt. ${pathPagesSaid(views.paths)}`) +
      "Logged the change in log.md.",
  };
}

// What an undo did to log.md, said whole: never left out of the answer.
function logSaid(log) {
  if (log === null || (!log.back && !log.notBack.length)) return "The merge rewrote no line of log.md. ";
  const said = [];
  if (log.back) {
    said.push(
      `Put back the ${plural(log.back, "line", "lines")} of log.md the merge rewrote, and kept every line logged since.`,
    );
  }
  for (const when of log.notBack) {
    said.push(`This log line was not put back: log.md at ${when}: could not tell which line the merge wrote.`);
  }
  return `${said.join(" ")} `;
}

function undoMergeTool(args = {}) {
  const c = change("undo_merge", args, ["desk", "record", "kept", "merged", "handle", "now"]);
  for (const key of ["record", "kept", "merged"]) {
    if (args[key] !== undefined && args[key] !== null && typeof args[key] !== "string") {
      throw new Refusal(`${key} is text. ${H.NOTHING}`);
    }
  }
  // The views and the log line run inside the undo, before its last step puts back the mode of
  // each page it made again (merge/merge.js); a stop at the undo's own page writes logs it too.
  const log = ({ kept, merged }) => () =>
    H.logChange(c.celorus, c.moment, c.handle, "check-desk", `undid the merge of ${merged} into ${kept}`);
  const done = undoMerge(c.root, { record: args.record, kept: args.kept, merged: args.merged }, c.moment, {
    after: viewsAfterChange(c.celorus, "undo_merge"),
    rest: (wrote, names) => guarded(c.celorus, wrote, (so) => viewsAfter(c.celorus, c.root, c.moment, so, "undo_merge"), log(names)),
    atStop: (refusal, torn, changed, names) => logAtStop(log(names))(refusal, torn, changed),
  });
  const notBack = done.log === null ? [] : done.log.notBack;
  const [views, logged] = done.rest;
  return {
    tool: "undo_merge",
    plugin_version: pluginVersion(),
    root: c.root,
    record: withPaths(c.celorus, [done.record])[0],
    restored: withPaths(c.celorus, done.restored),
    log_not_put_back: notBack.map((when) => ({ ...withPaths(c.celorus, ["log.md"])[0], logged: when })),
    views: withPaths(c.celorus, views.views),
    path_pages: withPaths(c.celorus, views.paths),
    views_not_rebuilt: views.not_rebuilt,
    modes_not_set: done.modesNotSet.map(({ rel, mode }) => ({ page: rel, mode: octal(mode) })),
    logged,
    summary:
      `Put back ${plural(done.restored.length, "page", "pages")} from ${done.record}, and marked it undone. ` +
      logSaid(done.log) +
      (views.not_rebuilt || `The views are rebuilt. ${pathPagesSaid(views.paths)}`) +
      "Logged the change in log.md." +
      modesSaid(done.modesNotSet),
  };
}

// The update's own stop, said whole: a stop that changed nothing says so; one that came after
// a write already names what changed (update/update.js), and never says nothing did.
function updating(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof UpdateStopped && Array.isArray(err.changed) && !err.changed.length) {
      // Before a previous text, which ends the answer whole when there is one.
      const tail = typeof err.tail === "string" && err.message.endsWith(err.tail) ? err.tail : "";
      const words = err.message.slice(0, err.message.length - tail.length);
      // A sentence of its own: the stop's words end with a full stop before it.
      const refusal = new Refusal(`${words}${/[.!?]$/u.test(words) ? "" : "."} ${H.NOTHING}`);
      if (typeof err.previous_text === "string") refusal.previous_text = err.previous_text;
      throw H.endWithTail(refusal, tail);
    }
    throw err;
  }
}

function updateDeskTool(args = {}) {
  const c = change("update_desk", args, ["desk", "handle", "now", "apply", "plan"]);
  if (args.apply !== undefined && typeof args.apply !== "boolean") {
    throw new Refusal(`apply is true or false: false (or left out) previews the update on a copy. ${H.NOTHING}`);
  }
  const opts = { today: c.moment.slice(0, 10), now: c.moment, time: c.moment.slice(11, 16), handle: c.handle };
  if (!args.apply) {
    const p = updating(() => previewUpdate(c.root, opts));
    return {
      tool: "update_desk",
      plugin_version: pluginVersion(),
      root: c.root,
      applied: false,
      preview: p.text,
      plan: p.plan,
      changed: p.changed,
      flags: p.flags,
      pages_before: p.pagesBefore,
      pages_after: p.pagesAfter,
      summary: p.changed.length
        ? "This is a preview on a copy; the desk is unchanged. Show the preview, and on yes call " +
          "update_desk again with apply true and this plan."
        : "The desk is already up to date; nothing was changed.",
    };
  }
  if (typeof args.plan !== "string" || !args.plan) {
    throw new Refusal(
      "apply true needs plan, the digest the preview returned: call update_desk with apply left " +
        `out, show its preview, and on yes pass that preview's plan with apply true. ${H.NOTHING}`,
    );
  }
  const r = updating(() => applyUpdate(c.root, { ...opts, plan: args.plan }));
  return {
    tool: "update_desk",
    plugin_version: pluginVersion(),
    root: c.root,
    applied: true,
    changed: r.changed,
    flags: r.flags,
    notes: r.notes,
    left_in_place: r.leftInPlace,
    model_version: r.target,
    summary:
      (r.changed.length
        ? `Updated the desk to model version ${r.target}: ${plural(r.changed.length, "file changed", "files changed")}, and logged in log.md.`
        : "The desk is already up to date; nothing was changed.") + r.leftInPlace.map((said) => ` ${said}`).join(""),
  };
}

// A spare file as an answer names it: its path under `base`, or, for one outside it (a spare in
// update_desk's scratch copy of the desk, in the engine's working folder), its file name alone,
// never a path into that folder, which is gone when the answer is read. `inside` says which.
function spareShown(base, file) {
  const rel = path.relative(base, file);
  const inside = rel !== "" && rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel);
  return { inside, shown: inside ? rel.split(path.sep).join("/") : path.basename(file) };
}

// A spare file a write could not remove (history.js takeSparesLeft), as a sentence of the
// answer: named under `base` (celorus/, or the desk for update_desk). `pagesRight` is false in a
// refusal that says a page may be incomplete, which the sentence never contradicts.
function sparesSaid(base, spares, pagesRight = true) {
  const ending = pagesRight ? "; the pages are right." : ".";
  return spares
    .map((file) => {
      const { inside, shown } = spareShown(base, file);
      return inside
        ? ` The spare file ${shown} could not be removed and was left in place${ending}`
        : ` The spare file ${shown} in the engine's working folder could not be removed.`;
    })
    .join("");
}

// Whether refusal `err` carries a page's previous text: a page it says may be incomplete.
function carriesPrevious(err) {
  return typeof err.previous_text === "string" || typeof err.log_previous_text === "string";
}

// Runs a tool so that its answer, or its refusal, names each spare file its writes left.
function namingSpares(run, deskLevel) {
  return (args = {}) => {
    H.takeSparesLeft();
    const base = () => {
      const desk = fs.realpathSync(registry().deskFor(args.desk, { writes: true }));
      if (deskLevel) return desk;
      try {
        return fs.realpathSync(path.join(desk, "celorus"));
      } catch {
        return path.join(desk, "celorus");
      }
    };
    let out;
    try {
      out = run(args);
    } catch (err) {
      const spares = H.takeSparesLeft();
      // Before a page's previous text, which ends the answer whole when there is one.
      if (spares.length && err instanceof Refusal) H.sayBeforeTail(err, sparesSaid(base(), spares, !carriesPrevious(err)));
      throw err;
    }
    const spares = H.takeSparesLeft();
    if (spares.length) {
      out.spares_left = spares.map((file) => {
        const { inside, shown } = spareShown(base(), file);
        return inside ? shown : `${shown} (in the engine's working folder)`;
      });
      out.summary += sparesSaid(base(), spares);
    }
    return out;
  };
}

const TOOLS = [
  {
    name: "render_views",
    description:
      "Rebuild the desk's three generated views under celorus/views/ (pipeline, who-knows-whom, " +
      "needs-attention from a whole-desk check) and the generated sent list on each person, firm " +
      "and family page, and each path page already under celorus/views/ (path-to-<file name>.md) " +
      "as who_can_introduce writes it, then log the change. Returns each page's path to show it " +
      "from. An absent path page is not written.",
    inputSchema: {
      type: "object",
      properties: { desk: DESK, handle: HANDLE, now: NOW },
      required: ["handle"],
      additionalProperties: false,
    },
    run: namingSpares(renderViewsTool, false),
  },
  {
    name: "merge_pages",
    description:
      "Merge page `merge` into page `keep` (two pages of one kind): the record under " +
      "celorus/merges/ is written first, links are repointed, the other page is removed last, " +
      "the views are rebuilt and the change logged. Returns what the merge could not put right " +
      "(still_named, points_at_itself, named_only_holds_details). Refuses, changing nothing, a " +
      "merge that would be wrong or could not be undone.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        keep: { type: "string", description: "The file name, without .md, of the page that stays." },
        merge: { type: "string", description: "The file name, without .md, of the page merged into it." },
        handle: HANDLE,
        now: NOW,
      },
      required: ["keep", "merge", "handle"],
      additionalProperties: false,
    },
    run: namingSpares(mergePagesTool, false),
  },
  {
    name: "undo_merge",
    description:
      "Undo a merge from its record under celorus/merges/: the record named, or the newest " +
      "standing record of the pair named by kept and merged, or the newest standing record. " +
      "Puts back every page it changed and the removed page, marks the record undone, rebuilds " +
      "the views and logs the change; refuses, changing nothing, when a page changed since.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        record: { type: "string", description: "The record's folder name under celorus/merges/." },
        kept: { type: "string", description: "The kept page's file name, to find its newest record." },
        merged: { type: "string", description: "The merged page's file name, to find its newest record." },
        handle: HANDLE,
        now: NOW,
      },
      required: ["handle"],
      additionalProperties: false,
    },
    run: namingSpares(undoMergeTool, false),
  },
  {
    name: "update_desk",
    description:
      "Move the desk to the newest layout and model version in twelve steps, as install-desk's " +
      "update.md says. With apply false (the default) it previews on a copy, changes nothing, " +
      "and returns the plan's digest; with apply true and that plan it updates the desk and " +
      "logs the change, and refuses, changing nothing, when the desk no longer gives that plan. " +
      "It never deletes a page, never writes through a link, and stops naming the step before a " +
      "move would overwrite or a value be made up; a stop after a write names what changed.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        handle: HANDLE,
        now: NOW,
        apply: { type: "boolean", description: "True updates the desk; false or left out previews on a copy." },
        plan: {
          type: "string",
          description: "With apply true: the plan the preview returned, the one the person said yes to.",
        },
      },
      required: ["handle"],
      additionalProperties: false,
    },
    run: namingSpares(updateDeskTool, true),
  },
];

module.exports = { TOOLS, pathPagesOf };
