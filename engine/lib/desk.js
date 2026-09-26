"use strict";
// The shared desk reader. Every desk tool reads a desk through here: where the desk is, its
// stamps, and every page under `celorus/` with its header, its body and, when a page cannot
// be read, the problem in words. Reading never fails a desk because one page is odd; the
// page carries its problem and the rest is read.
//
// A desk is a folder holding `celorus/index.md`. It is found from `CELORUS_DESK` when that is
// set, otherwise on the walk up from where the work started. Either way the first folder whose
// listing holds an entry named exactly `celorus`, of any kind, is the desk for the call (a
// `Celorus` is walked past as some other folder, unless it holds an index.md: then it is a desk's
// record folder misnamed, refused by name with the rename, at every door, the named `desk` too):
// one that is no desk the tools can read
// is refused by what is wrong with it, never passed over for a desk above (findDesk). A
// `CELORUS_DESK` naming the desk's `celorus` folder is refused, with the folder to set, and one
// naming a folder with no `celorus` entry is refused, never passed over for the walk.

const fs = require("node:fs");
const path = require("node:path");
const { parseHeader, HeaderError, HEADER_SUBSET } = require("./header.js");
const { Refusal } = require("./refusal.js");
const { brokenRoot, linkedSaid, linkKind, NOTHING: LINKED_NOTHING } = require("./linkedroot.js");

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
// An error the reader has no words for: named in these fixed words, never the system's message,
// which carries an absolute path and a cause the reader did not check.
const WHY_OTHER = "the file system would not give its text, and gave no reason the desk tools know";
const REMEDY_PAGE = "Restore the page, or move it out of the desk folder.";
// An entry named like a page that is neither a file nor a folder. It is never opened: opening a
// pipe waits for a writer, so one read would hang every desk tool (the base's ruling R32).
const ODD_KINDS = [
  ["isFIFO", "a pipe"],
  ["isSocket", "a socket"],
  ["isCharacterDevice", "a device"],
  ["isBlockDevice", "a device"],
];
const REMEDY_ODD = "Move it out of the desk folder.";
// A folder under celorus/ the reader cannot list: named by its path with a slash after it, and
// the rest of the desk read (the base's ruling R33 point 3).
const WHY_FOLDER = {
  EACCES: "it is a folder this machine gives no permission to read",
  EPERM: "it is a folder this machine gives no permission to read",
};
const WHY_FOLDER_OTHER = "it is a folder the file system would not list, for no reason the desk tools know";
const REMEDY_FOLDER = "Give the folder back its permissions, or move it out of the desk folder.";
// A link under celorus/ that the reader cannot follow: named by its path with a slash after it,
// as a folder that cannot be listed is, and the rest of the desk read (the base's ruling R64).
const WHY_LINK = {
  ENOENT: "it is a link that points nowhere",
  ENOTDIR: "it is a link that points nowhere",
  ELOOP: "it is a link that leads back to itself",
  EACCES: "it is a link this machine gives no permission to follow",
  EPERM: "it is a link this machine gives no permission to follow",
};
const WHY_LINK_OTHER = "it is a link the file system would not follow, for no reason the desk tools know";
const REMEDY_LINK = "Point the link at a folder, or move it out of the desk folder.";
// What a folder link the reader followed is (readDesk's `links`): one whose pages were read
// through it, or one that leads to a folder read already, whose pages are read there once.
const LINK_FOLDER = "a link to a folder";
const LINK_READ = "a folder already read, reached again through a link";

// The oracle's header split: the file starts with a line of three dashes and the header ends
// at the next line of three dashes, which must itself end in a newline.
const FRONT = /^---\n([\s\S]*?)\n---\n/;

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const LOOSE_UTF8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

