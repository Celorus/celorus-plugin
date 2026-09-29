"use strict";
// The engine's in-place write: the one way it rewrites a page it already owns (the base's
// ruling on writes, point 5, and its ruling R2). The file is opened read-write, the whole new text written from its first byte, cut to
// the new length, flushed to disk, and read back to compare with what was written. Nothing is
// created, so the page keeps its inode, owner, group, ACLs, extended attributes and hard links.
// The old text is held in memory by the caller the whole time; a failed write, cut, flush or
// read-back writes it back the same way.
//
// These helpers were lifted unchanged from lib/stamp.js, which imports them, as the desk's
// writers (engine/write) do; openedWhere is the writers' own, run after each open. A kill during the one write is outside what they can recover:
// the file can then be left with a line cut short, or with the old text's tail after the new
// text, because the cut had not run yet.

const fs = require("node:fs");
const path = require("node:path");

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

// Whether the file open as `fd` is where it must be: `file`'s folder, its links followed, is
// `folder`, and `file` names the file open as `fd` (the same device and inode). Null when so,
// or what is wrong, with no subject. Run right after an open and before the first byte is read
// or written: O_NOFOLLOW covers only the last part of a path, so a folder on the way made a
// link just before the open is caught here, not by the open.
function openedWhere(fd, file, folder) {
  let here;
  try {
    here = fs.realpathSync(path.dirname(file));
  } catch (err) {
    return `could not be told to be in the desk's celorus folder (${codeOf(err)})`;
  }
  if (here !== folder) return "was opened through a folder that is a link out of its place in the desk's celorus folder";
  const named = stillNamed(fd, file);
  if (named === true) return null;
  if (named === false) return "was opened as a file its path no longer names";
  return `could not be told to be the file its path names (${named})`;
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
module.exports = { codeOf, readWhole, putWhole, stillNamed, openedWhere, keepingMode, putBack, rewrite };
