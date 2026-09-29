"use strict";
// The desk's written forms, as the writers put them down: a page's header, a table row, a log
// line, a time. Ported from the demo kit's layout 2 writer so a page the engine writes is the
// page the demo wrote, byte for byte, apart from the differences the tests name (the
// generated_by stamp, the footer, the log's hand-written lines).
//
// Python's whitespace is not JavaScript's: `\s`, str.split() and str.strip() read the 29
// characters in PY_SPACE, which leave out U+FEFF and take in U+001C to U+001F and U+0085. The
// writers read text as the demo did, so they use this set, never `\s` or trim().

const { linkSpans } = require("../check/text.js");

const PY_SPACE =
  "\\t\\n\\u000b\\u000c\\r\\u001c-\\u001f \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const SPACE_RUN = new RegExp(`[${PY_SPACE}]+`, "gu");
const EDGE_SPACE = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu");
// The characters besides "\n" and "\r" that Python's str.splitlines() reads as a line break,
// each by its name. A register holding one is refused, as one with "\r" is (pages.js), so a
// row that holds one is never torn in two.
const LINE_BREAK_NAMES = {
  "\u000b": "a vertical tab (U+000B)",
  "\u000c": "a form feed (U+000C)",
  "\u001c": "a file separator (U+001C)",
  "\u001d": "a group separator (U+001D)",
  "\u001e": "a record separator (U+001E)",
  "\u0085": "a next line (U+0085)",
  "\u2028": "a line separator (U+2028)",
  "\u2029": "a paragraph separator (U+2029)",
};
const LINE_BREAK = /[\u000b\u000c\u001c\u001d\u001e\u0085\u2028\u2029]/u;

// The name of the first such character in `text`, or null.
function lineBreakIn(text) {
  const m = LINE_BREAK.exec(text);
  return m ? LINE_BREAK_NAMES[m[0]] : null;
}

// The empty cell, and the separator of a log line's parts.
const BLANK = "\u00b7";
const DOT = ` ${BLANK} `;

// A seat handle, and the slug of any page a writer names: lowercase words joined by hyphens. A
// case-folding disk would read "Kabir" as kabir.md, and "../" would leave the folder.
const HANDLE = /^[a-z0-9][a-z0-9-]*$/u;

function pyStrip(text) {
  return text.replace(EDGE_SPACE, "");
}

function pySplit(text) {
  return pyStrip(text).split(SPACE_RUN).filter((word) => word !== "");
}

// One table cell or one proof-line field: no separators, one line.
function clean(value) {
  const text = value ? String(value) : "";
  return pyStrip(text.split(BLANK).join(",").split("|").join("/").replace(SPACE_RUN, " "));
}

// A header value written as a link, "[[slug]]", and one written bare as a date or a time.
class Link {
  constructor(slug) {
    this.text = `[[${slug}]]`;
  }
}
class Stamp {
  constructor(text) {
    this.text = text;
  }
}
const link = (slug) => new Link(slug);
const stamp = (text) => new Stamp(text);

// The text inside a link that is the whole value, its name and tail as written, read by the one
// link reader (check/text.js linkSpans); or the text as it is.
function unlink(value) {
  const text = value ? String(value) : "";
  const [first] = linkSpans(text);
  return first && first.start === 0 && first.end === text.length ? first.name + first.tail : text;
}

const RESERVED = new Set(["yes", "no", "true", "false", "null", "on", "off", "y", "n"]);
// No comma: a flow list would split a bare "Vohra, Nikhil" into two items.
const PLAIN = /^[A-Za-z][A-Za-z0-9 _.'()/+&-]*$/u;

// One header value, written so it reads back as the same value and type.
function scalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (value instanceof Link) return `"${value.text}"`;
  if (value instanceof Stamp) return value.text;
  if (typeof value !== "string") throw new TypeError(`not a header value the writers write: ${String(value)}`);
  if (PLAIN.test(value) && value === pyStrip(value) && !RESERVED.has(value.toLowerCase())) return value;
  return JSON.stringify(value);
}

