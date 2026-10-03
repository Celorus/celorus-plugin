"use strict";
// scaffold_desk: sets a new desk up. It writes the whole scaffold install-desk/scaffold.md
// shows, read the way the update reads it, with the install's answers filled in: every page
// template, the model pages byte for byte, the empty folders, the Obsidian settings, then the
// systems table and the set-up record at the end of celorus/desk.md, and last the seat pointer
// in the home folder. It never writes into an existing desk or over a file: everything it
// would refuse is refused before the first write, with nothing written, and every file is
// made new (a file or a link already at a path stops the write there, never followed), but for
// a .gitignore already in the desk folder, to which it adds only the scaffold's lines the file
// lacks, and whose record names those lines and any line break added before them, never the
// file; the record marks a .gitignore as made whenever the set-up made it, in a folder it made
// too, and names its lines. Its answer names every path
// desk-relative, and the seat pointer home-relative.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { isDesk, readPage } = require("../lib/desk.js");
const { obsidianBlocks, PLUGIN_MODEL } = require("../update/update.js");
const H = require("../update/history.js");
const { hasLink } = require("../check/text.js");
const S = require("./systems.js");
const { soulCopy } = require("../soul/pages.js");
const { pluginVersion } = require("../lib/version.js");

const PLUGIN = path.resolve(__dirname, "..", "..");
const NOTHING = "Nothing was written.";

// The seat's role, where its book lives, and the other answers' shapes.
const SEAT_ROLES = Object.freeze(["rep", "rm", "desk-head", "operator", "other"]);
const BOOK_SOURCES = Object.freeze(["crm-export", "sheet", "typed"]);
const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PACK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PLACEHOLDER = /\{\{[a-z_]+\}\}/u;
const FOLDER = /`(celorus\/[^`]*\/)`/gu;
// The seat file's connector switches, and the role each one reads in the systems table.
const SWITCHES = Object.freeze({ mail: "mail", calendar: "calendar", drive: "files" });

// ---- the scaffold, as the update reads it ----

// Every `## <backticked path>` heading in the scaffold, mapped to the fenced block below it
// (systems.js, where take_down reads the .gitignore lines from the same block).
const { templates } = S;

// The empty folders the scaffold names, in the order it names them.
function emptyFolders(text) {
  const at = text.indexOf("## The empty folders");
  if (at === -1) throw new Error("the scaffold no longer names its empty folders");
  const part = text.slice(at + "## The empty folders".length).split("\n## ")[0];
  return [...new Set([...part.matchAll(FOLDER)].map((m) => m[1]))];
}

function fill(template, values) {
  let text = template;
  for (const [key, value] of Object.entries(values)) text = text.split(`{{${key}}}`).join(value);
  const left = PLACEHOLDER.exec(text);
  if (left) throw new Error(`the template needs ${left[0]}, which the set-up does not have`);
  return text;
}

// The model version the plugin's own model/model.md carries.
function modelVersion() {
  const page = readPage(PLUGIN_MODEL, "model.md");
  const version = page.head ? page.head.model_version : undefined;
  if (!Number.isInteger(version)) throw new Error("the plugin's model/model.md carries no model_version");
  return String(version);
}

// The model pages the scaffold copies: every page in the plugin's model/ but the change notes.
function modelPages() {
  return fs
    .readdirSync(PLUGIN_MODEL)
    .filter((name) => name.endsWith(".md") && !/^changes-v[0-9]+\.md$/u.test(name))
    .sort();
}

// ---- the answers, each checked before anything is written ----

function refuse(message) {
  throw new Refusal(`${message} ${NOTHING}`);
}

function text(value, name, what) {
  if (typeof value !== "string" || value.trim() === "") refuse(`\`${name}\` is ${what}, as text.`);
  return value;
}

// Whether `value` holds a control character or a line break of any kind.
function hasControl(value) {
  return [...value].some((ch) => {
    const code = ch.codePointAt(0);
    return code < 32 || (code >= 127 && code < 160) || code === 8232 || code === 8233;
  });
}

// The desk's name: one line, no control character, as the person says it.
function deskName(value) {
  text(value, "name", "the desk's name");
  if (value !== value.trim()) refuse("`name` has blank space around it; give the desk's name as it is said.");
  if (hasControl(value)) refuse("`name` is one line of text, with no line break or control character.");
  if (value.length > 100) refuse("`name` is at most 100 characters.");
  return value;
}

