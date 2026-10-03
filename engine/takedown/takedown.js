"use strict";
// take_down: what a person removes to take a desk out, in order and where, and what stays
// because it is the firm's. It removes nothing and writes nothing: a person removes what a
// person created. It reads the desk's systems table and its set-up record (scaffold/systems.js)
// from celorus/desk.md, and looks, without changing anything, at whether this machine's seat
// pointer is there and what else the pointer folder holds. The order: one line for each
// connection made after the set-up (the systems table is the set-up's record, and the update
// changes only a row's state, to none on this desk), then each row naming a connector, whatever
// its state, in reverse, disconnected in the harness's own settings; the seat pointer, and
// its folder when the set-up made it and nothing else is in it; the plugin; and last the desk
// folder, only when the set-up record reads whole and says the set-up made it, and its .gitignore
// is gone or holds nothing of the firm's (what else is in the folder stays, named, to move out
// first), else what the desk put in it: the folder celorus, its scratch folder .celorus, and its
// lines in the file .gitignore, the file itself only when the record says the set-up made it and,
// once the desk's lines and every blank line are taken out, nothing is left in it; otherwise the
// firm's lines stay, each named as the file holds it, and the folder stays. Every step passes one
// guard before it names a path for removal or edit (`look`): what stands there is looked at, never
// followed, and a link of any kind, a file with another name (a hard link), or a path not of the
// kind the step expects is never named: it stays, left alone, in words that say what stands there.
// A set-up-made .gitignore that is not UTF-8 text is not named either, nor any line in it. A named
// path carries no trailing slash, which a delete would follow through a link that stands there by
// the time the list is followed. Every path is said desk-relative, or home-relative for the seat
// pointer.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readPage, NO_HEADER } = require("../lib/desk.js");
const { readOwn } = require("../update/history.js");
const S = require("../scaffold/systems.js");

const HISTORY =
  "The desk's own history stays: it is the firm's. Where the desk is kept in a repository, that " +
  "repository is the firm's, and taking the desk down never deletes it; keep it, or a copy of " +
  "the desk folder, before the folder is deleted.";

const LATER =
  "Disconnect, in the harness's own settings, each connection made for the desk after the " +
  "set-up, the transcript tool among them: the systems table records the connections as they " +
  "were when the desk was set up.";

// The desk's desk.md, read: its desk id, and both tables (null where it holds none), or why
// it could not be read.
function readSetUp(desk, shape = S.shapes()) {
  const page = readPage(path.join(desk, "celorus"), "desk.md");
  if (page.problem && page.problem !== NO_HEADER) {
    return { problem: `celorus/desk.md: ${page.problem}${page.why ? ` (${page.why})` : ""}`, deskId: null, systems: null, record: null };
  }
  const id = page.head && typeof page.head.desk_id === "string" && /^[a-z0-9-]+$/u.test(page.head.desk_id) ? page.head.desk_id : null;
  const tables = S.readTables(page.body || "", shape);
  return { problem: page.problem ? "celorus/desk.md: no header" : null, deskId: id, ...tables };
}

// The one guard every step passes through before it names a path for removal or edit: what stands
// at `full`, looked at with lstat and never followed. `absent` where nothing stands there; `ok`
// where it is the kind the step expects (`kind`, "file" or "folder"), is no link, and, a file, has
// no other name; else `other`, with what does stand there (`is`), in words, read from the look.
function look(full, kind) {
  let st;
  try {
    st = fs.lstatSync(full);
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) return { at: "absent" };
    return { at: "other", is: "something that cannot be looked at" };
  }
  if (st.isSymbolicLink()) return { at: "other", is: "a link" };
  if (st.isDirectory()) return kind === "folder" ? { at: "ok" } : { at: "other", is: "a folder" };
  if (!st.isFile()) return { at: "other", is: "neither a file nor a folder" };
  if (kind === "folder") return { at: "other", is: "a file" };
  return st.nlink > 1 ? { at: "other", is: "a file with another name elsewhere (a hard link)" } : { at: "ok" };
}

// What a step says instead of naming a path the guard turned away: it stays, left alone.
function leftAlone(rel, kind, seen) {
  return `What stands at ${rel} stays, left alone: it is not the ${kind} the set-up made, but ${seen.is}.`;
}

// What the desk puts in its folder: its celorus folder, its hidden scratch beside it (the
// workday skills write it), and its .gitignore.
const DESK_OWN = Object.freeze(["celorus", ".celorus", ".gitignore"]);

// The entries of the desk folder the desk did not make, by name, sorted; null when the folder
// cannot be listed.
function notTheDesks(desk) {
  try {
    return fs
      .readdirSync(desk)
      .filter((name) => !DESK_OWN.includes(name))
      .sort();
  } catch {
    return null;
  }
}

