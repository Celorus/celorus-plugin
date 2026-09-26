"use strict";
// Header lines written the way the desk's first writer, PyYAML 6 in the plugin's Python oracles,
// wrote them, so a page the engine writes reads line for line as the page the oracle wrote. Only
// the shapes the desk tools write are covered: a mapping of details, lists and mappings of plain
// values, text, whole numbers, floats, true and false, null, and a date or a moment the header
// held as one. Nothing is folded at a width: the oracles wrote with a width of 1000, and no
// value the tools write comes near it.
//
// A value is plain data from lib/header.js, with two marks the header reader does not keep on
// its own: a float is a PyFloat (check/values.js asPython), and a date or a moment the header
// wrote unquoted is a Moment (markMoments below), since the reader hands both back as the text
// written and YAML writes a date bare where it quotes the same text.

const { PyFloat, isMapping, compareText } = require("../check/values.js");

// A date or a moment the header wrote as one, kept as its parts so it is written as Python
// writes the value YAML built from it: `2026-09-03`, or `2026-09-03T10:00:00+05:30`.
class Moment {
  constructor(text) {
    this.text = text;
  }
}

// YAML 1.1's implicit types, as PyYAML's resolver matches them, first character and all. A text
// that would read back as one of these is not plain text, so it is quoted. `$` in Python's
// pattern also matches before one final line end.
const RESOLVERS = [
  [/^[yYnNtTfFoO]/u, /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)\n?$/u],
  [
    /^[-+0-9.]/u,
    /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))\n?$/u,
  ],
  [
    /^[-+0-9]/u,
    /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)\n?$/u,
  ],
  [/^</u, /^(?:<<)\n?$/u],
  [/^(?:[~nN]|$)/u, /^(?:~|null|Null|NULL|)\n?$/u],
  [
    /^[0-9]/u,
    /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)\n?$/u,
  ],
  [/^=/u, /^(?:=)\n?$/u],
];

// Whether YAML reads this text back as text when it is written bare.
function readsAsText(text) {
  return !RESOLVERS.some(([first, whole]) => first.test(text) && whole.test(text));
}

// The timestamp pattern alone, for markMoments.
const TIMESTAMP = RESOLVERS[5][1];

const BREAKS = "\n\u0085  ";
const SPACE_OR_END = "\0 \t\r\n\u0085  ";

