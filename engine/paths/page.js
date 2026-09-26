"use strict";
// The path page's words: how it reads is addendum 15 (gtm one-desk design, the founder's five
// rulings of 2026-09-22), and its parts are the app's path page (a ranked list of paths, shown
// before said, then fewer hops, then fresher; five at most; the no-path lines; a Mermaid drawing
// whose every name opens its page).
//
//   1. The preamble comes off. One sentence stays: "Generated; edit the pages, never this view."
//   2. A hop is one sentence a person would read: who, the connection in plain words, and its
//      proof as a clause carrying the quote and where it was said.
//   3. A longer path with the same people folds (fold.js), and its extra hops are said on the
//      hop they explain.
//   4. A hop states both facts when both are recorded: knowing someone and having worked with
//      them each keep their own proof; two people who share an employer are said as "they both
//      worked at".
//   5. The drawing stays, and draws every hop the page keeps, the folded ones included.
//
// Every word of a fact comes off its line; only the joins are the writer's. Links are read by
// check/text.js `linksIn` alone, and written by `wikilink` alone (DESK-60).

const { BLANK_CLASS, strip, compareText } = require("../check/values.js");
const { linksIn, proofMatch } = require("../check/text.js");

// The one place under engine/paths that writes a link (DESK-60). It builds text only: what it
// returns is printed, or, in ownWords, compared whole with a field linksIn has already read. No
// link is ever found by it; the behaviour guard in paths.test.js holds that.
function wikilink(stem) {
  return `[[${stem}]]`;
}

// NUL, the separator a list of file names is joined with to compare it whole, since no file name
// holds it. Built by its code point: no source under engine/paths writes a `\u` escape (DESK-60,
// fix round 8).
const NUL = String.fromCodePoint(0);

const EDIT_PAGES = "Generated; edit the pages, never this view.";
// What ownWords counts as the far page's own name, said in restatesName's order (fix round 10,
// the cut clause fix round 11): knownNames keeps a name that holds a word (a character that is
// not a blank) and makes each run of blanks one space with the ends trimmed (spaced), so a cut is
// only at a blank between two words, never at a name's leading or trailing blanks; then the
// label and each cut are put through normal(): NFKC, then toLowerCase (not case folding), then
// each run of blanks one space, then the ends trimmed. paths.test.js reads the sentence clause by
// clause (sentenceSays) and compares it with restatesName over every BMP code point.
// Printed under a qualified path's heading and published in the tool's description (index.js),
// so the two cannot drift apart.
const NAME_RULE =
  "A label counts as the far page's own name when it matches that page's file name with hyphens " +
  "read as spaces, its title or an alias it declares, when that name holds a word, whole or cut " +
  "short at a blank between two of its words, both compared after compatibility normalisation, " +
  "then lower-casing, then collapsing runs of blanks to one space and trimming the ends; " +
  "punctuation counts. Any other form is shown as written until the page declares it under " +
  "`aliases`.";
// The line under a qualified path's heading (R19).
const QUALIFIED =
  "Qualified: this path's weakest hop rests only on lines that write their far end in their own " +
  `words, shown as written. ${NAME_RULE}`;
const SHOWN_PATHS = 5;
const HOPS = { 1: "one hop", 2: "two hops", 3: "three hops" };

// A connection in plain words, with one page as its subject and with two. A connection nobody
// has spelt here still reads, as its own name with the underscores opened out.
const WORDS = {
  knows: "knows",
  works_at: "works at",
  worked_at: "worked at",
  introduced_by: "was introduced by",
  part_of: "is part of",
  member_of: "is a member of",
};
const BOTH = {
  knows: "know",
  works_at: "work at",
  worked_at: "worked at",
  introduced_by: "were introduced by",
  part_of: "are part of",
  member_of: "are members of",
};
// Where a line stands, by its register.
const REGISTER = { yours: "in our own record", web: "in public research", record: "in the record" };

const words = (conn) => WORDS[conn] || conn.replace(/_/g, " ");
const both = (conn) => BOTH[conn] || conn.replace(/_/g, " ");

