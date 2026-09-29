"use strict";
// The screen a writer's words pass before anything is written: the words are the model's,
// written just after it read a call or a mailbox, and a page keeps them. A value that trips a
// rule is refused, never quietly rewritten, and the refusal names where the words sit, what is
// wrong and what to send instead, never the words themselves.
//
// The mechanism rules of the demo kit's leak screen, ported (the base's ruling R4): a phone
// number that is not masked, an address off a .example domain, a path from this machine, an em
// dash, an @ in any form, an address spelled out as at and dot, a link, and seven or more digits
// in a row. The kit's list of real names is custody and never enters the plugin, so a real name
// is not refused here: the kit's refusals are a larger set, and the tests name that difference. A
// said line's speaker label is held to the desk's own seats and people by the conversation
// writer (writers.js).
//
// One screen fold and one set of rules for both screens (round 1, K2): the fold and the rules are
// render_view's (render/screen.js), run here twice, over the text as a page on the desk shows it
// (Obsidian draws a character reference as its character, so each is decoded first) and over the
// text as sent. So a writer refuses whatever render_view's screen refuses, and more.
//
// The screen reads only the new words a writer is sent, never a page's own text (the base's ruling
// R72, K2c). A new absolute home or temp path is refused, and the refusal says to write the
// file's name or the path in its tilde form; a tilde form passes, as it passes in a page's own
// text, and the answer says it as "(a path)" (R73, unpathed below).
//
// The screen's fold is not the fold names are matched by (0.19.0 round 1 readers, K2b; the base's
// ruling R71): the screen takes every default-ignorable and combining mark out and reads every
// number character as a digit, so no leak hides behind one; a name keeps its marks, so a said
// line's speaker (writers.js) is matched by nameFold below, as it was before round 1.

const { screen, normalised: screenFold, pathsSaid, WRONG, SAY_INSTEAD } = require("../render/screen.js");
const { pySplit } = require("./text.js");

// The named character references the screen decodes, beside every numeric one: the ones that
// write a character a rule reads, and the four every page writes.
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  mdash: "\u2014",
  commat: "@",
  period: ".",
  colon: ":",
  sol: "/",
};

function unescapeHtml(text) {
  return text.replace(/&(?:#([0-9]+)|#[xX]([0-9a-fA-F]+)|([A-Za-z]+));/gu, (whole, dec, hex, name) => {
    if (name !== undefined) return Object.hasOwn(NAMED, name) ? NAMED[name] : whole;
    const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "\ufffd";
  });
}

// Every rule a writer's words trip, in order: render_view's rules over the text as a page shows
// it, folded, then over the text as sent.
function rulesOf(text) {
  return [...screen(unescapeHtml(screenFold(text))), ...screen(text)];
}

// The first rule a writer's words trip, or null.
function firstRule(text) {
  const [rule] = rulesOf(text);
  return rule || null;
}

// A name as a said line's speaker and a page's title are matched by: NFKC over the whole text (so
// a decomposed accent composes, and a composed one stays), every invisible format character (Cf)
// taken out, marks kept (an accent, a Devanagari vowel sign), and white space made single spaces.
const FORMAT = /\p{Cf}/u;
function nameFold(text) {
  const nfkc = String(text).normalize("NFKC");
  return pySplit([...nfkc].filter((ch) => !FORMAT.test(ch)).join("")).join(" ");
}

// The refusal for the first of `words` ([where, text]) that trips a rule, or null.
function screened(words, instead = SAY_INSTEAD, done = "Nothing was written.") {
  for (const [where, text] of words) {
    const rule = firstRule(String(text));
    if (rule) return `${where} ${WRONG[rule]}; ${instead[rule]}. ${done}`;
  }
  return null;
}

// A path written from the home folder with a tilde, which new text may carry (the base's ruling
// R73: the screen passes it, as it passes in a page's own text). The page keeps it; an answer
// never repeats it, so where a tool echoes words it was sent, each such path is said as
// "(a path)", by the ONE pathsSaid (the base's ruling R101 (b), K4g: no second screen beside it).
// "~/" alone names no folder and is left as it is.
function unpathed(text) {
  return typeof text === "string" ? pathsSaid(text) : text;
}

module.exports = { SAY_INSTEAD, nameFold, rulesOf, screened, unpathed };
