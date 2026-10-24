"use strict";
// The converter (gtm design, Addendum 19 section 6; slice E6b): it takes a desk from layout 2, one
// folder every seat shares, to layout 3, a graph per seat and the firm's common space beside them
// (engine/layout/layout.js). It is an update path, on update_desk's contract (engine/update): a
// preview first, which writes nothing and returns a plan; then one yes, an apply that derives the
// plan again and refuses one that moved; a dated copy of the whole desk before its first write;
// nothing deleted, read off the disk after the writes; and a second run writes nothing.
//
// It builds beside the desk and never writes in it, except the one line the switch writes in its
// desk.md (`converted: <date>`), after which every writer refuses that desk (lib/tools.js). Pages
// are placed as they are, byte for byte, except a pointer by path into the old desk's own folders,
// re-pointed to where that page now is. It never guesses: a page that names no seat is asked at the
// preview, and the apply refuses until it is answered.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { readDesk, readPage, readCommon, hiddenName } = require("../lib/desk.js");
// A page of the desk, as its reader takes pages: a .md file under no hidden name (lib/desk.js
// hiddenName). A .md file under one, Obsidian's bin among them, is a file like any other.
const isPage = (rel) => rel.endsWith(".md") && !rel.split("/").some(hiddenName);
const { linksIn, hasLink } = require("../check/text.js");
const { deskMd, seatsOf: declaredSeats } = require("../write/facts.js");
const { writePage, makeFolders, NotOwnFolder } = require("../update/history.js");
const { sha256 } = require("../update/digest.js");
const { PLUGIN_MODEL } = require("../update/update.js");
const L = require("../layout/layout.js");
const { tableOf: syncTable } = require("../sync/sync.js");
const { parseHeader } = require("../lib/header.js");
const { MERGE_RECORD } = require("../overnight/overnight.js");
const { renderViews, sentBlocksAfter, VIEWS } = require("../views/views.js");
const { ModelUnreadable } = require("../check/model.js");
const { Desk, unlink } = require("../render/desk.js");
const { suppliedSeat } = require("../render/counts.js");

// The steps, in order: a stop names the one it stopped in.
const STEPS = [
  "reading the desk",
  "checking the targets",
  "making the dated copy",
  "recording the plan",
  "writing the graphs",
  "writing the common space",
  "checking nothing is deleted",
  "switching",
];
// The record of what the converter wrote, in the firm folder: each file's path under it and the
// sha256 of the bytes it wrote. A file whose bytes still equal its record is the converter's own and
// unchanged; any other file at a target is a hand change or a page it did not write, and refused.
const RECORD = "conversion.json";
// Desk-wide pages and folders, by their path under celorus/, are placed whole in the common space
// (layout.js COMMON_PAGES and COMMON_FOLDERS, the one list the graph reader reads them by).
const { isCommon } = L;
// Files each graph is given as generated copies of the old desk's (`rules/`, `model/`,
// `.obsidian/`).
const GENERATED = ["model/", "rules/", ".obsidian/"];
// A file under celorus/, not a page, that the writers' table (sync/sync.js) shares with no one, in
// no row or in a seat's own (Obsidian's settings but which plugins are on, a file a page names, a
// CRM export): it is on the runner's machine alone, as a file outside celorus/ is, so it goes into
// the runner's graph alone, never another seat's or the common space (the base's ruling,
// c/6169137770 item 5, after c/6167970275). The table is read as the overnight's own commit stages
// it (sync.js tableOf(true)), the widest any commit shares: the family, person and firm rows hold
// their pages alone, so any other file under those folders is no one's to share.
const sharedByNoOne = (rel) => {
  const row = syncTable(true).find((one) => one.pattern.test(`celorus/${rel}`)) || null;
  return row === null || row.cls === "seat";
};
const runnersOwn = (rel) => !isPage(rel) && sharedByNoOne(rel);
// A page the table shares with no one (one in signals/inbox/, one in crm/ but its README, one in
// context/brand/, one a folder deeper than its page row): the rule reaches pages (the base's ruling
// A2, c/6169769956). It goes into the runner's graph alone, in its personal part, whatever
// seat it names; never into another seat's graph, the common space or the name list.
const runnersOwnPage = (rel) => isPage(rel) && sharedByNoOne(rel);
// The tables split by the column that names a row's seat, each row kept whole and each table at
// the graph's root: the marks, the desk log and the register of routines, a routine by the seat
// that set it up (the base's ruling K11: scheduled.md sits at the graph's root).
const BY_SEAT = ["marks.md", "desk-log.md", "scheduled.md"];
const seatColumn = (rel) => (rel === "scheduled.md" ? "set_up_by" : "seat");
const FOLLOW_UPS = "queues/follow-ups.md";
const BOOK = "queues/book.md";
const SUPPLIED = "queues/supplied.md";
// What stays in the old desk and is never placed: its stamps and index (each graph gets its own),
// its log (each graph and the common space begin their own), the views (drawn again from each
// graph), the merge records (the old desk's history) and a seat's render cache.
const STAYS = (rel) =>
  rel === "desk.md" || rel === "index.md" || rel === "log.md" || /^(views|merges|\.views)\//u.test(rel);
// The kinds placed by link, and the kinds the name list holds with the seat pages (section 6).
const WORLD = new Set(["person", "family", "firm"]);
const MADE = new Set(["brief", "research", "review", "sent", "draft"]);
const BLANK = "·";
const HANDLE = /^[a-z0-9][a-z0-9-]*$/u;
const MOMENT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/u;
// A path token: a run of path characters ending in `.md`, not inside a longer one; a full stop
// after it that ends a sentence is not part of it (`see celorus/x.md.` names `celorus/x.md`).
const PATH_TOKEN = /(?<![A-Za-z0-9_./-])((?:celorus\/)?[A-Za-z0-9_][A-Za-z0-9_./-]*\.md)(?![A-Za-z0-9_/-]|\.[A-Za-z0-9_/-])/gu;

class ConvertStopped extends Refusal {}

function stop(step, words, written = []) {
  const err = new ConvertStopped(`${step}: ${words}`);
  err.written = written;
  return err;
}

const sha = (bytes) => sha256().update(bytes).hex();
const posix = (rel) => rel.split(path.sep).join("/");
const isMapping = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Every file under `dir`, by its path from `dir` with forward slashes, in path order. A link or
// an entry that is neither a file nor a folder is refused: the converter copies only plain files,
// and never follows a link out of the desk. `.git` is the desk's history, not its pages.
function filesUnder(dir, step) {
  const out = [];
  const walk = (at) => {
    for (const name of fs.readdirSync(at).sort()) {
      if (name === ".git") continue;
      const full = path.join(at, name);
      const st = fs.lstatSync(full);
      const rel = posix(path.relative(dir, full));
      if (st.isSymbolicLink()) throw stop(step, `${rel} is a link; the converter copies only plain files, so nothing was written`);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(rel);
      else throw stop(step, `${rel} is neither a file nor a folder, so nothing was written`);
    }
  };
  walk(dir);
  return out;
}

// Every read the converter makes of a file by its path: lstat asks for a plain file first, so a
// pipe, a socket, a device, a folder or a link is refused and never opened (the engine's read
// rule, B4). The refusal names the file's own name alone, never its folder.
function readRegular(file, encoding) {
  if (!fs.lstatSync(file).isFile()) throw new Refusal(`${path.basename(file)} is not a plain file, so the converter does not read it. Nothing was written.`);
  const bytes = fs.readFileSync(file);
  return encoding ? bytes.toString(encoding) : bytes;
}

// The entries under the desk folder that cannot be copied as a file (a pipe, a socket, a
// device), by their paths under it: the dated copy refuses before it starts when there is one.
function oddUnder(root) {
  const out = [];
  const go = (folder, prefix) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) go(path.join(folder, entry.name), rel);
      else if (!entry.isFile() && !entry.isSymbolicLink()) out.push(rel);
    }
  };
  go(root, "");
  return out.sort();
}

// The handles a header value names: plain words and [[links]], each once.
function handlesIn(value) {
  const out = [];
  const add = (v) => {
    if (typeof v !== "string") return;
    const links = linksIn(v);
    for (const one of links.length ? links : [v.trim()]) if (one && !out.includes(one)) out.push(one);
  };
  if (Array.isArray(value)) value.forEach(add);
  else add(value);
  return out;
}

// The [[links]] a page holds, header and body, by file name.
function linksOf(page) {
  const text = `${JSON.stringify(page.head || {})}\n${page.body || ""}`;
  return new Set(linksIn(text));
}

// A markdown table in `text`: the lines before it, its header and divider, its rows, and the lines
// after it; null when the text holds none.
function tableOf(text) {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.startsWith("|"));
  if (first === -1 || !(lines[first + 1] || "").startsWith("|")) return null;
  let end = first + 2;
  while (end < lines.length && lines[end].startsWith("|")) end += 1;
  const columns = lines[first].split("|").slice(1, -1).map((c) => c.trim());
  return { before: lines.slice(0, first), head: lines.slice(first, first + 2), rows: lines.slice(first + 2, end), after: lines.slice(end), columns };
}

const cellsOf = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
// A table's rule line, |---|, as the desk's readers pass it over (render/desk.js readTable).
const ruleLine = (line) => [...line.split("|").join("").trim()].every((ch) => "-: ".includes(ch));
const withRows = (t, rows) => [...t.before, ...t.head, ...rows, ...t.after].join("\n");