// A folder whose listing names an entry exactly `celorus` holding a file index.md: the same
// exact-name rule the walk applies (holdsCelorus), so a folder that holds only a `Celorus` is no
// desk at the named `desk` door either, on any disk.
function isDesk(folder) {
  if (holdsCelorus(folder) === false) return false;
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

// The folder to set is said as the person wrote the setting, never resolved: a relative one read
// through a folder link would otherwise name where the link leads.
function refuseCelorusFolder(named, folder) {
  if (isCelorusFolder(folder)) {
    throw new Refusal(
      `CELORUS_DESK is ${named}, the desk's celorus folder. CELORUS_DESK names the desk folder, ` +
        `the one holding celorus/: set it to ${path.dirname(named)}.`,
    );
  }
}

const NO_INDEX = "celorus/ holds no index.md";
const DENIED = new Set(["EACCES", "EPERM"]);
const DESK_SHAPE =
  "A desk's celorus/ is a plain folder holding a plain, readable index.md: make it one, then ask again.";

// Why the celorus folder `dir` (a link to it followed) holds no index.md the tools can read,
// named by its path under the desk, or null when it is a folder this machine may read and search
// holding a regular file index.md this machine may read. Nothing is opened: a pipe there would
// wait for a writer.
function indexFault(dir) {
  try {
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.X_OK);
  } catch (err) {
    return DENIED.has(err && err.code)
      ? "celorus/ cannot be read: this machine gives no permission to read or search it"
      : "celorus/ cannot be read: the file system would not list it, and gave no reason the desk tools know";
  }
  const file = path.join(dir, "index.md");
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    if (err && err.code === "ENOENT") return NO_INDEX;
    return "celorus/index.md cannot be read: the file system would not look at it, and gave no reason the desk tools know";
  }
  if (st.isSymbolicLink()) return `celorus/index.md is ${linkKind(file)}`;
  if (st.isDirectory()) return "celorus/index.md is a folder, not a page";
  const odd = oddKind(st);
  if (odd !== null) return `celorus/index.md is ${odd}, not a page`;
  try {
    fs.accessSync(file, fs.constants.R_OK);
  } catch {
    return "celorus/index.md cannot be read: this machine gives no permission to read it";
  }
  return null;
}

// The refusal for a folder the walk stopped at, or the one CELORUS_DESK names (`named`, as the
// person set it), that is no desk the tools can read: `fault` says what is wrong, by its path
// under that folder, and the folder itself is said in words, never by its path.
function notADesk(fault, named, remedy = DESK_SHAPE) {
  const where =
    named === undefined
      ? "so the first folder on the walk up from the working folder that holds a celorus entry is " +
        "no desk the tools can read, and the walk stops there: no desk above it is used."
      : `so the folder CELORUS_DESK names, ${named}, is no desk the tools can read.`;
  return new Refusal(`${fault}, ${where} ${remedy}`);
}

// Whether `folder` holds an entry named exactly `celorus`, read in the folder's listing: true or
// false, or null when the folder cannot be listed. A look-up by the name would not do: on a disk
// that ignores case (macOS's default) `celorus` finds a folder named `Celorus`, which may be the
// person's own folder and no desk, and the walk would stop there.
function holdsCelorus(folder) {
  try {
    return fs.readdirSync(folder).includes("celorus");
  } catch {
    return null;
  }
}

// The name of an entry in `folder`'s listing that is `celorus` in another case (`Celorus`,
// `CELORUS`) and holds an index.md, or null. Such an entry is a desk's record folder misnamed, not
// the person's own folder: every door refuses it by name, with the rename to make, for the readers
// and the writers alike, never passing it for a desk above. One without an index.md is walked past.
function misnamedCelorus(folder) {
  let names;
  try {
    names = fs.readdirSync(folder).sort();
  } catch {
    return null;
  }
  for (const name of names) {
    if (name === "celorus" || name.toLowerCase() !== "celorus") continue;
    try {
      fs.lstatSync(path.join(folder, name, "index.md"));
      return name;
    } catch {
      // no index.md in it: some other folder
    }
  }
  return null;
}

const misnamedFault = (name) =>
  `${name}/ holds an index.md, but the desk tools read a desk only from a folder named exactly celorus/`;
const renameIt = (name) => `Rename ${name}/ to celorus/, then ask again. ${LINKED_NOTHING}`;

