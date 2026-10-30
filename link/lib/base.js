"use strict";
// What this desk last read of its seat's storage: the storage's base then, and each page's
// digest as the storage holds it, by its path in the firm folder (seats/<this seat's folder>/...,
// common/...):
//   - a making call on a seat's graph sends the held base as read_base, so a call made over a
//     copy the storage has moved past is not kept (stale_base); with no base held, or a file the
//     link cannot trust, the call is refused and nothing is sent: the desk is pulled first;
//   - a kept answer's base becomes the next base, never a commit, when the call went over a
//     held base (the read that write advanced), and its pages follow what the storage took
//     (kept_paths);
//   - a write the storage stopped part way leaves what is held as it is: the storage has moved
//     past the held base, so the next change fails safe until the desk is pulled, and each page
//     held is still what this desk last read (nothing was written here), so the pull tells a
//     page the person changed from one the storage moved;
//   - a pull, and a seed's kept answer, set it whole;
//   - a seed's batch marks it as a seed's (seeding), and only a seed this desk marked goes on: a
//     pull and a kept change carry the mark while the storage holds no desk.md of this seat
//     (a seed under way), and the seed's last batch, or a pull of a desk, drops it;
//   - a seed's mark holds whether that seed opens the firm's common space (common), decided at
//     its first batch: the common pages its batch 1 carried, each with its SHA-256, while no
//     batch of it is known kept, and "kept" once one is, so a seed that goes on carries the rest
//     of it, and no other seed any of it; it rides with the mark, and goes with it.
// The link's own file, .celorus/link-base.json: 0600 in the seat's 0700 folder, written by the
// link alone, never at a path a server named, never sent, and never written while the desk's
// .gitignore does not keep .celorus/ out of git (the queue's rule). A file that does not read as
// one holds nothing; a link at its place, or on the way to it, refuses the call, as the link
// refuses any link. A held base the storage has moved past fails safe: the door answers
// stale_base, and nothing is kept.

const fs = require("node:fs");
const path = require("node:path");
const { LinkError } = require("./errors.js");
const P = require("./paths.js");
const queue = require("./queue.js");

const FILE = "link-base.json";
const VERSION = 1;
const BASE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u;
const DIGEST = /^[0-9a-f]{64}$/u;

const baseRel = () => `${queue.SEAT}/${FILE}`;
const isBase = (value) => typeof value === "string" && BASE.test(value);
const isDigest = (value) => typeof value === "string" && DIGEST.test(value);

// A seed's mark that it opens the firm's common space, as the link holds it: { sent }, the common
// pages its batch 1 carried (path to SHA-256), before a batch of it is known kept; "kept" after;
// null for anything else.
function opensOf(value) {
  if (value === "kept") return "kept";
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const sent = value.sent;
  if (sent === null || typeof sent !== "object" || Array.isArray(sent)) return null;
  const out = {};
  for (const [rel, digest] of Object.entries(sent)) {
    if (!P.pathOk(rel) || !rel.startsWith("common/") || !isDigest(digest)) return null;
    out[rel] = digest;
  }
  return { sent: out };
}

// Whether a plain file is the link's own as it writes it: this user's, 0600.
const ownFile = (st) => (st.mode & 0o777) === 0o600 && (typeof process.getuid !== "function" || st.uid === process.getuid());

// The held { base, pages, seeding, common }, base null when none is held, seeding true only for a
// base a seed's batch held, common { sent } or "kept" only for a seed's that opens the firm's
// common space (null otherwise);
// null when nothing is held, or the file is not the link's own or does not read: a file the link
// cannot trust holds nothing.
function held(root) {
  let data;
  try {
    const st = P.standing(root, baseRel());
    if (st === "absent" || (st.isFile() && !ownFile(st))) return null;
    data = P.readBytes(root, baseRel());
  } catch (err) {
    // a link, or a folder where the file goes, refuses the call; a file the link cannot look at
    // or open holds nothing
    if (err instanceof LinkError) throw err;
    return null;
  }
  if (data === null || data === P.TOO_BIG) return null;
  let entry;
  try {
    entry = JSON.parse(P.textOf(data));
  } catch {
    return null;
  }
  if (entry === null || typeof entry !== "object" || entry.version !== VERSION) return null;
  if (entry.base !== null && !isBase(entry.base)) return null;
  const pages = entry.pages;
  if (pages === null || typeof pages !== "object" || Array.isArray(pages)) return null;
  const out = {};
  for (const [rel, digest] of Object.entries(pages)) {
    if (!P.pathOk(rel) || !isDigest(digest)) return null;
    out[rel] = digest;
  }
  return { base: entry.base, pages: out, seeding: entry.seeding === true, common: entry.seeding === true ? opensOf(entry.common) : null };
}

// Holds `base` (or null) and `pages` (path to SHA-256) as this desk's, marked as a seed's when
// `seeding`, and as one that opens the firm's common space when `common` too: a fresh file moved
// over the old. Answers false, holding nothing, when the desk's .gitignore does not keep .celorus/
// out of git.
function hold(root, base, pages, { seeding = false, common = null } = {}) {
  if (base !== null && !isBase(base)) throw new TypeError("not a base the storage gives");
  if (!queue.keptOutOfGit(root)) return false;
  const dir = queue.folder(root, queue.SEAT);
  const sorted = {};
  for (const rel of Object.keys(pages).sort()) sorted[rel] = pages[rel];
  const next = path.join(dir, `${FILE}.next`);
  fs.rmSync(next, { force: true });
  const entry = { version: VERSION, base, pages: sorted };
  if (seeding === true) entry.seeding = true;
  const opens = seeding === true ? opensOf(common) : null;
  if (opens !== null) entry.common = opens;
  queue.writeNew(next, JSON.stringify(entry));
  fs.renameSync(next, path.join(dir, FILE));
  return true;
}

// Nothing held: what this desk holds can no longer be kept as it should be.
function clear(root) {
  const st = P.standing(root, baseRel());
  if (st !== "absent") fs.rmSync(path.join(root, baseRel()), { force: true });
}

// After a kept answer: its base, when the call went over a held one, and the held pages as the
// storage took them, still marked as a seed's when they were and the change kept no desk.md of
// this seat. A kept answer that changed nothing (no base) leaves what is held as it is; one made
// over no held base, or whose base this link does not read, holds the pages it took, and no base.
function afterKept(root, before, kept, keptPaths) {
  if (!kept || typeof kept !== "object") return false;
  if (kept.base === null && kept.changes === 0) return false;
  const pages = { ...(before ? before.pages : {}) };
  const paths = keptPaths && typeof keptPaths === "object" ? keptPaths : {};
  for (const one of Array.isArray(paths.written) ? paths.written : []) {
    if (one && P.pathOk(one.path) && isDigest(one.sha256)) pages[one.path] = one.sha256;
  }
  for (const rel of Array.isArray(paths.removed) ? paths.removed : []) {
    if (typeof rel === "string") delete pages[rel];
  }
  const next = before && isBase(before.base) && isBase(kept.base) ? kept.base : null;
  const desk = /^seats\/[0-9]{1,12}\/celorus\/desk\.md$/u;
  const seeding = Boolean(before && before.seeding) && next !== null && !Object.keys(pages).some((rel) => desk.test(rel));
  if (hold(root, next, pages, { seeding, common: before ? before.common : null })) return next !== null;
  clear(root);
  return false;
}

module.exports = { FILE, afterKept, baseRel, clear, hold, held, isBase, isDigest };
