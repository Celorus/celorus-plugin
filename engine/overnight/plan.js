"use strict";
// The overnight's plan: every page the run changes, held in memory until the run has read all
// it needs, so every refusal comes before the first change (R25) and the pages go down in one
// pass through the writers' own steps (write/pages.js writeSteps), the history line last. A page
// is read for writing through the writers' reader (write/pages.js readOwned): never through a
// link, never a page that is not a plain file or not UTF-8 text; such a page in the plan refuses
// the whole run, named, with nothing written.
//
// The page forms are the demo kit's layout 2 (demo_kit/layout2.py), ported: a section, a line
// added under a heading, a proof line, a table. Where the demo re-wrote a page's whole header,
// the plan rewrites only the lines it changes, and every other byte of the header stays; on a
// header the demo wrote, the two give the same bytes.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { splitPage } = require("../lib/desk.js");
const { parseHeader, HeaderError } = require("../lib/header.js");
const T = require("../write/text.js");
const { linkSpans } = require("../check/text.js");
const { readOwned, withGeneratedBy } = require("../write/pages.js");

const NOTHING = "Nothing was written.";

function refuse(message) {
  throw new Refusal(message);
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// A header as a value that compares whatever order its keys were written in.
function settled(value) {
  if (Array.isArray(value)) return value.map(settled);
  if (isMapping(value)) {
    return Object.keys(value)
      .sort()
      .map((key) => [key, settled(value[key])]);
  }
  return value;
}
const same = (a, b) => JSON.stringify(settled(a)) === JSON.stringify(settled(b));

// What stands at a page's place, looked at and never followed: "absent", "file", or "other".
function standing(file) {
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    return err && (err.code === "ENOENT" || err.code === "ENOTDIR") ? "absent" : "other";
  }
  return st.isFile() ? "file" : "other";
}

class Plan {
  constructor(ctx) {
    this.ctx = ctx;
    // rel -> { raw: Buffer or null (a page the run makes), text, before }
    this.pages = new Map();
  }

  file(rel) {
    return path.join(this.ctx.celorus, ...rel.split("/"));
  }

  // Whether the page is there, in the plan or on the desk. A page that is there but is not a
  // plain file (a link, a folder) refuses the run, named: the run would read or write it.
  holds(rel) {
    if (this.pages.has(rel)) return this.pages.get(rel).text !== null;
    const at = standing(this.file(rel));
    if (at === "other") refuse(`${rel} is not a plain file (a link or a folder), so nothing was written.`);
    return at === "file";
  }

  // The page's text as the plan holds it, read for writing: null when it is not there.
  read(rel) {
    if (this.pages.has(rel)) return this.pages.get(rel).text;
    const owned = readOwned(this.ctx.celorus, rel, this.ctx.desk.id);
    if (owned === null) return null;
    if (owned.refused) refuse(owned.refused);
    this.pages.set(rel, { raw: owned.raw, text: owned.text, before: owned.text });
    return owned.text;
  }

  put(rel, text) {
    const held = this.pages.get(rel);
    if (held) held.text = text;
    else this.pages.set(rel, { raw: null, text, before: null });
  }

  // The steps that put the plan down, in the order the pages were first read or made, and the
  // pages among them by path; a page read and left as it was is no step.
  steps() {
    const out = [];
    for (const [rel, held] of this.pages) {
      if (held.text === null || held.text === held.before) continue;
      out.push(held.raw === null ? { kind: "create", rel, text: held.text } : { kind: "rewrite", rel, raw: held.raw, text: held.text });
    }
    return out;
  }
}

// A page of the plan opened for a change: its header's text, the header read, and its body.
function open(plan, rel) {
  const text = plan.read(rel);
  if (text === null) return null;
  const split = splitPage(text);
  if (split === null) refuse(`${rel} has no header, so the overnight does not change it. ${NOTHING}`);
  let head;
  try {
    head = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    refuse(`${rel} has a header that does not read, so the overnight does not change it. ${NOTHING}`);
  }
  if (!isMapping(head)) refuse(`${rel} has no header of keys and values, so the overnight does not change it. ${NOTHING}`);
  return { rel, header: split.header, head, body: split.body, keys: [] };
}

// Sets one header key on an opened page: its line replaced where it stands, or added at the
// header's end, as the demo's dict put a new key last.
function setKey(page, key, value) {
  const line = T.dumpHeader({ [key]: value }).split("\n")[1];
  const lines = page.header.split("\n");
  const pattern = new RegExp(`^${key}[ \\t]*:`, "u");
  const at = lines.flatMap((row, i) => (pattern.test(row) ? [i] : []));
  if (at.length > 1) refuse(`${page.rel} names ${key} more than once in its header, so the overnight does not change it. ${NOTHING}`);
  if (at.length) lines[at[0]] = line;
  else lines.push(line);
  page.header = lines.join("\n");
  page.head = { ...page.head, [key]: parseHeader(line)[key] };
  page.keys.push(key);
}