// The desk at `folder`, reached by the walk or by CELORUS_DESK (`named`, as set; undefined for the
// walk): undefined when its listing names no entry exactly `celorus` (a `Celorus` is some other
// folder), which the walk goes past; when the folder cannot be listed, the name is looked at as
// below. The folder when it
// is a desk the call can use, a plain celorus/ folder holding a plain readable index.md, or a live
// link to a folder holding one, which the readers follow and the writers refuse at their own door
// (lib/linkedroot.js); and otherwise a refusal, never a desk above. The entry is looked at with
// lstat, never followed to look. A link to a file or to nothing is refused in the linked-root
// words, for the readers and the writers alike; a live link to a folder that holds no readable
// index.md is refused to a writer (`writes`) in the linked-root words, and named to a reader.
function deskAt(folder, named, writes) {
  if (holdsCelorus(folder) === false) {
    const misnamed = misnamedCelorus(folder);
    if (misnamed !== null) throw notADesk(misnamedFault(misnamed), named, renameIt(misnamed));
    return undefined;
  }
  let st;
  try {
    st = fs.lstatSync(path.join(folder, "celorus"));
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) return undefined;
    throw notADesk("celorus cannot be looked at: this machine gives no permission to search the folder that holds it", named);
  }
  if (st.isSymbolicLink()) {
    const broken = brokenRoot(folder);
    if (broken !== null) throw new Refusal(`${broken} ${LINKED_NOTHING}`);
    const fault = indexFault(path.join(folder, "celorus"));
    if (fault === null) return folder;
    if (writes) throw new Refusal(`${linkedSaid("celorus/", "a link to a folder")} ${LINKED_NOTHING}`);
    throw notADesk(fault === NO_INDEX ? "celorus/ is a link to a folder that holds no index.md" : fault, named);
  }
  if (!st.isDirectory()) {
    const odd = oddKind(st);
    throw notADesk(`celorus is ${odd === null ? "a file" : odd}, not a folder`, named);
  }
  const fault = indexFault(path.join(folder, "celorus"));
  if (fault !== null) throw notADesk(fault, named);
  return folder;
}

// The working folder as the person's shell names it (PWD), when PWD is a full path to the same
// folder as `start`, or null. The upward walk starts from it, so a session started inside a
// linked celorus/ meets the folder that holds the link; without it the walk starts from `start`,
// the tools' own working folder, which names every link in it resolved. CELORUS_DESK is never
// read from it: a relative one is read from `start`, the real folder, as the `desk` argument and
// the session hook read it.
function shellFolder(start, env) {
  const pwd = env.PWD;
  if (typeof pwd !== "string" || !path.isAbsolute(pwd)) return null;
  try {
    return fs.realpathSync(pwd) === fs.realpathSync(start) ? path.resolve(pwd) : null;
  } catch {
    return null;
  }
}

// A writer whose working folder lies inside the desk's celorus/ folder, with no PWD to say how
// the session reached it: the tools' own working folder names every link resolved, so a
// celorus/ that is a link and a plain one look the same from there, and the writer refuses
// before any change. The words name no path.
const INSIDE_CELORUS =
  "The working folder is inside a desk's celorus/ folder, and PWD does not name it, so the desk " +
  "tools cannot tell whether that celorus/ is a link; a desk tool writes a page only as a real " +
  "file inside the desk folder, never through a link, so it wrote nothing. Start the session " +
  `from the desk's folder, the one holding celorus/, then ask again. ${LINKED_NOTHING}`;

function isInside(folder, within) {
  const rel = path.relative(within, folder);
  return rel === "" || (rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel));
}

// A CELORUS_DESK that names no desk folder is refused, echoed as the person set it: passed over,
// the walk could land on another desk, and a writer write there.
function noDeskNamed(named) {
  return new Refusal(
    `CELORUS_DESK names ${named}, which holds no celorus/index.md. Set CELORUS_DESK to the desk ` +
      "folder (the one holding celorus/index.md), or name that folder as `desk`.",
  );
}

