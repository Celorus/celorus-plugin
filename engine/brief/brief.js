"use strict";
// DESK-381 (the repeat walk's row 18), in the one-brief shape of DESK-464:
// the research brief as a page, every time research answers. research-lead gives the brief's parts as fields; this tool fills the person-brief
// template, brings the design system's sheets and wordmarks into it, and writes one page in
// ~/.celorus/briefs/, outside every desk, with a desk or without one. It reads and writes no desk.
//
// The shape: In one breath is one short paragraph; each fact line ends in a small number and
// carries no source word; the foot, "Where this comes from", has a block for each kind (our data,
// the web, your desk, our estimate) with its numbers and short source names; a web row links to
// its page and gives the day the page was read. A number is the line's whole answer to "where did
// this come from", so a line with no number, a number with no foot row, and a foot row no line
// uses are each refused. A foot row that labels itself worked out, estimated or read from an
// indirect signal (its `how`) is accepted in the estimate block only.
//
// What the engine checks of a fact's grade is its words and its row, and no more: a line whose
// words say "estimate" (estimated, or "est.") takes its number from the estimate block; a line numbered
// there says the words of its own row ("our estimate" for an estimate row, "worked out" for a
// worked out row, "indirect" for an indirect signal row); a line worked out or read from an
// indirect signal holds no digit and no magnitude word (thousand, lakh, crore, million, billion); an estimate row names its source. A money
// or share figure stands only in a numbered line: the breath, the meeting part, every headline and
// every other line with no number are refused when they hold one. Whether a fact truly is of the
// grade its block names, and whether a tool really returned an estimated figure, rests on the
// skill, not on this tool.
//
// What keeps a hostile web value inert (the ruling's terms, each pinned by
// tests/desk_engine/research_brief.test.js):
//   - every value is escaped for text and for attributes, and is never written as markup;
//   - a web link goes into an href only when it begins with the https or http scheme and holds no
//     space or control character; any other link (javascript:, data:, vbscript:) keeps its name
//     with no link;
//   - the page carries the template's policy: no script, nothing loaded from the web, styles,
//     fonts and images inline only. The template holds no script, and the dark theme comes from a
//     media rule this tool writes from the design sheet's own dark block, so an escaping slip
//     still runs nothing;
//   - the file name is built only from a-z, 0-9 and dashes, inside ~/.celorus/briefs/, and the
//     page is refused when ~/.celorus or its briefs folder is a link or not a folder. The page is
//     written to a new spare file opened never through a link, then renamed into place.
// The link's make never sends this tool to the desk server (link/lib/make.js STAY).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");

const TOOL = "write_research_brief";
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATE = path.join(PLUGIN_ROOT, "skills", "research-lead", "assets", "person-brief.html");
const DESIGN = path.join(PLUGIN_ROOT, "skills", "celorus-design", "assets");
// The design skill's files this tool reads, each by its own name.
const SHEETS = {
  "embedded-fonts.css": path.join(DESIGN, "embedded-fonts.css"),
  "foundation-block.css": path.join(DESIGN, "foundation-block.css"),
  "collateral.css": path.join(DESIGN, "collateral.css"),
};
const MARKS = {
  light: path.join(DESIGN, "celorus-mono-white.svg"),
  dark: path.join(DESIGN, "celorus-primary.svg"),
};
const FOLDER = [".celorus", "briefs"];

// Each part's budget, as the template's data-budget gives it.
const BUDGET = { person: 4, company: 3, figures: 2, events: 3, say: 3, careful: 2, people: 5, breath: 60, rows: 8 };
const MAX_TEXT = 2000;
const MAX_SLUG = 80;
const DAY = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/u;
const SLASHES = "/".repeat(2);
const SCHEMES = ["https:", "http:"];
// A space or a control character anywhere in a link, the line and paragraph separators among them.
const UNSAFE_IN_LINK = /[\x00-\x20\x7f-\x9f\u2028\u2029]/u;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// The foot's blocks, in the order the numbers run: the key the call gives, and the name a person reads.
const KINDS = [
  ["our_data", "Our data"],
  ["web", "The web"],
  ["desk", "Your desk"],
  ["estimate", "Our estimate"],
];
// What a fact is when it is not stated by its source: each takes its number in the estimate block.
const HOW = { estimate: "", worked_out: " (worked out)", indirect_signal: " (indirect signal)" };
// A number joins its line with a no-break space, so it never wraps alone onto the next line.
const JOIN = "&nbsp;";
// What a numbered fact's words can be checked for. A line says "estimat" (estimate, estimated,
// estimation) only when its number sits in the estimate block. A line numbered on an estimate row
// says "our estimate", on a worked out row "worked out", on an indirect signal row "indirect" or
// "indirectly": each row's own grade words, and no other grade's. Any word that starts "estimat",
// and the short form "est." with its dot, tie a line to the estimate block.
const SAYS_ESTIMATE = /\bestimat|\best\./iu;
const SAYS_ITS_GRADE = {
  estimate: { pattern: /\bour estimate\b/iu, words: '"our estimate"' },
  worked_out: { pattern: /\bworked out\b/iu, words: '"worked out"' },
  indirect_signal: { pattern: /\bindirect(?:ly)?\b/iu, words: '"indirect" or "indirectly"' },
};
// The magnitude words, and only these: thousand, lakh (lac), crore, million, billion, each with its
// plural. A worked out or indirect line (HOLDS_A_FIGURE) holds no figure of any kind: any digit, or
// any magnitude word, refuses the line. A count in words (one, two, ten, tens, hundred) is no
// magnitude word and stands there.
const MAGNITUDE_WORDS = ["thousand", "lakh", "lac", "crore", "million", "billion"];
const WORD = `\\b(?:${MAGNITUDE_WORDS.join("|")})s?\\b`;
const HOLDS_A_FIGURE = new RegExp(`\\p{N}|${WORD}`, "iu");
// The unnumbered text of the brief (UNNUMBERED_FIGURE) refuses a money or share figure by CLASS, not
// by spelling, and lets a date or a plain count pass ("since 2019", "100 people", "two meetings").
// DESK-464 fix round 6 (one-desk-wave2-base, 13 Nov). The text is folded first
// (FOLD): NFKC, then every format character (category Cf: the zero-width space, the soft hyphen, the
// directional marks) dropped, so the full-width per cent sign reads as "%" and a hidden character
// between a number and its unit falls away, as the server's fold does. The check then reads:
//   - the separator between a number and its unit or currency is any run of spaces (Zs), dashes (Pd)
//     and slashes, in either order: "12 crore", "12-crore", "12 en dash crore", "INR-40", "$-5",
//     "40/-", "12 per  cent";
//   - a number is digits, or a number in words (one ... ninety, hundred, or a magnitude word);
//   - a share unit after digits or a number word, in any case: the per cent sign, percent(s), per cent,
//     percentage points (or percentage pt, pts), pct, the unspaced p.c., bps, basis points (a bare
//     "pts" passes). The unit must be in lower case, the number before it in any case ("Twelve bp"
//     is refused, "twelve BP" prints): "pc", "pp", "bp", and the spaced "p. c." (a run of separators,
//     one or more, sits between "p." and "c", and the final dot is optional). Any other casing
//     prints, so a person's initials, a bag and a blood-pressure reading are not refused:
//     "Since 2019 P. C. Rao", "12 PP bags", "120 BP";
//   - a money unit after digits or a number word: crore, lakh, lac, million, billion, cr, crs, lacs,
//     mn, bn; "a" or "half a" before a long unit counts as a number ("a crore");
//   - a currency mark before or after a number or a number word: any currency symbol (Unicode
//     category Sc: $, euro, pound, yen, rupee and the rest), the codes INR, USD, EUR, GBP, AED, SGD,
//     JPY, CNY, AUD, CAD, CHF, HKD, and Rs; and after a number, a number word, or digits with k, m,
//     bn, mn, b or l on them, the words rupee(s), dollar(s), euro(s), pound(s). "Rs" counts after a
//     number word as it does after digits ("forty Rs", "forty Rs.", "Rs forty", "Rs. forty");
//   - the Indian rupee mark "/-" after digits ("40/-").
// A single letter (m, b, k, l) is money only behind or before a currency mark, so a bare "5M" or
// "5 L" passes. Known false refusals, accepted (Q-F, one-desk-wave2-base, 13 Nov), with no exception
// added: "the 3 Rs of", "40 RS-232 cables", "BS-6 Euro-6 norms", "one CRS report", "a 3-pc suit",
// "A million reasons", "a lakh-strong team", "One rs note" (the base ruled on 13 Nov that "Rs" after a
// number word is refused, as "40 Rs" is), "a 300 pp report" (the base ruled on 13 Nov that lower-case
// "pp" is a spelling of percentage points). Known gaps, accepted (one-desk-wave2-base, 13 Nov): any
// casing of these four that is not all lower case prints, so an upper-case "12 P. C." meant as per
// cent (Q-M) prints, as do "12 PP" or "50 BP" meant as points (Q-N) and mixed case such as "12 Pp".
// The rupee sign is written as a currency symbol class, so this file holds no character outside
// plain ASCII but the page's own punctuation (the middle dot, the curly quotes).
const SMALL_NUMBER_WORDS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred",
];
const SEP = "[\\p{Zs}\\p{Pd}\\s/]";
const SEPS = `${SEP}+`;
const SEPZ = `${SEP}*`;
const DIGITS = "\\p{Nd}(?:[\\p{Nd},.]*\\p{Nd})?";
const IN_WORDS = `\\b(?:${[...SMALL_NUMBER_WORDS, ...MAGNITUDE_WORDS].join("|")})s?\\b`;
const LONG_UNIT =
  `(?:crores?|lakhs?|lacs?|millions?|billions?|percents?|per${SEPS}cent|percentage${SEPS}(?:points?|pts?)|basis${SEPS}points?)`;
