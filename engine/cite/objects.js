"use strict";
// A file as it was at a commit, read out of the desk's own git objects (row E4b, the base's ruling
// R8): with Node's builtins alone (fs, zlib, crypto, path), never by running git.
//
// What it reads: loose objects; packs through their index (version 2), with offset deltas and
// deltas against a named base, however deep the chain; a work tree whose .git is a file naming
// its git folder, and the common folder that folder's `commondir` names; the object folders
// objects/info/alternates adds. What it cannot read it refuses in its own words, a Refusal with a
// `reason` (one of REASONS' keys), never raw error text and never a path: a git folder with no
// object store, a commit or a file a shallow or partial copy does not hold, a pack or an index of
// a version it does not know, an object that is damaged or cannot be opened, and a file the
// history holds in another form than its lines (through a filter an attributes file names, a
// link, or another repository).
//
// It reads only what is inside the desk. The attributes files git also reads from outside it (the
// home folder's, core.attributesFile's default, and the system's) are never read, a named limit;
// where the desk's own git settings may name one (any attributesfile key, in any spelling or
// layout, or any include or includeIf section, whose files are not read), a citation no rule
// inside the desk decides is refused as outside_rules, never read as unfiltered.
//
// The fail-closed rule, in one place (filterState): whatever in the attribute rules the reader
// does not model exactly (a pattern it does not read, a pattern git's versions read differently
// (see matcher), a match that holds only with case ignored, a line whose attribute names git
// would not accept, an overlong line, a macro that is negated, unset, given a value, defined
// badly or defined twice with different words, or a desk setting that points outside the desk)
// may set a filter, so the citation is not checked, and never clears one or leaves it unset.
//
// Bounded work: a history is opened once per check run (openHistory), reads each pack index the
// first time it needs one and keeps it for that run only; an object is found by the index's
// fan-out and a binary search, never by walking a pack. No object grows past LARGEST: an inflate
// stops at the size its header claims, and a claim past LARGEST is refused before anything is
// made; the compressed bytes read for an object are no more than SPAN_FOR its claim. Nothing is
// kept in this file between calls: a history's state is the object it returns, and close() lets
// go of its open packs.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { Refusal } = require("../lib/refusal.js");

// Why a stamped citation could not be read, in the engine's words: each ends a sentence that
// begins "... and were not checked: ".
const REASONS = Object.freeze({
  no_history: "the desk folder holds no git history to read it from",
  shallow: "the desk's history on this machine is a shallow or partial copy, without that commit or file",
  pack_version: "the desk's history is packed in a form the check does not read",
  corrupt: "the desk's history is damaged or cannot be opened where the citation points",
  ambiguous: "the short commit id names more than one object in the desk's history",
  stored_form: "the desk's history keeps that file through a filter, a link or another repository, not as its own lines",
  outside_rules: "the desk's git settings point to attribute rules kept outside the desk, which are not read",
});

function cannotRead(reason) {
  const words = REASONS[reason];
  const err = new Refusal(`${words[0].toUpperCase()}${words.slice(1)}.`);
  err.reason = reason;
  return err;
}

const TYPES = { 1: "commit", 2: "tree", 3: "blob", 4: "tag" };
const OFS_DELTA = 6;
const REF_DELTA = 7;
// Deeper than git ever writes (its default is 50), so a chain this long is a loop or damage.
const MOST_LINKS = 10000;
const IDX_MAGIC = 0xff744f63;
// The most bytes one object may hold once inflated or rebuilt from its delta: far past any page or
// file a citation names lines of, so an object that claims more is damage, refused before any of
// it is made.
const LARGEST = 256 * 1024 * 1024;
// The compressed bytes read, one length after the next, for a loose object's header (a stream's
// first bytes may hold only its code tables), and the most each byte may inflate to (deflate gives
// at most about 1032 bytes for each one it reads; twice that, so a true stream is never cut).
const HEAD_IN = [64, 512, 4096];
const HEAD_RATIO = 2064;
// The most compressed bytes read for an object that claims `size` bytes once inflated: twice the
// claim and a kilobyte. deflate's worst is stored blocks (5 bytes a block over the data) or fixed
// codes (at most 9 bits a byte, an eighth more), both far inside this, so a span longer than it is
// never read whole: what inflates within it is the object, and a stream it cuts is damage.
function SPAN_FOR(size) {
  return size * 2 + 1024;
}
// How deep objects/info/alternates may send the reader, as git's own limit.
const DEEPEST_ALTERNATE = 5;
// The tree modes of a file git stores as its own bytes, and those of what it stores otherwise: a
// link (its target's name) and another repository (a commit of that one).
const FILE_MODES = new Set(["100644", "100755", "100664"]);
const OTHER_FORMS = new Set(["120000", "160000"]);
// The reason each form the history keeps a file in other than its lines is counted under: a
// filter an attributes file gives the path, and a link or another repository on the path. One
// reason for both today; each is its own entry here so that either can take a reason of its own.
const FORM_REASON = Object.freeze({ filter: "stored_form", link: "stored_form" });

// An error from the file system that means nothing is there (no such entry, or a file where a
// folder was meant): absence. Any other (a folder that cannot be opened, a read that fails) is a
// history that cannot be opened there, refused as corrupt, never read as absence.
const ABSENT = new Set(["ENOENT", "ENOTDIR"]);
function absentOrRefused(err) {
  if (!err || !ABSENT.has(err.code)) throw cannotRead("corrupt");
}

// The bytes of `file`, or null when nothing is there. stat asks for a regular file before the
// read, so a pipe, a socket or a device is never opened (the base's ruling R38).
function readRegular(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch (err) {
    absentOrRefused(err);
    return null;
  }
  if (!st.isFile()) throw cannotRead("corrupt");
  try {
    return fs.readFileSync(file);
  } catch {
    throw cannotRead("corrupt");
  }
}

