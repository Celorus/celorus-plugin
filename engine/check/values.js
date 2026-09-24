"use strict";
// How the checker reads text and header values. The rules were first written in Python, and a
// finding's words and its page must come out the same here, so the few places where Python and
// JavaScript read text or values differently are spelled out once, in this file:
//   - a line ends at more characters than "\n" (splitLines);
//   - a blank is Unicode whitespace as Python counts it (BLANK_CLASS, isSpace, strip, splitWords);
//   - a value is printed and compared as Python prints and compares it (show, same, holds);
//   - text sorts by character, not by UTF-16 unit (compareText).
// A header value is plain data from lib/header.js: text, a number, true or false, null, a list,
// or a mapping. Its own keys are read with own(), never a name every object inherits. The
// check reads each header through asPython, which makes a value the header wrote as a float a
// PyFloat, so that `2.0` prints and weighs as Python's float does, never as the integer 2.

const { writtenAsFloat } = require("../lib/header.js");

// A number the header wrote as a float, as Python holds one: it prints as a float (`2.0`), it
// is no integer, and it equals the number it is (2.0 == 2).
class PyFloat {
  constructor(value) {
    this.value = value;
  }
}

// A header as the check reads it: every value the header wrote as a float a PyFloat, the rest
// as it was. The reader's own header is not changed.
function asPython(value) {
  const one = (holder, key, item) => (writtenAsFloat(holder, key) ? new PyFloat(item) : asPython(item));
  if (Array.isArray(value)) return value.map((item, i) => one(value, i, item));
  if (isMapping(value)) {
    const out = {};
    for (const key of Object.keys(value)) out[key] = one(value, key, value[key]);
    return out;
  }
  return value;
}

// Every character Python's str.isspace() calls whitespace, "\n" apart; BLANK_CLASS is it as a
// regular-expression class. Python's `[^\S\n]` is this class.
const BLANK_CHARS =
  "\t\u000b\u000c\r\u001c\u001d\u001e\u001f \u0085\u00a0\u1680" +
  "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a" +
  "\u2028\u2029\u202f\u205f\u3000";
const BLANK_CLASS = "[\\t\\u000b\\u000c\\r\\u001c-\\u001f \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
const SPACES = new Set([...BLANK_CHARS, "\n"]);

function isSpace(ch) {
  return SPACES.has(ch);
}

// The characters Python's str.splitlines() ends a line at; "\r\n" counts once.
const LINE_ENDS = new Set(["\n", "\r", "\u000b", "\u000c", "\u001c", "\u001d", "\u001e", "\u0085", "\u2028", "\u2029"]);

