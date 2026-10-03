"use strict";
// The live-row contract (row E11; the design's section 4.4 and demo items 16 and 19). The rows a
// skill reads from the harness's connectors come to the engine as one argument, `systems`
// (render/systems.js has its shape). A connector's row reaches a counted page only if it names
// someone on the desk: its seat is a seat page, its family or record a page (or a record a person
// page names by its id), its sender a person or a seat the desk has a page for. A row that does not, or whose words the screen refuses, is
// refused, and one refused row drops its whole role back to the desk's own count: the role reads
// as not handed over, so the page says the hole in counts.js's own words (NOT_HANDED_OVER),
// never a count short by the rows refused, nor a 0 because the screen refused every row.
//
// A row is carried onward by its named fields alone (CARRIED, below): every field a page, a count,
// a saved file or an answer takes from a row is named there with how it is held, to the desk's
// names, to the screen, or to a closed shape, and the rows handed on are built again from those
// fields. A key the table does not name, at the top of a row or inside an object in it, is left
// behind: it reaches no page, no answer and no file, and it refuses nothing (a real connector's
// rows carry many keys the engine does not read).
//
// A refused row is reported by its role, list and rule, never by its value: the value is real.
// The names a row is held to are read from the desk each time the screen runs, never kept between
// calls, so a person the overnight added this morning is on the list (item 19: a list read at
// screen time). On a synthetic desk the same screen keeps a real row, which names no one there,
// outside every count.
//
// A page drawn in a call that handed rows over is never saved with its sentences: they are about
// the connector's rows, not the desk's, so a later render without them must not reuse them.
// handedOver says whether a call handed any over, kept or refused.

const { Desk } = require("../render/desk.js");
const { systemsOf, istTime, ROLES } = require("../render/systems.js");
const { screen, normalised } = require("../render/screen.js");

// The rules a row is refused by, besides the screen's own (render/screen.js), each in a word.
const NOT_ON_THE_DESK = "not-on-the-desk";
const NOT_A_ROW = "not-a-row";
const NOT_AN_ID = "not-an-id";
const NOT_A_PHONE_NUMBER = "not-a-phone-number";
const NOT_AN_IST_TIME = "not-an-ist-time";
const NOT_A_DAY = "not-a-day";
// The pages a row may name as its family, record or subject.
const PAGE_KINDS = ["families", "people", "firms"];

// How a carried field is held. NAMED: to the desk's names, by the list's check in NAMES_THE_DESK.
// TEXT: free text, to the screen. The rest are closed shapes, which the screen is not asked about
// (its phone and digits rules would refuse every real number, time and id): an id, a phone
// number, a time in IST, a day, true or false, a whole number.
const NAMED = "named";
const TEXT = "text";
const ID = "id";
const PHONE = "phone";
const TIME = "time";
const DAY = "day";
const FLAG = "flag";
const COUNT = "count";

// Every field of every list that is carried onward, and how it is held. An object here is an
// object in the row, carried by its own named keys; a list of one object is a list of such objects.
const CARRIED = {
  "crm.records": {
    id: ID,
    stage: TEXT,
    desk_ref: NAMED,
    phone: PHONE,
    name: TEXT,
    company: TEXT,
    owner_seat: TEXT,
    last_activity: DAY,
    research: {
      net_worth_band: TEXT,
      source_of_wealth: TEXT,
      company: TEXT,
      designation: TEXT,
      city: TEXT,
      age_band: TEXT,
      family_members_known: COUNT,
      board_seats: COUNT,
      listed_holdings: TEXT,
      liquidity_timing: TEXT,
      last_refreshed: DAY,
      profile: TEXT,
    },
  },
  "crm.activities": { record: NAMED, at: TIME, kind: TEXT, by: NAMED },
  "calendar.events": { id: ID, seat: NAMED, attendees: NAMED, start: TIME, title: TEXT, family: NAMED, kind: TEXT },
  "calendar.proposals": {
    id: ID,
    seat: NAMED,
    family: NAMED,
    why: TEXT,
    hold: { seat: NAMED, title: TEXT, start: TIME, end: TIME, attendees: NAMED, family: NAMED },
  },
  "mail.threads": {
    id: ID,
    seat: NAMED,
    family: NAMED,
    subject: TEXT,
    critical: FLAG,
    messages: [{ at: TIME, from_name: NAMED, from_seat: NAMED }],
  },
  "chat.messages": { id: ID, channel: TEXT, from: NAMED, to: NAMED, at: TIME, text: TEXT, needs_reply: FLAG },
};

