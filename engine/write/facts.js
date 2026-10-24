"use strict";
// What the writers read of the desk before they write: its seats, whether a slug names a page
// it has, a page's title, the people of a family, and the footer a demo desk asks for.

const fs = require("node:fs");
const path = require("node:path");
const { readPage, splitPage } = require("../lib/desk.js");
const { parseHeader, HeaderError } = require("../lib/header.js");
const { codeOf } = require("../lib/inplace.js");
const { Refusal } = require("../lib/refusal.js");
const { linksIn, linkSpans, linkName } = require("../check/text.js");
const { linkKind, linkedSaid, linkOnWay } = require("../lib/linkedroot.js");
const { HANDLE, pyStrip } = require("./text.js");
const { LAYOUT, SHARED, PERSONAL, PARTS, COMMON_STAMPS, NAMES, defaultPart, commonOfGraph } = require("../layout/layout.js");

// The folders a writer's slug may name a page in.
const FOLDERS = ["families", "people", "firms", "seats"];
// The layouts a desk.md may state, each a whole number (reader 3's ruling, c/6225848393): any
// other value of layout_version (text, blank, 0, a list) states no layout.
const LAYOUTS = Object.freeze([1, 2, LAYOUT]);

// The form desk.md's seats key must take, said in every refusal of another form.
const SEATS_FORM = "seats: [as, kb], each seat's handle or a link to its page";

// desk.md's `seats:` line as it stands in its header, or null when it has none.
function seatsLine(header) {
  const m = /^seats[ \t]*:.*$/mu.exec(header);
  return m ? m[0] : null;
}

// The first line of desk.md's header at which it stops reading, counted from 1 in the header
// (its line in desk.md is one more, for the opening ---), and the text of that line: each
// longer run of the header's lines is read in turn, and the first that does not read ends at
// that line. The whole header does not read when this is asked, so a line is always found.
function failingLine(header) {
  const lines = header.split("\n");
  for (let k = 1; k <= lines.length; k += 1) {
    try {
      parseHeader(lines.slice(0, k).join("\n"));
    } catch (err) {
      if (!(err instanceof HeaderError)) throw err;
      return { at: k, line: lines[k - 1] };
    }
  }
  return { at: lines.length, line: lines[lines.length - 1] };
}

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

