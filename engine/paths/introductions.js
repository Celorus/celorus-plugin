"use strict";
// `introductions_from`: check 2 of the sales desk (gtm one-desk design, section 9, B5), the
// introductions a firm's conversations offered, as the base's ruling R1 on DESK-92 fixes it. It
// answers what gtm's runner `desk-build/paths.py introductions-from <firm>` answered, so check 2
// does not go dark when the runner retires (R17, issue 4197, comment 5814450826). Answer only: it
// writes nothing. Registered by one line in paths/index.js.
//
// A line is an introduction from the firm's thread when it is a `knows` or `introduced_by` proof
// line that is shown or said (a guess is never an introduction), and either names a conversation
// about the firm (`in [[conversation]]`) or cites a file of the firm's own record
// (`from relationships/<firm>/...`). Each such line is answered with the page holding it, as the
// page holds it, so the same line on two pages is two rows, each named (DESK-55).
//
// Every reading is an existing reader's (DESK-92 design gate, section 1): pages by lib/desk.js readDesk
// and check/rules.js checkPages; lines by splitLines off Page.outside; the proof line, its tag and its
// cite by paths/page.js told, with cite/cite.js citationIn the cite fallback where told reads none (the
// union is interim until DESK-172 makes one cite reader); the firm's conversations by linksIn; links
// are read by check/text.js alone (DESK-60).

const { readDesk, DESK_ARGUMENT, PAGE_UNREAD, HEADER_UNREAD, NOT_UTF8 } = require("../lib/desk.js");
const { Refusal } = require("../lib/refusal.js");
const { pluginVersion } = require("../lib/version.js");
const { strip, splitLines, compareText, isMapping } = require("../check/values.js");
const { linksIn } = require("../check/text.js");
const rules = require("../check/rules.js");
const { citationIn } = require("../cite/cite.js");
const { told } = require("./page.js");

const TOOL = "introductions_from";
// The two connections an introduction is (the runner's, paths.py:64).
const INTRODUCTIONS = ["knows", "introduced_by"];
// The problems that keep a page's text from being read: its lines are not counted, and the answer
// names it. A page whose header alone was not read (HEADER_UNREAD) keeps its lines, which are in
// hand (lib/desk.js readPage), and only cannot count as one of the firm's conversations (fix round
// 1, P1); a page whose fence never closes keeps the lines before it (P5, N4). Both are named too.
const UNREADABLE = new Set([PAGE_UNREAD, NOT_UTF8]);

// The firm, as its page's file name: text, not blank, and no slash and no leading dot, since it
// names the folder relationships/<firm>/ whose files are the firm's record.
function firmOf(firm) {
  if (typeof firm !== "string" || strip(firm) === "") {
    throw new Refusal("`firm` is the file name of the firm's page, as text.");
  }
  const said = strip(firm);
  if (said.includes("/") || said.includes("\\") || said.startsWith(".")) {
    throw new Refusal(
      `\`firm\` is "${said}", and it names the folder relationships/<firm>/ whose files are the firm's ` +
        "record, so it may not hold a slash or start with a dot. Name the firm's page by its file name.",
    );
  }
  return said;
}

// inThread counts only `- ` lines told reads outside fences: the lines the tool could read (P2, P6).
const lines = (n) => (n === 1 ? "1 line the tool could read comes" : `${n} lines the tool could read come`);
const pagesWord = (n) => (n === 1 ? "1 page" : `${n} pages`);
// What the answer says when a page is in not_read.
const UNREAD = (n) => `${pagesWord(n)} could not be read whole, so an introduction may be missing.`;

