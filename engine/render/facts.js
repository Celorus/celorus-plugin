"use strict";
// Facts about one family, each naming the page it came from: what a family page (the reach-out
// card, the room brief) is drawn from. Called against a desk that was just written to, so nothing
// here invents a value: what cannot be read is null, or the row is passed over.
//
// Ported from the demo kit's facts.py (row E5); the CRM resolver and the book query stay the
// kit's and are not here.

const { linksIn, linkSpans } = require("../check/text.js");
const { unlink, linkedSlug } = require("./desk.js");
const { effectiveOwner, fittingProducts, recordsOf, followUpSource } = require("./counts.js");
const { asDate } = require("./words.js");

const TOUCH_ACTIONS = new Set(["mail", "call", "meeting-set", "meeting-held"]);
const TOUCH_KINDS = new Set(["call", "meeting", "mail"]);
const CRM_KEYS = ["id", "name", "company", "stage", "owner_seat", "last_activity", "phone"];
const ROUTE_FIELDS = ["kind", "how", "proof", "register", "date"];
const UNREADABLE_ROUTE = "unreadable route line";

// A header value as Python's dict.get reads it: missing is the default, a null is null.
function got(header, key, fallback = null) {
  return Object.hasOwn(header, key) && header[key] !== undefined ? header[key] : fallback;
}

// A date off a table row or a CRM activity; a value that is not a date is passed over.
function day(value) {
  try {
    return asDate(value);
  } catch {
    return null;
  }
}

// The latest touch on a family: its desk-log rows and its CRM records' activities.
function lastTouch(desk, st, family) {
  const days = [];
  for (const r of desk.deskLog) {
    if (unlink(r.lead) === family && TOUCH_ACTIONS.has(r.action)) {
      const d = day(r.date);
      if (d !== null) days.push(d);
    }
  }
  const recs = recordsOf(desk, st, family);
  for (const a of st.crm.activities) {
    if (recs.has(a.record) && TOUCH_KINDS.has(a.kind)) {
      const d = day(a.at);
      if (d !== null) days.push(d);
    }
  }
  return days.length ? days.reduce((a, b) => (b > a ? b : a)) : null;
}

// One member or contact. A slug with no page yet keeps its slug as its name and says nothing else.
function person(desk, st, slug, decision) {
  const page = desk.pages.get(slug);
  const header = page ? page.header : {};
  const crmId = header.crm_id ? String(header.crm_id) : null;
  const rec = crmId ? st.crm.records.find((r) => r.id === crmId) || {} : {};
  return {
    slug,
    name: desk.title(slug),
    role: got(header, "role_title", ""),
    standing: got(header, "standing", ""),
    crm_id: crmId,
    phone: rec.phone || null,
    decision_maker: slug === decision,
  };
}

function linked(desk, body, heading) {
  return desk
    .section(body, heading)
    .map(linkedSlug)
    .filter((slug) => slug !== null);
}

// A route line's sixth field, `in [[conversation]]`: the conversation its link names (render/desk.js
// unlink, over the one link reader, check/text.js linkSpans), or null when the field is not "in "
// and a link.
const IN = "in ";
function conversationIn(field) {
  if (!field.startsWith(IN)) return null;
  const [first] = linkSpans(field);
  return first && first.start === IN.length ? unlink(field.slice(IN.length)) : null;
}

// The `## Routes in` lines: `- kind \u00b7 how \u00b7 proof \u00b7 register \u00b7 date` and an optional
// `in [[conversation]]`. A line short of those five fields comes back with them empty, its `note`
// saying so, and the line itself under `line`.
function routes(desk, body) {
  const out = [];
  for (const line of desk.section(body, "Routes in")) {
    const parts = line.startsWith("- ")
      ? line
          .slice(2)
          .split(" \u00b7 ")
          .map((p) => p.trim())
      : [];
    const short = parts.length < ROUTE_FIELDS.length;
    const conv = parts.length > 5 ? conversationIn(parts[5]) : null;
    const fields = Object.fromEntries(ROUTE_FIELDS.map((f, i) => [f, short ? null : parts[i]]));
    out.push({ ...fields, conversation: short ? null : conv, note: short ? UNREADABLE_ROUTE : null, line: line.trim() });
  }
  return out;
}

function familyFacts(desk, st, family) {
  const page = desk.pages.get(family);
  if (!page || page.kind !== "families") return null;
  const body = page.body;
  let decision = null;
  for (const line of desk.section(body, "Members")) {
    const slug = line.includes("Decision maker") ? linkedSlug(line) : null;
    if (slug !== null) {
      decision = slug;
      break;
    }
  }
  const signals = desk.signals(family).map((s) => ({
    slug: s.slug,
    label: got(s.header, "engine_label"),
    engine: desk.get(s, "engine"),
    what: got(s.header, "description"),
    as_of: desk.get(s, "as_of"),
  }));
  const convs = desk
    .of("conversations")
    .filter((p) => desk.get(p, "about") === family)
    .map((p, i) => ({ p, i, k: desk.get(p, "date") }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i))
    .map((x) => x.p);
  const slugs = new Set(convs.map((p) => p.slug));
  const segment = (got(page.header, "segments") || [""])[0];
  const holds = new Set(got(page.header, "holds") || []);
  const last = lastTouch(desk, st, family);
  const recs = recordsOf(desk, st, family);
  return {
    family,
    title: desk.title(family),
    stage: desk.get(page, "stage"),
    relationship_kind: desk.get(page, "relationship_kind"),
    owner: effectiveOwner(desk, family),
    segment,
    band: desk.get(page, "band"),
    bracket: desk.get(page, "bracket"),
    trigger: desk.get(page, "trigger"),
    city: desk.get(page, "city"),
    holds: [...holds].sort(),
    decision_maker: decision,
    members: linked(desk, body, "Members").map((s) => person(desk, st, s, decision)),
    contacts: linked(desk, body, "Contacts").map((s) => person(desk, st, s, decision)),
    firms: linked(desk, body, "Firms").map((s) => ({ slug: s, name: desk.title(s) })),
    wealth: desk.section(body, "Wealth and where it came from").join(" "),
    what_matters: desk.section(body, "What matters to this family").join(" "),
    routes: routes(desk, body),
    signals,
    conversations: convs.map((p) => ({
      slug: p.slug,
      date: desk.get(p, "date"),
      channel: desk.get(p, "channel"),
      title: got(p.header, "title"),
      seat: desk.seatOf(p.slug),
      summary: got(p.header, "description"),
    })),
    heard: desk.section(body, "What we have heard"),
    follow_ups: desk.followUps.filter((f) => {
      // its source in any form (base ruling R42): one of the family's conversations, or its page
      const ref = followUpSource(desk, f.from).ref;
      return (slugs.has(ref) || ref === family) && f.state === "due";
    }),
    products: fittingProducts(desk.products, segment, new Set(signals.map((s) => s.engine)), holds),
    crm: st.crm.records
      .filter((r) => recs.has(r.id))
      .map((r) => ({ ...Object.fromEntries(CRM_KEYS.map((k) => [k, got(r, k)])), research: got(r, "research", {}) })),
    last_touch: last,
    titles: Object.fromEntries([...new Set(linksIn(body))].sort().map((s) => [s, desk.title(s)])),
  };
}

module.exports = { familyFacts, lastTouch, TOUCH_ACTIONS, TOUCH_KINDS };
