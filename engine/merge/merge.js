"use strict";
// Merge two pages of one kind, and undo it (one-desk design sections 3.4 and 10). check-desk's
// skill, "Merge two pages", states the same steps in words. Every page a merge changes is copied
// before and after, so the undo is exact, and refuses when a page moved on since.
//
// A merge changes only what it merges. The kept page's header keeps every line it had: a detail
// it lacked is added as the other page wrote it, and a list both pages hold is joined on one
// line. The lines under `## Connections` and `## Coordinates` join the kept page's own section
// of that name, found by the checker's own reader; the rest of the other page goes under
// `## From the merged page <title>`, its headings one level down. A detail both headers hold with
// different values keeps the kept page's value, and the other page's goes first under that
// heading as `- <key>: <value>`.
//
// The order follows the rule in update/history.js. The record is written whole (every copy
// flushed to disk) before the desk changes. Then the merged page is taken off the desk, the
// merge's first change outside the record: whether it can be removed depends on the page itself
// (a lock flag, its own ACL, its owner under a sticky folder), which cannot be asked, so it is
// taken before any page is rewritten. If the record cannot be written, or the page cannot be
// removed, the record this call made is removed again, its files and then its folders in reverse,
// and the merge is refused: "Nothing was changed." (or, if that fails too, the refusal names what
// is left). Only then are the pages rewritten. A run cut at any point after the record can be
// undone. The undo checks every path its record names before it restores one: inside celorus/,
// outside merges/, with its copy under before/.
//
// Every file this file reads is read through its one guarded reader (readGuarded), and nothing
// else here reads a file: a page of the desk, log.md, a record's merge.md, its before/ and after/
// copies, and an older record's pages. It reads a plain file through the file itself, never
// through a link. Anything else is refused before any write, folder or probe, by its path under
// celorus/ and the kind in the engine's own words: a link (and where it leads: to nothing, to a
// folder, back to itself), not a plain file (what is there), cannot be read (why, in words, as
// "this machine gives no permission to read it"), or not there where the record needs it. The
// why is never the error's own message, which carries the desk's absolute path. A merge reads
// every page of the desk once, up front (its two pages, the repoint, still_named and log.md's
// line ends), and refuses so a page the desk reader could not open. An undo reads every file its
// plan reads (each page its record names, as the desk has it now, their before/ and after/
// copies, log.md and merge.md), then asks every page it writes (ahead), all before its first
// change. A record is read only through folders of the desk's own, the write side's check
// (history.js holdFolder): merges/, a record folder or a folder in it that is a link is refused
// by its name. Every path a record names is asked before any is read: one that is absolute,
// climbs out of celorus/ or leads out of it is refused by the record's name, never echoed, and
// nothing outside celorus/ is opened.
//
// A page the undo makes again (the page the merge removed) is made owner-readable and writable,
// so the call's later writes to it (the views, log.md) never meet its mode. Its recorded mode,
// the copy's permission bits, is put back as the call's last step, after every other write, and
// on every exit the running call survives, a stop in the views or log step too. If that fails, the
// answer says so for that page, and nothing is unwound: the text is right. The window: a kill
// before that last step leaves the page writable by its owner, which is safe.
//
// The repoint acts only on the spans the reader gives, where linksIn reads them: check/text.js
// linkSpans over each value of the page's header, decoded, and over its body outside fenced
// blocks. A span is repointed when the page it names (linkName, as the check and the views read
// it) is the merged page, whether written [[name]], [[name|label]], [[name#part]] or with blanks
// around the name, [[ name ]]; only the name changes. A link the reader reads but cannot give a
// span for in the page's text (a header value written with an escape, a link read across a
// fenced block) is left as written, never guessed at. still_named is read after the repoint, off
// the pages as the merge leaves them, by the same reading: every link that still names the
// merged page is listed, exactly, with every line that still holds its bare file name.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot, refuseLinkedFolders } = require("../lib/linkedroot.js");
const { readDesk, splitPage, NO_HEADER, NOT_UTF8, HEADER_UNREAD, PAGE_UNREAD, STAMP_NOT_ONE_VALUE } =
  require("../lib/desk.js");
const { parseHeader } = require("../lib/header.js");
const { pluginVersion } = require("../lib/version.js");
const { checkPages } = require("../check/rules.js");
const { loadDeskModel, ModelUnreadable } = require("../check/model.js");
const { linkSpans, linkName, linksIn, readOutsideFences, headingOf, sectionSpan, holdsContactDetails, Page } =
  require("../check/text.js");
const V = require("../check/values.js");
const { dumpLines, oneLine, markMoments, sameValue, Moment, isCollection } = require("../update/yaml.js");
const { writeWhole, writePage, lineEndOf, withLineEnd, readOwn, holdFolder, NotOwnFolder, NotClosed, rstrip, quoted, aMoment, clockNow, NOTHING, folderShown } =
  require("../update/history.js");
// The check before the first write, and a stop's own words (history.js).
const { ahead, modesLast, previousTail, endWithTail, sayBeforeTail, codeOf } = require("../update/history.js");

// The owner's read and write bits, which a page the undo makes again is made with (see above).
const OWNER_RW = 0o600;

