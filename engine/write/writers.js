"use strict";
// The desk's writers: a conversation page, a desk-log row, a follow-up, a supplied lead and a
// brief. Ported from the demo kit's writers, whose output on the synthetic desk they equal,
// byte for byte, apart from the differences the tests name.
//
// Every writer refuses before anything is written: a seat that is not one of the desk's seats
// (house rule 6, the refusal naming them), a slug that is not a page of the desk, a word off
// its fixed list, a time with no offset, and words the screen refuses (screen.js). A link is
// refused up front too, as the 0.18 writers refuse it (rule C2, lib/linkedroot.js): celorus/,
// celorus/views/ and celorus/log.md at the door (tools.js), and a folder under celorus/ that a
// page of the call sits in here, before the first page is read for writing. Then it
// writes its page and, last, its line in log.md (house rule 5); a failure takes the page back
// (pages.js). Every page it makes or rewrites carries `generated_by: celorus-plugin <version>
// <tool>` (gate G5): on a register that carries a header (desk-log.md, the queues) the stamp
// names the last tool that wrote it (the base's ruling R5). log.md alone carries no stamp: the
// rules want it to have no header (check/rules.js), so it cannot carry one.

const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedFolders } = require("../lib/linkedroot.js");
const T = require("./text.js");
const { SAY_INSTEAD, nameFold, screened, unpathed } = require("./screen.js");
const { seatHandles, seatsOf, seatsNamed, isPage, titleOf, familyPeople } = require("./facts.js");
const { fileOf, generatedByOf, headerOf, readOwned, withGeneratedBy, writeSteps } = require("./pages.js");
const { linksIn } = require("../check/text.js");
const fs = require("node:fs");

const DESK_LOG = "desk-log.md";
const FOLLOW_UPS = "queues/follow-ups.md";
const SUPPLIED = "queues/supplied.md";
const LOG = "log.md";

// The skill each desk-log action is logged under; the actions are its keys. An action is logged
// under the plugin skill that teaches it, and one no plugin skill teaches under the tool itself,
// `log_action`, so log.md never names a writer that did not run.
const SKILL = {
  mail: "call-review",
  call: "call-review",
  "meeting-set": "call-review",
  "handed-over": "log_action",
  "meeting-held": "call-review",
  reply: "log_action",
  "prospect-created": "log_action",
  "book-moment": "log_action",
  "crm-merged": "log_action",
};
const ACTIONS = Object.keys(SKILL);
// The name each brief kind is logged under, by the same rule: no plugin skill teaches a kind,
// so each is logged under the tool, `write_brief`. The kinds are its keys.
const BRIEF_SKILL = { room: "write_brief", "reach-out": "write_brief" };
// The name each of the other writers is logged under, by the same rule: `add_follow_up` under
// follow-up, which teaches it; the rest, which no plugin skill names, under the tool itself.
const LOGGED_AS = {
  write_conversation: "write_conversation",
  add_follow_up: "follow-up",
  assign_lead: "assign_lead",
};
const OWED_BY = ["us", "them"];
const CHANNELS = ["call", "meeting"];
const BRIEF_KINDS = Object.keys(BRIEF_SKILL);
const CONNECTION = /^[a-z_]+$/u;
// The stamp of a brief write_brief made, by any version of the plugin.
const MADE_BY_WRITE_BRIEF = /^celorus-plugin [^ ]+ write_brief$/u;

// What to write instead of a conversation's words the screen refuses: the kit's, and for a
// said line labelled with a speaker who is not on the desk.
const CONVERSATION_INSTEAD = {
  ...SAY_INSTEAD,
  email: "leave the address out: a conversation page names people, never their addresses",
};
const REAL_NAME_INSTEAD =
  "a transcript labels its speakers with the real people in the room: write each line as the " +
  "made-up person on this desk it stands for, and send the conversation again";

const NOTHING = "Nothing was written.";

function refuse(message) {
  throw new Refusal(message);
}

// Refuses a seat that is not one of the desk's, naming them, or, when the desk has none, why
// (facts.js seatsOf).
function heldSeat(what, value, seats) {
  if (typeof value !== "string" || !seats.handles.includes(value)) {
    refuse(`${what} must be a seat handle, one of: ${seatsNamed(seats)}; got ${JSON.stringify(value)}. ${NOTHING}`);
  }
}