// The firm's supplied list, with a `seat` column (the base's ruling, c/6233887704). A seat's graph
// reads a lead's seat from its row's own cell, else from an assign_lead line in its own log.md
// (render/counts.js suppliedSeat, R42), and a graph's log holds its own seat's lines alone: a lead
// the flat desk gave by a log line would read as nobody's on every graph but the head's. So each
// row's cell is the seat the flat desk reads for it today, and blank (·) where it reads none; in a
// list that has the column already, a row the desk reads a seat for by a log line has it set, and
// the others are kept as they are. The rows are the desk's own reading of them (render/desk.js),
// one for one: a rule line among them is passed over, as the readers pass it, and a short row is
// filled out to the new cell. Its lines end as they did. Stopped where the desk reads rows the
// table's lines do not hold.
function suppliedWithSeats(old, bytes) {
  const text = bytes.toString("utf8");
  const eol = text.includes("\r\n") ? "\r\n" : text.includes("\r") ? "\r" : "\n";
  const t = tableOf(text.split(/\r\n|\r|\n/u).join("\n"));
  const desk = new Desk(old.read);
  const seatSet = new Set(desk.of("seats").map((page) => page.slug));
  const parts = (line) => line.trim().split(/(?<!\\)\|/u);
  const columns = t === null ? [] : parts(t.head[0]).slice(1, -1).map((c) => c.trim());
  const had = columns.indexOf("seat");
  const at = had === -1 ? columns.length : had;
  let i = 0;
  const rows = (t === null ? [] : t.rows).map((line) => {
    if (ruleLine(line) || i >= desk.supplied.length) return line;
    const r = desk.supplied[i++];
    const seat = suppliedSeat(desk, r, seatSet);
    if (had !== -1 && (seat === null || seat === unlink(r.seat))) return line;
    const p = parts(line);
    const cells = p.slice(1, -1).map((c) => c.trim());
    while (cells.length < at) cells.push(BLANK);
    if (had === -1) cells.splice(at, 0, seat === null ? BLANK : seat);
    else cells[at] = seat;
    return `| ${cells.join(" | ")} |${p[p.length - 1]}`;
  });
  if (i !== desk.supplied.length) {
    throw stop("reading the desk", `${SUPPLIED} holds rows the desk reads apart from its table's lines, so the converter cannot give each its seat; make it one table of whole rows, and convert again. Nothing was written`);
  }
  if (t === null || (had !== -1 && rows.every((line, k) => line === t.rows[k]))) return bytes;
  const head = had !== -1 ? t.head : [`| ${[...columns, "seat"].join(" | ")} |`, `|${[...parts(t.head[1]).slice(1, -1), "---"].join("|")}|`];
  return withRows({ ...t, head }, rows).split("\n").join(eol);
}

// The old desk as the converter reads it: every file's bytes, every page's header (lib/desk.js),
// the seats, the stamps.
function readOld(desk) {
  const step = "reading the desk";
  const read = readDesk(desk);
  if (read.stampsUnread) throw stop(step, `the desk's stamps page, ${read.stampsUnread.rel}, cannot be read, so nothing was written`);
  if (read.layout === L.LAYOUT) throw stop(step, "this desk is already on layout 3, so there is nothing to convert");
  if (read.layout !== 2) throw stop(step, `this desk reads as layout ${JSON.stringify(read.layout)}, not layout 2: update it to layout 2 first (update_desk), then convert`);
  const root = path.join(read.root, "celorus");
  const rels = filesUnder(root, step);
  const heads = new Map(read.pages.map((p) => [p.rel, p]));
  const files = new Map(rels.map((rel) => [rel, readRegular(path.join(root, ...rel.split("/")))]));
  // A seat is one every writer holds a seat to (write/facts.js seatsOf): a seat page whose header
  // says `type: seat`, and, when desk.md lists its seats, one it lists. A file in seats/ is never
  // a seat by its name alone (a README there, or a seat that has left the list).
  const declared = declaredSeats(root, deskMd(root, "Nothing was written."));
  const seats = new Map();
  for (const handle of declared.handles) {
    const page = heads.get(`seats/${handle}.md`);
    const head = page && isMapping(page.head) ? page.head : {};
    seats.set(handle, { rel: `seats/${handle}.md`, role: typeof head.role === "string" ? head.role : null });
  }
  const plugin = readPage(PLUGIN_MODEL, "model.md");
  const target = plugin.head && plugin.head.model_version;
  if (read.stamps.model_version !== target) {
    throw stop(step, `this desk is on model version ${JSON.stringify(read.stamps.model_version)} and this plugin ships ${JSON.stringify(target)}: update it first (update_desk), then convert`);
  }
  return { read, root: read.root, celorus: root, rels, heads, files, seats, seatsWhy: declared.why, stamps: read.stamps };
}

// Who each page belongs to, over every seat of the desk, converted or not (Addendum 19 section 6).
// Returns Map rel -> Set of handles. A page in the account role goes to its owner; a conversation
// to each seat it was attended by; a seat's own files to that seat; a brief, research, a review, a
// sent page or a draft to the seats of what it is about or for; a page to every seat whose pages
// link it, so every link opens inside the graph; seat pages to every graph.
// `seeds` are the preview's answers, page to seat, each taken as a seat the page carries itself.
// `fixed` are the pages of the runner's own, page to the runner: each has that seat alone, whatever
// it names or is linked from, and gives it to the pages it links and is the subject of.
function belongs(old, pages, seeds = new Map(), rows = () => [], fixed = new Map()) {
  const handles = new Set(old.seats.keys());
  const byStem = new Map(pages.map((p) => [L.stemOf(p.rel), p]));
  const seatsOf = new Map(pages.map((p) => [p.rel, new Set()]));
  const give = (rel, set) => {
    if (fixed.has(rel)) return false;
    const have = seatsOf.get(rel);
    let grew = false;
    for (const h of set) if (handles.has(h) && !have.has(h)) (have.add(h), (grew = true));
    return grew;
  };
  for (const p of pages) {
    if (fixed.has(p.rel)) {
      if (handles.has(fixed.get(p.rel))) seatsOf.get(p.rel).add(fixed.get(p.rel));
      continue;
    }
    const head = isMapping(p.head) ? p.head : {};
    if (p.rel.startsWith("seats/")) give(p.rel, handles);
    if (seeds.has(p.rel)) give(p.rel, [seeds.get(p.rel)]);
    for (const key of ["owner", "seat", "for_seat", "attended"]) give(p.rel, handlesIn(head[key]));
    const manner = /^manner\/([a-z0-9-]+)-manner\.md$/u.exec(p.rel);
    if (manner) give(p.rel, [manner[1]]);
  }
  // Made pages take the seats of what they are about or for, by what those pages carry themselves
  // (or, for a made page, what it was given here), to a fixed point: never the seats a world page
  // is given below only because a placed page links it, so a page sent by one seat does not follow
  // a person into another seat's graph.
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of pages) {
      const head = isMapping(p.head) ? p.head : {};
      if (MADE.has(head.type)) {
        for (const key of ["about", "for_conversation", "sent_to", "from"]) {
          for (const stem of handlesIn(head[key])) {
            const at = byStem.get(stem);
            if (at && give(p.rel, seatsOf.get(at.rel))) grew = true;
          }
        }
      }
    }
  }
  // What each page carries itself, before the links: a seat a page reaches only by a link is
  // counted at the preview, by kind (`linked_in`).
  const own = new Map([...seatsOf].map(([rel, set]) => [rel, new Set(set)]));
  // The tables' rows are placed pages too: each row, with the seats of the graphs it goes to.
  const placedRows = rows(seatsOf);
  // Then, to a fixed point, a person, family or firm page takes the seats of every page that links
  // it, so a link to one opens inside the graph. Only those three kinds, as section 6 writes it
  // (the base's ruling of 2026-10-14, c/6162433833): a sent record, a brief, research, a review or a
  // conversation goes only to its own seats, never filed in another seat's graph by a link.
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of pages) {
      const from = seatsOf.get(p.rel);
      if (!from.size) continue;
      for (const stem of linksOf(p)) {
        const at = byStem.get(stem);
        if (at && WORLD.has(isMapping(at.head) ? at.head.type : null) && give(at.rel, from)) grew = true;
      }
    }
    for (const row of placedRows) {
      for (const name of linksIn(row.text)) {
        const at = byStem.get(name);
        if (at && WORLD.has(isMapping(at.head) ? at.head.type : null) && give(at.rel, row.seats)) grew = true;
      }
    }
  }
  return { seatsOf, own };
}

