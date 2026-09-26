"use strict";
// Writing the path page, `celorus/views/path-to-<file name>.md`. The tool writes this one page
// and nothing else, never through a link and never over a page it did not write:
//
// - The way to the page is walked one folder at a time without following a link (lstat): the
//   desk folder as named, `celorus`, `celorus/views`, then the page. A folder on the way that is
//   not a plain folder, or a page that is not a plain file, is refused by name. The views folder
//   is resolved again right before the page is opened. Right after the open, before any byte is
//   written, the views folder must still resolve to the desk's own, and the page's path must
//   still name the file opened (the stamp's stillNamed look); otherwise nothing is written, a file
//   the open made is removed through the path only when that path names it, and where it cannot
//   be removed the refusal names it by device and inode.
// - After every write, a failed one too, the page's path must still name the file written (the
//   stamp's stillNamed look); a page saved over by rename meanwhile is never claimed written.
// - A page not there yet is created fresh: O_CREAT | O_EXCL | O_NOFOLLOW, so a file or a link
//   that appears in its place after the look is never written through.
// - A page already there is rewritten only when its header says this tool wrote it,
//   `generated_by: celorus-plugin <version> who_can_introduce`. Any other page by that name
//   is refused by name and not touched.
// - A page this tool owns is rewritten in place, by the engine's write discipline for a page it
//   owns (the base's ruling on the stamp, issue 4197, comment 5802709003, point 5): the same
//   file, opened read-write without following a link, the whole new text written from its first
//   byte, cut to the new length, flushed, and read back. Nothing is created, so the page keeps
//   its owner, group, mode, ACLs and hard links. Its old text is held in memory the whole time;
//   on any error, or a read-back that differs, the old text is written back the same way, and
//   the refusal says either that the page was restored or that it may be incomplete, with its
//   previous text carried in the refusal.
//
// Its edge, as the stamp names its own: a kill during the one write can leave the page cut
// short, or with the old text's tail after the new text, because the cut had not run yet.
//
// These helpers are a small local copy of lib/stamp.js's in-place discipline (readWhole,
// putWhole, the mode kept), since stamp.js exports none of them. E8 lifts the stamp's helpers
// into engine/lib/inplace.js on the 0.19 branch; the two are made one when 0.19 is rebased.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot, linkedSaid, notFolderSaid, linkKind, NOTHING } = require("../lib/linkedroot.js");
const { splitPage } = require("../lib/desk.js");
const { parseHeader } = require("../lib/header.js");

const TOOL = "who_can_introduce";
// The header value that makes a page this tool's own, whichever release wrote it.
const OWNED = new RegExp(`^celorus-plugin \\S+ ${TOOL}$`, "u");
const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;

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
// flushes it, and says whether it reads back as exactly those bytes.
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
      // Without the bits put back the file allows less than it did, never more.
    }
  }
}

// What a thing met by lstat is, in words, for a refusal.
function kindOf(stat) {
  if (stat.isSymbolicLink()) return "a link";
  if (stat.isDirectory()) return "a folder";
  if (stat.isFile()) return "a plain file";
  return "neither a plain file nor a folder";
}

// `shown` is the path under the desk the refusal names it by, never the absolute one.
function lstatOrNull(file, shown) {
  try {
    return fs.lstatSync(file);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw new Refusal(`${shown} could not be looked at (${codeOf(err)}), so the path page was not written.`);
  }
}

// The desk's own views folder, reached one folder at a time without following a link: the desk
// folder as the person named it, resolved once (a link above the desk is how they chose to name
// it), then `celorus`, then `views`, each looked at by lstat and refused by name when it is a link
// or not a folder; `views` is made when it is not there. Node has no openat, so the folder is
// held by its resolved path: the write resolves it again right before and right after the open
// (stillThere), and a folder on the way that became a link since is caught there.
function viewsFolder(root, rel) {
  let dir;
  try {
    dir = fs.realpathSync(root);
  } catch (err) {
    throw new Refusal(`The desk folder could not be looked at (${codeOf(err)}), so ${rel} was not written.`);
  }
  for (const [name, shown] of [
    ["celorus", "celorus/"],
    ["views", "celorus/views/"],
  ]) {
    dir = path.join(dir, name);
    let seen = lstatOrNull(dir, shown);
    if (seen === null && name === "views") {
      try {
        fs.mkdirSync(dir);
      } catch (err) {
        if (!err || err.code !== "EEXIST") {
          throw new Refusal(`celorus/views could not be made (${codeOf(err)}), so ${rel} was not written.`);
        }
      }
      seen = lstatOrNull(dir, shown);
    }
    // A link, or a views folder that is not a folder, in the words every writer refuses it in
    // (lib/linkedroot.js); a celorus folder that is not there, or not a folder, as before.
    if (seen !== null && seen.isSymbolicLink()) throw new Refusal(`${linkedSaid(shown, linkKind(dir))} ${NOTHING}`);
    if (seen !== null && !seen.isDirectory() && name === "views") {
      throw new Refusal(`${notFolderSaid(kindOf(seen))} ${NOTHING}`);
    }
    if (seen === null || !seen.isDirectory()) {
      throw new Refusal(
        `${shown} is ${seen === null ? "not there" : kindOf(seen)}, not a plain folder, so ${rel} was not ` +
          `written: the path page is written only into a views folder on the desk itself. Make ${shown} ` +
          "a plain folder, then ask again.",
      );
    }
  }
  return dir;
}

