"use strict";
// The argument guard's shapes (row E11; the design's section 4.4 and demo item 6: a permission
// covers a tool, never what is passed to it). The guard's hook in hooks/ runs this before every
// connector call of the session (hooks.json, PreToolUse), with the call the harness is about to
// make as JSON. A call to the mail or calendar connector goes through only when what it passes
// has the fixed shape the desk skills pass for that role; any other tool goes through untouched. The
// answer is null to let the call through, or the reason it is refused, which the hook says in
// one line: why, and the shape the call may take.
//
// The shapes, by role:
//   mail: a search names only addresses written on the desk's pages. Its words are address terms
//     (from:, to: or cc:), OR groups and window terms (after:, before:, newer_than:, older_than:,
//     is:unread, in:inbox), and nothing else: an OR joins address terms alone, and a window term
//     is never an OR's operand, so it narrows the search and never widens it. The search is a run
//     of groups, each one address term or several joined by OR, and at least one group holds only
//     addresses that are on no seat's page: a seat's own address alone reads that seat's whole
//     mailbox, so it bounds nothing. Grouping, braces,
//     quotes and any other word are refused, never read. A thread is read by its id; a draft goes
//     only to addresses written on the desk's pages. Nothing is sent: no send tool.
//   calendar: no listing of calendars; events are listed and created on the seat's own calendar
//     only ("primary", or left out), a listing by its window alone, an event with no guest (a
//     guest is an invitation mailed from the seat's account). An event is created only as a hold
//     propose_hold accepted within its time: the same title, start and end, read from the record
//     propose_hold keeps in the desk's .celorus/ (hold/hold.js).
// The addresses on the desk and the accepted holds are read at the moment of the call, never kept.
//
// The tools of a guarded connector are of two sorts. Its connection tools, which sign the
// connector in and carry no desk data (CONNECTION, named from each connector's tool list as it
// stands: authenticate and complete_authentication), always go through. Every other tool reads
// or writes data: it goes through only in the shape its table below gives it, and a tool the
// table does not name is refused, so a data tool a connector adds later is refused until it is
// read and added here, on a connector a role holds by its name. On a connector neither of whose
// names holds a word of a role (an id the desktop app assigns), a tool is held only by its own
// name: ROLES below says which.
//
// It fails closed: input it cannot read, a data tool of a guarded role it does not know, an
// argument outside the shape, and any fault while deciding are refused, never passed.
//
// A session with no desk (row E11, the base's ruling of 2026-09-30): with CELORUS_DESK not set and
// no desk found from the call's working folder, the person is using the plugin without a desk, and
// their own mail and calendar connectors are theirs: the guard stands aside, the call goes through,
// and the hook says so in one line (ASIDE_LINE). With CELORUS_DESK set and naming no desk, or a
// desk folder found that cannot be read as one, the person meant a desk: the call is refused, in
// the words the desk tools refuse that desk with (lib/desk.js).

const fs = require("node:fs");
const path = require("node:path");
const { findDesk, readDesk } = require("../lib/desk.js");
const { Refusal } = require("../lib/refusal.js");
const { ACCEPTED_FOR_MS, SCRATCH, RECORD } = require("../hold/hold.js");

const PASS = 0;
const REFUSE = 2;
const SAID = "Refused by the desk's argument guard: ";
const AFTER = " Nothing was called. Do not call this tool again to get round the guard.";
// What decide answers when the guard stands aside, and the one line the hook says then.
const ASIDE = Object.freeze({ aside: true });
const ASIDE_LINE =
  "The desk's argument guard stood aside for this call: this session has no desk, none named and none found " +
  "from its working folder, so the call was not held to a desk's pages.";