function seatOf(seat, i, seen) {
  const at = `seats[${i}]`;
  if (seat === null || typeof seat !== "object" || Array.isArray(seat)) {
    refuse(`${at} is an object: handle, role, book_source and baseline_minutes.`);
  }
  const keys = ["handle", "role", "book_source", "baseline_minutes"];
  const extra = Object.keys(seat).filter((key) => !keys.includes(key));
  if (extra.length) refuse(`${at} does not take ${extra.join(", ")}. It takes: ${keys.join(", ")}.`);
  const { handle, role, book_source: book, baseline_minutes: minutes } = seat;
  if (typeof handle !== "string" || !HANDLE.test(handle) || handle.length > 40) {
    refuse(`${at}.handle is the seat's short name, lowercase letters and digits with single hyphens between them, at most 40 characters (it names the seat's file).`);
  }
  if (seen.has(handle)) refuse(`${at}.handle ${JSON.stringify(handle)} names a seat twice; each seat has its own handle.`);
  seen.add(handle);
  if (!SEAT_ROLES.includes(role)) refuse(`${at}.role is one of: ${SEAT_ROLES.join(", ")}.`);
  if (!BOOK_SOURCES.includes(book)) refuse(`${at}.book_source is one of: ${BOOK_SOURCES.join(", ")}.`);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    refuse(`${at}.baseline_minutes is how long researching one lead takes today, in whole minutes, from 1 to 600.`);
  }
  return { handle, role, book, minutes: String(minutes) };
}

function seatsOf(seats) {
  if (!Array.isArray(seats) || !seats.length) {
    refuse("`seats` is a list of one or more seats, this machine's seat first, each { handle, role, book_source, baseline_minutes }.");
  }
  const seen = new Set();
  return seats.map((seat, i) => seatOf(seat, i, seen));
}

// A connector's name as the harness shows it: one line, and nothing a table cell cannot hold.
function connectorOf(value, at) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    refuse(`${at}.connector is the connector's name as the harness shows it, as text with no blank space around it, or left out where it shows none.`);
  }
  const cellBreaker = value.includes("|") || value.includes("`") || hasLink(value);
  if (cellBreaker || hasControl(value) || value === S.NONE || value.length > 60) {
    refuse(`${at}.connector is at most 60 characters, on one line, with no bar, no backtick and no link.`);
  }
  return value;
}

// The systems table: one row per role, in the table's order. A role the install passes no row
// for is written still to connect, with no connector named.
function systemsOf(systems) {
  if (systems === undefined || systems === null) systems = [];
  if (!Array.isArray(systems)) refuse(`\`systems\` is a list of { role, connector, state }, one per role, the roles being: ${S.ROLES.join(", ")}.`);
  const given = new Map();
  systems.forEach((r, i) => {
    const at = `systems[${i}]`;
    if (r === null || typeof r !== "object" || Array.isArray(r)) refuse(`${at} is an object: role, connector and state.`);
    const extra = Object.keys(r).filter((key) => !["role", "connector", "state"].includes(key));
    if (extra.length) refuse(`${at} does not take ${extra.join(", ")}. It takes: role, connector, state.`);
    if (!S.ROLES.includes(r.role)) refuse(`${at}.role is one of: ${S.ROLES.join(", ")}.`);
    if (given.has(r.role)) refuse(`${at}.role names ${r.role} a second time; the table has one row per role.`);
    if (!S.STATES.includes(r.state)) refuse(`${at}.state is one of: ${S.STATES.join(", ")}.`);
    const connector = connectorOf(r.connector, at);
    if (r.state === S.CONNECTED && connector === null) {
      refuse(`${at} is connected, so it names its connector as the harness shows it.`);
    }
    if (r.state === S.NONE_HERE && connector !== null) refuse(`${at} is none on this desk, so it names no connector.`);
    given.set(r.role, { role: r.role, connector, state: r.state });
  });
  return S.ROLES.map((role) => given.get(role) || { role, connector: null, state: S.STILL });
}

