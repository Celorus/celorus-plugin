"use strict";
// The desk tools: one list, served by both doors. The server lists and calls these; the
// command line runs the same `run` functions. A tool is { name, description, inputSchema,
// run(args) }: `run` returns a plain object (numbers and rows the model repeats, never
// counts itself) or throws a Refusal naming the valid values.
//
// Tool names are the demo's or the checker oracle's, so each port is testable against them.
// `check_desk` reads the desk through the shared reader and runs rules C01 to C16
// (check/rules.js) over it. It is read-only unless asked to record (`record: true`): then a
// whole-desk check writes `checked_with: <version>` and `checked_findings: <n>` into desk.md
// (lib/stamp.js), clean or not.

const fs = require("node:fs");
const path = require("node:path");
const {
  findDesk,
  resolveDesk,
  readDesk,
  PAGE_UNREAD,
  NO_HEADER,
  HEADER_UNREAD,
  NOT_UTF8,
  STAMP_NOT_ONE_VALUE,
  LINK_FOLDER,
  comparePaths,
} = require("./desk.js");
const { Refusal } = require("./refusal.js");
const { pluginVersion } = require("./version.js");
const { RULES, checkDesk: runRules, narrowFindings } = require("../check/rules.js");
const { stampCheckedWith } = require("./stamp.js");
const paths = require("../paths/index.js");
const { TOOLS: VIEW_TOOLS } = require("../views/tools.js");

// Refuses an argument the tool does not take, naming the ones it does.
function onlyArguments(tool, args, allowed) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Refusal(`${tool} takes its input as an object: ${allowed.join(", ")}.`);
  }
  const extra = Object.keys(args).filter((key) => !allowed.includes(key));
  if (extra.length) {
    throw new Refusal(`${tool} does not take ${extra.join(", ")}. It takes: ${allowed.join(", ")}.`);
  }
}

// The plugin folder: this file is <plugin>/engine/lib/tools.js.
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");

// The folder the work started in, or null when it is not known. A harness may start this
// server inside the plugin folder (Kimi's declaration runs it with `cwd` the plugin folder),
// and then the server's working folder says nothing about where the person works: walking up
// from it would find no desk, or someone else's above the install. So there the desk must be
// named by a full path, and nothing is guessed.
function workingFolder(cwd = process.cwd()) {
  const rel = path.relative(PLUGIN_ROOT, path.resolve(cwd));
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  return inside ? null : cwd;
}

const NAME_IT_IN_FULL =
  "This desk server was started in the plugin folder, so it does not know the folder you " +
  "work in. Name the desk folder (the one holding celorus/index.md) as `desk`, written as a " +
  "full path, or set CELORUS_DESK to its full path.";

// The desk CELORUS_DESK names, when the server started in the plugin folder and that setting
// is all it has to go on: a full path is read by findDesk, as from any other folder, so both
// doors give one answer (the desk, or the refusal naming what is wrong with that folder); a
// relative one is refused, since there is no working folder to read it from.
function deskFromEnv(named, writes) {
  if (!path.isAbsolute(named)) {
    throw new Refusal(`CELORUS_DESK is ${JSON.stringify(named)}, not a full path. ${NAME_IT_IN_FULL}`);
  }
  return findDesk({ start: null, env: { CELORUS_DESK: named }, writes });
}