// The roles this guard holds. A call is put in a role by any name it carries, never by an id
// (DESK-275: the desktop app names a directory connector's tools from an id it assigns,
// mcp__<id>__<tool>, so the connector's name may say nothing). Three names are read, each in the
// two readings readingsOf gives (lower case whole; and words split where a capital follows a
// lower-case letter, or a letter meets a digit either way, then lower case; in both, each run of
// other characters than a letter or a digit one underscore):
//   the connector's name as the harness shows it in a tool's name, mcp__<connector>__<tool>;
//   the server's declared name, the call's mcp_server.name (Claude Code 2.1.274 or later);
//   the tool's own name.
// A role holds a call when either reading of any of the three holds one of its words (`words`:
// Gmail, or Google Calendar, as a whole word, in any of the spellings below), or when either
// reading of the tool's own name is one of that connector's tools (`tools`, named from each connector's tool list as it stands, its
// connection tools aside, CONNECTION below). A bare "mail" or "calendar" is no word of a role:
// other servers' tools carry them.
// A name only ever puts a call in a role, so it only ever holds a call, never lets one through: a
// server that declares a guarded connector's name is held to that role's shapes. So is a tool of
// another connector that shares a name with one of a role's tools (a chat server's reply or
// send_message, a notes server's get_thread): in a desk's session it is held to that role's
// shapes, the same as the role's own tools: a call outside them is refused in the words said of
// those tools, and one inside them passes. A tool that is a role's only in another spelling
// (sendMessage, sEnd_message, Authenticate) is refused, a connection tool in another spelling
// included, since the checks and the connection list are read by the name as the call gives it.
// A call its names put in both roles is refused, its connection tools aside. What is not held: on a connector neither of
// whose names holds a word of a role, a tool whose own name holds none and is on neither list,
// such as a data tool Gmail or Google Calendar adds later, until it is read and added here.
const ROLES = [
  {
    role: "mail",
    words: /(?:^|_)(?:gmail|g_mail|google_mail)(?:_|$)/u,
    tools: [
      "apply_sensitive_message_label",
      "apply_sensitive_thread_label",
      "create_draft",
      "create_label",
      "delete_draft",
      "delete_label",
      "forward",
      "get_draft",
      "get_message",
      "get_thread",
      "label_message",
      "label_thread",
      "list_drafts",
      "list_labels",
      "mark_message_spam",
      "mark_thread_spam",
      "reply",
      "search_threads",
      "send_message",
      "trash_message",
      "trash_thread",
      "unlabel_message",
      "unlabel_thread",
      "unmark_message_spam",
      "unmark_thread_spam",
      "untrash_message",
      "untrash_thread",
      "update_draft",
      "update_label",
      "update_message_labels",
    ],
  },
  {
    role: "calendar",
    words: /(?:^|_)(?:google_calendar|gcal)(?:_|$)/u,
    tools: [
      "create_event",
      "delete_event",
      "get_event",
      "list_calendars",
      "list_events",
      "respond_to_event",
      "search_events",
      "suggest_time",
      "update_event",
    ],
  },
];

// A plain address, ASCII only, so a look-alike letter is never read as a letter.
const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/u;
const ADDRESS_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gu;
// The kinds of page an address on the desk is read from, and the kind whose addresses are the
// seats' own.
const ADDRESS_KINDS = ["people", "firms", "families", "seats"];
const SEAT_KIND = "seats";
// The pages whose addresses bound a mail search on their own: a person's and a family's. A firm page
// can carry a seat's own address, and the installed seat page carries none (row E11, the base's
// ruling B of 2026-10-01), so an address on a firm's page alone bounds nothing.
const PARTY_KINDS = ["people", "families"];
// The terms a mail search may hold beside the addresses it names.
const SEARCH_ADDRESS = /^(?:from|to|cc):(.+)$/u;
const SEARCH_WINDOW = /^(?:(?:after|before):\d{4}\/\d{2}\/\d{2}|(?:newer_than|older_than):\d{1,3}[dmy]|is:unread|in:inbox)$/u;
const SEARCH_SHAPE =
  "a mail search names only addresses written on the desk's pages, each as from:<address>, to:<address> or " +
  "cc:<address>, joined by OR if need be, with after:, before:, newer_than:, is:unread or in:inbox beside them, " +
  "and no other words";
const OWN_CALENDAR = "primary";
// The connection tools of each guarded connector: they sign it in and carry no desk data.
const CONNECTION = {
  mail: ["authenticate", "complete_authentication"],
  calendar: ["authenticate", "complete_authentication"],
};
// Arguments that set a guest on an event, by any name a connector gives them.
const GUEST = /attendee|guest|invit/iu;

