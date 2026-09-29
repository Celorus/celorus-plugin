"use strict";
// check_reconcile (row E6): holds a snapshot render_view drew to the views it was drawn from.
// Nobody types a number on the desk's pages; this reads the snapshot saved under celorus/.views/
// for a day, draws the same snapshot again from the desk log's first rows, as many as it recorded
// reading (round 5, row A13; base ruling R56), with the desk's other pages as they stand now, at
// the moment the saved page says it was taken, and holds every figure on the saved page to the fresh one, by its place
// on the page, never by its label. A figure that disagrees is a problem, said in words with both
// numbers. The whole saved page is then held to the whole fresh page, shell and content, by
// equality: its title, its heading and its generated_by line each by name, and any other
// difference as the page's text, so no part of the snapshot goes unread. The views are then held to each other and to the desk log file (counts.js
// checkReconcile). A snapshot that cannot be held at all is a hole, and the answer says why in
// words, never a pass. It writes nothing.

const { Refusal } = require("../lib/refusal.js");
const { readDesk, DESK_ARGUMENT } = require("../lib/desk.js");
const { Desk } = require("./desk.js");
const { systemsOf } = require("./systems.js");
const C = require("./counts.js");
const { deskRoot, plainFolder, plainFile, readPlain } = require("./files.js");
const W = require("./words.js");
const { pageContext } = require("../templates/parts.js");
const { PAGES } = require("../templates/pages.js");
const { STALL_COUNTS } = require("../templates/seats.js");
const { assemble } = require("../templates/base.js");
const { pathsSaid } = require("./screen.js");

const TOOL = "check_reconcile";
const ARGUMENTS = ["desk", "date", "systems"];
const VIEWS_REL = "celorus/.views";
const VIEW = "snapshot";
const KEY = "team";
// the line a snapshot page carries under its heading (templates/seats.js snapshot)
const TAKEN = /<p class="taken"><span>Taken at <b>([01]\d|2[0-3]):([0-5]\d)<\/b>/;
// the record of the desk-log rows the snapshot read at its moment (round 5, row A13)
const READ = /<script type="application\/json" id="rows-read">([^<]*)<\/script>/;
const DIGEST = /^[0-9a-f]{64}$/;

