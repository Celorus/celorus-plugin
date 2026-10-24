"use strict";
// The link's offline queue: a write made while the desk server could not be reached, kept in the
// desk's .celorus/link-queue/ and made at the next making call, in the order it came. Each
// entry is one call, the tool and its arguments only (never pages, never the token), in a file
// of its own (000001.json, 000002.json, ...), 0600 in a 0700 folder, never written through a
// link.
//
// .celorus/ is the seat's own folder: never sent (lib/workingset.js), and kept out of the
// desk's git by the desk's .gitignore. A desk whose .gitignore does not keep it out gets no
// queue: the write is refused instead, and the answer says why.
//
// Only a call that reached nothing is queued. An answer the server gave (refused, payment
// required, or one this link does not know) is never queued, so nothing is replayed without
// end. A queued call the server, or the desk, refuses when it is made is set aside in
// link-queue/refused/, with its reason, and never sent again nor removed by the link: the
// person reads it and removes it.
//
// Each entry says whether the storage may have kept it (`sent`): "never", the call never
// left this computer; "answered", the server answered that it kept nothing; "maybe", the
// call may have reached the server and its answer been lost. An entry that does not say is
// "maybe", and once "maybe" an entry stays so. A "maybe" entry met by a storage that has
// moved since its pages were read is set aside, never made again (it may be made twice).
// A "maybe" entry holds the base it was sent over (`read_base`, or none): once the desk is read
// at another base, it is set aside unsent, as the read may hold it already.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { LinkError } = require("./errors.js");
const P = require("./paths.js");

const SEAT = ".celorus";
const QUEUE = "link-queue";
const REFUSED = "refused";
const ENTRY = /^[0-9]{6}\.json$/u;
const MAX_WAITING = 100;
const sentOf = (value) => (value === "never" || value === "answered" ? value : "maybe");
const baseOf = (value) => (typeof value === "string" ? value : null);

function queueRel() {
  return `${SEAT}/${QUEUE}`;
}

// The desk's .gitignore's text, or null.
function gitignoreText(root) {
  const st = P.standing(root, ".gitignore");
  if (st === "absent" || !st.isFile()) return null;
  return P.textOf(fs.readFileSync(path.join(root, ".gitignore")));
}

// Whether the desk's .gitignore keeps .celorus/ out of git.
function keptOutOfGit(root) {
  return P.ignoresSeat(gitignoreText(root));
}

// Why a queue is refused when the .gitignore does not keep .celorus/ out: its line is missing,
// or a `!` line could let the folder back in.
function notIgnored(root) {
  const lines = P.ignoreLines(gitignoreText(root)) || [];
  const why = lines.some(P.backIn)
    ? "has a line starting with ! (with a wildcard, an escape, or .celorus in it) that could let .celorus/ back into git, so a queued change could reach the desk's git. Take that line out of the desk's .gitignore,"
    : "has no .celorus/ line, so a queued change could reach the desk's git. Add the line .celorus/ to the desk's .gitignore,";
  return new LinkError("queue_not_ignored", `The desk server could not be reached, and the change was not queued: the desk's .gitignore ${why} or make the change when you are online. Nothing was written.`);
}

// A folder of the seat's own, made 0700 where it is not there; a link refuses.
function folder(root, rel) {
  const st = P.standing(root, rel);
  if (st === "absent") {
    fs.mkdirSync(path.join(root, rel), { mode: 0o700 });
    fs.chmodSync(path.join(root, rel), 0o700);
  } else if (!st.isDirectory()) {
    throw P.linkInside(rel);
  }
  return path.join(root, rel);
}

// The queued calls waiting, by file name, in order.
function waiting(root) {
  const st = P.standing(root, queueRel());
  if (st === "absent") return [];
  if (!st.isDirectory()) throw P.linkInside(queueRel());
  return fs.readdirSync(path.join(root, queueRel())).filter((name) => ENTRY.test(name)).sort();
}

