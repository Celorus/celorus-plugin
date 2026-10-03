"use strict";
// The read tools, served by both doors: lib/tools.js takes this list by one load and one spread,
// as it takes the writers. Names and inputs are the demo server's (desk_count, team_rollup,
// book_query, family_facts), with two more on each, as render_view takes them: `desk`, as every
// desk tool takes it, and `systems`, the rows the skill read from the desk's connectors (base
// ruling R7; render/systems.js has the contract). The demo read those rows from its own state
// files; the engine never reaches a connector, so they come in as an argument.
//
// One reader: every number and row is counted by render/counts.js or read by render/facts.js,
// reached through its file's exports so no second copy of a count lives here. Every answer is
// desk-relative (slugs, handles and paths under celorus/, never a folder on this machine), and a
// hole in it says why: a connector's rows not handed over, a desk with no family pages (and so
// no book moment), a relationship no family has, signals left out as no liquidity event, or a
// liquidity filter not applied because no signal on the desk names an engine.
//
// lib/tools.js loads this file, so its helpers are reached when a tool runs, never at load.

const { Refusal } = require("../lib/refusal.js");
const { pluginVersion } = require("../lib/version.js");
const { readDesk, DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { Desk } = require("../render/desk.js");
const { systemsOf } = require("../render/systems.js");
const { liveRows } = require("../live/live.js");
const { todayInIst } = require("../render/index.js");
const C = require("../render/counts.js");
const F = require("../render/facts.js");
const W = require("../render/words.js");
const { bookRows, namesEngines, LIQUIDITY } = require("./book.js");

const VIEWS = ["brief", "rep", "rm", "team"];
const ROLE_WORD = { rep: "SDR", rm: "RM", "desk-head": "desk head" };
// What a connector's rows, or a desk's missing family pages, leave uncounted is said in counts.js's
// words (C.NOT_HANDED_OVER, C.NO_FAMILIES, C.NO_BOOK_MOMENTS), and a seat's view's holes are
// counts.js's viewUnread: one copy, which the morning brief draws its holes from too.
// Asked for liquidity signals only, on a desk where no signal names an engine: no signal can say
// it is a liquidity event, so the rows are not filtered to nothing; the engines are not named.
const NO_ENGINE =
  "This desk's signals name no liquidity event: none of them names an engine, so the liquidity " +
  "filter was not applied and every signal was read.";
const PULL = { pulled: false, note: "this view is counted from the desk on this machine; nothing was pulled" };

const DATE = { type: "string", description: "The day, as 2026-09-21. Leave it out for today in IST." };
const SYSTEMS = {
  type: "object",
  description:
    "The rows read from the desk's connectors, in the stand-in systems' shape: crm (records, " +
    "activities), calendar (events, proposals), mail (threads) and chat (messages), as render_view " +
    "takes them. Leave a role out when its connector is not there: the answer's holes say what that " +
    "leaves uncounted. Every time is an ISO string in IST, like 2026-09-21T10:00:00+05:30.",
};

// The desk, read once through the engine's one reader, and the systems rows checked for their
// shape. The rows themselves are handed to no tool from here: each tool that counts them takes
// them from underContract, below.
function context(tool, args, allowed) {
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(tool, args, allowed);
  const day = dayOf(args.date);
  systemsOf(args.systems, { held: true });
  const read = readDesk(deskFor(args.desk));
  if (read.stampsUnread) {
    throw new Refusal(`The desk's stamps page ${read.stampsUnread.rel} cannot be read, so nothing is counted. Run check_desk to see why.`);
  }
  return { tool, day, desk: new Desk(read), read };
}

// The systems rows a read tool counts, under the live-row contract (row E11, live/live.js), as
// render_view holds it: a role holding a row that names no one on the desk is counted as not
// handed over, so its hole is said as any hole is. `st` is the rows that are left; `told` adds to
// every answer the roles that fell back (`fell_back`) and each refused row by its role, list and
// rule (`dropped`), never by its value: both always, empty when nothing fell back, as render_view
// and check_reconcile answer them. Every read tool that takes `systems` counts from this `st` and
// no other: one copy, so a guard on one door is never a hole on the next.
function underContract(args, read) {
  const contract = liveRows(args.systems, read);
  const st = systemsOf(contract.systems);
  const told = (counted) => ({ ...counted, fell_back: contract.fell_back, dropped: contract.dropped });
  return { st, told };
}

function dayOf(date) {
  return dayArg("date", date, "today in IST") || todayInIst();
}

// Every day argument of the read tools: a real calendar day, checked by W.asDate, or left out
// ("" when left out). An impossible day (2026-13-45, 2026-09-31) is refused in the same words
// whichever argument carries it; `blank` says what leaving it out means.
function dayArg(name, value, blank) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try {
      return W.asDate(value);
    } catch {
      // said below, with the shape a day is written in
    }
  }
  throw new Refusal(`\`${name}\` is ${JSON.stringify(value)}, not a day: write it like 2026-09-21, or leave it out for ${blank}.`);
}

