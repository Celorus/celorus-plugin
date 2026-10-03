"use strict";
// The sentences a page takes, held to the page's exact schema (templates/pages.js PROSE) before
// anything is drawn, screened or saved. Every slot has one shape at every depth, and anything
// outside it is refused by its path and its kind, never by its text: an unknown key at any
// depth, a value that is not text where text belongs, or a gist keyed by something that is no
// row in this render's systems. The file saved beside a page is built only from what the schema
// accepted, and every text in it is screened as the page would draw it, whether or not this
// render draws it (base ruling R20: the page's own unit, a paragraph, a list item, a heading, a
// line of pills), so nothing reaches the disk that the screen has not read.

const W = require("./words.js");
const { PROSE } = require("../templates/pages.js");
const { shownRefusal } = require("./screen.js");

// a key outside the schema is named by its place, never by its text
const UNKNOWN = '"..."';
const SECTION_KEYS = ["heading", "paragraphs"];
const REFS_SAID = 12;

class Outside extends Error {}

function kindOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "a number";
  if (typeof value === "boolean") return "true or false";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}

function outside(where, what, takes) {
  throw new Outside(`The prose at ${where} is ${what}; ${takes}. Nothing was rendered.`);
}

// Text, or a list of text: as a list.
function texts(value, where) {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) outside(where, kindOf(value), "text or a list of text belongs there");
  return value.map((item, i) => {
    if (typeof item !== "string") outside(`${where}[${i}]`, kindOf(item), "each item of the list is text");
    return item;
  });
}

// Text, or a list of sections, each text or an object of a heading (text) and paragraphs (text
// or a list of text).
function sections(value, where) {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) outside(where, kindOf(value), "text or a list of sections belongs there");
  return value.map((item, i) => {
    const at = `${where}[${i}]`;
    if (typeof item === "string") return item;
    if (!W.isMap(item)) outside(at, kindOf(item), "a section is text, or an object of heading and paragraphs");
    for (const key of Object.keys(item)) {
      if (!SECTION_KEYS.includes(key)) outside(`${at}.${UNKNOWN}`, "a key a section does not take", "a section takes heading and paragraphs");
    }
    const out = {};
    if (Object.hasOwn(item, "heading")) {
      if (typeof item.heading !== "string") outside(`${at}.heading`, kindOf(item.heading), "a heading is text");
      out.heading = item.heading;
    }
    if (Object.hasOwn(item, "paragraphs")) out.paragraphs = texts(item.paragraphs, `${at}.paragraphs`);
    return out;
  });
}

function refsSaid(refs) {
  if (!refs.length) return "and this render was handed none";
  const shown = refs.slice(0, REFS_SAID).join(", ");
  return refs.length > REFS_SAID ? `here ${shown} and ${refs.length - REFS_SAID} more` : `here ${shown}`;
}

// An object of one text per row, keyed by the row's ref in this render's systems.
function gists(value, where, refs) {
  if (!W.isMap(value)) outside(where, kindOf(value), "an object belongs there, one text per row, keyed by the row's ref");
  const out = {};
  for (const key of Object.keys(value)) {
    if (!refs.includes(key)) {
      outside(
        `${where}.${UNKNOWN}`,
        "a key that is not a row ref in this render's systems",
        `a gist is keyed by the id of a mail thread, a CRM record or a calendar row handed over in systems, ${refsSaid(refs)}`,
      );
    }
    if (typeof value[key] !== "string") outside(`${where}.${key}`, kindOf(value[key]), "a gist is text");
    out[key] = value[key];
  }
  return out;
}

// a family's page name, as a slot keyed by family is keyed (row E6)
const PAGE_NAME = /^[a-z0-9][a-z0-9-]*$/;

// An object of one text per family, keyed by the family's page name (row E6: the RM console's
// grow-the-book lines). A family the page draws no row for is still screened, never drawn.
function byFamily(value, where) {
  if (!W.isMap(value)) outside(where, kindOf(value), "an object belongs there, one text per family, keyed by the family's page name");
  const out = {};
  for (const key of Object.keys(value)) {
    if (!PAGE_NAME.test(key)) outside(`${where}.${UNKNOWN}`, "a key that is not a page name", "a line is keyed by the family page's name, as its file is named");
    if (typeof value[key] !== "string") outside(`${where}.${key}`, kindOf(value[key]), "a line is text");
    out[key] = value[key];
  }
  return out;
}

