"use strict";
// What every tool that writes the desk's generated pages, merges or updates shares: the moment
// a change is stamped with, the seat that makes it (house rule 6), the change's line in the
// desk's own history, log.md (house rule 5), and writing a page whole.
//
// The rule every call that changes the desk follows (merge, undo, update, views), in three kinds:
// (a) The up-front check asks only what it can answer exactly, and asks every page already on
//     the desk that the call touches (one it rewrites, moves or removes) by ONE path (askPage),
//     before it makes or probes anything: what is at the page's path, by lstat; that it is a
//     plain file; that every folder on its way is the desk's own; and, when the call rewrites
//     it, that it opens read-write as itself. A link, or any other kind of file, there at call
//     start is refused here, by the page's name, before any write, folder or probe. Only then
//     is a page made new asked, by its folder's access.
// (b) A step whose permission cannot be asked is TAKEN before the call changes anything it cannot
//     put back: removing a page or moving it out of its folder; making a folder the call makes a
//     page in; and making a page in a folder (the probe below). If that step fails, the call puts
//     back what it has done and is refused: "Nothing was changed.", or, when putting back fails
//     too, the answer names exactly what is left.
// (c) A removal whose failure still leaves the desk correct is never a stop: the answer names
//     what was left.
//
// A folder the call makes a page in is made in the up-front check (ahead), outermost first, as
// this person, so it takes the entries its parent passes down (an ACL entry that applies only to
// what is made inside) exactly as the call's own write would meet them. The check then probes
// inside it. When anything in the check fails, the folders it made are removed, deepest first.
//
// A page made new is written to a spare file and renamed onto its name, so a crash mid-write
// never leaves half a page. Whether that rename (and the spare's removal) is allowed depends on
// more than the folder's access bits (an ACL that denies deleting an entry), so it too cannot be
// asked: before the first write, each folder the call makes a page in, made first if it is not
// there, is probed from inside by taking the step itself (probeFolder): a spare made there,
// renamed to a second spare name, and removed. A kill mid-probe leaves at most one spare-named
// file in that folder; the next probe of that folder removes it (the first name is removed before
// it is made again, the second is renamed over). If no later call probes that folder, the file
// stays: a named limit. It is not a page.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { linksIn } = require("../check/text.js");
const { strip, show, compareText, BLANK_CLASS } = require("../check/values.js");

const NOTHING = "Nothing was changed.";

// The half of a refused moment that says what to do, shared by every arm of aMoment.
const AS_WRITTEN = "Write it in ISO 8601, with a `T` between the date and the time and the local offset";

// A text as Python's repr() writes it, as the refusals quote what they were given.
function quoted(text) {
  return show([text]).slice(1, -1);
}

// A moment as Python's datetime.fromisoformat reads one: a date, then one character of any kind,
// then the time and an offset. The date and the time each in the extended or the basic form.
const ISO =
  /^(?<y>[0-9]{4})-?(?<mo>[0-9]{2})-?(?<d>[0-9]{2})(?:(?<sep>[\s\S])(?<h>[0-9]{2})(?::?(?<mi>[0-9]{2})(?::?(?<s>[0-9]{2})(?:[.,](?<f>[0-9]{1,6}))?)?)?(?<zone>Z|[-+][0-9]{2}(?::?[0-9]{2}(?::?[0-9]{2}(?:\.[0-9]{1,6})?)?)?)?)?$/u;

function realDate(y, mo, d) {
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= days;
}

// `now` in ISO 8601, with a `T` and a local offset, or a refusal naming which of those it is
// missing, checked before anything is written: the value goes into a header as a line, so a
// value with a line break in it, or that is not a moment, would leave a header nobody can read.
function aMoment(now) {
  if (typeof now !== "string") throw new Refusal(`now is text, as 2026-09-03T10:00:00+05:30. ${NOTHING}`);
  if (!strip(now)) throw new Refusal(`${quoted(now)} is blank. ${AS_WRITTEN}. ${NOTHING}`);
  if (now !== strip(now)) throw new Refusal(`${quoted(now)} has blank space around it. ${AS_WRITTEN}. ${NOTHING}`);
  const m = ISO.exec(now);
  const g = m ? m.groups : null;
  const timeOk =
    g && (g.h === undefined || (Number(g.h) < 24 && Number(g.mi || 0) < 60 && Number(g.s || 0) < 60));
  if (!g || !realDate(Number(g.y), Number(g.mo), Number(g.d)) || !timeOk) {
    throw new Refusal(`${quoted(now)} is not a timestamp at all. ${AS_WRITTEN}. ${NOTHING}`);
  }
  if (g.zone === undefined) {
    throw new Refusal(`${quoted(now)} is not a moment with its offset. ${AS_WRITTEN}. ${NOTHING}`);
  }
  if (!now.includes("T")) {
    throw new Refusal(`${quoted(now)} does not part its date from its time with a \`T\`. ${AS_WRITTEN}. ${NOTHING}`);
  }
  return now;
}

