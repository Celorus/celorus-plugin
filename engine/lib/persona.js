"use strict";
// The name of the assistant a desk's pages speak of (DESK-98; the founder's word R65).
// The default is DEFAULT_NAME. A desk may set its own as `assistant_name` in the header of
// celorus/desk.md, and its pages then say that name wherever they would say the default.
//
// This file is the ONE place the name is read and defaulted: the templates receive it as a
// value (templates/parts.js pageContext and templates/base.js assemble take it from the render
// tools) and never read the header or spell the default themselves. It reads the desk handed to
// it at every call and keeps nothing between calls, so two desks drawn one after the other each
// get their own name.
//
// The reader takes one options object, `{ desk, seat }`, and answers the persona as an object whose
// `name` and `introduction` the templates read (the founder's amendment to DESK-156, c/5905804938: one soul per desk,
// and a seat's own manner held against that seat). `desk` is the desk as the render tools hold it
// (its `root`, and its `stamps`, the header of desk.md); `seat` is the seat the page is for, or
// absent. The seat changes nothing here: the name is the desk's, never a seat's. A later reader of
// the desk's soul, or of a seat's manner, joins this function without a template changing.
//
// The soul and the manner (DESK-156). This is also the one reader of how the assistant speaks: the
// persona answers `soul`, the soul the plugin ships (soul/default.js) with the desk's name in place
// of the default only where the soul names the assistant (F6; NAME_SITES), and never the body of
// the desk's celorus/soul.md, which is a written copy for people to read (F7); and `manner`, the
// four manner values (F3), each the seat's own from its page celorus/manner/<seat>-manner.md where
// set, else the desk's from the header of celorus/soul.md, else null (F4); `address` is the seat's
// own only, never the desk's (the base's ruling F1). A value a page holds is taken only
// when it is one the feedback door could have written: a word on its key's list, or a name form
// the pages can say (sayable); anything else reads as unset. Nothing else in the engine reads
// soul.md or a manner page as the soul or the manner. Every call reads the pages again and keeps
// nothing, so two desks, and two seats of one desk, each get their own.

const path = require("node:path");
const { screen } = require("../render/screen.js");
const { readPage } = require("./desk.js");
const { shippedSoul } = require("../soul/default.js");
const { holdsLinkBracket } = require("../check/text.js");

const DEFAULT_NAME = "Milan";

// How every page's footer introduces the assistant after its name, whatever the name (the
// founder's ruling c/5906195267: "made by <name>, <introduction>, from the <firm> desk").
// The templates read it from the persona as `introduction` and never spell it.
const INTRODUCTION = "your work companion";

// The longest name a page says, in characters.
const MAX_LENGTH = 40;

