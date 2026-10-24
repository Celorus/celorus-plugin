"use strict";
// The making call: one desk tool, made on the desk server, written to this desk.
//
// In order: the desk, found as the engine finds it (the one named, or from where the work
// started), refused when it is the home folder, holds the link's token, or has a linked root;
// then any queued calls, in order; then the call's own pages (lib/workingset.js); the token
// (lib/token.js); one desk_make call to the desk server; and its answer written to the desk
// (lib/apply.js).
//
// What happens to a write:
//   - the server made the pages: they are written, all or nothing, and the engine's own answer
//     comes back;
//   - the server could not be reached: the call is queued (lib/queue.js), nothing written;
//   - the server did not keep it because the desk changed since its pages were read
//     (stale_base): nothing written, and the call is queued, or stays queued, to be made again
//     from a fresh read (the clash rule, below);
//   - the server refused it, did not keep it for another reason, asked for payment, or answered
//     in a way this link does not know: nothing written, never queued, and the answer says so,
//     with the server's own words (and, for payment, its balance, what is needed and, when it
//     names the account page, that it is where to recharge).
// On a seat's graph (layout 3) the call sends a firm folder, contract_version 2: the seat's desk
// and the firm's common space (lib/workingset.js); a desk sends contract_version 1.
// The token is sent only in the call's Authorization header. The log carries the tool, the
// outcome and counts: never a token, a page's text, a page's path or the desk's folder.

const path = require("node:path");
const { findDesk, resolveDesk } = require("../../engine/lib/desk.js");
const { refuseLinkedRoot } = require("../../engine/lib/linkedroot.js");
const { applyAnswer } = require("./apply.js");
const base = require("./base.js");
const { LinkError, passingStatus } = require("./errors.js");
const { MAKE_URL } = require("./origins.js");
const queue = require("./queue.js");
const token = require("./token.js");
const { post } = require("./transport.js");
const { SERVED, workingSet } = require("./workingset.js");

const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const PROTOCOL = "2025-06-18";
const STAY = ["take_down", "list_routines", "render_snapshot"];
const NOTHING = "Nothing was written.";

const NAME_IT_IN_FULL =
  "The link was started in the plugin folder, so it does not know the folder you work in. " +
  "Name the desk folder (the one holding celorus/index.md) as `desk` in the call's arguments, " +
  "written as a full path, or set CELORUS_DESK to its full path.";

function refused(message) {
  return new LinkError("refused", message);
}

// The folder the work started in, or null when the link was started inside the plugin folder.
function workingFolder(cwd) {
  const rel = path.relative(PLUGIN_ROOT, path.resolve(cwd));
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  return inside ? null : cwd;
}

// The desk a call writes on, as the engine's own writers find it.
function deskFor(named, { cwd, env }) {
  const base = workingFolder(cwd);
  if (named !== undefined && named !== null) {
    if (typeof named !== "string" || named.trim() === "") throw refused("`desk` is the path of a desk folder, as text.");
    if (base === null && !path.isAbsolute(named)) throw refused(`\`desk\` is not a full path. ${NAME_IT_IN_FULL}`);
    return resolveDesk(named, base === null ? PLUGIN_ROOT : base);
  }
  if (base === null && env.CELORUS_DESK) {
    if (!path.isAbsolute(env.CELORUS_DESK)) throw refused(`CELORUS_DESK is not a full path. ${NAME_IT_IN_FULL}`);
    return findDesk({ start: null, env: { CELORUS_DESK: env.CELORUS_DESK }, writes: true });
  }
  const found = findDesk({ start: base, env, writes: true });
  if (found) return found;
  if (base === null) throw refused(`No desk was named. ${NAME_IT_IN_FULL}`);
  throw refused(
    "No desk was named and none was found: the walk up from the working folder found no folder " +
      "that holds celorus/index.md. Name the desk folder as `desk`, or set CELORUS_DESK to it.",
  );
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function refuseHomeDesk(root, home) {
  const desk = path.resolve(root);
  if (desk === path.resolve(home) || inside(token.tokenFolder(home), desk)) {
    throw refused(`The link does not work on a desk at the home folder, or one that holds the link's sign-in (~/.celorus/link). ${NOTHING}`);
  }
}

function checkInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw refused("make takes { tool, arguments }.");
  const { tool, arguments: given } = input;
  if (typeof tool !== "string" || !SERVED.includes(tool)) {
    const stays = STAY.includes(tool) ? `${tool} stays on this computer: use the desk's own tool for it. ` : "";
    throw refused(`${stays}make runs only these desk tools on the desk server: ${SERVED.join(", ")}. ${NOTHING}`);
  }
  if (given === null || typeof given !== "object" || Array.isArray(given)) throw refused(`make takes the tool's own arguments as an object. ${NOTHING}`);
  if (tool === "render_view" && given.view === "snapshot") {
    throw refused(`The snapshot view stays on this computer: use the desk's own render_snapshot for it. ${NOTHING}`);
  }
  const args = { ...given };
  const named = args.desk;
  delete args.desk;
  return { tool, args, named };
}

