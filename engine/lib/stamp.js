"use strict";
// The check's stamp: two adjacent lines in the header of the desk's desk.md,
// `checked_with: <version>` and `checked_findings: <n>`, saying which release of the plugin
// last checked the whole desk and how many findings it listed. They record which release
// checked the desk, never that it is clean; the count gives the state.
//
// House rule 5, ruled: a stamp of the checker's own version is NOT a desk change. Rule 5 is
// about the desk's content; the stamp is the check's record of itself, which the stamp line
// carries. No history line.
//
// A check is read-only unless it is asked to record (`record: true`, the command line's
// --record). It then writes only when desk.md is the desk's stamps page, the answer reads the
// desk as layout 2, and the whole desk was checked. Exactly these two lines of desk.md change and every other byte stays as it was: a
// line already there is replaced where it stands, a missing one is added beside the other,
// and with neither there both go at the header's end. Two lines standing apart are brought
// together, the count moved to follow the version. The answer names the lines written and
// the page, or says in a sentence why nothing was.
//
// The stamp rewrites desk.md in place: the same file, opened for writing, the whole new text
// written from its first byte, cut to the new length, flushed to disk, and read back to compare
// with what was written. Nothing is created, so desk.md keeps its owner, group, ACLs, extended
// attributes and hard links. A write by a user who is not root clears the setuid and setgid
// bits, so the mode is put back after it when it changed. desk.md's old text is held in memory
// the whole time. A failed write, cut, flush or read-back writes the old text back the same way;
// a desk.md renamed away, removed, or not confirmed to be the file the stamp went into has the
// stamp taken back out of that file. A stamp that fails never fails the check.
//
// The promise, on every path:
// (i) desk.md's text is never lost or torn: the old text is written back, or carried in
//     `previous_text` when the write-back did not read back equal.
// (ii) The answer says written only when the stamp landed and read back equal.
// (iii) Every sentence the answer makes about the file is true, including which file
//     `previous_text` belongs to (`previous_text_is_desk_md`, decided by the look at the path).
//
// Its edge: a save of desk.md by another program during the one write is outside the promise.
// A save by rename, or a removal, is seen by the look at the path, which runs after the write on
// every path, a failed one too: the answer says desk.md was replaced or removed (or, when the look
// itself fails, that this could not be confirmed), the save is kept, and the file the stamp went
// into gets its old text back or the answer carries it. A save written into the same file can be
// overwritten by the stamp or by the write-back, and the answer reports only what the stamp's own
// read-back saw. So is a kill
// during the one write: desk.md can then be left with a stamp line cut short, or with the old
// text's tail after the new text, because the cut had not run yet.

const fs = require("node:fs");
const path = require("node:path");
const { readPage, splitPage } = require("./desk.js");
const { parseHeader, HeaderError } = require("./header.js");
const { rootFault } = require("./linkedroot.js");

const VERSION_KEY = "checked_with";
const COUNT_KEY = "checked_findings";
const LINE_OF = {
  [VERSION_KEY]: /^checked_with[ \t]*:/,
  [COUNT_KEY]: /^checked_findings[ \t]*:/,
};
const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// `previous_text_is_desk_md` says which file `previous_text` belongs to: true when desk.md itself
// is the file the stamp went into, as the look at the path confirms, so the text can go back into
// desk.md; false when it is the file the stamp went into, which desk.md may no longer name (a
// replace, or a look that cannot tell), so writing it over desk.md could overwrite a newer save;
// null with no text. The same look decides it on every path that carries a text.
function notWritten(reason, previous = null, isDeskMd = null) {
  return {
    written: null,
    page: null,
    reason,
    previous_text: previous,
    previous_text_is_desk_md: previous === null ? null : isDeskMd,
  };
}