// The plan: every file the conversion writes, by its path under the firm folder, with its bytes;
// what it asks; and its counts. Pure: it reads the old desk and the target folder, writes nothing.
function derive(desk, firm, opts) {
  const old = readOld(desk);
  const step = "reading the desk";
  const seats = opts.seats;
  if (!Array.isArray(seats) || !seats.length || seats.some((s) => typeof s !== "string") || new Set(seats).size !== seats.length) {
    throw new Refusal("`seats` is the list of seat handles to convert, each once, as [\"tanvi\", \"meenal\"].");
  }
  for (const s of seats) {
    if (!old.seats.has(s)) throw stop(step, `${s} is not a seat of this desk (its seats are ${old.seats.size ? [...old.seats.keys()].join(", ") : `none: ${old.seatsWhy}`}), so nothing was written`);
  }
  const common = L.commonFolder(firm);
  const record = recordOf(firm, old.stamps.desk_id);
  const commonStamps = readPage(common, L.COMMON_STAMPS);
  const earlier = isMapping(commonStamps.head) ? commonStamps.head : null;
  if (earlier && earlier.desk_id !== old.stamps.desk_id) throw stop(step, "the common space there belongs to another desk, so nothing was written");

  // The desk head (c/6152545966): the seat whose role says so, if converted; else one of the
  // converted seats the preview names; a later conversion keeps the one already recorded.
  const byRole = [...old.seats].filter(([, s]) => s.role === "desk-head").map(([h]) => h);
  // A seat converted earlier: one common.md names, or one with a file under its graph in the
  // conversion record, which a run cut short wrote before it reached common.md.
  const recordedSeats = Object.keys(record.files).filter((rel) => rel.startsWith(`${L.SEATS}/`)).map((rel) => rel.split("/")[1]);
  const converted = [...new Set([...(earlier && Array.isArray(earlier.converted_seats) ? earlier.converted_seats : []), ...recordedSeats, ...seats])].sort();
  let deskHead = earlier ? earlier.desk_head : null;
  const ask = { pages_without_seat: [], desk_head: null, rest_to: null };
  if (!deskHead) {
    // chosen only from the converted seats the desk still has: one in the record of a run cut
    // short may have left the desk since
    const heads = converted.filter((h) => old.seats.has(h));
    const named = byRole.find((h) => heads.includes(h));
    if (named) {
      if (opts.desk_head && opts.desk_head !== named) throw stop(step, `${named} is the desk head by role and is converted, so the desk head is ${named}, not ${opts.desk_head}`);
      deskHead = named;
    } else if (opts.desk_head) {
      if (!heads.includes(opts.desk_head)) throw stop(step, `${opts.desk_head} is not a converted seat of this desk, and the desk head must be one (${heads.join(" or ")})`);
      deskHead = opts.desk_head;
    } else {
      ask.desk_head = { why: byRole.length ? `${byRole.join(", ")} is the desk head by role and is not converted` : "no seat's role says desk head", choose_from: heads };
    }
  }

  // A table split by seat is one table, as the converter reads it: a line of one apart from it (a
  // second table, a row set in by a space, or a line starting with | above it, which hides the
  // table itself) would go whole to every graph, with every seat's rows. So is the supplied list,
  // whose rows the converter gives a seat column: a row apart from it would keep no seat.
  const piped = (lines) => lines.filter((line) => /^\s*\|/u.test(line)).length;
  for (const rel of [...BY_SEAT, FOLLOW_UPS, BOOK, MERGE_RECORD, SUPPLIED]) {
    if (!old.files.has(rel)) continue;
    const text = old.files.get(rel).toString("utf8");
    const t = tableOf(text);
    if (t ? piped(t.before) + piped(t.after) : piped(text.split("\n"))) {
      throw stop(step, `${rel} holds a table line apart from the one table the converter ${rel === SUPPLIED ? "gives a seat column" : "splits by seat"} (a second table, a row set in by a space, or a line starting with | above it); join them into one table, or move the rest to a page of its own, and convert again. Nothing was written`);
    }
    // The converter takes a table's second line for its rule line and keeps it with the header line,
    // which goes to every graph a split table goes to: a table with no rule line would send its first
    // row with it (E6b-2c panel). Read with its lines ending in any of the three ways, as the supplied
    // list's seat column reads it.
    const lined = tableOf(text.split(/\r\n|\r|\n/u).join("\n"));
    if (lined && !ruleLine(lined.head[1])) {
      throw stop(step, `${rel}'s table has no rule line (|---|) under its header line, so the converter would read its first row as part of the header; put one under the header line, and convert again. Nothing was written`);
    }
  }

  // Each file of the old desk, sorted into where it goes.
  const pages = old.rels.filter((rel) => isPage(rel)).map((rel) => old.heads.get(rel) || { rel, head: null, body: "" });
  const counts = { pages_read: pages.length, leads_left: 0, merges_left: 0, left_for_seats_not_converted: 0, placed: 0, placed_byte_equal: 0, linked_in: { person: 0, family: 0, firm: 0 }, pages_repointed: 0, pointers_repointed: 0, sent_lists_drawn: 0, pointers_left: 0, rows_left: 0, attachments_not_carried: 0, own_copied: 0, own_not_carried: 0, own_whole: 0, own_pages: 0, own_pages_left: 0 };
  // A page whose `file` names a file that is not carried with it.
  const notCarried = new Set();
  // each file of the runner's own a placed page names, in the runner's graph, once however many of
  // its pages name it; each one a page in another seat's graph names, not carried there; and each
  // such page, counted
  const ownCopied = new Set();
  const ownLeft = new Set();
  const ownLeftPages = new Set();
  const leads = new Set(pages.filter((p) => L.isLead(p)).map((p) => p.rel));
  counts.leads_left = leads.size;
  // A merge record, in merges/ or a page of its kind anywhere, is the old desk's history: it stays.
  const merge = (p) => p.rel.startsWith("merges/") || (isMapping(p.head) && p.head.type === "merge-record");
  // The pages of the runner's own, but a lead page, a merge record and a page the desk keeps, which
  // stay: each placed with the kinds' pages, by the runner's seat alone, wherever it sits (under a
  // common or a generated folder as well, in place of the common space and every graph).
  const ownPages = new Set(pages.filter((p) => runnersOwnPage(p.rel) && !leads.has(p.rel) && !merge(p) && !STAYS(p.rel)).map((p) => p.rel));
  const fixed = new Map([...ownPages].map((rel) => [rel, opts.handle]));
  const kindPages = pages.filter((p) => !leads.has(p.rel) && !merge(p) && !STAYS(p.rel) && (ownPages.has(p.rel) || (!isCommon(p.rel) && !GENERATED.some((g) => p.rel.startsWith(g)) && !BY_SEAT.includes(p.rel) && p.rel !== FOLLOW_UPS && p.rel !== BOOK)));
  // A follow-up's `from`, the conversation it came from, as its path under celorus/: written as a
  // path (`conversations/x.md`, with or without `celorus/`) or as a link (`[[x]]`).
  const relByStem = new Map(kindPages.map((p) => [L.stemOf(p.rel), p.rel]));
  const sourceOf = (cell) => {
    const link = handlesIn(cell)[0];
    if (hasLink(cell) && link && relByStem.has(link)) return relByStem.get(link);
    return cell.startsWith("celorus/") ? cell.slice(8) : cell;
  };
  counts.merges_left = new Set([...old.rels.filter((rel) => rel.startsWith("merges/")), ...pages.filter(merge).map((p) => p.rel)]).size;
  // A lead page and a merge record stay wherever they sit, under a common or a generated folder as
  // well: never copied into the common space or a graph, and a pointer to one is left.
  const kept = new Set(pages.filter((p) => leads.has(p.rel) || merge(p)).map((p) => p.rel));
  // Who each page belongs to by what it carries; then the preview's answers for the pages that
  // carry no seat, each taken as that page's own seat, and the placement read again with them.
  const restTo = typeof opts.rest_to === "string" && old.seats.has(opts.rest_to) ? opts.rest_to : null;
  // The rows of the tables, each with the seats it goes to (as the tables are split below): a
  // marks or desk-log row to its seat, a follow-up to the seats of its conversation, and a row
  // that names neither, and the book's, to rest_to.
  const tableRows = (seatsOf, rest = restTo ? [restTo] : []) => {
    const out = [];
    for (const rel of BY_SEAT) {
      const t = tableOf(old.files.get(rel)?.toString("utf8") || "");
      if (!t) continue;
      const col = t.columns.indexOf(seatColumn(rel));
      for (const row of t.rows) {
        const who = handlesIn(cellsOf(row)[col])[0];
        out.push({ text: row, seats: old.seats.has(who) ? [who] : rest });
      }
    }
    const follow = tableOf(old.files.get(FOLLOW_UPS)?.toString("utf8") || "");
    if (follow) {
      const col = follow.columns.indexOf("from");
      for (const row of follow.rows) {
        const from = cellsOf(row)[col] || "";
        const rel = sourceOf(from);
        out.push({ text: row, seats: seatsOf.has(rel) ? [...seatsOf.get(rel)] : rest });
      }
    }
    for (const row of (tableOf(old.files.get(BOOK)?.toString("utf8") || "") || { rows: [] }).rows) out.push({ text: row, seats: rest });
    return out;
  };
  const first = belongs(old, kindPages, new Map(), tableRows, fixed);
  const answers = isMapping(opts.seat_for) ? opts.seat_for : {};
  // A page of the runner's own carries the runner's seat (the tool holds the runner to a seat of
  // the desk), so it is never asked about and never goes to rest_to.
  const unseated = new Set(kindPages.filter((p) => !first.seatsOf.get(p.rel).size).map((p) => p.rel));
  // The pages the preview asks about before rest_to is answered: one of them a book's row links
  // takes rest_to's seat once it is, and its answer still holds, the page going to both seats.
  const bare = restTo ? belongs(old, kindPages, new Map(), (seatsOf) => tableRows(seatsOf, []), fixed) : first;
  const askable = new Set(kindPages.filter((p) => !bare.seatsOf.get(p.rel).size).map((p) => p.rel));
  for (const [rel, seat] of Object.entries(answers)) {
    if (!askable.has(rel)) throw stop(step, `seat_for names ${rel}, which is not a page the preview asked about, so nothing was written`);
    if (!old.seats.has(seat)) throw stop(step, `seat_for gives ${rel} to ${seat}, which is not a seat of this desk, so nothing was written`);
  }
  if (opts.rest_to !== undefined && opts.rest_to !== null && !old.seats.has(opts.rest_to)) {
    throw stop(step, `rest_to is ${opts.rest_to}, which is not a seat of this desk, so nothing was written`);
  }
  const seeds = new Map(Object.entries(answers));
  const rest = [];
  for (const rel of unseated) {
    if (seeds.has(rel)) continue;
    if (/^(crm|signals)\//u.test(rel) || !rel.includes("/")) rest.push(rel);
    else ask.pages_without_seat.push(rel);
  }
  // The files no seat names and no page carries (crm/, signals/, other top-level tables): whole to
  // the seat the preview names for them, as the book's rows are; one the writers' table shares
  // with no one, to the runner's graph alone.
  const loose = old.rels.filter((rel) => !isPage(rel) && /^(crm|signals)\//u.test(rel) && !rel.endsWith("/.gitkeep"));
  const looseShared = loose.filter((rel) => !runnersOwn(rel));
  // Each file the writers' table shares with no one that goes whole into the runner's graph alone:
  // one of those, one under a generated folder, and one under a common folder (in place of the
  // common space).
  const ownWhole = old.rels.filter((rel) => runnersOwn(rel) && (loose.includes(rel) || GENERATED.some((prefix) => rel.startsWith(prefix)) || isCommon(rel)));
  const bookRows = (tableOf(old.files.get(BOOK)?.toString("utf8") || "") || { rows: [] }).rows;
  // The rows that name no seat of the desk (a seat that has left, or none), and the follow-ups
  // whose conversation is no page here: they go to rest_to as well, never to no graph.
  let homeless = 0;
  for (const rel of BY_SEAT) {
    const t = tableOf(old.files.get(rel)?.toString("utf8") || "");
    if (!t) continue;
    const col = t.columns.indexOf(seatColumn(rel));
    homeless += t.rows.filter((row) => !old.seats.has(handlesIn(cellsOf(row)[col])[0])).length;
  }
  const follows = tableOf(old.files.get(FOLLOW_UPS)?.toString("utf8") || "");
  if (follows) {
    const col = follows.columns.indexOf("from");
    homeless += follows.rows.filter((row) => !first.seatsOf.has(sourceOf(cellsOf(row)[col] || ""))).length;
  }
  if ((rest.length || looseShared.length || bookRows.length || homeless) && restTo === null) {
    ask.rest_to = { why: "these name no seat and go whole to one seat", pages: [...rest, ...looseShared], book_rows: bookRows.length, rows_without_seat: homeless, choose_from: [...old.seats.keys()] };
  }
  for (const rel of rest) if (restTo) seeds.set(rel, restTo);
  const { seatsOf, own } = seeds.size ? belongs(old, kindPages, seeds, tableRows, fixed) : first;

  // The path each placed page takes in each graph: <part>/<its layout 2 path>; a page of the
  // runner's own, the personal part. Run by a seat not converted, it goes into no graph, counted.
  const placedIn = new Map(seats.map((s) => [s, new Map()]));
  for (const p of kindPages) {
    const has = seatsOf.get(p.rel);
    const mine = seats.filter((s) => has.has(s));
    if (!mine.length) {
      if (ownPages.has(p.rel)) counts.own_pages_left += 1;
      else if (has.size) counts.left_for_seats_not_converted += 1;
      continue;
    }
    if (ownPages.has(p.rel)) counts.own_pages += 1;
    for (const s of mine) {
      placedIn.get(s).set(p.rel, `${ownPages.has(p.rel) ? L.PERSONAL : L.defaultPart(p)}/${p.rel}`);
      if (!own.get(p.rel).has(s)) counts.linked_in[p.head.type] += 1;
    }
  }
  for (const rel of [...loose, ...ownWhole.filter((at) => !loose.includes(at) && !GENERATED.some((prefix) => at.startsWith(prefix)))]) {
    const to = runnersOwn(rel) ? opts.handle : restTo;
    if (to && seats.includes(to)) placedIn.get(to).set(rel, `${L.PERSONAL}/${rel}`);
  }
  // A file under celorus/ a page names in its `file`, as its path there: null when under a hidden
  // folder or not a file the desk holds.
  const inDesk = (named) => {
    const parts = posix(path.normalize(named)).split("/");
    if (path.isAbsolute(named) || parts[0].toLowerCase() !== "celorus" || parts.some((part) => part.startsWith("."))) return null;
    const rel = parts.slice(1).join("/");
    return old.files.has(rel) ? rel : null;
  };
  for (const s of seats) {
    placedIn.get(s).set(FOLLOW_UPS, `${L.SHARED}/${FOLLOW_UPS}`);
    placedIn.get(s).set(BOOK, `${L.PERSONAL}/${BOOK}`);
  }

  const out = new Map();
  const put = (rel, bytes) => out.set(rel, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "utf8"));
  const mergeTable = tableOf(old.files.get(MERGE_RECORD)?.toString("utf8") || "");
  const mergeRecord = mergeTable ? { t: mergeTable, col: mergeTable.columns.indexOf("conversation") } : null;
  const carried = new Set();
  // Each page of the runner's own that a page in another seat's graph links or points at, with
  // that graph, for the preview's per-file list (the base's ruling A2, c/6169769956).
  const ownStems = new Map([...ownPages].map((rel) => [L.stemOf(rel), rel]));
  const ownPagesNamed = new Set();
  // Each placed page written byte for byte, by its path in the firm folder, until a sent list drawn
  // on it changes it.
  const byteEqual = new Set();
  for (const s of seats) {
    const g = `${L.SEATS}/${s}/celorus`;
    const mine = placedIn.get(s);
    const repoint = (text) => {
      let n = 0;
      let left = 0;
      const next = text.replace(PATH_TOKEN, (token) => {
        const full = token.startsWith("celorus/");
        const rel = full ? token.slice("celorus/".length) : token;
        if (mine.has(rel)) return (n += 1), `${full ? "celorus/" : ""}${mine.get(rel)}`;
        if (ownPages.has(rel)) ownPagesNamed.add(`${g}/${rel}`);
        if (old.files.has(rel) && (!sameInGraph(rel) || ownPages.has(rel) || kept.has(rel))) left += 1;
        return token;
      });
      return { next, n, left };
    };
    for (const [rel, to] of mine) {
      if (rel === FOLLOW_UPS || rel === BOOK) continue;
      const bytes = old.files.get(rel);
      if (!isPage(rel)) {
        put(`${g}/${to}`, bytes);
        continue;
      }
      const { next, n, left } = repoint(bytes.toString("utf8"));
      for (const stem of linksOf(old.heads.get(rel))) {
        if (ownStems.has(stem) && !mine.has(ownStems.get(stem))) ownPagesNamed.add(`${g}/${ownStems.get(stem)}`);
      }
      counts.pointers_left += left;
      if (n) (counts.pages_repointed += 1), (counts.pointers_repointed += n);
      else (counts.placed_byte_equal += 1), byteEqual.add(`${g}/${to}`);
      counts.placed += 1;
      put(`${g}/${to}`, n ? next : bytes);
      // The file the page names in its `file` (a sent page's attachment) goes with it, at the same
      // path under the graph's desk folder, so its pointer opens unchanged. One the runner's own (a
      // file outside celorus/, which no sync shares, or one under it the writers' table shares with
      // no one) goes byte for byte into the runner's graph alone, and in another seat's graph is not
      // carried, the page counted and the file named in the preview (the base's ruling R1,
      // c/6165508936, as amended by c/6167970275 and c/6169137770 item 5). A page it names is placed
      // by the page rules. A file the desk keeps (the views, the merge records) or a rule of its own
      // places elsewhere (the common space, the files no seat names, each moved whole) is not carried
      // with the page, and counted; a generated file the graph is given opens where it points already.
      const head = old.heads.get(rel) && isMapping(old.heads.get(rel).head) ? old.heads.get(rel).head : {};
      const named = typeof head.file === "string" ? head.file : null;
      const outside = named ? attachment(old.root, named) : null;
      const inside = named && !outside ? inDesk(named) : null;
      const generated = inside !== null && GENERATED.some((prefix) => inside.startsWith(prefix));
      const file = outside ? outside.rel : `celorus/${inside}`;
      if (inside === null && !outside) {
        if (named) notCarried.add(rel);
      } else if (inside !== null && (isPage(inside) || STAYS(inside))) {
        if (!isPage(inside)) notCarried.add(rel);
      } else if ((outside || runnersOwn(inside)) && s !== opts.handle) {
        ownLeft.add(`${L.SEATS}/${s}/${file}`);
        ownLeftPages.add(`${g}/${to}`);
      } else if (inside !== null && !generated && (isCommon(inside) || loose.includes(inside))) {
        notCarried.add(rel);
      } else {
        // One outside celorus/ goes to the seat folder's root, where the seat's conversion record is
        // kept: one by the record's name in any case of letters, as a case-blind disk folds them
        // (upper case, then lower, so a long s reads as an s), is refused, never written over it.
        if (outside && outside.rel.toUpperCase().toLowerCase() === RECORD) {
          throw stop(step, `${rel} names ${outside.rel} in its file, which would go to ${L.SEATS}/${s}/${outside.rel}, where the seat's conversion record is kept; rename the file in the desk folder, and the file line that names it, then convert again. Nothing was written`);
        }
        if (!generated) put(`${L.SEATS}/${s}/${file}`, outside ? outside.bytes : old.files.get(inside));
        if (outside || runnersOwn(inside)) ownCopied.add(`${L.SEATS}/${s}/${file}`);
      }
    }
    // The tables: each graph keeps the header and its own rows, each row whole.
    for (const rel of BY_SEAT) {
      const text = old.files.has(rel) ? old.files.get(rel).toString("utf8") : null;
      const t = text === null ? null : tableOf(text);
      if (t === null) {
        if (text !== null) put(`${g}/${rel}`, text);
        continue;
      }
      const col = t.columns.indexOf(seatColumn(rel));
      const rows = t.rows.filter((row) => {
        const who = handlesIn(cellsOf(row)[col])[0];
        return who === s || (!old.seats.has(who) && restTo === s);
      });
      put(`${g}/${rel}`, withRows(t, rows));
    }
    const follow = tableOf(old.files.get(FOLLOW_UPS)?.toString("utf8") || "");
    if (follow) {
      const col = follow.columns.indexOf("from");
      const rows = follow.rows
        .filter((row) => {
          const from = cellsOf(row)[col] || "";
          const rel = sourceOf(from);
          if (mine.has(rel)) return true;
          return !seatsOf.has(rel) && restTo === s;
        })
        .map((row) => repoint(row).next);
      put(`${g}/${L.SHARED}/${FOLLOW_UPS}`, withRows(follow, rows));
    }
    const book = tableOf(old.files.get(BOOK)?.toString("utf8") || "");
    if (book) put(`${g}/${L.PERSONAL}/${BOOK}`, withRows(book, restTo === s ? book.rows : []));
    // The overnight's merge record, at the graph's root (the base's ruling K11): the rows whose
    // conversation this graph holds, by its stem, which its move into a part keeps; none, no page,
    // as on a desk whose overnight has merged nothing yet.
    if (mergeRecord) {
      const stems = new Set([...mine.keys()].filter((rel) => isPage(rel)).map((rel) => L.stemOf(rel)));
      // each row by its place in the record, so one the record holds twice is carried twice
      const held = mergeRecord.t.rows.map((row, i) => [row, i]).filter(([row]) => stems.has(handlesIn(cellsOf(row)[mergeRecord.col])[0]));
      for (const [, i] of held) carried.add(i);
      if (held.length) put(`${g}/${MERGE_RECORD}`, withRows(mergeRecord.t, held.map(([row]) => row)));
    }
    // The generated copies, but the desk's own words, which the common space holds alone (the
    // base's ruling K7), and the graph's own stamps, index, log and from-my-team.
    for (const rel of old.rels) {
      if (!GENERATED.some((prefix) => rel.startsWith(prefix)) || ownPages.has(rel) || kept.has(rel) || rel === L.OWN_WORDS) continue;
      if (runnersOwn(rel) && s !== opts.handle) continue;
      put(`${g}/${rel}`, old.files.get(rel));
    }
    put(`${g}/desk.md`, graphStamps(old.files.get("desk.md").toString("utf8"), s, old.stamps.desk_id));
    put(`${g}/index.md`, old.files.get("index.md"));
    put(`${g}/${L.TEAM}/.gitkeep`, "");
    const gitignore = path.join(old.root, ".gitignore");
    if (fs.existsSync(gitignore)) put(`${L.SEATS}/${s}/.gitignore`, readRegular(gitignore));
    // The sent lists, drawn in the plan from every sent page the graph will hold (the base's ruling
    // K6), as render_views draws them there: this run's pages over the ones on disk already, as an
    // earlier run's sent page the desk has since renamed, which stays. Each page goes into the
    // record with its list, so render_views rewrites none (T19). A list is drawn only on a page this
    // run writes; the converter places no page in from-my-team.
    const planned = {};
    for (const [rel, bytes] of out) if (rel.startsWith(`${g}/`) && isPage(rel)) planned[rel.slice(g.length + 1)] = bytes;
    for (const [rel, text] of Object.entries(sentBlocksAfter(graphOnDisk(path.join(firm, L.SEATS, s)), planned, null))) {
      if (!Object.hasOwn(planned, rel)) continue;
      put(`${g}/${rel}`, text);
      counts.sent_lists_drawn += 1;
      if (byteEqual.delete(`${g}/${rel}`)) counts.placed_byte_equal -= 1;
    }
  }
  counts.attachments_not_carried = notCarried.size;
  // a file under rules/ or model/ that a page in another seat's graph names is in the runner's graph
  // all the same, as each of those is
  for (const at of ownLeft) {
    const copy = `${L.SEATS}/${opts.handle}/${at.split("/").slice(2).join("/")}`;
    if (out.has(copy)) ownCopied.add(copy);
  }
  counts.own_copied = ownCopied.size;
  counts.own_not_carried = ownLeftPages.size;
  counts.own_whole = ownWhole.length;
  counts.merge_rows_carried = carried.size;
  counts.merge_rows_left = mergeRecord ? mergeRecord.t.rows.length - carried.size : 0;
  // Rows of seats not converted, counted as left.
  for (const rel of BY_SEAT) {
    const t = tableOf(old.files.get(rel)?.toString("utf8") || "");
    if (!t) continue;
    const col = t.columns.indexOf(seatColumn(rel));
    counts.rows_left += t.rows.filter((row) => {
      const who = handlesIn(cellsOf(row)[col])[0];
      return old.seats.has(who) ? !seats.includes(who) : !seats.includes(restTo);
    }).length;
  }

  // The common space: the desk-wide pages whole, but the supplied list with its seat column; its
  // stamps, the default table and the name list.
  for (const rel of old.rels) if (isCommon(rel) && !runnersOwn(rel) && !ownPages.has(rel) && !kept.has(rel)) put(`${L.COMMON}/${rel}`, rel === SUPPLIED ? suppliedWithSeats(old, old.files.get(rel)) : old.files.get(rel));
  put(`${L.COMMON}/${L.COMMON_STAMPS}`, commonStampsText(old, deskHead, converted));
  put(`${L.COMMON}/${L.DEFAULTS}`, defaultsText());
  // The name list is in the common space, so it names no page of the runner's own.
  const names = [];
  for (const s of seats) {
    for (const rel of placedIn.get(s).keys()) {
      if (ownPages.has(rel)) continue;
      const p = old.heads.get(rel);
      const type = p && isMapping(p.head) ? p.head.type : null;
      if ((WORLD.has(type) || type === "seat") && !names.some((n) => n.rel === rel)) names.push({ rel, type, head: p.head });
    }
  }
  const namesFile = path.join(common, L.NAMES);
  put(`${L.COMMON}/${L.NAMES}`, namesText(fs.existsSync(namesFile) ? readRegular(namesFile, "utf8") : null, names));
  const ownFiles = { copied: [...ownCopied].sort(), not_carried: [...ownLeft].sort(), whole: ownWhole, pages: [...ownPages].sort(), pages_named: [...ownPagesNamed].sort() };
  return { old, out, ask, counts, record, converted, deskHead, restTo, seatsOf, leads, seats, ownFiles };
}

// A seat's graph as it is on disk: every page under its celorus/, as render_views reads them once
// the graph is whole, read as readDesk reads a desk's but with no index page needed (a run stopped
// in the graph leaves it without one). No page when no graph is there yet, or its folder cannot be
// listed: render_views then draws no list there either.
function graphOnDisk(graph) {
  const none = { root: graph, pages: [] };
  try {
    const listed = readCommon(path.join(graph, "celorus"));
    return listed ? { root: graph, pages: listed.pages } : none;
  } catch {
    return none;
  }
}

// A path a page names that every graph holds at the same place: its stamps, index, logs, split
// tables and generated copies. A pointer to one opens unchanged and is not counted as left.
function sameInGraph(rel) {
  return ["desk.md", "index.md", "log.md", ...BY_SEAT].includes(rel) || GENERATED.some((prefix) => rel.startsWith(prefix));
}

// The file a page's `file` names under the desk folder but outside celorus/ (a sent page's
// attachment), as { rel, bytes }; null for one inside celorus/ (in any case of letters, as a
// folder on a case-blind disk opens either way), under a hidden folder or named as a hidden file
// (.git/, a seat's .celorus/ and its key: never carried to another seat), outside the desk,
// reached through a link anywhere on its path, or not a plain file there. Only a file the desk
// itself holds in plain view is carried.
function attachment(root, named) {
  const rel = posix(path.normalize(named));
  const top = rel.split("/")[0].toLowerCase();
  if (path.isAbsolute(named) || rel.startsWith("../") || rel === ".." || top === "celorus" || rel.split("/").some((part) => part.startsWith("."))) return null;
  const file = path.join(root, ...rel.split("/"));
  try {
    // The path as named, under the desk as resolved: a link on the way resolves elsewhere.
    if (fs.realpathSync(file) !== path.join(fs.realpathSync(root), ...rel.split("/"))) return null;
    return { rel, bytes: readRegular(file) };
  } catch {
    return null;
  }
}

// The record of an earlier run, or an empty one: the firm's, of the common space's files, and each
// seat's, beside its graph, of the files under its seat folder by their path there, so it names no
// folder. Read as one: each file by its path under the firm folder. Refused when one cannot be read
// or is another desk's; when the firm's names a file under seats/, as the earlier converter's one
// record did (the base's ruling D2, c/6218761764): no real folder holds one while layout 3 is dark;
// and when a seat's is in a folder not named by its seat: the converter finds a seat's graph under
// its handle (E10 names the folder by the seat_id at upload), so it would build that graph again
// beside the one renamed; one beside the seat's own folder is a copy, to move out of seats/.
function recordOf(firm, deskId) {
  const files = {};
  const readRecord = (rel) => {
    let record;
    try {
      record = JSON.parse(readRegular(path.join(firm, ...rel.split("/")), "utf8"));
    } catch {
      record = null;
    }
    if (!isMapping(record) || !isMapping(record.files)) throw stop("checking the targets", `the conversion record there, ${rel}, cannot be read, so nothing was written`);
    if (record.desk_id !== deskId) throw stop("checking the targets", "the firm folder there holds another desk's conversion, so nothing was written");
    return record;
  };
  if (fs.existsSync(path.join(firm, RECORD))) {
    const record = readRecord(RECORD);
    if (Object.keys(record.files).some((rel) => rel.startsWith(`${L.SEATS}/`))) {
      throw stop("checking the targets", `the conversion record there, ${RECORD}, was written by an earlier converter, which kept every seat's files in one record at the firm's root; convert again from the dated copy of the desk, into a new folder. Nothing was written`);
    }
    Object.assign(files, record.files);
  }
  let folders = [];
  try {
    folders = fs.readdirSync(path.join(firm, L.SEATS), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    folders = [];
  }
  for (const folder of folders) {
    const rel = `${L.SEATS}/${folder}/${RECORD}`;
    if (!fs.existsSync(path.join(firm, ...rel.split("/")))) continue;
    const record = readRecord(rel);
    if (typeof record.seat !== "string") throw stop("checking the targets", `the conversion record there, ${rel}, cannot be read, so nothing was written`);
    if (record.seat !== folder && folders.includes(record.seat)) {
      throw stop("checking the targets", `${L.SEATS}/${folder} holds the conversion record of seat ${record.seat}, whose graph is at ${L.SEATS}/${record.seat}: a copy, which the converter never reads; move it out of ${L.SEATS}/ to convert again. Nothing was written`);
    }
    if (record.seat !== folder) {
      throw stop("checking the targets", `${L.SEATS}/${folder} holds the conversion record of seat ${record.seat}: the converter finds a seat's graph under its handle, so it would build ${record.seat}'s graph again beside this one; rename it back to ${L.SEATS}/${record.seat} to convert again. Nothing was written`);
    }
    for (const [file, hash] of Object.entries(record.files)) files[`${L.SEATS}/${folder}/${file}`] = hash;
  }
  return { desk_id: deskId, files };
}

// The records `files` makes, by path under the firm folder, each as its text: the firm's, of the
// files outside seats/ and the seats converted, and one per seat folder, of the files under it.
function recordsOf(deskId, files, converted) {
  const firm = {};
  const bySeat = new Map();
  for (const rel of Object.keys(files).sort()) {
    const parts = rel.split("/");
    if (parts[0] !== L.SEATS) {
      firm[rel] = files[rel];
      continue;
    }
    if (!bySeat.has(parts[1])) bySeat.set(parts[1], {});
    bySeat.get(parts[1])[parts.slice(2).join("/")] = files[rel];
  }
  const text = (record) => `${JSON.stringify(record, null, 2)}\n`;
  const out = new Map([[RECORD, text({ desk_id: deskId, files: firm, converted_seats: converted })]]);
  for (const [folder, mine] of bySeat) out.set(`${L.SEATS}/${folder}/${RECORD}`, text({ desk_id: deskId, seat: folder, files: mine }));
  return out;
}

// A graph's desk.md: the old one's, with layout_version 3, the seat and the firm in place of the
// desk's list of seats, and no switch line. The body is kept as it was.
function graphStamps(raw, seat, firmId) {
  const text = raw.replace(/\r\n?/gu, "\n");
  const m = /^---\n([\s\S]*?)\n---\n/u.exec(text);
  if (m === null) throw stop("reading the desk", "the desk's desk.md has no header the converter can read, so nothing was written");
  const lines = m[1].split("\n");
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^(seats|converted):/u.test(line)) {
      while (i + 1 < lines.length && /^\s+-/u.test(lines[i + 1])) i += 1;
      continue;
    }
    if (/^layout_version:/u.test(line)) {
      kept.push(`layout_version: ${L.LAYOUT}`, `seat: ${asText(seat)}`, `firm: ${firmId}`);
      continue;
    }
    kept.push(line);
  }
  return `---\n${kept.join("\n")}\n---\n${text.slice(m[0].length)}`;
}