// A citation at the end of a line, `from <path>:<line>` or `from <path>:<first>-<last>` (gtm
// addendum 12). Read here only to say it; the citation grammar itself is engine/cite's.
const CITED = /^from (\S+:\d+(?:-\d+)?)$/u;

// Whether what is left after a candidate quote is what a writer puts after one: a speaker, a
// note, or nothing.
function follows(rest) {
  return !rest.length || rest[0].startsWith("said by ") || rest[0].startsWith("tie ");
}

// A proof line read back into the fields a person reads, or null when it is not one. `raw` is
// the line as the page holds it without its bullet. The fields after the date are split at the
// middle dot; the quote is the shortest span from the first field that opens with a quote mark
// whose remainder reads as a speaker, a note or nothing, since a quote may hold the separator
// itself; a speaker and a conversation are links, read by linksIn; the note runs from `tie ` to
// the end; any other field is kept as a note too, so no word on the line is lost.
function told(raw) {
  const read = proofMatch(`- ${raw}`);
  if (read === null) return null;
  const fields = read.rest.split("·").map(strip).filter(Boolean);
  let cite = null;
  const last = fields.length ? CITED.exec(fields[fields.length - 1]) : null;
  if (last) {
    cite = last[1];
    fields.pop();
  }
  let quote = null;
  let before = fields;
  let after = [];
  const first = fields.findIndex((f) => f.startsWith('"'));
  if (first !== -1) {
    const closes = [];
    for (let i = first; i < fields.length; i += 1) {
      if (fields[i].endsWith('"') && (i > first || fields[i].length > 1)) closes.push(i);
    }
    const end = closes.find((i) => follows(fields.slice(i + 1)));
    const close = end !== undefined ? end : closes.length ? closes[closes.length - 1] : null;
    if (close !== null) {
      quote = fields.slice(first, close + 1).join(" · ").slice(1, -1);
      before = fields.slice(0, first);
      after = fields.slice(close + 1);
    }
  }
  const scan = quote === null ? before : after;
  let conversation = null;
  const other = [];
  for (const f of before) {
    const link = f.startsWith("in ") ? linksIn(f.slice(3))[0] : undefined;
    if (link !== undefined && conversation === null) conversation = link;
    else if (quote !== null) other.push(f);
  }
  let saidBy = null;
  let note = null;
  for (let i = 0; i < scan.length; i += 1) {
    const f = scan[i];
    if (f.startsWith("tie ")) {
      note = scan.slice(i).join(" · ").slice(4);
      break;
    }
    if (f.startsWith("said by ") && saidBy === null && linksIn(f.slice(8)).length) {
      saidBy = linksIn(f.slice(8))[0];
      continue;
    }
    const link = f.startsWith("in ") ? linksIn(f.slice(3))[0] : undefined;
    if (quote === null && link !== undefined && link === conversation) continue;
    other.push(f);
  }
  const notes = [...other, ...(note === null ? [] : [note])];
  return {
    conn: read.conn,
    proof: read.proof,
    register: read.register,
    date: read.date,
    conversation,
    quote,
    saidBy,
    note: notes.length ? notes.join(" · ") : null,
    cite,
  };
}

// One line's proof as a clause: who said or showed it and when, where it was said, where it
// stands, the words themselves, the source, and any note on the line. A name with no page on
// the desk is written plain, since a link to it would offer to make an empty page.
function proofClause(raw, link) {
  const read = told(raw);
  if (read === null) return raw;
  const spoke =
    read.proof === "said" && read.saidBy ? `${link(read.saidBy)} said so` : read.proof === "said" ? "Said" : "Shown";
  const heard = read.conversation ? ` in ${link(read.conversation)}` : "";
  const stands = REGISTER[read.register] || `in ${read.register}`;
  // A speaker on a line that is not `said` is not the subject of the clause, so it is said after
  // where the line stands, and never dropped.
  const by = read.proof !== "said" && read.saidBy ? `, said by ${link(read.saidBy)}` : "";
  const quoted = read.quote ? `: "${read.quote}"` : "";
  const source = read.cite ? `, from ${read.cite}` : "";
  const note = read.note ? ` The note on the line: ${read.note}.` : "";
  return `${spoke} on ${read.date}${heard}, ${stands}${by}${quoted}${source}.${note}`;
}

