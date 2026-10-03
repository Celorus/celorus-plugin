"use strict";
// The register of routines on the desk, and the removal story for them (Plan C, E9; the demo's
// items 1 to 3 and its platform check row 6).
//
// A routine is the client's: a person makes it once, by hand, in the app, and it runs itself
// afterwards, on the client's plan and at the client's cost. Nothing of ours creates one. It is
// kept outside the plugin, one folder per routine in the person's home folder, so removing the
// plugin stops nothing it runs, and deleting the routine in the app leaves that folder, with its
// script, behind. It runs at most once an hour, with a delay of some minutes the app picks, so it
// lands "every morning", never at a clock time. So the desk keeps a register, celorus/scheduled.md
// (the demo's page and columns), one row for every routine set up for it, and the removal story
// names each row's routine and its folder.
//
// A routine runs unattended only after one attended run: register_routine refuses a routine
// until log.md holds an attended run of the overnight, and overnight_reconcile refuses an
// unattended run until log.md holds one and the register holds a routine
// (overnight/overnight.js). The attended run is the line the overnight writes at the end of an
// attended run (RUN_LINE below).
//
// Where the app keeps a routine (ROUTINES_HOME, SCRIPT below): the folder
// ~/.claude/scheduled-tasks/<the routine's name>, holding its script SKILL.md. A row's skill_file
// is held to exactly that, the folder above the file named as the routine, when the row is
// written and again every time it is read: the register is a file every seat shares, and a row
// written by hand, or on another machine, is never trusted to name a folder on this one.
//
// list_routines reads the register and changes nothing: for each routine, the steps a person
// takes, in order, and whether its folder is on this machine, looked at and never followed. A
// row whose routine is not a routine's name, or whose skill_file is not that routine's own
// script, is answered by its row number alone: nothing of it is said in a sentence, and no step
// is made from it. A folder is named for deletion only when it holds the script as a plain file
// on this machine: a link, a file, or a folder without the script stays, left alone.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readPage, NO_HEADER } = require("../lib/desk.js");
const T = require("../write/text.js");
const { screened } = require("../write/screen.js");
const { seatsOf, seatsNamed } = require("../write/facts.js");
const { writeSteps } = require("../write/pages.js");
const { refuseLinkedFolders } = require("../lib/linkedroot.js");
const P = require("../overnight/plan.js");

const REGISTER = "scheduled.md";
const LOG = "log.md";
const COLUMNS = Object.freeze(["routine", "runs", "repeats", "when", "folder", "model", "set_up_by", "set_up_on", "skill_file"]);
const RUNS = Object.freeze(["local", "cloud"]);
const REPEATS = Object.freeze(["hourly", "daily", "weekdays", "weekly"]);
const SKILL = "overnight";
const NOTHING = P.NOTHING;

// The register's own words (the demo's), and its header's.
const TITLE = "What was scheduled";
const DESCRIPTION = "Every routine set up for this desk, so it can be found and removed later";
const INTRO =
  "One row for every routine set up for this desk. Nothing of ours creates a routine: a person sets it up " +
  "once in the app, and it runs itself afterwards. A routine is kept outside the plugin, in its own folder " +
  "(`skill_file`), and deleting it in the app leaves that folder behind, so taking the desk out removes " +
  "both, by hand, starting from this page.";

// The line the overnight writes at the end of each run, and the one that proves a run attended.
const RUN_LINE = {
  attended: "ran the overnight, attended",
  routine: "ran the overnight as a routine",
};

// Whether log.md's text holds an attended run of the overnight.
function attendedRun(logText) {
  return P.logEntries(logText).some((e) => e.skill === SKILL && e.what.startsWith(`${RUN_LINE.attended}:`));
}

