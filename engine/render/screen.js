"use strict";
// The screen the sentences sent for a page are held to before they go on it: the model may have
// just read a real mailbox or a real transcript, and its words land on the page and beside it.
// A refusal names the slot and the rule, never the sentence.
//
// Mechanism rules only (base ruling R4): a phone number, an address, a path from this
// machine, an em dash, an @, an address spelled out, a link, and seven or more digits in a row.
// The demo kit's screen also matched a fixed list of real names; that list never enters this
// repository, so names are not screened here. Ported from the kit's leak_screen.py (row E5).
//
// This fold and these rules are the writers' screen too (write/screen.js, round 1 K2): one fold,
// one set of rules, so a writer never keeps what render_view would refuse.

const os = require("node:os");
const { PY_SPACE } = require("../write/text.js");

// A path from this machine (the rule "home-path"): a home folder or a temp or scratch folder, as
// each family of machine writes one, either slash: the macOS and Windows homes (Users, with or
// without a drive, or behind a server's name), the old Windows home, the Linux homes (home,
// root), a home written with a user's name after a tilde; /tmp, /var/tmp and /private/tmp,
// /var/folders and /private/var/folders, and the Windows AppData temp. Beside them, the home and
// temp folders of the machine the engine runs on, read when it starts (os.homedir(); os.tmpdir(),
// which is TMPDIR, TMP or TEMP when set), so a home or temp outside the families is refused too;
// and a Windows drive path, a drive, its colon and a separator before a name (DESK-118).
// No folder of any machine is written here.
//
// Each is matched by its CONTENT, a path's shape wherever it sits, never by its position, and
// never as words with a slash between them (0.19.0 round 1 readers, K2b; the base's rulings R71,
// and R101 (A), K4g):
// - a path starts at a root, and a root is found by what it is:
//   - a run of slashes or backslashes, taken whole, that follows no letter, digit, "_", ".", "~"
//     or "-" (so a slash between two words, as in "Settings/Home", starts none). A drive's colon
//     may come before it, and a word's colon before a single one ("file:/x"); a scheme's colon
//     and two separators start a link's host, never a root (an https link to a users page is a
//     link, and the link rule's);
//   - a file: url, with a host (localhost, a server, wsl.localhost) or none, and an editor's url
//     whose host is the word file (vscode, cursor): the path in it is a path on a machine;
//   - a relative walk ("../..", "./"): where it resolves is not known, so a home folder after it
//     is a home folder;
// - a home folder (Users, Documents and Settings or home, and a name) is found after any run of
//   folders from its root: under a mount or a volume ("/mnt/c", "/Volumes/x",
//   "/System/Volumes/Data", "/mnt/wslg/distro", "/var"), behind a server's name
//   ("\\srv\c$\", "\\wsl$\Ubuntu\"), or straight after the root;
// - a separator is a run of them, so a backslash doubled by JSON's or Python's quoting is the
//   same separator by content (R103 (3));
// - a form of one folder goes on past a separator: "/tmp/" and "/tmp/x" are paths, "the /tmp
//   folder" is not; a form of two (Users and a name, home and a name) is a path as it stands;
// - a home written with a tilde alone ("~/", "~/folder/file") is not refused: it names no seat
//   and no machine, and it is the way the refusal asks a path to be written (the base's ruling
//   R73); "~name/" names a user, and is refused;
// - "AppData\Local\Temp" is refused wherever it stands, at a root, after a folder (which may be
//   a user's), or on its own as a relative path (0.19.0 K4b: the base's ruling R73 refuses the
//   AppData temp, and a relative one would be echoed into a row, a history line and a commit);
//   only its tilde form ("~\AppData\Local\Temp") passes, as every tilde form does.
const SEP = "[\\\\/]";
const SEPS = `${SEP}+`;
const NAME = "[^\\\\/\\s\"']+";
const END = "(?![\\p{L}\\p{N}_.-])";
const NAME_CHAR = "\\p{L}\\p{N}_.~\\-";
// A run of separators, taken whole (no separator and no name character before it). After a
// colon: a drive's ("C:"), with no name character before its letter, or a single separator;
// a word's colon and two separators are a link's scheme.
const AT_ROOT = `(?<![${NAME_CHAR}\\\\/])(?:(?<![${NAME_CHAR}+]:)|(?<=(?:^|[^${NAME_CHAR}+])[A-Za-z]:)|(?!${SEP}{2}))`;
const PLAIN_ROOT = `${AT_ROOT}${SEPS}`;
// A file: url, its host or none, and an editor's url of a file: the scheme is part of the path.
const URL_ROOT = `(?<![${NAME_CHAR}+])(?:file:(?:${SEP}{2}[^\\\\/\\s"'<>]*)?|[a-z][a-z0-9+.-]*:${SEP}{2}file)${SEPS}`;
// A relative walk: one or more "." or ".." folders.
const WALK_ROOT = `(?<![${NAME_CHAR}\\\\/])\\.{1,2}(?:${SEPS}\\.{1,2})*${SEPS}`;
const ROOT = `(?:${URL_ROOT}|${WALK_ROOT}|${PLAIN_ROOT})`;
// Any run of folders between a root and a home folder.
const DEEP = `(?:${NAME}${SEPS})*?`;
// Where a home folder's path begins (the base's ruling R108 (3), K4g-2): a root, or the start of
// a token (the text's start, or a character that is neither a name's nor a separator), then any
// run of folders; the same for every home family, the machine's own and every other ("kept at
// Users/x/", "C:Users\x\", a volume whose name holds a space, an smb host). A name alone never
// starts one, and at a token's start with no root a family needs a separator after its name:
// "Users/Admins" is a slash used as "or" and passes, "Users/Admins/" is refused (a limit, pinned
// in the table). A drive's colon with no separator after it ("C:Users\x", "Plan B:Users/x") is a
// token's start, not a root (DESK-105): the family needs a separator after its name there too, as
// the door reads it (the colon a mark, the tail a relative name). The machine's own home is found
// by its own text wherever it stands (folderForm), so it is refused in every one of these forms.
const AT_TOKEN = `(?<![${NAME_CHAR}\\\\/])`;
const HOME_AT = (folder) => `(?:${ROOT}${DEEP}${folder}${SEPS}${NAME}|${AT_TOKEN}${DEEP}${folder}${SEPS}${NAME}${SEP})`;
// A drive, its colon and a separator before a name (DESK-118): a path from a root on a machine,
// whatever folder it names, so it is refused as the families are; a drive root with no name after
// it ("C:\", then a blank or the end) is none. A drive is one letter with no name character or "+"
// before it, as AT_ROOT reads one, or one after a long-path prefix ("\\?\", "\\.\", as PATH_PREFIX
// says them; pathsSaid takes the prefix with it), a single leading separator ("/D:/", one with no
// name character, "+", "?" or separator before it) or a file url, its host or none as URL_ROOT
// reads one, before the drive, which are taken with it; the door reads each of these as rooted
// (lib/door.js FROM_ROOT: the colon a mark and the tail from a root, or the url's root the place's).
const DRIVE_PATH = `(?:(?<![${NAME_CHAR}+\\\\/])|(?<=${SEP}{2}[?.]${SEP})|(?<![${NAME_CHAR}+?\\\\/])(?:file:${SEP}{2}[^\\\\/\\s"'<>]*)?${SEP})[A-Za-z]:${SEPS}${NAME}`;
const FAMILIES = [
  HOME_AT("Users"),
  HOME_AT("Documents and Settings"),
  HOME_AT("home"),
  `${ROOT}root${SEP}`,
  `(?<![\\p{L}\\p{N}_.~\\\\/-])~[A-Za-z_][A-Za-z0-9._-]*${SEP}`,
  `${ROOT}(?:private${SEPS})?(?:var${SEPS})?tmp${SEP}`,
  `${ROOT}(?:private${SEPS})?var${SEPS}folders${SEP}`,
  `(?<![~\\\\/])${SEPS}AppData${SEPS}Local${SEPS}Temp(?:${SEP}|${END})`,
  `(?<![\\p{L}\\p{N}_.~\\\\/-])AppData${SEPS}Local${SEPS}Temp(?:${SEP}|${END})`,
  DRIVE_PATH,
];

