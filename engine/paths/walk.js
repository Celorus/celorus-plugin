"use strict";
// The walk behind the path page: every path of up to three hops from a start to the page asked
// about, over the desk's own pages. A start is a seat, or a person whose `standing` is
// `in-conversation`, never the page asked about, and a path never passes through a second start
// or through the same page twice. A hop is a `shown` or `said` proof line of a connection the
// desk's model draws, on a page of a kind the model puts at one end of it; a guess is never a
// hop.
//
// DESK-59, settled by the engine's port (gtm one-desk design, addendum 16 point 5): the walk is
// over PAIRS of pages. Two pages joined by more than one line are one hop, never two paths, and
// the hop carries every line between the pair as its facts, each with its own proof. Which line
// ranks the hop (shown before said, then the fresher) is the step's `best`; what the hop SAYS is
// all of `lines`.
//
// Leaving a firm: along a connection the model runs out of a firm to the far page's kind
// (model.leaves, the checker's own question), and, by the founder's ruling R11 of 2026-09-24
// (issue 4197, comment 5813430302, "B: let paths pass through a shared firm"), along
// `works_at` and `worked_at` backwards, to a page of the kind the model puts at their source
// end. So two people at one firm are a path through it, and addendum 15's rulings 3 to 5 fire
// on the page the founder read: the route through a shared former employer is found, folded
// under the shorter path it explains, and drawn. Firm to firm is still only what the model says.
//
// Links are read by check/text.js `linksIn` and nothing else (DESK-60).

const path = require("node:path");
const { strip, splitLines, compareText, isMapping } = require("../check/values.js");
const { linksIn, proofMatch, sectionSpan } = require("../check/text.js");
const model = require("../check/model.js");
const rules = require("../check/rules.js");
const { NOT_UTF8 } = require("../lib/desk.js");
const { ownWords } = require("./page.js");

const MAX_HOPS = 3;
// The founder's ruling R11 (issue 4197, comment 5813430302): the two employment
// connections a path may walk back out of a firm along.
const SHARED_FIRM = ["works_at", "worked_at"];

// The census's own words for a page whose lines it could not read, as the app's walk wrote them.
const UNBACKED_HERE = "a connection named on this page has no proof line the walk could read";
const NO_SECTION_HERE = "this page has no `## Connections` heading, so its connections were not read";
const MODEL_SPLIT_HERE =
  "the desk's connections page has something listed under layout, so what draws a line on this desk is not settled";
const SECOND_SECTION_HERE = "this page has a second `## Connections` heading, and the lines under it were not read";
const NO_LINE_HERE = "this page holds a connection line where no line is drawn, so it was not walked";
const NOT_DECODED_HERE = "the page did not decode, so its lines were not read";

// A page's `## Connections` section, line by line, and every other line on the page, both read
// off the page with its fenced blocks blanked, so the walk and the census stand on one index.
function connectionsOf(page) {
  const body = splitLines(page.outside);
  const span = sectionSpan(body, "Connections");
  const none = [];
  if (span === null) return [none, body];
  const [start, end] = span;
  return [body.slice(start, end), [...body.slice(0, start - 1), ...body.slice(end)]];
}

// Whether a path on a page of kind `here` may walk along `conn` to a page of kind `there`.
function mayLeave(m, here, there, conn) {
  if (model.leaves(m, here, there, conn)) return true;
  if (model.asKind(m, here) !== model.FIRM || !SHARED_FIRM.includes(conn)) return false;
  const ends = model.endsOf(m, conn);
  return ends !== null && ends[1].has(model.FIRM) && ends[0].has(model.asKind(m, there));
}

// Shown before said, then the fresher, then by page and line, so one pair always ranks by the
// same line.
function strongestFirst(lines) {
  const ordered = [...lines].sort((a, b) => compareText(a.page, b.page) || compareText(a.line, b.line));
  ordered.sort((a, b) => compareText(b.date, a.date));
  ordered.sort((a, b) => (a.proof === "said") - (b.proof === "said"));
  return ordered;
}

function compareNodes(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const c = compareText(a[i], b[i]);
    if (c) return c;
  }
  return a.length - b.length;
}

