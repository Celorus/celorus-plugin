"use strict";
// The desk's generated pages (one-desk design section 5): the three views under views/, and the
// generated sent list on each person, firm and family page. A view is rewritten whole; a page's
// generated part sits between <!-- generated:sent --> and <!-- /generated:sent -->, and nothing
// else on the page is touched. check-desk's skill states the same shapes in words.
//
// The path pages under views/ are not rendered here: render_views (views/tools.js) rebuilds each
// one already on the desk with who_can_introduce's own page and writer (the base's ruling R9).
//
// Every link is read with the one link reader, check/text.js linkSpans (and linksIn, its names),
// and the page it names is linkName's.

const fs = require("node:fs");
const path = require("node:path");
const { readDesk, readPage, splitPage, NO_HEADER, NOT_UTF8, HEADER_UNREAD, PAGE_UNREAD } = require("../lib/desk.js");
const { parseHeader, HeaderError, HEADER_SUBSET } = require("../lib/header.js");
const { pluginVersion } = require("../lib/version.js");
const { RULES, checkDesk, checkPages } = require("../check/rules.js");
const { loadDeskModel, isKind } = require("../check/model.js");
const { linkSpans, linkName, linksIn, proofMatch, sectionOf, Page } = require("../check/text.js");
const V = require("../check/values.js");
const { checkCitations } = require("../cite/cite.js");
const { dumpLines } = require("../update/yaml.js");
const { rstrip } = require("../update/history.js");

const DOT = "·";
const EDIT_PAGES = "Generated; edit the pages, never this view.";
const VIEWS = ["pipeline.md", "who-knows-whom.md", "needs-attention.md"];
const TOOL = "render_views";

const BLANKS = V.BLANK_CLASS.slice(1, -1);
const WHITE = `[${BLANKS}\\n]`;
const NOT_WHITE = `[^${BLANKS}\\n]`;
const WORD = "[\\p{L}\\p{N}_]";

// `text` with each desk link in it given as `fn(span)` says (a span as linkSpans reads it), and
// every other character as written.
function eachLink(text, fn) {
  let out = "";
  let from = 0;
  for (const span of linkSpans(text)) {
    out += text.slice(from, span.start) + fn(span);
    from = span.end;
  }
  return out + text.slice(from);
}

// A value put in a table cell. A pipe inside a desk link is its alias, and is escaped, which is
// how a table carries one; anywhere else it is the person's own text and becomes a slash.
function cell(value) {
  const raw = V.show(value);
  const spans = linkSpans(raw);
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== "|") out += raw[i];
    else out += spans.some(({ start, end }) => i > start && i < end) ? "\\|" : "/";
  }
  return out;
}

// A finding's or a line's own words: a link to a page on the desk stays a link, and a link to a
// page that is not there loses its brackets, since it would offer to make an empty page.
// `onDesk` is the set of file names on the desk (a list is taken too).
function plain(text, onDesk) {
  const known = onDesk instanceof Set ? onDesk : new Set(onDesk);
  return eachLink(text, (span) => (known.has(linkName(span)) ? text.slice(span.start, span.end) : linkName(span)));
}

// A view: its header, then its lines.
function viewPage(title, description, now, body) {
  const head = {
    type: "view",
    title,
    description,
    timestamp: now,
    generated_by: `celorus-plugin ${pluginVersion()} ${TOOL}`,
  };
  const lines = dumpLines(head, { sortKeys: false, flow: false });
  return `---\n${lines.join("\n")}\n---\n\n${rstrip(body.join("\n"))}\n`;
}

function byText(a, b) {
  return V.compareText(a, b);
}