// desk.md as a call reads it: the seats it declares, each by its handle, or null when it
// declares no seats list, and the footer line a demo desk asks for (`page_footer: <line>`), or
// null. A call reads desk.md once, here, and every reader in engine/write and engine/sync takes
// its data from what this answers, never from a read of its own. `id` is desk.md's dev and ino
// from this one lstat (never through a link), or null when there is no desk.md: a page the
// writers own that is desk.md by a second name is refused by it (pages.js readOwned). `graph` says
// desk.md is a seat's graph's (layout_version 3), and `seat` is then its `seat:` when that is one
// value of text, else null; on any other desk `graph` is false and `seat` null.
// desk.md declares no seats list in exactly two states, and then the seats are the seat pages
// that say type: seat (the kit's rule):
//   (A) fs.lstatSync(desk.md) throws ENOENT: there is no entry at all.
//   (B) desk.md is a regular file (checked with lstat, not a link), reads as valid UTF-8, its
//       header parses as a mapping, and that mapping has no `seats` key.
// Every other state refuses, naming desk.md and the state, with nothing written. That
// includes: a symlink, dangling or not; a folder; EACCES or any other read error; bytes that
// are not valid UTF-8; a header that is not a mapping (a list, a scalar, empty); a `seats` key
// in a form it cannot read as a list.
// A UTF-8 byte-order mark is refused by name: the kit reads a page as plain UTF-8 and keeps the
// mark, so it would find no header there. A header that does not parse is refused naming its
// first failing line by number, never the line's text.
// With `parts`, a folder that holds a seat's graph's parts while desk.md does not say it is a graph
// is refused too (notGraphSaid), as every writer's door asks (slice E6b-2b).
function deskMd(celorus, done, { parts = false } = {}) {
  const file = path.join(celorus, "desk.md");
  const refused = (state) => new Refusal(`desk.md ${state}, so no seat can be held to the seats it declares. ${done}`);
  let entry;
  try {
    entry = fs.lstatSync(file, { bigint: true });
  } catch (err) {
    if (err && err.code === "ENOENT") {
      const said = parts ? notGraphSaid(celorus, null, false) : null;
      if (said !== null) throw new Refusal(`${said} ${done}`);
      return { seats: null, footer: null, id: null, name: null, graph: false, seat: null }; // (A)
    }
    throw refused(`could not be read (${codeOf(err)})`);
  }
  if (entry.isSymbolicLink()) throw refused("is a link, not the page itself");
  if (entry.isDirectory()) throw refused("is a folder, not a page");
  if (!entry.isFile()) throw refused("is not a regular file");
  const id = { dev: entry.dev, ino: entry.ino }; // BigInt, as pages.js readOwned compares it
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (err) {
    throw refused(`could not be read (${codeOf(err)})`);
  }
  if (bytes.subarray(0, BOM.length).equals(BOM)) {
    throw refused("starts with a byte-order mark, which the desk's pages do not carry: save it as UTF-8 without one");
  }
  let text;
  try {
    text = STRICT_UTF8.decode(bytes).replace(/\r\n?/g, "\n");
  } catch {
    throw refused("is not readable as UTF-8");
  }
  const split = splitPage(text);
  if (split === null) throw refused("has no header of keys and values");
  let head;
  try {
    head = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    const bad = failingLine(split.header);
    const at = bad.at + 1;
    if (/^seats[ \t]*:/u.test(bad.line)) {
      throw new Refusal(
        `desk.md's header does not read at its line ${at}, its seats: line, so no seat can be held to it: ` +
          `write it as ${SEATS_FORM}. ${done}`,
      );
    }
    throw new Refusal(`desk.md's header does not read at its line ${at}, so the seats it declares cannot be read: correct that line. ${done}`);
  }
  if (head === null || typeof head !== "object" || Array.isArray(head)) {
    throw refused("has a header that is not a mapping of keys and values (a list, a single value, or nothing)");
  }
  const said = parts ? notGraphSaid(celorus, head, true) : null;
  if (said !== null) throw new Refusal(`${said} ${done}`);
  const footer = footerIn(head);
  // The desk by its own name (desk.md's `desk:`), never by its folder: an answer names the desk
  // by it (0.19.0 round 1 readers, K4).
  const name = typeof head.desk === "string" ? head.desk : null;
  // A seat's graph is one seat's: its desk.md names the seat in `seat:` and holds no seats: list
  // (convert.js graphStamps); the firm's list of seats is the common space's.
  const graph = head.layout_version === LAYOUT;
  const seat = graph && typeof head.seat === "string" ? head.seat : null;
  if (!Object.hasOwn(head, "seats")) return { seats: null, footer, id, name, graph, seat }; // (B)
  const seats = head.seats;
  if (Array.isArray(seats) && seats.every((entry) => typeof entry === "string")) {
    // An entry is a handle or a link to the seat's page, "[[kabir]]", read by the one link
    // reader (check/text.js).
    const handles = seats.map((entry) => {
      const found = linksIn(entry);
      return found.length ? found[0] : entry;
    });
    return { seats: handles, footer, id, name, graph, seat };
  }
  const line = seatsLine(split.header);
  throw new Refusal(
    `desk.md's line ${JSON.stringify(line === null ? "seats:" : line)} does not read as a list of seats, so no seat can be ` +
      `held to it: write it as ${SEATS_FORM}. ${done}`,
  );
}

