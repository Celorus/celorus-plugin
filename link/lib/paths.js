"use strict";
// The desk's files as the link reads and writes them: by their path in the desk (forward
// slashes), with the desk server's own caps, and never through a link. Each folder on the way
// to a file is looked at with lstat, so no link is followed to look; a link anywhere on the way
// refuses the call.

const fs = require("node:fs");
const path = require("node:path");
const { foldName } = require("../../engine/lib/desk.js");
const { LinkError } = require("./errors.js");

// The desk server's caps on a call, refused here before anything is sent, never cut.
const CAPS = Object.freeze({
  files: 2000,
  fileBytes: 512 * 1024,
  totalBytes: 8 * 1024 * 1024,
  pathChars: 512,
  pathParts: 12,
  partBytes: 255,
});
// The desk's top folders that are never sent: the seat's own (its key, its holds, the link's
// queue) and git's.
const NEVER_SENT = Object.freeze([".celorus", ".git"]);

// Whether a .gitignore's text keeps the desk's .celorus/ out of git: one of its lines names it, as
// git reads a line (a leading space counts, trailing spaces do not), and no `!` line could let
// the folder back in. Git takes nothing back from inside an ignored folder, so only a `!` line
// matching .celorus itself could: one naming it in any case (git on a Mac ignores case), and any
// with a wildcard or an escape, which count as one.
const SEAT_IGNORED = Object.freeze([".celorus/", ".celorus", "/.celorus/", "/.celorus"]);
function ignoresSeat(text) {
  const lines = ignoreLines(text);
  return lines !== null && lines.some((line) => SEAT_IGNORED.includes(line)) && !lines.some(backIn);
}

