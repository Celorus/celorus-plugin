"use strict";
// The writers and the sync as desk tools, served by both doors: lib/tools.js takes this list
// by one load and one spread (the base's ruling R1). Tool names and their inputs are the
// demo's (milan.py), with two more on every writer: `desk`, as every desk tool takes it, and
// `at`, the time of the change with its own offset, which every writer needs (ruling R6).
//
// lib/tools.js loads this file, so its helpers are reached when a tool runs, never at load.

const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot } = require("../lib/linkedroot.js");
const { deskShown, DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { pluginVersion } = require("../lib/version.js");
const { readAt } = require("./text.js");
const { deskMd } = require("./facts.js");
const W = require("./writers.js");
const { deskSync } = require("../sync/sync.js");

const AT = {
  type: "string",
  description:
    "When the change happened, with its own offset, as 2026-09-21T10:30:00+05:30. The desk " +
    "writes it at that offset. A time with no offset is refused.",
};
const SEAT = { type: "string", description: "The seat making the change: the name of one of the desk's seat pages." };
const TEXT = (description) => ({ type: "string", description });

function context(tool, args, allowed) {
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(tool, args, allowed);
  const at = readAt(args.at);
  if (at === null) {
    throw new Refusal(
      `\`at\` is when the change happened, with its own offset, as 2026-09-21T10:30:00+05:30; got ${JSON.stringify(args.at)}. Nothing was written.`,
    );
  }
  const version = pluginVersion();
  if (version === "unknown") {
    throw new Refusal("The plugin's version is not known, so no page could carry generated_by. Nothing was written.");
  }
  const root = deskFor(args.desk, { writes: true });
  // A celorus/, celorus/views/ or celorus/log.md that is a link is refused here, before anything
  // is read for writing, in the words every writer refuses it in (lib/linkedroot.js, rule C2).
  // A folder under celorus/ that a writer writes a page under is refused by the writer itself,
  // once it knows the page (writers.js), through the same helper.
  refuseLinkedRoot(root);
  const celorus = path.join(root, "celorus");
  // The call's one read of desk.md, through its checks (facts.js deskMd): the seats and the
  // footer come from it, and nothing in this call reads desk.md again.
  const desk = deskMd(celorus, "Nothing was written.");
  // `shown`: how the answer names a page it wrote (R72, lib/desk.js deskShown).
  const shown = deskShown(args.desk, root);
  return { tool, version, root, celorus, at, desk, shown, footer: desk.footer, generatedBy: `celorus-plugin ${version} ${tool}`, logLine: null };
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
    "write_conversation",
    "Write a conversation page for a call or meeting, and its line in log.md. named: [{slug, name, " +
      "note}], people of the family named on the call; heard: [{subject, connection, target, words, " +
      "said_by}]. Refused before anything is written: a seat or page not on the desk, and words the " +
      "screen refuses. Answers the page's path.",
    {
      seat: SEAT,
      family: TEXT("The family's page slug."),
      channel: TEXT("call or meeting."),
      title: TEXT("The conversation's title."),
      summary: TEXT("One or two sentences on what the conversation was."),
      attended: { type: "array", items: { type: "string" }, description: "The pages of the people on the call besides the seat; [] when none." },
      named: { type: "array", items: { type: "object" }, description: "[{slug, name, note}]: people of the family named on the call." },
      said: { type: "array", items: { type: "string" }, description: "The lines said, each labelled with its speaker as the desk writes them." },
      heard: { type: "array", items: { type: "object" }, description: "[{subject, connection, target, words, said_by}]." },
      recorded: { type: "boolean", description: "Whether the call was recorded; true when left out." },
    },
    ["seat", "family", "channel", "title", "summary", "attended"],
    W.writeConversation,
  ),
  writer(
    "log_action",
    "Add a desk-log row, and its line in log.md: mail, call, meeting-set, handed-over, meeting-held, " +
      "reply, prospect-created or book-moment. A hand-over's outcome is \"to <handle>\", the handle of " +
      "a seat on this desk, never the person's name.",
    {
      seat: SEAT,
      family: TEXT("The family's page slug."),
      action: TEXT("mail, call, meeting-set, handed-over, meeting-held, reply, prospect-created or book-moment."),
      outcome: TEXT("What came of it, in a few words."),
      minutes: { type: "integer", description: "Minutes spent, or left out." },
    },
    ["seat", "family", "action", "outcome"],
    W.logAction,
  ),
  writer(
    "add_follow_up",
    "Add a follow-up owed by us or them, due by a date, from a conversation page the desk has, and " +
      "its line in log.md.",
    {
      seat: SEAT,
      owed_by: TEXT("us or them."),
      who: TEXT("The page slug of whom it is owed to or by."),
      what: TEXT("What is owed."),
      by: TEXT("The date it is due, as 2026-09-21."),
      conversation: TEXT("The slug of the conversation page that made the promise."),
    },
    ["seat", "owed_by", "who", "what", "by", "conversation"],
    W.addFollowUp,
  ),
  writer(
    "assign_lead",
    "Give a family to a seat, from a named list: a row in queues/supplied.md, and its line in log.md.",
    {
      by_seat: TEXT("The seat giving the lead."),
      family: TEXT("The family's page slug."),
      to_seat: TEXT("The seat the lead is given to."),
      list_name: TEXT("The name of the list the lead came from."),
    },
    ["by_seat", "family", "to_seat", "list_name"],
    W.assignLead,
  ),
  writer(
    "write_brief",
    "Save a room brief (kind room) or a reach-out card (kind reach-out) for a family: sections " +
      "[{heading, paragraphs}]. Answers the page's path, and its line in log.md. Unlike the demo's writer, a " +
      "brief already made today is never written over for another seat, and is rewritten for the same seat only " +
      "with replace: true, which loses any notes added by hand to it.",
    {
      seat: SEAT,
      family: TEXT("The family's page slug."),
      kind: TEXT("room or reach-out."),
      sections: { type: "array", items: { type: "object" }, description: "[{heading, paragraphs}]: each heading, and its paragraphs as a list of text." },
      meeting_on: TEXT("The meeting's date, as 2026-09-21, or left out."),
      replace: {
        type: "boolean",
        description: "True only when the person has asked to rewrite this seat's brief of today: the whole page is rewritten, and notes added by hand to it are lost.",
      },
    },
    ["seat", "family", "kind", "sections"],
    W.writeBrief,
  ),
  {
    name: "desk_sync",
    description:
      "Answer the git commands that commit the desk as the seat, for the skill to run in order, " +
      "filling each word in braces from the line an earlier command printed; the engine runs none. Only what every seat shares is staged, by name: a seat's own pages " +
      "(celorus/.views) never are, pages only the overnight may change (families/, people/, firms/) " +
      "are held back, and a file desk_sync's table does not name is left out and named. push is " +
      "true only when the person has just asked, in words, for the " +
      "desk to go up: then the pull and the push are answered too, to the branch's upstream alone.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        seat: SEAT,
        message: TEXT("The commit message: what changed on the desk, in a sentence."),
        push: { type: "boolean", description: "True only when the person has just asked, in words, for the desk to go up." },
      },
      required: ["seat", "message"],
      additionalProperties: false,
    },
    run(args = {}) {
      const { deskFor, deskNamed, onlyArguments } = require("../lib/tools.js");
      onlyArguments("desk_sync", args, ["desk", "seat", "message", "push"]);
      const version = pluginVersion();
      const root = deskFor(args.desk);
      return deskSync({ version, root, celorus: path.join(root, "celorus"), shown: deskShown(deskNamed(args.desk), root) }, args);
    },
  },
];

module.exports = { TOOLS };
