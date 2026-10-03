"use strict";
// The two pages the soul lives on (DESK-156), as the engine writes them: celorus/soul.md, which
// every desk set up from this release carries (the install-desk scaffold writes it), and
// celorus/manner/<seat>-manner.md, a seat's own manner, which only the feedback door writes (F4;
// the file name, the base's ruling F3, is lib/persona.js mannerRel, the reader's own).
//
// soul.md is a header, the desk-wide manner (empty at set-up), and a written copy of the shipped
// soul, byte for byte, for people to read. The copy is never read as the soul (F7): lib/persona.js
// answers the shipped text always, and the check names a copy that differs (rule C18).
//
// A header value is written so it reads back as the same value: an unset one as `key:` alone, a
// plain word as itself, anything else quoted. Every page this file makes is read back through the
// header reader before it is written, and refused when it would not read as it was meant.

const { splitPage } = require("../lib/desk.js");
const { parseHeader, HeaderError } = require("../lib/header.js");
const { MANNER_KEYS, SOUL_PAGE, mannerRel } = require("../lib/persona.js");
const { shippedSoul } = require("./default.js");

// The keys that keep the values before the last change, one level, for undo.
const PREVIOUS = Object.freeze(Object.fromEntries(MANNER_KEYS.map((key) => [key, `previous_${key}`])));

const PLAIN = /^[A-Za-z][A-Za-z0-9 _.'-]*$/u;
const RESERVED = new Set(["yes", "no", "true", "false", "null", "on", "off", "y", "n", "~"]);

// One header line.
function headerLine(key, value) {
  if (value === null || value === undefined) return `${key}:`;
  const text = String(value);
  const plain = PLAIN.test(text) && text === text.trim() && !RESERVED.has(text.toLowerCase());
  return `${key}: ${plain ? text : JSON.stringify(text)}`;
}

// Whether two headers are the same value, whatever order their keys were written in.
function sameHead(a, b) {
  const settle = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value)
          .sort()
          .map((key) => [key, settle(value[key])])
      : value;
  return JSON.stringify(settle(a)) === JSON.stringify(settle(b));
}

// The header text read as a mapping, or null when it does not read as one.
function mappingOf(header) {
  let head;
  try {
    head = parseHeader(header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    return null;
  }
  return head !== null && typeof head === "object" && !Array.isArray(head) ? head : null;
}

// A page from its header fields, in order, and its body; or { refused } when the header would not
// read back as those fields.
function pageOf(rel, fields, body) {
  const header = Object.entries(fields).map(([key, value]) => headerLine(key, value)).join("\n");
  const head = mappingOf(header);
  const meant = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value === undefined ? null : value]));
  if (head === null || !sameHead(head, meant)) return { refused: `${rel} would not read back as it was meant, so nothing was changed.` };
  return { text: `---\n${header}\n---\n${body}` };
}

// celorus/soul.md as the set-up writes it: the header, with the desk-wide manner empty, and the
// shipped soul, byte for byte, as its body. `generatedBy` is `celorus-plugin <version> <tool>`.
function soulCopy(generatedBy) {
  const fields = { type: "soul", title: "Soul" };
  for (const key of MANNER_KEYS) fields[key] = null;
  fields.generated_by = generatedBy;
  const page = pageOf(SOUL_PAGE, fields, shippedSoul());
  if (page.refused) throw new Error(page.refused);
  return page.text;
}

// A seat's manner page: its four values, the four before the last change, and its stamp; the
// desk's footer line under the body, when the desk asks for one.
function mannerPage(seat, values, previous, generatedBy, footer) {
  const fields = { type: "manner", title: `Manner for ${seat}`, for_seat: `[[${seat}]]` };
  for (const key of MANNER_KEYS) fields[key] = values[key];
  for (const key of MANNER_KEYS) fields[PREVIOUS[key]] = previous[key];
  fields.generated_by = generatedBy;
  const lines = [
    `# Manner for ${seat}`,
    "",
    "How the assistant speaks to this seat, set by the seat's own feedback. The values before the last change are kept for one undo.",
  ];
  if (footer !== null) lines.push("", footer);
  return pageOf(mannerRel(seat), fields, `${lines.join("\n")}\n`);
}

// `text` (soul.md) with each of `entries` ([key, value]) set in its header, the line replaced where
// it stands or added at the header's end, and every other byte as it was, the body among them; or
// { refused } saying why not.
function withHeaderValues(rel, text, entries) {
  const no = (why) => ({ refused: `${rel} ${why}, so nothing was changed.` });
  const split = splitPage(text);
  if (split === null) return no("has no header");
  const before = mappingOf(split.header);
  if (before === null) return no("has a header that does not read as keys and values");
  const lines = split.header.split("\n");
  for (const [key, value] of entries) {
    const at = new RegExp(`^${key}[ \\t]*:`, "u");
    const found = lines.flatMap((line, i) => (at.test(line) ? [i] : []));
    if (found.length > 1) return no(`names ${key} more than once`);
    if (found.length) lines[found[0]] = headerLine(key, value);
    else lines.push(headerLine(key, value));
  }
  const header = lines.join("\n");
  const after = mappingOf(header);
  if (after === null || !sameHead(after, { ...before, ...Object.fromEntries(entries) })) {
    return no("has a header whose manner lines are not one value on one line each");
  }
  return { text: `---\n${header}\n---\n${split.body}` };
}

module.exports = { PREVIOUS, soulCopy, mannerRel, mannerPage, withHeaderValues, mappingOf };
