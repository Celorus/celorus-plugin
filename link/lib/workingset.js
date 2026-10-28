"use strict";
// The pages a making call sends: its working set. A closed list per tool, read from what each
// tool reads in the engine, so the desk server makes from these pages what the engine makes
// from the whole desk (the parity test holds this, tool by tool, for all twelve). The list is the
// engine's own data (engine/lib/workingsets.json), so any caller that sends a desk to the server
// sends the same pages; this file reads it, and refuses a list of a version it does not know.
//
// Six writers send only their own pages:
//   - every writer: celorus/index.md, desk.md, log.md, and every seat page under celorus/seats/;
//   - the page of each page name the call names (in families/, people/, firms/ or seats/);
//   - log_action: desk-log.md. add_follow_up: queues/follow-ups.md and the conversation's page.
//     assign_lead: queues/supplied.md. write_conversation: the day's conversations of that
//     family on that channel. write_brief: the day's brief of that kind for that family.
//     register_routine: scheduled.md.
// Six desk-wide tools send the desk's celorus/ folder, never the folder that holds it, which may
// be a whole working repository: every plain file in celorus/ that is UTF-8 text, but nothing whose
// path has a part that starts with a dot (.celorus/, .git/, a tool's settings, an editor's or
// another plugin's folder, a page in a dot-folder inside celorus/), save the engine's own dot
// paths the tool reads, each named exactly in the list; and beside celorus/, the files the desk's
// sent items name in their `file:` lines, where the engine's check looks for them (check/rules.js
// C05). Those and the dot paths are the only files sent from outside celorus/:
//   - update_desk: the desk's .gitignore, the four vault settings in celorus/.obsidian/, and a
//     .gitkeep inside celorus/, each of which it writes only when it is missing (update/update.js),
//     and every page of celorus/.views/, as its plan is a digest of every file under celorus/;
//   - render_view: the four Obsidian settings at the desk folder, which it writes only when they
//     are missing (render/obsidian.js), the leftover spare files it removes there and in
//     celorus/.views/ (render/files.js), and the view pages dated within a day of the day it may
//     draw (its date or today), as it reads only the page it draws and its saved sentences;
//   - the other four: none.
// A page the call did not send is never overwritten when it comes back (lib/apply.js), so a dot
// path a tool needs and was not sent would refuse every such call on a desk that has it.
// A file that is not text (a picture, a system file) is passed over and counted, as the desk
// server takes text only; but a page that is not UTF-8 refuses the call, as the engine names such
// a page in its views and the server would never see it.
// A sent item's `file:` is read from the page the walk holds, joined as the check joins it, and
// the file sent only when it is in the desk folder (on a graph, the seat's folder), outside
// celorus/, with no part that starts with a dot (`..` among them), and a plain file: written in
// full, or anywhere else, it is not sent, and the server's check says it is not there.
// What such a `file:` names in the desk folder that the call does not send as text (a file that is
// not text, in celorus/ or beside it, a folder, anything else) goes in the call's `named`, by its
// path in the call, as "file", "folder" or "other": never a byte of it, nor its size, its date or
// anything else read from it. The server's check reads that list where its disk has nothing, so a
// sent item naming a PDF reads there as it reads on this computer. The six writers send no list.
//
// On a seat's graph (layout 3: desk.md says layout_version 3) the call sends a firm folder, as the
// desk server takes one: the seat's desk under seats/<its folder's name>/ and the firm's common
// space under common/, when the seat's folder sits in the firm's seats/ folder beside it. A
// writer's page is looked for where the engine looks for it on a graph: a desk-wide page (the soul,
// the register, supplied.md and the like) in the common space, a page the graph keeps whole
// (desk.md, the logs) in its celorus/, and a page of a kind in each of the graph's three parts; and
// every writer sends the firm's common.md, which names its seats and its desk head. A desk-wide tool
// sends the seat's desk as a desk is sent, and the whole common space but its dot paths. No other
// seat's graph is ever sent.
//
// A link anywhere in what would be sent refuses the call, a sent item's file and the folders on its
// way among it: the link never reads through a link, so nothing outside the desk is ever sent.
// Nothing outside celorus/ is opened but those dot paths and named files, so a link, a large file
// or a crowd of files beside the desk that no sent item names stops nothing; a named file behind a
// link, or a named text file over the cap, refuses as any sent file does. Each cap is refused,
// never cut.

