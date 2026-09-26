"use strict";
// `who_can_introduce`: the path page, on both doors (registered in lib/tools.js by two lines,
// the base's ruling R1, issue 4197, comment 5813180160). It finds the page
// asked about, walks the desk (walk.js), folds the paths that restate a shorter one (fold.js),
// renders `celorus/views/path-to-<file name>.md` whole (page.js), writes it without following
// a link and never over a page it did not write (write.js), and returns its path, so the skill
// shows the page from that path and never retypes it.

const path = require("node:path");
const { readDesk } = require("../lib/desk.js");
const { Refusal } = require("../lib/refusal.js");
const { pluginVersion } = require("../lib/version.js");
const { strip, isMapping, compareText } = require("../check/values.js");
const rules = require("../check/rules.js");
const { ModelUnreadable } = require("../check/model.js");
const { walkTo, namesOf: walkNamesOf } = require("./walk.js");
const { fold } = require("./fold.js");
const { renderPage, SHOWN_PATHS, NAME_RULE } = require("./page.js");
const { writePathPage } = require("./write.js");

const TOOL = "who_can_introduce";

// The time a page is written, as the desk writes one: local, to the second, with its offset.
function localNow(date = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

// The names a page answers to (walk.js namesOf: its title and each of its aliases), compared
// without case.
const namesOf = (page) => walkNamesOf(page).map((name) => strip(name).toLowerCase());

// The file name the question is about: a page whose file name is the name as said; else the one
// page whose title or alias it is (several are refused, naming each); else, with no such page,
// the name lower case with a hyphen for each run of spaces, so the question still has a page.
function targetOf(to, pages) {
  if (typeof to !== "string" || strip(to) === "") {
    throw new Refusal("`to` is the name of the person, family or firm to be introduced to, as text.");
  }
  const said = strip(to);
  if (pages.some((page) => page.stem === said)) return said;
  const wanted = said.toLowerCase();
  const named = [...new Set(pages.filter((page) => namesOf(page).includes(wanted)).map((page) => page.stem))];
  if (named.length > 1) {
    throw new Refusal(
      `"${said}" is the title or an alias of ${named.length} pages: ${named.sort(compareText).join(", ")}. ` +
        "Name one of them by its file name as `to`.",
    );
  }
  if (named.length === 1) return named[0];
  const made = wanted.split(/\s+/u).join("-");
  if (made.includes("/") || made.includes("\\") || made.startsWith(".")) {
    throw new Refusal(
      `No page is named "${said}", and a path page's file name is made from the name, which may not ` +
        "hold a slash or start with a dot. Name the page by its title, an alias or its file name.",
    );
  }
  return made;
}

// The page for the question on the desk `read`, as text, and what the walk found: for E4's
// rebuild of every path page as well as for this tool.
function pathPage(read, target, now, findings = null) {
  const pages = rules.checkPages(read.pages);
  const onDesk = new Set(pages.map((page) => page.stem));
  const page = pages.find((p) => p.stem === target);
  const title = page && isMapping(page.head) && page.head.title ? String(page.head.title) : target;
  let walk = null;
  let kept = [];
  let folded = 0;
  if (page) {
    walk = walkTo(read, target, findings);
    ({ kept, folded } = fold(walk.paths, walk.people, walk.known));
  }
  const text = renderPage({ target, title, onDesk, walk, kept, now, version: pluginVersion() });
  return { text, title, found: walk ? walk.paths.length : 0, kept: kept.length, folded };
}

function whoCanIntroduce(args = {}, { now = localNow() } = {}) {
  // Required lazily: lib/tools.js requires this file to register the tool.
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(TOOL, args, ["desk", "to"]);
  // who_can_introduce writes the path page, so it finds its desk as a writer does.
  const read = readDesk(deskFor(args.desk, { writes: true }));
  const target = targetOf(args.to, rules.checkPages(read.pages));
  let page;
  try {
    page = pathPage(read, target, now);
  } catch (err) {
    if (!(err instanceof ModelUnreadable)) throw err;
    throw new Refusal(
      `The desk's model cannot be read from ${err.rel}, so no path page was written: a walk over it ` +
        "would follow words nobody wrote. `check_desk` lists that page; mend it, then ask again.",
    );
  }
  const rel = `celorus/views/path-to-${target}.md`;
  const file = path.join(read.root, ...rel.split("/"));
  writePathPage(read.root, rel, page.text);
  const shown = Math.min(page.kept, SHOWN_PATHS);
  return {
    tool: TOOL,
    plugin_version: pluginVersion(),
    root: read.root,
    page: file,
    rel,
    to: target,
    title: page.title,
    paths_found: page.found,
    paths_kept: page.kept,
    paths_folded: page.folded,
    paths_shown: shown,
    summary:
      `Wrote ${rel}: ${page.kept} ${page.kept === 1 ? "path" : "paths"} to ${page.title}` +
      (page.folded ? `, ${page.folded} more folded into the shorter ${page.folded === 1 ? "path it restates" : "paths they restate"}` : "") +
      (page.kept > shown ? `, ${shown} shown` : "") +
      ". Show the page from its path.",
  };
}

const TOOLS = [
  {
    name: TOOL,
    description:
      "Answer \"who can introduce me to <name>?\" over the desk's own pages: writes " +
      "celorus/views/path-to-<file name>.md, the ranked paths of up to three hops from a seat or " +
      "someone in conversation, each hop a sentence with its proofs and one drawing, and returns " +
      "the page's path to show. A path is headed qualified when its weakest hop rests only on " +
      `lines that write their far end in their own words. ${NAME_RULE}`,
    inputSchema: {
      type: "object",
      properties: {
        desk: {
          type: "string",
          description:
            "The desk folder (the one holding celorus/index.md), as a full path. Leave it out to use " +
            "CELORUS_DESK, or the desk found above the working folder when this server knows it.",
        },
        to: {
          type: "string",
          description:
            "The person, family or firm, as the person said it: a page's file name, title or alias. " +
            "Where it names no page, the page is still written and says so.",
        },
      },
      required: ["to"],
      additionalProperties: false,
    },
    run: whoCanIntroduce,
  },
];

module.exports = { TOOLS, whoCanIntroduce, pathPage, targetOf, localNow };