// The two sentences a failed write ends with when the look sees desk.md still names the file.
const RESTORED = "desk.md was restored.";
// A write-back of desk.md's old text that fails can fail before its first byte, so desk.md can
// still hold the whole stamp, or neither text whole.
const INCOMPLETE = "desk.md may still hold the stamp or be incomplete, and its previous text is in the answer.";
const CHANGED = "desk.md changed while the check ran, so the stamp was not written.";
const REPLACED = "desk.md was replaced or removed while the stamp was being written, so the stamp was not written";
// Said on every failed put-back: a write-back can fail before its first byte or after its
// write (a cut or a flush), so the file can hold the stamp, or neither text whole.
const MAY_HOLD = "the file it went into may still hold the stamp or be incomplete, and its previous text is in the answer.";
// A run asked for a scope that was not applied. It says nothing of what a run without scope
// would meet (a desk.md that cannot be written, an existing stamp), so it is true whatever that is.
const NOT_APPLIED = "A check asked for a scope does not stamp the desk, even when the scope was not applied.";

// A header as a value that compares whatever order its keys were written in.
function sameValue(a, b) {
  const settle = (value) => {
    if (Array.isArray(value)) return value.map(settle);
    if (value !== null && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .map((key) => [key, settle(value[key])]);
    }
    return value;
  };
  return JSON.stringify(settle(a)) === JSON.stringify(settle(b));
}

// Why a run may not stamp the desk, or null when it may. `read` is readDesk's answer. A run
// asked for a scope (`scoped`) never stamps, whether the scope was `applied` or not. One whose
// scope was not applied was not narrowed, so a more basic reason a whole check would meet comes
// first where one applies (here, and in stampCheckedWith up to the open), and then NOT_APPLIED.
function whyNot(read, { record, scoped, applied, version }) {
  if (!record) return "This run was read-only: only a run asked to record (record: true) writes the stamp.";
  // A desk whose celorus/, celorus/views/ or celorus/log.md is a link, or whose celorus/views/ is
  // not a folder: the check read it and reports as ever, and writes no stamp, in the words every
  // writer refuses it in (lib/linkedroot.js).
  const linked = rootFault(read.root);
  if (linked !== null) return linked;
  if (scoped && applied) return "A check narrowed by scope does not stamp the desk; only a whole-desk check does.";
  if (read.stampsUnread) return `The desk's stamps page, ${read.stampsUnread.rel}, could not be read, so nothing was written.`;
  if (read.deskPage === null) {
    return "This desk has no desk.md, so it has no stamps page to carry checked_with; nothing was written.";
  }
  // The same layout the answer reports (read.layout, desk.js's reading of layout_version, 1
  // when desk.md names none). Only the number 2 (written 2 or 2.0) is stamped; 1, a quoted
  // "1" or "2", true or 3 is not, so the write never goes past what the answer says.
  if (read.layout !== 2) {
    const shown = typeof read.layout === "number" ? String(read.layout) : JSON.stringify(read.layout);
    return `This desk reads as layout ${shown}, not layout 2 (its desk.md does not say layout_version: 2), so the stamp was not written.`;
  }
  if (version === "unknown") return "The plugin's version is not known, so checked_with was not written.";
  return null;
}

