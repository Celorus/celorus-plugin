"use strict";
// The desk update (design section 7): it moves a desk to the newest layout and model version.
// It previews on a copy first, never deletes a page, stops and names the step before a move
// would overwrite or a value would have to be made up, and changes nothing when run twice.
// install-desk's update.md says the same twelve steps in words.
//
// A header line the update does not change is kept as written: a flat header is put together
// from the old header's own lines wherever a detail keeps its name and value.
//
// It reads what it writes from the plugin's own files: the model pages under
// skills/install-desk/model/, the page templates in install-desk/scaffold.md and the Obsidian
// settings in install-desk/obsidian.md. REQUIRED_FILES_V2 and GITIGNORE_V2 are carried here,
// and a Python test holds them equal to the workspace contract's.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot } = require("../lib/linkedroot.js");
const { parseHeader, HeaderError, writtenAsFloat } = require("../lib/header.js");
const { comparePaths } = require("../lib/desk.js");
const { loadDeskModel, drawnKinds } = require("../check/model.js");
const { readOutsideFences, sectionSpan } = require("../check/text.js");
const V = require("../check/values.js");
const { dumpLines, markMoments, sameValue, momentText, Moment, isCollection } = require("./yaml.js");
const {
  withLogEntry,
  logEntry,
  writePage,
  makeFolders,
  holdFolder,
  NotOwnFolder,
  NotClosed,
  PageNotWritten,
  NotWritable,
  FolderNotWritable,
  ahead,
  previousTail,
  endWithTail,
  codeOf,
  folderShown,
} = require("./history.js");

// The desk folder itself, as an answer names it (history.js folderShown): the update's paths are
// under the desk, so its own folder is the one holding celorus/.
const DESK_FOLDER = "the desk folder";
const { sha256 } = require("./digest.js");

const PLUGIN = path.resolve(__dirname, "..", "..");
const INSTALL = path.join(PLUGIN, "skills", "install-desk");
const PLUGIN_MODEL = path.join(INSTALL, "model");
const SCAFFOLD = path.join(INSTALL, "scaffold.md");
const OBSIDIAN = path.join(INSTALL, "obsidian.md");

const STEP_NAMES = [
  "moving folders",
  "writing desk.md",
  "rewriting index.md",
  "regrouping the log",
  "queueing promises",
  "flattening headers",
  "repointing paths",
  "renaming words",
  "writing the model pages and settings",
  "stamping the versions",
  "rebuilding the views",
  "logging the update",
];
const FOLDER_MOVES = { accounts: "firms", calls: "conversations" };
const TYPE_MOVES = { account: "firm", call: "conversation" };
// The four nested blocks layout 1 wrote, and the singular each flat name starts with.
const SINGULAR = { caps: "cap", roles: "role", crm_fields: "crm_field", connectors: "connector" };
const FOLLOW_UP_HEADER_V1 = ["who", "what", "by", "from", "state"];
const FOLLOW_UP_HEADER_V2 = ["owed_by", "who", "what", "by", "from", "state"];
const NO_STAMPS = "desk.md is missing and index.md holds no stamps; restore desk.md from the copy taken before the update";
// The files a layout 2 desk holds, and the lines its .gitignore holds (the workspace contract).
const REQUIRED_FILES_V2 = [
  ".gitignore",
  "celorus/index.md",
  "celorus/log.md",
  "celorus/desk-log.md",
  "celorus/motion-spec.md",
  "celorus/register.md",
  "celorus/marks.md",
  "celorus/queues/supplied.md",
  "celorus/queues/follow-ups.md",
  "celorus/queues/book.md",
  "celorus/crm/README.md",
  "celorus/context/tone.md",
  "celorus/context/never-say.md",
  "celorus/context/notes.md",
  "celorus/desk.md",
  "celorus/rules/rulebook.md",
  "celorus/model/model.md",
  "celorus/model/connections.md",
  "celorus/model/own-words.md",
];
const GITIGNORE_V2 = [".celorus/", "celorus/.obsidian/workspace*.json"];
const SKIP_TOP = new Set(["model", "views", "merges"]);