// "asha (rep), ravi (rm)": the desk's seats with their roles, for a refusal.
function seatsSaid(desk) {
  const seats = desk.of("seats").map((p) => `${p.slug} (${p.header.role || "no role"})`);
  return seats.length ? seats.join(", ") : "none";
}

// A view needs a seat of one of `roles` on the desk: refused, naming the seats it has, when the
// desk has none, so the refusal never lists an empty set.
function needRole(desk, roles, view) {
  if (desk.of("seats").some((p) => roles.includes(p.header.role))) return;
  if (roles.length === 1 && roles[0] === "desk-head") {
    throw new Refusal(
      `The ${view} view needs a desk head: no seat page on this desk has role desk-head. Its seats are: ${seatsSaid(desk)}.`,
    );
  }
  const words = roles.map((role) => ROLE_WORD[role] || role).join(" or ");
  throw new Refusal(`This desk has no ${words} seat, so there is no ${view} view to count. Its seats are: ${seatsSaid(desk)}.`);
}

// The holes of a tool that is not a seat's view (family_facts, book_query): each connector it reads
// whose rows were not handed over, and a desk with no family pages where it reads over families.
function holes(desk, st, roles, overFamilies) {
  const out = C.notHandedOver(st, roles);
  if (overFamilies && !desk.of("families").length) out.push({ role: "families", why: C.NO_FAMILIES });
  return out;
}

function answer(tool, data, st, found) {
  return { tool, plugin_version: pluginVersion(), ...data, systems: st.given, holes: found };
}

// desk_count's `count`: one workday count (counts.js WORKDAY_COUNTS) for one seat on one day, in
// place of a view. The count reads the seat itself and says its own refusals; `start` and `page`
// are research_minutes' inputs and go with no other count and no view. Its holes are the
// connectors it reads (counts.js WORKDAY_READS) that were not handed over, then the count's own
// (due_follow_ups names a follow-up with no date it is due by), each as a `why`. A count that
// reads a connector not handed over answers no figure at all: a figure that is absent is never
// read as zero, so the answer holds the hole and `not_counted`, the keys the count would have
// answered, as a page's gates name the keys it does not count. The rule is read from the table,
// never from a count's name.
const COUNTS = Object.keys(C.WORKDAY_COUNTS);
const TIMED = "research_minutes";
const VIEW_OR_COUNT = `desk_count needs \`view\` or \`count\`. The views are: ${VIEWS.join(", ")}. The counts are: ${COUNTS.join(", ")}.`;
const NOT_BOTH = "desk_count takes `view` or `count`, never both: `view` is a view of the desk, `count` one workday count for one seat on one day.";
const TIMED_ONLY = `\`start\` and \`page\` go with \`count\` "${TIMED}" only: leave them out of a view and of every other count.`;

function workdayCount(tool, desk, st, day, args) {
  const { count, seat, start, page } = args;
  if (args.view !== undefined) throw new Refusal(NOT_BOTH);
  if (typeof count !== "string" || !Object.hasOwn(C.WORKDAY_COUNTS, count)) {
    throw new Refusal(`${JSON.stringify(count)} is not a count desk_count counts. The counts are: ${COUNTS.join(", ")}.`);
  }
  const timed = count === TIMED;
  if (!timed && (start !== undefined || page !== undefined)) throw new Refusal(TIMED_ONLY);
  const { holes: own = [], ...data } = C.WORKDAY_COUNTS[count](desk, st, seat, day, timed ? { start, page } : undefined);
  const unread = holes(desk, st, C.WORKDAY_READS[count], false);
  // a count's own hole is a sentence about a follow-up, or a hole with its own role
  const found = [...unread, ...own.map((hole) => (typeof hole === "string" ? { role: "follow-ups", why: hole } : hole))];
  if (unread.length) return answer(tool, { not_counted: Object.keys(data) }, st, found);
  return answer(tool, data, st, found);
}