// The desk.md text with the two stamp lines in its header, or a reason they cannot go in
// without touching another line.
function stamped(text, want) {
  if (text.includes("\r")) return { reason: "desk.md has Windows line endings, so the stamp was not written." };
  const split = splitPage(text);
  if (split === null) return { reason: "desk.md has no header, so the stamp was not written." };
  let before;
  try {
    before = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    return { reason: "desk.md's header does not parse, so the stamp was not written." };
  }
  if (before === null) return { reason: "desk.md has no header, so the stamp was not written." };
  const lines = split.header.split("\n");
  const at = {};
  for (const key of [VERSION_KEY, COUNT_KEY]) {
    const found = lines.flatMap((row, i) => (LINE_OF[key].test(row) ? [i] : []));
    if (found.length > 1) return { reason: `desk.md names ${key} more than once, so the stamp was not written.` };
    at[key] = found.length ? found[0] : null;
  }
  const line = (key) => `${key}: ${want[key]}`;
  if (at[VERSION_KEY] !== null && at[COUNT_KEY] !== null) {
    const adjacent = at[COUNT_KEY] === at[VERSION_KEY] + 1;
    if (adjacent && lines[at[VERSION_KEY]] === line(VERSION_KEY) && lines[at[COUNT_KEY]] === line(COUNT_KEY)) {
      return { same: true };
    }
    lines[at[VERSION_KEY]] = line(VERSION_KEY);
    lines.splice(at[COUNT_KEY], 1);
    lines.splice(lines.indexOf(line(VERSION_KEY)) + 1, 0, line(COUNT_KEY));
  } else if (at[VERSION_KEY] !== null) {
    lines[at[VERSION_KEY]] = line(VERSION_KEY);
    lines.splice(at[VERSION_KEY] + 1, 0, line(COUNT_KEY));
  } else if (at[COUNT_KEY] !== null) {
    lines[at[COUNT_KEY]] = line(COUNT_KEY);
    lines.splice(at[COUNT_KEY], 0, line(VERSION_KEY));
  } else {
    lines.push(line(VERSION_KEY), line(COUNT_KEY));
  }
  const header = lines.join("\n");
  let after;
  try {
    after = parseHeader(header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    after = undefined;
  }
  // The two lines must change the stamp and nothing else the header says.
  if (after === undefined || !sameValue(after, { ...before, ...want })) {
    return { reason: "desk.md's checked_with or checked_findings is not one value on one line, so the stamp was not written." };
  }
  return { text: `---\n${header}\n---\n${split.body}`, lines: [line(VERSION_KEY), line(COUNT_KEY)] };
}

const codeOf = (err) => (err && typeof err.code === "string" ? err.code : "an unknown error");

// The bytes of the file open as `fd`, from its first byte to its length.
function readWhole(fd) {
  const size = fs.fstatSync(fd).size;
  const bytes = Buffer.alloc(size);
  let at = 0;
  while (at < size) {
    const got = fs.readSync(fd, bytes, at, size - at, at);
    if (got === 0) break;
    at += got;
  }
  return bytes.subarray(0, at);
}

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
  return readWhole(fd).equals(bytes);
}

// Whether `file` still names the file open as `fd`: true for the same device and inode, false
// when it names another file or nothing, or the error's code when that cannot be told.
function stillNamed(fd, file) {
  let now;
  let held;
  try {
    try {
      now = fs.lstatSync(file);
    } catch (err) {
      if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) return false;
      throw err;
    }
    held = fs.fstatSync(fd);
  } catch (err) {
    return codeOf(err);
  }
  return now.dev === held.dev && now.ino === held.ino;
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
      // Only desk.md's owner can put the setuid and setgid bits back; without them the file
      // allows less than it did, never more.
    }
  }
}

// Writes `bytes` back over the file open as `fd`, and says whether it reads back as them.
function putBack(fd, bytes) {
  try {
    return keepingMode(fd, () => putWhole(fd, bytes));
  } catch {
    return false;
  }
}

// Rewrites desk.md, open as `fd` and holding `before`, as `after`. Returns null when it holds
// `after`; otherwise the old text has been written back, and the answer is what went wrong, with
// no subject ("could not be written (EIO)"), and whether the file is known to hold its old text
// again.
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

// Why the stamp is not kept when desk.md no longer names the file the stamp went into (false),
// or that cannot be confirmed (the error's code).
function notNamedWhy(named) {
  return named === false
    ? REPLACED
    : `It could not be confirmed that desk.md is the file the stamp went into (${named}), so the stamp was not written`;
}

// Why the stamps page the reader opened as desk.md is not in the desk's page list. On a disk
// that ignores case, opening desk.md opens a DESK.MD or a desk.MD, which the page list (names
// ending in `.md`) leaves out; the check does not stamp that page, and says its name. Only when
// the folder holds a desk.md by that exact name, or none in any case, did desk.md change.
function unlistedWhy(dir) {
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => name.toLowerCase() === "desk.md");
  } catch {
    return CHANGED;
  }
  if (names.length === 0 || names.includes("desk.md")) return CHANGED;
  return `The desk's stamps page is named ${names.join(" and ")}, not exactly desk.md, so the check does not stamp it; nothing was written.`;
}