// Whether the views folder, held by its resolved path, still resolves to that path: no folder on
// the way to it has become a link.
function stillThere(dir) {
  try {
    return fs.realpathSync(dir) === dir;
  } catch {
    return false;
  }
}

function movedAway(rel, tail) {
  return new Refusal(`celorus/views no longer leads to the desk's own views folder, so ${rel} was not written; ${tail}`);
}

function placeChanged(rel, tail) {
  return new Refusal(`The place of ${rel} changed while it was being opened, so the path page was not written; ${tail}`);
}

// Whether the file open as `fd` is the one the desk names, in the desk's own views folder: the
// look right after the open, before any byte is written.
function openedInPlace(dir, fd, file) {
  return stillThere(dir) && stillNamed(fd, file) === true;
}

// Where the file open as `fd` is, by device and inode, for a refusal that cannot remove it.
function whereIs(fd) {
  try {
    const held = fs.fstatSync(fd);
    return `device ${held.dev}, inode ${held.ino}`;
  } catch (err) {
    return `it could not be looked at (${codeOf(err)})`;
  }
}

// Whether `file` still names the file open as `fd` (lib/stamp.js's stillNamed, the same look):
// true for the same device and inode, false when it names another file or nothing, or the
// error's code when that cannot be told.
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

// Why the path page is not claimed written when `rel` no longer names the file the text went
// into (false), or that cannot be told (the error's code).
function notNamedWhy(rel, named) {
  return named === false
    ? `${rel} was replaced by another file while the path page was being written`
    : `It could not be confirmed that ${rel} is the file the path page went into (${named})`;
}

function notPlain(rel, what) {
  return new Refusal(
    `${rel} is ${what}, not a plain file, so it was not written: the path page is written only as a ` +
      "plain file this tool wrote, or where there is none. Move it away, then ask again.",
  );
}

// Whether `bytes` are a page whose header says this tool wrote it.
function owned(bytes) {
  let text;
  try {
    text = STRICT_UTF8.decode(bytes).replace(/\r\n?/g, "\n");
  } catch {
    return false;
  }
  const split = splitPage(text);
  if (!split) return false;
  let head;
  try {
    head = parseHeader(split.header);
  } catch {
    return false;
  }
  return head !== null && typeof head === "object" && typeof head.generated_by === "string" && OWNED.test(head.generated_by);
}

// Removes the file open as `fd` when `file` still names it, and says whether it did.
function removeMade(fd, file) {
  try {
    if (stillNamed(fd, file) !== true) return false;
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

// A page not there yet, created fresh and written whole.
function create(dir, file, rel, bytes) {
  if (!stillThere(dir)) throw movedAway(rel, "nothing was made.");
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o666);
  } catch (err) {
    if (err && err.code === "EEXIST") {
      throw new Refusal(`${rel} appeared while the path page was being written, so it was not written. Ask again.`);
    }
    throw new Refusal(`${rel} could not be made (${codeOf(err)}), so the path page was not written.`);
  }
  try {
    // The open may have gone through a folder that became a link after the look, and back again:
    // nothing is written, and what the open made is removed through the path only when the path
    // names it.
    if (!openedInPlace(dir, fd, file)) {
      throw placeChanged(
        rel,
        removeMade(fd, file)
          ? "the new file was removed."
          : `the empty file the open made is left where the open went (${whereIs(fd)}).`,
      );
    }
    let fault = null;
    try {
      if (!putWhole(fd, bytes)) fault = "did not read back as it was written";
    } catch (err) {
      fault = `could not be written (${codeOf(err)})`;
    }
    const named = stillNamed(fd, file);
    if (named !== true) {
      throw new Refusal(
        `${notNamedWhy(rel, named)}, so the path page was not written; ` +
          (named === false ? "the file it went into is not on the desk." : `the file it went into is left where it is (${whereIs(fd)}).`),
      );
    }
    if (fault !== null) {
      throw new Refusal(
        `${rel} ${fault}, so the path page was not written; ` +
          (removeMade(fd, file) ? "the new file was removed." : "the new file may be left incomplete."),
      );
    }
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // The text is flushed and read back already.
    }
  }
}