const TOOL = "merge_pages";
const SKIP_TOP = new Set(["model", "views", "merges"]);
const SKIP = ["type", "title", "aliases", "timestamp", "description"];
// Of those, the one that still belongs on the desk when the two pages disagree.
const CARRY = ["description"];
// The two sections the checker reads at level two: joined, never pushed a level down.
const JOINED = ["Connections", "Coordinates"];
const FRONT = /^---\n([\s\S]*?\n)---\n/u;
// The header as the desk reader finds it, its last line end left out.
const HEADER = /^---\n([\s\S]*?)\n---\n/u;
// A header key as the header reader (lib/header.js KEY_LINE) reads one: a letter or underscore,
// then letters, digits, underscores, dots or hyphens, then a colon and a space or the line's end.
const KEY = /^(?<key>[A-Za-z_][A-Za-z0-9_.-]*):(?= |$)/u;
// A header comment: a line that is only a comment, at any indent.
const COMMENT = /^[ \t]*#/u;
const ATX = /^(?<indent> {0,3})(?<hashes>#{1,5})(?=[ \t]|$)/u;

const SAYS_NOTHING = "its header says neither `type` nor `title`";
// What to say about a page the merge cannot use, keyed by what is wrong with it: the rule
// check-desk lists it under, and the mend to ask for.
const MENDS = {
  [NO_HEADER]: ["C12", "Give it a header saying at least its `type` and `title`"],
  [HEADER_UNREAD]: ["C12", "Put the header back as YAML"],
  [NOT_UTF8]: ["C12", "Save it again as UTF-8 text"],
  [SAYS_NOTHING]: ["C02", "Give it a header saying at least its `type` and `title`"],
  [PAGE_UNREAD]: ["C12", "Restore the page, or move it out of the desk folder"],
};

class MergeRefused extends Refusal {}

function refuse(message) {
  throw new MergeRefused(message);
}

function isEmpty(value) {
  return V.isEmpty(value);
}

function inList(list, value) {
  return list.some((item) => sameValue(item, value));
}

function sameList(a, b) {
  return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
}

// A value as a header line or lines: a list of plain values on one line, a list of mappings one
// `- {...}` per item, a plain value `key: value`.
function render(key, value) {
  const collection = isCollection(value);
  return dumpLines({ [key]: value }, { sortKeys: false, flow: collection ? null : false, momentSep: " " });
}

// The header's lines grouped by the top-level key each belongs to, in order; a line that starts
// no key belongs to the key above it.
function chunks(head) {
  const out = [];
  for (const line of V.splitLines(head)) {
    const m = KEY.exec(line);
    if (m || !out.length) out.push([m ? m.groups.key : null, [line]]);
    else out[out.length - 1][1].push(line);
  }
  return out;
}

// A header value on one line, spelled as a header spells it.
function plainValue(value) {
  return V.splitWords(oneLine(value, { momentSep: "T" })).join(" ");
}

// The file names a page is remembered as not the same as, always as a list.
function notSameAs(head) {
  const value = V.own(head, "not_same_as");
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value.map(V.show) : [V.show(value)];
}

// A page's header as the merge compares it: floats as Python holds them, and a date or moment
// the header wrote bare marked as one, read from the header's own lines for that key.
function markedHead(head, byKey) {
  const out = {};
  for (const [key, value] of Object.entries(V.asPython(head) || {})) {
    out[key] = markMoments(value, (byKey.get(key) || []).join("\n"));
  }
  return out;
}

function chunkMap(list) {
  const map = new Map();
  for (const [key, lines] of list) map.set(key, lines);
  return map;
}

// The kept page's header text with the other page's details added, and one body line per
// detail the two pages hold with different values.
function joinedHead(a, aText, b, bText) {
  const ours = chunks(FRONT.exec(aText)[1]);
  const theirs = chunkMap(chunks(FRONT.exec(bText)[1]));
  const aHead = markedHead(a.head, chunkMap(ours));
  const bHead = markedHead(b.head, theirs);
  const changed = new Map();
  const added = [];
  const differs = [];
  const has = (head, key) => Object.hasOwn(head, key);
  const get = (head, key) => (has(head, key) ? head[key] : null);

  const own = V.items(V.truthy(get(aHead, "aliases")) ? get(aHead, "aliases") : []);
  const aliases = own.slice();
  const bAliases = V.items(V.truthy(get(bHead, "aliases")) ? get(bHead, "aliases") : []);
  for (const name of [get(bHead, "title"), ...bAliases]) {
    if (V.truthy(name) && !sameValue(name, get(aHead, "title")) && !inList(aliases, name)) aliases.push(name);
  }
  if (!sameList(aliases, own)) changed.set("aliases", aliases);
  for (const [key, value] of Object.entries(bHead)) {
    if (SKIP.includes(key)) {
      if (CARRY.includes(key) && !isEmpty(value) && !sameValue(value, get(aHead, key))) {
        differs.push(`- ${key}: ${plainValue(value)}`);
      }
      continue;
    }
    if (!has(aHead, key)) {
      if (!theirs.has(key)) {
        refuse(
          `${key} on ${b.rel} is a header line this merge cannot read: it reads a key as a letter ` +
            "or underscore, then letters, digits, underscores, dots or hyphens, then a colon. Write " +
            "that key in that form, then say this again",
        );
      }
      if (isEmpty(value)) continue;
      added.push(...theirs.get(key));
      continue;
    }
    if (aHead[key] === null || aHead[key] === "") {
      changed.set(key, value);
      continue;
    }
    let mine = aHead[key];
    let other = value;
    if (key === "not_same_as") {
      mine = notSameAs(aHead);
      other = notSameAs(bHead);
    } else if (!(Array.isArray(mine) && Array.isArray(other))) {
      if (!isEmpty(other) && !sameValue(other, mine)) differs.push(`- ${key}: ${plainValue(other)}`);
      continue;
    }
    const joined = [...mine, ...other.filter((v) => !inList(mine, v))];
    if (!sameList(joined, mine)) changed.set(key, joined);
  }

  const lines = ["---"];
  for (const [key, chunk] of ours) {
    if (key !== null && changed.has(key)) {
      // The value is written anew; a comment line under it is the person's, and stays.
      lines.push(...render(key, changed.get(key)), ...chunk.slice(1).filter((line) => COMMENT.test(line)));
      changed.delete(key);
    } else lines.push(...chunk);
  }
  for (const [key, value] of changed) lines.push(...render(key, value));
  return [`${[...lines, ...added, "---"].join("\n")}\n`, differs];
}

// Where a section's lines are in the body's lines, read as the checker reads it: the heading
// found outside fenced blocks.
function span(body, heading) {
  const outside = V.splitLines(readOutsideFences(body)[0]);
  const found = sectionSpan(outside, heading);
  if (found === null) return null;
  return [found[0], found[1] === outside.length ? V.splitLines(body).length : found[1]];
}

function trimNewlines(text) {
  return text.replace(/^\n+|\n+$/gu, "");
}

function joinedBody(aBody, bBody, title, differs) {
  let body = aBody;
  for (const heading of JOINED) {
    const theirs = span(bBody, heading);
    if (theirs === null) continue;
    const mine = span(body, heading);
    const lines = V.splitLines(body);
    const have = new Set(mine ? lines.slice(mine[0], mine[1]) : []);
    const fresh = V.splitLines(bBody)
      .slice(theirs[0], theirs[1])
      .filter((line) => V.strip(line) && !have.has(line));
    if (!fresh.length) continue;
    if (mine === null) {
      body = `${body.replace(/\n+$/u, "")}\n\n## ${heading}\n\n${fresh.join("\n")}\n`;
      continue;
    }
    const filled = [];
    for (let i = mine[0]; i < mine[1]; i += 1) if (V.strip(lines[i])) filled.push(i);
    const at = filled.length ? filled[filled.length - 1] + 1 : mine[0];
    lines.splice(at, 0, ...(filled.length ? fresh : ["", ...fresh]));
    body = `${lines.join("\n")}\n`;
  }

  const rest = V.splitLines(bBody);
  const outside = V.splitLines(readOutsideFences(bBody)[0]);
  const drop = new Set();
  const first = outside.findIndex((line) => V.strip(line));
  if (first !== -1) {
    const h = headingOf(outside[first]);
    if (h && h[0] === 1) drop.add(first); // the other page's title
  }
  for (const heading of JOINED) {
    const found = span(bBody, heading);
    if (found) for (let i = found[0] - 1; i < found[1]; i += 1) drop.add(i);
  }
  const kept = [];
  rest.forEach((line, i) => {
    if (drop.has(i)) return;
    kept.push(i < outside.length && ATX.test(outside[i]) ? line.replace(ATX, "$<indent>#$<hashes>") : line);
  });
  const restText = trimNewlines(kept.join("\n"));
  const parts = [differs.join("\n"), restText].filter((part) => V.strip(part));
  if (parts.length) {
    return `${body.replace(/\n+$/u, "")}\n\n## From the merged page ${title}\n\n${parts.join("\n\n")}\n`;
  }
  return body;
}

// `file` with every link in its path resolved, or, when it cannot be, as it is written.
function realOr(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function exists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

// What is at a path that is neither a plain file nor a link, in plain words.
const KINDS = [
  ["isDirectory", "a folder"],
  ["isFIFO", "a pipe (a channel one program writes and another reads)"],
  ["isSocket", "a socket (a point a program listens on)"],
  ["isCharacterDevice", "a device"],
  ["isBlockDevice", "a device"],
];

function kindOf(st) {
  for (const [is, said] of KINDS) if (st[is]()) return said;
  return "another kind of file";
}

// Where the link at `file` leads, in plain words.
function leadsTo(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch (err) {
    if (err.code === "ELOOP") return "it leads back to itself";
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return "it leads to nothing";
    if (err.code === "EACCES" || err.code === "EPERM") return "it leads where this machine gives no permission to look";
    return "it leads where the file system will not follow it";
  }
  return st.isFile() ? "it leads to a file" : `it leads to ${kindOf(st)}`;
}

// Why a file could not be read, in the engine's own words, by the error's code: never the error's
// own message, which carries the file's absolute path, and never the code itself. These are the
// words after the reader's first look found a plain file, so a link or a folder met then was put
// there since; a loop met at the first look was there before it (loopOnWay).
const GONE = "it is gone since this call began";
const WHY_NOT_READ = {
  EACCES: "this machine gives no permission to read it",
  EPERM: "this machine gives no permission to read it",
  ENOENT: GONE,
  ENOTDIR: GONE,
  ELOOP: "a link was put in its place since this call began",
  EISDIR: "a folder was put in its place since this call began",
};

function whyNotRead(err) {
  const code = err && typeof err.code === "string" ? err.code : null;
  return code !== null && Object.hasOwn(WHY_NOT_READ, code) ? WHY_NOT_READ[code] : "the file system would not give it";
}

// The first folder on the way to `rel` under `root` that is a link, as its path under `root`, or
// null.
function linkOnWay(root, rel) {
  const parts = rel.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i += 1) {
    const folder = parts.slice(0, i).join("/");
    try {
      if (fs.lstatSync(at(root, folder)).isSymbolicLink()) return folder;
    } catch {
      return null;
    }
  }
  return null;
}

// Why `rel` could not be read when the reader's first look met a loop: a folder on its way is a
// link that leads back to itself, there when the look was made, never put there since.
function loopOnWay(root, rel) {
  const folder = linkOnWay(root, rel);
  return folder === null
    ? "a folder on its way is a link that leads back to itself"
    : `the folder ${folderShown(folder)} on its way is a link that leads back to itself`;
}

// Refuses reading `shown`, a record's file by its path under celorus/ (`root`), through a folder
// that is not the desk's own: the write side's check (history.js holdFolder), asked before the
// read, the link named by its path under celorus/. A folder the check cannot resolve that is not
// a link is left to the reader, which says why.
function ownFolders(root, shown, words) {
  try {
    holdFolder(at(root, shown));
    return;
  } catch (err) {
    if (!(err instanceof NotOwnFolder)) throw err;
  }
  const folder = linkOnWay(root, shown);
  if (folder === null) return;
  refuse(
    `${folderShown(folder)} is a link, not a folder of the desk's own (${leadsTo(at(root, folder))}), so ${words.who} ` +
      `cannot read ${shown} through it: ${words.reads}, and none through a link. Put the folder itself back in its ` +
      `place, then say this again. ${NOTHING}`,
  );
}

// Who reads a file, and why, as the guarded reader's refusal says it: the tool, what it reads,
// and what to do about each kind it meets (a link, another kind of file, a file it cannot read).
const RECORD_MENDS = {
  link: "Put the record's own file back in its place",
  kind: "Put the record's own file back in its place",
  unread: "Restore it as the merge wrote it",
};
const MERGE_PAGE = {
  who: "this merge",
  reads: "a merge reads every page on the desk",
  link: "Put the page itself in its place, or move the link out of celorus/",
  kind: "Put a page in its place, or move it out of celorus/",
  unread: "Restore the page, or move it out of celorus/",
};
const UNDO_PAGE = {
  who: "this undo",
  reads: "an undo reads every page its record names",
  link: "Put the page itself in its place",
  kind: "Put the page itself in its place",
  unread: "Restore the page",
};
const MERGE_RECORD = { who: "this merge", reads: "a merge reads the records under merges/", ...RECORD_MENDS };
const UNDO_RECORD = { who: "this undo", reads: "an undo reads the records under merges/", ...RECORD_MENDS };
// A tool's words for a page of the desk, then for a record's file.
const WORDS = { merge: [MERGE_PAGE, MERGE_RECORD], undo: [UNDO_PAGE, UNDO_RECORD] };

// The one reader of every file this file reads (the rule at the top): `rel` under `root`, named
// in a refusal as `shown`, its path under celorus/, and `words` saying who reads it and why.
// Returns its bytes, read through the file itself, never through a link (history.js readOwn), or
// null when nothing is at its path; with `need`, that is refused too, as gone since the call
// began, or in `missing`'s words (a record's copy never seen there). A link (wherever it leads),
// anything else but a plain file, or a file that cannot be read is refused, the kind in the
// engine's own words, never the error's message. With `unreadAtStart` (a page the desk reader
// could not open) the page is refused even when it reads now.
function readGuarded(root, rel, words, { shown = rel, need = false, missing = null, unreadAtStart = false } = {}) {
  // The one raw read of a file in this file, private to this reader.
  const bytesOf = (file) => readOwn(file);
  const file = at(root, rel);
  const cannot = (why) =>
    refuse(
      `${shown} cannot be read (${why}), so ${words.who} cannot read it: ${words.reads}. ${words.unread}, then say ` +
        `this again. ${NOTHING}`,
    );
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    // The first look: a loop met here was there before it.
    if (err && err.code === "ELOOP") return cannot(loopOnWay(root, rel));
    if (!(err && (err.code === "ENOENT" || err.code === "ENOTDIR"))) return cannot(whyNotRead(err));
    if (!need) return null;
    return missing === null ? cannot(GONE) : refuse(missing);
  }
  if (st.isSymbolicLink()) {
    refuse(
      `${shown} is a link, not a plain file (${leadsTo(file)}), so ${words.who} cannot read it: ${words.reads}, and ` +
        `none through a link. ${words.link}, then say this again. ${NOTHING}`,
    );
  }
  if (!st.isFile()) {
    refuse(
      `${shown} is ${kindOf(st)}, not a plain file, so ${words.who} cannot read it: ${words.reads}. ${words.kind}, ` +
        `then say this again. ${NOTHING}`,
    );
  }
  let bytes;
  try {
    bytes = bytesOf(file);
  } catch (err) {
    return cannot(whyNotRead(err));
  }
  if (unreadAtStart) return cannot(`it could not be read when ${words.who} read the desk`);
  return bytes;
}