// The pack a desk bundle names, or none.
function packOf(pack, version) {
  if (pack === undefined || pack === null || pack === "") {
    if (version !== undefined && version !== null && version !== 0) refuse("`pack_version` goes with `pack`; leave both out where there is no desk bundle.");
    return { pack: '""', version: "0" };
  }
  if (typeof pack !== "string" || !PACK.test(pack)) refuse("`pack` is the pack's name from the desk bundle, lowercase letters and digits with single hyphens.");
  if (!Number.isInteger(version) || version < 1) refuse("`pack_version` is the pack's version from the desk bundle, a whole number from 1.");
  return { pack, version: String(version) };
}

// The home folder, with the seat pointer's folder in it looked at: a real folder, or none yet.
function homeOf() {
  let home = "";
  try {
    home = os.homedir();
  } catch {
    home = "";
  }
  if (!home || !path.isAbsolute(home)) refuse("This machine names no home folder, so the seat pointer has nowhere to go.");
  let real = home;
  try {
    real = fs.realpathSync(home);
  } catch {
    refuse("The home folder cannot be read, so the seat pointer has nowhere to go.");
  }
  const folder = path.join(real, ".celorus");
  let st = null;
  try {
    st = fs.lstatSync(folder);
  } catch (err) {
    if (!err || err.code !== "ENOENT") refuse("~/.celorus cannot be looked at, so the seat pointer has nowhere to go.");
  }
  if (st && !st.isDirectory()) {
    refuse(`~/.celorus is ${st.isSymbolicLink() ? "a link" : "not a folder"}; the seat pointer goes only into a real folder. Make it a plain folder, then ask again.`);
  }
  return { home: real, folder, made: st === null };
}

function isInside(folder, within) {
  const rel = path.relative(within, folder);
  return rel === "" || (rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel));
}

// The folder to set the desk up in: named in full, never the home folder, a top folder, a
// folder inside the plugin or inside another desk, and never a folder that holds a celorus
// entry already (a .gitignore there is looked at by ignoreOf). It may not exist yet, when the
// folder that would hold it does: then the set-up makes it. Said in words, never by its path.
function deskFolder(named, home) {
  text(named, "desk", "the folder to set the desk up in, written as a full path");
  if (!path.isAbsolute(named)) refuse("`desk` is the folder to set the desk up in, written as a full path.");
  const asked = path.resolve(named);
  let st = null;
  try {
    st = fs.lstatSync(asked);
  } catch (err) {
    if (!err || (err.code !== "ENOENT" && err.code !== "ENOTDIR")) refuse("The folder named as `desk` cannot be looked at.");
  }
  if (st && st.isSymbolicLink()) refuse("The folder named as `desk` is a link; a desk is set up only in a real folder, never through a link.");
  if (st && !st.isDirectory()) refuse("What `desk` names is not a folder.");
  let parent;
  try {
    parent = fs.realpathSync(path.dirname(asked));
  } catch {
    refuse("The folder that would hold the desk folder is not there; name a folder inside one that is.");
  }
  if (!fs.statSync(parent).isDirectory()) refuse("What would hold the desk folder is not a folder.");
  const folder = path.join(parent, path.basename(asked));
  if (path.dirname(folder) === folder || path.dirname(parent) === parent) {
    refuse("The folder named as `desk` is at the top of the disk; name a folder of the person's own for the desk.");
  }
  if (folder === home || isInside(home, folder)) refuse("The folder named as `desk` is the home folder, or holds it; name a folder of its own for the desk.");
  if (isInside(folder, path.join(home, ".celorus"))) refuse("The folder named as `desk` is inside ~/.celorus, which holds the seat pointers; name another folder.");
  const plugin = (() => {
    try {
      return fs.realpathSync(PLUGIN);
    } catch {
      return PLUGIN;
    }
  })();
  if (isInside(folder, plugin)) refuse("The folder named as `desk` is inside the plugin's own folder, which goes when the plugin is removed; name a folder of the person's own.");
  for (let up = parent; ; up = path.dirname(up)) {
    if (isDesk(up)) refuse("The folder named as `desk` is inside another desk's folder; a desk is never set up inside another. Name a folder outside it.");
    if (path.dirname(up) === up) break;
  }
  if (st) {
    let names;
    try {
      names = fs.readdirSync(folder);
    } catch {
      refuse("The folder named as `desk` cannot be listed.");
    }
    const held = names.filter((name) => name.toLowerCase() === "celorus").sort();
    if (held.length) {
      refuse(
        `The folder named as \`desk\` already holds ${held.join(" and ")}, so it may be a desk already. ` +
          "The set-up never writes into an existing desk: name a folder that holds no celorus.",
      );
    }
  }
  return { folder, made: st === null };
}

