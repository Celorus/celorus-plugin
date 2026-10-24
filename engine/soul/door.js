"use strict";
// The soul's two tools (DESK-156, F3): read_soul, which answers the persona for a seat, and
// soul_feedback, the one door a seat changes how the assistant speaks through.
//
// The door changes exactly four manner keys (lib/persona.js MANNER_KEYS). By default a change is
// held against the seat that asked, on its own page, celorus/manner/<seat>-manner.md (F4), so one
// seat's feedback never changes how the assistant speaks to another; with whole_desk it changes the
// desk's manner in soul.md's header, and a seat's own value still wins for that seat. address is
// how the assistant speaks to one seat, so it is never sent with whole_desk (the base's ruling F1).
// The soul's text is never changed by the door. Every change keeps the values before it on the same
// page, and undo puts them back (one level; a second undo swaps back). A change to the value already
// held writes nothing and logs nothing, so the kept values stay the ones before the last real change.
//
// Refused, with nothing written: a key naming the honesty lines or the personal-talk rule, with
// the soul's own words for what feedback cannot change; any other key but the four, naming them; a
// value off its key's list, or a name form the pages cannot say. The door writes through the
// writers' guards: a link refused before the first change, generated_by on the page it writes, one
// writer per page, the seat held to the desk's seats, and a line in log.md last, which names the
// key and the seat and never the value (house rule 5; the founder's amendment, item 3).

const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { refuseLinkedRoot, refuseLinkedFolders } = require("../lib/linkedroot.js");
const { readDesk } = require("../lib/desk.js");
const { pluginVersion } = require("../lib/version.js");
const P = require("../lib/persona.js");
const T = require("../write/text.js");
const { deskMd, seatsOf, seatsNamed, seatHeld, entryAt, placedAt, commonFor } = require("../write/facts.js");
const { partOf, PERSONAL, TEAM, COMMON } = require("../layout/layout.js");
const { generatedByOf, headerOf, readOwned, writeSteps } = require("../write/pages.js");
const { shippedSoul } = require("./default.js");
const S = require("./pages.js");

const FEEDBACK = "soul_feedback";
const READ = "read_soul";
const LOG = "log.md";
const NOTHING = "Nothing was changed.";

// The keys that name what feedback cannot change: the honesty lines and the personal-talk rule
// (the founder's amendment, item 5).
const LOCKED = Object.freeze(["counts", "cites", "unknowns", "sends", "personal_talk", "honesty"]);
// The pages the door may write over, by the tool that last wrote them: a seat's manner page only
// when the door made it; soul.md when the set-up or the door wrote it.
const MADE_BY_DOOR = /^celorus-plugin [^ ]+ soul_feedback$/u;
const SOUL_MADE_BY = /^celorus-plugin [^ ]+ (?:scaffold_desk|soul_feedback)$/u;

function refuse(message) {
  throw new Refusal(message);
}