// This machine's clock now, as a moment with its local offset, to the second.
function clockNow(date = new Date()) {
  const two = (n) => String(n).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const zone = `${sign}${two(Math.floor(Math.abs(offset) / 60))}:${two(Math.abs(offset) % 60)}`;
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}` +
    `T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}${zone}`
  );
}

// The moment a tool stamps its change with: the one it was given, or the clock's.
function momentOf(now) {
  return aMoment(now === undefined || now === null ? clockNow() : now);
}

// The desk's seats: the file names of its seat pages, and the seats desk.md names (a name, or
// a link to the seat's page), in order.
function seatsOf(pages, deskHead) {
  const seats = new Set();
  for (const page of pages) if (page.type === "seat") seats.add(page.stem);
  const named = deskHead && Object.hasOwn(deskHead, "seats") ? deskHead.seats : null;
  for (const entry of Array.isArray(named) ? named : named === null ? [] : [named]) {
    const links = linksIn(entry);
    if (links.length) links.forEach((name) => seats.add(name));
    else if (typeof entry === "string" && strip(entry)) seats.add(strip(entry));
  }
  return [...seats].sort(compareText);
}

// Refuses a change whose seat is not one of the desk's, naming them (house rule 6).
function heldSeat(handle, seats) {
  if (!seats.length) {
    throw new Refusal(
      "This desk has no seat yet, and the seat must be known before anything is written: add a " +
        `seat page under seats/ (install-desk does), then say this again. ${NOTHING}`,
    );
  }
  if (typeof handle !== "string" || !seats.includes(handle)) {
    throw new Refusal(
      `handle is the seat making this change, one of: ${seats.join(", ")}; got ${JSON.stringify(handle ?? null)}. ` +
        `The seat must be known before anything is written. ${NOTHING}`,
    );
  }
  return handle;
}

// One line of log.md: `* <HH:MM> · <seat> · <skill> · <what> · yours`.
function logEntry(clock, handle, skill, what) {
  return `* ${clock} · ${handle} · ${skill} · ${what} · yours`;
}

// log.md's text with `entry` added as the newest line of `date`: under that day's heading, or
// under a new heading at the top of the log. `text` is null when the desk has no log.
function withLogEntry(text, date, entry) {
  if (text === null) return `# Log\n\n## ${date}\n\n${entry}\n`;
  const lines = text.split("\n");
  const at = lines.indexOf(`## ${date}`);
  if (at !== -1) {
    const first = lines[at + 1] === "" ? at + 2 : at + 1;
    lines.splice(first, 0, entry);
  } else {
    lines.splice(2, 0, `## ${date}`, "", entry, "");
  }
  return lines.join("\n");
}

const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;
const MAKE = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW;
// A page already on the desk, opened to be written in place: never made, never through a link,
// and readable too, as the write reads it back.
const OWN = fs.constants.O_RDWR | NOFOLLOW;
// The same open made only to learn that a page can be written (ahead), and closed with nothing
// written: O_NONBLOCK, so a pipe put at the path can never hold it.
const AHEAD = OWN | (fs.constants.O_NONBLOCK || 0);

// A folder as an answer names it: its path under the folder the answer's paths are relative to,
// with a trailing slash. That folder itself (an empty path) is named `top`: celorus/ by default,
// the desk's own folder, never a bare "/".
function folderShown(rel, top = "celorus/") {
  return rel === "" ? top : `${rel}/`;
}

// A write stopped before its first byte, or before its move: a folder on the way to `file` is no
// longer the one the tool checked (a link was put in its place), so nothing was written there.
// `said(rel, top)` is the same, with `rel` the path as a tool's answer names it; `folder` marks a
// `file` that is itself a folder, named as folderShown names it (with `top` for an empty path).
class NotOwnFolder extends Error {
  constructor(file, folder = false) {
    super("");
    this.file = file;
    this.link = true;
    this.folder = folder;
    // What the up-front check (ahead) made and could not remove again when it refused, absolute:
    // its probe's spare, and the folders it made. told() names them.
    this.leftover = null;
    this.foldersLeft = [];
    // Met by the up-front check (ahead), before the call changed anything: the link was there
    // at call start, so the answer never says it was put there since.
    this.early = false;
    this.message = this.said(file);
  }

  named(rel, top) {
    return this.folder ? folderShown(rel, top) : rel;
  }