// The desk_make answer, from the server's answer to the call.
function madeFrom(out) {
  if (out.status === 401) return { unauthorized: true };
  if (out.status !== 200) {
    throw new LinkError("server", `The desk server answered ${out.status}, so the call was not made. ${NOTHING} Try again later.`, { passing: passingStatus(out.status) });
  }
  let text = out.text;
  // A server may answer as an event stream; its last data line is the answer.
  if (/^(event|data):/mu.test(text) && !text.trimStart().startsWith("{")) {
    const data = text.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
    text = data.length ? data[data.length - 1] : "";
  }
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    throw new LinkError("server", `The desk server's answer was not one the link reads. ${NOTHING}`);
  }
  if (message === null || typeof message !== "object") throw new LinkError("server", `The desk server's answer was not one the link reads. ${NOTHING}`);
  if (message.error) throw new LinkError("server", `The desk server could not take the call. ${NOTHING}`);
  const result = message.result;
  if (!result || typeof result !== "object") throw new LinkError("server", `The desk server could not make the pages. ${NOTHING}`);
  // a tool error is the server failing on its own side (the account's daily limit, or the
  // account not looked up), never the call: it passes
  if (result.isError === true) throw new LinkError("server", `The desk server could not make the pages now. ${NOTHING} Try again later.`, { passing: true });
  const candidates = [result.structuredContent, result.structuredContent && result.structuredContent.result];
  for (const c of candidates) if (c && typeof c === "object" && typeof c.state === "string") return c;
  const first = Array.isArray(result.content) ? result.content.find((c) => c && c.type === "text") : null;
  if (first) {
    try {
      const parsed = JSON.parse(first.text);
      if (parsed && typeof parsed === "object" && typeof parsed.state === "string") return parsed;
    } catch {
      // falls through to the refusal below
    }
  }
  throw new LinkError("server", `The desk server's answer was not one the link reads. ${NOTHING}`);
}

// One desk_make call, signed. `contract` is the shape of `files`: 1 a desk, 2 a firm folder (a
// seat's graph). `readBase`, the base this seat's graph last read of its storage (lib/base.js),
// goes as read_base when held.
async function deskMake(tool, args, files, contract, d, readBase = null) {
  const call = { tool, arguments: args, files, contract_version: contract };
  if (base.isBase(readBase)) call.read_base = readBase;
  return served("desk_make", call, d);
}

// One call of the desk server's tool `name`, signed; on a 401, the token refreshed once and the
// call made again. Answers the tool's structured answer (madeFrom). A token the server refuses and
// that cannot be renewed (no refresh token), and a renewed token the server still refuses, are
// dropped while still kept, so sign_in no longer reads the computer as signed in and asks for the
// browser sign-in. A renewal refused drops itself (token.refresh); a fault on the way (a network
// fault, another answer) keeps the token.
async function served(name, args, d) {
  let tok = await token.current(d).catch(unsent);
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL,
      Authorization: `Bearer ${tok.access_token}`,
    };
    const out = await post(MAKE_URL, "make", headers, body, { request: d.request });
    const made = madeFrom(out);
    if (!made.unauthorized) return made;
    if (attempt === 0) {
      const refused = tok;
      tok = await token.refresh(tok, d).catch((err) => {
        if (err && err.code === "signed_out") token.dropTokenIfStill(refused, { home: d.home });
        return unsent(err);
      });
    }
  }
  token.dropTokenIfStill(tok, { home: d.home });
  throw new LinkError("signed_out", token.SIGNED_OUT);
}

