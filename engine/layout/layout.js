"use strict";
// Layout version 3: the per-person graph (gtm design, Addendum 19). Today a desk is one folder every
// seat of a firm shares (layout 2); from layout 3 every seat has a graph of its own, a desk folder
// holding celorus/ in three parts, and the firm keeps one common space beside its seats' graphs.
// This file is the one place the engine learns that shape: the reader, the checker and the
// converter (engine/convert) read it from here, and so do the server's making parts.
//
// On disk, under one firm folder (local folders now; the storage door gives the same places at
// slice E10):
//   <firm>/seats/<seat>/celorus/   a seat's graph, a desk the engine finds by celorus/index.md
//   <firm>/common/                 the firm's common space, beside the graphs and never a desk
// Inside a graph a page sits in its kind's default part under the path it had on layout 2:
// people/a.md on layout 2 is shared/people/a.md in a graph.

const path = require("node:path");

const LAYOUT = 3;
// The three parts of a graph (Addendum 19 section 1). `team` is written only by the graph job
// (wave 3); in wave 1 it is there and empty.
const SHARED = "shared";
const PERSONAL = "personal";
const TEAM = "team";
const PARTS = [SHARED, PERSONAL, TEAM];
// The version of the views' shape, which every view the engine writes names in its header as
// `view_version` (Track F's F3, c/6217719020; the base's ruling D3, c/6218761764): one up at any
// change to a view's header keys, headings or line forms, on both layouts.
const VIEW_VERSION = 1;

// The firm folder's two places, by name.
const SEATS = "seats";
const COMMON = "common";
// The common space's own pages: its stamps, its log, the firm's name list and its table of
// default parts. Every other page in it is a desk-wide page placed there whole from layout 2.
const COMMON_STAMPS = "common.md";
const COMMON_LOG = "log.md";
const NAMES = "names.md";
const DEFAULTS = "defaults.md";
// The desk-wide pages and folders the common space holds, by their path under celorus/ on layout
// 2, which is their path under common/: the converter places them there whole, and a graph reads
// them from there.
const COMMON_PAGES = Object.freeze(["soul.md", "register.md", "motion-spec.md", "queues/supplied.md", "model/own-words.md"]);
const COMMON_FOLDERS = Object.freeze(["context/", "learnings/", "rules/"]);
// The desk's own words, read on a graph from the common space alone (the base's ruling K7,
// c/6212179305).
const OWN_WORDS = "model/own-words.md";

// The default part of each kind, as shipped (Addendum 19 section 2). A page's kind is its header
// `type`. Two entries are the founder's word of 2026-10-13 (c/6152892569), each one
// entry here and pinned by test:
// - item 5, "Shared like any": a conversation is shared whatever its channel, mail and messages
//   included (`conversation` below has no channel exception);
// - item 4, "Lock them": a lead page is shared and is never switched (`switchable`, below).
const DEFAULT_PART = Object.freeze({
  person: SHARED,
  firm: SHARED,
  family: SHARED,
  conversation: SHARED,
  review: SHARED,
  brief: SHARED,
  research: SHARED,
  feedback: SHARED,
  seat: SHARED,
  board: PERSONAL,
  draft: PERSONAL,
  sent: PERSONAL,
  manner: PERSONAL,
  workflow: PERSONAL,
});
// The tables a graph keeps in a part, by their path under celorus/ on layout 2.
const TABLE_PART = Object.freeze({
  "queues/follow-ups.md": SHARED,
  "queues/book.md": PERSONAL,
});
// The folders whose files are a seat's own and personal by the default table, whatever their
// header: the CRM mirror and the signals inbox.
const PERSONAL_FOLDERS = Object.freeze(["crm/", "signals/inbox/"]);

// A lead is a role a page takes (Addendum 19 section 4): its name is `lead-<our lead id>` for its
// whole life, in every graph of the firm.
const LEAD_NAME = /^lead-[A-Za-z0-9][A-Za-z0-9_-]*$/u;