// Returns the desk folder found from `start`, or null. `start` null means the working folder
// is not known: only a CELORUS_DESK written as a full path is then read, and nothing is walked.
// The first folder the variable or the walk reaches that holds a `celorus` entry of any kind is
// the desk for the call (deskAt): the walk never passes it to reach a desk above. `writes` says
// the call writes, which decides the words for a live link to a folder with no readable index.md,
// and refuses a walk from inside the desk's celorus/ that no PWD vouches for (INSIDE_CELORUS).
function findDesk({ start = process.cwd(), env = process.env, writes = false } = {}) {
  const named = env.CELORUS_DESK;
  if (named && (start !== null || path.isAbsolute(named))) {
    const folder = path.resolve(start === null ? "/" : start, named);
    const found = deskAt(folder, named, writes);
    if (found !== undefined) return found;
    refuseCelorusFolder(named, folder);
    throw noDeskNamed(named);
  }
  if (start === null) return null;
  const shell = shellFolder(start, env);
  let folder = path.resolve(shell === null ? start : shell);
  for (;;) {
    const parent = path.dirname(folder);
    if (parent === folder) return null; // the filesystem root is not walked, as in the hook
    const found = deskAt(folder, undefined, writes);
    if (found !== undefined) {
      if (writes && shell === null && isInside(path.resolve(start), path.join(found, "celorus"))) {
        throw new Refusal(INSIDE_CELORUS);
      }
      return found;
    }
    folder = parent;
  }
}