const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;

// A UTF-8 byte order mark is read as no part of the first line (git reads it so); the file's
// bytes, the mark included, are never rewritten, only added to at its end.
const UTF8 = new TextDecoder("utf-8", { fatal: true });

// The .gitignore already in a folder that was there, looked at before anything is written: none
// (the set-up makes it new), or a plain file, its bytes read through the engine's listed reader
// (history.js readOwn, never through a link), with the scaffold's lines it lacks, and whether its
// last line lacks a line break (`joint`), which the set-up then adds before its lines. Refused by
// name, each with the step to take, before the first change: a link, anything not a plain file,
// one that cannot be read, one that is not UTF-8, one that ends a line with a carriage return
// alone (which git reads as no line end), and, where there are lines to add, one that cannot be
// written. What was looked at is kept so the append can check it is still the same file.
function ignoreOf(folder, lines) {
  const file = path.join(folder, ".gitignore");
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    refuse("The desk folder's .gitignore cannot be looked at.");
  }
  if (st.isSymbolicLink()) {
    refuse("The desk folder's .gitignore is a link; the set-up adds its lines only to a plain file, never through a link. Make it a plain file, then ask again.");
  }
  if (!st.isFile()) {
    refuse("The desk folder's .gitignore is not a file; the set-up adds its lines only to a plain file. Move it out of the desk folder, or make it a plain file, then ask again.");
  }
  let bytes;
  try {
    bytes = H.readOwn(file);
  } catch (err) {
    refuse(
      err && (err.code === "EACCES" || err.code === "EPERM")
        ? "The desk folder's .gitignore cannot be read: this machine gives no permission to read it, so the set-up cannot tell which of its lines it lacks. Give this seat permission to read and write it, then ask again."
        : "The desk folder's .gitignore cannot be read, so the set-up cannot tell which of its lines it lacks. Make it a plain file this seat can read and write, then ask again.",
    );
  }
  let raw;
  try {
    raw = UTF8.decode(bytes);
  } catch {
    refuse("The desk folder's .gitignore is not UTF-8 text (a file saved as UTF-16 is not), so the set-up cannot tell which of its lines it lacks. Save it as UTF-8, then ask again.");
  }
  if (/\r(?!\n)/u.test(raw)) {
    refuse("The desk folder's .gitignore ends a line with a carriage return alone, which git does not read as a line end, so the set-up cannot add its lines after it. Save it with LF line ends, then ask again.");
  }
  const text = raw.split("\r\n").join("\n");
  const have = text.split("\n");
  const missing = lines.filter((line) => !have.includes(line));
  if (missing.length) {
    try {
      fs.accessSync(file, fs.constants.W_OK);
    } catch {
      refuse("The desk folder's .gitignore cannot be written: this machine gives no permission to write it, so the set-up cannot add its lines. Give this seat permission to write it, then ask again.");
    }
  }
  const joint = missing.length > 0 && text.length > 0 && !text.endsWith("\n");
  return {
    missing,
    joint,
    was: { dev: st.dev, ino: st.ino, size: st.size },
    bytes: missing.length ? Buffer.from(`${joint ? "\n" : ""}${missing.join("\n")}\n`, "utf8") : null,
  };
}

// ---- the plan, and the writes ----