// A record's copy of `rel` on `side` (before or after), read by the guarded reader, through
// folders of the desk's own, and named by its path under celorus/. With `need`, a copy not there
// is refused as the record needing it.
function recordCopy(note, side, rel, words, need = false) {
  const shown = `merges/${note.name}/${side}/${rel}`;
  ownFolders(path.dirname(path.dirname(note.folder)), shown, words);
  const missing =
    `${shown} is not there, and the record needs it, so ${words.who} cannot read it: ${words.reads}. ` +
    `${words.unread}, then say this again. ${NOTHING}`;
  return readGuarded(note.folder, `${side}/${rel}`, words, { shown, need, missing });
}

// Whether two reads are the same bytes: never when either found nothing.
function same(x, y) {
  return x !== null && y !== null && x.equals(y);
}

// Bytes as text, as the views read a page's bytes (views.js textOfBytes), or null when they are
// not UTF-8. Required here, not at the top: the views read the check and the citations, which
// this file's neighbours also load.
function asText(bytes) {
  return require("../views/views.js").textOfBytes(bytes);
}

// A page read from its bytes as the desk reader reads one (views.js pageOfBytes). Required here
// as asText.
function pageFromBytes(rel, bytes) {
  return require("../views/views.js").pageOfBytes(rel, bytes).page;
}

function at(root, rel) {
  return path.join(root, ...rel.split("/"));
}

// The record folders under merges/ that hold a merge.md, in name order: anything at that path,
// so a merge.md that is a link, a folder or unreadable is read, and refused by its name.
function recordNotes(root) {
  let names;
  try {
    names = fs.readdirSync(path.join(root, "merges"));
  } catch {
    return [];
  }
  return names
    .sort(V.compareText)
    .filter((name) => exists(path.join(root, "merges", name, "merge.md")))
    .map((name) => ({ name, rel: `merges/${name}/merge.md`, folder: path.join(root, "merges", name) }));
}

// Whether `rel`, a path a record names, is a path under celorus/ (`root`): not absolute, never
// climbing (`..`), and not leading out of celorus/ through a folder that is a link.
function withinDesk(root, rel) {
  if (!rel || path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel) || rel.split(/[\\/]/u).includes("..")) return false;
  const file = at(root, rel);
  return inside(file, root) && inside(path.join(realOr(path.dirname(file)), path.basename(file)), realOr(root));
}

// A record's header and its merge.md's bytes, read by the guarded reader for `tool` (merge or
// undo), through folders of the desk's own, or a refusal naming the record that cannot be read.
// Every path it names (changed, removed) is asked here, before any is read, and one outside
// celorus/ is refused by the record's name, never echoed.
function recordRead(root, note, tool = "merge") {
  const words = WORDS[tool][1];
  const shown = `merges/${note.name}/merge.md`;
  ownFolders(root, shown, words);
  const bytes = readGuarded(root, note.rel, words, { shown, need: true });
  const page = pageFromBytes(note.rel, bytes);
  if (page.problem && page.problem !== NO_HEADER) {
    refuse(
      `${shown} cannot be read, so the desk cannot tell what it recorded; put its header back as it was, then say ` +
        "this again",
    );
  }
  const head = V.isMapping(page.head) ? page.head : {};
  const changed = V.own(head, "changed");
  const named = [...(Array.isArray(changed) ? changed : []), V.own(head, "removed")];
  if (named.some((rel) => typeof rel === "string" && !withinDesk(root, rel))) {
    refuse(
      `${shown} names a page outside celorus/ (an absolute path, one that climbs out of it, or one whose folder ` +
        `leads out of it), so ${words.who} ` +
        `cannot read the record: ${words.reads}, and none outside celorus/. ${words.unread}, then say this again. ${NOTHING}`,
    );
  }
  return { head, bytes };
}

// A record's header, or a refusal naming the record that cannot be read.
function recordHead(root, note, tool = "merge") {
  return recordRead(root, note, tool).head;
}

function stemOf(rel) {
  return new Page(rel, null, "", null).stem;
}

// The kept page's path, as the record names it: the entry in `changed` whose file name is the
// kept page's.
function keptRel(head) {
  const changed = V.own(head, "changed");
  const kept = V.own(head, "kept");
  if (!Array.isArray(changed) || typeof kept !== "string") return null;
  return changed.find((rel) => typeof rel === "string" && stemOf(rel) === kept) ?? null;
}

// Whether this record's merge has been put back: the undo says so itself, in `undone:`. A record
// written before that line existed falls back to reading the bytes, which is a guess. An undo
// makes the removed page again, so a record whose removed page is not on the desk is not undone:
// it may be a merge cut after the page was taken off and before its pages were rewritten. Every
// file it reads, the record's copies and the live kept page, is read by the guarded reader, in
// `tool`'s words (merge or undo).
function undone(root, note, head, tool = "merge") {
  if (Object.hasOwn(head, "undone")) return true;
  const rel = keptRel(head);
  if (rel === null) return false;
  const [page, record] = WORDS[tool];
  const before = recordCopy(note, "before", rel, record);
  if (before === null) return false;
  const live = readGuarded(root, rel, page);
  if (live === null) return false;
  if (same(recordCopy(note, "after", rel, record), before)) return false;
  const removed = V.own(head, "removed");
  if (typeof removed === "string" && !exists(at(root, removed))) return false;
  return live.equals(before);
}

