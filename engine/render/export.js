"use strict";
// The desk's CRM export, as the workday count supplied_already_yours reads it (base ruling R45,
// row E6): the newest crm/export-<YYYY-MM-DD>.csv by the date in its name, and the cells of its
// column headed `name` (trimmed, letter case ignored). The file is opened through files.js, a
// plain file under the desk and never through a link, and nothing here writes. A desk with no
// export, or an export that has no name column or cannot be read, answers why in words: the
// count is then not available, never zero.

const fs = require("fs");
const path = require("path");
const { deskRoot, plainFolder, plainFile, readPlain } = require("./files.js");
const { asDate } = require("./words.js");
const { pathsSaid } = require("./screen.js");

const CRM = "crm";
const EXPORT = /^export-(\d{4}-\d{2}-\d{2})\.csv$/;
const NO_EXPORT = "there is no CRM export under crm/";

class Unreadable extends Error {}

// The export's file name, the newest by the date its name carries, or null.
function newestExport(root) {
  const folder = `celorus/${CRM}`;
  if (!plainFolder(root, folder)) return null;
  let newest = null;
  for (const name of fs.readdirSync(path.join(root, "celorus", CRM))) {
    const m = EXPORT.exec(name);
    let day = null;
    try {
      day = m ? asDate(m[1]) : null;
    } catch {
      day = null;
    }
    if (day === m?.[1] && (newest === null || day > newest[0])) newest = [day, name];
  }
  return newest === null ? null : newest[1];
}

// The file's records, as RFC 4180 reads them: a cell that opens with a double quote may hold a
// comma, a line break or a doubled quote. A quote anywhere else in a cell is the character itself
// (a name like O"Neil), as Python's csv reads it. A leading BOM and CRLF line ends are read. A
// blank line is no record.
function records(text) {
  const s = text.replace(/^\ufeff/, "");
  const out = [];
  let row = [];
  let cell = "";
  let quoted = false;
  // whether the next character is the first of its cell
  let opens = true;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (s[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = false;
    } else if (ch === '"' && opens) {
      quoted = true;
      opens = false;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      opens = true;
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
      opens = true;
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
    } else {
      cell += ch;
      opens = false;
    }
  }
  if (quoted) throw new Unreadable("a quoted cell is never closed");
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => !(r.length === 1 && r[0] === ""));
}

// What a name is compared as: trimmed, letter case ignored.
function nameKey(value) {
  return String(value).trim().toLowerCase();
}

// {available: true, file, names} with `names` a set of name keys, or {available: false, reason}.
function crmExport(deskFolder) {
  let file = null;
  try {
    const root = deskRoot(deskFolder);
    const name = newestExport(root);
    if (name === null) return { available: false, reason: NO_EXPORT };
    file = `${CRM}/${name}`;
    const rel = `celorus/${file}`;
    if (!plainFile(root, rel)) return { available: false, reason: NO_EXPORT };
    const rows = records(readPlain(root, rel));
    const columns = rows.length ? rows[0].map((c) => c.trim()) : [];
    const at = columns.findIndex((c) => c.toLowerCase() === "name");
    if (at === -1) {
      // the export's own header cells, but for a path in them, said as "(a path)" (R73: no answer
      // repeats a path; 0.19.0 K4c, met by the door walk's drive)
      const said = columns.length ? `its columns are ${pathsSaid(columns.join(", "))}` : "it has no header line";
      return { available: false, reason: `the CRM export ${file} has no column headed name: ${said}` };
    }
    const names = new Set(
      rows
        .slice(1)
        .map((r) => nameKey(r[at] === undefined ? "" : r[at]))
        .filter(Boolean),
    );
    return { available: true, file, names };
  } catch (err) {
    const why = err instanceof Unreadable ? err.message : "it is not a plain file the engine can open";
    return { available: false, reason: file ? `the CRM export ${file} cannot be read: ${why}` : `the crm/ folder cannot be read: ${why}` };
  }
}

module.exports = { crmExport, nameKey, records, NO_EXPORT };
