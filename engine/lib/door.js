"use strict";
// The door screen (0.19.0 K4h, the base's ruling R102, c/5856613653, under R101 (A) 1b,
// c/5856546770, and R72, c/5849012621). Every answer the two answer doors say is walked here once,
// after the tool built it and before the door writes it out: the server's reply (lib/mcp.js, the
// line server.js writes) and the command line's printer and its refusals (cli.js). ONE function,
// screenAtDoor, for both doors.
//
// - A string at a field R72 pins (lib/fields.js NAMED, by `<tool> <pointer>`: the fields the model
//   acts on and the root fields) is the one place an answer may carry the desk's path, and there it
//   must extend the desk as the caller gave it (lib/tools.js deskNamed: the `desk` argument, else
//   the CELORUS_DESK the desk was read from, R101 (C)): every path in it that names a place from a
//   root (lib/fields.js: an absolute path rides only there, and only as an extension of the desk)
//   starts with the desk as given, and no `..` step leads out of it. A pinned field that fails
//   turns the whole answer into the door's refusal, which names the field, never its value.
// - Every other string, every key of an object, and every refusal's words go through the ONE
//   pathsSaid (render/screen.js, R101 (b)): a path in it is said "(a path)". There is no second
//   screen: a pinned field is never rewritten, only held to the desk.
// - The write doors keep their own control (R73: a writer refuses a new absolute home or temp
//   path in page text). This screen reads what a tool SAYS, never what it wrote.
//
// What the door knows about a write: nothing. A tool may have written a page before its answer
// reached the door, and the door sees only the answer. So its refusal says what the door did (it
// passed none of the answer on, and it writes nothing itself), and that whether the tool wrote
// first is not the door's to say; it never says that nothing was written.
//
// The walk reads what serialization writes: a string, a list's items, an object's own enumerable
// keys and values, a toJSON's answer; and a Map's or a Set's contents too, where one reaches a door
// (JSON writes neither, but a reader of the value may). One walk, the answer copied once and never
// serialized here: the door serializes the copy as it did the answer.

const { pathsSaid, findings, PATH_ONLY } = require("../render/screen.js");
const { NAMED, keyed, itemed } = require("./fields.js");
const { deskNamed } = require("./tools.js");