// A network failure at the sign-in service: the call itself was never sent (a first answer that
// asked for a fresh token kept nothing).
function unsent(err) {
  if (err instanceof LinkError && err.network) err.sent = "never";
  throw err;
}

function answer(text, structured, isError) {
  return { content: [{ type: "text", text }], structuredContent: structured, isError };
}

const say = (value, cap = 600) => (typeof value === "string" ? value.slice(0, cap) : "");
// A figure from the server: a number, or a string cut to 40 characters; anything else is not passed on.
const figure = (value) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" ? value.slice(0, 40) : undefined);

// Where the server points a person to top up: the account page, by name, never a link. A pointer
// this link does not know is not shown.
function rechargeWords(recharge) {
  const page = recharge !== null && typeof recharge === "object" && !Array.isArray(recharge) ? recharge.page : undefined;
  return page === "account" ? "Recharge on your account page." : "";
}

// The clash rule, as the link keeps it: every write to a seat's storage names what it replaces as
// it read it, and the storage takes the whole write or none. A change the storage did not keep
// because the desk changed since its pages were read (stale_base) is made again from a fresh read
// of the desk, never forced over the change and never dropped: it stays queued on this desk until
// the desk is pulled, and the person is told. A queued change whose answer was lost (it may have
// been kept) is never made again over a desk that has moved: it is set aside, as made again it
// could be made twice.
const STALE = "stale_base";
// The storage held by another write to the seat: nothing was kept, and the call passes.
const DESK_BUSY = "desk_busy";
const isStale = (made) => made.state === "not_kept" && made.reason === STALE;

// What a server's answer other than proceed says, and its structured part.
function notMade(made) {
  if (made.state === "refused") {
    const words = say(made.message) || "The desk server refused the call.";
    return answer(`${words} ${NOTHING} It was not queued.`, { state: "refused", reason: say(made.reason, 60) }, true);
  }
  if (made.state === "not_kept") {
    // The storage's words may say the change may or may not have been kept: the link says only
    // what it knows, that it wrote nothing here.
    const words = say(made.message) || "The desk server did not keep the change.";
    return answer(`${words} Nothing was written on this computer. It was not queued.`, { state: "not_kept", reason: say(made.reason, 60) }, true);
  }
  if (made.state === "partly_kept") {
    // the storage took part of the write. Nothing is written here; the paths it names
    // are this seat's own pages, passed on capped, and the next change reads the storage first.
    const named = (list) => (Array.isArray(list) ? list.filter((p) => typeof p === "string").slice(0, 50).map((p) => say(p, 300)) : null);
    const structured = { state: "partly_kept", written: named(made.written), removed: named(made.removed) };
    const words = say(made.message) || "The storage stopped part way through this change.";
    return answer(`${words} Nothing was written on this computer. It was not queued. Pull the desk (the link's pull) before the next change.`, structured, true);
  }
  if (made.state === "payment_required") {
    // the structured part passes on the figures cut short, the account page by name and no other
    // pointer, and the server's own reason and message capped (the words show neither)
    const structured = { state: "payment_required" };
    for (const key of ["balance", "needed"]) if (figure(made[key]) !== undefined) structured[key] = figure(made[key]);
    if (rechargeWords(made.recharge)) structured.recharge = { page: "account" };
    if (typeof made.reason === "string") structured.reason = say(made.reason, 60);
    if (typeof made.message === "string") structured.message = say(made.message);
    const parts = [
      "This change needs payment before the desk server makes it.",
      structured.balance !== undefined ? `Balance: ${say(String(structured.balance), 40)}.` : "",
      structured.needed !== undefined ? `Needed: ${say(String(structured.needed), 40)}.` : "",
      rechargeWords(made.recharge),
      `${NOTHING} It was not queued; make the change again once the account is recharged.`,
    ];
    return answer(parts.filter(Boolean).join(" "), structured, true);
  }
  return answer(
    `The desk server answered in a way this link does not know (${say(made.state, 60)}). ${NOTHING} It was not queued. The plugin may need an update.`,
    { state: "unknown", server_state: say(made.state, 60) },
    true,
  );
}