// Everything the set-up writes, in order, each { rel, bytes } for a file or { rel } for a
// folder, `rel` from the desk folder; and the seat pointer apart.
function planOf(a) {
  const scaffold = S.scaffoldText();
  const shape = S.shapes(scaffold);
  const shipped = templates(scaffold);
  const quotedName = a.name.split("\\").join("\\\\").split('"').join('\\"');
  const first = a.seats[0];
  const switches = Object.fromEntries(
    Object.entries(SWITCHES).map(([key, role]) => [key, String(a.systems.find((r) => r.role === role).state === S.CONNECTED)]),
  );
  const values = (seat) => ({
    desk_id: a.deskId,
    handle: seat.handle,
    role: seat.role,
    book_source: seat.book,
    baseline: seat.minutes,
    ...switches,
    now: a.now,
    date: a.now.slice(0, 10),
    time: a.now.slice(11, 16),
    model_version: a.modelVersion,
    pack: a.pack.pack,
    pack_version: a.pack.version,
  });
  const named = (template) => template.split('"{{desk}}"').join(`"${quotedName}"`).split("{{desk}}").join(a.name);
  const plan = [];
  const folders = new Set(a.madeFolder ? ["."] : []);
  const folder = (rel) => {
    const parts = rel.split("/");
    for (let i = 1; i <= parts.length; i += 1) {
      const up = parts.slice(0, i).join("/");
      if (!folders.has(up)) {
        folders.add(up);
        plan.push({ rel: `${up}/` });
      }
    }
  };
  const file = (rel, bytes) => {
    if (rel.includes("/")) folder(rel.slice(0, rel.lastIndexOf("/")));
    plan.push({ rel, bytes });
  };
  const seatTemplate = Object.keys(shipped).find((rel) => rel.includes("{{handle}}"));
  const seatsLine = '["{{handle}}"]';
  for (const [rel, template] of Object.entries(shipped)) {
    if (rel === ".gitignore" && a.ignore) {
      // A .gitignore that was there: only the lines it lacks, added at its end.
      if (a.ignore.bytes) plan.push({ rel, append: a.ignore.bytes, was: a.ignore.was });
      continue;
    }
    if (rel === seatTemplate) {
      for (const seat of a.seats) file(fill(rel, values(seat)), Buffer.from(fill(named(template), values(seat)), "utf8"));
      continue;
    }
    let body = named(template);
    if (rel === "celorus/desk.md") {
      if (!body.includes(seatsLine)) throw new Error("the scaffold's desk.md no longer lists its seats as [\"{{handle}}\"]");
      // The handles are plain words (HANDLE), so JSON writes each as the template quotes one.
      body = body.split(seatsLine).join(JSON.stringify(a.seats.map((seat) => seat.handle)).split('","').join('", "'));
      body = fill(body, values(first)) + S.tablesText(a.systems, a.made, shape);
    } else {
      body = fill(body, values(first));
    }
    file(fill(rel, values(first)), Buffer.from(body, "utf8"));
  }
  // Read as the update reads them when it writes them (history.js readText, a listed site).
  for (const name of modelPages()) {
    const page = H.readText(path.join(PLUGIN_MODEL, name));
    if (page === null) throw new Error(`the plugin's model page ${name} cannot be read`);
    file(`celorus/model/${name}`, Buffer.from(page, "utf8"));
  }
  // The soul's written copy (DESK-156): celorus/soul.md, its header with the desk-wide manner
  // empty and its body the soul this plugin ships, byte for byte, for people to read. The
  // assistant never speaks from this copy (lib/persona.js reads the shipped soul).
  file("celorus/soul.md", Buffer.from(soulCopy(`celorus-plugin ${pluginVersion()} scaffold_desk`), "utf8"));
  for (const rel of emptyFolders(scaffold)) file(`${rel}.gitkeep`, Buffer.alloc(0));
  for (const [rel, body] of obsidianBlocks()) file(rel, Buffer.from(body, "utf8"));
  const pointer = {
    rel: fill(shape.pointer.place, { desk_id: a.deskId }),
    bytes: Buffer.from(`${fill(shape.pointer.line, { handle: first.handle })}\n`, "utf8"),
  };
  return { plan, pointer };
}

// A write that stopped, in fixed words: never the system's message, which names full paths.
const STOPPED = {
  EEXIST: "something appeared there while the set-up ran, and the set-up never writes over it",
  EACCES: "this machine gives no permission to write there",
  EPERM: "this machine gives no permission to write there",
  ENOSPC: "the disk is full",
  EROFS: "the disk cannot be written",
  ELOOP: "it became a link while the set-up ran, and the set-up never writes through a link",
  CHANGED: "it changed while the set-up ran, and the set-up adds its lines only to the file it looked at",
};

