"use strict";
// How a page says what the counts hand it: dates in words, a count's label read for its count,
// a row's sentence split where the page sets its parts apart, and text escaped for the page.
// Nothing here counts anything: every number a page prints is its view's own.
//
// Ported from the demo kit's render.py and counts.py (row E5), so a page reads as the kit's did.
// Python's own ways of printing are kept where a page shows them: a float prints with its point
// (45.0), a capitalised line lowers the rest of it, and a quote escapes to its decimal character reference.

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const NUMBER_WORDS = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
  "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];
// the plural nouns a count's label is written with, each read for one; a label with none of
// them reads the same whatever the count
// "promises" is written as a string in this file, key and member alike: the bare word is the name
// of fs.promises, which the engine's read scan refuses (B4, e4c_read_scan.test.js).
const ONE_OF = {
  meetings: "meeting", briefs: "brief", "promises": "promise", moments: "moment", leads: "lead",
  replies: "reply", families: "family", calls: "call", rooms: "room", "follow-ups": "follow-up",
  seats: "seat",
};

// A day as "YYYY-MM-DD", read from a date or a timestamp written that way; anything else throws,
// as the kit's as_date does.
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
function asDate(value) {
  const text = String(value === null || value === undefined ? "" : value).slice(0, 10);
  const m = ISO_DAY.exec(text);
  if (!m) throw new TypeError(`not a date: ${JSON.stringify(value)}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new TypeError(`not a date: ${JSON.stringify(value)}`);
  }
  return text;
}

function dayNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// Whole days from `a` to `b`, both "YYYY-MM-DD".
function daysBetween(a, b) {
  return dayNumber(b) - dayNumber(a);
}

function addDays(iso, n) {
  return new Date((dayNumber(iso) + n) * 86400000).toISOString().slice(0, 10);
}

function weekday(iso) {
  // Monday is 0, as Python's weekday()
  return (new Date(dayNumber(iso) * 86400000).getUTCDay() + 6) % 7;
}

// "Monday 21 September"
function dateLabel(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${DAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]}`;
}

// "Mon 21 Sep", from anything a date is read from; throws as asDate does.
function shortDate(value) {
  const iso = asDate(value);
  const [, m, d] = iso.split("-").map(Number);
  return `${DAYS[weekday(iso)].slice(0, 3)} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

// A date in short words, or the words that say the line holds none.
function shortWords(value) {
  try {
    return shortDate(value);
  } catch {
    return "no date on the line";
  }
}

// A date in words, or the words that say the page holds none.
function dayWords(value) {
  try {
    return dateLabel(asDate(value));
  } catch {
    return "no date on the page";
  }
}

// Python's str() of a value a page prints: a float keeps its point, None is "None".
class PyFloat {
  constructor(value) {
    this.value = value;
  }

  toString() {
    const v = this.value;
    if (Number.isInteger(v)) return `${v}.0`;
    return String(v);
  }
}

function num(value) {
  return value instanceof PyFloat ? value.value : value;
}

function pyStr(value) {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

// The items of a value the model sent, strings and nested lists flattened, other kinds kept.
function items(value) {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (typeof item === "string" || Array.isArray(item)) out.push(...items(item));
    else out.push(item);
  }
  return out;
}

function isMap(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Prose sent live, as the list a page loops over: a map is its values, never a repr.
function aslist(value) {
  const out = [];
  for (const item of items(isMap(value) ? Object.values(value) : value)) {
    if (isMap(item)) out.push(...aslist(item));
    else out.push(item);
  }
  return out;
}

// One line of prose as a page says it.
function asline(value) {
  if (value === null || value === undefined) return "";
  if (isMap(value) || Array.isArray(value)) return aslist(value).map(pyStr).join(" ").trim();
  return pyStr(value);
}

function asmap(value) {
  return isMap(value) ? value : {};
}

// A room brief's sections as the page draws them.
function assections(value) {
  const out = [];
  for (const item of items(value)) {
    if (isMap(item) && (truthy(item.heading) || truthy(item.paragraphs))) {
      out.push({ heading: asline(item.heading), paragraphs: aslist(item.paragraphs) });
    } else if (typeof item === "string" && item.trim()) {
      out.push({ heading: "", paragraphs: [item] });
    }
  }
  return out;
}

// The lines a card joins into its one who-and-why paragraph, as that paragraph's text.
function joinedLine(value) {
  return aslist(value).map(pyStr).join(" ");
}

// A room brief's paragraphs as the page draws them: each one a paragraph ({text}), or, when it
// starts with "- ", a list whose items are its lines ({list}). The page (templates/parts.js)
// and the screen (render/prose.js) read the same blocks, so what is screened is what is drawn.
function paragraphBlocks(items) {
  const out = [];
  for (const item of aslist(items)) {
    const p = pyStr(item);
    if (p.trimStart().startsWith("- ")) {
      const list = [];
      for (const li of p.split("\n")) {
        const line = li.trim();
        if (line) list.push(line.startsWith("- ") ? line.slice(2) : line);
      }
      out.push({ list });
    } else {
      out.push({ text: p });
    }
  }
  return out;
}

// Python's truth of a value.
function truthy(value) {
  if (value === null || value === undefined || value === false || value === "" || value === 0) return false;
  if (value instanceof PyFloat) return value.value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isMap(value)) return Object.keys(value).length > 0;
  return true;
}

// A count said in words; past twenty it stays a numeral.
function words(n) {
  return Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : pyStr(n);
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

// A count's label read for the count beside it: one brief ready, two briefs ready.
function counted(label, n) {
  const said = asline(label);
  if (n !== 1) return said;
  const parts = said.split(" ");
  for (let i = 0; i < parts.length; i += 1) {
    if (Object.hasOwn(ONE_OF, parts[i])) {
      parts[i] = ONE_OF[parts[i]];
      return parts.join(" ");
    }
  }
  return said;
}

// Python's str.partition.
function partition(text, sep) {
  const at = text.indexOf(sep);
  return at === -1 ? [text, "", ""] : [text.slice(0, at), sep, text.slice(at + sep.length)];
}

function rpartition(text, sep) {
  const at = text.lastIndexOf(sep);
  return at === -1 ? ["", "", text] : [text.slice(0, at), sep, text.slice(at + sep.length)];
}

// A signal row's layer, set apart, and what happened.
function splitSignal(why) {
  const text = asline(why);
  const [head, sep, rest] = partition(text, ": ");
  return sep && head.length < 40 ? [head, rest] : ["", text];
}

// A critical mail row's sender, set apart, and its subject.
function splitMail(why) {
  const text = asline(why);
  const [head, sep, rest] = partition(text, " wrote: ");
  return sep ? [head, rest] : ["", text];
}

// "New signal, Fri 18 Sep": what comes before the last comma, and after it.
function splitLast(text) {
  const [head, sep, tail] = rpartition(asline(text), ", ");
  return sep ? [head, tail] : ["", asline(text)];
}

function since(when) {
  const text = asline(when);
  return text.startsWith("Waiting on you ") ? text.slice("Waiting on you ".length) : text;
}

// Lines that open with a name and a colon, one group per name in the order the names come.
function grouped(lines) {
  const groups = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    const [head, rest] = splitSignal(line);
    if (!groups.has(head)) groups.set(head, []);
    groups.get(head).push(rest);
  }
  return [...groups.entries()];
}

// "09:15" as minutes past midnight, or null.
function minutes(hhmm) {
  const m = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(asline(hhmm));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Python's str.capitalize: the first letter up, the rest down.
function capitalize(text) {
  const s = String(text);
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

// Text escaped for the page, as the kit's templates escape it.
// a decimal character reference, the form Python's html.escape writes for the two quotes
const reference = (code) => "&" + "#" + code + ";";
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': reference(34), "'": reference(39) };
function escape(value) {
  return pyStr(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// Words that are already page text: never escaped again.
class Html {
  constructor(text) {
    this.text = text;
  }

  toString() {
    return this.text;
  }
}

// A value set into a page: page text as it is, anything else escaped.
function e(value) {
  return value instanceof Html ? value.text : escape(value);
}

module.exports = {
  asDate,
  daysBetween,
  addDays,
  weekday,
  dateLabel,
  shortDate,
  shortWords,
  dayWords,
  PyFloat,
  num,
  pyStr,
  items,
  isMap,
  aslist,
  asline,
  asmap,
  assections,
  joinedLine,
  paragraphBlocks,
  truthy,
  words,
  plural,
  counted,
  partition,
  rpartition,
  splitSignal,
  splitMail,
  splitLast,
  since,
  grouped,
  minutes,
  capitalize,
  escape,
  Html,
  e,
};