// A handle as a header value that reads back as the same text: as written, or quoted when the
// header would read it as something else (a number, like 1042, or a word like no or null).
function asText(handle) {
  return parseHeader(`seat: ${handle}`).seat === handle ? handle : JSON.stringify(handle);
}

function commonStampsText(old, deskHead, converted) {
  const s = old.stamps;
  const lines = [
    "---",
    "type: common-space",
    `title: ${JSON.stringify(`${s.desk}: the common space`)}`,
    "description: What the firm keeps once for every seat",
    `desk: ${JSON.stringify(s.desk)}`,
    `desk_id: ${s.desk_id}`,
    `layout_version: ${L.LAYOUT}`,
    `model_version: ${s.model_version}`,
  ];
  if (s.pack !== undefined) lines.push(`pack: ${s.pack}`, `pack_version: ${s.pack_version}`);
  lines.push(`desk_head: ${deskHead ? asText(deskHead) : BLANK}`, `seats: [${[...old.seats.keys()].sort().map(asText).join(", ")}]`, `converted_seats: [${converted.map(asText).join(", ")}]`, "---", "");
  lines.push(`# ${s.desk}: the common space`, "", "What the firm keeps once for every seat: the soul, the context, the desk's own words, the", "learnings and the rulebook, the names supplied, the name list and the default parts.", "");
  return lines.join("\n");
}

