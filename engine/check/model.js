"use strict";
// The desk's own model, read from its pages under celorus/model/, so a desk one model version
// behind is checked against its own words. A page the model cannot be read from stops the
// model being read at all (ModelUnreadable, naming the page): a model read in part would have
// every page checked against words nobody wrote.

const fs = require("node:fs");
const path = require("node:path");
const { readPage } = require("../lib/desk.js");
const { own, truthy, items, holds, show, strip, splitLines, splitWords, isSpace, compareText, sortedText, asPython } =
  require("./values.js");

const NO_HEADER = "no header";

// Every key read off model/model.md's header, by any reader of the model.
const MODEL_KEYS = [
  "every_page_must_have",
  "account_fields",
  "account_kinds",
  "system_types",
  "pack_lists",
  "desk_lists",
  "field_lists",
  "spine",
];
// The same, for a kind page and a list page.
const KIND_KEYS = ["kind", "folder", "must_have"];
const LIST_KEYS = ["list"];

class ModelUnreadable extends Error {
  constructor(rel) {
    super(rel);
    this.name = "ModelUnreadable";
    this.rel = rel;
  }
}

// `works_at: person -> firm, draws a line`: a connections entry naming the kinds at each end.
const CONN_ENDS = /^(?<conn>[a-z_]+): (?<sources>[^>]*?) -> (?<targets>[^,]+)/u;
// The name alone, for an entry whose ends will not parse but which still says it draws.
const CONN_NAME = /^(?<conn>[a-z_]+):/u;
// A connection in the list under the text: "- `works_at`: what it says".
const CONN_PROSE = /^- `(?<conn>[a-z_]+)`: (?<says>.+?)[ \t]*$/u;
// A markdown bullet opens an item of its own and never continues the one above it.
const BULLET = /^[-*+][ \t]/u;
const OWN_PACK = /^(?<list>[a-z_]+): (?<word>[a-z0-9-]+) -> (?<target>[a-z0-9-]+)(?=\n?$)/u;
const OWN_DESK = /^(?<list>[a-z_]+): (?<word>[a-z0-9-]+)(?=\n?$)/u;

// Spacing is not a disagreement: what the two copies of a connection say is compared, not how.
function said(text) {
  return splitWords(text).join(" ");
}

// The connections list written under the text, as a Map of name to what it says: the longest
// run of these bullets, where an indented line inside the run continues the bullet above it.
function proseEntries(body) {
  const runs = [];
  let run = new Map();
  let entry = null;
  for (const line of splitLines(body)) {
    const stripped = strip(line);
    const m = CONN_PROSE.exec(stripped);
    if (m) {
      entry = m.groups.conn;
      run.set(entry, said(m.groups.says));
    } else if (!stripped) {
      entry = null; // a blank line ends the bullet, but not the run
    } else if (entry !== null && line.length > 0 && isSpace(Array.from(line)[0]) && !BULLET.test(stripped)) {
      run.set(entry, said(`${run.get(entry)} ${stripped}`));
    } else {
      entry = null;
      if (run.size) {
        runs.push(run);
        run = new Map();
      }
    }
  }
  if (run.size) runs.push(run);
  let best = new Map();
  for (const candidate of runs) if (candidate.size > best.size) best = candidate;
  return best;
}

// A list of "left <sep> right" rows as a Map; a row that has lost its separator is a page that
// cannot be read.
function pairs(value, sep, whose) {
  const rows = items(value).map(show);
  if (rows.some((row) => !row.includes(sep))) throw new ModelUnreadable(whose);
  const out = new Map();
  for (const row of rows) {
    const at = row.indexOf(sep);
    out.set(row.slice(0, at), row.slice(at + sep.length));
  }
  return out;
}

// The model pages, by file name, in name order: files directly under model/ ending ".md".
function modelFiles(root) {
  const dir = path.join(root, "model");
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.name.endsWith(".md") && !entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareText);
}

function textSet(values) {
  return new Set(values.filter((v) => typeof v === "string"));
}

