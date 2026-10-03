"use strict";
// How render_view touches the desk folder: only plain folders and plain files inside it, never
// through a link. A folder or file it would write into or read from is looked at with lstat
// first, and a link, or a thing that is not a plain folder or file, is refused by its path in
// the desk before anything is written. O_NOFOLLOW covers only the last name in a path, so every
// file opened is checked before its first byte is read or written: the opened file must be the
// one at its path (same dev and ino), and its folder must still resolve to where it sits under
// the desk, whose resolved path is taken once at the door (deskRoot). A folder swapped for a
// link after the look is refused, and nothing is written through it.
//
// A render's files are written as one (writeAll): every folder is made and every file opened
// and checked before the first byte of any of them is written, and only then is each written,
// in the order given. A refusal says what is on the disk: "Nothing was written." only when that
// is so, and otherwise the files already written, by name, and anything it made that it could
// not take away.
//
// No file render_view writes is at its path until it is whole. Each is written in full to a
// spare file in its target's folder (so the move stays on one filesystem), named
// `.celorus-spare-<16 hex>.tmp` whatever the target is called (so a target whose own name fits
// the name limit always has a spare that fits too), opened O_CREAT|O_EXCL, fsynced, and only
// then moved there: a new file only while an lstat shows nothing at its path, a replaced one over
// the old. The kill window is between a render's first open and its last move: a kill there
// leaves spare files beside their targets, empty or whole (a whole one holds the page or the
// sentences that render was given), and never an empty or half-written file at a page's, its
// sentences' or a setting's path. No reader of the desk or of Obsidian's settings looks at a
// .tmp name, so a leftover spare is never read or taken for a page, sentences or a setting.
// The next render removes them. The folders it looks in are the sweep set: the folder of every
// file the caller can create (writeAll's `targets`, which render_view takes from the same
// functions that choose its page, its sentences and every settings file, whether or not each is
// missing today), never a folder listed by hand; a folder this render made cannot hold a
// leftover and is not searched. Once its own files are opened, in each folder of
// that set, it removes every entry whose name is exactly a spare's (SPARE) and that is a plain
// file by lstat (never a link, never anything else, never its own spares), and names each one
// removed, by its path in the desk, as a leftover spare file in its answer (spares_removed). A
// spare it cannot remove is named too (spares_not_removed), and a folder of the set it cannot
// list is named apart, as one it could not look in (spares_not_looked_for_in); neither blocks the
// render. Nothing outside the sweep set is ever swept, and nothing else is ever removed. The
// engine cannot tell a live spare from a killed render's, so two renders of the same desk at once
// can remove each other's spares: that is out of scope under the threat model (a same-user
// change during a call).

const fs = require("fs");
const path = require("path");
const { Refusal } = require("../lib/refusal.js");

const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;
// The flags of an open that makes its file and refuses anything already at its path.
const EXCLUSIVE = fs.constants.O_CREAT | fs.constants.O_EXCL;
const DONE = "Nothing was written.";
// The one name a spare has; the sweep removes only entries named exactly so.
const SPARE = /^\.celorus-spare-[0-9a-f]{16}\.tmp$/;

// A refusal whose cause is kept apart from what it says about the disk (`said`), so a writer
// that has written some files already can say that part truly. `left` names what this step
// made and could not take away.
function refusal(said, left = []) {
  const err = new Refusal(`${said} ${ledger([], left)}`);
  err.said = said;
  err.left = left;
  return err;
}

// What a refusal says about the disk: nothing, or the files written and what was left behind,
// after the leftover spare files it removed, or could not, and the folders it could not look in,
// before it stopped. A render that removed a leftover spare never says nothing was written.
function ledger(written, left, swept = { removed: [], kept: [], unlisted: [] }) {
  const parts = [];
  if (swept.removed.length) parts.push(`It removed these leftover spare files: ${swept.removed.join(", ")}.`);
  if (swept.kept.length) parts.push(`It could not remove these leftover spare files: ${swept.kept.join(", ")}.`);
  if (swept.unlisted.length) parts.push(`It could not look for leftover spares in ${swept.unlisted.join(", ")}.`);
  if (!written.length && !left.length && !swept.removed.length) parts.push(DONE);
  if (written.length) parts.push(`These files were written before it stopped: ${written.join(", ")}.`);
  if (left.length) parts.push(`These it made and could not take away, each empty: ${left.join(", ")}.`);
  return parts.join(" ");
}

// The lstat of `rel` under root, or null when nothing is there. Any other error is refused by
// the path in the desk and the error's code, never its text (failed).
function look(root, rel) {
  try {
    return fs.lstatSync(path.join(root, ...rel.split("/")));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw failed(rel, "look at", err);
  }
}