const WHITE = `[${V.BLANK_CLASS.slice(1, -1)}\\n]`;
const OLD_PATH = /(?<![A-Za-z0-9_-])(accounts|calls)\/(?=[A-Za-z0-9_./-]+\.md)/gu;
const OLD_LOG = /^- ([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}) · (.+)$/u;
const RENAME = /^(?<list>[a-z_]+): (?<old>[a-z0-9-]+) -> (?<new>[a-z0-9-]+)$/u;
const CHANGES = /^changes-v([0-9]+)\.md$/u;
const FRONT = /^---\n([\s\S]*?\n)---\n/u;
const PAGE_FRONT = /^---\n([\s\S]*?)\n---\n/u;
const KEY = /^(?<key>[A-Za-z_][A-Za-z0-9_]*):/u;
const PLACEHOLDER = /\{\{[a-z_]+\}\}/u;
const HEADING_PATH = /^## `([^`]+)`/u;
const FOLDER = /`(celorus\/[^`]*\/)`/gu;
const BLOCK = /^## `(celorus\/\.obsidian\/[a-z-]+\.json)`\n\n```json\n([\s\S]*?)\n```$/gmu;
// What a file browser leaves in a folder, by name: none of these is a page, and none is empty.
const LEAVINGS = new Set([".DS_Store", ".localized", ".gitkeep"]);

// Obsidian's own record of its open panes, rewritten while it runs and ignored by the desk's
// .gitignore: not something the update reads, so not part of the plan's inputs.
const OBSIDIAN_CHURN = /^\.obsidian\/workspace[^/]*\.json$/u;

// The update stopped; the message starts with the step's name ("before the first step" for a
// link, "confirming the plan" for a plan that changed). `changed` lists every path under the
// desk the update had already written, moved or removed when it stopped: empty means the desk
// is as it was.
class UpdateStopped extends Refusal {}

function stopped(message, changed = []) {
  const err = new UpdateStopped(message);
  err.changed = changed;
  return err;
}

// ---- reading and writing ----

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function isDir(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}

function lexists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// A file's text as Python's text mode reads it.
// Opened only when stat reports a regular file: anything else is missing as a page, in the
// words for one not there (as Run.read says it), never opened (R38).
function readText(file) {
  let bytes;
  try {
    if (!fs.statSync(file).isFile()) throw new Error(`${path.basename(file)} is missing`);
    bytes = fs.readFileSync(file);
  } catch (err) {
    if (err && err.code === "ENOENT") throw new Error(`${path.basename(file)} is missing`);
    throw err;
  }
  try {
    return UTF8.decode(bytes).replace(/\r\n?/gu, "\n");
  } catch {
    throw new Error(`${path.basename(file)} is not readable as UTF-8`);
  }
}

// A page's header (a mapping, or null) and body, as the checker's reader splits them.
function readHead(file) {
  const text = readText(file);
  const m = PAGE_FRONT.exec(text);
  if (!m) return { head: null, body: text, text };
  let head;
  try {
    head = parseHeader(m[1]);
  } catch (err) {
    if (err instanceof HeaderError) throw new Error(`the header of ${path.basename(file)} does not parse: ${err.message}`);
    throw err;
  }
  return { head: V.isMapping(head) ? head : null, body: text.slice(m[0].length), text, raw: m[1] };
}

// Every path under `dir` (files and folders), relative with forward slashes, in path order.
function walk(dir) {
  const out = [];
  const go = (folder, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      out.push(rel);
      if (entry.isDirectory()) go(path.join(folder, entry.name), rel);
    }
  };
  go(dir, "");
  return out.sort(comparePaths);
}

function markdownFiles(dir) {
  return walk(dir).filter((rel) => rel.endsWith(".md") && isFile(path.join(dir, ...rel.split("/"))));
}

function at(root, rel) {
  return path.join(root, ...rel.split("/"));
}

function isLink(file) {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
}

// ---- links ----

// The desk folder with every link in its own path resolved, so a desk reached through a linked
// parent folder is read where it is. A folder that is not there is left as named, and the
// update's first check stops on it.
function deskRoot(desk) {
  try {
    return fs.realpathSync(path.resolve(desk));
  } catch {
    return path.resolve(desk);
  }
}

// Every link in what the update would touch, from the desk folder: .gitignore, the celorus
// folder, and everything under it. Nothing under a linked folder is walked.
function linksAt(desk) {
  const found = [".gitignore", "celorus"].filter((rel) => isLink(at(desk, rel)));
  if (found.includes("celorus")) return found;
  const root = path.join(desk, "celorus");
  return [...found, ...walk(root).filter((rel) => isLink(at(root, rel))).map((rel) => `celorus/${rel}`)];
}

// The update never writes, moves or removes through a link: what a link points at may be
// outside the desk, and outside its history. So a desk holding one is refused, naming each,
// before anything is read for writing, by the preview and by the apply alike.
function refuseLinks(desk) {
  // celorus/, celorus/views/ and celorus/log.md first, in the words every writer refuses them
  // in (lib/linkedroot.js); then any other link, named here.
  refuseLinkedRoot(desk);
  const links = linksAt(desk);
  if (!links.length) return;
  throw stopped(
    `before the first step: ${links.map((rel) => `${rel} is a link`).join(", ")}; the update never ` +
      "writes through a link, since what it points at may be outside the desk. Put the file or " +
      'folder itself in its place, then say "update my desk" again',
  );
}

// What an entry the preview's copy meets is, when it is neither a file, a folder nor a link, in
// words: "a pipe", "a socket" or "a device"; null otherwise. Read off the listing, which looks at
// the entry without following it or opening it.
function oddEntryKind(entry) {
  if (entry.isFIFO()) return "a pipe";
  if (entry.isSocket()) return "a socket";
  if (entry.isCharacterDevice() || entry.isBlockDevice()) return "a device";
  return null;
}

// Every entry the preview copies (the desk folder, each .git left out as the copy leaves it out)
// that is a pipe, a socket or a device: its path under the desk, and its kind. No link is followed
// and nothing is opened: opening a pipe waits for a writer.
function oddEntriesAt(desk) {
  const out = [];
  const go = (folder, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return; // a folder that cannot be listed: the copy meets it and stops, as it does today
    }
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const kind = oddEntryKind(entry);
      if (kind !== null) out.push([rel, kind]);
      else if (entry.isDirectory()) go(path.join(folder, entry.name), rel);
    }
  };
  go(desk, "");
  return out.sort(([a], [b]) => comparePaths(a, b));
}

// The preview runs the update on a copy of the whole desk folder, and a pipe, a socket or a
// device cannot be copied as a file (copying a pipe would wait on it, or stop on an error the
// update has no words for). So one on the desk is refused, named by its path under the desk with
// its kind, before the temporary folder is made and before anything is copied (R39).
function refuseOddEntries(desk) {
  const odd = oddEntriesAt(desk);
  if (!odd.length) return;
  throw stopped(
    `before the first step: ${odd.map(([rel, kind]) => `${rel} is ${kind}`).join(", ")}; the preview copies the ` +
      "desk folder to run the update on, and a pipe, a socket or a device cannot be copied as a file, so no " +
      'copy was made. Move each out of the desk folder, then say "update my desk" again.',
  );
}

// A path under the desk, with forward slashes.
function under(desk, file) {
  return path.relative(desk, file).split(path.sep).join("/");
}

// Runs one write, move or removal. A folder on its way swapped for a link after the checks by
// path (history.js checks the opened file, and the folder again before a move) stops it, in the
// update's own words. Any other error at a write stops it too, by its code only, never its
// message (which names the absolute path). A write that may have left a page incomplete carries
// the page (`rel`) and its previous text (`previous`) to the stop, which ends with that text.
function guard(desk, fn) {
  try {
    return fn();
  } catch (err) {
    if (!(err instanceof NotOwnFolder)) {
      // A page or folder the desk holds that does not let this person write, met with no words of
      // its own: its words by its path under the desk ride along (`readOnly`), for the preview's
      // scratch run, whose copy keeps the desk's modes (runUpdate's step).
      const said = readOnlySaid(desk, err);
      throw Object.assign(new Error(`a write stopped (${codeOf(err)})`), { pathless: faultOf(err) }, said === null ? {} : { readOnly: said });
    }
    const rel = under(desk, err.file);
    const said = err.told(rel, DESK_FOLDER);
    const stop = new Error(err.link ? `${said}, and the update never writes through one` : said);
    if (faultOf(err) !== null) stop.pathless = faultOf(err);
    if (typeof err.previous === "string") Object.assign(stop, { rel, previous: err.previous });
    // A page on the desk as written, then not closed: a change the stop names (history.js NotClosed).
    if (err instanceof NotClosed) Object.assign(stop, { written: true, code: err.code });
    throw stop;
  }
}

// The codes a page or a folder that does not let this person write answers with.
const READ_ONLY = new Set(["EACCES", "EPERM", "EROFS"]);

// What stopped a write, in words that name no path (`pathless`): how a stop on the preview's
// scratch copy says it (stoppedPartWay), since no page there is the desk's, and the copy is gone
// when the answer is read. Null for a stop the copy meets because of what the desk itself holds,
// which the copy keeps (a read-only page, a folder that takes no new page, an entry that is not a
// plain page): that is true of the desk, and is said in its own words, by the desk's own paths.
function faultOf(err) {
  if (err instanceof NotClosed) return `a page could not be closed (${err.code})`;
  if (err instanceof PageNotWritten) return `a page ${err.fault}`;
  if (err instanceof NotOwnFolder && err.link) return "a folder on the way was no longer the copy's own";
  if (err instanceof NotWritable || err instanceof FolderNotWritable) return READ_ONLY.has(err.code) ? null : `a write stopped (${err.code})`;
  if (err instanceof NotOwnFolder) return null;
  if (READ_ONLY.has(codeOf(err))) return null;
  return `a write stopped (${codeOf(err)})`;
}

// A write's own error with a read-only code, in the words the desk's read-only faults are said in,
// by its path under `desk` (the copy's path mapped back): a spare made beside a page, or a folder
// being made, is refused by the folder that would hold it, which takes no new page; any other path
// is a page that is read-only. Null for any other error, or one with no path under the desk.
function readOnlySaid(desk, err) {
  if (!err || !READ_ONLY.has(err.code) || typeof err.path !== "string") return null;
  const rel = path.relative(desk, err.path);
  if (rel === "" || rel.split(path.sep)[0] === ".." || path.isAbsolute(rel)) return null;
  const shown = rel.split(path.sep).join("/");
  if (/\.celorus-writing(-[0-9]+)?$/u.test(shown) || err.syscall === "mkdir") {
    const dir = path.posix.dirname(shown);
    return `${folderShown(dir === "." ? "" : dir, DESK_FOLDER)} cannot take a new page (${err.code})`;
  }
  return `${shown} is read-only (${err.code})`;
}

// The calls that only read: a fault met there in the scratch run is said as a read.
const READS = new Set(["open", "read", "stat", "lstat", "fstat", "scandir", "readdir", "realpath"]);

// What stopped a step of the preview's scratch run, in words with no path (scratchStop), or null
// for a stop said in its own words: a read-only fault the desk holds, named by its path under the
// desk, or a refusal in the engine's own words about what a page holds. A stop with its `pathless`
// words is said in them; any other fault the file system answered with a code (a read that
// failed, say) is said by that code alone, never by its message, which names the copy's path.
function scratchFault(err) {
  if (err && typeof err.pathless === "string") return err.pathless;
  if (err && typeof err.code === "string") {
    return `${READS.has(err.syscall) ? "a file could not be read" : "a file operation failed"} (${err.code})`;
  }
  return null;
}

// Whether a path page's refusal (paths/write.js) is a read-only fault of the page or folder the
// desk holds: its code, in the words' own "(<code>)", is one a page or folder that does not let
// this person write answers with, and the refusal carries no previous text (a page left torn is
// the copy's, never the desk's).
function readOnlyRefusal(err) {
  if (!err || typeof err.message !== "string" || typeof err.tail === "string") return false;
  const code = typeof err.code === "string" ? err.code : (/\((E[A-Z]+)\)/u.exec(err.message) || [])[1];
  return READ_ONLY.has(code);
}

// What the preview, or the update, says of a working copy it could not remove: the answer is not
// the copy's, so the copy is never named by its path.
const DESK_COPY_LEFT = "The copy of the desk the preview ran on could not be removed, and was left in the engine's working folder.";
const MODEL_COPY_LEFT = "The copy of the model the update read could not be removed, and was left in the engine's working folder.";

// Removes `tmp`, a folder in the engine's working folder, and never throws over the answer. A copy
// keeps each folder's mode (a read-only folder of the desk is read-only in its copy too), so each
// folder in it is made owner-writable first. Returns false when it could not be removed.
function removeWorking(tmp) {
  const open = (dir) => {
    try {
      fs.chmodSync(dir, (fs.lstatSync(dir).mode & 0o7777) | 0o700);
    } catch {
      // A folder that cannot be opened is met by the removal below, and said as left.
    }
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) if (entry.isDirectory()) open(path.join(dir, entry.name));
  };
  try {
    open(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
    return true;
  } catch {
    return !lexists(tmp);
  }
}

// A stop, with each sentence saying a working copy was left put after its words (before a previous
// text, which ends the answer whole). The sentences are kept on it (`workingLeft`), so the apply,
// which says its plan-confirming preview's stop in words of its own, says them too.
function saidLeft(err, sentences) {
  if (!sentences.length || !(err instanceof Error)) return err;
  const tail = typeof err.tail === "string" && err.message.endsWith(err.tail) ? err.tail : "";
  const words = err.message.slice(0, err.message.length - tail.length);
  err.message = `${words}${/[.!?]$/u.test(words) ? "" : "."} ${sentences.join(" ")}${tail}`;
  err.workingLeft = [...(Array.isArray(err.workingLeft) ? err.workingLeft : []), ...sentences];
  return err;
}

// Throws unless `file` is under the desk with no link on the way: the guard by path before any
// write, move or removal.
function ownPath(desk, file) {
  const rel = path.relative(desk, file);
  if (rel === "" || rel.split(path.sep)[0] === ".." || path.isAbsolute(rel)) {
    throw new Error(`${file} is outside the desk, and the update never writes there`);
  }
  let cur = desk;
  for (const part of rel.split(path.sep)) {
    cur = path.join(cur, part);
    if (isLink(cur)) {
      throw new Error(`${path.relative(desk, cur).split(path.sep).join("/")} is a link, and the update never writes through one`);
    }
    if (!lexists(cur)) return;
  }
}

// What the update reads, as one digest: .gitignore, and every folder and file under celorus/
// but Obsidian's pane record. Folders count, since the update adds the ones the desk lacks.
function inputsDigest(desk) {
  const h = sha256();
  const add = (rel, file) => {
    // Opened only when stat reports a regular file, as the walk below picks them (R38).
    if (!fs.statSync(file).isFile()) return;
    const bytes = fs.readFileSync(file);
    h.update(`${rel}\0${bytes.length}\0`).update(bytes);
  };
  if (isFile(path.join(desk, ".gitignore"))) add(".gitignore", path.join(desk, ".gitignore"));
  const root = path.join(desk, "celorus");
  for (const rel of walk(root)) {
    if (OBSIDIAN_CHURN.test(rel)) continue;
    const file = at(root, rel);
    if (isDir(file)) h.update(`celorus/${rel}/\0`);
    else if (isFile(file)) add(`celorus/${rel}`, file);
  }
  return h.hex();
}

// The plan a preview shows, as one digest: what it read (every path and its bytes), and what it
// would do: each path it writes, each path it moves a page away from or removes, each folder it
// empties and removes, and each kind of change it names. The moment is not in it, so a yes given
// later in the day still matches.
function planDigest(inputs, result, pagesBefore, pagesAfter) {
  const said = {
    inputs,
    target: pyStr(result.target),
    changed: result.changed,
    left: result.left,
    folders: result.folders,
    notes: result.notes,
    flags: result.flags,
    pagesBefore,
    pagesAfter,
  };
  return sha256().update(JSON.stringify(said)).hex();
}

// ---- values as Python spells them ----

// str(value): a date or moment the header wrote bare as Python prints the date it built.
function pyStr(value) {
  if (value instanceof Moment) return momentText(value.text, " ");
  return V.show(value);
}

// int(value), or an error as Python's.
function pyInt(value) {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") return Math.trunc(value);
  if (value instanceof V.PyFloat) return Math.trunc(value.value);
  if (typeof value === "string" && /^[ \t\n\r\f\v]*[+-]?[0-9](?:_?[0-9])*[ \t\n\r\f\v]*$/u.test(value)) {
    return Number(value.replace(/_/gu, ""));
  }
  throw new Error(`invalid literal for int() with base 10: ${V.show([value]).slice(1, -1)}`);
}

// json.dumps(value, default=str, ensure_ascii=False), Python's spelling.
function pyJson(value) {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return String(value);
  if (value instanceof V.PyFloat) return V.show(value);
  if (value instanceof Moment) return JSON.stringify(momentText(value.text, " "));
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pyJson).join(", ")}]`;
  return `{${Object.keys(value).map((k) => `${JSON.stringify(k)}: ${pyJson(value[k])}`).join(", ")}}`;
}

