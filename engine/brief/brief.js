"use strict";
// DESK-381 (the repeat walk's row 18):
// the research brief as a page, every time research answers. research-lead gives the brief's parts as fields; this tool fills the person-brief
// template, brings the design system's sheets and wordmarks into it, and writes one page in
// ~/.celorus/briefs/, outside every desk, with a desk or without one. It reads and writes no desk.
//
// What keeps a hostile web value inert (the ruling's terms, each pinned by
// tests/desk_engine/research_brief.test.js):
//   - every value is escaped for text and for attributes, and is never written as markup;
//   - a web link goes into an href only when it begins with the https or http scheme and holds no
//     space or control character; any other link (javascript:, data:, vbscript:) keeps its chip
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
const BUDGET = { person: 4, company: 3, figures: 2, events: 3, say: 3, careful: 2 };
const MAX_TEXT = 2000;
const MAX_SLUG = 80;
const DAY = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/u;
const SLASHES = "/".repeat(2);
const SCHEMES = ["https:", "http:"];
// A space or a control character anywhere in a link, the line and paragraph separators among them.
const UNSAFE_IN_LINK = /[\x00-\x20\x7f-\x9f\u2028\u2029]/u;
// The chip a person reads for a line or a figure from our data; the argument stays `from: record`.
const OUR_DATA = "our data";

const FOLDER_SAID =
  "Research briefs are kept in ~/.celorus/briefs/, and ~/.celorus or its briefs folder is a link " +
  "or not a folder, so the brief was not written. Remove the one that is, then ask again.";

