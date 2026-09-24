"use strict";
// The desk check, rules C01 to C15. It lists; it never blocks. It reads the desk's own model
// pages under celorus/model/, so a desk one model version behind is checked against its own
// words. A finding is { page, rule, message }: the page under celorus/, the rule's id, and what
// is wrong, in words the person can act on.

const fs = require("node:fs");
const path = require("node:path");
const { readPage, NO_HEADER, NOT_UTF8, STAMP_NOT_ONE_VALUE } = require("../lib/desk.js");
const values = require("./values.js");
const text = require("./text.js");
const model = require("./model.js");

const { own, hasOwn, truthy, isEmpty, show, same, items, holds, strip, splitLines, head, compareText, sortedText } =
  values;
const { Page, linksIn, hasLink, proofMatch, headingOf, isHeading, sectionSpan, sectionOf } = text;

const RULES = {
  C01: "unknown kind",
  C02: "missing must-have detail",
  C03: "word on no list",
  C04: "own word with no match",
  C05: "link that points at nothing",
  C06: "connection with no proof line",
  C07: "guess drawn as a line",
  C08: "contact details on a named-only person",
  C09: "name with no source",
  C10: "may be the same",
  C11: "file name used twice",
  C12: "layout",
  C13: "evidence link drawn as a line",
  C14: "no Connections section",
  C15: "connections on a page that draws no line",
};
const NO_SECTION = "no `## Connections` heading; connection lines are read only there";
const SECOND_SECTION = "a second `## Connections` heading; only the first is read";
const UNCLOSED_FENCE = "a fenced block was opened and never closed, so the lines after it were not read";
// The rule that says a connection the person named in a header has no proof line.
const UNBACKED = "C06";
// The pages a desk must hold. celorus/index.md is not listed: it is what makes a folder a desk,
// so the door decides it, and a folder without it is refused before the check runs.
const REQUIRED = [
  "desk.md",
  "log.md",
  "desk-log.md",
  "motion-spec.md",
  "register.md",
  "marks.md",
  "queues/supplied.md",
  "queues/follow-ups.md",
  "queues/book.md",
  "crm/README.md",
  "context/tone.md",
  "context/never-say.md",
  "context/notes.md",
  "rules/rulebook.md",
  "model/model.md",
  "model/connections.md",
  "model/own-words.md",
];
// The folders the check does not read as pages: the model (read as the model), the generated
// views and the merge records.
const SKIP_TOP = new Set(["model", "views", "merges"]);
const NAME_SOURCE_KINDS = new Set(["conversation", "sent", "brief", "research"]);
// A log line: its title, a dated heading, or a timed entry.
const LOG_LINE = new RegExp(
  `^(?:# Log|## [0-9]{4}-[0-9]{2}-[0-9]{2}|\\* [0-9]{2}:[0-9]{2}${values.BLANK_CLASS}*\\u00b7${values.BLANK_CLASS}*.+)?$`,
  "u",
);
// The supplied forms of a name source; the list part in either case.
const NAME_SOURCE_FORM = /^(?:supplied-[A-Za-z0-9-]+|book|crm-export-[0-9]{4}-[0-9]{2}-[0-9]{2})$/u;

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// A page as a model page is opened: its problem, or "no header" when it has none.
function problemOf(root, rel) {
  const page = readPage(root, rel);
  return page.problem || (page.head === null ? NO_HEADER : null);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The words of a page's title and aliases, each set of words in order, for C10.
function namesOf(page) {
  const aliases = own(page.head, "aliases");
  const raw = [own(page.head, "title"), ...items(truthy(aliases) ? aliases : [])];
  return new Set(
    raw.filter(truthy).map((n) => (show(n).toLowerCase().match(/[a-z0-9]+/g) || []).sort().join(" ")),
  );
}

// The file names a page is remembered as not the same as, always as a list.
function notSameAs(pageHead) {
  const value = own(pageHead, "not_same_as");
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value.map(show) : [show(value)];
}

function compareFindings(a, b) {
  return compareText(a.page, b.page) || compareText(a.rule, b.rule) || compareText(a.message, b.message);
}

// The check's pages: every page under celorus/ but the model, the views and the merge records,
// from the desk reader's pages (lib/desk.js readDesk). A page with no header carries no problem
// here: having none is the rules' to say. Nor does a stamps page whose stamp is not one value:
// its header parsed, so every rule runs on it as on any page, and the stamp problem rides
// beside as `stampProblem`, which the rules list as a C12 of its own.
function checkPages(readPages) {
  return readPages
    .filter((page) => !SKIP_TOP.has(page.rel.split("/")[0]))
    .map((page) => {
      const own = page.problem === NO_HEADER || page.problem === STAMP_NOT_ONE_VALUE ? null : page.problem;
      const checked = new Page(page.rel, values.asPython(page.head), page.body, own);
      checked.stampProblem = page.problem === STAMP_NOT_ONE_VALUE ? page.problem : null;
      return checked;
    });
}

// The findings kept by a scope: those on the pages it names and, when `linked` is given (the
// page rules ran), on the pages those link, one hop. A filter over one run's findings.
function narrowFindings(findings, scope, linked) {
  const wanted = new Set(scope);
  if (linked) {
    for (const rel of scope) for (const other of linked(rel)) wanted.add(other);
  }
  return findings.filter((finding) => wanted.has(finding.page));
}

// Checks the desk at `desk` (its folder) whose pages under celorus/ are `readPages`, in path
// order. `scope`, when given, keeps the findings on those pages and on the pages they link;
// where the rules stop at the layout they read no page, so it keeps those pages' findings alone.
// Returns the findings, sorted by page, rule and message. `read`, when given, is told which
// pages the rules read: `read.pages`, the paths under celorus/ of the model's pages and of
// every page the page rules ran on, or null when desk.md or the model is missing or cannot be
// read and the rules stopped at the desk's layout; `read.rules`, the rules that ran: C12
// alone when the rules stopped at the layout, since only its layout checks ran, and every
// rule otherwise; and `read.linked`, the paths of the pages a page links (one hop), or null
// when the page rules did not run. A scope applied later with narrowFindings(findings, scope,
// read.linked) keeps what this run would have kept for it.
function checkDesk(desk, readPages, scope = null, read = {}) {
  const root = path.join(desk, "celorus");
  const found = new Map();
  let modelShort = false;
  read.pages = null;
  read.rules = ["C12"];
  read.linked = null;

  // `fromModel` marks a finding that reads a part of the model kept on its own page; when a
  // page under model/ cannot be read, that part is missing, not empty, and says nothing.
  function add(rule, rel, message, fromModel = false) {
    if (fromModel && modelShort) return;
    const finding = { page: rel, rule, message };
    found.set(JSON.stringify([rel, rule, message]), finding);
  }

  // Every finding with no scope; with one, those kept for it.
  function done() {
    const all = [...found.values()].sort(compareFindings);
    return scope === null ? all : narrowFindings(all, scope, read.linked);
  }

  for (const rel of REQUIRED) {
    if (!isFile(path.join(root, ...rel.split("/")))) add("C12", rel, "missing");
  }
  if (!["desk.md", "model/model.md", "model/connections.md"].every((rel) => isFile(path.join(root, ...rel.split("/"))))) {
    return done();
  }
  const broken = [];
  for (const rel of ["model/model.md", "model/connections.md"]) {
    const why = problemOf(root, rel);
    if (why) broken.push([rel, why]);
  }
  for (const [rel, why] of broken) add("C12", rel, why);
  if (broken.length) return done();
  let m;
  try {
    m = model.loadDeskModel(root);
  } catch (err) {
    if (!(err instanceof model.ModelUnreadable)) throw err;
    add("C12", err.rel, "the model cannot be read from this page");
    return done();
  }
  for (const [rel, why] of m.unreadable) add("C12", rel, why);
  // A page under model/ that cannot be read may be the page that held the kinds, the lists or
  // the desk's own words, so the rules that read those stand down; the page is named above.
  modelShort = m.unreadable.size > 0;
  const drawsSet = new Set(m.draws);
  if (!m.draws.length) add("C12", "model/connections.md", "names no draws, so no connection draws a line");
  for (const conn of sortedText(m.draws.filter((c) => !m.connEnds.has(c)))) {
    add("C12", "model/connections.md", `${conn} draws a line but no entry names its ends`);
  }
  if (m.draws.length) {
    for (const conn of sortedText(m.drawsAny.filter((c) => !drawsSet.has(c)))) {
      add("C12", "model/connections.md", `${conn} says it draws a line but is not in \`draws\``);
    }
  }
  const proofRequired = new Set(m.proofRequired.filter((c) => typeof c === "string"));
  for (const conn of sortedText(new Set(m.draws.filter((c) => !proofRequired.has(c))))) {
    add("C12", "model/connections.md", `${conn} draws a line but is not in \`proof_required\``);
  }
  for (const conn of sortedText(m.connEnds.keys())) {
    const ends = m.connEnds.get(conn);
    for (const word of sortedText(new Set([...ends[0], ...ends[1]].filter((w) => !m.kinds.has(w))))) {
      add("C12", "model/connections.md", `${conn}: ${word} is not a kind of page`, true);
    }
  }
  if (!m.kinds.has("firm")) {
    add("C12", "model/connections.md", 'no kind is named "firm", so the rule about leaving one reads from nothing', true);
  }

  // The connections page states every connection twice: in its header, which the desk runs on,
  // and as a list under the text. The two are compared.
  const connectionsPage = readPage(root, "model/connections.md");
  const connectionsHead = values.asPython(connectionsPage.head);
  const header = new Map();
  for (const entry of items(truthy(own(connectionsHead || {}, "connections")) ? own(connectionsHead, "connections") : []).map(show)) {
    const at = entry.indexOf(": ");
    if (at === -1) continue;
    header.set(entry.slice(0, at), model.said(entry.slice(at + 2)));
  }
  const prose = model.proseEntries(connectionsPage.body);
  if (header.size) {
    const either = new Set([...header.keys(), ...prose.keys()]);
    for (const conn of sortedText([...either].filter((c) => header.has(c) !== prose.has(c)))) {
      const missing = header.has(conn) ? "the list under the text" : "the header";
      add("C12", "model/connections.md", `${conn} is not in ${missing}`);
    }
  }
  for (const conn of sortedText([...header.keys()].filter((c) => prose.has(c)))) {
    if (header.get(conn) !== prose.get(conn)) {
      add("C12", "model/connections.md", `${conn} is written twice and the two disagree`);
    }
  }
  for (const word of sortedText(new Set(m.systemTypes.filter((w) => typeof w === "string" && m.kinds.has(w))))) {
    add("C12", "model/model.md", `${word} is both a system type and a kind of page`);
  }
  const deskHead = values.asPython(readPage(root, "desk.md").head) || {};
  if (!same(own(deskHead, "layout_version"), 2)) add("C12", "desk.md", "layout_version is not 2");
  for (const entry of m.ownUnread) add("C04", "model/own-words.md", `${entry}: cannot be read as a list word`);
  for (const [listName, words] of m.ownPack) {
    const standard = m.lists.get(listName) || [];
    for (const [word, target] of words) {
      if (holds(standard, word)) {
        add(
          "C04",
          "model/own-words.md",
          `${listName}: ${word} is now also a standard word; the desk's meaning is kept, decide which`,
          true,
        );
      }
      if (!holds(standard, target)) {
        add("C04", "model/own-words.md", `${listName}: ${word} -> ${target}: ${target} is not a ${listName} word`, true);
      }
    }
  }

  const pages = checkPages(readPages);
  read.pages = [...m.files.map((name) => `model/${name}`), ...pages.map((page) => page.rel)];
  read.rules = Object.keys(RULES);
  const byStem = new Map();
  for (const page of pages) {
    if (!byStem.has(page.stem)) byStem.set(page.stem, []);
    byStem.get(page.stem).push(page);
  }
  const kindOf = new Map();
  for (const page of pages) if (model.isKind(m, page.type)) kindOf.set(page.stem, page.type);
  const namedFor = model.namedFor(m);
  const drawn = model.drawnKinds(m);
  const isSystem = (type) => holds(m.systemTypes, type === undefined ? null : type);
  // The file names only furniture answers to: the walk reaches no page of that name.
  const furniture = new Set();
  for (const [stem, group] of byStem) if (group.every((p) => isSystem(p.type))) furniture.add(stem);
  // The walk's view of the desk: the file names a path may run through, and each one's kind.
  const reached = new Map();
  for (const page of pages) if (model.walked(m, page)) reached.set(page.stem, page.type);

  // C15: a line the census counts is a line this check lists, with the line.
  function c15(page, listedByLayout) {
    const name = page.name;
    let what = name === "index.md" ? "an index" : truthy(page.type) ? `a ${show(page.type)} page` : "";
    what = what || "this page";
    const lines = splitLines(page.outside);
    const span = sectionSpan(lines, "Connections");
    const under = span ? lines.slice(span[0], span[1]) : [];
    lines.forEach((raw, index) => {
      if (span && span[0] <= index && index < span[1]) return;
      const read = proofMatch(raw);
      if (read === null || !model.turnedAway(m, read)) return;
      const heads = (span ? lines.slice(span[1], index) : []).map(headingOf).filter((h) => h !== null);
      const last = heads[heads.length - 1];
      const second = heads.length > 0 && last[0] === 2 && last[1] === "Connections";
      const where = second ? "under a second Connections heading" : "outside the Connections section";
      add("C15", page.rel, `a proof line ${where}: ${strip(raw)}`);
    });
    const onWalk = model.walked(m, page);
    const here = reached.get(page.stem);
    for (const raw of under) {
      const line = strip(raw);
      if (!line) continue;
      const read = proofMatch(raw);
      if (listedByLayout && (read === null || (read.proof !== "guessed" && !hasLink(read.target)))) continue;
      if (!onWalk) {
        if (read === null || model.turnedAway(m, read)) {
          add("C15", page.rel, `under Connections on ${what}, which draws no line: ${line}`);
        }
        continue;
      }
      if (read === null) {
        add("C15", page.rel, `under Connections, not read as a proof line: ${line}`);
        continue;
      }
      if (!model.turnedAway(m, read) || model.endsOf(m, read.conn) === null) continue;
      const conn = read.conn;
      if (!model.drawsOn(m, here, conn)) {
        add("C15", page.rel, `${conn} does not join ${what}, so it draws no line here: ${line}`);
        continue;
      }
      const links = linksIn(read.target);
      if (!links.length) {
        add("C15", page.rel, `the target is not a link, so the walk takes the line nowhere: ${line}`);
        continue;
      }
      const far = links.filter((end) => end !== page.stem);
      if (!far.length) {
        add("C15", page.rel, `[[${page.stem}]] is this page itself, so the line draws no line: ${line}`);
      }
      for (const end of far) {
        if (!byStem.has(end)) {
          add("C15", page.rel, `[[${end}]] is no page on this desk, so the line draws nothing to it: ${line}`);
        } else if (!reached.has(end)) {
          const why = furniture.has(end)
            ? "is part of the desk itself and draws no line"
            : "has no kind and sits outside every kind's folder, so the walk never reaches it";
          add("C15", page.rel, `[[${end}]] ${why}: ${line}`);
        } else if (!(model.leaves(m, here, reached.get(end), conn) || model.leaves(m, reached.get(end), here, conn))) {
          add("C15", page.rel, `${conn} does not run from a firm to a firm, so it draws no line to [[${end}]]: ${line}`);
        }
      }
    }
  }

  for (const page of pages) {
    const name = page.name;
    if (page.problem !== NOT_UTF8) {
      const kindPage = page.head !== null && model.isKind(m, page.type);
      c15(page, !page.problem && kindPage && name !== "index.md" && name !== "log.md");
    }
    if (page.stampProblem) add("C12", page.rel, page.stampProblem);
    if (page.problem) {
      add("C12", page.rel, page.problem);
      continue;
    }
    if (name === "index.md") {
      if (page.rel === "index.md") {
        if (!same(page.head, { okf_version: "0.2" })) add("C12", page.rel, 'the index header holds only okf_version "0.2"');
      } else if (page.head !== null) {
        add("C12", page.rel, "an index below the root has no header");
      }
      if (page.fenceOpen) add("C12", page.rel, UNCLOSED_FENCE);
      continue;
    }
    if (name === "log.md") {
      if (page.head !== null) add("C12", page.rel, "the log has no header");
      for (const line of splitLines(page.body)) {
        if (!LOG_LINE.test(line)) add("C12", page.rel, `log line of another shape: ${head(line, 60)}`);
      }
      continue;
    }
    if (page.head === null) {
      add("C12", page.rel, "no header");
      continue;
    }
    // A fence opened and never closed takes the lines below it; the two rules that would have
    // to assume something about those lines stand down on this page (C06, and C05 for links
    // in the body).
    if (page.fenceOpen) add("C12", page.rel, UNCLOSED_FENCE);
    const headerLinks = linksIn(Object.values(page.head));
    const bodyLinks = page.fenceOpen ? [] : linksIn(page.outside);
    for (const target of new Set([...headerLinks, ...bodyLinks])) {
      if (!byStem.has(target)) add("C05", page.rel, `[[${target}]] points at nothing`);
    }
    for (const key of m.everyPageMust) {
      if (isEmpty(own(page.head, key))) add("C02", page.rel, `no ${show(key)}`);
    }
    const t = page.type;
    if (!truthy(t)) continue;
    const kind = model.isKind(m, t) ? m.kinds.get(t) : null;
    if (kind === null && !isSystem(t)) {
      add("C01", page.rel, `${show(t)} is not a kind of page`, true);
      continue;
    }
    for (const key of Object.keys(page.head)) {
      const value = page.head[key];
      if (
        key === "sources" &&
        Array.isArray(value) &&
        value.every((v) => values.isMapping(v) && hasOwn(v, "resource"))
      ) {
        continue;
      }
      if (values.isMapping(value) || (Array.isArray(value) && value.some((v) => values.isMapping(v) || Array.isArray(v)))) {
        add("C12", page.rel, `${key} is nested; headers are flat`);
      }
    }
    const outsideLines = splitLines(page.outside);
    const span = sectionSpan(outsideLines, "Connections");
    if (kind === null) continue;
    const packs = items(truthy(own(kind, "packs")) ? own(kind, "packs") : []);
    if (packs.length && m.pack && !holds(packs, m.pack)) {
      add("C01", page.rel, `${t} belongs to the ${packs.map(show).join(" or ")} pack; this desk runs ${m.pack}`);
    }
    if (!same(page.folder, kind.folder)) add("C12", page.rel, `a ${t} page belongs in ${show(kind.folder)}/`);
    if (drawn.has(t)) {
      for (const key of Object.keys(page.head)) {
        if (drawsSet.has(key) || namedFor.get(t).has(key)) continue;
        for (const target of linksIn(page.head[key])) {
          add("C13", page.rel, `${key} [[${target}]] in the header would draw a line`);
        }
      }
    }
    for (const key of items(kind.must_have)) {
      if (isEmpty(own(page.head, key))) add("C02", page.rel, `no ${show(key)}`);
    }
    if (holds(m.accountKinds, t)) {
      const held = m.accountFields.filter((k) => truthy(own(page.head, k)));
      if (held.length && held.length !== m.accountFields.length) {
        const missing = m.accountFields.filter((k) => !held.some((h) => same(h, k)));
        add("C02", page.rel, `the account role needs all three: no ${missing.map(show).join(", ")}`);
      }
    }
    for (const [field, listName] of m.fieldLists) {
      if (!hasOwn(page.head, field)) continue;
      const standard = m.lists.get(listName) || [];
      const pack = m.ownPack.get(listName) || new Map();
      const deskWords = m.ownDesk.get(listName) || [];
      if (!standard.length && !pack.size && !deskWords.length) continue;
      const valid = new Set([...standard.filter((w) => typeof w === "string"), ...pack.keys(), ...deskWords]);
      const value = page.head[field];
      for (const one of Array.isArray(value) ? value : [value]) {
        if (one === null || one === "") continue; // an empty detail is C02's to list
        if (!valid.has(show(one))) add("C03", page.rel, `${field} ${show(one)} is on no list`, true);
      }
    }
    if (t === "sent" && truthy(own(page.head, "file"))) {
      const file = show(page.head.file);
      const found = whatIsAt(atDesk(desk, file));
      if (found === null) add("C05", page.rel, `file ${file} is not there`);
      else if (found !== "a file") add("C05", page.rel, `file ${file} is ${found}, not a file`);
    }
    const foundSection = sectionOf(page.outside, "Connections");
    if (drawn.has(t) && foundSection === null && !page.fenceOpen) add("C14", page.rel, NO_SECTION);
    if (span && outsideLines.slice(span[1]).some((line) => isHeading(line, 2, "Connections"))) {
      add("C12", page.rel, SECOND_SECTION);
    }
    const section = foundSection || "";
    const proofLines = splitLines(section).map(proofMatch).filter((r) => r !== null);
    for (const r of proofLines) {
      if (r.proof === "guessed" && hasLink(r.target)) add("C07", page.rel, `${r.conn} ${r.target}: a guess drawn as a line`);
    }
    for (const raw of splitLines(section)) {
      if (!strip(raw)) continue;
      const read = proofMatch(raw);
      if (read === null) {
        add("C12", page.rel, `under Connections, not read as a proof line: ${strip(raw)}`);
        continue;
      }
      if (m.connWords.length && !m.connWords.includes(read.conn)) {
        add("C03", page.rel, `${read.conn} is on no list of connections`, true);
      } else if (read.proof !== "guessed" && !hasLink(read.target)) {
        add("C12", page.rel, `the target is not a link: ${strip(raw)}`);
      }
    }
    // Stood down on an open fence: the lines below it could not be read.
    for (const conn of page.fenceOpen ? [] : m.proofRequired) {
      for (const target of linksIn(own(page.head, conn))) {
        const matching = proofLines.filter(
          (r) => same(r.conn, conn) && (linksIn(r.target).includes(target) || slug(r.target) === target),
        );
        if (!matching.length) add(UNBACKED, page.rel, `${show(conn)} [[${target}]] has no proof line`);
        else if (matching.every((r) => r.proof === "guessed")) {
          add("C07", page.rel, `${show(conn)} [[${target}]] is in the header on a guess`);
        }
      }
    }
    if (t === "person") {
      if (same(own(page.head, "standing"), "named-only") && !m.switchOn) {
        const filled = text.coordinatesFilled(page);
        if (text.holdsContactDetails(page)) {
          // On a page whose structure could not be read, the row says so, and only about the
          // half that is unsure.
          const unsure = page.fenceOpen && filled && !text.contactInText(page);
          const said = unsure
            ? "a fenced block on this page was never closed, so its structure could not be read; " +
              "there may be contact details on a named-only person here while the desk's switch is off"
            : "contact details on a named-only person while the desk's switch is off";
          add("C08", page.rel, said);
        }
      }
      // The plain file name of the page the name came from, never a link.
      const source = own(page.head, "name_source");
      if (!isEmpty(source)) {
        const namedPage = show(source);
        // A firm page is the name's source only for a person whose own header works_at links
        // that firm; any other firm page is no source.
        const ownFirm =
          kindOf.get(namedPage) === model.FIRM && linksIn(own(page.head, "works_at")).includes(namedPage);
        const known = NAME_SOURCE_KINDS.has(kindOf.get(namedPage)) || ownFirm;
        if (linksIn(source).length) {
          add("C09", page.rel, "name_source is a link; write the page's plain file name");
        } else if (!known && !NAME_SOURCE_FORM.test(namedPage)) {
          add(
            "C09",
            page.rel,
            `name_source ${namedPage} names no conversation, sent item, brief, research page, list or book`,
            true,
          );
        }
      }
    }
  }

  for (const kindName of ["person", "firm", "family"]) {
    const group = pages.filter((p) => truthy(p.head) && p.type === kindName);
    for (let i = 0; i < group.length; i += 1) {
      for (const b of group.slice(i + 1)) {
        const a = group[i];
        const apart = notSameAs(a.head).includes(b.stem) || notSameAs(b.head).includes(a.stem);
        const bNames = namesOf(b);
        if ([...namesOf(a)].some((n) => bNames.has(n)) && !apart) {
          add("C10", a.rel, `may be the same ${kindName} as ${b.rel}`);
          add("C10", b.rel, `may be the same ${kindName} as ${a.rel}`);
        }
      }
    }
  }
  for (const [stem, group] of byStem) {
    const kinded = group.filter((p) => model.isKind(m, p.type));
    if (kinded.length > 1) {
      for (const p of kinded) add("C11", p.rel, `the file name ${stem} is used by ${kinded.length} pages`);
    }
  }

  // One hop: the pages a page links, read when a scope asks. A page no rule reads (under views/
  // or merges/, or in a folder below model/) is in the same read of the desk, `readPages`, and
  // its links are followed the same way, so a scope naming it keeps the findings on the pages it
  // links. The model's own pages, which the rules read as the model, are followed as before.
  const byRel = new Map(pages.map((page) => [page.rel, page]));
  const ruled = new Set(read.pages);
  for (const page of readPages) {
    if (!ruled.has(page.rel)) byRel.set(page.rel, { head: values.asPython(page.head), body: page.body });
  }
  read.linked = (rel) => {
    const page = byRel.get(rel);
    if (!page) return [];
    const out = [];
    for (const target of [...linksIn(Object.values(page.head || {})), ...linksIn(page.body)]) {
      for (const p of byStem.get(target) || []) out.push(p.rel);
    }
    return out;
  };
  return done();
}

// The path a sent item's `file:` names: under the desk folder, or itself when written in full.
// Joined as Python's pathlib joins `desk / file`: an empty part (a doubled or a trailing
// slash) and a `.` part are dropped, and nothing else is tidied, so `..` is the disk's to read.
function atDesk(desk, file) {
  const root = path.isAbsolute(file) ? path.parse(file).root : "";
  const parts = file
    .slice(root.length)
    .split(path.sep === "/" ? "/" : /[\\/]/)
    .filter((part) => part !== "" && part !== ".");
  return root ? `${root}${parts.join(path.sep)}` : [desk, ...parts].join(path.sep);
}

// What is at `file`, following links, as the sent item's `file:` is read: "a file", "a folder",
// "something other than a file or a folder", or null when nothing is. A sent item cites a file
// a reader can open, so only "a file" answers it; the finding says which of the others it met.
function whatIsAt(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (stat.isFile()) return "a file";
  return stat.isDirectory() ? "a folder" : "something other than a file or a folder";
}

module.exports = {
  RULES,
  NO_SECTION,
  SECOND_SECTION,
  UNCLOSED_FENCE,
  UNBACKED,
  REQUIRED,
  checkDesk,
  checkPages,
  narrowFindings,
};