// A header value as the update compares and writes it: a float the header wrote as one a
// PyFloat, and a date or moment it wrote bare a Moment (`raw` is the header text it was read
// from). A value already marked is kept as it is.
function marked(value, raw) {
  if (value instanceof Moment || value instanceof V.PyFloat) return value;
  const one = (holder, key, item) => (writtenAsFloat(holder, key) ? new V.PyFloat(item) : marked(item, raw));
  if (typeof value === "string") return markMoments(value, raw);
  if (Array.isArray(value)) return value.map((item, i) => one(value, i, item));
  if (V.isMapping(value)) {
    const out = {};
    for (const key of Object.keys(value)) out[key] = one(value, key, value[key]);
    return out;
  }
  return value;
}

function inList(list, value) {
  return list.some((item) => sameValue(item, value));
}

function count(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ---- header lines ----

// The header's lines grouped by the top-level key each belongs to, in order.
function chunks(head) {
  const out = [];
  for (const line of V.splitLines(head)) {
    const m = KEY.exec(line);
    if (m || !out.length) out.push([m ? m.groups.key : null, [line]]);
    else out[out.length - 1][1].push(line);
  }
  return out;
}

// A value as header lines: a list of plain values on one line, a plain value `key: value`.
function render(key, value) {
  return dumpLines({ [key]: value }, { sortKeys: false, flow: isCollection(value) ? null : false, momentSep: "T" });
}

// The old header's own lines for each detail, the nested block's lifted one level.
function verbatim(text) {
  const m = FRONT.exec(text);
  if (!m) return new Map();
  const out = new Map();
  for (const [key, lines] of chunks(m[1])) if (key !== null) out.set(key, lines);
  const block = (out.get("celorus") || []).slice(1);
  const filled = block.filter((line) => V.strip(line));
  if (filled.length) {
    const cut = Math.min(...filled.map((line) => line.length - line.replace(/^ +/u, "").length));
    const lifted = block.map((line) => line.slice(cut)).join("\n");
    for (const [key, lines] of chunks(lifted)) if (key !== null && !out.has(key)) out.set(key, lines);
  }
  return out;
}

// Whether the lines, read alone, hold exactly `key: value`.
function sameLines(lines, key, value, raw) {
  let head;
  try {
    head = parseHeader(lines.join("\n"));
  } catch {
    return false;
  }
  if (!V.isMapping(head)) return false;
  const keys = Object.keys(head);
  return keys.length === 1 && keys[0] === key && sameValue(marked(head, raw)[key], value);
}

// A page from its header and body. Given the page's old text, every detail that keeps its name
// and its value is written as the old header wrote it. `raw` is header text a date or moment in
// the values was read from, to write it bare where the header did.
function dumpPage(head, body, old = null, raw = null) {
  const kept = old ? verbatim(old) : new Map();
  const source = raw ?? (old ? (FRONT.exec(old) || [null, ""])[1] : "");
  const lines = [];
  for (const [key, value] of Object.entries(marked(head, source))) {
    const chunk = kept.get(key);
    if (chunk !== undefined && sameLines(chunk, key, value, source)) lines.push(...chunk);
    else lines.push(...render(key, value));
  }
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

// Where a section's lines are in the body's lines, read as the checker reads it.
function span(body, heading) {
  const outside = V.splitLines(readOutsideFences(body)[0]);
  const found = sectionSpan(outside, heading);
  if (found === null) return null;
  return [found[0], found[1] === outside.length ? V.splitLines(body).length : found[1]];
}

// Adds lines to the body's `## <heading>` section, after its last line; the heading once, at
// the end, only when the body has none. A line already in the section is not added again.
function addToSection(body, heading, lines) {
  const found = span(body, heading);
  let fresh = [...new Set(lines)];
  if (found === null) {
    const text = `${body.replace(/\n+$/u, "")}\n\n## ${heading}\n`;
    return text + (fresh.length ? `\n${fresh.join("\n")}\n` : "");
  }
  const rows = V.splitLines(body);
  const have = rows.slice(found[0], found[1]);
  fresh = fresh.filter((line) => !have.includes(line));
  if (!fresh.length) return body;
  const filled = [];
  for (let i = found[0]; i < found[1]; i += 1) if (V.strip(rows[i])) filled.push(i);
  const where = filled.length ? filled[filled.length - 1] + 1 : found[0];
  rows.splice(where, 0, ...(filled.length ? fresh : ["", ...fresh]));
  return `${rows.join("\n")}\n`;
}

// A part of a line holding a scheme's colon and two slashes: a web address, the person's words.
// The two slashes are written as a count, since the engine's files carry no address literal.
const WEB_ADDRESS = new RegExp(":/{2}", "u");

// Paths under the old folders named by their new ones. A web address is left as written.
function repoint(text) {
  return text
    .split(new RegExp(`(${WHITE}+)`, "u"))
    .map((part) => (WEB_ADDRESS.test(part) ? part : part.replace(OLD_PATH, (_, old) => `${FOLDER_MOVES[old]}/`)))
    .join("");
}

// Where a page that was at `rel` (from the desk folder) is after the update.
function keptAt(rel) {
  const parts = rel.split("/");
  return parts.length > 1 && SKIP_TOP.has(parts[1]) ? rel : repoint(rel);
}

// ---- the plugin's own files ----

// Every `## <backticked path>` heading in the scaffold, mapped to the fenced block below it.
function templates() {
  const lines = V.splitLines(readText(SCAFFOLD));
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const m = HEADING_PATH.exec(lines[i]);
    const rel = m ? m[1] : null;
    if (rel === null || !(rel === ".gitignore" || rel.startsWith("celorus/"))) {
      i += 1;
      continue;
    }
    while (i < lines.length && !lines[i].startsWith("```")) i += 1;
    if (i >= lines.length) throw new Error(`${rel}: heading with no fenced block`);
    i += 1;
    const body = [];
    while (i < lines.length && lines[i].replace(/\s+$/u, "") !== "```") {
      body.push(lines[i]);
      i += 1;
    }
    if (i >= lines.length) throw new Error(`${rel}: unterminated fenced block`);
    if (!body.length) throw new Error(`${rel}: empty template`);
    out[rel] = `${body.join("\n")}\n`;
    i += 1;
  }
  return out;
}

// The empty folders the scaffold names.
function emptyFolders() {
  const text = readText(SCAFFOLD);
  const at = text.indexOf("## The empty folders");
  if (at === -1) throw new Error("the scaffold no longer names its empty folders");
  const part = text.slice(at + "## The empty folders".length).split("\n## ")[0];
  return V.sortedText(new Set([...part.matchAll(FOLDER)].map((m) => m[1])));
}

// The Obsidian settings files obsidian.md writes, each [path, text].
function obsidianBlocks() {
  return [...readText(OBSIDIAN).matchAll(BLOCK)].map((m) => [m[1], m[2]]);
}

function fill(template, values) {
  let text = template;
  for (const [key, value] of Object.entries(values)) text = text.split(`{{${key}}}`).join(value);
  const left = PLACEHOLDER.exec(text);
  if (left) throw new Error(`the template needs ${left[0]}, which the desk does not record`);
  return text;
}

// ---- the run ----

class Run {
  constructor(desk, today, now) {
    this.desk = desk;
    this.root = path.join(desk, "celorus");
    this.today = today;
    this.now = now;
    this.changed = new Set();
    // Paths the update moved a page away from or removed, as paths under the desk: a stop
    // part-way names them beside `changed`.
    this.left = new Set();
    // Folders the update made, or removed after moving what they held, as paths under the desk.
    this.folders = new Set();
    // Each page the update moved, by where it went, with where it was, as paths under the desk;
    // and each path the update wrote. A moved page it then rewrites is checked before the first
    // write through the page it is (applyUpdate).
    this.moved = new Map();
    this.wrote = new Set();
    // True on the preview's copy, whose own changes are never the desk's.
    this.scratch = false;
    this.flags = [];
    this.notes = [];
    // A noise file or an emptied folder the update could not remove, each as a sentence naming
    // it ("<rel> was left in place (<code>)."): the desk is right without the removal.
    this.leftInPlace = [];
    // A working copy the run could not remove, each as a sentence with no path (removeWorking).
    this.workingLeft = [];
  }

  // Everything the run has done to the desk so far, folders too, as paths under the desk.
  touched() {
    return V.sortedText(new Set([...this.changed, ...this.left, ...this.folders]));
  }

  // Makes a folder and any missing above it, never through a link, and counts each one made, a
  // stop part way too.
  makeFolder(dir) {
    const made = [];
    try {
      guard(this.desk, () => makeFolders(dir, made));
    } finally {
      for (const folder of made) this.folders.add(under(this.desk, folder));
    }
  }

  read(rel) {
    const file = at(this.desk, rel);
    if (!isFile(file)) throw new Error(`${rel} is missing`);
    return readText(file);
  }

  write(rel, text) {
    const file = at(this.desk, rel);
    if (isFile(file)) {
      let same = false;
      try {
        same = readText(file) === text;
      } catch {
        same = false;
      }
      if (same) return;
    }
    ownPath(this.desk, file);
    this.makeFolder(path.dirname(file));
    try {
      guard(this.desk, () => writePage(file, text));
    } catch (err) {
      // A page a failed write may have left incomplete, or wrote and then could not close, is a
      // change the stop names.
      if (typeof err.previous === "string" || err.written === true) this.changed.add(rel);
      if (err.written === true) this.wrote.add(rel);
      throw err;
    }
    this.changed.add(rel);
    this.wrote.add(rel);
  }

  // The desk's pages outside the model, the views and the merge records, as paths under celorus/.
  pages() {
    return markdownFiles(this.root).filter((rel) => !SKIP_TOP.has(rel.split("/")[0]));
  }
}

function values(run) {
  const stamps = readHead(path.join(run.root, "desk.md")).head || {};
  const get = (key, empty) => {
    const v = V.own(stamps, key);
    return pyStr(V.truthy(v) ? v : empty);
  };
  return {
    desk: get("desk", ""),
    desk_id: get("desk_id", ""),
    now: run.now,
    date: run.today,
    time: run.now.slice(11, 16),
    model_version: get("model_version", 0),
    pack: get("pack", ""),
    pack_version: get("pack_version", 0),
  };
}

// The old index's header and its `celorus:` block, or a stop: desk.md is never written from
// nothing, because its desk_id would be made up.
function oldStamps(run) {
  const index = path.join(run.root, "index.md");
  const read = isFile(index) ? readHead(index) : null;
  const head = read ? read.head : null;
  const cel = V.own(head || {}, "celorus");
  if (!V.isMapping(cel)) throw new Error(NO_STAMPS);
  if (!V.truthy(V.own(cel, "desk_id"))) throw new Error("index.md holds no desk_id; the update never makes one up");
  if (!(V.truthy(V.own(cel, "desk")) || V.truthy(V.own(head, "title")))) {
    throw new Error("index.md holds no name for the desk; the update never makes one up");
  }
  return { head, cel, raw: read.raw };
}

function checkStamps(run) {
  if (!isFile(path.join(run.root, "desk.md"))) oldStamps(run);
}

// A file the person did not write and cannot see: an empty-folder marker, or what a file
// browser leaves behind. A page of theirs never starts with a dot.
function noise(file) {
  const name = path.basename(file);
  if (!name.startsWith(".")) return false;
  if (LEAVINGS.has(name) || name.startsWith("._")) return true;
  // Opened only when stat reports a regular file; anything else is not noise (R38).
  if (!fs.statSync(file).isFile()) return false;
  return fs.readFileSync(file).every((b) => b === 0x20 || (b >= 0x09 && b <= 0x0d));
}

function checkMoves(run) {
  for (const [old, now] of Object.entries(FOLDER_MOVES)) {
    const src = path.join(run.root, old);
    if (!isDir(src)) continue;
    for (const rel of walk(src)) {
      const file = at(src, rel);
      const target = at(path.join(run.root, now), rel);
      if (isFile(file) && !noise(file) && lexists(target)) {
        throw new Error(
          `moving ${path.relative(run.desk, file).split(path.sep).join("/")}: ` +
            `${path.relative(run.desk, target).split(path.sep).join("/")} already exists`,
        );
      }
    }
  }
}

// Puts back the folder moves done so far: each page renamed back, the last first, then each
// folder made for them removed, the deepest first. Returns what could not be put back, as paths
// under the desk (a folder with its trailing slash), each also counted as a change of the run so
// the stop names it; empty when the desk is as it was.
function putMovesBack(run, renamed, made) {
  const where = (file) => under(run.desk, file);
  const left = [];
  for (const [file, target] of [...renamed].reverse()) {
    try {
      holdFolder(target);
      holdFolder(file);
      fs.renameSync(target, file);
    } catch {
      left.push(`${where(target)} (moved from ${where(file)})`);
      run.left.add(where(file));
      run.changed.add(where(target));
    }
  }
  for (const dir of [...made].reverse()) {
    try {
      fs.rmdirSync(dir);
    } catch {
      left.push(folderShown(where(dir), DESK_FOLDER));
      run.folders.add(where(dir));
    }
  }
  return left;
}

// The folder moves, the update's first writes, in the order of the rule in history.js. Whether a
// page may leave its folder cannot be asked, so every rename is taken before anything else is
// written. `made` holds the folders the up-front check made (applyUpdate), the first steps of
// kind (b). If a rename fails part way, the renames already done are renamed back in reverse, the
// folders made (by the check, and for the moves) are removed, and the update is refused: "Nothing
// was changed." (or, when putting back fails too, the stop names exactly what is left). Only
// after every rename: each noise file whose place is taken is removed, then each emptied source
// folder. A failure there leaves the desk correct, so it never stops the update: the file or
// folder is left, and the answer names it ("<rel> was left in place").
function moveFolders(run, made = []) {
  // A folder the up-front check made that holds no file yet stands for one the update had not
  // made yet at this point: it counts as not there, so a scaffold folder is found empty (and
  // given its .gitkeep) exactly as the preview found it.
  const early = new Set(made);
  const bare = (dir) => early.has(dir) && fs.readdirSync(dir).every((name) => bare(path.join(dir, name)));
  const where = (file) => under(run.desk, file);
  const renamed = [];
  const removals = [];
  const pairs = [];
  try {
    checkMoves(run);
    for (const [old, now] of Object.entries(FOLDER_MOVES)) {
      const src = path.join(run.root, old);
      if (!isDir(src)) continue;
      const all = walk(src);
      for (const rel of all.filter((r) => isFile(at(src, r)))) {
        const file = at(src, rel);
        const target = at(path.join(run.root, now), rel);
        ownPath(run.desk, file);
        ownPath(run.desk, target);
        if (lexists(target) && noise(file)) {
          removals.push({ file, remove: fs.unlinkSync, folder: false });
          continue;
        }
        guard(run.desk, () => makeFolders(path.dirname(target), made));
        // The folders holding each end checked again just before the move.
        guard(run.desk, () => {
          holdFolder(target);
          holdFolder(file);
        });
        try {
          fs.renameSync(file, target);
        } catch (err) {
          // A page that may not leave its folder is what the desk holds (faultOf); any other code
          // is the write's own.
          const code = codeOf(err);
          throw Object.assign(
            new Error(`${where(file)} could not be moved to ${where(target)} (${code})`),
            READ_ONLY.has(code) ? {} : { pathless: `a page could not be moved (${code})` },
          );
        }
        renamed.push([file, target]);
      }
      for (const rel of all.filter((r) => isDir(at(src, r))).reverse()) {
        ownPath(run.desk, at(src, rel));
        removals.push({ file: at(src, rel), remove: fs.rmdirSync, folder: true });
      }
      ownPath(run.desk, src);
      removals.push({ file: src, remove: fs.rmdirSync, folder: true });
      pairs.push([old, now]);
    }
  } catch (err) {
    const left = putMovesBack(run, renamed, made);
    if (!left.length) throw err;
    // On the preview's scratch copy, what is left is the copy's, never the desk's: said with no
    // path, a read-only move too (stoppedPartWay).
    throw Object.assign(
      new Error(`${err.message}; putting the moves back failed too, so ${left.join(", ")} ${left.length === 1 ? "is" : "are"} left`),
      { pathless: `${typeof err.pathless === "string" ? err.pathless : "a move stopped"}, and the moves could not be put back` },
    );
  }
  for (const [file, target] of renamed) {
    run.left.add(where(file));
    run.changed.add(where(target));
    run.moved.set(where(target), where(file));
  }
  for (const dir of made) run.folders.add(where(dir));
  for (const { file, remove, folder } of removals) {
    try {
      holdFolder(file);
      remove(file);
    } catch (err) {
      const shown = folder ? folderShown(where(file), DESK_FOLDER) : where(file);
      run.leftInPlace.push(`${shown} was left in place (${err instanceof NotOwnFolder ? "a folder on its way is a link" : codeOf(err)}).`);
      continue;
    }
    if (folder) run.folders.add(where(file));
    else run.left.add(where(file));
  }
  for (const [old, now] of pairs) run.notes.push(`Folder renamed: ${old} becomes ${now}.`);
  for (const rel of emptyFolders()) {
    const folder = at(run.desk, rel);
    ownPath(run.desk, folder);
    run.makeFolder(folder);
    if (fs.readdirSync(folder).every((name) => bare(path.join(folder, name)))) run.write(`${rel.replace(/\/+$/u, "")}/.gitkeep`, "");
  }
}

function writeDeskMd(run) {
  if (isFile(path.join(run.root, "desk.md"))) return;
  const { head, cel, raw } = oldStamps(run);
  const name = pyStr(V.truthy(V.own(cel, "desk")) ? V.own(cel, "desk") : V.own(head, "title"));
  const chain = V.items(V.truthy(V.own(cel, "chain")) ? V.own(cel, "chain") : []);
  if (!inList(chain, "check-desk")) chain.push("check-desk");
  const seats = V.items(V.truthy(V.own(cel, "seats")) ? V.own(cel, "seats") : []);
  const stamps = {
    type: "desk",
    title: name,
    description: "Who this desk is, its stamps and its switches",
    timestamp: new Moment(run.now),
    desk: name,
    desk_id: V.own(cel, "desk_id"),
    layout_version: 2,
    model_version: 0,
    pack: "",
    pack_version: 0,
    named_only_contact_details: false,
    seats,
    chain,
  };
  const body = templates()["celorus/desk.md"].replace(FRONT, "").split("{{desk}}").join(name);
  run.write("celorus/desk.md", dumpPage(stamps, body, null, raw));
  run.notes.push("A new page, desk.md, holds the stamps index.md used to hold.");
}

function rewriteIndex(run) {
  const index = path.join(run.root, "index.md");
  const head = isFile(index) ? readHead(index).head : null;
  // Already the short form: anything else the person added to their own index.md is theirs.
  if (head !== null && V.own(head, "okf_version") === "0.2" && !Object.hasOwn(head, "celorus")) return;
  run.write("celorus/index.md", fill(templates()["celorus/index.md"], values(run)));
  run.notes.push("index.md is rewritten to the short form; its old text is in the copy taken before the update.");
}

function regroupLog(run) {
  const text = run.read("celorus/log.md");
  if (text.startsWith("# Log")) return;
  const days = new Map();
  const add = (day, line) => {
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(line);
  };
  for (const line of V.splitLines(text.replace(FRONT, ""))) {
    if (!V.strip(line) || V.strip(line) === "# Log") continue;
    const m = OLD_LOG.exec(line);
    if (m) add(m[1], `* ${m[2]} · ${m[3]}`);
    else add(run.today, `* 00:00 · kept by the update · ${V.strip(line)}`);
  }
  const out = ["# Log", ""];
  for (const day of V.sortedText(days.keys()).reverse()) out.push(`## ${day}`, "", ...days.get(day), "");
  run.write("celorus/log.md", out.join("\n"));
  run.notes.push("The log is regrouped under one heading per day, newest first.");
}

function cells(line) {
  return V.strip(line).replace(/^\|+|\|+$/gu, "").split("|").map(V.strip);
}

// The queue's own table: the run of pipe lines the header starts, and that header.
function queueTable(lines) {
  const first = lines.findIndex((line) => line.startsWith("|"));
  if (first === -1) return [[], FOLLOW_UP_HEADER_V2];
  const table = [first];
  while (table[table.length - 1] + 1 < lines.length && lines[table[table.length - 1] + 1].startsWith("|")) {
    table.push(table[table.length - 1] + 1);
  }
  return [table, cells(lines[first])];
}

function sameHeader(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function knownHeader(header) {
  return sameHeader(header, FOLLOW_UP_HEADER_V1) || sameHeader(header, FOLLOW_UP_HEADER_V2);
}

// Every promise written in a call's header, wherever the page sits.
function promisesOn(run) {
  const out = [];
  for (const folder of ["calls", "conversations"]) {
    const src = path.join(run.root, folder);
    if (!isDir(src)) continue;
    for (const rel of markdownFiles(src)) {
      const read = readHead(at(src, rel));
      const cel = V.own(read.head || {}, "celorus");
      const block = V.truthy(cel) ? cel : {};
      const block2 = marked(block, read.raw || "");
      const commitments = V.own(block2, "commitments");
      for (const promise of V.truthy(commitments) ? V.items(commitments) : []) {
        if (!V.isMapping(promise) || promise instanceof Moment || !Object.hasOwn(promise, "what")) {
          throw new Error(
            `the promise on ${path.relative(run.desk, at(src, rel)).split(path.sep).join("/")} does not say what was promised`,
          );
        }
        out.push([`conversations/${rel}`, { lead: V.own(block2, "lead") ?? null, ...promise }]);
      }
    }
  }
  return out;
}

function checkQueue(run) {
  const lines = run.read("celorus/queues/follow-ups.md").split("\n");
  const [table, header] = queueTable(lines);
  if (!knownHeader(header)) {
    throw new Error(`the follow-ups table has the columns ${V.show(header)}, which neither layout writes`);
  }
  for (const i of table.slice(2)) {
    const row = cells(lines[i]);
    if (row.length < header.length) {
      throw new Error(`the follow-ups row ${V.strip(lines[i])} has ${row.length} cells, not the ${header.length} its columns name`);
    }
  }
  promisesOn(run);
}

function queuePromises(run) {
  const rel = "celorus/queues/follow-ups.md";
  const lines = run.read(rel).split("\n");
  const [table, header] = queueTable(lines);
  if (!knownHeader(header)) {
    throw new Error(`the follow-ups table has the columns ${V.show(header)}, which neither layout writes`);
  }
  const rows = [];
  for (const i of table.slice(2)) {
    let row = cells(lines[i]);
    if (row.length < header.length) {
      throw new Error(`the follow-ups row ${V.strip(lines[i])} has ${row.length} cells, not the ${header.length} its columns name`);
    }
    if (sameHeader(header, FOLLOW_UP_HEADER_V1)) {
      const [who, state, source, by] = [row[0], row[row.length - 1], row[row.length - 2], row[row.length - 3]];
      row = ["us", who, row.slice(1, -3).join(" | "), by, repoint(source), state];
    }
    rows.push(row);
  }
  const keyOf = (r) => JSON.stringify([r[1], r[2], r[3], r[4]]);
  const seen = new Set(rows.map(keyOf));
  let added = 0;
  let undated = 0;
  for (const [source, promise] of promisesOn(run)) {
    const lead = promise.lead;
    const by = V.own(promise, "by");
    const row = ["us", pyStr(V.truthy(lead) ? lead : ""), pyStr(promise.what), pyStr(V.truthy(by) ? by : ""), source, "due"];
    if (!seen.has(keyOf(row))) {
      rows.push(row);
      seen.add(keyOf(row));
      added += 1;
      undated += row[3] ? 0 : 1;
    }
  }
  if (table.length && sameHeader(header, FOLLOW_UP_HEADER_V2) && !added) return;
  const fresh = [`| ${FOLLOW_UP_HEADER_V2.join(" | ")} |`, `|${"---|".repeat(FOLLOW_UP_HEADER_V2.length)}`];
  fresh.push(...rows.map((r) => `| ${r.join(" | ")} |`));
  const start = table.length ? table[0] : lines.length;
  const end = table.length ? table[table.length - 1] + 1 : lines.length;
  run.write(rel, [...lines.slice(0, start), ...fresh, ...lines.slice(end)].join("\n"));
  if (added) {
    run.notes.push(
      `${count(added, "promise from a conversation page joins", "promises from conversation pages join")} the follow-ups queue.`,
    );
  }
  if (undated) {
    run.notes.push(`${count(undated, "promise joins", "promises join")} the queue with no date: none was written, and none is made up.`);
  }
  run.notes.push("The follow-ups queue gains a first column, owed_by; every old row is ours.");
}

// A layout 1 citation as a layout 2 source: its `ref` (or a `url`) is the `resource`.
function source(item) {
  if (typeof item === "string") return { resource: item };
  if (V.isMapping(item) && !(item instanceof Moment)) {
    let out = { ...item };
    for (const name of ["ref", "url"]) {
      if (!Object.hasOwn(out, "resource") && Object.hasOwn(out, name)) {
        const { [name]: resource, ...rest } = out;
        out = { resource, ...rest };
      }
    }
    return Object.hasOwn(out, "resource") ? out : null;
  }
  return null;
}

function isDict(value) {
  return V.isMapping(value) && !(value instanceof Moment);
}

function flat(prefix, value) {
  if (!isDict(value)) return [[prefix, value]];
  const out = [];
  for (const [sub, subValue] of Object.entries(value)) out.push(...flat(`${prefix}_${sub.split("-").join("_")}`, subValue));
  return out;
}

function nested(value) {
  return isDict(value) || (Array.isArray(value) && value.some((v) => isDict(v) || Array.isArray(v)));
}

// One layout 1 header to its layout 2 shape. Pure.
function flatten(head, body, titles, asOf, drawn = new Set()) {
  const cel = V.truthy(V.own(head, "celorus")) ? head.celorus : {};
  const kind = V.own(head, "type") ?? null;
  const fresh = {};
  for (const [k, v] of Object.entries(head)) if (k !== "celorus") fresh[k] = v;
  if (kind !== null) fresh.type = typeof kind === "string" && Object.hasOwn(TYPE_MOVES, kind) ? TYPE_MOVES[kind] : kind;
  if (kind === "call") fresh.channel = "call";
  const kept = [];
  const guesses = [];
  const keep = (key, value) => kept.push(`- celorus.${key}: ${pyJson(value)}`);
  const put = (key, value) => {
    if (Object.hasOwn(fresh, key) && !sameValue(fresh[key], value)) keep(key, value);
    else fresh[key] = value;
  };
  for (const [key, value] of Object.entries(isDict(cel) ? cel : {})) {
    if (key === "kind" && kind === "context") put("context_kind", value);
    else if (key === "slug" || key === "kind" || (key === "commitments" && kind === "call")) continue;
    else if (key === "lead" && kind === "call") {
      // A lead left blank is no page to point at; the checker asks for it.
      if (value !== null && value !== "") put("about", `[[${pyStr(value)}]]`);
    } else if (key === "family") {
      const asOfOwn = V.own(cel, "as_of");
      const day = pyStr(V.truthy(asOfOwn) ? asOfOwn : asOf);
      const slugs = Array.isArray(value) ? value : V.truthy(value) ? [value] : [];
      for (const slug of slugs) {
        const title = typeof slug === "string" && Object.hasOwn(titles, slug) ? titles[slug] : pyStr(slug);
        guesses.push(`- member_of ${title} · guessed · yours · ${day} · carried from layout 1, confirm`);
      }
    } else if (key === "citations") {
      const list = V.truthy(value) ? V.items(value) : [];
      const sources = list.map(source);
      list.forEach((c, i) => {
        if (sources[i] === null) keep(key, c);
      });
      put("sources", sources.filter((s) => s !== null));
    } else if (Object.hasOwn(SINGULAR, key) && isDict(value)) {
      for (const [name, flatValue] of flat(SINGULAR[key], value)) put(name, flatValue);
    } else if (nested(value)) keep(key, value);
    else put(key, value);
  }
  let out = body;
  if (guesses.length) out = addToSection(out, "Connections", guesses);
  const type = Object.hasOwn(fresh, "type") ? fresh.type : undefined;
  if (typeof type === "string" && drawn.has(type) && span(out, "Connections") === null) out = addToSection(out, "Connections", []);
  if (kept.length) out = addToSection(out, "Kept by the update", kept);
  return [fresh, out];
}

// The model the desk will run on, read as the checker reads a desk's own copy. It is set out in
// the engine's working folder first; a write there that fails is said by its code alone, never
// by its message, which names that folder's path. The copy is removed after, never over the
// answer; one that could not be removed is said in `left`, with no path (removeWorking).
function modelView(modelDir, packDir, left) {
  const working = (fn) => {
    try {
      return fn();
    } catch (err) {
      throw new Error(`the model could not be set out in the engine's working folder (${codeOf(err)})`);
    }
  };
  const tmp = working(() => fs.mkdtempSync(path.join(os.tmpdir(), "celorus-model-")));
  try {
    const folder = path.join(tmp, "model");
    working(() => fs.mkdirSync(folder));
    const pages = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith(".md") && isFile(path.join(dir, name)));
    for (const dir of [modelDir, ...(packDir ? [packDir] : [])]) {
      for (const name of pages(dir)) if (!CHANGES.test(name)) working(() => fs.copyFileSync(path.join(dir, name), path.join(folder, name)));
    }
    const pack = packDir ? V.own(readHead(path.join(packDir, "pack.md")).head || {}, "pack") ?? null : "";
    working(() => fs.writeFileSync(path.join(tmp, "desk.md"), dumpPage({ type: "desk", pack }, ""), "utf8"));
    return loadDeskModel(tmp);
  } finally {
    if (!removeWorking(tmp)) left.push(MODEL_COPY_LEFT);
  }
}

function flattenHeaders(run, drawn) {
  const titles = {};
  const families = path.join(run.root, "families");
  if (isDir(families)) {
    for (const name of fs.readdirSync(families).filter((n) => n.endsWith(".md")).sort(V.compareText)) {
      const head = readHead(path.join(families, name)).head || {};
      const title = V.own(head, "title");
      titles[name.slice(0, -3)] = pyStr(V.truthy(title) ? title : name.slice(0, -3));
    }
  }
  let n = 0;
  for (const rel of run.pages()) {
    if (["index.md", "log.md", "desk.md"].includes(rel)) continue;
    const read = readHead(at(run.root, rel));
    const head = read.head;
    if (!V.truthy(head)) continue;
    const type = V.own(head, "type");
    if (!Object.hasOwn(head, "celorus") && !(typeof type === "string" && Object.hasOwn(TYPE_MOVES, type))) continue;
    const [fresh, body] = flatten(marked(head, read.raw), read.body, titles, run.today, drawn);
    run.write(`celorus/${rel}`, dumpPage(fresh, body, read.text));
    n += 1;
  }
  if (n) run.notes.push(`${count(n, "page header becomes", "page headers become")} flat: no nested block, the same details.`);
}

function repointPaths(run) {
  let n = 0;
  for (const rel of run.pages()) {
    const text = readText(at(run.root, rel));
    const next = repoint(text);
    if (next !== text) {
      run.write(`celorus/${rel}`, next);
      n += 1;
    }
  }
  if (n) {
    run.notes.push(
      `${count(n, "page that named an old folder now names", "pages that named an old folder now name")} the new one.`,
    );
  }
}

function fieldLists(modelDir) {
  const head = readHead(path.join(modelDir, "model.md")).head || {};
  const out = new Map();
  const lists = V.own(head, "field_lists");
  for (const entry of V.truthy(lists) ? V.items(lists) : []) {
    const text = V.show(entry);
    const cut = text.indexOf(" <- ");
    if (cut === -1) throw new Error(`dictionary update sequence element has length 1; 2 is required`);
    out.set(text.slice(0, cut), text.slice(cut + 4));
  }
  return out;
}

function pending(modelDir, have, target) {
  const found = [];
  for (const name of fs.readdirSync(modelDir)) {
    const m = CHANGES.exec(name);
    if (!m) continue;
    const number = Number(m[1]);
    if (have < number && number <= target) found.push([number, readHead(path.join(modelDir, name)).head || {}]);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, head]) => head);
}

