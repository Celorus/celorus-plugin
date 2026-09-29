"use strict";
// How a writer puts its pages down. A write is a list of steps, each one page: a page the
// engine creates is created fresh (never through a link, never over a page that is there); a
// page it already owns (a register, log.md, a brief made again the same day) is rewritten in
// place by lib/inplace.js, the base's write discipline
// (point 5 of its ruling): the same file, the old text held in memory, read back, restored on error.
//
// The steps run in order, the history line last. When one fails, the ones before it are taken
// back, so a change never stands without its line in log.md (house rule 5). The answer then
// says, for each page, whether it was restored, or carries its previous text when it may not
// have been. A kill during a write is outside what this can recover (lib/inplace.js).

const fs = require("node:fs");
const path = require("node:path");
const { splitPage } = require("../lib/desk.js");
const { parseHeader, HeaderError } = require("../lib/header.js");
const { codeOf, readWhole, putWhole, stillNamed, openedWhere, putBack, rewrite } = require("../lib/inplace.js");

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;

function fileOf(celorus, rel) {
  return path.join(celorus, ...rel.split("/"));
}

// The folder `rel` must be in: its place in the desk's celorus folder, links followed only in
// the path to that folder. Every open checks it holds after the open (lib/inplace.js).
function placeOf(celorus, rel) {
  return path.join(fs.realpathSync(celorus), ...path.dirname(rel).split("/"));
}