// The pages a record under merges/ names as merged, leaving out merges since undone.
function recordedMerged(root) {
  const names = new Set();
  for (const note of recordNotes(root)) {
    const head = recordHead(root, note);
    if (!undone(root, note, head)) names.add(V.show(V.own(head, "merged") ?? null));
  }
  return names;
}

// The record of a merge of these two pages that was cut before its last step, or null.
function cutRecord(root, keep, merge, keepRel) {
  for (const note of recordNotes(root)) {
    const head = recordHead(root, note);
    if (V.own(head, "kept") !== keep || V.own(head, "merged") !== merge || Object.hasOwn(head, "undone")) continue;
    if (same(readGuarded(root, keepRel, MERGE_PAGE), recordCopy(note, "after", keepRel, MERGE_RECORD))) return note.name;
  }
  return null;
}

// The record of a merge of these two pages cut after the merged page was taken off and before
// the kept page was rewritten (it still reads as its before/ copy, which differs from its
// after/ copy), or null.
function cutBeforePages(root, keep, merge) {
  for (const note of recordNotes(root)) {
    const head = recordHead(root, note);
    if (V.own(head, "kept") !== keep || V.own(head, "merged") !== merge || undone(root, note, head)) continue;
    const rel = keptRel(head);
    if (rel === null) continue;
    const before = recordCopy(note, "before", rel, MERGE_RECORD);
    if (before === null) continue;
    if (!same(before, recordCopy(note, "after", rel, MERGE_RECORD)) && same(readGuarded(root, rel, MERGE_PAGE), before)) {
      return note.name;
    }
  }
  return null;
}

function cutSaid(merge, keep, record) {
  return (
    `a merge of ${merge} into ${keep} was cut before it finished, and its record is merges/${record}; ` +
    "undo that merge first, then say this one again"
  );
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

// The name as a whole word: no letter, digit, `-` or `_` against it.
function edges(name) {
  return new RegExp(`(?<![0-9A-Za-z_-])${escapeRegExp(name)}(?![0-9A-Za-z_-])`, "u");
}

// `text` with the link `span` (as linkSpans gives it, its offsets into `text`) naming `keep`:
// only the name changes, the blanks around it and its tail, the `|label` or `#part`, are kept as
// written.
function withName(text, span, keep) {
  const name = linkName(span);
  // The blanks cut off are all before and after the name, and a name starts with no blank.
  const at = span.name.indexOf(name);
  const inside = span.name.slice(0, at) + keep + span.name.slice(at + name.length) + span.tail;
  return `${text.slice(0, span.start)}[[${inside}]]${text.slice(span.end)}`;
}

// A header's text read as the desk reader reads it: the mapping, or null when it does not parse
// or is not a mapping (no link in it is read then).
function headOf(header) {
  try {
    const head = parseHeader(header);
    return V.isMapping(head) ? head : null;
  } catch {
    return null;
  }
}

// How many links linksIn reads in header value `a` that name `merge` and, at the same place in
// `b`, name `keep`, all else alike: 0 for values alike, Infinity for any other difference (a
// mapping differing at all, a text differing other than by one such link).
function linksApart(a, b, merge, keep) {
  if (sameValue(a, b)) return 0;
  if (typeof a === "string" && typeof b === "string") {
    return linkSpans(a).some((span) => linkName(span) === merge && withName(a, span, keep) === b) ? 1 : Infinity;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.reduce((n, item, i) => n + linksApart(item, b[i], merge, keep), 0);
  }
  return Infinity;
}

// Whether header `after` is header `before` but for exactly one link linksIn reads in its values,
// which named `merge` and names `keep`.
function oneLinkApart(before, after, merge, keep) {
  const keys = Object.keys(before);
  const others = Object.keys(after);
  if (keys.length !== others.length || keys.some((key, i) => key !== others[i])) return false;
  return keys.reduce((n, key) => n + linksApart(before[key], after[key], merge, keep), 0) === 1;
}

// A header's text with each link to `merge` that linksIn reads in its values named `keep`. The
// reader reads a header's values decoded, so a span in the text is taken only when the header,
// read again with that span repointed, is the header as it was but for exactly one link linksIn
// reads, now naming `keep`. A link the text spells another way (an escape in a quoted value) has
// no span naming `merge`; a span in a comment or a mapping changes no link linksIn reads; each is
// left as written, and still_named lists a link to `merge` linksIn still reads.
function repointedHeader(header, merge, keep) {
  let head = headOf(header);
  if (head === null) return header;
  let text = header;
  // From the last span back, so each earlier span's offsets still hold.
  for (const span of linkSpans(header).filter((s) => linkName(s) === merge).reverse()) {
    const next = withName(text, span, keep);
    const after = headOf(next);
    if (after !== null && oneLinkApart(head, after, merge, keep)) {
      text = next;
      head = after;
    }
  }
  return text;
}

// The links the check reads in a page body, the body outside fenced blocks (check/text.js
// readOutsideFences, linkSpans over it), each given as a span of `body` itself: its offsets into
// `body`, its name and tail as written there. The body outside fences keeps every line, a fenced
// line blanked, so a link on lines none of which was blanked is in `body` as it is there; a link
// the reading reaches across a blanked line has no span in `body` and is left out.
function bodySpans(body) {
  const lines = V.splitLines(body);
  if (!lines.length) return [];
  const outside = readOutsideFences(body)[0];
  const kept = outside.split("\n");
  const outStart = [];
  const bodyStart = [];
  let o = 0;
  let b = 0;
  lines.forEach((line, i) => {
    outStart.push(o);
    o += kept[i].length + 1;
    bodyStart.push(b);
    b += line.length;
    b += body[b] === "\r" && body[b + 1] === "\n" ? 2 : 1;
  });
  const lineOf = (offset) => {
    let i = 0;
    while (i + 1 < outStart.length && outStart[i + 1] <= offset) i += 1;
    return i;
  };
  const out = [];
  for (const span of linkSpans(outside)) {
    const first = lineOf(span.start);
    const last = lineOf(span.end - 1);
    let whole = true;
    for (let i = first; i <= last; i += 1) if (kept[i] !== lines[i]) whole = false;
    if (!whole) continue;
    const start = bodyStart[first] + (span.start - outStart[first]);
    const end = bodyStart[last] + (span.end - outStart[last]);
    if (end - start !== span.end - span.start) continue;
    const raw = body.slice(start, end);
    out.push({ start, end, name: raw.slice(2, 2 + span.name.length), tail: raw.slice(2 + span.name.length, raw.length - 2) });
  }
  return out;
}

// The page's text with every link to `merge` the reader gives a span for pointed at `keep`
// (bodySpans, repointedHeader): never inside a fenced block, never in a header comment, a mapping
// or anywhere else linksIn does not read, and never a link it reads but cannot find in the text.
// A text with no header is read as a body, as a single line or log.md is.
function repointed(text, merge, keep) {
  const split = splitPage(text);
  let body = split === null ? text : split.body;
  for (const span of bodySpans(body).filter((s) => linkName(s) === merge).reverse()) body = withName(body, span, keep);
  if (split === null) return body;
  return `---\n${repointedHeader(split.header, merge, keep)}\n---\n${body}`;
}

// Every link the repoint's reading reads on a page's text, as { name, line }: each value of a
// header that reads as a mapping (linksIn, over the value decoded), on its key's line, and the
// body outside fenced blocks (linkSpans over readOutsideFences), each on its line. Lines are
// counted as V.splitLines counts the page's lines.
function linksRead(text) {
  const split = splitPage(text);
  const body = split === null ? text : split.body;
  const found = [];
  const head = split === null ? null : headOf(split.header);
  if (head !== null) {
    const lines = V.splitLines(split.header);
    for (const [key, value] of Object.entries(head)) {
      const at = lines.findIndex((line) => {
        const m = KEY.exec(line);
        return m !== null && m.groups.key === key;
      });
      for (const name of linksIn(value)) found.push({ name, line: at + 2 });
    }
  }
  const first = V.splitLines(text.slice(0, text.length - body.length)).length;
  const outside = readOutsideFences(body)[0];
  for (const span of linkSpans(outside)) {
    found.push({ name: linkName(span), line: first + outside.slice(0, span.start).split("\n").length });
  }
  return found;
}

// What still names the merged page on the desk as the merge leaves it, as `<path>:<line>`,
// outside the desk's own furniture, read after the repoint off `texts` (the pages the merge
// writes, the page it removes as "") and the desk (every other page): each link the repoint's
// own reading (linksRead) still reads as naming `merged`, and each line, fenced blocks left out,
// that still holds its bare file name (a queue row or a log row keyed by it).
function stillNamed(root, rels, merged, texts = {}) {
  const found = [];
  const edge = edges(merged);
  for (const rel of rels) {
    if (SKIP_TOP.has(rel.split("/")[0])) continue;
    const text = Object.hasOwn(texts, rel) ? texts[rel] : asText(readGuarded(root, rel, MERGE_PAGE, { need: true }));
    if (text === null) continue;
    const lines = new Set(linksRead(text).filter((link) => link.name === merged).map((link) => link.line));
    const split = splitPage(text);
    const body = split === null ? text : split.body;
    const read = text.slice(0, text.length - body.length) + readOutsideFences(body)[0];
    V.splitLines(read).forEach((line, i) => {
      if (edge.test(line)) lines.add(i + 1);
    });
    for (const n of [...lines].sort((x, y) => x - y)) found.push(`${rel}:${n}`);
  }
  return found;
}

// The lines of the kept page the repointing turns into a link to itself, as `<n>: <line>`: the
// page repointed whole (a repoint changes a name inside a line, never a line's count).
function pointsAtItself(before, merge, keep) {
  const was = V.splitLines(before);
  const out = [];
  V.splitLines(repointed(before, merge, keep)).forEach((line, i) => {
    if (line !== was[i]) out.push(`${i + 1}: ${V.strip(line)}`);
  });
  return out;
}

// Whether the desk's model turns on the switch that lets a named-only person hold contact
// details. A model that cannot be read is read as the switch off, its default: the merge goes
// on, as a firm pair's does on that desk (the tool then says the views were not rebuilt), and a
// named-only page holding details is flagged, never let through unsaid.
function namedOnlyMayHoldDetails(root) {
  try {
    return loadDeskModel(root).switchOn;
  } catch (err) {
    if (!(err instanceof ModelUnreadable)) throw err;
    return false;
  }
}

// Whether the kept page, as the merge will leave it, is a named-only person holding contact
// details: C08's own reading, run on the finished page.
function detailsOnNamedOnly(root, rel, headText, body) {
  let head;
  try {
    head = V.asPython(parseHeader(headText)) || {};
  } catch {
    head = {};
  }
  const page = new Page(rel, V.isMapping(head) ? head : {}, body, null);
  if (V.own(page.head, "type") !== "person") return false;
  if (V.own(page.head, "standing") !== "named-only") return false;
  if (namedOnlyMayHoldDetails(root)) return false;
  return holdsContactDetails(page);
}

// The record folder for one merge: never one that exists.
function newRecord(root, name) {
  let folder = name;
  let n = 2;
  while (exists(path.join(root, "merges", folder))) {
    folder = `${name}-${n}`;
    n += 1;
  }
  return folder;
}

// The desk's celorus/ folder with every link in its path resolved, read once at a tool's door
// so every path the merge or the undo compares, and every folder a write checks, is a resolved
// one.
function realCelorus(read) {
  const celorus = path.join(fs.realpathSync(read.root), "celorus");
  try {
    return fs.realpathSync(celorus);
  } catch {
    return celorus;
  }
}

// Runs the writes of a merge or an undo on the desk whose celorus/ folder is `root`. `wrote`
// lists each path under celorus/ written so far. Any stop at a write (a folder swapped for a
// link, a page that cannot be written, or any other error) ends them there, refusing with that
// list, desk-relative paths and error codes only; a page a failed write may have left incomplete
// is listed too, and its previous text ends the answer. `atStop`, when given, is run on that
// refusal when anything had changed, with the path of the page left maybe incomplete (null when
// none) and the list of what changed: the tool writes the change's line in log.md there, and says
// so (views/tools.js).
function writing(root, wrote, fn, atStop = null) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof Refusal) throw err;
    const rel = err instanceof NotOwnFolder ? path.relative(root, err.file).split(path.sep).join("/") : null;
    const said = rel === null ? `A write stopped (${codeOf(err)})` : err.told(rel);
    // A page left maybe incomplete, or written and then not closed (NotClosed), is changed too.
    const all = [...wrote, ...(previousTail(err, rel) || err instanceof NotClosed ? [rel] : [])];
    const refusal = new MergeRefused(
      `${said}, so nothing more was written. ` + (all.length ? `Already changed: ${all.join(", ")}.` : NOTHING),
    );
    endWithTail(refusal, previousTail(err, rel));
    if (previousTail(err, rel)) refusal.previous_text = err.previous;
    if (atStop !== null && all.length) atStop(refusal, previousTail(err, rel) ? rel : null, all);
    throw refusal;
  }
}

