"use strict";
// The checker's readers of a page's lines: links, proof lines, fenced blocks, headings and the
// sections under them, and the contact-detail patterns. One reader per question, asked here and
// nowhere else, so the rules cannot read one line two ways.

const {
  BLANK_CLASS: B,
  splitLines,
  strip,
  isMapping,
  show,
} = require("./values.js");

// A desk link, `[[name]]`, `[[name|label]]` or `[[name#part]]`; the name is group 1.
const LINK_SOURCE = "\\[\\[([^\\]|#]+)(?:[|#][^\\]]*)?\\]\\]";
const LINK = new RegExp(LINK_SOURCE, "u");

// A proof line: a list item, its bullet a dash and one plain space, then the connection, the
// far end, how it is known, whose register, the date, and the rest. A blank inside the line is
// any horizontal whitespace, since a phone or a word processor writes no-break and other spaces
// that read as one space; the connection and the words around it are ASCII.
const PROOF = new RegExp(
  `^- (?<conn>[a-z_]+)${B}+(?<target>.+?)${B}*\\u00b7${B}*` +
    `(?<proof>shown|said|guessed)${B}*\\u00b7${B}*(?<register>[a-z-]+)` +
    `${B}*\\u00b7${B}*(?<date>[0-9]{4}-[0-9]{2}-[0-9]{2})(?<rest>.*)$`,
  "u",
);

// A fence marker: three or more backticks or tildes at any indent, then its info text.
const FENCE = /^[ \t]*(?<marker>`{3,}|~{3,})(?<info>.*)$/u;

// A heading of level one or two, as Markdown reads it: up to three spaces, the hashes, a blank,
// the text. The blanks cut off the text's two ends are any whitespace, since none can be seen.
const ATX = /^ {0,3}(?<hashes>#{1,2})(?:[ \t]+(?<text>.*))?$/u;
const EDGE_BLANKS = new RegExp(`^${B}+|${B}+$`, "gu");
const CLOSING_HASHES = new RegExp(`(?:^|${B})#+$`, "u");

// The heading levels that end a section.
const SECTION_ENDS = [1, 2];

// An email address and a phone number, as the disclosure rule reads them. A number in a web
// address counts: a messaging link is a phone number, and a record's id cannot be told from one.
const WORD = "[\\p{L}\\p{N}_";
const EMAIL = new RegExp(`${WORD}.+-]+@${WORD}-]+\\.${WORD}.-]+`, "u");
const PHONE = /(?<![\p{Nd}:-])\+?\p{Nd}(?:[ -]?\p{Nd}){9,12}(?![\p{Nd}:-])/u;

// The desk links in a header value: in a text, or in a list of them however deep; a mapping's
// links are its own business and are not read.
function linksIn(value) {
  if (typeof value === "string") {
    return [...value.matchAll(new RegExp(LINK_SOURCE, "gu"))].map((m) => strip(m[1]));
  }
  if (Array.isArray(value)) return value.flatMap(linksIn);
  return [];
}

function hasLink(text) {
  return LINK.test(text);
}

// A proof line's parts, or null. Every reader of a proof line comes through here.
function proofMatch(raw) {
  const m = PROOF.exec(raw);
  return m ? m.groups : null;
}

// Whether this line opens or closes a fence. A backtick fence's info text may not hold a
// backtick: ```a word``` is inline code in a sentence, not a fence.
function isFenceMarker(line) {
  const m = FENCE.exec(line);
  if (!m) return false;
  return !(m.groups.marker[0] === "`" && m.groups.info.includes("`"));
}

// The text with every fenced block blanked (each line kept, so line numbers line up), and
// whether a fence was left open. A fence closes with the same character, at least as long, and
// no info text.
function readOutsideFences(text) {
  const out = [];
  let opener = null;
  for (const line of splitLines(text)) {
    const found = isFenceMarker(line) ? FENCE.exec(line) : null;
    if (!found) {
      out.push(opener !== null ? "" : line);
      continue;
    }
    const { marker, info } = found.groups;
    out.push("");
    if (opener === null) opener = marker;
    else if (marker[0] === opener[0] && marker.length >= opener.length && strip(info) === "") opener = null;
  }
  return [out.join("\n"), opener !== null];
}

// [level, text] of a level-one or level-two heading, or null.
function headingOf(line) {
  const m = ATX.exec(line);
  if (!m) return null;
  let text = (m.groups.text || "").replace(EDGE_BLANKS, "");
  const closing = CLOSING_HASHES.exec(text);
  if (closing) text = text.slice(0, closing.index);
  return [m.groups.hashes.length, text.replace(EDGE_BLANKS, "")];
}

function isHeading(line, level, text) {
  const h = headingOf(line);
  return h !== null && h[0] === level && h[1] === text;
}

// The half-open range of lines a section's body occupies, or null when the page has no such
// heading. The first section of that name is the one read; `ends` are the levels that close it.
function sectionSpan(lines, heading, ends = SECTION_ENDS) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!isHeading(lines[i], 2, heading)) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      const h = headingOf(lines[j]);
      if (ends.includes(h ? h[0] : 0)) {
        end = j;
        break;
      }
    }
    return [i + 1, end];
  }
  return null;
}