// Reads the desk's model from `root`, the desk's celorus folder. Throws ModelUnreadable naming
// the page when the model cannot be read from it.
function loadDeskModel(root) {
  const heads = new Map();
  const bodies = new Map();
  const unreadable = new Map();
  const files = modelFiles(root);
  for (const name of files) {
    const page = readPage(root, `model/${name}`);
    if (page.head === null) unreadable.set(`model/${name}`, page.problem || NO_HEADER);
    heads.set(name, asPython(page.head) || {});
    bodies.set(name, page.body);
  }
  const top = heads.get("model.md") || {};
  if (MODEL_KEYS.some((key) => own(top, key) === undefined || own(top, key) === null)) {
    throw new ModelUnreadable("model/model.md");
  }
  const connections = heads.get("connections.md") || {};
  const orEmpty = (value) => (truthy(value) ? value : []);
  const draws = items(orEmpty(own(connections, "draws"))).map(show);
  const connEnds = new Map();
  // The model says whether a connection draws in three places: `draws`, the entry's trailing
  // clause and the bullet under the text. The union is kept, so drift between the copies can
  // only widen what a measure of the walk counts, never hide it.
  const claimed = new Set(draws);
  const named = new Set([...draws, ...items(orEmpty(own(connections, "proof_required"))).map(show)]);
  for (const [conn, says] of proseEntries(bodies.get("connections.md") || "")) {
    named.add(conn);
    if (says.includes("draws a line")) claimed.add(conn);
  }
  for (const entry of items(orEmpty(own(connections, "connections"))).map(show)) {
    const name = CONN_NAME.exec(entry);
    if (name) named.add(name.groups.conn);
    if (entry.includes("draws a line") && name) claimed.add(name.groups.conn);
    const m = CONN_ENDS.exec(entry);
    if (!m) continue;
    if (draws.includes(m.groups.conn)) {
      connEnds.set(
        m.groups.conn,
        ["sources", "targets"].map((side) => new Set(m.groups[side].split(" or ").map(strip))),
      );
    }
  }
  const ownWords = heads.get("own-words.md") || {};
  const deskPage = readPage(root, "desk.md");
  const desk = asPython(deskPage.head) || {};
  const ownPack = new Map();
  const ownDesk = new Map();
  const ownUnread = [];
  for (const entry of items(orEmpty(own(ownWords, "own_words"))).map(show)) {
    let m = OWN_PACK.exec(entry);
    if (m && holds(own(top, "pack_lists"), m.groups.list)) {
      if (!ownPack.has(m.groups.list)) ownPack.set(m.groups.list, new Map());
      ownPack.get(m.groups.list).set(m.groups.word, m.groups.target);
      continue;
    }
    m = OWN_DESK.exec(entry);
    if (m && holds(own(top, "desk_lists"), m.groups.list)) {
      if (!ownDesk.has(m.groups.list)) ownDesk.set(m.groups.list, []);
      ownDesk.get(m.groups.list).push(m.groups.word);
      continue;
    }
    ownUnread.push(entry);
  }
  // A kind page is read here to key it, and by the rules for its folder and its must-haves.
  const kinds = new Map();
  const lists = new Map();
  for (const [name, head] of heads) {
    const type = show(own(head, "type"));
    const keys = type === "model-kind" ? KIND_KEYS : type === "model-list" ? LIST_KEYS : null;
    if (keys === null) continue;
    if (keys.some((key) => own(head, key) === undefined || own(head, key) === null)) {
      throw new ModelUnreadable(`model/${name}`);
    }
    if (own(head, "type") === "model-kind") kinds.set(show(head.kind), head);
  }
  for (const head of heads.values()) {
    if (own(head, "type") !== "model-list") continue;
    const key = own(head, "list");
    if (key !== null && typeof key !== "object") lists.set(key, items(orEmpty(own(head, "words"))));
  }
  return {
    everyPageMust: items(top.every_page_must_have),
    everyPageUsual: items(orEmpty(own(top, "every_page_usual"))),
    accountFields: items(top.account_fields),
    accountKinds: items(top.account_kinds),
    systemTypes: items(top.system_types),
    kinds,
    // Not turned into text: a model entry that is not text names no header key.
    proofRequired: items(orEmpty(own(connections, "proof_required"))),
    // What draws is read from the desk's own copy of the connections page.
    draws,
    drawsAny: sortedText(claimed),
    connWords: sortedText(named),
    connEnds,
    lists,
    packLists: items(top.pack_lists),
    deskLists: items(top.desk_lists),
    fieldLists: pairs(top.field_lists, " <- ", "model/model.md"),
    ownPack,
    ownDesk,
    ownUnread,
    unreadable,
    // The model's pages, by file name: every one was read as the model.
    files,
    pack: show(truthy(own(desk, "pack")) ? own(desk, "pack") : ""),
    switchOn: own(desk, "named_only_contact_details") === true,
  };
}