// Before the first write of a merge or an undo: each page it writes can be, or the call is
// refused naming it, with nothing changed. `pairs` is the call's up-front set, each { rel }: a
// page it writes, by path under celorus/, asked by the one path when it is there (history.js
// askPage: a plain file, in the desk's own folders, opened read-write), and by its folder when
// the call makes it, each folder it is made in that is not there made here and probed from
// inside, after every page there was asked; { rel, removed: true } is a page it removes, asked by
// the same path but for the open. Returns the folders made, absolute, outermost first: the call's
// own change from here on. A folder is named as folderShown names it. First, before anything is
// asked or made, a page of the set under a folder inside celorus/ that is a link refuses the call
// in the linked root's words (lib/linkedroot.js refuseLinkedFolders).
function canRewrite(root, pairs) {
  refuseLinkedFolders(root, pairs.map(({ rel }) => rel));
  try {
    return ahead(pairs.map(({ rel, removed = false }) => ({ file: at(root, rel), removed })));
  } catch (err) {
    if (!(err instanceof NotOwnFolder)) throw err;
    // A probe spare or a folder the check made and could not remove is named in the refusal, and
    // is the one thing changed.
    const ending = err.leftBehind().length ? "Nothing else was changed." : NOTHING;
    return refuse(`${err.told(path.relative(root, err.file).split(path.sep).join("/"))}. ${ending}`);
  }
}

// Removes what a merge made of its record when the merge cannot go on: `made` lists, in the
// order they were made, the record's folders ({ dir }) and files ({ file }), which are taken
// away in reverse. Returns what could not be removed, as paths under celorus/ (a folder with its
// trailing slash), in the order met; empty when the record is gone whole.
function unmake(root, made) {
  const left = [];
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");
  for (const item of [...made].reverse()) {
    try {
      if (item.file) {
        holdFolder(item.file);
        fs.unlinkSync(item.file);
      } else fs.rmdirSync(item.dir);
    } catch {
      left.push(item.file ? rel(item.file) : folderShown(rel(item.dir)));
    }
  }
  return left;
}

// The refusal of a merge that put its record back: `why`, then "Nothing was changed.", or, when
// part of the record could not be removed, exactly what is left.
function putBackSaid(why, left) {
  if (!left.length) return `${why}. ${NOTHING}`;
  return (
    `${why}. The record this merge had written could not all be removed, so the desk is as it ` +
    `was but for ${left.join(", ")}, left in place.`
  );
}