// Refuses a slug that is not a page of this desk, and a word off its fixed list. The refusal
// names where, and never the value, which may have come from a call.
function heldPage(ctx, what, slug) {
  if (!isPage(ctx.celorus, ctx.desk, slug)) {
    refuse(
      `${what} is not a page on this desk: pass the slug of a family, person, firm or seat page ` +
        `it already has, as family_facts answers them. ${NOTHING}`,
    );
  }
}

function heldWord(what, value, listed) {
  if (!listed.includes(value)) refuse(`${what} must be one of: ${listed.join(", ")}. ${NOTHING}`);
}

function heldText(what, value) {
  if (typeof value !== "string") refuse(`${what} is text. ${NOTHING}`);
}

function screen(words, instead, done) {
  const said = screened(words, instead, done);
  if (said) refuse(said);
}

// The seat a hand-over's outcome names, `to <handle>`, when it is a seat of the desk.
function handedTo(outcome, seats) {
  const m = /^to ([a-z0-9][a-z0-9-]*)$/u.exec(T.clean(outcome));
  return m && seats.handles.includes(m[1]) ? m[1] : null;
}

// The step that adds `line` to log.md: rewritten in place, or created when the desk has none.
function logStep(ctx, handle, skill, what) {
  const line = T.logLine(ctx.at.clock, handle, skill, what);
  const owned = readOwned(ctx.celorus, LOG, ctx.desk.id);
  if (owned && owned.refused) refuse(owned.refused);
  const text = T.withLogLine(owned ? owned.text : null, ctx.at.date, ctx.at.clock, line, ctx.footer);
  return { step: owned ? { kind: "rewrite", rel: LOG, raw: owned.raw, text } : { kind: "create", rel: LOG, text }, line };
}

// The step that adds a row to a register's table, with the register's stamp naming this tool,
// and the row as written, its keys the table's columns in their order. `rowFor` is the row, or
// makes it from the table's columns. A row whose keys are not the table's columns is refused,
// naming them, and so is a register holding a character read as a line break: every line
// already there is kept as it was, never split again or torn (R6).
function registerStep(ctx, rel, rowFor) {
  const owned = readOwned(ctx.celorus, rel, ctx.desk.id);
  if (owned === null) refuse(`${rel} is not on this desk, so the row has nowhere to go. ${NOTHING}`);
  if (owned.refused) refuse(owned.refused);
  const broken = T.lineBreakIn(owned.text);
  if (broken) refuse(`${rel} holds ${broken}, which reads as a line break, so a row could be torn in two. ${NOTHING}`);
  const columns = T.tableColumns(owned.text);
  if (columns === null) refuse(`${rel} has no table, so the row has nowhere to go. ${NOTHING}`);
  // The columns are the first table's and the row goes after the last table line, so a page of
  // more than one table (its "|" lines not one run) is refused: the row would sit under columns
  // it was never held to.
  if (T.tableRuns(owned.text) > 1) {
    refuse(`${rel} holds more than one table (its lines that start with "|" are not one run), so the row has no one table to go in. ${NOTHING}`);
  }
  const given = typeof rowFor === "function" ? rowFor(columns) : rowFor;
  const keys = Object.keys(given);
  if (new Set(columns).size !== columns.length || columns.length !== keys.length || !keys.every((key) => columns.includes(key))) {
    refuse(`${rel} has the columns ${columns.join(", ")}, and this row has ${keys.join(", ")}, so the row has nowhere to go. ${NOTHING}`);
  }
  const row = Object.fromEntries(columns.map((column) => [column, given[column]]));
  const stamped = withGeneratedBy(rel, T.withRows(owned.text, [row]), ctx.generatedBy);
  if (stamped.refused) refuse(stamped.refused);
  return { step: { kind: "rewrite", rel, raw: owned.raw, text: stamped.text }, row };
}

// The answer every writer gives: the pages written, or why nothing was. The desk is named by
// desk.md's desk: (or null), never by its folder (0.19.0 round 1 readers, K4).
// A row the answer echoes says a tilde path the model sent as "(a path)", as the history line does
// (R73: no answer repeats a path); the page keeps the words as sent.
function answer(ctx, done, page, extra) {
  const echoed = extra && extra.row ? { ...extra, row: Object.fromEntries(Object.entries(extra.row).map(([k, v]) => [k, unpathed(v)])) } : extra;
  const base = { tool: ctx.tool, plugin_version: ctx.version, desk: ctx.desk.name, ...echoed };
  if (done.written === null) {
    return { ...base, written: null, page: null, path: null, history: null, reason: done.reason, previous_text: done.previous_text };
  }
  return {
    ...base,
    written: done.written,
    page,
    // The page to show: the caller's `desk` extended, or desk-relative (R72, lib/desk.js deskShown).
    path: ctx.shown.at(`celorus/${page}`),
    history: { page: LOG, line: unpathed(ctx.logLine) },
    reason: null,
    previous_text: null,
  };
}