function deskCount(args = {}) {
  const { tool, day, desk, read } = context("desk_count", args, ["desk", "view", "count", "seat", "start", "page", "date", "systems"]);
  const { st, told } = underContract(args, read);
  if (args.count !== undefined) return told(workdayCount(tool, desk, st, day, args));
  if (args.start !== undefined || args.page !== undefined) throw new Refusal(TIMED_ONLY);
  if (args.view === undefined) throw new Refusal(VIEW_OR_COUNT);
  const { view, seat = "" } = args;
  if (!VIEWS.includes(view)) {
    throw new Refusal(`${JSON.stringify(view === undefined ? "" : view)} is not a view desk_count counts. The views are: ${VIEWS.join(", ")}.`);
  }
  if (typeof seat !== "string") throw new Refusal("`seat` is a seat's handle, as text.");
  if (view === "team") {
    needRole(desk, ["desk-head"], "team");
    return told(answer(tool, C.leadGenView(desk, st, day), st, C.viewUnread(desk, st, "desk-head")));
  }
  const roles = { brief: ["rep", "rm", "desk-head"], rep: ["rep"], rm: ["rm"] }[view];
  needRole(desk, roles, view);
  const make = { brief: C.briefView, rep: C.repView, rm: C.rmView }[view];
  const data = make(desk, st, seat, day);
  // the seat's view's holes, as counts.js's viewUnread reads them by the seat's role: an RM's view
  // reads no CRM row and counts its book moments over the families; a seat not on the desk reads all
  const page = desk.pages.get(seat);
  const role = page && page.kind === "seats" ? page.header.role : null;
  return told(answer(tool, data, st, C.viewUnread(desk, st, role)));
}

function teamRollup(args = {}) {
  const { tool, day, desk, read } = context("team_rollup", args, ["desk", "date", "systems"]);
  const { st, told } = underContract(args, read);
  needRole(desk, ["desk-head"], "team");
  return told(answer(tool, { ...C.leadGenView(desk, st, day), pull: PULL }, st, C.viewUnread(desk, st, "desk-head")));
}

function familyFacts(args = {}) {
  const { tool, desk, read } = context("family_facts", args, ["desk", "family", "systems"]);
  const { st, told } = underContract(args, read);
  const { family } = args;
  const families = desk
    .of("families")
    .map((p) => p.slug)
    .sort();
  if (!families.length) throw new Refusal(`${C.NO_FAMILIES.replace(", so no family is counted.", "")}, so there is no family to read.`);
  if (typeof family !== "string" || !families.includes(family)) {
    throw new Refusal(`${JSON.stringify(family === undefined ? "" : family)} is not a family on this desk. The families are: ${families.join(", ")}.`);
  }
  return told(answer(tool, F.familyFacts(desk, st, family), st, holes(desk, st, C.FAMILY_READS, false)));
}

// book_query's signal window: a day (`event_since`), or a count of days back from the query's own
// day (`event_within_days`), never both. The tool counts the days back, so a skill passes a count
// and never writes a day it made by subtracting. A count of days back ends on the query's own day,
// so 0 keeps that day's signals alone; a day passed as `event_since` keeps every signal from it on.
function signalWindow(args, day) {
  const since = dayArg("event_since", args.event_since, "any signal");
  const within = args.event_within_days;
  if (within === undefined || within === null) return { eventSince: since, eventUntil: null, within: null };
  if (!Number.isInteger(within) || within < 0) {
    throw new Refusal(`\`event_within_days\` is ${JSON.stringify(within)}: it is a whole number, 0 or more, and 0 keeps only the day's own signals.`);
  }
  if (since) {
    throw new Refusal("Pass `event_since` or `event_within_days`, not both: `event_since` is a day, and `event_within_days` a count of days back from `date`.");
  }
  return { eventSince: W.addDays(day, -within), eventUntil: day, within };
}

function bookQuery(args = {}) {
  const allowed = ["desk", "owner", "relationship", "event_since", "event_within_days", "no_touch_days", "liquidity_only", "date", "systems"];
  const { tool, day, desk, read } = context("book_query", args, allowed);
  const { st, told } = underContract(args, read);
  const { owner = "", relationship = "", no_touch_days: noTouch = 0, liquidity_only: liquidityOnly = false } = args;
  const seats = desk
    .of("seats")
    .map((p) => p.slug)
    .sort();
  if (typeof owner !== "string" || (owner && !seats.includes(owner))) {
    throw new Refusal(`\`owner\` is ${JSON.stringify(owner)}, not a seat on this desk. The seats are: ${seats.join(", ")}; leave it out for every owner.`);
  }
  if (typeof relationship !== "string") throw new Refusal("`relationship` is a family's relationship_kind, as text, like client or prospect.");
  const { eventSince, eventUntil, within } = signalWindow(args, day);
  if (!Number.isInteger(noTouch) || noTouch < 0) {
    throw new Refusal(`\`no_touch_days\` is ${JSON.stringify(noTouch)}: it is a whole number, 0 or more, and 0 asks for no gap.`);
  }
  if (typeof liquidityOnly !== "boolean") {
    throw new Refusal("`liquidity_only` is true or false: false, the default, reads every signal; true keeps only liquidity signals.");
  }
  const { rows, leftForSignals, filtered } = bookRows(desk, st, { owner, relationship, eventSince, eventUntil, noTouchDays: noTouch, liquidityOnly, today: day });
  const found = holes(desk, st, C.FAMILY_READS, true);
  if (relationship && !desk.of("families").some((p) => desk.get(p, "relationship_kind") === relationship)) {
    const kinds = [...new Set(desk.of("families").map((p) => desk.get(p, "relationship_kind")).filter(Boolean))].sort();
    found.push({
      role: "relationship",
      why: `No family on this desk has relationship_kind ${JSON.stringify(relationship)}; the kinds its families have are: ${kinds.join(", ") || "none"}.`,
    });
  }
  // the demo's engine names are said only on a desk whose signals name engines
  const engines = namesEngines(desk) ? [...LIQUIDITY].sort() : [];
  if (liquidityOnly && !filtered) found.push({ role: "signals", why: NO_ENGINE });
  if (leftForSignals) {
    found.push({
      role: "signals",
      why: `Families whose signals are none of the liquidity events (${engines.join(", ")}) were left out; ask with liquidity_only false to read every signal.`,
    });
  }
  const query = {
    owner,
    relationship,
    event_since: eventSince,
    event_within_days: within,
    no_touch_days: noTouch,
    liquidity_only: liquidityOnly,
    liquidity_engines: engines,
    today: day,
  };
  return told(answer(tool, { query, count: rows.length, rows }, st, found));
}