const SHORT_UNIT = `(?:crs?|lacs?|mn|bn|pct|bps|p\\.c\\.?)`;
const CODES = ["inr", "usd", "eur", "gbp", "aed", "sgd", "jpy", "cny", "aud", "cad", "chf", "hkd"];
const MONEY_WORDS = "(?:rupees?|dollars?|euros?|pounds?)";
const SYMBOL = "\\p{Sc}";
// A currency before a number: a symbol, a code, or Rs, with an optional dot after a code or Rs.
const CURRENCY = `(?:${SYMBOL}|\\b(?:rs|${CODES.join("|")})(?![\\p{L}])\\.?)`;
// A currency after digits: a symbol, a code, Rs, or a money word.
const CURRENCY_AFTER = `(?:${SYMBOL}|(?:rs|${CODES.join("|")})(?![\\p{L}])|${MONEY_WORDS}(?![\\p{L}]))`;
// A currency after a number in words: the same as after digits.
const CURRENCY_AFTER_WORD = `(?:${SYMBOL}|(?:rs|${CODES.join("|")})(?![\\p{L}])|${MONEY_WORDS}(?![\\p{L}]))`;
// A letter of magnitude on digits: "5k rupees", "5m dollars", "5 bn USD".
const MAGNITUDE_LETTER = "(?:k|m|bn|mn|b|l)";
const NO_MORE_WORD = "(?![\\p{L}\\p{N}_&])";
const UNNUMBERED_FIGURE = new RegExp(
  `${DIGITS}${SEPZ}(?:${LONG_UNIT}|${SHORT_UNIT}|%)${NO_MORE_WORD}` +
    `|${DIGITS}${SEPZ}${CURRENCY_AFTER}` +
    `|${DIGITS}${SEPZ}${MAGNITUDE_LETTER}${SEPZ}${SYMBOL}` +
    `|${DIGITS}${SEPZ}${MAGNITUDE_LETTER}${SEPS}${CURRENCY_AFTER}` +
    `|${DIGITS}[\\p{Zs}\\s]*/[\\p{Zs}\\s]*\\p{Pd}` +
    `|${CURRENCY}${SEPZ}(?:${DIGITS}|${IN_WORDS})` +
    `|${IN_WORDS}${SEPS}(?:${LONG_UNIT}|${SHORT_UNIT})${NO_MORE_WORD}` +
    `|${IN_WORDS}${SEPZ}%` +
    `|${IN_WORDS}${SEPZ}${SYMBOL}` +
    `|${IN_WORDS}${SEPS}${CURRENCY_AFTER_WORD}` +
    `|\\b(?:half${SEPS})?a${SEPS}${LONG_UNIT}${NO_MORE_WORD}`,
  "iu",
);
// "pc", "pp", "bp" and the spaced "p. c." are share units only in lower case, after digits or a number
// word: "12 pc", "twelve pp", "12 bp" and "12 p. c." are refused; "2 PC games", "12 PP bags", "120 BP"
// and "Since 2019 P. C. Rao" print. Read case-blind, then the unit itself must be in lower case.
const LOWER_UNIT = new RegExp(
  `(?:${DIGITS}${SEPZ}|${IN_WORDS}${SEPS})(pc|pp|bp|p\\.${SEPS}c\\.?)${NO_MORE_WORD}`,
  "giu",
);