function run(ctx, steps, page, extra) {
  return answer(ctx, writeSteps(ctx.celorus, steps), page, extra);
}

// One desk-log row. The outcome is the model's words, held to the screen first.
function logAction(ctx, { seat, family, action, outcome, minutes }) {
  heldText("the outcome", outcome);
  screen([["the outcome", outcome]]);
  const seats = seatsOf(ctx.celorus, ctx.desk);
  heldSeat("seat", seat, seats);
  heldPage(ctx, "the family", family);
  heldWord("the action", action, ACTIONS);
  if (minutes !== undefined && minutes !== null && !Number.isSafeInteger(minutes)) {
    refuse(`minutes is a whole number of minutes, or left out. ${NOTHING}`);
  }
  if (action === "handed-over" && handedTo(outcome, seats) === null) {
    refuse(`a hand-over's outcome must be 'to <handle>', one of: ${seatsNamed(seats)}; got ${JSON.stringify(unpathed(outcome))}. ${NOTHING}`);
  }
  // desk-log.md and log.md sit in celorus/ itself, under no folder of their own: the door's
  // refusal of a linked celorus/ or log.md (tools.js) is this writer's whole link check.
  const { step, row } = registerStep(ctx, DESK_LOG, {
    date: ctx.at.date,
    seat,
    lead: `[[${family}]]`,
    source: "desk",
    minutes: minutes === undefined ? null : minutes,
    action,
    outcome: T.clean(outcome),
    mark: null,
    by: seat,
  });
  const log = logStep(ctx, seat, SKILL[action], `${action} [[${family}]]: ${outcome}`);
  ctx.logLine = log.line;
  return run(ctx, [step, log.step], DESK_LOG, { row });
}

// One promise, from the conversation that made it.
function addFollowUp(ctx, { seat, owed_by: owedBy, who, what, by, conversation }) {
  heldText("what is owed", what);
  screen([["what is owed", what]]);
  if (!OWED_BY.includes(owedBy)) refuse(`owed_by must be one of: ${OWED_BY.join(", ")}; got ${JSON.stringify(owedBy)}. ${NOTHING}`);
  heldPage(ctx, "who", who);
  heldSeat("the seat", seat, seatsOf(ctx.celorus, ctx.desk));
  const conv = T.unlink(conversation);
  if (typeof conversation !== "string" || !T.HANDLE.test(conv) || !fs.existsSync(fileOf(ctx.celorus, `conversations/${conv}.md`))) {
    refuse(
      `no conversation page ${JSON.stringify(conv)} on this desk: a follow-up comes from the conversation ` +
        "that made the promise, so write the conversation first and pass the slug it answers",
    );
  }
  const due = typeof by === "string" ? T.readDate(by) : null;
  if (due === null) refuse(`by is the date the follow-up is due, as 2026-09-21. ${NOTHING}`);
  refuseLinkedFolders(ctx.celorus, [FOLLOW_UPS, LOG]);
  const { step, row } = registerStep(ctx, FOLLOW_UPS, {
    owed_by: owedBy,
    who: `[[${who}]]`,
    what: T.clean(what),
    by: due,
    from: `[[${conv}]]`,
    state: "due",
  });
  const log = logStep(ctx, seat, LOGGED_AS.add_follow_up, `follow-up owed by ${owedBy} to [[${who}]], by ${due}: ${what}`);
  ctx.logLine = log.line;
  return run(ctx, [step, log.step], FOLLOW_UPS, { row });
}

