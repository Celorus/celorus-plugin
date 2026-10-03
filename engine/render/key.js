"use strict";
// The snapshot key (row DESK-147): one key for this seat on this machine, which seals the record
// a snapshot carries of the desk-log rows it read.
//
// What it closes. A snapshot shows how many rows it read and the minute it was taken. With a plain
// digest of those rows beside them, a page of one row, or two pages one row apart whose earlier
// rows are known, gives that row up to anyone who can guess at it and hold each guess to the
// digest. A digest made with a key the page never shows cannot be held to a guess without the
// key, so the page says nothing of its rows to a reader who holds the page alone.
//
// The key. 32 bytes from the machine's random source, in .celorus/snapshot.key, a file only its
// owner reads (0600). .celorus/ is the seat's own folder: the desk's .gitignore keeps it out of
// git and desk_sync stages nothing under it, so the key is held here and never passed on. It is
// made once, for the seat's first snapshot with no key there, and put only where nothing is: never
// through a link, never over a file. It is written whole to a spare beside its path first and
// given its name by a hard link, so a kill leaves no half-written key there; on a disk with no hard
// links it is written into a file its path is created as, so a kill there can leave a part of a
// key, which the next snapshot refuses as it refuses any key file it cannot read. A key file that cannot be read as a key refuses the
// snapshot and is left as it is; no snapshot is taken unsealed in its place. The file also holds
// the moment the key was made, so a record with no seal taken since then is told from one taken
// before there was a key.
//
// The record. {rows, digest, seal, key_id}: the count of rows; digest, the keyed digest (HMAC with
// SHA-256, RFC 2104) of the page's minute and those rows; seal, the keyed digest of the minute,
// the count, the digest and key_id together; key_id, 16 hex of a labelled SHA-256 of the key,
// which names the key and gives none of it away. SHA-256 is the engine's own (update/digest.js);
// the one thing taken from the crypto built-in, here and in the whole engine, is randomBytes.
//
// Two renders of one desk at once are out of scope under the threat model, as in files.js, and no
// lock is taken. Of two that each make a key, the one that puts its key there second finds the
// first's at the path and is refused, with hard links or without. A render that starts after the
// first's key is there reads it and seals with it. If the first's own write is then refused, the
// first keeps that key when a snapshot page on the desk already carries it, and says so in MINTED.
// A render that has read the key but not yet placed its page is not seen: the first then takes the
// key away, and that render's page is sealed with a key this machine no longer holds, which
// check_reconcile answers as a hole. That is the race left out of scope.

const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");
const { Refusal } = require("../lib/refusal.js");
const { sha256 } = require("../update/digest.js");
const { look, plainFolder, plainFile, readPlain, makeFolder, spareFor } = require("./files.js");

const FOLDER = ".celorus";
const KEY_REL = `${FOLDER}/snapshot.key`;
const KEY_BYTES = 32;
// the desk's zone: the moment a key is made is written as a snapshot's moment is
const IST_MS = (5 * 60 + 30) * 60 * 1000;
// The key file, whole: a line naming it, the key in hex, the moment it was made.
const FILE = /^celorus-snapshot-key 1\n([0-9a-f]{64})\n(\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\+05:30)\n$/;
const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;
const DONE = "Nothing was written.";
// where render_view writes a snapshot's page (index.js, reconcile.js); a page's name is matched
// without regard to case, since a disk that ignores case opens it for check_reconcile by any case;
// `u` folds a letter as such a disk does (a long s is an s)
const VIEWS_REL = "celorus/.views";
const SNAPSHOT_PAGE = /^\d{4}-\d{2}-\d{2}-snapshot-[^/]+\.html$/iu;

// The sentences a person reads, as the founder approved them: his records on the row, comment
// c/5909515963 for every one but NOT_HELD, and c/5911962400 for NOT_HELD as it reads now. Of a
// snapshot whose key this machine does not hold, check_reconcile holds the page's figures and
// words to the page drawn again from as many rows as it read, and that count to the desk log
// (reconcile.js). The rows themselves and the Taken-at clock are held by the keyed digest alone,
// so NOT_HELD says its figures are checked, never its rows or its time.
const MINTED =
  "This machine now holds a snapshot key for this seat, so every snapshot from now on is sealed. The key stays on this machine and is never saved to the desk.";
const NO_KEY = "This snapshot was taken before snapshots were sealed, so it carries no key. Its rows and its time are checked as before.";
const NOT_HELD =
  "This snapshot was sealed with a key this machine does not hold, so its seal cannot be checked. Its figures are still checked, but it does not count as a pass.";