// The text as the checks read it: NFKC, then no format character (Cf).
function fold(said) {
  return said.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

// The first money or share figure in a text, or null.
function figureIn(said) {
  const folded = fold(said);
  const found = UNNUMBERED_FIGURE.exec(folded);
  if (found !== null) return found;
  for (const hit of folded.matchAll(LOWER_UNIT)) if (hit[1] === hit[1].toLowerCase()) return hit;
  return null;
}

const FOLDER_SAID =
  "Research briefs are kept in ~/.celorus/briefs/, and ~/.celorus or its briefs folder is a link " +
  "or not a folder, so the brief was not written. Remove the one that is, then ask again.";

const OLD_SHAPE_SAID =
  `${TOOL} was called in the old shape of the brief, so no page was written. Give each fact line its number, \`n\`, ` +
  "and no chip; give `breath` as one paragraph of text; give a company's `people` as `rows`; and give `foot`, the " +
  "numbers by kind with their sources, in place of `built_from`. The tool's input says how.";

const ARGUMENTS = [
  "lead", "kind", "date", "intent_label", "top", "breath", "person", "people", "company",
  "events", "meeting", "care_line", "offer", "assistant_name", "foot", "company_page",
];

// ---------------------------------------------------------------------------------------------
// The values: each read as text, escaped where it is written.

function esc(value) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#x27;");
}

function text(value, where, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new Refusal(`${TOOL} needs \`${where}\`, as text.`);
    return null;
  }
  if (typeof value !== "string") throw new Refusal(`\`${where}\` is text, and this call gave something else.`);
  const kept = value.trim();
  if (kept === "") {
    if (required) throw new Refusal(`${TOOL} needs \`${where}\`, as text that is not empty.`);
    return null;
  }
  if (kept.length > MAX_TEXT) throw new Refusal(`\`${where}\` is at most ${MAX_TEXT} characters.`);
  return kept;
}

// A free text of the brief that carries no number of its own: read as text, and refused when it
// holds a money or share figure, which stands only in a numbered line with its source.
function free(value, where, opts) {
  const kept = text(value, where, opts);
  if (kept !== null) {
    const found = figureIn(kept);
    if (found !== null) {
      throw new Refusal(
        `\`${where}\` holds a money or share figure ("${found[0].trim()}"), and it has no number of its own. A figure stands only in a numbered line with its source: move it to a numbered line, or leave it out.`,
      );
    }
  }
  return kept;
}

function object(value, where, keys) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Refusal(`\`${where}\` is an object of ${keys.join(", ")}.`);
  const extra = Object.keys(value).filter((key) => !keys.includes(key));
  if (extra.length) throw new Refusal(`\`${where}\` does not take ${extra.join(", ")}. It takes: ${keys.join(", ")}.`);
  return value;
}

function list(value, where, most) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Refusal(`\`${where}\` is a list.`);
  if (value.length > most) {
    throw new Refusal(`\`${where}\` holds at most ${most} line${most === 1 ? "" : "s"}, as the brief's frame sets; this call gave ${value.length}.`);
  }
  return value;
}

// A web link as an href, or null: only the https or http scheme, with no space or control
// character anywhere once the spaces at both ends are trimmed.
function webLink(value) {
  if (typeof value !== "string") return null;
  const link = value.replace(/^ +| +$/gu, "");
  if (link === "" || UNSAFE_IN_LINK.test(link)) return null;
  const lower = link.toLowerCase();
  return SCHEMES.some((scheme) => lower.startsWith(scheme + SLASHES)) ? link : null;
}

// A day as the page says it: 2026-11-12 as 12 Nov 2026.
function dayAsRead(day) {
  return `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------------------------
// The foot, checked first: every number a line gives must name a row of it.

function number(value, where) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Refusal(`\`${where}\` is the line's number: a whole number from 1, the number of its row in the foot.`);
  }
  return value;
}

function footRow(value, where, kind) {
  const given = object(value, where, ["n", "source", "link", "read", "how"]);
  if (given === null) throw new Refusal(`\`${where}\` is a foot row: { n, source }.`);
  const n = number(given.n, `${where}.n`);
  const source = text(given.source, `${where}.source`, { required: kind !== "estimate" });
  if (source === null) {
    throw new Refusal(
      `\`${where}.source\` is the tool's answer this estimate came from, in a short name. An estimate with no source is not printed: give the tool's answer, or leave the line out.`,
    );
  }
  if (kind !== "web" && (given.link !== undefined || given.read !== undefined)) {
    throw new Refusal(`\`${where}\` names a link or a day read only in the \`web\` block.`);
  }
  if (kind !== "estimate" && given.how !== undefined) {
    throw new Refusal(
      `\`${where}\`: a fact that is worked out, estimated or read from an indirect signal takes its number in the \`estimate\` block, not in \`${kind}\`.`,
    );
  }
  let how = "";
  if (kind === "estimate") {
    if (!Object.hasOwn(HOW, given.how)) {
      throw new Refusal(`\`${where}.how\` is one of ${Object.keys(HOW).join(", ")}: say what kind of fact this number stands for.`);
    }
    how = HOW[given.how];
  }
  let html = `<span class="m">${n}</span>`;
  if (kind === "web") {
    // the link is read as given, not trimmed: a link that opens with a tab or another control character is no link
    if (typeof given.link !== "string") throw new Refusal(`${TOOL} needs \`${where}.link\`, as text: the page the web gave this.`);
    if (given.link.length > MAX_TEXT) throw new Refusal(`\`${where}.link\` is at most ${MAX_TEXT} characters.`);
    const link = given.link;
    const read = text(given.read, `${where}.read`, { required: true });
    if (!DAY.test(read)) throw new Refusal(`\`${where}.read\` is the day the page was read, as YYYY-MM-DD.`);
    const href = webLink(link);
    html += `${href === null ? esc(source) : `<a href="${esc(href)}">${esc(source)}</a>`}, read ${dayAsRead(read)}`;
  } else {
    html += `${esc(source)}${how}`;
  }
  return { n, kind, how: given.how, html };
}

// The foot as a map of number to row, with the numbers run in blocks by kind, from 1, with no gap.
function foot(args) {
  const given = object(args.foot, "foot", KINDS.map(([key]) => key));
  if (given === null) throw new Refusal(`${TOOL} needs \`foot\`: the numbers by kind, with their sources.`);
  const rows = new Map();
  const order = [];
  const blocks = KINDS.map(([key, name]) => {
    const made = list(given[key], `foot.${key}`, BUDGET.rows).map((value, at) => footRow(value, `foot.${key}.${at}`, key));
    for (const row of made) {
      if (rows.has(row.n)) throw new Refusal(`The foot gives number ${row.n} twice: each number has one row.`);
      rows.set(row.n, row);
      order.push(row.n);
    }
    return { name, made };
  });
  order.forEach((n, at) => {
    if (n !== at + 1) {
      throw new Refusal(
        `The foot's numbers run 1, 2, 3 and on with no gap, in blocks: our data, then the web, then your desk, then our estimate. Number ${n} is out of place.`,
      );
    }
  });
  const html = blocks
    .filter(({ made }) => made.length)
    .map(({ name, made }) => `<div><dt>${name}</dt><dd>${made.map((row) => row.html).join(' <span class="sep">·</span> ')}</dd></div>`)
    .join("");
  return { rows, used: new Set(), html };
}