// The desk a tool works on: the one named, or the one found from where the work started.
// `writes` says the tool writes on it (for a recorded check, only when asked to record): a live
// link to a folder with no readable index.md is then refused in the linked-root words.
function deskFor(named, { cwd = process.cwd(), env = process.env, writes = false } = {}) {
  const base = workingFolder(cwd);
  if (named !== undefined && named !== null) {
    if (typeof named !== "string" || named.trim() === "") {
      throw new Refusal("`desk` is the path of a desk folder, as text.");
    }
    if (base === null && !path.isAbsolute(named)) {
      throw new Refusal(`\`desk\` is ${JSON.stringify(named)}, not a full path. ${NAME_IT_IN_FULL}`);
    }
    return resolveDesk(named, base === null ? PLUGIN_ROOT : base);
  }
  if (base === null && env.CELORUS_DESK) return deskFromEnv(env.CELORUS_DESK, writes);
  const found = findDesk({ start: base, env, writes });
  if (found) return found;
  if (base === null) throw new Refusal(`No desk was named. ${NAME_IT_IN_FULL}`);
  // The working folder is named in words, never by its path; CELORUS_DESK as the person set it
  // (a set one that names no desk is refused by findDesk before this). The sentence is true: the
  // walk stops at the first folder holding a `celorus` entry, so it ended here only because no
  // folder on it holds one.
  const setting = env.CELORUS_DESK === undefined ? "is not set" : `is ${JSON.stringify(env.CELORUS_DESK)}`;
  throw new Refusal(
    `No desk was named and none was found: CELORUS_DESK ${setting}, and the walk up from the ` +
      "working folder found no folder that holds celorus/index.md. Name the desk folder as " +
      "`desk`, or set CELORUS_DESK to it.",
  );
}

const DESK_ARGUMENT = {
  type: "string",
  description:
    "The desk folder (the one holding celorus/index.md), as a full path. Leave it out to use " +
    "CELORUS_DESK, or the desk found above the working folder when this server knows it.",
};

// The pages a check is narrowed to: a list of page paths under celorus/, or absent.
function scopeOf(scope) {
  if (scope === undefined || scope === null) return null;
  if (!Array.isArray(scope) || !scope.every((rel) => typeof rel === "string")) {
    throw new Refusal(
      "`scope` is a list of page paths under the desk's celorus folder, as " +
        '["people/meera-sample.md"]; leave it out to check the whole desk.',
    );
  }
  if (!scope.length) {
    throw new Refusal(
      "`scope` is an empty list, which names no page: a check narrowed to it would keep no " +
        'finding and read as clean. Name the pages to check, as ["people/meera-sample.md"], or ' +
        "leave scope out to check the whole desk.",
    );
  }
  return scope;
}

// The folder a page is named by, where no rule reads it: its top folder, or for a page below
// model/, its own folder there (model/old), never model/, whose own pages the rules read.
function folderOf(rel) {
  const parts = rel.split("/");
  return parts[0] === "model" && parts.length > 2 ? `model/${parts[1]}` : parts[0];
}

// The page under the desk's celorus folder `dir` that a scope entry names, or null: the entry
// as written; a relative entry read by posix path rules ("./" dropped, ".." resolved), from the
// celorus folder, or from the desk folder when celorus/ is in front, and taken only while it
// stays inside the celorus folder; or a full path inside `dir` (read with and without the links
// in it followed, as a skill may name a page either way). Letter case is matched as written.
function pageNamed(entry, dir, listed) {
  if (listed.has(entry)) return entry;
  if (!path.isAbsolute(entry)) {
    const parts = entry.split("/").filter((part) => part !== "." && part !== "");
    if (!parts.length) return null;
    const clean = path.posix.normalize(parts.join("/"));
    const fromDesk = parts[0] === "celorus";
    if (fromDesk && !clean.startsWith("celorus/")) return null;
    const rel = fromDesk ? clean.slice("celorus/".length) : clean;
    // Outside the folder is a first part of "..": a page file named "..odd.md" is inside.
    if (rel.split("/")[0] === "..") return null;
    return listed.has(rel) ? rel : null;
  }
  const real = (file) => {
    try {
      return fs.realpathSync(file);
    } catch {
      return null;
    }
  };
  for (const folder of [dir, real(dir)]) {
    for (const file of [path.resolve(entry), real(entry)]) {
      if (folder === null || file === null) continue;
      const rel = path.relative(folder, file);
      // Outside the folder is a first part of "..": a page file named "..odd.md" is inside.
      if (rel === "" || rel.split(path.sep)[0] === ".." || path.isAbsolute(rel)) continue;
      const named = rel.split(path.sep).join("/");
      if (listed.has(named)) return named;
    }
  }
  return null;
}