// The record a snapshot carries of the desk-log rows it read, {rows, digest}: how many, and one
// digest over them and the page's moment (base ruling R56). Null when it carries none that reads
// as one, as a page taken before the record held a count and a digest does.
function recordOf(html) {
  const m = READ.exec(html);
  if (!m) return null;
  let got;
  try {
    got = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const ok = got && typeof got === "object" && Number.isSafeInteger(got.rows) && got.rows >= 0 && typeof got.digest === "string" && DIGEST.test(got.digest);
  return ok ? { rows: got.rows, digest: got.digest } : null;
}

const rowsSaid = (n) => `${n} ${n === 1 ? "row" : "rows"}`;

// The record held to the desk log now, at the page's moment: the desk log's first rows, as many as
// the record read, digested with the moment the page says it was taken, are its digest. A writer
// adds a row after the last, so rows logged since sit after them and are not the snapshot's; a row
// it read and changed or removed since, a record edited by hand, or a Taken-at clock relabelled is
// a problem, in words.
function recordProblems(record, read, moment) {
  const lines = C.deskLogRows(read, record.rows);
  if (lines.length < record.rows) {
    return [
      `the snapshot read ${rowsSaid(record.rows)} of the desk log, and the desk log holds ${rowsSaid(lines.length)} now: a row it read has been removed since, or its record was edited`,
    ];
  }
  if (C.recordDigest(moment, lines) !== record.digest) {
    return [
      `the snapshot's digest of the desk log as it read it, ${rowsSaid(record.rows)} at ${moment.slice(11, 16)}, is not the digest of those rows now at that moment: a row it read has been changed since, or its record or its Taken-at clock was edited`,
    ];
  }
  return [];
}

// the words a piece of the page shows, its tags dropped
function plain(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// the part of a page from `start` to the first `end` after it, or "" when it has none
function part(html, start, end) {
  const at = html.indexOf(start);
  if (at < 0) return "";
  const to = html.indexOf(end, at + start.length);
  return to < 0 ? html.slice(at) : html.slice(at, to + end.length);
}

// The key in the page table a label is drawn for, read for any count it carries (W.counted), from
// `known`, [key, label] pairs; the label itself when it is none of them.
function keyOf(known, label) {
  const hit = known.find(([, said]) => said === label || W.counted(said, 1) === label);
  return hit ? hit[0] : label;
}

// Every figure a snapshot shows, keyed by its place on the page: [key, {what, shown}] in page
// order. The key never carries the figure or a label read for it (a label is read for the count it
// carries, so it changes with it); `what` names the figure in words. A funnel step and a count
// under the stall are keyed by their key in the page table, not by their place (round 5, row A11):
// a step or a count in a hole is on neither page, and no other figure moves into its place, so a
// figure is never held to a hole's neighbour and a hole is held only to a hole.
function figures(html) {
  const out = [];
  const add = (key, what, shown) => out.push([key, { what, shown }]);
  const week = /where the desk stands on the week <b>([^<]*)<\/b> to <b>([^<]*)<\/b>/.exec(html);
  if (week) add("week", "the week it covers", `${week[1]} to ${week[2]}`);
  const steps = /<div class="fn-step[^"]*">\n(?:<p class="fn-fell">(.*)<\/p>\n)?<b class="fn-v">([^<]*)<\/b>\n<p class="fn-lbl">([^<]*)<\/p>/g;
  const stepKeys = C.FUNNEL_KEYS.map(([key, label]) => [key, label]);
  let i = 0;
  for (const m of html.matchAll(steps)) {
    i += 1;
    const label = plain(m[3]);
    const key = `funnel ${keyOf(stepKeys, label)}`;
    add(key, `step ${i} of the funnel (${label})`, plain(m[2]));
    if (m[1] === undefined) continue;
    const kept = /<span class="fn-kept">([^<]*)<\/span>/.exec(m[1]);
    const stalls = m[1].includes('<span class="status');
    const fell = m[1].replace(/<span class="fn-kept">[^<]*<\/span>/, "").replace(/<span class="status.*$/, "");
    add(`${key} fell`, `the line over step ${i} of the funnel`, plain(fell));
    if (kept) add(`${key} kept`, `the share carried to step ${i} of the funnel`, plain(kept[1]));
    add(`${key} stalls`, `whether step ${i} of the funnel is where it stalls`, stalls ? "yes" : "no");
  }
  const stall = part(html, '<aside class="stall">', "</aside>");
  const said = /<p class="stall-said">(.*)<\/p>/.exec(stall);
  if (said) add("stall said", "the stall's sentence", plain(said[1]));
  const stallKeys = STALL_COUNTS.map(([key, label]) => [key, label]);
  i = 0;
  for (const m of stall.matchAll(/<div class="c[^"]*"><b>([^<]*)<\/b><span>([^<]*)<\/span>/g)) {
    i += 1;
    add(`stall ${keyOf(stallKeys, plain(m[2]))}`, `count ${i} under the stall (${plain(m[2])})`, plain(m[1]));
  }
  for (const m of html.matchAll(/<h2 class="head[^"]*"><span>([^<]*)<\/span><span class="count">([^<]*)<\/span>/g)) {
    add(`count ${plain(m[1])}`, `the count beside "${plain(m[1])}"`, plain(m[2]));
  }
  const seats = part(html, '<section class="block" id="seats">', "</section>");
  for (const row of seats.matchAll(/<tr(?: class="team")?><td class="seat">([^<]*)<\/td>((?:<td [^>]*>[^<]*<\/td>)+)<\/tr>/g)) {
    const name = plain(row[1]);
    for (const c of row[2].matchAll(/data-label="([^"]*)">([^<]*)</g)) {
      add(`seat ${name} ${c[1]}`, `${name}'s ${plain(c[1]).toLowerCase()} in the seats' table`, plain(c[2]));
    }
  }
  const seam = part(html, '<section class="block" id="seam">', "</section>");
  const seamSaid = /<p class="seam-said">(.*)<\/p>/.exec(seam);
  if (seamSaid) add("seam said", "the hand-over sentence", plain(seamSaid[1]));
  for (const m of part(seam, '<ul class="seam-key">', "</ul>").matchAll(/<b>([^<]*)<\/b><span class="w">([^<]*)<\/span>/g)) {
    add(`seam ${plain(m[2])}`, `the hand-overs ${plain(m[2])}`, plain(m[1]));
  }
  const rms = part(seam, '<aside class="rm-side">', "</aside>");
  const RM = /<li><span class="g"[^>]*>[^<]*<\/span><div><b>([^<]*)<\/b><span class="more"><span>(\d+) ([^<]*)<\/span><span>(\d+) ([^<]*)<\/span><\/span><\/div><span class="d">(\d+) ([^<]*)<\/span><\/li>/g;
  for (const m of rms.matchAll(RM)) {
    const name = plain(m[1]);
    add(`rm ${name} held`, `${name}'s meetings held`, m[2]);
    add(`rm ${name} acted`, `${name}'s book moments acted on`, m[4]);
    add(`rm ${name} handed`, `the leads handed to ${name}`, m[6]);
  }
  return out;
}

// The saved page's figures held to the fresh page's: what disagrees, in words.
function figureProblems(saved, fresh) {
  const problems = [];
  const now = new Map(fresh);
  const then = new Map(saved);
  for (const [key, f] of saved) {
    if (!now.has(key)) {
      problems.push(`the snapshot shows ${f.what} as ${JSON.stringify(f.shown)}, and the views count no such figure now`);
    } else if (now.get(key).shown !== f.shown) {
      problems.push(`the snapshot says ${now.get(key).what} is ${JSON.stringify(f.shown)}; counted from the views it is ${JSON.stringify(now.get(key).shown)}`);
    }
  }
  for (const [key, f] of fresh) {
    if (!then.has(key)) problems.push(`the views count ${f.what} as ${JSON.stringify(f.shown)}, and the snapshot does not show it`);
  }
  return problems;
}

// The parts of a page's shell held by name, each whole: where it is, in words, and how it is found.
const SHELL = [
  ["title", /<title>([\s\S]*?)<\/title>/],
  ["heading", /<h1>([\s\S]*?)<\/h1>/],
  ["generated_by line", /<meta name="generated_by" content="([^"]*)">/],
];