// A number a line gives: it names a row of the foot, and the row is marked as used. `said` is the
// fact's own words, where a fact line gives them: the words are tied to the row's block.
function mark(value, where, ledger, only, said) {
  return `${JOIN}<span class="m">${take(value, where, ledger, only, said)}</span>`;
}

function take(value, where, ledger, only, said) {
  const n = number(value, `${where}.n`);
  const row = ledger.rows.get(n);
  if (row === undefined) throw new Refusal(`\`${where}\` gives number ${n}, and the foot has no row ${n}.`);
  if (only !== undefined && row.kind !== only) {
    const name = KINDS.find(([key]) => key === only)[1];
    throw new Refusal(`\`${where}\` gives number ${n}, which sits in the \`${row.kind}\` block: this one is from ${name.toLowerCase()}, so its number belongs in the \`${only}\` block.`);
  }
  if (said !== undefined) tie(said, where, n, row);
  ledger.used.add(n);
  return n;
}

// The one textual tie to a fact's grade that the engine can check: what the words say against the
// block the number sits in, and against the row's own grade. A fact's grade beyond its words rests
// on the skill.
function tie(said, where, n, row) {
  estimateTie(said, where, n, row);
  if (row.kind !== "estimate") return;
  const grade = SAYS_ITS_GRADE[row.how];
  if (!grade.pattern.test(said)) {
    throw new Refusal(
      `\`${where}\` has its number ${n} on an estimate-block row whose \`how\` is \`${row.how}\`, so its words must say ${grade.words}. Say it in the line, in those words, or give the line the number of the row that fits it.`,
    );
  }
  if (row.how !== "estimate" && (HOLDS_A_FIGURE.test(fold(said)) || figureIn(said) !== null)) {
    throw new Refusal(
      `\`${where}\` is a fact that is ${row.how === "worked_out" ? "worked out" : "read from an indirect signal"} (its foot row says \`${row.how}\`), and it holds a figure, in digits or in words. A figure is printed only when a tool returned it as an estimate, said "our estimate" with the row's \`how\` as \`estimate\`. Say this fact in words with no figure, or leave the line out.`,
    );
  }
}

// A line whose words say "estimate" (or "est.") takes its number from the estimate block.
function estimateTie(said, where, n, row) {
  if (row.kind !== "estimate" && SAYS_ESTIMATE.test(said)) {
    throw new Refusal(
      `\`${where}\` says "estimate", and its number ${n} sits in the \`${row.kind}\` block. A fact that is our estimate takes its number from the \`estimate\` block: give it the number of its row there, or take the word out of the line.`,
    );
  }
}

// A date or a start ("since", an event's "when") sits beside a numbered line and is read by the
// two checks that fit it: no money or share figure, and no "estimate" word beside a number that is
// not in the estimate block. A date and a count pass.
function dated(value, where, ledger, n) {
  const said = free(value, where, { required: true });
  const row = ledger.rows.get(n);
  if (row !== undefined) estimateTie(said, where, n, row);
  return said;
}

function line(value, where, ledger) {
  const given = object(value, where, ["text", "n"]);
  if (given === null) throw new Refusal(`\`${where}\` is a line: { text, n }.`);
  const said = text(given.text, `${where}.text`, { required: true });
  return `<li><span class="t">${esc(said)}${mark(given.n, where, ledger, undefined, said)}</span></li>`;
}

function emptyLine(value, where) {
  return `<li class="empty"><span class="t">${esc(free(value, where, { required: true }))}</span></li>`;
}

// A part's lines, or its one plain line: a part is never padded and never dropped, so a part with
// neither is refused.
function lines(given, where, most, ledger, { dated = false } = {}) {
  const rows = list(given.lines, `${where}.lines`, most).map((row, at) => (dated ? datedLine(row, `${where}.lines[${at}]`, ledger) : line(row, `${where}.lines[${at}]`, ledger)));
  const empty = text(given.empty, `${where}.empty`);
  if (rows.length === 0 && empty === null) {
    throw new Refusal(`\`${where}\` has no lines: give its one plain line in \`${where}.empty\`, which says what the part rests on.`);
  }
  if (rows.length === 0) return `<ul class="lines">${emptyLine(empty, `${where}.empty`)}</ul>`;
  return `<ul class="lines${dated ? " dated" : ""}">${rows.join("")}</ul>`;
}

function datedLine(value, where, ledger) {
  const given = object(value, where, ["when", "text", "n"]);
  if (given === null) throw new Refusal(`\`${where}\` is a dated line: { when, text, n }.`);
  const said = text(given.text, `${where}.text`, { required: true });
  const marked = mark(given.n, where, ledger, undefined, said);
  const when = dated(given.when, `${where}.when`, ledger, given.n);
  return `<li><span class="when-k">${esc(when)}</span><span class="t">${esc(said)}${marked}</span></li>`;
}

// ---------------------------------------------------------------------------------------------
// The parts, in the frame's order.

function topbar(args, marks) {
  const kind = free(args.intent_label, "intent_label");
  const when = free(args.top && args.top.when_short, "top.when_short");
  return (
    `<header class="coll-topbar"><div class="brand">` +
    `${marks.light === null ? "" : `<img class="wm wm-light" src="${esc(marks.light)}" alt="Celorus">`}` +
    `${marks.dark === null ? "" : `<img class="wm wm-dark" src="${esc(marks.dark)}" alt="Celorus"><img class="wm-print" src="${esc(marks.dark)}" alt="Celorus">`}` +
    `<span class="brand-sep"></span><span class="brand-tag">Meeting brief</span></div>` +
    `<div class="topbar-right">${kind === null ? "" : `<span class="topbar-kind">${esc(kind)}</span>`}` +
    `${when === null ? "" : `<span class="topbar-when">${esc(when)}</span>`}</div></header>`
  );
}

function top(args, lead) {
  const given = object(args.top, "top", ["role", "when_short", "when", "place", "meeting_kind"]) || {};
  const role = free(given.role, "top.role");
  const bits = [["when", "b"], ["place", "span"], ["meeting_kind", "span"]]
    .map(([key, tag]) => [free(given[key], `top.${key}`), tag])
    .filter(([value]) => value !== null)
    .map(([value, tag]) => `<${tag}>${esc(value)}</${tag}>`);
  return (
    `<section class="top" data-part="top"><div class="eyebrow">Before you meet</div><h1>${esc(lead)}</h1>` +
    `${role === null ? "" : `<p class="role">${esc(role)}</p>`}` +
    `${bits.length ? `<p class="when">${bits.join('<span class="dot">·</span>')}</p>` : ""}</section>`
  );
}

