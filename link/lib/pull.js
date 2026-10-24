"use strict";
// The link's pull: a seat's graph brought to what its storage holds now (the desk server's
// desk_pull, a fresh read of the seat's own folder and the firm's common space, at one base).
//
// The rules it keeps:
//   - a seat's graph only (layout 3), in a folder named as the storage names the seat
//     (seats/<seat>/), on a desk whose .gitignore keeps .celorus/ out of git, as the base it
//     reads is held there (lib/base.js);
//   - every page answered is checked before the first is written: its digest, its place (the
//     seat's own folder or the firm's common space, nowhere else), and its name: only where an
//     answer may write (lib/paths.js), and no name starting with a dot but a page in
//     celorus/.views/. A page the link never writes is passed over and named;
//   - a page the person changed on this computer since the desk last read its storage is never
//     overwritten nor removed: the whole pull is refused, naming each page and the way through,
//     and nothing is written. A page the storage no longer holds is removed only when it is as
//     the desk last read it; a page only this computer holds is left as it is. A page is found
//     as this computer's disk finds its name, as a disk may hold two names that differ only in
//     letters' case or form as one file; and an answer naming two such pages is refused;
//   - then each page is written, each removed, and the storage's base held with each page's
//     digest, so the next change made through the link is made over this read; a queued change
//     whose answer was lost, sent over another read, is set aside (lib/make.js).

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { refuseLinkedRoot } = require("../../engine/lib/linkedroot.js");
const { writePage } = require("./apply.js");
const base = require("./base.js");
const { LinkError } = require("./errors.js");
const M = require("./make.js");
const P = require("./paths.js");
const queue = require("./queue.js");
const { placesOf } = require("./workingset.js");

const NOTHING = "Nothing was written.";
const SEAT_FOLDER = /^seats\/[0-9]{1,12}\/$/u;
const NAMED = 20;
const VIEWS = "celorus/.views";

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const digestOf = (data) => (data === P.TOO_BIG ? "too big" : sha(data));
// The file a name finds on this computer's disk, whatever the name it was found by.
const fileOf = (st) => `${st.dev}:${st.ino}`;
// Two names a disk may hold as one file: the engine's fold, then a full case fold (ς and σ, ß and
// ss) and compatibility forms. Only ever a refusal, so wider than a disk is safe.
const twinKey = (named) => P.fold(named).toUpperCase().toLowerCase().normalize("NFKC");
const twins = (one, two) => M.refused(`The storage holds two pages whose names differ only in capital letters or in how a letter is written, which one folder on this computer may hold as one page: ${M.say(one, 300)} and ${M.say(two, 300)}. Rename one of them in the storage, then pull again. ${NOTHING}`);
const pageAndFolder = (page, inside) => M.refused(`The storage holds a page named as the folder of another page, alike or but for capital letters or how a letter is written, which one folder on this computer cannot hold as both: the page ${M.say(page, 300)} and the folder of ${M.say(inside, 300)}. Rename one of them in the storage, then pull again. ${NOTHING}`);
// Each folder on the way to a page's name, as its full name: seats/7/celorus/notes/a.md is in
// seats, seats/7, seats/7/celorus and seats/7/celorus/notes.
const foldersOf = (named) => named.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"));
const malformed = () => new LinkError("answer", `The desk server's answer to the pull does not read as one. ${NOTHING}`);

// Where a pulled page may be written in its place: where an answer may write, and no name
// starting with a dot but a page in celorus/.views/ (never .gitignore nor a tool's settings).
function takes(place, rel, { folder = false } = {}) {
  const writable = place.kind === "common" ? P.commonWritable : P.writable;
  if (!writable(rel, { folder })) return false;
  const parts = rel.split("/");
  return parts.every((part, i) => {
    if (!P.fold(part).startsWith(".")) return true;
    return i === 1 && P.fold(parts.slice(0, 2).join("/")) === VIEWS && (folder ? parts.length === 2 : parts.length === 3);
  });
}

// The firm's common space as a place, made when the storage holds pages there and the seat's
// folder sits in a firm's seats/ folder.
function commonPlace(root, places) {
  const found = places.find((place) => place.kind === "common");
  if (found) return found;
  const seats = path.dirname(root);
  if (path.basename(seats) !== "seats") return null;
  const common = path.join(path.dirname(seats), "common");
  const st = P.lstatOrNull(common);
  if (st !== null) throw P.linkInside("common/");
  fs.mkdirSync(common);
  return { prefix: "common/", root: common, kind: "common" };
}