const STRIPPED = "This snapshot has no seal, but it was taken after this seat's key was made, so its seal may have been removed.";
const UNREADABLE = "The snapshot key on this machine cannot be read, so no snapshot was taken. The key file is left as it is.";
// check_reconcile's hole for any snapshot while the key file here cannot be read, approved by the
// base on the row (2026-10-01) as a restatement of the ruled mechanism; its middle sentence is
// NOT_HELD's, c/5911962400, unchanged.
const UNREADABLE_HOLE =
  "The snapshot key on this machine cannot be read, so this snapshot's seal cannot be checked. Its figures are still checked, but it does not count as a pass. The key file is left as it is.";

const BLOCK = 64;
const bytesOf = (hex) => Buffer.from(hex, "hex");

// HMAC with SHA-256 (RFC 2104), in hex: `key` is bytes, `message` text (as UTF-8) or bytes. Its
// test holds it to the vectors of RFC 4231.
function hmacSha256(key, message) {
  const k = key.length > BLOCK ? bytesOf(sha256().update(key).hex()) : key;
  const inner = new Uint8Array(BLOCK).fill(0x36);
  const outer = new Uint8Array(BLOCK).fill(0x5c);
  for (let i = 0; i < k.length; i += 1) {
    inner[i] ^= k[i];
    outer[i] ^= k[i];
  }
  const first = bytesOf(sha256().update(inner).update(message).hex());
  return sha256().update(outer).update(first).hex();
}

// The name a record gives its key: 16 hex of a labelled digest of it, never a part of the key.
function keyId(key) {
  return sha256().update("celorus snapshot key id 1\n").update(key).hex().slice(0, 16);
}

// The keyed digest of a record's text: the page's minute and the rows it read (counts.js
// recordDigest).
function keyedDigest(key, text) {
  return hmacSha256(key, `celorus snapshot rows 1\n${text}`);
}

// A record {rows, digest} sealed with the key, at the page's moment: the same two, the seal over
// the minute, the count, the digest and the key's id together, and that id.
function sealed(key, moment, record) {
  const id = keyId(key);
  const seal = hmacSha256(key, ["celorus snapshot record 1", String(moment).slice(0, 16), String(record.rows), record.digest, id].join("\n"));
  return { rows: record.rows, digest: record.digest, seal, key_id: id };
}

function at(root, rel) {
  return path.join(root, ...rel.split("/"));
}

// An error named by its code only, as files.js names one: its text can quote a path from this
// machine, so it never rides a refusal.
function codeOf(err) {
  return err && typeof err.code === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(err.code) ? err.code : "an error with no code";
}

// The key this machine holds for the desk at `root` (the desk folder as the disk resolves it):
// {key, id, made}, or null when no key file is there. A key file that is a link, is no plain
// file, cannot be opened or does not read as a key is refused in the approved words and left as
// it is. A .celorus that is itself a link or no folder is refused in files.js's own words.
function load(root) {
  if (!plainFolder(root, FOLDER)) return null;
  let text;
  try {
    if (!plainFile(root, KEY_REL)) return null;
    text = readPlain(root, KEY_REL);
  } catch (err) {
    if (err instanceof Refusal) throw new Refusal(UNREADABLE);
    throw err;
  }
  const m = FILE.exec(text);
  if (!m) throw new Refusal(UNREADABLE);
  const key = bytesOf(m[1]);
  return { key, id: keyId(key), made: m[2] };
}

// The key this machine holds, for a check that writes nothing: {key, id, made}; null only when no
// key file is there; and {unreadable: true} when one is there and cannot be read as a key, or the
// folder it sits in is refused. An unreadable key is never read as no key: a snapshot with no seal
// could then pass as one taken before the key was made. check_reconcile says what it cannot check,
// and never makes a key.
function held(root) {
  try {
    return load(root);
  } catch (err) {
    if (err instanceof Refusal) return { unreadable: true };
    throw err;
  }
}

function taken() {
  return new Refusal(`${KEY_REL} is already there, so render_view did not put its own file in its place: the one there stays. Look at it and render again. ${DONE}`);
}

function failed(doing, err) {
  return new Refusal(`render_view could not ${doing} ${KEY_REL} (${codeOf(err)}). Look at that file and its folder, and render again. ${DONE}`);
}