function renameWords(run, modelDir, changesList) {
  const ownPath = path.join(run.root, "model", "own-words.md");
  const ownRead = isFile(ownPath) ? readHead(ownPath) : null;
  const ownHead = ownRead ? ownRead.head : null;
  const listed = V.own(ownHead || {}, "own_words");
  const was = V.truthy(listed) ? V.items(listed) : [];
  let own = was.slice();
  const fields = fieldLists(modelDir);
  for (const changes of changesList) {
    const renames = V.own(changes, "renames_word");
    for (const entry of V.truthy(renames) ? V.items(renames) : []) {
      const m = typeof entry === "string" ? RENAME.exec(entry) : null;
      if (!m) throw new Error(`cannot read the rename ${V.show([entry]).slice(1, -1)}`);
      const { list: name, old, new: now } = m.groups;
      const owned = new Set(
        own
          .map((e) => (typeof e === "string" ? RENAME.exec(e) : null))
          .filter((r) => r && r.groups.list === name)
          .map((r) => r.groups.old),
      );
      if (owned.has(now)) {
        if (!own.includes(`${name}: ${old} -> ${now}`)) own.push(`${name}: ${old} -> ${now}`);
        run.flags.push(
          `The standard word ${now} on ${name} is also one of this desk's own words. Pages keep ${old}; decide which meaning the desk keeps.`,
        );
        continue;
      }
      const named = [...fields].filter(([, list]) => list === name).map(([field]) => field);
      for (const rel of run.pages()) {
        const read = readHead(at(run.root, rel));
        if (!V.truthy(read.head)) continue;
        const head = { ...read.head };
        let touched = false;
        for (const field of named) {
          const value = V.own(head, field);
          if (value === old) {
            head[field] = now;
            touched = true;
          } else if (Array.isArray(value) && value.includes(old)) {
            head[field] = value.map((v) => (v === old ? now : v));
            touched = true;
          }
        }
        if (touched) run.write(`celorus/${rel}`, dumpPage(head, read.body, read.text));
      }
      own = own.map((e) => {
        const r = typeof e === "string" ? RENAME.exec(e) : null;
        return r && r.groups.list === name && r.groups.new === old ? `${name}: ${r.groups.old} -> ${now}` : e;
      });
      run.notes.push(`The word ${old} on ${name} is now ${now}; pages that used it now say ${now}.`);
    }
  }
  if (ownHead !== null && !(own.length === was.length && own.every((e, i) => sameValue(e, was[i])))) {
    run.write("celorus/model/own-words.md", dumpPage({ ...ownHead, own_words: own }, ownRead.body, ownRead.text));
  }
}