function empty(value) {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
  );
}

// An argument outside `allowed` is refused unless it is empty: an empty cc sends nothing.
function only(args, allowed) {
  const extra = Object.keys(args)
    .filter((key) => !allowed.includes(key) && !empty(args[key]))
    .sort();
  return extra.length ? `this call may not set ${extra.join(", ")}; it takes only ${allowed.join(", ")}` : null;
}

// The desk the call is made from, found as the desk tools find it (CELORUS_DESK, or the call's
// working folder): { root }, the desk's folder; { root: null } when none is named and none is
// found; or { refused }, the desk tools' own words for a desk that was named, or met on the way,
// and cannot be read as one.
function deskOf(payload, env, cwd) {
  const start = typeof payload.cwd === "string" && payload.cwd !== "" ? payload.cwd : cwd;
  try {
    const found = findDesk({ start, env });
    return { root: found === undefined ? null : found };
  } catch (err) {
    if (err instanceof Refusal) return { refused: err.message.replace(/\.$/u, "") };
    throw err;
  }
}

// Every address written on the desk's pages, in lower case, read now: `all` of them, `seats`, those
// written on a seat's page, and `parties`, those written on a person's or a family's page.
function deskAddresses(root) {
  const all = new Set();
  const seats = new Set();
  const parties = new Set();
  for (const page of readDesk(root).pages) {
    const kind = page.rel.split("/")[0];
    if (!ADDRESS_KINDS.includes(kind)) continue;
    const text = `${page.body || ""}\n${JSON.stringify(page.head || {})}`;
    for (const match of text.matchAll(ADDRESS_IN_TEXT)) {
      all.add(match[0].toLowerCase());
      if (kind === SEAT_KIND) seats.add(match[0].toLowerCase());
      if (PARTY_KINDS.includes(kind)) parties.add(match[0].toLowerCase());
    }
  }
  return { all, seats, parties };
}

function onTheDesk(address, known) {
  return typeof address === "string" && ADDRESS.test(address.toLowerCase()) && known().all.has(address.toLowerCase());
}

// An address on the desk that is on no seat's page: a person's, a family's or a firm's.
function notASeats(address, known) {
  return onTheDesk(address, known) && !known().seats.has(address.toLowerCase());
}

// An address that bounds a mail search: on a person's or a family's page, and on no seat's.
function aPartys(address, known) {
  return notASeats(address, known) && known().parties.has(address.toLowerCase());
}

// The refusals of a search no person's or family's address bounds.
const BESIDE = "name a person's or a family's address beside it, outside any OR that holds a seat's or a firm's";
const SEAT_ONLY = `${SEARCH_SHAPE}; this one is held to no address but a seat's own, which reads that seat's whole mailbox: ${BESIDE}`;
const FIRM_ONLY = `${SEARCH_SHAPE}; this one is held to no address but one on a firm's page, and a firm page can carry a seat's own address, which reads that seat's whole mailbox: ${BESIDE}`;