// Why no rule reads `rel`, a page the reader read: it is generated (under views/ or merges/),
// it sits in a folder below model/, or, as a guard, no rule read it.
function unreadKind(rel) {
  const folder = folderOf(rel);
  if (folder === "views" || folder === "merges") return "generated";
  return folder !== rel.split("/")[0] ? "below-model" : "unread";
}

// The summary's clause naming the pages of a scope that no rule reads (path under celorus/ to
// its kind), or "": each carries no rules, and the findings on the pages it links were kept.
function skippedLine(skipped) {
  const one = (n, a, b) => (n === 1 ? a : b);
  const why = {
    generated: (n) => `${one(n, "is", "are")} generated and ${one(n, "carries", "carry")} no rules`,
    "below-model": (n) => `${one(n, "is", "are")} in a folder below model/ and ${one(n, "carries", "carry")} no rules`,
    unread: (n) => `${one(n, "carries", "carry")} no rules, since no rule read ${one(n, "it", "them")}`,
  };
  const parts = [];
  for (const kind of Object.keys(why)) {
    const rels = [...skipped].filter(([, k]) => k === kind).map(([rel]) => rel).sort();
    if (rels.length) parts.push(`${andList(rels)} ${why[kind](rels.length)}`);
  }
  if (!parts.length) return "";
  return ` Of those, ${parts.join(", and ")}; the findings on the pages ${one(skipped.size, "it links", "they link")} were kept.`;
}

// Why a scope entry naming `rel`, a page the reader read, is refused when the scope names no
// page the rules read: no rule reads that page, so a scope must also name one they read. It
// makes no claim about what a check narrowed to the page would hold: named beside a page the
// rules read, it keeps the findings on the pages it links.
function notReadByRules(entry, rel) {
  const named = `\`scope\` names ${JSON.stringify(entry)}`;
  const folder = folderOf(rel);
  const remedy = "a scope must also name a page the rules read. Name one beside it, or leave scope out to check the whole desk.";
  if (unreadKind(rel) === "generated") {
    return `${named}, a page under ${folder}/, which is generated: no rule reads it, so ${remedy}`;
  }
  if (unreadKind(rel) === "below-model") {
    return `${named}, a page in ${folder}/, a folder below model/: no rule reads it, so ${remedy}`;
  }
  // Every other page the reader read is one the rules read (a scope is only held to the pages
  // when they read past the layout), so this is a guard, said without a reason it cannot know.
  return `${named}, a page no rule read, so ${remedy}`;
}

// Why the check could not read all the links of `page`, a page the reader read, or null when it
// read them all. `page.problem` is the reader's own word for the page (lib/desk.js). A page with
// no header at all is read in full, its body and the links in it; one whose header reads as
// something other than keys and values (`headerNotMapping`) has that header's text unread, and
// the links in it with it. A stamps page whose stamp is not one value keeps its parsed header and
// body. On layout 2 that page is desk.md, the rules run on it (check/rules.js), and its links are
// all known. On layout 1 it is index.md only where desk.md is missing, and then the rules stop at
// the layout, so this function is never reached. Any other problem, one this function does not
// know among them, leaves the page's links not all known.
function linksUnknown(page) {
  if (!page || !page.problem) return null;
  if (page.problem === NO_HEADER) return page.headerNotMapping ? "its header does not read as keys and values" : null;
  if (page.problem === STAMP_NOT_ONE_VALUE) return null;
  const said = {
    [PAGE_UNREAD]: "it cannot be read",
    [HEADER_UNREAD]: "its header does not parse",
    [NOT_UTF8]: "it is not readable as UTF-8",
  };
  return said[page.problem] || `the reader says of it "${page.problem}"`;
}

// A folder link the reader met under celorus/ (readDesk's `links`), as the check names it: its
// path under celorus/ with a slash after it, what it is, and why, naming it by its path under the
// desk. A link to a folder: its pages were read through it, and a tool that writes refuses to
// change one (lib/linkedroot.js). A link to a folder already read: read there, once.
function linkRow(link) {
  const shown = `celorus/${link.rel}`;
  if (link.kind === LINK_FOLDER) {
    return {
      page: link.rel,
      problem: link.kind,
      why: `${shown} is a link, and the pages under it were read through it; a desk tool that writes changes no page under it, and refuses a change that would`,
      remedy: "Put a plain folder in its place, so the desk tools can write the pages under it.",
    };
  }
  return {
    page: link.rel,
    problem: link.kind,
    why: `${shown} leads to ${link.readAt}, whose pages were read there, so it was not read again`,
    remedy: "Move the link out of the desk folder.",
  };
}