// The pages made, written where the call's places are; the engine's own answer back, with one line
// on what was written.
function written(places, sent, made, skipped = 0) {
  const engine = made.answer;
  if (!engine || typeof engine !== "object" || !Array.isArray(engine.content)) {
    throw new LinkError("answer", `The desk server's answer carried no answer from the desk. ${NOTHING}`);
  }
  if (engine.isError === true) {
    const empty = [made.files, made.removed, made.folders, made.removed_folders].every((list) => Array.isArray(list) && list.length === 0);
    if (!empty) throw new LinkError("answer", `The desk refused the call, and the server still sent pages; none was written. ${NOTHING}`);
    return { result: { content: engine.content, structuredContent: engine.structuredContent, isError: true }, done: null };
  }
  const done = applyAnswer(places, sent, made);
  const left = done.left.length ? ` ${done.left.length} folder(s) the server emptied still hold pages it never saw, so they were kept.` : "";
  const passed = skipped ? ` ${skipped} file(s) that are not text were not sent, as the desk server takes text only.` : "";
  const line = `Written on this desk through the link: ${done.written} page(s), ${done.removed} removed.${left}${passed}`;
  const content = [...engine.content, { type: "text", text: line }];
  const result = { content, isError: false };
  if (engine.structuredContent !== undefined) result.structuredContent = engine.structuredContent;
  return { result, done };
}

// One call made: its pages, the server's answer, and the answer written. Throws a network failure
// for the caller to queue. On a seat's graph a change goes only over a base this desk read: with
// none held, or a file the link cannot trust, nothing is sent ({ noBase }). The held base goes
// with the call; a kept answer's base, once its pages are written here, is the next one
// (lib/base.js), and a write the storage stopped part way leaves what is held as it is: the
// storage has moved past it, so the next change is refused until the desk is pulled. `over`, for
// a queued change that may have been kept, is the base it was sent over: it is made only over
// that read, as a read since, at another base, may hold it already ({ readAgain }, nothing sent).
// A network failure carries the base the call went over.
async function makeOne(root, tool, args, d, { over } = {}) {
  const { files, skipped, contract, places } = workingSet(root, tool, args);
  let before = null;
  try {
    before = contract === 2 ? base.held(root) : null;
  } catch (err) {
    // a link, or a folder, where the held file goes is no base this link can trust: `refused`
    // says why
    if (err instanceof LinkError) return { noBase: true, refused: err };
    throw err;
  }
  const readBase = before && base.isBase(before.base) ? before.base : null;
  if (contract === 2 && readBase === null) return { noBase: true };
  if (over !== undefined && over !== readBase) return { readAgain: true };
  let made;
  try {
    made = await deskMake(tool, args, files, contract, d, readBase);
  } catch (err) {
    if (err instanceof LinkError && err.network) err.readBase = readBase;
    throw err;
  }
  if (made.state !== "proceed") return { made, result: notMade(made), applied: false };
  const { result, done } = written(places, files, made, skipped);
  if (done !== null && contract === 2 && made.kept) {
    // the pages are written and the answer stands, whatever holding its base meets
    try {
      base.afterKept(root, before, made.kept, made.kept_paths);
    } catch {
      forget(root);
    }
  }
  return { made, result, applied: done !== null };
}

// No base held, as far as the desk lets it be cleared: one left in place is one the storage has
// moved past, which the door refuses (stale_base).
function forget(root) {
  try {
    base.clear(root);
  } catch {
    // a link where the file was: the link writes nothing through it
  }
}

// The server's refusals that say themselves they will pass, as they name the server's state and
// not the call: a queued call they stop stays queued. Every other refusal is of
// the call itself (its arguments, its files, its size, a tool held on the laptop).
const PASSING_REASONS = Object.freeze(["account_busy", "busy", "unavailable", "slot_lost", "engine_failed", "timeout"]);
// Of those, the two that may be the call's own (it ran past its time, or the desk tool failed on
// it): a queued call they stop MAX_STOPS times is set aside, so it never holds the queue for good.
const MAYBE_OWN = Object.freeze(["timeout", "engine_failed"]);
const MAX_STOPS = 3;
// The sign-in's failures: the call never reached the desk server, so a queued call stays queued.
const SIGN_IN_CODES = Object.freeze(["signed_out", "token_failed", "token_shape", "token_folder"]);