// The names a page answers to, as its header writes them: its title and each of its aliases. The
// tool resolves `to` by these (index.js), and a link's label restates its target by them (page.js
// ownWords), so the two cannot disagree about one page.
function namesOf(page) {
  const head = isMapping(page.head) ? page.head : {};
  const out = [];
  if (typeof head.title === "string") out.push(head.title);
  if (Array.isArray(head.aliases)) out.push(...head.aliases.filter((a) => typeof a === "string"));
  else if (typeof head.aliases === "string") out.push(head.aliases);
  return out;
}

function pairKey(one, two) {
  return compareText(one, two) < 0 ? [one, two] : [two, one];
}

// Whether a hop's proof rests only on lines whose own words narrow or deny the link (page.js
// ownWords, the one detector the hop sentence and the drawing use): every line between its pair
// of the hop's own proof word carries such words, so none of them states the bare tie.
const qualifiedHop = (step) => step.lines.every((l) => l.proof !== step.best.proof || ownWords(l) !== null);

// A path: its pages in the order walked, and one step per hop. It is `qualified` (the base's
// ruling R19, issue 4197, comment 5816863817) when its weakest hop rests only on such lines: a hop
// of the proof word the path is headed by (said when any hop is said) that is a qualifiedHop.
function pathOf(nodes, steps) {
  const said = steps.some((step) => step.best.proof === "said");
  return {
    nodes,
    steps,
    said,
    qualified: steps.some((step) => (step.best.proof === "said") === said && qualifiedHop(step)),
    asOf: steps.map((step) => step.best.date).sort(compareText)[0],
  };
}

// Every path to `target` over the desk `read` (lib/desk.js readDesk), ranked: shown before said,
// then, within one proof word, a qualified path after the rest (R19), then fewer hops, then fresher (a path is as fresh as its oldest hop), then by the pages along
// it. Returns { paths, unwalked, cut, people, known }: `unwalked` is every line the walk did not
// walk that the page must admit to, `cut` whether a route was still opening out at the third
// hop, `people` the file names the desk calls a person, and `known` those it gives any kind.
// `findings` is this desk's check, when the caller has it. Throws model.ModelUnreadable.
function walkTo(read, target, findings = null) {
  const root = path.join(read.root, "celorus");
  const m = model.loadDeskModel(root);
  const all = rules.checkPages(read.pages);
  const pages = all.filter((page) => model.walked(m, page));
  const stems = new Set(pages.map((page) => page.stem));
  const kindOf = new Map(pages.map((page) => [page.stem, page.type]));
  const farNames = new Map(pages.map((page) => [page.stem, namesOf(page)]));
  const startsHere = (page) =>
    page.type === "seat" || (page.type === "person" && isMapping(page.head) && page.head.standing === "in-conversation");
  const starts = new Set(pages.filter(startsHere).map((page) => page.stem));
  starts.delete(target);

  const pairs = new Map();
  for (const page of pages) {
    const [section] = connectionsOf(page);
    section.forEach((raw, index) => {
      const read = proofMatch(raw);
      if (!read || read.proof === "guessed" || !m.draws.includes(read.conn)) return;
      if (!model.drawsOn(m, kindOf.get(page.stem), read.conn)) return;
      for (const other of linksIn(read.target)) {
        if (!stems.has(other) || other === page.stem) continue;
        const line = {
          page: page.stem,
          target: other,
          conn: read.conn,
          proof: read.proof,
          date: read.date,
          line: strip(raw.slice(2)),
          // The far end as the line wrote it, which may say more than the link (page.js).
          field: strip(read.target),
          // The far page's title and aliases, which a label may restate (page.js ownWords).
          farNames: farNames.get(other),
          index,
          rel: page.rel,
        };
        const key = JSON.stringify(pairKey(page.stem, other));
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push(line);
      }
    });
  }

  const near = new Map();
  const drawn = new Set();
  const keys = [...pairs.keys()].sort((a, b) => compareNodes(JSON.parse(a), JSON.parse(b)));
  for (const key of keys) {
    const [one, two] = JSON.parse(key);
    const lines = strongestFirst(pairs.get(key));
    const forth = [one, two];
    const back = [two, one];
    for (const [here, there] of [forth, back]) {
      const walkable = lines.filter((l) => mayLeave(m, kindOf.get(here), kindOf.get(there), l.conn));
      if (!walkable.length) continue;
      if (!near.has(here)) near.set(here, []);
      near.get(here).push({ from: here, to: there, best: walkable[0], lines });
      for (const l of walkable) drawn.add(JSON.stringify([l.rel, l.index, l.target]));
    }
  }

  const found = [];
  let cut = false;
  const walk = (nodes, steps) => {
    const last = nodes[nodes.length - 1];
    if (last === target) {
      found.push(pathOf(nodes, steps));
      return;
    }
    const next = near.get(last) || [];
    if (steps.length === MAX_HOPS) {
      cut = cut || next.some((step) => !nodes.includes(step.to) && !starts.has(step.to));
      return;
    }
    for (const step of next) {
      if (!nodes.includes(step.to) && !starts.has(step.to)) walk([...nodes, step.to], [...steps, step]);
    }
  };
  for (const start of [...starts].sort(compareText)) walk([start], []);
  found.sort((a, b) => compareNodes(a.nodes, b.nodes));
  found.sort((a, b) => compareText(b.asOf, a.asOf));
  found.sort((a, b) => a.said - b.said || a.qualified - b.qualified || a.steps.length - b.steps.length);

  return {
    paths: found,
    unwalked: unwalked(read, m, all, drawn, findings),
    cut,
    people: new Set(all.filter((page) => page.type === "person").map((page) => page.stem)),
    known: new Set(all.filter((page) => typeof page.type === "string" && page.type).map((page) => page.stem)),
  };
}

