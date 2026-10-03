"use strict";
// overnight_reconcile: one morning's run over the desk, ported from the demo kit's overnight
// (demo_kit/reconcile.py, which the demo's server runs), whose output on the made-up fixture it equals
// apart from the differences the tests name. It is the only writer that grows the shared pages
// from the conversations (the E8 writers write a conversation and the links it carries, and no
// person page: the base's ruling R16, pin 2). In order:
//
// 1. Each conversation dated before the run's day and not yet on the merge record: every person
//    it names who has no page gets a named-only person page, and joins the family page under
//    Members; every line heard on it goes onto its subject's page; the conversation joins the
//    merge record. A dictated call has no sides: a heard line is said by someone only when it
//    says so, and a named person's page says who named them only when exactly one person with
//    a page attended (the demo's rule, platform check row 8).
// 2. Each family's latest hand-over dated before the run's day moves its owner, once.
// 3. A CRM record made from the desk gets its id onto the page of the family's member it names.
// 4. Mail on a family's thread that no reply row covers becomes a reply row.
//
// Where it leaves the demo, by the base's rulings, each with a test: a CRM record whose name
// matches no member is tied to no one and named in unread (the demo tied it to the decision
// maker, for good, whichever record came first); a line heard about a seat grows no page, since
// the overnight never writes under seats/ (the demo rewrote the seat's page), and is named in
// unread; a reply row covers the mail dated before it and no other (the demo never logged mail
// dated the day of a run).
//
// The engine cannot reach the harness's connectors: the CRM records and the mail threads are
// the skill's to read through them, and come in with the call; the connected route stays the rule.
//
// The run is as the seat that runs it (house rule 6): it is refused without one of the desk's
// seats, and every line and row it writes names that seat, never a pseudo-seat (R6). Every change
// is planned first (plan.js), so every refusal comes before the first change; then the pages go
// down, and last the lines in log.md (house rule 5), one per change as the demo wrote them, and one
// that says the run happened and whether a person watched it. An unattended run is refused until
// log.md holds an attended one and the register holds a routine (routines/routines.js).

const path = require("node:path");
const fs = require("node:fs");
const { readPage } = require("../lib/desk.js");
const { refuseLinkedFolders } = require("../lib/linkedroot.js");
const T = require("../write/text.js");
const { screened, unpathed } = require("../write/screen.js");
const { seatsOf, seatsNamed } = require("../write/facts.js");
const { writeSteps } = require("../write/pages.js");
const P = require("./plan.js");
const R = require("../routines/routines.js");

const MERGE_RECORD = "merge-record.md";
const MERGE_COLUMNS = ["conversation", "date", "merged_on", "lines", "pages"];
const DESK_LOG = "desk-log.md";
const LOG = "log.md";
const SKILL = "overnight";
const SEATS = "seats";
const FOLDERS = ["families", "people", "firms", SEATS];
const LISTS = new Set(["knows", "worked_at", "member_of"]);
const SINGLE = new Set(["works_at", "part_of", "introduced_by"]);

// A list item that opens with a link (the demo's `^- [[slug]]`): the link's inside, or null.
function linkedItem(line) {
  if (!line.startsWith("- ")) return null;
  const link = P.linkAt(line, 2);
  return link ? link.inner : null;
}

// A line under "Named on this call" (the demo's `^- [[slug]] Full Name(, note)?$`): its slug, name
// and note, or null.
function namedItem(line) {
  if (!line.startsWith("- ")) return null;
  const link = P.linkAt(line, 2);
  if (!link || line[link.end] !== " ") return null;
  const rest = line.slice(link.end + 1);
  const comma = rest.indexOf(",");
  const name = comma === -1 ? rest : rest.slice(0, comma);
  if (name === "" || (comma !== -1 && rest[comma + 1] !== " ")) return null;
  return [link.inner, name, comma === -1 ? undefined : rest.slice(comma + 2)];
}
const HAND_OVER = /^to ([a-z0-9][a-z0-9-]*)$/u;
const NOTHING = P.NOTHING;
const refuse = P.refuse;

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// Whether a page is there, for reading only: the plan's, else the desk's, a link followed as every
// reader follows one.
function seen(plan, rel) {
  if (plan.pages.has(rel)) return plan.pages.get(rel).text !== null;
  return isFile(plan.file(rel));
}

