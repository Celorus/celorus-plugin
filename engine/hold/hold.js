"use strict";
// propose_hold: the one place a calendar hold's time is settled (row E11; the design's demo item
// 5: the hold writer never looked for a clash, an unsaid time got invented, and "a guard written
// into some of the paths that write is a guard on none").
//
// The engine never reaches a connector (Plan C, "The engine cannot reach the harness's
// connectors"): the skill lists the seat's events for the hold's day through the harness's
// calendar connector and hands them over as `events`; this tool refuses an unsaid time and a
// clash, and only then does the skill create the event, with exactly the title, start and end
// this tool answers. Asking for a missing time is the skill's job; refusing an unsaid time is this
// tool's. It writes nothing on the desk: the hold lives on the calendar.
//
// The events are those the listing of one day gave (`day`, the hold's day): an event that does
// not touch that day is refused, and an empty list is taken only when the skill says the listing
// came back empty (`listing_empty`). The answer names the day and how many events it compared,
// and says what the listing held, never what the calendar holds.
//
// Each hold it answers is recorded, as its seat, title, start, end and the moment it was
// accepted, in the seat's scratch folder .celorus/ at the desk's root (git-ignored, never shared,
// and no page of the desk): the argument guard's hook reads that record and lets a calendar event
// be created only as a hold accepted within ACCEPTED_FOR_MS (live/shapes.js).
//
// Every refusal ends "Nothing was proposed." and names what the call may pass instead. No event's
// title or guest is ever read: an event is passed as its start and end alone, so nothing a real
// calendar holds about another meeting reaches this tool or its answer.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { pluginVersion } = require("../lib/version.js");
const { readDesk, DESK_ARGUMENT } = require("../lib/desk.js");
const { Desk } = require("../render/desk.js");

const TOOL = "propose_hold";
const ARGUMENTS = ["desk", "seat", "about", "start", "end", "day", "events", "listing_empty"];
// Where the holds this tool accepted are recorded, from the desk's root, and how long each stands:
// the skill creates the event straight after this answer, in the same turn, so a few minutes
// cover the person's yes; a hold older than that was checked against a listing that may have
// changed since, and the event is proposed again. The argument guard reads the same record.
const SCRATCH = ".celorus";
const RECORD = "holds.json";
const WRITING = ".holds.json.writing";
const ACCEPTED_FOR_MS = 10 * 60 * 1000;
const NOTHING = "Nothing was proposed.";
// The kinds of page a hold may be about: the follow-up queue's `who` names one of these.
const ABOUT_KINDS = ["families", "people", "firms"];
const EVENT_FIELDS = ["start", "end"];
const EXAMPLE = "2026-09-21T15:00:00+05:30";
// A time of day in IST, as the desk writes every time: seconds may be written, the zone must be.
const IST_TIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\+05:30$/;
// A day with no time of day: an event that fills whole days, or a hold whose time was not said.
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_EXAMPLE = "2026-09-21";
const IST_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The moment, in milliseconds, that the digits of a day and a time name in IST, or null when the
// day does not exist (no 30 Feb).
function momentOf(year, month, day, hour = 0, minute = 0, second = 0) {
  const [y, mo, d] = [Number(year), Number(month), Number(day)];
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (mo < 1 || mo > 12 || d < 1 || d > last) return null;
  return Date.UTC(y, mo - 1, d, Number(hour), Number(minute), Number(second)) - IST_MS;
}

// A moment as the answer says it: "2026-09-21 15:00", in IST.
function clockOf(ms) {
  const shown = new Date(ms + IST_MS).toISOString();
  return `${shown.slice(0, 10)} ${shown.slice(11, 16)}`;
}

function unsaid(what) {
  return new Refusal(
    `No time was said for the hold: ${what}. \`start\` and \`end\` are the times the person said, each a day and a ` +
      `time of day in IST, like ${EXAMPLE}. Ask the person when, and never pick a time for them. ${NOTHING}`,
  );
}