// Writes the stamp when the run may, and says what was written or why nothing was.
function stampCheckedWith(read, options) {
  const reason = whyNot(read, options);
  if (reason !== null) return notWritten(reason);
  const rel = read.deskPage;
  const dir = path.join(read.root, "celorus");
  if (!read.pages.some((page) => page.rel === rel)) return notWritten(unlistedWhy(dir));
  const file = path.join(dir, ...rel.split("/"));
  let raw;
  let text;
  try {
    if (!fs.lstatSync(file).isFile()) return notWritten("desk.md is not a plain file, so the stamp was not written.");
    raw = fs.readFileSync(file);
    text = STRICT_UTF8.decode(raw);
  } catch {
    return notWritten("desk.md could not be read again, so the stamp was not written.");
  }
  const listed = read.pages.find((page) => page.rel === rel);
  const now = readPage(dir, rel);
  if (!listed || !sameValue([listed.head, listed.body, listed.problem], [now.head, now.body, now.problem])) {
    return notWritten(CHANGED);
  }
  const want = { [VERSION_KEY]: options.version, [COUNT_KEY]: options.findings };
  const next = stamped(text, want);
  if (next.reason) return notWritten(next.reason);
  if (next.same) {
    return notWritten(`desk.md already says checked_with: ${options.version} and checked_findings: ${options.findings}, so nothing was written.`);
  }
  // The reasons a whole check meets before its open have been said above; the open and the write
  // are never tried for a scoped run, and NOT_APPLIED makes no claim about them.
  if (options.scoped) return notWritten(NOT_APPLIED);
  let fd;
  try {
    // O_NOFOLLOW: a desk.md made a link since the look above is not opened through.
    fd = fs.openSync(file, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  } catch (err) {
    return notWritten(`desk.md could not be written (${codeOf(err)}), so the stamp was not written.`);
  }
  try {
    // The old text held in memory is the text the open file holds.
    if (!readWhole(fd).equals(raw)) return notWritten(CHANGED);
    const failed = rewrite(fd, raw, Buffer.from(next.text, "utf8"));
    // A save by rename or a removal since the open, or a look that cannot tell: the stamp and any
    // write-back went into the file the open holds, which the path may no longer name. The look
    // runs on every path after the write, a failed one too, so an answer says desk.md was
    // restored, or calls the old text desk.md's, only when the path is seen to name that file still.
    const named = stillNamed(fd, file);
    if (failed) {
      if (named === true) {
        if (failed.restored) return notWritten(`desk.md ${failed.fault}, so the stamp was not written; ${RESTORED}`);
        return notWritten(`desk.md ${failed.fault}; ${INCOMPLETE}`, text, true);
      }
      const why = notNamedWhy(named);
      const said = `The stamp ${failed.fault}, and ${why[0].toLowerCase()}${why.slice(1)}`;
      if (failed.restored) return notWritten(`${said}; the file it went into was put back as it was.`);
      return notWritten(`${said}; ${MAY_HOLD}`, text, false);
    }
    // After a stamp written whole, that file gets its old text back. A desk.md~ backup or another
    // hard link of it then holds no stamp.
    if (named !== true) {
      const why = notNamedWhy(named);
      if (!putBack(fd, raw)) return notWritten(`${why}; ${MAY_HOLD}`, text, false);
      return notWritten(`${why}; ${named === false ? "the file it went into" : "that file"} was put back as it was.`);
    }
  } catch (err) {
    return notWritten(`desk.md could not be written (${codeOf(err)}), so the stamp was not written.`);
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // The text is flushed and read back already; a close that fails changes nothing on disk.
    }
  }
  return { written: next.lines, page: rel, reason: null, previous_text: null, previous_text_is_desk_md: null };
}

module.exports = { stampCheckedWith };