// The saved page held whole to the page drawn now, by equality, never containment: each named part
// of the shell that differs, in words with both, and then any other difference as the page's text.
// A figure already said to differ (`figured`) is not said a second time as a difference of text.
function shellProblems(saved, drawn, figured) {
  const problems = [];
  let restSaved = saved;
  let restDrawn = drawn;
  for (const [where, pattern] of SHELL) {
    const a = pattern.exec(saved);
    const b = pattern.exec(drawn);
    const now = b ? plain(b[1]) : "";
    if (!a) {
      problems.push(`the snapshot has no ${where}; the views draw it as ${JSON.stringify(now)}`);
    } else if (!b || a[0] !== b[0]) {
      problems.push(`the snapshot's ${where} reads ${JSON.stringify(plain(a[1]))}; the views draw it as ${JSON.stringify(now)}`);
    }
    if (a) restSaved = restSaved.replace(a[0], "");
    if (b) restDrawn = restDrawn.replace(b[0], "");
  }
  if (!figured && restSaved !== restDrawn) {
    problems.push(
      "the snapshot's text differs from the text the views draw now, outside its title, its heading and every figure it names: its rows or its words have moved since it was taken",
    );
  }
  return problems;
}

function checkReconcileTool(args = {}) {
  // required here, not at the top: index.js requires this file for its tool list
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  const { dayOf, drawnHere, drawnBy } = require("./index.js");
  onlyArguments(TOOL, args, ARGUMENTS);
  const day = dayOf(args.date);
  const st = systemsOf(args.systems);
  const read = readDesk(deskFor(args.desk));
  if (read.stampsUnread) {
    throw new Refusal(`The desk's stamps page ${read.stampsUnread.rel} cannot be read, so nothing is reconciled. Run check_desk to see why.`);
  }
  const desk = new Desk(read);
  const rel = `${VIEWS_REL}/${day}-${VIEW}-${KEY}.html`;
  const root = deskRoot(read.root);
  const hole = (why) => ({ day, snapshot: rel, reconciled: false, hole: why });
  if (!(plainFolder(root, "celorus") && plainFolder(root, VIEWS_REL) && plainFile(root, rel))) {
    return hole(`There is no snapshot of ${day} at ${rel}, so there is nothing to hold to the views. Take one with render_view (view snapshot) first.`);
  }
  const html = readPlain(root, rel);
  if (!drawnHere(html)) {
    return hole(`${rel} carries no generated_by line of render_view, so the engine did not count what it shows, and it is not read as a snapshot.`);
  }
  const taken = TAKEN.exec(html);
  if (!taken) {
    return hole(`${rel} does not say when it was taken (no "Taken at HH:MM" line), so the views cannot be counted at its moment.`);
  }
  const moment = `${day}T${taken[1]}:${taken[2]}:00+05:30`;
  const record = recordOf(html);
  if (!record) {
    return hole(`${rel} carries no record of the desk-log rows it read, so it cannot be drawn again as it was taken. Take it again with render_view (view snapshot).`);
  }
  // the desk as the snapshot read it (round 5, row A13): the desk log holds its first rows, as
  // many as the record read, and no row logged since. Only the desk log is rolled back; every
  // other page of the desk is read as it stands now (base ruling R56: the mechanism is owed)
  const problems = recordProblems(record, read, moment);
  const asRead = new Desk(C.deskAsRecorded(read, record.rows));
  // the whole page render_view draws for the same moment from those rows, shell and content, as
  // it draws it
  const data = C.snapshotView(asRead, st, day, moment);
  const drawn = assemble(PAGES[VIEW](data, {}, pageContext(asRead)), data, { firm: asRead.firm(), fixture: asRead.fixture, stamp: drawnBy() });
  const saved = figures(html);
  const figured = figureProblems(saved, figures(drawn));
  problems.push(...figured);
  problems.push(...shellProblems(html, drawn, figured.length > 0));
  problems.push(...C.checkReconcile(asRead, st, day, moment));
  // A problem quotes the snapshot's words as it holds them, but for a path in them, said as "(a
  // path)" (R73: no answer repeats a path; 0.19.0 K4c, met by the door walk's drive).
  return { day, snapshot: rel, taken_at: moment, figures: saved.length, reconciled: !problems.length, problems: problems.map(pathsSaid) };
}