// One supplied lead: a family given to a seat from a named list. The register holds the seat
// only when its table has a seat column, as the demo's does not; the seat is then said only in
// log.md, and the answer's row is exactly what the register holds.
function assignLead(ctx, { by_seat: bySeat, family, to_seat: toSeat, list_name: listName }) {
  heldText("the list's name", listName);
  screen([["the list's name", listName]]);
  const seats = seatsOf(ctx.celorus, ctx.desk);
  heldSeat("to_seat", toSeat, seats);
  heldPage(ctx, "the family", family);
  heldSeat("by_seat", bySeat, seats);
  refuseLinkedFolders(ctx.celorus, [SUPPLIED, LOG]);
  const { step, row } = registerStep(ctx, SUPPLIED, (columns) => ({
    lead: `[[${family}]]`,
    list: T.clean(listName),
    date: ctx.at.date,
    state: "assigned",
    ...(columns.includes("seat") ? { seat: toSeat } : {}),
  }));
  const log = logStep(ctx, bySeat, LOGGED_AS.assign_lead, `assigned [[${family}]] to ${toSeat} (${listName})`);
  ctx.logLine = log.line;
  return run(ctx, [step, log.step], SUPPLIED, { row });
}

// Every piece of text a conversation page will carry, each with the words naming where it sits.
function conversationWords({ family, channel, title, summary, attended, named, said, heard }) {
  const out = [
    ["the family", family],
    ["the channel", channel],
    ["the title", title],
    ["the summary", summary],
  ];
  attended.forEach((p, i) => out.push([`attended ${i + 1}`, p]));
  said.forEach((s, i) => out.push([`said line ${i + 1}`, s]));
  named.forEach((x, i) => ["slug", "name", "note"].forEach((k) => out.push([`the ${k} of named person ${i + 1}`, x[k]])));
  heard.forEach((h, i) => ["subject", "target", "words", "said_by"].forEach((k) => out.push([`the ${k} of heard item ${i + 1}`, h[k]])));
  return out.filter(([, text]) => text).map(([where, text]) => [where, String(text)]);
}

// The case-folded names a said line may be labelled with: each seat by its handle, title and
// first name, and each person the family page lists, by title and first name.
function speakers(ctx, family) {
  const { celorus, footer } = ctx;
  const names = new Set(seatHandles(celorus, ctx.desk));
  const people = [...names, ...familyPeople(celorus, family, footer)];
  for (const slug of people) {
    const title = fold(nameFold(titleOf(celorus, slug)));
    if (title) {
      names.add(title);
      names.add(title.split(" ")[0]);
    }
  }
  return names;
}

// Case folding as the demo did it (Python's casefold), for the labels of said lines.
function fold(text) {
  return text.toUpperCase().toLowerCase();
}

// A said line's speaker label, folded: what stands before its first colon, when that is one to
// four words.
function speaker(line) {
  const at = line.indexOf(":");
  if (at === -1) return null;
  const head = line.slice(0, at);
  const words = T.pySplit(head).length;
  return words >= 1 && words <= 4 ? fold(nameFold(head)) : null;
}

function listOf(what, value, check) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) refuse(`${what} is a list. ${NOTHING}`);
  value.forEach(check);
  return value;
}

function needs(item, keys, what) {
  const isObject = item !== null && typeof item === "object" && !Array.isArray(item);
  const missing = keys.filter((k) => !(isObject && item[k]));
  if (missing.length) refuse(`a ${what} needs ${keys.join(", ")}; one has no ${missing.join(", ")}. ${NOTHING}`);
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined && v !== null && typeof v !== "string") refuse(`the ${k} of a ${what} is text. ${NOTHING}`);
  }
}

function proofLine(connection, target, date, conversation, words, saidBy) {
  const parts = [target ? `- ${connection} [[${target}]]` : `- ${connection}`, "said", "yours", date];
  if (conversation) parts.push(`in [[${conversation}]]`);
  if (words) parts.push(`"${words}"`);
  if (saidBy) parts.push(`said by [[${saidBy}]]`);
  return parts.join(T.DOT);
}

