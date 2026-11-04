"use strict";
// The seat's graphs this computer holds, as the link last pulled or seeded each (DESK-263;
// walk finding UTF-040): by the seat's folder in its storage (seats/<n>/), the full path of the
// graph's folder on this computer. So a pull with no desk named, started where no desk is found,
// finds the seat's graph here and pulls it, and the install skill never brings a second copy down
// nor sets a second desk up.
//
// Kept under the home folder beside the link's sign-in, in ~/.celorus/link/desks.json: the folder
// 0700 and the file 0600, written to a new file opened only if it does not exist and never through
// a link, then renamed into place, as the token is (token.js). Never in a desk, never sent, never
// logged. A remembered folder is a hint only: the pull uses it only where it still holds a seat's
// graph in a folder named as the storage names the seat. A file that does not read, is not the
// link's own, or is a link holds nothing, and a link there is never written through nor replaced.
// Neither reading nor keeping ever stops the call it rides on.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const token = require("./token.js");

const FILE = "desks.json";
const VERSION = 1;
// At most this many seats are remembered; the one remembered longest ago goes first.
const MOST = 20;
const SEAT_FOLDER = /^seats\/[0-9]{1,12}\/$/u;

const ownFile = (st) => st.isFile() && (st.mode & 0o777) === 0o600 && (typeof process.getuid !== "function" || st.uid === process.getuid());

// Whether `root` is named as the graph of `seatFolder` (seats/<n>/) is named in its firm folder: a
// folder <n> in a folder seats. A pull finds a remembered folder only so, so none other is kept.
const fits = (seatFolder, root) =>
  typeof seatFolder === "string" && SEAT_FOLDER.test(seatFolder) && typeof root === "string" && path.isAbsolute(root) && path.basename(path.dirname(root)) === "seats" && `seats/${path.basename(root)}/` === seatFolder;

// The remembered folders, { "seats/<n>/": full path }, in the order they were remembered; {} when
// none are, or the file cannot be trusted.
function readAll(home) {
  if (typeof home !== "string" || !token.folderThere(home)) return {};
  const file = path.join(token.tokenFolder(home), FILE);
  let st;
  try {
    st = fs.lstatSync(file);
  } catch {
    return {};
  }
  if (!ownFile(st)) return {};
  let entry;
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    entry = JSON.parse(fs.readFileSync(fd, "utf8"));
  } catch {
    return {};
  } finally {
    fs.closeSync(fd);
  }
  if (entry === null || typeof entry !== "object" || entry.version !== VERSION) return {};
  const all = entry.desks;
  if (all === null || typeof all !== "object" || Array.isArray(all)) return {};
  const out = {};
  for (const [seat, folder] of Object.entries(all)) {
    if (SEAT_FOLDER.test(seat) && typeof folder === "string" && path.isAbsolute(folder)) out[seat] = folder;
  }
  return out;
}

// The folder remembered for `seatFolder` (seats/<n>/), or null.
function recall(home, seatFolder) {
  try {
    const all = readAll(home);
    return Object.hasOwn(all, seatFolder) ? all[seatFolder] : null;
  } catch {
    return null;
  }
}

// Remember `root` as the graph of `seatFolder` on this computer; true when kept. A folder a pull
// would not find again (not <n> in a seats folder) is never kept.
function remember(home, seatFolder, root) {
  if (typeof home !== "string" || !fits(seatFolder, root)) return false;
  let spare = null;
  try {
    const all = readAll(home);
    if (all[seatFolder] === root && Object.keys(all).at(-1) === seatFolder) return true;
    delete all[seatFolder];
    all[seatFolder] = root;
    const seats = Object.keys(all);
    for (const old of seats.slice(0, Math.max(0, seats.length - MOST))) delete all[old];
    const folder = token.makeFolder(home);
    const file = path.join(folder, FILE);
    const st = fs.lstatSync(file, { throwIfNoEntry: false });
    if (st !== undefined && !st.isFile()) return false;
    spare = path.join(folder, `.desks-${crypto.randomBytes(8).toString("hex")}.tmp`);
    const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
    const fd = fs.openSync(spare, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
    try {
      fs.fchmodSync(fd, 0o600);
      fs.writeSync(fd, JSON.stringify({ version: VERSION, desks: all }));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(spare, file);
    return true;
  } catch {
    try {
      if (spare !== null) fs.rmSync(spare, { force: true });
    } catch {
      // the spare stays; it is never read as the file
    }
    return false;
  }
}

module.exports = { FILE, MOST, fits, recall, remember };