// A queued change that may have been kept, met by a desk read since at another base.
const READ_AGAIN = "an answer to it was lost on its way back, and the desk was read since at another base, so the storage may already hold it: made again over that read, it could be made twice. Look in the desk whether the change is there.";
const madeOver = (entry) => (base.isBase(entry.read_base) ? entry.read_base : null);
// A change on a seat's graph while this desk holds no base of its storage it can trust.
const NO_BASE = "no_base";
const PULL_FIRST = "This seat's desk holds no read of its storage that the link can trust, so the storage could not tell a change made now from one made over pages it has moved past. Pull the desk first, then make the change again.";
const NO_BASE_MAYBE = "an answer to it was lost on its way back, and this desk now holds no read of its storage that the link can trust, so the storage may already hold it: made again, it could be made twice. Pull the desk (the link's pull) and look whether the change is there.";

// The queued changes that may have been kept, each set aside once the desk is read at a base
// other than the one it was sent over (a pull): made over that read, each could be made twice.
// Answers how many.
function setAsideReadAgain(root, d) {
  const held = base.held(root);
  const now = held && base.isBase(held.base) ? held.base : null;
  let n = 0;
  for (const name of queue.waiting(root)) {
    const entry = queue.read(root, name);
    if (entry === null || entry.sent !== "maybe" || madeOver(entry) === now) continue;
    queue.setAside(root, name, READ_AGAIN, d.now());
    n += 1;
  }
  return n;
}

// The line that says how many queued calls were made and written before the answer's own.
const madeFirst = (made) => (made ? ` Before that, ${made} change(s) queued on this desk were made and written on it.` : "");

