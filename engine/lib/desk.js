"use strict";
// The shared desk reader. Every desk tool reads a desk through here: where the desk is, its
// stamps, and every page under `celorus/` with its header, its body and, when a page cannot
// be read, the problem in words. Reading never fails a desk because one page is odd; the
// page carries its problem and the rest is read.
//
// A desk is a folder holding `celorus/index.md`. It is found the way the session hook finds
// it: `CELORUS_DESK` when that folder holds `celorus/index.md`, otherwise the first folder
// holding one on the walk up from where the work started. A `CELORUS_DESK` naming the desk's
// `celorus` folder is refused, with the folder to set.

const fs = require("node:fs");
const path = require("node:path");
const { parseHeader, HeaderError, HEADER_SUBSET } = require("./header.js");
const { Refusal } = require("./refusal.js");

// The problems a page can carry, in the words the checker's Python oracle uses.
const NO_HEADER = "no header";
const NOT_UTF8 = "not readable as UTF-8";
const HEADER_UNREAD = "the header does not parse";
// A page listed in the folder that cannot be opened: a link to nothing, a file without read
// permission, a file removed between the listing and the read. The oracle has no word for it
// (it stops the whole check); the engine lists the page and reads the rest.
const PAGE_UNREAD = "the page cannot be read";
// A stamp the desk tools read (the desk's name, its id, its layout, or the title that stands
// in for the name) written as a mapping or a list where it is one value. The oracle has no
// word for it either; the engine names the page rather than print a mapping as a name.
const STAMP_NOT_ONE_VALUE = "a desk stamp is not one value";
const WHY_UNREAD = {
  ENOENT: "it is gone, or it is a link to a file that is not there",
  EACCES: "this machine gives no permission to read it",
  EPERM: "this machine gives no permission to read it",
  EISDIR: "it is a folder, not a page",
  ELOOP: "it is a link that leads back to itself",
};

// The oracle's header split: the file starts with a line of three dashes and the header ends
// at the next line of three dashes, which must itself end in a newline.
const FRONT = /^---\n([\s\S]*?)\n---\n/;

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const LOOSE_UTF8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

function isDesk(folder) {
  try {
    return fs.statSync(path.join(folder, "celorus", "index.md")).isFile();
  } catch {
    return false;
  }
}

// CELORUS_DESK names the desk folder, the one holding `celorus/`, as the session hook and the
// skills read it. Set to the desk's `celorus` folder instead, it is refused by name with the
// folder to set, in every door alike: honoured in one and passed over in another, the same
// setting would read two different desks.
// The name is compared without case: on a disk that ignores case (macOS's default),
// `<desk>/Celorus` is the celorus folder, and a case-sensitive compare would pass it over for
// the walk, which may find another desk.
function isCelorusFolder(folder) {
  return path.basename(folder).toLowerCase() === "celorus" && isDesk(path.dirname(folder));
}

function refuseCelorusFolder(named, folder) {
  if (isCelorusFolder(folder)) {
    throw new Refusal(
      `CELORUS_DESK is ${named}, the desk's celorus folder. CELORUS_DESK names the desk folder, ` +
        `the one holding celorus/: set it to ${path.dirname(folder)}.`,
    );
  }
}

// Returns the desk folder found from `start`, or null. `start` null means the working folder
// is not known: only a CELORUS_DESK written as a full path is then read, and nothing is walked.
function findDesk({ start = process.cwd(), env = process.env } = {}) {
  const named = env.CELORUS_DESK;
  if (named && (start !== null || path.isAbsolute(named))) {
    const folder = path.resolve(start === null ? "/" : start, named);
    if (isDesk(folder)) return folder;
    refuseCelorusFolder(named, folder);
  }
  if (start === null) return null;
  let folder = path.resolve(start);
  for (;;) {
    const parent = path.dirname(folder);
    if (parent === folder) return null; // the filesystem root is not walked, as in the hook
    if (isDesk(folder)) return folder;
    folder = parent;
  }
}