// The page a slug names in the shared folders or seats/, by its path under celorus/, or null
// (demo reconcile._page): the plan's pages first, so a page this run made is found. `writes`: the
// run may write the page it finds, so a link or a folder at any place looked at refuses the run.
// A seat's page is only ever looked at: the overnight writes nothing under seats/.
function pageOf(plan, slug, writes = true) {
  if (typeof slug !== "string" || !T.HANDLE.test(slug)) return null;
  for (const folder of FOLDERS) {
    const rel = `${folder}/${slug}.md`;
    if (writes && folder !== SEATS ? plan.holds(rel) : seen(plan, rel)) return rel;
  }
  return null;
}

// A page's header and body as the plan would leave it, for reading only: the plan's, else the
// desk's, a link followed; null when it does not read.
function viewOf(plan, rel) {
  if (plan.pages.has(rel)) {
    const page = P.open(plan, rel);
    return page ? { head: page.head, body: page.body } : null;
  }
  const page = readPage(plan.ctx.celorus, rel);
  return page.problem || page.head === null || typeof page.head !== "object" ? null : { head: page.head, body: page.body };
}

// The run's context line for log.md, added to the plan's log.md.
function logLine(plan, run, what) {
  const line = T.logLine(run.at.clock, run.seat, SKILL, what);
  plan.put(LOG, T.withLogLine(plan.read(LOG), run.at.date, run.at.clock, line, plan.ctx.footer));
  run.lines.push(line);
}

// A line log.md does not already hold, so a rerun writes nothing new (demo reconcile._log_once).
function logOnce(plan, run, what) {
  const said = T.clean(what);
  if (P.logEntries(plan.read(LOG)).some((e) => e.what === said)) return;
  logLine(plan, run, what);
}

function mergedConversations(plan) {
  const text = plan.read(MERGE_RECORD);
  return new Set(text === null ? [] : P.readTable(text).map((row) => T.unlink(row.conversation)));
}

function addMergeRow(plan, run, row) {
  const ctx = plan.ctx;
  let text = plan.read(MERGE_RECORD);
  if (text === null) {
    // The demo's desk made this page at set-up and its run failed without it; the engine makes
    // it on the first run that merges a conversation.
    text = P.tablePage(
      { type: "merge-record", title: "Merge record", timestamp: T.stamp(run.at.iso), generated_by: ctx.generatedBy },
      "Merge record",
      "Which conversations the overnight run has merged into the shared pages.",
      MERGE_COLUMNS,
      ctx.footer,
    );
  }
  plan.put(MERGE_RECORD, P.withRegisterRows(MERGE_RECORD, text, [row], ctx.generatedBy));
}

// A named person with no page: a named-only person page (demo reconcile._named_only).
function namedOnly(plan, run, { slug, name, note, conv, family, date, saidBy }) {
  const ctx = plan.ctx;
  const words = T.clean(note).split('"').join("'");
  const header = {
    type: "person",
    title: T.clean(name),
    description: T.clean(note) || "Named on a call.",
    timestamp: T.stamp(run.at.iso),
    standing: "named-only",
    name_source: conv, // the plain file name (C09), where the demo wrote a link
    member_of: [T.link(family)],
    generated_by: ctx.generatedBy,
  };
  const proof = P.proofLine("member_of", family, "yours", date, { conversation: conv, words: words || null, saidBy });
  const body = [`# ${T.clean(name)}`, "", `Named on [[${conv}]]. We hold no contact details for this person.`, "", "## Connections", "", proof];
  if (ctx.footer !== null) body.push("", ctx.footer);
  plan.put(`people/${slug}.md`, T.pageText(header, body.join("\n")));
}