// The pages the answer names, each checked: { named, sha, data }. Throws on one that does not
// read; answers the ones passed over beside them.
function answered(got) {
  if (!Array.isArray(got.files) || got.files.length > P.CAPS.files) throw malformed();
  const pages = [];
  const seen = new Set();
  for (const page of got.files) {
    if (page === null || typeof page !== "object" || typeof page.path !== "string" || page.encoding !== "utf-8" || typeof page.content !== "string") throw malformed();
    if (seen.has(page.path)) throw malformed();
    seen.add(page.path);
    const data = Buffer.from(page.content, "utf8");
    if (page.sha256 !== sha(data)) throw malformed();
    pages.push({ named: page.path, sha: page.sha256, data });
  }
  const skipped = Array.isArray(got.skipped) ? got.skipped.filter((p) => typeof p === "string") : [];
  return { pages, skipped };
}

// The pages this computer holds where a pull writes: each by its path in the call, its digest
// ("too big" for one over the cap, which no answer matches) and its file.
function onThisComputer(places) {
  const out = [];
  const visit = (place, folder) => {
    const at = folder === "" ? place.root : path.join(place.root, folder);
    for (const name of fs.readdirSync(at).sort()) {
      const rel = folder === "" ? name : `${folder}/${name}`;
      const st = fs.lstatSync(path.join(place.root, rel));
      if (st.isSymbolicLink()) throw P.linkInside(place.prefix + rel);
      if (st.isDirectory()) {
        if (takes(place, rel, { folder: true })) visit(place, rel);
        continue;
      }
      if (!st.isFile() || !takes(place, rel)) continue;
      const data = P.readBytes(place.root, rel);
      if (data !== null) out.push({ named: place.prefix + rel, sha: digestOf(data), file: fileOf(st) });
    }
  };
  for (const place of places) {
    if (place.kind === "common") visit(place, "");
    else if (P.standing(place.root, "celorus") !== "absent") visit(place, "celorus");
  }
  return out;
}

// The page this computer holds where a pulled page is written, as its disk finds the name:
// { sha, file }, or null where none is.
function pageAt(place, rel) {
  const st = P.standing(place.root, rel);
  if (st === "absent" || !st.isFile()) return null;
  const data = P.readBytes(place.root, rel);
  return data === null ? null : { sha: digestOf(data), file: fileOf(st) };
}

// The file this computer's disk finds at `rel` in `place`, as for pageAt, read never: null where
// none is, or where the way to it cannot be looked at (a name the pull never writes may sit
// where the link never looks, as in a folder starting with a dot).
function fileFound(place, rel) {
  try {
    const st = P.standing(place.root, rel);
    return st !== "absent" && st.isFile() ? fileOf(st) : null;
  } catch {
    return null;
  }
}

function placed(places, named) {
  for (const place of places) {
    if (named.startsWith(place.prefix) && named.length > place.prefix.length) return { place, rel: named.slice(place.prefix.length) };
  }
  return null;
}

// Each folder on the way to `rel` in `place`, made where it is not there; a link, or a file where
// a folder goes, refuses.
function folderFor(place, rel) {
  const parts = rel.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i += 1) {
    const dir = parts.slice(0, i).join("/");
    const st = P.standing(place.root, dir);
    if (st === "absent") fs.mkdirSync(path.join(place.root, dir));
    else if (!st.isDirectory()) throw new LinkError("not_folder", `${M.say(place.prefix + dir, 300)} in the desk is not a folder, and a page the storage holds goes in it. Move it out of the desk folder, then pull again. ${NOTHING}`);
  }
}

const listed = (paths) => {
  const shown = paths.slice(0, NAMED).map((p) => M.say(p, 300));
  return `${shown.join(", ")}${paths.length > NAMED ? `, and ${paths.length - NAMED} more` : ""}`;
};

// Why a page here stops the pull, each in words true of it: the storage holds it as this desk last
// read it, and only this computer changed it; both changed it; the storage no longer holds it; or
// this desk never read it from the storage, and the storage holds it otherwise.
const CHANGED = {
  here: "changed on this computer since the desk last read its storage, which still holds them as read",
  both: "changed on this computer, and changed in the storage too, since the desk last read it",
  gone: "changed on this computer since the desk last read its storage, which no longer holds them",
  unread: "differ from the storage's and were never read from the storage here",
};