// Returns the desk folder for a folder someone named: the desk itself, or its `celorus`
// folder. Anything else is refused, naming what a desk is. A relative name is read from
// `base`, the working folder.
function resolveDesk(named, base = process.cwd()) {
  const folder = path.resolve(base, named);
  if (isDesk(folder)) return folder;
  if (isCelorusFolder(folder)) return path.dirname(folder);
  throw new Refusal(
    `There is no desk at ${folder}. A desk is a folder that holds celorus/index.md: ` +
      "name that folder, or set CELORUS_DESK to it.",
  );
}

// Reads text as Python's text mode does: newlines made universal, a byte-order mark kept.
function normalise(text) {
  return text.replace(/\r\n?/g, "\n");
}

// Splits a page into its header text and its body, or returns null when it has no header.
function splitPage(text) {
  const match = FRONT.exec(text);
  if (!match) return null;
  return { header: match[1], body: text.slice(match[0].length) };
}

// Reads one page. `dir` is the desk's `celorus` folder and `rel` the page's path under it,
// with forward slashes. A page whose header does not parse, or that cannot be read at all,
// also carries `why` (what was met) and `remedy` (what the page should be).
function readPage(dir, rel) {
  let bytes;
  try {
    bytes = fs.readFileSync(path.join(dir, ...rel.split("/")));
  } catch (err) {
    return {
      rel,
      head: null,
      body: "",
      problem: PAGE_UNREAD,
      why: WHY_UNREAD[err.code] || `the file system said ${err.code || err.message}`,
      remedy: "Restore the page, or move it out of the desk folder.",
    };
  }
  let text;
  try {
    text = normalise(STRICT_UTF8.decode(bytes));
  } catch {
    const loose = normalise(LOOSE_UTF8.decode(bytes));
    const split = splitPage(loose);
    return { rel, head: null, body: split ? split.body : loose, problem: NOT_UTF8 };
  }
  const split = splitPage(text);
  if (!split) return { rel, head: null, body: text, problem: NO_HEADER };
  let head;
  try {
    head = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    return {
      rel,
      head: null,
      body: split.body,
      problem: HEADER_UNREAD,
      why: err.message,
      remedy: HEADER_SUBSET,
    };
  }
  if (head !== null) return { rel, head, body: split.body, problem: null };
  // A header YAML reads as something other than a mapping (a list, a bare scalar, or only
  // comments) reads as no header, as the oracle reads it, but it is there and its text is not
  // read for links: `headerNotMapping` says so, beside the problem a page with none carries.
  return { rel, head, body: split.body, problem: NO_HEADER, headerNotMapping: true };
}

// Orders paths part by part, as Python sorts paths: `a/y.md` before `a-b/x.md`.
function comparePaths(a, b) {
  const left = a.split("/");
  const right = b.split("/");
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}

// Every `.md` path under `dir`, relative and with forward slashes, in path order.
function markdownUnder(dir) {
  const out = [];
  const walk = (folder, prefix) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(folder, entry.name), rel);
      else if (entry.name.endsWith(".md")) out.push(rel);
    }
  };
  walk(dir, "");
  return out.sort(comparePaths);
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The file system as the stamps look-up opens it, over the celorus folder `dir`: `lstat` and
// `read` take a page's path under `dir`. readDesk takes another in its place, so a test can
// hand it a disk that ignores case, or one that keeps it, on whichever disk the test runs.
function diskAt(dir) {
  return {
    lstat: (rel) => fs.lstatSync(path.join(dir, ...rel.split("/"))),
    read: (rel) => readPage(dir, rel),
  };
}

// The page `name`, opened through `disk` as the oracle opens `<root>/desk.md`: on a disk that
// ignores case (macOS's default) a `Desk.md` is that page, which a case-exact look-up in the
// listing would pass over. lstat, not stat: a link to nothing is still the desk's desk.md.
// The listed page that is the same file is the one returned, so the problem it carries is
// the one the desk's page list shows; null when there is no such file.
function pageAt(disk, pages, name) {
  let file;
  try {
    file = disk.lstat(name);
  } catch {
    return null;
  }
  const exact = pages.find((page) => page.rel === name);
  if (exact) return exact;
  const same = pages.find((page) => {
    if (page.rel.toLowerCase() !== name) return false;
    try {
      const listed = disk.lstat(page.rel);
      return listed.ino === file.ino && listed.dev === file.dev;
    } catch {
      return false;
    }
  });
  return same || disk.read(name);
}