function listed(items) {
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const UTF8 = new TextDecoder("utf-8", { fatal: true });

// What the desk folder's .gitignore holds, read by its bytes through the engine's listed reader
// (history.js readOwn, never through a link), a byte order mark no part of its first line, each
// line matched with either line ending: `gone` where there is no file; `unread` where it is not a
// plain file or is not UTF-8 text; else the desk's `lines` it holds (each taken once), its blank
// lines, and every other line (`others`), each as the file holds it but for its line end.
function heldIn(desk, lines) {
  const file = path.join(desk, ".gitignore");
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    return err && err.code === "ENOENT" ? { gone: true } : { unread: true };
  }
  if (!st.isFile()) return { unread: true };
  let text;
  try {
    text = UTF8.decode(readOwn(file));
  } catch {
    return { unread: true };
  }
  const rows = text.split("\n").map((row) => row.replace(/\r$/u, ""));
  if (rows.at(-1) === "") rows.pop();
  const left = [...lines];
  const held = { gone: false, unread: false, desks: [], blanks: [], others: [] };
  for (const row of rows) {
    const at = left.indexOf(row);
    if (at !== -1) {
      left.splice(at, 1);
      held.desks.push(row);
    } else if (row.trim() === "") held.blanks.push(row);
    else held.others.push(row);
  }
  return held;
}

// What this machine's home holds for the pointer at `rel` (home-relative): what stands at the
// pointer and at its folder, through the guard, and the other entries in its folder. Looked at,
// never opened or changed.
function onThisMachine(rel) {
  let home = "";
  try {
    home = os.homedir();
  } catch {
    home = "";
  }
  if (!home) return { known: false, pointer: { at: "absent" }, folder: { at: "absent" }, others: [] };
  const file = path.join(home, ...rel.slice(2).split("/"));
  const folder = look(path.dirname(file), "folder");
  let pointer = look(file, "file");
  // A pointer reached through a folder the guard turns away would be deleted through it: never named.
  if (folder.at === "other" && pointer.at !== "absent") {
    pointer = { at: "other", is: `what is reached through ${rel.slice(0, rel.lastIndexOf("/"))}, which is ${folder.is}` };
  }
  let others = [];
  try {
    others = fs.readdirSync(path.dirname(file)).filter((name) => name !== path.basename(file));
  } catch {
    others = [];
  }
  return { known: true, pointer, folder, others };
}

