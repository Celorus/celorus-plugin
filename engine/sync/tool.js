"use strict";
// desk_sync as a desk tool, on the laptop's table (lib/tools.js). It sat in write/tools.js beside
// the writers until E5b-1 (the base's verdict c/6284330827 V1 and checkpoint 1): the
// writers are made on our server and that file is held back from the published plugin, while
// desk_sync answers git commands for this machine and stays here.
//
// lib/tools.js loads this file, so its helpers are reached when the tool runs, never at load.

const path = require("node:path");
const { deskShown, DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { pluginVersion } = require("../lib/version.js");
const { deskSync } = require("./sync.js");

const SEAT = { type: "string", description: "The seat making the change: the name of one of the desk's seat pages." };
const TEXT = (description) => ({ type: "string", description });

const TOOLS = [
  {
    name: "desk_sync",
    description:
      "Answer the git commands that commit the desk as the seat, for the skill to run in order, " +
      "filling each word in braces from the line an earlier command printed; the engine runs none. Only what every seat shares is staged, by name: a seat's own pages " +
      "(celorus/.views) never are, pages only the overnight may change (families/, people/, firms/) " +
      "and its merge record are held back, and a file desk_sync's table does not name is left out and named. overnight " +
      "is true only from the overnight skill, after its run: then those pages and the merge record are staged too. push is " +
      "true only when the person has just asked, in words, for the " +
      "desk to go up: then the pull and the push are answered too, to the branch's upstream alone." +
      " What the seat says about themselves is never written to the desk: leave it out of every field.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        seat: SEAT,
        message: TEXT("The commit message: what changed on the desk, in a sentence."),
        push: { type: "boolean", description: "True only when the person has just asked, in words, for the desk to go up." },
        overnight: {
          type: "boolean",
          description: "True only from the overnight skill, after its run: the family, person and firm pages and the merge record, which only the overnight commits, are staged too.",
        },
      },
      required: ["seat", "message"],
      additionalProperties: false,
    },
    run(args = {}) {
      const { deskFor, deskNamed, onlyArguments } = require("../lib/tools.js");
      onlyArguments("desk_sync", args, ["desk", "seat", "message", "push", "overnight"]);
      const version = pluginVersion();
      const root = deskFor(args.desk, { writes: true });
      return deskSync({ version, root, celorus: path.join(root, "celorus"), shown: deskShown(deskNamed(args.desk), root) }, args);
    },
  },
];

module.exports = { TOOLS };