// The handles of the seat pages in `folder` (seats/, under the celorus folder) whose header says
// `type: seat`, sorted. A file whose name is not a handle is never a seat, whatever its header says.
function seatPages(celorus, folder = "seats") {
  let names;
  try {
    names = fs.readdirSync(path.join(celorus, ...folder.split("/")));
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md") && HANDLE.test(name.slice(0, -3)))
    .map((name) => name.slice(0, -3))
    .filter((handle) => {
      if (!isFile(path.join(celorus, ...folder.split("/"), `${handle}.md`))) return false;
      const head = readPage(celorus, `${folder}/${handle}.md`).head;
      return head !== null && typeof head === "object" && head.type === "seat";
    })
    .sort();
}

// The desk's seats, the ones it declares: each a seat page, seats/<handle>.md, whose header
// says `type: seat`, and, when desk.md carries a `seats:` list, one it names. A file in seats/
// is never a seat by its name alone. Every writer and desk_sync hold a seat to this list, and
// name it when they refuse one (house rule 6); there is no other writer's name. `why`, when the
// list is empty, says why: which declared seats have no seat page, and which seat pages are not
// declared. `desk` is the call's one read of desk.md (deskMd). A seat's graph has one seat, the
// one its desk.md names in `seat:`, when its seat page, shared/seats/<handle>.md, says type: seat:
// the graph is that seat's alone, and no other seat is held to it.
function seatsOf(celorus, desk) {
  if (desk.graph) {
    const own = desk.seat !== null && seatPages(celorus, `${SHARED}/seats`).includes(desk.seat);
    if (own) return { handles: [desk.seat], why: null, own: desk.seat };
    const why =
      desk.seat === null
        ? "this desk is a seat's graph, and its desk.md names no seat in one seat: value"
        : `this desk is ${desk.seat}'s graph, and ${desk.seat} has no seat page under ${SHARED}/seats/ that says type: seat`;
    return { handles: [], why };
  }
  const listed = desk.seats;
  const pages = seatPages(celorus);
  const handles = listed === null ? pages : pages.filter((handle) => listed.includes(handle));
  if (handles.length) return { handles, why: null };
  const undeclared = pages.length ? `; the seat pages that say type: seat, ${pages.join(", ")}, are not in that list` : "";
  let why;
  if (listed === null) why = "no seat page on this desk says type: seat";
  else if (!listed.length) why = `desk.md's seats: list is empty${undeclared}`;
  else {
    why =
      `desk.md's seats: list names ${listed.join(", ")}, and none of them has a seat page that says type: seat` +
      (undeclared || "; no seat page on this desk says type: seat");
  }
  return { handles, why };
}

function seatHandles(celorus, desk) {
  return seatsOf(celorus, desk).handles;
}

// The seats as a refusal names them: the handles, or "none" and why.
function seatsNamed(seats) {
  return seats.handles.length ? seats.handles.join(", ") : `none, since ${seats.why}`;
}

// Refuses `value` as the seat `what` names when it is not one of `seats` (seatsOf), naming them, or
// on a seat's graph naming the one seat that writes in it (reader 1's low, c/6215653403: a graph's
// refusal never lists the firm's seats it would then refuse). `echo` false never repeats the value.
function seatHeld(what, value, seats, done, { echo = true } = {}) {
  if (typeof value === "string" && seats.handles.includes(value)) return;
  const got = echo ? `; got ${JSON.stringify(value)}` : "";
  if (seats.own) throw new Refusal(`${what} must be this graph's seat: this desk is ${seats.own}'s graph, and only ${seats.own} writes in it${got}. ${done}`);
  throw new Refusal(`${what} must be a seat handle, one of: ${seatsNamed(seats)}${got}. ${done}`);
}

// The seats of the firm a seat's graph names, by their seat pages in its shared part that say type:
// seat: the seats a hand-over and a lead may go to, and a said line may be labelled with. When the
// firm's common space beside the graph says a seats: list (common.md, as convert.js writes it), only
// the pages it names, as desk.md's list holds a flat desk's (seatsOf): a seat that has left the list
// keeps its page, and is never a seat (E6b-2c panel). The list only narrows the pages, never adds a
// seat. On any other desk, its seats (seatHandles).
function firmSeats(celorus, desk) {
  if (!desk.graph) return seatHandles(celorus, desk);
  const pages = seatPages(celorus, `${SHARED}/seats`);
  const listed = firmList(path.dirname(celorus));
  return listed === null ? pages : pages.filter((handle) => listed.includes(handle));
}

// The firm's seats: list in common.md beside the graph at `root`, each entry a handle or a link to
// the seat's page, or null when no common space is beside it, it holds no common.md, or its
// common.md says no such list. A common.md whose header does not read, and a list that does not read
// as one, are refused, as desk.md's are on a flat desk (deskMd), never read as no list (E6b-2c fix
// round reader). A common.md that is a link to nothing is there, and does not read.
function firmList(root) {
  const dir = commonOfGraph(root);
  if (dir === null || !entryAt(path.join(dir, COMMON_STAMPS))) return null;
  const page = readPage(dir, COMMON_STAMPS);
  const head = page.head;
  if (head === null || typeof head !== "object" || Array.isArray(head)) {
    throw new Refusal(
      `The firm's common.md does not read (${page.problem || "its header is not a list of keys"}), so no seat of the firm can be held to it: its header says the firm's seats as ${SEATS_FORM}. Nothing was written.`,
    );
  }
  if (!Object.hasOwn(head, "seats")) return null;
  const seats = head.seats;
  if (!Array.isArray(seats) || !seats.every((entry) => typeof entry === "string")) {
    throw new Refusal(
      `The firm's common.md says a seats: line that does not read as a list of seats, so no seat of the firm can be held to it: write it as ${SEATS_FORM}. Nothing was written.`,
    );
  }
  return seats.map((entry) => {
    const found = linksIn(entry);
    return found.length ? found[0] : entry;
  });
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// What is at `file`, looked at and never followed: true when anything is there.
function entryAt(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

// Where a seat's graph holds the page at `rel`, its path on layout 2 (families/a.md), as a path
// under celorus/: in the shared part or the personal part, where the person keeps it, else null.
// from-my-team is the graph job's and is never a page a writer reads as the graph's own. On any
// other desk, `rel` when the page is there.
function heldAt(celorus, desk, rel) {
  if (!desk.graph) return isFile(path.join(celorus, ...rel.split("/"))) ? rel : null;
  for (const part of [SHARED, PERSONAL]) {
    if (isFile(path.join(celorus, part, ...rel.split("/")))) return `${part}/${rel}`;
  }
  return null;
}

// Where a writer puts the page at `rel` (its path on layout 2) of kind `type` on a seat's graph, as
// a path under celorus/: the part that holds an entry at that path already (from-my-team too, so
// a writer refuses it there and never makes a second page of the name), else the kind's default
// part (layout.js defaultPart). On any other desk, `rel`.
function placedAt(celorus, desk, rel, type) {
  if (!desk.graph) return rel;
  for (const part of PARTS) {
    if (entryAt(path.join(celorus, part, ...rel.split("/")))) return `${part}/${rel}`;
  }
  return `${defaultPart({ rel, head: { type } })}/${rel}`;
}

// Whether a slug names a family, person, firm or seat page this desk already has. A seat is one
// of the desk's seats (seatHandles), never a file in seats/ by its name alone; on a seat's graph,
// any seat of the firm (firmSeats).
function isPage(celorus, desk, slug) {
  if (typeof slug !== "string" || !HANDLE.test(slug)) return false;
  if (["families", "people", "firms"].some((folder) => heldAt(celorus, desk, `${folder}/${slug}.md`) !== null)) return true;
  return firmSeats(celorus, desk).includes(slug);
}

// The title of the page a slug names, or the slug when it has none.
function titleOf(celorus, slug, desk = null) {
  for (const folder of FOLDERS) {
    const rel = desk === null ? (isFile(path.join(celorus, folder, `${slug}.md`)) ? `${folder}/${slug}.md` : null) : heldAt(celorus, desk, `${folder}/${slug}.md`);
    if (rel === null) continue;
    const page = readPage(celorus, rel);
    const title = page.head && typeof page.head === "object" ? page.head.title : null;
    return title ? String(title) : slug;
  }
  return slug;
}

// The parts of a seat's graph `celorus` holds as a folder of exactly that name, or a link to a
// folder among them (the reader follows it); a file, a broken link or a name in another case is
// none.
function partsIn(celorus) {
  let names;
  try {
    names = fs.readdirSync(celorus);
  } catch {
    return [];
  }
  return PARTS.filter((name) => {
    if (!names.includes(name)) return false;
    try {
      const stat = fs.statSync(path.join(celorus, name), { throwIfNoEntry: false });
      return Boolean(stat && stat.isDirectory());
    } catch {
      return false;
    }
  });
}

// The layout desk.md's header states, a whole number in LAYOUTS, or null when it states none.
function statedLayout(head) {
  const value = head !== null && typeof head === "object" && !Array.isArray(head) ? head.layout_version : undefined;
  return Number.isInteger(value) && LAYOUTS.includes(value) ? value : null;
}

// Why a folder is refused as a seat's graph that its desk.md does not say it is, or null. `head` is
// desk.md's header as read (null when it cannot be read), `present` whether desk.md is there. A
// graph's parts are in no other desk, and read as a desk of another layout every seat page in its
// shared part would be a seat that may change it. Any two of the three parts make a graph whatever
// desk.md says, or if it is gone; one part does when desk.md is there and states no layout (reader
// 3's ruling, c/6225848393). check-desk is named only where it names something: desk.md gone, or
// its header unread.
function notGraphSaid(celorus, head, present) {
  const stated = statedLayout(head);
  if (stated === LAYOUT) return null;
  const parts = partsIn(celorus);
  if (!parts.length || (parts.length < 2 && !(present && stated === null))) return null;
  const mapping = head !== null && typeof head === "object" && !Array.isArray(head);
  const named = parts.map((part) => `${part}/`);
  const which = named.length === 1 ? `${named[0]} part` : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]} parts`;
  const said = !present
    ? "its desk.md is gone: check-desk names what is missing"
    : !mapping
      ? "its desk.md's header cannot be read: check-desk names what is wrong with it"
      : stated !== null
        ? `its desk.md says layout_version: ${stated}`
        : "its desk.md states no layout (layout_version is the whole number 1, 2 or 3)";
  return (
    `This desk holds a seat's graph's ${which}, but ${said}, so nothing is written. A seat's graph's desk.md ` +
    `says layout_version: ${LAYOUT} and names its seat in seat:; a desk that is not a graph keeps no folder ` +
    "named shared, personal or team in celorus/."
  );
}

// The firm's common space beside the seat's graph at `root` (the desk folder), for a write there
// of `page` (its path in the common space) by `seat`: its folder, which only the desk head writes
// (the base's ruling K8, c/6212179305), as common.md's desk_head: names. Every other case is
// refused, saying which, before anything is read for writing: no common space beside the graph
// (layout.js commonOfGraph: a graph away from its firm folder never writes outside it), a common
// space or a folder in it on the way to the page that is a link, a common.md that names no desk
// head, and a seat that is not the desk head.
function commonFor(root, desk, seat, page, done) {
  const dir = commonBeside(root, desk, page, done);
  const head = readPage(dir, COMMON_STAMPS).head;
  const named = head !== null && typeof head === "object" && !Array.isArray(head) && typeof head.desk_head === "string" ? pyStrip(head.desk_head) : "";
  if (!named) {
    throw new Refusal(`The firm's common space names no desk head (its common.md says no desk_head:), so no seat writes ${page} there. ${done}`);
  }
  if (seat !== named) {
    throw new Refusal(`Only the desk head, ${named}, writes the firm's common space (${page}), and ${seat} is not the desk head. ${done}`);
  }
  noLinkOnWay(dir, page, done);
  return dir;
}