const RECONCILE_TOOL = {
  name: TOOL,
  description:
    "Hold the desk's snapshot for a day to the views it was drawn from, and answer whether it " +
    "reconciles. The snapshot saved under celorus/.views/ is drawn again at the moment it says it " +
    "was taken, from the desk log's first rows, as many as it recorded reading, and every figure on " +
    "it is held to the fresh one. Only the desk log is rolled back to the snapshot's moment, so rows " +
    "logged in the desk log since do not move it. Every other page of the desk is read as it stands " +
    "now, so work done since on those pages, such as a follow-up marked done or a call reviewed the " +
    "same day, shows as a figure that moved. Rows it read and changed since are said to have " +
    "changed, and the figures that moved with them are named; the team " +
    "view, the consoles and the desk log file are held to each other. Each disagreement is said in " +
    "words with both numbers. A snapshot that cannot be held says why. Nothing is written.",
  inputSchema: {
    type: "object",
    properties: {
      desk: DESK_ARGUMENT,
      date: { type: "string", description: "The snapshot's day, as 2026-09-21. Leave it out for today in IST." },
      systems: {
        type: "object",
        description:
          "The rows read from the desk's connectors, as render_view takes them. Hand over the same " +
          "connectors the snapshot was drawn with; a row that changed since is a disagreement.",
      },
    },
    additionalProperties: false,
  },
  run: checkReconcileTool,
};

module.exports = { RECONCILE_TOOL, checkReconcileTool, figures };
