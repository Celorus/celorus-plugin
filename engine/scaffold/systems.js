"use strict";
// The systems table and the set-up record, the two tables scaffold_desk writes at the end of a
// desk's celorus/desk.md, below its own text. The systems table has one row per role: the
// connector named as the harness shows it (passed in by the install; no connector's name is
// carried here), and its state: connected, still to connect, or none on this desk where the
// person said, at set-up or when the update asked, that the firm has no such system (such a row
// names no connector). The set-up record has one row for each thing the set-up made that holds
// the rest, the seat pointer outside the desk folder included. Their headings, words and column
// lines are read from install-desk/scaffold.md, as the update reads its templates there, so there
// is one copy of each; the rows are the engine's. The install's "still to connect" and "none on
// this desk" lists, the update and take_down all read the tables back through readTables here.

const path = require("node:path");
const { readText } = require("../update/history.js");

const PLUGIN = path.resolve(__dirname, "..", "..");
const SCAFFOLD = path.join(PLUGIN, "skills", "install-desk", "scaffold.md");

// The roles, in the table's order, and the three states a row may be in.
const ROLES = Object.freeze(["mail", "calendar", "files", "chat", "crm", "client book", "product list"]);
const CONNECTED = "connected";
const STILL = "still to connect";
const NONE_HERE = "none on this desk";
const STATES = Object.freeze([CONNECTED, STILL, NONE_HERE]);
// A role the harness shows no connector for: the desk log's blank.
const NONE = "·";

// What each set-up record row names, by its path: the desk folder itself, the two entries the
// set-up puts in a folder that was already there, and the seat pointer and its folder in the
// home folder, written home-relative.
const POINTER_FOLDER = "~/.celorus/";
const POINTER = /^~\/\.celorus\/seat-[a-z0-9-]+$/u;
// The line break the set-up adds at the end of a .gitignore's last line when that line had none,
// before the desk's lines: recorded, so take_down names it with them.
const LINE_BREAK_AT = ".gitignore (line break)";
// The mark on a .gitignore the set-up made, in a folder it made or one that held none: written
// from what the set-up saw before its first write, never read from the file later.
const IGNORE_MADE = ".gitignore (made by the set-up)";
const MADE = Object.freeze({
  ".": "the desk folder",
  "celorus/": "the desk's celorus folder",
  ".gitignore": "the desk's .gitignore",
  [IGNORE_MADE]: "the desk's .gitignore, which the set-up made",
  [LINE_BREAK_AT]: "the line break the set-up added at the end of the .gitignore's last line",
  [POINTER_FOLDER]: "the seat pointer's folder",
});
const POINTER_SAID = "the seat pointer";
// A line the set-up added to the desk's .gitignore: the record names the line, never the file,
// as `.gitignore: <line>`, the line one of the scaffold's.
const LINE_SAID = "a line the set-up added to the desk's .gitignore";
const LINE_AT = ".gitignore: ";

const SYSTEMS_HEADING = "## The systems table";
const RECORD_HEADING = "## The set-up record";
const POINTER_HEADING = "## The seat pointer";

// The scaffold's text, as the update reads it, through the engine's listed text reader.
function scaffoldText() {
  const text = readText(SCAFFOLD);
  if (text === null) throw new Error("the plugin's install-desk/scaffold.md cannot be read");
  return text;
}

const HEADING_PATH = /^## `([^`]+)`/u;

// Every `## <backticked path>` heading in the scaffold, mapped to the fenced block below it:
// the templates scaffold_desk writes, the .gitignore's lines among them.
function templates(text) {
  const lines = text.split("\n");
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const m = HEADING_PATH.exec(lines[i]);
    const rel = m ? m[1] : null;
    if (rel === null || !(rel === ".gitignore" || rel.startsWith("celorus/"))) {
      i += 1;
      continue;
    }
    while (i < lines.length && !lines[i].startsWith("```")) i += 1;
    if (i >= lines.length) throw new Error(`${rel}: heading with no fenced block`);
    i += 1;
    const body = [];
    while (i < lines.length && lines[i].replace(/\s+$/u, "") !== "```") {
      body.push(lines[i]);
      i += 1;
    }
    if (i >= lines.length) throw new Error(`${rel}: unterminated fenced block`);
    if (!body.length) throw new Error(`${rel}: empty template`);
    out[rel] = `${body.join("\n")}\n`;
    i += 1;
  }
  return out;
}