function pipeline(root, model, pages, now) {
  const spine = V.items(V.own(V.asPython(readPage(root, "model/model.md").head), "spine"));
  const stageHead = V.asPython(readPage(root, "model/list-stage.md").head) || {};
  const stepOf = new Map();
  const steps = V.own(stageHead, "spine_steps");
  for (const entry of V.truthy(steps) ? V.items(steps) : []) {
    if (typeof entry !== "string" || !entry.includes(" -> ")) continue;
    const at = entry.indexOf(" -> ");
    stepOf.set(entry.slice(0, at), entry.slice(at + 4));
  }
  const own = model.ownPack.get("stage") || new Map();
  for (const [word, packWord] of own) if (stepOf.has(packWord)) stepOf.set(word, stepOf.get(packWord));
  const rows = new Map(spine.map((step) => [V.show(step), []]));
  const off = [];
  for (const page of pages) {
    const head = page.head || {};
    if (!V.holds(model.accountKinds, page.type)) continue;
    if (!model.accountFields.every((key) => V.truthy(V.own(head, key)))) continue;
    const row =
      `| [[${page.stem}]] | ${V.show(page.type)} | ${cell(V.own(head, "stage"))} | ` +
      `${cell(V.own(head, "relationship_kind"))} | ${cell(V.own(head, "owner"))} |`;
    // A stage written as a list, or one no step claims, lands under "not on a step", where the
    // person sees it.
    const stage = V.own(head, "stage");
    const step = typeof stage === "string" && stepOf.has(stage) ? stepOf.get(stage) : null;
    const placed = step !== null && rows.has(step) ? rows.get(step) : off;
    placed.push([V.show(V.own(head, "title")), row]);
  }
  const body = ["# Pipeline", "", `Every page in the account role, by step and stage. ${EDIT_PAGES}`];
  for (const [step, items] of [...rows, ["not on a step", off]]) {
    if (step === "not on a step" && !items.length) continue;
    body.push("", `## ${step}`, "");
    if (items.length) {
      body.push("| page | kind | stage | kind of relationship | owner |", "|---|---|---|---|---|");
      items.sort((a, b) => byText(a[0], b[0]) || byText(a[1], b[1]));
      body.push(...items.map(([, row]) => row));
    } else {
      body.push("Nothing here.");
    }
  }
  return viewPage("Pipeline", "Every account by step and stage", now, body);
}

// What follows a proof line's date, cut into fields at the middle dots, and only at those: a
// dot inside a desk link, a markdown link or a web address is part of it.
const WHOLE = new RegExp(`\\[[^\\[\\]\\n]*\\]\\([^()${BLANKS}\\n]*\\)|https?:/{2}${NOT_WHITE}+`, "uy");

function splitFields(rest) {
  const links = new Map(linkSpans(rest).map(({ start, end }) => [start, end]));
  const fields = [];
  let start = 0;
  let i = 0;
  while (i < rest.length) {
    WHOLE.lastIndex = i;
    const whole = WHOLE.exec(rest);
    if (whole) i += whole[0].length;
    else if (links.has(i)) i = links.get(i);
    else if (rest[i] === DOT) {
      fields.push(rest.slice(start, i));
      start = i + 1;
      i += 1;
    } else i += 1;
  }
  fields.push(rest.slice(start));
  return fields.map(V.strip).filter(Boolean);
}

// A field that cites a page, `in [[page]]`, however the word `in` was spelled; the citation, or
// null. Python's case-blind `in` also takes the dotted capital and the dotless small i.
const CITATION = new RegExp(`^[iI\\u0130\\u0131][nN]${V.BLANK_CLASS}+`, "u");

function citation(field) {
  const m = CITATION.exec(field);
  if (!m) return null;
  return linkSpans(field).some((span) => span.start === m[0].length) ? field.slice(m[0].length) : null;
}

// Somewhere a fact on a `shown` line came from, when a field opens with one: a markdown link to
// an address, a web address, or a CRM export's name; the thing itself, never the whole field.
const A_PLACE = new RegExp(
  `\\[[^\\[\\]\\n]*\\]\\([^()${BLANKS}\\n]+\\)` +
    `|https?:/{2}(?:(?!\\u00b7unverified(?!${WORD}))${NOT_WHITE})+` +
    `|crm-export-\\p{Nd}(?:[\\p{L}\\p{N}_.-]*${WORD})?`,
  "iuy",
);

function aPlace(field) {
  A_PLACE.lastIndex = 0;
  const m = A_PLACE.exec(V.strip(field));
  return m ? m[0] : null;
}