  said(rel, top) {
    return this.early
      ? `${this.named(rel, top)} was not written: a folder on its way is not the desk's own (a link is in its place)`
      : `${this.named(rel, top)} was not written: a folder on its way is no longer the desk's own (a link was put in its place)`;
  }

  // Every path the up-front check left behind, absolute: the spare, then the folders.
  leftBehind() {
    return [...(this.leftover ? [this.leftover] : []), ...this.foldersLeft];
  }

  // `abs` as the answer names it, given `rel`, this error's own path as the answer names it: the
  // paths are relative to the same folder.
  shown(abs, rel, top) {
    const parts = rel.split("/").filter(Boolean);
    const base = parts.length ? path.resolve(this.file, ...parts.map(() => "..")) : path.resolve(this.file);
    const under = path.relative(base, abs).split(path.sep).join("/");
    return this.foldersLeft.includes(abs) ? folderShown(under, top) : under;
  }

  // said(), then each path the up-front check left behind, named.
  told(rel, top) {
    let out = this.said(rel, top);
    if (this.leftover) out += `; the spare ${this.shown(this.leftover, rel, top)} made to ask was left in place`;
    const folders = this.foldersLeft.map((dir) => this.shown(dir, rel, top));
    if (folders.length === 1) out += `; the folder ${folders[0]} made to ask was left in place`;
    if (folders.length > 1) out += `; the folders ${folders.join(", ")} made to ask were left in place`;
    return out;
  }
}

// A write stopped before its first byte: a file, not a folder, is where a folder on its way
// should be (`file` is that path). The tools stop at it as they stop at a link, in these words.
class NotAFolder extends NotOwnFolder {
  constructor(file) {
    super(file);
    this.link = false;
  }

  said(rel) {
    return `a file, not a folder, is at ${rel}, so nothing was written there`;
  }
}

const codeOf = (err) => (err && typeof err.code === "string" ? err.code : "an unknown error");
const READ_ONLY = new Set(["EACCES", "EPERM", "EROFS"]);

// A write stopped before its first byte: a page already on the desk cannot be opened to be
// written in place (`code`, as "EACCES"). The tools meet it before their first write (ahead).
class NotWritable extends NotOwnFolder {
  constructor(file, code) {
    super(file);
    this.link = false;
    this.code = code;
    this.message = this.said(file);
  }

  said(rel) {
    return READ_ONLY.has(this.code) ? `${rel} is read-only (${this.code})` : `${rel} cannot be opened to be written (${this.code})`;
  }
}

// A call refused before its first write: a folder it makes a page in does not let this person
// add a file there, as fs.access answers for the folder, or a folder could not be made, or its
// probe (probeFolder) failed (`code`, as "EACCES"). `file` is the folder. `leftover`, when the
// probe made a spare it could not remove, is that spare's path, and told() names it with any
// folder left (NotOwnFolder); nothing else was changed.
class FolderNotWritable extends NotOwnFolder {
  constructor(dir, code, leftover = null) {
    super(dir, true);
    this.link = false;
    this.code = code;
    this.leftover = leftover;
    this.message = this.told(dir);
  }

  said(rel, top) {
    return `${this.named(rel, top)} cannot take a new page (${this.code})`;
  }
}

// A write stopped before its first byte: what is at a page's path is not a plain file (a link, a
// folder, a pipe), so it is neither written in place nor replaced. `isLink` says the page itself
// is a link, and the answer says so.
class NotAPage extends NotOwnFolder {
  constructor(file, isLink = false) {
    super(file);
    this.link = false;
    this.isLink = isLink;
    this.message = this.said(file);
  }

  said(rel) {
    return this.isLink
      ? `${rel} is a link, not a plain file, so nothing was written there`
      : `${rel} is not a plain file (a folder or another kind of file is there), so nothing was written there`;
  }
}

// A write in place that failed after the page was opened (ruling point 2): the page's old text
// was written back the same way, and read back equal (`restored`) or not. When it was not,
// `previous` holds the old text, and the tool's answer carries it (previousTail).
class PageNotWritten extends NotOwnFolder {
  constructor(file, fault, restored, previous) {
    super(file);
    this.link = false;
    this.fault = fault;
    this.restored = restored;
    this.previous = restored ? null : previous;
    this.message = this.said(file);
  }

  said(rel) {
    return this.restored
      ? `${rel} ${this.fault}; ${rel} was restored`
      : `${rel} ${this.fault}; ${rel} may be incomplete; its previous text is in the answer`;
  }
}

