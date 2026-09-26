"use strict";
// The linked root: the one refusal every desk tool that writes gives, before its first change,
// when the desk's `celorus/` folder, `celorus/views/` or `celorus/log.md` is a link (to a folder
// inside the desk or outside it, to a file, or to nothing), or when `celorus/views/` is there and
// is not a folder. A tool writes a page only as a real file inside the desk folder, never through
// a link: what a link leads to may be outside the desk, and outside its history. The same words
// refuse a call whose plan changes a page under any other folder inside celorus/ that is a link
// (refuseLinkedFolders).
//
// Each is looked at with lstat, so no link is followed to look. The desk folder itself is not
// looked at: a link above the desk is how the person named it, and is resolved as today. The
// readers follow a live link as they always have (lib/desk.js); only the writers refuse one.
//
// The check writes nothing, and names each place by its path under the desk, never by an
// absolute path.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("./refusal.js");

const NOTHING = "Nothing was changed.";

// The three places, in the order they are looked at, and what a plain one is.
const PLACES = [
  ["celorus/", "folder"],
  ["celorus/views/", "folder"],
  ["celorus/log.md", "file"],
];

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch {
    // Not there, or not to be looked at: the writer meets that itself, as it does today.
    return null;
  }
}

// What the link at `file` leads to, in words: a folder, a file, nothing, or back to itself.
function linkKind(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch (err) {
    return err && err.code === "ELOOP" ? "a link that leads back to itself" : "a link that points nowhere";
  }
  if (st.isDirectory()) return "a link to a folder";
  if (st.isFile()) return "a link to a file";
  return "a link to something that is neither a file nor a folder";
}

// The sentence for place `rel` when it is `kind`, a link; with `page`, the page the call would
// change under it.
function linkedSaid(rel, kind, page = null) {
  const noun = rel.endsWith("/") ? "folder" : "file";
  const under = page === null ? "" : `, and this call would change ${page} under it`;
  return (
    `${rel} is ${kind}${under}: a desk tool writes a page only as a real file inside the desk folder, never ` +
    "through a link, since what a link leads to may be outside the desk, so it wrote nothing. Put a " +
    `plain ${noun} in its place, then ask again.`
  );
}

// The sentence for `celorus/views/` when it is there and is `kind`, not a folder.
function notFolderSaid(kind) {
  return (
    `celorus/views/ is ${kind}, not a folder: a desk tool writes the views only into a plain folder ` +
    "inside the desk folder, so it wrote nothing. Make celorus/views/ a plain folder, then ask again."
  );
}

// The words for what `celorus/` is when it is a link that makes no desk (to a file, or to
// nothing), or null: lib/desk.js's resolveDesk refuses such a desk in these words, for the
// readers and the writers alike, never as "no desk" by an absolute path.
function brokenRoot(desk) {
  const file = path.join(desk, "celorus");
  const st = lstatOrNull(file);
  if (st === null || !st.isSymbolicLink()) return null;
  const kind = linkKind(file);
  return kind === "a link to a folder" ? null : linkedSaid("celorus/", kind);
}

// Why a tool may not write on the desk at `desk` (the desk folder), in one sentence, or null
// when it may.
function rootFault(desk) {
  for (const [rel] of PLACES) {
    const file = path.join(desk, ...rel.split("/").filter(Boolean));
    const st = lstatOrNull(file);
    if (st === null) {
      if (rel === "celorus/") return null;
      continue;
    }
    if (st.isSymbolicLink()) return linkedSaid(rel, linkKind(file));
    if (rel === "celorus/" && !st.isDirectory()) return null;
    if (rel === "celorus/views/" && !st.isDirectory()) {
      return notFolderSaid(st.isFile() ? "a plain file" : "neither a plain file nor a folder");
    }
  }
  return null;
}

// Refuses, before any write, a desk whose celorus/, celorus/views/ or celorus/log.md is a link,
// or whose celorus/views/ is not a folder.
function refuseLinkedRoot(desk) {
  const fault = rootFault(desk);
  if (fault !== null) throw new Refusal(`${fault} ${NOTHING}`);
}

// The first folder on the way to `rel`, a page's path under the desk's celorus/ folder `celorus`
// (forward slashes), that is a link: its path under celorus/ with a slash after it, or null. Each
// folder is looked at with lstat, so no link is followed to look; a folder not there ends the
// look, since the call makes it, and nothing below it is a link yet.
function linkOnWay(celorus, rel) {
  const parts = rel.split("/").filter(Boolean).slice(0, -1);
  for (let i = 1; i <= parts.length; i += 1) {
    const st = lstatOrNull(path.join(celorus, ...parts.slice(0, i)));
    if (st === null) return null;
    if (st.isSymbolicLink()) return `${parts.slice(0, i).join("/")}/`;
  }
  return null;
}

// Refuses, before any write, a call whose plan writes, makes or removes a page under a folder
// inside celorus/ that is a link (the base's ruling R64, the linked root's rule applied to the
// folder above the page). `celorus` is the desk's celorus/ folder, resolved; `rels` are the pages
// of the plan, by path under it. The readers follow such a link and read the pages under it, so a
// call whose plan changes none of them goes on, with every page read. The words are the linked
// root's, naming the folder and the page by their paths under the desk.
function refuseLinkedFolders(celorus, rels) {
  for (const rel of rels) {
    const folder = linkOnWay(celorus, rel);
    if (folder === null) continue;
    const kind = linkKind(path.join(celorus, ...folder.split("/").filter(Boolean)));
    throw new Refusal(`${linkedSaid(`celorus/${folder}`, kind, `celorus/${rel}`)} ${NOTHING}`);
  }
}

module.exports = {
  rootFault,
  refuseLinkedRoot,
  refuseLinkedFolders,
  brokenRoot,
  linkedSaid,
  notFolderSaid,
  linkKind,
  NOTHING,
};
