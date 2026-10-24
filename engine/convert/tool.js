"use strict";
// convert_desk, the converter's door (engine/convert/convert.js; slice E6b). lib/tools.js lists it
// beside the others, so both doors serve it. Its answers name the desk and the firm folder by
// their last part alone, never by a path (R72): what it wrote is named under the firm folder.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { readDesk, DESK_ARGUMENT: DESK } = require("../lib/desk.js");
const { pluginVersion } = require("../lib/version.js");
const { refuseLinkedRoot } = require("../lib/linkedroot.js");
const { checkPages } = require("../check/rules.js");
const H = require("../update/history.js");
const { previewConvert, applyConvert, ConvertStopped, besideDesk } = require("./convert.js");

// The registry's helpers, read when the tool runs: lib/tools.js lists this tool, so it is still
// loading when this file is.
function registry() {
  return require("../lib/tools.js");
}

const ALLOWED = ["desk", "into", "seats", "handle", "now", "apply", "plan", "desk_head", "seat_for", "rest_to", "unsent_writes", "switch"];
const HANDLE_WORDS = /^[a-z0-9][a-z0-9-]*$/u;

function aHandleList(value, name) {
  if (!Array.isArray(value) || !value.length || value.some((one) => typeof one !== "string" || !HANDLE_WORDS.test(one)) || new Set(value).size !== value.length) {
    throw new Refusal(`${name} is a list of seat handles, each once, as ["tanvi", "meenal"]. ${H.NOTHING}`);
  }
  return [...value];
}

function aSeat(value, name) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !HANDLE_WORDS.test(value)) throw new Refusal(`${name} is one seat handle, as "tanvi". ${H.NOTHING}`);
  return value;
}

function seatFor(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Refusal(`seat_for maps each page the preview asked about, by its path under celorus/, to one seat handle. ${H.NOTHING}`);
  }
  for (const [page, seat] of Object.entries(value)) {
    if (typeof seat !== "string" || !HANDLE_WORDS.test(seat) || page.startsWith("/") || page.split("/").includes("..")) {
      throw new Refusal(`seat_for maps each page the preview asked about, by its path under celorus/, to one seat handle. ${H.NOTHING}`);
    }
  }
  return { ...value };
}

// Runs the converter, a stop at which nothing was written refused in the plain words of a refusal.
function converting(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ConvertStopped && !err.written.length) {
      throw new Refusal(`${err.message}${/[.!?]$/u.test(err.message) ? "" : "."}`);
    }
    throw err;
  }
}