// The summary's clause for a scope that was not applied because the links of some page it names
// are not all known (path under celorus/ to why): the pages, and why for each.
function linksUnknownLine(unknown) {
  const rels = [...unknown.keys()].sort();
  const why = rels.length === 1 ? unknown.get(rels[0]) : rels.map((rel) => `${rel}: ${unknown.get(rel)}`).join("; ");
  return ` The scope was not applied, since the links of ${andList(rels)} are not all known (${why}).`;
}

// The scope as the rules read it: `pages`, each entry as the path under the desk's celorus
// folder of a page the rules read (`byRules`; never called when they stopped at the layout), or
// of a page the whole check put a finding on (`found`), such as a required page that is missing;
// and `skipped`, the pages the reader read but no rule reads (generated, or below model/), each
// path to its kind, which the summary names; they carry no finding, and the findings on the
// pages they link are kept. Where any page the scope names, read by the rules or not, has links
// the check could not all read (linksUnknown), the findings on the pages it links cannot be
// kept, so the scope is not applied: the answer is `{ linksUnknown }`, each such page to why.
// Otherwise a scope whose every page is skipped is refused by name. An entry naming no page the
// check read is refused by name, never dropped, whatever else the scope names. Two spellings of
// one page are one page.
function scopePages(scope, read, byRules, found) {
  if (scope === null) return null;
  const dir = path.join(read.root, "celorus");
  const taken = new Set([...(byRules || []), ...found.map((finding) => finding.page)]);
  const listed = new Set(read.pages.map((page) => page.rel));
  const pageOf = new Map(read.pages.map((page) => [page.rel, page]));
  const pages = new Set();
  const skipped = new Map();
  const unknown = new Map();
  const note = (rel) => {
    const why = linksUnknown(pageOf.get(rel));
    if (why !== null) unknown.set(rel, why);
  };
  let firstSkipped = null;
  for (const entry of scope) {
    const rel = pageNamed(entry, dir, taken);
    if (rel !== null) {
      note(rel);
      pages.add(rel);
      continue;
    }
    const unread = pageNamed(entry, dir, listed);
    if (unread !== null) {
      note(unread);
      if (firstSkipped === null) firstSkipped = notReadByRules(entry, unread);
      skipped.set(unread, unreadKind(unread));
      continue;
    }
    throw new Refusal(
      `\`scope\` names ${JSON.stringify(entry)}, which matches no page path this check read ` +
        `under ${dir}, spelled as given, nor a required page the check found missing. Name each ` +
        'page by its path under the desk\'s celorus folder, as "people/meera-sample.md" (with ' +
        "celorus/ in front, or as its full path, is taken too); leave scope out to check the " +
        "whole desk.",
    );
  }
  if (unknown.size) return { linksUnknown: unknown };
  if (!pages.size) throw new Refusal(firstSkipped);
  return { pages: [...pages], skipped };
}

// Whether a check may write its stamp: only when asked to record; read-only otherwise.
function recordOf(record) {
  if (record === undefined || record === null) return false;
  if (typeof record !== "boolean") {
    throw new Refusal(
      "`record` is true or false: true writes checked_with and checked_findings into desk.md " +
        "after a whole-desk check; false, the default, keeps the run read-only.",
    );
  }
  return record;
}