// The firm's common space beside the seat's graph at `root`, for the one write there that is not
// the desk head's: a new name in the name list (layout.js NAMES), which the overnight adds for the
// graph's own seat when it makes a page for someone new (gtm Addendum 19 section 9, "it writes
// nothing but a new name in the name list"; slice E6b-2c, T12, c/6233107975). Its folder, or
// refused, saying which, as commonFor refuses: no common space beside the graph, or a link at
// common/. The list sits at common/'s root, so no folder is on its way; a list that is itself a
// link is refused where it is read (write/pages.js readOwned).
function namesFor(root, desk, done) {
  return commonBeside(root, desk, NAMES, done);
}

// The common space's folder beside the graph at `root`, refused when it is a link or is not there.
function commonBeside(root, desk, page, done) {
  const dir = commonOfGraph(root);
  let st = null;
  try {
    st = dir === null ? null : fs.lstatSync(dir);
  } catch {
    st = null;
  }
  if (st !== null && st.isSymbolicLink()) throw new Refusal(`In the firm folder, ${linkedSaid("common/", linkKind(dir), `common/${page}`)} ${done}`);
  if (st === null || !st.isDirectory()) {
    throw new Refusal(
      `This desk is ${desk.seat}'s graph, and no common space is beside it (its folder is not seats/<seat> in a firm ` +
        `folder that holds common/), so ${page} has nowhere to go. ${done}`,
    );
  }
  return dir;
}

