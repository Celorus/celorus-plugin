"use strict";
// The link's seed: a seat's converted graph written into the seat's own storage, one batch at a
// time (the desk server's desk_seed).
//
// The rules it keeps:
//   - a seat's graph only (layout 3), in its firm's seats/ folder named as the storage names the
//     seat, never a dated copy the converter left beside a desk (<desk>-before-convert-<date>),
//     on a desk whose .gitignore keeps .celorus/ out of git, as each batch's base is held there
//     (lib/base.js);
//   - every run starts with the desk server's desk_pull, for the storage's base and what it holds;
//   - from the seat's folder only a page the link's own sync table (lib/synctable.js) keeps as
//     shared or overnight is sent: a page only this computer keeps, and one no row names, never
//     leave the laptop; from the firm's common space only its own pages;
//   - the seat's desk.md goes alone in the last batch, so a storage that holds it holds a desk,
//     and a seed never adds to one: the desk is pulled instead;
//   - a storage that holds none of this seat's pages is seeded fresh, batch 1 over the pull's
//     base, held marked as a seed's before batch 1 is sent, so a batch 1 whose answer is lost
//     still leaves a seed to go on from (a batch 1 refused for certain puts back what was held);
//     one that holds this seat's pages is seeded on only over the base this desk holds from its
//     own seed (held marked as a seed's), sending only the pages the storage lacks; a storage that
//     moved since stops the seed, and one whose base this desk holds from anything else (a pull,
//     a kept change) or not at all is pulled instead;
//   - the firm's common pages are sent only in batch 1 of a fresh seed, into a firm whose common
//     space in the storage is empty, as many as batch 1 carries: otherwise the seat's folder alone
//     is sent, and the answer says why;
//   - the whole graph, with what the storage holds, stays inside what one pull reads, so the
//     storage never holds more than the desk can pull back;
//   - batches of at most 50 pages and under the body cap; each batch kept, or the pages of one
//     kept in part, is held at once, so a seed stopped part way resumes from the last kept base,
//     and the first pull after a seed refuses nothing the seed sent;
//   - a batch not kept stops the seed, saying what is kept and what is not yet sent; one over a
//     storage that moved says so (MOVED: never this seat's overnight, which waits for its
//     desk.md), and a last batch the storage refused for its desk.md says the pages before stay
//     kept.
// The log carries counts and reasons only: never a page's path or text.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { refuseLinkedRoot } = require("../../engine/lib/linkedroot.js");
const base = require("./base.js");
const { LinkError } = require("./errors.js");
const M = require("./make.js");
const P = require("./paths.js");
const queue = require("./queue.js");
const TABLE = require("./synctable.js");
const { placesOf } = require("./workingset.js");

const NOTHING = "Nothing was sent.";
const SEAT_FOLDER = /^seats\/[0-9]{1,12}\/$/u;
// The most pages the storage takes in one write, so the most one batch holds.
const BATCH = 50;
// Each batch's pages as sent, in bytes, under the desk server's cap on a call's body, with room for JSON's escapes.
const BATCH_BYTES = 6 * 1024 * 1024;
// The copy the conversion leaves beside a desk (engine/convert/convert.js copyName), as the storage names it.
const DATED_COPY = /^.+-before-convert-\d{4}-\d{2}-\d{2}(-\d+)?(\.partial)?$/u;
const CLASSES = new Set(["seat", "shared", "overnight"]);
const SEEDED = new Set(["shared", "overnight"]);
const GLOB = /^[A-Za-z0-9_.*\-/]{1,200}$/u;
const NAMED = 20;
const WAY = "Pull the desk (the link's pull), then seed again: a seed goes on from what the storage holds, and sends only the pages it lacks.";
// What moves a seat's storage while a seed is under way.
const MOVED = "a change made to it in between: one through the link from another computer, or another seat's overnight adding to the firm's name list (common/names.md)";
// The desk server's reasons for a batch that may or may not have been kept (keep's own words).
const MAYBE = new Set(["provider_refused", "provider_unreachable", "unreachable", "not_an_answer", "storage_failed"]);