function defaultsText() {
  return ["---", "type: defaults", "title: Default parts", "description: Where each kind of page goes in a seat's graph, as shipped", "---", "", L.defaultsTable(), ""].join("\n");
}

// The name list: what was there, kept whole, with a row for each name not on it yet, each once.
function namesText(was, names) {
  const head = ["---", "type: names", "title: Names", "description: One name for one person, family or firm across the firm, with what ties it to the world", "---", "", "| name | kind | lead_id | company_id | firm_id |", "|---|---|---|---|---|"];
  const text = was === null ? `${head.join("\n")}\n` : was;
  const t = tableOf(text);
  const have = new Set(t ? t.rows.map((row) => cellsOf(row)[0]) : []);
  const add = names
    .map((n) => ({ ...n, name: L.stemOf(n.rel) }))
    .filter((n) => !have.has(n.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((n) => {
      const h = isMapping(n.head) ? n.head : {};
      const id = (key) => (typeof h[key] === "string" && h[key].trim() ? h[key].trim() : BLANK);
      return `| ${n.name} | ${n.type} | ${BLANK} | ${id("cin")} | ${id("crm_id")} |`;
    });
  if (!add.length) return text;
  if (!t) return `${text}${add.join("\n")}\n`;
  return withRows(t, [...t.rows, ...add]);
}

// The common log and a graph's log: begun with one line naming the conversion; a later run adds
// its line under the day's heading. Written only when the run writes something else.
function logged(was, date, line) {
  if (was === null) return `# Log\n\n## ${date}\n\n${line}\n`;
  const heading = `## ${date}\n\n`;
  const at = was.indexOf(heading);
  if (at !== -1) return `${was.slice(0, at + heading.length)}${line}\n${was.slice(at + heading.length)}`;
  const top = was.indexOf("\n\n");
  return top === -1 ? `${was}\n${heading}${line}\n` : `${was.slice(0, top + 2)}${heading}${line}\n\n${was.slice(top + 2)}`;
}

// What the run would write, each against what the target holds now: `writes`, the files to write;
// `refused`, a target holding a file the converter did not write, or one changed since it did;
// `kept`, a common file changed in the common space since the converter wrote it.
// - In a graph: a file there whose bytes are the record's is the converter's own, unchanged, and
//   is written again from the desk (a re-run before the switch rebuilds the graphs from it).
// - In the common space: a file still the converter's own is written again from the desk, so a
//   later conversion carries what the seats still on the desk added to its desk-wide pages; one
//   changed there since is kept as it is and said (`kept`), never written over and never a stop;
//   the name list only gains rows; the common space's stamps, changed since, are refused.
// - Anywhere: a file there the record does not name is not the converter's, and refused.
// `stale`, a file an earlier run wrote in a graph this run rebuilds, which the desk no longer
// places there: nothing is deleted, so it stays, and the preview says so.
function against(firm, derived) {
  const writes = [];
  const refused = [];
  const kept = [];
  const names = `${L.COMMON}/${L.NAMES}`;
  const stamps = `${L.COMMON}/${L.COMMON_STAMPS}`;
  for (const [rel, bytes] of derived.out) {
    const file = path.join(firm, ...rel.split("/"));
    const there = fs.existsSync(file) ? readRegular(file) : null;
    if (there !== null && there.equals(bytes)) continue;
    const recorded = Object.hasOwn(derived.record.files, rel);
    const ours = there !== null && recorded && derived.record.files[rel] === sha(there);
    if (there === null || rel === names) writes.push(rel);
    else if (!recorded) refused.push(rel);
    else if (!rel.startsWith(`${L.COMMON}/`) || rel === stamps) (ours ? writes : refused).push(rel);
    else (ours ? writes : kept).push(rel);
  }
  const rebuilt = (rel) => derived.seats.some((s) => rel.startsWith(`${L.SEATS}/${s}/`));
  const stale = Object.keys(derived.record.files)
    .filter((rel) => rebuilt(rel) && !derived.out.has(rel) && fs.existsSync(path.join(firm, ...rel.split("/"))))
    .sort();
  return { writes, refused, kept, stale };
}

function planOf(desk, firm, opts, derived, writes) {
  const h = sha256();
  for (const rel of derived.old.rels) h.update(`${rel}\0${sha(derived.old.files.get(rel))}\0`);
  for (const rel of writes) h.update(`w\0${rel}\0${sha(derived.out.get(rel))}\0`);
  h.update(JSON.stringify({ seats: opts.seats, desk_head: derived.deskHead, rest_to: derived.restTo, seat_for: opts.seat_for || {}, switch: Boolean(opts.switch) }));
  return h.hex().slice(0, 16);
}

function copyName(desk, date, n = 1) {
  return `${path.basename(desk)}-before-convert-${date}${n === 1 ? "" : `-${n}`}`;
}

// The day's first copy name beside the desk that neither a copy nor a copy cut short holds: each
// run that writes makes its own copy of the desk as it then stands, and none is written over.
function freeCopyName(desk, date) {
  const taken = (name) => {
    try {
      fs.lstatSync(path.join(path.dirname(desk), name));
      return true;
    } catch {
      return false;
    }
  };
  for (let n = 1; ; n += 1) {
    const name = copyName(desk, date, n);
    if (!taken(name) && !taken(`${name}.partial`)) return name;
  }
}

// The preview: what the conversion would write, what it asks, and its plan. Writes nothing.
function previewConvert(desk, firm, opts) {
  return prepared(desk, firm, opts).preview;
}

// The folder the disk holds at `p`, by its device and number: a second spelling of a folder (a
// firmlink, a case-blind name) is the same folder.
function folderId(p) {
  const st = fs.statSync(p, { bigint: true });
  return `${st.dev}:${st.ino}`;
}

// Whether the folder the disk holds at `outer` is on the way up from `inner`: from the nearest of
// its folders that is there, with the links on its way resolved, each folder compared as the disk
// holds it. The walk stops at `outer`'s own parent, which no folder under `outer` is above, so it
// looks no higher than the two folders' meeting place.
function holds(outer, inner) {
  const target = folderId(outer);
  const above = path.dirname(outer) === outer ? null : folderId(path.dirname(outer));
  let at = path.resolve(inner);
  while (!fs.existsSync(at) && path.dirname(at) !== at) at = path.dirname(at);
  at = fs.realpathSync(at);
  for (;;) {
    const id = folderId(at);
    if (id === target) return true;
    if (id === above || path.dirname(at) === at) return false;
    at = path.dirname(at);
  }
}

// The firm folder is beside the desk: neither inside it nor holding it, as the disk holds both.
function besideDesk(desk, firm) {
  return !holds(desk, firm) && !(fs.existsSync(firm) && holds(firm, desk));
}

function prepared(desk, firm, opts) {
  if (!besideDesk(desk, firm)) throw stop("reading the desk", "the firm folder must be beside the desk, neither inside it nor holding it: the converter never writes in the desk. Nothing was written");
  const derived = derive(desk, firm, opts);
  const { writes, refused, kept, stale } = against(firm, derived);
  const switching = Boolean(opts.switch) && !alreadySwitched(derived.old);
  // The switch makes every writer refuse the desk, so it rides a run that rebuilds every graph
  // already written, from the desk as it stands: no converted seat's work there since an earlier
  // wave is left behind. A seat never converted has no graph after it and does not run
  // (Addendum 19 section 6), and the preview names it. A seat converted earlier that is no longer
  // one of the desk's seats cannot be in a run (derive refuses it), so it never holds the switch
  // back: its graph stays as the earlier run wrote it, and the preview says so.
  const departed = derived.converted.filter((h) => !derived.old.seats.has(h));
  const missing = derived.converted.filter((h) => derived.old.seats.has(h) && !opts.seats.includes(h));
  if (switching && missing.length) {
    throw stop(
      "reading the desk",
      `switch true marks the desk converted, and every writer then refuses it, so it rides a run that rebuilds every graph already written, from the desk as it stands; ${missing.join(", ")} ${missing.length === 1 ? "was" : "were"} converted earlier and ${missing.length === 1 ? "is" : "are"} not in this run's seats. Add ${missing.length === 1 ? "it" : "them"}, then switch. Nothing was written`,
    );
  }
  const stopping = switching ? [...derived.old.seats.keys()].filter((h) => !derived.converted.includes(h)).sort() : [];
  if (switching && headerEnd(derived.old.files.get("desk.md").toString("utf8")) === null) {
    throw stop("reading the desk", "switch true marks the desk's desk.md, and its header has no end to mark the line under, so nothing was written");
  }
  const asked = derived.ask.pages_without_seat.length || derived.ask.desk_head || derived.ask.rest_to;
  const lines = [];
  if (refused.length) lines.push(`Refused at apply: ${refused.length} target file${refused.length === 1 ? "" : "s"} changed since the converter wrote ${refused.length === 1 ? "it" : "them"}, or written by hand; nothing will be written over.`);
  if (kept.length) lines.push(`Kept as ${kept.length === 1 ? "it is" : "they are"}: ${kept.length} file${kept.length === 1 ? "" : "s"} in the common space changed there since the converter wrote ${kept.length === 1 ? "it" : "them"} (${kept.join(", ")}); the desk's copy is not carried over ${kept.length === 1 ? "it" : "them"}.`);
  if (stale.length) lines.push(`Left from an earlier run: ${stale.length} file${stale.length === 1 ? "" : "s"} in the graphs this run rebuilds that the desk no longer places there (${stale.join(", ")}); nothing is deleted, so ${stale.length === 1 ? "it stays" : "they stay"} until removed by hand.`);
  if (asked) lines.push("Answer first: the apply refuses until every question below is answered.");
  lines.push(
    `${writes.length} file${writes.length === 1 ? "" : "s"} to write beside the desk, in ${opts.seats.length} graph${opts.seats.length === 1 ? "" : "s"} and the common space; nothing in the desk changes${switching ? " but the one switch line in its desk.md" : ""}, and nothing is deleted.`,
  );
  if (stopping.length) {
    lines.push(`After the switch ${stopping.join(", ")} ${stopping.length === 1 ? "has no graph and does not run" : "have no graph and do not run"} until a later conversion gives ${stopping.length === 1 ? "it one" : "them theirs"}; ${stopping.length === 1 ? "its" : "their"} pages stay in the old desk.`);
  }
  if (switching && departed.length) {
    lines.push(`${departed.join(", ")} ${departed.length === 1 ? "was" : "were"} converted earlier and ${departed.length === 1 ? "is" : "are"} no longer a seat of this desk, so the switch rebuilds no graph for ${departed.length === 1 ? "it" : "them"}; ${departed.length === 1 ? "its graph stays" : "their graphs stay"} as the earlier run wrote ${departed.length === 1 ? "it" : "them"}.`);
  }
  lines.push(
    `${derived.counts.placed} pages placed (${derived.counts.placed_byte_equal} byte for byte, ${derived.counts.pages_repointed} with a pointer re-pointed, ${derived.counts.placed - derived.counts.placed_byte_equal - derived.counts.pages_repointed} changed only in their sent list; ${derived.counts.sent_lists_drawn} sent list${derived.counts.sent_lists_drawn === 1 ? "" : "s"} drawn from the graph's own sent pages); ${derived.counts.left_for_seats_not_converted} left for seats not converted, with ${derived.counts.rows_left} table row${derived.counts.rows_left === 1 ? "" : "s"}; ${derived.counts.leads_left} lead pages left for the graph job; ${derived.counts.merges_left} merge-record files left as the desk's history.`,
    `Placed in a seat's graph only because a page there links them: ${derived.counts.linked_in.person} person, ${derived.counts.linked_in.family} family and ${derived.counts.linked_in.firm} firm pages.`,
  );
  const rows = derived.counts.merge_rows_carried + derived.counts.merge_rows_left;
  if (rows) {
    const { merge_rows_carried: carried, merge_rows_left: left } = derived.counts;
    lines.push(`Of the overnight's merge record, ${carried} row${carried === 1 ? "" : "s"} carried, each into every graph that holds its conversation, and ${left} left with the desk, ${left === 1 ? "its conversation" : "their conversations"} in no graph.`);
  }
  // The runner's own files (outside celorus/, or under it and shared by the writers' table with no
  // one): on this machine alone, so into the runner's graph alone (the base's rulings
  // c/6167970275 and c/6169137770 item 5).
  const ownN = derived.counts.own_copied;
  if (ownN) lines.push(`The runner's own, into its graph alone: ${ownN} file${ownN === 1 ? "" : "s"} a placed page names in \`file\`, outside celorus/ or under it and shared by the writers' table with no one, copied byte for byte into the graph of the seat running the conversion (${opts.handle}), so ${ownN === 1 ? "its pointer opens" : "their pointers open"} unchanged; nothing in the desk or its folders changes.`);
  const leftN = derived.counts.own_not_carried;
  if (leftN) lines.push(`Not carried, for ${leftN} page${leftN === 1 ? "" : "s"} placed in another seat's graph: the file of the runner's own ${leftN === 1 ? "it names" : "each names"} in \`file\`. Such a file is on this machine alone, as no sync shares it, so it goes into no other seat's graph; the page is placed there without it, its pointer opening nothing until the file is shared by hand.`);
  const whole = derived.ownFiles.whole;
  if (whole.length) {
    const settings = whole.filter((rel) => rel.startsWith(".obsidian/")).length;
    const named = [...whole.filter((rel) => !rel.startsWith(".obsidian/")).map((rel) => `celorus/${rel}`), ...(settings ? [`${settings} of Obsidian's settings`] : [])];
    const into = opts.seats.includes(opts.handle) ? `into the graph of the seat running the conversion (${opts.handle}) alone` : `into no graph, as the seat running the conversion (${opts.handle}) is not converted here`;
    lines.push(`The runner's own, whole: ${whole.length} file${whole.length === 1 ? "" : "s"} under celorus/ the writers' table shares with no one (${named.join(", ")}) ${whole.length === 1 ? "goes" : "go"} ${into}, never into another seat's graph or the common space.`);
  }
  // The pages of the runner's own (the base's ruling A2, c/6169769956).
  const ownPages = derived.ownFiles.pages;
  if (ownPages.length) {
    const one = ownPages.length === 1;
    const into = opts.seats.includes(opts.handle) ? `into the personal part of the graph of the seat running the conversion (${opts.handle}) alone` : `into no graph, as the seat running the conversion (${opts.handle}) is not converted here, and ${one ? "stays" : "stay"} in the old desk`;
    lines.push(`The runner's own pages: ${ownPages.length} page${one ? "" : "s"} under celorus/ the writers' table shares with no one (${ownPages.map((rel) => `celorus/${rel}`).join(", ")}) ${one ? "goes" : "go"} ${into}, whatever seat ${one ? "it names" : "each names"}; never into another seat's graph, the common space or the name list, and a link to ${one ? "it" : "one"} from another seat's graph opens nothing there.`);
  }
  // Each file a page names by name, with every copy and its graph, and each seat whose graph holds
  // a page naming it and is not given it (the base's ruling c/6167970275); and each page of the
  // runner's own a page in another seat's graph links or points at, with those seats (A2).
  const ownByFile = new Map();
  for (const [list, key] of [[derived.ownFiles.copied, "copies"], [derived.ownFiles.not_carried, "left"], [derived.ownFiles.pages_named, "left"]]) {
    for (const at of list) {
      const [, seat, ...rest] = at.split("/");
      const file = rest.join("/");
      if (!ownByFile.has(file)) ownByFile.set(file, { copies: [], left: [] });
      ownByFile.get(file)[key].push(key === "copies" ? `${at} (${seat}'s graph)` : seat);
    }
  }
  for (const file of [...ownByFile.keys()].sort()) {
    const f = ownByFile.get(file);
    // one moved whole (a CRM export, a file under context/) is in the runner's personal part
    const moved = file.startsWith("celorus/") ? `${L.SEATS}/${opts.handle}/celorus/${L.PERSONAL}/${file.slice("celorus/".length)}` : null;
    const where = f.copies.length ? `copied to ${f.copies.join(", ")}` : moved && derived.out.has(moved) ? `whole in ${moved} (${opts.handle}'s graph)` : "copied into no graph";
    lines.push(`- ${file}: ${where}${f.left.length ? `; named by a page in the graph of ${f.left.join(", ")}, not carried there` : ""}.`);
  }
  if (derived.counts.attachments_not_carried) lines.push(`Not carried: the file ${derived.counts.attachments_not_carried} page${derived.counts.attachments_not_carried === 1 ? " names" : "s name"} in \`file\`, being under a hidden folder, outside the desk, reached through a link, not there, kept in the desk (the views, the merge records), or placed whole elsewhere by a rule of its own (the common space, the part of the graph the files no seat names go to); ${derived.counts.attachments_not_carried === 1 ? "that page is" : "those pages are"} placed without it.`);
  if (opts.unsent_writes !== undefined && opts.unsent_writes !== 0) lines.push("Refused at apply: the desk has writes not yet sent to its storage.");
  const preview = {
    text: lines.join("\n"),
    plan: planOf(desk, firm, opts, derived, writes),
    writes,
    refused,
    kept,
    stale,
    ask: derived.ask,
    counts: derived.counts,
    desk_head: derived.deskHead,
    switching,
    stopping,
  };
  return { preview, derived };
}

// The end of desk.md's header, with the line end the file has before it (a Windows checkout's
// \r\n, an old Mac's \r): null when there is none to mark.
function headerEnd(text) {
  const m = /(\r\n|\r|\n)---(?:\r\n|\r|\n|$)/u.exec(text);
  return m === null ? null : { index: m.index, eol: m[1] };
}

function alreadySwitched(old) {
  return Object.hasOwn(old.stamps, "converted");
}

// The apply: on the preview's plan, with every question answered and the caller's word that no
// write waits to be sent. A dated copy of the whole desk first; then the record of the plan; then
// the graphs and the common space; then the check that nothing is deleted; then the switch line.
function applyConvert(desk, firm, opts) {
  if (!Number.isInteger(opts.unsent_writes)) {
    throw new Refusal("unsent_writes is required on an apply: the number of the desk's writes not yet sent to its storage (0 when none). It is never read as none.");
  }
  if (opts.unsent_writes !== 0) throw stop("reading the desk", "the desk has writes not yet sent to its storage; send them first, so nothing was written");
  const { preview: p, derived } = prepared(desk, firm, opts);
  if (p.plan !== opts.plan) throw stop("reading the desk", "what the conversion would do now is not the plan the preview showed, so it did not run; preview again, show that preview, and ask again");
  const a = p.ask;
  if (a.pages_without_seat.length) throw stop("reading the desk", `${a.pages_without_seat.length} page${a.pages_without_seat.length === 1 ? " names" : "s name"} no seat and the preview gave none (${a.pages_without_seat.join(", ")}); the converter never guesses a seat, so nothing was written`);
  if (a.desk_head) throw stop("reading the desk", `the desk head must be a converted seat (${a.desk_head.choose_from.join(" or ")}) and none was named, so nothing was written`);
  if (a.rest_to) throw stop("reading the desk", "some pages, the book's rows or table rows name no seat of the desk and no seat was named for them (rest_to), so nothing was written");
  if (p.refused.length) throw stop("checking the targets", `${p.refused.join(", ")} ${p.refused.length === 1 ? "was" : "were"} changed since the converter wrote ${p.refused.length === 1 ? "it" : "them"}, or not written by it; nothing is written over a hand change, so nothing was written`);
  if (!p.writes.length && !p.switching) return { written: [], copy: null, kept: p.kept, counts: p.counts, desk_head: p.desk_head, ...drawViews(firm, opts.seats, opts.now, Object.keys(derived.record.files)) };

  const date = opts.now.slice(0, 10);
  const time = opts.now.slice(11, 16);
  const written = [];
  const at = (rel) => path.join(firm, ...rel.split("/"));
  let where = "making the dated copy";
  const before = new Map(derived.old.rels.map((rel) => [rel, sha(derived.old.files.get(rel))]));
  const targetsBefore = fs.existsSync(firm) ? filesUnder(firm, where) : [];
  let copyAs;
  try {
    // A copy of the whole desk as this run reads it, before its first write: made under a .partial
    // name and given its own only once whole, so a copy cut short is never taken for one.
    copyAs = freeCopyName(derived.old.root, date);
    const partial = path.join(path.dirname(derived.old.root), `${copyAs}.partial`);
    const odd = oddUnder(derived.old.root);
    if (odd.length) throw stop(where, `${odd.join(", ")} cannot be copied as a file (a pipe, a socket or a device), so no copy was made; move ${odd.length === 1 ? "it" : "them"} out of the desk folder and convert again. Nothing was written`, written);
    fs.cpSync(derived.old.root, partial, { recursive: true, filter: (src) => path.basename(src) !== ".git", errorOnExist: true, force: false });
    fs.renameSync(partial, path.join(path.dirname(derived.old.root), copyAs));
    if (p.writes.length) {
      where = "recording the plan";
      makeFolders(firm);
      const files = { ...derived.record.files };
      for (const rel of p.writes) files[rel] = sha(derived.out.get(rel));
      for (const [rel, text] of recordsOf(derived.old.stamps.desk_id, files, derived.converted)) {
        // A seat's record as it is already, as a graph this run leaves alone has it, is not written
        // again, so nothing in that seat's folder changes.
        if (fs.existsSync(at(rel)) && readRegular(at(rel), "utf8") === text) continue;
        makeFolders(path.dirname(at(rel)));
        writePage(at(rel), text);
        written.push(rel);
      }
      const line = `* ${time} · ${opts.handle} · convert-desk · converted from layout 2: ${derived.converted.join(", ")} · yours`;
      for (const rel of p.writes) {
        where = rel.startsWith(`${L.COMMON}/`) ? "writing the common space" : "writing the graphs";
        makeFolders(path.dirname(at(rel)));
        writePage(at(rel), derived.out.get(rel));
        written.push(rel);
      }
      where = "writing the common space";
      const logs = [`${L.COMMON}/${L.COMMON_LOG}`, ...opts.seats.map((s) => `${L.SEATS}/${s}/celorus/log.md`)];
      for (const rel of logs) {
        const was = fs.existsSync(at(rel)) ? readRegular(at(rel), "utf8") : null;
        if (was !== null && rel !== logs[0]) continue;
        writePage(at(rel), logged(was, date, line));
        written.push(rel);
      }
    }
    where = "checking nothing is deleted";
    const gone = [...before.keys()].filter((rel) => !fs.existsSync(path.join(derived.old.celorus, ...rel.split("/"))));
    const lost = targetsBefore.filter((rel) => !fs.existsSync(at(rel)));
    if (gone.length || lost.length) throw stop(where, `${[...gone, ...lost].join(", ")} is not there any more`, written);
    if (p.switching) {
      where = "switching";
      const deskMd = path.join(derived.old.celorus, "desk.md");
      const text = readRegular(deskMd, "utf8");
      const end = headerEnd(text);
      if (end === null) throw stop(where, "the desk's desk.md has no header end to mark", written);
      writePage(deskMd, `${text.slice(0, end.index)}${end.eol}converted: ${date}${text.slice(end.index)}`);
      written.push("the desk's desk.md");
    }
  } catch (err) {
    if (err instanceof ConvertStopped) throw err;
    const words = err instanceof Refusal ? err.message : `the file system refused (${err && err.code ? err.code : "no reason given"})`;
    throw stop(where, written.length ? `${words}; written before the stop: ${written.join(", ")}; run it again to resume` : `${words}; nothing was written`, written);
  }
  return { written, copy: copyAs, kept: p.kept, counts: p.counts, desk_head: derived.deskHead, ...drawViews(firm, opts.seats, opts.now, [...Object.keys(derived.record.files), ...p.writes]) };
}

// The views of each graph this run converts, drawn last with the engine's own view writer (T19),
// from the graph as written, on every apply that reaches its end: a graph's three, when one is
// missing or older than a file the conversion keeps (`kept`, by its path in the firm folder) in
// that graph or in the common space, which its views read. So a run stopped after its writes and
// before the views draws them when run again, and a run that changes nothing changes no view. They
// are in no record: render_views draws them again at every call, with its own time. One that cannot
// be drawn leaves the conversion as it is, done, and is named with its reason, for render_views on
// that graph: the model page that cannot be read, the folder on its way that is a file or a link,
// by its path in the seat's folder, a refusal's own words, or the file system's error code; never a
// path on the machine.
function drawViews(firm, seats, now, kept) {
  const views_drawn = [];
  const views_not_drawn = [];
  const changed = (rel) => {
    try {
      return fs.statSync(path.join(firm, ...rel.split("/")), { bigint: true }).mtimeNs;
    } catch {
      return null;
    }
  };
  for (const s of [...seats].sort()) {
    const graph = path.join(firm, L.SEATS, s);
    const newest = kept
      .filter((rel) => rel.startsWith(`${L.SEATS}/${s}/`) || rel.startsWith(`${L.COMMON}/`))
      .reduce((n, rel) => {
        const t = changed(rel);
        return t !== null && t > n ? t : n;
      }, -1n);
    const fresh = (name) => {
      const t = changed(`${L.SEATS}/${s}/celorus/views/${name}`);
      return t !== null && t >= newest;
    };
    if (VIEWS.every(fresh)) continue;
    try {
      const built = renderViews(graph, now);
      makeFolders(path.join(graph, "celorus", "views"));
      for (const name of VIEWS) {
        writePage(path.join(graph, "celorus", "views", name), built.views[name]);
        views_drawn.push(`${L.SEATS}/${s}/celorus/views/${name}`);
      }
    } catch (err) {
      let why = `the file system refused (${err && err.code ? err.code : "no reason given"}).`;
      if (err instanceof ModelUnreadable) why = `${err.message} cannot be read.`;
      else if (err instanceof NotOwnFolder) why = `${err.said(path.relative(graph, err.file).split(path.sep).join("/"))}.`;
      else if (err instanceof Refusal) why = err.message;
      views_not_drawn.push({ seat: s, why });
    }
  }
  return { views_drawn, views_not_drawn };
}

module.exports = { STEPS, RECORD, ConvertStopped, previewConvert, applyConvert, derive, belongs, graphStamps, copyName, besideDesk };