// The hold's own start or end, in milliseconds: a day and a time of day in IST, or refused. A
// time left out, left empty, or written as a day alone was not said.
function holdTime(name, value) {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    throw unsaid(`\`${name}\` was left out`);
  }
  if (typeof value !== "string") {
    throw new Refusal(`\`${name}\` is a day and a time of day in IST, as text, like ${EXAMPLE}. ${NOTHING}`);
  }
  if (DAY_ONLY.test(value.trim())) throw unsaid(`\`${name}\` names a day and no time of day`);
  const m = IST_TIME.exec(value);
  const ms = m ? momentOf(...m.slice(1)) : null;
  if (ms === null) {
    throw new Refusal(
      `\`${name}\` is ${JSON.stringify(value)}, which is not a day and a time of day in IST: write it like ${EXAMPLE}; ` +
        `a time in another zone is refused, never converted. ${NOTHING}`,
    );
  }
  return ms;
}

// An event's start or end, in milliseconds: a day and a time of day in IST, or a day alone (an
// event that fills whole days, whose end is the day after its last, as a calendar writes it).
function eventTime(where, value) {
  const text = typeof value === "string" ? value.trim() : null;
  const day = text === null ? null : DAY_ONLY.exec(text);
  const at = text === null ? null : IST_TIME.exec(text);
  const ms = day ? momentOf(...day.slice(1)) : at ? momentOf(...at.slice(1)) : null;
  if (ms === null) {
    throw new Refusal(
      `${where} is not a day and a time of day in IST, like ${EXAMPLE}, nor a day alone, like 2026-09-21, for an ` +
        `event that fills the day: pass each event's start and end as the calendar gave them, in IST. ${NOTHING}`,
    );
  }
  return ms;
}

// The day listed, as the skill passes it: the hold's own day, or refused.
function dayOf(day, holdDay) {
  if (typeof day !== "string" || !DAY_ONLY.test(day.trim())) {
    throw new Refusal(
      `\`day\` is the day the seat's calendar was listed for, like ${DAY_EXAMPLE}: list the hold's day and pass it. ${NOTHING}`,
    );
  }
  if (day.trim() !== holdDay) {
    throw new Refusal(`\`day\` is ${day.trim()}, and the hold is on ${holdDay}: list the seat's calendar for the hold's day. ${NOTHING}`);
  }
  return holdDay;
}

// The day's events, each as { start, end } in milliseconds, or refused. They must be handed over:
// with none, no clash can be looked for, and the hold is refused rather than proposed unchecked.
// Each must touch the day listed (`from` to `to`); an empty list is taken only as the listing's.
function eventsOf(events, day, from, to, listingEmpty) {
  if (events === undefined || events === null) {
    throw new Refusal(
      "The day's events were not handed over, so a clash cannot be looked for. List the seat's calendar for the " +
        "hold's day through the calendar connector and pass its events as `events`, each as its start and end " +
        `alone, or pass an empty list when the day holds none. ${NOTHING}`,
    );
  }
  if (!Array.isArray(events)) {
    throw new Refusal(`\`events\` is a list of the day's events, each as { start, end }; an empty list is a day with none. ${NOTHING}`);
  }
  if (listingEmpty !== undefined && listingEmpty !== true) {
    throw new Refusal(`\`listing_empty\` is passed only as true, when the listing of the day came back empty. ${NOTHING}`);
  }
  if (events.length === 0 && listingEmpty !== true) {
    throw new Refusal(
      "No event was passed, and the listing was not said to be empty: list the seat's calendar for the hold's day " +
        `and pass its events, or, when the listing came back empty, pass \`listing_empty\` as true. ${NOTHING}`,
    );
  }
  if (events.length > 0 && listingEmpty === true) {
    throw new Refusal(`\`listing_empty\` is true, yet events were passed: pass the events the listing gave, and leave it out. ${NOTHING}`);
  }
  return events.map((event, i) => {
    const where = `events[${i}]`;
    if (event === null || typeof event !== "object" || Array.isArray(event)) {
      throw new Refusal(`${where} is not an event: pass each event as { start, end }. ${NOTHING}`);
    }
    const extra = Object.keys(event).filter((key) => !EVENT_FIELDS.includes(key));
    if (extra.length) {
      throw new Refusal(
        `${where} carries ${extra.join(", ")}: an event is passed as its start and end alone, so nothing else a ` +
          `calendar holds about it reaches the desk tools. ${NOTHING}`,
      );
    }
    const start = eventTime(`${where}.start`, event.start);
    const end = eventTime(`${where}.end`, event.end);
    if (end <= start) throw new Refusal(`${where} ends before it starts: pass its start and end as the calendar gave them. ${NOTHING}`);
    if (end <= from || start >= to) {
      throw new Refusal(`${where} does not touch ${day}, the day listed: pass the events the listing of the hold's day gave, and no other. ${NOTHING}`);
    }
    return { start, end };
  });
}