const changedHow = (held, theirs) => (held === undefined ? "unread" : held === theirs ? "here" : "both");

function changedHereAnswer(changedHere) {
  const named = changedHere.map((page) => page.named).sort();
  const cases = Object.keys(CHANGED)
    .map((how) => [how, changedHere.filter((page) => page.how === how).map((page) => page.named).sort()])
    .filter(([, pages]) => pages.length)
    .map(([how, pages]) => `${pages.length} page(s) ${CHANGED[how]}: ${listed(pages)}.`);
  return M.answer(
    `The desk was not pulled, as the pull never writes over a page this computer holds otherwise than the storage: ${cases.join(" ")} ${NOTHING} To pull, copy each of those pages out of the desk folder and delete it here, pull again, then put your change back: into the page the pull brought, or, for a page the storage no longer holds, as the page again.`,
    { state: "not_pulled", reason: "changed_here", pages: named.slice(0, 50).map((p) => M.say(p, 300)) },
    true,
  );
}

function notPulled(got) {
  if (got.state === "not_pulled") {
    const words = M.say(got.message) || "The desk server did not read the storage.";
    return M.answer(`${words} ${NOTHING}`, { state: "not_pulled", reason: M.say(got.reason, 60) }, true);
  }
  return M.answer(
    `The desk server answered in a way this link does not know (${M.say(got.state, 60)}). ${NOTHING} The plugin may need an update.`,
    { state: "unknown", server_state: M.say(got.state, 60) },
    true,
  );
}

