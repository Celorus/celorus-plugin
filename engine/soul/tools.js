"use strict";
// The soul's tools, served by both doors: lib/tools.js takes this list by one load and one spread
// (the base's ruling R1). read_soul reads; soul_feedback writes (door.js).

const { DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { MANNER_KEYS, MANNER_WORDS } = require("../lib/persona.js");
const { soulFeedback, readSoul, FEEDBACK, READ } = require("./door.js");

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
  {
    name: FEEDBACK,
    description:
      "Change how the assistant speaks, from the seat's own feedback, in one of four ways: brevity " +
      `(${MANNER_WORDS.brevity.join(", ")}), address (what it calls the seat), explain ` +
      `(${MANNER_WORDS.explain.join(", ")}) or language. The change is held for that seat alone, on ` +
      "celorus/manner/<seat>-manner.md; with whole_desk true it is the desk's, in the header of celorus/soul.md, and a " +
      "seat's own value still wins for that seat. address is only ever the seat's own: it is refused with whole_desk. " +
      "A value already held writes nothing. undo: true puts back the values before the last change, for the " +
      "seat or the whole desk, and a second undo swaps back. Feedback cannot change the honesty lines or the " +
      "personal-talk rule: such a change is refused with the reason, and so is any other key. The soul's text is " +
      "never changed. Writes its line in log.md, naming the key and the seat, never the value. What the seat says " +
      "about themselves is never written to the desk: leave it out of every field.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        at: {
          type: "string",
          description:
            "When the feedback was given, with its own offset, as 2026-09-21T10:30:00+05:30. A time with no offset is refused.",
        },
        seat: { ...SEAT, description: "The seat giving the feedback, by its handle: the name of one of the desk's seat pages." },
        change: {
          type: "object",
          description:
            `{ key, value }: the key one of ${MANNER_KEYS.join(", ")}; brevity and explain take a word from their ` +
            "lists, address and language a short name form the pages can say. Leave it out with undo.",
          properties: {
            key: { type: "string", enum: [...MANNER_KEYS] },
            value: { type: "string" },
          },
          required: ["key", "value"],
          additionalProperties: false,
        },
        undo: { type: "boolean", description: "True puts back the values before the last change; leave change out." },
        whole_desk: {
          type: "boolean",
          description: "True changes the desk's brevity, explain or language, for every seat without its own value; left out, the seat's own.",
        },
      },
      required: ["at", "seat"],
      additionalProperties: false,
    },
    run: soulFeedback,
  },
];

module.exports = { TOOLS };