const MAIL = {
  search_threads(args, known) {
    if (typeof args.query !== "string") return SEARCH_SHAPE;
    const terms = args.query.trim().split(/\s+/u);
    // Each term is an address term, a window term or OR, and an OR stands between two address
    // terms: anything else, a window term beside an OR among them, is refused.
    const kinds = terms.map((term) => (term === "OR" ? "or" : SEARCH_ADDRESS.test(term) ? "address" : SEARCH_WINDOW.test(term) ? "window" : null));
    if (kinds.includes(null)) return SEARCH_SHAPE;
    for (const [i, kind] of kinds.entries()) {
      if (kind === "or" && (kinds[i - 1] !== "address" || kinds[i + 1] !== "address")) {
        return `${SEARCH_SHAPE}; an OR joins address terms alone, and a window term stands outside every OR`;
      }
    }
    // The groups: address terms joined by OR, or one alone. Terms side by side narrow the search
    // to the threads every group matches, so one group of addresses on a person's or a family's
    // page, and on no seat's, bounds it.
    const groups = [];
    for (const [i, kind] of kinds.entries()) {
      if (kind !== "address") continue;
      const address = SEARCH_ADDRESS.exec(terms[i])[1];
      if (kinds[i - 1] === "or") groups[groups.length - 1].push(address);
      else groups.push([address]);
    }
    if (groups.length === 0) return SEARCH_SHAPE;
    if (!groups.flat().every((address) => onTheDesk(address, known))) return `${SEARCH_SHAPE}; this one names an address that is on no page of the desk`;
    if (!groups.some((group) => group.every((address) => aPartys(address, known)))) {
      if (groups.some((group) => group.every((address) => notASeats(address, known)))) return FIRM_ONLY;
      return SEAT_ONLY;
    }
    return only(args, ["query", "pageSize", "pageToken"]);
  },
  get_thread(args) {
    if (typeof args.threadId !== "string" || args.threadId === "") return "a thread is read by its id, threadId, alone";
    return only(args, ["threadId", "messageFormat"]);
  },
  create_draft(args, known) {
    for (const key of ["to", "cc", "bcc"]) {
      const value = args[key];
      if (key !== "to" && empty(value)) continue;
      if (!Array.isArray(value) || value.length === 0 || !value.every((one) => onTheDesk(one, known))) {
        return "a draft goes only to addresses written on the desk's pages, as a list in `to` (and `cc`, `bcc`)";
      }
    }
    return only(args, ["to", "cc", "bcc", "subject", "body"]);
  },
};

function ownCalendar(args) {
  return empty(args.calendarId) || args.calendarId === OWN_CALENDAR
    ? null
    : `only the seat's own calendar, calendarId "${OWN_CALENDAR}" or left out`;
}

const CALENDAR = {
  list_calendars() {
    return "no listing of calendars: the desk skills read the seat's own calendar and no other";
  },
  list_events(args) {
    const why = ownCalendar(args);
    if (why) return why;
    if (typeof args.startTime !== "string" || typeof args.endTime !== "string") {
      return "events are listed by their window alone, startTime and endTime";
    }
    return only(args, ["calendarId", "startTime", "endTime"]);
  },
  create_event(args, known, accepted) {
    const why = ownCalendar(args);
    if (why) return why;
    if (Object.keys(args).some((key) => GUEST.test(key) && !empty(args[key]))) {
      return "an event carries no guest: a guest is an invitation mailed from the seat's account";
    }
    if (typeof args.summary !== "string" || typeof args.startTime !== "string" || typeof args.endTime !== "string") {
      return "an event is created with its summary, startTime and endTime, as propose_hold answered them";
    }
    const extra = only(args, ["calendarId", "summary", "description", "startTime", "endTime"]);
    if (extra) return extra;
    const match = accepted().some((one) => one.title === args.summary && one.start === args.startTime && one.end === args.endTime);
    return match
      ? null
      : "an event is created only as a hold propose_hold accepted in the last few minutes, with its title, start and end " +
          "exactly: call propose_hold with the day's events and the time the person said, then create the event it answers";
  },
};

const CHECKS = { mail: MAIL, calendar: CALENDAR };

// A name as ROLES reads it, in two readings, each with every run of other characters than a letter
// or a digit made one underscore and none at either end: the name in lower case whole (a stray
// capital inside a word, gmAil, leaves the word whole); and the name with its words split where a
// capital follows a lower-case letter, or a letter meets a digit either way, then in lower case
// (sendMessage, Gmail2, 2gmail). A call is held when either reading holds, so the split never loses a
// word the whole reading holds.
function readingsOf(text) {
  const plain = (one) => one.toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
  const split = text
    .replace(/([a-z])([A-Z])/gu, "$1_$2")
    .replace(/([A-Za-z])([0-9])/gu, "$1_$2")
    .replace(/([0-9])([A-Za-z])/gu, "$1_$2");
  return [plain(text), plain(split)].filter((one) => one !== "");
}