function writeModelPagesAndSettings(run, modelDir, packDir) {
  const shipped = templates();
  for (const rel of REQUIRED_FILES_V2) {
    if (!isFile(at(run.desk, rel)) && Object.hasOwn(shipped, rel)) run.write(rel, fill(shipped[rel], values(run)));
  }
  const before = run.changed.size;
  const pagesOf = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort(V.compareText);
  for (const name of pagesOf(modelDir)) {
    if (CHANGES.test(name)) continue;
    if (name.startsWith("list-") && !isFile(path.join(run.root, "model", name))) {
      run.notes.push(`A new list arrives: ${name.slice(5, -3)}.`);
    }
    run.write(`celorus/model/${name}`, readText(path.join(modelDir, name)));
  }
  for (const name of packDir ? pagesOf(packDir) : []) {
    if (!CHANGES.test(name)) run.write(`celorus/model/${name}`, readText(path.join(packDir, name)));
  }
  if (run.changed.size > before) run.notes.push("The model pages in model/ are refreshed from the plugin.");
  // Byte for byte as obsidian.md writes them, and only where missing: a setting the person
  // changed is theirs.
  const added = obsidianBlocks().filter(([rel]) => !isFile(at(run.desk, rel)));
  for (const [rel, body] of added) run.write(rel, body);
  if (added.length) {
    run.notes.push("Obsidian settings are added: shut Obsidian before saying yes, or it writes over them when it closes.");
  }
  const ignore = path.join(run.desk, ".gitignore");
  const have = isFile(ignore) ? V.splitLines(readText(ignore)) : [];
  const missing = GITIGNORE_V2.filter((line) => !have.includes(line));
  if (missing.length) run.write(".gitignore", `${[...have, ...missing].join("\n")}\n`);
}