// A page that is on the desk as written, whose file could not be closed after (`code`, as "EIO"):
// written whole and moved into place, or written in place and read back. It counts as written, so
// the stop that meets it names it as changed and logs the change (`written`), and says the close
// error.
class NotClosed extends NotOwnFolder {
  constructor(file, code) {
    super(file);
    this.link = false;
    this.code = code;
    this.written = true;
    this.message = this.said(file);
  }

  said(rel) {
    return `${rel} was written, but could not be closed (${this.code})`;
  }
}

// Closes `fd` after a write to `file`. When the page is written (`written`), a close that fails is
// NotClosed; otherwise the write's own error, already on its way, is the one said, never the close's.
function closeAfter(fd, file, written) {
  try {
    fs.closeSync(fd);
  } catch (err) {
    if (written) throw new NotClosed(file, codeOf(err));
  }
}

// The end of a tool's answer after a write that left `rel` maybe incomplete: its previous text,
// whole. Empty for any other stop.
function previousTail(err, rel) {
  return err && typeof err.previous === "string" ? `\nThe previous text of ${rel}:\n${err.previous}` : "";
}

// Ends refusal `err`'s message with `tail` (previousTail's, one or more), and keeps the tail on it,
// unlisted, so words added to the answer later go in before it (sayBeforeTail): a page's previous
// text always ends the answer, whole, as the page held it.
function endWithTail(err, tail) {
  if (!tail) return err;
  err.message += tail;
  const kept = typeof err.tail === "string" ? err.tail : "";
  Object.defineProperty(err, "tail", { value: kept + tail, enumerable: false, writable: true, configurable: true });
  return err;
}

// Puts `words` into refusal `err`'s message before the previous-text tail that ends it (none: at
// its end).
function sayBeforeTail(err, words) {
  const tail = typeof err.tail === "string" && err.message.endsWith(err.tail) ? err.tail : "";
  err.message = err.message.slice(0, err.message.length - tail.length) + words + tail;
}

function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}

// Whether `dir` is itself: every link on its path resolved, it names the same folder. The paths
// the tools write are built from the desk folder resolved at the door, so a folder that resolves
// elsewhere was swapped for a link since.
function stillAt(dir) {
  try {
    return fs.realpathSync(dir) === path.resolve(dir);
  } catch {
    return false;
  }
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch {
    return null;
  }
}

// Makes `folder` and each missing folder above it, outermost first, one at a time and never
// through a link. Each folder made is pushed onto `made`, the caller's own list, the moment it is
// made, so a failure part way still hands back every folder made before it; returns `made`.
function makeFolders(folder, made = []) {
  const missing = [];
  for (let dir = path.resolve(folder); ; dir = path.dirname(dir)) {
    const st = lstatOrNull(dir);
    if (st) {
      if (!stillAt(dir)) throw new NotOwnFolder(dir, true);
      if (!st.isDirectory()) throw new NotAFolder(dir);
      break;
    }
    missing.unshift(dir);
    if (path.dirname(dir) === dir) break;
  }
  for (const dir of missing) {
    fs.mkdirSync(dir);
    made.push(dir);
    if (!stillAt(dir)) throw new NotOwnFolder(dir, true);
  }
  return made;
}

// Removes `made`, folders a call made, the deepest (the last made) first. Returns the ones that
// could not be removed, in that order: empty when every one is gone.
function unmakeFolders(made) {
  const left = [];
  for (const dir of [...made].reverse()) {
    try {
      fs.rmdirSync(dir);
    } catch {
      left.push(dir);
    }
  }
  return left;
}

// Whether the file open at `fd` is the one at `file`, in the folder the tool means.
function heldAt(fd, file) {
  const st = lstatOrNull(file);
  return st !== null && sameFile(fs.fstatSync(fd), st) && stillAt(path.dirname(file));
}

// The name every spare file ends with: a page's spare is `<page>.celorus-writing`, and the
// up-front probe's two are `.celorus-probe.celorus-writing` and `.celorus-probe-2.celorus-writing`.
const SPARE = ".celorus-writing";

// Spare files a write could not remove, by absolute path, since the last takeSparesLeft(): a
// stale one an earlier cut write left, or a write's own after it failed. Each is a failure that
// leaves the desk's pages correct (the rule above), so it is never a stop: the tool's answer names
// it (views/tools.js).
const sparesLeft = new Set();

function takeSparesLeft() {
  const out = [...sparesLeft];
  sparesLeft.clear();
  return out;
}

