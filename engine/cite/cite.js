"use strict";
// Citations (gtm one-desk design, addenda 12 and 14). A cited line ends ` · from <path>:<line>`,
// or ` · from <path>:<first>-<last>` for a block of source lines printed whole; a citation alone
// on a line, `· from ...`, cites the table or code block above it. `<path>` is read from the desk
// folder, and may end `@<sha>`: a file a switch removed, carried at the commit it last existed at.
//
// The write side is whole: `stamped` stamps a citation of a removed file, and `headCommit` reads
// the commit to stamp with from the desk's own git folder, with the file system alone, never by
// running git (the base's ruling R8).
//
// The read side is the rule "a cited line must exist" (C16): a plain citation's file must be on
// the desk, readable, and hold every line it names. A stamped citation is not checked, and is
// counted as not checked: reading a file out of git history is a later row (E4b), so until then
// the check never says a stamped line is missing, and never says it is there.

const fs = require("node:fs");
const path = require("node:path");
const { BLANK_CLASS, splitLines } = require("../check/values.js");

// A blank as Python's `\s` reads one: any whitespace, line ends included.
const WHITE = `${BLANK_CLASS.slice(0, -1)}\\n]`;
const NOT_WHITE_OR_COLON = `[^${BLANK_CLASS.slice(1, -1)}\\n:]`;

// The citation at the end of a line: gtm's `cite.FROM`, word for word. The line numbers are ASCII
// digits, where Python's `\d` also takes other scripts' digits; the desks write ASCII.
const FROM = new RegExp(
  `(?:^| )\\u00b7 from (?<path>${NOT_WHITE_OR_COLON}+):(?<line>[0-9]+)(?:-(?<last>[0-9]+))?$`,
  "u",
);
// The switch's stamp: an `@` and a sha at the end of a path, and nothing else.
const STAMP = /@([0-9a-f]{7,40})$/u;

const RULE = "C16";
const RULE_WORDS = "cited line that is not there";

// The file a citation names, with the switch's commit taken off it.
function sourceFile(cited) {
  return cited.replace(STAMP, "");
}

function isStamped(cited) {
  return STAMP.test(cited);
}

// The citation a line ends with, or null: { path, first, last, start, end }, where start and end
// are where the path sits in the line.
function citationIn(line) {
  const m = FROM.exec(line);
  if (!m) return null;
  const start = m.index + m[0].indexOf(" from ") + " from ".length;
  const first = Number(m.groups.line);
  return {
    path: m.groups.path,
    first,
    last: m.groups.last === undefined ? first : Number(m.groups.last),
    start,
    end: start + m.groups.path.length,
  };
}

// The line with its citation stamped `@sha` when it cites one of the `retired` files; any other
// line as it is. gtm's `retire.stamped`, one reader of the grammar for both sides.
function stamped(line, retired, sha) {
  const c = citationIn(line);
  if (!c || !retired.has(c.path)) return line;
  return `${line.slice(0, c.end)}@${sha}${line.slice(c.end)}`;
}

// The git folder of a repository whose work tree is `folder`, or null: `.git` itself, or the
// folder a `.git` file points at (a worktree), and the common folder its refs live in.
function gitFolders(folder) {
  const dotGit = path.join(folder, ".git");
  let stat;
  try {
    stat = fs.statSync(dotGit);
  } catch {
    return null;
  }
  let gitDir = dotGit;
  if (stat.isFile()) {
    const m = /^gitdir: (.+)$/mu.exec(fs.readFileSync(dotGit, "utf8"));
    if (!m) return null;
    gitDir = path.resolve(folder, m[1].trim());
  }
  let common = gitDir;
  try {
    const commondir = path.join(gitDir, "commondir");
    if (regular(commondir)) common = path.resolve(gitDir, fs.readFileSync(commondir, "utf8").trim());
  } catch {
    // not a worktree: the refs are in the git folder itself
  }
  return { gitDir, common };
}

// Whether `stat` (which follows a link) reports `file` as a regular file: the one thing this
// file opens. A pipe, a socket or a device is never opened, since opening a pipe waits for a
// writer and the call would never return (the base's ruling R38). Throws as stat throws.
function regular(file) {
  return fs.statSync(file).isFile();
}

const SHA = /^[0-9a-f]{40}$/u;

// The commit a ref names: its loose file, else its line in packed-refs, else null.
function refCommit(folders, ref) {
  for (const dir of [folders.gitDir, folders.common]) {
    try {
      const file = path.join(dir, ...ref.split("/"));
      if (!regular(file)) continue;
      const text = fs.readFileSync(file, "utf8").trim();
      if (SHA.test(text)) return text;
      if (text.startsWith("ref: ")) return refCommit(folders, text.slice(5).trim());
    } catch {
      // not a loose ref here
    }
  }
  try {
    const packed = path.join(folders.common, "packed-refs");
    for (const line of regular(packed) ? fs.readFileSync(packed, "utf8").split("\n") : []) {
      const [sha, name] = line.trim().split(" ");
      if (name === ref && SHA.test(sha)) return sha;
    }
  } catch {
    // no packed refs
  }
  return null;
}