function convertDeskTool(args = {}) {
  const { deskFor, onlyArguments } = registry();
  onlyArguments("convert_desk", args, ALLOWED);
  const moment = H.momentOf(args.now);
  const root = fs.realpathSync(deskFor(args.desk, { writes: true }));
  // It writes the switch line in the desk, so a desk whose celorus/ is a link is refused, as
  // every writer refuses one, before anything is read.
  refuseLinkedRoot(root);
  if (typeof args.into !== "string" || !path.isAbsolute(args.into)) {
    throw new Refusal(`into is the full path of the firm folder the graphs and the common space are written in, beside the desk. ${H.NOTHING}`);
  }
  const into = path.resolve(args.into);
  if (!besideDesk(root, into)) {
    throw new Refusal(`into, ${path.basename(into)}, must be a folder beside the desk, neither inside it nor holding it: the converter never writes in the desk. ${H.NOTHING}`);
  }
  if (args.apply !== undefined && typeof args.apply !== "boolean") {
    throw new Refusal(`apply is true or false: false (or left out) previews the conversion and writes nothing. ${H.NOTHING}`);
  }
  if (args.switch !== undefined && typeof args.switch !== "boolean") {
    throw new Refusal(`switch is true or false: true writes the one line in the desk's desk.md that marks it converted. ${H.NOTHING}`);
  }
  const read = readDesk(root);
  const handle = H.heldSeat(args.handle, H.seatsOf(checkPages(read.pages), read.stamps || null));
  const opts = {
    seats: aHandleList(args.seats, "seats"),
    handle,
    now: moment,
    desk_head: aSeat(args.desk_head, "desk_head"),
    rest_to: aSeat(args.rest_to, "rest_to"),
    seat_for: seatFor(args.seat_for),
    switch: args.switch === true,
    unsent_writes: args.unsent_writes,
  };
  const named = { tool: "convert_desk", plugin_version: pluginVersion(), desk: path.basename(root), into: path.basename(into) };
  if (!args.apply) {
    const p = converting(() => previewConvert(root, into, opts));
    return {
      ...named,
      applied: false,
      preview: p.text,
      plan: p.plan,
      ask: p.ask,
      writes: p.writes.length,
      refused: p.refused,
      kept: p.kept,
      stale: p.stale,
      counts: p.counts,
      desk_head: p.desk_head,
      switching: p.switching,
      stopping: p.stopping,
      summary: p.writes.length || p.switching
        ? "This is a preview; nothing was written. Show it, answer what it asks, and on yes call convert_desk again with apply true, this plan and unsent_writes."
        : "The graphs are already as the desk gives them; nothing would be written.",
    };
  }
  if (typeof args.plan !== "string" || !args.plan) {
    throw new Refusal(`apply true needs plan, the digest the preview returned: preview first, show it, and on yes pass that plan with apply true. ${H.NOTHING}`);
  }
  const r = converting(() => applyConvert(root, into, { ...opts, plan: args.plan }));
  const drawn = r.views_drawn || [];
  const notDrawn = r.views_not_drawn || [];
  // The views, drawn last and in no record, by the graphs drawn: one not drawn leaves the conversion
  // done, and is named.
  const graphs = [...new Set(drawn.map((rel) => rel.split("/")[1]))];
  const views =
    (drawn.length ? ` Drew the three views of ${graphs.length === 1 ? `${graphs[0]}'s graph` : `the graphs of ${graphs.join(", ")}`} (${drawn.length} files).` : "") +
    notDrawn.map((v) => ` The views of ${v.seat}'s graph were not drawn: ${v.why} Draw them with render_views on that graph.`).join("");
  return {
    ...named,
    applied: true,
    written: r.written,
    copy: r.copy,
    kept: r.kept,
    counts: r.counts,
    desk_head: r.desk_head,
    views_drawn: drawn,
    views_not_drawn: notDrawn,
    summary:
      (r.written.length
        ? `Converted: ${r.written.length} file${r.written.length === 1 ? "" : "s"} written beside the desk, after a dated copy of it (${r.copy}); nothing deleted.`
        : "The graphs are already as the desk gives them; nothing was written.") + views,
  };
}

const SEAT = { type: "string", description: "One seat handle: the file name of a seat page under seats/." };

const TOOLS = [
  {
    name: "convert_desk",
    description:
      "Convert a desk from layout 2, one folder every seat shares, to layout 3: a graph for each " +
      "seat named in seats and the firm's common space beside them, all in the firm folder into, " +
      "beside the desk. With apply false (the default) it previews, writes nothing, and returns the " +
      "plan's digest and what it asks (pages that name no seat, the desk head, the seat for the " +
      "pages no seat names); with apply true, that plan, every question answered and unsent_writes " +
      "it makes a dated copy of the whole desk, then writes the graphs and the common space, and " +
      "never deletes a file or writes in the desk, but the one switch line when switch is true, on a " +
      "run that rebuilds every graph already written; a seat never converted then has no graph and " +
      "does not run, and the preview names it. Pages are placed byte for byte, but a pointer by path re-pointed " +
      "to where its page now is. A second run writes nothing; a target changed since it wrote it, or " +
      "not written by it, is refused. What the seat says about themselves is never written to the " +
      "desk: leave it out of every field.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK,
        into: { type: "string", description: "The full path of the firm folder the graphs (seats/<seat>/) and the common space (common/) are written in, beside the desk." },
        seats: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true, description: "The seats to convert, by handle; the others keep the old desk until a later conversion." },
        handle: { type: "string", description: "The seat running the conversion, one of the desk's seats." },
        now: { type: "string", description: "The moment of the conversion in ISO 8601 with its offset, as 2026-10-14T10:00:00+05:30. Left out, this machine's clock." },
        apply: { type: "boolean", description: "True converts; false or left out previews and writes nothing." },
        plan: { type: "string", description: "With apply true: the plan the preview returned, the one the person said yes to." },
        desk_head: { ...SEAT, description: "The desk head, a converted seat, when the preview asks for one." },
        seat_for: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "For each page the preview asked about, by its path under celorus/, the seat it goes to.",
        },
        rest_to: { ...SEAT, description: "The seat that takes whole what names no seat: the book's rows, crm/ and signals/." },
        unsent_writes: {
          type: "integer",
          minimum: 0,
          description: "Required with apply true: how many of the desk's writes are not yet sent to its storage (0 when none). Above 0 is refused.",
        },
        switch: { type: "boolean", description: "True writes `converted: <date>` in the desk's desk.md after the graphs are written, and every writer then refuses the desk." },
      },
      required: ["handle", "into", "seats"],
      additionalProperties: false,
    },
    run: convertDeskTool,
  },
];

module.exports = { TOOLS };