// Opens a new spare file for `file`, never through a link, and returns { fd, spare }. A spare an
// earlier cut write left behind, a plain file in the right folder, is removed first; when it
// cannot be, it is left and named (sparesLeft), and a fresh numbered spare is opened instead.
function openSpare(file) {
  const spare = `${file}${SPARE}`;
  try {
    return { fd: fs.openSync(spare, MAKE, 0o666), spare };
  } catch (err) {
    const st = err && err.code === "EEXIST" ? lstatOrNull(spare) : null;
    if (!st || !st.isFile() || !stillAt(path.dirname(spare))) throw err;
    try {
      fs.unlinkSync(spare);
      return { fd: fs.openSync(spare, MAKE, 0o666), spare };
    } catch {
      sparesLeft.add(spare);
    }
  }
  for (let n = 2; ; n += 1) {
    const other = `${file}${SPARE}-${n}`;
    try {
      return { fd: fs.openSync(other, MAKE, 0o666), spare: other };
    } catch (err) {
      if (!err || err.code !== "EEXIST") throw err;
    }
  }
}

function bytesOf(data) {
  return typeof data === "string" ? Buffer.from(data, "utf8") : data;
}

// Writes a page the engine creates (text, or bytes): to a spare file beside it, then moved into
// place, so a reader never meets half a page. Its folders are made as needed, each pushed onto
// `made` (the caller's list, so a failure after them still hands them back); returns `made`.
// `mode`, when given, is the permission bits the new page takes (a copy of a page takes
// its page's), set on the spare before its first byte. The spare is opened by itself with
// O_NOFOLLOW and O_EXCL, and before its first byte the opened file must be the one at its path,
// in the folder meant; the folder is checked again just before the move. On a mismatch nothing
// more is written, the spare this write made is removed (through a path that still names it),
// and NotOwnFolder is thrown. A page already on the desk is written in place (writePage).
function writeWhole(file, data, mode, made = []) {
  makeFolders(path.dirname(file), made);
  const { fd, spare } = openSpare(file);
  let moved = false;
  try {
    if (!heldAt(fd, spare)) throw new NotOwnFolder(file);
    if (mode !== undefined) fs.fchmodSync(fd, mode & 0o777);
    const bytes = bytesOf(data);
    for (let at = 0; at < bytes.length; ) at += fs.writeSync(fd, bytes, at, bytes.length - at);
    // On disk before it takes the page's name: a record a later step relies on is there whole.
    fs.fsyncSync(fd);
    if (!heldAt(fd, spare)) throw new NotOwnFolder(file);
    fs.renameSync(spare, file);
    moved = true;
  } finally {
    if (!moved) {
      // The write's own spare, after a failure: one that cannot be removed is left and named.
      const st = lstatOrNull(spare);
      try {
        if (st && sameFile(st, fs.fstatSync(fd))) fs.unlinkSync(spare);
      } catch {
        sparesLeft.add(spare);
      }
    }
    // The page counts as written once it is moved into place (NotClosed).
    closeAfter(fd, file, moved);
  }
  return made;
}

// Every byte of the file open as `fd`, read from its start.
function readAll(fd) {
  const size = fs.fstatSync(fd).size;
  const buf = Buffer.alloc(size);
  let got = 0;
  while (got < size) {
    const n = fs.readSync(fd, buf, got, size - got, got);
    if (n === 0) break;
    got += n;
  }
  return buf.subarray(0, got);
}

// The ruled in-place writer. putWhole, keepingMode and rewrite are lib/stamp.js's, step for step
// (the base's ruling on the in-place write, points 1, 2 and 5): the two become one helper at the
// 0.19 rebase (R21 pin 2). The whole new text is written from offset 0, then the file is cut to
// its length, flushed, and read back. The kill window, named: a kill during the write can leave
// a line cut short, or the new text with a stale tail of the old one before the cut, never an
// empty page; nothing in the answer covers it.

// Writes `bytes` over the file open as `fd` from its first byte, cuts it to their length,
// flushes it to disk, and says whether it reads back as exactly those bytes.
function putWhole(fd, bytes) {
  let at = 0;
  while (at < bytes.length) {
    const put = fs.writeSync(fd, bytes, at, bytes.length - at, at);
    if (put <= 0) throw new Error("the write took no bytes");
    at += put;
  }
  fs.ftruncateSync(fd, bytes.length);
  fs.fsyncSync(fd);
  return readAll(fd).equals(bytes);
}

// Runs `write` on the file open as `fd`, then puts its mode back when the write changed it: a
// write by a user who is not root clears the setuid and setgid bits.
function keepingMode(fd, write) {
  const mode = fs.fstatSync(fd).mode & 0o7777;
  try {
    return write();
  } finally {
    try {
      if ((fs.fstatSync(fd).mode & 0o7777) !== mode) fs.fchmodSync(fd, mode);
    } catch {
      // Only the page's owner can put the setuid and setgid bits back; without them the file
      // allows less than it did, never more.
    }
  }
}