// In one breath: one short paragraph, written from the parts below and from nothing else.
function breath(args) {
  const said = free(args.breath, "breath", { required: true });
  const words = said.split(/\s+/u).length;
  if (words > BUDGET.breath) {
    throw new Refusal(`\`breath\` is one paragraph of at most ${BUDGET.breath} words, and this one has ${words}.`);
  }
  return `<section class="breath" data-part="one-breath"><div class="k-title">In one breath</div><p class="say">${esc(said)}</p></section>`;
}

function person(args, ledger) {
  const given = object(args.person, "person", ["headline", "lines", "empty", "you_and_them"]);
  if (given === null) throw new Refusal(`A person's brief needs \`person\`: headline, lines or empty, and you_and_them on a desk.`);
  const headline = free(given.headline, "person.headline", { required: true });
  return (
    `<section class="part" data-part="person"><div class="eyebrow"><span class="n">1</span> The person</div>` +
    `<h2>${esc(headline)}</h2>${lines(given, "person", BUDGET.person, ledger)}${youAndThem(given.you_and_them, ledger)}</section>`
  );
}

function youAndThem(value, ledger) {
  const given = object(value, "person.you_and_them", ["first_name", "met", "said", "still_open", "n"]);
  if (given === null) return "";
  const first = text(given.first_name, "person.you_and_them.first_name", { required: true });
  const rows = ["met", "said"].map((key) => {
    const pair = object(given[key], `person.you_and_them.${key}`, ["lead", "line"]);
    if (pair === null) return "";
    const lead = free(pair.lead, `person.you_and_them.${key}.lead`);
    const said = free(pair.line, `person.you_and_them.${key}.line`, { required: true });
    return `<li>${lead === null ? "" : `<b>${esc(lead)}</b> `}${esc(said)}</li>`;
  });
  const open = free(given.still_open, "person.you_and_them.still_open");
  if (open !== null) rows.push(`<li><span class="open">Still open:</span> ${esc(open)}</li>`);
  const at = `<span class="m">${take(given.n, "person.you_and_them", ledger, "desk")}</span>`;
  return (
    `<div class="desk"><div class="desk-head"><span class="k">You and ${esc(first)}</span>${at}</div>` +
    `<ul>${rows.join("")}</ul></div>`
  );
}

// Who matters here (a company's brief): at most five people, one to a row, the deciders first.
function people(args, ledger) {
  const given = object(args.people, "people", ["headline", "rows", "empty", "ask_for", "others"]);
  if (given === null) throw new Refusal(`A company's brief needs \`people\`: headline and rows, the people who matter here, the deciders first.`);
  const rows = list(given.rows, "people.rows", BUDGET.people);
  const empty = free(given.empty, "people.empty");
  if (rows.length === 0 && empty === null) {
    throw new Refusal("`people` has no rows: give its one plain line in `people.empty`, which says what the part rests on.");
  }
  let rest = false;
  const body = rows.map((value, at) => {
    const where = `people.rows[${at}]`;
    const row = object(value, where, ["who", "role", "since", "n", "decides"]);
    if (row === null) throw new Refusal(`\`${where}\` is a person: { who, role, since, n }.`);
    if (row.decides !== undefined && typeof row.decides !== "boolean") throw new Refusal(`\`${where}.decides\` is true or false.`);
    if (row.decides === true && rest) throw new Refusal(`\`${where}\` decides, and a person before it does not: the deciders come first.`);
    if (row.decides !== true) rest = true;
    const who = esc(text(row.who, `${where}.who`, { required: true }));
    const role = esc(text(row.role, `${where}.role`, { required: true }));
    // the claim is the role: a year in `since` is a date the tool gave, never a figure the line makes;
    // `since` is still read for a money or share figure and for an "estimate" word on a plain row
    const said = text(row.role, `${where}.role`);
    const marked = mark(row.n, where, ledger, undefined, said);
    const since = esc(dated(row.since, `${where}.since`, ledger, row.n));
    return `<tr><td>${who}</td><td>${role}</td><td class="d">${since}${marked}</td></tr>`;
  });
  const ask = free(given.ask_for, "people.ask_for");
  const others = object(given.others, "people.others", ["text", "n"]);
  const table = body.length
    ? `<table class="people"><thead><tr><th>Who</th><th>Role here</th><th>Since</th></tr></thead><tbody>${body.join("")}</tbody></table>`
    : `<ul class="lines">${emptyLine(empty, "people.empty")}</ul>`;
  return (
    `<section class="part" data-part="people"><div class="eyebrow"><span class="n">1</span> Who matters here</div>` +
    `<h2>${esc(free(given.headline, "people.headline", { required: true }))}</h2>${table}` +
    `${ask === null ? "" : `<p class="ask-for"><b>Ask for</b> ${esc(ask)}</p>`}` +
    `${others === null ? "" : othersLine(others, ledger)}</section>`
  );
}

function othersLine(others, ledger) {
  const said = text(others.text, "people.others.text", { required: true });
  return `<p class="rest">${esc(said)}${mark(others.n, "people.others", ledger, undefined, said)}</p>`;
}

function company(args, ledger) {
  const given = object(args.company, "company", ["headline", "why_this", "lines", "empty", "figures"]);
  if (given === null) throw new Refusal(`${TOOL} needs \`company\`: headline, why_this, lines or empty, and figures from our data.`);
  const why = free(given.why_this, "company.why_this");
  const figures = list(given.figures, "company.figures", BUDGET.figures).map((value, at) => {
    const where = `company.figures[${at}]`;
    const fig = object(value, where, ["label", "value", "n"]);
    if (fig === null) throw new Refusal(`\`${where}\` is a figure from our data: { label, value, n }.`);
    return (
      `<div class="fig"><div class="fig-head"><span class="k">${esc(text(fig.label, `${where}.label`, { required: true }))}</span>` +
      `<span class="m">${take(fig.n, where, ledger, "our_data")}</span></div>` +
      `<div class="v">${esc(text(fig.value, `${where}.value`, { required: true }))}</div></div>`
    );
  });
  // No figure: no tiles and no line in their place. The part's own lines, or its empty line, say what it rests on.
  const tiles = figures.length ? `<div class="figs">${figures.join("")}</div>` : "";
  return (
    `<section class="part" data-part="company"><div class="eyebrow"><span class="n">2</span> The company that matters here</div>` +
    `<h2>${esc(free(given.headline, "company.headline", { required: true }))}</h2>` +
    `${why === null ? "" : `<p class="why-this">${esc(why)}</p>`}${lines(given, "company", BUDGET.company, ledger)}${tiles}</section>`
  );
}

