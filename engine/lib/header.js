"use strict";
// A page header, read in the desk header subset below and in nothing wider. The subset is
// the desk format's definition: the desks define it (every header on the fixture desk, the
// synthetic desk and our own desk is inside it), and the checker's Python oracle (PyYAML)
// gives the same problem word over those desks and over the case table
// (tests/desk_engine/header_cases.json). Past the subset this reader is stricter than YAML on
// purpose: a header outside it reads "the header does not parse", never guessed at, and the
// page carries HEADER_SUBSET as the remedy. Where YAML would have read such a header, the case
// table names it as an "engine is stricter" row beside the oracle's answer.
//
// THE SUBSET.
// A header is a mapping:
//   - one `key: value` or `key:` per line, from the line's first column. A key is a letter or
//     `_`, then letters, digits, `_`, `.` or `-`, and YAML reads it as text (not `yes`, `null`).
//   - A value is on one line: plain text, 'single-quoted', "double-quoted", a flow list
//     `[a, "b", [c]]` of those, or a flow mapping of the first three (below). Plain text resolves as YAML 1.1 does (the rules the oracle
//     reads by): null, booleans including yes/no/on/off, integers including sexagesimal,
//     floats including sexagesimal. Dates and times stay the text written, since the engine
//     compares and prints them and never does calendar sums; a date or time no calendar has
//     (`2026-02-31`, `25:00:00`) is outside the subset, as the oracle's calendar refuses it.
//     So is plain text YAML 1.1 gives a tag no reader builds (`=`, `<<`), a `0b`/`0x` number
//     with no digit, and an integer past 2^53 (the one number this reader cannot hold exactly).
//   - A plain value inside a flow list holds no `?` and does not start with `:`.
//   - A flow mapping is on one line: `{}`, or `{key: value, key: value}` where each key is a
//     desk key (as above) followed by `:` and a blank, or by `,` or `}` for an empty value,
//     and each value is plain (as inside a flow list), 'single-quoted', "double-quoted" or
//     empty. It holds no flow list and no flow mapping. It may be a key's value, a block list
//     item (`- {resource: x, claim: y, as_of: z}`, as the research-lead profile writes a
//     source), an item of a flow list (`[{resource: x, claim: y}]`), a value in a mapping
//     item, or the whole header on its one line (`{}`, which YAML reads as an empty mapping).
//   - A key with no value may head a block list: `- item` lines, all at one indent, at the
//     key's column or further in. An item is one value, or a flat mapping: `- key: value`,
//     with its further `key: value` lines indented exactly to its first key's column, every
//     value on one line.
//   - A key with no value may instead head a mapping of these same lines, all at one column
//     further in than the key, and so on down: three levels under the top of the header at
//     most (MAX_NESTING). This is layout 1's shape (install-desk/layout-1.md): every detail
//     under one block, `celorus:`, nested as the skill wrote it. Its deepest blocks are the
//     motion spec's `roles:` (`celorus:` > `roles:` > `rm:` > `entry: x`, three levels) and
//     `caps:`, and the seat's `connectors:`; a call's `commitments:` is a block list inside it.
//   - Blank lines and `#` comments anywhere; a comment after a value has a space before `#`.
//   - Spaces only. A tab outside a quoted value or a comment is outside the subset.
//   - Printable text only, anywhere in the header: no control character (tab aside), no DEL,
//     no C1 character, no U+FFFE or U+FFFF (YAML's reader refuses each), and none of the
//     characters YAML reads as a line end or a byte-order mark (U+0085, U+2028, U+2029,
//     U+FEFF).
// Not a header, read as "no header" as the oracle reads it: only blank lines and comments; a
// scalar (plain text that may run over lines, or one quoted value or flow list on one line);
// a list of one-line items, all at one indent.
// Outside the subset (a HeaderError naming what was met): a mapping nested more than three
// levels under the top, a mapping inside a list item past its flat keys, a key off its
// mapping's column, a flow mapping over several lines, one holding a flow list or a flow
// mapping, or one whose entry is not `key: value` with a desk key
// (`{a:1}`, `{"a": 1}`, `{a}`), a block scalar (| or >), an anchor, an alias, a
// tag, a value over several lines, a key that is quoted, holds a blank, starts with a digit or
// is the key a plain object reads as its parent (see setKey), a key YAML reads as other than
// text (`yes`, `null`), a list in a list, list items at two indents, a list item over
// several lines, a tab, a document marker (--- or ...) inside the header.

