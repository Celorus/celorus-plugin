"use strict";
// The systems rows a page counts beside the desk: the CRM, the calendar, the mailbox and the
// chat. The engine never reaches a connector and never reads a folder outside the desk (base
// ruling R7): the skill fetches the rows from the harness's own connectors and hands
// them to render_view as one argument, `systems`, in the stand-in systems' own shape. The
// contract is written once, in row E5 of Plan C (docs/superpowers/plans/
// 2026-09-23-one-desk-track-d-desk-engine.md); E11 screens this same argument, and E12's
// stand-in serves it.
//
//   systems = {
//     crm:      { records: [ { id, stage, desk_ref, phone, ... } ], activities: [ { record, at, kind, by } ] },
//     calendar: { events: [ { seat, attendees, start, title, family, kind } ],
//                 proposals: [ { id, seat, family, why, hold: { start, title, ... } } ] },
//     mail:     { threads: [ { id, seat, family, subject, critical, messages: [ { at, from_name, from_seat, body } ] } ] },
//     chat:     { messages: [ { id, channel, from, to, at, text, needs_reply } ] },
//   }
//
// Each role may be left out: a role not given has no rows, and the answer says which were given.
// Every time is an ISO string in IST (+05:30), as the contract says: a time in another zone, or
// with none, is refused by its row, field and value, never converted (the kit's systems.py
// refuses it the same way). A thread holds at least one message, each whole: the queries read
// its last one, and a message without `from_seat` is never read as the other side's.
// The queries below are the stand-in's own (the demo kit's systems.py), so a page counts the
// same rows the demo counted.

const { Refusal } = require("../lib/refusal.js");

// Each role, the lists it holds, and the fields each row of a list must carry.
const ROLES = {
  crm: { records: ["id", "stage"], activities: ["record", "at", "kind", "by"] },
  calendar: { events: ["seat", "attendees", "start", "title", "family", "kind"], proposals: ["id", "seat", "family", "why", "hold"] },
  mail: { threads: ["id", "seat", "family", "subject", "critical", "messages"] },
  chat: { messages: ["id", "channel", "from", "to", "at", "text", "needs_reply"] },
};

function shapeLine() {
  return Object.entries(ROLES)
    .map(([role, lists]) => `${role}: {${Object.keys(lists).map((list) => ` ${list}: [...]`).join(",")} }`)
    .join(", ");
}

function refuse(what) {
  throw new Refusal(
    `\`systems\` ${what}. It is the rows the skill read from the desk's connectors, in this shape: ` +
      `{ ${shapeLine()} }. Leave a role out when its connector is not there.`,
  );
}

function isMap(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The fields of a row that hold a time, by list; each must be written in IST.
const TIMES = { "crm.activities": ["at"], "calendar.events": ["start"], "chat.messages": ["at"] };
const MESSAGE_FIELDS = ["at", "from_name", "from_seat"];
const HOLD_FIELDS = ["start", "title"];
const IST_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?\+05:30$/;
const IST_EXAMPLE = "2026-09-21T10:00:00+05:30";

// Whether the digits of an IST time name a day and a time that exist (no 30 Feb, no 25:61).
function exists(match) {
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part || 0));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= days && hour <= 23 && minute <= 59 && second <= 59;
}

function checkTime(where, value) {
  const match = typeof value === "string" ? IST_TIME.exec(value) : null;
  if (match === null) {
    refuse(
      `says ${where} is ${JSON.stringify(value)}, which is not IST: every time is written in IST, like ${IST_EXAMPLE}, and is never converted here`,
    );
  }
  if (!exists(match)) {
    refuse(`says ${where} is ${JSON.stringify(value)}, a day or a time that does not exist: write a real one, like ${IST_EXAMPLE}`);
  }
}

function checkFields(where, row, fields) {
  if (!isMap(row)) refuse(`holds ${where} as something other than an object`);
  const missing = fields.filter((field) => !Object.hasOwn(row, field));
  if (missing.length) refuse(`holds ${where} without ${missing.join(", ")}`);
}

// What a row holds beyond its own fields: a thread's messages, a proposal's hold, and its times.
function checkRow(role, list, i, row) {
  const where = `${role}.${list}[${i}]`;
  for (const field of TIMES[`${role}.${list}`] || []) checkTime(`${where}.${field}`, row[field]);
  if (role === "calendar" && list === "proposals") {
    checkFields(`${where}.hold`, row.hold, HOLD_FIELDS);
    checkTime(`${where}.hold.start`, row.hold.start);
  }
  if (role === "mail" && list === "threads") {
    if (!Array.isArray(row.messages)) refuse(`holds ${where}.messages as something other than a list`);
    if (!row.messages.length) refuse(`says ${where}.messages holds no message: a thread carries at least one, and a page reads its last`);
    row.messages.forEach((message, j) => {
      checkFields(`${where}.messages[${j}]`, message, MESSAGE_FIELDS);
      checkTime(`${where}.messages[${j}].at`, message.at);
    });
  }
}

