"use strict";
// list_routines as a desk tool, on the laptop's table (lib/tools.js). It sat in
// overnight/tools.js until E5b-1 (the base's verdict c/6284330827 V1 and V8, and
// checkpoint 1): the overnight runs on our server and that file is held back from the published
// plugin, while list_routines says whether each routine's folder is still on this machine, which
// only this machine can see (the server holds it on the laptop).
//
// lib/tools.js loads this file, so its helpers are reached when the tool runs, never at load.

const { DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { pluginVersion } = require("../lib/version.js");
const R = require("./routines.js");

const TOOLS = [
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
      const { deskFor, onlyArguments } = require("../lib/tools.js");
      onlyArguments("list_routines", args, ["desk"]);
      const root = deskFor(args.desk);
      return { tool: "list_routines", plugin_version: pluginVersion(), ...R.listRoutines(root) };
    },
  },
];

module.exports = { TOOLS };
