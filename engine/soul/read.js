"use strict";
// read_soul as a desk tool, on the laptop's table (lib/tools.js). It sat in soul/tools.js beside
// soul_feedback until E5b-1 (the base's verdict c/6284330827 V1, and checkpoint 1):
// soul_feedback writes and is made on our server, and that file is held back from the published
// plugin, while read_soul reads and stays here (door.js).

const { DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { MANNER_KEYS } = require("../lib/persona.js");
const { readSoul, READ } = require("./door.js");

const SEAT = { type: "string", description: "The seat, by its handle: the name of one of the desk's seat pages." };

const TOOLS = [
  {
    name: READ,
    description:
      "Read how the assistant speaks on this desk, before the first answer of a session: its name, the soul it " +
      "speaks from (the one this plugin ships, with the desk's own assistant name in it), and the seat's manner, " +
      `${MANNER_KEYS.join(", ")}: each the seat's own where set, else the desk's, else unset (null). The soul's ` +
      "text is always the shipped one; celorus/soul.md holds a copy for reading, and is never read as the soul. " +
      "Nothing is written.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        seat: { ...SEAT, description: "The seat the assistant speaks to, by its handle; left out, only the desk's manner is read." },
      },
      additionalProperties: false,
    },
    run: readSoul,
  },
];

module.exports = { TOOLS };