// Rewrites the file open as `fd` and holding `before` as `after`. Returns null when it holds
// `after`; otherwise the old text has been written back the same way, and the answer is what
// went wrong ("could not be written (EIO)") and whether the file reads back as its old text.
function rewrite(fd, before, after) {
  return keepingMode(fd, () => {
    let fault = null;
    try {
      if (!putWhole(fd, after)) fault = "did not read back as it was written";
    } catch (err) {
      fault = `could not be written (${codeOf(err)})`;
    }
    if (fault === null) return null;
    let restored = false;
    try {
      restored = putWhole(fd, before);
    } catch {
      // Not restored: the answer carries the old text instead.
    }
    return { fault, restored };
  });
}

// Opens a page already on the desk to be written in place (`flags`), or throws: NotOwnFolder when
// a folder on its way is no longer the desk's, NotAPage for a link, NotWritable for any other.
function openOwn(file, flags = OWN) {
  try {
    return fs.openSync(file, flags);
  } catch (err) {
    if (!stillAt(path.dirname(file))) throw new NotOwnFolder(file);
    if (err && err.code === "ELOOP") throw new NotAPage(file, true);
    throw new NotWritable(file, codeOf(err));
  }
}

// Writes a page already on the desk IN PLACE (the ruled writer above): the page itself is opened,
// never made and never through a link, so it keeps its inode, mode, owner and links. Before its
// first byte the opened file must be the one at its path, in the folder meant. Its old bytes are
// held in memory; on any error they are written back, and PageNotWritten says whether they read
// back equal ("was restored") or not ("may be incomplete", carrying the old text).
function writeInPlace(file, data) {
  const fd = openOwn(file);
  let written = false;
  try {
    if (!heldAt(fd, file)) throw new NotOwnFolder(file);
    const was = readAll(fd);
    const failed = rewrite(fd, was, bytesOf(data));
    if (failed) throw new PageNotWritten(file, failed.fault, failed.restored, was.toString("utf8"));
    written = true;
  } finally {
    // The page counts as written once it reads back as the new text (NotClosed).
    closeAfter(fd, file, written);
  }
}

// What is at `file`: its lstat, or null when nothing is there (ENOENT, or ENOTDIR, which the
// making of its folders refuses as NotAFolder). Any other error stops the write as NotWritable.
function whatIsAt(file) {
  try {
    return fs.lstatSync(file);
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) return null;
    if (!stillAt(path.dirname(file))) throw new NotOwnFolder(file);
    throw new NotWritable(file, codeOf(err));
  }
}

// Writes a page: in place when a plain file is already there (writeInPlace), made fresh only
// where nothing is (writeWhole, which takes `mode` for a new page). Anything else at the path, a
// link, a folder or a pipe, is refused with nothing written (NotAPage). Returns the folders made.
function writePage(file, data, mode) {
  const st = whatIsAt(file);
  if (st === null) return writeWhole(file, data, mode);
  if (!st.isFile()) throw new NotAPage(file, st.isSymbolicLink());
  writeInPlace(file, data);
  return [];
}

// The folder a page not there yet is made in: its own folder, or the nearest one above it that
// is there (writeWhole makes the rest, as this person, so they take the page). Throws as
// makeFolders does for a folder on the way that is a link or a file.
function standingFolder(file) {
  let dir = path.dirname(path.resolve(file));
  for (;;) {
    const st = whatIsAt(dir);
    if (st !== null) {
      if (!stillAt(dir)) throw new NotOwnFolder(dir, true);
      if (!st.isDirectory()) throw new NotAFolder(dir);
      return dir;
    }
    const up = path.dirname(dir);
    if (up === dir) return dir;
    dir = up;
  }
}

// Throws FolderNotWritable unless this person may add a file to `dir`.
function mayAdd(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK | fs.constants.X_OK);
  } catch (err) {
    throw new FolderNotWritable(dir, codeOf(err));
  }
}

