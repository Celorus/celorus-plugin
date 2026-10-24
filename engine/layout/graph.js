"use strict";
// A seat's graph (layout 3) as the engine's readers read a desk (slice E6b-2a). The
// readers were written for layout 2, where a page's path under celorus/ says its kind by its first
// folder (people/a.md) and the desk-wide pages sit at the root (soul.md, queues/supplied.md). On a
// graph the same page is shared/people/a.md, and the desk-wide pages are in the firm's common space
// beside the graph (layout.js). The view below hands a reader the graph's pages at the paths it
// reads (people/a.md), each still saying where it is (`path`, under the graph's celorus/, and
// `part`), with the common space's desk-wide pages added, so one reading serves both layouts and
// nothing is read twice.
//
// What the view holds: every page of the graph's shared and personal parts at its path inside its
// part; the graph's own pages outside the parts (desk.md, the logs, model/, rules/, views/) as they
// are; and the common space's desk-wide pages (layout.js COMMON_PAGES and COMMON_FOLDERS), which
// stand in for a graph's copy of the same page, since the common space is where the firm keeps
// them. from-my-team (team/) is the graph job's and is left out; the views, which are drawn from
// all three parts (Addendum 19 section 1), read the graph whole. A graph with no common space
// beside it (opened away from its firm folder, layout.js commonOfGraph) has no desk-wide pages but
// its own.

const { readDesk, readCommon, comparePaths } = require("../lib/desk.js");
const L = require("./layout.js");

// The desk read whole (lib/desk.js readDesk), and a graph as its view.
function readView(folder) {
  const read = readDesk(folder);
  return read.layout === L.LAYOUT ? graphView(read) : read;
}

function graphView(read) {
  const at = L.commonOfGraph(read.root);
  const common = at === null ? null : readCommon(at);
  const deskWide = common === null ? [] : common.pages.filter((page) => L.isCommon(page.rel));
  const theirs = new Set(deskWide.map((page) => page.rel));
  const pages = [];
  for (const page of read.pages) {
    const where = L.partOf(page.rel);
    // A folder of a part that could not be listed stays as the reader met it.
    if (where === null || where.inner === "" || where.inner.endsWith("/")) {
      if (where === null && theirs.has(page.rel)) continue;
      pages.push({ ...page, path: page.rel, part: where === null ? null : where.part });
    } else if (where.part !== L.TEAM) {
      pages.push({ ...page, rel: where.inner, path: page.rel, part: where.part });
    }
  }
  for (const page of deskWide) pages.push({ ...page, path: null, part: L.COMMON });
  pages.sort((a, b) => comparePaths(a.rel, b.rel));
  const seat = read.stamps && typeof read.stamps.seat === "string" ? read.stamps.seat : null;
  return { ...read, pages, graph: { seat, common: common === null ? null : common.dir } };
}

// The desk read whole with each page at its own path, as a reader keyed by file name and type reads
// it (introductions_from): on a graph, from-my-team left out, as the view leaves it.
function readInPlace(folder) {
  const read = readDesk(folder);
  if (read.layout !== L.LAYOUT) return read;
  return { ...read, pages: read.pages.filter((page) => (L.partOf(page.rel) || {}).part !== L.TEAM) };
}

// The file names of the common space's pages beside a seat's graph (layout.js commonOfGraph), which
// a link on the graph opens as it opens one of the graph's own (check/rules.js): the views and the
// path pages draw such a link as a link. None on any other desk, or on a graph with no common space
// beside it.
function commonStems(read) {
  const at = read.layout === L.LAYOUT ? L.commonOfGraph(read.root) : null;
  const common = at === null ? null : readCommon(at);
  return common === null ? [] : common.pages.filter((p) => p.rel.endsWith(".md")).map((p) => L.stemOf(p.rel));
}

module.exports = { readView, readInPlace, commonStems };