// The queued calls, made in order. Stops at the first that cannot be made: offline, stopped at
// the sign-in, or by a failure that passes (kept, to be made later), or refused for itself (set
// aside, never sent again). Each stop says how many were made and written before it.
async function drain(root, d) {
  const names = queue.waiting(root);
  let made = 0;
  const wait = (words, structured) => {
    const left = names.length - made;
    return { stop: answer(`${words} The ${left} queued change(s) still wait, and are made at the next change made through the link; this change was not made.${madeFirst(made)}`, structured, true) };
  };
  const setAside = (name, tool, words, structured) => {
    queue.setAside(root, name, words, d.now());
    return { stop: answer(`A change queued on this desk (${tool}) was set aside in ${queue.queueRel()}/refused/ and will not be sent again: ${words} The new change was not made; make it again.${madeFirst(made)}`, structured, true) };
  };
  for (const name of names) {
    const entry = queue.read(root, name);
    if (entry === null) return setAside(name, "unreadable", "it could not be read.", { state: "queue_stopped" });
    let one;
    try {
      // a queued call is checked as a live one is, before it is made
      const checked = checkInput(entry);
      one = await makeOne(root, checked.tool, checked.args, d, entry.sent === "maybe" ? { over: madeOver(entry) } : {});
    } catch (err) {
      if (err instanceof LinkError && err.network) {
        if (err.sent === "maybe") queue.mayBeKept(root, name, err.readBase);
        return { offline: true, made };
      }
      if (err instanceof LinkError && SIGN_IN_CODES.includes(err.code)) return wait(err.message, { state: err.code === "signed_out" ? "signed_out" : "waiting" });
      if (err instanceof LinkError && err.passing) return wait(err.message, { state: "waiting" });
      const why = err instanceof LinkError || (err && err.name === "Refusal") ? err.message : "it stopped on an error the link has no words for.";
      return setAside(name, entry.tool, why, { state: "queue_stopped", tool: entry.tool });
    }
    if (one.noBase && entry.sent === "maybe") return setAside(name, entry.tool, NO_BASE_MAYBE, { state: "queue_stopped", tool: entry.tool, reason: NO_BASE });
    if (one.noBase) return wait(one.refused ? one.refused.message : PULL_FIRST, { state: "waiting", reason: NO_BASE });
    if (one.readAgain) return setAside(name, entry.tool, READ_AGAIN, { state: "queue_stopped", tool: entry.tool, reason: "read_again" });
    if (one.made.state === "refused" && PASSING_REASONS.includes(one.made.reason)) {
      const words = say(one.made.message) || "The desk server could not make it now.";
      if (MAYBE_OWN.includes(one.made.reason) && queue.stopped(root, name) >= MAX_STOPS) {
        return setAside(name, entry.tool, `${words} It was stopped so ${MAX_STOPS} times.`, { state: "queue_stopped", tool: entry.tool, reason: one.made.reason });
      }
      return wait(words, { state: one.made.reason === "account_busy" ? "busy" : "waiting" });
    }
    if (one.made.state === "not_kept" && one.made.reason === DESK_BUSY) {
      // another write held the seat's storage: nothing was kept, and it passes
      return wait(say(one.made.message) || "Another write held the desk's storage, and nothing was kept.", { state: "busy" });
    }
    if (isStale(one.made) && entry.sent === "maybe") {
      return setAside(
        name,
        entry.tool,
        "it met a desk that changed since its pages were read, and an answer to it was lost before, so the storage may already have kept it: made again, it could be made twice. Pull the desk (the link's pull) and look whether the change is there.",
        { state: "queue_stopped", tool: entry.tool, reason: STALE },
      );
    }
    if (isStale(one.made)) {
      // the storage kept nothing of it: never set aside and never counted as a stop, it is
      // made again from a fresh read once the desk is pulled
      return wait(
        `A change queued on this desk (${entry.tool}) met a desk that changed since its pages were read, so the desk server did not keep it; it stays queued and is made again from a fresh read of the desk. Pull the desk (the link's pull) before the next change.`,
        { state: "waiting", reason: STALE },
      );
    }
    if (one.made.state !== "proceed" || one.result.isError) {
      const words = one.result.content.map((c) => c.text).join(" ");
      return setAside(name, entry.tool, words, { ...one.result.structuredContent, queued_tool: entry.tool });
    }
    queue.done(root, name);
    made += 1;
  }
  return { made };
}

// The queue's own refusals: it is full, or the desk's .gitignore does not keep it out of git.
const QUEUE_REFUSED = Object.freeze(["queue_full", "queue_not_ignored"]);

// `sent`, the queue's mark (lib/queue.js): a change the server answered stale_base was answered,
// one that reached nothing says itself whether it may have been sent, and over which base.
function queued(root, tool, args, d, made = 0, { stale = false, sent = "maybe", readBase = null } = {}) {
  // the call's own refusals (a link, a cap) come first, and are never queued; each still says
  // what queued calls were written first
  let n;
  try {
    workingSet(root, tool, args);
    n = queue.add(root, tool, args, d.now(), stale ? "answered" : sent, readBase);
  } catch (err) {
    if (stale && err instanceof LinkError && QUEUE_REFUSED.includes(err.code)) {
      const why = err.code === "queue_full" ? "the queue on this desk is full" : "the desk's .gitignore does not keep .celorus/ out of git, so a queued change could reach the desk's git; give it the line .celorus/ and no line starting with ! that could let it back in";
      return answer(
        `The desk changed since these pages were read, so the desk server did not keep this change. It was not queued, as ${why}. Read the desk again and make the change again. ${NOTHING}${madeFirst(made)}`,
        { state: "not_kept", reason: STALE },
        true,
      );
    }
    if (made && (err instanceof LinkError || (err && err.name === "Refusal"))) err.message += madeFirst(made);
    throw err;
  }
  if (stale) {
    return answer(
      `The desk changed since these pages were read, so the desk server did not keep this change. It was queued on this desk (${n} waiting), and is made again from a fresh read of the desk at the next change made through the link: pull the desk (the link's pull) before then. ${NOTHING}${madeFirst(made)}`,
      { state: "queued", waiting: n, reason: STALE },
      false,
    );
  }
  return answer(
    `The desk server could not be reached, so the change was queued on this desk (${n} waiting). It is made at the next change made through the link, while online. ${NOTHING} Reading the desk works as before.${madeFirst(made)}`,
    { state: "queued", waiting: n },
    false,
  );
}