// Every line on a page that the walk did not walk and the page must admit to: all of them under
// `## Connections`, the proof lines it can read elsewhere, and the page itself where the check
// lists one of five things about it (C06, C14, a second Connections heading, C15, and, on every
// page of a drawn kind, a connections page listed under layout). Asked of the check rather than
// worked out again, so the page and the check cannot disagree about one desk.
function unwalked(read, m, pages, drawn, findings) {
  const found = findings || rules.checkDesk(read.root, read.pages);
  const pagesOf = (keep) => new Set(found.filter(keep).map((f) => f.page));
  const unbacked = pagesOf((f) => f.rule === rules.UNBACKED);
  const noSection = pagesOf((f) => f.rule === "C14");
  const modelSplit = found.some((f) => f.page === "model/connections.md" && f.rule === "C12");
  const secondSection = pagesOf((f) => f.message === rules.SECOND_SECTION);
  const drawsNoLine = pagesOf((f) => f.rule === "C15");
  const drawnKinds = model.drawnKinds(m);
  const out = [];
  for (const page of pages) {
    if (page.problem === NOT_UTF8) {
      out.push(`${page.rel}: ${NOT_DECODED_HERE}`);
      continue;
    }
    if (page.fenceOpen) {
      out.push(`${page.rel}: ${rules.UNCLOSED_FENCE}`);
      continue;
    }
    if (unbacked.has(page.rel)) out.push(`${page.rel}: ${UNBACKED_HERE}`);
    if (noSection.has(page.rel)) out.push(`${page.rel}: ${NO_SECTION_HERE}`);
    if (modelSplit && drawnKinds.has(page.type)) out.push(`${page.rel}: ${MODEL_SPLIT_HERE}`);
    if (secondSection.has(page.rel)) out.push(`${page.rel}: ${SECOND_SECTION_HERE}`);
    if (drawsNoLine.has(page.rel)) out.push(`${page.rel}: ${NO_LINE_HERE}`);
    const [section, elsewhere] = connectionsOf(page);
    for (const raw of elsewhere) {
      const read = proofMatch(raw);
      if (read && model.turnedAway(m, read)) out.push(`${page.rel}: ${strip(raw)}`);
    }
    section.forEach((raw, index) => {
      const line = strip(raw);
      if (!line) return;
      const read = proofMatch(raw);
      if (read === null) {
        out.push(`${page.rel}: ${line}`);
        return;
      }
      if (!model.turnedAway(m, read)) return;
      const far = linksIn(read.target).filter((end) => end !== page.stem);
      const ends = far.length ? far : [""];
      if (ends.some((end) => !drawn.has(JSON.stringify([page.rel, index, end])))) out.push(`${page.rel}: ${line}`);
    });
  }
  return out.sort(compareText);
}

module.exports = { MAX_HOPS, SHARED_FIRM, walkTo, mayLeave, connectionsOf, compareNodes, namesOf };