function refuseLink(rel) {
  throw refusal(
    `${rel} is a link, so render_view neither reads nor writes through it: a page and its sentences stay inside the desk folder. Make it a plain folder or file there, or move the link away.`,
  );
}

// Whether `rel` under root is a plain folder (true) or absent (false); anything else is refused.
function plainFolder(root, rel) {
  const st = look(root, rel);
  if (st === null) return false;
  if (st.isSymbolicLink()) refuseLink(rel);
  if (!st.isDirectory()) throw refusal(`${rel} is not a plain folder, so render_view writes nothing into it.`);
  return true;
}

// Whether `rel` under root is a plain file (true) or absent (false); anything else is refused.
function plainFile(root, rel) {
  const st = look(root, rel);
  if (st === null) return false;
  if (st.isSymbolicLink()) refuseLink(rel);
  if (!st.isFile()) throw refusal(`${rel} is not a plain file, so render_view neither reads nor writes it.`);
  return true;
}

// The plain files among `rels` that hold no bytes. Nothing render_view writes is ever empty, and
// nothing it writes is at its path before it is whole (writeAll), so an empty one at a render's
// path is never its page or sentences.
function emptyFiles(root, rels) {
  return rels.filter((rel) => {
    const st = look(root, rel);
    return st !== null && st.isFile() && st.size === 0;
  });
}

// The desk folder as the disk resolves it: taken once, at the door, and every file below is
// opened by its path under it.
function deskRoot(root) {
  return fs.realpathSync(root);
}

function under(root, rel) {
  return path.join(root, ...rel.split("/"));
}

function moved(rel, left = []) {
  return refusal(
    `The folder holding ${rel} changed while the file was being opened (a link or another folder was put in its place), so render_view neither reads nor writes it. Look at that folder and render again.`,
    left,
  );
}

// A new file's path that is taken by the time its spare would be moved there: the thing there
// stays, whatever it is, and the spare is taken away.
function taken(rel) {
  return refusal(`${rel} is already there, so render_view did not put its own file in its place: the one there stays. Look at it and render again.`);
}

function movedBeforePlaced(rel) {
  return refusal(
    `The folder holding ${rel} changed before the file was put in place (a link or another folder was put in its place), so render_view did not put it there. Look at that folder and render again.`,
  );
}

// An error named by its code only: its message can quote a path from this machine or a file's
// text, so it never rides a refusal.
function codeOf(err) {
  return err && typeof err.code === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(err.code) ? err.code : "an error with no code";
}

function failed(rel, doing, err) {
  return refusal(`render_view could not ${doing} ${rel} (${codeOf(err)}). Look at that file and its folder, and render again.`);
}

// A spare that could not be opened: named by the target it was for, which may not be on the disk
// yet, never as a file that could not be opened.
function spareFailed(rel, err) {
  return refusal(`render_view could not create a spare file beside ${rel} (${codeOf(err)}). Look at the folder it goes in, and render again.`);
}

// What a refusal says about why it stopped: its own words, or the error's code, never its text.
function why(err) {
  return err.said || `render_view stopped on an error (${codeOf(err)}). Look at the desk's celorus/.views and .obsidian folders, and render again.`;
}

// Whether the opened fd is the file at `rel` under root (same dev and ino as its path's lstat),
// in the folder it should be in (that folder still resolves to its place under the desk).
function inPlace(root, rel, fd) {
  try {
    const opened = fs.fstatSync(fd);
    const there = fs.lstatSync(under(root, rel));
    const folder = path.dirname(under(root, rel));
    return opened.dev === there.dev && opened.ino === there.ino && fs.realpathSync(folder) === folder;
  } catch {
    return false;
  }
}

// Takes away a file this render made and holds open: its bytes first, through its own fd, then
// its name, but only through a path that is that very file (its inode matches the fd); anything
// else there is left alone. Answers whether the file is gone (no name on the disk holds it).
function discard(root, rel, fd) {
  try {
    fs.ftruncateSync(fd, 0);
  } catch {
    // an fd opened for reading holds no bytes of ours
  }
  try {
    const opened = fs.fstatSync(fd);
    const there = fs.lstatSync(under(root, rel));
    if (opened.dev === there.dev && opened.ino === there.ino) fs.unlinkSync(under(root, rel));
  } catch {
    // nothing there that is this file
  }
  try {
    return fs.fstatSync(fd).nlink === 0;
  } catch {
    return false;
  }
}