// Puts an opened page back into the plan, its body with the blanks at its ends taken off, as the
// demo's write_page did. A key whose old value ran over more than one line would leave its tail
// behind: the header is read back and must hold exactly the values set, or the run is refused.
function close(plan, page) {
  let after;
  try {
    after = parseHeader(page.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    after = undefined;
  }
  if (after === undefined || !same(after, page.head)) {
    refuse(`${page.rel} has its ${[...new Set(page.keys)].join(", ")} written over more than one line, so the overnight does not rewrite it. ${NOTHING}`);
  }
  plan.put(page.rel, `---\n${page.header}\n---\n\n${T.pyStrip(page.body)}\n`);
}

// A time as written in a header, as a moment: an offset read as written, a time with none read
// at `offset` (the run's own); null for a date alone or anything else.
const TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?[ ]*(Z|[+-][0-9]{2}:?[0-9]{2})?$/u;
function momentOf(value, offset) {
  if (typeof value !== "string") return null;
  const m = TIME.exec(value);
  if (!m) return null;
  const zone = m[8] === undefined ? offset : m[8] === "Z" ? "+00:00" : m[8];
  const sign = zone[0] === "-" ? -1 : 1;
  const digits = zone.slice(1).replace(":", "");
  const shift = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
  const ms = Number(`0.${m[7] || "0"}`) * 1000;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)) + ms - shift * 60000;
}

// A page's timestamp moves forward only, to the run's time (demo reconcile._touch).
function touch(page, at) {
  const offset = at.iso.slice(-6);
  const old = momentOf(page.head.timestamp, offset);
  if (old === null || old < momentOf(at.iso, offset)) setKey(page, "timestamp", T.stamp(at.iso));
}

// The non-blank lines under `## heading`, up to the next `## `, the footer line left out.
function section(body, heading, footer) {
  const lines = [];
  let inside = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      inside = T.pyStrip(line.slice(3)) === heading;
      continue;
    }
    if (inside && T.pyStrip(line) && T.pyStrip(line) !== footer) lines.push(line);
  }
  return lines;
}

// Lines added under `## heading` (made at the body's end when missing), each skipped when it is
// there already, the footer line kept last (demo layout2.add_to_section).
function addToSection(body, heading, added, footer) {
  const existing = new Set(section(body, heading, footer));
  let fresh = added.filter((line) => !existing.has(line));
  let text = (footer === null ? body : body.split(footer).join("")).replace(/\n+$/u, "");
  if (fresh.length) {
    const lines = text.split("\n");
    const start = lines.indexOf(`## ${heading}`);
    if (start !== -1) {
      let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
      if (end === -1) end = lines.length;
      while (end > start + 1 && !T.pyStrip(lines[end - 1])) end -= 1;
      if (end === start + 1) fresh = ["", ...fresh];
      lines.splice(end, 0, ...fresh);
      text = lines.join("\n");
    } else {
      text = `${text}\n\n## ${heading}\n\n${fresh.join("\n")}`;
    }
  }
  const kept = text.replace(/\n+$/u, "");
  return footer === null ? `${kept}\n` : `${kept}\n\n${footer}\n`;
}

// One said line under `## Connections` (demo layout2.proof_line, proof "said").
function proofLine(connection, target, register, date, { conversation = null, words = null, saidBy = null } = {}) {
  const parts = [target ? `- ${connection} [[${target}]]` : `- ${connection}`, "said", register, date];
  if (conversation) parts.push(`in [[${conversation}]]`);
  if (words) parts.push(`"${words}"`);
  if (saidBy) parts.push(`said by [[${saidBy}]]`);
  return parts.join(T.DOT);
}

// The link that starts `at` in `text`, read through the engine's one link reader (check/text.js,
// DESK-60): its inside as written, name and tail (the demo's `[^\]]+`), and where it ends; or null.
function linkAt(text, at = 0) {
  const span = linkSpans(text).find((s) => s.start === at);
  return span ? { inner: span.name + span.tail, end: span.end } : null;
}

// The head of a proof line (the demo's `^- (?:[[subject]] )?connection(?: [[target]]| words)?$`):
// { subject, connection, target }, or null when it is not one.
function proofHead(text) {
  if (!text.startsWith("- ")) return null;
  let rest = text.slice(2);
  let subject = null;
  const first = linkAt(rest);
  if (first && rest[first.end] === " ") {
    subject = first.inner;
    rest = rest.slice(first.end + 1);
  }
  const conn = /^[a-z_]+/u.exec(rest);
  if (!conn) return null;
  const after = rest.slice(conn[0].length);
  if (after === "") return { subject, connection: conn[0], target: null };
  if (!after.startsWith(" ") || after.length === 1) return null;
  const words = after.slice(1);
  const link = linkAt(words);
  return { subject, connection: conn[0], target: link && link.end === words.length ? link.inner : null };
}