// Check 2 over the pages `read` (lib/desk.js readDesk) for `firm`, a file name: the introductions,
// and what the answer says about them.
function introductionsOf(read, firm) {
  const pages = rules.checkPages(read.pages);
  const why = new Map(read.pages.map((page) => [page.rel, page.why]));
  const readable = pages.filter((page) => !UNREADABLE.has(page.problem));
  const notRead = [];
  for (const page of pages) {
    const reasons = [];
    if (UNREADABLE.has(page.problem)) reasons.push(why.get(page.rel) || page.problem);
    else {
      if (page.problem === HEADER_UNREAD) {
        reasons.push(`its header was not read (${why.get(page.rel) || page.problem}), so whether it is one of ${firm}'s conversations is not known`);
      }
      if (page.fenceOpen) reasons.push("a fence was opened on it and never closed, so its lines after the fence were not read");
    }
    if (reasons.length) notRead.push({ page: page.rel, why: reasons.join("; and ") });
  }
  const about = new Set(
    readable
      .filter((page) => page.problem !== HEADER_UNREAD)
      .filter((page) => page.type === "conversation" && linksIn(isMapping(page.head) ? page.head.about : undefined).includes(firm))
      .map((page) => page.stem),
  );
  const record = `relationships/${firm}/`;
  let inThread = 0;
  const found = [];
  for (const page of readable) {
    for (const line of splitLines(page.outside)) {
      const fields = line.startsWith("- ") ? told(line.slice(2)) : null;
      if (fields === null) continue;
      const from = [];
      if (fields.conversation !== null && about.has(fields.conversation)) from.push("conversation");
      const cited = fields.cite !== null ? fields.cite : (citationIn(line) || { path: null }).path; // fallback: round 4
      if (cited !== null && cited.startsWith(record)) from.push("record");
      if (!from.length) continue;
      inThread += 1;
      if (fields.proof === "guessed" || !INTRODUCTIONS.includes(fields.conn)) continue;
      found.push({ stem: page.stem, row: { page: page.rel, line, from } });
    }
  }
  found.sort((a, b) => compareText(`${a.stem}: ${a.row.line}`, `${b.stem}: ${b.row.line}`) || compareText(a.row.page, b.row.page));
  const introductions = found.map((one) => one.row);
  let none = null;
  if (!introductions.length) {
    if (inThread > 0 || about.size > 0) {
      none = `${lines(inThread)} from ${firm}'s conversations or record, and none is a knows or introduced_by line that is shown or said.`;
    } else if (!pages.some((page) => page.stem === firm)) {
      none = `No page on the desk is named ${firm}, and the tool found no knows or introduced_by line citing a file under ${record}.`;
    } else {
      none = `No conversation is about ${firm}, and the tool found no knows or introduced_by line citing a file under ${record}.`;
    }
    if (notRead.length) none = `${none.slice(0, -1)}, and ${UNREAD(notRead.length)}`;
  }
  return { introductions, conversations: about.size, notRead, none };
}

function introductionsFrom(args = {}) {
  // Required lazily: lib/tools.js requires paths/index.js, which requires this file.
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(TOOL, args, ["desk", "firm"]);
  const firm = firmOf(args.firm);
  const read = readDesk(deskFor(args.desk));
  const { introductions, conversations, notRead, none } = introductionsOf(read, firm);
  const pages = new Set(introductions.map((row) => row.page)).size;
  const unread = notRead.length ? ` ${UNREAD(notRead.length)}` : "";
  return {
    tool: TOOL,
    plugin_version: pluginVersion(),
    firm,
    conversations_about: conversations,
    count: introductions.length,
    pages,
    introductions,
    not_read: notRead,
    none,
    summary:
      none !== null
        ? none
        : `${introductions.length} ${introductions.length === 1 ? "introduction" : "introductions"} from ${firm}'s ` +
          `conversations and record, on ${pagesWord(pages)}.${unread}`,
  };
}

const TOOLS = [
  {
    name: TOOL,
    description:
      "Answer check 2 of the sales desk: the introductions a firm's conversations offered. Lists " +
      "every knows or introduced_by line, shown or said (never a guess), that names a conversation " +
      "about the firm (in [[conversation]]) or cites a file of the firm's own record " +
      "(from relationships/<firm>/...), each with the page holding it and the line as the page " +
      "holds it. Writes nothing. Where there is none, says why.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK_ARGUMENT,
        firm: {
          type: "string",
          description:
            "The firm's page, by its file name without .md (as harbour-sample-capital), which is " +
            "also the name of its record folder under relationships/.",
        },
      },
      required: ["firm"],
      additionalProperties: false,
    },
    run: introductionsFrom,
  },
];

module.exports = { TOOLS, introductionsFrom, introductionsOf, firmOf };