// The section's lines, each with its own "\n", or null.
function sectionOf(body, heading, ends = SECTION_ENDS) {
  const lines = splitLines(body);
  const span = sectionSpan(lines, heading, ends);
  if (span === null) return null;
  return lines.slice(span[0], span[1]).map((line) => `${line}\n`).join("");
}

// A page as the rules read it: its path under celorus/, header (a mapping or null), body, and
// the problem that stopped its header being read (null for a page with no header at all).
class Page {
  constructor(rel, head, body, problem) {
    this.rel = rel;
    this.head = head;
    this.body = body;
    this.problem = problem;
    this._fenced = null;
  }

  // The file name without its suffix, as a path's stem is read.
  get stem() {
    const name = this.rel.slice(this.rel.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    return dot > 0 && dot < name.length - 1 ? name.slice(0, dot) : name;
  }

  get name() {
    return this.rel.slice(this.rel.lastIndexOf("/") + 1);
  }

  // The page's folder under celorus/, "." at the top.
  get folder() {
    const at = this.rel.lastIndexOf("/");
    return at === -1 ? "." : this.rel.slice(0, at);
  }

  get type() {
    return isMapping(this.head) && Object.hasOwn(this.head, "type") ? this.head.type : undefined;
  }

  _fences() {
    if (this._fenced === null) this._fenced = readOutsideFences(this.body);
    return this._fenced;
  }

  // The body with fenced blocks blanked. Every reader of a page's lines uses this.
  get outside() {
    return this._fences()[0];
  }

  // A fence was opened on this page and never closed, so its later lines were not read.
  get fenceOpen() {
    return this._fences()[1];
  }
}

// The words under a real heading, read as the person wrote them: the heading is found in the
// fenced reading, the words are taken from the page. The section ends at a level-two heading
// only. On a page whose fence never closed nothing can be found in the fenced reading, so the
// page is read the plain way: for a rule that protects a person, over-reporting is safe.
function sectionWords(page, heading) {
  if (page.fenceOpen) return sectionOf(page.body, heading, [2]);
  const outside = splitLines(page.outside);
  const body = splitLines(page.body);
  const span = sectionSpan(outside, heading, [2]);
  if (span === null) return null;
  return body.slice(span[0], span[1]).join("\n");
}

// Whether `## Coordinates` holds anything but the words that say it holds nothing. A fence
// marker is not a coordinate.
function coordinatesFilled(page) {
  const coords = sectionWords(page, "Coordinates");
  return (
    coords !== null &&
    splitLines(coords).some((line) => !["", "- Not established."].includes(strip(line)) && !isFenceMarker(line))
  );
}

// Every text and integer a header holds, however deep. true and false are not text, nor is a
// float, however whole (`9876543210.0` is a PyFloat here, as Python's float it is).
function textsIn(value) {
  if (typeof value === "string") return [value];
  if (typeof value === "number" && Number.isInteger(value)) return [show(value)];
  if (Array.isArray(value)) return value.flatMap(textsIn);
  if (isMapping(value)) return Object.values(value).flatMap(textsIn);
  return [];
}

// Whether an email address or a phone number is written anywhere on the page: the whole body,
// fences and all, and every value in the header.
function contactInText(page) {
  const blob = `${page.body}\n${textsIn(Object.values(page.head || {})).join("\n")}`;
  return EMAIL.test(blob) || PHONE.test(blob);
}

// The disclosure rule's question, asked once: either reading is enough.
function holdsContactDetails(page) {
  return coordinatesFilled(page) || contactInText(page);
}

module.exports = {
  LINK,
  linksIn,
  hasLink,
  proofMatch,
  isFenceMarker,
  readOutsideFences,
  headingOf,
  isHeading,
  sectionSpan,
  sectionOf,
  sectionWords,
  coordinatesFilled,
  contactInText,
  holdsContactDetails,
  Page,
};