// Merges page `merge` into page `keep` on the desk at `desk`, `now` being the moment (checked
// by the caller). Returns { wrote, changed, removed, record, stillNamed, pointsAtItself,
// namedOnlyHoldsDetails }, paths under celorus/ (`wrote` every one it wrote or removed), or { alreadyMerged: true } when a standing
// record says the page was merged already. Refuses, changing nothing, a merge that would be
// wrong or could not be undone.
//
// With `sent` true (the merge_pages tool, which rebuilds the views after), the generated sent
// lists the merge changes are rebuilt inside it, before the record is sealed: the record then
// holds every page the merge changes, so its undo puts each one back.
//
// `after`, when given, is how the caller derives the pages it rewrites after the merge, read off
// the desk as the merge will leave it: after(read, texts, removed) gives paths under celorus/,
// `texts` the pages the merge writes and `removed` the page it deletes. They are checked with the
// merge's own pages before its first write, so the whole call is refused with nothing written.
//
// `atStop`, when given, is how the caller logs a stop after the merge's first write: run on the
// refusal of a stop at a page write (writing), the page left maybe incomplete or null, and what
// had changed. A
// merge whose record could not all be taken away again was not made, and its refusal then says
// log.md was not written.
function mergePages(desk, keep, merge, now, { sent = false, after = null, atStop = null } = {}) {
  aMoment(now);
  const read = readDesk(desk);
  refuseLinkedRoot(read.root);
  const root = realCelorus(read);
  const raw = new Map(read.pages.map((p) => [p.rel, p]));
  const every = checkPages(read.pages);
  const pages = new Map();
  for (const p of every) if (V.truthy(p.head)) pages.set(p.stem, p);

  for (const name of [merge, keep]) {
    const twins = every.filter((p) => p.stem === name).map((p) => p.rel).sort(V.compareText);
    if (twins.length > 1) {
      refuse(
        `${name} is the file name of ${twins.length} pages (${twins.join(", ")}), so a link to it does ` +
          "not say which one is meant; give one of them a different file name first, then say this again",
      );
    }
  }

  const unreadable = (name) => {
    for (const p of every) {
      if (p.stem !== name || V.truthy(p.head)) continue;
      const problem = raw.get(p.rel).problem;
      const said = problem === null || problem === STAMP_NOT_ONE_VALUE ? SAYS_NOTHING : problem;
      const [rule, mend] = MENDS[said] || MENDS[NO_HEADER];
      return [p.rel, said, rule, mend];
    }
    return null;
  };

  for (const name of [merge, keep]) {
    if (pages.has(name)) continue;
    if (name === merge && recordedMerged(root).has(merge)) {
      const cutEarly = cutBeforePages(root, keep, merge);
      if (cutEarly !== null) refuse(cutSaid(merge, keep, cutEarly));
      return { alreadyMerged: true };
    }
    const broken = unreadable(name);
    if (broken !== null) {
      const [where, said, rule, mend] = broken;
      // A page the reader could not open is named as what is at its path (a link as a link).
      if (raw.get(where).problem === PAGE_UNREAD) readGuarded(root, where, MERGE_PAGE, { need: true, unreadAtStart: true });
      refuse(
        `${name} is on this desk at ${where}, but ${said}, so this merge cannot use it; check-desk ` +
          `lists it (${rule}) and says the same. ${mend}, then say this again`,
      );
    }
    refuse(`${name} is not a page on this desk`);
  }
  if (keep === merge) refuse(`${keep} cannot be merged into itself`);
  const a = pages.get(keep);
  const b = pages.get(merge);
  if (a.type !== b.type) refuse(`${keep} is a ${V.show(a.type)} and ${merge} is a ${V.show(b.type)}`);
  if (notSameAs(a.head).includes(merge) || notSameAs(b.head).includes(keep)) {
    refuse(`${keep} and ${merge} are remembered as not the same`);
  }
  const cut = cutRecord(root, keep, merge, a.rel);
  if (cut !== null) refuse(cutSaid(merge, keep, cut));

  // Every page the merge reads (the two pages, the repoint, still_named, log.md's line end and
  // the record's before/ copies, below) is read here once, by the guarded reader, before anything
  // is written; a page the desk reader could not open is refused so too. A folder it could not
  // list (its path ends in a slash) is refused with that folder's own why and remedy, its
  // permissions, never as a folder standing where a page should be.
  const bytesOn = new Map(
    every.map((page) => {
      const listed = raw.get(page.rel);
      if (page.rel.endsWith("/") && listed.problem === PAGE_UNREAD) {
        refuse(
          `${page.rel} cannot be read (${listed.why}), so ${MERGE_PAGE.who} cannot read it: ${MERGE_PAGE.reads}. ` +
            `${listed.remedy.replace(/\.$/, "")}, then say this again. ${NOTHING}`,
        );
      }
      return [page.rel, readGuarded(root, page.rel, MERGE_PAGE, { need: true, unreadAtStart: listed.problem === PAGE_UNREAD })];
    }),
  );
  const textOn = new Map([...bytesOn].map(([rel, bytes]) => [rel, asText(bytes)]));
  const aText = textOn.get(a.rel);
  const bText = textOn.get(b.rel);
  const [headText, differs] = joinedHead(a, aText, b, bText);
  const keptText = headText + joinedBody(a.body, b.body, V.show(V.own(b.head, "title") ?? null), differs);

  const toChange = new Map([[a.rel, repointed(keptText, merge, keep)]]);
  for (const page of every) {
    if (page.rel === a.rel || page.rel === b.rel) continue;
    const text = textOn.get(page.rel);
    if (text === null) continue;
    const next = repointed(text, merge, keep);
    if (next !== text) toChange.set(page.rel, next);
  }
  if (sent) {
    // Required here, not at the top: the views read the check and the citations, which this
    // file's neighbours also load.
    const { sentBlocksAfter } = require("../views/views.js");
    // Only the sent lists this merge changes join the record: a page whose sent list is stale
    // for another reason, with or without the merge, is left to the views rebuilt after it, so
    // it never becomes a page whose later edit blocks the undo.
    const rebuilt = sentBlocksAfter(read, Object.fromEntries(toChange), b.rel);
    const without = sentBlocksAfter(read, {}, null);
    for (const rel of Object.keys(rebuilt).sort(V.compareText)) {
      if (toChange.has(rel) || rebuilt[rel] !== without[rel]) toChange.set(rel, rebuilt[rel]);
    }
  }

  // What the merge cannot put right, read off the desk as it will be, before anything is written.
  const final = FRONT.exec(toChange.get(a.rel));
  const texts = Object.fromEntries([...textOn, ...toChange]);
  texts[b.rel] = "";
  const allRels = read.pages.map((p) => p.rel);
  const extra = {
    still_named: stillNamed(root, allRels, merge, texts),
    points_at_itself: pointsAtItself(keptText, merge, keep),
    named_only_holds_details: detailsOnNamedOnly(
      root,
      a.rel,
      final[1],
      toChange.get(a.rel).slice(final.index + final[0].length),
    ),
  };

  // The order is the one at the top of this file: the whole record, then the merged page taken
  // off, then the pages.
  // Every write checks the file it opened; a copy holds the page's bytes as they were read up
  // front, through the page itself, never through a link. A page of the desk is written in place (writePage); the record's files are made
  // fresh, and each copy of a page takes that page's permission bits, so the record keeps them
  // and the undo makes a removed page again as it was. Up front, each page rewritten in place is
  // opened read-write, and each file the record makes is asked by its folder, so one that cannot
  // be written is refused before anything is. Whether the merged page can be removed is not
  // asked: that step is taken first, and the record put back when it fails.
  const rewrites = [...toChange.keys(), ...(after ? after(read, Object.fromEntries(toChange), b.rel) : [])];
  const folderName = newRecord(root, `${now.slice(0, 10)}-${keep}-${merge}`);
  const folder = path.join(root, "merges", folderName);
  const befores = [...toChange.keys(), b.rel].map((rel) => [`merges/${folderName}/before/${rel}`, rel]);
  const afters = [...toChange.keys()].map((rel) => [`merges/${folderName}/after/${rel}`, rel]);
  const noteRel = `merges/${folderName}/merge.md`;
  // Each before/ copy holds the page's bytes as the merge read them up front.
  const beforeBytes = new Map(
    befores.map(([, rel]) => [rel, bytesOn.has(rel) ? bytesOn.get(rel) : readGuarded(root, rel, MERGE_PAGE, { need: true })]),
  );
  // Every folder a file of the call is made in is made here, the record's and views/ when it is
  // not there, and probed from inside (history.js ahead), after every page already on the desk
  // was asked by the one path. The merged page is asked by that path but for the open: it is
  // taken off the desk, never rewritten.
  const aheadMade = canRewrite(root, [
    { rel: b.rel, removed: true },
    ...[...befores.map(([rel]) => rel), ...afters.map(([rel]) => rel), noteRel, ...rewrites].map((rel) => ({ rel })),
  ]);
  const wrote = [];
  const put = (rel, data) => {
    writePage(at(root, rel), data);
    wrote.push(rel);
  };
  // The folders and files this call made, the check's folders first, then the record's own files
  // and any folder a write makes, in the order made, so a merge that cannot go on takes them away
  // again (unmake). A write that fails part way still hands back the folders it made.
  const made = aheadMade.map((dir) => ({ dir }));
  const make = (rel, data, mode) => {
    const file = at(root, rel);
    const dirs = [];
    // A file moved into place and then not closed (NotClosed) is made too, and taken away with
    // the rest.
    let placed = false;
    try {
      writeWhole(file, data, mode, dirs);
      placed = true;
    } catch (err) {
      placed = err instanceof NotClosed;
      throw err;
    } finally {
      for (const dir of dirs) made.push({ dir });
      if (placed) made.push({ file });
    }
  };
  // log.md keeps the line ends the person's file has, read off its bytes as the merge read them
  // up front, before the check made any folder.
  const logEnd = toChange.has(LOG) ? lineEndOf(bytesOn.get(LOG).toString("utf8")) : "\n";
  const changed = [...toChange.keys()].sort(V.compareText);
  const note = {
    type: "merge-record",
    title: `Merge of ${merge} into ${keep}`,
    description: "Both originals and every changed page, so the merge can be undone",
    timestamp: new Moment(now),
    kept: keep,
    merged: merge,
    removed: b.rel,
    changed,
    ...extra,
    generated_by: `celorus-plugin ${pluginVersion()} ${TOOL}`,
  };
  const noteText =
    `---\n${dumpLines(note, { sortKeys: false, flow: false, momentSep: "T" }).join("\n")}\n---\n\n` +
    `# Merge of ${merge} into ${keep}\n\n` +
    `Say "undo the merge of ${merge} into ${keep}" to put every page back.\n`;
  // The record, then the merged page taken off the desk. A stop at either removes what this call
  // made of the record, and the merge is refused with nothing changed.
  let takingOff = false;
  try {
    const modeOf = (rel) => fs.lstatSync(at(root, rel)).mode;
    for (const [copyRel, rel] of befores) make(copyRel, beforeBytes.get(rel), modeOf(rel));
    for (const [copyRel, rel] of afters) make(copyRel, toChange.get(rel), modeOf(rel));
    make(noteRel, noteText);
    takingOff = true;
    holdFolder(at(root, b.rel));
    fs.unlinkSync(at(root, b.rel));
  } catch (err) {
    if (err instanceof Refusal) throw err;
    const where = err instanceof NotOwnFolder ? path.relative(root, err.file).split(path.sep).join("/") : null;
    let why;
    if (where !== null) why = err.said(where);
    else if (takingOff) why = `${b.rel} could not be removed (${codeOf(err)})`;
    else why = `A write stopped (${codeOf(err)})`;
    const left = unmake(root, made);
    const refusal = new MergeRefused(putBackSaid(why, left));
    if (left.length && atStop !== null) sayBeforeTail(refusal, " The merge was not made, so log.md was not written.");
    throw refusal;
  }
  // A folder the check made outside merges/ (views/) is a change of its own; merges/ and the
  // record's folders are named by the record's files.
  const outside = aheadMade.filter((dir) => !inside(dir, path.join(root, "merges")));
  wrote.push(...outside.map((dir) => folderShown(path.relative(root, dir).split(path.sep).join("/"))));
  wrote.push(...befores.map(([rel]) => rel), ...afters.map(([rel]) => rel), noteRel, b.rel);
  writing(
    root,
    wrote,
    () => {
      for (const [rel, text] of toChange) put(rel, rel === LOG ? withLineEnd(text, logEnd) : text);
    },
    atStop,
  );
  return {
    wrote,
    changed,
    removed: b.rel,
    record: `merges/${folderName}/merge.md`,
    stillNamed: extra.still_named,
    pointsAtItself: extra.points_at_itself,
    namedOnlyHoldsDetails: extra.named_only_holds_details,
  };
}