function seatsSaid(desk) {
  const seats = desk.of("seats").map((page) => page.slug).sort();
  return seats.length ? seats.join(", ") : "none";
}

// The seat whose calendar the hold goes on: a seat page on the desk (house rule 6).
function seatOf(desk, seat) {
  if (seat === undefined || seat === null || seat === "") {
    throw new Refusal(`The seat must be known before a hold is proposed: pass \`seat\`, a seat's handle, one of: ${seatsSaid(desk)}. ${NOTHING}`);
  }
  const page = typeof seat === "string" ? desk.pages.get(seat) : undefined;
  if (!page || page.kind !== "seats") {
    throw new Refusal(`${JSON.stringify(seat)} is not a seat on this desk: the seats are ${seatsSaid(desk)}. ${NOTHING}`);
  }
  return seat;
}

// The page the hold is about: a family, person or firm page on the desk, by its page name.
function aboutOf(desk, about) {
  const page = typeof about === "string" ? desk.pages.get(about) : undefined;
  if (!page || !ABOUT_KINDS.includes(page.kind)) {
    throw new Refusal(
      `\`about\` is ${JSON.stringify(about === undefined ? "" : about)}, which is no family, person or firm page on ` +
        `this desk: name the page the hold is about by its page name, as under ${ABOUT_KINDS.map((k) => `${k}/`).join(", ")}. ${NOTHING}`,
    );
  }
  return page;
}

// The holds accepted within ACCEPTED_FOR_MS of `now`, with this one added, written to the
// seat's scratch folder. A scratch folder or record that is a link, or not what it should be, is
// refused: the record is written only as a real file in a real folder at the desk's root.
function recordHold(root, hold, now) {
  const folder = path.join(root, SCRATCH);
  const file = path.join(folder, RECORD);
  const kept = [];
  try {
    const at = fs.lstatSync(folder, { throwIfNoEntry: false });
    if (at === undefined) fs.mkdirSync(folder);
    else if (!at.isDirectory()) throw new Refusal(`The desk's ${SCRATCH}/ is not a folder of its own, so the hold cannot be recorded for the calendar guard. ${NOTHING}`);
    const was = fs.lstatSync(file, { throwIfNoEntry: false });
    if (was !== undefined && !was.isFile()) throw new Refusal(`The desk's ${SCRATCH}/${RECORD} is not a plain file, so the hold cannot be recorded for the calendar guard. ${NOTHING}`);
    if (was !== undefined) {
      let held = null;
      try {
        held = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        held = null;
      }
      const list = held && Array.isArray(held.accepted) ? held.accepted : [];
      for (const one of list) if (one && typeof one.accepted_at === "number" && now - one.accepted_at < ACCEPTED_FOR_MS) kept.push(one);
    }
    kept.push({ ...hold, accepted_at: now });
    const writing = path.join(folder, WRITING);
    fs.writeFileSync(writing, `${JSON.stringify({ accepted: kept }, null, 2)}\n`);
    fs.renameSync(writing, file);
  } catch (err) {
    if (err instanceof Refusal) throw err;
    throw new Refusal(`The hold could not be recorded in the desk's ${SCRATCH}/ (${err && err.code ? err.code : "an error with no code"}), so the calendar guard would refuse the event. ${NOTHING}`);
  }
}