// A character a path's token starts after: a blank, a quote, or an option's `=`; a place also starts
// after a mark (R141). Inside a group (a template's `{...}`, a pattern's `(...)`, R143) or past a
// scheme's `:` (R142), a separator is inside a token that is no path from a root (placeEnd).
const STARTS_AFTER = /[\s"'`=]/u;
// A character that ends a path and so a place: a blank or a quote; a mark only at depth zero (R143).
const ENDS = /[\s"'`,;:)\]}]/u;
const isSeparator = (ch) => ch === "/" || ch === "\\";
// A step up out of a folder: `..` at a place's start or after a separator, before one or the end.
const UP = /(?:^|[\\/])\.\.(?=[\\/\s"'`]|$)/u;

// The desk as given, its trailing separators aside, as the text a pinned field extends; "" for a
// desk that is not text or is a root alone (which would take every path with it).
function deskText(desk) {
  if (typeof desk !== "string") return "";
  let end = desk.length;
  while (end > 0 && isSeparator(desk[end - 1])) end -= 1;
  return desk.slice(0, end);
}

// The start of a path that names a place from a root, not from the desk: a separator (or two, a
// server's) before a name, the home's tilde and a separator before a name, or a drive and a
// separator. A separator before no name (a pattern's `/[`) starts none.
const FROM_ROOT = /^(?:[\\/]{1,2}[\p{L}\p{N}_.~-]|~[\\/][\p{L}\p{N}_.~-]|[A-Za-z]:[\\/])/u;
// A character a path's token ends at, at any bracket depth: a blank or a quote.
const TOKEN_END = /[\s"'`]/u;

// Whether the ONE finder reports a path in `text` (render/screen.js findings, its rule "home-path",
// which pathsSaid says a path by, read with every other rule skipped; R101 (A) 1b, no second
// boundary). In the desk's own place the desk as given is read as the one name `d`, so the finder
// reports only a form that does not start the desk as given (R129 item 1, R140): a home or scratch
// form in a page's NAME is one (DESK-122, held; the caller renames the page).
const saysPath = (text) => findings(text, PATH_ONLY).length > 0;

// Whether the desk's text `bare` starts at `at` in `text` and ends there as a folder: at a
// separator, the text's end, or a character that ends a path.
function deskStartsAt(text, bare, at) {
  if (bare === "" || !text.startsWith(bare, at)) return false;
  const after = text[at + bare.length];
  return after === undefined || isSeparator(after) || ENDS.test(after);
}

// The door's refusal of an answer whose pinned field carries a path off the desk as given: the
// field by its pinned name (the tool, then the field), never its value; what the door did, and
// what it cannot know.
const HELD =
  "carries a path that is not under the desk as it was given, and an answer carries a path only " +
  "under that desk. The door passed none of that answer on, and the door itself writes nothing. Whether " +
  "the tool wrote to the desk before it answered is not the door's to say: the desk holds the record of any " +
  "write, so look at the desk and its log.md before asking again.";
const heldWords = (field) => `The door held back this answer: its field ${field} (the tool, then the field) ${HELD}`;

// Brackets group (R143): within a place, an opening round, square or curly bracket raises a depth
// and its matching closer lowers it; a mark ends the place only at depth zero, so a group is part
// of its token (a template's `{url_path}`, a pattern's `(...)` or `[...]`, a bracketed name). A
// closer at depth zero, or one that is not the innermost opener's, is unmatched and is a mark
// (R141). FROM_ROOT tests the place's start; the finder reads the whole place, so a home or a
// scratch form inside a group is held (and pathsSaid says it too).
const CLOSER = { "(": ")", "[": "]", "{": "}" };
// A scheme's colon (R142): the screen's own grammar reads a word's colon before two separators as a
// link's scheme, and a file: url carries its scheme as part of its path (render/screen.js:61-65).
// So a colon that closes a scheme, with two separators after it, does not end a place: the url is
// ONE place, read by UP, by FROM_ROOT at its start (which a scheme fails) and by the finder inside
// it. A scheme mirrors screen.js:65's: a letter, then letters, digits, "+", "." or "-", with no name
// character or "+" before it. A single letter is a drive's (screen.js:62, AT_DRIVE), and its colon
// stays a mark, as does every other colon (R141), a word's colon before ONE separator too: there
// the door is stricter than the screen, never weaker (R129). `from` is where the place's own text
// starts (past the desk as given, in the desk's place), so a scheme never reaches into the desk.
const SCHEME = /(?<![\p{L}\p{N}_.~+-])[A-Za-z][A-Za-z0-9+.-]+$/u;
const closesScheme = (text, from, at) =>
  text[at] === ":" && isSeparator(text[at + 1]) && isSeparator(text[at + 2]) && SCHEME.test(text.slice(from, at));
// Where the place whose own text starts at `from` ends in `text`, read from `end`: at a character
// `stops` names (a token's end), at any depth; or at a mark (ENDS) at bracket depth zero that is no
// scheme's colon (R141, R142, R143).
function placeEnd(text, from, end, stops) {
  const open = [];
  for (; end < text.length; end += 1) {
    const ch = text[end];
    if (stops.test(ch)) break;
    if (CLOSER[ch] !== undefined) open.push(CLOSER[ch]);
    else if (open.length > 0 && ch === open[open.length - 1]) open.pop();
    else if (open.length > 0 && !")]}".includes(ch)) continue;
    else if (ENDS.test(ch) && !closesScheme(text, from, end)) break;
  }
  return end;
}

// The answer `answer` of tool `tool` (called with `args`) as a door may say it: { answer, held }.
// `answer` is the screened copy and `held` null; or, where a pinned field carries a path off the
// desk as given, `answer` is null and `held` is the door's refusal. `tool` null: `answer` is words
// no tool field holds (a refusal's, a protocol message's), every string of it prose.
function screenAtDoor(tool, args, answer) {
  // The desk as given: the `desk` argument, else what deskNamed reads with none passed (the
  // CELORUS_DESK the desk was read from, R101 (C)); deskNamed(args.desk) says the same, read here
  // in two steps so the door reads only the desk from what the caller passed.
  const bare = tool === null ? "" : deskText(args.desk === undefined || args.desk === null ? deskNamed(undefined) : args.desk);
  // Whether a pinned string is on the desk as given (R102; the base's rulings R129 item 1, R133 (B)
  // item 2, R140 and R141). The check is a positive one, place by place: each place is on the desk, or
  // the string is held, whatever its root; and every path form the ONE finder reports starts the desk
  // as given and reads on to its end, so the door's boundary and the one screen's never drift. A place
  // starts where a path's token may (the text's start, or after STARTS_AFTER) or after a mark that
  // ended the place before it. A mark (a comma, a semicolon, a colon, a closing bracket) ends EVERY
  // place, the desk's own (R138, K4h-4; R140, K4h-5) and any other (R141, K4h-6): a mark is never part
  // of a pinned path, so a root, a tilde, a home or a scratch form after one is a place of its own,
  // held unless it starts the desk as given. A mark ends a place only at bracket depth zero (R143,
  // placeEnd): a group is part of its token. A scheme's colon before two separators is no mark (R142,
  // closesScheme): the url is one place. So a foreign root that is no family, inside a relative token
  // (after a scheme, "file:///srv/x", or a balanced group, "{x}/srv/y"), is answered as the screen
  // passes it: DESK-124, a named limit (0.20.0 changes the screen and the door together).
  // A place is on the desk when:
  // - the desk as given starts there as a folder: its place then reads on through a separator to
  //   the first character that ends a path (ENDS), the desk's own extension (R102), and in it, with
  //   the desk read as a name, the finder reports no path (saysPath: a home or scratch form in a
  //   page's name is held, DESK-122);
  // - or it is a relative name: no path from a root starts there (FROM_ROOT: a separator, a tilde,
  //   a drive; the rooted check) and, up to the place's end, the finder reports no path. A home or a
  //   scratch form after a scheme or a word is the finder's there, as it is the screen's, and so is
  //   one in a desk-relative page's name (R140 item 2 withdrew its exemption); one after a mark, and
  //   a root or a tilde after a mark, starts a place of its own (R141; DESK-122 widened).
  // No `..` step leads out: the step is read past the desk as given (R129 item 2, K4h-3), so a desk
  // the caller named with a step in it is answered, and a step after it, or at a place's start, is
  // held.
  const onDesk = (text) => {
    // where a place starts with no STARTS_AFTER before it: the text's start, or after a mark that
    // ended the desk's place
    let from = 0;
    for (let at = 0; at < text.length; at += 1) {
      if (STARTS_AFTER.test(text[at]) || (at !== from && !STARTS_AFTER.test(text[at - 1]))) continue;
      let end = at;
      if (deskStartsAt(text, bare, at)) {
        end = placeEnd(text, at + bare.length, at + bare.length, TOKEN_END);
        const extension = text.slice(at + bare.length, end);
        if (UP.test(extension) || saysPath(`d${extension}`)) return false;
      } else {
        end = placeEnd(text, at, at, STARTS_AFTER);
        const place = text.slice(at, end);
        if (UP.test(place) || FROM_ROOT.test(place) || saysPath(place)) return false;
      }
      // a mark ended the place: a new place starts after it
      if (end < text.length && !STARTS_AFTER.test(text[end])) {
        from = end + 1;
        at = end;
        continue;
      }
      at = end;
    }
    return true;
  };
  let held = null;
  const within = [];
  const copy = (value, at) => {
    if (typeof value === "string") {
      if (tool === null || !NAMED.has(`${tool} ${at}`)) return pathsSaid(value);
      if (held === null && !onDesk(value)) held = [...NAMED].find((name) => name === `${tool} ${at}`);
      return value;
    }
    if (value === null || typeof value !== "object") return value;
    if (within.includes(value)) throw new TypeError("An answer that holds itself cannot be written out.");
    within.push(value);
    try {
      if (typeof value.toJSON === "function") return copy(value.toJSON(), at);
      // a list's items; a Map's entries (each a [key, value] pair) and a Set's members, as a list
      if (Array.isArray(value) || value instanceof Map || value instanceof Set) {
        const items = [];
        for (const one of value) items.push(copy(one, itemed(at)));
        return value instanceof Map ? new Map(items) : value instanceof Set ? new Set(items) : items;
      }
      const out = {};
      for (const [key, one] of Object.entries(value)) out[pathsSaid(key)] = copy(one, keyed(at, key));
      return out;
    } finally {
      within.pop();
    }
  };
  const out = copy(answer, "");
  return held === null ? { answer: out, held: null } : { answer: null, held: heldWords(held) };
}

module.exports = { screenAtDoor };