const TOOLS = [
  {
    name: "desk_count",
    description:
      "Numbers and rows for a view of the desk: brief (a seat's morning brief), rep (an SDR's " +
      "console), rep and rm need seat; team (the head of lead generation's view). Or, with count " +
      "in place of view, one workday count for one seat on one day; start and page go with count " +
      "research_minutes only. Counted by the " +
      "engine from the desk and the systems rows handed over; say these numbers, never your own. " +
      "holes says what a connector not handed over leaves uncounted. A systems row that names no " +
      "one on the desk is refused, and its whole role is then counted as not handed over: fell_back " +
      "names the role, and dropped the rule.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        view: { type: "string", enum: VIEWS, description: "brief, rep, rm or team." },
        count: { type: "string", enum: COUNTS, description: `In place of view, a workday count for one seat on one day: ${COUNTS.join(", ")}.` },
        seat: { type: "string", description: "The seat's handle, for brief, rep and rm, and for a count." },
        start: { type: "string", description: "With count research_minutes only: when the research began, a time with its offset, like 2026-09-21T10:00:00+05:30." },
        page: { type: "string", description: "With count research_minutes only: the page the research wrote." },
        date: DATE,
        systems: SYSTEMS,
      },
      additionalProperties: false,
    },
    run: deskCount,
  },
  {
    name: "team_rollup",
    description:
      "The head of lead generation's view: each SDR's leads and week, the totals, the funnel and " +
      "the families with a signal and no owner, counted from the desk on this machine. Nothing is " +
      "pulled from the network.",
    inputSchema: {
      type: "object",
      properties: { desk: DESK, date: DATE, systems: SYSTEMS },
      additionalProperties: false,
    },
    run: teamRollup,
  },
  {
    name: "book_query",
    description:
      "The families matching an owner (a seat), a relationship_kind, a signal since a date and no " +
      "touch for N days, each with its signal and its last touch; a family never touched says so " +
      "and has no days. Every signal is read unless liquidity_only is true, which keeps liquidity " +
      "signals only on a desk whose signals name an engine; holes says why a part is not read.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        owner: { type: "string", description: "A seat's handle: the families it owns now. Leave it out for every owner." },
        relationship: { type: "string", description: "A family's relationship_kind, like client or prospect." },
        event_since: { type: "string", description: "Only families with a signal on or after this day, as 2026-09-21." },
        event_within_days: {
          type: "integer",
          description:
            "Only families with a signal on the query's day or in this many days before it, counted back by the tool from date (today in IST if left out); not with event_since.",
        },
        no_touch_days: { type: "integer", description: "Only families untouched for more than this many days; 0, the default, asks for no gap." },
        liquidity_only: {
          type: "boolean",
          description: "False, the default, reads every signal; true keeps liquidity signals only, where the desk's signals name an engine.",
        },
        date: DATE,
        systems: SYSTEMS,
      },
      additionalProperties: false,
    },
    run: bookQuery,
  },
  {
    name: "family_facts",
    description:
      "Everything the desk knows about one family, each fact naming the page it came from: its " +
      "members and contacts, the decision maker, firms, routes in, signals, conversations, open " +
      "follow-ups, fitting products, its CRM records and its last touch.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        family: { type: "string", description: "The family page's name, as its file is named, without .md." },
        systems: SYSTEMS,
      },
      required: ["family"],
      additionalProperties: false,
    },
    run: familyFacts,
  },
];

module.exports = { TOOLS };
