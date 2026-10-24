"use strict";
// The desk server's pages, written to the desk: all or nothing.
//
// Before any change, every check: the answer's shape and each path in it; each page against its
// sha256; each page that was sent still holding, on the laptop, the bytes that were sent (a page
// changed by hand meanwhile is never overwritten, and is named); each page that was not sent
// absent from the laptop (a page the call never saw is never overwritten); and no path crossing
// a link, by the engine's own linked-root rule and by looking at every folder on every path.
// Then, in the answer's order: each folder made, each page written (to a new file beside it,
// then renamed into place), each removed path deleted, each removed folder removed (only when
// empty: a folder still holding a page the server never saw is kept, and said).
//
// On a seat's graph the answer names paths in the firm folder: each is written in the seat's own
// desk (seats/<its folder>/) or in the firm's common space (common/), and every other path, another
// seat's graph among them, refuses the whole answer, as a place the engine never writes does.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { refuseLinkedRoot, refuseLinkedFolders } = require("../../engine/lib/linkedroot.js");
const { LinkError } = require("./errors.js");
const P = require("./paths.js");

const NOTHING = "Nothing was written.";
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/u;

function malformed(what) {
  return new LinkError("answer", `The desk server's answer was not one the link can write (${what}). ${NOTHING}`);
}

function pathList(value, what) {
  if (!Array.isArray(value)) throw malformed(what);
  for (const rel of value) if (!P.pathOk(rel)) throw malformed(`a path in ${what}`);
  return value;
}

// The pages of the answer, each { rel, data }, checked against its digest.
function pagesOf(files) {
  if (!Array.isArray(files)) throw malformed("files");
  return files.map((page) => {
    if (page === null || typeof page !== "object") throw malformed("a file");
    const { path: rel, sha256, encoding, content } = page;
    if (!P.pathOk(rel)) throw malformed("a file's path");
    if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(sha256) || typeof content !== "string") throw malformed("a file");
    let data;
    if (encoding === "utf-8") data = Buffer.from(content, "utf8");
    else if (encoding === "base64" && BASE64.test(content) && content.length % 4 === 0) data = Buffer.from(content, "base64");
    else throw malformed("a file's encoding");
    const digest = crypto.createHash("sha256").update(data).digest("hex");
    if (digest !== sha256) {
      throw new LinkError("digest", `${rel} came back from the desk server different from its digest. ${NOTHING}`);
    }
    return { rel, data };
  });
}

function notHere(rel) {
  return new LinkError(
    "not_here",
    `The desk server's answer would change ${rel}, a place the desk's own tools never write, so none of it was written. ${NOTHING}`,
  );
}

function changedSince(rel) {
  return new LinkError(
    "changed",
    `${rel} changed on this computer after it was sent to the desk server, so it was not overwritten. ${NOTHING} Make the change again.`,
  );
}

function notSent(rel) {
  return new LinkError(
    "not_sent",
    `${rel} is on this computer but was not sent to the desk server, so it was not overwritten. ${NOTHING}`,
  );
}

// Every check on a path the answer writes or removes (`rel` in its place's folder, `named` in the
// call): nothing on its way is a link, and it holds what was sent (or is absent when it was not
// sent).
function checkPage(root, sent, named, rel, { removing }) {
  const st = P.standing(root, rel);
  const was = Object.hasOwn(sent, named) ? Buffer.from(sent[named], "utf8") : null;
  if (st === "absent") {
    if (was !== null || removing) throw changedSince(named);
    return;
  }
  if (!st.isFile()) throw P.linkInside(named);
  if (was === null) throw notSent(named);
  const now = P.readBytes(root, rel, Number.MAX_SAFE_INTEGER);
  if (now === null || !Buffer.isBuffer(now) || !now.equals(was)) throw changedSince(named);
}

// Where each kind of place lets an answer write (lib/paths.js).
const WRITABLE = Object.freeze({ desk: P.writable, graph: P.graphWritable, common: P.commonWritable });

// The place a path in the answer is in, and its path in that place's folder; null for a path in
// none (on a seat's graph: outside the seat's own folder and the firm's common space).
function placed(places, named) {
  for (const place of places) {
    if (named.startsWith(place.prefix) && named.length > place.prefix.length) return { place, rel: named.slice(place.prefix.length) };
  }
  return null;
}

function keepsSeat() {
  return new LinkError("gitignore", `The answer would stop the desk's .gitignore keeping .celorus/ out of git. ${NOTHING}`);
}

function checkFolder(root, rel) {
  const st = P.standing(root, rel);
  if (st !== "absent" && !st.isDirectory()) throw P.linkInside(rel);
}

// A page written to a new file beside it, never through a link, then renamed into place. It keeps
// the mode of the file it replaces, less any right to run it: no page the engine writes is a
// program.
function writePage(root, rel, data) {
  const target = path.join(root, rel);
  const before = P.standing(root, rel);
  const mode = before !== "absent" && before.isFile() ? before.mode & 0o666 : 0o644;
  const spare = path.join(path.dirname(target), `.${path.basename(target)}.celorus-link-${crypto.randomBytes(6).toString("hex")}`);
  const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
  const fd = fs.openSync(spare, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, mode);
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    P.standing(root, rel); // once more, just before: still no link on the way
    fs.renameSync(spare, target);
  } catch (err) {
    fs.rmSync(spare, { force: true });
    throw err;
  }
}