// The person onto the family's own page, under Members (demo reconcile._join_family).
function joinFamily(plan, run, { slug, family, note }) {
  const rel = `families/${family}.md`;
  if (!T.HANDLE.test(family) || !plan.holds(rel)) return false;
  const page = P.open(plan, rel);
  const footer = plan.ctx.footer;
  const onIt = [...P.section(page.body, "Members", footer), ...P.section(page.body, "Contacts", footer)].flatMap((line) => {
    const slug = linkedItem(line);
    return slug === null ? [] : [slug];
  });
  if (onIt.includes(slug)) return false;
  const said = T.clean(note).replace(/\.+$/u, "");
  page.body = P.addToSection(page.body, "Members", [said ? `- [[${slug}]], ${said}.` : `- [[${slug}]], named on a call.`], footer);
  P.touch(page, run.at);
  P.close(plan, page);
  return true;
}

// One heard line onto its subject's page (demo reconcile._apply).
function apply(plan, run, rel, p, conv) {
  const page = P.open(plan, rel);
  const footer = plan.ctx.footer;
  if (p.connection === "note") {
    const parts = [`- ${p.date}`, `"${p.words}"`];
    if (p.said_by) parts.push(`said by [[${p.said_by}]]`);
    page.body = P.addToSection(page.body, "What we have heard", [[...parts, `in [[${conv}]]`].join(T.DOT)], footer);
  } else {
    const key = p.connection;
    if (LISTS.has(key)) {
      const had = page.head[key];
      const values = (Array.isArray(had) ? had : had === undefined || had === null ? [] : [had]).map((v) => T.unlink(v));
      P.setKey(page, key, [...new Set([...values, p.target])].map(T.link));
    } else if (SINGLE.has(key) && !page.head[key]) {
      P.setKey(page, key, T.link(p.target));
    }
    const line = P.proofLine(key, p.target, p.register, p.date, { conversation: conv, words: p.words, saidBy: p.said_by });
    page.body = P.addToSection(page.body, "Connections", [line], footer);
  }
  P.touch(page, run.at);
  P.close(plan, page);
}

// 1. The conversations dated before the run's day, not yet merged (demo reconcile.grow).
function grow(plan, run) {
  const ctx = plan.ctx;
  const footer = ctx.footer;
  const done = mergedConversations(plan);
  const out = [];
  let names = [];
  try {
    names = fs
      .readdirSync(path.join(ctx.celorus, "conversations"))
      .filter((name) => name.endsWith(".md"))
      .sort();
  } catch {
    names = [];
  }
  for (const name of names) {
    const conv = name.slice(0, -3);
    const rel = `conversations/${name}`;
    if (done.has(conv)) continue;
    const page = readPage(ctx.celorus, rel);
    if (page.problem || page.head === null || typeof page.head !== "object") {
      run.unread.push({ page: rel, why: `${page.problem || "no header"}${page.why ? ` (${page.why})` : ""}; it was not merged` });
      continue;
    }
    const day = page.head.date === undefined || page.head.date === null ? null : T.readDate(String(page.head.date));
    if (day === null) {
      run.unread.push({ page: rel, why: "its date does not read as a date; it was not merged" });
      continue;
    }
    if (day >= run.at.date) continue;
    const family = T.unlink(page.head.about);
    if (!T.HANDLE.test(family)) {
      run.unread.push({ page: rel, why: "its about names no page of the desk; it was not merged" });
      continue;
    }
    const attended = Array.isArray(page.head.attended) ? page.head.attended : [];
    // An attendee with a page, counted through the plan as seen() and pageOf() count: a page this
    // run has just planned counts, so one run over two days equals two daily runs.
    const people = attended.map((a) => T.unlink(a)).filter((a) => T.HANDLE.test(a) && seen(plan, `people/${a}.md`));
    const speaker = people.length === 1 ? people[0] : null;
    const grown = new Set();
    let lines = 0;
    for (const text of P.section(page.body, "Named on this call", footer)) {
      const m = namedItem(text);
      if (!m) continue;
      const [slug, fullName, note] = m;
      if (!T.HANDLE.test(slug)) {
        run.unread.push({ page: rel, why: "a person it names has a slug that is not lowercase words joined by hyphens; no page was made for them" });
        continue;
      }
      if (pageOf(plan, slug) !== null) continue;
      namedOnly(plan, run, { slug, name: fullName, note, conv, family, date: day, saidBy: speaker });
      grown.add(slug);
      lines += 1;
      if (joinFamily(plan, run, { slug, family, note })) {
        grown.add(family);
        lines += 1;
      }
    }
    for (const text of P.section(page.body, "Heard on this call", footer)) {
      const p = P.parseProofLine(text);
      const target = p && p.subject ? pageOf(plan, p.subject) : null;
      if (target === null || (p.connection !== "note" && !p.target)) continue;
      // A note with no words has nothing to carry: the demo wrote the word None in their place.
      if (p.connection === "note" && p.words === null) continue;
      // A line about a seat stays on the conversation: a seat's page is every seat's, staged and
      // sent up by desk_sync, and the overnight never writes it.
      if (target.startsWith(`${SEATS}/`)) {
        run.unread.push({ page: rel, why: "a line heard on it is about a seat, and the overnight never writes a seat's page: the line stays on the conversation and grew no page" });
        continue;
      }
      apply(plan, run, target, p, conv);
      grown.add(p.subject);
      lines += 1;
    }
    addMergeRow(plan, run, { conversation: `[[${conv}]]`, date: day, merged_on: run.at.date, lines, pages: grown.size });
    logLine(plan, run, `grew ${grown.size} pages from [[${conv}]] (${lines} lines)`);
    const titles = {};
    for (const slug of [...grown].sort()) {
      const at = pageOf(plan, slug, false);
      if (at === null) continue;
      const view = viewOf(plan, at);
      titles[slug] = view && view.head && view.head.title ? String(view.head.title) : slug;
    }
    out.push({ conversation: conv, pages: [...grown].sort(), lines, titles });
  }
  return out;
}