// The closed shapes. An id is one token: letters, digits and the joiners ids are written with, no
// space and no at-sign. A phone number is digits, or X where a digit is masked, with the marks a
// number is written with. A day is a calendar day, or a time in IST.
const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9_.:=-]{0,199}$/u;
const PHONE_SHAPE = /^[+(]?[0-9Xx][0-9Xx ().-]{3,22}$/u;
const DAY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const COUNT_MOST = 999999;
// A value shorter than this is too short to be told from an ordinary word, and is not looked for
// in a sentence (carriesRefused, below).
const SHORTEST_MATCHED = 4;

function isMap(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Everyone and everything on the desk a row may name, read from the desk as it is now.
function namesOf(desk) {
  const seats = new Set(desk.of("seats").map((page) => page.slug));
  const pages = new Set(PAGE_KINDS.flatMap((kind) => desk.of(kind).map((page) => page.slug)));
  // a sender is a person or a seat, named as the desk titles them, in any letter case
  const senders = new Set(
    ["people", "seats"].flatMap((kind) => desk.of(kind).map((page) => normalised(desk.title(page.slug)).toLowerCase())),
  );
  // a CRM record is the desk's too when a person page names its id (`crm_id`), as counts.js
  // recordsOf reads a family's records
  const records = new Set(
    desk
      .of("people")
      .map((page) => page.header && page.header.crm_id)
      .filter(Boolean)
      .map(String),
  );
  // every name the desk's own pages give, a handle, a page's name, a title, and each word of them
  const own = new Set(
    ["seats", ...PAGE_KINDS].flatMap((kind) =>
      desk.of(kind).flatMap((page) => [page.slug, desk.title(page.slug)].flatMap((name) => [folded(name), ...wordsIn(name)])),
    ),
  );
  return { seats, pages, senders, records, own };
}

const blank = (value) => value === null || value === undefined || value === "";
const aSeat = (names, value) => typeof value === "string" && names.seats.has(value);
const aPage = (names, value) => typeof value === "string" && names.pages.has(value);
const aPageOrNone = (names, value) => blank(value) || aPage(names, value);
const aSender = (names, value) => typeof value === "string" && names.senders.has(normalised(value).toLowerCase());
// a chat message is sent to a seat or to a list of seats
const seatsOnly = (names, value) => aSeat(names, value) || (Array.isArray(value) && value.every((one) => aSeat(names, one)));

// an event's attendees, and a hold's: a list of seats and pages
const partiesOnly = (names, value) => Array.isArray(value) && value.every((one) => aSeat(names, one) || aPage(names, one));

// Whether a row of `role.list` names only the desk, by the fields that name someone. A CRM record
// names the desk by the page its `desk_ref` names, or, with none, by its id on a person page.
const NAMES_THE_DESK = {
  "crm.records": (row, names) => (blank(row.desk_ref) ? typeof row.id === "string" && names.records.has(row.id) : aPage(names, row.desk_ref)),
  "crm.activities": (row, names, ids) => typeof row.record === "string" && ids.has(row.record) && aSeat(names, row.by),
  "calendar.events": (row, names) => aSeat(names, row.seat) && aPageOrNone(names, row.family) && partiesOnly(names, row.attendees),
  // a proposal's hold is what its yes writes on the calendar: the seat, the family and the
  // attendees it names are the desk's too, where it names them
  "calendar.proposals": (row, names) =>
    aSeat(names, row.seat) &&
    aPage(names, row.family) &&
    (blank(row.hold.seat) || aSeat(names, row.hold.seat)) &&
    aPageOrNone(names, row.hold.family) &&
    (blank(row.hold.attendees) || partiesOnly(names, row.hold.attendees)),
  "mail.threads": (row, names) =>
    aSeat(names, row.seat) &&
    aPageOrNone(names, row.family) &&
    row.messages.every(
      (message) => isMap(message) && (blank(message.from_seat) || aSeat(names, message.from_seat)) && aSender(names, message.from_name),
    ),
  "chat.messages": (row, names) => aSeat(names, row.from) && seatsOnly(names, row.to),
};

function realDay(value) {
  const m = typeof value === "string" ? DAY_SHAPE.exec(value) : null;
  if (m === null) return false;
  const [year, month, day] = m.slice(1).map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Why a value is not what its field holds, as a rule's word, or null when it is.
const HELD = {
  // held by the list's names check, which has run by the time a field is read
  [NAMED]: () => null,
  [TEXT]: (value) => {
    if (blank(value)) return null;
    if (typeof value !== "string") return NOT_A_ROW;
    const found = screen(value);
    return found.length ? found[0] : null;
  },
  [ID]: (value) => (blank(value) || (typeof value === "string" && ID_SHAPE.test(value)) ? null : NOT_AN_ID),
  [PHONE]: (value) => (blank(value) || (typeof value === "string" && PHONE_SHAPE.test(value)) ? null : NOT_A_PHONE_NUMBER),
  [TIME]: (value) => (istTime(value) ? null : NOT_AN_IST_TIME),
  [DAY]: (value) => (blank(value) || realDay(value) || istTime(value) ? null : NOT_A_DAY),
  [FLAG]: (value) => (blank(value) || typeof value === "boolean" ? null : NOT_A_ROW),
  [COUNT]: (value) => (blank(value) || (Number.isInteger(value) && value >= 0 && value <= COUNT_MOST) ? null : NOT_A_ROW),
};

// The named fields of `row`, each held as `fields` says, written into `out`: the rule's word of
// the first that is not what it should be, or null when every one is. A field the row does not
// carry is left out of `out` as it was left out of the row.
function carry(fields, row, out) {
  for (const [field, how] of Object.entries(fields)) {
    if (!Object.hasOwn(row, field)) continue;
    const value = row[field];
    if (Array.isArray(how)) {
      if (!Array.isArray(value)) return NOT_A_ROW;
      const items = [];
      for (const one of value) {
        if (!isMap(one)) return NOT_A_ROW;
        const inner = {};
        const rule = carry(how[0], one, inner);
        if (rule !== null) return rule;
        items.push(inner);
      }
      out[field] = items;
    } else if (isMap(how)) {
      if (blank(value)) continue;
      if (!isMap(value)) return NOT_A_ROW;
      const inner = {};
      const rule = carry(how, value, inner);
      if (rule !== null) return rule;
      out[field] = inner;
    } else {
      const rule = HELD[how](value);
      if (rule !== null) return rule;
      out[field] = Array.isArray(value) ? [...value] : value;
    }
  }
  return null;
}

// A row of `role.list` as it is carried onward, { row }, or why it is refused, { rule }.
function heldRow(key, row, names, ids) {
  if (!isMap(row)) return { rule: NOT_A_ROW };
  if (!NAMES_THE_DESK[key](row, names, ids)) return { rule: NOT_ON_THE_DESK };
  const out = {};
  const rule = carry(CARRIED[key], row, out);
  return rule === null ? { row: out } : { rule };
}

// Text as it is matched in a sentence: the screen's own fold, in lower case, its spaces single.
function folded(text) {
  return normalised(String(text)).toLowerCase().replace(/\s+/gu, " ").trim();
}

// The words of a text as a sentence is matched word by word: its runs of letters and digits,
// folded, never a part of one.
function wordsIn(text) {
  return folded(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}

// A number as it is matched in a sentence, in any grouping: its digits, and X where a digit is
// masked, with every mark between them left out.
function digitsOf(text) {
  return folded(text).replace(/[^0-9x]/gu, "");
}

// The numbers a sentence writes: a run of digits (or X where one is masked), with spaces and the
// marks a number is written with between them, standing apart from any word; each as digitsOf
// gives it. A run may hold more than one number (a phone, then a time), so it is matched by its
// stretches: every part of it that holds SHORTEST_MATCHED real digits or more, an X standing in a
// stretch but never counted toward them. The whole run is read.
const NUMBER_RUN = /(?<![\p{L}\p{N}])[0-9x](?:[ .()+-]*[0-9x])*(?![\p{L}\p{N}])/gu;
function numbersIn(text) {
  return (folded(text).match(NUMBER_RUN) || []).map((run) => digitsOf(run));
}

// The longest stretch tried. A phone of PHONE_SHAPE, in any grouping and masked anywhere, is at most
// 24 places, well under it; only a value refused for its shape can be longer, and one whose first
// SHORTEST_MATCHED real digits are spread over more than LONGEST_STRETCH places is not matched. A
// longer stretch that a refused phone holds and no kept one does has a first LONGEST_STRETCH places
// that a refused phone holds too; only a kept phone sharing all of them would excuse it.
const LONGEST_STRETCH = 128;

// Whether a stretch of the run, of SHORTEST_MATCHED real digits or more, is one a refused phone
// (`refused`) holds and no kept phone (`kept`) does. A stretch no refused phone holds is never
// held once it grows, so it grows no further; the real digits are counted as it grows.
function refusedStretchIn(run, refused, kept) {
  if (!refused.length) return false;
  const holds = (numbers, stretch) => numbers.some((number) => number.includes(stretch));
  for (let from = 0; from < run.length; from += 1) {
    let real = 0;
    for (let to = from + 1; to <= Math.min(run.length, from + LONGEST_STRETCH); to += 1) {
      if (run[to - 1] !== "x") real += 1;
      const stretch = run.slice(from, to);
      if (!holds(refused, stretch)) break;
      if (real >= SHORTEST_MATCHED && !holds(kept, stretch)) return true;
    }
  }
  return false;
}

// The fields that name a person, a company, a handle or an address, matched word by word; every
// other field (a page's slug, a record, a subject, a stage and the rest) is matched as a whole value.
const NAMING = {
  "crm.records": new Set(["name", "company"]),
  "crm.activities": new Set(["by"]),
  "calendar.events": new Set(["seat", "attendees"]),
  "calendar.proposals": new Set(["seat", "hold.seat", "hold.attendees"]),
  "mail.threads": new Set(["seat", "messages.from_name", "messages.from_seat"]),
  "chat.messages": new Set(["from", "to"]),
};

// What a row carries that a sentence may say, at any depth: `words`, each word of a field that names
// the row; `values`, each other text field whole; `numbers`, each phone as digitsOf gives it; and
// `every`, each word of any of them, which is what a kept row takes out of the refused rows' words.
function saidOf() {
  return { words: new Set(), values: new Set(), numbers: new Set(), every: new Set() };
}
const SAID_IN_A_SENTENCE = [NAMED, TEXT, PHONE];
function wordsOf(key, fields, row, into, at = "") {
  if (!isMap(row)) return;
  for (const [field, how] of Object.entries(fields)) {
    const value = row[field];
    const path = at + field;
    if (Array.isArray(how)) {
      if (Array.isArray(value)) for (const one of value) wordsOf(key, how[0], one, into, `${path}.`);
    } else if (isMap(how)) {
      wordsOf(key, how, value, into, `${path}.`);
    } else if (SAID_IN_A_SENTENCE.includes(how)) {
      for (const one of Array.isArray(value) ? value : [value]) {
        if (typeof one !== "string" || one === "") continue;
        for (const word of wordsIn(one)) into.every.add(word);
        if (how === PHONE) into.numbers.add(digitsOf(one));
        else if (NAMING[key] && NAMING[key].has(path)) for (const word of wordsIn(one)) into.words.add(word);
        else into.values.add(folded(one));
      }
    }
  }
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
// Whether `text` holds `value` as whole words: not as a part of a longer word or number.
function holdsWhole(text, value) {
  for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + 1)) {
    const before = at === 0 ? "" : text[at - 1];
    const after = at + value.length >= text.length ? "" : text[at + value.length];
    if (!(WORD_CHAR.test(before) && WORD_CHAR.test(value[0])) && !(WORD_CHAR.test(after) && WORD_CHAR.test(value[value.length - 1]))) return true;
  }
  return false;
}

// The systems rows a page may count, by the contract: `systems` as the skill passed it, and `read`,
// the desk as lib/desk.js readDesk read it for this call. Answers `systems`, each role that holds no
// refused row with its rows as they are carried onward, and each role that holds one left out (so it
// reads as not handed over); `dropped`, each refused row as { role, list, rule }; `live`, the roles
// whose rows reach the page; and `fell_back`, the roles handed over and dropped back to the desk's
// own count. A `systems` of the wrong shape is refused whole by render/systems.js, as every tool
// that takes it refuses it.
//
// It answers one thing more, which is never listed among its keys and so is in no answer, page,
// file, log or error: `carriesRefused(text)`, whether a sentence carries a word of a refused row's
// name, company, handle or address, whole and in any letter case, a run of its phone's digits in
// any grouping, or another of its text fields whole. The refused rows' words are held inside it for
// this call alone. A word or a run a row that was not refused carries too, a word the desk's own
// pages give, and a word or a run shorter than SHORTEST_MATCHED are not looked for.
function liveRows(systems, read) {
  const st = systemsOf(systems, { held: true });
  const names = namesOf(new Desk(read));
  const kept = {};
  const dropped = [];
  const live = [];
  const fellBack = [];
  const refused = saidOf();
  const passed = saidOf();
  const ids = new Set(st.crm.records.filter(isMap).map((record) => record.id));
  for (const role of st.given) {
    const rows = {};
    const refusedRows = [];
    for (const list of Object.keys(ROLES[role])) {
      const key = `${role}.${list}`;
      rows[list] = [];
      for (const row of st[role][list]) {
        const one = heldRow(key, row, names, ids);
        if (one.rule === undefined) {
          rows[list].push(one.row);
          wordsOf(key, CARRIED[key], row, passed);
        } else {
          dropped.push({ role, list, rule: one.rule });
          refusedRows.push([key, row]);
        }
      }
    }
    if (refusedRows.length) {
      fellBack.push(role);
      for (const [key, row] of refusedRows) wordsOf(key, CARRIED[key], row, refused);
    } else {
      kept[role] = rows;
      live.push(role);
    }
  }
  const looked = (word) => word.length >= SHORTEST_MATCHED && !passed.every.has(word) && !names.own.has(word);
  const words = [...refused.words].filter(looked);
  const values = [...refused.values].filter((value) => looked(value) && !passed.values.has(value));
  const numbers = [...refused.numbers];
  const keptNumbers = [...passed.numbers];
  // a run of the sentence is a refused phone's when a stretch of it is: one that phone holds and no
  // kept row's phone does
  const refusedNumber = (run) => refusedStretchIn(run, numbers, keptNumbers);
  const result = { systems: kept, dropped, live, fell_back: fellBack };
  Object.defineProperty(result, "carriesRefused", {
    enumerable: false,
    value: (text) => {
      if (!(words.length + values.length + numbers.length) || typeof text !== "string") return false;
      const within = folded(text);
      const said = new Set(wordsIn(text));
      return (
        words.some((word) => said.has(word)) ||
        values.some((value) => holdsWhole(within, value)) ||
        numbersIn(text).some(refusedNumber)
      );
    },
  });
  return result;
}

// Whether a call handed over any connector's rows, kept or refused: when it did, its sentences are
// never saved, and none saved is drawn.
function handedOver(result) {
  return result.live.length + result.fell_back.length > 0;
}

module.exports = {
  liveRows,
  handedOver,
  CARRIED,
  SHORTEST_MATCHED,
  NOT_ON_THE_DESK,
  NOT_A_ROW,
  NOT_AN_ID,
  NOT_A_PHONE_NUMBER,
  NOT_AN_IST_TIME,
  NOT_A_DAY,
};