async function pullAt(root, d) {
  const { contract, places: found } = placesOf(root);
  if (contract !== 2) {
    throw M.refused(`The pull is for a seat's graph (a desk of layout 3, in its firm's seats/ folder), and this desk is not one. ${NOTHING}`);
  }
  if (!queue.keptOutOfGit(root)) {
    throw M.refused(`The desk's .gitignore does not keep .celorus/ out of git, where the link holds what it pulled. Add the line .celorus/ to the desk's .gitignore, then pull again. ${NOTHING}`);
  }
  const got = await M.served("desk_pull", {}, d);
  if (got.state !== "pulled") return notPulled(got);
  if (!base.isBase(got.base) || typeof got.seat_folder !== "string" || !SEAT_FOLDER.test(got.seat_folder)) throw malformed();
  const own = found[0];
  if (own.prefix !== got.seat_folder) {
    throw M.refused(`This seat's folder on this computer is ${own.prefix}, and its storage holds it as ${got.seat_folder}: the folder is named by the seat's number. ${NOTHING}`);
  }
  const { pages, skipped } = answered(got);
  const passedOver = skipped.slice(0, P.CAPS.files);
  const places = [...found];
  if (pages.some((page) => page.named.startsWith("common/")) && !places.some((place) => place.kind === "common")) {
    const common = commonPlace(root, places);
    if (common === null) throw M.refused(`The storage holds the firm's common pages, and this seat's folder is not in a firm folder's seats/ folder, where they go beside it. ${NOTHING}`);
    places.push(common);
  }
  const incoming = new Map();
  // each folder a pulled page goes in, by the same key: the page named first inside it
  const folders = new Map();
  const notWritten = [];
  for (const page of pages) {
    const where = placed(places, page.named);
    if (where === null) throw new LinkError("answer", `The desk server's pull named ${M.say(page.named, 300)}, outside this seat's folder and the firm's common space. ${NOTHING}`);
    if (!takes(where.place, where.rel)) {
      skipped.push(page.named);
      notWritten.push(page.named);
      continue;
    }
    const key = twinKey(page.named);
    const twin = incoming.get(key);
    if (twin) throw twins(twin.named, page.named);
    if (folders.has(key)) throw pageAndFolder(page.named, folders.get(key));
    for (const folder of foldersOf(page.named)) {
      const named = incoming.get(twinKey(folder));
      if (named) throw pageAndFolder(named.named, page.named);
      if (!folders.has(twinKey(folder))) folders.set(twinKey(folder), page.named);
    }
    incoming.set(key, { ...page, ...where });
  }
  const held = base.held(root);
  const before = held ? held.pages : {};
  const here = onThisComputer(places);
  // each page here by its file, and each file a pulled page finds: a page here is the storage's,
  // and never removed, when a pulled page finds it, by whatever name
  const nameOf = new Map(here.map((page) => [page.file, page.named]));
  const met = new Set();
  const changedHere = [];
  const writes = [];
  const removes = [];
  let unchanged = 0;
  // what this desk last read of a page: under the storage's name, or the name this computer has
  // its file by (the storage may have renamed it only in letters' case or form)
  const heldAs = (named, file) => (Object.hasOwn(before, named) ? before[named] : before[nameOf.get(file)]);
  // and two pulled pages that find one file here are twins, whatever their names
  const foundBy = new Map();
  for (const page of incoming.values()) {
    const now = pageAt(page.place, page.rel);
    if (now !== null && foundBy.has(now.file)) throw twins(foundBy.get(now.file), page.named);
    if (now !== null) foundBy.set(now.file, page.named);
    if (now !== null) met.add(now.file);
    if (now !== null && now.sha === page.sha) unchanged += 1;
    else if (now === null || heldAs(page.named, now.file) === now.sha) writes.push(page);
    else changedHere.push({ named: nameOf.get(now.file) || page.named, how: changedHow(heldAs(page.named, now.file), page.sha) });
  }
  // a page the storage holds that the pull does not write (one the server passed over as not
  // text, or a name the link never writes) is still the storage's: the file it finds here, by
  // whatever name, is never removed nor compared, and it stays held as it was
  const stillHeld = {};
  for (const named of [...passedOver, ...notWritten]) {
    const where = placed(places, named);
    if (where === null) continue;
    if (Object.hasOwn(before, named)) stillHeld[named] = before[named];
    const file = fileFound(where.place, where.rel);
    if (file === null) continue;
    met.add(file);
    const mine = nameOf.get(file);
    if (mine !== undefined && Object.hasOwn(before, mine)) stillHeld[mine] = before[mine];
  }
  for (const now of here) {
    if (met.has(now.file) || !Object.hasOwn(before, now.named)) continue;
    if (before[now.named] === now.sha) removes.push(placed(places, now.named));
    else changedHere.push({ named: now.named, how: "gone" });
  }
  if (changedHere.length) return changedHereAnswer(changedHere);
  refuseLinkedRoot(root);
  for (const page of writes) {
    // a folder where the page goes is not a page: it is never removed
    const st = P.standing(page.place.root, page.rel);
    if (st !== "absent" && !st.isFile()) throw P.linkInside(page.named);
  }
  // every folder a page goes in is made before any page is written: a file where one goes
  // refuses with no page written
  for (const page of writes) folderFor(page.place, page.rel);
  const done = { written: [], removed: [] };
  try {
    for (const page of writes) {
      writePage(page.place.root, page.rel, page.data);
      done.written.push(page);
    }
    for (const { place, rel } of removes) {
      const st = P.standing(place.root, rel);
      if (st !== "absent" && st.isFile()) fs.unlinkSync(path.join(place.root, rel));
      done.removed.push(place.prefix + rel);
    }
  } catch (err) {
    if (!done.written.length && !done.removed.length) throw err;
    return partWay(root, held, before, done, err);
  }
  const pagesHeld = { ...stillHeld };
  for (const page of incoming.values()) pagesHeld[page.named] = page.sha;
  // the read is held only as the next change reads it back: a disk that keeps no file permissions
  // shows the file open to all, and the link trusts it no further
  // a seed under way this desk began stays its own while the storage holds no desk.md of the seat
  const sealed = [...incoming.values()].some((page) => page.named === `${got.seat_folder}celorus/desk.md`);
  let notHeld = !base.hold(root, got.base, pagesHeld, { seeding: Boolean(held && held.seeding) && !sealed });
  if (!notHeld) {
    try {
      const now = base.held(root);
      notHeld = now === null || now.base !== got.base;
    } catch {
      notHeld = true;
    }
  }
  // the desk is pulled whatever setting aside meets: a queue folder the link cannot use stops
  // every change made through the link, so a change that may be kept is never made again
  let aside = 0;
  let notAside = false;
  try {
    aside = M.setAsideReadAgain(root, d);
  } catch {
    notAside = true;
  }
  const asideWords = notAside
    ? ` The changes queued on this desk that may already be kept could not be set aside, as the link could not use its queue folder ${queue.queueRel()}: no change is made through the link while it stays so. Make it a plain folder again, then pull again.`
    : aside ? ` ${aside} change(s) queued on this desk had an answer lost on its way back, so the storage may already hold it: each is set aside, never made again. Look in the desk whether each change is there.` : "";
  const passed = skipped.length ? ` ${skipped.length} page(s) the storage holds were not written here, as the link writes only text pages, in the folders it writes, and never a name starting with a dot but a page in celorus/.views/: ${listed(skipped)}.` : "";
  let waiting = 0;
  try {
    waiting = queue.waiting(root).length;
  } catch {
    waiting = 0;
  }
  const queuedWords = waiting && !notAside && !notHeld ? ` ${waiting} change(s) queued on this desk are made at the next change made through the link.` : "";
  const overWords = notHeld
    ? ` This desk could not hold what it read of the storage as the link holds it, in a file only this user may read and write (${base.baseRel()}): the disk the desk is on may not keep file permissions. A change on this seat's graph is refused until that read is held: move the desk to a disk that keeps them, then pull again.`
    : " The next change made through the link is made over this read.";
  const reason = notAside ? { reason: "not_set_aside" } : notHeld ? { reason: "not_held" } : {};
  return M.answer(
    `Pulled this seat's desk from its storage: ${writes.length} page(s) written, ${removes.length} removed, ${unchanged} as they were.${passed}${overWords}${asideWords}${queuedWords}`,
    { state: "pulled", written: writes.length, removed: removes.length, unchanged, skipped: skipped.length, ...reason },
    notAside || notHeld,
  );
}