class HeaderError extends Error {
  constructor(message) {
    super(message);
    this.name = "HeaderError";
  }
}

// The remedy a page outside the subset carries: what a desk header is, in a sentence or two.
const HEADER_SUBSET =
  "A desk page header is one `key: value` per line, each value on its line (plain text, " +
  "'quoted', \"quoted\", a [flow, list], or a {key: value, key: value} flow mapping of plain " +
  "or quoted values); a key with no value may head `- item` lines at one " +
  "indent, where an item is one value or a flat `- key: value` mapping with its further keys " +
  "under its first, or may head `key: value` lines further in (as an older desk's " +
  "`celorus:` block), three levels deep at most. Use spaces, not tabs, and no control " +
  "characters; no flow mapping over several lines or with a list or mapping inside it, no | or " +
  ">, anchor, alias, tag, or --- or ... inside the header.";

// The characters a header may not hold anywhere (see THE SUBSET): YAML's reader refuses the
// control characters, DEL, C1, U+FFFE, U+FFFF and a lone surrogate, and reads U+0085, U+2028,
// U+2029 as a line end and U+FEFF as a byte-order mark where this reader would read text.
const OUTSIDE_CHARACTER =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u2028\u2029\uFEFF\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_.-]*):(?: +(.*))?$/;
// A list item: its indent (spaces), then `-`, then the item's text after one or more spaces.
const ITEM_LINE = /^( *)-(?: +(.*))?$/;
// How many levels a mapping may nest under the top of the header: layout 1's `celorus:` block
// (one), its motion spec's `roles:` (two) and each role's own mapping (three).
const MAX_NESTING = 3;