// An open pack file, { fd, size }, or null when nothing is there; stat asks for a regular file
// before the open, as readRegular does.
function openRegular(file) {
  let info;
  try {
    info = fs.statSync(file);
  } catch (err) {
    absentOrRefused(err);
    return null;
  }
  if (!info.isFile()) throw cannotRead("corrupt");
  try {
    return { fd: fs.openSync(file, "r"), size: info.size };
  } catch {
    throw cannotRead("corrupt");
  }
}

// The names in a folder, or none when nothing is there.
function namesIn(folder) {
  try {
    return fs.readdirSync(folder);
  } catch (err) {
    absentOrRefused(err);
    return [];
  }
}

// Whether a folder is at `at` (stat follows a link, as git does).
function isFolder(at) {
  try {
    return fs.statSync(at).isDirectory();
  } catch (err) {
    absentOrRefused(err);
    return false;
  }
}

// The object folders of a repository: its own, then each one objects/info/alternates names
// (relative to the folder naming it, as git reads them), each once. `lost` is true when an entry
// names no folder, or the entries go deeper than DEEPEST_ALTERNATE: the history then lacks
// objects it was meant to have, and an object not found is never said not to be there.
function objectFolders(first) {
  const folders = [];
  const seen = new Set();
  let lost = false;
  const add = (folder, depth) => {
    const at = path.resolve(folder);
    if (seen.has(at)) return;
    if (depth > DEEPEST_ALTERNATE || !isFolder(at)) {
      lost = true;
      return;
    }
    seen.add(at);
    folders.push(at);
    const alt = readRegular(path.join(at, "info", "alternates"));
    if (alt === null) return;
    for (const line of alt.toString("utf8").split("\n")) {
      const want = line.trim();
      if (want && !want.startsWith("#")) add(path.resolve(at, want), depth + 1);
    }
  };
  add(first, 0);
  return { folders, lost };
}

// Whether the repository is a shallow or partial copy, so an object it lacks may be one it was
// never given rather than one that never was.
function incompleteCopy(common, folders) {
  if (readRegular(path.join(common, "shallow")) !== null) return true;
  const config = readRegular(path.join(common, "config"));
  if (config !== null && /^\s*(?:partialclone|promisor)\s*=/imu.test(config.toString("utf8"))) return true;
  return folders.some((folder) => namesIn(path.join(folder, "pack")).some((name) => name.endsWith(".promisor")));
}

function hashOf(type, data) {
  return crypto.createHash("sha1").update(`${type} ${data.length}\0`).update(data).digest("hex");
}

// `bytes` inflated to exactly `size` bytes: the inflate stops once it would pass `size`, so a
// stream that claims little and holds much is refused having made no more than `size` of it.
function inflate(bytes, size) {
  if (!Number.isSafeInteger(size) || size < 0 || size > LARGEST) throw cannotRead("corrupt");
  let out;
  try {
    out = zlib.inflateSync(bytes, { maxOutputLength: Math.max(size, 1) });
  } catch {
    throw cannotRead("corrupt");
  }
  if (out.length !== size) throw cannotRead("corrupt");
  return out;
}

// `length` bytes of an open file from `position`, or fewer where the file ends.
function readFd(fd, position, length) {
  const buf = Buffer.alloc(length);
  let got = 0;
  try {
    while (got < length) {
      const n = fs.readSync(fd, buf, got, length - got, position + got);
      if (n === 0) break;
      got += n;
    }
  } catch {
    throw cannotRead("corrupt");
  }
  return buf.subarray(0, got);
}

// The loose object at `file`, or null when nothing is there: its header is read from the file's
// first bytes alone, and the file is read whole only when it is no longer than SPAN_FOR the size
// that header claims (and never past SPAN_FOR(LARGEST)).
function readLoose(file) {
  const open = openRegular(file);
  if (open === null) return null;
  try {
    if (open.size > SPAN_FOR(LARGEST)) throw cannotRead("corrupt");
    const first = readFd(open.fd, 0, Math.min(open.size, HEAD_IN[HEAD_IN.length - 1]));
    const head = looseHead(first);
    if (open.size > SPAN_FOR(head.whole)) throw cannotRead("corrupt");
    const bytes = open.size <= first.length ? first : readFd(open.fd, 0, open.size);
    const raw = inflate(bytes, head.whole);
    return { type: head.type, data: raw.subarray(head.whole - head.size) };
  } finally {
    try {
      fs.closeSync(open.fd);
    } catch {
      // already let go
    }
  }
}

// A loose object's header, "<type> <size>\0" once inflated, read from its first compressed bytes
// alone (HEAD_IN, each inflated no further than HEAD_RATIO times its length): { type, size, whole }
// with `whole` the inflated length of the header and data together.
function looseHead(bytes) {
  let m = null;
  let nul = -1;
  for (const length of HEAD_IN) {
    let head;
    try {
      head = zlib.inflateSync(bytes.subarray(0, length), { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: length * HEAD_RATIO });
    } catch {
      throw cannotRead("corrupt");
    }
    nul = head.indexOf(0);
    if (nul >= 0) {
      m = /^(commit|tree|blob|tag) ([0-9]{1,10})$/u.exec(head.toString("latin1", 0, nul));
      break;
    }
    if (head.length > 32 || length >= bytes.length) break;
  }
  if (!m) throw cannotRead("corrupt");
  const size = Number(m[2]);
  if (size > LARGEST) throw cannotRead("corrupt");
  return { type: m[1], size, whole: nul + 1 + size };
}