function handedTo(outcome, seats) {
  const m = HAND_OVER.exec(T.clean(outcome));
  return m && seats.includes(m[1]) ? m[1] : null;
}

// 2. The hand-overs dated before the run's day (demo reconcile.hand_overs).
function handOvers(plan, run) {
  const text = plan.read(DESK_LOG);
  if (text === null) return [];
  const rows = P.readTable(text).filter((r) => r.action === "handed-over" && r.date && T.readDate(r.date) !== null && T.readDate(r.date) < run.at.date);
  for (const row of rows) {
    if (handedTo(row.outcome, run.seats) === null) {
      const target = T.pyStrip(T.clean(row.outcome).replace(/^to /u, ""));
      logOnce(plan, run, `skipped the hand-over of [[${T.unlink(row.lead)}]] dated ${row.date}: no seat page for "${target}"`);
    }
  }
  // Each family's latest valid hand-over, latest by the row's date, a later row breaking a tie.
  const latest = new Map();
  rows.forEach((row, i) => {
    const to = handedTo(row.outcome, run.seats);
    if (to === null) return;
    const family = T.unlink(row.lead);
    const key = [T.readDate(row.date), i];
    const held = latest.get(family);
    if (!held || key[0] > held.key[0] || (key[0] === held.key[0] && key[1] >= held.key[1])) latest.set(family, { key, to });
  });
  const moved = [];
  for (const [family, { to }] of latest) {
    const rel = `families/${family}.md`;
    if (!T.HANDLE.test(family) || !plan.holds(rel)) continue;
    const page = P.open(plan, rel);
    if (T.unlink(page.head.owner) === to) continue;
    P.setKey(page, "owner", T.link(to));
    P.touch(page, run.at);
    P.close(plan, page);
    logLine(plan, run, `[[${family}]] now owned by ${to}`);
    moved.push(family);
  }
  return moved;
}

