"use strict";
// The overnight and the routines as desk tools, served by both doors: lib/tools.js takes this
// list by one load and one spread (BUILD-COMMON rule 4). overnight_reconcile is the demo's tool
// by name (the demo server's); register_routine and list_routines keep the register of routines and say
// the removal story for them (routines/routines.js).
//
// lib/tools.js loads this file, so its helpers are reached when a tool runs, never at load.

const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot } = require("../lib/linkedroot.js");
const { deskShown, DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { pluginVersion } = require("../lib/version.js");
const { readAt } = require("../write/text.js");
const { deskMd } = require("../write/facts.js");
const { overnightReconcile } = require("./overnight.js");
const R = require("../routines/routines.js");

function registry() {
  return require("../lib/tools.js");
}

const AT = {
  type: "string",
  description:
    "When the run happens, with its own offset, as 2026-09-21T06:00:00+05:30. The desk writes it at that " +
    "offset. A time with no offset is refused.",
};
const SEAT = { type: "string", description: "The seat running this: the name of one of the desk's seat pages." };
const TEXT = (description) => ({ type: "string", description });

// The call's context, as every writer's (write/tools.js): the call held to the tool's own inputs,
// the time, the plugin's version, the desk (a linked celorus/, views/ or log.md refused before
// anything is read for writing), desk.md read once, and how the answer names a path.
function context(tool, args, allowed) {
  const { deskFor, onlyArguments } = registry();
  onlyArguments(tool, args, allowed);
  const at = readAt(args.at);
  if (at === null) {
    throw new Refusal(
      `\`at\` is when the change happens, with its own offset, as 2026-09-21T06:00:00+05:30; got ${JSON.stringify(args.at)}. Nothing was written.`,
    );
  }
  const version = pluginVersion();
  if (version === "unknown") {
    throw new Refusal("The plugin's version is not known, so no page could carry generated_by. Nothing was written.");
  }
  const root = deskFor(args.desk, { writes: true });
  refuseLinkedRoot(root);
  const celorus = path.join(root, "celorus");
  const desk = deskMd(celorus, "Nothing was written.");
  const shown = deskShown(args.desk, root);
  return { tool, version, root, celorus, at, desk, shown, footer: desk.footer, generatedBy: `celorus-plugin ${version} ${tool}` };
}

function writer(name, description, properties, required, write) {
  const allowed = ["desk", "at", ...Object.keys(properties)];
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: { desk: DESK, at: AT, ...properties },
      required: ["at", ...required],
      additionalProperties: false,
    },
    run(args = {}) {
      return write(context(name, args, allowed), args);
    },
  };
}

const TOOLS = [
  writer(
    "overnight_reconcile",
    "Run the overnight for the desk: every conversation dated before the run's day and not yet merged grows " +
      "the shared pages (a page for each person it names who has none, that person onto the family page, each " +
      "line heard onto its subject's page) and joins the merge record; each family's latest hand-over moves " +
      "its owner; each CRM record made from the desk gets its id onto the page of the family's member it names, " +
      "and one naming no member, a member another record names too, or a member who holds another id is tied to " +
      "no one and named in unread, whatever the order of the records; mail on a family's thread that no reply row covers becomes a " +
      "reply row; a line heard about a seat grows no page, since a seat's page is never written. Every change has its line in log.md, and one " +
      "more says the run happened and whether a person watched it. attended is false only when a routine runs " +
      "it, and such a run is refused until log.md holds an attended run and the desk's register holds a " +
      "routine. Refused before anything is written: a seat not on the desk, a page it would write that is a " +
      "link or not a plain file. Answers grown, handed_over, linked, replies, and unread: what it passed over, each with why." +
      " What the seat says about themselves is never written to the desk: leave it out of every field.",
    {
      seat: SEAT,
      attended: { type: "boolean", description: "True when a person is watching this run; false only when a routine runs it." },
      crm_records: {
        type: "array",
        items: { type: "object" },
        description: "[{id, name, desk_ref, stage}]: the CRM records made from the desk, read through the CRM connection; desk_ref is the family's slug. [] or left out when none.",
      },
      mail_threads: {
        type: "array",
        items: { type: "object" },
        description:
          "Each mail thread on the desk's families as {family, seat, messages}, each message {from_seat, at, from_name}, oldest message first, read through the mail connection. An empty list or left out when none.",
      },
    },
    ["seat", "attended"],
    overnightReconcile,
  ),
  writer(
    "register_routine",
    "Record on the desk's register a routine a person made by hand in the app, so taking the desk out can " +
      "name it, and its line in log.md. Refused until log.md holds an attended run of the overnight: a " +
      "routine runs unattended only after one. when is said in words, as every morning, never a clock time." +
      " What the seat says about themselves is never written to the desk: leave it out of every field.",
    {
      seat: SEAT,
      routine: TEXT("The routine's name as its folder is named: lowercase words joined by hyphens."),
      runs: TEXT("local or cloud: where the app runs it."),
      repeats: TEXT("hourly, daily, weekdays or weekly."),
      when: TEXT("When it lands, in words, as every morning."),
      model: TEXT("The model the routine was made with, as the app shows it."),
      skill_file: TEXT("Where the app keeps the routine's script: ~/.claude/scheduled-tasks/<the routine's name>/SKILL.md, and nothing else is taken."),
    },
    ["seat", "routine", "runs", "repeats", "when", "model", "skill_file"],
    R.registerRoutine,
  ),
  {
    name: "list_routines",
    description:
      "Say every routine on the desk's register and how each is removed, in order and where: the routine " +
      "deleted in the app where it was made, then the folder the app leaves behind with its script, deleted " +
      "by hand, and whether that folder is still on this machine. It removes nothing and writes nothing. A " +
      "folder is named for deletion only when it holds the routine's script on this machine: a link, a file, " +
      "or a folder without the script stays, left alone. A row that is not a routine's own is answered by its " +
      "row number alone.",
    inputSchema: {
      type: "object",
      properties: { desk: DESK },
      additionalProperties: false,
    },
    run(args = {}) {
      const { deskFor, onlyArguments } = registry();
      onlyArguments("list_routines", args, ["desk"]);
      const root = deskFor(args.desk);
      return { tool: "list_routines", plugin_version: pluginVersion(), ...R.listRoutines(root) };
    },
  },
];

module.exports = { TOOLS };