function stampVersions(run, target, packDir) {
  run.read("celorus/desk.md");
  const read = readHead(path.join(run.root, "desk.md"));
  const head = { ...(read.head || {}) };
  const want = { model_version: target };
  if (packDir) {
    const pack = readHead(path.join(packDir, "pack.md")).head || {};
    for (const key of ["pack", "pack_version"]) {
      if (!Object.hasOwn(pack, key)) throw new Error(V.show([key]).slice(1, -1));
      want[key] = pack[key];
    }
  }
  if (Object.entries(want).every(([k, v]) => sameValue(V.asPython(V.own(head, k) ?? null), V.asPython(v)))) return;
  Object.assign(head, want);
  run.write("celorus/desk.md", dumpPage(head, read.body, read.text));
  run.notes.push(`The desk moves to model version ${target}.`);
}

// The views, the sent lists and every path page, as render_views rebuilds them, from the desk as
// the update has left it. The path pages (views/tools.js pathPagesOf) are worked out first, and
// an entry among them that is not a plain page is asked, and so refused by name, before the first
// view is written; each is written by who_can_introduce's own writer (paths/write.js) and is a
// change of the update's, so the preview, run on its copy, lists the same pages the apply writes.
// A stop here is said against the desk (retold): the preview's copy is never named, and whether
// anything was changed is the update's own stop to say, once.
function rebuildViews(run) {
  // Required here, not at the top: the views read the check, which reads this file's neighbours.
  const { renderViews, renderSentBlocks } = require("../views/views.js");
  const { pathPagesOf } = require("../views/tools.js");
  const { readDesk } = require("../lib/desk.js");
  const { writePathPage } = require("../paths/write.js");
  const H = require("./history.js");
  let paths;
  try {
    paths = pathPagesOf(readDesk(run.desk), run.root, run.now, "update_desk");
    H.ahead(H.asThemselves(paths.ask.map((rel) => path.join(run.root, ...rel.split("/")))));
  } catch (err) {
    // On the preview's copy, a fault that is not the desk's own is said with no path (faultOf).
    if (err instanceof NotOwnFolder && faultOf(err) !== null) err.pathless = faultOf(err);
    throw retold(run, err);
  }
  for (const [name, text] of Object.entries(renderViews(run.desk, run.now).views)) run.write(`celorus/views/${name}`, text);
  for (const [rel, text] of Object.entries(renderSentBlocks(run.desk))) run.write(`celorus/${rel}`, text);
  for (const { rel, text } of paths.rebuild) {
    const shown = `celorus/${rel}`;
    try {
      writePathPage(run.desk, shown, text);
    } catch (err) {
      // A page the write may have left incomplete is a change the stop names, and its previous
      // text (the refusal's tail) ends the update's answer (runUpdate's step, stoppedPartWay).
      if (err && typeof err.tail === "string") {
        run.changed.add(shown);
        err.rel = shown;
      }
      // On the preview's copy, said in words with no path (stoppedPartWay); a read-only path page
      // the desk holds is the desk's own, and named by its path under the desk.
      if (err && typeof err === "object" && !readOnlyRefusal(err)) err.pathless = "a path page could not be written";
      throw retold(run, err);
    }
    run.changed.add(shown);
    run.wrote.add(shown);
  }
}