// The lines the desk's .gitignore carries, from the scaffold's `.gitignore` template.
function gitignoreLines(text) {
  const template = templates(text)[".gitignore"];
  if (template === undefined) throw new Error("the scaffold no longer shows the desk's .gitignore");
  return template.split("\n").filter((line) => line !== "");
}

// The part of the scaffold under the heading that starts with `heading`, up to the next
// heading outside a fenced block (a block may show a heading of its own).
function sectionOf(text, heading) {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.startsWith(heading));
  if (at === -1) throw new Error(`the scaffold no longer has a section starting "${heading}"`);
  const rest = lines.slice(at + 1);
  let fenced = false;
  const end = rest.findIndex((line) => {
    if (line.startsWith("```")) fenced = !fenced;
    return !fenced && line.startsWith("## ");
  });
  return end === -1 ? rest : rest.slice(0, end);
}

// The fenced block in the scaffold's section under `heading`, as its lines.
function blockUnder(text, heading) {
  const lines = sectionOf(text, heading);
  const open = lines.findIndex((line) => line.startsWith("```"));
  const close = open === -1 ? -1 : lines.slice(open + 1).findIndex((line) => line.replace(/\s+$/u, "") === "```");
  if (open === -1 || close === -1) throw new Error(`the scaffold's "${heading}" section has no fenced block`);
  const body = lines.slice(open + 1, open + 1 + close);
  if (!body.length) throw new Error(`the scaffold's "${heading}" block is empty`);
  return body;
}

// A table's block from the scaffold: its lines, its heading (the first line, a level-two
// heading) and its column line (the last line but one, above the separator).
function tableBlock(text, heading) {
  const body = blockUnder(text, heading);
  const title = body[0];
  const columns = body[body.length - 2];
  const rule = body[body.length - 1];
  if (!title.startsWith("## ") || !columns || !columns.startsWith("|") || !/^\|(-+\|)+$/u.test(rule)) {
    throw new Error(`the scaffold's "${heading}" block is not a heading, words and a table's two first lines`);
  }
  return { lines: body, title, columns };
}