// Whether `folder` is the desk's celorus folder or inside it, its links followed.
function within(celorus, folder) {
  try {
    const top = fs.realpathSync(celorus);
    const here = fs.realpathSync(folder);
    const rel = path.relative(top, here);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

// A page the engine owns, read to be rewritten: { raw, text }, null when there is no file, or
// { refused } saying why it is not written. A link is never written through, and a page that is
// desk.md by a second name (a hard link: `deskId`, desk.md's dev and ino from the call's one
// read, facts.js deskMd) is refused. Other hard links are kept: a rewrite keeps a page's inode.
// Both ids are read as BigInt: an NTFS file id can pass 2^53, where two Numbers round together.
function readOwned(celorus, rel, deskId) {
  const file = fileOf(celorus, rel);
  let info;
  try {
    info = fs.lstatSync(file, { bigint: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    return { refused: `${rel} could not be read (${codeOf(err)}), so nothing was written.` };
  }
  if (!info.isFile()) return { refused: `${rel} is not a plain file (a link or a folder), so nothing was written.` };
  if (deskId && info.dev === deskId.dev && info.ino === deskId.ino) {
    return { refused: `${rel} is the same file as desk.md (a second name for it), so nothing was written.` };
  }
  if (!within(celorus, path.dirname(file))) {
    return { refused: `${rel} is outside the desk's celorus folder by a link, so nothing was written.` };
  }
  let raw;
  let text;
  try {
    raw = fs.readFileSync(file);
    text = STRICT_UTF8.decode(raw);
  } catch {
    return { refused: `${rel} could not be read as UTF-8 text, so nothing was written.` };
  }
  if (text.includes("\r")) return { refused: `${rel} has Windows line endings, so nothing was written.` };
  return { raw, text };
}

// A header as a value that compares whatever order its keys were written in.
function sameValue(a, b) {
  const settle = (value) => {
    if (Array.isArray(value)) return value.map(settle);
    if (value !== null && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .map((key) => [key, settle(value[key])]);
    }
    return value;
  };
  return JSON.stringify(settle(a)) === JSON.stringify(settle(b));
}

const GENERATED_BY = /^generated_by[ \t]*:/u;

// The generated_by a page's header names, as text, or null when it names none or has no
// header that parses.
function generatedByOf(text) {
  const head = headerOf(text);
  return head !== null && typeof head.generated_by === "string" ? head.generated_by : null;
}

// The page's header, read as a mapping, or null when it has none that reads as one. Only the
// header is read: a line in the body never stands for a header field.
function headerOf(text) {
  const split = splitPage(text);
  if (split === null) return null;
  let head;
  try {
    head = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    return null;
  }
  return head !== null && typeof head === "object" && !Array.isArray(head) ? head : null;
}

// The page's text with `generated_by: <value>` in its header, the line replaced where it stands
// or added at the header's end, and every other byte as it was; or { refused } saying why not.
function withGeneratedBy(rel, text, value) {
  const split = splitPage(text);
  const no = (why) => ({ refused: `${rel} ${why}, so nothing was written.` });
  if (split === null) return no("has no header");
  let before;
  try {
    before = parseHeader(split.header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    return no("has a header that does not parse");
  }
  if (before === null || typeof before !== "object" || Array.isArray(before)) return no("has no header of keys and values");
  const lines = split.header.split("\n");
  const found = lines.flatMap((line, i) => (GENERATED_BY.test(line) ? [i] : []));
  if (found.length > 1) return no("names generated_by more than once");
  const line = `generated_by: ${value}`;
  if (found.length) lines[found[0]] = line;
  else lines.push(line);
  const header = lines.join("\n");
  let after;
  try {
    after = parseHeader(header);
  } catch (err) {
    if (!(err instanceof HeaderError)) throw err;
    after = undefined;
  }
  if (after === undefined || !sameValue(after, { ...before, generated_by: value })) {
    return no("has a generated_by that is not one value on one line");
  }
  return { text: `---\n${header}\n---\n${split.body}` };
}

// Creates `rel` fresh with `bytes`. { done } or { fault } (the page is not there after a fault).
function create(celorus, rel, bytes) {
  const file = fileOf(celorus, rel);
  const folder = path.dirname(file);
  try {
    fs.mkdirSync(folder, { recursive: true });
  } catch (err) {
    return { fault: `${rel} could not be written (${codeOf(err)}), so nothing was written.` };
  }
  if (!within(celorus, folder)) {
    return { fault: `${rel} would be written outside the desk's celorus folder by a link, so nothing was written.` };
  }
  let place;
  try {
    place = placeOf(celorus, rel);
  } catch (err) {
    return { fault: `${rel} could not be written (${codeOf(err)}), so nothing was written.` };
  }
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o666);
  } catch (err) {
    if (err && err.code === "EEXIST") return { exists: true };
    return { fault: `${rel} could not be written (${codeOf(err)}), so nothing was written.` };
  }
  let fault = null;
  let held = null;
  try {
    held = fs.fstatSync(fd);
    const off = openedWhere(fd, file, place);
    if (off !== null) {
      // The file this open made is taken out only through a path that still names it.
      const gone = takeOut(file, held);
      return {
        fault: gone
          ? `${rel} ${off}, so nothing was written; the file it made was taken back out.`
          : `${rel} ${off}, so nothing was written; the empty file it made could not be taken back out.`,
      };
    }
    if (!putWhole(fd, bytes)) fault = "did not read back as it was written";
  } catch (err) {
    fault = `could not be written (${codeOf(err)})`;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Flushed and read back already, or failed and taken out below.
    }
  }
  if (fault === null) return { done: { kind: "create", rel, file, held } };
  const gone = takeOut(file, held);
  return {
    fault: gone
      ? `${rel} ${fault}, so nothing was written; ${rel} was taken back out.`
      : `${rel} ${fault}, so nothing was written; ${rel} could not be taken back out and may be incomplete.`,
  };
}

// Removes the file the engine created, when the path still names it: the same device and inode.
function takeOut(file, held) {
  try {
    const now = fs.lstatSync(file);
    if (held === null || now.dev !== held.dev || now.ino !== held.ino) return false;
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

// Rewrites `rel`, holding `raw`, as `bytes`, in place. { done } or { fault, previous }.
function rewriteOwned(celorus, rel, raw, bytes) {
  const file = fileOf(celorus, rel);
  const text = raw.toString("utf8");
  let place;
  let fd;
  try {
    place = placeOf(celorus, rel);
    // lstat asks for a plain file before the open: a page made a pipe, a device or a folder since
    // it was read (readOwned) is not opened. O_NOFOLLOW: one made a link is not opened through.
    if (!fs.lstatSync(file).isFile()) return { fault: `${rel} is not a plain file (a link or a folder), so nothing was written.` };
    fd = fs.openSync(file, fs.constants.O_RDWR | NOFOLLOW);
  } catch (err) {
    return { fault: `${rel} could not be written (${codeOf(err)}), so nothing was written.` };
  }
  try {
    const off = openedWhere(fd, file, place);
    if (off !== null) return { fault: `${rel} ${off}, so nothing was written.` };
    if (!readWhole(fd).equals(raw)) return { fault: `${rel} changed while it was being written, so nothing was written.` };
    const failed = rewrite(fd, raw, bytes);
    const named = stillNamed(fd, file);
    const notNamed =
      named === false
        ? `${rel} was replaced or removed while it was being written, so nothing was written`
        : `It could not be confirmed that ${rel} is the file the change went into (${named}), so nothing was written`;
    if (failed) {
      if (named === true) {
        if (failed.restored) return { fault: `${rel} ${failed.fault}, so nothing was written; ${rel} was restored.` };
        return {
          fault: `${rel} ${failed.fault}; ${rel} may still hold the change or be incomplete, and its previous text is in the answer.`,
          previous: { page: rel, text, still_the_page: true },
        };
      }
      if (failed.restored) return { fault: `${notNamed}; the file it went into was put back as it was.` };
      return {
        fault: `${notNamed}; the file it went into may still hold the change or be incomplete, and its previous text is in the answer.`,
        previous: { page: rel, text, still_the_page: false },
      };
    }
    if (named !== true) {
      if (putBack(fd, raw)) return { fault: `${notNamed}; the file it went into was put back as it was.` };
      return {
        fault: `${notNamed}; the file it went into may still hold the change or be incomplete, and its previous text is in the answer.`,
        previous: { page: rel, text, still_the_page: false },
      };
    }
    return { done: { kind: "rewrite", celorus, rel, file, raw, bytes } };
  } catch (err) {
    return { fault: `${rel} could not be written (${codeOf(err)}), so nothing was written.` };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Flushed and read back already; a close that fails changes nothing on disk.
    }
  }
}

// Takes back a step that was done: a created page is taken out, a rewritten one gets its old
// text back in place. The clause the answer adds, and the previous text when it may not have.
function undo(step) {
  if (step.kind === "create") {
    return takeOut(step.file, step.held)
      ? { said: `${step.rel} was taken back out.` }
      : { said: `${step.rel} could not be taken back out, so it stands without its line in log.md.` };
  }
  const text = step.raw.toString("utf8");
  const kept = { said: `${step.rel} could not be put back as it was, and its previous text is in the answer.`, previous: { page: step.rel, text, still_the_page: true } };
  let fd;
  let place;
  try {
    place = placeOf(step.celorus, step.rel);
    // lstat asks for a plain file before the open, as rewriteOwned's does.
    if (!fs.lstatSync(step.file).isFile()) return kept;
    fd = fs.openSync(step.file, fs.constants.O_RDWR | NOFOLLOW);
  } catch {
    return kept;
  }
  try {
    if (openedWhere(fd, step.file, place) !== null) return kept;
    if (!readWhole(fd).equals(step.bytes)) return kept;
    if (rewrite(fd, step.bytes, step.raw) !== null || stillNamed(fd, step.file) !== true) return kept;
    return { said: `${step.rel} was put back as it was.` };
  } catch {
    return kept;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Nothing more to do.
    }
  }
}

// Runs `steps` in order: { kind: "create", rel, text } or { kind: "rewrite", rel, raw, text }.
// A created page whose name is taken by then is refused, never written over. Answers
// { written: [rel] } or { written: null, reason, previous_text }.
function writeSteps(celorus, steps) {
  const done = [];
  for (const step of steps) {
    const bytes = Buffer.from(step.text, "utf8");
    let out = step.kind === "create" ? create(celorus, step.rel, bytes) : rewriteOwned(celorus, step.rel, step.raw, bytes);
    if (out.exists) out = { fault: `${step.rel} was made by something else while it was being written, so nothing was written.` };
    if (out.done) {
      done.push(out.done);
      continue;
    }
    const said = [out.fault];
    const previous = out.previous ? [out.previous] : [];
    for (const back of done.reverse()) {
      const undone = undo(back);
      said.push(undone.said);
      if (undone.previous) previous.push(undone.previous);
    }
    return { written: null, reason: said.join(" "), previous_text: previous.length ? previous : null };
  }
  return { written: done.map((step) => step.rel) };
}

module.exports = { fileOf, generatedByOf, headerOf, readOwned, withGeneratedBy, writeSteps, within };