// A stop met rebuilding the views, said against the desk: an entry the up-front check refused is
// named under celorus/, as pathPagesOf names a path page in the same step and merge_pages names
// the same entry (the preview runs on a copy, whose path is gone when the answer is read), and a
// refusal's own "Nothing was changed." is left to the update's stop, which says it only when it
// is so (views/tools.js updating, stoppedPartWay).
function retold(run, err) {
  if (err instanceof NotOwnFolder) {
    return Object.assign(new Error(err.told(under(run.root, err.file))), typeof err.pathless === "string" ? { pathless: err.pathless } : {});
  }
  if (err instanceof Refusal) {
    const tail = typeof err.tail === "string" && err.message.endsWith(err.tail) ? err.tail : "";
    const body = err.message.slice(0, err.message.length - tail.length);
    const nothing = ` ${require("./history.js").NOTHING}`;
    if (body.endsWith(nothing)) err.message = body.slice(0, -nothing.length) + tail;
  }
  return err;
}

function logUpdate(run, target, time, handle) {
  const text = run.read("celorus/log.md");
  const entry = logEntry(time, handle, "install-desk", `updated the desk to model version ${target}`);
  run.write("celorus/log.md", withLogEntry(text, run.today, entry));
}

// A stop after the update had begun to write: the stop names every path it had already changed,
// and the desk's own log.md says the update stopped there (house rule 5), as far as it can. On
// the preview's scratch copy nothing of the desk has changed, so the stop names no page of it as
// changed or incomplete and carries no previous text: a write that stopped there (`pathless`) is
// said only as the preview not completed and why, in words with no path (scratchStop); any other
// stop says what stopped it. The copy's log.md is neither written nor named. When the stop's
// own log.md write fails and log.md does not read back as it was, the stop says log.md may be
// incomplete, lists it as changed, and carries its previous text as an item of its own
// (`log_previous_text`), apart from the first error's (`previous_text`).
function stoppedPartWay(run, err, where, time, handle) {
  if (run.scratch) {
    // Said already as the scratch run's stop (runUpdate's step), or said now.
    if (typeof err.scratch === "string") return err;
    return typeof err.pathless === "string" ? scratchStop(err.pathless, where) : stopped(err.message);
  }
  const touched = run.touched();
  const told = (stop) => {
    if (typeof err.previous === "string") stop.previous_text = err.previous;
    return stop;
  };
  if (!touched.length) return told(endWithTail(stopped(err.message), previousTail(err, err.rel)));
  const LOG = "celorus/log.md";
  let said;
  let torn = null;
  try {
    const file = path.join(run.root, "log.md");
    ownPath(run.desk, file);
    const text = isFile(file) ? readText(file) : null;
    const what =
      `the update stopped at ${where}; ${count(touched.length, "file had", "files had")} already changed: ` +
      touched.join(", ");
    guard(run.desk, () => writePage(file, withLogEntry(text, run.today, logEntry(time, handle, "install-desk", what))));
    said = "and log.md says the update stopped there";
  } catch (logErr) {
    if (logErr && logErr.written === true) {
      said = `and log.md says the update stopped there, but log.md could not be closed (${logErr.code})`;
    } else if (logErr && typeof logErr.previous === "string") {
      torn = logErr;
      said = "and log.md may be incomplete; its previous text is in the answer";
    } else {
      said = "and log.md could not be written to say so";
    }
  }
  const changed = torn && !touched.includes(LOG) ? [...touched, LOG] : touched;
  const stop = told(
    endWithTail(
      stopped(`${err.message}; the desk has already changed: ${changed.join(", ")}, ${said}`, changed),
      previousTail(err, err.rel) + previousTail(torn, LOG),
    ),
  );
  if (torn) stop.log_previous_text = torn.previous;
  return stop;
}

// A write that stopped on the preview's scratch copy, at step `where`, said as the preview not
// completed, and why (`fault`, words with no path). `fault` and `where` are kept on the stop, so
// the apply, which runs the preview first to confirm its plan, says it as the update not completed.
function scratchStop(fault, where) {
  const why = `${fault} in the engine's working copy of the desk while ${where}`;
  return Object.assign(stopped(`the preview could not be completed: ${why}`), { scratch: why });
}

// Asked up front, only as it can be answered exactly (history.js ahead), over `pairs`, the
// up-front set read off the confirmed plan: every page the plan rewrites in place is opened
// read-write, so one that cannot be written is refused before the first write. A page the plan
// moves and then rewrites is not at its new path yet: it is opened through the page it is now,
// from the preview's move plan (a rename keeps its inode, owner and ACL, so that is exact). A
// page the plan makes at a path where nothing is, moved or new, is asked by its folder: each
// folder on its way that is not there is made (kind b), and the page's own folder is probed from
// inside. Whether a page may leave its folder is not asked: the moves run first, and are put back
// when one fails (moveFolders), with the folders made here. Returns those folders, absolute.
function checkAhead(run, pairs) {
  try {
    return ahead(pairs);
  } catch (err) {
    if (!(err instanceof NotOwnFolder)) throw err;
    const said = `checking the pages it rewrites: ${err.told(under(run.desk, err.file), DESK_FOLDER)}`;
    // A probe spare or a folder the check made and could not remove is the one thing changed,
    // so the stop names it as changed.
    const left = err.leftBehind().map((file) => under(run.desk, file));
    if (left.length) throw stopped(`${said}. Nothing else was changed.`, left);
    throw stopped(said);
  }
}

