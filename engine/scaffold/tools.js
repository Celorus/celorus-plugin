"use strict";
// The set-up and take-down tools: scaffold_desk (scaffold.js) and take_down (the take-down
// folder's own tools.js), listed together so lib/tools.js takes both in one line.

const { pluginVersion } = require("../lib/version.js");
const { scaffoldDesk, SEAT_ROLES, BOOK_SOURCES } = require("./scaffold.js");
const S = require("./systems.js");
const { readBack } = require("../takedown/takedown.js");
const { TOOLS: TAKE_DOWN } = require("../takedown/tools.js");

// The registry's helpers, read when the tool runs: lib/tools.js lists this tool, so it is still
// loading when this file is.
function registry() {
  return require("../lib/tools.js");
}

const ARGUMENTS = ["desk", "name", "seats", "systems", "pack", "pack_version", "now"];

function scaffoldDeskTool(args = {}) {
  registry().onlyArguments("scaffold_desk", args, ARGUMENTS);
  return { tool: "scaffold_desk", plugin_version: pluginVersion(), ...scaffoldDesk(args, { readBack }) };
}

const TOOLS = [
  {
    name: "scaffold_desk",
    description:
      "Set a new desk up in a folder that holds no desk: every page of install-desk's scaffold " +
      "with the answers filled in, the model pages, the empty folders, the Obsidian settings, " +
      "the systems table and the set-up record at the end of celorus/desk.md, and this " +
      "machine's seat pointer at ~/.celorus/seat-<desk_id>. It never writes into an existing " +
      "desk or over a file: it refuses first, naming why, with nothing written. To a " +
      ".gitignore already in the folder it adds only the desk's lines the file lacks. Returns what " +
      "it made, desk-relative, and the systems table as written: what is connected, what is " +
      "still to connect, and what is none on this desk." +
      " What the seat says about themselves is never written to the desk: leave it out of every field.",
    inputSchema: {
      type: "object",
      properties: {
        desk: {
          type: "string",
          description:
            "The folder to set the desk up in, as a full path: a folder that holds no celorus (a " +
            ".gitignore there, a plain file, has the desk's lines it lacks added), or one not made " +
            "yet inside a folder that is there.",
        },
        name: { type: "string", description: "The desk's name, as the person says it." },
        seats: {
          type: "array",
          description: "The desk's seats, this machine's seat first: the seat pointer names it.",
          items: {
            type: "object",
            properties: {
              handle: { type: "string", description: "Short, lowercase, no spaces: it names the seat's file." },
              role: { type: "string", enum: [...SEAT_ROLES] },
              book_source: { type: "string", enum: [...BOOK_SOURCES] },
              baseline_minutes: {
                type: "integer",
                description: "How long researching one lead takes today, in minutes, self-reported.",
              },
            },
            required: ["handle", "role", "book_source", "baseline_minutes"],
            additionalProperties: false,
          },
        },
        systems: {
          type: "array",
          description:
            "One row per role the harness was asked about: its connector's name as the harness " +
            "shows it, and connected, still to connect, or none on this desk where the person said " +
            "the firm has no such system. A row none on this desk names no connector. A role left " +
            "out is written still to connect, with no connector named.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: [...S.ROLES] },
              connector: { type: "string", description: "The connector's name as the harness shows it." },
              state: { type: "string", enum: [...S.STATES] },
            },
            required: ["role", "state"],
            additionalProperties: false,
          },
        },
        pack: { type: "string", description: "The pack's name from the desk bundle; leave it out with no bundle." },
        pack_version: { type: "integer", description: "The pack's version from the desk bundle, with pack." },
        now: {
          type: "string",
          description:
            "The moment of the set-up, in ISO 8601 with a T between the date and the time and the " +
            "local offset, as 2026-09-03T10:00:00+05:30. Leave it out to use this machine's clock.",
        },
      },
      required: ["desk", "name", "seats"],
      additionalProperties: false,
    },
    run: scaffoldDeskTool,
  },
  ...TAKE_DOWN,
];

module.exports = { TOOLS };