// A mode as the answers write it, as 0444.
function octal(mode) {
  return `0${(mode & 0o777).toString(8).padStart(3, "0")}`;
}

// The sentences naming each page made again whose recorded mode ({ rel, mode }) could not be
// put back, each with a space before it: the same on success and at a stop.
function modesSaid(modesNotSet) {
  return modesNotSet.map(({ rel, mode }) => ` ${rel} was restored but its mode could not be set back to ${octal(mode)}.`).join("");
}

// Writes `undone: <now>` into a record the undo has just put back, once. `was` is its merge.md's
// bytes as the undo read them up front; without them it is read here, by the guarded reader.
function markUndone(file, now, was = null) {
  const shown = `merges/${path.basename(path.dirname(file))}/merge.md`;
  const bytes = was !== null ? was : readGuarded(path.dirname(file), path.basename(file), UNDO_RECORD, { shown, need: true });
  const text = asText(bytes);
  if (text === null) return;
  const front = HEADER.exec(text);
  if (front === null) return;
  const head = pageFromBytes(path.basename(file), bytes).head;
  if (V.isMapping(head) && Object.hasOwn(head, "undone")) return;
  const end = 4 + front[1].length;
  writePage(file, `${text.slice(0, end)}\nundone: ${now}${text.slice(end)}`);
}

// The record folder an undo means: the one named, or the newest standing record of the pair
// named, or the newest standing record of all. Only the records it chooses among are read past
// their merge.md: those of the pair named, newest first, until one stands, so no other record's
// page can refuse the undo. An undo that names no merge must read each record's merge.md, and
// each record newer than the one it undoes, to choose; a refusal there names that record and
// the way to undo one directly.
function recordFor(root, { record, kept, merged }) {
  if (record !== undefined && record !== null) return record;
  const named = (kept !== undefined && kept !== null) || (merged !== undefined && merged !== null);
  const choosing = (note, fn) => {
    try {
      return fn();
    } catch (err) {
      if (named || !(err instanceof MergeRefused)) throw err;
      const said = err.message.endsWith(NOTHING) ? err.message.slice(0, -NOTHING.length).trimEnd() : `${err.message}.`;
      return refuse(
        `${said} This undo names no merge, so it reads the records under merges/, newest first, to find the one ` +
          `that stands, and merges/${note.name}/ is one it had to read; name a record with \`record\` to undo it ` +
          `directly. ${NOTHING}`,
      );
    }
  };
  const records = [];
  for (const note of recordNotes(root)) {
    const head = choosing(note, () => recordHead(root, note, "undo"));
    if (kept !== undefined && kept !== null && V.own(head, "kept") !== kept) continue;
    if (merged !== undefined && merged !== null && V.own(head, "merged") !== merged) continue;
    const when = Date.parse(V.show(V.own(head, "timestamp") ?? ""));
    records.push([Number.isNaN(when) ? -Infinity : when, note, head]);
  }
  records.sort((x, y) => x[0] - y[0] || V.compareText(x[1].name, y[1].name));
  for (const [, note, head] of records.reverse()) {
    if (!choosing(note, () => undone(root, note, head, "undo"))) return note.name;
  }
  const which = kept || merged ? `of ${merged || "a page"} into ${kept || "a page"} ` : "";
  return refuse(`there is no standing merge ${which}under celorus/merges/ to undo`);
}

// The desk's log, the one page a merge record may cover that is history, not a page of the desk.
const LOG = "log.md";

// The day heading above each line of a log: null above the first.
function daysOf(lines) {
  let day = null;
  return lines.map((line) => {
    const heading = /^## (\S+)$/u.exec(line);
    if (heading) day = heading[1];
    return day;
  });
}