// "a, b and c".
function andList(words) {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// The summary's account of the desk's pages: how many the rules read, and the rest in words.
// `byRules` is the rules' own list of the pages they read (check/rules.js checkDesk), null when
// desk.md or the model is missing or cannot be read and the rules stopped at the layout: then
// the line names no count of rules, since only the layout rule ran. The pages the rules never read are those under views/ and merges/, which are generated, and any
// in a folder below model/; the model's own pages are read as the model and can carry findings.
// So a page below model/ is named by its own folder, as model/old/, never as model/, which would
// read as the model carrying no rules.
function pagesLine(pages, byRules, name, rules) {
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (byRules === null) {
    return (
      `Checked only the layout of ${name}, since desk.md or the model is ` +
      `missing or cannot be read (its ${count(pages.length, "page was", "pages were")} not checked beyond that)`
    );
  }
  const read = new Set(byRules);
  const checked = pages.filter((page) => read.has(page.rel));
  const rest = pages.filter((page) => !read.has(page.rel));
  const line = `Checked ${count(checked.length, "page", "pages")} of ${name} against ${rules} rules`;
  if (!rest.length) return line;
  const folders = [...new Set(rest.map((page) => folderOf(page.rel)))].sort();
  const one = rest.length === 1;
  const generated = folders.every((folder) => folder === "views" || folder === "merges");
  const what = `${generated ? `${one ? "is" : "are"} generated and ` : ""}${one ? "carries" : "carry"} no rules`;
  return `${line} (the other ${rest.length}, under ${andList(folders.map((folder) => `${folder}/`))}, ${what})`;
}

function checkDesk(args = {}) {
  onlyArguments("check_desk", args, ["desk", "scope", "record"]);
  const asked = scopeOf(args.scope);
  const record = recordOf(args.record);
  const read = readDesk(deskFor(args.desk, { writes: record }));
  // One read of the desk and one run of the rules: the rules' own list of the pages they read,
  // and where its findings land, are what a scope entry is held to, and a scope then narrows
  // that same run's findings. rules_run, the pages and the summary all describe this one run.
  const byRules = {};
  const whole = runRules(read.root, read.pages, null, byRules);
  // Where the rules stopped at the layout they read no page, so a scope has nothing to narrow;
  // where a page the scope names has links the check could not all read, the findings on the
  // pages it links cannot be kept. Either way the check answers as the whole check does and
  // says the scope was not applied, and why.
  const atLayout = asked !== null && byRules.pages === null;
  const narrowed = atLayout ? null : scopePages(asked, read, byRules.pages, whole);
  const unknownLinks = narrowed && narrowed.linksUnknown ? narrowed.linksUnknown : null;
  const scope = unknownLinks ? null : narrowed;
  // The reader's own account of each page it could not read: why, and the remedy. The rules
  // see these pages too (C12), but a rule's message does not carry the reader's why. A page
  // with no header is not among them: whether it should have one is the rules' to say (log.md
  // and an index below the root must not; any other page gets the C12 "no header").
  // Each folder link the reader met is named here too, by its path under celorus/ with a slash
  // after it, as a folder that cannot be listed is (the base's ruling R64): the check reads the
  // pages under it, and says that a tool that writes changes none of them.
  const problems = [
    ...read.pages
      .filter((page) => page.problem && page.problem !== NO_HEADER)
      .map((page) => {
        const row = { page: page.rel, problem: page.problem };
        if (page.why) Object.assign(row, { why: page.why, remedy: page.remedy });
        return row;
      }),
    ...read.links.map(linkRow),
  ].sort((a, b) => comparePaths(a.page, b.page));
  // A page the scope names that no rule reads carries no finding of its own, and the findings on
  // the pages it links are kept, from the links the same read holds (check/rules.js).
  const kept = scope === null ? whole : narrowFindings(whole, [...scope.pages, ...scope.skipped.keys()], byRules.linked);
  const findings = kept.map((finding) => ({
    page: finding.page,
    rule: finding.rule,
    message: finding.message,
  }));
  const byRule = {};
  for (const finding of findings) byRule[finding.rule] = (byRule[finding.rule] || 0) + 1;
  // A stamps page that cannot be read leaves the desk's name and id unknown, and the layout
  // too on a desk with desk.md (see readDesk): they are null, and the summary says which page
  // to mend, never a default in their place.
  const unread = read.stampsUnread;
  const name = unread ? null : read.stamps.desk || read.stamps.title || "This desk";
  const unknown = read.layout === null ? "name, id and layout are" : "name and id are";
  const stampsLine = unread
    ? `The desk's stamps page, ${unread.rel}, ${unread.problem === PAGE_UNREAD ? "cannot be read" : `carries "${unread.problem}"`}, so the desk's ${unknown} not known; mend that page first. `
    : "";
  // The count is of every page the scope names, those no rule reads too.
  const named = scope === null ? 0 : scope.pages.length + scope.skipped.size;
  const scoped = atLayout
    ? " The scope was not applied, since the rules stopped at the desk's layout."
    : unknownLinks
      ? linksUnknownLine(unknownLinks)
      : scope === null
      ? ""
      : ` Narrowed to ${named} page${named === 1 ? "" : "s"} and what they link.` + skippedLine(scope.skipped);
  const version = pluginVersion();
  // A run asked for a scope never stamps, applied or not; its reason says which.
  const stamp = stampCheckedWith(read, {
    record,
    scoped: asked !== null,
    applied: scope !== null,
    findings: findings.length,
    version,
  });
  return {
    tool: "check_desk",
    plugin_version: version,
    desk: name,
    desk_id: unread ? null : read.stamps.desk_id || null,
    layout: read.layout,
    stamps_unread: unread ? unread.rel : null,
    root: read.root,
    pages_read: read.pages.length,
    pages_with_problems: problems,
    rules_run: byRules.rules.length,
    rules: RULES,
    findings_by_rule: byRule,
    findings,
    checked_with: stamp,
    summary:
      stampsLine +
      `${pagesLine(read.pages, byRules.pages, name || "the desk", byRules.rules.length)}; ` +
      (findings.length
        ? `${findings.length} to look at. The check lists; it never blocks.`
        : "nothing to look at.") +
      scoped +
      (stamp.written ? ` Wrote ${stamp.written.join(" and ")} into ${stamp.page}.` : ""),
  };
}

const TOOLS = [
  {
    name: "check_desk",
    description:
      "Check a desk against rules C01 to C16 and list what to look at, each finding with its " +
      "page, rule and message. It lists; it never blocks. Only when record is true, a " +
      "whole-desk check writes checked_with: <version> and checked_findings: <n> into desk.md.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK_ARGUMENT,
        scope: {
          type: "array",
          items: { type: "string" },
          description:
            "Page paths under the desk's celorus folder, as people/meera-sample.md (with " +
            "celorus/ in front, or as the page's full path, is taken too): the check keeps the " +
            "findings on those pages and on the pages they link. A required page that is missing " +
            "may be named, as the check puts its finding there. A relative path is read with ./ " +
            "dropped and .. resolved inside the celorus folder; letter case is matched as written. " +
            "A page no rule reads (under views/ or merges/, or in a folder below model/) carries " +
            "no findings; when the list also names a page the rules read, the findings on the " +
            "pages it links are kept and the summary names it. " +
            "Refused first: an empty list, and a path that matches no page path the check read " +
            "(where the rules read past the desk's layout). Next, the scope is not applied, and the " +
            "answer is the whole check's with the summary saying why, where the rules stopped at the " +
            "desk's layout, or where a page the list names has links the check could not all read: " +
            "the page cannot be read, its header does not parse or does not read as keys and values, " +
            "or it is not UTF-8. Only then is a list of pages no rule reads alone refused. Leave it " +
            "out to check the whole desk.",
        },
        record: {
          type: "boolean",
          description:
            "True lets a whole-desk check write checked_with: <version> and " +
            "checked_findings: <n> into desk.md. " +
            "Leave it out, or false, to keep the run read-only.",
        },
      },
      additionalProperties: false,
    },
    run: checkDesk,
  },
  ...paths.TOOLS,
  ...VIEW_TOOLS,
];

// The tool with this name, or a refusal naming every tool there is.
function findTool(name) {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (tool) return tool;
  throw new Refusal(
    `There is no desk tool named ${JSON.stringify(name)}. The desk tools are: ` +
      `${TOOLS.map((candidate) => candidate.name).join(", ")}.`,
  );
}

module.exports = { TOOLS, findTool, deskFor, onlyArguments };