// The systems argument, checked for its shape and filled out: every role and list present, a
// role not given holding empty lists. `given` names the roles the caller handed over.
function systemsOf(value) {
  const out = { given: [] };
  for (const [role, lists] of Object.entries(ROLES)) {
    out[role] = {};
    for (const list of Object.keys(lists)) out[role][list] = [];
  }
  if (value === undefined || value === null) return out;
  if (!isMap(value)) refuse("is not an object");
  const extra = Object.keys(value).filter((role) => !Object.hasOwn(ROLES, role));
  if (extra.length) refuse(`names ${extra.join(", ")}, which is no role; the roles are ${Object.keys(ROLES).join(", ")}`);
  for (const [role, lists] of Object.entries(ROLES)) {
    if (!Object.hasOwn(value, role) || value[role] === null || value[role] === undefined) continue;
    if (!isMap(value[role])) refuse(`holds ${role} as something other than an object`);
    for (const [list, fields] of Object.entries(lists)) {
      const rows = value[role][list];
      if (rows === undefined || rows === null) continue;
      if (!Array.isArray(rows)) refuse(`holds ${role}.${list} as something other than a list`);
      rows.forEach((row, i) => {
        checkFields(`${role}.${list}[${i}]`, row, fields);
        checkRow(role, list, i, row);
      });
      out[role][list] = rows;
    }
    out.given.push(role);
  }
  return out;
}

// Python's sort over a key, stable, ascending; `reverse` keeps equal rows in their order, as
// Python's does.
function sortedBy(rows, key, reverse = false) {
  const keyed = rows.map((row, i) => ({ row, i, k: key(row) }));
  keyed.sort((a, b) => {
    const c = compareKeys(a.k, b.k);
    return (reverse ? -c : c) || a.i - b.i;
  });
  return keyed.map((item) => item.row);
}

function compareKeys(a, b) {
  if (Array.isArray(a)) {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      const c = compareKeys(a[i], b[i]);
      if (c) return c;
    }
    return a.length - b.length;
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return a < b ? -1 : a > b ? 1 : 0;
}

// A seat's mail threads, newest first: who wrote last, and whether it waits on us.
function mailSearch(st, seat, { criticalOnly = false, family = "" } = {}) {
  const out = [];
  for (const t of st.mail.threads) {
    if (t.seat !== seat || (family && t.family !== family) || (criticalOnly && !t.critical)) continue;
    const last = t.messages[t.messages.length - 1];
    out.push({
      thread: t.id,
      subject: t.subject,
      family: t.family,
      critical: t.critical,
      last_at: last.at,
      last_from: last.from_name,
      messages: t.messages.length,
      waiting_on: last.from_seat ? "them" : "us",
    });
  }
  return sortedBy(out, (x) => x.last_at, true);
}

// A seat's events between two days, "YYYY-MM-DD" each, soonest first.
function calendarEvents(st, seat, from, to) {
  return sortedBy(
    st.calendar.events.filter(
      (ev) => (ev.seat === seat || (ev.attendees || []).includes(seat)) && from <= ev.start.slice(0, 10) && ev.start.slice(0, 10) <= to,
    ),
    (ev) => ev.start,
  );
}

// What takes a proposed meeting off the list: a meeting or a hold for its family.
const ON_THE_CALENDAR = ["meeting", "hold"];

// The meetings the day proposed for this seat that no calendar holds yet, soonest first.
function calendarProposals(st, seat, from) {
  const held = new Set(
    st.calendar.events
      .filter((ev) => ev.family && ON_THE_CALENDAR.includes(ev.kind) && ev.start.slice(0, 10) >= from)
      .map((ev) => ev.family),
  );
  return sortedBy(
    st.calendar.proposals.filter((p) => p.seat === seat && !held.has(p.family)),
    (p) => [p.hold.start, p.id],
  );
}

// The chat a seat has not answered: asked of it, with no later post of its own on the channel.
function chatUnread(st, seat) {
  const msgs = st.chat.messages;
  return msgs.filter(
    (m) =>
      m.needs_reply &&
      (m.to || []).includes(seat) &&
      !msgs.some((x) => x.channel === m.channel && x.from === seat && x.at > m.at),
  );
}

module.exports = { ROLES, systemsOf, mailSearch, calendarEvents, calendarProposals, chatUnread, sortedBy, compareKeys };
