"use strict";
// The book query: the families that match an owner, a relationship, a signal since a date and no
// touch for N days. Ported from the demo kit's book_query (row E7). It holds no count of its own:
// the owner is counts.js's effectiveOwner, the signal's sentence counts.js's signalWhy, and the
// last touch facts.js's lastTouch, each reached through its file's exports so there is one reader.

const C = require("../render/counts.js");
const F = require("../render/facts.js");
const { daysBetween } = require("../render/words.js");

// The signal engines that are a liquidity event, as the demo's world names them. A desk whose
// signals name no engine (the product model writes none) is never filtered by them.
const LIQUIDITY = new Set(["ipo-watch", "stake-sale", "property-sale", "esop-cash"]);

// Whether any signal page on the desk names an engine: only then can a signal say it is a
// liquidity event, and only then is the filter applied or its engines named.
function namesEngines(desk) {
  return desk.of("research").some((page) => Boolean(desk.get(page, "engine")));
}

// { rows, leftForSignals, filtered }: the rows; whether a family was left out only because none
// of its signals is a liquidity event; and whether the liquidity filter was applied at all.
function bookRows(desk, st, { owner, relationship, eventSince, eventUntil, noTouchDays, liquidityOnly, today }) {
  const rows = [];
  const filtered = Boolean(liquidityOnly) && namesEngines(desk);
  let leftForSignals = false;
  for (const fam of desk.of("families")) {
    if (owner && C.effectiveOwner(desk, fam.slug) !== owner) continue;
    if (relationship && desk.get(fam, "relationship_kind") !== relationship) continue;
    // a window counted back from a day ends on that day (`eventUntil`); `event_since` alone is open
    const inWindow = (asOf) => (!eventSince || asOf >= eventSince) && (!eventUntil || asOf <= eventUntil);
    const since = desk.signals(fam.slug).filter((s) => inWindow(desk.get(s, "as_of")));
    const sigs = since.filter((s) => !filtered || LIQUIDITY.has(desk.get(s, "engine")));
    if ((eventSince || filtered) && !sigs.length) {
      if (filtered && since.length) leftForSignals = true;
      continue;
    }
    const last = F.lastTouch(desk, st, fam.slug);
    const days = last ? daysBetween(last, today) : null;
    if (noTouchDays && days !== null && days <= noTouchDays) continue;
    const sig = sigs.length ? sigs[sigs.length - 1] : null;
    // never touched is not "0 days ago": the row says so in a word, and its days stay null
    rows.push({
      family: fam.slug,
      title: desk.title(fam.slug),
      signal: sig ? C.signalWhy(sig) : null,
      signal_page: sig ? sig.slug : null,
      as_of: sig ? desk.get(sig, "as_of") : null,
      last_touch: last,
      days_since_touch: days,
      never_touched: last === null,
    });
  }
  return { rows, leftForSignals, filtered };
}

module.exports = { bookRows, namesEngines, LIQUIDITY };