// 3. A CRM record made from the desk gets its id onto the family's person page: the member
// whose name matches the record (demo reconcile.link_crm). The result never turns on the order of
// the records (the base's rulings on E9's item 9 and, in fix round 2, item 2): every record is read
// against the desk as the run found it, and only then is anything written. A record is tied only
// when it is the one record naming its member, that member holds no id, and the record names no
// other member. Every other record that names a family of the desk is passed over, fail closed,
// with no id written and no line in the history, and is named in unread by its id: no member's
// name matched it (the demo tied it to the decision maker, which held her own record out for good);
// more than one record names the member (the first in the list used to win, and the other was
// dropped unsaid); the member already holds another id; or the record came more than once, under
// the names of different members. Links go down in the order of the pages' names, and unread in
// the order of the ids.
// An id is one record however many times it comes (fix round 3, item 1): where it comes under more
// than one name, or one name in more than one family (round 4, item 1), every copy of it is passed over with the one reason that says so, and nothing a
// copy would have done on its own (a link, another reason) is done: its id goes onto no page, and
// unread names it once. The same id under the same name in the same family is one record, read once.
function linkCrm(plan, run, records) {
  const footer = plan.ctx.footer;
  const reached = (rec) => {
    const family = rec.desk_ref;
    const rel = typeof family === "string" && T.HANDLE.test(family) ? `families/${family}.md` : null;
    return rel !== null && rec.stage !== "Merged" && seen(plan, rel);
  };
  const namesOf = new Map(); // a record's id -> every family and name it comes under, the name read without case
  for (const rec of records) {
    if (!reached(rec)) continue;
    if (!namesOf.has(rec.id)) namesOf.set(rec.id, new Set());
    namesOf.get(rec.id).add(`${rec.desk_ref}\n${rec.name.toLowerCase()}`);
  }
  const cameTwice = (id) => `CRM record ${unpathed(id)} came more than once, under different names or families, so its id went onto no page: it is tied by hand, on the page of the person it belongs to`;
  const claims = new Map(); // a member's page -> its title, and the ids of the records naming it
  const names = new Map(); // a record's id -> the members' pages it names
  const passed = new Map(); // what is passed over, each once
  const pass = (id, why) => passed.set(`${id}\n${why}`, { record: unpathed(id), why });
  const onNoPage = (id) => `so the id of CRM record ${unpathed(id)} went onto no page`;
  for (const rec of records) {
    const family = rec.desk_ref;
    const rel = typeof family === "string" && T.HANDLE.test(family) ? `families/${family}.md` : null;
    if (rel === null || rec.stage === "Merged" || !seen(plan, rel)) continue;
    const view = viewOf(plan, rel);
    if (view === null) continue;
    const members = [...P.section(view.body, "Members", footer), ...P.section(view.body, "Contacts", footer)].flatMap((line) => {
      const slug = linkedItem(line);
      return slug === null ? [] : [slug];
    });
    const headers = new Map();
    for (const slug of members) {
      if (headers.has(slug) || !T.HANDLE.test(slug) || !seen(plan, `people/${slug}.md`)) continue;
      const person = viewOf(plan, `people/${slug}.md`);
      if (person && person.head && typeof person.head === "object") headers.set(slug, person.head);
    }
    if ([...headers.values()].some((h) => String(h.crm_id) === rec.id)) continue;
    if (namesOf.get(rec.id).size > 1) {
      pass(rec.id, cameTwice(rec.id));
      continue;
    }
    const named = [...headers.entries()].find(([, h]) => String(h.title).toLowerCase() === rec.name.toLowerCase());
    if (!named) {
      pass(rec.id, `no member's name matched CRM record ${unpathed(rec.id)}, so its id went onto no page: it is tied by hand, on the page of the person it belongs to`);
      continue;
    }
    const [target, head] = named;
    const title = unpathed(String(head.title));
    // The person holds an id already: it stays, and this record's is not written over it.
    if (head.crm_id) {
      pass(rec.id, `${title} already holds another CRM id, ${onNoPage(rec.id)}: which of the two is right is settled by hand`);
      continue;
    }
    if (!claims.has(target)) claims.set(target, { title, ids: new Set() });
    claims.get(target).ids.add(rec.id);
    if (!names.has(rec.id)) names.set(rec.id, new Set());
    names.get(rec.id).add(target);
  }
  const linked = [];
  for (const target of [...claims.keys()].sort()) {
    const { title, ids } = claims.get(target);
    let clear = ids.size === 1;
    for (const id of ids) {
      if (names.get(id).size > 1) {
        pass(id, cameTwice(id));
        clear = false;
      } else if (ids.size > 1) {
        pass(id, `more than one CRM record names ${title}, ${onNoPage(id)}: it is tied by hand, if it is the right one`);
      }
    }
    if (!clear) continue;
    const [id] = ids;
    const page = P.open(plan, `people/${target}.md`);
    P.setKey(page, "crm_id", id);
    P.touch(page, run.at);
    P.close(plan, page);
    logLine(plan, run, `linked [[${target}]] to CRM record ${id}`);
    linked.push(target);
  }
  for (const key of [...passed.keys()].sort()) run.unread.push(passed.get(key));
  return linked;
}