// A character of a folder's name as a pattern: a letter or digit as itself, any other by its code
// point (\u{...}), so a character a pattern reads as an operator (".", "(", "+", "$", "[") or a
// space is matched as itself, and never as what it would mean in a pattern.
const asPattern = (ch) => (/^[A-Za-z0-9]$/u.test(ch) ? ch : `\\u{${ch.codePointAt(0).toString(16)}}`);

// A folder of this machine by its literal text, each separator a run of either slash; null for a
// root or a drive alone, which would take in every path. The folder is read as the rules read
// text (fold: NFKC, white space single), so it matches the text as the rules see it.
// - where it starts: a home of two or more names is matched WHEREVER its text appears (R101 (c),
//   pin 3): after a root, a mount, a volume, a scheme or leading text, with any root or run of
//   folders before it taken with it, so the whole path is one match. Its drive is not part of
//   the text matched (a path's drive is said with it by pathsSaid), so the home is found under a
//   WSL mount too. A scratch form of two or more names, the temp folder among them, is matched
//   the same way, wherever it sits (R110 5 (b), K4g-4b). A form of one name ("/root", or a temp
//   folder of one name) is matched at a root only: a one-name folder is a word a sentence may
//   hold ("work/tmp/x");
// - where it ends: after its last name comes a separator, or a character that cannot go on a
//   folder's name (END: no letter, digit, "_", "." or "-"), so a home named "al" is not found in
//   a folder named "alex": a path is never taken for the home because it shares the home's first
//   letters. A space may end it: a home named "a" is found in a folder named "a person", which is
//   a home folder by the families too.
function folderForm(dir, anywhere) {
  if (typeof dir !== "string") return null;
  const parts = fold(dir).text.split(/[\\/]+/u);
  while (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  const names = parts.filter((p) => p && !/^[A-Za-z]:$/u.test(p));
  if (!names.length) return null;
  if (anywhere && names.length > 1) {
    const body = names.map((p) => [...p].map(asPattern).join("")).join(SEPS);
    // its end: a separator, no name character, or a full stop that no name character follows (R110 5 (c))
    return `(?:(?:${ROOT}|${AT_TOKEN})${DEEP}|(?<![\\\\/])${SEPS})${body}(?:${SEP}|${END}|\\.${END})`;
  }
  const body = parts.map((p) => [...p].map(asPattern).join("")).join(SEPS);
  return `${AT_ROOT}${body}${names.length > 1 ? `(?:${SEP}|${END})` : SEP}`;
}

// The rule over the given folders and the families: exported so a test can hold a machine's own
// folders apart from the families. `homes` are matched wherever they appear (folderForm), each
// before the families, so where a home and a family both start at one place the home, the
// longer text, is the match (a home whose name holds a space is said whole by pathsSaid).
// A scratch folder is matched by the rule a home is (the base's rulings R122 and R123, K4g-4b):
// a form of two or more names wherever its text appears, a word and a separator before it too,
// and a form of one name at a root (folderForm), so a scratch path glued to a word is refused
// and a sentence's "work/tmp/x" passes. The scratch forms: the families' of two or more names
// (the var folders, the private tmp, the var tmp, each with and without the private prefix; the
// AppData temp's family is matched anywhere already), and `folders` (the machine's own temp),
// each as given and as its real path where a link names it, as the own homes are (R110 5 (b)).
// folderForm's note on where a form starts states this same rule.
const SCRATCH = [["private", "var", "folders"], ["var", "folders"], ["private", "tmp"], ["private", "var", "tmp"], ["var", "tmp"]].map((names) => ["", ...names].join("/"));
function realOf(dir) {
  try {
    return [require("node:fs").realpathSync(dir)];
  } catch {
    // a folder that is not there has no real path; its text as given still holds
    return [];
  }
}
function machinePath(folders, homes = []) {
  const forms = [];
  const scratch = [...SCRATCH, ...folders.flatMap((dir) => (typeof dir === "string" && dir ? [dir, ...realOf(dir)] : [dir]))];
  for (const dir of [...homes, ...scratch]) {
    const form = folderForm(dir, true);
    if (form && !forms.includes(form)) forms.push(form);
  }
  for (const form of FAMILIES) forms.push(form);
  return new RegExp(forms.join("|"), "iu");
}

// This machine's home folders by their text: os.homedir() (HOME, or USERPROFILE on Windows,
// where the environment sets one: a shell may set a home the system does not name), and the
// account's own home (os.userInfo()) where it differs; and its temp folder (os.tmpdir(), which is
// TMPDIR, TMP or TEMP when set).
function ownHomes() {
  const out = [];
  for (const read of [() => os.homedir(), () => os.userInfo().homedir]) {
    try {
      const home = read();
      if (typeof home === "string" && home && !out.includes(home)) out.push(home);
      // its real path too, where a link names it (R110 5 (b)); a home that is not there has none
      out.push(...[require("node:fs").realpathSync(home)].filter((real) => !out.includes(real)));
    } catch {
      // A machine with no home to name has none to screen for; the families still hold.
    }
  }
  return out;
}

function ownTemp() {
  try {
    return [os.tmpdir()];
  } catch {
    return [];
  }
}

// The rules each read for their first match only (first), so each is declared once with the
// flags that asks for, and no g: a match without g carries where it was found.
const PHONE = /(?<![\dX])(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\dX])/;
const EMAIL = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;
const EM_DASH = /\u2014/;
const AT_SIGN = /@/;
const AT_DOT = /(?<![a-z])at(?![a-z])[\s\S]*(?<![a-z])dot(?![a-z])/i;
// A link is a scheme, a www., or a host with something after it that only an address carries:
// a path (x.com/path, bit.ly/abc), a query (evil.io?x=1), a fragment (x.com#f) or a port
// (x.com:8080) (the base's ruling R77). A query or a fragment starts with a word character, so a
// question that ends on a file name ("did they read notes.txt?") is not one. A page of the desk
// (a name ending .md) followed by a heading, a query or a line ("log.md:12", as 64 pages of our
// desk of record cite one) is a page and its place, not a link. A bare name.ext is not a link: a
// file name (notes.txt, report.pdf) and a bare host (example.com) have the same shape, and .md or
// .ai is both a file ending and a domain, so the bare form passes and the rule yields (R74).
const LINK_TEXT = /(?<![a-z0-9])(?:[a-z][a-z0-9+.-]*:[/]{2}|www\.|(?:mailto|tel):|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?=\/)|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?!md(?![a-z]))[a-z]{2,}(?=[?#][a-z0-9_%=&-]|:\d{1,5}(?!\d)))/i;
const CLOCK_TIME = /(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g;
const DIGITS = /\d{7,}/;

const WRONG = {
  phone: "carries a phone number that is not masked",
  email: "carries an address that is not on a .example domain",
  "home-path": "carries a path from this machine",
  "em-dash": "carries an em dash",
  "at-sign": "carries an @, the way an address is written",
  "at-dot": "spells an address out as at and dot",
  link: "carries a link",
  digits: "carries seven or more digits in a row, the way a phone number is written",
};
const SAY_INSTEAD = {
  phone: "a number on this desk is stored masked, like +91 98XXX XX796",
  email: "leave the address out: the desk keeps names, never addresses",
  "home-path": "write the file's name alone, or the path from the home folder in its tilde form, like ~/folder/file",
  "em-dash": "no page on this desk carries an em dash: write it with a comma, a colon or a full stop",
  "at-sign": "leave the address out: a page names people, never where to reach them",
  "at-dot": "leave the address out: a page names people, never where to reach them",
  link: "leave the link out: a page says what a thing is, never where it lives",
  digits: "leave the number out, or say it in words: seven digits in a row read as a phone number",
};

// A digit's value: every decimal digit (\p{Nd}), in any script, as its ASCII digit (Unicode
// keeps each script's digits in runs of ten from zero, so it is its distance from the start of
// its run, modulo ten); any other number character (\p{N}: a dingbat or double-circled numeral,
// an Ethiopic or Suzhou one) reads as a digit too, and is counted as 0.
function digitOf(ch) {
  if (!/\p{Nd}/u.test(ch)) return "0";
  const code = ch.codePointAt(0);
  let start = code;
  while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start -= 1;
  return String((code - start) % 10);
}

// An html character reference as typed. Every slot a page draws the model's sentences in goes
// through W.escape (templates/parts.js delinker), so the reader sees a reference exactly as it
// was sent and it is never decoded here (base ruling R20): its digits are digits the reader sees,
// and its other characters are markup, which parts no number.
const REFERENCE = /&(?:#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{M}]/u;

// Folded text, each character with the span of the original it came from ([start, end) in code
// units), so a rule run on the fold reports where it is in what was sent.
class Folded {
  constructor(text = "", starts = [], ends = []) {
    this.text = text;
    this.starts = starts;
    this.ends = ends;
  }

  // the span of the original under folded [from, to)
  span(from, to) {
    return [this.starts[from], this.ends[to - 1]];
  }

  // each match of `re` replaced by `fn(match)`: a replacement as long as its match keeps each
  // character's span, any other takes the whole match's
  replace(re, fn) {
    const out = new Folded();
    let last = 0;
    for (const m of this.text.matchAll(re)) {
      out.push(this, last, m.index);
      const by = fn(m);
      for (let i = 0; i < by.length; i += 1) {
        const [a, b] = by.length === m[0].length ? this.span(m.index + i, m.index + i + 1) : this.span(m.index, m.index + m[0].length);
        out.add(by[i], a, b);
      }
      last = m.index + m[0].length;
    }
    out.push(this, last, this.text.length);
    return out;
  }

  // the characters `keep` keeps, each with its span
  filter(keep) {
    const out = new Folded();
    for (const [i, ch] of this.points()) if (keep(ch)) out.push(this, i, i + ch.length);
    return out;
  }

  // without the spaces at either end
  trimmed() {
    let a = 0;
    let b = this.text.length;
    while (a < b && this.text[a] === " ") a += 1;
    while (b > a && this.text[b - 1] === " ") b -= 1;
    const out = new Folded();
    out.push(this, a, b);
    return out;
  }

  // [index, character] for each code point
  *points() {
    let i = 0;
    while (i < this.text.length) {
      const ch = String.fromCodePoint(this.text.codePointAt(i));
      yield [i, ch];
      i += ch.length;
    }
  }

  add(chars, start, end) {
    for (const ch of chars) {
      for (let k = 0; k < ch.length; k += 1) {
        this.text += ch[k];
        this.starts.push(start);
        this.ends.push(end);
      }
    }
  }

  push(from, a, b) {
    this.text += from.text.slice(a, b);
    this.starts.push(...from.starts.slice(a, b));
    this.ends.push(...from.ends.slice(a, b));
  }
}

// Text as the rules read it: each character by NFKC (which folds full-width, circled and other
// compatibility numerals to digits), every default-ignorable code point (a zero-width joiner, a
// Hangul filler) and every combining mark out, every number character an ASCII digit (digitOf),
// a curly apostrophe straight, and white space single, white space being Python's as the kit
// read it (PY_SPACE: U+001C to U+001F and U+0085 too). An html reference stays as typed.
const SPACE_RUN = new RegExp(`[${PY_SPACE}]+`, "gu");

function fold(text) {
  const src = String(text);
  const out = new Folded();
  let i = 0;
  while (i < src.length) {
    // a character with the marks after it, so a decomposed accent composes (NFC) before any rule
    // or the machine's own home (folderForm reads it by this fold) is matched (R110 5 (a))
    let ch = String.fromCodePoint(src.codePointAt(i));
    ch += /^\p{M}*/u.exec(src.slice(i + ch.length, i + 64))[0];
    for (const c of ch.normalize("NFKC")) {
      if (INVISIBLE.test(c)) continue;
      out.add(/\p{N}/u.test(c) ? digitOf(c) : c === "\u2019" ? "'" : c, i, i + ch.length);
    }
    i += ch.length;
  }
  return out.replace(SPACE_RUN, () => " ").trimmed();
}

// The fold without accents: each character's decomposition without its marks.
function unaccented(folded) {
  const out = new Folded();
  for (const [i, ch] of folded.points()) {
    out.add(ch.normalize("NFKD").replace(/\p{Mn}/gu, "").normalize("NFKC"), ...folded.span(i, i + ch.length));
  }
  return out;
}

// The path rule, built when the engine starts, once the fold it reads a folder by is defined.
const HOME = machinePath(ownTemp(), ownHomes());

function found(rule, folded, m) {
  const [start, end] = folded.span(m.index, m.index + m[0].length);
  return { rule, start, end };
}

function first(rule, folded, re, out) {
  const m = folded.text.match(re);
  if (m) out.push(found(rule, folded, m));
}

// The text the path rule reads (DESK-102, R108 item 4): one percent-decode of a separator written as
// percent 2F or percent 5C (either case), then one fold of the look-alike separators (division
// slash, fraction slash, big solidus, fullwidth solidus) to a plain one, both before the families
// run, so a home written with either is the home. One decode: a second encoding is left. Only the
// separators are decoded: a decoder of any escape is a speller the engine holds at six (R68) and
// could spell a bracket, so another escape (a letter's) is left, a named limit (the class table,
// row 102-12). Only the path rule reads it: an escape is no @ and no digit.
const PERCENT_SEPARATOR = /%(?:2f|5c)/giu;
const LOOK_ALIKE = /[\u2215\u2044\u29f8\uff0f]/gu;
const pathForm = (folded) => folded.replace(PERCENT_SEPARATOR, (m) => (m[1] === "2" ? "/" : "\\")).replace(LOOK_ALIKE, () => "/");
// The same separators in a text as pathsSaid reads it, each kept at its own place: each character
// the finder's text (pathForm of the fold) reads as a separator is one here, every code unit of
// what was sent under it, so a percent separator (three characters, or more with an invisible in
// it, or in fullwidth characters) is read as that many separators, and a separator the fold makes
// (a fullwidth or small reverse solidus) as one; a place in this text is the same place in the
// text said (DESK-102: the said text masks what the finder reads; panel 2 round 3, V1). Every
// other character is as sent, so a path's end is read at the marks as sent.
function separatorsAt(text) {
  const read = pathForm(fold(text));
  const at = text.split("");
  for (let i = 0; i < read.text.length; i += 1) {
    if (read.text[i] === "/" || read.text[i] === "\\") at.fill(read.text[i], read.starts[i], read.ends[i]);
  }
  return at.join("");
}

function textRules(folded, out) {
  first("phone", folded, PHONE, out);
  for (const m of folded.text.matchAll(EMAIL)) if (!m[1].endsWith(".example")) out.push(found("email", folded, m));
  first("home-path", pathForm(folded), HOME, out);
  first("em-dash", folded, EM_DASH, out);
}

// The rules a page's own text is never refused for (the base's ruling R72, K2c): a path it holds.
// The screen guards what a tool says, not what the desk holds, so where the text screened is the
// desk's own (sentences saved by an earlier render, a linked page's title), a path in it is no
// refusal; the model's new words are held to every rule where they are sent.
const OWN_TEXT = new Set(["home-path"]);
const NONE = new Set();
// Every rule but the path rule: the model's words, links read in its own words, are held to the
// path rule alone, since the page's reading of them was held to the rest.
const PATH_ONLY = new Set(Object.keys(WRONG).filter((rule) => rule !== "home-path"));

// The rules a text breaks, in the order the kit's live screen finds them, each with where it is
// in the text as sent ({rule, start, end}, code units): empty when it is clean. The rules run on
// the fold, so a digit is anything that reads as one. The rules in `skip` are left out.
function findings(text, skip = NONE) {
  return allFindings(text).filter((f) => !skip.has(f.rule));
}

function allFindings(text) {
  const plain = fold(text);
  const bare = unaccented(plain);
  const out = [];
  textRules(plain, out);
  if (bare.text !== plain.text) textRules(bare, out);
  first("at-sign", plain, AT_SIGN, out);
  first("at-dot", plain, AT_DOT, out);
  first("link", plain, LINK_TEXT, out);
  const kept = plain.replace(CLOCK_TIME, (m) => `${m[1]}h${m[2]}`).replace(REFERENCE, (m) => m[0].replace(/\D/g, ""));
  const joined = kept.filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  first("digits", joined, DIGITS, out);
  return out;
}

// The rules a text breaks, in the order the kit's live screen finds them; empty when it is clean.
function screen(text, skip = NONE) {
  return findings(text, skip).map((f) => f.rule);
}

// The text as the rules read it.
// A text with each path in it said as "(a path)" and the rest kept as it is (R73: no answer
// repeats a path; 0.19.0 K4b, the page lines check_desk quotes). This is the ONE place a text a
// tool quotes back is said without its paths (the base's ruling R101 (b), K4g): every Refusal
// or fault that quotes a page's text, and every answer that echoes one, goes through it. A path
// is what the path rule finds (by its content, wherever it sits: a mount, a volume, a scheme, a
// relative walk, leading text), from a drive or a long-path prefix before its root to the space,
// quote or bracket after it (a comma, stop, semicolon or colon that ends a clause, before a blank
// or the end of the text, is the sentence's: DESK-157; a colon before a letter or a digit is the
// path's), and a home written with a tilde, which ends at the same marks and goes on past them as
// below (DESK-187: PATH_GOES_ON's run); "~/" alone names no folder and is left. A folder's name may
// hold a space: where the word after a blank (any run of white space, as the path's end reads one)
// goes on as a path (it holds a separator before the next blank, quote or bracket), the path goes
// on through it (panel round 2, finding 7), so a home folder named "a person" is said whole with
// the path under it. A comma, stop, semicolon or colon before the blank is the name's too when the
// word after it goes on as a path (a name holds ", ", ". ", "; " or ": ", as a folder named
// "Accounts: north" or "Dr. Rao"), and the sentence's only when no path goes on after it (DESK-157;
// panel 2 round 3, V2: the marks and blanks the end stops at). The path's end is read in the separators the finder reads (separatorsAt, DESK-102),
// so a path written in percent or look-alike separators is said whole too. The machine's own home is
// matched by its literal text (folderForm), its space in it, so it is said whole by the rule's
// own match.
const TILDE_PATH = /(?<![\p{L}\p{N}_.~\\/-])~[\\/](?:(?![,.;:](?:\s|$))[^\s"'`<>|])+(?:[,.;:]?\s+(?=[^\s"'`<>|()]*[\\/])(?:(?![,.;:](?:\s|$))[^\s"'`<>|])+)*/gu;
const PATH_PREFIX = /(?:[\\/]{2}[?.][\\/](?:UNC[\\/])?)?(?:[A-Za-z]:)?$/u;
const PATH_STOP = /^(?:[\s"'`<>|()]|[,.;:](?:\s|$))/u;
const PATH_GOES_ON = /^[,.;:]?\s+[^\s"'`<>|()]*[\\/]/u;
// How many separators a text holds as the path rule reads it (textRules): each "/" or "\\" in the
// fold with its percent and look-alike separators read (pathForm), and, where the fold without
// accents differs, each in it read the same way, since a separator may be one only without accents
// (a percent escape whose letter carries one, "%2" and an accented F). The most passes pathsSaid
// may take (DESK-196).
const SEPARATOR = /[\\/]/gu;
const separatorsIn = (folded) => (pathForm(folded).text.match(SEPARATOR) || []).length;
function separatorsRead(text) {
  const plain = fold(text);
  const bare = unaccented(plain);
  return separatorsIn(plain) + (bare.text === plain.text ? 0 : separatorsIn(bare));
}
// DESK-196: the passes are bounded, and no text whose spans hold reaches the bound. Where a folded
// text's characters and its spans come apart (the door walk's replay of a marked receiver, Folded.
// replace's `this`), a pass splices "(a path)" where the path is not, the path stays, and an
// unbounded loop grew one text from 85 characters to about 21,000. Why the bound ends every loop
// and changes no answer where the spans hold, read on the count separatorsRead takes, the fold's
// separators and, where the fold without accents differs, its separators too:
// - every form the path rule matches holds a separator as it reads one: each family and each of
//   this machine's folders is written with SEP or SEPS (FAMILIES, folderForm). A hit is a match in
//   the fold or in the fold without accents (textRules runs on both), so it holds a separator that
//   form's count counts;
// - a pass says [start, end), which holds the whole of its hit, so the code units of that
//   separator go, and the count of the form the hit came from falls by one or more. The "(a path)"
//   put in their place adds none to either form and joins nothing across it into one: it is plain
//   letters, a blank and brackets, no separator, no part of a percent escape, no accented letter and
//   no base a mark composes with. So neither form's count rises, and a text whose fold without
//   accents is its fold stays so (no accented letter comes into it). A pass may expose a match the
//   text did not hold before (a drive taken with the hit's prefix, a scratch form left before it),
//   but it holds a separator still counted;
// - so each pass lowers the count by one or more, and a text takes at most as many passes as its
//   count before the first. Past that, a hit left is a text whose spans did not hold, and it fails
//   closed: the whole text is said as the screen says a home-path finding in a quoted text,
//   "(a path)" (R73), the answer pathsSaid gives a text that is a path whole, so no path text goes
//   out and every caller gets a value it already reads (lib/tools.js entrySaid).
function pathsSaid(text) {
  if (typeof text !== "string") return text;
  let out = text.replace(TILDE_PATH, "(a path)");
  let passes = null;
  for (let hit = allFindings(out).find((f) => f.rule === "home-path"); hit; hit = allFindings(out).find((f) => f.rule === "home-path")) {
    if (passes === null) passes = separatorsRead(out);
    if (passes === 0) return "(a path)";
    passes -= 1;
    const start = hit.start - PATH_PREFIX.exec(out.slice(0, hit.start))[0].length;
    const read = separatorsAt(out);
    let end = hit.end;
    for (;;) {
      while (end < read.length && !PATH_STOP.test(read.slice(end, end + 2))) end += 1;
      const on = PATH_GOES_ON.exec(read.slice(end));
      if (on === null) break;
      end += on[0].length;
    }
    out = `${out.slice(0, start)}(a path)${out.slice(end)}`;
  }
  return out;
}

function normalised(text) {
  return fold(text).text;
}

function* lines(value) {
  if (value !== null && typeof value === "object") {
    for (const item of Array.isArray(value) ? value : Object.values(value)) yield* lines(item);
  } else if (value !== null && value !== undefined) {
    yield String(value);
  }
}

function said(key, rule) {
  const where = /^[a-z_]{1,40}$/.test(key) ? `a sentence in the prose's ${key}` : "a sentence in the prose";
  return `${where} ${WRONG[rule]}; ${SAY_INSTEAD[rule]}, and render the page again. Nothing was rendered.`;
}

// Why the sentences sent for a page cannot go on it, or null: each sentence as it was sent.
function proseRefusal(prose, skip = NONE) {
  const slots = prose !== null && typeof prose === "object" && !Array.isArray(prose) ? Object.entries(prose) : [["summary", prose]];
  for (const [key, value] of slots) {
    for (const text of lines(value)) {
      const found = screen(text, skip);
      if (found.length) return said(key, found[0]);
    }
  }
  return null;
}

// Why the page cannot say what it would, or null: each sentence the model sent as the page
// shows it, [slot, text] in the order the page draws them (templates/parts.js pageContext). A
// link reads as its words and a list's lines as the one line the page joins them into, so a
// number split across two links or two lines is read whole. Held before anything is written.
function shownRefusal(shown, skip = NONE) {
  for (const [slot, text] of shown) {
    const found = screen(text, skip);
    if (found.length) return said(slot, found[0]);
  }
  return null;
}

module.exports = { screen, findings, pathsSaid, proseRefusal, shownRefusal, normalised, machinePath, WRONG, SAY_INSTEAD, OWN_TEXT, PATH_ONLY, LINK_TEXT };