// A text's lines, as Python's str.splitlines() gives them: no line end kept, no empty line after
// a final line end, and nothing at all for "".
function splitLines(text) {
  const out = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (LINE_ENDS.has(ch)) {
      out.push(text.slice(start, i));
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      start = i;
    } else {
      i += 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

// Python's str.strip() with no argument.
function strip(text) {
  const chars = Array.from(text);
  let a = 0;
  let b = chars.length;
  while (a < b && isSpace(chars[a])) a += 1;
  while (b > a && isSpace(chars[b - 1])) b -= 1;
  return chars.slice(a, b).join("");
}

// Python's str.split() with no argument: the words between runs of whitespace.
function splitWords(text) {
  const out = [];
  let word = "";
  for (const ch of text) {
    if (isSpace(ch)) {
      if (word) out.push(word);
      word = "";
    } else {
      word += ch;
    }
  }
  if (word) out.push(word);
  return out;
}

// The first `n` characters of a text, counted as Python counts them (by character).
function head(text, n) {
  return Array.from(text).slice(0, n).join("");
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof PyFloat);
}

// A header's own value for `key`, or undefined: only a text key names anything in a header, and
// nothing is read that every object inherits (a header that never wrote `toString` has none).
function own(map, key) {
  return hasOwn(map, key) ? map[key] : undefined;
}

function hasOwn(map, key) {
  return isMapping(map) && typeof key === "string" && Object.hasOwn(map, key);
}

// Whether a value counts as true, as Python's `if value:` reads it.
function truthy(value) {
  if (value === null || value === undefined || value === false) return false;
  // Python reads a NaN as true and only zero as false.
  if (typeof value === "number") return value !== 0;
  if (value instanceof PyFloat) return value.value !== 0;
  if (typeof value === "string") return value !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (isMapping(value)) return Object.keys(value).length > 0;
  return true;
}

// A detail that says nothing, as `value in (None, "", [])` reads it.
function isEmpty(value) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

// A number as Python prints it: an integer, or with `float` a float, which keeps a `.0` when it
// is whole (2.0, -0.0) until it is long enough to print with an exponent (1e+16).
function showNumber(value, float = false) {
  if (Number.isNaN(value)) return "nan";
  if (value === Infinity) return "inf";
  if (value === -Infinity) return "-inf";
  if (Number.isInteger(value)) {
    if (!float) return String(value);
    if (Math.abs(value) < 1e16) return `${Object.is(value, -0) ? "-0" : String(value)}.0`;
  }
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp < -4 || exp >= 16) {
    const [mantissa, power] = value.toExponential().split("e");
    const sign = power.startsWith("-") ? "-" : "+";
    const digits = power.replace(/^[-+]/, "").padStart(2, "0");
    return `${mantissa}e${sign}${digits}`;
  }
  return String(value);
}

// A text as Python's repr() writes it.
function quote(text) {
  const q = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = q;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += `\\${q}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else if (code >= 0x80 && code <= 0xa0) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return out + q;
}

// A value as Python's repr() writes it, inside a printed list or mapping.
function repr(value) {
  if (typeof value === "string") return quote(value);
  return show(value);
}

// A value as Python's str() writes it, which is how a finding's message prints one.
function show(value) {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return showNumber(value);
  if (value instanceof PyFloat) return showNumber(value.value, true);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `[${value.map(repr).join(", ")}]`;
  if (isMapping(value)) {
    return `{${Object.keys(value).map((key) => `${quote(key)}: ${repr(value[key])}`).join(", ")}}`;
  }
  return String(value);
}

// Whether two values are equal as Python's == says: true is 1 and false is 0, a list equals a
// list item for item, a mapping a mapping key for key; text equals only text.
function same(a, b) {
  const num = (v) => (typeof v === "boolean" ? Number(v) : v instanceof PyFloat ? v.value : v);
  const numeric = (v) => typeof v === "number" || typeof v === "boolean" || v instanceof PyFloat;
  if (numeric(a) && numeric(b)) return num(a) === num(b);
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  if (isMapping(a) && isMapping(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => hasOwn(b, k) && same(a[k], b[k]));
  }
  return false;
}

// The items Python's list() takes from a value: a list's items, a text's characters, a
// mapping's keys; nothing from anything else (where Python would stop with an error).
function items(value) {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === "string") return Array.from(value);
  if (isMapping(value)) return Object.keys(value);
  return [];
}

// `value in container`, as Python reads it: an item of a list, a key of a mapping, a part of a
// text.
function holds(container, value) {
  if (Array.isArray(container)) return container.some((item) => same(item, value));
  if (typeof container === "string") return typeof value === "string" && container.includes(value);
  if (isMapping(container)) return typeof value === "string" && hasOwn(container, value);
  return false;
}

// Orders two texts character by character, as Python compares str.
function compareText(a, b) {
  if (a === b) return 0;
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    if (x[i] !== y[i]) return x[i].codePointAt(0) - y[i].codePointAt(0);
  }
  return x.length - y.length;
}

function sortedText(values) {
  return [...values].sort(compareText);
}

module.exports = {
  BLANK_CLASS,
  isSpace,
  splitLines,
  strip,
  splitWords,
  head,
  PyFloat,
  asPython,
  isMapping,
  own,
  hasOwn,
  truthy,
  isEmpty,
  show,
  same,
  items,
  holds,
  compareText,
  sortedText,
};
