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
const K = require("./key.js");
const { deskRoot, plainFolder, plainFile, readPlain } = require("./files.js");
const W = require("./words.js");
const { pageContext, fellBack } = require("../templates/parts.js");
const { liveRows } = require("../live/live.js");
const { PAGES } = require("../templates/pages.js");
const { STALL_COUNTS } = require("../templates/seats.js");
const { assemble } = require("../templates/base.js");
const { persona, notUsed } = require("../lib/persona.js");
const { pathsSaid } = require("./screen.js");

const TOOL = "check_reconcile";
const ARGUMENTS = ["desk", "date", "systems"];
const VIEWS_REL = "celorus/.views";
const VIEW = "snapshot";
const KEY = "team";
// the line a snapshot page carries under its heading (templates/seats.js snapshot)
const TAKEN = /<p class="taken"><span>Taken at <b>([01]\d|2[0-3]):([0-5]\d)<\/b>/;
// The record a snapshot carries of the desk-log rows it read (round 5, row A13; DESK-147): read by
// render/key.js's recordOf, which the key's undo shares to tell a page this check reads.
const { recordOf } = K;

const rowsSaid = (n) => `${n} ${n === 1 ? "row" : "rows"}`;

// The record held to the desk log now, at the page's moment: the desk log's first rows, as many as
// the record read, digested with the moment the page says it was taken, are its digest. A writer
// adds a row after the last, so rows logged since sit after them and are not the snapshot's; a row
// it read and changed or removed since, a record edited by hand, or a Taken-at clock relabelled is
// a problem, in words. A sealed record's digest is made again with `key`, the key that sealed it,
// when this machine holds it; when it does not (`key` is null), the digest cannot be made again
// here, so the record's count alone is held and its rows are never said to have changed
// (DESK-147). Its seal and its key's id are held with the rest of the page, which is drawn again
// with the record made again (checkReconcileTool).
function recordProblems(record, read, moment, key) {
  const lines = C.deskLogRows(read, record.rows);
  if (lines.length < record.rows) {
    return [
      `the snapshot read ${rowsSaid(record.rows)} of the desk log, and the desk log holds ${rowsSaid(lines.length)} now: a row it read has been removed since, or its record was edited`,
    ];
  }
  if (record.key_id !== undefined && !key) return [];
  if (C.recordDigest(moment, lines, key) !== record.digest) {
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
  systemsOf(args.systems, { held: true });
  const read = readDesk(deskFor(args.desk));
  if (read.stampsUnread) {
    throw new Refusal(`The desk's stamps page ${read.stampsUnread.rel} cannot be read, so nothing is reconciled. Run check_desk to see why.`);
  }
  // The live-row contract (row E11, live/live.js), as render_view holds it: a role holding a
  // refused row is counted as not handed over, so the snapshot is held to the desk's own count of
  // it, and a row that names no one on the desk never counts toward a pass.
  const contract = liveRows(args.systems, read);
  const st = systemsOf(contract.systems);
  const desk = new Desk(read);
  const rel = `${VIEWS_REL}/${day}-${VIEW}-${KEY}.html`;
  const root = deskRoot(read.root);
  // the contract's answer, on every return: the roles counted as not handed over, and each refused
  // row by its role, list and rule, never by its value; always said, as empty lists when nothing was
  // refused (item 11, ruled), never left out
  const told = (answer) => ({ ...answer, fell_back: contract.fell_back, dropped: contract.dropped });
  const hole = (why) => told({ day, snapshot: rel, reconciled: false, hole: why });
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
  // DESK-147: the snapshot key this machine holds and can read, if any (render/key.js; nothing is
  // written, and no key is made here), and whether it is the one that sealed this record. A key
  // file that is there and cannot be read is never taken for no key.
  const holds = K.held(root);
  const unreadable = holds !== null && holds.unreadable === true;
  const key = holds === null || unreadable ? null : holds;
  const sealed = record.key_id !== undefined;
  const mine = sealed && key !== null && key.id === record.key_id;
  const problems = recordProblems(record, read, moment, mine ? key.key : null);
  const asRead = new Desk(C.deskAsRecorded(read, record.rows));
  // the whole page render_view draws for the same moment from those rows, shell and content, as
  // it draws it
  const data = C.snapshotView(asRead, st, day, moment);
  // the record it is drawn with: a sealed one made again with the key that sealed it, so a seal or
  // a key's id edited on the page differs from the page drawn now; where this machine does not
  // hold that key the seal cannot be made again, and the page is drawn with the record it carries
  if (sealed) data.read = mine ? C.rowsRead(asRead, moment, key.key) : record;
  const who = persona({ desk: asRead });
  const ctx = pageContext(asRead, who);
  const page = PAGES[VIEW](data, {}, ctx);
  // a role that fell back is said on the page, as render_view says it
  page.content += fellBack(ctx, contract.fell_back);
  const drawn = assemble(page, data, { firm: asRead.firm(), fixture: asRead.fixture, stamp: drawnBy(), persona: who });
  const saved = figures(html);
  const figured = figureProblems(saved, figures(drawn));
  problems.push(...figured);
  problems.push(...shellProblems(html, drawn, figured.length > 0));
  problems.push(...C.checkReconcile(asRead, st, day, moment));
  // A problem quotes the snapshot's words as it holds them, but for a path in them, said as "(a
  // path)" (R73: no answer repeats a path; 0.19.0 K4c, met by the door walk's drive).
  const held = { day, snapshot: rel, taken_at: moment, figures: saved.length };
  const said = problems.map(pathsSaid);
  // a desk's assistant_name that was set and refused is said, in words that never repeat it,
  // whichever of the answers below is given, and each through told (row E11)
  const named = notUsed(who) ? { assistant_name_not_used: notUsed(who) } : {};
  // DESK-147, each in the founder's words (render/key.js). A record sealed with a key this machine
  // does not hold is a hole in words: its count, its time and its figures are held above, and it
  // is never a pass. So is any record while the key file here cannot be read, in its own words:
  // whether its seal was removed cannot be told. A record with no seal, taken in or after the minute this seat's key was made,
  // is a problem: every snapshot this seat took since then is sealed. Any other record with no
  // seal is held as it was before snapshots were sealed, and the answer says it carries no key.
  if (unreadable) return told({ ...held, reconciled: false, hole: K.UNREADABLE_HOLE, problems: said, ...named });
  if (sealed && !mine) return told({ ...held, reconciled: false, hole: K.NOT_HELD, problems: said, ...named });
  if (!sealed && key !== null && moment.slice(0, 16) >= key.made.slice(0, 16)) {
    return told({ ...held, reconciled: false, problems: [K.STRIPPED, ...said], ...named });
  }
  return told({ ...held, reconciled: !problems.length, problems: said, ...(sealed ? {} : { seal: K.NO_KEY }), ...named });
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
    "words with both numbers. A snapshot's record is read with the snapshot key this machine holds: " +
    "a snapshot sealed with a key this machine does not hold is said in the answer's hole field and " +
    "does not count as a pass, and a snapshot that carries no key is checked as before and is said " +
    "in the answer's seal field; when this machine's key cannot be read, that is said in the " +
    "answer's hole field and no snapshot counts as a pass. A snapshot that cannot be held says " +
    "why. Nothing is written.",
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
