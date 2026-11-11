"use strict";
// Every view's numbers and rows, counted from the desk and the systems rows the skill handed
// over. The model never counts: it gets these rows and writes sentences about them. This is data
// only; the pages that draw it are in engine/templates. The morning brief draws from the rep,
// RM and team views here, and the consoles, the team view and the snapshot (row E6) draw from
// the same functions (base ruling R12).
//
// Ported from the demo kit's counts.py (row E5). The kit's live rows (a block read live from a
// real connector, `live`) are row E11's and are not here. The kit's shared list of real leads
// is not here either: the product carries none, so a rep's real leads are always none.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { linkSpans, linkName, bareLinkNames } = require("../check/text.js");
const { sha256 } = require("../update/digest.js");
const { pyStrip } = require("../write/text.js");
const { deskHeadNamed } = require("../write/facts.js");
const { unlink, readTable } = require("./desk.js");
const { splitPage } = require("../lib/desk.js");
const { withGeneratedBy } = require("../write/pages.js");
const { crmExport, nameKey } = require("./export.js");
const S = require("./systems.js");
const { asDate, daysBetween, addDays, dateLabel, shortDate } = require("./words.js");

const QUIET_DAYS = 5;
const FRESH_SIGNAL_DAYS = 7;
const BOOK_SIGNAL_DAYS = 30;
const STALE_SUPPLY_DAYS = 5;
const WEEK = 7;
const TOUCHES = new Set(["mail", "call", "meeting-set"]);
const REP_BLOCKS = ["to_calendar", "new_from_signals", "to_reach", "follow_ups_due", "quiet", "critical_mail", "chat", "crm_gaps", "backlog"];
const WEEK_KEYS = ["reached", "replies", "meetings_set", "handed_over"];
// the desk's funnel, in the order a lead moves through it: the key in the totals, the label a
// page sets over the step, and the short word a sentence about the step uses
const FUNNEL_KEYS = [
  ["leads", "Leads with the team", "leads"],
  ["reached", "Reached this week", "reached"],
  ["replies", "Replied", "replied"],
  ["meetings_set", "Meetings set", "meetings set"],
  ["handed_over", "Handed to RMs", "handed on"],
];
// the words a seat's role is said in, with its article
const ROLE_WORDS = { rep: ["an", "SDR"], rm: ["an", "RM"], "desk-head": ["a", "desk head"] };
const HAND_OVER = /^to ([a-z0-9][a-z0-9-]*)$/;
// assign_lead's line in log.md (write/writers.js assignLead): "assigned ", the family's link, then
// what AFTER_ASSIGNED reads, the seat and the list (assignedLine), and on a graph the common file
const ASSIGNED = "assigned ";
const AFTER_ASSIGNED = /^ to ([a-z0-9][a-z0-9-]*) \((.*)\)(?: in common\/queues\/supplied\.md)?$/;
// the desk's own folder, which a follow-up's source may name in front of its path
const DESK_FOLDER = "celorus";

// What each connector's rows leave uncounted when they are not handed over, and what a desk with
// no family pages leaves uncounted: desk_count's holes, in its own words (round 3, row A6). The
// morning brief draws a figure in one of these holes as the hole, never as 0.
const NOT_HANDED_OVER = {
  crm:
    "The CRM's rows were not handed over, so nothing the CRM holds is read: no record, phone or " +
    "logged touch, no family reads as in the CRM, and every call and meeting reads as not in it.",
  calendar: "The calendar's rows were not handed over, so no meeting, event or proposed meeting is counted.",
  mail: "The mailbox's threads were not handed over, so no thread is counted, critical or quiet.",
  chat: "The chat's messages were not handed over, so no message waiting on a reply is counted.",
};
const NO_FAMILIES = "This desk has no family pages under families/, so no family is counted.";
// an RM's view counts its book moments over the families: with none, the 0 is no count
const NO_BOOK_MOMENTS =
  "This desk holds no family pages under families/, so no book moment can be counted: " +
  "book_moments here is not a count of the desk's families.";
const EVERY_ROLE = ["crm", "calendar", "mail", "chat"];
// The connectors each seat's view reads, as desk_count reads them: an RM's reads no CRM row.
const VIEW_READS = { rep: EVERY_ROLE, rm: ["calendar", "mail", "chat"], "desk-head": EVERY_ROLE };
// The one table of what each figure and block of each seat page reads beyond the desk's own pages
// (round 4, row A9, base ruling R49; it grew from the morning brief's): by the page, then by the
// seat's role, each key a figure or block the page draws and the sources it reads, a connector or
// `families`, the desk's family pages. Every figure a page draws has its key here; [] is a figure
// that reads the desk's own pages only. A figure that reads a hole is not drawn, never as 0, and
// neither is a line that follows from it: the holes block says it in desk_count's words (round 3,
// row A6). A block drops only the part that reads the hole (round 4, row A8). A key's sources are
// every source its count reaches, by any path, not the ones its name suggests (round 5, row A12):
// a test withholds each source in turn and holds every key that does not list it to its figure.
const CAL = ["calendar"];
const FAM = ["families"];
// the calls and meetings not in the CRM: a talk is logged when the CRM holds it on one of the
// family's records, and a record is the family's by its desk_ref or by the crm_id on a person its
// family page names (recordsOf), so with no family page a logged talk reads as not in the CRM
const CRM_GAPS = ["crm", "calendar", "families"];
// the threads gone quiet: a thread counts only on a family the seat owns, and the families it owns
// are its family pages, so with none no thread counts
const QUIET = ["mail", "families"];
const INBOX = ["mail", "chat"];
const PAGE_READS = {
  "morning-brief": {
    rep: {
      critical_mail: ["mail"],
      chat: ["chat"],
      // mail and chat drawn as one block, when neither is a hole
      inbox: INBOX,
      to_calendar: CAL,
      // the figure counts the follow-ups due and the threads gone quiet, which read what quiet reads
      follow_ups: QUIET,
      follow_ups_due: [],
      quiet: QUIET,
      to_reach: ["crm", "families"],
      crm_gaps: CRM_GAPS,
      // the backlog's figure and its supplied leads, which read the CRM and the family pages
      backlog: ["crm", "families"],
      // the backlog's overdue follow-ups, which read the desk's own pages only
      overdue: [],
      calendar: CAL,
    },
    rm: {
      to_calendar: CAL,
      meetings_today: CAL,
      briefs_to_make: CAL,
      // "promises" is written as a string in this file, key and member alike: the bare word is the name
      // of fs.promises, which the engine's read scan refuses (B4, e4c_read_scan.test.js).
      "promises": [],
      book_moments: FAM,
      critical_mail: ["mail"],
      chat: ["chat"],
      inbox: INBOX,
      meetings_week: CAL,
      meetings_held: [],
      book_moments_acted: [],
      meetings: CAL,
      calendar: CAL,
    },
    "desk-head": {
      unassigned: FAM,
      leads: FAM,
      reached: [],
      meetings_set: [],
      handed_over: [],
      crm_gaps: CRM_GAPS,
      // the Exceptions block's count and its empty line, which follow from every line it could
      // hold: the calls not in the CRM and the families with no owner among them (round 4, row
      // A10); the lines that read neither stay on the page
      exceptions: ["crm", "calendar", "families"],
      calendar: CAL,
    },
  },
  "rep-console": {
    rep: {
      // the leads the seat owns are its family pages
      leads: FAM,
      reached: [],
      replies: [],
      meetings_set: [],
      handed_over: [],
      to_calendar: CAL,
      // a family reads as new from a signal when the CRM holds no record of it
      new_from_signals: ["crm", "families"],
      to_reach: ["crm", "families"],
      follow_ups_due: [],
      quiet: QUIET,
      critical_mail: ["mail"],
      chat: ["chat"],
      inbox: INBOX,
      crm_gaps: CRM_GAPS,
      backlog: ["crm", "families"],
      overdue: [],
      calendar: CAL,
    },
  },
  "rm-console": {
    rm: {
      meetings_today: CAL,
      meetings_week: CAL,
      briefs_ready: CAL,
      to_calendar: CAL,
      "promises": [],
      book_moments: FAM,
      meetings_held: [],
      book_moments_acted: [],
      meetings: CAL,
      critical_mail: ["mail"],
      chat: ["chat"],
      inbox: INBOX,
    },
  },
  "lead-gen": {
    "desk-head": {
      // the SDR seats the page lists, read off the seat pages
      seats: [],
      leads: FAM,
      reached: [],
      replies: [],
      meetings_set: [],
      handed_over: [],
      stale: [],
      crm_gaps: CRM_GAPS,
      unassigned: FAM,
      exceptions: ["crm", "calendar", "families"],
    },
  },
  // the snapshot draws through the table as the team view does (round 5, row A11): its funnel,
  // its stall card, its seats' table, the seam and each RM's own week
  snapshot: {
    "desk-head": {
      seats: [],
      leads: FAM,
      reached: [],
      replies: [],
      meetings_set: [],
      handed_over: [],
      stale: [],
      crm_gaps: CRM_GAPS,
      unassigned: FAM,
      // the week's hand-overs to an RM, and those met since: the desk log's rows
      handed: [],
      met: [],
      // a hand-over with a meeting ahead on the RM's calendar, and one with none: the calendar's
      on_calendar: CAL,
      stalled: CAL,
      // each RM's own week: meetings held, book moments acted on, leads handed to them
      rm_week: [],
    },
  },
};

// Python's round() of a float to a whole number: a half goes to the even neighbour.
function pyRound(x) {
  const r = Math.round(x);
  if (Math.abs(x - Math.trunc(x)) === 0.5) return 2 * Math.round(x / 2);
  return r;
}

function row(desk, family, why, whyToday, ref, kind, extra = {}) {
  return { family, title: family ? desk.title(family) : "", why, why_today: whyToday, ref, kind, ...extra };
}