// The kind a page is read as by the walk: a kind this desk has no page for is read as a firm.
const FIRM = "firm";

function isKind(model, kind) {
  return typeof kind === "string" && model.kinds.has(kind);
}

function asKind(model, kind) {
  return isKind(model, kind) ? kind : FIRM;
}

// The kinds the model puts at each end of `conn`, or null where it does not say, or where an
// end names something that is no kind of page here.
function endsOf(model, conn) {
  const ends = model.connEnds.get(conn);
  if (!ends) return null;
  for (const word of [...ends[0], ...ends[1]]) if (!model.kinds.has(word)) return null;
  return ends;
}

// Whether a page of this kind draws `conn` at all.
function drawsOn(model, kind, conn) {
  const ends = endsOf(model, conn);
  const as = asKind(model, kind);
  return ends !== null && (ends[0].has(as) || ends[1].has(as));
}

// The desk's own folder of a path, with `.` and empty parts dropped, as a pure path reads it.
function purePath(text) {
  const parts = text.split("/").filter((part) => part !== "" && part !== ".");
  const rooted = text.startsWith("/");
  const joined = parts.join("/");
  return rooted ? `/${joined}` : joined || ".";
}

// The folders above a relative path, nearest first, ending at ".".
function parentsOf(folder) {
  const out = [];
  let at = folder;
  while (at !== "." && at !== "/" ) {
    const cut = at.lastIndexOf("/");
    at = cut === -1 ? "." : cut === 0 ? "/" : at.slice(0, cut);
    out.push(at);
  }
  return out;
}

// Whether a path may run through this page: not the desk's own furniture, and, for a page that
// names no type, only a page lying where some kind's pages live.
function walked(model, page) {
  if (holds(model.systemTypes, page.type === undefined ? null : page.type)) return false;
  if (truthy(page.type)) return true;
  const home = purePath(page.folder);
  const above = new Set(parentsOf(home));
  for (const kind of model.kinds.values()) {
    const folder = show(own(kind, "folder") === undefined ? "" : own(kind, "folder")).replace(/^\/+|\/+$/g, "");
    if (!folder) continue;
    if (home === purePath(folder) || above.has(folder)) return true;
  }
  return false;
}

// Whether a path on a page of kind `here` may walk along `conn` to a page of kind `there`. A
// firm is left only along a line the model runs from a firm to the far page's kind.
function leaves(model, here, there, conn) {
  if (asKind(model, here) !== FIRM) return true;
  const ends = endsOf(model, conn);
  return ends !== null && ends[0].has(FIRM) && ends[1].has(asKind(model, there));
}

// Whether a proof line the walk did not take counts as one it turned away: never a guess, and
// never a connection no copy of the model calls a drawing one.
function turnedAway(model, read) {
  if (read.proof === "guessed") return false;
  return model.drawsAny.length === 0 || model.drawsAny.includes(read.conn);
}

// Every detail the model names for each kind of page.
function namedFor(model) {
  const base = [...model.everyPageMust, ...model.everyPageUsual, ...model.accountFields];
  const out = new Map();
  for (const [kind, head] of model.kinds) {
    const orEmpty = (value) => (truthy(value) ? value : []);
    out.set(kind, textSet([...base, ...items(orEmpty(own(head, "must_have"))), ...items(orEmpty(own(head, "usual")))]));
  }
  return out;
}

// The kinds of page that draw a line: those among whose named details is a connection in draws.
function drawnKinds(model) {
  const draws = new Set(model.draws);
  const out = new Set();
  for (const [kind, keys] of namedFor(model)) if ([...keys].some((key) => draws.has(key))) out.add(kind);
  return out;
}

module.exports = {
  ModelUnreadable,
  MODEL_KEYS,
  KIND_KEYS,
  FIRM,
  loadDeskModel,
  proseEntries,
  said,
  isKind,
  asKind,
  endsOf,
  drawsOn,
  walked,
  leaves,
  turnedAway,
  namedFor,
  drawnKinds,
};