// Puts a new key at its path, and answers how to take it away again. The folder is made a plain
// folder (files.js makeFolder); the key is written whole to a spare beside its path, opened
// O_CREAT|O_EXCL|O_NOFOLLOW at 0600 so nothing already there, a link included, is written through
// and no one else reads it, fsynced, and then given the key's name by a hard link, which the disk
// makes only where nothing holds that name. On a disk with no hard links the key's path itself is
// created the same exclusive way and the key written into it and fsynced: the create makes the
// file or refuses whatever is there, so a key put there meanwhile is never replaced, and a rename,
// which would replace it, is never used. From the moment a key file this render made is at its
// path (the link, or the create) until place answers, any failure takes that file away while it is
// still the one this render made (the same device and inode; before the created file's inode is
// known, while it is an empty plain file), and is refused in failed's words when it is no refusal
// of its own; the spare and any folder made here are taken away too, so
// nothing was written. The answer takes the key away only while the file at its path is still the
// one put there, and says whether it is gone.
function place(root, key, made) {
  const folders = [];
  const spare = spareFor(KEY_REL);
  const text = `celorus-snapshot-key 1\n${key.toString("hex")}\n${made}\n`;
  const gone = (rel) => {
    try {
      fs.unlinkSync(at(root, rel));
    } catch {
      // not there
    }
  };
  const unmade = () => {
    for (const f of [...folders].reverse()) {
      try {
        fs.rmdirSync(at(root, f.rel));
      } catch {
        // it holds something, or is gone
      }
    }
  };
  // the key file this render made at its path, by device and inode, once it is there
  let put = null;
  let linked = false;
  // set once this render has created the key's path on a disk with no hard links: until its fstat
  // answers, the file there is known only as the empty one this render just made
  let created = false;
  // takes it away while the file at its path is still that one
  const mineGone = () => {
    try {
      const there = fs.lstatSync(at(root, KEY_REL));
      if (there.dev === put.dev && there.ino === put.ino) fs.unlinkSync(at(root, KEY_REL));
    } catch {
      // nothing there that is this file
    }
  };
  // the file this render created at the key's path before it knew its inode: taken away only while
  // it is an empty plain file, which a whole key never is
  const emptyGone = () => {
    try {
      const there = fs.lstatSync(at(root, KEY_REL));
      if (there.isFile() && there.size === 0) fs.unlinkSync(at(root, KEY_REL));
    } catch {
      // nothing there, or nothing that can be told
    }
  };
  try {
    makeFolder(root, FOLDER, folders);
    let fd;
    try {
      fd = fs.openSync(at(root, spare), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
    } catch (err) {
      throw new Refusal(`render_view could not create a spare file beside ${KEY_REL} (${codeOf(err)}). Look at the folder it goes in, and render again. ${DONE}`);
    }
    let spareIs;
    try {
      fs.writeFileSync(fd, text, "utf8");
      fs.fsyncSync(fd);
      spareIs = fs.fstatSync(fd);
    } catch (err) {
      throw failed("write", err);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.linkSync(at(root, spare), at(root, KEY_REL));
      linked = true;
    } catch (err) {
      if (err.code === "EEXIST") throw taken();
    }
    if (linked) {
      // the link is the spare's own inode under the key's name
      put = spareIs;
    } else {
      let kfd;
      try {
        kfd = fs.openSync(at(root, KEY_REL), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
        created = true;
      } catch (opened) {
        if (opened.code === "EEXIST") throw taken();
        throw failed("put in place", opened);
      }
      try {
        put = fs.fstatSync(kfd);
        fs.writeFileSync(kfd, text, "utf8");
        fs.fsyncSync(kfd);
      } finally {
        fs.closeSync(kfd);
      }
    }
    // the file at the key's path is the one this render made
    const there = fs.lstatSync(at(root, KEY_REL));
    if (there.dev !== put.dev || there.ino !== put.ino) throw taken();
  } catch (err) {
    if (put !== null) mineGone();
    else if (created) emptyGone();
    gone(spare);
    unmade();
    throw (put !== null || created) && !(err instanceof Refusal) ? failed("put in place", err) : err;
  }
  gone(spare);
  return () => {
    mineGone();
    unmade();
    try {
      return look(root, KEY_REL) === null;
    } catch {
      return false;
    }
  };
}

// the record of the desk-log rows a snapshot read at its moment (round 5, row A13), as
// check_reconcile reads it
const READ = /<script type="application\/json" id="rows-read">([^<]*)<\/script>/;
const DIGEST = /^[0-9a-f]{64}$/;
const KEY_ID = /^[0-9a-f]{16}$/;

// The record a snapshot carries of the desk-log rows it read, {rows, digest}: how many, and one
// digest over them and the page's moment (base ruling R56). A sealed record (DESK-147) carries its
// seal and the id of the key that sealed it as well, {rows, digest, seal, key_id}. Null when it
// carries none that reads as one, as a page taken before the record held a count and a digest
// does, and as a record with a seal or a key's id that does not read as one does.
function recordOf(html) {
  const m = READ.exec(html);
  if (!m) return null;
  let got;
  try {
    got = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const ok = got && typeof got === "object" && Number.isSafeInteger(got.rows) && got.rows >= 0 && typeof got.digest === "string" && DIGEST.test(got.digest);
  if (!ok) return null;
  if (got.seal === undefined && got.key_id === undefined) return { rows: got.rows, digest: got.digest };
  const sealed = typeof got.seal === "string" && DIGEST.test(got.seal) && typeof got.key_id === "string" && KEY_ID.test(got.key_id);
  return sealed ? { rows: got.rows, digest: got.digest, seal: got.seal, key_id: got.key_id } : null;
}

// Whether a snapshot page on the desk at `root` may carry the key named `id`. The pages looked at
// are the ones check_reconcile reads: render_view writes a sealed record only into a snapshot's
// page, only at celorus/.views/<day>-snapshot-<key>.html, and check_reconcile reads it only from
// there, through plain folders, from a plain file, with recordOf. So a celorus or views folder that
// is absent, a link or no folder, an entry that is a link, a folder or anything but a plain file,
// and a page whose record recordOf does not read or that carries no key's id are skipped: none is
// a page check_reconcile holds to this key. A plain page, or either folder, that cannot be read
// may carry it, and answers true, so a key is never taken away on a guess. A page's name is
// matched without regard to case, as a disk that ignores case opens it for check_reconcile.
function carried(root, id) {
  for (const rel of ["celorus", VIEWS_REL]) {
    // files.js plainFolder's own test, without its refusal: a folder that cannot be looked at may
    // hold a page carrying the key; one that is absent, a link or no folder holds none
    let st;
    try {
      st = look(root, rel);
    } catch {
      return true;
    }
    if (st === null || !st.isDirectory()) return false;
  }
  let names;
  try {
    names = fs.readdirSync(at(root, VIEWS_REL));
  } catch {
    return true;
  }
  for (const name of names) {
    if (!SNAPSHOT_PAGE.test(name)) continue;
    const rel = `${VIEWS_REL}/${name}`;
    let text;
    try {
      // files.js plainFile's own test, without its refusal: the lstat of a link or of anything but
      // a plain file is no file, and is skipped
      const st = look(root, rel);
      if (st === null || !st.isFile()) continue;
      text = readPlain(root, rel);
    } catch {
      return true;
    }
    const record = recordOf(text);
    if (record !== null && record.key_id === id) return true;
  }
  return false;
}

// The key a snapshot of the desk at `root` is sealed with: {key, id, made, minted, around}. The
// key the machine holds, or, when it holds none, a new one. A new key is on no disk yet: it is put
// at its path by `around(write)`, straight before the snapshot's own files are written by `write`,
// so a render refused before then has written nothing, as it says. When `write` refuses, the new
// key stays when it may have sealed something on the disk: when `write` placed a file (its
// refusal's `written`, files.js writeAll), or when a snapshot page on the desk carries its id
// (carried: another render read this key from its path meanwhile and sealed its page with it).
// Then the refusal is write's own words and then MINTED, with `written` still on it. Otherwise the
// key sealed nothing on the disk and is taken away again; when it cannot be, the refusal says the
// machine holds it. `minted` is true for a new key, and the render that made it says so once, in
// MINTED: in its answer, or in its refusal when the key outlives it.
function forSnapshot(root, now = Date.now()) {
  const there = load(root);
  if (there) return { ...there, minted: false, around: (write) => write() };
  const key = randomBytes(KEY_BYTES);
  const id = keyId(key);
  const made = `${new Date(now + IST_MS).toISOString().slice(0, 19)}+05:30`;
  const around = (write) => {
    const undo = place(root, key, made);
    try {
      return write();
    } catch (err) {
      const placed = err instanceof Refusal && Array.isArray(err.written) && err.written.length > 0;
      if (placed || carried(root, id)) {
        if (!(err instanceof Refusal)) throw err;
        const kept = new Refusal(`${err.message} ${MINTED}`);
        kept.written = Array.isArray(err.written) ? err.written : [];
        throw kept;
      }
      if (!undo() && err instanceof Refusal) throw new Refusal(`${err.message} ${MINTED}`);
      throw err;
    }
  };
  return { key, id, made, minted: true, around };
}

module.exports = { KEY_REL, MINTED, NO_KEY, NOT_HELD, STRIPPED, UNREADABLE, UNREADABLE_HOLE, hmacSha256, keyId, keyedDigest, sealed, held, recordOf, forSnapshot };