// PyYAML's analyze_scalar: which styles a text may be written in.
function analyze(text) {
  const chars = Array.from(text);
  if (!chars.length) {
    return { empty: true, multiline: false, flowPlain: false, blockPlain: true, single: true };
  }
  let blockIndicators = false;
  let flowIndicators = false;
  let lineBreaks = false;
  let special = false;
  let leadingSpace = false;
  let leadingBreak = false;
  let trailingSpace = false;
  let trailingBreak = false;
  let breakSpace = false;
  let spaceBreak = false;
  if (text.startsWith("---") || text.startsWith("...")) {
    blockIndicators = true;
    flowIndicators = true;
  }
  let precededBySpace = true;
  let followedBySpace = chars.length === 1 || SPACE_OR_END.includes(chars[1]);
  let previousSpace = false;
  let previousBreak = false;
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (i === 0) {
      if ("#,[]{}&*!|>'\"%@`".includes(ch)) {
        flowIndicators = true;
        blockIndicators = true;
      }
      if (ch === "?" || ch === ":") {
        flowIndicators = true;
        if (followedBySpace) blockIndicators = true;
      }
      if (ch === "-" && followedBySpace) {
        flowIndicators = true;
        blockIndicators = true;
      }
    } else {
      if (",?[]{}".includes(ch)) flowIndicators = true;
      if (ch === ":") {
        flowIndicators = true;
        if (followedBySpace) blockIndicators = true;
      }
      if (ch === "#" && precededBySpace) {
        flowIndicators = true;
        blockIndicators = true;
      }
    }
    if (BREAKS.includes(ch)) lineBreaks = true;
    const code = ch.codePointAt(0);
    if (!(ch === "\n" || (code >= 0x20 && code <= 0x7e))) {
      const printable =
        (code === 0x85 || (code >= 0xa0 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code < 0x10ffff)) &&
        code !== 0xfeff;
      if (!printable) special = true;
    }
    if (ch === " ") {
      if (i === 0) leadingSpace = true;
      if (i === chars.length - 1) trailingSpace = true;
      if (previousBreak) breakSpace = true;
      previousSpace = true;
      previousBreak = false;
    } else if (BREAKS.includes(ch)) {
      if (i === 0) leadingBreak = true;
      if (i === chars.length - 1) trailingBreak = true;
      if (previousSpace) spaceBreak = true;
      previousSpace = false;
      previousBreak = true;
    } else {
      previousSpace = false;
      previousBreak = false;
    }
    precededBySpace = SPACE_OR_END.includes(ch);
    followedBySpace = i + 2 >= chars.length || SPACE_OR_END.includes(chars[i + 2]);
  }
  let flowPlain = true;
  let blockPlain = true;
  let single = true;
  if (leadingSpace || leadingBreak || trailingSpace || trailingBreak) {
    flowPlain = false;
    blockPlain = false;
  }
  if (breakSpace) {
    flowPlain = false;
    blockPlain = false;
    single = false;
  }
  if (spaceBreak || special) {
    flowPlain = false;
    blockPlain = false;
    single = false;
  }
  if (lineBreaks) {
    flowPlain = false;
    blockPlain = false;
  }
  if (flowIndicators) flowPlain = false;
  if (blockIndicators) blockPlain = false;
  return { empty: false, multiline: lineBreaks, flowPlain, blockPlain, single };
}

// PyYAML's single-quoted writer, for a text with no line break in it (the desk's are one line);
// a line break is written as YAML folds it back, a blank line per break.
function singleQuoted(text, indent) {
  let out = "'";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === "'") out += "''";
    else if (BREAKS.includes(ch)) {
      let run = "";
      while (i < chars.length && BREAKS.includes(chars[i])) {
        run += chars[i];
        i += 1;
      }
      i -= 1;
      if (run[0] === "\n") out += "\n";
      for (const br of run) out += br === "\n" ? "\n" : br;
      out += " ".repeat(indent);
    } else out += ch;
  }
  return `${out}'`;
}

const ESCAPES = {
  "\0": "0",
  "\u0007": "a",
  "\b": "b",
  "\t": "t",
  "\n": "n",
  "\u000b": "v",
  "\f": "f",
  "\r": "r",
  "\u001b": "e",
  '"': '"',
  "\\": "\\",
  "\u0085": "N",
  " ": "_",
  " ": "L",
  " ": "P",
};

function doubleQuoted(text) {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const plain =
      !'"\\\u0085  ﻿'.includes(ch) &&
      ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd));
    if (plain) out += ch;
    else if (Object.hasOwn(ESCAPES, ch)) out += `\\${ESCAPES[ch]}`;
    else if (code <= 0xff) out += `\\x${code.toString(16).toUpperCase().padStart(2, "0")}`;
    else if (code <= 0xffff) out += `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
    else out += `\\U${code.toString(16).toUpperCase().padStart(8, "0")}`;
  }
  return `${out}"`;
}

// A text as PyYAML writes it: bare where it may be and reads back as text, else single-quoted,
// else double-quoted. `flow` is true inside a flow list or mapping; `key` for a mapping's key.
function textScalar(text, { flow = false, key = false, indent = 2 } = {}) {
  const a = analyze(text);
  if (readsAsText(text) && !(key && (a.empty || a.multiline)) && (flow ? a.flowPlain : a.blockPlain)) return text;
  if (a.single && !(key && a.multiline)) return singleQuoted(text, indent);
  return doubleQuoted(text);
}