// The sync table's glob as the engine's sync globPattern reads it: `**/` at
// the start any folders, `/**` at the end anything below, `*` any name within one folder; every
// other character is itself.
function globPattern(glob) {
  let src = "";
  let at = 0;
  if (glob.startsWith("**/")) {
    src = "(?:[^/]*/)*";
    at = 3;
  }
  const deep = glob.endsWith("/**");
  for (const ch of glob.slice(at, deep ? glob.length - 3 : glob.length)) src += ch === "*" ? "[^/]*" : ch === "." ? "\\." : ch;
  return new RegExp(`^${src}${deep ? "/.*" : ""}$`, "u");
}

// The table's rows, each read before any is used: a table that does not read refuses the seed.
function rowsOf(table) {
  if (!Array.isArray(table) || table.length === 0 || table.length > 500) return null;
  const rows = [];
  for (const row of table) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !GLOB.test(row[0]) || !CLASSES.has(row[1])) return null;
    rows.push({ pattern: globPattern(row[0]), cls: row[1] });
  }
  return rows;
}

// The class of a path from the seat's folder: the first row's that matches it, or null.
function classOf(rows, rel) {
  const row = rows.find((one) => one.pattern.test(rel));
  return row ? row.cls : null;
}

const listed = (paths) => {
  const shown = paths.slice(0, NAMED).map((p) => M.say(p, 300));
  return `${shown.join(", ")}${paths.length > NAMED ? `, and ${paths.length - NAMED} more` : ""}`;
};

// The pages this computer would seed: the seat's by the table, the common space's own. Each is
// { named, data }; a page past the cap, or not UTF-8 text, refuses the seed, naming it.
function pagesHere(rows, places, carryCommon) {
  const pages = [];
  let notSent = 0;
  const take = (place, rel) => {
    const named = place.prefix + rel;
    const data = P.readBytes(place.root, rel);
    if (data === null) return;
    if (data === P.TOO_BIG) throw M.refused(`${M.say(named, 300)} is over ${P.CAPS.fileBytes / 1024} KB, more than the storage keeps in one page. ${NOTHING}`);
    if (P.textOf(data) === null) throw M.refused(`${M.say(named, 300)} is not UTF-8 text, and the storage keeps text only. Save it as text, or move it out of the desk folder, then seed again. ${NOTHING}`);
    pages.push({ named, data });
  };
  const walk = (place, folder, keep) => {
    const at = folder === "" ? place.root : path.join(place.root, folder);
    for (const name of fs.readdirSync(at).sort()) {
      const rel = folder === "" ? name : `${folder}/${name}`;
      if (folder === "" && P.neverSent(name)) continue;
      const st = fs.lstatSync(path.join(place.root, rel));
      if (st.isSymbolicLink()) throw P.linkInside(place.prefix + rel);
      if (DATED_COPY.test(name)) throw M.refused(`${M.say(place.prefix + rel, 300)} is named as the copy the conversion leaves of a desk, and a seed never carries one. Move it out of the desk folder, then seed again. ${NOTHING}`);
      if (st.isDirectory()) walk(place, rel, keep);
      else if (st.isFile()) {
        if (keep(rel)) take(place, rel);
        else notSent += 1;
      }
    }
  };
  const [own, common] = places;
  walk(own, "", (rel) => SEEDED.has(classOf(rows, rel)) && P.pathOk(own.prefix + rel));
  if (common && carryCommon) walk(common, "", (rel) => P.commonWritable(rel) && P.pathOk(common.prefix + rel));
  return { pages, notSent };
}

// The order a seed sends in: the common space, the seat's folder, and the seat's desk.md last,
// as the storage takes a seat folder that holds a desk.md as a desk.
function ordered(pages, own) {
  const rank = (page) => (page.named === `${own}celorus/desk.md` ? 2 : page.named.startsWith("common/") ? 0 : 1);
  return [...pages].sort((a, b) => rank(a) - rank(b) || (a.named < b.named ? -1 : a.named > b.named ? 1 : 0));
}