// A header: keys in the order given, a missing value left out, a list in flow style.
function dumpHeader(fields) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    lines.push(Array.isArray(value) ? `${key}: [${value.map(scalar).join(", ")}]` : `${key}: ${scalar(value)}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

// A whole page: its header, a blank line, and its body with the blanks at its ends taken off.
function pageText(header, body) {
  return `${dumpHeader(header)}\n${pyStrip(body)}\n`;
}

function cell(value) {
  if (value === null || value === undefined || value === "") return BLANK;
  return String(value).split("|").join("\\|").split("\n").join(" ");
}

function cells(line) {
  return pyStrip(line)
    .split(/(?<!\\)\|/u)
    .slice(1, -1)
    .map((part) => pyStrip(part).split("\\|").join("|"));
}

// The page's lines, split on "\n" alone so every other byte of a line stays in it, and the
// indexes of its table's lines.
function tableLines(text) {
  const lines = text.replace(/\n+$/u, "").split("\n");
  return { lines, at: lines.flatMap((line, i) => (line.startsWith("|") ? [i] : [])) };
}

// The columns the page's table names, or null when the page has no table.
function tableColumns(text) {
  const { lines, at } = tableLines(text);
  return at.length ? cells(lines[at[0]]) : null;
}

// How many tables the page holds: the runs of consecutive lines that start with "|".
function tableRuns(text) {
  const { at } = tableLines(text);
  return at.filter((line, i) => i === 0 || at[i - 1] !== line - 1).length;
}

// The page's text with `rows` added after its table's last row, each cell under the column the
// table names; or null when the page has no table. The caller holds each row to the columns
// first (writers.js); every line already there is kept as it was.
function withRows(text, rows) {
  const { lines, at } = tableLines(text);
  if (!at.length) return null;
  const columns = cells(lines[at[0]]);
  const added = rows.map((row) => `| ${columns.map((column) => cell(row[column])).join(" | ")} |`);
  lines.splice(at[at.length - 1] + 1, 0, ...added);
  return `${lines.join("\n")}\n`;
}

// A time the person gave, with its own offset: the writers write it at that offset, as given.
const AT = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]{1,9}))?)?(Z|[+-][0-9]{2}:[0-9]{2})$/u;

function daysIn(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validDate(year, month, day) {
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}

// The time `at` as the writers use it: its date, its clock time as HH:MM, and the timestamp a
// header carries, written as Python writes it (seconds always, a fraction only when there is one).
// Null when it is not such a time.
function readAt(at) {
  if (typeof at !== "string") return null;
  const m = AT.exec(at);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  if (!validDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const offset = m[8] === "Z" ? "+00:00" : m[8];
  const [oh, om] = offset.slice(1).split(":").map(Number);
  if (oh > 23 || om > 59) return null;
  const micro = (m[7] || "").padEnd(6, "0").slice(0, 6);
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const clock = `${m[4]}:${m[5]}`;
  const fraction = /^0+$/u.test(micro) ? "" : `.${micro}`;
  return { date, clock, iso: `${date}T${clock}:${String(second).padStart(2, "0")}${fraction}${offset}` };
}

// A date the person gave, from the first ten characters of what they wrote, as the demo read it;
// null when those are not a date.
function readDate(value) {
  const text = String(value).slice(0, 10);
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(text);
  if (!m || !validDate(Number(m[1]), Number(m[2]), Number(m[3]))) return null;
  return text;
}

// log.md. One line per change, under the day's heading, the newest day first and the newest
// line first within its day:
//   * HH:MM \u00b7 <seat> \u00b7 <skill> \u00b7 <what> \u00b7 yours
// The demo rebuilt the whole log from the lines it could read and dropped the rest. The engine
// puts the new line in place instead, and every other line stays as it was, byte for byte, a
// line written by hand that reads as no entry among them (the base's ruling R6). On a log the
// demo wrote, the two give the same bytes.
const LOG_ENTRY = /^\* ([0-9]{2}:[0-9]{2}) \u00b7 /u;
const LOG_DAY = /^## ([0-9]{4}-[0-9]{2}-[0-9]{2})$/u;

function logLine(clock, handle, skill, what) {
  return `* ${clock}${DOT}${handle}${DOT}${skill}${DOT}${clean(what)}${DOT}yours`;
}

// log.md's text with `line` added for `date` at `clock`. `text` is null when there is no log;
// `footer` is the desk's footer line, or null.
function withLogLine(text, date, clock, line, footer) {
  if (text === null) {
    return footer === null ? `# Log\n\n## ${date}\n${line}\n` : `# Log\n\n## ${date}\n${line}\n\n${footer}\n`;
  }
  const lines = text.split("\n");
  const ends = (i) => lines[i].startsWith("## ") || lines[i].startsWith("# ") || (footer !== null && lines[i] === footer);
  const days = lines.flatMap((row, i) => {
    const m = LOG_DAY.exec(row);
    return m ? [{ i, date: m[1] }] : [];
  });
  const day = days.find((d) => d.date === date);
  if (day) {
    let end = day.i + 1;
    while (end < lines.length && !ends(end)) end += 1;
    const entries = [];
    for (let i = day.i + 1; i < end; i += 1) {
      const m = LOG_ENTRY.exec(lines[i]);
      if (m) entries.push({ i, clock: m[1] });
    }
    const later = entries.find((entry) => entry.clock < clock);
    const at = later ? later.i : entries.length ? entries[entries.length - 1].i + 1 : day.i + 1;
    lines.splice(at, 0, line);
    return lines.join("\n");
  }
  const block = [`## ${date}`, line, ""];
  const older = days.find((d) => d.date < date);
  if (older) {
    lines.splice(older.i, 0, ...block);
    return lines.join("\n");
  }
  const foot = footer === null ? -1 : lines.indexOf(footer);
  if (foot !== -1) {
    lines.splice(foot, 0, ...block);
    return lines.join("\n");
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return `${[...lines, "", `## ${date}`, line].join("\n")}\n`;
}

module.exports = {
  BLANK,
  DOT,
  HANDLE,
  PY_SPACE,
  pyStrip,
  pySplit,
  clean,
  link,
  stamp,
  unlink,
  dumpHeader,
  pageText,
  lineBreakIn,
  tableColumns,
  tableRuns,
  withRows,
  readAt,
  readDate,
  logLine,
  withLogLine,
};