// A text as the own-words rule compares it: NFKC, then toLowerCase, then each run of blanks one
// space, then the ends trimmed; no other step. toLowerCase is the call index.js resolves `to`
// with; until fix round 10 this was toLocaleLowerCase("und") (the pull request's fix round 10
// records the comparison of the two).
// A blank is the engine's one rule, Python's whitespace (check/values.js BLANK_CLASS and strip,
// fix round 7), the rule linksIn trims a name by.
const BLANKS = new RegExp(`(?:${BLANK_CLASS}|\n)+`, "gu");
// Blanks alone: each run one space, trimmed, as normal() does it, and nothing else changed.
const spaced = (text) => strip(String(text).replace(BLANKS, " "));
const normal = (text) => strip(String(text).normalize("NFKC").toLowerCase().replace(BLANKS, " "));

// The two separators a link may hold, masked so that linksIn reads the whole of a link's inside
// as its name: the label after `|`, the part after `#`. A field that already holds a mask
// character cannot be rebuilt as it was written, so it is never bare. Private-use code points,
// built by code point (no `\u` escape under engine/paths, fix round 8).
const LABEL_MASK = String.fromCodePoint(0xe000);
const PART_MASK = String.fromCodePoint(0xe001);
const unmask = (text) => text.split(LABEL_MASK).join("|").split(PART_MASK).join("#");

// The names a target is known by (fix round 4): its file name with hyphens read as spaces, its
// page's title and each of its aliases (walk.js namesOf, the names the tool resolves `to` by),
// each run of blanks made one space and the ends trimmed (spaced), and no other step, so that
// restatesName cuts each only at a blank between two of its words (fix rounds 8 and 11); a name
// with no word (blanks alone, or nothing) is dropped.
const knownNames = (line) => [line.target.split("-").join(" "), ...(line.farNames || [])].map(spaced).filter(Boolean);

// Whether a label restates the target: it equals a known name, or that name cut short at a blank
// between two of its words, each compared under normal(), punctuation kept: `Ravi` for Ravi
// Sample, `Ravi,` (never `Ravi`) for Ravi, Sample. A name is cut before NFKC (fix round 8), so a
// space NFKC makes, as from U+00B4, which it reads as a space and a combining accent, is never a
// cut.
function restatesName(label, names) {
  const said = normal(label);
  return names.some((name) => {
    const words = name.split(" ");
    return words.some((_, n) => normal(words.slice(0, n + 1).join(" ")) === said);
  });
}

// The words a line wrote for its far end, when they say more than the bare link to it, or null.
// A hop never states a tie the record does not hold, so such words are the claim's far end,
// verbatim, and never cut down to the link. This is the one detector: the hop sentence, the
// drawing's edge and the heading's `qualified` (walk.js) all ask it.
//
// Fix round 4: bare is a closed set of cases, decided by exact match, never by splitting words.
// A field is bare only when all three hold:
//   (a) it holds exactly one link, to the target, with nothing but whitespace outside it;
//   (b) the link has no label, or its label, normalised, restates a known name (restatesName);
//   (c) the link has no `#part` (fix round 5). A part names a section of the far page, never the
//       page itself, so it narrows or qualifies the tie (`#Pension fund`, a family member's
//       section, a profile's own `#Not established`): ruling 4 makes only a label bare.
// Everything else is the line's own words, shown verbatim. A form that is neither a known name nor
// that name cut at a space (`Dr Ravi Sample` for the title `Dr. Ravi Sample`) is own words until the
// far page declares it under `aliases`; exact match errs toward showing the line's words, and
// NAME_RULE says so to the reader. linksIn reads the link: once as it
// is, and once with its two separators masked, so that it returns the link's whole inside, which
// is then written back with `wikilink` and compared with the field for (a).
function ownWords(line) {
  if (typeof line.field !== "string") return null;
  const names = linksIn(line.field);
  if (names.length !== 1 || names[0] !== line.target) return line.field;
  const whole = linksIn(line.field.split("|").join(LABEL_MASK).split("#").join(PART_MASK));
  if (whole.length !== 1) return line.field;
  const inside = unmask(whole[0]);
  const spelt = [inside, ` ${inside}`, `${inside} `, ` ${inside} `].map((text) => normal(wikilink(text)));
  if (!spelt.includes(normal(line.field))) return line.field;
  const [head, ...labelled] = whole[0].split(LABEL_MASK);
  if (head.includes(PART_MASK)) return line.field;
  if (labelled.length && !restatesName(unmask(labelled.join(LABEL_MASK)), knownNames(line))) return line.field;
  return null;
}