// Opens `rel` under root with these flags and checks it before any byte moves; on a mismatch a
// file the open made is taken away, the fd is closed, and the render is refused. An open that
// fails is refused by the file and the error. A spare is opened for its target `name`, and a
// refusal names the target: a spare that could not be opened is refused as one that could not be
// created beside it, and a spare is named only when it is left on the disk.
function openChecked(root, rel, flags, mode, name = rel) {
  // An exclusive create makes the file itself, so nothing can be there to look at; any other
  // open first asks lstat for a plain file (plainFile), so a pipe, a device, a folder or a link
  // there is refused before it is opened. The fd is held to that file after (inPlace).
  if ((flags & EXCLUSIVE) !== EXCLUSIVE) plainFile(root, rel);
  let fd;
  try {
    fd = fs.openSync(under(root, rel), flags, mode);
  } catch (err) {
    throw name === rel ? failed(rel, "open", err) : spareFailed(name, err);
  }
  if (!inPlace(root, rel, fd)) {
    const gone = flags & fs.constants.O_CREAT ? discard(root, rel, fd) : true;
    fs.closeSync(fd);
    throw moved(name, gone ? [] : [rel]);
  }
  return fd;
}

// Eight hex characters, from one 32-bit part of Math.random.
function hex8() {
  return Math.floor(Math.random() * 0x100000000)
    .toString(16)
    .padStart(8, "0");
}

// A spare for `rel`: a fresh SPARE name in its folder, its 16 hex from two 32-bit parts.
// The spare is opened O_CREAT|O_EXCL, so its name needs to be unique, never secret: a clash refuses the render honestly, and a same-user guess is out of scope under the threat model.
function spareFor(rel) {
  const folder = rel.split("/").slice(0, -1).join("/");
  const name = `.celorus-spare-${hex8()}${hex8()}.tmp`;
  return folder ? `${folder}/${name}` : name;
}

// Removes the leftover spare files in these folders (the sweep set): each entry named exactly
// SPARE that is a plain file by lstat, and not one of this render's own (`own`), in a folder that
// still resolves to its place under the desk. A folder not on the disk holds none. Answers
// { removed, kept, unlisted }, each by its path in the desk, sorted: the spares removed, the
// spares it could not remove, and the folders it could not list (with a trailing /), which are
// never called spares.
function sweep(root, folders, own) {
  const removed = [];
  const kept = [];
  const unlisted = [];
  for (const folder of folders) {
    const at = folder ? under(root, folder) : root;
    let names;
    try {
      if (fs.realpathSync(at) !== at) continue;
      names = fs.readdirSync(at);
    } catch (err) {
      if (err.code !== "ENOENT") unlisted.push(`${folder}/`);
      continue;
    }
    for (const name of names) {
      const rel = folder ? `${folder}/${name}` : name;
      if (!SPARE.test(name) || own.has(rel)) continue;
      try {
        if (!fs.lstatSync(under(root, rel)).isFile()) continue;
        fs.unlinkSync(under(root, rel));
        removed.push(rel);
      } catch (err) {
        if (err.code !== "ENOENT") kept.push(rel);
      }
    }
  }
  return { removed: removed.sort(), kept: kept.sort(), unlisted: unlisted.sort() };
}

const CREATE = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW;

// A plain file's text, opened without following a link, and read from the fd openChecked
// made, after its lstat asked for a plain file. A read that fails is refused by the file and the
// error's code (failed), like an open that fails.
function readPlain(root, rel) {
  const fd = openChecked(root, rel, fs.constants.O_RDONLY | NOFOLLOW);
  try {
    try {
      return fs.readFileSync(fd, "utf8");
    } catch (err) {
      throw failed(rel, "read", err);
    }
  } finally {
    fs.closeSync(fd);
  }
}

// A folder under root made one level at a time, each level a plain folder. Each folder made is
// added to `made` ({rel, ino}), so it can be taken away.
function makeFolder(root, rel, made = []) {
  const parts = rel.split("/");
  for (let i = 1; i <= parts.length; i += 1) {
    const sub = parts.slice(0, i).join("/");
    if (plainFolder(root, sub)) continue;
    try {
      fs.mkdirSync(under(root, sub));
    } catch (err) {
      throw failed(sub, "make the folder", err);
    }
    // made the moment mkdir answers, so a failure at the look after it still takes it away;
    // its ino is null until that look answers
    const entry = { rel: sub, ino: null };
    made.push(entry);
    entry.ino = fs.lstatSync(under(root, sub)).ino;
  }
  return made;
}