// A `!` line that could let .celorus/ back into git.
function backIn(line) {
  return line.startsWith("!") && (fold(line).includes(".celorus") || /[*?[\\]/u.test(line));
}

// The byte-order mark some editors put at the top of a text file.
const BOM = String.fromCharCode(0xfeff);

// A .gitignore's lines as git reads them: past a byte-order mark at its top, with no line end and
// no trailing space; null for no text.
function ignoreLines(text) {
  if (typeof text !== "string") return null;
  return (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/u).map((line) => line.replace(/ +$/u, ""));
}

// A text's lines as the engine reads them where it rewrites the desk's .gitignore
// (update/update.js readText, check/values.js splitLines): a CR LF or a lone CR as a LF, then
// split at every line end Python's str.splitlines() knows, with no empty line after the last
// line end and the byte-order mark kept; null for no text.
const LINE_ENDS = new Set(["\n", "\v", "\f", "\x1c", "\x1d", "\x1e", "\x85", String.fromCharCode(0x2028), String.fromCharCode(0x2029)]);
function engineLines(text) {
  if (typeof text !== "string") return null;
  const normal = text.replace(/\r\n?/gu, "\n");
  const out = [];
  let start = 0;
  for (let i = 0; i < normal.length; i += 1) {
    if (LINE_ENDS.has(normal[i])) {
      out.push(normal.slice(start, i));
      start = i + 1;
    }
  }
  if (start < normal.length) out.push(normal.slice(start));
  return out;
}

// A name as a disk that does not tell case apart may read it: with no invisible character (an
// older Mac disk passes over some), in its compatibility form (so .celorus written with a
// long s, U+017F, is .celorus), and in lower case (so .GIT is .git). The engine's own rule
// (lib/desk.js foldName), so the link and the engine's reader fold a name alike.
const fold = foldName;

// A top folder never sent, in any case or form.
function neverSent(name) {
  return NEVER_SENT.includes(fold(name));
}

// Where an answer may write: only where the engine itself writes, by an allow-list. The desk's
// celorus/ folder (the engine writes nothing in files/, the person's own); inside it, no name
// that starts with a dot but the engine's own (celorus/.views/, a .gitkeep), so no tool's
// settings (.mcp.json, .envrc, .vscode/), and no file an assistant reads as its instructions
// (CLAUDE.md, AGENTS.md and the like), in any case, even a page the engine would name so; and,
// by name, the desk's .gitignore and the Obsidian settings files the engine writes. A name a disk
// could read as another is refused: a short name (GIT~1), a trailing dot or space, a colon, a
// backslash, an invisible character. Each top name is compared as written, so a different case
// (.GIT, CELORUS) is refused, as on a disk that does not tell case apart it could name a folder
// not allowed.
const WRITE_FOLDERS = Object.freeze(["celorus"]);
const WRITE_FILES = Object.freeze([
  ".gitignore",
  // render_view's settings at the desk folder
  ".obsidian/app.json",
  ".obsidian/appearance.json",
  ".obsidian/graph.json",
  ".obsidian/snippets/hide-model.css",
  // update_desk's vault settings, from the install skill (none turns on another's plugin)
  "celorus/.obsidian/app.json",
  "celorus/.obsidian/graph.json",
  "celorus/.obsidian/core-plugins.json",
  "celorus/.obsidian/bookmarks.json",
]);
const WRITE_FILE_FOLDERS = Object.freeze([".obsidian", ".obsidian/snippets", "celorus/.obsidian"]);
// The dot-names the engine writes inside celorus/: a folder by its path, a file by its name.
const DOT_FOLDERS = Object.freeze(["celorus/.views"]);
const DOT_FILES = Object.freeze([".gitkeep"]);
// The one name of a spare file the engine's render leaves beside a file it writes, and removes
// when it finds one left over (render/files.js SPARE): an answer may name one in any folder the
// engine writes in.
const SPARE = /^\.celorus-spare-[0-9a-f]{16}\.tmp$/u;
const INSTRUCTION_FILES = Object.freeze(["agent.md", "agents.md", "agents.override.md", "claude.md", "claude.local.md", "crush.md", "gemini.md", "qwen.md", "warp.md"]);
const ODD_NAME = /[:\\]|[. ]$|~[0-9]+(\.|$)|\p{Default_Ignorable_Code_Point}|\p{Cc}/u;

function writable(rel, { folder = false } = {}) {
  if (!pathOk(rel)) return false;
  if (WRITE_FILES.includes(rel) || (folder && WRITE_FILE_FOLDERS.includes(rel))) return true;
  const parts = rel.split("/");
  if (!folder && SPARE.test(parts[parts.length - 1]) && WRITE_FILE_FOLDERS.includes(parts.slice(0, -1).join("/"))) return true;
  if (!WRITE_FOLDERS.includes(parts[0])) return false;
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i];
    const name = fold(part);
    if (ODD_NAME.test(part) || ODD_NAME.test(name)) return false;
    if (INSTRUCTION_FILES.includes(name)) return false;
    if (!name.startsWith(".")) continue;
    const last = i === parts.length - 1;
    if (DOT_FOLDERS.includes(parts.slice(0, i + 1).join("/"))) continue;
    if (last && !folder && (DOT_FILES.includes(part) || SPARE.test(part))) continue;
    return false;
  }
  return true;
}

// On a seat's graph (layout 3) an answer writes in the seat's desk as on any desk, but never in
// its from-my-team part, which only the graph job writes; and in the firm's common space beside
// it only the common space's own pages: the desk-wide pages and folders the engine keeps there
// and its stamps, log, name list and table of defaults (engine/layout/layout.js), with the same
// screens on each name as inside celorus/.
const GRAPH = require("../../engine/lib/workingsets.json").layout_3;
const TEAM = GRAPH.parts[GRAPH.parts.length - 1];

function graphWritable(rel, { folder = false } = {}) {
  const parts = rel.split("/");
  if (parts[0] === "celorus" && parts.length > 1 && fold(parts[1]) === TEAM) return false;
  return writable(rel, { folder });
}