// The two blocks, the seat pointer's place and the .gitignore's lines, as the scaffold shows them.
function shapes(text = scaffoldText()) {
  const pointer = sectionOf(text, POINTER_HEADING).join("\n");
  const place = /`(~\/[^`]+)`/u.exec(pointer);
  const line = /one line: `([^`]+)`/u.exec(pointer);
  if (!place || !line) throw new Error("the scaffold no longer says where the seat pointer goes and what it holds");
  return {
    systems: tableBlock(text, SYSTEMS_HEADING),
    record: tableBlock(text, RECORD_HEADING),
    pointer: { place: place[1], line: line[1] },
    gitignore: gitignoreLines(text),
  };
}

function row(cells) {
  return `| ${cells.join(" | ")} |`;
}

// The text scaffold_desk adds at the end of desk.md: the systems table, then the set-up record.
// `systems` is one { role, connector, state } per role, in the table's order (connector null
// where the harness shows none); `made` is one { what, path } per thing the set-up made.
function tablesText(systems, made, shape = shapes()) {
  const lines = [
    "",
    ...shape.systems.lines,
    ...systems.map((r) => row([r.role, r.connector === null ? NONE : r.connector, r.state])),
    "",
    ...shape.record.lines,
    ...made.map((r) => row([r.what, r.path])),
  ];
  return `${lines.join("\n")}\n`;
}

// The cells of a table line: the text between its first and last bar, split at each bar.
function cellsOf(line) {
  const inner = line.trim();
  if (!inner.startsWith("|") || !inner.endsWith("|") || inner.length < 2) return null;
  return inner.slice(1, -1).split("|").map((cell) => cell.trim());
}

// The rows of the table under the line `title` in `lines`: null when there is no such heading;
// otherwise the column line as written and each row after the separator, until the first line
// that is not a table line.
function tableUnder(lines, title) {
  const at = lines.findIndex((line) => line.replace(/\s+$/u, "") === title);
  if (at === -1) return null;
  let i = at + 1;
  while (i < lines.length && !lines[i].trim().startsWith("|") && !lines[i].startsWith("## ")) i += 1;
  const table = [];
  while (i < lines.length && lines[i].trim().startsWith("|")) {
    table.push(lines[i].trim());
    i += 1;
  }
  return { columns: table[0] || null, rows: table.slice(2) };
}

// A systems row read back, or the reason it cannot be: its role, its connector (null for the
// blank) and its state.
function systemsRow(line, seen) {
  const cells = cellsOf(line);
  if (!cells || cells.length !== 3) return { why: "it is not three cells" };
  const [role, connector, state] = cells;
  if (!ROLES.includes(role)) return { why: `its role is not one of: ${ROLES.join(", ")}` };
  if (seen.has(role)) return { why: `it names ${role} a second time` };
  if (!STATES.includes(state)) return { why: `its state is not ${CONNECTED}, ${STILL} or ${NONE_HERE}` };
  const named = connector === NONE || connector === "" ? null : connector;
  if (state === CONNECTED && named === null) return { why: "it is connected but names no connector" };
  if (state === NONE_HERE && named !== null) return { why: "it is none on this desk but names a connector" };
  seen.add(role);
  return { role, connector: named, state };
}

// A set-up record row read back, or the reason it cannot be.
function recordRow(line, shape) {
  const cells = cellsOf(line);
  if (!cells || cells.length !== 2) return { why: "it is not two cells" };
  const [what, where] = cells;
  if (Object.hasOwn(MADE, where) || POINTER.test(where)) return { what, path: where };
  if (where.startsWith(LINE_AT) && shape.gitignore.includes(where.slice(LINE_AT.length))) return { what, path: where };
  return {
    why: `its path is not one the set-up makes: ., celorus/, .gitignore, ${IGNORE_MADE}, ${LINE_AT}<one of the desk's .gitignore lines>, ${LINE_BREAK_AT}, ${POINTER_FOLDER} or ~/.celorus/seat-<desk_id>`,
  };
}

// Whether a column line as written holds the scaffold's columns, read by its trimmed cells, so a
// line a table formatter padded still reads.
function sameColumns(written, columns) {
  const got = written === null ? null : cellsOf(written);
  const want = cellsOf(columns);
  return got !== null && got.length === want.length && got.every((cell, i) => cell === want[i]);
}

// Both tables, read from the body of desk.md: each is null when desk.md holds no such table,
// else { rows, unread }, `unread` naming each row that could not be read, as written, and why.
// Rows are read one by one: a row that does not read is named, and every row that does counts.
function readTables(body, shape = shapes()) {
  const lines = body.split("\n");
  const read = (block, rowOf) => {
    const table = tableUnder(lines, block.title);
    if (table === null) return null;
    if (!sameColumns(table.columns, block.columns)) {
      return { rows: [], unread: [{ row: table.columns || block.title, why: `its columns are not ${block.columns}` }] };
    }
    const rows = [];
    const unread = [];
    for (const line of table.rows) {
      const got = rowOf(line);
      if (got.why) unread.push({ row: line, why: got.why });
      else rows.push(got);
    }
    return { rows, unread };
  };
  const seen = new Set();
  return {
    systems: read(shape.systems, (line) => systemsRow(line, seen)),
    record: read(shape.record, (line) => recordRow(line, shape)),
  };
}

module.exports = {
  ROLES,
  STATES,
  CONNECTED,
  STILL,
  NONE_HERE,
  NONE,
  MADE,
  POINTER,
  POINTER_FOLDER,
  POINTER_SAID,
  LINE_SAID,
  LINE_AT,
  LINE_BREAK_AT,
  IGNORE_MADE,
  SCAFFOLD,
  scaffoldText,
  sectionOf,
  templates,
  shapes,
  tablesText,
  readTables,
};