// One conversation page.
function writeConversation(ctx, args) {
  const { seat, family, channel, title, summary } = args;
  const recorded = args.recorded === undefined || args.recorded === null ? true : args.recorded;
  if (typeof recorded !== "boolean") refuse(`recorded is true or false. ${NOTHING}`);
  heldSeat("seat", seat, seatsOf(ctx.celorus, ctx.desk));
  for (const [what, value] of [["the family", family], ["the channel", channel], ["the title", title], ["the summary", summary]]) {
    heldText(what, value);
  }
  if (args.attended === undefined || args.attended === null) {
    refuse(`attended is the list of the pages of the people on the call besides the seat, [] when none. ${NOTHING}`);
  }
  const attended = listOf("attended", args.attended, (p) => heldText("each attended", p));
  const said = listOf("said", args.said, (s) => heldText("each said line", s));
  const named = listOf("named", args.named, (x) => needs(x, ["slug", "name"], "named person"));
  const heard = listOf("heard", args.heard, (h) => needs(h, ["subject", "connection", "words"], "heard item"));
  screen(conversationWords({ family, channel, title, summary, attended, named, said, heard }), CONVERSATION_INSTEAD);
  const fresh = new Set(named.map((x) => x.slug));
  if (![...fresh].every((slug) => T.HANDLE.test(slug))) {
    refuse(`the slug of a named person is lowercase words joined by hyphens, like the name it stands for. ${NOTHING}`);
  }
  heldPage(ctx, "the family", family);
  attended.forEach((p, i) => heldPage(ctx, `attended ${i + 1}`, p));
  heard.forEach((h, i) => {
    for (const k of ["subject", "target", "said_by"]) {
      if (h[k] && !fresh.has(h[k])) heldPage(ctx, `the ${k} of heard item ${i + 1}`, h[k]);
    }
  });
  heldWord("the channel", channel, CHANNELS);
  heard.forEach((h, i) => {
    if (!CONNECTION.test(h.connection)) {
      refuse(`the connection of heard item ${i + 1} is one word of lowercase letters and underscores, as knows or works_at. ${NOTHING}`);
    }
  });
  const labels = said.flatMap((line, i) => {
    const label = speaker(line);
    return label === null ? [] : [[i + 1, label]];
  });
  const known = labels.length ? speakers(ctx, family) : new Set();
  for (const [i, label] of labels) {
    if (!known.has(label)) {
      refuse(
        `said line ${i} is labelled with a speaker who is not on this desk: label each line with the seat's ` +
          `name or a person of this family as the desk writes them; ${REAL_NAME_INSTEAD}. ${NOTHING}`,
      );
    }
  }
  let slug = `${ctx.at.date}-${family}-${channel}`;
  for (let n = 2; exists(ctx, `conversations/${slug}.md`); n += 1) slug = `${ctx.at.date}-${family}-${channel}-${n}`;
  refuseLinkedFolders(ctx.celorus, [`conversations/${slug}.md`, LOG]);
  const header = {
    type: "conversation",
    title: T.clean(title),
    description: T.clean(summary),
    timestamp: T.stamp(ctx.at.iso),
    date: T.stamp(ctx.at.date),
    channel,
    about: T.link(family),
    attended: [T.link(seat), ...attended.map(T.link)],
    named: named.length ? named.map((x) => T.link(x.slug)) : null,
    recorded,
    timestamps: false,
    speakers_separated: false,
    generated_by: ctx.generatedBy,
  };
  const lines = [`# ${T.clean(title)}`, "", T.clean(summary), "", "## What was said", ""];
  lines.push(...(said.length ? said.map((s) => `- ${T.clean(s)}`) : ["- Not recorded word for word."]));
  if (named.length) {
    lines.push("", "## Named on this call", "");
    lines.push(...named.map((x) => `- [[${x.slug}]] ${T.clean(x.name)}${x.note ? `, ${T.clean(x.note)}` : ""}`));
  }
  if (heard.length) {
    lines.push("", "## Heard on this call", "");
    for (const h of heard) {
      const line = proofLine(h.connection, h.target, ctx.at.date, slug, T.clean(h.words).split('"').join("'"), h.said_by);
      lines.push(`- [[${h.subject}]] ${line.slice(2)}`);
    }
  }
  if (ctx.footer !== null) lines.push("", ctx.footer);
  const rel = `conversations/${slug}.md`;
  const page = { kind: "create", rel, text: T.pageText(header, lines.join("\n")) };
  const log = logStep(ctx, seat, LOGGED_AS.write_conversation, `wrote [[${slug}]]`);
  ctx.logLine = log.line;
  return run(ctx, [page, log.step], rel, { conversation: slug });
}

function exists(ctx, rel) {
  try {
    fs.lstatSync(fileOf(ctx.celorus, rel));
    return true;
  } catch {
    return false;
  }
}