// A delta applied to its base (git's pack format: the base's size, the result's size, then copy
// and insert instructions). A result claimed past LARGEST is refused before it is made.
function applyDelta(base, delta) {
  let i = 0;
  const size = () => {
    let n = 0;
    let shift = 0;
    for (;;) {
      if (i >= delta.length) throw cannotRead("corrupt");
      const b = delta[i++];
      n += (b & 0x7f) * 2 ** shift;
      shift += 7;
      if (!(b & 0x80)) return n;
    }
  };
  if (size() !== base.length) throw cannotRead("corrupt");
  const claimed = size();
  if (claimed > LARGEST) throw cannotRead("corrupt");
  const out = Buffer.alloc(claimed);
  let at = 0;
  while (i < delta.length) {
    const op = delta[i++];
    if (op & 0x80) {
      let offset = 0;
      let length = 0;
      for (let k = 0; k < 4; k += 1) if (op & (1 << k)) offset += delta[i++] * 2 ** (8 * k);
      for (let k = 0; k < 3; k += 1) if (op & (1 << (4 + k))) length += delta[i++] * 2 ** (8 * k);
      if (length === 0) length = 0x10000;
      if (i > delta.length || offset + length > base.length || at + length > out.length) throw cannotRead("corrupt");
      base.copy(out, at, offset, offset + length);
      at += length;
    } else if (op) {
      if (i + op > delta.length || at + op > out.length) throw cannotRead("corrupt");
      delta.copy(out, at, i, i + op);
      i += op;
      at += op;
    } else {
      throw cannotRead("corrupt");
    }
  }
  if (at !== out.length) throw cannotRead("corrupt");
  return out;
}

// A pack index, version 2: its object names, and where each object starts in its pack.
function parseIndex(bytes) {
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== IDX_MAGIC) return { version: 1 };
  const version = bytes.readUInt32BE(4);
  if (version !== 2) return { version };
  if (bytes.length < 8 + 1024 + 40) throw cannotRead("corrupt");
  const count = bytes.readUInt32BE(8 + 1020);
  const names = 8 + 1024;
  const offsets = names + count * 24;
  const large = offsets + count * 4;
  if (bytes.length < large + 40) throw cannotRead("corrupt");
  return { version, bytes, count, names, offsets, large };
}

function nameAt(idx, i) {
  return idx.bytes.toString("hex", idx.names + i * 20, idx.names + i * 20 + 20);
}

function offsetAt(idx, i) {
  const small = idx.bytes.readUInt32BE(idx.offsets + i * 4);
  if (!(small & 0x80000000)) return small;
  const at = idx.large + (small & 0x7fffffff) * 8;
  if (at + 8 > idx.bytes.length - 40) throw cannotRead("corrupt");
  return Number(idx.bytes.readBigUInt64BE(at));
}

// The index positions whose names start with `prefix` (hex, 7 to 40 characters): the fan-out for
// its first byte, a binary search for the first name at or after it, then the names that follow
// while they still start with it.
function positionsOf(idx, prefix) {
  const first = parseInt(prefix.slice(0, 2), 16);
  const fan = (b) => (b < 0 ? 0 : idx.bytes.readUInt32BE(8 + b * 4));
  let lo = fan(first - 1);
  const hi = fan(first);
  if (hi > idx.count || lo > hi) throw cannotRead("corrupt");
  const want = prefix.padEnd(40, "0");
  let top = hi;
  while (lo < top) {
    const mid = (lo + top) >>> 1;
    if (nameAt(idx, mid) < want) lo = mid + 1;
    else top = mid;
  }
  const out = [];
  for (let i = lo; i < hi && nameAt(idx, i).startsWith(prefix); i += 1) out.push(i);
  return out;
}

// ---- attributes: whether git kept a file through a filter ----
//
// A path whose attributes give it a filter (an encrypting filter, a large-file store, any clean
// filter) was stored as the filter's output, not as the file's lines, so its stamped citation
// cannot be checked against the history. The rules are read as git reads an attributes file: a
// pattern and its attributes on each line; a pattern with no slash matched against the file's
// name at any depth below the attributes file's folder, one with a slash against the path from
// that folder; `*`, `?`, `**` (before a slash or an escaped one), backslash escapes and bracket
// expressions as git's wildmatch has them (ranges, `!` or `^` to negate, a `]` first taken as
// itself, and the twelve named classes such as `:alpha:`, each over ASCII as git's own ctype has
// them), matched byte by byte on the path's UTF-8 bytes as git matches it; a file's lines split
// on newlines and its words on git's blanks alone (space, tab, carriage return), a leading
// byte-order mark skipped; a pattern that ends in a slash names a folder alone, which git never
// applies to the files in it; a pattern that starts with `!` is one git ignores; later lines over
// earlier, deeper files over shallower, the repository's own info/attributes over them all;
// `[attr]` macros from the top-level file and info/attributes alone (git ignores one anywhere
// else), and git's own `binary`.
// Letters: git matches in either case only where the desk ignores case (core.ignorecase), which
// the history cannot tell, so a match that holds only with case ignored falls under the
// fail-closed rule in the header.
// A pattern the reader does not read is unsure, taken to match every path under the same rule.
// Unsure: a bracket expression with no close, a named class git does not know, a byte past ASCII
// inside a bracket expression, a trailing backslash, a quoted pattern with no end or with an
// escape git does not write.

// The two characters that open and close a bracket expression in an attributes pattern. They are
// read here as a character class of a path's pattern, never as a link.
const [OPEN, CLOSE] = "[]";

// git's named classes, over ASCII bytes, as git's own ctype has them (its space is tab, newline,
// carriage return and space alone).
const CLASSES = {
  alnum: (c) => CLASSES.digit(c) || CLASSES.alpha(c),
  alpha: (c) => CLASSES.upper(c) || CLASSES.lower(c),
  blank: (c) => c === 9 || c === 32,
  cntrl: (c) => c < 32 || c === 127,
  digit: (c) => c >= 48 && c <= 57,
  graph: (c) => c > 32 && c < 127,
  lower: (c) => c >= 97 && c <= 122,
  print: (c) => c >= 32 && c < 127,
  punct: (c) => CLASSES.graph(c) && !CLASSES.alnum(c),
  space: (c) => c === 9 || c === 10 || c === 13 || c === 32,
  upper: (c) => c >= 65 && c <= 90,
  xdigit: (c) => CLASSES.digit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102),
};

