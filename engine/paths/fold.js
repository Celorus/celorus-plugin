"use strict";
// Addendum 15, ruling 3 (gtm one-desk design, the founder, 2026-09-22): a path that restates a
// shorter path folds into it, and its extra hops become the reason on the hop they explain. It
// is a step between the walk and the writer: the walk still finds everything and the page still
// says everything, since a folded path is said on the hop it explains, never dropped.
//
// A longer path folds into a shorter one when all four hold: they start at the same page; they
// end at the same page; they name the same PEOPLE in the same order, counting only the pages the
// desk calls a person (a firm cannot introduce anybody, so a longer route through a shared
// employer is the same path, and a longer route through another person is not); and the shorter
// path's pages are a subsequence of the longer one's, which makes every extra hop belong to
// exactly one hop of the shorter path. A page the desk gives no kind cannot be counted as a
// person or as not one, so a longer path through one never folds: two paths are printed rather
// than two the desk cannot tell apart merged.

// The separator a list of file names is joined with to compare it whole: NUL, which no file name
// holds. Built by its code point, since no source under engine/paths writes a `\u` escape
// (DESK-60, fix round 8).
const NUL = String.fromCodePoint(0);

// Where each page of `small` sits in `big`, in order, or null when it is not a subsequence.
function places(small, big) {
  const out = [];
  let at = 0;
  for (const name of small) {
    while (at < big.length && big[at] !== name) at += 1;
    if (at === big.length) return null;
    out.push(at);
    at += 1;
  }
  return out;
}

// Where `kept`'s pages sit in `longer` when `longer` restates `kept`, or null.
function foldsInto(kept, longer, people, known) {
  if (longer.steps.length <= kept.steps.length) return null;
  const mine = kept.nodes;
  const theirs = longer.nodes;
  if (mine[0] !== theirs[0] || mine[mine.length - 1] !== theirs[theirs.length - 1]) return null;
  const persons = (nodes) => nodes.filter((n) => people.has(n)).join(NUL);
  if (persons(mine) !== persons(theirs)) return null;
  if (theirs.some((n) => !mine.includes(n) && !known.has(n))) return null;
  return places(mine, theirs);
}

const samePair = (a, b) => (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from);

// The paths the page keeps, in the walk's order, each as { path, reasons }, where reasons[j] is
// the list of steps that folded onto its hop j; and how many paths folded. A path is compared
// only with the shorter paths already kept, so the paths are taken shortest first (the walk's
// order within one length), and a path folds into the first kept path it restates.
function fold(paths, people, known) {
  const byLength = paths
    .map((p, rank) => ({ p, rank }))
    .sort((a, b) => a.p.steps.length - b.p.steps.length || a.rank - b.rank);
  const kept = [];
  let folded = 0;
  for (const { p, rank } of byLength) {
    let home = null;
    for (const base of kept) {
      const at = foldsInto(base.path, p, people, known);
      if (at !== null) {
        home = { base, at };
        break;
      }
    }
    if (home === null) {
      kept.push({ path: p, rank, reasons: p.steps.map(() => []) });
      continue;
    }
    folded += 1;
    const { base, at } = home;
    // The group takes the best walk rank among its members: the rank of one real path, never a
    // rank made of fields from different paths. The kept path keeps its own proof, hops and date,
    // so its heading states one real route.
    base.rank = Math.min(base.rank, rank);
    for (let j = 0; j < base.path.steps.length; j += 1) {
      const extra = p.steps.slice(at[j], at[j + 1]);
      // One hop between the same two pages is the same hop, said once.
      if (extra.length === 1 && samePair(extra[0], base.path.steps[j])) continue;
      for (const step of extra) {
        if (!base.reasons[j].some((held) => samePair(held, step))) base.reasons[j].push(step);
      }
    }
  }
  // A group stands where its best member stood in the walk's ranking (shown before said, then
  // fewer hops, then fresher), so it is counted against the five-path cut by that member and a
  // shown route is never pushed past the cut by a fold: a fold only takes paths away from above
  // any other path. The group still shows its shorter path first, the longer ones folded under it
  // (ruling 3); only the group's place comes from its best member.
  kept.sort((a, b) => a.rank - b.rank);
  return { kept: kept.map(({ path, reasons }) => ({ path, reasons })), folded };
}

module.exports = { fold, foldsInto, places };