// A proof line read back (demo layout2.parse_proof_line), or null when it is not one.
function parseProofLine(line) {
  const parts = line.split(T.DOT).map(T.pyStrip);
  if (parts.length < 4 || !["shown", "said", "guessed"].includes(parts[1])) return null;
  const head = proofHead(parts[0]);
  if (!head) return null;
  const out = {
    subject: head.subject,
    connection: head.connection,
    target: head.target,
    register: parts[2],
    date: parts[3],
    words: null,
    said_by: null,
  };
  for (const part of parts.slice(4)) {
    if (part.startsWith("in ") && linkAt(part, 3)) continue;
    else if (part.startsWith('"') && part.endsWith('"')) out.words = part.slice(1, -1);
    else if (part.startsWith("said by ") && linkAt(part, 8)) out.said_by = T.unlink(part.slice(8));
  }
  return out;
}

// A register's rows (demo layout2.read_table): the first table line names the columns, a rule
// line is passed over, a short row is read with its missing cells empty and a long one keeps only
// the columns named; the empty cell reads as null.
function readTable(text) {
  const rows = [];
  let columns = null;
  const cellsOf = (line) =>
    T.pyStrip(line)
      .split(/(?<!\\)\|/u)
      .slice(1, -1)
      .map((part) => T.pyStrip(part).split("\\|").join("|"));
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (columns === null) columns = cellsOf(line);
    else if ([...line.split("|").join("").trim()].every((ch) => "-: ".includes(ch))) continue;
    else {
      const cells = cellsOf(line);
      while (cells.length < columns.length) cells.push(T.BLANK);
      rows.push(Object.fromEntries(columns.map((column, i) => [column, cells[i] === T.BLANK ? null : cells[i]])));
    }
  }
  return rows;
}

// A register's text with `rows` added under its table, and its stamp naming this tool (the base's
// ruling R5); refused, naming why, where the rows have nowhere to go (as the writers' registers).
function withRegisterRows(rel, text, rows, generatedBy) {
  const broken = T.lineBreakIn(text);
  if (broken) refuse(`${rel} holds ${broken}, which reads as a line break, so a row could be torn in two. ${NOTHING}`);
  const columns = T.tableColumns(text);
  if (columns === null) refuse(`${rel} has no table, so the row has nowhere to go. ${NOTHING}`);
  if (T.tableRuns(text) > 1) {
    refuse(`${rel} holds more than one table (its lines that start with "|" are not one run), so the row has no one table to go in. ${NOTHING}`);
  }
  for (const row of rows) {
    const keys = Object.keys(row);
    if (new Set(columns).size !== columns.length || columns.length !== keys.length || !keys.every((key) => columns.includes(key))) {
      refuse(`${rel} has the columns ${columns.join(", ")}, and this row has ${keys.join(", ")}, so the row has nowhere to go. ${NOTHING}`);
    }
  }
  const stamped = withGeneratedBy(rel, T.withRows(text, rows), generatedBy);
  if (stamped.refused) refuse(stamped.refused);
  return stamped.text;
}

// A new register page: its header, heading, words and an empty table (demo writes.new_table_page).
function tablePage(header, heading, intro, columns, footer) {
  const table = [`| ${columns.join(" | ")} |`, `|${columns.map(() => "---").join("|")}|`].join("\n");
  const body = [`# ${heading}`, "", intro, "", table, ...(footer === null ? [] : ["", footer])].join("\n");
  return T.pageText(header, body);
}

// log.md's entries, each with its seat, the skill it names and what it says, read as the demo read
// them (demo layout2.read_log): a line under a day's heading that starts "* ".
function logEntries(text) {
  const out = [];
  let day = null;
  for (const line of (text || "").split("\n")) {
    if (line.startsWith("## ")) day = T.pyStrip(line.slice(3));
    else if (line.startsWith("* ") && day) {
      const parts = line.slice(2).split(T.DOT);
      if (parts.length < 5) continue;
      out.push({ day, handle: parts[1], skill: parts[2], what: parts.slice(3, -1).join(T.DOT) });
    }
  }
  return out;
}

module.exports = {
  NOTHING,
  Plan,
  refuse,
  open,
  setKey,
  close,
  touch,
  section,
  addToSection,
  proofLine,
  parseProofLine,
  linkAt,
  readTable,
  withRegisterRows,
  tablePage,
  logEntries,
  standing,
};