// A pull that stopped part way through writing here. What it wrote and removed is held as the
// storage's, at the base held before it (only a pull that ends holds the storage's new base), so a
// page written is never taken for one changed here; the answer says what was written.
function partWay(root, held, before, done, err) {
  const pages = { ...before };
  for (const page of done.written) pages[page.named] = page.sha;
  for (const named of done.removed) delete pages[named];
  let kept = false;
  try {
    kept = base.hold(root, held && base.isBase(held.base) ? held.base : null, pages, { seeding: Boolean(held && held.seeding) });
  } catch {
    // what was held stays: a page written here then reads as changed here, and a pull refuses
    // it, never writing over it
    kept = false;
  }
  const why = err && typeof err.code === "string" ? M.say(err.code, 40) : "an error the link has no words for";
  const heldWords = kept
    ? "Each page written is held as the storage's."
    : `What this desk holds of its storage could not be held at ${base.baseRel()}, so a page written here may read as changed here, and a pull never writes over it.`;
  return M.answer(
    `The pull stopped part way, on ${why}: ${done.written.length} page(s) were written here and ${done.removed.length} removed as the storage holds them, and the rest were not. ${heldWords} Put right what stopped it, then pull again before the next change.`,
    { state: "not_pulled", reason: "part_way", written: done.written.length, removed: done.removed.length, held: kept },
    true,
  );
}

// The link's `pull` tool: { desk } in (or nothing, the desk found as make finds it), an MCP tool
// result out.
async function pull(input, deps) {
  const d = M.withDefaults(deps);
  let root = null;
  let result;
  try {
    if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) throw M.refused(`pull takes { desk }, the desk folder, or nothing. ${NOTHING}`);
    const at = M.deskFor(input ? input.desk : undefined, d);
    M.refuseHomeDesk(at, d.home);
    refuseLinkedRoot(at);
    root = at;
    result = await pullAt(root, d);
    d.log(`pull: ${result.structuredContent.state}`);
  } catch (err) {
    if (err instanceof LinkError && err.network) {
      d.log("pull: offline");
      result = M.answer(`The desk server could not be reached, so the desk was not pulled. ${NOTHING}`, { state: "offline" }, true);
    } else if (err instanceof LinkError || (err && err.name === "Refusal")) {
      d.log(`pull: refused (${err.code || err.name})`);
      result = M.answer(M.shown(err, d), { state: err.code === "signed_out" ? "signed_out" : "refused" }, true);
    } else {
      d.log(`pull: failed (${err && err.name ? err.name : "error"})`);
      result = M.answer("The link stopped on an error it has no words for, part way through the pull. Look at the desk, then pull again.", { state: "failed" }, true);
    }
  }
  return root === null ? result : M.namingSetAside(root, result);
}

module.exports = { pull, takes };