// Refuses a link in the common space on the way to `page`.
function noLinkOnWay(dir, page, done) {
  const folder = linkOnWay(dir, page);
  if (folder !== null) throw new Refusal(`In the firm folder, ${linkedSaid(`common/${folder}`, linkKind(path.join(dir, ...folder.split("/").filter(Boolean))), `common/${page}`)} ${done}`);
}

// The non-blank lines under `## heading`, up to the next `## `, the footer line left out.
function section(body, heading, footer) {
  const lines = [];
  let inside = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      inside = pyStrip(line.slice(3)) === heading;
      continue;
    }
    if (inside && pyStrip(line) && pyStrip(line) !== footer) lines.push(line);
  }
  return lines;
}

// The slugs a family page lists under Members and Contacts, each a list item ("- ") that opens with
// its link, read by the one link reader (check/text.js linkSpans, the page by linkName).
const ITEM = "- ";
function familyPeople(celorus, family, footer, desk = null) {
  const rel = desk === null ? (isFile(path.join(celorus, "families", `${family}.md`)) ? `families/${family}.md` : null) : heldAt(celorus, desk, `families/${family}.md`);
  if (rel === null) return [];
  const page = readPage(celorus, rel);
  const body = page.body || "";
  return [...section(body, "Members", footer), ...section(body, "Contacts", footer)].flatMap((line) => {
    if (!line.startsWith(ITEM)) return [];
    const [first] = linkSpans(line);
    return first && first.start === ITEM.length ? [linkName(first)] : [];
  });
}

// The footer line a demo desk writes at the end of every page, from desk.md's header
// (`page_footer: <line>`), or null. A client's desk has none: the line comes only from a demo
// fixture's own setting, never from the plugin (the base's ruling R6).
function footerIn(head) {
  const value = head.page_footer;
  return typeof value === "string" && pyStrip(value) !== "" && !value.includes("\n") ? value : null;
}

module.exports = {
  deskMd,
  seatHandles,
  seatsOf,
  seatsNamed,
  seatHeld,
  firmSeats,
  entryAt,
  heldAt,
  placedAt,
  isPage,
  titleOf,
  familyPeople,
  notGraphSaid,
  commonFor,
  namesFor,
};