// Each slot kind: its exact shape, and the units the page draws it in (read through `plain`,
// the page's own link reader, so a link is screened as the words it shows).
const KINDS = {
  line: {
    shape: texts,
    drawn: (value, plain) => {
      const line = W.joinedLine(value);
      return line ? [plain(line)] : [];
    },
  },
  lines: { shape: texts, drawn: (value, plain) => W.aslist(value).map((line) => plain(line)) },
  sections: {
    shape: sections,
    drawn: (value, plain) => {
      const all = W.assections(value);
      const heads = all.filter((s) => W.truthy(s.heading)).map((s) => plain(s.heading));
      // the contents row draws every heading as a pill on one line
      const out = heads.length > 1 ? [heads.join(" ")] : [];
      for (const s of all) {
        if (s.heading) out.push(plain(s.heading));
        for (const block of W.paragraphBlocks(s.paragraphs)) out.push(...(block.list ? block.list.map((line) => plain(line)) : [plain(block.text)]));
      }
      return out;
    },
  },
  gists: { shape: gists, drawn: (value, plain) => Object.values(value).map((text) => plain(text)) },
  by_family: { shape: byFamily, drawn: (value, plain) => Object.values(value).map((text) => plain(text)) },
};

// The refs a gist may be keyed by: every mail thread, CRM record and calendar row in this
// render's systems (systems.js systemsOf) that carries an id as text.
function rowRefs(st) {
  const rows = [...st.mail.threads, ...st.crm.records, ...st.calendar.events, ...st.calendar.proposals];
  return [...new Set(rows.map((r) => r.id).filter((id) => typeof id === "string"))].sort();
}

// The sentences as the page's schema takes them, { words }, or why not, { refused }. A string
// or a list sent whole is the page's summary; a page with no summary slot takes an object.
function checked(view, prose, refs) {
  const slots = PROSE[view];
  const names = Object.keys(slots).join(", ") || "none: this page takes no sentences";
  try {
    let value = prose;
    const blob = typeof value === "string" || Array.isArray(value);
    if (blob) {
      if (!Object.hasOwn(slots, "summary")) outside("prose", kindOf(value), `the ${view} takes an object of its slots: ${names}`);
      value = { summary: value };
    } else if (!W.isMap(value)) {
      outside("prose", kindOf(value), `the ${view} takes an object of its slots (${names}), or text`);
    }
    const words = {};
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(slots, key)) outside(`prose.${UNKNOWN}`, `a key that is no slot on the ${view}`, `its slots are ${names}`);
      words[key] = KINDS[slots[key]].shape(value[key], `prose.${key}`, refs);
    }
    // text sent whole with nothing in it is no sentences at all
    if (blob && !W.aslist(words.summary).length) return { words: {} };
    return { words };
  } catch (err) {
    if (err instanceof Outside) return { refused: err.message };
    throw err;
  }
}

// Why these sentences cannot go on the page, or null: every text, in every slot, screened as
// the page draws that slot, whether or not this render draws it; the rules in `skip` left out.
function drawnRefusal(view, words, plain, skip = undefined) {
  const units = [];
  for (const [slot, value] of Object.entries(words)) {
    for (const text of KINDS[PROSE[view][slot]].drawn(value, plain)) units.push([slot, text]);
  }
  return shownRefusal(units, skip);
}

// The sentences with each one `carries` answers true for left out, and how many were (row E11,
// live/live.js: a sentence that carries a refused row's name, handle or number). A sentence is one
// text the schema took: a line, a list's item, a section's paragraph, a gist, a family's line. A
// section whose heading is left out goes with it, counted once.
function withoutCarried(view, words, carries) {
  let setAside = 0;
  const keep = (text) => {
    if (!carries(text)) return true;
    setAside += 1;
    return false;
  };
  const out = {};
  for (const [slot, value] of Object.entries(words)) {
    const kind = PROSE[view][slot];
    if (kind === "gists" || kind === "by_family") {
      out[slot] = Object.fromEntries(Object.entries(value).filter(([, text]) => keep(text)));
    } else if (kind === "sections") {
      out[slot] = [];
      for (const item of value) {
        if (typeof item === "string") {
          if (keep(item)) out[slot].push(item);
        } else if (!Object.hasOwn(item, "heading") || keep(item.heading)) {
          out[slot].push(Object.hasOwn(item, "paragraphs") ? { ...item, paragraphs: item.paragraphs.filter(keep) } : item);
        }
      }
    } else {
      out[slot] = value.filter(keep);
    }
  }
  return { words: out, setAside };
}

module.exports = { checked, drawnRefusal, rowRefs, withoutCarried };