function events(args, ledger) {
  const given = object(args.events, "events", ["headline", "lines", "empty"]);
  if (given === null) throw new Refusal(`${TOOL} needs \`events\`: headline, and dated lines or empty.`);
  return (
    `<section class="part" data-part="event"><div class="eyebrow"><span class="n">3</span> What is happening</div>` +
    `<h2>${esc(free(given.headline, "events.headline", { required: true }))}</h2>${lines(given, "events", BUDGET.events, ledger, { dated: true })}</section>`
  );
}

function meeting(args, offerLine, ledger) {
  const care = free(args.care_line, "care_line");
  const given = object(args.meeting, "meeting", ["eyebrow", "headline", "why_it_matters", "opener", "say", "careful", "maybe_not", "ask"]);
  if (care !== null) {
    if (given !== null) throw new Refusal(`A lead handled with care gets no meeting part: leave \`meeting\` out with \`care_line\`.`);
    return `<section class="part" data-part="your-meeting"><ul class="lines"><li class="empty"><span class="t">${esc(care)}</span></li></ul>${offerLine}</section>`;
  }
  if (given === null) throw new Refusal(`${TOOL} needs \`meeting\`, or \`care_line\` for a lead handled with care.`);
  const eyebrow = free(given.eyebrow, "meeting.eyebrow") || "Your meeting";
  const why = free(given.why_it_matters, "meeting.why_it_matters");
  const opener = free(given.opener, "meeting.opener");
  const ask = free(given.ask, "meeting.ask");
  const say = list(given.say, "meeting.say", BUDGET.say).map((value, at) => `<li><span class="t">${esc(free(value, `meeting.say[${at}]`, { required: true }))}</span></li>`);
  const careful = list(given.careful, "meeting.careful", BUDGET.careful).map((value, at) => `<li><span class="t">${esc(free(value, `meeting.careful[${at}]`, { required: true }))}</span></li>`);
  return (
    `<section class="part" data-part="your-meeting"><div class="eyebrow"><span class="n">4</span> ${esc(eyebrow)}</div>` +
    `<h2>${esc(free(given.headline, "meeting.headline", { required: true }))}</h2>` +
    `${why === null ? "" : `<p class="why-you"><b>Why it matters to you.</b> ${esc(why)}</p>`}` +
    `${opener === null ? "" : `<div class="opener"><div class="small-k">Open with</div><blockquote>“${esc(opener)}”</blockquote></div>`}` +
    `<div class="plan"><div class="say"><div class="small-k">What to say</div><ul class="lines">${say.join("")}</ul></div>` +
    `<div class="careful"><div class="small-k">Be careful</div><ul class="lines">${careful.join("")}</ul>${maybeNot(given.maybe_not, ledger)}</div></div>` +
    `${ask === null ? "" : `<div class="ask"><div class="small-k">Ask for</div><p>${esc(ask)}</p></div>`}${offerLine}</section>`
  );
}

// A web mention that cannot be tied to the person at the top: apart, under Be careful.
function maybeNot(value, ledger) {
  const given = object(value, "meeting.maybe_not", ["first_name", "text", "n"]);
  if (given === null) return "";
  const at = mark(given.n, "meeting.maybe_not", ledger, "web");
  return (
    `<div class="apart"><div class="apart-head"><span class="k">Maybe not ${esc(text(given.first_name, "meeting.maybe_not.first_name", { required: true }))}</span></div>` +
    `<p><b>This may be a different person.</b> ${esc(text(given.text, "meeting.maybe_not.text", { required: true }))}${at}</p></div>`
  );
}

function offer(args) {
  const said = free(args.offer, "offer");
  if (said === null) return "";
  const who = text(args.assistant_name, "assistant_name") || "Milan";
  // the offer line names the assistant itself ("Milan can ..."), so the label is left off then
  const label = said.startsWith(`${who} `) ? "" : `<span class="who">${esc(who)}</span>`;
  return `<p class="offer" data-part="offer">${label}${esc(said)}</p>`;
}

// Where this comes from: one block for each kind, its numbers and short source names.
function footer(args, day, ledger) {
  if (args.company_page !== undefined && typeof args.company_page !== "boolean") throw new Refusal("`company_page` is true or false.");
  const unused = [...ledger.rows.keys()].filter((n) => !ledger.used.has(n));
  if (unused.length) {
    throw new Refusal(`The foot's number${unused.length === 1 ? "" : "s"} ${unused.join(", ")} ${unused.length === 1 ? "has" : "have"} no line: give ${unused.length === 1 ? "it" : "each"} a line, or leave ${unused.length === 1 ? "its row" : "the rows"} out.`);
  }
  return (
    `<footer class="foot">${ledger.html === "" ? "" : `<p class="k-title">Where this comes from</p><dl class="srcgrp">${ledger.html}</dl>`}` +
    `<p class="prov"><span class="gen">Generated by Celorus · ${day}.</span>` +
    `${args.company_page === true ? '<span class="company-page"> Full sources are on the company page.</span>' : ""}</p></footer>`
  );
}

// ---------------------------------------------------------------------------------------------
// The page: the template's head with the sheets brought in, then the parts.

function readOwn(file) {
  const st = fs.statSync(file);
  if (!st.isFile()) throw new Error(`not a regular file: ${file}`);
  return fs.readFileSync(file, "utf8");
}

// The design sheet's dark block, as a media rule on the computer's own setting, for the screen
// only, so print stays light: the same tokens the sheet gives [data-theme="dark"], and the
// wordmark swap collateral.css gives it.
function darkRule(foundation) {
  const opened = foundation.indexOf('[data-theme="dark"] {');
  const start = foundation.indexOf("{", opened);
  const end = foundation.indexOf("}", start);
  if (opened < 0 || end < 0 || foundation.indexOf('[data-theme="dark"]', opened + 1) >= 0) {
    throw new Refusal("The design sheet's dark block could not be read, so the brief was not written.");
  }
  return (
    `@media screen and (prefers-color-scheme: dark){:root{${foundation.slice(start + 1, end).trim()}}` +
    ".wm-light,.coll-topbar .brand img.wm-light{display:none}" +
    ".wm-dark,.coll-topbar .brand img.wm-dark{display:block}}"
  );
}