// The commit the desk folder's HEAD is at, as its full sha, or null when the folder is not a git
// work tree or its HEAD names no commit yet. Read from the git folder's files: HEAD, the loose
// refs and packed-refs.
function headCommit(folder) {
  const folders = gitFolders(folder);
  if (!folders) return null;
  let head;
  try {
    const headFile = path.join(folders.gitDir, "HEAD");
    if (!regular(headFile)) return null;
    head = fs.readFileSync(headFile, "utf8").trim();
  } catch {
    return null;
  }
  if (SHA.test(head)) return head;
  if (!head.startsWith("ref: ")) return null;
  return refCommit(folders, head.slice(5).trim());
}

function lineWords(first, last) {
  return first === last ? `line ${first}` : `lines ${first} to ${last}`;
}

const OUTSIDE = "names a file outside the desk folder, which the check does not read";

// The path with every link in it resolved, as far as the path exists: the rest is joined on
// unresolved, since nothing is there to follow.
function realPath(file) {
  let cur = file;
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...rest);
    } catch {
      const up = path.dirname(cur);
      if (up === cur) return file;
      rest.unshift(path.basename(cur));
      cur = up;
    }
  }
}

function outside(file, folder) {
  const rel = path.relative(folder, file);
  return rel === "" || rel.split(path.sep)[0] === ".." || path.isAbsolute(rel);
}

// What is wrong with a plain citation, or null when every line it names is there. `inDesk` are
// the folders a cited file may be in once its links are resolved: the desk folder, and its
// celorus/ folder, which the check reads as the desk's own pages even when it is a link. A cited
// path that leaves them, by `..` or through a link, is never read. `lines` caches each file's
// lines (or its problem) by resolved path.
function citedProblem(desk, inDesk, c, lines) {
  if (c.first < 1) return "names line 0, and a file's lines start at 1";
  if (c.last < c.first) return "ends before it starts";
  if (outside(path.resolve(desk, c.path), desk)) return OUTSIDE;
  const file = realPath(path.resolve(desk, c.path));
  if (inDesk.every((folder) => outside(file, folder))) return OUTSIDE;
  if (!lines.has(file)) {
    let got;
    try {
      // stat follows a link: a link to a pipe is the pipe. A folder is named as today; anything
      // else that is not a regular file is named as a line that cannot be read, never opened.
      const st = fs.statSync(file);
      if (st.isDirectory()) got = "names a folder, not a file";
      else if (!st.isFile()) got = "names a file that cannot be read";
      else {
        const bytes = fs.readFileSync(file);
        try {
          got = splitLines(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
        } catch {
          got = "names a file that is not readable as UTF-8";
        }
      }
    } catch (err) {
      got = err && err.code === "EISDIR" ? "names a folder, not a file" : "names a file that is not on the desk";
    }
    lines.set(file, got);
  }
  const got = lines.get(file);
  if (typeof got === "string") return got;
  if (c.last > got.length) {
    return `names ${lineWords(c.first, c.last)}, and the file has ${got.length} line${got.length === 1 ? "" : "s"}`;
  }
  return null;
}

// The rule "a cited line must exist" over the check's pages (check/text.js Page, each with its
// body read outside fenced blocks). `desk` is the desk folder. Returns the findings, each
// { page, rule, message }, and how many citations were checked and how many were stamped and so
// not checked.
function checkCitations(desk, pages) {
  const findings = [];
  const lines = new Map();
  const realDesk = realPath(path.resolve(desk));
  const inDesk = [realDesk, realPath(path.join(path.resolve(desk), "celorus"))];
  let checked = 0;
  let notChecked = 0;
  for (const page of pages) {
    for (const line of splitLines(page.outside)) {
      const c = citationIn(line);
      if (!c) continue;
      if (isStamped(c.path)) {
        notChecked += 1;
        continue;
      }
      checked += 1;
      const problem = citedProblem(path.resolve(desk), inDesk, c, lines);
      if (problem !== null) {
        const range = c.first === c.last ? `${c.first}` : `${c.first}-${c.last}`;
        findings.push({ page: page.rel, rule: RULE, message: `from ${c.path}:${range} ${problem}` });
      }
    }
  }
  return { findings, checked, notChecked };
}

module.exports = {
  FROM,
  STAMP,
  RULE,
  RULE_WORDS,
  sourceFile,
  isStamped,
  citationIn,
  stamped,
  headCommit,
  checkCitations,
};