// A float as PyYAML's representer writes it: Python's repr, lower case, `.0` before an exponent
// that has no point, and YAML's own words for the infinities and not-a-number.
function floatText(value) {
  if (Number.isNaN(value)) return ".nan";
  if (value === Infinity) return ".inf";
  if (value === -Infinity) return "-.inf";
  let text;
  if (Number.isInteger(value) && Math.abs(value) < 1e16) text = `${Object.is(value, -0) ? "-0" : String(value)}.0`;
  else {
    const exp = Math.floor(Math.log10(Math.abs(value)));
    if (exp < -4 || exp >= 16) {
      const [mantissa, power] = value.toExponential().split("e");
      const sign = power.startsWith("-") ? "-" : "+";
      text = `${mantissa}e${sign}${power.replace(/^[-+]/, "").padStart(2, "0")}`;
    } else text = String(value);
  }
  text = text.toLowerCase();
  if (!text.includes(".") && text.includes("e")) text = text.replace("e", ".0e");
  return text;
}

// The parts of a timestamp YAML reads, written back as Python's isoformat writes the date or
// datetime it built: two-digit fields, six-digit microseconds where there are any, the offset as
// +HH:MM, a `Z` as +00:00. `sep` is what goes between the date and the time.
const MOMENT_PARTS =
  /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:[Tt]|[ \t]+)([0-9]{1,2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]*))?(?:[ \t]*(Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?)?$/u;

function momentText(text, sep) {
  const m = MOMENT_PARTS.exec(text.replace(/\n$/u, ""));
  if (!m) return text;
  const two = (n) => String(Number(n)).padStart(2, "0");
  const date = `${m[1]}-${two(m[2])}-${two(m[3])}`;
  if (m[4] === undefined) return date;
  let time = `${two(m[4])}:${m[5]}:${m[6]}`;
  if (m[7] !== undefined && m[7] !== "" && Number(m[7].slice(0, 6).padEnd(6, "0")) !== 0) {
    time += `.${m[7].slice(0, 6).padEnd(6, "0")}`;
  }
  let zone = "";
  if (m[8] === "Z") zone = "+00:00";
  else if (m[8] !== undefined) {
    const [hours, minutes = "00"] = m[8].slice(1).split(":");
    const total = Number(hours) * 60 + Number(minutes);
    zone = total === 0 ? "+00:00" : `${m[8][0]}${two(hours)}:${minutes}`;
  }
  return `${date}${sep}${time}${zone}`;
}

function isCollection(value) {
  return Array.isArray(value) || (isMapping(value) && !(value instanceof Moment));
}

// A scalar as PyYAML writes it, with the options of the dump it is part of.
function scalar(value, opts, ctx = {}) {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (value instanceof PyFloat) return floatText(value.value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : floatText(value);
  if (value instanceof Moment) return momentText(value.text, opts.momentSep);
  return textScalar(String(value), ctx);
}

function keysOf(map, opts) {
  const keys = Object.keys(map);
  return opts.sortKeys ? keys.sort(compareText) : keys;
}

// A collection written on one line, `[a, b]` or `{a: 1}`. `indent` is where a text's second line
// would start, were it to hold a line break: two further in at each level of brackets.
function flowText(value, opts, indent = 2) {
  const inner = (item) =>
    isCollection(item) ? flowText(item, opts, indent + 2) : scalar(item, opts, { flow: true, indent });
  if (Array.isArray(value)) {
    return `[${value.map(inner).join(", ")}]`;
  }
  const parts = keysOf(value, opts).map((key) => {
    const item = value[key];
    const text = inner(item);
    return `${textScalar(key, { flow: true, key: true })}: ${text}`;
  });
  return `{${parts.join(", ")}}`;
}

// Whether a collection is written on one line: always when empty; with `flow` true always and
// with false never; with null (PyYAML's "best style"), when it holds no collection.
function isFlow(value, opts) {
  const items = Array.isArray(value) ? value : Object.values(value);
  if (!items.length) return true;
  if (opts.flow === true) return true;
  if (opts.flow === false) return false;
  return !items.some(isCollection);
}

// The lines of a block collection at `indent` spaces.
function blockLines(value, indent, opts) {
  const pad = " ".repeat(indent);
  const out = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isCollection(item) && !isFlow(item, opts)) {
        const inner = blockLines(item, indent + 2, opts);
        out.push(`${pad}- ${inner[0].slice(indent + 2)}`, ...inner.slice(1));
      } else {
        out.push(`${pad}- ${isCollection(item) ? flowText(item, opts, indent + 4) : scalar(item, opts, { indent: indent + 2 })}`);
      }
    }
    return out;
  }
  for (const key of keysOf(value, opts)) {
    const item = value[key];
    const name = textScalar(key, { key: true });
    if (isCollection(item) && !isFlow(item, opts)) {
      out.push(`${pad}${name}:`);
      // A list under a key sits at the key's own column, as PyYAML writes it.
      out.push(...blockLines(item, Array.isArray(item) ? indent : indent + 2, opts));
    } else {
      out.push(`${pad}${name}: ${isCollection(item) ? flowText(item, opts, indent + 4) : scalar(item, opts, { indent: indent + 2 })}`);
    }
  }
  return out;
}

