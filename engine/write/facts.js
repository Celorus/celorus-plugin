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
const { HANDLE, pyStrip } = require("./text.js");

// The folders a writer's slug may name a page in.
const FOLDERS = ["families", "people", "firms", "seats"];

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
// writers own that is desk.md by a second name is refused by it (pages.js readOwned).
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
function deskMd(celorus, done) {
  const file = path.join(celorus, "desk.md");
  const refused = (state) => new Refusal(`desk.md ${state}, so no seat can be held to the seats it declares. ${done}`);
  let entry;
  try {
    entry = fs.lstatSync(file, { bigint: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return { seats: null, footer: null, id: null, name: null }; // (A)
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
  const footer = footerIn(head);
  // The desk by its own name (desk.md's `desk:`), never by its folder: an answer names the desk
  // by it (0.19.0 round 1 readers, K4).
  const name = typeof head.desk === "string" ? head.desk : null;
  if (!Object.hasOwn(head, "seats")) return { seats: null, footer, id, name }; // (B)
  const seats = head.seats;
  if (Array.isArray(seats) && seats.every((entry) => typeof entry === "string")) {
    // An entry is a handle or a link to the seat's page, "[[kabir]]", read by the one link
    // reader (check/text.js).
    const handles = seats.map((entry) => {
      const found = linksIn(entry);
      return found.length ? found[0] : entry;
    });
    return { seats: handles, footer, id, name };
  }
  const line = seatsLine(split.header);
  throw new Refusal(
    `desk.md's line ${JSON.stringify(line === null ? "seats:" : line)} does not read as a list of seats, so no seat can be ` +
      `held to it: write it as ${SEATS_FORM}. ${done}`,
  );
}

// The handles of the seat pages in seats/ whose header says `type: seat`, sorted. A file whose
// name is not a handle is never a seat, whatever its header says.
function seatPages(celorus) {
  let names;
  try {
    names = fs.readdirSync(path.join(celorus, "seats"));
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".md") && HANDLE.test(name.slice(0, -3)))
    .map((name) => name.slice(0, -3))
    .filter((handle) => {
      if (!isFile(path.join(celorus, "seats", `${handle}.md`))) return false;
      const head = readPage(celorus, `seats/${handle}.md`).head;
      return head !== null && typeof head === "object" && head.type === "seat";
    })
    .sort();
}

// The desk's seats, the ones it declares: each a seat page, seats/<handle>.md, whose header
// says `type: seat`, and, when desk.md carries a `seats:` list, one it names. A file in seats/
// is never a seat by its name alone. Every writer and desk_sync hold a seat to this list, and
// name it when they refuse one (house rule 6); there is no other writer's name. `why`, when the
// list is empty, says why: which declared seats have no seat page, and which seat pages are not
// declared. `desk` is the call's one read of desk.md (deskMd).
function seatsOf(celorus, desk) {
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

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// Whether a slug names a family, person, firm or seat page this desk already has. A seat is one
// of the desk's seats (seatHandles), never a file in seats/ by its name alone.
function isPage(celorus, desk, slug) {
  if (typeof slug !== "string" || !HANDLE.test(slug)) return false;
  if (["families", "people", "firms"].some((folder) => isFile(path.join(celorus, folder, `${slug}.md`)))) return true;
  return seatHandles(celorus, desk).includes(slug);
}

// The title of the page a slug names, or the slug when it has none.
function titleOf(celorus, slug) {
  for (const folder of FOLDERS) {
    if (!isFile(path.join(celorus, folder, `${slug}.md`))) continue;
    const page = readPage(celorus, `${folder}/${slug}.md`);
    const title = page.head && typeof page.head === "object" ? page.head.title : null;
    return title ? String(title) : slug;
  }
  return slug;
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
function familyPeople(celorus, family, footer) {
  if (!isFile(path.join(celorus, "families", `${family}.md`))) return [];
  const page = readPage(celorus, `families/${family}.md`);
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

module.exports = { deskMd, seatHandles, seatsOf, seatsNamed, isPage, titleOf, familyPeople };