// A text as its UTF-8 bytes, one character for each byte: patterns and paths are matched as git
// matches them, byte by byte.
function bytesOf(text) {
  return Buffer.from(text, "utf8").toString("latin1");
}

// One byte as a regular expression's source that matches it alone.
function lit(byte) {
  return `\\u{${byte.toString(16)}}`;
}

// The bracket expression whose first member is at `b[from]` (the byte after the one that opens
// it), as git's wildmatch reads it: { source, end } with `end` the index of the byte that closes
// it, or null for one the reader does not read.
function bracket(b, from) {
  let i = from;
  let negated = false;
  if (b[i] === "!" || b[i] === "^") {
    negated = true;
    i += 1;
  }
  const members = [];
  let prev = null;
  let first = true;
  for (; i < b.length && (first || b[i] !== CLOSE); i += 1) {
    first = false;
    let c = b[i];
    if (c === "\\") {
      i += 1;
      if (i >= b.length) return null;
      c = b[i];
      members.push(lit(c.charCodeAt(0)));
      prev = c.charCodeAt(0);
    } else if (c === "-" && prev !== null && i + 1 < b.length && b[i + 1] !== CLOSE) {
      i += 1;
      let end = b[i];
      if (end === "\\") {
        i += 1;
        if (i >= b.length) return null;
        end = b[i];
      }
      const hi = end.charCodeAt(0);
      if (hi > 127) return null;
      if (prev <= hi) members.push(`${lit(prev)}-${lit(hi)}`);
      prev = null;
    } else if (c === OPEN && b[i + 1] === ":") {
      const close = b.indexOf(CLOSE, i + 2);
      if (close < 0) return null;
      if (close - 1 < i + 2 || b[close - 1] !== ":") {
        // Not a named class: the opening byte is a member as itself, as git reads it.
        members.push(lit(c.charCodeAt(0)));
        prev = c.charCodeAt(0);
        continue;
      }
      const test = CLASSES[b.slice(i + 2, close - 1)];
      if (!test) return null;
      for (let byte = 0; byte < 128; byte += 1) if (test(byte)) members.push(lit(byte));
      prev = null;
      i = close;
    } else {
      if (c.charCodeAt(0) > 127) return null;
      members.push(lit(c.charCodeAt(0)));
      prev = c.charCodeAt(0);
    }
  }
  if (i >= b.length) return null;
  // git's bracket expression never matches a slash.
  const body = members.join("");
  const source = negated ? `${OPEN}^/${body}${CLOSE}` : body ? `(?!/)${OPEN}${body}${CLOSE}` : "(?!)";
  return { source, end: i };
}

// Where a pattern's literal start ends: its first `*`, `?`, bracket or backslash. For a pattern
// with a slash git compares that start on its own and hands wildmatch the rest, so a `**` just
// after it begins that rest and may be whole.
function literalLength(p) {
  for (let i = 0; i < p.length; i += 1) if (p[i] === "*" || p[i] === "?" || p[i] === OPEN || p[i] === "\\") return i;
  return p.length;
}

// A pattern's bytes as a regular expression's source, matched against a path's bytes with forward
// slashes; null for a pattern the reader does not read. `start` is where the part git hands
// wildmatch begins (see literalLength).
function globSource(b, start = 0) {
  let re = "";
  for (let i = 0; i < b.length; i += 1) {
    const ch = b[i];
    if (ch === "*") {
      let j = i;
      while (b[j] === "*") j += 1;
      const escapedSlash = b[j] === "\\" && b[j + 1] === "/";
      const whole = j - i >= 2 && (i === 0 || i === start || b[i - 1] === "/") && (j === b.length || b[j] === "/" || escapedSlash);
      if (whole && j === b.length) {
        re += ".*";
      } else if (whole && !escapedSlash) {
        re += "(?:.*/)?";
        j += 1;
      } else if (whole) {
        // Before an escaped slash git's ** crosses folders but matches no folder away.
        re += ".*";
      } else {
        re += "[^/]*";
      }
      i = j - 1;
    } else if (ch === "?") {
      re += "[^/]";
    } else if (ch === OPEN) {
      const got = bracket(b, i + 1);
      if (got === null) return null;
      re += got.source;
      i = got.end;
    } else if (ch === "\\") {
      i += 1;
      if (i >= b.length) return null;
      re += lit(b.charCodeAt(i));
    } else {
      re += lit(b.charCodeAt(i));
    }
  }
  return re;
}

// The match of an unsure pattern: every path, and it may only set a filter.
const UNSURE = Object.freeze({ unsure: true, exact: () => true, folded: () => true });