// Returns the desk folder for a folder someone named: the desk itself, or its `celorus`
// folder. Anything else is refused, naming what a desk is. A relative name is read from
// `base`, the working folder.
//
// Its celorus/ folder is looked at first without following a link (lib/linkedroot.js): a link
// to a folder is followed, as every reader follows one; a link to a file or to nothing makes no
// desk, and is refused in the linked-root words, for the readers and the writers alike, never as
// "no desk". The refusal for no desk names the folder as the person named it, never the path it
// resolves to.
function resolveDesk(named, base = process.cwd()) {
  const folder = path.resolve(base, named);
  if (holdsCelorus(folder) !== false) {
    const broken = brokenRoot(folder);
    if (broken !== null) throw new Refusal(`${broken} ${LINKED_NOTHING}`);
  }
  if (isDesk(folder)) return folder;
  if (isCelorusFolder(folder)) return path.dirname(folder);
  const misnamed = holdsCelorus(folder) === false ? misnamedCelorus(folder) : null;
  if (misnamed !== null) {
    throw new Refusal(
      `${misnamedFault(misnamed)}, so the folder named as \`desk\`, ${named}, is no desk the tools ` +
        `can read. ${renameIt(misnamed)}`,
    );
  }
  throw new Refusal(
    `There is no desk at ${named}. A desk is a folder that holds celorus/index.md: ` +
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

// An entry the reader could not read: the page's (or folder's) path under celorus/, and why.
function unread(rel, why, remedy) {
  return { rel, head: null, body: "", problem: PAGE_UNREAD, why, remedy };
}

// What `stat` says an entry named like a page is, when it is neither a file nor a folder: "a
// pipe", "a socket", "a device", or null for a file or a folder.
function oddKind(st) {
  if (st.isFile() || st.isDirectory()) return null;
  const found = ODD_KINDS.find(([test]) => typeof st[test] === "function" && st[test]());
  return found ? found[1] : "neither a file nor a folder";
}

// Reads one page. `dir` is the desk's `celorus` folder and `rel` the page's path under it,
// with forward slashes. A page whose header does not parse, or that cannot be read at all,
// also carries `why` (what was met) and `remedy` (what the page should be). The page is opened
// only when `stat` (which follows a link: the target decides) reports a regular file; anything
// else is named without being opened.
function readPage(dir, rel) {
  const file = path.join(dir, ...rel.split("/"));
  let bytes;
  try {
    const st = fs.statSync(file);
    if (st.isDirectory()) return unread(rel, WHY_UNREAD.EISDIR, REMEDY_PAGE);
    const odd = oddKind(st);
    if (odd !== null) return unread(rel, `it is ${odd}, not a page, so it was not opened`, REMEDY_ODD);
    bytes = fs.readFileSync(file);
  } catch (err) {
    return unread(rel, WHY_UNREAD[err && err.code] || WHY_OTHER, REMEDY_PAGE);
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

// Every `.md` path under `dir`, relative and with forward slashes, in path order; each folder
// below `dir` that could not be listed, as a page the reader could not read (its path with a
// slash after it, see unread); and each folder link it met (`links`). A link named like a page is
// read by readPage, whose stat follows it, as ever. Any other link is looked at with stat (the
// base's ruling R64, applying R33's "readers follow a link"): one that leads to a folder is walked
// and its pages read under the link's path, and named in `links`; one that leads to nothing, or
// that this machine will not follow, is named as a folder that cannot be listed is; one that
// leads to a file not named like a page is passed over, as such a file is. The real folders are
// walked first and the links after, in path order, so a page is always read at its own path when
// it has one. A folder is read once: a link to a folder already read (a link back to a folder
// above it, or a second way to one) is named in `links`, never walked again, so a loop of links
// ends. A `dir` itself that cannot be listed is refused in the engine's words: no page of the
// desk can be read then.
function markdownUnder(dir) {
  const out = [];
  const folders = [];
  const links = [];
  // Each folder read, by its device and inode, to its path under `dir`.
  const seen = new Map();
  // The links met and not yet looked at: [path under dir, absolute path].
  const pending = [];
  const walk = (folder, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch (err) {
      const why = WHY_FOLDER[err && err.code];
      if (prefix === "") {
        throw new Refusal(
          `celorus/ cannot be listed: ${why ? "this machine gives no permission to read it" : "the file system would not list it"}, so no page could be read.`,
        );
      }
      folders.push(unread(`${prefix}/`, why || WHY_FOLDER_OTHER, REMEDY_FOLDER));
      return;
    }
    const id = folderId(folder);
    if (id !== null) {
      if (seen.has(id)) {
        links.push(alreadyRead(prefix, seen.get(id)));
        return;
      }
      seen.set(id, prefix);
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(folder, entry.name), rel);
      else if (entry.name.endsWith(".md")) out.push(rel);
      else if (entry.isSymbolicLink()) pending.push([rel, path.join(folder, entry.name)]);
    }
  };
  walk(dir, "");
  while (pending.length) {
    pending.sort(([a], [b]) => comparePaths(a, b));
    const [rel, file] = pending.shift();
    let st;
    try {
      st = fs.statSync(file);
    } catch (err) {
      folders.push(unread(`${rel}/`, WHY_LINK[err && err.code] || WHY_LINK_OTHER, REMEDY_LINK));
      continue;
    }
    if (!st.isDirectory()) continue;
    const id = `${st.dev}:${st.ino}`;
    if (seen.has(id)) {
      links.push(alreadyRead(rel, seen.get(id)));
      continue;
    }
    links.push({ rel: `${rel}/`, kind: LINK_FOLDER, readAt: null });
    walk(file, rel);
  }
  return { rels: out.sort(comparePaths), folders, links: links.sort((a, b) => comparePaths(a.rel, b.rel)) };
}

// A folder's device and inode as one key, or null when stat cannot say.
function folderId(folder) {
  try {
    const st = fs.statSync(folder);
    return `${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
}

// A link (or a folder reached through one) at `rel` that leads to the folder already read at
// `readAt` (both paths under celorus/, without the trailing slash; "" is celorus/ itself).
function alreadyRead(rel, readAt) {
  return { rel: `${rel}/`, kind: LINK_READ, readAt: readAt === "" ? "celorus/" : `celorus/${readAt}/` };
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
// on a desk without one), every page, and each folder link under celorus/ the reader met
// (`links`: { rel, kind, readAt }, see markdownUnder). The stamps are the header of
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
  const listed = markdownUnder(dir);
  // A folder that could not be listed sits in the page list in path order, so every tool that
  // names the reader's problems names it (check_desk's pages_with_problems).
  const pages = [...listed.rels.map((rel) => readPage(dir, rel)), ...listed.folders].sort((a, b) =>
    comparePaths(a.rel, b.rel),
  );
  const { deskPage, stampsPage } = stampsPageOf(disk(dir), pages);
  const links = listed.links;
  const unknown = { root, layout: deskPage ? null : 1, stamps: null, deskPage: deskPage ? deskPage.rel : null, links };
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
  return { root, layout, stamps, stampsUnread: null, deskPage: deskPage ? deskPage.rel : null, pages, links };
}

module.exports = {
  NO_HEADER,
  NOT_UTF8,
  HEADER_UNREAD,
  PAGE_UNREAD,
  STAMP_NOT_ONE_VALUE,
  LINK_FOLDER,
  LINK_READ,
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