const ARGUMENTS = [
  "lead", "kind", "date", "intent_label", "top", "breath", "person", "people", "company",
  "events", "meeting", "care_line", "offer", "assistant_name", "built_from", "company_page",
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

// A line's chip: record, desk, or web with the site's name, linked only by webLink.
function chip(value, where) {
  const given = object(value, where, ["from", "site", "link"]);
  if (given === null) throw new Refusal(`\`${where}\` is the line's chip: { from: record, desk or web }.`);
  if (given.from === "record" || given.from === "desk") {
    if (given.site !== undefined || given.link !== undefined) {
      throw new Refusal(`\`${where}\` names a site or a link only when it is from the web.`);
    }
    return `<span class="src">${given.from === "record" ? OUR_DATA : "desk"}</span>`;
  }
  if (given.from !== "web") throw new Refusal(`\`${where}.from\` is one of record, desk, web.`);
  const site = text(given.site, `${where}.site`, { required: true });
  if (given.link !== undefined && given.link !== null && typeof given.link !== "string") {
    throw new Refusal(`\`${where}.link\` is text.`);
  }
  if (typeof given.link === "string" && given.link.length > MAX_TEXT) {
    throw new Refusal(`\`${where}.link\` is at most ${MAX_TEXT} characters.`);
  }
  const href = webLink(given.link);
  return href === null
    ? `<span class="src">web · ${esc(site)}</span>`
    : `<a class="src" href="${esc(href)}">web · ${esc(site)}</a>`;
}

function line(value, where) {
  const given = object(value, where, ["text", "chip"]);
  if (given === null) throw new Refusal(`\`${where}\` is a line: { text, chip }.`);
  return `<li><span class="t">${esc(text(given.text, `${where}.text`, { required: true }))}</span>${chip(given.chip, `${where}.chip`)}</li>`;
}

function emptyLine(value, where) {
  return `<li class="empty"><span class="t">${esc(text(value, where, { required: true }))}</span></li>`;
}

// A part's lines, or its one plain line: a part is never padded and never dropped, so a part with
// neither is refused.
function lines(given, where, most, { dated = false } = {}) {
  const rows = list(given.lines, `${where}.lines`, most).map((row, at) => (dated ? datedLine(row, `${where}.lines[${at}]`) : line(row, `${where}.lines[${at}]`)));
  const empty = text(given.empty, `${where}.empty`);
  if (rows.length === 0 && empty === null) {
    throw new Refusal(`\`${where}\` has no lines: give its one plain line in \`${where}.empty\`, which says what the part rests on.`);
  }
  if (rows.length === 0) return `<ul class="lines">${emptyLine(empty, `${where}.empty`)}</ul>`;
  return `<ul class="lines${dated ? " dated" : ""}">${rows.join("")}</ul>`;
}

function datedLine(value, where) {
  const given = object(value, where, ["when", "text", "chip"]);
  if (given === null) throw new Refusal(`\`${where}\` is a dated line: { when, text, chip }.`);
  const when = text(given.when, `${where}.when`, { required: true });
  return `<li><span class="when-k">${esc(when)}</span><span class="t">${esc(text(given.text, `${where}.text`, { required: true }))}</span>${chip(given.chip, `${where}.chip`)}</li>`;
}

// ---------------------------------------------------------------------------------------------
// The parts, in the frame's order.

function topbar(args, marks) {
  const kind = text(args.intent_label, "intent_label");
  const when = text(args.top && args.top.when_short, "top.when_short");
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
  const role = text(given.role, "top.role");
  const bits = [["when", "b"], ["place", "span"], ["meeting_kind", "span"]]
    .map(([key, tag]) => [text(given[key], `top.${key}`), tag])
    .filter(([value]) => value !== null)
    .map(([value, tag]) => `<${tag}>${esc(value)}</${tag}>`);
  return (
    `<section class="top" data-part="top"><div class="eyebrow">Before you meet</div><h1>${esc(lead)}</h1>` +
    `${role === null ? "" : `<p class="role">${esc(role)}</p>`}` +
    `${bits.length ? `<p class="when">${bits.join('<span class="dot">·</span>')}</p>` : ""}</section>`
  );
}

function breath(args) {
  const given = object(args.breath, "breath", ["who", "why_now", "open_with", "ask_for"]);
  if (given === null) throw new Refusal(`${TOOL} needs \`breath\`: who, why_now, and, unless the lead is handled with care, open_with and ask_for.`);
  const rows = [["who", "Who"], ["why_now", "Why now"], ["open_with", "Open with"], ["ask_for", "Ask for"]]
    .map(([key, label]) => [label, text(given[key], `breath.${key}`, { required: key === "who" })])
    .filter(([, value]) => value !== null)
    .map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`);
  return `<section class="breath" data-part="one-breath"><div class="k-title">In one breath</div><dl>${rows.join("")}</dl></section>`;
}

function person(args) {
  const given = object(args.person, "person", ["headline", "lines", "empty", "you_and_them"]);
  if (given === null) throw new Refusal(`A person's brief needs \`person\`: headline, lines or empty, and you_and_them on a desk.`);
  const headline = text(given.headline, "person.headline", { required: true });
  return (
    `<section class="part" data-part="person"><div class="eyebrow"><span class="n">1</span> The person</div>` +
    `<h2>${esc(headline)}</h2>${lines(given, "person", BUDGET.person)}${youAndThem(given.you_and_them)}</section>`
  );
}

function youAndThem(value) {
  const given = object(value, "person.you_and_them", ["first_name", "met", "said", "still_open"]);
  if (given === null) return "";
  const first = text(given.first_name, "person.you_and_them.first_name", { required: true });
  const rows = ["met", "said"].map((key) => {
    const pair = object(given[key], `person.you_and_them.${key}`, ["lead", "line"]);
    if (pair === null) return "";
    const lead = text(pair.lead, `person.you_and_them.${key}.lead`);
    const said = text(pair.line, `person.you_and_them.${key}.line`, { required: true });
    return `<li>${lead === null ? "" : `<b>${esc(lead)}</b> `}${esc(said)}</li>`;
  });
  const open = text(given.still_open, "person.you_and_them.still_open");
  if (open !== null) rows.push(`<li><span class="open">Still open:</span> ${esc(open)}</li>`);
  return (
    `<div class="desk"><div class="desk-head"><span class="k">You and ${esc(first)}</span><span class="src">desk</span></div>` +
    `<ul>${rows.join("")}</ul></div>`
  );
}

function people(args) {
  const given = object(args.people, "people", ["headline", "paragraph"]);
  if (given === null) throw new Refusal(`A company's brief needs \`people\`: headline and paragraph, the people who matter here.`);
  return (
    `<section class="part" data-part="people"><div class="eyebrow"><span class="n">1</span> The people who matter here</div>` +
    `<h2>${esc(text(given.headline, "people.headline", { required: true }))}</h2>` +
    `<p class="why-this">${esc(text(given.paragraph, "people.paragraph", { required: true }))}</p></section>`
  );
}

function company(args) {
  const given = object(args.company, "company", ["headline", "why_this", "lines", "empty", "figures"]);
  if (given === null) throw new Refusal(`${TOOL} needs \`company\`: headline, why_this, lines or empty, and figures from our data.`);
  const why = text(given.why_this, "company.why_this");
  const figures = list(given.figures, "company.figures", BUDGET.figures).map((value, at) => {
    const where = `company.figures[${at}]`;
    const fig = object(value, where, ["label", "value"]);
    if (fig === null) throw new Refusal(`\`${where}\` is a figure from our data: { label, value }.`);
    return (
      `<div class="fig"><div class="fig-head"><span class="k">${esc(text(fig.label, `${where}.label`, { required: true }))}</span>` +
      `<span class="src">${OUR_DATA}</span></div><div class="v">${esc(text(fig.value, `${where}.value`, { required: true }))}</div></div>`
    );
  });
  // No figure: no tiles and no line in their place. The part's own lines, or its empty line, say what it rests on.
  const tiles = figures.length ? `<div class="figs">${figures.join("")}</div>` : "";
  return (
    `<section class="part" data-part="company"><div class="eyebrow"><span class="n">2</span> The company that matters here</div>` +
    `<h2>${esc(text(given.headline, "company.headline", { required: true }))}</h2>` +
    `${why === null ? "" : `<p class="why-this">${esc(why)}</p>`}${lines(given, "company", BUDGET.company)}${tiles}</section>`
  );
}

function events(args) {
  const given = object(args.events, "events", ["headline", "lines", "empty"]);
  if (given === null) throw new Refusal(`${TOOL} needs \`events\`: headline, and dated lines or empty.`);
  return (
    `<section class="part" data-part="event"><div class="eyebrow"><span class="n">3</span> What is happening</div>` +
    `<h2>${esc(text(given.headline, "events.headline", { required: true }))}</h2>${lines(given, "events", BUDGET.events, { dated: true })}</section>`
  );
}

function meeting(args, offerLine) {
  const care = text(args.care_line, "care_line");
  const given = object(args.meeting, "meeting", ["eyebrow", "headline", "why_it_matters", "opener", "say", "careful", "maybe_not", "ask"]);
  if (care !== null) {
    if (given !== null) throw new Refusal(`A lead handled with care gets no meeting part: leave \`meeting\` out with \`care_line\`.`);
    return `<section class="part" data-part="your-meeting"><ul class="lines"><li class="empty"><span class="t">${esc(care)}</span></li></ul>${offerLine}</section>`;
  }
  if (given === null) throw new Refusal(`${TOOL} needs \`meeting\`, or \`care_line\` for a lead handled with care.`);
  const eyebrow = text(given.eyebrow, "meeting.eyebrow") || "Your meeting";
  const why = text(given.why_it_matters, "meeting.why_it_matters");
  const opener = text(given.opener, "meeting.opener");
  const ask = text(given.ask, "meeting.ask");
  const say = list(given.say, "meeting.say", BUDGET.say).map((value, at) => `<li><span class="t">${esc(text(value, `meeting.say[${at}]`, { required: true }))}</span></li>`);
  const careful = list(given.careful, "meeting.careful", BUDGET.careful).map((value, at) => `<li><span class="t">${esc(text(value, `meeting.careful[${at}]`, { required: true }))}</span></li>`);
  return (
    `<section class="part" data-part="your-meeting"><div class="eyebrow"><span class="n">4</span> ${esc(eyebrow)}</div>` +
    `<h2>${esc(text(given.headline, "meeting.headline", { required: true }))}</h2>` +
    `${why === null ? "" : `<p class="why-you"><b>Why it matters to you.</b> ${esc(why)}</p>`}` +
    `${opener === null ? "" : `<div class="opener"><div class="small-k">Open with</div><blockquote>“${esc(opener)}”</blockquote></div>`}` +
    `<div class="plan"><div class="say"><div class="small-k">What to say</div><ul class="lines">${say.join("")}</ul></div>` +
    `<div class="careful"><div class="small-k">Be careful</div><ul class="lines">${careful.join("")}</ul>${maybeNot(given.maybe_not)}</div></div>` +
    `${ask === null ? "" : `<div class="ask"><div class="small-k">Ask for</div><p>${esc(ask)}</p></div>`}${offerLine}</section>`
  );
}

// A web mention that cannot be tied to the person at the top: apart, under Be careful.
function maybeNot(value) {
  const given = object(value, "meeting.maybe_not", ["first_name", "text", "chip"]);
  if (given === null) return "";
  return (
    `<div class="apart"><div class="apart-head"><span class="k">Maybe not ${esc(text(given.first_name, "meeting.maybe_not.first_name", { required: true }))}</span>` +
    `${chip(given.chip, "meeting.maybe_not.chip")}</div>` +
    `<p><b>This may be a different person.</b> ${esc(text(given.text, "meeting.maybe_not.text", { required: true }))}</p></div>`
  );
}

function offer(args) {
  const said = text(args.offer, "offer");
  if (said === null) return "";
  const who = text(args.assistant_name, "assistant_name") || "Milan";
  // the offer line names the assistant itself ("Milan can ..."), so the label is left off then
  const label = said.startsWith(`${who} `) ? "" : `<span class="who">${esc(who)}</span>`;
  return `<p class="offer" data-part="offer">${label}${esc(said)}</p>`;
}

function footer(args, day) {
  if (args.company_page !== undefined && typeof args.company_page !== "boolean") throw new Refusal("`company_page` is true or false.");
  const built = text(args.built_from, "built_from", { required: true });
  return (
    `<footer class="foot"><span class="gen">Generated by Celorus · ${day}. </span>${esc(built)}` +
    `${args.company_page === true ? '<span class="company-page"> Full sources are on the company page.</span>' : ""}</footer>`
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

function build(args) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Refusal(`${TOOL} takes its input as an object: ${ARGUMENTS.join(", ")}.`);
  }
  const extra = Object.keys(args).filter((key) => !ARGUMENTS.includes(key));
  if (extra.length) throw new Refusal(`${TOOL} does not take ${extra.join(", ")}. It takes: ${ARGUMENTS.join(", ")}.`);
  const lead = text(args.lead, "lead", { required: true });
  if (args.kind !== "person" && args.kind !== "company") throw new Refusal("`kind` is person or company.");
  const day = args.date === undefined ? today() : args.date;
  if (typeof day !== "string" || !DAY.test(day)) throw new Refusal("`date` is the day as YYYY-MM-DD.");
  if (args.kind === "person" && args.people !== undefined) throw new Refusal("A person's brief takes `person`, not `people`.");
  if (args.kind === "company" && args.person !== undefined) throw new Refusal("A company's brief takes `people`, not `person`.");
  const marks = marksOf();
  const body =
    `<body>\n${topbar(args, marks)}\n<main class="sheet">\n` +
    [top(args, lead), breath(args), args.kind === "person" ? person(args) : people(args), company(args), events(args), meeting(args, offer(args)), footer(args, day)].join("\n") +
    "\n</main>\n</body>\n</html>\n";
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

const CHIP_SCHEMA = {
  type: "object",
  description: "Where the line came from: { from: record } or { from: desk }, or { from: web, site, link }: the site's name, and its link, which goes into the page only when it begins with the https or http scheme.",
  properties: { from: { enum: ["record", "desk", "web"] }, site: { type: "string" }, link: { type: "string" } },
  required: ["from"],
  additionalProperties: false,
};
const LINE_SCHEMA = { type: "object", properties: { text: { type: "string" }, chip: CHIP_SCHEMA }, required: ["text", "chip"], additionalProperties: false };
const DATED_SCHEMA = { type: "object", properties: { when: { type: "string" }, text: { type: "string" }, chip: CHIP_SCHEMA }, required: ["when", "text", "chip"], additionalProperties: false };
const LINES = (most) => ({ type: "array", items: LINE_SCHEMA, maxItems: most });
const TEXTS = (most) => ({ type: "array", items: { type: "string" }, maxItems: most });
const S = { type: "string" };

const TOOLS = [
  {
    name: TOOL,
    description:
      "Write the research brief as a page, every time research answers: research-lead's seller's brief, from its fields, " +
      "in the house design, kept in ~/.celorus/briefs/ on this computer, with a desk or without one. It reads and writes " +
      "no desk. Every value is text: the tool escapes it, puts a web link in only when it begins with the https or http " +
      "scheme, and writes a page that runs no script and loads nothing from the web. A part nothing answers gives its " +
      "one plain line in `empty`. The same lead on the same day replaces its page. Answers with the page's `file`, its name alone, in ~/.celorus/briefs/.",
    inputSchema: {
      type: "object",
      properties: {
        lead: { type: "string", description: "The lead's name, as the brief heads it." },
        kind: { enum: ["person", "company"] },
        date: { type: "string", description: "The day, YYYY-MM-DD. Leave it out for today on this computer." },
        intent_label: { type: "string", description: "Pitch, Meeting or Call, for the top bar." },
        top: { type: "object", properties: { role: S, when_short: S, when: S, place: S, meeting_kind: S }, additionalProperties: false },
        breath: { type: "object", properties: { who: S, why_now: S, open_with: S, ask_for: S }, required: ["who"], additionalProperties: false },
        person: {
          type: "object",
          description: "For a person: the person part. you_and_them only on a desk.",
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
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        people: { type: "object", description: "For a company: the people who matter here, in a paragraph.", properties: { headline: S, paragraph: S }, additionalProperties: false },
        company: {
          type: "object",
          properties: {
            headline: S,
            why_this: S,
            lines: LINES(BUDGET.company),
            empty: S,
            figures: { type: "array", description: "Only values the record gave, exactly as it gave them.", items: { type: "object", properties: { label: S, value: S }, required: ["label", "value"], additionalProperties: false }, maxItems: BUDGET.figures },
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
            maybe_not: { type: "object", properties: { first_name: S, text: S, chip: CHIP_SCHEMA }, additionalProperties: false },
            ask: S,
          },
          additionalProperties: false,
        },
        care_line: { type: "string", description: "For a lead handled with care, in place of `meeting`: the plain line that says the lead is not pitched." },
        offer: { type: "string", description: "The offer line, only when nothing follows the brief in the chat." },
        assistant_name: { type: "string", description: "The name the desk gave the assistant; Milan when left out." },
        built_from: { type: "string", description: "What the brief was built from, in one line." },
        company_page: { type: "boolean", description: "True only when a company page was written on a desk." },
      },
      required: ["lead", "kind", "breath", "company", "events", "built_from"],
      additionalProperties: false,
    },
    run: (args) => writeResearchBrief(args),
  },
];

module.exports = { TOOLS, TOOL, build, writeResearchBrief, webLink, slugOf, esc, darkRule };