function withDefaults(deps = {}) {
  return {
    home: deps.home,
    cwd: deps.cwd || process.cwd(),
    env: deps.env || process.env,
    request: deps.request,
    now: deps.now || (() => Math.floor(Date.now() / 1000)),
    log: deps.log || (() => {}),
  };
}

function shown(err, d) {
  const text = err.message || "";
  return d.home ? text.split(d.home).join("~") : text;
}

// The words every answer on a desk ends with while changes are set aside: how many, where, and
// how the person clears them (the link never removes one).
function setAsideWords(n) {
  return `${n} change(s) once queued on this desk are set aside in ${queue.queueRel()}/${queue.REFUSED}/ and are never sent again. To clear one, read its file (its set_aside line says why), pull the desk (the link's pull), make the change again through the link if it is still wanted, then delete the file.`;
}

function namingSetAside(root, result) {
  let n = 0;
  try {
    n = queue.setAsideCount(root);
  } catch {
    return result;
  }
  if (!n) return result;
  return { ...result, content: [...result.content, { type: "text", text: setAsideWords(n) }] };
}

// The link's `make` tool: { tool, arguments } in, an MCP tool result out.
async function make(input, deps) {
  const at = { root: null };
  const result = await makeIn(input, deps, at);
  return at.root === null ? result : namingSetAside(at.root, result);
}

async function makeIn(input, deps, at) {
  const d = withDefaults(deps);
  let tool = "make";
  try {
    const checked = checkInput(input);
    tool = checked.tool;
    const root = deskFor(checked.named, d);
    refuseHomeDesk(root, d.home);
    refuseLinkedRoot(root);
    at.root = root;
    const before = await drain(root, d);
    if (before.stop) {
      d.log(`make ${tool}: queue stopped`);
      return before.stop;
    }
    if (before.offline) {
      d.log(`make ${tool}: offline, queued behind ${queue.waiting(root).length}`);
      return queued(root, tool, checked.args, d, before.made, { sent: "never" });
    }
    let one;
    try {
      one = await makeOne(root, tool, checked.args, d);
    } catch (err) {
      if (err instanceof LinkError && err.network) {
        d.log(`make ${tool}: offline, queued`);
        return queued(root, tool, checked.args, d, before.made, { sent: err.sent, readBase: err.readBase });
      }
      if (before.made && (err instanceof LinkError || (err && err.name === "Refusal"))) err.message += madeFirst(before.made);
      throw err;
    }
    if (one.noBase && one.refused) {
      if (before.made) one.refused.message += madeFirst(before.made);
      throw one.refused;
    }
    if (one.noBase) {
      d.log(`make ${tool}: refused (${NO_BASE})`);
      return answer(`${PULL_FIRST} ${NOTHING}${madeFirst(before.made)}`, { state: "refused", reason: NO_BASE }, true);
    }
    if (isStale(one.made)) {
      d.log(`make ${tool}: not kept (${STALE}), queued`);
      return queued(root, tool, checked.args, d, before.made, { stale: true });
    }
    d.log(`make ${tool}: ${one.made.state}${one.applied ? " written" : ""}${before.made ? `, ${before.made} queued made first` : ""}`);
    if (before.made) one.result.content.push({ type: "text", text: madeFirst(before.made).trim() });
    return one.result;
  } catch (err) {
    if (err instanceof LinkError || (err && err.name === "Refusal")) {
      d.log(`make ${tool}: refused (${err.code || err.name})`);
      return answer(shown(err, d), { state: err.code === "signed_out" ? "signed_out" : "refused" }, true);
    }
    d.log(`make ${tool}: failed (${err && err.name ? err.name : "error"}${err && err.code ? ` ${err.code}` : ""})`);
    return answer(`The link stopped on an error it has no words for, so it cannot say what it changed. Look at the desk before making the change again.`, { state: "failed" }, true);
  }
}

module.exports = { NOTHING, SERVED, answer, deskFor, make, namingSetAside, refuseHomeDesk, refused, say, served, setAsideReadAgain, shown, withDefaults };