// Takes away the folders this render made, last first: only a folder that is still the one it
// made (same ino, or any plain folder when its look after mkdir failed) and is empty, by rmdir,
// never a recursive delete. A folder that was there before the call is never in `made`.
// Answers the ones it made that are still there and empty.
function unmake(root, made) {
  const left = [];
  for (const { rel, ino } of [...made].reverse()) {
    try {
      const there = fs.lstatSync(under(root, rel));
      if (!there.isDirectory() || (ino !== null && there.ino !== ino)) {
        left.push(`${rel}/`);
        continue;
      }
      fs.rmdirSync(under(root, rel));
    } catch (err) {
      // a folder that now holds a file is not empty, and one already gone is gone
      if (err.code !== "ENOTEMPTY" && err.code !== "EEXIST" && err.code !== "ENOENT") left.push(`${rel}/`);
    }
  }
  return left;
}

function closeAll(open) {
  for (const f of open) {
    try {
      fs.closeSync(f.fd);
    } catch {
      // already closed
    }
  }
}

// One render's files as one write. `files` is [{ rel, text, replace }]. Every file is written
// to a spare in its folder (O_CREAT|O_EXCL|O_NOFOLLOW, so nothing already there, a link
// included, is written through), fsynced, and renamed to its path once its folder is looked at
// again: `replace` renames it over the file already there; a new file is renamed only while an
// lstat shows nothing at its path, else it is refused (taken). Every folder is made and every
// spare opened and checked first; then the leftover spare files in the sweep set are removed
// (sweep): the folders of `targets`, every file the caller can create, written this time or not
// (by default the files given). Only then is each written and moved, in the order given. On a
// refusal every spare not yet moved is taken away, and so is every folder made that is left
// empty. Answers { written, removed, kept, unlisted }: the paths written, the leftover spares
// removed and not, and the folders of the sweep set it could not look in. A refusal after a file
// was moved carries those paths as `written`.
function writeAll(root, files, targets = files.map((f) => f.rel)) {
  const made = [];
  const open = [];
  try {
    for (const f of files) {
      makeFolder(root, f.rel.split("/").slice(0, -1).join("/"), made);
      const at = spareFor(f.rel);
      open.push({ ...f, at, fd: openChecked(root, at, CREATE, 0o644, f.rel) });
    }
  } catch (err) {
    const left = [...(err.left || [])];
    for (const f of open) if (!discard(root, f.at, f.fd)) left.push(f.at);
    closeAll(open);
    left.push(...unmake(root, made));
    throw new Refusal(`${why(err)} ${ledger([], left)}`);
  }
  const fresh = new Set(made.map((m) => m.rel));
  const folders = [...new Set(targets.map((rel) => rel.split("/").slice(0, -1).join("/")))].filter(
    (folder) => !fresh.has(folder),
  );
  const swept = sweep(root, folders, new Set(open.map((f) => f.at)));
  const written = [];
  try {
    for (const f of open) {
      try {
        fs.writeFileSync(f.fd, f.text, "utf8");
        fs.fsyncSync(f.fd);
      } catch (err) {
        throw failed(f.rel, "write", err);
      }
      if (!inPlace(root, f.at, f.fd)) throw movedBeforePlaced(f.rel);
      if (!f.replace && look(root, f.rel) !== null) throw taken(f.rel);
      try {
        fs.renameSync(under(root, f.at), under(root, f.rel));
      } catch (err) {
        throw failed(f.rel, "put in place", err);
      }
      written.push(f.rel);
    }
  } catch (err) {
    const left = [];
    for (const f of open.slice(written.length)) if (!discard(root, f.at, f.fd)) left.push(f.at);
    left.push(...unmake(root, made));
    // the paths already placed ride the refusal too, for a caller that must know whether any
    // file was (render/key.js keeps a new key once a file it sealed is on the disk)
    const refused = new Refusal(`${why(err)} ${ledger(written, left, swept)}`);
    refused.written = [...written];
    throw refused;
  } finally {
    closeAll(open);
  }
  return { written, ...swept };
}

// A new file with this text; refused, and nothing written, when anything, a link included, is
// at the path when it would be moved there.
function createFresh(root, rel, text) {
  writeAll(root, [{ rel, text, replace: false }]);
}

// The file's text replaced whole: a fresh file beside it, renamed over it once its folder is
// looked at again.
function replaceWhole(root, rel, text) {
  writeAll(root, [{ rel, text, replace: true }]);
}

module.exports = { look, deskRoot, plainFolder, plainFile, emptyFiles, readPlain, writeAll, createFresh, replaceWhole, makeFolder, spareFor, SPARE };