function head(lead, day) {
  const template = readOwn(TEMPLATE);
  const ends = template.indexOf("</head>");
  if (ends < 0 || /<script/iu.test(template)) throw new Refusal("The brief's template is not the one this tool fills, so the brief was not written.");
  let top = template.slice(0, ends);
  const sheets = {};
  for (const [name, file] of Object.entries(SHEETS)) {
    const css = readOwn(file);
    if (/<\/style/iu.test(css)) throw new Refusal(`The design sheet ${name} cannot sit in a style tag, so the brief was not written.`);
    sheets[name] = css;
  }
  for (const name of Object.keys(SHEETS)) {
    const slot = `<style data-inline="${name}"></style>`;
    if (!top.includes(slot)) throw new Refusal("The brief's template is not the one this tool fills, so the brief was not written.");
    const extra = name === "collateral.css" ? `\n<style data-inline="dark">${darkRule(sheets["foundation-block.css"])}</style>` : "";
    top = top.replace(slot, () => `<style data-inline="${name}">${sheets[name]}</style>${extra}`);
  }
  // the date first, so a lead's name that holds the date's slot stays as written
  return top
    .replace(/\{\{generated_date\}\}/gu, () => day)
    .replace("{{person_name}}", () => esc(lead));
}

// Each wordmark as a data URI of the design skill's own text, percent-encoded, or null where it
// cannot be read: the mark is then left out, never drawn.
function marksOf() {
  const uri = (file) => {
    try {
      return `data:image/svg+xml,${encodeURIComponent(readOwn(file))}`;
    } catch {
      return null;
    }
  };
  return { light: uri(MARKS.light), dark: uri(MARKS.dark) };
}