const fs = require("node:fs");
const path = require("node:path");
const { headOf, hiddenName, readPage } = require("../../engine/lib/desk.js");
const LIST = require("../../engine/lib/workingsets.json");
const { LinkError } = require("./errors.js");
const P = require("./paths.js");

// The version of the engine's list this link reads.
const VERSION = 1;

const NARROW_TOOLS = Object.freeze(Object.keys(LIST.narrow));
const WIDE_TOOLS = Object.freeze(Object.keys(LIST.wide));
const SERVED = Object.freeze([...NARROW_TOOLS, ...WIDE_TOOLS]);
const GRAPH = LIST.layout_3;
const VIEWS = LIST.views;
// The one folder of the desk folder a desk-wide call walks, as the engine writes only there.
const DESK = "celorus";
const SPARE = new RegExp(LIST.spare, "u");

// A page name, as the engine takes one.
const HANDLE = /^[a-z0-9][a-z0-9-]*$/u;
const DATE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/u;
// The name of a seat's folder in its firm's seats/ folder, as the call names it to the server.
const FOLDER_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;

// The page names in one argument: the value itself, and each [[name]] in it.
function namesIn(value) {
  if (typeof value !== "string") return [];
  const found = [value.trim(), ...[...value.matchAll(/\[\[([^\]|#]+)/gu)].map((m) => m[1].trim())];
  return found.filter((name) => HANDLE.test(name));
}

const list = (value) => (Array.isArray(value) ? value : []);
const dayOf = (at) => {
  const m = typeof at === "string" ? DATE.exec(at) : null;
  return m ? m[1] : null;
};

// The values an argument spec names: "seat" the argument itself, "attended[]" each item of a list,
// "named[].slug" a key of each item of a list.
function valuesAt(args, spec) {
  const [head, key] = spec.split(".");
  if (!head.endsWith("[]")) return [args[head]];
  const items = list(args[head.slice(0, -2)]);
  if (key === undefined) return items;
  return items.map((item) => (item && typeof item === "object" ? item[key] : null));
}

// A template filled from the arguments, or null when one of its values is not there: {key} a page
// name, {key:day} the day a moment starts with.
function fill(template, args) {
  let ok = true;
  const out = template.replace(/\{([a-z_]+)(?::(day))?\}/gu, (_, key, day) => {
    const value = args[key];
    const filled = day ? dayOf(value) : typeof value === "string" && HANDLE.test(value) ? value : null;
    if (filled === null) ok = false;
    return filled === null ? "" : filled;
  });
  return ok ? out : null;
}

// A writer's own pages, by their paths on a desk, from its arguments: { files, series }. `series`
// is a folder and the pattern its pages' names must match.
function rulePages(tool, args) {
  const rule = LIST.narrow[tool];
  const files = [];
  const names = list(rule.names).flatMap((spec) => valuesAt(args, spec)).flatMap(namesIn);
  for (const name of names) for (const folder of LIST.page_folders) files.push(`celorus/${folder}/${name}.md`);
  files.push(...list(rule.files));
  for (const named of list(rule.pages_named)) for (const name of namesIn(args[named.argument])) files.push(`${named.folder}/${name}.md`);
  for (const template of list(rule.templates)) {
    const rel = fill(template, args);
    if (rel !== null) files.push(rel);
  }
  const series = [];
  for (const one of list(rule.series)) {
    const stem = fill(one.name, args);
    if (stem !== null) series.push([one.folder, new RegExp(`^${stem}${one.numbered ? "(-[0-9]+)?" : ""}\\.md$`, "u")]);
  }
  return { files, series };
}

// Where a call reads and writes: one place for a desk, and on a seat's graph the seat's desk and,
// when it is there, the firm's common space. Each place is { prefix, root, kind }: a path in the
// call is the place's prefix and the path in its folder.
function placesOf(root) {
  const page = readPage(path.join(root, "celorus"), "desk.md");
  const head = page.head !== null && typeof page.head === "object" && !Array.isArray(page.head) ? page.head : null;
  if (head === null || head.layout_version !== GRAPH.layout_version) {
    return { contract: 1, places: [{ prefix: "", root, kind: "desk" }] };
  }
  const name = path.basename(root);
  if (!FOLDER_NAME.test(name)) {
    throw new LinkError("graph_folder", "This seat's graph is in a folder whose name the desk server does not take (letters, digits, dashes and underscores, starting with a letter or a digit). Nothing was sent.");
  }
  const places = [{ prefix: `${GRAPH.seats}/${name}/`, root, kind: "graph" }];
  const seats = path.dirname(root);
  if (path.basename(seats) === GRAPH.seats) {
    const common = path.join(path.dirname(seats), GRAPH.common);
    const st = P.lstatOrNull(common);
    if (st !== null && st.isSymbolicLink()) throw P.linkInside(`${GRAPH.common}/`);
    if (st !== null && st.isDirectory()) places.push({ prefix: `${GRAPH.common}/`, root: common, kind: "common" });
  }
  return { contract: GRAPH.contract_version, places };
}

// The places a desk path is looked for in: on a desk, itself; on a graph, a desk-wide page in the
// common space, a page with no folder in the graph's celorus/, any other in each of its parts.
function candidates(places, rel) {
  const [own, common] = places;
  if (own.kind === "desk") return [[own, rel]];
  const inner = rel.slice("celorus/".length);
  if (GRAPH.common_pages.includes(inner) || GRAPH.common_folders.some((folder) => inner.startsWith(folder))) {
    return common ? [[common, inner]] : [];
  }
  if (!inner.includes("/")) return [[own, rel]];
  return GRAPH.parts.map((part) => [own, `celorus/${part}/${inner}`]);
}

// The names in a folder of a place, or [] when it is not there; read without following a link.
function namesUnder(root, rel) {
  const st = P.standing(root, rel);
  if (st === "absent") return [];
  if (!st.isDirectory()) return [];
  return fs.readdirSync(path.join(root, rel)).sort();
}

// The file at `rel` in a place, as text, into `files` by its path in the call; nothing when absent.
function take(files, place, rel, notText) {
  const sent = place.prefix + rel;
  if (!P.pathOk(sent)) return;
  const data = P.readBytes(place.root, rel);
  if (data === null) return;
  if (data === P.TOO_BIG) throw P.tooBig(sent);
  const text = P.textOf(data);
  if (text === null) throw new LinkError("not_text", notText(sent));
  files[sent] = text;
}

function narrow(places, tool, args) {
  const { files: own, series } = rulePages(tool, args);
  const wanted = new Map();
  const want = (place, rel) => wanted.set(place.prefix + rel, [place, rel]);
  for (const rel of [...LIST.base, ...own]) for (const [place, at] of candidates(places, rel)) want(place, at);
  for (const [place, folder] of candidates(places, `${LIST.seat_pages}/x`).map(([p, at]) => [p, path.posix.dirname(at)])) {
    for (const name of namesUnder(place.root, folder)) if (name.endsWith(".md") && HANDLE.test(name.slice(0, -3))) want(place, `${folder}/${name}`);
  }
  for (const [folder, pattern] of series) {
    for (const [place, at] of candidates(places, `${folder}/x`).map(([p, rel]) => [p, path.posix.dirname(rel)])) {
      for (const name of namesUnder(place.root, at)) if (pattern.test(name)) want(place, `${at}/${name}`);
    }
  }
  const common = places.find((place) => place.kind === "common");
  if (common) for (const sent of GRAPH.narrow_common) want(common, sent.slice(common.prefix.length));
  const files = {};
  for (const key of [...wanted.keys()].sort()) {
    const [place, rel] = wanted.get(key);
    take(files, place, rel, (sent) => `${sent} is not UTF-8 text, so the desk cannot read it. Nothing was sent.`);
  }
  return { files, skipped: 0 };
}

// The day `days` after the day `day` (YYYY-MM-DD), or null for no day.
function shiftDay(day, days) {
  const m = typeof day === "string" ? /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(day) : null;
  if (!m) return null;
  const at = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return Number.isNaN(at.getTime()) ? null : at.toISOString().slice(0, 10);
}

// Which pages of celorus/.views/ a call sends, by name: all, none, or those dated within a day of
// the call's date, its taken_at or today.
function viewsSent(word, args, today) {
  if (word === "all") return () => true;
  if (word !== "dated") return () => false;
  const days = new Set();
  for (const base of [today, dayOf(args.date), dayOf(args.taken_at)]) {
    for (const shift of [-1, 0, 1]) {
      const day = shiftDay(base, shift);
      if (day) days.add(day);
    }
  }
  return (name) => days.has(name.slice(0, 10));
}

const isDot = hiddenName;

// Whether a desk-wide call opens a folder of the desk at `rel` whose path has a dot part, and
// whether it sends a file there: only the dot paths its list names, each exactly; the views folder
// by its own name, case aside, never a look-alike of it.
function dotRules(tool, args, today) {
  const spec = LIST.wide[tool];
  const views = viewsSent(spec.views, args, today);
  const named = (rel) => list(spec.dot_files).includes(rel);
  const spareIn = (folder, name) => SPARE.test(name) && list(spec.spares_in).includes(folder);
  return {
    opens(rel) {
      if (rel.toLowerCase() === VIEWS) return spec.views !== "none" || list(spec.spares_in).includes(VIEWS);
      return list(spec.dot_files).some((f) => f.startsWith(`${rel}/`)) || list(spec.spares_in).some((f) => f === rel || f.startsWith(`${rel}/`));
    },
    sends(folder, name) {
      const rel = folder === "" ? name : `${folder}/${name}`;
      if (folder.toLowerCase() === VIEWS) return isDot(name) ? spareIn(VIEWS, name) : views(name);
      if (named(rel) || spareIn(folder, name)) return true;
      const parts = rel.split("/");
      return list(spec.dot_names).includes(name) && parts[0] === "celorus" && !parts.slice(0, -1).some(isDot);
    },
  };
}

// A sent item's `file:` as a path in the desk folder, joined as the engine's check joins it and
// keyed as its list is keyed (check/rules.js atDesk, listKey): an empty or `.` part dropped,
// nothing else tidied. null when it is written in full, has a part that starts with a dot (`..`
// among them, so it never leaves the folder), or has a part a disk may read as another name (a
// Windows short name such as GIT~1, a trailing dot or space, a colon, a backslash; the link writes
// no such name either, lib/paths.js ODD_NAME). So a `file:` written with a backslash
// (files\deck.pdf) is neither sent nor listed.
function attachedAt(file) {
  if (file.startsWith("/")) return null;
  const parts = file.split("/").filter((part) => part !== "" && part !== ".");
  const odd = (part) => P.ODD_NAME.test(part) || P.ODD_NAME.test(P.fold(part));
  if (parts.length === 0 || parts.some(isDot) || parts.some(odd)) return null;
  return parts.join("/");
}

// A key for a path that folds letter case and how a letter is written at least as far as the desk
// server does when it refuses two spellings of one path (as lib/pull.js keys a twin).
const twinKey = (rel) => P.fold(rel).toUpperCase().toLowerCase().normalize("NFKC");

// The files the desk's own sent items name in their `file:` lines, by their paths in the desk
// folder, once each, in the order the pages are held: the pages in hand under the place's celorus/
// (on a graph, the seat's) that the engine's check reads as pages, named `.md` exactly with no part
// that starts with a dot (lib/desk.js markdownUnder), never the common space's. Only the pages in
// hand are read for them. The engine's check names each of these too (check/rules.js
// namesUnsent): the same header reader, a text `file:`, never one written in full or with a dot
// part, read from a set of pages that holds these.
function attachments(files, place) {
  const found = new Set();
  const under = `${place.prefix}${DESK}/`;
  for (const [sent, text] of Object.entries(files)) {
    if (!sent.startsWith(under) || !sent.endsWith(".md") || sent.slice(under.length).split("/").some(isDot)) continue;
    const head = headOf(text);
    if (head === null || !Object.hasOwn(head, "type") || head.type !== "sent") continue;
    const file = Object.hasOwn(head, "file") ? head.file : null;
    const rel = typeof file === "string" ? attachedAt(file) : null;
    if (rel !== null) found.add(rel);
  }
  return [...found];
}

function wide(places, tool, args, today) {
  const files = {};
  let skipped = 0;
  const desk = dotRules(tool, args, today);
  const none = { opens: () => false, sends: () => false };
  // The plain file at `rel` in a place, into `files` as text; one that is not text is passed over
  // and counted, but a page under celorus/ (or the common space) that is not UTF-8 refuses.
  const send = (place, rel) => {
    const sent = place.prefix + rel;
    const data = P.readBytes(place.root, rel);
    if (data === null) return;
    if (data === P.TOO_BIG) {
      if (P.looksLikeText(place.root, rel)) throw P.tooBig(sent);
      skipped += 1;
      return;
    }
    const text = P.textOf(data);
    if (text === null) {
      const page = P.fold(rel).endsWith(".md") && (place.kind === "common" || P.fold(rel).startsWith("celorus/"));
      if (page) {
        throw new LinkError("not_text", `${sent} is not UTF-8 text, so the desk server cannot read it, and its views would leave it out. Nothing was sent: save it as UTF-8, then make the change again.`);
      }
      skipped += 1;
      return;
    }
    if (!P.pathOk(sent)) throw P.badPath(sent);
    files[sent] = text;
    if (Object.keys(files).length > P.CAPS.files) {
      throw new LinkError("too_many", `The desk holds more than ${P.CAPS.files} files, more than the desk server takes in one call. Nothing was sent.`);
    }
  };
  // A spelling held back, read only so that a file that is not text is counted as send() counts
  // it; its text is never sent, so nothing about it refuses the call.
  const counted = (place, rel) => {
    const data = P.readBytes(place.root, rel);
    if (data === null) return;
    if (data === P.TOO_BIG ? !P.looksLikeText(place.root, rel) : P.textOf(data) === null) skipped += 1;
  };
  const visit = (place, folder, rules, dotted) => {
    const at = folder === "" ? place.root : path.join(place.root, folder);
    for (const name of fs.readdirSync(at).sort()) {
      const rel = folder === "" ? name : `${folder}/${name}`;
      if (folder === "" && P.neverSent(name)) continue;
      if (P.fold(name) === ".git") continue;
      // at the desk folder only celorus/ is walked, and the dot paths below: never the rest of the
      // folder that holds the desk, which may be a whole working repository
      if (folder === "" && place.kind !== "common" && name !== DESK && !isDot(name)) continue;
      // a path with a dot part is looked at only when the list names it, or a path under it
      const dot = dotted || isDot(name);
      if (dot && !rules.opens(rel) && !rules.sends(folder, name)) continue;
      const st = fs.lstatSync(path.join(place.root, rel));
      if (st.isSymbolicLink()) throw P.linkInside(place.prefix + rel);
      if (st.isDirectory()) {
        // nothing in a folder inside celorus/.views/ is sent
        if (P.fold(folder) === VIEWS) continue;
        if (!dot || rules.opens(rel)) visit(place, rel, rules, dot);
        continue;
      }
      if (dot && !rules.sends(folder, name)) continue;
      if (!st.isFile()) {
        skipped += 1;
        continue;
      }
      send(place, rel);
    }
  };
  for (const place of places) visit(place, "", place.kind === "common" ? none : desk, false);
  // the files the sent items name, in the desk folder (on a graph, the seat's folder), where the
  // engine's check looks for them. Beside celorus/ a plain file is sent when it is text, as the walk
  // sends a page; in celorus/ the walk has had it. One that is there and was not sent as text (a
  // file that is not text, a folder, anything else) is listed in `named` by what it is, and only
  // that: the server's check reads the list where its disk has nothing. One not there, behind a
  // file on its way, or on a path the desk server does not take is neither sent nor listed, and
  // the server's check says it is not there. The list holds at most one path per sent item, and
  // every sent item is in `files`, so it is within the pages' own cap. The server refuses two
  // spellings of one path, or of a folder on its way, which a disk that folds case holds as one:
  // a file beside celorus/ that another line has sent under another spelling is listed, not sent
  // again. Only a spelling that was sent is kept for that. A spelling held back is still read, but
  // only to be counted, so a file that is not text is counted for each line that names it.
  const [own] = places;
  const named = {};
  const spelled = new Map();
  const ways = (sent) => sent.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"));
  const spell = (sent) => {
    for (const at of ways(sent)) if (!spelled.has(twinKey(at))) spelled.set(twinKey(at), at);
  };
  const twin = (sent) => ways(sent).some((at) => (spelled.get(twinKey(at)) ?? at) !== at);
  for (const rel of attachments(files, own)) {
    const sent = own.prefix + rel;
    if (!P.pathOk(sent)) continue;
    let st;
    try {
      st = P.standing(own.root, rel);
    } catch (err) {
      if (err instanceof LinkError && err.code === "not_folder") continue;
      throw err;
    }
    if (st === "absent") continue;
    const walked = P.fold(rel.split("/")[0]) === DESK;
    if (!walked && st.isFile()) {
      if (twin(sent)) counted(own, rel);
      else {
        send(own, rel);
        if (Object.hasOwn(files, sent)) spell(sent);
      }
    } else if (!walked && !st.isDirectory()) skipped += 1;
    if (Object.hasOwn(files, sent)) continue;
    named[sent] = st.isFile() ? "file" : st.isDirectory() ? "folder" : "other";
  }
  return { files, skipped, named };
}

// The working set for `tool` called with `args` on the desk at `root`: { files, skipped, contract,
// places, named }, `files` each page's text by its path in the call, `skipped` the files passed
// over as not text, `contract` the shape of the call (1 a desk, 2 a firm folder), `places` where
// each path in the call is on this computer, and for a desk-wide tool `named`, what the sent items
// name that was not sent, by its path in the call. `today` is the day of the call (YYYY-MM-DD, in
// UTC).
function workingSet(root, tool, args, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (LIST.version !== VERSION) {
    throw new LinkError("working_sets", `The plugin's list of the pages each tool sends is of a version this link does not read (${String(LIST.version).slice(0, 20)}). Nothing was sent. The plugin may need an update.`);
  }
  if (!SERVED.includes(tool)) throw new LinkError("not_served", `${tool} is not made on the desk server.`);
  const given = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const { contract, places } = placesOf(root);
  const out = NARROW_TOOLS.includes(tool) ? narrow(places, tool, given) : wide(places, tool, given, today);
  let total = 0;
  for (const [rel, text] of Object.entries(out.files)) {
    total += Buffer.byteLength(rel, "utf8") + Buffer.byteLength(text, "utf8");
    if (total > P.CAPS.totalBytes) {
      throw new LinkError("too_big", `The pages this call needs come to more than the desk server takes (${P.CAPS.totalBytes} bytes). Nothing was sent.`);
    }
  }
  return { ...out, contract, places };
}

module.exports = { CAPS: P.CAPS, NARROW_TOOLS, SERVED, VERSION, WIDE_TOOLS, placesOf, workingSet };