function takeDown(desk) {
  const shape = S.shapes();
  const read = readSetUp(desk, shape);
  const unread = [];
  if (read.problem) unread.push({ row: "celorus/desk.md", why: read.problem.slice("celorus/desk.md: ".length) });
  for (const table of [read.systems, read.record]) if (table) unread.push(...table.unread);
  const systems = read.systems ? read.systems.rows : [];
  const record = read.record ? read.record.rows : [];
  const steps = [];
  const stays = [];
  const add = (step) => steps.push({ step: steps.length + 1, ...step });

  // The connections. The systems table is what the set-up recorded, and the update changes only a
  // row's state, to none on this desk, so first one line, always, for a connection made after the
  // set-up; then each row that names a connector, whatever its state, the table's rows in reverse.
  add({
    remove: "connection",
    role: null,
    connector: null,
    path: null,
    where: "in the harness's own settings",
    say: LATER,
  });
  for (const r of [...systems].reverse()) {
    if (r.connector === null) continue;
    add({
      remove: "connection",
      role: r.role,
      connector: r.connector,
      recorded: r.state,
      path: null,
      where: "in the harness's own settings, where it was connected",
      say:
        r.state === S.CONNECTED
          ? `Disconnect ${r.connector}, the desk's ${r.role} connection, in the harness's own settings, where it was connected.`
          : `Disconnect ${r.connector}, the desk's ${r.role} connection, in the harness's own settings, where it is connected: the set-up recorded it still to connect, and it may have been connected since.`,
    });
  }
  const notConnected = systems.filter((r) => r.state === S.STILL).map((r) => r.role);

  // The seat pointer: the recorded one, or where the set-up puts it for this desk's id.
  const recorded = record.find((r) => S.POINTER.test(r.path));
  const pointer = recorded ? recorded.path : read.deskId ? `~/.celorus/seat-${read.deskId}` : null;
  if (pointer) {
    const here = onThisMachine(pointer);
    const elsewhere = " Every other machine that holds a seat of this desk has its own, at the same place, deleted there.";
    if (here.pointer.at === "other") {
      stays.push({ what: pointer, say: leftAlone(pointer, "file", here.pointer) + elsewhere });
    } else {
      const present = here.pointer.at === "ok";
      add({
        remove: "file",
        path: pointer,
        present,
        where: "in this machine's home folder",
        say:
          (present
            ? `Delete the file ${pointer}, the seat pointer, on this machine, by hand.`
            : `The seat pointer ${pointer} is not on this machine; there is nothing to delete here.`) + elsewhere,
      });
    }
    if (record.some((r) => r.path === S.POINTER_FOLDER)) {
      // Said without the record's trailing slash, which a delete would follow through a link.
      const folder = S.POINTER_FOLDER.replace(/\/$/u, "");
      if (here.folder.at === "other") {
        stays.push({ what: folder, say: leftAlone(folder, "folder", here.folder) });
      } else if (here.known && here.others.length === 0 && here.pointer.at !== "other") {
        add({
          remove: "folder",
          path: folder,
          where: "in this machine's home folder",
          say: `Delete the folder ${folder}, which the set-up made and which then holds nothing else.`,
        });
      } else {
        stays.push({
          what: folder,
          say: `The folder ${folder} stays: it holds more than this desk's pointer.`,
        });
      }
    }
  } else {
    unread.push({ row: "celorus/desk.md", why: "it records no seat pointer and holds no desk_id, so the pointer cannot be named" });
  }

  add({
    remove: "plugin",
    path: null,
    where: "in the harness where it was installed",
    say: "Uninstall the plugin in the harness where it was installed, once no other desk on this machine uses it.",
  });

  // The desk folder, last. The folder itself only when the set-up record reads whole, holds its
  // `.` row, and the .gitignore is gone or holds nothing of the firm's; then every entry in it the
  // desk did not make stays, named, to move out first. Otherwise the folder stays, and the list
  // names what the desk put in it.
  const recordWhole = read.record !== null && read.record.unread.length === 0;
  // Whether any record row reads: rows are read one by one, and every row that reads counts.
  const recordReads = record.length > 0;
  const has = (at) => record.some((r) => r.path === at);
  // The .gitignore lines that are the desk's, in the scaffold's order: every line where the set-up
  // made the file (its mark, or, in a record written before the mark was, its `.` row: a folder
  // the set-up made held no .gitignore), or where the record names the file as the first set-ups
  // wrote it; else those the record's line rows name. Only when no record row reads at all is
  // every line named, in words that say the record does not show whether the set-up added them,
  // and never with a delete. A record row naming the file is never read as the mark.
  const marked = has(S.IGNORE_MADE) || has(".");
  const named = new Set(record.filter((r) => r.path.startsWith(S.LINE_AT)).map((r) => r.path.slice(S.LINE_AT.length)));
  const lines = shape.gitignore.filter((line) => !recordReads || marked || has(".gitignore") || named.has(line));
  const lineBreak = has(S.LINE_BREAK_AT);
  // What stands at the desk folder and at its .gitignore, through the guard, marked or not: a link,
  // a file with another name, or the other kind is never named, nor a line in it.
  const deskAt = look(desk, "folder");
  const ignoreAt = look(path.join(desk, ".gitignore"), "file");
  // Where the set-up made the file: what it holds now, read from the file. It goes when, the desk's
  // lines and every blank line taken out, nothing is left in it; any other line is the firm's.
  const held = marked && ignoreAt.at !== "other" ? heldIn(desk, lines) : null;
  const goes = held !== null && !held.unread && (held.gone || held.others.length === 0);
  if (deskAt.at === "other") {
    // What stands at the desk folder's own path is not a folder: every desk path would be followed
    // through it, so none is named.
    stays.push({
      what: ".",
      say: `What stands at the desk folder's path stays, left alone: it is not a folder, but ${deskAt.is}, so nothing in it is named.`,
    });
  } else if (recordWhole && has(".") && goes) {
    const others = notTheDesks(desk);
    if (others === null) unread.push({ row: ".", why: "the desk folder cannot be listed, so what the desk did not make in it is found by hand" });
    for (const name of others || []) {
      stays.push({
        what: name,
        say: `${name} in the desk folder was not made by the desk: move it out of the desk folder before the folder is deleted.`,
      });
    }
    add({
      remove: "folder",
      path: ".",
      where: "the desk folder, the one holding the folder celorus",
      say:
        "Delete the desk folder, by hand, last, once the firm keeps the desk's history" +
        (others === null || others.length ? ", and once what the desk did not make, named in what stays, is moved out of it." : "."),
    });
  } else {
    const pages = look(path.join(desk, "celorus"), "folder");
    if (pages.at === "other") stays.push({ what: "celorus", say: leftAlone("celorus", "folder", pages) });
    else {
      add({
        remove: "folder",
        path: "celorus",
        where: "in the desk folder",
        say: "Delete the folder celorus from the desk folder, by hand, once the firm keeps the desk's history.",
      });
    }
    const scratch = look(path.join(desk, ".celorus"), "folder");
    if (scratch.at === "other") stays.push({ what: ".celorus", say: leftAlone(".celorus", "folder", scratch) });
    else if (scratch.at === "ok") {
      add({
        remove: "folder",
        path: ".celorus",
        where: "in the desk folder",
        say: "Delete the folder .celorus from the desk folder, by hand: the desk's scratch, which its skills write and which may be deleted at any time. Deleting it also deletes this seat's snapshot key, and snapshots taken before then can no longer be checked.",
      });
    }
    // The file itself is named only where the set-up made it, and only when nothing of the
    // firm's is in it. Without that the file stays, the desk's lines named, with the line break
    // the set-up added above them where the record names it; where the set-up made it, each line
    // of the firm's in it is named in stays, as the file holds it.
    if (ignoreAt.at === "other") {
      stays.push({ what: ".gitignore", say: leftAlone(".gitignore", "file", ignoreAt) });
    } else if (goes && !held.gone) {
      const holds = [
        ...(held.desks.length ? [held.desks.length === 1 ? "the desk's line" : "the desk's lines"] : []),
        ...(held.blanks.length ? ["blank lines"] : []),
      ];
      add({
        remove: "file",
        path: ".gitignore",
        where: "in the desk folder",
        say: `Delete the file .gitignore from the desk folder, by hand, last: the set-up made it, and ${holds.length ? `it holds only ${holds.join(" and ")}` : "it is empty"}.`,
      });
    } else if (held && held.unread) {
      // The file the set-up made is a plain file with one name, but it cannot be read as UTF-8
      // text: no step names it or a line in it, and it stays, left alone.
      stays.push({
        what: ".gitignore",
        say: "The file .gitignore in the desk folder stays, left alone: it cannot be read as UTF-8 text, so nothing in it is named.",
      });
    } else if (lines.length && ignoreAt.at === "ok") {
      const them = lines.length === 1 ? `the desk's line ${lines[0]}` : `the desk's lines ${listed(lines)}`;
      add({
        remove: "lines",
        path: ".gitignore",
        lines,
        line_break: lineBreak,
        where: "in the desk folder",
        say: !recordReads
          ? `Remove ${them} from the file .gitignore in the desk folder, where it holds them, by hand, last: the record does not show whether the set-up added them, so keep any the firm had before the set-up. The file itself stays.`
          : `Remove ${them} from the file .gitignore in the desk folder, where it holds them` +
            (lineBreak ? ", and, when nothing follows them, the line break at the end of the line just above them, which the set-up added," : ",") +
            " by hand, last; the file itself stays.",
      });
      if (held && held.others.length) {
        const n = held.others.length;
        stays.push({
          what: ".gitignore",
          lines: held.others,
          say: `The rest of the file .gitignore stays: the set-up made the file, but it now holds ${n === 1 ? "the line" : "the lines"} ${listed(held.others)}, which the desk did not add.`,
        });
      }
    }
    stays.push({
      what: ".",
      say: has("celorus/")
        ? "The desk folder itself stays: it was there before the set-up."
        : !has(".")
          ? "The desk folder itself stays: whether the set-up made it is not recorded."
          : !recordWhole
            ? "The desk folder itself stays: the record says the set-up made it, but a row of the record could not be read."
            : `The desk folder itself stays: the set-up made it, but ${ignoreAt.at === "other" ? "what stands at its .gitignore is not the file the set-up made" : held && held.unread ? "its .gitignore cannot be read as UTF-8 text" : "its .gitignore holds lines the desk did not add"}, named in what stays.`,
    });
  }
  stays.push({ what: "the desk's own history", say: HISTORY });

  const noTable = read.systems === null ? " This desk records no systems table, so its connections are found in the harness's own settings." : "";
  const noRecord =
    read.record === null ? " This desk records no set-up record, so the list names what the desk puts in its folder, and the folder itself stays." : "";
  const odd = unread.length ? ` ${unread.length === 1 ? "One row" : `${unread.length} rows`} could not be read; each is named in unread.` : "";
  return {
    desk_id: read.deskId,
    systems,
    not_connected: notConnected,
    made: record,
    steps,
    stays,
    unread,
    summary:
      `${steps.length} steps, in this order, each done by hand; nothing was removed.${noTable}${noRecord}${odd}`,
  };
}

// The tables as scaffold_desk reads them back after writing: the rows it wrote, as take_down
// reads them.
function readBack(desk) {
  const read = readSetUp(desk);
  if (read.problem || !read.systems || !read.record || read.systems.unread.length || read.record.unread.length) {
    throw new Error("the set-up's own tables did not read back");
  }
  return { systems: read.systems.rows, made: read.record.rows };
}

module.exports = { takeDown, readBack, readSetUp, HISTORY };