// A room brief (kind room) or a reach-out card (kind reach-out); sections [{heading, paragraphs}].
function writeBrief(ctx, args) {
  const { seat, family, kind } = args;
  const sections = listOf("sections", args.sections, (s) => {
    const ok =
      s !== null &&
      typeof s === "object" &&
      typeof s.heading === "string" &&
      s.heading !== "" &&
      Array.isArray(s.paragraphs) &&
      s.paragraphs.every((p) => typeof p === "string");
    if (!ok) refuse(`each section is {heading, paragraphs}: a heading, and its paragraphs as a list of text. ${NOTHING}`);
  });
  heldText("the family", family);
  const words = [["the family", family]];
  sections.forEach((s, i) => {
    words.push([`the heading of section ${i + 1}`, s.heading]);
    s.paragraphs.forEach((p, j) => words.push([`paragraph ${j + 1} of section ${i + 1}`, p]));
  });
  screen(words.filter(([, text]) => text));
  heldSeat("seat", seat, seatsOf(ctx.celorus, ctx.desk));
  heldPage(ctx, "the family", family);
  heldWord("the kind", kind, BRIEF_KINDS);
  const replace = args.replace === undefined || args.replace === null ? false : args.replace;
  if (typeof replace !== "boolean") refuse(`replace is true or false, or left out. ${NOTHING}`);
  let meetingOn = null;
  if (args.meeting_on !== undefined && args.meeting_on !== null && args.meeting_on !== "") {
    meetingOn = typeof args.meeting_on === "string" ? T.readDate(args.meeting_on) : null;
    if (meetingOn === null) refuse(`meeting_on is the meeting's date, as 2026-09-21, or left out. ${NOTHING}`);
  }
  const slug = `${ctx.at.date}-${family}-${kind}`;
  const name = kind === "room" ? "room brief" : "reach-out card";
  const title = `${titleOf(ctx.celorus, family)}, ${name}`;
  const header = {
    type: "brief",
    title,
    description: `The ${name} for [[${family}]]`,
    timestamp: T.stamp(ctx.at.iso),
    about: T.link(family),
    brief_kind: kind,
    for_seat: T.link(seat),
    meeting_on: meetingOn === null ? null : T.stamp(meetingOn),
    generated_by: ctx.generatedBy,
  };
  const parts = [`# ${title}`];
  for (const s of sections) {
    parts.push(`## ${T.clean(s.heading)}`);
    parts.push(...s.paragraphs.map(T.pyStrip).filter((p) => p));
  }
  if (ctx.footer !== null) parts.push(ctx.footer);
  const rel = `briefs/${slug}.md`;
  const text = T.pageText(header, parts.join("\n\n"));
  // A brief's page name carries no seat, so a brief already at its path is written over only
  // when it is write_brief's own page (its header naming write_brief as the tool that made it),
  // made for this seat, and the call says replace: true, since a rewrite loses any notes added
  // by hand to its body. Any other page is refused, named, and kept (the base's ruling R18).
  refuseLinkedFolders(ctx.celorus, [rel, LOG]);
  const owned = readOwned(ctx.celorus, rel, ctx.desk.id);
  if (owned && owned.refused) refuse(owned.refused);
  if (owned) {
    if (!MADE_BY_WRITE_BRIEF.test(generatedByOf(owned.text) || "")) {
      refuse(
        `${rel} is already on this desk and was not made by write_brief (its header does not say ` +
          `generated_by: celorus-plugin <version> write_brief), so it is not written over. ${NOTHING}`,
      );
    }
    const head = headerOf(owned.text);
    const forSeat = head !== null && typeof head.for_seat === "string" ? head.for_seat : null;
    const found = forSeat === null ? [] : linksIn(forSeat);
    const held = found.length ? found[0] : forSeat;
    if (held !== seat) {
      refuse(forSeat === null ? `${rel} names no seat in its for_seat. ${NOTHING}` : `${rel} is the ${name} of seat ${forSeat}. ${NOTHING}`);
    }
    if (!replace) {
      refuse(
        `${rel} is already on this desk, made for ${seat}. Send replace: true to rewrite it: that rewrites the ` +
          `whole page, and any notes added by hand to its body are lost with it. ${NOTHING}`,
      );
    }
  }
  const page = owned ? { kind: "rewrite", rel, raw: owned.raw, text } : { kind: "create", rel, text };
  const did = owned ? "replaced" : "made";
  const log = logStep(ctx, seat, BRIEF_SKILL[kind], `${did} the ${name} [[${slug}]]`);
  ctx.logLine = log.line;
  return run(ctx, [page, log.step], rel, { brief: slug });
}

module.exports = { logAction, addFollowUp, assignLead, writeConversation, writeBrief, ACTIONS, CHANNELS, BRIEF_KINDS, OWED_BY };