// The file name of a path, without `.md`.
function stemOf(rel) {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

// Whether a page, { rel, head }, is in the lead role: named `lead-<id>`, or a header saying so.
function isLead(page) {
  if (LEAD_NAME.test(stemOf(page.rel))) return true;
  const head = page.head && typeof page.head === "object" && !Array.isArray(page.head) ? page.head : {};
  return head.role === "lead" || Object.hasOwn(head, "lead_id");
}

// The default part of a page, { rel, head }, by its layout 2 path under celorus/: a lead page is
// shared; a table by its path; the CRM mirror and the signals inbox are personal; else its kind's
// part; and a page of a kind the model does not know, or anything unrecognised, is personal
// (decision 16, "anything new or unrecognised").
function defaultPart(page) {
  if (isLead(page)) return SHARED;
  if (Object.hasOwn(TABLE_PART, page.rel)) return TABLE_PART[page.rel];
  if (PERSONAL_FOLDERS.some((folder) => page.rel.startsWith(folder))) return PERSONAL;
  if (page.rel.startsWith("manner/")) return PERSONAL;
  const type = page.head && typeof page.head === "object" && !Array.isArray(page.head) ? page.head.type : undefined;
  return typeof type === "string" && Object.hasOwn(DEFAULT_PART, type) ? DEFAULT_PART[type] : PERSONAL;
}

// The part a path under a graph's celorus/ sits in, and its path inside that part, or null for a
// path outside every part (desk.md, the logs, model/, rules/, views/).
function partOf(rel) {
  const at = rel.indexOf("/");
  if (at === -1) return null;
  const part = rel.slice(0, at);
  return PARTS.includes(part) ? { part, inner: rel.slice(at + 1) } : null;
}

// Whether the person may switch a page between shared/ and personal/ by telling Milan (decision
// 16), and if not, why, in plain words. A page in from-my-team is the graph job's; a lead page is
// locked (item 4, "Lock them"); a page outside the two parts is the desk's own.
function switchable(page) {
  const where = partOf(page.rel);
  if (where === null) return { switchable: false, why: "it is one of the desk's own pages, in no part" };
  if (where.part === TEAM) return { switchable: false, why: "it is in from-my-team, which only the graph job writes" };
  if (isLead(page)) return { switchable: false, why: "it is a lead page, which the graph job writes from the front door and is never switched" };
  return { switchable: true, why: null };
}

// The places of a firm folder: each seat's graph (a desk folder) and the common space.
function graphFolder(firm, seat) {
  return path.join(firm, SEATS, seat);
}

function commonFolder(firm) {
  return path.join(firm, COMMON);
}

// Whether a path under celorus/ on layout 2 is a desk-wide page the common space holds.
function isCommon(rel) {
  return COMMON_PAGES.includes(rel) || COMMON_FOLDERS.some((folder) => rel.startsWith(folder));
}

// The common space of the graph whose desk folder is `desk`, or null. The firm folder is two levels
// up (<firm>/seats/<seat>), and only there: a desk folder whose own folder is not named `seats` has
// no common space, so a graph opened anywhere else (a working folder on the server, a copy away
// from its firm folder) never reads a folder outside the one it was given. The seat's folder name
// is never read for who the seat is: that is desk.md's `seat:`.
function commonOfGraph(desk) {
  const seats = path.dirname(desk);
  if (path.basename(seats) !== SEATS) return null;
  return commonFolder(path.dirname(seats));
}

// The default table as the common space writes it (defaults.md): one row per kind, as shipped.
// The firm may change a default there (decision 16); a changed default applies to pages made
// after it.
function defaultsTable() {
  const rows = Object.entries(DEFAULT_PART).map(([kind, part]) => `| ${kind} | ${part} |`);
  for (const [rel, part] of Object.entries(TABLE_PART)) rows.push(`| ${rel} | ${part} |`);
  for (const folder of PERSONAL_FOLDERS) rows.push(`| ${folder} | ${PERSONAL} |`);
  rows.push(`| lead | ${SHARED} |`, `| anything else | ${PERSONAL} |`);
  return ["| kind | part |", "|---|---|", ...rows].join("\n");
}

module.exports = {
  LAYOUT,
  SHARED,
  PERSONAL,
  TEAM,
  PARTS,
  VIEW_VERSION,
  SEATS,
  COMMON,
  COMMON_STAMPS,
  COMMON_LOG,
  NAMES,
  DEFAULTS,
  COMMON_PAGES,
  COMMON_FOLDERS,
  OWN_WORDS,
  DEFAULT_PART,
  TABLE_PART,
  PERSONAL_FOLDERS,
  stemOf,
  isLead,
  defaultPart,
  partOf,
  switchable,
  graphFolder,
  commonFolder,
  isCommon,
  commonOfGraph,
  defaultsTable,
};