function whoKnowsWhom(model, pages, onDesk, now) {
  const lines = [];
  const guesses = [];
  for (const page of pages) {
    if (!isKind(model, page.type)) continue;
    const section = sectionOf(page.outside, "Connections") || "";
    for (const raw of V.splitLines(section)) {
      const m = proofMatch(raw);
      if (!m || !V.holds(model.proofRequired, m.conn)) continue;
      if (m.proof === "guessed") {
        const target = eachLink(m.target, (span) => span.name);
        // A guess's tail is the person's reason, printed as written and never parsed.
        const tail = V.strip(m.rest);
        const why = tail.startsWith(DOT) ? V.strip(tail.slice(1)) : tail;
        guesses.push(
          `| [[${page.stem}]] | ${m.conn} | ${cell(target)} | ${m.date} | ${cell(plain(why, onDesk) || DOT)} |`,
        );
        continue;
      }
      const parts = splitFields(m.rest);
      let where = parts.map(citation).find((c) => c !== null) ?? null;
      if (where === null && m.proof === "shown") where = parts.map(aPlace).find((c) => c !== null) ?? null;
      lines.push(
        `| [[${page.stem}]] | ${m.conn} | ${cell(plain(m.target, onDesk))} | ` +
          `${m.proof} | ${m.register} | ${m.date} | ${cell(plain(where || DOT, onDesk))} |`,
      );
    }
  }
  const body = [
    "# Who knows whom",
    "",
    "One hop: every connection on the desk's pages, with how we know it.",
    `A guess draws no line; guesses are listed apart for someone to confirm. ${EDIT_PAGES}`,
    "",
    "| from | connection | to | proof | register | date | where |",
    "|---|---|---|---|---|---|---|",
    ...lines.sort(byText),
    "",
    "## Guesses to confirm",
    "",
  ];
  if (guesses.length) body.push("| on | connection | to | date | why |", "|---|---|---|---|---|", ...guesses.sort(byText));
  else body.push("None.");
  return viewPage("Who knows whom", "Every connection with its proof, one hop", now, body);
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function needsAttention(root, findings, onDesk, notChecked, now) {
  // A missing file is half the findings under C12; its name stays plain.
  const where = (rel) => {
    const stem = new Page(rel, null, "", null).stem;
    return isFile(path.join(root, ...rel.split("/"))) ? `[[${stem}]]` : stem;
  };
  const body = ["# Needs attention", "", "Listed, never blocking. Walk it with the person whose desk it is."];
  if (!findings.length) body.push("", "Nothing to look at.");
  else {
    body.push("", "| what | page | detail |", "|---|---|---|");
    for (const f of findings) body.push(`| ${RULES[f.rule]} | ${where(f.page)} | ${cell(plain(f.message, onDesk))} |`);
  }
  if (notChecked) {
    body.push(
      "",
      `${notChecked} ${notChecked === 1 ? "citation names" : "citations name"} a file as it was at a commit (\`@\` and ` +
        "the commit), and the check does not read a file out of the desk's history yet, so " +
        `${notChecked === 1 ? "it was" : "they were"} not checked.`,
    );
  }
  return viewPage("Needs attention", "What the checker found, to walk with the person", now, body);
}

// The desk's pages as the rules read them: every page under celorus/ but the model, the views
// and the merge records.
function deskPages(read) {
  return checkPages(read.pages);
}

// The three views, by file name under views/, from one read of the desk and one run of the
// check. Throws ModelUnreadable when the model cannot be read: a view read from words nobody
// wrote is not written.
function renderViews(desk, now) {
  const read = readDesk(desk);
  const root = path.join(read.root, "celorus");
  const model = loadDeskModel(root);
  const pages = deskPages(read);
  const onDesk = new Set(pages.map((p) => p.stem));
  const findings = checkDesk(read.root, read.pages);
  const cited = checkCitations(read.root, pages);
  return {
    views: {
      "pipeline.md": pipeline(root, model, pages, now),
      "who-knows-whom.md": whoKnowsWhom(model, pages, onDesk, now),
      "needs-attention.md": needsAttention(root, findings, onDesk, cited.notChecked, now),
    },
    findings: findings.length,
    citations: { checked: cited.checked, notChecked: cited.notChecked },
  };
}

const SENT = /<!-- generated:sent -->\n[\s\S]*?<!-- \/generated:sent -->/gu;

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const LOOSE_UTF8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

// A page's text as the desk reader (lib/desk.js readPage) decodes its bytes: UTF-8 with a
// byte-order mark kept, and line ends made "\n"; null when the bytes are not UTF-8.
function textOfBytes(bytes) {
  try {
    return STRICT_UTF8.decode(bytes).replace(/\r\n?/gu, "\n");
  } catch {
    return null;
  }
}

// A page from text textOfBytes gave, as readPage reads one once it is text.
function pageFromText(rel, text) {
  const split = splitPage(text);
  if (!split) return { rel, head: null, body: text, problem: NO_HEADER };
  let head;
  try {
    head = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    return { rel, head: null, body: split.body, problem: HEADER_UNREAD, why: err.message, remedy: HEADER_SUBSET };
  }
  if (head !== null) return { rel, head, body: split.body, problem: null };
  return { rel, head, body: split.body, problem: NO_HEADER, headerNotMapping: true };
}

// The one function that turns a page's bytes into the page the sent lists are read from, for
// the lists the views write (renderSentBlocks) and for the ones a change reads off before its
// first write (sentBlocksAfter) alike: `page` as readPage builds it from the same bytes (line
// ends made "\n", a page that is not UTF-8 marked NOT_UTF8), and `text`, null on a page that is
// not UTF-8, which no sent list is ever written on.
function pageOfBytes(rel, bytes) {
  const text = textOfBytes(bytes);
  if (text !== null) return { page: pageFromText(rel, text), text };
  const loose = LOOSE_UTF8.decode(bytes).replace(/\r\n?/gu, "\n");
  const split = splitPage(loose);
  return { page: { rel, head: null, body: split ? split.body : loose, problem: NOT_UTF8 }, text: null };
}

// The desk's pages as they are on disk, each read through pageOfBytes, in the reader's order; a
// page the reader could not open is kept as it read it, with no text.
function pagesOnDisk(read) {
  const root = path.join(read.root, "celorus");
  return new Map(
    read.pages.map((p) => {
      if (p.problem === PAGE_UNREAD) return [p.rel, { page: p, text: null }];
      try {
        // Opened only when stat reports a regular file: a pipe put in its place since the desk
        // was read is kept with no text, as a page that cannot be read, never opened (R38).
        const file = path.join(root, ...p.rel.split("/"));
        if (!fs.statSync(file).isFile()) return [p.rel, { page: p, text: null }];
        return [p.rel, pageOfBytes(p.rel, fs.readFileSync(file))];
      } catch {
        return [p.rel, { page: p, text: null }];
      }
    }),
  );
}

// Each person, firm and family page whose generated sent list changes, by path under celorus/,
// with its new text: every sent item whose `about` links the page, newest first.
function renderSentBlocks(desk) {
  return sentBlocks(pagesOnDisk(readDesk(desk)));
}

// renderSentBlocks over the desk as a change will leave it, before the change is written:
// `written` holds the pages it writes by path under celorus/, each as the bytes it writes (text
// is written as its UTF-8), read through pageOfBytes as renderSentBlocks will read them once
// written (a page not on the desk yet, as one an undo makes again, joins it); `removed` is the
// page it deletes. merge_pages seals these into its record, so its undo covers every page the
// merge changed; merge_pages and undo_merge read off them, before their first write, the sent
// lists the views rebuilt after them rewrite.
function sentBlocksAfter(read, written, removed) {
  const pages = pagesOnDisk(read);
  pages.delete(removed);
  for (const [rel, data] of Object.entries(written)) {
    if (rel !== removed) pages.set(rel, pageOfBytes(rel, Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8")));
  }
  return sentBlocks(pages);
}

// The sent lists that change, over `read`: each page by path under celorus/, as { page, text }.
function sentBlocks(read) {
  const pages = checkPages([...read.values()].map((r) => r.page));
  const sent = pages.filter((p) => p.type === "sent" && V.truthy(p.head));
  const out = {};
  for (const page of pages) {
    if (!["person", "firm", "family"].includes(page.type)) continue;
    const items = sent
      .filter((s) => linksIn(V.own(s.head, "about")).includes(page.stem))
      .map((s) => [V.show(V.own(s.head, "sent_on")), V.show(V.own(s.head, "sent_kind")), s.stem]);
    items.sort((a, b) => byText(b[0], a[0]) || byText(b[1], a[1]) || byText(b[2], a[2]));
    const text = read.get(page.rel).text;
    if (text === null) continue;
    SENT.lastIndex = 0;
    const hasBlock = SENT.test(text);
    if (!items.length && !hasBlock) continue;
    const block =
      "<!-- generated:sent -->\n" +
      items.map(([d, k, s]) => `- ${d} ${DOT} ${k} ${DOT} [[${s}]]\n`).join("") +
      "<!-- /generated:sent -->";
    const next = hasBlock ? text.replace(SENT, () => block) : `${rstrip(text)}\n\n## Sent\n\n${block}\n`;
    if (next !== text) out[page.rel] = next;
  }
  return out;
}

module.exports = {
  VIEWS,
  TOOL,
  cell,
  plain,
  splitFields,
  citation,
  aPlace,
  renderViews,
  renderSentBlocks,
  sentBlocksAfter,
  textOfBytes,
  pageOfBytes,
};