// The page that carries the desk's stamps: `deskPage`, the desk's desk.md as opening it opens
// it, or null; and `stampsPage`, that page or else index.md (layout 1), or null.
function stampsPageOf(disk, pages) {
  const deskPage = pageAt(disk, pages, "desk.md");
  return { deskPage, stampsPage: deskPage || pageAt(disk, pages, "index.md") };
}

// The stamps the desk tools read, and only those: the name and the id always; the title only
// where it stands in for a name that is missing (check_desk prints `desk || title`); and
// layout_version only on desk.md, where the layout is read from it. A key no tool reads is
// never a reason to leave the desk's name unknown.
function stampKeysRead(stamps, deskPage) {
  const keys = ["desk", "desk_id"];
  if (!stamps.desk) keys.push("title");
  if (deskPage) keys.push("layout_version");
  return keys;
}

// Reads a whole desk. `folder` is a desk folder (see resolveDesk). Returns the folder, the
// layout, the stamps, the stamps page's path, desk.md's path under celorus/ (`deskPage`, null
// on a desk without one), and every page. The stamps are the header of
// `desk.md`; a desk with no `desk.md` is on layout 1, which keeps them in `index.md` under one
// block, `celorus:` (install-desk/layout-1.md), or, on an older index, at its top. When the
// stamps page is there but cannot be read (the file, its encoding or its header), or a stamp
// the tools read on it is a mapping or a list (stampKeysRead), the desk's name and id are
// not known: `stamps` is null, never filled in from defaults, and `stampsUnread` names the
// page. The layout is then null on a desk with `desk.md`, whose layout is in that page, and 1
// on a desk without one, which is layout 1 by its files. `disk` makes the file system the
// stamps look-up opens (diskAt).
function readDesk(folder, { disk = diskAt } = {}) {
  const root = resolveDesk(folder);
  const dir = path.join(root, "celorus");
  const pages = markdownUnder(dir).map((rel) => readPage(dir, rel));
  const { deskPage, stampsPage } = stampsPageOf(disk(dir), pages);
  const unknown = { root, layout: deskPage ? null : 1, stamps: null, deskPage: deskPage ? deskPage.rel : null };
  if (stampsPage && stampsPage.problem && stampsPage.problem !== NO_HEADER) {
    return { ...unknown, stampsUnread: stampsPage, pages };
  }
  const head = (stampsPage && stampsPage.head) || {};
  const stamps = !deskPage && isMapping(head.celorus) ? head.celorus : head;
  const notOne = stampKeysRead(stamps, deskPage).filter(
    (key) => stamps[key] !== null && typeof stamps[key] === "object",
  );
  if (notOne.length) {
    const named = {
      ...stampsPage,
      problem: STAMP_NOT_ONE_VALUE,
      why: notOne
        .map((key) => `${key} is ${Array.isArray(stamps[key]) ? "a list" : "a mapping"}`)
        .join("; "),
      remedy: `Write ${notOne.join(" and ")} as one value each, as \`desk: Sample Desk\`.`,
    };
    return { ...unknown, stampsUnread: named, pages: pages.map((page) => (page === stampsPage ? named : page)) };
  }
  const layout = deskPage ? stamps.layout_version ?? 1 : 1;
  return { root, layout, stamps, stampsUnread: null, deskPage: deskPage ? deskPage.rel : null, pages };
}

module.exports = {
  NO_HEADER,
  NOT_UTF8,
  HEADER_UNREAD,
  PAGE_UNREAD,
  STAMP_NOT_ONE_VALUE,
  DeskRefusal: Refusal,
  isDesk,
  refuseCelorusFolder,
  findDesk,
  resolveDesk,
  splitPage,
  readPage,
  readDesk,
  diskAt,
  stampsPageOf,
  comparePaths,
};
