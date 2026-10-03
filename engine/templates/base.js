"use strict";
// The shared base every page stands in (direction 2): the look lives once, in design.js (the base
// page, the foundation block and the mark), and a page (pages.js) hands over only what is its own.
// The band carries the page's name, its theme words and drawing, and the one pill its band says;
// the footer names the page, the day, the assistant (its `name` and `introduction`) and the desk.
// The assistant's name is the `name` of the
// persona the render tools hand over (lib/persona.js reads it from the desk): the look's own text holds it as the
// token NAMED, filled here on every page, and the design() memo holds only the look.
//
// The "Synthetic demo data" note is the synthetic fixture's own setting (base ruling R6): it is
// drawn only on a desk whose desk.md says `fixture: synthetic`, never by the product itself.

const P = require("./parts.js");
const D = require("./design.js");
const { e } = require("../render/words.js");

const DARK = /^\[data-theme="dark"\] \{\n([\s\S]*?)^\}/m;
// where the look's own text (design.js) says the assistant's name
const NAMED = /\{\{assistant\}\}/g;

// A drawing set into the page as an include sets it: its one trailing newline dropped.
function included(text) {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

let cached = null;
function design() {
  if (cached === null) {
    const dark = DARK.exec(D.FOUNDATION);
    cached = { base: D.BASE, foundation: D.FOUNDATION, foundation_dark: dark ? dark[1] : "", mark: D.MARK };
  }
  return cached;
}

function drawingOf(name) {
  if (!name) return "";
  const svg = included(D.DRAWINGS[name]);
  // the band sets the morning's drawing to meet its box, not to fill it
  return svg.replace("{{align}}", name === "first-light" ? "xMidYMax meet" : "xMidYMax slice");
}

function band(page, v, firm, assistant) {
  const d = design();
  return (
    `<header class="band"><div class="band-in${page.drawing ? "" : " no-art"}">\n` +
    `<div class="id"><span class="mark" role="img" aria-label="Celorus">${d.mark}</span>\n` +
    `<div><p class="desk-name">${e(firm)} desk</p><p class="page-name">${e(page.page_name)}</p>` +
    `<p class="stamp">${e(v.date_label)}${v.seat_name ? ` \u00b7 ${e(v.seat_name)}` : ""}</p></div></div>\n` +
    `<div class="art">${drawingOf(page.drawing)}</div>\n` +
    `<div class="acts">${page.theme ? `<span class="theme">${e(page.theme)}</span>` : ""}${page.say ? P.pill(assistant, "go", page.say) : ""}</div>\n` +
    "</div></header>\n"
  );
}

function footer(page, v, firm, fixture, persona) {
  return (
    `<footer><span>${e(page.page_name)} \u00b7 ${e(v.date_label)} \u00b7 made by ${e(persona.name)}, ${e(persona.introduction)}, from the ${e(firm)} desk \u00b7 times in IST</span>` +
    `${fixture ? "<span>Synthetic demo data</span>" : ""}</footer>\n`
  );
}

// The whole page. `stamp` is the generated_by line every generated page carries; `persona` is the
// one the page speaks for (lib/persona.js), whose name is set into the look's own text before any
// slot is filled, so no desk text a slot carries is ever read for the token.
function assemble(page, v, { firm, fixture, stamp, persona }) {
  const d = design();
  const assistant = persona && persona.name;
  const named = (text) => (typeof text === "string" ? text.replace(NAMED, () => assistant) : text);
  const slots = {
    drawn: `<meta name="generated_by" content="${e(stamp)}">\n`,
    title: page.title,
    foundation: named(d.foundation),
    foundation_dark: named(d.foundation_dark),
    page_css: named(page.page_css),
    band: band(page, v, firm, assistant),
    greet: `<div class="greet"><h1>${page.heading}</h1>${page.lede}</div>\n`,
    content: page.content,
    footer: footer(page, v, firm, fixture, persona),
  };
  return named(d.base).replace(/\{\{(drawn|title|foundation_dark|foundation|page_css|band|greet|content|footer)\}\}/g, (_, k) => slots[k]);
}

module.exports = { assemble };