// The name rule: a name is refused by class, never by a list of scripts or of characters (the
// base's word on fix round 3). A page says a name in its text and attributes, escaped there as
// every desk value is (words.e), and as written in its own style comments and script strings,
// which no escape reaches, and in the look's own text before the page's slots are filled. So a
// name may hold any character of any script, digits, brackets and punctuation among them, and is
// refused only for a character of a class that can break a page or a path, for a name a reader
// cannot see, for a sentence end, which would let a name set into the soul speak as the soul's own
// words, or for its length, in this order (after TOO_LONG):
//   CONTROL    a control, format or unassigned character (Unicode class C), save a zero-width
//              joiner or non-joiner (U+200D, U+200C) inside a word, after a letter or its mark and
//              before a letter or a mark;
//   INVISIBLE  a default-ignorable character (Unicode Default_Ignorable_Code_Point), which shows
//              as nothing, save those same joiners inside a word, and save one variation
//              selector straight after a character a reader sees, whose drawing it picks (an
//              emoji's, a kanji's variant, a Mongolian letter's form);
//   MARK_FIRST a mark (Unicode class M) as its first character, with no letter to sit on;
//   UNSEEN     no character a reader sees anywhere in it: only spaces, marks, and the symbols
//              that are drawn blank. No Unicode class says "drawn blank", so these are listed
//              (BLANK_SYMBOLS): the braille pattern with no dot raised, the object replacement
//              character and the musical null notehead;
//   MARKUP     a character a page reads as markup: < > & " and the braces { } the look's slots
//              are written in;
//   SEPARATOR  a path separator (a slash or a backslash), or a line or paragraph separator;
//   SENTENCE_END a sentence end, in any script: a mark that ends a sentence, with any closing
//              marks after it, then a blank or the name's end; a stop of a script that writes no
//              space, anywhere; or a colon anywhere (the base's rulings F2, P1 and round 5 on
//              DESK-156; SENTENCE_END below lists each class), so a name set
//              into the soul where it names the assistant never ends the soul's sentence and
//              starts one of its own;
//   SCREENED  anything the one screen every text a page shows is held to refuses
//              (render/screen.js), a path, a link, an address or a long number among them;
//   TOO_LONG   more than MAX_LENGTH characters.
// A manner name form (address, language) is held to the same classes and to one more (item 1 of
// the review of DESK-156): BRACKET, a square bracket, which a page reads as part of a link (`[[`,
// `]]`, a markdown link's `](`), as one class, since every such shape holds one; the link reader
// asks it (check/text.js holdsLinkBracket). The assistant's
// own name may hold one: it is said literally at every site (DESK-98).
const JOINER_IN_A_WORD = /(?<=[\p{L}\p{M}])[\u200C\u200D](?=[\p{L}\p{M}])/gu;
const CONTROL = /\p{C}/u;
const SELECTOR_ON_A_SEEN_CHARACTER = /(?<=[^\p{Z}\p{C}\p{Default_Ignorable_Code_Point}])\p{Variation_Selector}/gu;
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/u;
const MARK_FIRST = /^\p{M}/u;
const BLANK_SYMBOLS = "\\u2800\\ufffc\\u{1d159}";
const SEEN = new RegExp(`[^\\p{Z}\\p{C}\\p{M}\\p{Default_Ignorable_Code_Point}${BLANK_SYMBOLS}]`, "u");
const SEPARATOR = /[/\\\p{Zl}\p{Zp}]/u;
const MARKUP = /[<>&"{}]/u;
// A sentence end in any script, in Unicode's sentence-boundary shape:
// - a terminal (TERMINAL: a mark Unicode names a sentence terminal, and four this engine's Unicode
//   does not: the ellipsis U+2026, the Greek question mark U+037E, the Armenian question mark
//   U+055E and the Tibetan shad U+0F0D), then any closing marks and combining marks, in any order
//   or count (CLOSER: a closing bracket, \p{Pe}; a closing or opening quote, \p{Pf} and \p{Pi},
//   since a quote mark closes a quote in one script and opens it in another; ASCII's quote and
//   apostrophe; and a combining mark, \p{M}), then a blank or the end of the value (the name site
//   supplies the blank after it);
// - a stop of a script that writes no space, anywhere (NO_SPACE_STOP: the sentence terminals in
//   the CJK, vertical, small and fullwidth forms, U+3002, U+FE12, U+FE15, U+FE16, U+FE52, U+FE56,
//   U+FE57, U+FF01, U+FF0E, U+FF1F and U+FF61), with no blank needed;
// - or a colon anywhere (COLON): every colon Unicode classes as punctuation, ASCII's (U+003A), the Syriac
//   ones (U+0703 to U+0709), the Ethiopic two (U+1365, U+1366), the Mongolian (U+1804), the Bamum
//   (U+A6F4), the vertical (U+FE13), the small (U+FE55), the fullwidth (U+FF1A), the two cuneiform
//   (U+12471, U+12472) and the SignWriting (U+1DA8A). The modifier-letter colons are letters, and
//   the operators named for a colon are symbols; neither is taken.
// A middle dot (U+00B7, U+30FB) ends no sentence, so a name written with one passes.
const TERMINAL = "[\\p{Sentence_Terminal}\\u2026\\u037e\\u055e\\u0f0d]";
const CLOSER = "[\\p{Pe}\\p{Pf}\\p{Pi}\\u0022\\u0027\\p{M}]";
const NO_SPACE_STOP = "[\\u3002\\ufe12\\ufe15\\ufe16\\ufe52\\ufe56\\ufe57\\uff01\\uff0e\\uff1f\\uff61]";
const COLON = "[\\u003a\\u0703-\\u0709\\u1365\\u1366\\u1804\\ua6f4\\ufe13\\ufe55\\uff1a\\u{12471}\\u{12472}\\u{1da8a}]";
const SENTENCE_END = new RegExp(`${TERMINAL}${CLOSER}*(?:\\p{Zs}|$)|${NO_SPACE_STOP}|${COLON}`, "u");

// Why a set value is not said, in words that never repeat it (it may be hostile), or null when
// it is a name the pages can say, the classes held in the order above. Each is the clause after
// "was not used: ".
const REFUSED = Object.freeze({
  NOT_TEXT: "it is not written as one line of text",
  TOO_LONG: `it is longer than ${MAX_LENGTH} characters`,
  CONTROL: "it holds a control or invisible character",
  INVISIBLE: "it holds a character that shows as nothing",
  MARK_FIRST: "it begins with a mark that belongs on a letter",
  UNSEEN: "it holds nothing a reader can see",
  SEPARATOR: "it holds a path separator or a line break",
  MARKUP: "it holds a character a page reads as markup",
  BRACKET: "it holds a square bracket, which a page reads as part of a link",
  SENTENCE_END: "it holds the end of a sentence: a mark that ends a sentence, in any script, followed by a space or ending the name, a mark that ends a sentence in a script that writes no space, or a colon; a title or an initial is written without its full stop, as Dr Asha or J R",
  SCREENED: "it reads as something no page may show, such as a path, a link, an address or a long number",
});

function refusalOf(value) {
  if (typeof value !== "string") return REFUSED.NOT_TEXT;
  if ([...value].length > MAX_LENGTH) return REFUSED.TOO_LONG;
  const unjoined = value.replace(JOINER_IN_A_WORD, "");
  if (CONTROL.test(unjoined)) return REFUSED.CONTROL;
  if (INVISIBLE.test(unjoined.replace(SELECTOR_ON_A_SEEN_CHARACTER, ""))) return REFUSED.INVISIBLE;
  if (MARK_FIRST.test(value)) return REFUSED.MARK_FIRST;
  if (!SEEN.test(value)) return REFUSED.UNSEEN;
  if (MARKUP.test(value)) return REFUSED.MARKUP;
  if (SEPARATOR.test(value)) return REFUSED.SEPARATOR;
  if (SENTENCE_END.test(value)) return REFUSED.SENTENCE_END;
  if (screen(value).length) return REFUSED.SCREENED;
  return null;
}

// Whether `value` is a name the pages can say: text, not empty, and refused by no class above.
function sayable(value) {
  return typeof value === "string" && value.length > 0 && refusalOf(value) === null;
}

// Why a manner name form is not taken (the name's classes, then BRACKET), or null when it is one.
function formRefusalOf(value) {
  const why = refusalOf(value);
  if (why !== null) return why;
  return holdsLinkBracket(value) ? REFUSED.BRACKET : null;
}

// Whether `desk` is a desk as the loader gives it (lib/desk.js readDesk, or render/desk.js Desk
// over it): its root, its stamps (the header of desk.md, or null when it could not be read) and
// its pages. A path, an empty object or nothing is not.
function loaded(desk) {
  return (
    desk !== null &&
    typeof desk === "object" &&
    typeof desk.root === "string" &&
    Object.hasOwn(desk, "stamps") &&
    typeof desk.stamps === "object" &&
    Object.hasOwn(desk, "pages")
  );
}

// The manner keys (F3), and the closed list of words for the two that take one; `address` (what
// the assistant calls the seat) and `language` are name forms, held to `formRefusalOf`.
const MANNER_KEYS = Object.freeze(["brevity", "address", "explain", "language"]);
const MANNER_WORDS = Object.freeze({
  brevity: Object.freeze(["brief", "usual", "full"]),
  explain: Object.freeze(["less", "usual", "more"]),
});

// Where the desk's manner and each seat's are kept, under the desk's celorus folder (F4).
const SOUL_PAGE = "soul.md";
const MANNER_FOLDER = "manner";
// A seat handle, as the writers hold one (write/text.js HANDLE): a manner page is read only for a
// seat named so, and never by any other path.
const SEAT_HANDLE = /^[a-z0-9][a-z0-9-]*$/u;
// A seat's manner page is named for the seat and the word manner, <seat>-manner.md, so its file
// name is never the seat's own page's, and a link or a question naming the seat reaches one page
// (the base's ruling F3). MANNER_PAGE is every rel written so, for the check's furniture.
const MANNER_SUFFIX = "-manner";
const MANNER_PAGE = new RegExp(`^${MANNER_FOLDER}/[a-z0-9][a-z0-9-]*${MANNER_SUFFIX}\\.md$`, "u");

// The rel of `handle`'s manner page, under the desk's celorus folder.
function mannerRel(handle) {
  return `${MANNER_FOLDER}/${handle}${MANNER_SUFFIX}.md`;
}

// Whether `page` ({ rel, type }, rel under the celorus folder) is one of the two pages the engine
// writes for the soul: soul.md at the root saying type soul, or a manner page where the door
// writes one saying type manner. By path and type both: a page of either type anywhere else is
// the desk's own and read as any other (rule C17).
function isSoulPage(page) {
  if (page === null || typeof page !== "object" || typeof page.rel !== "string") return false;
  return (page.rel === SOUL_PAGE && page.type === "soul") || (MANNER_PAGE.test(page.rel) && page.type === "manner");
}

// A manner value as the reader takes it: a word on its key's list, or a name form the pages can
// say, blanks at its ends taken off; else null.
function mannerValue(key, value) {
  if (typeof value !== "string") return null;
  const said = value.trim();
  if (Object.hasOwn(MANNER_WORDS, key)) return MANNER_WORDS[key].includes(said) ? said : null;
  return said.length > 0 && formRefusalOf(said) === null ? said : null;
}

// The four manner values a page's header holds, each as the reader takes it (mannerValue), null
// for a key it does not hold; all null for no header.
function mannerHeld(head) {
  const mapping = head !== null && typeof head === "object" && !Array.isArray(head);
  return Object.fromEntries(MANNER_KEYS.map((key) => [key, mapping && Object.hasOwn(head, key) ? mannerValue(key, head[key]) : null]));
}

// The header of the page `rel` under the desk's celorus folder when it reads whole as a page of
// `type`, else null (no page, one that cannot be read, or one of another type).
function headOf(root, rel, type) {
  const page = readPage(path.join(root, "celorus"), rel);
  const head = page.problem ? null : page.head;
  return head !== null && typeof head === "object" && !Array.isArray(head) && head.type === type ? head : null;
}

// Where the shipped soul names the assistant, each once: its heading and the first words of its
// first sentence. The desk's name is set there and nowhere else (the base's ruling F2).
const NAME_SITES = Object.freeze([`# ${DEFAULT_NAME}\n`, `\n${DEFAULT_NAME} is ${INTRODUCTION}.`]);

// The soul the pages speak from: the shipped text, with `name` in place of the default at each of
// NAME_SITES when the desk has a name of its own (F6). Each site is found in the shipped text
// itself, never in text the name was set into.
function soulFor(name) {
  const shipped = shippedSoul();
  if (name === DEFAULT_NAME) return shipped;
  const parts = [];
  let from = 0;
  for (const site of NAME_SITES) {
    const at = shipped.indexOf(site, from);
    if (at === -1 || shipped.indexOf(site, at + 1) !== -1) {
      throw new Error("the shipped soul no longer names the assistant once at each of its name sites");
    }
    parts.push(shipped.slice(from, at), site.replace(DEFAULT_NAME, () => name));
    from = at + site.length;
  }
  parts.push(shipped.slice(from));
  return parts.join("");
}

// The manner `seat` is spoken to with on the desk at `root`: per key, the seat's own, else the
// desk's, else null; `address` only ever the seat's own. A seat that is absent or not written as
// a handle has only the desk's.
function mannerFor(root, seat) {
  const desk = { ...mannerHeld(headOf(root, SOUL_PAGE, "soul")), address: null };
  const handle = typeof seat === "string" && SEAT_HANDLE.test(seat) ? seat : null;
  const page = handle === null ? null : headOf(root, mannerRel(handle), "manner");
  // A page copied under another seat's name is not that seat's: its for_seat must name the seat.
  const own = mannerHeld(page !== null && page.for_seat === `[[${handle}]]` ? page : null);
  return Object.freeze(Object.fromEntries(MANNER_KEYS.map((key) => [key, own[key] !== null ? own[key] : desk[key]])));
}

// The persona `desk`'s pages speak for: its name is the desk's own when its desk.md sets one the
// pages can say, else the default. An absent or empty field (blank counts as empty) is no
// refusal: the pages say the default and nothing is said about it. A field set to a value that is
// refused is not said either, and `refused` says why in words (REFUSED), which the render tools'
// answers carry as one sentence (notUsed); otherwise `refused` is null. A call that hands no
// loaded desk, as `{ desk }`, is a caller's error, never the default. `soul` and `manner` are
// the soul and the manner above, read from this desk on this call.
function persona(options) {
  if (options === null || typeof options !== "object" || !loaded(options.desk)) {
    throw new TypeError("persona takes one options object, { desk, seat }, whose desk is a loaded desk");
  }
  const stamps = options.desk.stamps || {};
  const set = Object.hasOwn(stamps, "assistant_name") ? stamps.assistant_name : null;
  const value = typeof set === "string" ? set.trim() : set;
  const empty = value === null || value === undefined || value === "";
  const refused = empty ? null : refusalOf(value);
  const name = empty || refused ? DEFAULT_NAME : value;
  const manner = mannerFor(options.desk.root, options.seat);
  return Object.freeze({ name, introduction: INTRODUCTION, refused, soul: soulFor(name), manner });
}

// The one sentence a render tool's answer carries when the desk's field was refused, built from
// the persona's `refused` and never from the value; null when nothing was refused.
function notUsed(who) {
  return who.refused ? `The desk's assistant_name was not used: ${who.refused}. The pages say the default name, ${DEFAULT_NAME}.` : null;
}

module.exports = {
  persona,
  notUsed,
  sayable,
  refusalOf,
  formRefusalOf,
  mannerHeld,
  REFUSED,
  DEFAULT_NAME,
  INTRODUCTION,
  MAX_LENGTH,
  MANNER_KEYS,
  MANNER_WORDS,
  SOUL_PAGE,
  MANNER_FOLDER,
  mannerRel,
  isSoulPage,
};