// Takes, in folder `dir`, the steps a page made there takes (writeWhole): a spare made with
// O_CREAT, O_EXCL and O_NOFOLLOW, renamed to a second spare name in the same folder, and removed.
// The spare takes the folder's inheritable entries as a page's spare does, so this asks exactly
// what the write will. On a failure, what the probe made is removed, and FolderNotWritable is
// thrown, naming the spare when it could not be removed.
function probeFolder(dir) {
  const first = path.join(dir, `.celorus-probe${SPARE}`);
  const second = path.join(dir, `.celorus-probe-2${SPARE}`);
  let made = null;
  try {
    let fd;
    try {
      fd = fs.openSync(first, MAKE, 0o666);
    } catch (err) {
      // A probe spare a killed probe left: removed, then made again.
      const st = err && err.code === "EEXIST" ? lstatOrNull(first) : null;
      if (!st || !st.isFile()) throw err;
      fs.unlinkSync(first);
      fd = fs.openSync(first, MAKE, 0o666);
    }
    made = first;
    fs.closeSync(fd);
    fs.renameSync(first, second);
    made = second;
    fs.unlinkSync(second);
    made = null;
  } catch (err) {
    let leftover = null;
    if (made !== null) {
      try {
        fs.unlinkSync(made);
      } catch {
        leftover = made;
      }
    }
    throw new FolderNotWritable(dir, codeOf(err), leftover);
  }
}

// Throws NotOwnFolder unless the folder holding `file` is the desk's own: no link on its way,
// whether put there since the call began or there at its start.
function ownFolder(file) {
  if (!stillAt(path.dirname(path.resolve(file)))) throw new NotOwnFolder(file);
}

// The one path every page already on the desk that a call touches is asked by (rule (a) at the
// top), `st` being its lstat: it is a plain file (a link, a folder or a pipe is refused as
// NotAPage, a link by that name); every folder on its way is the desk's own (NotOwnFolder); and,
// when `rewritten`, it opens read-write as itself (AHEAD), the opened file the one at its path,
// and is closed again. A page the call removes, and never rewrites, is asked the same way but for
// the open: whether it may leave its folder cannot be asked, so the call takes that step first
// and puts back what it did when the step fails (kind b).
function askPage(file, st, rewritten) {
  if (!st.isFile()) throw new NotAPage(file, st.isSymbolicLink());
  ownFolder(file);
  if (!rewritten) return;
  const fd = openOwn(file, AHEAD);
  try {
    if (!heldAt(fd, file)) throw new NotOwnFolder(file);
  } finally {
    // Nothing was written through it, so a close that fails changes nothing and is not a stop.
    closeAfter(fd, file, false);
  }
}

// Before a tool's first write: every page the call writes can be, asked only as it can be
// answered exactly (the rule at the top). `pairs` is the call's up-front set, each
// { file, from, removed }, read off the plan the call's writes run from. It is asked in two
// passes, so nothing is made or probed until every page already on the desk has been asked:
// - first, every page there at call start, by the one path (askPage): a page the call writes in
//   place (rewritten), a page it removes (`removed`, never rewritten), and `from`, for a page an
//   update moves and then rewrites, the page it is now (a rename keeps its inode, owner and ACL,
//   so asking it through itself is exact);
// - then every page not there, which the call makes (writeWhole), owner-writable. The folder that
//   is there on its way is asked by its access (a folder that cannot take a new folder is
//   refused here), and must be the desk's own. Then every folder it is made in that is not there
//   is MADE, outermost first (kind b: making a folder cannot be asked), and, once per folder,
//   the page's own folder is asked from inside: its access, then the probe (probeFolder), so the
//   entries it took from its parent are met as the call's own write meets them.
// Returns the folders it made, outermost first, which are now the call's own change: the caller
// puts them back with its other steps of kind b, and names them when it stops later. On the first
// that cannot, it removes the folders it made, deepest first, and throws NotAPage, NotWritable,
// NotOwnFolder or FolderNotWritable, carrying any folder it could not remove (foldersLeft), so the
// tool refuses with nothing changed or names exactly what is left (told). A folder it names is
// one on the desk after the call: never one it made and removed again.
function ahead(pairs) {
  const made = [];
  try {
    const fresh = [];
    for (const { file, from = null, removed = false } of pairs) {
      const st = whatIsAt(file);
      if (st !== null) {
        askPage(file, st, !removed);
        continue;
      }
      // A page the call removes that is not there: the call has nothing to take off.
      if (removed) continue;
      const src = from === null ? null : whatIsAt(from);
      if (src !== null) {
        try {
          askPage(from, src, true);
        } catch (err) {
          if (err instanceof NotWritable) throw new NotWritable(file, err.code);
          throw err;
        }
      }
      fresh.push(file);
    }
    const probed = new Set();
    for (const file of fresh) {
      const standing = standingFolder(file);
      mayAdd(standing);
      const dir = path.dirname(path.resolve(file));
      try {
        makeFolders(dir, made);
      } catch (err) {
        if (err instanceof NotOwnFolder) throw err;
        // Named by the folder on its way that was there at call start, never one this check made
        // (for this page or an earlier one), which it removes again.
        let there = standing;
        while (made.includes(there)) there = path.dirname(there);
        throw new FolderNotWritable(there, codeOf(err));
      }
      if (!probed.has(dir)) {
        probed.add(dir);
        mayAdd(dir);
        probeFolder(dir);
      }
    }
  } catch (err) {
    const left = unmakeFolders(made);
    if (err instanceof NotOwnFolder) {
      err.early = true;
      err.foldersLeft = left;
      err.message = err.told(err.file);
    }
    throw err;
  }
  return made;
}