// The lines of `day` that read exactly `text`, as their places top down. A heading never counts.
function likeLines(lines, days, day, text) {
  const like = [];
  lines.forEach((line, i) => {
    if (days[i] === day && line === text && !/^## /u.test(line)) like.push(i);
  });
  return like;
}

// The lines of log.md a merge rewrote, from the record's two copies of the log (line ends made
// "\n"): a merge repoints links inside a line and never adds or drops one, so the copies line up
// line for line. Each is { before, after, day, n, k, logged }: its text as the merge found and
// left it; its day; n, how many lines of that day read exactly `after` in the log the merge
// left, and k, this line's place among them, top down; and `logged`, when it was logged, as
// `<date> <time>` from its day's heading and its own time (or `line <n>`), so an answer can name
// it without its words. Null when the copies do not line up.
function rewrittenLines(before, after) {
  const was = before.split("\n");
  const left = after.split("\n");
  if (was.length !== left.length) return null;
  const days = daysOf(left);
  const out = [];
  was.forEach((line, i) => {
    if (line === left[i]) return;
    const like = likeLines(left, days, days[i], left[i]);
    const time = /^\* ([0-9]{2}:[0-9]{2}) /u.exec(line);
    out.push({
      before: line,
      after: left[i],
      day: days[i],
      n: like.length,
      k: like.indexOf(i),
      logged: days[i] && time ? `${days[i]} ${time[1]}` : `line ${i + 1}`,
    });
  });
  return out;
}

// log.md as the undo leaves it, put back only where a line's place cannot be in doubt: when the
// lines of its day that read its `after` text number exactly n, as the merge left them, the
// k-th is put back as it was. Otherwise nothing is guessed, and the line is named in `notBack`
// (a hand edit, a line logged since that reads the same, or another merge's line). Every other
// line is left alone. Every line is found before any is put back.
function logBack(current, pairs) {
  const cur = current === null ? [] : current.split("\n");
  const days = daysOf(cur);
  const found = pairs.map((pair) => {
    const like = likeLines(cur, days, pair.day, pair.after);
    return pair.k >= 0 && like.length === pair.n ? like[pair.k] : -1;
  });
  const notBack = [];
  pairs.forEach((pair, n) => {
    if (found[n] === -1) notBack.push(pair.logged);
    else cur[found[n]] = pair.before;
  });
  return { text: cur.join("\n"), back: pairs.length - notBack.length, notBack };
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Puts back the merge its record names. `now` is the moment (checked by the caller). Returns
// { wrote, restored, record, kept, merged, log }, `wrote` every path under celorus/ it wrote,
// `log` being null when the merge rewrote no line of
// log.md, or { back, notBack }: how many rewritten lines were put back, and when each one not put
// back (its place was in doubt) was logged. Refuses, changing nothing, when a page moved on
// since; a folder swapped for a link at a write stops it there, naming what it had written.
// `after`, when given, is as mergePages takes it, over the desk as the undo will leave it.
// `rest`, when given, is the call's other writes, run after the undo's own and before the modes
// are put back: rest(wrote, { kept, merged }), its answer returned as `rest`. `modesNotSet`
// lists each page made again whose recorded mode ({ rel, mode }) could not be put back; the
// modes are put back at a stop too, and the stop's refusal names each that could not be.
// `atStop`, when given, is as mergePages takes it, run as atStop(refusal, rel, changed, { kept, merged }).
function undoMerge(desk, which, now, { after = null, rest = null, atStop = null } = {}) {
  now = aMoment(now === undefined || now === null || now === "" ? clockNow() : now);
  const read = readDesk(desk);
  refuseLinkedRoot(read.root);
  const root = realCelorus(read);
  const record = recordFor(root, which);
  if (typeof record !== "string") refuse("record is the name of a record folder under celorus/merges/, as text");
  const merges = path.resolve(root, "merges");
  const folder = path.join(root, "merges", record);
  if (path.dirname(path.resolve(folder)) !== merges || !record || record === "." || record === "..") {
    refuse(`${record} is not a record folder under celorus/merges/`);
  }
  // Anything at merge.md's path is read, so a merge.md that is a link, a folder or unreadable is
  // refused by its name; nothing there is a record that does not say what to put back.
  if (!exists(path.join(folder, "merge.md"))) refuse(`${record} holds no merge.md, so it does not say what to put back`);
  const { head: note, bytes: noteBytes } = recordRead(root, { name: record, rel: `merges/${record}/merge.md`, folder }, "undo");
  const changed = V.own(note, "changed");
  const removed = V.own(note, "removed");
  if (!Array.isArray(changed)) refuse(`${record}'s merge.md does not say which pages changed`);
  if (typeof removed !== "string") refuse(`${record}'s merge.md does not say which page was removed`);
  const named = [...changed.map(V.show), removed].sort(V.compareText);
  const realRoot = fs.realpathSync(root);
  for (const rel of named) {
    // Where the record's path is: its folder resolved, never the page itself, so a page that is a
    // link reaches the up-front check's one path (history.js askPage), which names it as a link.
    const where = path.join(realOr(path.dirname(at(root, rel))), path.basename(rel));
    if (!inside(where, realRoot) || inside(where, realOr(merges))) refuse(`${rel} is outside the desk's pages in celorus/`);
  }
  // Every file the plan reads, read here once by the guarded reader, before anything is asked or
  // written: each page the record names as the desk has it now (null when it is not there), and
  // its before/ and after/ copies in the record, through folders of the desk's own. A copy the
  // record needs (every before/, and log.md's after/) that is not there is refused so; one that
  // is a link, a folder or cannot be read is refused by its own path in the record, in the
  // reader's words, as the undo by the pair (recordFor) refuses it.
  const live = new Map();
  const copies = new Map();
  const rec = { name: record, folder };
  for (const rel of named) {
    live.set(rel, readGuarded(root, rel, UNDO_PAGE));
    for (const side of ["before", "after"]) {
      copies.set(`${side}/${rel}`, recordCopy(rec, side, rel, UNDO_RECORD, side === "before" || rel === LOG));
    }
  }
  const matches = (rel, side) => same(live.get(rel), copies.get(`${side}/${rel}`));
  // log.md is the desk's history: every tool adds its line there after the merge, this undo
  // too, so it is never held to its copies and never copied back whole. Only the lines the
  // merge rewrote are put back (logBack).
  const moved = changed
    .map(V.show)
    .filter((rel) => rel !== LOG)
    .filter((rel) => live.get(rel) === null || !(matches(rel, "after") || matches(rel, "before")));
  if (moved.length) refuse(`changed since the merge: ${moved.join(", ")}`);
  if (live.get(removed) !== null && !matches(removed, "before")) refuse(`${removed} is on the desk again`);
  // log.md: only the lines the merge rewrote, each one matched on its own (logBack).
  // Each copy and the live log are read with their line ends made "\n"; log.md is written back
  // with the line ends it has.
  let log = null;
  let logEnd = "\n";
  if (named.includes(LOG)) {
    const text = (bytes) => bytes.toString("utf8");
    const flat = (raw) => raw.replace(/\r\n?/gu, "\n");
    const pairs = rewrittenLines(flat(text(copies.get(`before/${LOG}`))), flat(text(copies.get(`after/${LOG}`))));
    if (pairs === null) refuse(`the copies of ${LOG} in ${record} do not line up, so the lines the merge rewrote cannot be told`);
    const liveLog = live.get(LOG) === null ? null : text(live.get(LOG));
    if (liveLog !== null) logEnd = lineEndOf(liveLog);
    log = logBack(liveLog === null ? null : flat(liveLog), pairs);
  }
  const restored = named.filter((rel) => rel !== LOG || (log !== null && log.back > 0));
  // The restore, planned once: each page with the copy it is put back from, the permission bits
  // that copy kept, and whether it is made (not on the desk now: a page the merge removed, made
  // owner-writable, its recorded mode put back last) or written in place. The up-front set is
  // read off this plan.
  const plan = restored.map((rel) => {
    const copy = at(folder, `before/${rel}`);
    return { rel, mode: fs.lstatSync(copy).mode & 0o777, made: live.get(rel) === null };
  });
  // The bytes the undo writes, its before/ copies as read above, as the views rebuilt after it
  // read them (views.js pageOfBytes).
  const back = Object.fromEntries(plan.filter((p) => p.rel !== LOG).map((p) => [p.rel, copies.get(`before/${p.rel}`)]));
  // Each page the undo writes, and each the views rewrite after it, is checked as itself when it
  // is on the desk and by its folder when the undo makes it (history.js ahead).
  // A folder the undo makes a page in again, gone since the merge, is made here and probed from
  // inside; from here on it is a change the undo names at a stop.
  const aheadMade = canRewrite(root, [
    ...plan.map((p) => ({ rel: p.rel })),
    { rel: `merges/${record}/merge.md` },
    ...(after ? after(read, back, null) : []).map((rel) => ({ rel })),
  ]);
  const kept = V.show(V.own(note, "kept") ?? null);
  const merged = V.show(V.own(note, "merged") ?? null);
  const wrote = aheadMade.map((dir) => folderShown(path.relative(root, dir).split(path.sep).join("/")));
  // Each page this call has made again whose recorded mode is not owner-writable: its mode is put
  // back last, on every exit the running call survives (the finally below).
  const owed = [];
  let others = null;
  let modesNotSet = [];
  let stop = null;
  try {
    writing(
      root,
      wrote,
      () => {
        // A page still on the desk is written in place; a page the merge removed is made again,
        // owner-readable and writable.
        for (const { rel, mode, made } of plan) {
          const owes = made && (mode | OWNER_RW) !== mode;
          try {
            writePage(at(root, rel), rel === LOG ? withLineEnd(log.text, logEnd) : back[rel], made ? mode | OWNER_RW : undefined);
          } catch (err) {
            // Made again and then not closed (NotClosed): the page is there, so its mode is owed.
            if (owes && err instanceof NotClosed) owed.push({ file: at(root, rel), rel, mode });
            throw err;
          }
          wrote.push(rel);
          if (owes) owed.push({ file: at(root, rel), rel, mode });
        }
        markUndone(path.join(folder, "merge.md"), now, noteBytes);
        wrote.push(`merges/${record}/merge.md`);
      },
      atStop === null ? null : (refusal, torn, all) => atStop(refusal, torn, all, { kept, merged }),
    );
    // The call's other writes (the tool's views and log.md).
    others = rest ? rest(wrote, { kept, merged }) : null;
  } catch (err) {
    stop = err;
    throw err;
  } finally {
    // Last, each page made again gets its recorded mode back; a stop's answer names each whose
    // mode could not be set back, as the answer on success does.
    modesNotSet = modesLast(owed).map(({ rel, mode }) => ({ rel, mode }));
    // Before a page's previous text, which ends the answer whole when there is one.
    if (stop instanceof Refusal && modesNotSet.length) sayBeforeTail(stop, modesSaid(modesNotSet));
  }
  return {
    wrote,
    restored,
    record: `merges/${record}/merge.md`,
    kept,
    merged,
    log: log === null ? null : { back: log.back, notBack: log.notBack },
    rest: others,
    modesNotSet,
  };
}

module.exports = {
  TOOL,
  MENDS,
  SAYS_NOTHING,
  MergeRefused,
  mergePages,
  undoMerge,
  octal,
  modesSaid,
  stillNamed,
  pointsAtItself,
  detailsOnNamedOnly,
  recordNotes,
  recordHead,
  undone,
  recordedMerged,
  markUndone,
  repointed,
  quoted,
  rstrip,
};