// Moves the desk at `desk` to the newest layout and model version, in place. Returns
// { changed, flags, notes }; throws UpdateStopped naming the step, with `changed` listing what
// the update had already changed (empty when it stopped before any write). Given `plan`, the
// digest a preview returned, it first derives the plan again and refuses, writing nothing,
// when the desk no longer gives that one.
function applyUpdate(desk, opts) {
  return runUpdate(desk, opts, false);
}

// The update itself. `scratch` is true only for the preview's own copy of the desk. A working copy
// the run could not remove is said after a stop's words (saidLeft), and, when the run goes
// through, beside what was left in place.
function runUpdate(desk, opts, scratch) {
  const run = new Run(deskRoot(desk), opts.today, opts.now);
  run.scratch = scratch;
  try {
    return updateOn(run, opts);
  } catch (err) {
    throw saidLeft(err, run.workingLeft);
  }
}

// The update's steps, on `run`.
function updateOn(run, { modelDir = PLUGIN_MODEL, packDir = null, today, now, time, handle, plan = null }) {
  refuseLinks(run.desk);
  // The up-front set, read off the confirmed plan (checkAhead).
  let upFront = null;
  if (plan !== null && plan !== undefined) {
    let fresh;
    try {
      fresh = previewUpdate(run.desk, { modelDir, packDir, today, now, time, handle });
    } catch (err) {
      // A write that stopped on the preview's copy: the update did not run (scratchStop).
      if (err instanceof UpdateStopped && typeof err.scratch === "string") {
        if (Array.isArray(err.workingLeft)) run.workingLeft.push(...err.workingLeft);
        throw stopped(`the update could not be completed: ${err.scratch}, as it confirmed the plan`);
      }
      throw err;
    }
    run.workingLeft.push(...fresh.workingLeft);
    if (fresh.plan !== plan) {
      throw stopped(
        "confirming the plan: what the update would do to this desk now is not the one the preview " +
          "showed, so it did not run; preview again, show that preview, and ask again",
      );
    }
    upFront = fresh.changed.map((rel) => ({ file: at(run.desk, rel), from: Object.hasOwn(fresh.moved, rel) ? at(run.desk, fresh.moved[rel]) : null }));
  }
  const was = markdownFiles(run.root).map((rel) => `celorus/${rel}`);
  let where = null;
  const step = (name, fn) => {
    if (!STEP_NAMES.includes(name)) throw new Error(`no step named ${name}`);
    where = name;
    try {
      return fn();
    } catch (err) {
      // A path page's refusal ends with the page's previous text (paths/write.js, its tail): the
      // text is carried apart from the words, as a page's `previous` is, so the stop's answer
      // ends with it, after what changed (stoppedPartWay), and never has words after it.
      const carried =
        err && typeof err.previous !== "string" && typeof err.rel === "string" && typeof err.tail === "string" &&
        err.message.endsWith(err.tail)
          ? err.tail
          : "";
      const words = err && err.message ? err.message.slice(0, err.message.length - carried.length) : String(err);
      const stop = stopped(`${name}: ${words}`);
      if (err && typeof err.previous === "string") Object.assign(stop, { rel: err.rel, previous: err.previous });
      else if (carried) Object.assign(stop, { rel: err.rel, previous: carried.replace(/^\n\n/u, "") });
      if (err && typeof err.pathless === "string") stop.pathless = err.pathless;
      // On the preview's scratch copy, a stop that is not the desk's own is said as the preview
      // not completed and why, with no path (scratchFault), before its first write or after it.
      const fault = run.scratch ? scratchFault(err) : null;
      if (fault !== null) throw scratchStop(fault, name);
      // A read-only fault the desk holds, named by its path under the desk (guard).
      if (run.scratch && err && typeof err.readOnly === "string") throw stopped(`${name}: ${err.readOnly}`);
      throw stop;
    }
  };
  // Before any write: a clash, a desk.md that would have to be made up, or a model that cannot
  // be read leaves the desk untouched.
  step("moving folders", () => checkMoves(run));
  step("writing desk.md", () => checkStamps(run));
  step("regrouping the log", () => run.read("celorus/log.md"));
  step("queueing promises", () => checkQueue(run));
  const target = step("stamping the versions", () => {
    const head = readHead(path.join(modelDir, "model.md")).head || {};
    if (!Object.hasOwn(head, "model_version")) throw new Error("'model_version'");
    return pyInt(head.model_version);
  });
  const have = step("stamping the versions", () => {
    const file = path.join(run.root, "desk.md");
    if (!isFile(file)) return 0;
    const v = V.own(readHead(file).head || {}, "model_version");
    return pyInt(V.truthy(v) ? v : 0);
  });
  const changesList = step("renaming words", () => pending(modelDir, have, target));
  const drawn = step("flattening headers", () => drawnKinds(modelView(modelDir, packDir, run.workingLeft)));
  // Last before the first write, so a check above that stops leaves nothing it made.
  const aheadMade = upFront === null ? [] : checkAhead(run, upFront);

  try {
    step("moving folders", () => moveFolders(run, aheadMade));
    step("writing desk.md", () => writeDeskMd(run));
    step("rewriting index.md", () => rewriteIndex(run));
    step("regrouping the log", () => regroupLog(run));
    step("queueing promises", () => queuePromises(run));
    step("flattening headers", () => flattenHeaders(run, drawn));
    step("repointing paths", () => repointPaths(run));
    step("renaming words", () => renameWords(run, modelDir, changesList));
    step("writing the model pages and settings", () => writeModelPagesAndSettings(run, modelDir, packDir));
    step("stamping the versions", () => stampVersions(run, target, packDir));
    if (run.touched().length) {
      step("rebuilding the views", () => rebuildViews(run));
      step("logging the update", () => logUpdate(run, target, time, handle));
    }
    // "Nothing is deleted" is the preview's first promise, so it is read off the desk, not said.
    where = "the check that nothing is deleted";
    const gone = was.filter((rel) => !isFile(at(run.desk, keptAt(rel))));
    if (gone.length) {
      throw Object.assign(stopped(`nothing is deleted: ${gone.join(", ")} is not there any more`), {
        pathless: `${count(gone.length, "page was", "pages were")} not there any more`,
      });
    }
  } catch (err) {
    if (!(err instanceof UpdateStopped)) throw err;
    throw stoppedPartWay(run, err, where, time, handle);
  }
  return {
    changed: V.sortedText(run.changed),
    left: V.sortedText(run.left),
    folders: V.sortedText(run.folders),
    // The moved pages the update then rewrote: where each went, with where it was.
    moved: Object.fromEntries([...run.moved].filter(([to]) => run.wrote.has(to))),
    flags: run.flags,
    notes: run.notes,
    leftInPlace: [...run.leftInPlace, ...run.workingLeft],
    workingLeft: run.workingLeft,
    target,
  };
}

function countPages(root) {
  return isDir(root) ? markdownFiles(root).length : 0;
}

// The update run on a copy of the desk (its own history, .git, left out), and what it would do,
// with `plan`, the digest apply takes to hold the desk to this preview. A desk holding a link is
// refused here as the apply refuses it, so the copy is the desk as the apply will see it: no
// link is followed into it. A pipe, a socket or a device anywhere the copy reaches is refused
// before it, since the copy cannot copy one as a file (refuseOddEntries).
function previewUpdate(desk, opts) {
  const { plan: _unused, ...rest } = opts;
  const real = deskRoot(desk);
  refuseLinks(real);
  refuseOddEntries(real);
  const inputs = inputsDigest(real);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "celorus-update-"));
  // The copy is removed after the run, never over its answer (removeWorking); one that could not
  // be removed is said after the answer's words, with no path.
  let out;
  try {
    const copy = path.join(tmp, "desk");
    fs.cpSync(real, copy, {
      recursive: true,
      filter: (src) => path.basename(src) !== ".git",
    });
    out = previewOn(copy, inputs, rest);
  } catch (err) {
    throw removeWorking(tmp) ? err : saidLeft(err, [DESK_COPY_LEFT]);
  }
  if (!removeWorking(tmp)) {
    out.workingLeft.push(DESK_COPY_LEFT);
    out.text = `${out.text}\n${DESK_COPY_LEFT}`;
  }
  return out;
}

// The preview's run on `copy`, its copy of the desk.
function previewOn(copy, inputs, rest) {
  const before = countPages(path.join(copy, "celorus"));
  const result = runUpdate(copy, rest, true);
  const after = countPages(path.join(copy, "celorus"));
  const plan = planDigest(inputs, result, before, after);
  const workingLeft = [...result.workingLeft];
  const left = workingLeft.map((said) => `\n${said}`).join("");
  if (!result.changed.length) {
    return { text: `No file changes: the desk is already up to date.${left}`, changed: [], moved: {}, flags: [], pagesBefore: before, pagesAfter: after, target: result.target, plan, workingLeft };
  }
  const lines = [...result.notes];
  lines.push(
    `${count(result.changed.length, "file changes", "files change")}. Nothing is deleted: ${before} pages before, ${after} after.`,
  );
  lines.push(...result.flags.map((flag) => `Decide: ${flag}`));
  return { text: lines.join("\n") + left, changed: result.changed, moved: result.moved, flags: result.flags, pagesBefore: before, pagesAfter: after, target: result.target, plan, workingLeft };
}

module.exports = {
  STEP_NAMES,
  FOLDER_MOVES,
  TYPE_MOVES,
  SINGULAR,
  REQUIRED_FILES_V2,
  GITIGNORE_V2,
  FOLLOW_UP_HEADER_V2,
  PLUGIN_MODEL,
  UpdateStopped,
  obsidianBlocks,
  repoint,
  flatten,
  dumpPage,
  applyUpdate,
  previewUpdate,
};