// The roles a call's names put it in, and the tool's own name as the call gives it: { roles, tool },
// or null for a call no role holds. `server` is the call's mcp_server; one that is not an object
// with a name in text adds no name.
function roleOf(name, server) {
  const m = /^mcp__(.+)__([^_].*)$/su.exec(name);
  if (!m) return null;
  const tool = m[2];
  const declared = server !== null && typeof server === "object" && typeof server.name === "string" ? server.name : "";
  const names = [m[1], declared, tool].flatMap(readingsOf);
  const own = readingsOf(tool);
  const roles = ROLES.filter(
    (entry) => names.some((one) => entry.words.test(one)) || own.some((one) => entry.tools.includes(one)),
  ).map((entry) => entry.role);
  return roles.length ? { roles, tool } : null;
}

// The holds propose_hold accepted within ACCEPTED_FOR_MS of `now`, read from the desk's .celorus/
// record: none when the record is missing, a link, or not what it should be.
function acceptedHolds(root, now) {
  const folder = path.join(root, SCRATCH);
  const file = path.join(folder, RECORD);
  const at = fs.lstatSync(folder, { throwIfNoEntry: false });
  const was = at !== undefined && at.isDirectory() ? fs.lstatSync(file, { throwIfNoEntry: false }) : undefined;
  if (was === undefined || !was.isFile()) return [];
  let held = null;
  try {
    held = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const list = held && Array.isArray(held.accepted) ? held.accepted : [];
  return list.filter(
    (one) =>
      one !== null &&
      typeof one === "object" &&
      typeof one.accepted_at === "number" &&
      now - one.accepted_at >= 0 &&
      now - one.accepted_at < ACCEPTED_FOR_MS &&
      [one.title, one.start, one.end].every((value) => typeof value === "string"),
  );
}

// Null lets the call through; ASIDE lets it through and says the guard stood aside; a sentence is
// why it is refused.
function decide(payload, env = process.env, cwd = process.cwd(), now = Date.now()) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return "the call could not be read";
  const name = payload.tool_name;
  if (typeof name !== "string") return "the call could not be read";
  const held = roleOf(name, payload.mcp_server);
  if (held === null) return null;
  const args = payload.tool_input;
  if (args === null || typeof args !== "object" || Array.isArray(args)) return "the call's input could not be read";
  if (held.roles.every((role) => CONNECTION[role].includes(held.tool))) return null;
  const desk = deskOf(payload, env, cwd);
  if (desk.refused !== undefined) return desk.refused;
  if (desk.root === null) return ASIDE;
  if (held.roles.length > 1) {
    return `${held.tool} is put in both the ${held.roles.join(" and the ")} role by its names, so no one shape holds it`;
  }
  const [role] = held.roles;
  const checks = CHECKS[role];
  if (!Object.hasOwn(checks, held.tool)) {
    return `${held.tool} is not a ${role} tool the desk skills call; they call ${Object.keys(checks).join(", ")}`;
  }
  let addresses = null;
  const known = () => {
    if (addresses === null) addresses = deskAddresses(desk.root);
    return addresses;
  };
  const accepted = () => acceptedHolds(desk.root, now);
  return checks[held.tool](args, known, accepted);
}

// The line the hook says for a refusal.
function refusalLine(reason) {
  return `${SAID}${reason}.${AFTER}`;
}

// The whole decision over the text the harness sent: { code, message, said }. `message` is the
// refusal's line, for stderr; `said` is a line for a call that goes through, which the hook hands
// to the harness as the call's added context. Any fault is a refusal.
function run(text, { env = process.env, decider = decide, now = Date.now() } = {}) {
  let reason;
  try {
    reason = decider(JSON.parse(text), env, process.cwd(), now);
  } catch {
    reason = "the call could not be read, or the guard could not decide it";
  }
  if (reason === null || reason === undefined) return { code: PASS, message: "", said: "" };
  if (reason === ASIDE) return { code: PASS, message: "", said: ASIDE_LINE };
  return { code: REFUSE, message: refusalLine(reason) };
}

module.exports = { decide, run, roleOf, refusalLine, PASS, REFUSE, ASIDE, ASIDE_LINE };