// How a pattern (its bytes) of an attributes file in folder `dir` ("" at the top) matches a file: { exact,
// folded }, each a function of the file's path (exact: byte for byte; folded: with case ignored);
// null for a pattern that matches no file (a folder alone, or one git ignores); UNSURE for one the
// reader does not read.
function matcher(pattern, dir) {
  let p = pattern;
  if (p.startsWith("!")) return null;
  let anchored = false;
  if (p.startsWith("/")) {
    anchored = true;
    p = p.slice(1);
  }
  if (!p || p.endsWith("/")) return null;
  anchored = anchored || p.includes("/");
  // The shape git's versions read two ways: a pattern with a slash whose literal start runs
  // straight into a ** (as "data**" or "docs/img**/x"). git 2.51 and older compare the literal
  // start on its own and read the ** as whole, crossing folders; git 2.52 and newer keep the
  // start's last byte before the **, so it stays within one folder. Where the two readings
  // differ the pattern is taken to match wherever either does, and the line is unsure (see the
  // header): it may set a filter and never clears one.
  const readings = [...new Set([globSource(p, anchored ? literalLength(p) : 0), globSource(p, 0)])];
  if (readings.includes(null)) return UNSURE;
  let exact;
  let folded;
  try {
    exact = readings.map((source) => new RegExp(`^${source}$`, "u"));
    folded = readings.map((source) => new RegExp(`^${source}$`, "iu"));
  } catch {
    return UNSURE;
  }
  const under = dir ? `${bytesOf(dir)}/` : "";
  const test = (res, fold) => (file) => {
    const f = bytesOf(file);
    if (under && !(fold ? f.toLowerCase().startsWith(under.toLowerCase()) : f.startsWith(under))) return false;
    const rel = f.slice(under.length);
    const name = anchored ? rel : rel.slice(rel.lastIndexOf("/") + 1);
    return res.some((re) => re.test(name));
  };
  return { unsure: false, versions: readings.length > 1, exact: test(exact, false), folded: test(folded, true) };
}

// A pattern git wrote in quotes (its bytes), its escapes read as git's own quoting writes them (a
// letter escape, a backslash, a quote, or three octal digits for one byte), as bytes; null for
// any other escape, which the reader does not read.
const ESCAPES = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, "\\": 92, '"': 34 };
function unquoted(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "\\") {
      out += text[i];
      continue;
    }
    const octal = /^[0-3][0-7]{2}/u.exec(text.slice(i + 1, i + 4));
    if (octal) {
      out += Buffer.from([parseInt(octal[0], 8)]).toString("latin1");
      i += 3;
    } else if (i + 1 < text.length && Object.hasOwn(ESCAPES, text[i + 1])) {
      out += Buffer.from([ESCAPES[text[i + 1]]]).toString("latin1");
      i += 1;
    } else {
      return null;
    }
  }
  return out;
}

// git's blanks between an attributes line's words, and the longest line it reads (a longer one
// it ignores).
const BLANKS = /[ \t\r\n]+/u;
const LONGEST_LINE = 2048;
const LARGEST_ATTRIBUTES = 100 * 1024 * 1024;
// An attribute name git accepts: letters, digits, `-`, `.` and `_`, not starting with `-`, and
// not one of its own `builtin_` names.
const ATTR_NAME = /^(?!-)(?!builtin_)[-._0-9A-Za-z]+$/u;

// A token's parts: its sign ("", "-" or "!"), its name, whether it gives a value, and whether git
// accepts its name.
function tokenOf(token) {
  const sign = token[0] === "-" || token[0] === "!" ? token[0] : "";
  const body = sign ? token.slice(1) : token;
  const eq = body.indexOf("=");
  const name = eq < 0 ? body : body.slice(0, eq);
  return { sign, name, valued: eq >= 0, valid: ATTR_NAME.test(name) };
}

// The rules of an attributes file (its bytes) in folder `dir`: each { match, tokens, unsure } for
// a pattern line, or { macro, tokens, bad } for an `[attr]` line, which git reads only at the top
// ("" here: the top-level file and info/attributes) and ignores anywhere else. `unsure` and `bad`
// mark what the fail-closed rule covers.
function rulesOf(bytes, dir) {
  const out = [];
  // A file past git's largest it ignores whole; the reader keeps its lines, each unsure.
  const tooLarge = bytes.length > LARGEST_ATTRIBUTES;
  // git reads an attributes file two ways: from the work tree it skips a leading byte-order mark
  // and reads past a NUL; from a commit's tree it keeps the mark and stops at the first NUL. The
  // lines the two read differently (the first line after a mark, every line at or after a NUL)
  // are unsure, and the first line is read both ways.
  const mark = bytes.startsWith("\xef\xbb\xbf");
  const nul = bytes.indexOf("\0");
  let at = 0;
  for (const [k, raw] of bytes.split("\n").entries()) {
    const from = at;
    at += raw.length + 1;
    let shaky = tooLarge || raw.length >= LONGEST_LINE;
    let views = [raw];
    if (k === 0 && mark) {
      views = [raw.slice(3), raw];
      shaky = true;
    }
    if (nul >= 0 && from + raw.length >= nul) shaky = true;
    for (const view of views) {
      const rule = lineRule(view.split("\0")[0], dir, shaky);
      if (rule !== null) out.push(rule);
    }
  }
  return out;
}

// One line of an attributes file as a rule (see rulesOf), or null for a line with none. `shaky`
// marks a line the fail-closed rule covers.
function lineRule(raw, dir, shaky) {
  const line = raw.replace(/^[ \t\r\n]+/u, "");
  if (!line || line.startsWith("#")) return null;
  if (raw.length >= LONGEST_LINE) return { match: UNSURE, tokens: line.split(BLANKS).filter(Boolean), unsure: true };
  let pattern;
  let rest;
  if (line.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"(.*)$/su.exec(line);
    // A quoted pattern with no end: unsure, with every word on the line.
    if (!m) return { match: UNSURE, tokens: line.split(BLANKS).filter(Boolean), unsure: true };
    pattern = unquoted(m[1]);
    rest = m[2];
    if (pattern === null) return { match: UNSURE, tokens: rest.split(BLANKS).filter(Boolean), unsure: true };
  } else {
    const cut = line.search(BLANKS);
    pattern = cut < 0 ? line : line.slice(0, cut);
    rest = cut < 0 ? "" : line.slice(cut);
  }
  const tokens = rest.split(BLANKS).filter(Boolean);
  const unsure = shaky || tokens.some((t) => !tokenOf(t).valid);
  if (pattern.startsWith("[attr]")) {
    const name = pattern.slice("[attr]".length);
    return dir === "" ? { macro: name, tokens, bad: unsure || !ATTR_NAME.test(name) } : null;
  }
  const match = matcher(pattern, dir);
  return match === null ? null : { match, tokens, unsure: unsure || match.unsure || match.versions };
}