function batchesOf(pages) {
  const out = [];
  let batch = [];
  let bytes = 0;
  for (const page of pages) {
    const size = Buffer.byteLength(JSON.stringify(page.named)) + Buffer.byteLength(JSON.stringify(P.textOf(page.data)));
    if (batch.length && (batch.length === BATCH || bytes + size > BATCH_BYTES)) {
      out.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(page);
    bytes += size;
  }
  if (batch.length) out.push(batch);
  return out;
}

const malformed = () => new LinkError("answer", `The desk server's answer to the seed does not read as one. ${NOTHING}`);

function stopped(why, kept, notYet, structured) {
  return M.answer(`The seed stopped: ${why} ${kept} page(s) are kept in this seat's storage, and ${notYet} not yet sent. ${WAY}`, { state: "not_seeded", kept, not_yet_sent: notYet, ...structured }, true);
}

async function seedAt(root, d) {
  const rows = rowsOf(TABLE);
  if (rows === null) throw M.refused(`The link's sync table does not read, so it cannot tell which pages leave this computer. Install the plugin again. ${NOTHING}`);
  const { contract, places: found } = placesOf(root);
  if (contract !== 2) throw M.refused(`The seed is for a seat's graph (a desk of layout 3, in its firm's seats/ folder), and this desk is not one. ${NOTHING}`);
  const firm = path.dirname(path.dirname(root));
  if (DATED_COPY.test(path.basename(root)) || DATED_COPY.test(path.basename(firm))) {
    throw M.refused(`This desk is in the copy the conversion leaves of a desk, and a seed never carries one. Seed the converted graph instead. ${NOTHING}`);
  }
  if (!queue.keptOutOfGit(root)) throw M.refused(`The desk's .gitignore does not keep .celorus/ out of git, where the link holds what it seeded. Add the line .celorus/ to the desk's .gitignore, then seed again. ${NOTHING}`);
  const got = await M.served("desk_pull", {}, d);
  if (got.state !== "pulled") {
    const words = M.say(got.message) || "The desk server did not read the storage.";
    return M.answer(`${words} ${NOTHING}`, { state: "not_seeded", reason: M.say(got.reason, 60) }, true);
  }
  if (!base.isBase(got.base) || typeof got.seat_folder !== "string" || !SEAT_FOLDER.test(got.seat_folder) || !Array.isArray(got.files)) throw malformed();
  const own = found[0];
  if (own.prefix !== got.seat_folder) throw M.refused(`This seat's folder on this computer is ${own.prefix}, and its storage holds it as ${got.seat_folder}: the folder is named by the seat's number. ${NOTHING}`);
  const storage = new Map();
  let storageBytes = 0;
  for (const page of got.files) {
    if (page === null || typeof page !== "object" || typeof page.path !== "string" || typeof page.content !== "string" || !base.isDigest(page.sha256)) throw malformed();
    storage.set(page.path, page.sha256);
    storageBytes += Buffer.byteLength(page.content, "utf8");
  }
  for (const named of Array.isArray(got.skipped) ? got.skipped : []) if (typeof named === "string") storage.set(named, null);
  const held = base.held(root);
  const deskNamed = `${own.prefix}celorus/desk.md`;
  const seatHeld = [...storage.keys()].filter((named) => named.startsWith(own.prefix));
  const commonHeld = [...storage.keys()].filter((named) => named.startsWith("common/"));
  if (storage.has(deskNamed)) {
    d.log("seed: refused (a desk)");
    throw M.refused(`This seat's storage holds its desk already (its celorus/desk.md, which a seed sends last), and a seed never adds to a desk. Pull the desk instead. ${NOTHING}`);
  }
  let first = true;
  let at = got.base;
  let pages = {};
  if (seatHeld.length) {
    if (held === null || !base.isBase(held.base) || !held.seeding) {
      d.log("seed: refused (seeded)");
      throw M.refused(`This seat's storage holds its pages already, and this desk holds no batch of a seed of them: a seed goes only into an empty seat folder, or on from its own last batch. Pull the desk instead. ${NOTHING}`);
    }
    if (held.base !== got.base) {
      d.log("seed: stopped (moved)");
      return M.answer(
        `The seed did not go on: this seat's storage changed since this desk's last batch was kept (${MOVED}), and it holds ${seatHeld.length} of this seat's pages. ${NOTHING} ${WAY}`,
        { state: "not_seeded", reason: "moved", kept: seatHeld.length },
        true,
      );
    }
    first = false;
    at = held.base;
    pages = { ...held.pages };
  } else if (held !== null) {
    // what this desk read of the firm's common pages, where the storage holds them still as read
    for (const named of commonHeld) if (storage.get(named) !== null && held.pages[named] === storage.get(named)) pages[named] = held.pages[named];
  }
  // the firm's common pages go only in batch 1 of a fresh seed, into an empty common space
  const carryCommon = first && commonHeld.length === 0;
  const places = [...found];
  const { pages: here, notSent } = pagesHere(rows, places, carryCommon);
  const missing = here.filter((page) => !storage.has(page.named));
  const commonHere = ordered(missing.filter((page) => page.named.startsWith("common/")), own.prefix);
  const commonSent = commonHere.length ? batchesOf(commonHere)[0] : [];
  const commonLeft = commonHere.length - commonSent.length;
  const send = [...commonSent, ...ordered(missing.filter((page) => !page.named.startsWith("common/")), own.prefix)];
  const already = here.length - missing.length;
  const bytes = send.reduce((n, page) => n + page.data.length, storageBytes);
  if (storage.size + send.length > P.CAPS.files || bytes > P.CAPS.totalBytes) {
    throw M.refused(`This seat's graph with what its storage holds is ${storage.size + send.length} page(s) and ${Math.ceil(bytes / 1024)} KB, more than one pull of the desk reads (${P.CAPS.files} pages, ${P.CAPS.totalBytes / (1024 * 1024)} MB), so the storage would hold more than the desk can pull back. ${NOTHING}`);
  }
  if (!send.length || send[send.length - 1].named !== deskNamed) throw M.refused(`The seat's celorus/desk.md is not among the pages a seed sends. ${NOTHING}`);
  // the desk.md alone in the last batch: a storage that writes page by page holds the seal only
  // once every other page is kept
  const batches = [...batchesOf(send.slice(0, -1)), [send[send.length - 1]]];
  const sha = (text) => crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
  // a fresh seed's mark goes on before batch 1 is sent, so a batch 1 whose answer is lost leaves
  // this desk a seed to go on from once pulled; a batch 1 refused for certain puts back what was held
  if (first && !base.hold(root, at, pages, { seeding: true })) {
    throw M.refused(`This desk could not hold the seed's base at ${base.baseRel()}, so no batch was sent. ${NOTHING}`);
  }
  const putBack = () => (held === null ? base.clear(root) : base.hold(root, held.base, held.pages, { seeding: held.seeding }));
  let kept = 0;
  for (const [n, batch] of batches.entries()) {
    const files = Object.fromEntries(batch.map((page) => [page.named, P.textOf(page.data)]));
    let out;
    try {
      out = await M.served("desk_seed", { files, read_base: at, first: first && n === 0 }, d);
    } catch (err) {
      if (err instanceof LinkError && err.network) {
        d.log(`seed: stopped (offline), ${n} batch(es) kept`);
        return stopped(`the desk server could not be reached while batch ${n + 1} of ${batches.length} was sent, so that batch may or may not be kept.`, kept, send.length - kept, { reason: "offline" });
      }
      throw err;
    }
    if (out.state === "partly_kept") {
      // the storage took part of the batch: the pages it names as written, each one this batch
      // sent, are held as sent, over the base the batch went over, which the storage has moved
      // past, so the next seed stops and the desk is pulled first
      const named = Array.isArray(out.written) ? out.written.filter((p) => typeof p === "string" && files[p] !== undefined) : null;
      for (const p of named || []) pages[p] = sha(files[p]);
      kept += named ? named.length : 0;
      d.log(`seed: stopped (partly_kept), ${n} batch(es) kept`);
      const part = named === null ? "and did not say which of its pages it kept" : `keeping ${named.length} of its ${batch.length} page(s)`;
      const heldNow = named !== null && named.length > 0 ? base.hold(root, at, pages, { seeding: true }) : true;
      const heldWords = heldNow ? "" : ` What it kept could not be held at ${base.baseRel()}.`;
      return stopped(`the storage stopped part way through batch ${n + 1} of ${batches.length}, ${part}.${heldWords}`, kept, send.length - kept, { reason: "partly_kept" });
    }
    if (out.state !== "seeded") {
      const reason = M.say(out.reason, 60);
      if (first && n === 0 && !MAYBE.has(reason)) putBack();
      d.log(`seed: stopped (${reason}), ${n} batch(es) kept`);
      const why = reason === "stale_base"
        ? n === 0
          ? "this seat's storage changed after the desk read it and before the first batch was sent, so nothing of it was kept."
          : `this seat's storage changed after batch ${n} was kept (${MOVED}), so batch ${n + 1} was not kept.`
        : reason === "page_exists"
          ? `the storage already holds pages batch ${n + 1} carried${Array.isArray(out.pages) ? `: ${listed(out.pages.filter((p) => typeof p === "string"))}` : ""}, so that batch was not kept.`
          : reason === "not_a_graph"
            ? `the storage refused the seat's celorus/desk.md, which the last batch carries, as not saying layout_version 3, so that batch was not kept. The pages of the batches before stay kept, with no desk.md, and a seed of the desk at layout 3 goes on over them.`
            : `${M.say(out.message) || "the storage did not keep a batch."}`;
      return stopped(why, kept, send.length - kept, { reason: reason === "stale_base" ? "moved" : reason });
    }
    const keptBase = out.kept && out.kept.base;
    const written = out.kept_paths && Array.isArray(out.kept_paths.written) ? out.kept_paths.written : null;
    if (!base.isBase(keptBase) || written === null) throw malformed();
    for (const one of written) {
      if (one && files[one.path] !== undefined && base.isDigest(one.sha256)) pages[one.path] = one.sha256;
    }
    kept += batch.length;
    // the last batch carries the desk.md, the seal: what is held after it is a desk's, no seed's
    if (!base.hold(root, keptBase, pages, { seeding: n < batches.length - 1 })) {
      return stopped(`what the storage kept could not be held at ${base.baseRel()}.`, kept, send.length - kept, { reason: "not_held" });
    }
    at = keptBase;
  }
  d.log(`seed: seeded, ${batches.length} batch(es)`);
  const notSentWords = notSent ? ` ${notSent} file(s) in this seat's folder stay on this computer only, as the desk's sync table keeps them here or names them nowhere.` : "";
  const alreadyWords = already ? ` ${already} page(s) the storage holds already were not sent.` : "";
  const commonWords = !first
    ? found[1] && !commonHeld.length ? " The firm's common pages were not sent, as a seed sends them in its first batch only." : ""
    : commonHeld.length
      ? " The firm's common pages were not sent, as the storage holds common pages already: pull the desk next, and it brings them."
      : commonLeft
        ? ` ${commonLeft} of the firm's common pages were not sent, as a seed sends them in its first batch only and they are more than one batch carries: they stay on this computer.`
        : "";
  return M.answer(
    `Seeded this seat's storage: ${kept} page(s) sent in ${batches.length} batch(es), each kept, and the storage's base held on this desk, so the next change made through the link is made over it.${alreadyWords}${notSentWords}${commonWords}`,
    { state: "seeded", sent: kept, batches: batches.length, already: already, not_sent: notSent, common: carryCommon, common_not_sent: commonLeft },
    false,
  );
}

// The link's `seed` tool: { desk } in (or nothing, the desk found as make finds it), an MCP tool
// result out.
async function seed(input, deps) {
  const d = M.withDefaults(deps);
  let root = null;
  let result;
  try {
    if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) throw M.refused(`seed takes { desk }, the desk folder, or nothing. ${NOTHING}`);
    const at = M.deskFor(input ? input.desk : undefined, d);
    M.refuseHomeDesk(at, d.home);
    refuseLinkedRoot(at);
    root = at;
    result = await seedAt(root, d);
  } catch (err) {
    if (err instanceof LinkError && err.network) {
      d.log("seed: offline");
      result = M.answer(`The desk server could not be reached, so nothing was seeded. ${NOTHING}`, { state: "offline" }, true);
    } else if (err instanceof LinkError || (err && err.name === "Refusal")) {
      d.log(`seed: refused (${err.code || err.name})`);
      result = M.answer(M.shown(err, d), { state: err.code === "signed_out" ? "signed_out" : "refused" }, true);
    } else {
      d.log(`seed: failed (${err && err.name ? err.name : "error"})`);
      result = M.answer("The link stopped on an error it has no words for, part way through the seed. Look at the desk, pull it, then seed again.", { state: "failed" }, true);
    }
  }
  return root === null ? result : M.namingSetAside(root, result);
}

module.exports = { BATCH, classOf, globPattern, rowsOf, seed };