// 4. Inbound mail on a family's thread that no reply row covers becomes a reply row, one per
// family per run (demo reconcile.log_replies, but for which mail a row covers, below). The row is by the seat running the overnight.
function logReplies(plan, run, threads) {
  const ctx = plan.ctx;
  const text = plan.read(DESK_LOG);
  const rows = text === null ? [] : P.readTable(text);
  const out = [];
  threads.forEach((t, i) => {
    const inbound = t.messages.filter((m) => !m.from_seat && m.at.slice(0, 10) < run.at.date);
    if (!t.family || !inbound.length) return;
    const last = inbound[inbound.length - 1];
    // Which mail a reply row covers: the mail dated before it, and no other. A row the overnight
    // wrote on day D (source mail) was written by a run on D, and a run reads only mail dated before
    // its day, so mail dated D is not covered by it (the demo skipped that mail, and it was never
    // logged). A row a seat logged by hand on D (log_action, source desk) names no thread: the row
    // has no column for one, log_action takes none, and a thread passed here carries no key. So it
    // is read by the same rule, and mail dated D that a seat logged by hand on D is logged again by
    // the next run. That double row is known and kept: the other way loses a reply for good (the
    // base's ruling on E9 fix round 2, item 5: a row covers a thread's mail for its day once it
    // can name the thread, and never by the day alone).
    if (rows.some((r) => r.action === "reply" && T.unlink(r.lead) === t.family && r.date > last.at.slice(0, 10))) return;
    if (!run.seats.includes(t.seat)) {
      refuse(`the seat of mail thread ${i + 1} must be a seat handle, one of: ${seatsNamed(run.seatList)}; got ${JSON.stringify(t.seat)}. ${NOTHING}`);
    }
    if (!T.HANDLE.test(t.family) || pageOf(plan, t.family, false) === null) {
      refuse(`the family of mail thread ${i + 1} is not a page on this desk: pass the slug of a family page it already has. ${NOTHING}`);
    }
    const said = screened([[`the sender's name in mail thread ${i + 1}`, last.from_name]]);
    if (said) refuse(said);
    if (plan.read(DESK_LOG) === null) refuse(`${DESK_LOG} is not on this desk, so the reply row has nowhere to go. ${NOTHING}`);
    const outcome = `reply from ${last.from_name}`;
    const row = {
      date: run.at.date,
      seat: t.seat,
      lead: `[[${t.family}]]`,
      source: "mail",
      minutes: null,
      action: "reply",
      outcome: T.clean(outcome),
      mark: null,
      by: run.seat,
    };
    plan.put(DESK_LOG, P.withRegisterRows(DESK_LOG, plan.read(DESK_LOG), [row], ctx.generatedBy));
    rows.push(row);
    logLine(plan, run, `reply [[${t.family}]]: ${outcome}`);
    out.push(t.family);
  });
  return out;
}

// The inputs the skill reads through the connectors, held to their shapes before anything.
function recordsOf(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) refuse(`crm_records is a list of the CRM records made from the desk, [] when none. ${NOTHING}`);
  return value.map((rec, i) => {
    const ok =
      rec !== null &&
      typeof rec === "object" &&
      !Array.isArray(rec) &&
      typeof rec.id === "string" &&
      T.pyStrip(rec.id) !== "" &&
      !/[\n\r|]/u.test(rec.id) &&
      typeof rec.name === "string" &&
      ["desk_ref", "stage"].every((k) => rec[k] === undefined || rec[k] === null || typeof rec[k] === "string");
    if (!ok) refuse(`crm record ${i + 1} is {id, name, desk_ref, stage}: its id and name as text, on one line, desk_ref the family's slug or null. ${NOTHING}`);
    return rec;
  });
}