// Writes `bytes` back over the file open as `fd`, keeping its mode, and says whether it reads
// back as them.
function putBack(fd, bytes) {
  try {
    return keepingMode(fd, () => putWhole(fd, bytes));
  } catch {
    return false;
  }
}

// A page this tool owns, rewritten in place.
function rewrite(dir, file, rel, bytes) {
  if (!stillThere(dir)) throw movedAway(rel, "nothing was written to it.");
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDWR | NOFOLLOW);
  } catch (err) {
    if (err && (err.code === "ELOOP" || err.code === "EMLINK")) throw notPlain(rel, "a link");
    throw new Refusal(`${rel} could not be opened (${codeOf(err)}), so the path page was not written.`);
  }
  try {
    // The open may have gone through a folder that became a link after the look, and back again.
    if (!openedInPlace(dir, fd, file)) throw placeChanged(rel, "nothing was written to it.");
    if (!fs.fstatSync(fd).isFile()) throw notPlain(rel, "not a plain file");
    const before = readWhole(fd);
    if (!owned(before)) {
      throw new Refusal(
        `${rel} is on the desk and its header does not say generated_by: celorus-plugin <version> ` +
          `${TOOL}, so this tool did not write it and it was not written over. Move or rename that page, ` +
          "then ask again.",
      );
    }
    const fault = keepingMode(fd, () => {
      try {
        return putWhole(fd, bytes) ? null : "did not read back as it was written";
      } catch (err) {
        return `could not be written (${codeOf(err)})`;
      }
    });
    // A save by rename or a removal since the open, or a look that cannot tell: the text went into
    // the file the open holds, which the path may no longer name. The look runs after every write,
    // a failed one too (lib/stamp.js's discipline), so the tool says it wrote the page, or that
    // the page was restored, only when the path is seen to name that file still; otherwise that
    // file gets its old text back and the path's own file is left as it is.
    const named = stillNamed(fd, file);
    if (named !== true) {
      const why = notNamedWhy(rel, named);
      const also = fault === null ? "" : `, and the new text ${fault}`;
      throw new Refusal(
        `${why}${also}, so the path page was not written; ` +
          (putBack(fd, before) ? "the file it went into was put back as it was." : "the file it went into may hold part of the new text."),
      );
    }
    if (fault === null) return;
    const restored = putBack(fd, before);
    // The look runs again after the restore (lib/stamp.js looks after it too): "restored" is said
    // only when the path still names the file the old text went back into.
    const again = stillNamed(fd, file);
    if (again !== true) {
      const why = notNamedWhy(rel, again);
      throw new Refusal(
        `${rel} ${fault}, and then ${why[0].toLowerCase()}${why.slice(1)}, so the path page was not written; ` +
          (restored
            ? `its old text went back into the file the path page was written to, which ${rel} no longer names (${whereIs(fd)}).`
            : `the file the path page was written to may hold part of the new text (${whereIs(fd)}).`),
      );
    }
    if (restored) throw new Refusal(`${rel} ${fault}, so the path page was not written; ${rel} was restored.`);
    // The previous text ends the answer whole: it is marked as the refusal's tail (history.js
    // endWithTail's mark), so a caller that says more (render_views) says it before the text.
    const tail = `\n\n${before.toString("utf8")}`;
    const refusal = new Refusal(`${rel} ${fault}; ${rel} may be incomplete, and its previous text follows.${tail}`);
    Object.defineProperty(refusal, "tail", { value: tail, enumerable: false, writable: true, configurable: true });
    throw refusal;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Nothing is left to flush.
    }
  }
}

// Writes the path page `rel` (under the desk `root`) as `text`, or refuses and says why.
function writePathPage(root, rel, text) {
  // celorus/, celorus/views/ or celorus/log.md a link, or celorus/views/ not a folder: refused
  // before the first look at the page, in the words every writer refuses it in.
  refuseLinkedRoot(root);
  const dir = viewsFolder(root, rel);
  const file = path.join(dir, path.basename(rel));
  const bytes = Buffer.from(text, "utf8");
  const seen = lstatOrNull(file, rel);
  if (seen === null) return create(dir, file, rel, bytes);
  if (!seen.isFile()) throw notPlain(rel, kindOf(seen));
  return rewrite(dir, file, rel, bytes);
}

module.exports = { writePathPage, OWNED, owned };
