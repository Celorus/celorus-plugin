"use strict";
// The take_down tool (takedown.js): read-only, through both doors.

const { pluginVersion } = require("../lib/version.js");
const { takeDown } = require("./takedown.js");

// The registry's helpers, read when the tool runs: lib/tools.js lists this tool, so it is still
// loading when this file is.
function registry() {
  return require("../lib/tools.js");
}

function takeDownTool(args = {}) {
  const { deskFor, onlyArguments } = registry();
  onlyArguments("take_down", args, ["desk"]);
  const desk = deskFor(args.desk);
  return { tool: "take_down", plugin_version: pluginVersion(), ...takeDown(desk) };
}

const TOOLS = [
  {
    name: "take_down",
    description:
      "Say what a person removes to take this desk out, in order and where, and what stays " +
      "because it is the firm's. It removes nothing and writes nothing. The steps: one line " +
      "for any connection made after the set-up, then each connector the desk's systems table " +
      "names, whatever state the set-up recorded it in, its rows in reverse, disconnected in " +
      "the harness's own settings; this machine's seat pointer (and its folder, when the set-up made it and it " +
      "holds nothing else); the plugin; and last the desk folder, only where the set-up record " +
      "says the set-up made it, else what the desk put in it (the folder celorus, its scratch " +
      "folder .celorus, and its lines in the file .gitignore), the folder staying. A path where " +
      "a link, a file with another name, or the other kind now stands is never named: it stays, " +
      "left alone. Paths are desk-relative, the seat pointer's home-relative, with no trailing slash.",
    inputSchema: {
      type: "object",
      properties: {
        desk: {
          type: "string",
          description:
            "The desk folder (the one holding celorus/index.md), as a full path. Leave it out to " +
            "use CELORUS_DESK, or the desk found above the working folder when this server knows it.",
        },
      },
      additionalProperties: false,
    },
    run: takeDownTool,
  },
];

module.exports = { TOOLS };