// The facts one step says: its lines grouped by connection, direction and the words written for
// the far end, strongest first.
function factsOf(step) {
  const groups = new Map();
  for (const line of step.lines) {
    const said = ownWords(line);
    const key = JSON.stringify([line.conn, line.page, line.target, said]);
    if (!groups.has(key)) groups.set(key, { conn: line.conn, subject: line.page, object: line.target, said, lines: [] });
    groups.get(key).lines.push(line);
  }
  return [...groups.values()];
}

// A fact as a claim: its subject, the connection in plain words, and its far end as its line
// wrote it.
const claimOf = (f, link) => `${link(f.subject)} ${words(f.conn)} ${f.said === null ? link(f.object) : f.said}`;

// What one kept hop says: its own facts, then the facts of the hops that folded onto it. Two
// folded facts of one connection to one page, whose subjects are the hop's own two ends, are one
// fact: "they both worked at" (ruling 4), unless a line says more about that page than its link.
function claimsOf(step, reasons, link) {
  const own = factsOf(step).map((f) => ({ ...f, claim: claimOf(f, link) }));
  const folded = reasons.flatMap(factsOf);
  const ends = [step.from, step.to].sort(compareText).join(NUL);
  const out = [];
  const used = new Set();
  folded.forEach((fact, i) => {
    if (used.has(i)) return;
    const pair = folded
      .map((f, j) => [f, j])
      .filter(([f, j]) => j !== i && !used.has(j) && f.conn === fact.conn && f.object === fact.object && f.said === null);
    const subjects = [fact, ...pair.map(([f]) => f)].map((f) => f.subject);
    if (fact.said === null && pair.length && [...new Set(subjects)].sort(compareText).join(NUL) === ends) {
      pair.forEach(([, j]) => used.add(j));
      out.push({
        conn: fact.conn,
        subject: null,
        object: fact.object,
        lines: [fact, ...pair.map(([f]) => f)].flatMap((f) => f.lines),
        claim: `they both ${both(fact.conn)} ${link(fact.object)}`,
        parts: [fact, ...pair.map(([f]) => f)],
      });
      return;
    }
    out.push({ ...fact, claim: claimOf(fact, link) });
  });
  return [...own, ...out];
}

function quoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