// What feedback cannot change, in the soul's own words: the sentence under its "Feedback cannot
// change" heading, its lines joined, read from the shipped soul at the moment of the call.
function cannotChange() {
  const heading = "## Feedback cannot change\n";
  const text = shippedSoul();
  const at = text.indexOf(heading);
  if (at === -1) throw new Error("the shipped soul no longer says what feedback cannot change");
  return text
    .slice(at + heading.length)
    .split("\n\n")[0]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function lockedRefusal() {
  return `Feedback cannot change this: "${cannotChange()}" ${NOTHING}`;
}

function fourKeys() {
  const keys = P.MANNER_KEYS;
  return `${keys.slice(0, -1).join(", ")} and ${keys[keys.length - 1]}`;
}

// The change asked for, held before the desk is read: { key, value } on the four keys, a value on
// its list or a name form the pages can say. The refusals never repeat what was sent.
function heldChange(change) {
  if (change === null || typeof change !== "object" || Array.isArray(change)) {
    refuse(`change is { key, value }: the key one of ${fourKeys()}, and its new value. ${NOTHING}`);
  }
  const extra = Object.keys(change).filter((k) => k !== "key" && k !== "value");
  if (extra.length || !Object.hasOwn(change, "key") || !Object.hasOwn(change, "value")) {
    refuse(`change is { key, value } and nothing else: the key one of ${fourKeys()}, and its new value. ${NOTHING}`);
  }
  const { key, value } = change;
  if (typeof key === "string" && LOCKED.includes(key.trim().toLowerCase())) refuse(lockedRefusal());
  if (typeof key !== "string" || !P.MANNER_KEYS.includes(key)) {
    refuse(`Feedback changes only how the assistant speaks: ${fourKeys()}. The key sent is not one of them. ${NOTHING}`);
  }
  if (Object.hasOwn(P.MANNER_WORDS, key)) {
    const words = P.MANNER_WORDS[key];
    if (typeof value !== "string" || !words.includes(value.trim())) {
      refuse(`${key} is one of: ${words.join(", ")}. ${NOTHING}`);
    }
    return { key, value: value.trim() };
  }
  const said = typeof value === "string" ? value.trim() : value;
  const why = typeof said !== "string" ? P.REFUSED.NOT_TEXT : said === "" ? P.REFUSED.UNSEEN : P.formRefusalOf(said);
  if (why !== null) {
    refuse(`${key} is a name form the pages can say, and the one sent is not: ${why}. ${NOTHING}`);
  }
  return { key, value: said };
}

// What the call asks: a change, or an undo, for the seat or the whole desk.
function heldAsk(args) {
  const hasChange = args.change !== undefined && args.change !== null;
  const undo = args.undo === undefined || args.undo === null ? false : args.undo;
  if (typeof undo !== "boolean") refuse(`undo is true or left out. ${NOTHING}`);
  const whole = args.whole_desk === undefined || args.whole_desk === null ? false : args.whole_desk;
  if (typeof whole !== "boolean") refuse(`whole_desk is true or false, or left out. ${NOTHING}`);
  if (hasChange === undo) {
    refuse(`Send either change: { key, value } or undo: true, one of the two. ${NOTHING}`);
  }
  const change = hasChange ? heldChange(args.change) : null;
  if (whole && change !== null && change.key === "address") {
    refuse(`address is how the assistant speaks to one seat, so it is set for that seat alone: leave whole_desk out. ${NOTHING}`);
  }
  return { change, whole };
}

// The call's desk, time and stamp, as every writer holds them (write/tools.js context).
function context(args) {
  const { deskFor } = require("../lib/tools.js");
  const at = T.readAt(args.at);
  if (at === null) {
    refuse("`at` is when the feedback was given, with its own offset, as 2026-09-21T10:30:00+05:30. A time with no offset is refused. " + NOTHING);
  }
  const version = pluginVersion();
  if (version === "unknown") refuse(`The plugin's version is not known, so no page could carry generated_by. ${NOTHING}`);
  const root = deskFor(args.desk, { writes: true });
  refuseLinkedRoot(root);
  const celorus = path.join(root, "celorus");
  const desk = deskMd(celorus, NOTHING, { parts: true });
  return {
    version,
    root,
    celorus,
    at,
    desk,
    footer: desk.footer,
    generatedBy: `celorus-plugin ${version} ${FEEDBACK}`,
  };
}

// Refuses a seat that is not one of the desk's, naming them, or on a seat's graph any seat but its
// own, naming it (facts.js seatHeld), never repeating what was sent.
function heldSeat(ctx, seat) {
  seatHeld("seat", seat, seatsOf(ctx.celorus, ctx.desk), NOTHING, { echo: false });
}

// The four values a header holds as the reader takes them, and the four before the last change,
// or null when the page keeps none.
function heldValues(head) {
  const values = P.mannerHeld(head);
  const kept = P.MANNER_KEYS.every((key) => Object.hasOwn(head, S.PREVIOUS[key]));
  const previous = kept ? P.mannerHeld(Object.fromEntries(P.MANNER_KEYS.map((key) => [key, head[S.PREVIOUS[key]]]))) : null;
  return { values, previous };
}

// The values after the call, and the values it keeps for undo: a change keeps the values it
// replaced; an undo puts the kept ones back and keeps the ones it replaced, so a second undo
// swaps back.
function nextValues(ask, held, who) {
  if (ask.change) return { values: { ...held.values, [ask.change.key]: ask.change.value }, previous: held.values };
  if (held.previous === null) refuse(`There is no change to undo for ${who}. ${NOTHING}`);
  return { values: held.previous, previous: held.values };
}

// The step for a seat's own page: made new, or rewritten when the door made it for this seat. On a
// seat's graph the page is in the personal part, the one part a seat's manner is read from
// (lib/persona.js), whatever another part holds; with none there, one of that name in another part
// is refused, and from-my-team is the graph job's and is never written over.
function seatStep(ctx, seat, ask) {
  const own = `${PERSONAL}/${S.mannerRel(seat)}`;
  const kept = ctx.desk.graph && entryAt(path.join(ctx.celorus, ...own.split("/")));
  const rel = kept ? own : placedAt(ctx.celorus, ctx.desk, S.mannerRel(seat), "manner");
  const where = partOf(rel);
  if (where !== null && where.part === TEAM) refuse(`${rel} is in from-my-team, which only the graph job writes, so it is not written over. ${NOTHING}`);
  if (where !== null && where.part !== PERSONAL) {
    refuse(`${rel} is in ${where.part}/, and a seat's manner on its graph is read only from personal/, so a change written there would never be read; switch it into personal/ first. ${NOTHING}`);
  }
  refuseLinkedFolders(ctx.celorus, [rel, LOG]);
  const owned = readOwned(ctx.celorus, rel, ctx.desk.id);
  if (owned && owned.refused) refuse(owned.refused);
  let held = { values: P.mannerHeld(null), previous: null };
  if (owned) {
    if (!MADE_BY_DOOR.test(generatedByOf(owned.text) || "")) {
      refuse(`${rel} is on this desk and was not made by ${FEEDBACK} (its header does not say generated_by: celorus-plugin <version> ${FEEDBACK}), so it is not written over. ${NOTHING}`);
    }
    const head = headerOf(owned.text);
    if (head === null || head.type !== "manner" || head.for_seat !== `[[${seat}]]`) {
      refuse(`${rel} is not the manner page of seat ${seat} (its header must say type: manner and for_seat: "[[${seat}]]"), so it is not written over. ${NOTHING}`);
    }
    held = heldValues(head);
  }
  const next = nextValues(ask, held, "this seat");
  const blank = P.mannerHeld(null);
  const page = S.mannerPage(seat, next.values, next.previous || blank, ctx.generatedBy, ctx.footer);
  if (page.refused) refuse(page.refused);
  const step = owned ? { kind: "rewrite", rel, raw: owned.raw, text: page.text } : { kind: "create", rel, text: page.text };
  return { rel, step, held, next };
}

// The step for the desk's manner, in soul.md's header; the body is kept byte for byte. On a seat's
// graph the desk's manner is the firm's, in its common space's soul.md, which the desk head alone
// writes (the base's ruling K8; facts.js commonFor), through the firm folder as the step's root.
function deskStep(ctx, ask, seat) {
  const common = ctx.desk.graph ? commonFor(ctx.root, ctx.desk, seat, P.SOUL_PAGE, NOTHING) : null;
  const root = common === null ? ctx.celorus : path.dirname(common);
  const rel = common === null ? P.SOUL_PAGE : `${COMMON}/${P.SOUL_PAGE}`;
  refuseLinkedFolders(ctx.celorus, common === null ? [rel, LOG] : [LOG]);
  const owned = readOwned(root, rel, ctx.desk.id);
  if (owned && owned.refused) refuse(owned.refused);
  if (owned === null) {
    const why = common === null ? `This desk has no ${rel}: it was set up before the soul shipped` : `The firm's common space has no ${rel}`;
    refuse(`${why}, so a change for the whole desk has nowhere to go. A change for your own seat works: leave whole_desk out. ${NOTHING}`);
  }
  if (!SOUL_MADE_BY.test(generatedByOf(owned.text) || "")) {
    refuse(`${rel} does not say generated_by: celorus-plugin <version> scaffold_desk or ${FEEDBACK}, so it is not written over. ${NOTHING}`);
  }
  const head = headerOf(owned.text);
  if (head === null || head.type !== "soul") refuse(`${rel}'s header does not say type: soul, so it is not written over. ${NOTHING}`);
  const held = heldValues(head);
  const next = nextValues(ask, held, "the whole desk");
  const entries = [
    ...P.MANNER_KEYS.map((key) => [key, next.values[key]]),
    ...P.MANNER_KEYS.map((key) => [S.PREVIOUS[key], next.previous[key]]),
    ["generated_by", ctx.generatedBy],
  ];
  const page = S.withHeaderValues(rel, owned.text, entries);
  if (page.refused) refuse(page.refused);
  const step = { kind: "rewrite", rel, raw: owned.raw, text: page.text };
  return { rel, step: common === null ? step : { ...step, root }, held, next, common: common !== null };
}

// The step that adds the door's line to log.md. `what` names keys and whose manner, never a value.
function logStep(ctx, seat, what) {
  const line = T.logLine(ctx.at.clock, seat, FEEDBACK, what);
  const owned = readOwned(ctx.celorus, LOG, ctx.desk.id);
  if (owned && owned.refused) refuse(owned.refused);
  const text = T.withLogLine(owned ? owned.text : null, ctx.at.date, ctx.at.clock, line, ctx.footer);
  return { step: owned ? { kind: "rewrite", rel: LOG, raw: owned.raw, text } : { kind: "create", rel: LOG, text }, line };
}

function soulFeedback(args = {}) {
  const { onlyArguments } = require("../lib/tools.js");
  onlyArguments(FEEDBACK, args, ["desk", "at", "seat", "change", "undo", "whole_desk"]);
  const ask = heldAsk(args);
  const ctx = context(args);
  heldSeat(ctx, args.seat);
  const seat = args.seat;
  const done = ask.whole ? deskStep(ctx, ask, seat) : seatStep(ctx, seat, ask);
  const changed = P.MANNER_KEYS.filter((key) => done.next.values[key] !== done.held.values[key]);
  const whose = ask.whole ? "the whole desk" : "this seat";
  // A change to the value already held changes nothing: nothing is written and no line is logged,
  // so the values kept for undo stay the ones before the last real change.
  const same = ask.change !== null && changed.length === 0;
  // A change in the firm's common space is logged in the graph's own log.md, naming the page it
  // changed: nothing else under common/ is written (the base's ruling, c/6233107975).
  const where = done.common ? ` in ${done.rel}` : "";
  const what = ask.change
    ? `changed the manner's ${ask.change.key} for ${whose}${where}`
    : `undid the last manner change for ${whose}${where}${changed.length ? `: ${changed.join(", ")}` : ""}`;
  const log = same ? null : logStep(ctx, seat, what);
  const result = same ? { written: null } : writeSteps(ctx.celorus, [done.step, log.step]);
  const base = {
    tool: FEEDBACK,
    plugin_version: ctx.version,
    desk: ctx.desk.name,
    seat,
    whole_desk: ask.whole,
    ...(done.common ? { common_space: true } : {}),
    changed: result.written === null ? [] : changed,
  };
  if (result.written === null && !same) {
    return { ...base, manner: null, written: null, page: null, history: null, reason: result.reason, previous_text: result.previous_text };
  }
  // The manner the seat is now spoken to with, as the one reader answers it (the seat's own, else
  // the desk's), read from the desk as it now stands.
  const read = readDesk(ctx.root);
  const { manner } = P.persona({ desk: read, seat });
  if (same) {
    const reason = `The manner's ${ask.change.key} for ${whose} already holds the value sent, so nothing was written.`;
    return { ...base, manner, written: null, page: null, history: null, reason, previous_text: null };
  }
  return {
    ...base,
    manner,
    written: result.written,
    // Desk-relative only: the answer names no absolute path, so it needs no field of lib/fields.js.
    page: done.rel,
    history: { page: LOG, line: log.line },
    reason: null,
    previous_text: null,
  };
}

function readSoul(args = {}) {
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(READ, args, ["desk", "seat"]);
  const root = deskFor(args.desk);
  let seat = null;
  if (args.seat !== undefined && args.seat !== null) {
    const celorus = path.join(root, "celorus");
    const seats = seatsOf(celorus, deskMd(celorus, "Nothing was read."));
    if (typeof args.seat !== "string" || !seats.handles.includes(args.seat)) {
      refuse(`seat must be a seat handle, one of: ${seatsNamed(seats)}. Nothing was read.`);
    }
    seat = args.seat;
  }
  const read = readDesk(root);
  const who = P.persona({ desk: read, seat });
  return {
    tool: READ,
    plugin_version: pluginVersion(),
    desk: read.stamps && typeof read.stamps.desk === "string" ? read.stamps.desk : null,
    seat,
    name: who.name,
    introduction: who.introduction,
    refused: who.refused,
    not_used: P.notUsed(who),
    manner: who.manner,
    soul: who.soul,
  };
}

module.exports = { soulFeedback, readSoul, cannotChange, LOCKED, FEEDBACK, READ };