// Writes the answer `made` (desk_make's proceed answer) where its paths are on this computer,
// `sent` being the pages sent. `places` are the call's places (lib/workingset.js placesOf): one
// for a desk, the seat's desk and the firm's common space for a seat's graph; a desk's folder
// alone stands for its one place. Answers { written, removed, folders, left }, each path as the
// answer names it.
function applyAnswer(places, sent, made) {
  const at = typeof places === "string" ? [{ prefix: "", root: places, kind: "desk" }] : places;
  const pages = pagesOf(made.files);
  const removed = pathList(made.removed, "removed");
  const folders = pathList(made.folders, "folders");
  const gone = pathList(made.removed_folders, "removed_folders");
  const touched = [...pages.map((p) => p.rel), ...removed];
  if (new Set(touched).size !== touched.length) throw malformed("a path written twice");
  const where = new Map();
  const locate = (named, folder) => {
    const found = placed(at, named);
    if (found === null || !WRITABLE[found.place.kind](found.rel, { folder })) throw notHere(named);
    where.set(named, found);
    return found;
  };
  for (const named of touched) locate(named, false);
  for (const named of [...folders, ...gone]) locate(named, true);

  // The checks, all of them, before the first change.
  for (const place of at) {
    const mine = [...where].filter(([, found]) => found.place === place).map(([, found]) => found.rel);
    if (!mine.length) continue;
    if (place.kind === "common") {
      const st = P.lstatOrNull(place.root);
      if (st === null || st.isSymbolicLink() || !st.isDirectory()) throw P.linkInside(place.prefix);
      continue;
    }
    refuseLinkedRoot(place.root);
    const under = mine.filter((rel) => rel.startsWith("celorus/")).map((rel) => rel.slice("celorus/".length));
    if (under.length) refuseLinkedFolders(path.join(place.root, "celorus"), under);
  }
  const rootOf = (named) => where.get(named).place.root;
  const relOf = (named) => where.get(named).rel;
  for (const named of [...folders, ...gone]) checkFolder(rootOf(named), relOf(named));
  for (const { rel: named } of pages) checkPage(rootOf(named), sent, named, relOf(named), { removing: false });
  for (const named of removed) {
    if (!Object.hasOwn(sent, named)) throw malformed("a removed path that was not sent");
    checkPage(rootOf(named), sent, named, relOf(named), { removing: true });
  }
  // L6: the desk's .gitignore, which keeps .celorus/ (the seat's key, its holds, the link's queue)
  // out of git, is never removed. An answer that writes it holds the lines it held first and in
  // their order (git takes the last line that matches), then only lines with no `!`: the engine
  // only ever adds the lines it lacks after the ones there (update/update.js), and reads them as
  // engineLines does. A new one holds no `!` line. And one git read as keeping .celorus/ out still
  // does. This holds whether or not the link can tell the file keeps .celorus/ out.
  const gitignore = `${at[0].prefix}.gitignore`;
  if (removed.includes(gitignore)) throw keepsSeat();
  const ignore = pages.find((p) => p.rel === gitignore);
  if (ignore) {
    const was = Object.hasOwn(sent, gitignore) ? sent[gitignore] : null;
    const before = was === null ? [] : P.engineLines(was);
    const after = P.engineLines(P.textOf(ignore.data));
    if (
      after === null ||
      before.some((line, i) => after[i] !== line) ||
      after.slice(before.length).some((line) => line.startsWith("!")) ||
      (P.ignoresSeat(was) && !P.ignoresSeat(P.textOf(ignore.data)))
    ) {
      throw keepsSeat();
    }
  }

  // The changes, in the answer's order.
  const madeFolders = [];
  for (const named of folders) {
    const [root, rel] = [rootOf(named), relOf(named)];
    const st = P.standing(root, rel);
    if (st === "absent") {
      fs.mkdirSync(path.join(root, rel));
      madeFolders.push(named);
    }
    checkFolder(root, rel);
  }
  for (const { rel: named, data } of pages) writePage(rootOf(named), relOf(named), data);
  for (const named of removed) {
    const [root, rel] = [rootOf(named), relOf(named)];
    const st = P.standing(root, rel);
    if (st !== "absent") {
      if (!st.isFile()) throw P.linkInside(named);
      fs.unlinkSync(path.join(root, rel));
    }
  }
  const left = [];
  for (const named of gone) {
    const [root, rel] = [rootOf(named), relOf(named)];
    const st = P.standing(root, rel);
    if (st === "absent") continue;
    try {
      fs.rmdirSync(path.join(root, rel));
    } catch (err) {
      if (err.code === "ENOTEMPTY" || err.code === "EEXIST") left.push(named);
      else throw err;
    }
  }
  return { written: pages.length, removed: removed.length, folders: madeFolders.length, left };
}

module.exports = { applyAnswer, writePage };