function n(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function split(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// One table cell or one proof-line field: no separators, one line.
function clean(text) {
  return String(text || "")
    .replace(/\u00b7/g, ",")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

// Products that suit the segment, answer one of the signals' engines, and are not already held.
function fittingProducts(products, segment, engines, holds) {
  return products
    .filter((p) => {
      const suits = split(p.suits);
      return (
        (suits.includes(segment) || suits.includes("all")) &&
        split(p.fits).some((fit) => engines.has(fit)) &&
        !holds.has(p.key)
      );
    })
    .map((p) => ({ key: p.key, product: p.product }));
}

function logRows(desk, family, actions) {
  return desk.deskLog.filter((r) => unlink(r.lead) === family && actions.has(r.action));
}

function seats(desk) {
  return new Set(desk.of("seats").map((page) => page.slug));
}

// The seat a hand-over's outcome names, `to <handle>`, when it is a seat of the desk.
function handedTo(outcome, seatSet) {
  const m = HAND_OVER.exec(clean(outcome));
  return m && seatSet.has(m[1]) ? m[1] : null;
}

// Each family's latest valid hand-over, as {family: seat}; latest by the row's date, a later
// row breaking a tie.
function latestHandOvers(rows, seatSet) {
  const latest = new Map();
  rows.forEach((r, i) => {
    const to = r.action === "handed-over" ? handedTo(r.outcome, seatSet) : null;
    if (to === null) return;
    const family = unlink(r.lead);
    const key = [asDate(r.date), i];
    const had = latest.get(family);
    if (!had || S.compareKeys(key, had.key) >= 0) latest.set(family, { key, to });
  });
  return new Map([...latest].map(([family, { to }]) => [family, to]));
}

// On a seat's graph, another seat of the firm a caller asks for is refused: the graph holds every
// seat's page (the name list), but only its own seat's work, so another seat's view, count or book
// drawn from it would be a part told as the whole. Each tool calls it on the seat its caller named,
// never inside a view that walks the desk's seats itself: a team view counts every seat it holds.
// A name that is no seat page is left to the caller's own refusal.
function graphSeat(desk, seat) {
  if (!desk.read.graph || !seat || seat === desk.seat) return;
  const page = desk.pages.get(seat);
  if (!page || page.kind !== "seats") return;
  const whose = desk.seat === null ? "a seat's graph whose desk.md names no seat" : `${desk.seat}'s graph`;
  throw new Refusal(
    `${JSON.stringify(seat)} is not this graph's seat: this desk is ${whose}, which holds that seat's own work alone, so ` +
      `${seat}'s figures are read from ${seat}'s own graph.`,
  );
}

// On a seat's graph a view that counts a whole team is refused (the base's ruling K9, c/6212179305):
// the graph holds one seat's work, and every other seat's figures would be read as none. `what` is
// the view, as "The lead-gen".
function teamOnGraph(desk, what) {
  if (!desk.read.graph) return;
  throw new Refusal(
    `${what} counts a whole team, and a graph holds one seat's work: the team's figures read from-my-team, which the ` +
      "graph job fills from a later wave.",
  );
}

// The words that end a refusal of a name that is no seat: the desk's seats, or on a seat's graph its
// one seat, never the firm's seats it would then refuse (reader 1's low, c/6215653403).
function seatsSaid(desk) {
  if (desk.read.graph) {
    if (desk.seat === null) return "this desk is a seat's graph whose desk.md names no seat";
    // its one seat by its seat page in the shared part that says type: seat, as write/facts.js seatsOf
    const page = desk.pages.get(desk.seat);
    if (!(page && page.kind === "seats" && page.header && page.header.type === "seat")) {
      return `this desk is ${desk.seat}'s graph, and ${desk.seat} has no seat page in its shared part that says type: seat`;
    }
    return `this desk is ${desk.seat}'s graph, and its one seat is ${desk.seat}`;
  }
  const valid = desk
    .of("seats")
    .map((p) => p.slug)
    .sort();
  return `the seats are ${valid.join(", ")}`;
}

// The seat a view is for, or a refusal naming the seats it could be.
function seatPage(desk, seat, roles) {
  const page = desk.pages.get(seat || "");
  if (page && page.kind === "seats" && roles.includes(page.header.role)) return page;
  const valid = desk
    .of("seats")
    .filter((p) => roles.includes(p.header.role))
    .map((p) => p.slug)
    .sort();
  const [article, word] = roles.length === 1 ? ROLE_WORDS[roles[0]] || ["a", roles[0]] : ["a", ""];
  const kind = word ? `${word} ` : "";
  if (desk.read.graph) {
    const there = Boolean(page && page.kind === "seats");
    throw new Refusal(`${JSON.stringify(seat || "")} is not ${there ? `${article} ${kind}seat` : "a seat"} on this desk: ${seatsSaid(desk)}.`);
  }
  throw new Refusal(
    `${JSON.stringify(seat || "")} is not ${article} ${kind}seat on this desk: the ${kind}seats are ${valid.join(", ")}.`,
  );
}

// The page a follow-up's source names (base ruling R42), in every form a desk holds: a link
// ([[slug]] or [[folder/slug]]), a desk-relative path (folder/slug.md, with or without the desk's
// own folder in front), a bare file name (slug.md) or a bare slug. A folder named must be the
// page's own. On a seat's graph a path names the page where it is in its part
// (shared/conversations/slug.md), as the converter re-pointed it. Null when the source names no
// page on the desk.
function sourcePage(desk, from) {
  let text = unlink(from).trim();
  if (text.startsWith(`${DESK_FOLDER}/`)) text = text.slice(DESK_FOLDER.length + 1);
  if (text.endsWith(".md")) text = text.slice(0, -".md".length);
  const at = text.lastIndexOf("/");
  const page = desk.pages.get(text.slice(at + 1));
  if (!page || (at !== -1 && text.slice(0, at) !== page.kind && `${text}.md` !== page.path)) return null;
  return page;
}

// Whose a follow-up is, and about what: {ref, seat, family}. A conversation is the seat that
// attended it, and its family is what it is about; any other page is its owner's when that is a
// seat of the desk, and is its own family. A source naming no page gives no seat and no family.
function followUpSource(desk, from) {
  const page = sourcePage(desk, from);
  if (!page) return { ref: unlink(from), seat: null, family: null };
  if (page.kind === "conversations") return { ref: page.slug, seat: desk.seatOf(page.slug), family: desk.about(page.slug) };
  const owner = desk.get(page, "owner");
  return { ref: page.slug, seat: seats(desk).has(owner) ? owner : null, family: page.slug };
}

// An assign_lead line's { family, seat, list }, or null: "assigned ", a link read by the one link
// reader (check/text.js linkSpans) whose tail holds no label, then " to <seat> (<list>)". The
// family is the link's name and its `#part` as written, as the line's link was always read.
function assignedLine(what) {
  if (!what.startsWith(ASSIGNED)) return null;
  const [span] = linkSpans(what);
  if (!span || span.start !== ASSIGNED.length || span.tail.includes("|")) return null;
  const m = AFTER_ASSIGNED.exec(what.slice(span.end));
  return m ? { family: span.name + span.tail, seat: m[1], list: m[2] } : null;
}

// The seat a supplied row gives its family (base ruling R42): its `seat` cell, a handle or a
// link, when that names a seat of the desk; else the seat assign_lead's line in log.md names for
// the same family and list on the row's own date; else null, and the row does not decide the
// family's owner. assign_lead adds a row after the register's last and a line to the day's lines
// in log.md, newest first: so the day's lines are read in the order they were written, and a
// row's place among its family's rows for that list and day picks its line (round 3, row B5),
// the last line when there are more rows than lines.
function suppliedSeat(desk, r, seatSet) {
  const cell = unlink(r.seat);
  if (seatSet.has(cell)) return cell;
  const family = unlink(r.lead);
  const list = clean(r.list);
  const day = asDateOrNull(r.date);
  const same = (x) => unlink(x.lead) === family && clean(x.list) === list && asDateOrNull(x.date) === day;
  const place = desk.supplied.slice(0, Math.max(desk.supplied.indexOf(r), 0)).filter(same).length;
  const lines = [];
  desk.log.forEach((line, i) => {
    const m = line.day === day ? assignedLine(line.what || "") : null;
    if (m && m.family === family && clean(m.list) === list && seatSet.has(m.seat)) lines.push([String(line.time || ""), i, m.seat]);
  });
  if (!lines.length) return null;
  const written = S.sortedBy(lines, (x) => [x[0], x[1]]);
  return written[Math.min(place, written.length - 1)][2];
}

// Whether the desk log holds a worked line for the family: a touch the rep console reads.
function workedLead(desk, family) {
  return logRows(desk, family, TOUCHES).length > 0;
}

// Every supplied lead as each count and console reads it (round 3, row B5), by its page name:
// its latest row, by date and then by its place in the register, which replaces every earlier
// row of the lead, and that row's state; the seat of its latest assign_lead, the latest row that
// names one (suppliedSeat, R42 (b)), else its page's owner when that is a seat of the desk; and
// whether the desk log has worked it. In the order of each lead's latest row in the register. Read once per
// desk: a Desk is the desk as one render read it, and is never changed.
const LEADS = new WeakMap();
function suppliedLeads(desk) {
  if (!LEADS.has(desk)) LEADS.set(desk, readSuppliedLeads(desk));
  return LEADS.get(desk);
}

// Track G G10: a placed lead's three tags, its tier (P0, P1 or P2), the ordinal of the ideal
// client profile's persona it was placed under (`icp_persona`: "persona" in the engine is the
// assistant's own, lib/persona.js) and the profile's version, each read from the row's cell where
// its table has the column and the cell is filled, else from the lead page's header (the
// placement's PLACED_KEYS; one-desk's Q1 = A: on our own desks the tags are on the page). Null
// unless all three read: an absent tag is "not placed", never a fault. The inputs are those three
// keys alone (pay's Q-P1: the firm's own profile data; never a field an unlock reveals).
const ICP_TIERS = ["P0", "P1", "P2"];
const ICP_TAG_KEYS = ["persona", "tier", "icp_version"];
function ordinalOf(value) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return /^[1-9][0-9]{0,5}$/u.test(text) ? Number(text) : null;
}
function icpTags(row, head) {
  const header = head !== null && typeof head === "object" && !Array.isArray(head) ? head : {};
  const read = (key) => {
    const cell = row && Object.hasOwn(row, key) && row[key] !== null ? clean(row[key]) : "";
    return cell !== "" ? cell : header[key];
  };
  const persona = ordinalOf(read("persona"));
  const tierText = read("tier");
  const tier = typeof tierText === "string" && ICP_TIERS.includes(tierText.trim()) ? tierText.trim() : null;
  const version = ordinalOf(read("icp_version"));
  return persona === null || tier === null || version === null ? null : { tier, icp_persona: persona, icp_version: version };
}

// The latest row of each lead on a names-supplied list, as every count reads it: by its date, then
// its place, a later row replacing an earlier one; keyed by the lead its `lead` cell links.
function latestSupplied(rows) {
  const latest = new Map();
  rows.forEach((r, i) => {
    const lead = unlink(r.lead);
    const key = [String(r.date === undefined || r.date === null ? "" : r.date), i];
    const had = latest.get(lead);
    if (!had || S.compareKeys(key, had.key) >= 0) latest.set(lead, { key, row: r });
  });
  return latest;
}

// The lead pages a withdrawn row names anywhere in its `lead` cell: the placement's withdrawal
// turns that cell to its notice, which names the page by its link when the page is kept as a seat
// edited it (storage/interface.py place_notice_kept), and keeps a cell a seat edited.
const WITHDRAWN = "withdrawn";
// The lead pages the night reads as kept off rows it reads as withdrawn, each row as the door cuts
// it (icp/withdrawal.py kept_pages: every link of a placed page's shape in the row's lead cell, a
// stray "[" before it or not); the night asks the removal check about none of them.
const DOOR_KEPT_NAME = /lead-[a-z]{16}/u;
function doorKept(rows) {
  const out = new Set();
  for (const row of rows) {
    if (!row || row.state !== WITHDRAWN || typeof row.lead !== "string") continue;
    for (const name of bareLinkNames(row.lead, DOOR_KEPT_NAME)) out.add(name);
  }
  return out;
}
function withdrawnPages(rows) {
  const out = new Set();
  for (const r of rows) {
    if (clean(r.state) !== WITHDRAWN) continue;
    for (const span of linkSpans(String(r.lead === null || r.lead === undefined ? "" : r.lead))) out.add(span.name);
  }
  return out;
}

// The lead's latest row while the firm's list holds it as live (the base's Q-TG2, and the ruling on
// a kept page a later row links), else null; liveAt gives its place among the rows, else -1. Live:
// its latest row is there and is not withdrawn, and no withdrawn row names its page. A lead
// withdrawn for a removal whose page was kept stays not live even when a later row, which the
// withdrawal never reaches (it judges only rows with the placement's mark), links the same page. A
// lead marked "no longer on that list" keeps its row's state (the mark is on its page, never in the
// row), so it stays live and keeps its place on the day.
function liveRow(rows, lead) {
  const at = liveAt(rows, lead);
  return at === -1 ? null : rows[at];
}
function liveAt(rows, lead) {
  const got = latestSupplied(rows).get(lead);
  return got !== undefined && clean(got.row.state) !== WITHDRAWN && !withdrawnPages(rows).has(lead) ? got.key[1] : -1;
}

// A list line's cells as the door cuts them (storage/interface.py _py_cells): the line and each
// cell stripped as Python strips, so a cell the engine's own reader trims to a store id but the
// door does not (a U+FEFF at its edge) is read as the door reads it. readTable(text, doorCells)
// gives the same rows as readTable(text), in the same order.
function doorCells(line) {
  return pyStrip(line)
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((cell) => pyStrip(cell).replace(/\\\|/g, "|"));
}

// Whether the door reads `text`, the body of the firm's list, as a list at all (storage/interface.py
// table_rows and placed_list): one unbroken table, its columns each named once and holding lead,
// list and state. Else the night stops before any withdrawal (icp/placement_job.py, list_unread),
// so it reaches no row on the list. And the table's second line a rule line: the door passes over
// that line whatever it holds, so a list without one loses its first row to the night.
const DOOR_COLUMNS = Object.freeze(["lead", "list", "state"]);
function doorReadsList(text) {
  const lines = text.replace(/\n+$/u, "").split("\n");
  const table = [];
  lines.forEach((line, at) => {
    if (line.startsWith("|")) table.push(at);
  });
  if (table.length < 2 || table[table.length - 1] - table[0] !== table.length - 1) return false;
  const columns = doorCells(lines[table[0]]);
  if (new Set(columns).size !== columns.length || DOOR_COLUMNS.some((c) => !columns.includes(c))) return false;
  return [...lines[table[0] + 1].replace(/\|/g, "").trim()].every((ch) => "-: ".includes(ch));
}

// The line breaks the door refuses in a list it rewrites (storage/interface.py _LINE_BREAKS): the
// engine's reader makes "\r" a "\n" and reads the rest as text, so only the list's bytes show them.
const DOOR_LINE_BREAKS = /[\r\u000b\u000c\u001c\u001d\u001e\u0085\u2028\u2029]/u;

// The most bytes the list may hold for the night to write its removals back on a night that
// places leads. That write carries at most the server's MAX_FILE_BYTES per file, measured on the
// list after the removal has written its rows again, and a row written again can grow (a kept
// page's notice in its lead cell, "withdrawn" in its state, its cells spaced), so the list keeps
// DOOR_FILE_ROOM of that limit free for the rows one night withdraws. Past it the write is
// refused, and the removal with it.
const DOOR_FILE_ROOM = 64 * 1024;
const DOOR_FILE_BYTES = 512 * 1024 - DOOR_FILE_ROOM;

// The text of the list held at `file`, as the door would write it again: at most DOOR_FILE_BYTES,
// its bytes UTF-8 (the night stops at any other, not_text) and no line break but "\n"
// (place_extends refuses the removal's write); null else.
function doorText(file) {
  const bytes = typeof file === "string" ? pageBytes(file) : null;
  if (bytes === null || bytes.length > DOOR_FILE_BYTES) return null;
  try {
    const text = STRICT_TEXT.decode(bytes);
    return DOOR_LINE_BREAKS.test(text) ? null : text;
  } catch {
    return null;
  }
}

// The list's rows as the door cuts them (doorCells), at the places the engine's own reader gives
// them (readTable), so the day row and the brief read one row the same way: none on a list the
// door cannot read (doorReadsList) or would not write again (doorText, the list's file at
// `file`), none unless `body` is that file's own body (split as the engine's reader splits a
// page), and null for a row whose cells do not line up with the columns, which the night sets
// aside and never withdraws (storage/interface.py misshapen_rows).
function doorRowsOf(body, file) {
  if (typeof body !== "string" || !doorReadsList(body)) return [];
  const text = doorText(file);
  const split = text === null ? null : splitPage(text);
  if (split === null || split.body !== body) return [];
  // and a list the night's placing write can stamp again: one it refuses (a header naming
  // generated_by twice, or one that does not parse) takes no write, the removal's with it
  if (withGeneratedBy("queues/supplied.md", text, "celorus-plugin 0 place_leads").refused) return [];
  const widths = [];
  const rows = readTable(body, (line) => {
    const got = doorCells(line);
    widths.push(got.length);
    return got;
  });
  return rows.map((row, at) => (widths[at + 1] === widths[0] ? row : null));
}

// Track G G10, the base's ruling B2 and the gate's word on it: a lead's three tags show, on a day
// row or in a brief, only while the night's withdrawal can reach the row that gives them, so the
// tags of a lead the removal check removes go within one night. The night reaches a row two ways
// (icp/placement_job.py, the withdrawal's head). By the store id the row holds: the check is asked
// about it, a row with the placement's mark (its list, or its `lead` cell the link to the id's page)
// is withdrawn, and the briefs of the id's page are cleared (icp/withdrawal.py candidates,
// icp/brief_clear.py taken). So the row's id must be the page header's, the page must be the one
// that id names, and the row must carry the mark. Or, for a row with no id, by the page itself:
// the door lists a page that still reads as placed (storage/placed_digests.py placed_lead_id), the
// night keeps it only while that header id names the page, the check is asked about the id, and a
// removed lead's placed page is deleted. A page a seat edited no longer reads as placed and is
// never listed, so on a row with no id it shows no tags.
const STORE_ID = /^[0-9a-f]{64}$/u;
// The placement's list and its cells (write/writers.js PLACE_LIST and PLACE_OWN_COLUMNS; a test
// pins both equal), and the page header's record of them (writers.js PLACED_DIGESTS).
const PLACED_LIST = "icp-record";
const PLACED_CELLS = Object.freeze(["lead", "list", "date", "lead_id", "persona", "tier"]);
const PLACED_RECORD = "placed_digests";
const PLACED_STAMP = "generated_by";
const PLACED_ITEM = /^([a-z_]+)[.]([0-9a-f]{16})$/u;
const PLACED_UNNAMED = "~";
const PLACED_LEAD_ID = /^lead_id: ("?)([0-9a-f]{64})\1$/u;
const STRICT_TEXT = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// A placed lead's page name from its store id (icp/placement.py page_name; a test pins it equal).
const PAGE_LETTERS = "abcdefghijklmnopqrstuvwxyz";
function leadPageName(leadId) {
  let rest = BigInt(`0x${sha256().update(`celorus-icp-lead:${leadId}`).hex()}`);
  let name = "lead-";
  for (let i = 0; i < 16; i += 1) {
    name += PAGE_LETTERS[Number(rest % 26n)];
    rest /= 26n;
  }
  return name;
}

function placedDigestOf(page, name, text) {
  return sha256().update(`${page}\n${name}\n${text}`).hex().slice(0, 16);
}

function storedRecord(line) {
  const value = pyStrip(line.slice(PLACED_RECORD.length + 1));
  if (!(value.startsWith("[") && value.endsWith("]"))) return null;
  const out = new Map();
  for (const item of value.slice(1, -1).split(",")) {
    const hit = PLACED_ITEM.exec(pyStrip(item));
    if (hit === null || out.has(hit[1])) return null;
    out.set(hit[1], hit[2]);
  }
  return out;
}

// The store id the header of the lead page `page` (its name, without `.md`) holds while the page,
// as the bytes `bytes`, still reads as placed; else null. The door's read, line for line
// (storage/placed_digests.py page_digests and placed_lead_id; a table test pins the two equal).
function placedLeadId(page, bytes, columns = PLACED_CELLS) {
  let text;
  try {
    text = STRICT_TEXT.decode(bytes);
  } catch {
    return null;
  }
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end === -1) return null;
  let stored = null;
  let seen = 0;
  const now = new Map();
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(":");
    const key = colon === -1 ? line : line.slice(0, colon);
    if (key === PLACED_RECORD) {
      seen += 1;
      stored = storedRecord(line);
    } else if (key !== PLACED_STAMP) {
      let name = `f_${key}`;
      if (now.has(name)) name = `${name}~${now.size}`;
      now.set(name, placedDigestOf(page, name, line));
    }
  }
  now.set("body", placedDigestOf(page, "body", pyStrip(lines.slice(end + 1).join("\n"))));
  const record = seen === 1 ? stored : null;
  if (record === null) return null;
  const named = new Map([...now].filter(([name]) => name === "body" || record.has(name)));
  if (named.size < now.size) named.set(PLACED_UNNAMED, "0".repeat(16));
  const cells = new Set([...record.keys()].filter((name) => name.startsWith("c_")).map((name) => name.slice(2)));
  const fields = [...record].filter(([name]) => !name.startsWith("c_"));
  const want = new Set(columns);
  if (cells.size !== want.size || [...want].some((c) => !cells.has(c))) return null;
  if (fields.length !== named.size || fields.some(([name, d]) => named.get(name) !== d)) return null;
  const found = lines.slice(1, end).flatMap((line) => {
    const hit = PLACED_LEAD_ID.exec(line);
    return hit === null ? [] : [hit[2]];
  });
  return found.length === 1 ? found[0] : null;
}

// The folder the placement writes its lead pages to on the desk head's graph, the one folder the
// door lists placed pages from (writers.js and storage/interface.py PLACE_LEAD_FOLDER).
const PLACED_FOLDER = "shared/people";

// The lead page `page`'s file where the door would list it, as the graph at `root` (a desk folder)
// holds it at `rel`: only on the desk head's own graph, the one graph the night walks, and only in
// the placement's folder; else null.
function placedFile(root, graph, rel, page) {
  if (!graph || typeof graph.seat !== "string" || graph.common === null || graph.common === undefined) return null;
  if (rel !== `${PLACED_FOLDER}/${page}.md` || deskHeadNamed(graph.common) !== graph.seat) return null;
  return path.join(root, "celorus", ...rel.split("/"));
}

// A page's bytes as they stand on disk, or null: lstat asks for a plain file before the read, so a
// folder, a link or anything that would block a read reads as no page (the door reads the stored
// object itself, never what a link points at).
function pageBytes(file) {
  try {
    if (!fs.lstatSync(file).isFile()) return null;
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

// Whether the night reaches `row`, the lead page `page`'s live row as the door reads it
// (doorCells; the B2 text above): `head` is the page's header as read, `file` its path on disk,
// read only for a row with no id. A row the door reads as withdrawn is never reached.
function nightReaches(row, page, head, file) {
  const cell = (key) => (row && Object.hasOwn(row, key) && row[key] !== null && row[key] !== undefined ? String(row[key]) : "");
  if (!row || cell("state") === WITHDRAWN) return false;
  const id = cell("lead_id");
  if (STORE_ID.test(id)) {
    const header = head !== null && typeof head === "object" && !Array.isArray(head) ? head : {};
    const marked = cell("list") === PLACED_LIST || cell("lead") === `[[${page}]]`;
    return marked && String(header.lead_id) === id && leadPageName(id) === page;
  }
  // and, as the night lists a placed page (icp/placement_job.py), only while the id the page reads
  // as placed by names this page
  const bytes = file === null ? null : pageBytes(file);
  const placed = bytes === null ? null : placedLeadId(page, bytes);
  return placed !== null && leadPageName(placed) === page;
}

function readSuppliedLeads(desk) {
  const seatSet = seats(desk);
  const latest = new Map();
  const named = new Map();
  const later = (map, lead, item) => {
    const had = map.get(lead);
    if (!had || S.compareKeys(item.key, had.key) >= 0) map.set(lead, item);
  };
  desk.supplied.forEach((r, i) => {
    const lead = unlink(r.lead);
    const key = [String(r.date === undefined || r.date === null ? "" : r.date), i];
    later(latest, lead, { key, row: r });
    // the latest row that names a seat is the lead's latest assign_lead: a later row naming none
    // does not undo it
    const seat = suppliedSeat(desk, r, seatSet);
    if (seat !== null) later(named, lead, { key, seat });
  });
  const out = new Map();
  const gone = withdrawnPages(desk.supplied);
  // B2: a lead's tags only while the night reaches its row (nightReaches), and so only on a graph
  // whose list is the firm's common one, the list the night walks (storage/interface.py PLACE_LIST)
  // (no list file, no rows); the list read is the one the rows are (the last page at its path,
  // as desk.supplied takes it: on a graph the common list comes after a seat's own copy), and
  // it gives rows only while its body is the common list file's own (doorRowsOf)
  const graph = desk.read.graph;
  const walked = Boolean(graph && graph.common !== null && graph.common !== undefined);
  const listFile = walked ? path.join(graph.common, "queues", "supplied.md") : null;
  const listed = desk.read.pages.filter((p) => p.rel === "queues/supplied.md").pop();
  const doorRows = listed && !listed.problem ? doorRowsOf(listed.body, listFile) : [];
  // the pages a withdrawn row keeps, read as the night reads them (withdrawal.py kept_pages)
  const doorGone = doorKept(doorRows);
  const tagsOf = (r, at, lead, page) => {
    if (clean(r.state) === WITHDRAWN || gone.has(lead) || doorGone.has(lead)) return null;
    const tags = icpTags(r, page ? page.header : null);
    if (tags === null || !page) return null;
    const file = placedFile(desk.root, graph, page.path, lead);
    return nightReaches(doorRows[at] || null, lead, page.header, file) ? tags : null;
  };
  for (const [lead, { key, row: r }] of S.sortedBy([...latest], (x) => x[1].key[1])) {
    const page = desk.pages.get(lead);
    const owner = page ? desk.get(page, "owner") : null;
    out.set(lead, {
      lead,
      row: r,
      at: key[1],
      seat: named.has(lead) ? named.get(lead).seat : seatSet.has(owner) ? owner : null,
      list: clean(r.list),
      date: asDateOrNull(r.date),
      state: r.state,
      worked: workedLead(desk, lead),
      icp: tagsOf(r, key[1], lead, page),
    });
  }
  return out;
}

function asDateOrNull(value) {
  try {
    return asDate(value);
  } catch {
    return null;
  }
}

// The seat that owns the family now: the RM it was handed to, else the seat its supplied rows give
// it, as every count reads the lead (suppliedLeads, round 3, row B5), else the page's owner; null
// when that names no seat of the desk.
function effectiveOwner(desk, family) {
  const seatSet = seats(desk);
  const handed = latestHandOvers(desk.deskLog, seatSet).get(family);
  if (handed) return handed;
  const lead = suppliedLeads(desk).get(family);
  const page = desk.pages.get(family);
  const owner = lead ? lead.seat : page ? desk.get(page, "owner") : null;
  return seatSet.has(owner) ? owner : null;
}

function recordsOf(desk, st, family) {
  const ids = new Set();
  for (const slug of desk.peopleOf(family)) {
    const page = desk.pages.get(slug);
    if (page && page.header.crm_id) ids.add(String(page.header.crm_id));
  }
  for (const r of st.crm.records) if (r.desk_ref === family && r.stage !== "Merged") ids.add(r.id);
  return ids;
}

function inCrm(desk, st, family) {
  return recordsOf(desk, st, family).size > 0;
}

function fresh(desk, family, today, days) {
  const sigs = desk.signals(family).filter((p) => {
    const age = daysBetween(asDate(p.header.as_of), today);
    return age >= 0 && age <= days;
  });
  return sigs.length ? sigs[sigs.length - 1] : null;
}

// One signal in words.
function signalWhy(sig) {
  const label = sig.header.engine_label;
  const what = sig.header.description;
  if (label && what) return `${label}: ${what}`;
  return String(what || label || sig.slug);
}

function critical(desk, st, seat) {
  return S.mailSearch(st, seat, { criticalOnly: true })
    .filter((t) => t.waiting_on === "us")
    .map((t) =>
      row(desk, t.family, `${t.last_from} wrote: ${t.subject}`, `Waiting on you since ${shortDate(t.last_at)}`, t.thread, "mail"),
    );
}

function chat(desk, st, seat) {
  return S.chatUnread(st, seat).map((m) => row(desk, null, m.text, `${desk.title(m.from)}, ${m.at.slice(11, 16)}`, m.id, "chat"));
}

// The meetings the day proposed that no calendar holds yet, soonest first; each carries the
// `hold` its yes writes.
function toCalendar(desk, st, seat, today) {
  return S.calendarProposals(st, seat, today).map((p) => {
    const start = p.hold.start;
    return row(desk, p.family, p.why, `Proposed for ${shortDate(start)} ${start.slice(11, 16)}`, p.id, "proposal", { hold: p.hold });
  });
}

// The day a follow-up's `by` cell names, read as its words read it (round 3, row B4): a cell that
// opens with a link (the first span check/text.js linkSpans reads starts the cell) is read by that
// link's target (linkName), so `[[2026-09-02]]` and `[[2026-09-02|Wed]]` are that day; any other
// cell is read as it is written. Null when what is read is no date. Every reader of a `by` reads
// it here.
function dueBy(cell) {
  const text = String(cell === undefined || cell === null ? "" : cell).trim();
  const [first] = linkSpans(text);
  return asDateOrNull(first && first.start === 0 ? linkName(first) : text);
}

// The follow-ups the seat owes, each with its `by` as a date. A row whose `by` is no date is not
// one of them: undatedFollowUps names it instead.
function* owed(desk, seat) {
  for (const f of desk.followUps) {
    if (f.owed_by !== "us" || f.state !== "due") continue;
    const by = dueBy(f.by);
    if (by === null) continue;
    const src = followUpSource(desk, f.from);
    if (src.seat === seat) yield [f, src.ref, src.family, by];
  }
}

// A sentence's links read as the words the page shows for them (templates/parts.js delinker), so
// a hole says the same words in a count's answer and on a page.
function linkWords(desk, text) {
  const line = String(text === undefined || text === null ? "" : text).trim();
  let out = "";
  let from = 0;
  for (const span of linkSpans(line)) {
    const inner = line.slice(span.start + 2, span.end - 2);
    const bar = inner.indexOf("|");
    out += line.slice(from, span.start) + ((bar === -1 ? "" : inner.slice(bar + 1)) || desk.title(span.name));
    from = span.end;
  }
  return out + line.slice(from);
}

// The follow-ups in state `due` whose `by` is no date (round 2, row B2), as dueBy reads it: counted
// as due by no page and no count, and named by each in these words, which quote the `by` cell as
// it is written (round 3, row B4). The seat's own (by its source, R42 (a)), or with `seat` null
// the whole desk's; with `nobodys`, also those whose source names no seat, as calls_for_today
// puts them on every seat's no_seat.
function undatedFollowUps(desk, seat = null, nobodys = false) {
  const out = [];
  for (const f of desk.followUps) {
    if (f.state !== "due" || dueBy(f.by) !== null) continue;
    const src = followUpSource(desk, f.from);
    if (seat !== null && src.seat !== seat && !(nobodys && src.seat === null)) continue;
    const by = String(f.by === undefined || f.by === null ? "" : f.by).trim();
    const due = by ? `is due by ${by}, which is not a date` : "carries no date it is due by";
    out.push(`A follow-up is not counted as due: ${linkWords(desk, f.what)}, from ${src.ref}, ${due}.`);
  }
  return out;
}

// The seat's calls and meetings that its CRM does not hold. With the CRM's rows not handed over,
// no CRM row was read, so no talk is said to be missing from it: none (round 4, row A9).
function crmGaps(desk, st, seat, today) {
  if (!st.given.includes("crm")) return [];
  const talks = [];
  for (const p of desk.of("conversations")) {
    if (desk.seatOf(p.slug) === seat && ["call", "meeting"].includes(desk.get(p, "channel")) && asDate(p.header.date) <= today) {
      talks.push([desk.get(p, "about"), asDate(p.header.date), p.slug]);
    }
  }
  for (const ev of st.calendar.events) {
    if (ev.seat === seat && ["call", "meeting"].includes(ev.kind) && ev.family && asDate(ev.start) < today) {
      talks.push([ev.family, asDate(ev.start), null]);
    }
  }
  const sorted = S.sortedBy(talks, (t) => [t[1], t[0], t[2] === null]);
  const seen = new Set();
  const out = [];
  for (const [family, day, conv] of sorted) {
    const key = JSON.stringify([family, day]);
    if (seen.has(key)) continue;
    seen.add(key);
    const recs = recordsOf(desk, st, family);
    const logged = st.crm.activities.some(
      (a) => recs.has(a.record) && a.by === seat && ["call", "meeting"].includes(a.kind) && asDate(a.at) === day,
    );
    if (!logged) out.push(row(desk, family, `The talk on ${shortDate(day)} is not in your CRM`, "One line logs it", conv, "gap"));
  }
  return out;
}

// The seat's desk-log rows in the last seven days and today.
function weekRows(desk, seat, today) {
  return desk.deskLog.filter((r) => {
    if (r.seat !== seat) return false;
    const age = daysBetween(asDate(r.date), today);
    return age >= 0 && age <= WEEK;
  });
}

function week(desk, seat, today) {
  const rows = weekRows(desk, seat, today);
  const seatSet = seats(desk);
  const families = (test) => new Set(rows.filter(test).map((r) => unlink(r.lead))).size;
  return {
    reached: families((r) => r.action === "mail" || (r.action === "call" && r.outcome === "reached")),
    replies: families((r) => r.action === "reply"),
    meetings_set: rows.filter((r) => r.action === "meeting-set").length,
    handed_over: rows.filter((r) => r.action === "handed-over" && handedTo(r.outcome, seatSet)).length,
  };
}

// A view's frame; its seat is one seatPage has let through.
function frame(desk, view, seat, today, rest) {
  return {
    view,
    seat,
    seat_name: desk.title(seat),
    role: desk.pages.get(seat).header.role,
    date: today,
    date_label: dateLabel(today),
    ...rest,
  };
}

// Today's events on the desk's calendar for this seat: time, title, family.
function dayCalendar(st, seat, today) {
  return S.calendarEvents(st, seat, today, today).map((ev) => ({ time: ev.start.slice(11, 16), title: ev.title, family: ev.family }));
}

function repView(desk, st, seat, today) {
  seatPage(desk, seat, ["rep"]);
  const mine = desk
    .of("families")
    .map((f) => f.slug)
    .filter((slug) => effectiveOwner(desk, slug) === seat);
  const b = Object.fromEntries(REP_BLOCKS.map((k) => [k, []]));
  // a supplied lead is read as the counts read it: its latest row, and whether it is worked (B5)
  const leads = suppliedLeads(desk);
  for (const fam of mine) {
    const touched = workedLead(desk, fam);
    const sig = fresh(desk, fam, today, FRESH_SIGNAL_DAYS);
    const lastSupplied = leads.has(fam) ? leads.get(fam).row : null;
    const age = lastSupplied ? daysBetween(asDate(lastSupplied.date), today) : null;
    const crm = inCrm(desk, st, fam);
    if (!crm && sig) {
      b.new_from_signals.push(row(desk, fam, signalWhy(sig), `New signal, ${shortDate(sig.header.as_of)}`, sig.slug, "signal"));
    } else if (crm && !touched && (sig || (age !== null && age <= STALE_SUPPLY_DAYS))) {
      const why = sig ? signalWhy(sig) : `Assigned from the ${lastSupplied.list} list`;
      const when = sig ? `Fresh signal, ${shortDate(sig.header.as_of)}` : `Assigned ${shortDate(lastSupplied.date)}`;
      b.to_reach.push(row(desk, fam, why, when, sig ? sig.slug : null, "reach"));
    } else if (crm && !touched && lastSupplied) {
      b.backlog.push(
        row(desk, fam, `Assigned from the ${lastSupplied.list} list on ${shortDate(lastSupplied.date)}`, `Untouched for ${age} days`, null, "supplied"),
      );
    }
  }
  for (const [f, conv, fam, by] of owed(desk, seat)) {
    if (by === today) b.follow_ups_due.push(row(desk, fam, f.what, "Due today", conv, "follow-up"));
    else if (by < today) b.backlog.push(row(desk, fam, f.what, `Overdue since ${shortDate(by)}`, conv, "follow-up"));
  }
  const mineSet = new Set(mine);
  for (const t of S.mailSearch(st, seat)) {
    const days = daysBetween(asDate(t.last_at), today);
    if (mineSet.has(t.family) && t.waiting_on === "them" && days >= QUIET_DAYS) {
      b.quiet.push(row(desk, t.family, `You wrote on ${shortDate(t.last_at)}: ${t.subject}`, `${days} days, no reply`, t.thread, "quiet"));
    }
  }
  b.critical_mail = critical(desk, st, seat);
  b.chat = chat(desk, st, seat);
  b.crm_gaps = crmGaps(desk, st, seat, today);
  b.to_calendar = toCalendar(desk, st, seat, today);
  return frame(desk, "rep-console", seat, today, {
    blocks: b,
    calendar: dayCalendar(st, seat, today),
    counts: { ...week(desk, seat, today), leads: mine.length, to_calendar: b.to_calendar.length },
    holes: undatedFollowUps(desk, seat),
    ...pageGates(desk, st, "rep-console", "rep"),
  });
}

function rmView(desk, st, seat, today) {
  seatPage(desk, seat, ["rm"]);
  const b = { to_calendar: toCalendar(desk, st, seat, today), meetings: [], grow_the_book: [], promises_owed: [] };
  for (const ev of S.calendarEvents(st, seat, today, addDays(today, 6))) {
    if (ev.kind !== "meeting" || !ev.family) continue;
    const day = asDate(ev.start);
    const brief = desk
      .of("briefs")
      .find(
        (p) =>
          desk.get(p, "about") === ev.family && desk.get(p, "brief_kind") === "room" && desk.get(p, "meeting_on") === day,
      );
    b.meetings.push(
      row(desk, ev.family, `${shortDate(day)} ${ev.start.slice(11, 16)}, ${ev.title}`, brief ? "Brief ready" : "No brief yet", brief ? brief.slug : null, "meeting", {
        start: ev.start,
      }),
    );
  }
  for (const fam of desk.of("families")) {
    if (desk.get(fam, "relationship_kind") !== "client" || effectiveOwner(desk, fam.slug) !== seat) continue;
    const sig = fresh(desk, fam.slug, today, BOOK_SIGNAL_DAYS);
    if (!sig) continue;
    const segment = (fam.header.segments || [""])[0];
    const holds = new Set(fam.header.holds || []);
    const fit = fittingProducts(desk.products, segment, new Set([desk.get(sig, "engine")]), holds);
    const extra = desk.products.length ? { products: fit } : { products: [], needs_connection: "products" };
    b.grow_the_book.push(row(desk, fam.slug, signalWhy(sig), `Signal ${shortDate(sig.header.as_of)}`, sig.slug, "book", extra));
  }
  for (const [f, conv, fam, by] of owed(desk, seat)) {
    if (by <= addDays(today, 2)) b.promises_owed.push(row(desk, fam, f.what, `Due ${shortDate(by)}`, conv, "promise"));
  }
  b.critical_mail = critical(desk, st, seat);
  b.chat = chat(desk, st, seat);
  const rows = weekRows(desk, seat, today);
  const counts = {
    meetings_week: b.meetings.length,
    meetings_today: b.meetings.filter((r) => asDate(r.start) === today).length,
    briefs_ready: b.meetings.filter((r) => r.ref).length,
    book_moments: b.grow_the_book.length,
    "promises": b.promises_owed.length,
    meetings_held: rows.filter((r) => r.action === "meeting-held").length,
    book_moments_acted: rows.filter((r) => r.action === "book-moment").length,
    to_calendar: b.to_calendar.length,
  };
  return frame(desk, "rm-console", seat, today, { blocks: b, counts, holes: undatedFollowUps(desk, seat), ...pageGates(desk, st, "rm-console", "rm") });
}

// A team's own totals read as a funnel, and the step where the drop is worst: nothing new is
// counted, every value is a total the caller holds. A step whose key is in `skip` is not counted
// (it reads a hole), so it is no step, and the funnel opens at the first step counted.
function funnel(totals, skip = []) {
  const keys = FUNNEL_KEYS.filter(([key]) => !skip.includes(key));
  const top = keys.length ? totals[keys[0][0]] || 0 : 0;
  const steps = [];
  for (const [key, label, short] of keys) {
    const value = totals[key] || 0;
    const before = steps.length ? steps[steps.length - 1] : null;
    steps.push({
      key,
      label,
      short,
      value,
      share: top ? pyRound((value * 100) / top) : 0,
      from: before ? before.value : null,
      from_label: before ? before.label : "",
      from_short: before ? before.short : "",
      from_share: before ? before.share : 0,
      lost: before ? Math.max(before.value - value, 0) : 0,
      gained: before ? Math.max(value - before.value, 0) : 0,
      kept: before && before.value ? pyRound((value * 100) / before.value) : null,
      stall: false,
    });
  }
  // the share carried is compared exactly (cross-multiplied), never as the rounded percent
  const losing = steps.filter((s) => s.lost);
  let stall = null;
  for (const s of losing) {
    if (stall === null) {
      stall = s;
      continue;
    }
    const c = s.value * stall.from - stall.value * s.from;
    if (c < 0 || (c === 0 && -s.lost < -stall.lost)) stall = s;
  }
  if (stall) stall.stall = true;
  return [steps, stall];
}

function leadGenView(desk, st, today) {
  const head = desk.of("seats").find((p) => p.header.role === "desk-head");
  if (!head) throw new Refusal("The team view needs a desk head: no seat page on this desk has role desk-head.");
  const rows = [];
  for (const rep of desk.of("seats").filter((p) => p.header.role === "rep").map((p) => p.slug)) {
    const v = repView(desk, st, rep, today);
    const doing = desk.log.filter((line) => line.handle === rep && line.day === today);
    const latest = doing.reduce((best, line) => (best === null || line.time > best.time ? line : best), null);
    rows.push({
      seat: rep,
      name: desk.title(rep),
      leads: v.counts.leads,
      ...Object.fromEntries(WEEK_KEYS.map((k) => [k, v.counts[k]])),
      stale: v.blocks.backlog.filter((r) => r.kind === "follow-up").length,
      crm_gaps: v.blocks.crm_gaps.length,
      doing: latest ? latest.what : "Not started today",
    });
  }
  const keys = ["leads", ...WEEK_KEYS, "stale", "crm_gaps"];
  const totals = Object.fromEntries(keys.map((k) => [k, rows.reduce((sum, r) => sum + r[k], 0)]));
  // the page's holes (round 4, row A9): a funnel step that reads one is no step of the page's
  // funnel, and no exception follows from the calls not in the CRM when their count is a hole
  const gates = pageGates(desk, st, "lead-gen", "desk-head");
  const [steps, stall] = funnel(totals, gates.not_counted);
  const unassigned = unassignedFor(desk, head.slug, today);
  const exceptions = exceptionLines(rows, unassigned.length, !gates.not_counted.includes("crm_gaps"));
  // the desk's pages name every follow-up of the desk counted as due nowhere
  return frame(desk, "lead-gen", head.slug, today, {
    reps: rows,
    totals,
    funnel: steps,
    stall,
    exceptions,
    unassigned,
    holes: undatedFollowUps(desk),
    ...gates,
  });
}

// The families with a fresh signal and no owner but the desk head `head`, as rows.
function unassignedFor(desk, head, today) {
  const unassigned = [];
  for (const f of desk.of("families")) {
    const owner = effectiveOwner(desk, f.slug);
    if (owner !== head && owner !== null) continue;
    const sig = fresh(desk, f.slug, today, FRESH_SIGNAL_DAYS);
    if (sig) unassigned.push(row(desk, f.slug, signalWhy(sig), `New signal, ${shortDate(sig.header.as_of)}`, sig.slug, "unassigned"));
  }
  return unassigned;
}

// The desk head's brief on a seat's graph keeps these keys of its page; the team's are not counted.
const GRAPH_HEAD_KEEPS = ["unassigned", "calendar"];
const TEAM_NOT_COUNTED =
  "The team's figures are not counted on a seat's graph: they read from-my-team, which the graph job fills from a later wave.";

// The team's exceptions, each seat's under its name; `crm` false leaves out the calls not in the
// CRM, which a brief drawn with the CRM in a hole cannot say.
function exceptionLines(rows, unassigned, crm = true) {
  const out = [
    ...(crm ? rows.filter((r) => r.crm_gaps).map((r) => `${r.name}: ${n(r.crm_gaps, "call", "calls")} not in your CRM`) : []),
    ...rows.filter((r) => r.stale).map((r) => `${r.name}: ${n(r.stale, "follow-up", "follow-ups")} overdue`),
  ];
  if (unassigned) out.push(`${n(unassigned, "new family", "new families")} with a signal and no owner`);
  return out;
}

// The connectors among `roles` whose rows are not counted, not handed over or set aside by the
// live-row contract (live/live.js), as holes, {role, why}: one copy, read by a seat's view, by a
// family's pages and by the read tools, so each says the same hole in the same words.
function notHandedOver(st, roles) {
  return roles.filter((r) => !st.given.includes(r)).map((r) => ({ role: r, why: NOT_HANDED_OVER[r] }));
}

// The connectors a family's pages and family_facts read: the CRM's records, numbers and touches.
const FAMILY_READS = ["crm"];

// The holes in a seat's view, as desk_count answers them, {role, why}: each connector the view
// reads whose rows were not handed over, then a desk with no family pages (round 3, row A6).
function viewUnread(desk, st, role) {
  const out = notHandedOver(st, VIEW_READS[role] || EVERY_ROLE);
  if (!desk.of("families").length) out.push({ role: "families", why: role === "rm" ? NO_BOOK_MOMENTS : NO_FAMILIES });
  // the desk head's view on a seat's graph counts no team (the base's ruling K9)
  if (role === "desk-head" && desk.read.graph) out.push({ role: "team", why: TEAM_NOT_COUNTED });
  return out;
}

// A seat page's holes and the keys of it that read one, through the one table (round 4, row A9):
// `unread`, each hole of the seat's view as desk_count answers it, and `not_counted`, each key of
// the page's table for the seat's role that reads one. A page draws no figure and no line of a key
// not counted.
function pageGates(desk, st, page, role) {
  const unread = viewUnread(desk, st, role);
  const missing = new Set(unread.map((h) => h.role));
  const reads = PAGE_READS[page][role];
  return { unread, not_counted: Object.keys(reads).filter((key) => reads[key].some((r) => missing.has(r))), page_keys: Object.keys(reads) };
}

// The morning brief's numbers and the view it opens onto, for any seat of the desk.
function briefView(desk, st, seat, today) {
  const role = seatPage(desk, seat, ["rep", "rm", "desk-head"]).header.role;
  const calendar = dayCalendar(st, seat, today);
  let detail;
  let numbers;
  if (role === "rep") {
    detail = repView(desk, st, seat, today);
    const b = detail.blocks;
    numbers = {
      to_reach: b.new_from_signals.length + b.to_reach.length,
      follow_ups: b.follow_ups_due.length + b.quiet.length,
      critical_mail: b.critical_mail.length,
      chat: b.chat.length,
      crm_gaps: b.crm_gaps.length,
      backlog: b.backlog.length,
      to_calendar: b.to_calendar.length,
    };
  } else if (role === "rm") {
    detail = rmView(desk, st, seat, today);
    const c = detail.counts;
    const b = detail.blocks;
    numbers = {
      meetings_today: c.meetings_today,
      meetings_week: c.meetings_week,
      briefs_to_make: c.meetings_week - c.briefs_ready,
      book_moments: c.book_moments,
      "promises": c["promises"],
      critical_mail: b.critical_mail.length,
      chat: b.chat.length,
      to_calendar: c.to_calendar,
    };
  } else if (desk.read.graph) {
    // The desk head's brief on a seat's graph keeps its own figure, the families with a signal and
    // no owner, from the graph's own pages; the team's figures are not counted, said as a hole (the
    // base's ruling K9; viewUnread).
    detail = { reps: [], unassigned: unassignedFor(desk, seat, today), holes: [] };
    numbers = { unassigned: detail.unassigned.length };
  } else {
    detail = leadGenView(desk, st, today);
    numbers = { ...detail.totals, unassigned: detail.unassigned.length };
  }
  // what the brief cannot count (round 3, row A6): each hole desk_count answers, in its words, and
  // the figures and blocks that read one, which the page draws as the hole and never as 0
  const gates = pageGates(desk, st, "morning-brief", role);
  const { unread, page_keys: pageKeys } = gates;
  const teamless = role === "desk-head" && desk.read.graph;
  const notCounted = teamless ? pageKeys.filter((key) => !GRAPH_HEAD_KEEPS.includes(key) || gates.not_counted.includes(key)) : gates.not_counted;
  const exceptions = role === "desk-head" ? exceptionLines(detail.reps, detail.unassigned.length, !notCounted.includes("crm_gaps")) : [];
  return frame(desk, "morning-brief", seat, today, {
    numbers,
    calendar,
    detail,
    exceptions,
    unread,
    not_counted: notCounted,
    page_keys: pageKeys,
    holes: [...unread.map((h) => h.why), ...detail.holes],
  });
}

// The rep-to-RM seam: the three states a hand-over can be in, each with the word a page lists it
// under and what that word means.
const RM_WEEK_KEYS = ["meetings_held", "book_moments_acted"];
const SEAM_KEYS = ["met", "on_calendar", "stalled"];
const SEAM_WORDS = {
  met: ["met", "a meeting held since the hand-over"],
  on_calendar: ["on the calendar", "a meeting ahead, on the RM's own calendar"],
  stalled: ["stalled", "no meeting held, and none on the calendar"],
};
const SEAM_AHEAD_DAYS = 365;

// The week's hand-overs from a rep to an RM, and what became of each: met (a meeting-held row on
// or after the hand-over), on the calendar (a meeting ahead on the RM's calendar), or stalled.
function handOverSeam(desk, st, today, reps) {
  const handles = seats(desk);
  const held = desk.deskLog.filter((r) => r.action === "meeting-held").map((r) => [unlink(r.lead), asDate(r.date)]);
  const ahead = new Map();
  const rows = [];
  for (const r of desk.deskLog) {
    if (r.action !== "handed-over" || !reps.includes(r.seat)) continue;
    const to = handedTo(r.outcome, handles);
    const when = asDate(r.date);
    const age = daysBetween(when, today);
    if (to === null || !(age >= 0 && age <= WEEK)) continue;
    const family = unlink(r.lead);
    if (!ahead.has(to)) {
      ahead.set(
        to,
        S.calendarEvents(st, to, today, addDays(today, SEAM_AHEAD_DAYS)).filter((ev) => ev.kind === "meeting" && ev.family),
      );
    }
    const days = held.filter(([fam, day]) => fam === family && day >= when).map(([, day]) => day);
    const met = days.length ? days.reduce((a, b) => (b > a ? b : a)) : null;
    const meeting = ahead.get(to).find((ev) => ev.family === family) || null;
    let state;
    let said;
    if (met) {
      state = "met";
      said = `Met ${shortDate(met)}`;
    } else if (meeting) {
      state = "on_calendar";
      said = `Meeting ${shortDate(meeting.start)} ${meeting.start.slice(11, 16)}`;
    } else {
      state = "stalled";
      said = "No meeting yet";
    }
    rows.push(
      row(desk, family, `${desk.title(r.seat)} handed it to ${desk.title(to)} on ${shortDate(when)}`, said, null, "hand-over", {
        state,
        to,
        to_name: desk.title(to),
        by: r.seat,
        by_name: desk.title(r.seat),
        handed_on: when,
      }),
    );
  }
  const split = Object.fromEntries(SEAM_KEYS.map((k) => [k, rows.filter((r) => r.state === k).length]));
  const parts = SEAM_KEYS.map((k) => ({
    key: k,
    word: SEAM_WORDS[k][0],
    said: SEAM_WORDS[k][1],
    value: split[k],
    share: rows.length ? pyRound((split[k] * 100) / rows.length) : 0,
  }));
  return { rows, handed: rows.length, parts, ...split };
}

// Where the desk stands at the moment the page is taken, for the head of lead generation. `now`
// is that moment, "YYYY-MM-DDTHH:MM[...]" in the desk's zone, which the caller passes: the engine
// keeps no clock of its own.
function snapshotView(desk, st, today, now) {
  if (typeof now !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(now)) {
    throw new Refusal(`The snapshot needs the moment it is taken, as "YYYY-MM-DDTHH:MM", not ${JSON.stringify(now)}.`);
  }
  const lg = leadGenView(desk, st, today);
  // through the one page table, as the team view draws (round 5, row A11): a funnel step that
  // reads a hole is no step, and the page names each hole in desk_count's words
  const gates = pageGates(desk, st, "snapshot", "desk-head");
  const [steps, stall] = funnel(lg.totals, gates.not_counted);
  const seam = handOverSeam(
    desk,
    st,
    today,
    lg.reps.map((r) => r.seat),
  );
  const rms = [];
  for (const p of desk.of("seats")) {
    if (p.header.role !== "rm") continue;
    const c = rmView(desk, st, p.slug, today).counts;
    rms.push({
      seat: p.slug,
      name: desk.title(p.slug),
      handed_over: seam.rows.filter((r) => r.to === p.slug).length,
      ...Object.fromEntries(RM_WEEK_KEYS.map((k) => [k, c[k]])),
    });
  }
  const first = addDays(today, -WEEK);
  // whether the desk log holds a row from before the week (round 3, row A5): the page says the
  // week is all the desk holds only when it holds none. What the desk held at the moment the page
  // was taken is the record of the desk-log rows it read (round 5, row A13), which check_reconcile
  // redraws from, so rows logged in the desk log since leave the page as it was drawn
  const older = desk.deskLog.some((r) => {
    const day = asDateOrNull(r.date);
    return day !== null && day < first;
  });
  return frame(desk, "snapshot", lg.seat, today, {
    reps: lg.reps,
    totals: lg.totals,
    funnel: steps,
    stall,
    seam,
    rms,
    unassigned: lg.unassigned.length,
    holes: lg.holes,
    ...gates,
    taken_at: now,
    taken_label: dateLabel(asDate(now)),
    taken_clock: now.slice(11, 16),
    week: { from: first, to: today, days: WEEK + 1, from_label: shortDate(first), to_label: shortDate(today), older },
    read: rowsRead(desk, now),
  });
}

// The desk log's rows as its file holds them, in its order, as the table reader reads them
// (desk.js readTable: the first table line names the columns, a rule line is passed over): each
// row's line and its index among the file's lines.
function deskLogLines(body) {
  const lines = String(body).split(/\r\n|\r|\n/);
  const rows = [];
  let header = false;
  lines.forEach((line, at) => {
    if (!line.startsWith("|")) return;
    if (!header) {
      header = true;
      return;
    }
    if ([...line.replace(/\|/g, "").trim()].every((ch) => "-: ".includes(ch))) return;
    rows.push({ line, at });
  });
  return { lines, rows };
}

// SHA-256 (FIPS 180-4) of a text's UTF-8 bytes, in hex, in plain code: the engine requires no
// built-in beyond the few the ip-hygiene screen allows, and a digest is the one thing here that
// needs one. Its test holds it to Node's own.
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotr = (x, r) => (x >>> r) | (x << (32 - r));
function sha256Hex(text) {
  const bytes = Buffer.from(String(text), "utf8");
  const n = bytes.length;
  const total = Math.ceil((n + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[n] = 0x80;
  // the message's length in bits, big-endian, in its last eight bytes
  const hi = Math.floor(n / 0x20000000);
  const lo = (n * 8) >>> 0;
  [hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo].forEach((b, i) => {
    m[total - 8 + i] = b & 0xff;
  });
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      const at = off + 4 * i;
      w[i] = ((m[at] << 24) | (m[at + 1] << 16) | (m[at + 2] << 8) | m[at + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, k].forEach((x, i) => {
      h[i] = (h[i] + x) >>> 0;
    });
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}

function deskLogBody(read) {
  const page = read.pages.find((p) => p.rel === "desk-log.md");
  return page ? page.body : "";
}

// The first `count` rows of the desk log, each its line as written, trimmed, in the file's order.
function deskLogRows(read, count) {
  return deskLogLines(deskLogBody(read))
    .rows.slice(0, count)
    .map((r) => r.line.trim());
}

// The one digest a snapshot's record carries (round 5, row A13; base ruling R56): over the minute
// it was taken, as its Taken-at line and its day say it, and the desk-log rows it read, together.
// No row has a digest of its own, so the page names no row: a digest over the whole run of rows
// cannot be guessed row by row, and the moment inside it holds the page's clock to its record.
// With the seat's snapshot key (DESK-147; render/key.js, read here alone) the digest is keyed, so
// a guess at the rows cannot be held to it without the key; with none it is the plain digest a
// page taken before snapshots were sealed carries.
function recordDigest(moment, lines, key) {
  const text = [String(moment).slice(0, 16), ...lines].join("\n");
  return key ? require("./key.js").keyedDigest(key, text) : sha256Hex(text);
}

// What a snapshot records of the desk log at its moment: how many of its rows it read, and the
// one digest over those rows and that moment. A writer adds a row after the last
// (write/writers.js), so the rows a snapshot read are the desk log's first rows as long as no row
// it read is changed or removed. With the seat's snapshot key the record is sealed: it carries its
// seal and its key's id as well (DESK-147).
function rowsRead(desk, now, key) {
  const lines = deskLogRows(desk.read, Infinity);
  const record = { rows: lines.length, digest: recordDigest(now, lines, key) };
  return key ? require("./key.js").sealed(key, now, record) : record;
}

// The desk as a snapshot read it: the same pages, with the desk log holding only its first
// `count` rows, and no row logged after them.
function deskAsRecorded(read, count) {
  const { lines, rows } = deskLogLines(deskLogBody(read));
  const drop = new Set(rows.slice(count).map((r) => r.at));
  const kept = lines.filter((_, at) => !drop.has(at)).join("\n");
  return { ...read, pages: read.pages.map((p) => (p.rel === "desk-log.md" ? { ...p, body: kept } : p)) };
}

// The desk log's rows by a plain split of the file itself, not through the desk's table reader:
// the independent count checkReconcile holds the views to.
function deskLogFile(desk) {
  const page = desk.read.pages.find((p) => p.rel === "desk-log.md");
  const lines = page ? page.body.split(/\r\n|\r|\n/).filter((x) => x.startsWith("| ")) : [];
  if (!lines.length) return [];
  const strip = (x) => x.replace(/^[| ]+|[| ]+$/g, "");
  const columns = strip(lines[0])
    .split("|")
    .map((c) => c.trim());
  return lines.slice(1).map((x) => {
    const got = strip(x)
      .split("|")
      .map((c) => c.trim());
    const out = {};
    columns.forEach((c, i) => {
      if (i < got.length) out[c] = got[i];
    });
    return out;
  });
}

function fileCounts(rows, seat, today, seatSet) {
  const mine = rows.filter((r) => {
    if (r.seat !== seat) return false;
    const age = daysBetween(asDate(r.date), today);
    return age >= 0 && age <= WEEK;
  });
  // each family once, by its lead cell's link read through render/desk.js unlink (linkSpans)
  const families = (...pairs) =>
    new Set(
      mine
        .filter((r) => pairs.some(([a, o]) => r.action === a && (o === null || o === r.outcome)))
        .map((r) => unlink(r.lead)),
    ).size;
  const count = (action) => mine.filter((r) => r.action === action).length;
  return {
    reached: families(["mail", null], ["call", "reached"]),
    replies: families(["reply", null]),
    meetings_set: count("meeting-set"),
    handed_over: mine.filter((r) => r.action === "handed-over" && handedTo(r.outcome, seatSet)).length,
    meetings_held: count("meeting-held"),
    book_moments_acted: count("book-moment"),
  };
}

// The team view must be the sum of the seats' own views, the snapshot must say the same as both,
// every row must carry its reasons, and every week count must match the desk log file counted
// afresh. `now` is the snapshot's moment, as snapshotView takes it.
function checkReconcile(desk, st, today, now) {
  return reconcileProblems(reconcileCounts(desk, st, today, now));
}

// What checkReconcile holds to each other, each counted its own way: the team view, each rep's
// console (once for the team view's rows, once for each rep seat), each RM's console, the desk log
// file's own counts for each of those seats, and the snapshot.
function reconcileCounts(desk, st, today, now) {
  const lg = leadGenView(desk, st, today);
  const consoles = lg.reps.map((r) => repView(desk, st, r.seat, today));
  const seatPages = desk.of("seats");
  const views = seatPages.filter((p) => p.header.role === "rep").map((p) => repView(desk, st, p.slug, today));
  const rmViews = seatPages.filter((p) => p.header.role === "rm").map((p) => rmView(desk, st, p.slug, today));
  const fileRows = deskLogFile(desk);
  const onDisk = seats(desk);
  const counted = new Map(lg.reps.map((r) => [r.seat, fileCounts(fileRows, r.seat, today, onDisk)]));
  const rmCounted = new Map(rmViews.map((v) => [v.seat, fileCounts(fileRows, v.seat, today, onDisk)]));
  return { lg, consoles, views, rmViews, counted, rmCounted, snap: snapshotView(desk, st, today, now) };
}

// Each way the counts reconcileCounts gathers do not say the same, as a sentence.
function reconcileProblems({ lg, consoles, views, rmViews, counted, rmCounted, snap }) {
  const problems = [];
  for (const [i, r] of lg.reps.entries()) {
    const v = consoles[i];
    for (const key of ["leads", ...WEEK_KEYS]) {
      if (r[key] !== v.counts[key]) problems.push(`${r.seat}: team view says ${key} ${r[key]}, the console says ${v.counts[key]}`);
    }
    if (r.crm_gaps !== v.blocks.crm_gaps.length) problems.push(`${r.seat}: CRM gaps differ between the team view and the console`);
  }
  for (const [key, total] of Object.entries(lg.totals)) {
    if (total !== lg.reps.reduce((sum, r) => sum + r[key], 0)) problems.push(`totals: ${key} is not the sum of the rows`);
  }
  for (const v of [...views, ...rmViews]) {
    for (const [name, rows] of Object.entries(v.blocks)) {
      for (const r of rows) if (!r.why || !r.why_today) problems.push(`${v.seat} ${name}: a row has no reason`);
    }
  }
  for (const r of lg.reps) {
    for (const key of WEEK_KEYS) {
      const c = counted.get(r.seat)[key];
      if (r[key] !== c) problems.push(`${r.seat}: the desk log file says ${key} ${c}, the team view says ${r[key]}`);
    }
  }
  for (const key of WEEK_KEYS) {
    const inFile = [...counted.values()].reduce((sum, c) => sum + c[key], 0);
    if (lg.totals[key] !== inFile) problems.push(`totals: the desk log file says ${key} ${inFile}, the team view says ${lg.totals[key]}`);
  }
  for (const v of rmViews) {
    const inFile = rmCounted.get(v.seat);
    for (const key of RM_WEEK_KEYS) {
      if (v.counts[key] !== inFile[key]) {
        problems.push(`${v.seat}: the desk log file says ${key} ${inFile[key]}, the console says ${v.counts[key]}`);
      }
    }
  }
  problems.push(...snapshotProblems(snap, lg, rmViews));
  return problems;
}

// The snapshot held to the team view: a total each counts is the same number, and a total in a
// hole is a hole on both (round 5, row A11), never held as the 0 that stands for it.
function snapshotProblems(snap, lg, rmViews) {
  const problems = [];
  for (const [key, total] of Object.entries(lg.totals)) {
    const hole = snap.not_counted.includes(key);
    if (hole !== lg.not_counted.includes(key)) {
      problems.push(hole ? `the snapshot does not count ${key}, the team view says ${total}` : `the snapshot says ${key} ${snap.totals[key]}, the team view does not count it`);
    } else if (!hole && snap.totals[key] !== total) {
      problems.push(`the snapshot says ${key} ${snap.totals[key]}, the team view says ${total}`);
    }
  }
  if (snap.reps.map((r) => r.seat).join("\n") !== lg.reps.map((r) => r.seat).join("\n")) {
    problems.push("the snapshot and the team view do not hold the same seats in the same order");
  }
  const seam = snap.seam;
  const handed = seam.handed;
  if (SEAM_KEYS.reduce((sum, k) => sum + seam[k], 0) !== handed) {
    problems.push(`the seam: ${handed} handed over, and ${SEAM_KEYS.map((k) => `${seam[k]} ${k}`).join(" + ")} does not add up to it`);
  }
  if (handed !== lg.totals.handed_over) problems.push(`the seam says ${handed} handed over, the team view says ${lg.totals.handed_over}`);
  const bySeat = new Map(rmViews.map((v) => [v.seat, v.counts]));
  for (const r of snap.rms) {
    for (const key of RM_WEEK_KEYS) {
      if (bySeat.has(r.seat) && r[key] !== bySeat.get(r.seat)[key]) {
        problems.push(`${r.seat}: the snapshot says ${key} ${r[key]}, the console says ${bySeat.get(r.seat)[key]}`);
      }
    }
  }
  return problems;
}

// The workday counts the skills read by name (base ruling R42 item (c)), each for one seat on one
// day and answered as {rows, count}; the list and each count's definition are the read tools'.
// A seat the desk does not hold is refused, naming the seats it does.
function anySeat(desk, seat) {
  const page = desk.pages.get(seat || "");
  if (page && page.kind === "seats") return page;
  throw new Refusal(`${JSON.stringify(seat || "")} is not a seat on this desk: ${seatsSaid(desk)}.`);
}

// The states of a supplied row not yet worked: `new`, and `assigned`, the state assign_lead (the
// one writer of supplied rows) writes (round 2, row B3, amending the read tools' list to it).
const NOT_WORKED_STATES = new Set(["new", "assigned"]);

// The seat's supplied leads, each once, as suppliedLeads reads them, owned as the consoles read a
// family's owner (round 4, row B6): effectiveOwner, the seat it was handed to first, else the seat
// its latest row gives it, a later assign_lead replacing an earlier one (round 3, row B5). A lead
// handed over leaves the seat that handed it on.
function seatLeads(desk, seat) {
  return [...suppliedLeads(desk).values()].filter((lead) => effectiveOwner(desk, lead.lead) === seat);
}

// new_supplied: the seat's supplied leads not yet worked, as one number and one per list; each list
// carries its id and the newest date among the leads counted on it. A lead is not yet worked when
// its latest row is in NOT_WORKED_STATES and the desk log holds no worked line for it (round 3,
// row B5), as the rep console reads it.
function newSupplied(desk, st, seat) {
  anySeat(desk, seat);
  const rows = seatLeads(desk, seat)
    .filter((lead) => NOT_WORKED_STATES.has(lead.state) && !lead.worked)
    .map((lead) => ({ lead: lead.lead, list: lead.list, date: lead.date }));
  const lists = new Map();
  for (const r of rows) {
    const had = lists.get(r.list) || { list: r.list, count: 0, date: null };
    had.count += 1;
    if (r.date !== null && (had.date === null || r.date > had.date)) had.date = r.date;
    lists.set(r.list, had);
  }
  return { count: rows.length, lists: [...lists.values()], rows };
}

// due_follow_ups: the seat's follow-ups in state `due` whose `by` is on or before the day, each
// row's seat as R42 (a) reads its source: the rows, and how many we owe (us) and are owed (them).
// A row whose `by` is no date is no row of the day's; `holes` names each such row of the seat's in
// the words its pages use (undatedFollowUps), and is there only when there is one.
function dueFollowUps(desk, st, seat, day) {
  anySeat(desk, seat);
  const rows = [];
  for (const f of desk.followUps) {
    const by = dueBy(f.by);
    if (f.state !== "due" || by === null || by > day) continue;
    const src = followUpSource(desk, f.from);
    if (src.seat !== seat) continue;
    rows.push({ owed_by: f.owed_by, who: f.who, what: f.what, by: f.by, from: f.from, family: src.family });
  }
  const owedBy = (who) => rows.filter((r) => r.owed_by === who).length;
  const holes = undatedFollowUps(desk, seat);
  return { rows, count: rows.length, us: owedBy("us"), them: owedBy("them"), ...(holes.length ? { holes } : {}) };
}

// events_today: the seat's calendar events on the day, of any kind, as it or as an attendee, by
// time: the rows (time, title, family) and their number. Not the RM console's meetings_today,
// which counts its meetings with a family only.
function eventsToday(desk, st, seat, day) {
  anySeat(desk, seat);
  const rows = dayCalendar(st, seat, day);
  return { rows, count: rows.length };
}

// M's states: the rows not yet worked, and those researched or contacted (round 2, row B3)
const ASKED_STATES = new Set([...NOT_WORKED_STATES, "researched", "contacted"]);

// A page's names as the page writes them: its title and each of its aliases.
function pageNameTexts(page) {
  const aliases = page.header.aliases;
  const all = [page.header.title, ...(Array.isArray(aliases) ? aliases : aliases ? [aliases] : [])];
  return all.filter((x) => typeof x === "string");
}

// A page's names as the CRM export is matched against them.
function pageNames(page) {
  return pageNameTexts(page).map(nameKey);
}

// queues/book.md's rows and the column that names each row's lead: `lead`, or `family` on a book
// with no lead column.
function bookMoments(desk) {
  const page = desk.read.pages.find((p) => p.rel === "queues/book.md");
  const rows = page ? readTable(page.body) : [];
  return { rows, column: rows.length && !Object.hasOwn(rows[0], "lead") ? "family" : "lead" };
}

// What makes a supplied lead already the desk's, as a reader of one lead: `book`, a `lead` of
// queues/book.md by slug (its `family` on a book with no lead column), and `crm-export`, the lead
// page's title or an alias among `names`, the name column of the newest CRM export. The one
// matching supplied_already_yours and calls_for_today both read; `names` is null where there is no
// export to read, and the book is matched all the same.
function deskHolds(desk, names) {
  const { rows, column } = bookMoments(desk);
  const book = new Set(rows.map((r) => unlink(r[column])).filter(Boolean));
  return (lead) => {
    const page = desk.pages.get(lead);
    const matched = [];
    if (book.has(lead)) matched.push("book");
    if (names && page && pageNames(page).some((name) => names.has(name))) matched.push("crm-export");
    return matched;
  };
}

// supplied_already_yours: of the seat's supplied leads whose latest row is in state new, assigned,
// researched or contacted (M), each once as suppliedLeads reads it (round 3, row B5), those
// already the desk's (N), as deskHolds matches them. With no export, or one with no name column or
// that cannot be read, it is not available, with the reason, never zero.
function suppliedAlreadyYours(desk, st, seat) {
  anySeat(desk, seat);
  const found = crmExport(desk.root, desk.crm);
  if (!found.available) return { available: false, reason: found.reason };
  const held = deskHolds(desk, found.names);
  const asked = seatLeads(desk, seat).filter((lead) => ASKED_STATES.has(lead.state));
  const rows = [];
  for (const { lead, list } of asked) {
    const matched = held(lead);
    if (matched.length) rows.push({ lead, list, matched });
  }
  return { available: true, export: found.file, n: rows.length, m: asked.length, rows };
}

// a time as ISO 8601 with its offset, as research-lead notes its start and a page its timestamp
const OFFSET_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function offsetTime(value) {
  return typeof value === "string" && OFFSET_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

// research_minutes: the minutes from the start research-lead passes to the `timestamp` of the page
// it wrote, rounded up to the whole minute (a minute begun counts). A start after the write is
// refused, naming both, and gives no number.
function researchMinutes(desk, st, seat, day, { start, page } = {}) {
  anySeat(desk, seat);
  if (!offsetTime(start)) {
    throw new Refusal(`research_minutes: the start ${JSON.stringify(start)} is not a time with its offset, like 2026-09-21T10:00:00+05:30.`);
  }
  const p = sourcePage(desk, page);
  if (!p) throw new Refusal(`research_minutes: ${JSON.stringify(page)} names no page on this desk.`);
  const rel = `${p.kind}/${p.slug}.md`;
  const written = p.header.timestamp;
  if (!offsetTime(written)) throw new Refusal(`research_minutes: ${rel} carries no timestamp with its offset, so when it was written is not known.`);
  const ms = Date.parse(written) - Date.parse(start);
  if (ms < 0) {
    throw new Refusal(`research_minutes: the start ${start} is after ${rel} was written, at ${written}; a clock that runs backwards is an error, never 0.`);
  }
  return { minutes: Math.ceil(ms / 60000), start, written, page: rel };
}

// calls_for_today (base ruling R45 2, as E7's spec says it in words; row DESK-99): the seat's
// calls of the day in triage's order, cut at the desk's cap. An order and a cut, not a count: each
// row is one lead with every reason it has, and triage writes its sentence from the row's fields.

// the kinds a lead is called for, in the order that places it within its clock, and the key each
// kind's rows are answered under
const CALL_KINDS = ["follow-up", "reply", "supplied", "book moment"];
const CALL_KIND_KEYS = { "follow-up": "follow_up", reply: "reply", supplied: "supplied", "book moment": "book_moment" };
// the folders a lead's own page is read from
const LEAD_FOLDERS = new Set(["people", "families", "firms"]);
const HANDLE_WITH_CARE = "handle-with-care";
const REASON_TO_CALL = "reason-to-call";
// A clock whose key, in one letter case with every run of spaces, hyphens and underscores as one
// hyphen, equals the care key is the care clock (P6, item 4 of its ruling), however
// a page writes it. Only the care key is folded; the other clocks keep an
// exact match.
function isCareClock(key) {
  return String(key).trim().toLowerCase().replace(/[\s_-]+/gu, "-") === HANDLE_WITH_CARE;
}
// the day's order of clocks where motion-spec.md holds no list of them that can be read, and the
// one sentence that says so
const BUILT_IN_CLOCKS = ["money-in-motion", REASON_TO_CALL, HANDLE_WITH_CARE];
const NO_CLOCKS = `motion-spec.md holds no list of clocks that can be read, so today's calls are in the built-in order of clocks: ${BUILT_IN_CLOCKS.join(", ")}.`;
// what a row with no clock says, with no page and with a page; never said of a page that carries
// a clock
const NO_PAGE_YET = "no page yet; research first";
const NO_CLOCK_ON_PAGE = "no clock on the page";
// what the rows that belong to no seat are said with, as a hole of the answer
const NO_SEAT =
  "The rows under no_seat are nobody's yet: each is a supplied name or a book moment with no seat named for it and no page of its own naming an owner, " +
  "or a follow-up whose source names no seat, so it is on no seat's day, outside the order and the cap.";
// The states of a supplied lead's latest row that put it on the day are ASKED_STATES, the set
// supplied_already_yours reads: the not-worked states (NOT_WORKED_STATES, `new` and `assigned`),
// and researched and contacted. A row already-yours is never a call.
// a book moment is on the day from this many days before it through the day
const BOOK_MOMENT_DAYS = 6;
const DAY_IN_LINE = /\b\d{4}-\d{2}-\d{2}\b/g;

// The lead's own page, under people/, families/ or firms/, or null.
function leadPage(desk, slug) {
  const page = desk.pages.get(slug);
  return page && LEAD_FOLDERS.has(page.kind) ? page : null;
}

// A page header's value as the page has it, or null.
function headerValue(page, key) {
  const value = page ? page.header[key] : undefined;
  return value === undefined ? null : value;
}

// The freshest dated line under the page's "## What just happened", as written, or null: a line
// is dated by the latest day it names, and of two lines on the same day the one higher on the page
// is taken.
function freshestLine(desk, page) {
  let best = null;
  for (const line of desk.section(page.body, "What just happened")) {
    const days = (line.match(DAY_IN_LINE) || []).map(asDateOrNull).filter((d) => d !== null);
    if (!days.length) continue;
    const day = days.reduce((a, b) => (b > a ? b : a));
    if (best === null || day > best.day) best = { day, line: line.trim() };
  }
  return best ? best.line : null;
}

// The lines of context/never-say.md's body, a heading among them: a heading that names a lead
// marks it as any other line does.
function neverSayLines(desk) {
  const page = desk.read.pages.find((p) => p.rel === "context/never-say.md");
  if (!page) return [];
  return String(page.body)
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const WORD_CHAR = /[a-z0-9]/;

// A line or a name as the two are compared: in one letter case, its words one space apart.
function folded(text) {
  return String(text).toLowerCase().split(/\s+/u).filter(Boolean).join(" ");
}

// Whether a line names `name`: the name in any case, with no letter or digit either side of it.
function lineNames(line, name) {
  const text = folded(line);
  const want = folded(name);
  if (!want) return false;
  for (let at = text.indexOf(want); at !== -1; at = text.indexOf(want, at + 1)) {
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + want.length] || "";
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
  }
  return false;
}

// Every name a never-say line may name a lead by: its slug and the slug's words, and, where it
// has a page, the page's title and each alias the page carries.
function leadNames(lead, page) {
  const names = [lead, lead.split("-").join(" ")];
  if (page) names.push(...pageNameTexts(page));
  return names;
}

// motion-spec.md's clocks, in its order, or null where its header holds no list of them that can
// be read (no motion spec, no `clocks`, an empty list, or a value that is no list); and its cap on
// a day's calls as the header holds it.
function motionSpec(desk) {
  const page = desk.read.pages.find((p) => p.rel === "motion-spec.md");
  const head = page && page.head && typeof page.head === "object" && !Array.isArray(page.head) ? page.head : {};
  const listed = Array.isArray(head.clocks) ? head.clocks.map((c) => unlink(c).trim()).filter(Boolean) : [];
  return { clocks: listed.length ? listed : null, capSet: Object.hasOwn(head, "cap_calls_per_day") && head.cap_calls_per_day !== null, cap: head.cap_calls_per_day };
}

// The clocks in the day's order: the motion spec's, or the built-in ones where it holds no list
// that can be read; reason-to-call after them when the list does not hold it, and handle-with-care
// last wherever the list puts it.
function clockOrder(clocks) {
  const out = [];
  for (const clock of clocks || BUILT_IN_CLOCKS) if (clock !== HANDLE_WITH_CARE && !out.includes(clock)) out.push(clock);
  if (!out.includes(REASON_TO_CALL)) out.push(REASON_TO_CALL);
  out.push(HANDLE_WITH_CARE);
  return out;
}

// The cap the day is cut at, or none and the one sentence that says why: a cap is a whole number
// of 1 or more, as the header holds it, and is never guessed.
function dayCap(spec) {
  const cap = spec.cap;
  if (typeof cap === "number" && Number.isInteger(cap) && cap >= 1) return { cap, no_cut: null };
  if (!spec.capSet) return { cap: null, no_cut: "motion-spec.md sets no cap_calls_per_day, so today's calls are not cut." };
  return {
    cap: null,
    no_cut: `cap_calls_per_day in motion-spec.md is ${JSON.stringify(cap)}, which is not a whole number of 1 or more, so today's calls are not cut.`,
  };
}

// Two days as a sort reads them: a day before no day, earliest first, or newest first.
function byDay(a, b, newest) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a < b ? -1 : 1) * (newest ? -1 : 1);
}

// One row of the answer, and its place in the order: a lead with every reason it has and its
// clock. Handle with care is the clock of a lead a never-say line names, by any name of
// leadNames, and of a page whose own clock says so (the key or its words, isCareClock), whatever the day's order lists. A page's
// clock that the order does not hold places the row as reason-to-call and is said in
// clock_not_listed; no_clock is said only of a lead with no page or a page with no clock.
function callRow(desk, lead, kinds, order, careLines) {
  const page = leadPage(desk, lead);
  const title = page ? desk.title(lead) : lead;
  const kindsHeld = CALL_KINDS.filter((k) => kinds.has(k));
  // each kind's rows, its most pressing first: the earliest `by` or list date, the newest moment
  for (const k of kindsHeld) kinds.get(k).sort((a, b) => byDay(a.key, b.key, k === "book moment"));
  const first = kindsHeld[0];
  const names = leadNames(lead, page);
  const named = careLines.some((line) => names.some((name) => lineNames(line, name)));
  const written = page ? desk.get(page, "clock").trim() : "";
  // a page's care clock in words is the canonical key on the row, so the split and every reader
  // see one key
  const onPage = isCareClock(written) ? HANDLE_WITH_CARE : written;
  let clock = REASON_TO_CALL;
  let noClock = null;
  let notListed = null;
  // the day's order always holds handle-with-care and reason-to-call (clockOrder), so a page's own
  // care clock is honoured whatever motion-spec.md lists
  if (named) clock = HANDLE_WITH_CARE;
  else if (order.includes(onPage)) clock = onPage;
  else if (onPage) notListed = `The page's clock is ${JSON.stringify(onPage)}, which is not in the day's order of clocks, so the row is placed as ${REASON_TO_CALL}.`;
  else noClock = page ? NO_CLOCK_ON_PAGE : NO_PAGE_YET;
  const said = { lead, title, clock, kinds: kindsHeld, no_clock: noClock, clock_not_listed: notListed, ...researchCare(desk, lead) };
  for (const k of kindsHeld) said[CALL_KIND_KEYS[k]] = kinds.get(k).map((r) => r.fields);
  said.source = first === "supplied" ? `supplied-${kinds.get(first)[0].fields.list}` : first === "book moment" ? "book" : "follow-up";
  // Track G G10: a placed lead's tier, persona ordinal and profile version (icpTags), on the row
  // only when all three read; a lead with none shows none
  const icp = kinds.has("supplied") ? kinds.get("supplied")[0].icp || null : null;
  if (icp) Object.assign(said, icp);
  if (page) said.page_as_of = headerValue(page, "timestamp");
  else said.no_page = true;
  said.last_touch = headerValue(page, "last_touch");
  said.readiness = headerValue(page, "readiness");
  said.what_just_happened = page ? freshestLine(desk, page) : null;
  return { said, place: [order.indexOf(clock), CALL_KINDS.indexOf(first), first === "supplied" ? tierRank(icp) : 0, kinds.get(first)[0].key, first === "book moment"] };
}

// One-desk's Q-OD7: inside a clock and a kind, the supplied names go P0, P1, P2, then the untagged,
// then by their day; the kinds keep their order, so a follow-up or a reply is never below them.
function tierRank(icp) {
  return icp ? ICP_TIERS.indexOf(icp.tier) : ICP_TIERS.length;
}

// Two rows in the day's order: by clock, then by kind, then by tier (supplied names only), then by
// the kind's own day, then by slug.
function byPlace(a, b) {
  const [ca, ka, ta, da, newest] = a.place;
  const [cb, kb, tb, db] = b.place;
  if (ca !== cb) return ca - cb;
  if (ka !== kb) return ka - kb;
  if (ta !== tb) return ta - tb;
  const d = byDay(da, db, newest);
  if (d !== 0) return d;
  return a.said.lead < b.said.lead ? -1 : a.said.lead > b.said.lead ? 1 : 0;
}

function callsForToday(desk, st, seat, day) {
  anySeat(desk, seat);
  // the seat's leads, and the leads of no seat: each a map of its kinds to their rows
  const mine = new Map();
  const nobodys = new Map();
  const take = (leads, lead, kind, fields, key, icp = null) => {
    if (!lead) return;
    if (!leads.has(lead)) leads.set(lead, new Map());
    const kinds = leads.get(lead);
    if (!kinds.has(kind)) kinds.set(kind, []);
    kinds.get(kind).push(icp ? { fields, key, icp } : { fields, key });
  };
  // input 1: a follow-up due by the day, and a reply; the seat by the row's source (R42 (a)), or
  // no seat's where the source names none
  for (const f of desk.followUps) {
    const by = dueBy(f.by);
    const kind = f.state === "due" && by !== null && by <= day ? "follow-up" : f.state === "replied" ? "reply" : null;
    const from = kind === null ? null : followUpSource(desk, f.from).seat;
    if (kind === null || (from !== seat && from !== null)) continue;
    take(from === null ? nobodys : mine, unlink(f.who).trim(), kind, { what: f.what, by: f.by, from: f.from }, by);
  }
  // input 2: a supplied lead by its latest row, the seat's as the counts read it (R42 (b)), or no
  // seat's. One the desk already holds (deskHolds, the book matched with or without a CRM export)
  // is no call: it is named in already_yours with what matched, and spends no cap.
  const found = crmExport(desk.root, desk.crm);
  const held = deskHolds(desk, found.available ? found.names : null);
  const alreadyYours = [];
  for (const lead of suppliedLeads(desk).values()) {
    const owner = effectiveOwner(desk, lead.lead);
    if (!ASKED_STATES.has(lead.state) || (owner !== seat && owner !== null)) continue;
    const matched = held(lead.lead);
    if (matched.length) alreadyYours.push({ lead: lead.lead, list: lead.list, matched, ...(owner === null ? { no_seat: true } : {}) });
    else take(owner === null ? nobodys : mine, lead.lead, "supplied", { list: lead.list, date: lead.row.date }, lead.date, lead.icp);
  }
  // input 3: a book moment of the last week, the seat's as every reader reads a lead's owner
  // (effectiveOwner: a hand-over first, and a hand-over never rewrites the page), or no seat's
  const book = bookMoments(desk);
  const from = addDays(day, -BOOK_MOMENT_DAYS);
  for (const b of book.rows) {
    const lead = unlink(b[book.column]).trim();
    const at = asDateOrNull(b.date);
    if (!lead || at === null || at < from || at > day) continue;
    const owner = effectiveOwner(desk, lead);
    if (owner !== seat && owner !== null) continue;
    take(owner === null ? nobodys : mine, lead, "book moment", { moment: b.moment, date: b.date }, at);
  }
  const spec = motionSpec(desk);
  const order = clockOrder(spec.clocks);
  const careLines = neverSayLines(desk);
  const rows = [...mine].map(([lead, kinds]) => callRow(desk, lead, kinds, order, careLines)).sort(byPlace);
  const called = rows.filter((r) => r.said.clock !== HANDLE_WITH_CARE).map((r) => r.said);
  const care = rows.filter((r) => r.said.clock === HANDLE_WITH_CARE).map((r) => r.said);
  // the rows of no seat: in no order and cut at no cap, by slug, the same for every seat that asks
  const noSeat = [...nobodys]
    .map(([lead, kinds]) => callRow(desk, lead, kinds, order, careLines).said)
    .sort((a, b) => (a.lead < b.lead ? -1 : a.lead > b.lead ? 1 : 0));
  const { cap, no_cut: noCut } = dayCap(spec);
  const out = {
    today: cap === null ? called : called.slice(0, cap),
    later_today: cap === null ? [] : called.slice(cap),
    handle_with_care: care,
    cap,
    no_cut: noCut,
    no_clocks: spec.clocks === null ? NO_CLOCKS : null,
    already_yours: alreadyYours,
    no_seat: noSeat,
  };
  // a due follow-up whose `by` is no date is on no day: named, as due_follow_ups names it. An
  // export that is there but cannot be read is said in supplied_already_yours' own words, so no
  // supplied name it holds is called as new in silence; a desk with no export is the book alone.
  const holes = [
    ...(noSeat.length ? [{ role: "seats", why: NO_SEAT }] : []),
    ...(!found.available && !found.none ? [{ role: "crm export", why: found.reason }] : []),
    ...undatedFollowUps(desk, seat, true).map((why) => ({ role: "follow-ups", why })),
  ];
  return holes.length ? { ...out, holes } : out;
}

const WORKDAY_COUNTS = {
  new_supplied: newSupplied,
  due_follow_ups: dueFollowUps,
  events_today: eventsToday,
  supplied_already_yours: suppliedAlreadyYours,
  research_minutes: researchMinutes,
  calls_for_today: callsForToday,
};

// The connectors each workday count reads beyond the desk's own pages, as VIEW_READS says a
// view's: [] is a count that reads the desk's pages only. desk_count's holes for a count are read
// from here. supplied_already_yours reads the CRM export kept on the desk, never the CRM
// connector's rows, and says an export it cannot read in its own answer.
const WORKDAY_READS = {
  new_supplied: [],
  due_follow_ups: [],
  events_today: CAL,
  supplied_already_yours: [],
  research_minutes: [],
  calls_for_today: [],
};

module.exports = {
  graphSeat,
  teamOnGraph,
  seatsSaid,
  WORKDAY_COUNTS,
  WORKDAY_READS,
  NOT_HANDED_OVER,
  NO_FAMILIES,
  NO_BOOK_MOMENTS,
  VIEW_READS,
  PAGE_READS,
  FAMILY_READS,
  notHandedOver,
  viewUnread,
  pageGates,
  suppliedLeads,
  icpTags,
  liveRow,
  liveAt,
  doorCells,
  doorReadsList,
  doorRowsOf,
  doorKept,
  DOOR_FILE_BYTES,
  DOOR_FILE_ROOM,
  withdrawnPages,
  leadPageName,
  nightReaches,
  placedFile,
  placedLeadId,
  PLACED_CELLS,
  PLACED_FOLDER,
  PLACED_LIST,
  ICP_TIERS,
  ICP_TAG_KEYS,
  dueBy,
  fittingProducts,
  effectiveOwner,
  followUpSource,
  suppliedSeat,
  recordsOf,
  inCrm,
  signalWhy,
  seatPage,
  latestHandOvers,
  handedTo,
  repView,
  rmView,
  leadGenView,
  briefView,
  handOverSeam,
  snapshotView,
  checkReconcile,
  reconcileCounts,
  reconcileProblems,
  snapshotProblems,
  sha256Hex,
  deskLogRows,
  recordDigest,
  rowsRead,
  deskAsRecorded,
  funnel,
  dayCalendar,
  pyRound,
  row,
  clean,
  QUIET_DAYS,
  FRESH_SIGNAL_DAYS,
  BOOK_SIGNAL_DAYS,
  STALE_SUPPLY_DAYS,
  WEEK,
  WEEK_KEYS,
  RM_WEEK_KEYS,
  SEAM_KEYS,
  SEAM_WORDS,
  FUNNEL_KEYS,
};

// A list line of a research page that opens with the words "handle with care", in any letter case,
// after a list marker (`-`, `*`, `+`, `1.` or `1)`) and, where the line has one, a bold mark (`**`
// or `__`): followed by the end of the line, a space, ":" or the closing bold mark. A line that only
// mentions the words later, that runs them into a longer word, or that is no list line, is not one.
// The shown text is the line from the bold mark or the words on, as written.
const CARE_LINE = /^\s*(?:[-*+]|\d+[.)])\s+((?:\*\*|__)?handle\s+with\s+care(?=$|[\s:]|\*\*|__).*)$/iu;
// the line that opens or closes a fenced block of a page
const FENCE = "\u0060\u0060\u0060";

// A header's time as an instant in milliseconds, or null where it is missing or not a time with its
// offset as a pack writes it (OFFSET_TIME): never a lenient reading of some other form.
function instantOrNull(value) {
  return offsetTime(value) ? Date.parse(value) : null;
}

// Whether a research page is a pack: a signal page carries `engine` and `engine_label`, a pack's
// header holds neither (pack.py: type, title, description, about, as_of, timestamp).
function isPack(page) {
  return !Object.hasOwn(page.header, "engine") && !Object.hasOwn(page.header, "engine_label");
}

// Two research pages as a sort reads them, newest first: by `as_of`, then by the header's
// `timestamp` as an instant. Never by file name or file order. A page with no readable time reads
// as the oldest, and two such pages tie.
function byNewestResearch(desk, a, b) {
  const asOf = (page) => desk.get(page, "as_of").trim();
  const [x, y] = [asOf(a), asOf(b)];
  if (x !== y) return x < y ? 1 : -1;
  const [ta, tb] = [instantOrNull(a.header.timestamp), instantOrNull(b.header.timestamp)];
  if (ta === tb) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return tb - ta;
}

// The first care line of a page's body, outside any fenced block, as written, or null.
function careLineOf(body) {
  let fenced = false;
  for (const line of String(body).split(/\r\n|\r|\n/)) {
    if (line.trimStart().startsWith(FENCE)) {
      fenced = !fenced;
      continue;
    }
    const found = fenced ? null : CARE_LINE.exec(line);
    if (found) return found[1].trim();
  }
  return null;
}

// The care line of the lead's newest research pack, as the pack wrote it, and the page's slug, or
// nulls. Only packs count (a signal page, which carries `engine`, is read past), and only the
// newest: where `as_of` and `timestamp` both tie, the first of the tied pages (by slug) that holds
// a care line is read. This only shows the line; the row's clock, place and pitch are never read
// from it (D-IND-36: the chip changes nothing else).
function researchCare(desk, lead) {
  const pages = desk.of("research").filter((page) => isPack(page) && desk.get(page, "about") === lead);
  if (!pages.length) return { research_care: null, research_care_page: null };
  pages.sort((a, b) => byNewestResearch(desk, a, b) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const newest = pages.filter((page) => byNewestResearch(desk, pages[0], page) === 0);
  for (const page of newest) {
    const line = careLineOf(page.body);
    if (line !== null) return { research_care: line, research_care_page: page.slug };
  }
  return { research_care: null, research_care_page: null };
}