function proposeHold(args = {}, { now = Date.now() } = {}) {
  // required here, not at the top: lib/tools.js requires this file for its tool list
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(TOOL, args, ARGUMENTS);
  const root = deskFor(args.desk);
  const read = readDesk(root);
  if (read.stampsUnread) {
    throw new Refusal(`The desk's stamps page ${read.stampsUnread.rel} cannot be read, so no hold is proposed. Run check_desk to see why.`);
  }
  const desk = new Desk(read);
  const seat = seatOf(desk, args.seat);
  const about = aboutOf(desk, args.about);
  const start = holdTime("start", args.start);
  const end = holdTime("end", args.end);
  if (end <= start) {
    throw new Refusal(`The hold ends at or before it starts: \`end\` is after \`start\`, as the person said them. ${NOTHING}`);
  }
  if (clockOf(start).slice(0, 10) !== clockOf(end - 1).slice(0, 10)) {
    throw new Refusal(`A hold starts and ends on the same day, and the day's events are listed for it: ask the person for a time on one day. ${NOTHING}`);
  }
  const holdDay = clockOf(start).slice(0, 10);
  const day = dayOf(args.day, holdDay);
  const from = momentOf(...day.split("-"));
  const events = eventsOf(args.events, day, from, from + DAY_MS, args.listing_empty);
  // Two spans clash when each starts before the other ends: an event that ends as the hold starts,
  // or starts as it ends, leaves the hold clear.
  const clashes = events.filter((event) => event.start < end && start < event.end);
  if (clashes.length) {
    const spans = clashes.map((event) => `${clockOf(event.start)} to ${clockOf(event.end)}`).join("; ");
    throw new Refusal(
      `The hold, ${clockOf(start)} to ${clockOf(end).slice(11)}, clashes with the seat's calendar: an event runs ` +
        `${spans}. Ask the person for another time, and never move the hold yourself. ${NOTHING}`,
    );
  }
  const hold = { seat, about: about.slug, title: `Hold: ${desk.title(about.slug)}`, start: args.start, end: args.end };
  recordHold(root, hold, now);
  const listed = events.length
    ? `None of the ${events.length === 1 ? "event" : `${events.length} events`} the seat's calendar listed on ${day} overlaps ${clockOf(start)} to ${clockOf(end).slice(11)}.`
    : `The seat's calendar listed no event on ${day}.`;
  return {
    tool: TOOL,
    plugin_version: pluginVersion(),
    hold,
    day,
    events_compared: events.length,
    summary:
      `${listed} Create this hold on the seat's own calendar with exactly this title, start and end, and no guest, ` +
      "within a few minutes: the calendar guard lets only this event through, and only for that long. Nothing was written on the desk.",
  };
}

const TOOLS = [
  {
    name: TOOL,
    description:
      "Settle a calendar hold before it is created: refuses a hold whose time was not said, and one that " +
      "clashes with the day's events, which the skill lists through the calendar connector and passes in. " +
      "Answers the hold to create, with exactly its title, start and end, and records it in the seat's scratch " +
      "folder for the calendar guard. Writes nothing on the desk.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK_ARGUMENT,
        seat: { type: "string", description: "The handle of the seat whose calendar the hold goes on." },
        about: {
          type: "string",
          description: "The page the hold is about, by its page name: a family, person or firm page on the desk.",
        },
        start: {
          type: "string",
          description: `When the hold starts, as the person said it: a day and a time of day in IST, like ${EXAMPLE}.`,
        },
        end: {
          type: "string",
          description: "When the hold ends, as the person said it, on the same day, in IST.",
        },
        day: {
          type: "string",
          description: `The day the seat's calendar was listed for, like ${DAY_EXAMPLE}: the hold's day.`,
        },
        listing_empty: {
          type: "boolean",
          const: true,
          description: "True when the listing of the day came back empty, and only then; `events` is then an empty list.",
        },
        events: {
          type: "array",
          description:
            "The seat's events on the hold's day, as the calendar connector listed them, each as { start, end } " +
            "alone (a day alone, like 2026-09-21, for an event that fills the day). Empty only with `listing_empty`.",
          items: {
            type: "object",
            properties: { start: { type: "string" }, end: { type: "string" } },
            required: ["start", "end"],
            additionalProperties: false,
          },
        },
      },
      required: ["seat", "about", "start", "end", "day", "events"],
      additionalProperties: false,
    },
    run: proposeHold,
  },
];

module.exports = { TOOLS, proposeHold, clockOf, ACCEPTED_FOR_MS, SCRATCH, RECORD };