function threadsOf(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) refuse(`mail_threads is a list of the mail threads on the desk's families, [] when none. ${NOTHING}`);
  return value.map((t, i) => {
    const shape = `mail thread ${i + 1} is {family, seat, messages}: messages [{from_seat, at, from_name}], at as 2026-09-21T10:30:00+05:30. ${NOTHING}`;
    if (t === null || typeof t !== "object" || Array.isArray(t) || !Array.isArray(t.messages)) refuse(shape);
    if (!(t.family === undefined || t.family === null || typeof t.family === "string") || typeof t.seat !== "string") refuse(shape);
    for (const m of t.messages) {
      const ok =
        m !== null &&
        typeof m === "object" &&
        typeof m.from_seat === "boolean" &&
        typeof m.at === "string" &&
        T.readDate(m.at) !== null &&
        (m.from_seat || typeof m.from_name === "string");
      if (!ok) refuse(shape);
    }
    return t;
  });
}

function overnightReconcile(ctx, args) {
  const seats = seatsOf(ctx.celorus, ctx.desk);
  if (typeof args.seat !== "string" || !seats.handles.includes(args.seat)) {
    refuse(`seat must be a seat handle, one of: ${seatsNamed(seats)}; got ${JSON.stringify(unpathed(String(args.seat)))}. ${NOTHING}`);
  }
  if (typeof args.attended !== "boolean") {
    refuse(`attended is true when a person is watching this run, and false when a routine runs it. ${NOTHING}`);
  }
  const records = recordsOf(args.crm_records);
  const threads = threadsOf(args.mail_threads);
  const plan = new P.Plan(ctx);
  if (!args.attended) {
    if (!R.attendedRun(plan.read(LOG))) {
      refuse(
        "The overnight runs unattended only after one attended run, and log.md holds no attended run of it: " +
          `run it once with a person watching it (attended true) before any routine runs it. ${NOTHING}`,
      );
    }
    // Only a row the removal list can name counts: the one rule of the register (R.ownScript), so
    // a register whose every row was written by hand, or on another machine, lets no routine run.
    const register = R.readRegister(ctx.celorus);
    if (register.rows === null || !register.rows.some((row) => R.ownScript(row.routine, row.skill_file))) {
      refuse(
        "No routine is on the desk's register, so this unattended run is one taking the desk out could not " +
          `name: record the routine that runs it with register_routine first. ${NOTHING}`,
      );
    }
  }
  const run = { at: ctx.at, seat: args.seat, seats: seats.handles, seatList: seats, lines: [], unread: [] };
  const grown = grow(plan, run);
  const handedOver = handOvers(plan, run);
  const linked = linkCrm(plan, run, records);
  const replies = logReplies(plan, run, threads);
  const how = args.attended ? R.RUN_LINE.attended : R.RUN_LINE.routine;
  logLine(
    plan,
    run,
    `${how}: ${grown.length} conversations merged, ${handedOver.length} hand-overs, ${linked.length} CRM links, ${replies.length} replies`,
  );
  // log.md last: the history line goes down after every page it names (house rule 5).
  const steps = plan.steps();
  const ordered = [...steps.filter((s) => s.rel !== LOG), ...steps.filter((s) => s.rel === LOG)];
  refuseLinkedFolders(
    ctx.celorus,
    ordered.map((s) => s.rel),
  );
  const done = writeSteps(ctx.celorus, ordered);
  const answer = {
    tool: ctx.tool,
    plugin_version: ctx.version,
    desk: ctx.desk.name,
    attended: args.attended,
    grown,
    handed_over: handedOver,
    linked,
    replies,
    unread: run.unread,
  };
  if (done.written === null) {
    return { ...answer, written: null, history: null, reason: done.reason, previous_text: done.previous_text };
  }
  return { ...answer, written: done.written, history: { page: LOG, lines: run.lines }, reason: null, previous_text: null };
}

module.exports = { overnightReconcile, MERGE_RECORD, MERGE_COLUMNS };