// A clock time, in figures or in words: a routine lands at a time the app picks, never at one.
const CLOCK = /[0-9]|\b(?:a\.?m\.?|p\.?m\.?|o'clock|noon|midnight)\b|\bat (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/iu;
const WHEN_SAID =
  "when is said in words, as every morning: a routine runs at most once an hour, at a time the app picks " +
  "within some minutes, so it is never said as a clock time";

// Where the app keeps routines, written from the person's home folder, and the script's name.
const ROUTINES_HOME = "~/.claude/scheduled-tasks";
const SCRIPT = "SKILL.md";

// A routine's own folder and its own script, from its name alone.
function folderOf(routine) {
  return `${ROUTINES_HOME}/${routine}`;
}
function scriptOf(routine) {
  return `${folderOf(routine)}/${SCRIPT}`;
}

// Whether a routine and a skill_file are one routine's: the routine a name as a folder is named,
// and the skill_file exactly that routine's script where the app keeps routines. The one rule,
// held at the write and at every read: the removal list below, and the overnight's gate on an
// unattended run (overnight.js), which counts only the rows this takes.
function ownScript(routine, skillFile) {
  return typeof routine === "string" && T.HANDLE.test(routine) && skillFile === scriptOf(routine);
}

// What stands at a home-relative path on this machine, looked at and never followed: absent, a
// folder, a file, or what else (WHAT_ELSE says it in words).
const WHAT_ELSE = Object.freeze({
  file: "a file",
  link: "a link",
  odd: "neither a file nor a folder",
  unseen: "something that cannot be looked at",
});
function lookAtHome(rel) {
  let home = "";
  try {
    home = os.homedir();
  } catch {
    home = "";
  }
  if (!home) return "unseen";
  let st;
  try {
    st = fs.lstatSync(path.join(home, ...rel.slice(2).split("/")));
  } catch (err) {
    return err && (err.code === "ENOENT" || err.code === "ENOTDIR") ? "absent" : "unseen";
  }
  if (st.isSymbolicLink()) return "link";
  if (st.isDirectory()) return "folder";
  return st.isFile() ? "file" : "odd";
}

// The register as the desk holds it: its rows, or null when the desk has none; odd rows named.
function readRegister(celorus) {
  if (P.standing(path.join(celorus, REGISTER)) === "absent") return { rows: null, unread: [] };
  // Read as every reader reads a page: a link followed, an odd page named and passed over.
  const page = readPage(celorus, REGISTER);
  if (page.problem && page.problem !== NO_HEADER) {
    return { rows: [], unread: [{ row: `celorus/${REGISTER}`, why: page.why ? `${page.problem} (${page.why})` : page.problem }] };
  }
  return { rows: P.readTable(page.body || ""), unread: [] };
}

// Every routine on the register and the removal steps for each, in order: delete the routine in
// the app where it was made, then its folder by hand, which the app leaves behind. Changes nothing.
function listRoutines(root) {
  const celorus = path.join(root, "celorus");
  const read = readRegister(celorus);
  const routines = [];
  const steps = [];
  const stays = [];
  const unread = [...read.unread];
  const add = (step) => steps.push({ step: steps.length + 1, ...step });
  for (const [i, row] of (read.rows || []).entries()) {
    const name = row.routine;
    // The rule of the write, held again here: a row that fails it is named by its number alone.
    if (!ownScript(name, row.skill_file)) {
      unread.push({
        row: `celorus/${REGISTER} row ${i + 1}`,
        why:
          "its routine is not a routine's name, or its skill_file is not that routine's own script where the app keeps " +
          "routines, so nothing of the row is said and no step is made from it: its routine and its folder are found in the app by hand",
      });
      continue;
    }
    const where = row.runs === "cloud" ? "in the app's routines, on the account it was made on" : "in the app's routines, on the machine it was made on";
    add({
      remove: "routine",
      routine: name,
      path: null,
      where,
      say: `Delete the routine ${name} ${where}: it runs on its own clock, and removing the plugin does not stop it.`,
    });
    const folder = folderOf(name);
    const listed = { routine: name, runs: row.runs, repeats: row.repeats, when: row.when, model: row.model, set_up_by: row.set_up_by, set_up_on: row.set_up_on, skill_file: row.skill_file, folder, present: null };
    const seen = lookAtHome(folder);
    const whereFolder = "in the home folder of the machine the routine was made on";
    if (seen === "absent") {
      listed.present = false;
      add({
        remove: "folder",
        routine: name,
        path: folder,
        present: false,
        where: whereFolder,
        say: `The folder ${folder}, where the routine ${name} kept its script, is not on this machine; there is nothing to delete here.`,
      });
    } else if (seen !== "folder") {
      stays.push({ what: folder, say: `What stands at ${folder} stays, left alone: it is not the routine's folder, but ${WHAT_ELSE[seen]}.` });
    } else if (lookAtHome(scriptOf(name)) !== "file") {
      // A folder is there, and the script is not in it as a plain file: not a folder to delete.
      listed.present = true;
      stays.push({ what: folder, say: `What stands at ${folder} stays, left alone: it is a folder that does not hold the routine's script.` });
    } else {
      listed.present = true;
      add({
        remove: "folder",
        routine: name,
        path: folder,
        present: true,
        where: whereFolder,
        say: `Delete the folder ${folder} by hand, and look that it is gone: deleting the routine ${name} in the app leaves this folder, with its script, behind.`,
      });
    }
    routines.push(listed);
  }
  const n = routines.length;
  const odd = unread.length ? ` ${unread.length === 1 ? "One row" : `${unread.length} rows`} could not be read; each is named in unread.` : "";
  return {
    register: read.rows === null ? null : `celorus/${REGISTER}`,
    routines,
    steps,
    stays,
    unread,
    summary:
      (read.rows === null
        ? "This desk has no register of routines, so no routine is recorded for it; any made in the app is found there by hand."
        : `${n === 1 ? "1 routine is" : `${n} routines are`} on the desk's register; each is removed by hand, before the rest of the desk, and nothing was removed.`) + odd,
  };
}

function refuse(message) {
  P.refuse(message);
}

function heldText(what, value) {
  if (typeof value !== "string" || T.pyStrip(value) === "") refuse(`${what} is text. ${NOTHING}`);
}

// Records one routine a person made in the app, as a row on the register, and its line in log.md.
function registerRoutine(ctx, args) {
  const { seat, routine, runs, repeats, when, model } = args;
  const skillFile = args.skill_file;
  const seats = seatsOf(ctx.celorus, ctx.desk);
  if (typeof seat !== "string" || !seats.handles.includes(seat)) {
    refuse(`seat must be a seat handle, one of: ${seatsNamed(seats)}; got ${JSON.stringify(seat)}. ${NOTHING}`);
  }
  if (typeof routine !== "string" || !T.HANDLE.test(routine)) {
    refuse(`routine is the routine's name as its folder is named: lowercase words joined by hyphens. ${NOTHING}`);
  }
  if (!RUNS.includes(runs)) refuse(`runs must be one of: ${RUNS.join(", ")}. ${NOTHING}`);
  if (!REPEATS.includes(repeats)) refuse(`repeats must be one of: ${REPEATS.join(", ")}. ${NOTHING}`);
  heldText("when", when);
  heldText("model", model);
  const said = screened([
    ["when", when],
    ["model", model],
  ]);
  if (said) refuse(said);
  if (CLOCK.test(when)) refuse(`${WHEN_SAID}. ${NOTHING}`);
  if (!ownScript(routine, skillFile)) {
    refuse(
      `skill_file is where the app keeps the routine's script: ${scriptOf(routine)}, the folder above the file ` +
        `named exactly as the routine. ${NOTHING}`,
    );
  }
  const plan = new P.Plan(ctx);
  const log = plan.read(LOG);
  if (!attendedRun(log)) {
    refuse(
      "A routine runs unattended only after one attended run, and log.md holds no attended run of the " +
        "overnight: run it once with a person watching it (overnight_reconcile with attended true), then " +
        `record the routine. ${NOTHING}`,
    );
  }
  const text = plan.read(REGISTER);
  if (text !== null && P.readTable(text).some((row) => row.routine === routine)) {
    refuse(`the routine ${routine} is on the desk's register already. ${NOTHING}`);
  }
  const row = {
    routine,
    runs,
    repeats,
    when: T.clean(when),
    folder: ".",
    model: T.clean(model),
    set_up_by: seat,
    set_up_on: ctx.at.date,
    skill_file: skillFile,
  };
  const base =
    text !== null
      ? text
      : P.tablePage(
          { type: "register", title: TITLE, timestamp: T.stamp(ctx.at.iso), description: DESCRIPTION, generated_by: ctx.generatedBy },
          TITLE,
          INTRO,
          COLUMNS,
          ctx.footer,
        );
  plan.put(REGISTER, P.withRegisterRows(REGISTER, base, [row], ctx.generatedBy));
  const line = T.logLine(ctx.at.clock, seat, SKILL, `registered the routine ${routine} (${runs}, ${repeats}, ${T.clean(when)})`);
  plan.put(LOG, T.withLogLine(log, ctx.at.date, ctx.at.clock, line, ctx.footer));
  refuseLinkedFolders(ctx.celorus, [REGISTER, LOG]);
  // log.md last: the history line goes down after the page it names (house rule 5).
  const steps = plan.steps();
  const done = writeSteps(ctx.celorus, [...steps.filter((s) => s.rel !== LOG), ...steps.filter((s) => s.rel === LOG)]);
  const answer = { tool: ctx.tool, plugin_version: ctx.version, desk: ctx.desk.name, row };
  if (done.written === null) return { ...answer, written: null, page: null, history: null, reason: done.reason, previous_text: done.previous_text };
  return {
    ...answer,
    written: done.written,
    // The register by its place in celorus/ alone: an answer carries no path to the desk (R72).
    page: REGISTER,
    history: { page: LOG, line },
    reason: null,
    previous_text: null,
  };
}

module.exports = { REGISTER, COLUMNS, RUNS, REPEATS, RUN_LINE, attendedRun, listRoutines, ownScript, readRegister, registerRoutine };