// An edge's label: the connection and the proof of the fact's strongest line. Where the line
// wrote words of its own for its far end (ownWords), the label carries them verbatim, as the hop
// sentence does, so no arrow states the bare tie those words deny or qualify. Such a label is
// quoted for Mermaid, with a quote mark and a hash written as its entity.
function edgeLabel(fact) {
  const proof = fact.lines[0].proof;
  if (fact.said === null) return `${fact.conn}, ${proof}`;
  const text = `${words(fact.conn)} ${fact.said}, ${proof}`.replace(/#/g, "#num;").replace(/"/g, "#quot;");
  return `"${text}"`;
}

// The drawing of every hop the page keeps, folded ones included: one arrow per fact, from the
// page its line is written on to the page the line names, labelled by edgeLabel; node ids are
// n1, n2, ... in the order met, and every node's text is its file name, with
// `class ... internal-link`, so each one opens its page.
function drawing(kept) {
  const ids = new Map();
  const id = (stem) => {
    if (!ids.has(stem)) ids.set(stem, `n${ids.size + 1}`);
    return ids.get(stem);
  };
  const edges = [];
  for (const { path, reasons } of kept) {
    path.steps.forEach((step, j) => {
      for (const s of [step, ...reasons[j]]) {
        id(s.from);
        id(s.to);
        for (const fact of factsOf(s)) {
          const edge = `  ${id(fact.subject)} -->|${edgeLabel(fact)}| ${id(fact.object)}`;
          if (!edges.includes(edge)) edges.push(edge);
        }
      }
    });
  }
  return [
    "```mermaid",
    "graph LR",
    ...[...ids].map(([stem, n]) => `  ${n}["${stem}"]`),
    ...edges,
    `  class ${[...ids.values()].join(",")} internal-link`,
    "```",
  ];
}

// The line a path page carries when it found no path, by what the walk can stand behind.
function noPath(walk, target) {
  if (walk === null) return `No page named ${target} is on this desk.`;
  if (walk.unwalked.length) {
    return (
      `No path was found from a seat, or someone you are in conversation with, to ${wikilink(target)}. ` +
      "Some lines on this desk were not walked, so this is not the same as nothing connecting them. " +
      "`check-desk` lists what it can see."
    );
  }
  if (walk.cut) {
    return (
      `No path was found from a seat, or someone you are in conversation with, to ${wikilink(target)} ` +
      "in three hops. There may be a longer one this page does not walk."
    );
  }
  return `Nothing on this desk connects a seat, or someone you are in conversation with, to ${wikilink(target)}.`;
}

// The whole page. `title` is the page's own title (or the file name), `onDesk` the file names on
// the desk, `walk` the walk (null when no page has that name), `kept` the folded paths.
function renderPage({ target, title, onDesk, walk, kept, now, version }) {
  const link = (stem) => (onDesk.has(stem) ? wikilink(stem) : stem);
  const body = [`# Who can introduce you to ${title}`, "", EDIT_PAGES];
  if (!kept.length) body.push("", "## No path yet", "", noPath(walk, target));
  const shown = kept.slice(0, SHOWN_PATHS);
  shown.forEach(({ path, reasons }, n) => {
    // R19: a flag on the proof word when the path's weakest hop rests only on qualified lines.
    const proof = `${path.said ? "said" : "shown"}${path.qualified ? ", qualified" : ""}`;
    body.push("", `## Path ${n + 1}: ${proof}, ${HOPS[path.steps.length]}, as of ${path.asOf}`, "");
    if (path.qualified) body.push(QUALIFIED, "");
    body.push(`Starts at ${link(path.nodes[0])}.`);
    path.steps.forEach((step, j) => {
      const claims = claimsOf(step, reasons[j], link);
      body.push("", `${j + 1}. ${claims.map((c) => c.claim).join(", and ")}.`);
      for (const claim of claims) {
        const lead = claims.length > 1 ? `That ${claim.claim}: ` : "";
        for (const line of claim.lines) body.push("", `   ${lead}${proofClause(line.line, link)}`);
      }
    });
  });
  if (kept.length > SHOWN_PATHS) {
    body.push("", `${kept.length - SHOWN_PATHS} more, longer or less sure, are not shown.`);
  }
  if (shown.length) body.push("", "## The hops, drawn", "", ...drawing(shown));
  const head = [
    "---",
    "type: view",
    `title: ${quoted(`Who can introduce you to ${title}`)}`,
    `description: ${quoted(`Paths to ${target} over this desk's own pages`)}`,
    `timestamp: ${quoted(now)}`,
    `path_to: ${quoted(target)}`,
    `generated_by: ${quoted(`celorus-plugin ${version} who_can_introduce`)}`,
    "---",
    "",
  ];
  return `${[...head, ...body].join("\n")}\n`;
}

// knownNames and restatesName are exported for paths.test.js alone, which compares the sentence
// with them (fix round 10).
module.exports = { EDIT_PAGES, NAME_RULE, QUALIFIED, SHOWN_PATHS, told, proofClause, ownWords, knownNames, restatesName, factsOf, claimsOf, drawing, noPath, renderPage };