const NULLS = new Set(["", "~", "null", "Null", "NULL"]);
const TRUES = new Set(["yes", "Yes", "YES", "true", "True", "TRUE", "on", "On", "ON"]);
const FALSES = new Set(["no", "No", "NO", "false", "False", "FALSE", "off", "Off", "OFF"]);
const INT_DECIMAL = /^[-+]?(?:0|[1-9][0-9_]*)$/;
const INT_BINARY = /^[-+]?0b[01_]+$/;
const INT_OCTAL = /^[-+]?0[0-7_]+$/;
const INT_HEX = /^[-+]?0x[0-9a-fA-F_]+$/;
const INT_SEXAGESIMAL = /^[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+$/;
const FLOAT = /^(?:[-+]?[0-9][0-9_]*\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?)$/;
const FLOAT_SEXAGESIMAL = /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/;
const FLOAT_SPECIAL = /^(?:[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;

// A value written as a float (`2.0`, `.5`, `1:30.0`, `.inf`). YAML keeps a float apart from an
// integer, and once it is a JavaScript number a whole one (`2.0`) cannot be told from `2`. So
// the reader holds it as a Float while it reads, and parseHeader hands it back as a plain
// number whose key (or index) it names in FLOATS on the mapping or list that holds it: a
// symbol, not enumerable, so nothing that reads the header as plain data sees it.
// writtenAsFloat reads it, for the check, which prints and weighs the value as Python does.
const FLOATS = Symbol("written as a float");

class Float {
  constructor(value) {
    this.value = value;
  }
}
// Plain text YAML 1.1 resolves to the merge and value tags, which no safe reader builds.
const NO_READER_TAGS = new Set(["<<", "="]);
// YAML 1.1's timestamp: a date alone takes two-digit month and day; a date with a time may
// write them with one digit. The time takes an optional fraction and an optional zone.
const TIMESTAMP = new RegExp(
  "^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}" +
    "|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt]|[ \\t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]*)?" +
    "(?:[ \\t]*(?:Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?)$",
);
const TIMESTAMP_PARTS = new RegExp(
  "^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})" +
    "(?:(?:[Tt]|[ \\t]+)([0-9]{1,2}):([0-9]{2}):([0-9]{2})(?:\\.[0-9]*)?" +
    "(?:[ \\t]*(?:Z|([-+])([0-9]{1,2})(?::([0-9]{2}))?))?)?$",
);

// Characters a plain scalar may not start with in YAML (they open something else).
const PLAIN_FORBIDDEN_START = new Set([..."[]{},#&*!|>'\"%@`"]);

function signOf(text) {
  return text.startsWith("-") ? -1 : 1;
}

function unsigned(text) {
  return text.replace(/^[-+]/, "").replace(/_/g, "");
}

function daysIn(year, month) {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// A timestamp's text, kept as written, once the calendar has it: year 1 onward, a real month
// and day, a time of day under 24:00:00, a zone under a day. Otherwise a HeaderError, where
// the oracle's YAML raises ValueError.
function checkTimestamp(text) {
  const [, y, mo, d, h, mi, s, sign, zh, zm] = TIMESTAMP_PARTS.exec(text);
  const [year, month, day] = [Number(y), Number(mo), Number(d)];
  let real = year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
  if (h !== undefined) real = real && Number(h) <= 23 && Number(mi) <= 59 && Number(s) <= 59;
  if (sign !== undefined) real = real && Number(zh) * 60 + Number(zm || 0) < 24 * 60;
  if (!real) throw new HeaderError(`a date or time no calendar has: ${text}`);
  return text;
}

// An integer, held only when a JavaScript number holds it exactly (the oracle's are exact).
function exactInteger(text, value) {
  if (Number.isNaN(value)) throw new HeaderError(`a number with no digit: ${text}`);
  if (!Number.isSafeInteger(value)) {
    throw new HeaderError(`an integer past 2^53, which this reader cannot hold exactly: ${text}`);
  }
  return value;
}

// A sexagesimal number's parts summed as the oracle's YAML sums them, last part first.
function sexagesimal(text, read) {
  let total = 0;
  let base = 1;
  for (const part of unsigned(text).split(":").reverse()) {
    total += read(part) * base;
    base *= 60;
  }
  return signOf(text) * total;
}

// Resolves a plain scalar's text to the value YAML 1.1 gives it.
function resolvePlain(text) {
  const value = resolveTagged(text);
  return value instanceof Float ? value.value : value;
}

// As resolvePlain, with a float held as a Float until parseHeader settles the header.
function resolveTagged(text) {
  if (NO_READER_TAGS.has(text)) {
    throw new HeaderError(`plain text YAML reads as a tag no reader builds: ${text}`);
  }
  if (NULLS.has(text)) return null;
  if (TRUES.has(text)) return true;
  if (FALSES.has(text)) return false;
  const digits = unsigned(text);
  if (INT_DECIMAL.test(text)) return exactInteger(text, signOf(text) * Number(digits));
  if (INT_BINARY.test(text)) return exactInteger(text, signOf(text) * parseInt(digits.slice(2), 2));
  if (INT_HEX.test(text)) return exactInteger(text, signOf(text) * parseInt(digits.slice(2), 16));
  if (INT_OCTAL.test(text)) return exactInteger(text, signOf(text) * parseInt(digits, 8));
  if (INT_SEXAGESIMAL.test(text)) return exactInteger(text, sexagesimal(text, Number));
  if (FLOAT_SEXAGESIMAL.test(text)) return new Float(sexagesimal(text, Number));
  if (FLOAT.test(text)) return new Float(Number(text.replace(/_/g, "")));
  if (FLOAT_SPECIAL.test(text)) {
    if (/nan/i.test(text)) return new Float(NaN);
    return new Float(text.startsWith("-") ? -Infinity : Infinity);
  }
  if (TIMESTAMP.test(text)) return checkTimestamp(text);
  return text;
}

// A cursor over one line's value text.
class Cursor {
  constructor(text) {
    this.text = text;
    this.at = 0;
  }

  peek() {
    return this.text[this.at];
  }

  done() {
    return this.at >= this.text.length;
  }

  // Blanks are spaces: a tab is left for the value's reader to refuse.
  skipBlanks() {
    while (this.peek() === " ") this.at += 1;
  }

  // After a value: only spaces, or spaces and a comment, may follow.
  expectEnd() {
    const rest = this.text.slice(this.at);
    if (/^ *$/.test(rest) || /^ +#/.test(rest)) return;
    throw new HeaderError(`text after the value: ${JSON.stringify(rest.replace(/^ +| +$/g, ""))}`);
  }
}

const ESCAPES = { '"': '"', "\\": "\\", "/": "/", n: "\n", t: "\t", r: "\r", "0": "\0", " ": " " };

function readDoubleQuoted(cur) {
  cur.at += 1;
  let out = "";
  while (!cur.done()) {
    const ch = cur.peek();
    if (ch === '"') {
      cur.at += 1;
      return out;
    }
    if (ch === "\\") {
      const next = cur.text[cur.at + 1];
      if (next in ESCAPES) {
        out += ESCAPES[next];
        cur.at += 2;
        continue;
      }
      const width = { x: 2, u: 4, U: 8 }[next];
      const hex = width && cur.text.slice(cur.at + 2, cur.at + 2 + width);
      if (!width || !/^[0-9a-fA-F]+$/.test(hex) || hex.length !== width) {
        throw new HeaderError(`an escape this reader does not read: \\${next ?? ""}`);
      }
      const code = parseInt(hex, 16);
      if (code > 0x10ffff) throw new HeaderError(`an escape past the last character there is: \\${next}${hex}`);
      out += String.fromCodePoint(code);
      cur.at += 2 + width;
      continue;
    }
    out += ch;
    cur.at += 1;
  }
  throw new HeaderError("a double-quoted value that does not close on its line");
}

function readSingleQuoted(cur) {
  cur.at += 1;
  let out = "";
  while (!cur.done()) {
    const ch = cur.peek();
    if (ch === "'") {
      if (cur.text[cur.at + 1] === "'") {
        out += "'";
        cur.at += 2;
        continue;
      }
      cur.at += 1;
      return out;
    }
    out += ch;
    cur.at += 1;
  }
  throw new HeaderError("a single-quoted value that does not close on its line");
}

function checkPlain(text) {
  if (text === "") return;
  if (text.includes("\t")) throw new HeaderError(`a tab inside a value: ${JSON.stringify(text)}`);
  const first = text[0];
  if (PLAIN_FORBIDDEN_START.has(first)) {
    throw new HeaderError(`a value starting with ${JSON.stringify(first)}, which this reader does not read`);
  }
  if ("-?:".includes(first) && (text.length === 1 || text[1] === " " || text[1] === "\t")) {
    throw new HeaderError(`a value starting with ${JSON.stringify(`${first} `)}`);
  }
  if (/:(?:[ \t]|$)/.test(text)) {
    throw new HeaderError(`a colon and a blank inside a plain value: ${JSON.stringify(text)}`);
  }
}

// A plain scalar inside a flow list or a flow mapping (`where` names which): it ends at a
// comma or a closing bracket or brace.
function readFlowPlain(cur, where = "a flow list") {
  const start = cur.at;
  while (!cur.done() && !",[]{}".includes(cur.peek())) {
    if (cur.peek() === "#" && /[ \t]/.test(cur.text[cur.at - 1] || "")) {
      throw new HeaderError(`a comment inside ${where}`);
    }
    cur.at += 1;
  }
  const text = cur.text.slice(start, cur.at).replace(/^ +| +$/g, "");
  if (text === "") throw new HeaderError(`an empty item in ${where}`);
  // Inside a flow collection YAML reads `?` anywhere, and `:` first, as a mapping's key or value.
  if (text.includes("?") || text.startsWith(":")) {
    throw new HeaderError(`a ? or a leading : inside ${where}, which YAML reads as a mapping: ${JSON.stringify(text)}`);
  }
  checkPlain(text);
  return resolveTagged(text);
}

// A flow mapping's key, read in place: a desk key, as a block line's key is.
const FLOW_KEY = /[A-Za-z_][A-Za-z0-9_.-]*/y;

// A one-line flow mapping of scalars, `{key: value, key: value}` or `{}`: each key a desk key
// followed by `:` and a blank (or by `,` or `}` for an empty value), each value plain, quoted
// or empty. A flow list or a flow mapping inside one is outside the subset.
function readFlowMapping(cur) {
  cur.at += 1;
  const map = {};
  for (;;) {
    cur.skipBlanks();
    if (cur.done()) throw new HeaderError("a flow mapping that does not close on its line");
    if (cur.peek() === "}") {
      cur.at += 1;
      return map;
    }
    FLOW_KEY.lastIndex = cur.at;
    const key = FLOW_KEY.exec(cur.text);
    const after = key ? cur.text[FLOW_KEY.lastIndex + 1] : undefined;
    if (!key || cur.text[FLOW_KEY.lastIndex] !== ":" || after === undefined || !" ,}".includes(after)) {
      throw new HeaderError(
        `a flow mapping entry that is not \`key: value\` with a desk key: ${JSON.stringify(cur.text.slice(cur.at))}`,
      );
    }
    checkKey(key[0]);
    cur.at = FLOW_KEY.lastIndex + 1;
    cur.skipBlanks();
    const ch = cur.peek();
    let value;
    if (ch === "," || ch === "}") value = null;
    else if (ch === "[" || ch === "{") {
      throw new HeaderError("a flow list or flow mapping inside a flow mapping, which this reader does not read");
    } else if (ch === '"') value = readDoubleQuoted(cur);
    else if (ch === "'") value = readSingleQuoted(cur);
    else value = readFlowPlain(cur, "a flow mapping");
    map[key[0]] = value;
    cur.skipBlanks();
    if (cur.peek() === ",") {
      cur.at += 1;
      continue;
    }
    if (cur.peek() === "}") {
      cur.at += 1;
      return map;
    }
    throw new HeaderError("a flow mapping that does not close on its line");
  }
}

function readFlowList(cur) {
  cur.at += 1;
  const items = [];
  for (;;) {
    cur.skipBlanks();
    if (cur.done()) throw new HeaderError("a flow list that does not close on its line");
    if (cur.peek() === "]") {
      cur.at += 1;
      return items;
    }
    items.push(readFlowItem(cur));
    cur.skipBlanks();
    if (cur.peek() === ",") {
      cur.at += 1;
      continue;
    }
    if (cur.peek() === "]") {
      cur.at += 1;
      return items;
    }
    throw new HeaderError("a flow list that does not close on its line");
  }
}

function readFlowItem(cur) {
  const ch = cur.peek();
  if (ch === "[") return readFlowList(cur);
  if (ch === "{") return readFlowMapping(cur);
  if (ch === '"') return readDoubleQuoted(cur);
  if (ch === "'") return readSingleQuoted(cur);
  return readFlowPlain(cur);
}

// One value on one line, after `key: ` or `- `.
function readValue(text) {
  const cur = new Cursor(text);
  cur.skipBlanks();
  const ch = cur.peek();
  let value;
  if (ch === undefined || ch === "#") return null;
  if (ch === "[") value = readFlowList(cur);
  else if (ch === "{") value = readFlowMapping(cur);
  else if (ch === '"') value = readDoubleQuoted(cur);
  else if (ch === "'") value = readSingleQuoted(cur);
  else if (ch === "|" || ch === ">") throw new HeaderError("a block scalar (| or >), which this reader does not read");
  else if (ch === "&" || ch === "*") throw new HeaderError("an anchor or alias, which this reader does not read");
  else if (ch === "!") throw new HeaderError("a tag, which this reader does not read");
  else {
    const plain = text.slice(cur.at).replace(/ +#.*$/, "").replace(/ +$/, "");
    checkPlain(plain);
    return resolveTagged(plain);
  }
  cur.expectEnd();
  return value;
}

function isBlank(line) {
  return /^ *$/.test(line);
}

function isComment(line) {
  return /^ *#/.test(line);
}

// A header that is a list: every line a one-line list item, all at the first item's indent.
// Each item is read, so a value YAML cannot read still throws; an item may be a one-line
// `key: value`, as YAML reads a list of mappings.
function checkList(lines) {
  let indent = null;
  for (const line of lines) {
    if (isBlank(line) || isComment(line)) continue;
    const item = ITEM_LINE.exec(line);
    if (!item) throw new HeaderError(`a line after a list item that is not one: ${JSON.stringify(line)}`);
    if (indent === null) indent = item[1].length;
    else if (item[1].length !== indent) {
      throw new HeaderError("a list item at another indent than the list's first (a list in a list, or an item over several lines)");
    }
    const text = item[2];
    if (text === undefined) continue;
    const pair = KEY_LINE.exec(text);
    if (!pair) readValue(text);
    else if (pair[2] !== undefined) readValue(pair[2]);
  }
}

// A header that is one scalar: a quoted or flow value on one line, or a plain value that may
// run over several lines. A comment ends it, and so does a colon and a blank, which would make
// it a key YAML cannot read.
function checkScalar(lines) {
  let count = 0;
  let ended = false;
  let single = null;
  for (const line of lines) {
    if (isBlank(line)) continue;
    if (isComment(line)) {
      ended = count > 0;
      continue;
    }
    if (ended) throw new HeaderError(`text after the value has ended: ${JSON.stringify(line)}`);
    count += 1;
    const trimmed = line.replace(/^ +| +$/g, "");
    if (count === 1 && /^["'[{]/.test(trimmed)) {
      readValue(trimmed);
      ended = true;
      continue;
    }
    const plain = trimmed.replace(/ +#.*$/, "");
    ended = plain !== trimmed;
    if (count === 1) {
      checkPlain(plain);
      single = plain;
    } else {
      single = null;
      if (plain.includes("\t")) throw new HeaderError(`a tab inside a value: ${JSON.stringify(plain)}`);
      if (/:(?:[ \t]|$)/.test(plain)) {
        throw new HeaderError(`a colon and a blank inside a value: ${JSON.stringify(plain)}`);
      }
    }
  }
  if (single !== null) resolvePlain(single);
}

// Refuses a key this reader does not set: one YAML reads as other than text, and the one key a
// plain object reads as its parent.
function checkKey(key) {
  if (resolvePlain(key) !== key) {
    throw new HeaderError(`a key YAML reads as something other than text: ${key}`);
  }
  // Set on a plain object, this key would swap the object's parent and drop the key.
  if (key === "__proto__") throw new HeaderError(`the key ${key}, which this reader does not read`);
}

// Sets one `key: value` (a KEY_LINE match) on `target`. Returns whether the value was empty,
// which is what lets a block list follow the key.
function setKey(target, pair) {
  const key = pair[1];
  checkKey(key);
  const rest = pair[2];
  const empty = rest === undefined || rest === "" || rest.startsWith("#");
  target[key] = empty ? null : readValue(rest);
  return empty;
}

function indentOf(line) {
  return line.length - line.replace(/^ +/, "").length;
}

// The index of the first line from `at` that is not blank or a comment, or -1.
function nextContent(lines, at) {
  for (let i = at; i < lines.length; i += 1) {
    if (!isBlank(lines[i]) && !isComment(lines[i])) return i;
  }
  return -1;
}

const OTHER_INDENT =
  "a list item at another indent than the list's first (a list in a list, or an item over several lines)";

// Reads the block list whose `- item` lines start at `indent`, from lines[at], under a key at
// `keyColumn`. An item is one value, or the first key of a flat mapping whose further keys
// follow at that key's column, each on its line. The list ends at a line left of `indent`, or
// at a key line at `indent` when the list sits at its key's own column (YAML's list under a key
// with no indent). Returns the list and the index of the first line that is not its own.
function readList(lines, at, indent, keyColumn) {
  const items = [];
  let entry = null; // the open mapping item: { column, map }
  let i = at;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const lineIndent = indentOf(line);
    const item = ITEM_LINE.exec(line);
    if (item && lineIndent === indent) {
      entry = null;
      const text = item[2];
      const pair = text === undefined ? null : KEY_LINE.exec(text);
      if (text === undefined) items.push(null);
      else if (!pair) items.push(readValue(text));
      else {
        const map = {};
        setKey(map, pair);
        items.push(map);
        entry = { column: line.length - text.length, map };
      }
      continue;
    }
    const pair = entry && lineIndent === entry.column && KEY_LINE.exec(line.slice(lineIndent));
    if (pair) {
      setKey(entry.map, pair);
      continue;
    }
    if (lineIndent < indent || (lineIndent === indent && indent === keyColumn && !item)) break;
    if (item) throw new HeaderError(OTHER_INDENT);
    throw new HeaderError(
      "an indented line that is not a list item or a key under one (a mapping inside a list item, or a value over several lines)",
    );
  }
  return [items, i];
}

// Reads the block mapping whose keys start at `column`, from lines[at]; `depth` is how far it
// sits under the top (0 the header itself). A key with no value heads what the next line
// opens: `- item` lines at the key's column or further in, or a mapping further in, up to
// MAX_NESTING. Returns the mapping and the index of the first line left of `column`.
function readMapping(lines, at, column, depth) {
  const map = {};
  let i = at;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) {
      i += 1;
      continue;
    }
    const lineIndent = indentOf(line);
    if (lineIndent < column) break;
    if (lineIndent > column) {
      throw new HeaderError(
        "an indented line that is not a list item or a key under one (a key off its mapping's column, or a value over several lines)",
      );
    }
    const text = line.slice(column);
    if (ITEM_LINE.test(text)) throw new HeaderError("a list item with no key above it");
    const pair = KEY_LINE.exec(text);
    if (!pair) {
      const what = text.includes("\t") ? "a tab where a desk header uses spaces" : "a line that is not `key: value`";
      throw new HeaderError(`${what}: ${JSON.stringify(line)}`);
    }
    i += 1;
    if (!setKey(map, pair)) continue;
    const next = nextContent(lines, i);
    if (next === -1) continue;
    const nextIndent = indentOf(lines[next]);
    if (ITEM_LINE.test(lines[next]) && nextIndent >= column) {
      [map[pair[1]], i] = readList(lines, next, nextIndent, column);
    } else if (nextIndent > column) {
      if (depth >= MAX_NESTING) {
        throw new HeaderError(`a mapping nested more than ${MAX_NESTING} levels under the top of the header`);
      }
      [map[pair[1]], i] = readMapping(lines, next, nextIndent, depth + 1);
    }
  }
  return [map, i];
}

// A header that is one flow mapping on its line, as `{}`: YAML reads the header as that
// mapping. Only blank lines and comments may follow it.
function readFlowHeader(lines, first) {
  const value = readValue(first.replace(/^ +/, ""));
  const rest = lines.slice(lines.indexOf(first) + 1).find((line) => !isBlank(line) && !isComment(line));
  if (rest !== undefined) throw new HeaderError(`text after the value has ended: ${JSON.stringify(rest)}`);
  return value;
}

// Parses a header's text (the lines between the two `---` lines). Returns a plain object, or
// null when YAML reads the header as something other than a mapping: nothing (blank lines and
// comments), a bare scalar, a list. The oracle reads each of those as no header.
function parseHeader(text) {
  const outside = OUTSIDE_CHARACTER.exec(text);
  if (outside) {
    const code = outside[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    throw new HeaderError(`a character a desk header does not hold: U+${code}`);
  }
  const lines = text.split("\n").map((raw) => raw.replace(/\r$/, ""));
  for (const line of lines) {
    if (/^ *\t/.test(line)) throw new HeaderError("a tab at the start of a line; a desk header uses spaces");
    if (/^(?:---|\.\.\.)(?:[ \t]|$)/.test(line)) {
      throw new HeaderError("a document marker (--- or ...) inside the header");
    }
  }
  const first = lines.find((line) => !isBlank(line) && !isComment(line));
  if (first === undefined) return null;
  if (/^ *\{/.test(first)) return settle(readFlowHeader(lines, first));
  if (ITEM_LINE.test(first)) {
    checkList(lines);
    return null;
  }
  if (!KEY_LINE.test(first)) {
    checkScalar(lines);
    return null;
  }
  // The first line is a key at column 0, so the top mapping holds every line.
  return settle(readMapping(lines, 0, 0, 0)[0]);
}

// Turns each Float the reader held into a plain number, named in FLOATS on its holder.
function settle(value) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      value[i] = settled(value, i, item);
    });
  } else if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = settled(value, key, value[key]);
  }
  return value;
}

function settled(holder, key, value) {
  if (!(value instanceof Float)) return settle(value);
  if (!Object.hasOwn(holder, FLOATS)) Object.defineProperty(holder, FLOATS, { value: new Set() });
  holder[FLOATS].add(key);
  return value.value;
}

// Whether the value at `key` (a mapping's key, or a list's index) of a mapping or list that
// parseHeader returned was written as a float.
function writtenAsFloat(holder, key) {
  return holder !== null && typeof holder === "object" && Object.hasOwn(holder, FLOATS) && holder[FLOATS].has(key);
}

module.exports = { parseHeader, HeaderError, HEADER_SUBSET, resolvePlain, writtenAsFloat };