function listed(items) {
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function stoppedAt(rel, err, done, a) {
  const why = STOPPED[err && err.code] || "the file system would not write it, and gave no reason the desk tools know";
  let undo;
  if (a.madeFolder) undo = "delete the desk folder";
  else {
    const parts = [];
    if (done.some((d) => d.startsWith("celorus/"))) parts.push("delete celorus/ from the desk folder");
    if (done.includes(".gitignore")) {
      parts.push(
        a.ignore
          ? `remove the ${a.ignore.missing.length === 1 ? "line" : "lines"} ${listed(a.ignore.missing)} from its .gitignore` +
              (a.ignore.joint ? ", and the line break at the end of the line just above them, which the set-up added" : "")
          : "delete .gitignore from the desk folder",
      );
    }
    undo = parts.join(", and ");
  }
  const made = done.length
    ? ` Before it stopped it had made ${done.length} ${done.length === 1 ? "entry" : "entries"}, so this is not a whole desk: ${undo}${done.some((d) => d.startsWith("~/")) ? ", and what it made under ~/.celorus" : ""}, then ask again.`
    : ` ${NOTHING}`;
  return new Refusal(`The set-up stopped at ${rel}: ${why}.${made}`);
}

// Makes each folder and file of the plan new: a folder with mkdir, which fails on anything
// already there; a file opened with "wx", which fails on anything already there, a link too,
// and so never writes over a file or through a link. The one step that is not new, the lines a
// .gitignore that was there lacks, is added at its end: only when it is still the file the
// set-up looked at, the same size, and written with append, no-follow and no create, so never
// through a link and never to a file made in its place. It counts as made once its open
// succeeded: a write that stops partway still says to remove the lines, and an open that fails
// says nothing was written there.
const APPEND = fs.constants.O_WRONLY | fs.constants.O_APPEND | NOFOLLOW;

function execute(desk, home, plan, pointer, a) {
  const done = [];
  const make = (full, rel, bytes) => {
    try {
      if (bytes === undefined) fs.mkdirSync(full);
      else fs.writeFileSync(full, bytes, { flag: "wx" });
    } catch (err) {
      if (err && typeof err.code === "string") throw stoppedAt(rel, err, done, a);
      throw err;
    }
    done.push(rel);
  };
  const append = (full, rel, bytes, was) => {
    try {
      const st = fs.lstatSync(full);
      if (!st.isFile() || st.dev !== was.dev || st.ino !== was.ino || st.size !== was.size) throw Object.assign(new Error("changed"), { code: "CHANGED" });
      fs.writeFileSync(full, bytes, { flag: APPEND });
      done.push(rel);
    } catch (err) {
      // The open succeeded when the error came from the write after it.
      if (err && err.syscall === "write") done.push(rel);
      if (err && typeof err.code === "string") throw stoppedAt(rel, err, done, a);
      throw err;
    }
  };
  if (a.madeFolder) make(desk, "the desk folder");
  for (const step of plan) {
    const full = path.join(desk, ...step.rel.split("/").filter(Boolean));
    if (step.append) append(full, step.rel, step.append, step.was);
    else make(full, step.rel, step.bytes);
  }
  if (home.made) make(home.folder, S.POINTER_FOLDER);
  make(path.join(home.home, ...pointer.rel.slice(2).split("/")), pointer.rel, pointer.bytes);
  return done;
}

// A new desk id: d- and eight random lowercase letters or digits, whose seat pointer is not
// on this machine yet.
function mintId(home) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let tries = 0; tries < 20; tries += 1) {
    let id = "d-";
    for (let i = 0; i < 8; i += 1) id += alphabet[Math.floor(Math.random() * alphabet.length)];
    try {
      fs.lstatSync(path.join(home.folder, `seat-${id}`));
    } catch {
      return id;
    }
  }
  throw new Error("no free desk id after twenty tries");
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function said(rows) {
  return rows.map((r) => (r.connector === null ? r.role : `${r.role} (${r.connector})`)).join(", ");
}