// Paths as the up-front set's pairs (ahead), each checked as itself when it is there.
function asThemselves(files) {
  return files.map((file) => ({ file, from: null }));
}

// The last step of a call that made pages owner-writable to write them again later in the same
// call (undo_merge): each `{ file, mode }` gets its recorded permission bits back, through the
// page itself, never through a link. Returns the entries whose mode could not be set.
function modesLast(entries) {
  const failed = [];
  for (const entry of entries) {
    // Set once fchmod has run: a close that fails after it leaves the mode set, and is not said
    // as a mode not set back.
    let set = false;
    try {
      const fd = fs.openSync(entry.file, fs.constants.O_RDONLY | NOFOLLOW | (fs.constants.O_NONBLOCK || 0));
      try {
        if (!heldAt(fd, entry.file)) throw new NotOwnFolder(entry.file);
        fs.fchmodSync(fd, entry.mode & 0o777);
        set = true;
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      if (!set) failed.push(entry);
    }
  }
  return failed;
}

// The line end a text's first line ends with ("\r\n", a lone "\r", or "\n"), and the text,
// read with its line ends made "\n", given that line end again: a page the person keeps with
// Windows or old Mac line ends keeps them when a tool rewrites it.
function lineEndOf(raw) {
  const m = /\r\n|\r|\n/u.exec(raw);
  return m ? m[0] : "\n";
}

function withLineEnd(text, end) {
  return end === "\n" ? text : text.split("\n").join(end);
}

// A file's bytes, read through the file itself: never through a link at its last step. Opened
// only when stat reports a regular file: a pipe, socket or device (or a link to one) is never
// opened, since opening a pipe waits for a writer (R38). A folder fails as it always has, on the
// read; a link, on the open.
function readOwn(file) {
  let st = null;
  try {
    st = fs.statSync(file);
  } catch {
    // Nothing to stat (gone, or a link to nothing): the open below fails as it always has.
  }
  if (st !== null && !st.isFile() && !st.isDirectory()) throw new Error("not a regular file, so it was not opened");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | NOFOLLOW);
  try {
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Throws NotOwnFolder unless the folder holding `file` is still itself: the check just before a
// move or a removal by path.
function holdFolder(file) {
  if (!stillAt(path.dirname(file))) throw new NotOwnFolder(file);
}

// Reads a text file as Python's text mode reads it (line ends made "\n"), or null when there is
// no file there. Opened only when stat reports a regular file: anything else reads as no file,
// never opened (R38), and the writer that follows (writePage) refuses that path in its own words.
function readText(file) {
  let bytes;
  try {
    if (!fs.statSync(file).isFile()) return null;
    bytes = fs.readFileSync(file);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes).replace(/\r\n?/gu, "\n");
}

// Adds the change's line to the desk's log.md, written in place with the line ends it has, and
// returns the line.
function logChange(celorus, moment, handle, skill, what) {
  const entry = logEntry(moment.slice(11, 16), handle, skill, what);
  const file = path.join(celorus, "log.md");
  const text = readText(file);
  const end = text === null ? "\n" : lineEndOf(readOwn(file).toString("utf8"));
  writePage(file, withLineEnd(withLogEntry(text, moment.slice(0, 10), entry), end));
  return entry;
}

// Python's str.rstrip() with no argument.
const TRAILING = new RegExp(`[${BLANK_CLASS.slice(1, -1)}\\n]+$`, "u");
function rstrip(text) {
  return text.replace(TRAILING, "");
}

module.exports = {
  NOTHING,
  AS_WRITTEN,
  quoted,
  aMoment,
  clockNow,
  momentOf,
  seatsOf,
  heldSeat,
  logEntry,
  withLogEntry,
  NotOwnFolder,
  NotAFolder,
  NotWritable,
  NotAPage,
  FolderNotWritable,
  folderShown,
  takeSparesLeft,
  PageNotWritten,
  NotClosed,
  previousTail,
  endWithTail,
  sayBeforeTail,
  codeOf,
  writeWhole,
  writeInPlace,
  writePage,
  ahead,
  asThemselves,
  modesLast,
  lineEndOf,
  withLineEnd,
  makeFolders,
  unmakeFolders,
  readOwn,
  holdFolder,
  readText,
  logChange,
  rstrip,
};