// A mapping's lines, as `yaml.dump(mapping, ...)` writes them. Options: `sortKeys` (PyYAML's
// sort_keys), `flow` (its default_flow_style: false, null or true) and `momentSep`, "T" as the
// oracles' own dumper writes a moment, " " as PyYAML's safe dumper does.
function dumpLines(mapping, { sortKeys = false, flow = false, momentSep = "T" } = {}) {
  return blockLines(mapping, 0, { sortKeys, flow, momentSep });
}

// One value on one line, as `yaml.dump(value, default_flow_style=True)` writes it before the
// document's end: the oracles write a value the two pages disagree on this way.
function oneLine(value, { momentSep = "T" } = {}) {
  const opts = { sortKeys: true, flow: true, momentSep };
  return isCollection(value) ? flowText(value, opts) : scalar(value, opts);
}

// A header value with every date or moment the header wrote bare marked as a Moment: a text in
// the value that YAML reads as a timestamp, found in the header's own lines for that key standing
// as a plain value, with no quote mark against it. `raw` is those lines.
function markMoments(value, raw) {
  if (typeof value === "string") {
    if (!(TIMESTAMP.test(value) && /^[0-9]/u.test(value))) return value;
    let at = raw.indexOf(value);
    while (at !== -1) {
      // Bare where a plain value starts and ends: at a line's start or end, or against a blank
      // or the punctuation that opens and closes a value, never inside a longer word or a path.
      const before = at === 0 ? "\n" : raw[at - 1];
      const after = at + value.length === raw.length ? "\n" : raw[at + value.length];
      if (" \t\n[{,".includes(before) && " \t\n,]}#".includes(after)) return new Moment(value);
      at = raw.indexOf(value, at + 1);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => markMoments(item, raw));
  if (isMapping(value) && !(value instanceof Moment)) {
    const out = {};
    for (const key of Object.keys(value)) out[key] = markMoments(value[key], raw);
    return out;
  }
  return value;
}

// Python's == over two header values as the oracles compare them, a Moment by its moment.
function sameValue(a, b) {
  if (a instanceof Moment || b instanceof Moment) {
    return a instanceof Moment && b instanceof Moment && momentText(a.text, "T") === momentText(b.text, "T");
  }
  const num = (v) => (typeof v === "boolean" ? Number(v) : v instanceof PyFloat ? v.value : v);
  const numeric = (v) => typeof v === "number" || typeof v === "boolean" || v instanceof PyFloat;
  if (numeric(a) && numeric(b)) return num(a) === num(b);
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (isMapping(a) && isMapping(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]));
  }
  return false;
}

module.exports = {
  Moment,
  isCollection,
  readsAsText,
  textScalar,
  floatText,
  momentText,
  scalar,
  dumpLines,
  oneLine,
  markMoments,
  sameValue,
};