function writeNew(file, text) {
  const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
  const fd = fs.openSync(file, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
  try {
    fs.fchmodSync(fd, 0o600);
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// Queues one call, marked with whether the storage may have kept it, and the base it was sent
// over. Answers how many calls now wait.
function add(root, tool, args, nowSeconds, sent = "maybe", readBase = null) {
  if (!keptOutOfGit(root)) throw notIgnored(root);
  folder(root, SEAT);
  const dir = folder(root, queueRel());
  const names = waiting(root);
  if (names.length >= MAX_WAITING) {
    throw new LinkError("queue_full", `The desk server could not be reached, and ${MAX_WAITING} changes already wait, so this one was not queued. Nothing was written.`);
  }
  const taken = new Set([...names, ...listRefused(root)]);
  let next = names.length ? Number(names[names.length - 1].slice(0, 6)) + 1 : 1;
  while (taken.has(`${String(next).padStart(6, "0")}.json`)) next += 1;
  const name = `${String(next).padStart(6, "0")}.json`;
  const entry = { tool, arguments: args, queued_at: new Date(nowSeconds * 1000).toISOString(), sent: sentOf(sent), read_base: baseOf(readBase) };
  writeNew(path.join(dir, name), JSON.stringify(entry));
  return names.length + 1;
}

function listRefused(root) {
  const rel = `${queueRel()}/${REFUSED}`;
  const st = P.standing(root, rel);
  if (st === "absent" || !st.isDirectory()) return [];
  return fs.readdirSync(path.join(root, rel));
}

// One queued call, { tool, arguments, sent, read_base }, or null when the file is not one.
function read(root, name) {
  const data = P.readBytes(root, `${queueRel()}/${name}`);
  if (data === null || data === P.TOO_BIG) return null;
  let entry;
  try {
    entry = JSON.parse(P.textOf(data));
  } catch {
    return null;
  }
  const ok =
    entry !== null &&
    typeof entry === "object" &&
    typeof entry.tool === "string" &&
    entry.arguments !== null &&
    typeof entry.arguments === "object" &&
    !Array.isArray(entry.arguments);
  return ok ? { tool: entry.tool, arguments: entry.arguments, sent: sentOf(entry.sent), read_base: baseOf(entry.read_base) } : null;
}

// The entry at `rel` as an object, or null when it does not read as one.
function entryAt(root, rel) {
  const data = P.readBytes(root, rel);
  try {
    const entry = data === null || data === P.TOO_BIG ? null : JSON.parse(P.textOf(data));
    return entry !== null && typeof entry === "object" && !Array.isArray(entry) ? entry : null;
  } catch {
    return null;
  }
}

// `entry` written at `file`, a fresh file moved over the old.
function rewrite(file, entry) {
  const next = `${file}.next`;
  fs.rmSync(next, { force: true });
  writeNew(next, JSON.stringify(entry));
  fs.renameSync(next, file);
}

// A queued call whose answer was lost once more after it was sent over `readBase`: it may have
// been kept.
function mayBeKept(root, name, readBase = null) {
  const rel = `${queueRel()}/${name}`;
  const entry = entryAt(root, rel);
  if (entry === null || entry.sent === "maybe") return;
  rewrite(path.join(root, rel), { ...entry, sent: "maybe", read_base: baseOf(readBase) });
}

// A queued call stopped once more by a failure that may be its own: the count is kept in its file
// (a fresh file moved over it), and answered. A file that cannot be read back counts as stopped
// for good.
function stopped(root, name) {
  const rel = `${queueRel()}/${name}`;
  const entry = entryAt(root, rel);
  if (entry === null) return Infinity;
  entry.stopped = (Number.isInteger(entry.stopped) && entry.stopped > 0 ? entry.stopped : 0) + 1;
  rewrite(path.join(root, rel), entry);
  return entry.stopped;
}

// A queued call made: its file goes.
function done(root, name) {
  fs.rmSync(path.join(root, queueRel(), name), { force: true });
}

// A queued call refused: its file is set aside in refused/, never sent again, and then the reason
// and the time it was set aside are written in it (a file that does not read stays as it is).
// The move comes first, so the call is out of the queue before anything else is written.
function setAside(root, name, reason, nowSeconds) {
  const dir = folder(root, `${queueRel()}/${REFUSED}`);
  let target = path.join(dir, name);
  if (P.lstatOrNull(target) !== null) target = path.join(dir, `${name.slice(0, 6)}-${crypto.randomBytes(3).toString("hex")}.json`);
  fs.renameSync(path.join(root, queueRel(), name), target);
  if (typeof reason !== "string") return;
  const entry = entryAt(root, path.relative(root, target).split(path.sep).join("/"));
  if (entry === null) return;
  const at = Number.isFinite(nowSeconds) ? new Date(nowSeconds * 1000).toISOString() : undefined;
  rewrite(target, { ...entry, set_aside: { reason: reason.slice(0, 600), at } });
}

// How many queued calls are set aside in refused/.
function setAsideCount(root) {
  return listRefused(root).filter((name) => name.endsWith(".json")).length;
}

module.exports = { MAX_WAITING, REFUSED, SEAT, add, done, folder, keptOutOfGit, mayBeKept, queueRel, read, setAside, setAsideCount, stopped, waiting, writeNew };