function commonWritable(rel, { folder = false } = {}) {
  if (!pathOk(rel)) return false;
  const parts = rel.split("/");
  for (const part of parts) {
    const name = fold(part);
    if (ODD_NAME.test(part) || ODD_NAME.test(name) || INSTRUCTION_FILES.includes(name) || name.startsWith(".")) return false;
  }
  const pages = [...GRAPH.common_pages, ...GRAPH.common_own_pages];
  if (folder) {
    return pages.some((page) => page.startsWith(`${rel}/`)) || GRAPH.common_folders.some((at) => `${rel}/`.startsWith(at) || at.startsWith(`${rel}/`));
  }
  return pages.includes(rel) || GRAPH.common_folders.some((at) => rel.startsWith(at));
}

const STRICT = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// A path in the desk the server takes: relative, forward slashes, at most the caps' parts and
// characters, no empty, . or .. part, no backslash or NUL, nothing under a folder never sent.
function pathOk(rel) {
  if (typeof rel !== "string" || rel === "" || rel.length > CAPS.pathChars || rel.includes("\\") || rel.includes("\0")) return false;
  const parts = rel.split("/");
  if (parts.length > CAPS.pathParts || neverSent(parts[0])) return false;
  return parts.every((part) => part !== "" && part !== "." && part !== ".." && Buffer.byteLength(part, "utf8") <= CAPS.partBytes);
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return null;
    throw err;
  }
}

function linkInside(rel) {
  return new LinkError(
    "link",
    `${rel} in the desk is a link, or is reached through one. The link never reads or writes through a link, so nothing was sent and nothing was written.`,
  );
}

// Where `rel` stands in the desk at `root`: "absent" when it, or a folder on its way, is not
// there; else its lstat. A link on the way, or a file where a folder should be, refuses.
function standing(root, rel) {
  const parts = rel.split("/");
  let at = root;
  for (let i = 0; i < parts.length; i += 1) {
    at = path.join(at, parts[i]);
    const st = lstatOrNull(at);
    if (st === null) return "absent";
    if (st.isSymbolicLink()) throw linkInside(parts.slice(0, i + 1).join("/"));
    if (i < parts.length - 1 && !st.isDirectory()) throw new LinkError("not_folder", `${parts.slice(0, i + 1).join("/")} in the desk is not a folder. Nothing was sent and nothing was written.`);
    if (i === parts.length - 1) return st;
  }
  return "absent";
}

// What readBytes answers for a file over the cap: it is not read.
const TOO_BIG = Object.freeze({ tooBig: true });

// The bytes of a plain file at `rel`, opened without following a link; null when absent, TOO_BIG
// when over `maxBytes`.
function readBytes(root, rel, maxBytes = CAPS.fileBytes) {
  const st = standing(root, rel);
  if (st === "absent") return null;
  if (!st.isFile()) throw new LinkError("not_file", `${rel} in the desk is not a plain file. Nothing was sent and nothing was written.`);
  const fd = fs.openSync(path.join(root, rel), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const size = fs.fstatSync(fd).size;
    if (size > maxBytes) return TOO_BIG;
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

// The text of `data`, or null when it is not UTF-8.
function textOf(data) {
  try {
    return STRICT.decode(data);
  } catch {
    return null;
  }
}

// Whether the first bytes of the file at `rel` read as UTF-8 (a file too big to send is named
// when it is text, and passed over when it is not).
function looksLikeText(root, rel) {
  const fd = fs.openSync(path.join(root, rel), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const head = Buffer.alloc(4096);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    decoder.decode(head.subarray(0, n), { stream: true });
    return true;
  } catch {
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

function tooBig(rel) {
  return new LinkError("too_big", `${rel} is larger than the desk server takes (${CAPS.fileBytes} bytes a file). Nothing was sent.`);
}

function badPath(rel) {
  return new LinkError("path", `${JSON.stringify(rel)} is not a path the desk server takes. Nothing was sent.`);
}

module.exports = { CAPS, NEVER_SENT, ODD_NAME, SPARE, TOO_BIG, WRITE_FILES, backIn, commonWritable, engineLines, fold, graphWritable, ignoreLines, ignoresSeat, neverSent, writable, badPath, linkInside, looksLikeText, lstatOrNull, pathOk, readBytes, standing, textOf, tooBig };