// What `rules` (in the order git weighs them, the last the strongest) leave `file`'s filter as:
// "set", "unset" or "unspecified". The fail-closed rule (see the header) is applied here alone: a
// line it covers may set a filter and never clears one, and a macro it covers turns every line
// into one that may only set.
function filterState(rules, file) {
  // Each macro's definitions, each different one kept: a macro defined twice with different words
  // is unsure, and each of its definitions is applied.
  const defs = new Map([["binary", ["-diff -merge -text"]]]);
  let macrosUnsure = false;
  for (const rule of rules) {
    if (rule.macro === undefined) continue;
    if (rule.bad || rule.macro === "filter") macrosUnsure = true;
    const words = rule.tokens.join(" ");
    const known = defs.get(rule.macro) || [];
    if (!known.includes(words)) {
      if (known.length) macrosUnsure = true;
      defs.set(rule.macro, [...known, words]);
    }
  }
  // A macro negated, unset or given a value: git then leaves a weaker line's macro unexpanded,
  // which the reader does not model.
  const touchesMacro = (tokens) =>
    tokens.some((t) => {
      const k = tokenOf(t);
      return defs.has(k.name) && (k.sign !== "" || k.valued);
    });
  for (const each of defs.values()) for (const words of each) if (touchesMacro(words.split(" ").filter(Boolean))) macrosUnsure = true;
  const matched = [];
  for (const rule of rules) {
    if (!rule.match) continue;
    let setOnly;
    if (rule.match.unsure || rule.unsure) setOnly = rule.match.unsure || rule.match.folded(file) ? true : null;
    else if (rule.match.exact(file)) setOnly = false;
    else if (rule.match.folded(file)) setOnly = true;
    else setOnly = null;
    if (setOnly === null) continue;
    matched.push({ tokens: rule.tokens, setOnly });
    if (touchesMacro(rule.tokens)) macrosUnsure = true;
  }
  let state = "unspecified";
  const apply = (tokens, depth, setOnly) => {
    for (const token of tokens) {
      const k = tokenOf(token);
      if (k.name === "filter") {
        if (!k.sign) state = "set";
        else if (!setOnly) state = k.sign === "-" ? "unset" : "unspecified";
      } else if (!k.sign && !k.valued && defs.has(k.name)) {
        if (depth >= 10) state = "set";
        else for (const words of defs.get(k.name)) apply(words.split(" ").filter(Boolean), depth + 1, setOnly);
      }
    }
  };
  for (const { tokens, setOnly } of matched) apply(tokens, 0, setOnly || macrosUnsure);
  return state;
}

// Whether the desk's own git settings may name an attributes file outside the desk: any
// attributesfile key, in any spelling, section or layout, or any include or includeIf section
// anywhere in the file (whose files may set one, and are not read).
function namesOutsideRules(common, gitDir) {
  for (const file of [path.join(common, "config"), path.join(gitDir, "config.worktree")]) {
    const bytes = readRegular(file);
    if (bytes === null) continue;
    const text = bytes.toString("latin1").toLowerCase();
    if (text.includes("attributesfile")) return true;
    // An include or includeIf section anywhere: at a line's start, after another section on the
    // same line, after a byte-order mark.
    for (let at = text.indexOf(OPEN); at >= 0; at = text.indexOf(OPEN, at + 1)) {
      if (text.slice(at + 1).trimStart().startsWith("include")) return true;
    }
  }
  return false;
}

