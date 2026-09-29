"use strict";
// A desk as the pages count it: every page of the kinds a page draws, by its slug, with the
// desk's registers read as tables. It reads through the engine's one reader (lib/desk.js) and
// its one link reader (check/text.js linkSpans, DESK-60): no second parser of either lives here.
//
// Ported from the demo kit's desk.py and layout2.py (row E5).

const { readDesk } = require("../lib/desk.js");
const { linkSpans, sectionOf } = require("../check/text.js");

// The page folders a page counts from; a desk's system pages are none of these.
const FOLDERS = ["families", "people", "firms", "seats", "conversations", "briefs", "research"];
// A blank table cell.
const BLANK = "\u00b7";
// The line the synthetic fixture closes its pages with: read past on a desk that says it is the
// fixture (base ruling R6), never on any other.
const FIXTURE_FOOT = "Synthetic demo data.";

// A header value as text, its link unwrapped: "[[kabir]]" is "kabir". Only a value that is one
// link from its first character to its last is unwrapped; its name is as written.
function unlink(value) {
  if (value === null || value === undefined || value === "" || value === false) return "";
  const text = String(value);
  const [first] = linkSpans(text);
  return first && first.start === 0 && first.end === text.length ? first.name : text;
}

// The slug a list line "- [[slug]], ..." opens with, or null.
function linkedSlug(line) {
  if (!line.startsWith("- ")) return null;
  const span = linkSpans(line).find((s) => s.start === 2);
  return span ? span.name : null;
}

function cells(line) {
  const parts = line.trim().split(/(?<!\\)\|/);
  return parts.slice(1, -1).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

// A register's rows: the first table line names the columns, a rule line is passed over, a
// short row is read with its missing cells empty, and a blank cell is null.
function readTable(text) {
  const rows = [];
  let columns = null;
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (!line.startsWith("|")) continue;
    if (columns === null) {
      columns = cells(line);
    } else if ([...line.replace(/\|/g, "").trim()].every((ch) => "-: ".includes(ch))) {
      continue;
    } else {
      const got = cells(line);
      while (got.length < columns.length) got.push(BLANK);
      const row = {};
      columns.forEach((column, i) => {
        row[column] = got[i] === BLANK ? null : got[i];
      });
      rows.push(row);
    }
  }
  return rows;
}

// log.md's lines: the day heads a run of "* HH:MM \u00b7 handle \u00b7 skill \u00b7 what \u00b7 register" lines.
function readLog(text) {
  const out = [];
  let day = null;
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (line.startsWith("## ")) {
      day = line.slice(3).trim();
    } else if (line.startsWith("* ") && day) {
      const parts = line.slice(2).split(" \u00b7 ");
      out.push({ day, time: parts[0], handle: parts[1], skill: parts[2], what: parts.slice(3, -1).join(" \u00b7 ") });
    }
  }
  return out;
}

class Desk {
  constructor(read) {
    this.read = read;
    this.root = read.root;
    this.stamps = read.stamps || {};
    // the fixture's own setting: its footer line is read past, and its pages say it is demo data
    this.fixture = this.stamps.fixture === "synthetic";
    this.pages = new Map();
    const byRel = new Map(read.pages.map((page) => [page.rel, page]));
    for (const kind of FOLDERS) {
      const rels = read.pages
        .map((page) => page.rel)
        .filter((rel) => rel.startsWith(`${kind}/`) && !rel.slice(kind.length + 1).includes("/"))
        .sort();
      for (const rel of rels) {
        const page = byRel.get(rel);
        const slug = rel.slice(kind.length + 1, -".md".length);
        const header = page.head && typeof page.head === "object" && !Array.isArray(page.head) ? page.head : {};
        this.pages.set(slug, { slug, kind, header, body: page.body.replace(/^\n+/, "") });
      }
    }
    const text = (rel) => (byRel.has(rel) ? byRel.get(rel).body : "");
    this.deskLog = readTable(text("desk-log.md"));
    this.followUps = readTable(text("queues/follow-ups.md"));
    this.supplied = readTable(text("queues/supplied.md"));
    this.products = readTable(text("context/products.md"));
    this.log = readLog(text("log.md"));
  }

  of(kind) {
    return [...this.pages.values()].filter((page) => page.kind === kind);
  }

  // A page's title, or its slug when it carries none.
  title(slug) {
    const page = this.pages.get(slug || "");
    if (page) {
      const title = page.header.title;
      return title !== null && title !== undefined && title !== "" && title !== false ? String(title) : slug || "";
    }
    return slug || "";
  }

  get(page, key) {
    return unlink(page.header[key]);
  }

  // The non-blank lines under `## heading`, the fixture's footer line read past on the fixture.
  section(body, heading) {
    const text = sectionOf(body, heading, [2]);
    if (text === null) return [];
    return text
      .split("\n")
      .filter((line) => line.trim() && !(this.fixture && line.trim() === FIXTURE_FOOT));
  }

  // Every `## ` section of a body, its paragraphs split on blank lines.
  sections(body) {
    const out = [];
    const blocks = body.split(/^## /m).slice(1);
    for (const block of blocks) {
      const at = block.indexOf("\n");
      const heading = at === -1 ? block : block.slice(0, at);
      const rest = at === -1 ? "" : block.slice(at + 1);
      const paragraphs = rest
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p && !(this.fixture && p === FIXTURE_FOOT));
      out.push({ heading: heading.trim(), paragraphs });
    }
    return out;
  }

  peopleOf(family) {
    const page = this.pages.get(family);
    if (!page) return [];
    return [...this.section(page.body, "Members"), ...this.section(page.body, "Contacts")]
      .map(linkedSlug)
      .filter((slug) => slug !== null);
  }

  seatOf(conversation) {
    const page = this.pages.get(conversation);
    const attended = page ? page.header.attended || [] : [];
    for (const value of Array.isArray(attended) ? attended : []) {
      const slug = unlink(value);
      if (this.pages.has(slug) && this.pages.get(slug).kind === "seats") return slug;
    }
    return null;
  }

  about(slug) {
    const page = this.pages.get(slug);
    return page ? this.get(page, "about") : null;
  }

  signals(family) {
    const rows = this.of("research").filter((page) => this.get(page, "about") === family);
    return rows
      .map((page, i) => ({ page, i, k: this.get(page, "as_of") }))
      .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i))
      .map((item) => item.page);
  }

  // The firm's name, as the desk's stamps page titles it, without its " desk".
  firm() {
    const title = String(this.stamps.title || "");
    return title.endsWith(" desk") ? title.slice(0, -" desk".length) : title;
  }
}

function loadDesk(folder) {
  return new Desk(readDesk(folder));
}

module.exports = { Desk, loadDesk, unlink, linkedSlug, readTable, readLog, FOLDERS, FIXTURE_FOOT };