function today() {
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

// The page's file name: a-z, 0-9 and dashes only. A name with none of them is named by a short
// digest of itself. A name the letters and digits keep whole, case and spaces aside, is the lead's
// own, so the same lead on the same day replaces its page; where the name dropped anything (a mark,
// another script, a dash, the part past the cap), a short digest of the lead follows it, so two
// different leads never share a page.
function slugOf(lead) {
  const plain = lead
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/gu, "");
  // A short fixed suffix from the name, FNV-1a over its UTF-8 bytes (64 bits): it keeps two leads'
  // pages apart in the folder and is no secret, so it needs no hashing library.
  // It only names a page and secures nothing: keep it as it is, and do not swap a library in.
  const digest = (value) => {
    let h = 0xcbf29ce484222325n;
    for (const byte of Buffer.from(value, "utf8")) h = BigInt.asUintN(64, (h ^ BigInt(byte)) * 0x100000001b3n);
    return h.toString(16).padStart(16, "0").slice(0, 12);
  };
  if (plain === "") return `lead-${digest(lead)}`;
  const key = lead.normalize("NFKC").toLowerCase().trim().replace(/\s+/gu, " ");
  if (key.replace(/ /gu, "-") === plain) return plain;
  return `${plain.slice(0, MAX_SLUG - 13).replace(/-+$/gu, "")}-${digest(key)}`;
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// ~/.celorus/briefs/, made 0700 where it is not there; a link or a non-folder on the way is refused.
function briefsFolder(home) {
  let at = home;
  for (const part of FOLDER) {
    at = path.join(at, part);
    const st = lstatOrNull(at);
    if (st === null) {
      fs.mkdirSync(at, { mode: 0o700 });
    } else if (st.isSymbolicLink() || !st.isDirectory()) {
      throw new Refusal(FOLDER_SAID);
    }
  }
  return at;
}

let spares = 0;

function writePage(folder, name, page) {
  const file = path.join(folder, name);
  if (path.dirname(file) !== folder) throw new Refusal(FOLDER_SAID);
  const st = lstatOrNull(file);
  if (st !== null && !st.isFile() && !st.isSymbolicLink()) {
    throw new Refusal(`A folder or another kind of file sits where the brief goes, ${file}, so the brief was not written.`);
  }
  // the spare's name only has to differ from another writer's, as render's spares do (Math.random
  // alone): the exclusive create below refuses anything already there
  spares += 1;
  const tag = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  const spare = path.join(folder, `.brief-${Date.now()}-${spares}-${tag}.tmp`);
  const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
  const fd = fs.openSync(spare, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
  // any failure from the write to the rename takes the spare file away
  try {
    try {
      fs.writeSync(fd, page);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(spare, file);
  } catch (err) {
    fs.rmSync(spare, { force: true });
    throw err;
  }
  return file;
}

// A call in the shape this tool had before the one brief: a chip on a line, a breath of four
// labelled lines, a paragraph of people, or the one-line `built_from`. It is refused whole, before
// any part is read, so no page and no folder is made from half of it.
function inTheOldShape(args) {
  const has = (value, key) => value !== null && typeof value === "object" && Object.hasOwn(value, key);
  const rows = [args.person, args.company, args.events].flatMap((part) => (part && Array.isArray(part.lines) ? part.lines : []));
  return (
    has(args, "built_from") ||
    (args.breath !== null && typeof args.breath === "object") ||
    has(args.people, "paragraph") ||
    rows.some((row) => has(row, "chip")) ||
    has(args.meeting && args.meeting.maybe_not, "chip")
  );
}

function build(args) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Refusal(`${TOOL} takes its input as an object: ${ARGUMENTS.join(", ")}.`);
  }
  if (inTheOldShape(args)) throw new Refusal(OLD_SHAPE_SAID);
  const extra = Object.keys(args).filter((key) => !ARGUMENTS.includes(key));
  if (extra.length) throw new Refusal(`${TOOL} does not take ${extra.join(", ")}. It takes: ${ARGUMENTS.join(", ")}.`);
  const lead = text(args.lead, "lead", { required: true });
  if (args.kind !== "person" && args.kind !== "company") throw new Refusal("`kind` is person or company.");
  const day = args.date === undefined ? today() : args.date;
  if (typeof day !== "string" || !DAY.test(day)) throw new Refusal("`date` is the day as YYYY-MM-DD.");
  if (args.kind === "person" && args.people !== undefined) throw new Refusal("A person's brief takes `person`, not `people`.");
  if (args.kind === "company" && args.person !== undefined) throw new Refusal("A company's brief takes `people`, not `person`.");
  const marks = marksOf();
  const ledger = foot(args);
  // every part is read before one byte is written, so a refusal leaves no page
  const parts = [
    top(args, lead),
    breath(args),
    args.kind === "person" ? person(args, ledger) : people(args, ledger),
    company(args, ledger),
    events(args, ledger),
    meeting(args, offer(args), ledger),
    footer(args, day, ledger),
  ];
  const body = `<body>\n${topbar(args, marks)}\n<main class="sheet">\n${parts.join("\n")}\n</main>\n</body>\n</html>\n`;
  return { lead, day, name: `${slugOf(lead)}-${day}.html`, page: `${head(lead, day)}</head>\n${body}` };
}

// The answer names the page's file alone, never its full path: the door screen lets an absolute
// path through only inside the desk the caller gave (lib/fields.js), and this folder is outside
// every desk. The folder is fixed, ~/.celorus/briefs/, and the skill says it beside the name.
function writeResearchBrief(args, { home = os.homedir() } = {}) {
  const made = build(args);
  writePage(briefsFolder(home), made.name, made.page);
  return {
    tool: TOOL,
    file: made.name,
    page: `the research brief for ${made.lead}`,
    summary: `Wrote the research brief for ${made.lead}, dated ${made.day}, as ${made.name} in the research briefs folder. Nothing on the desk changed.`,
  };
}

const NUMBER_SCHEMA = { type: "integer", minimum: 1, description: "The number of this line's row in the foot." };
const LINE_SCHEMA = { type: "object", properties: { text: { type: "string" }, n: NUMBER_SCHEMA }, required: ["text", "n"], additionalProperties: false };
const DATED_SCHEMA = { type: "object", properties: { when: { type: "string" }, text: { type: "string" }, n: NUMBER_SCHEMA }, required: ["when", "text", "n"], additionalProperties: false };
const LINES = (most) => ({ type: "array", items: LINE_SCHEMA, maxItems: most });
const TEXTS = (most) => ({ type: "array", items: { type: "string" }, maxItems: most });
const S = { type: "string" };
const ROW = (description, extra = {}) => ({
  type: "array",
  description,
  maxItems: BUDGET.rows,
  items: { type: "object", properties: { n: { type: "integer", minimum: 1 }, source: S, ...extra }, required: ["n", "source", ...Object.keys(extra)], additionalProperties: false },
});
const FOOT_SCHEMA = {
  type: "object",
  description:
    "Where this comes from: the numbers the lines end in, in blocks by kind. The numbers run 1, 2, 3 and on with no gap, our data first, " +
    "then the web, then your desk, then our estimate. Every number a line gives has a row here, and every row has a line.",
  properties: {
    our_data: ROW("What our data gave: a number and a short source name each."),
    web: ROW("What the web gave: a number, the source's name, its link and the day the page was read (YYYY-MM-DD).", { link: S, read: S }),
    desk: ROW("What the seller's own desk holds: a number and a short name each."),
    estimate: ROW(
      "An estimated figure a tool returned as an estimate, or a fact that is worked out or read from an indirect signal and is not a figure, and no other: a number, the name of the tool's answer or of what it rests on, and `how`: estimate, worked_out or indirect_signal. A worked out or indirect line holds no figure.",
      { how: { enum: Object.keys(HOW) } },
    ),
  },
  additionalProperties: false,
};

const TOOLS = [
  {
    name: TOOL,
    description:
      "Write the research brief as a page, every time research answers: research-lead's seller's brief, from its fields, " +
      "in the house design, kept in ~/.celorus/briefs/ on this computer, with a desk or without one. It reads and writes " +
      "no desk. Every value is text: the tool escapes it, puts a web link in only when it begins with the https or http " +
      "scheme, and writes a page that runs no script and loads nothing from the web. Each fact line ends in a number, " +
      "`n`, with no source word on it, and the `foot` gives each number its source, by kind. A call with a line that has " +
      "no number, a number with no foot row or a foot row with no line is refused, and writes nothing. A part nothing " +
      "answers gives its one plain line in `empty`. The same lead on the same day replaces its page. Answers with the " +
      "page's `file`, its name alone, in ~/.celorus/briefs/.",
    inputSchema: {
      type: "object",
      properties: {
        lead: { type: "string", description: "The lead's name, as the brief heads it." },
        kind: { enum: ["person", "company"] },
        date: { type: "string", description: "The day, YYYY-MM-DD. Leave it out for today on this computer." },
        intent_label: { type: "string", description: "Pitch, Meeting or Call, for the top bar." },
        top: { type: "object", properties: { role: S, when_short: S, when: S, place: S, meeting_kind: S }, additionalProperties: false },
        breath: { type: "string", description: `In one breath: one paragraph of at most ${BUDGET.breath} words, written from the parts below and adding no fact of its own.` },
        person: {
          type: "object",
          description: "For a person: the person part. you_and_them only on a desk, with its `n` in the desk block.",
          properties: {
            headline: S,
            lines: LINES(BUDGET.person),
            empty: S,
            you_and_them: {
              type: "object",
              properties: {
                first_name: S,
                met: { type: "object", properties: { lead: S, line: S }, additionalProperties: false },
                said: { type: "object", properties: { lead: S, line: S }, additionalProperties: false },
                still_open: S,
                n: NUMBER_SCHEMA,
              },
              required: ["n"],
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        people: {
          type: "object",
          description: `For a company: who matters here, at most ${BUDGET.people} people, one to a row, the deciders first (\`decides\`: true).`,
          properties: {
            headline: S,
            rows: {
              type: "array",
              maxItems: BUDGET.people,
              items: {
                type: "object",
                properties: { who: S, role: S, since: S, n: NUMBER_SCHEMA, decides: { type: "boolean" } },
                required: ["who", "role", "since", "n"],
                additionalProperties: false,
              },
            },
            empty: S,
            ask_for: S,
            others: { type: "object", properties: { text: S, n: NUMBER_SCHEMA }, required: ["text", "n"], additionalProperties: false },
          },
          additionalProperties: false,
        },
        company: {
          type: "object",
          properties: {
            headline: S,
            why_this: S,
            lines: LINES(BUDGET.company),
            empty: S,
            figures: { type: "array", description: "Only values our data gave, exactly as it gave them; each `n` is a row of the our_data block.", items: { type: "object", properties: { label: S, value: S, n: NUMBER_SCHEMA }, required: ["label", "value", "n"], additionalProperties: false }, maxItems: BUDGET.figures },
          },
          additionalProperties: false,
        },
        events: { type: "object", properties: { headline: S, lines: { type: "array", items: DATED_SCHEMA, maxItems: BUDGET.events }, empty: S }, additionalProperties: false },
        meeting: {
          type: "object",
          properties: {
            eyebrow: S,
            headline: S,
            why_it_matters: S,
            opener: S,
            say: TEXTS(BUDGET.say),
            careful: TEXTS(BUDGET.careful),
            maybe_not: { type: "object", properties: { first_name: S, text: S, n: NUMBER_SCHEMA }, required: ["n"], additionalProperties: false },
            ask: S,
          },
          additionalProperties: false,
        },
        care_line: { type: "string", description: "For a lead handled with care, in place of `meeting`: the plain line that says the lead is not pitched." },
        offer: { type: "string", description: "The offer line, only when nothing follows the brief in the chat." },
        assistant_name: { type: "string", description: "The name the desk gave the assistant; Milan when left out." },
        foot: FOOT_SCHEMA,
        company_page: { type: "boolean", description: "True only when a company page was written on a desk." },
      },
      required: ["lead", "kind", "breath", "company", "events", "foot"],
      additionalProperties: false,
    },
    run: (args) => writeResearchBrief(args),
  },
];

module.exports = { TOOLS, TOOL, build, writeResearchBrief, webLink, slugOf, esc, darkRule };