// The history of the git work tree whose git folders are `folders` ({ gitDir, common }, from
// cite.js gitFolders), for one check run.
// A git folder that is not there, or whose common folder holds no object store (a .git file whose
// folder is gone, an empty .git), is a desk with no history to read: refused as no_history, never
// read as a history that lacks every commit.
function openHistory(folders) {
  if (!isFolder(folders.gitDir) || !isFolder(path.join(folders.common, "objects"))) throw cannotRead("no_history");
  const { folders: objects, lost } = objectFolders(path.join(folders.common, "objects"));
  // What an object the history lacks is, when it may be one this copy was never given: a shallow
  // or partial copy's (shallow), or an alternate store's that is gone (corrupt). Null for a whole
  // copy, where an object not found is not in the history.
  const gap = incompleteCopy(folders.common, objects) ? "shallow" : lost ? "corrupt" : null;
  const outsideRules = namesOutsideRules(folders.common, folders.gitDir);
  const seen = { loose: 0, packed: 0, ofs: 0, ref: 0, deepest: 0, indexes: 0 };
  let packs = null;
  let unknownVersion = false;
  const cache = new Map();

  function loadPacks() {
    if (packs !== null) return packs;
    packs = [];
    for (const folder of objects) {
      const dir = path.join(folder, "pack");
      for (const name of namesIn(dir).filter((n) => n.endsWith(".idx")).sort()) {
        const bytes = readRegular(path.join(dir, name));
        if (bytes === null) continue;
        seen.indexes += 1;
        const idx = parseIndex(bytes);
        if (idx.version !== 2) {
          unknownVersion = true;
          continue;
        }
        packs.push({ idx, file: path.join(dir, `${name.slice(0, -4)}.pack`), open: null, ends: null });
      }
    }
    return packs;
  }

  function packFile(pack) {
    if (pack.open) return pack.open;
    const open = openRegular(pack.file);
    if (open === null) throw cannotRead("corrupt");
    pack.open = open;
    const head = readAt(pack, 0, 12);
    if (head.toString("latin1", 0, 4) !== "PACK") throw cannotRead("corrupt");
    const version = head.readUInt32BE(4);
    if (version !== 2 && version !== 3) throw cannotRead("pack_version");
    if (head.readUInt32BE(8) !== pack.idx.count) throw cannotRead("corrupt");
    return open;
  }

  function readAt(pack, position, length) {
    const buf = Buffer.alloc(length);
    let got;
    try {
      got = fs.readSync(pack.open.fd, buf, 0, length, position);
    } catch {
      throw cannotRead("corrupt");
    }
    return buf.subarray(0, got);
  }

  // Where the entry at `offset` ends: the next entry's start, or the pack's checksum.
  function endOf(pack, offset) {
    if (pack.ends === null) {
      const all = new Float64Array(pack.idx.count);
      for (let i = 0; i < pack.idx.count; i += 1) all[i] = offsetAt(pack.idx, i);
      pack.ends = all.sort();
    }
    const ends = pack.ends;
    let lo = 0;
    let hi = ends.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (ends[mid] <= offset) lo = mid + 1;
      else hi = mid;
    }
    return lo < ends.length ? ends[lo] : pack.open.size - 20;
  }

  // The entry at `offset`: its type, its size once inflated, where its data starts, and its base
  // (an offset for an offset delta, a name for a named-base delta).
  function entryAt(pack, offset) {
    const { size: packSize } = packFile(pack);
    if (offset < 12 || offset >= packSize - 20) throw cannotRead("corrupt");
    const head = readAt(pack, offset, 32);
    let i = 0;
    let b = head[i++];
    const type = (b >> 4) & 7;
    let size = b & 0x0f;
    let shift = 4;
    while (b & 0x80) {
      if (i >= head.length) throw cannotRead("corrupt");
      b = head[i++];
      size += (b & 0x7f) * 2 ** shift;
      shift += 7;
    }
    const entry = { type, size, base: null };
    if (type === OFS_DELTA) {
      if (i >= head.length) throw cannotRead("corrupt");
      b = head[i++];
      let back = b & 0x7f;
      while (b & 0x80) {
        if (i >= head.length) throw cannotRead("corrupt");
        b = head[i++];
        back = (back + 1) * 128 + (b & 0x7f);
      }
      if (back <= 0 || back > offset) throw cannotRead("corrupt");
      entry.base = offset - back;
    } else if (type === REF_DELTA) {
      if (i + 20 > head.length) throw cannotRead("corrupt");
      entry.base = head.toString("hex", i, i + 20);
      i += 20;
    } else if (!TYPES[type]) {
      throw cannotRead("corrupt");
    }
    if (size > LARGEST) throw cannotRead("corrupt");
    const start = offset + i;
    const end = endOf(pack, offset);
    if (end <= start) throw cannotRead("corrupt");
    entry.data = () => inflate(readAt(pack, start, Math.min(end - start, SPAN_FOR(size))), size);
    return entry;
  }

  // The object at `offset` in `pack`, its delta chain followed to its base and applied back up.
  function packed(pack, offset, depth) {
    const chain = [];
    const visited = new Set();
    let at = offset;
    let base = null;
    for (;;) {
      if (visited.has(at) || chain.length > MOST_LINKS) throw cannotRead("corrupt");
      visited.add(at);
      const entry = entryAt(pack, at);
      if (entry.type === OFS_DELTA) {
        seen.ofs += 1;
        chain.push(entry);
        at = entry.base;
        continue;
      }
      if (entry.type === REF_DELTA) {
        seen.ref += 1;
        chain.push(entry);
        const here = positionsOf(pack.idx, entry.base);
        if (here.length === 1) {
          at = offsetAt(pack.idx, here[0]);
          continue;
        }
        base = object(entry.base, depth + 1);
        if (base === null) throw cannotRead(gap || "corrupt");
        break;
      }
      base = { type: TYPES[entry.type], data: entry.data() };
      break;
    }
    seen.deepest = Math.max(seen.deepest, chain.length);
    let data = base.data;
    for (let k = chain.length - 1; k >= 0; k -= 1) data = applyDelta(data, chain[k].data());
    return { type: base.type, data };
  }

  // The object named `sha` (40 hex), checked against its name, or null when no folder holds it.
  function object(sha, depth = 0) {
    if (cache.has(sha)) return cache.get(sha);
    if (depth > MOST_LINKS) throw cannotRead("corrupt");
    let got = null;
    for (const folder of objects) {
      got = readLoose(path.join(folder, sha.slice(0, 2), sha.slice(2)));
      if (got === null) continue;
      seen.loose += 1;
      break;
    }
    if (got === null) {
      for (const pack of loadPacks()) {
        const at = positionsOf(pack.idx, sha);
        if (at.length !== 1) continue;
        got = packed(pack, offsetAt(pack.idx, at[0]), depth);
        seen.packed += 1;
        break;
      }
    }
    if (got === null) {
      if (unknownVersion) throw cannotRead("pack_version");
      return null;
    }
    if (hashOf(got.type, got.data) !== sha) throw cannotRead("corrupt");
    if (got.type !== "blob") cache.set(sha, got);
    return got;
  }

  // Every object name `stamp` (7 to 40 hex) is the start of, across every folder and pack.
  function named(stamp) {
    if (stamp.length === 40) return [stamp];
    const found = new Set();
    for (const folder of objects) {
      for (const name of namesIn(path.join(folder, stamp.slice(0, 2)))) {
        const sha = stamp.slice(0, 2) + name;
        if (/^[0-9a-f]{40}$/u.test(sha) && sha.startsWith(stamp)) found.add(sha);
      }
    }
    for (const pack of loadPacks()) for (const i of positionsOf(pack.idx, stamp)) found.add(nameAt(pack.idx, i));
    return [...found];
  }

  // The tree a stamp names, as git reads `<stamp>:<path>`: a commit's tree, a tag followed to what
  // it tags, a tree itself. A short stamp that starts more than one name is read as git reads it
  // before a colon: the one of them that is a commit, a tag or a tree, and ambiguous when that is
  // not exactly one. Answers { tree } or { problem }; throws a Refusal it cannot read.
  function treeOf(stamp) {
    let candidates = named(stamp);
    if (candidates.length > 1) {
      candidates = candidates.filter((sha) => {
        const o = object(sha);
        return o !== null && o.type !== "blob";
      });
      if (candidates.length !== 1) throw cannotRead("ambiguous");
    }
    if (!candidates.length) {
      if (unknownVersion) throw cannotRead("pack_version");
      if (gap) throw cannotRead(gap);
      return { problem: "names a commit that is not in the desk's history" };
    }
    let sha = candidates[0];
    for (let hops = 0; hops < 100; hops += 1) {
      const o = object(sha);
      if (o === null) {
        if (gap) throw cannotRead(gap);
        if (hops === 0) return { problem: "names a commit that is not in the desk's history" };
        throw cannotRead("corrupt");
      }
      const text = o.type === "blob" ? "" : o.data.toString("latin1");
      if (o.type === "tree") return { tree: sha };
      if (o.type === "blob") return { problem: "names an object that is not a commit" };
      const m = (o.type === "commit" ? /^tree ([0-9a-f]{40})$/mu : /^object ([0-9a-f]{40})$/mu).exec(text);
      if (!m) throw cannotRead("corrupt");
      sha = m[1];
    }
    throw cannotRead("corrupt");
  }

  // The entries of a tree: name to { mode, sha }.
  function entriesOf(sha) {
    const o = object(sha);
    if (o === null) throw cannotRead(gap || "corrupt");
    if (o.type !== "tree") throw cannotRead("corrupt");
    const out = new Map();
    const d = o.data;
    let i = 0;
    while (i < d.length) {
      const space = d.indexOf(0x20, i);
      const nul = d.indexOf(0, space + 1);
      if (space < 0 || nul < 0 || nul + 21 > d.length) throw cannotRead("corrupt");
      out.set(d.toString("utf8", space + 1, nul), { mode: d.toString("latin1", i, space), sha: d.toString("hex", nul + 1, nul + 21) });
      i = nul + 21;
    }
    return out;
  }

  // The bytes of `file` (a path from the work tree's top, with forward slashes, no `.` or `..`)
  // as it was at `stamp`: { bytes } or { problem }, the problem in the words a plain citation's
  // would be said in. Throws a Refusal, with its reason, for what cannot be read.
  // The rules of the attributes file a tree entry names (see rulesOf), each file read once for the
  // run. A true absence is a tree, read and checked against its name, with no .gitattributes
  // entry: then there are no rules. An entry that is there and cannot be read (its object missing
  // or damaged, or it is a link or a folder) is never read as no rules: it is refused.
  const rulesCache = new Map();
  function attributesAt(entry, dir) {
    if (!FILE_MODES.has(entry.mode)) throw cannotRead("corrupt");
    const key = `${entry.sha}:${dir}`;
    if (!rulesCache.has(key)) {
      const o = object(entry.sha);
      if (o === null) throw cannotRead(gap || "corrupt");
      if (o.type !== "blob") throw cannotRead("corrupt");
      rulesCache.set(key, rulesOf(o.data.toString("latin1"), dir));
    }
    return rulesCache.get(key);
  }

  function fileAt(stamp, file) {
    const found = treeOf(stamp);
    if (found.problem) return found;
    let tree = found.tree;
    const parts = file.split("/");
    // The attributes files git would have read for this path when it stored it: each tree's own
    // .gitattributes on the way down, the deeper after the shallower. Read once the path is known
    // to name a file.
    const attributeFiles = [];
    for (let k = 0; k < parts.length; k += 1) {
      const entries = entriesOf(tree);
      const attributes = entries.get(".gitattributes");
      if (attributes) attributeFiles.push([attributes, parts.slice(0, k).join("/")]);
      const entry = entries.get(parts[k]);
      const last = k === parts.length - 1;
      if (!entry) return { problem: "names a file that was not on the desk at that commit" };
      if (entry.mode === "40000") {
        if (last) return { problem: "names a folder, not a file" };
        tree = entry.sha;
        continue;
      }
      // A link, or another repository, on the way or at the end: the history holds its target's
      // name or that repository's commit, not the file's lines.
      if (OTHER_FORMS.has(entry.mode)) throw cannotRead(FORM_REASON.link);
      if (!last) return { problem: "names a file that was not on the desk at that commit" };
      if (!FILE_MODES.has(entry.mode)) throw cannotRead("corrupt");
      const rules = [];
      for (const [attributes, dir] of attributeFiles) rules.push(...attributesAt(attributes, dir));
      // The repository's own info/attributes, above every tree's.
      const own = readRegular(path.join(folders.common, "info", "attributes"));
      if (own !== null) rules.push(...rulesOf(own.toString("latin1"), ""));
      const state = filterState(rules, file);
      if (state === "set") throw cannotRead(FORM_REASON.filter);
      // Rules outside the desk weigh least: only a path no rule inside it decides is theirs.
      if (state === "unspecified" && outsideRules) throw cannotRead("outside_rules");
      const blob = object(entry.sha);
      if (blob === null) throw cannotRead(gap || "corrupt");
      if (blob.type !== "blob") throw cannotRead("corrupt");
      return { bytes: blob.data };
    }
    return { problem: "names a folder, not a file" };
  }

  function close() {
    for (const pack of packs || []) {
      if (pack.open) {
        try {
          fs.closeSync(pack.open.fd);
        } catch {
          // already let go
        }
        pack.open = null;
      }
    }
  }

  return { fileAt, close, seen };
}

module.exports = { REASONS, LARGEST, openHistory, cannotRead };