// The set-up. `args` is checked whole before anything is written.
function scaffoldDesk(args, { readBack }) {
  const name = deskName(args.name);
  const seats = seatsOf(args.seats);
  const systems = systemsOf(args.systems);
  const pack = packOf(args.pack, args.pack_version);
  const now = H.momentOf(args.now);
  const home = homeOf();
  const { folder, made: madeFolder } = deskFolder(args.desk, home.home);
  const lines = S.shapes().gitignore;
  // A .gitignore already in a folder that was there, looked at before the first write.
  const ignore = madeFolder ? null : ignoreOf(folder, lines);
  // The lines the set-up adds: all of them to a .gitignore it makes, else only those it lacks.
  const added = ignore ? ignore.missing : lines;
  const deskId = mintId(home);
  const pointerRel = `~/.celorus/seat-${deskId}`;
  // The record names the desk folder where the set-up makes it, else celorus/; then, in either
  // folder, the .gitignore by its mark whenever the set-up makes the file (a folder it makes, or
  // one that held none when looked at above: `ignore` null), the line break the set-up added at
  // the end of the .gitignore's last line where it had none, and each line it added.
  const made = [
    ...(madeFolder ? [{ what: S.MADE["."], path: "." }] : [{ what: S.MADE["celorus/"], path: "celorus/" }]),
    ...(ignore === null ? [{ what: S.MADE[S.IGNORE_MADE], path: S.IGNORE_MADE }] : []),
    ...(ignore && ignore.joint ? [{ what: S.MADE[S.LINE_BREAK_AT], path: S.LINE_BREAK_AT }] : []),
    ...added.map((line) => ({ what: S.LINE_SAID, path: `${S.LINE_AT}${line}` })),
    ...(home.made ? [{ what: S.MADE[S.POINTER_FOLDER], path: S.POINTER_FOLDER }] : []),
    { what: S.POINTER_SAID, path: pointerRel },
  ];
  const a = { name, seats, systems, pack, now, deskId, made, madeFolder, ignore, modelVersion: modelVersion() };
  const { plan, pointer } = planOf(a);
  if (pointer.rel !== pointerRel) throw new Error("the scaffold's seat pointer is not at ~/.celorus/seat-<desk_id>");
  const done = execute(folder, home, plan, pointer, a);
  // The table as the desk now holds it, read back the way take_down reads it.
  const back = readBack(folder);
  const files = plan.filter((step) => step.bytes !== undefined);
  const folders = plan.filter((step) => step.bytes === undefined && step.append === undefined).length;
  const ignoreSaid = !ignore
    ? ""
    : ignore.missing.length
      ? ` It added ${plural(ignore.missing.length, "line", "lines")} to the .gitignore that was there,${ignore.joint ? " and a line break at the end of its last line," : ""} and changed nothing else in it.`
      : " The .gitignore that was there already held the desk's lines, so it was left as it was.";
  const connected = back.systems.filter((r) => r.state === S.CONNECTED).map(({ role, connector }) => ({ role, connector }));
  const still = back.systems.filter((r) => r.state === S.STILL).map(({ role, connector }) => ({ role, connector }));
  const none = back.systems.filter((r) => r.state === S.NONE_HERE).map(({ role, connector }) => ({ role, connector }));
  return {
    desk: name,
    desk_id: deskId,
    seat: seats[0].handle,
    seats: seats.map((seat) => seat.handle),
    made_desk_folder: madeFolder,
    made: back.made,
    written: files.map((step) => step.rel),
    files_written: files.length,
    gitignore_lines_added: added,
    gitignore_line_break_added: Boolean(ignore && ignore.joint),
    folders_made: folders + (madeFolder ? 1 : 0),
    seat_pointer: pointerRel,
    systems: back.systems,
    connected,
    still_to_connect: still,
    none_on_this_desk: none,
    entries_made: done.length,
    summary:
      `Set up the desk ${name} (${deskId}) for the seat ${seats[0].handle}: ` +
      `${plural(files.length, "file", "files")} in ${plural(folders + (madeFolder ? 1 : 0), "new folder", "new folders")}, ` +
      `every one new, nothing written over, and the seat pointer ${pointerRel} on this machine.${ignoreSaid} ` +
      (connected.length ? `Connected: ${said(connected)}. ` : "Nothing is connected yet. ") +
      (still.length ? `Still to connect: ${said(still)}.` : "Nothing is left to connect.") +
      (none.length ? `\nNone on this desk: ${said(none)}.` : ""),
  };
}

module.exports = { scaffoldDesk, SEAT_ROLES, BOOK_SOURCES, templates, emptyFolders };
