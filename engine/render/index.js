"use strict";
// render_view: a desk's page as one self-contained HTML file. Scripts count (counts.js, facts.js),
// the model writes sentences (`prose`), and the page drops both into the shared base. A page is
// saved beside its sentences, so a later render reuses the words.
//
// The pages: the two family pages, the reach-out card (level one) and the room brief (level
// two), and a seat's morning brief. The CRM, calendar, mail and chat rows the pages count come in
// as one argument, `systems` (base ruling R7; systems.js has the contract): the engine
// never reaches a connector and never reads a folder outside the desk.
//
// Ported from the demo kit's render.py (row E5). Every page carries
// `generated_by: celorus-plugin <version> render_view` as a meta line in its head.

const path = require("path");
const { Refusal } = require("../lib/refusal.js");
const { pluginVersion } = require("../lib/version.js");
const { readDesk, deskShown, DESK_ARGUMENT } = require("../lib/desk.js");
const { Desk } = require("./desk.js");
const { systemsOf } = require("./systems.js");
const C = require("./counts.js");
const { familyFacts } = require("./facts.js");
const { proseRefusal, shownRefusal, OWN_TEXT, PATH_ONLY } = require("./screen.js");
const { checked, drawnRefusal, rowRefs, withoutCarried } = require("./prose.js");
const { settingsFiles, missingSettings, settingsTargets } = require("./obsidian.js");
const { deskRoot, plainFolder, plainFile, emptyFiles, readPlain, writeAll } = require("./files.js");
const W = require("./words.js");
const { pageContext, fellBack, delinker } = require("../templates/parts.js");
const { liveRows, handedOver } = require("../live/live.js");
const { PAGES } = require("../templates/pages.js");
const { assemble } = require("../templates/base.js");
const { persona, notUsed } = require("../lib/persona.js");
const { RECONCILE_TOOL } = require("./reconcile.js");
const { forSnapshot, MINTED } = require("./key.js");

const TOOL = "render_view";
const VIEWS_REL = "celorus/.views";
const SAVED_REFUSED = "The saved sentences for this page cannot go on it: ";
// what a render answers when a connector's rows were handed to it, kept or refused (row E11, the
// live-row contract)
const NOT_SAVED =
  "This page was drawn with rows read from a connector, so its sentences were not saved and no saved " +
  "sentence was drawn: send the sentences again with each render that hands rows over.";
// the line every page render_view draws carries in its head (templates/base.js)
const DRAWN_HERE = /<meta name="generated_by" content="celorus-plugin [^ "]+ render_view">/;
const VIEWS = Object.keys(PAGES);
const FAMILY_VIEWS = ["reach-out-card", "room-brief", "summary-card"];
// row E6: a seat's console, keyed by the seat, and the desk's two team pages, keyed "team"
const SEAT_VIEWS = { "rep-console": C.repView, "rm-console": C.rmView };
const TEAM_VIEWS = ["lead-gen", "snapshot"];
const TEAM_KEY = "team";
const ARGUMENTS = ["desk", "view", "family", "seat", "date", "prose", "systems", "taken_at"];
// the snapshot's moment, in the desk's zone: seconds and the zone's own offset may be written
const TAKEN_AT = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(\+05:30)?$/;
const NO_TOUCH = "No one on this desk has spoken to this family yet.";
// the desk's zone: a day not named is today there
const IST_MS = (5 * 60 + 30) * 60 * 1000;

function todayInIst(now = Date.now()) {
  return new Date(now + IST_MS).toISOString().slice(0, 10);
}

// The touch line of a family page. With no touch on the desk's own pages and the CRM not counted
// (not handed over, or set aside), the line is left out: that no one has spoken to the family is
// said only when the CRM's logged touches were read too.
function touchWords(last, crmCounted) {
  if (last) return `Last touch ${W.dayWords(last)}`;
  return crmCounted ? NO_TOUCH : "";
}

function refuseFamily(desk, family) {
  const valid = desk
    .of("families")
    .map((p) => p.slug)
    .sort();
  throw new Refusal(
    `${JSON.stringify(family || "")} is not a family on this desk. The ${TOOL} family pages take one of: ${valid.join(", ")}.`,
  );
}

function refuseSeat(desk, seat) {
  const valid = desk
    .of("seats")
    .map((p) => p.slug)
    .sort();
  throw new Refusal(`${JSON.stringify(seat)} is not a seat on this desk: the seats are ${valid.join(", ")}.`);
}

function familyView(desk, st, seat, family, day) {
  const data = familyFacts(desk, st, family);
  if (data === null) refuseFamily(desk, family);
  Object.assign(data, {
    seat,
    seat_name: seat ? desk.title(seat) : "",
    date: day,
    date_label: W.dateLabel(day),
    touch_words: touchWords(data.last_touch, st.given.includes("crm")),
    // what the page could not count, as family_facts answers it (counts.js notHandedOver): the CRM
    // when its rows are not counted, which a family page says in its "Not counted" block
    crm_counted: st.given.includes("crm"),
    unread: C.notHandedOver(st, C.FAMILY_READS),
  });
  // the signal's sentence is counts.signalWhy's, never a second copy: the label is the pitch
  data.signal_rows = desk.signals(family).map((s) => ({
    family,
    title: W.dayWords(desk.get(s, "as_of")),
    why: C.signalWhy(s),
    why_today: desk.get(s, "engine"),
    ref: s.slug,
    kind: "signal",
  }));
  const briefs = desk
    .of("briefs")
    .filter((p) => desk.get(p, "about") === family && desk.get(p, "brief_kind") === "room")
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  data.brief = briefs.length ? desk.sections(briefs[briefs.length - 1].body) : [];
  return data;
}

function dayOf(date) {
  if (date === undefined || date === null) return todayInIst();
  try {
    return W.asDate(date);
  } catch {
    throw new Refusal(`${JSON.stringify(date)} is not a date; a view is rendered for a day written like 2026-09-21.`);
  }
}

// The moment a snapshot is taken (row E6), as "YYYY-MM-DDTHH:MM:SS+05:30", and the day it is of:
// `taken_at` as given, in IST, or now in IST when it is left out. The moment falls on the page's
// day, so a snapshot of a day is always taken on it; a moment in another zone is refused, never
// converted.
function snapshotMoment(takenAt, date, now = Date.now()) {
  let moment;
  if (takenAt === undefined || takenAt === null) {
    moment = `${new Date(now + IST_MS).toISOString().slice(0, 19)}+05:30`;
  } else {
    const m = typeof takenAt === "string" ? TAKEN_AT.exec(takenAt) : null;
    let real = false;
    try {
      real = m !== null && W.asDate(m[1]) === m[1];
    } catch {
      real = false;
    }
    if (!real) {
      throw new Refusal(
        `taken_at is ${JSON.stringify(takenAt)}, which is not a moment in IST: write it like 2026-09-21T08:31:00+05:30, in the desk's zone, never another.`,
      );
    }
    moment = `${m[1]}T${m[2]}:${m[3]}:${m[4] || "00"}+05:30`;
  }
  const day = date === undefined || date === null ? moment.slice(0, 10) : dayOf(date);
  if (moment.slice(0, 10) !== day) {
    throw new Refusal(
      `The snapshot of ${day} is taken on that day, and taken_at (${moment}) is not: pass taken_at on ${day}, or leave date out.`,
    );
  }
  return { moment, day };
}

// The sentences as the page's schema takes them (prose.js), each text screened as it was sent,
// or a refusal: the file saved beside the page is written only from what this answers. The rules
// in `skip` are left out: a path, in the sentences a render saved before (the page's own text).
// `carries`, when given, says whether a sentence carries a word of a row the live-row contract
// refused (live/live.js): each that does is left out before the screen reads the rest, and
// `setAside` counts them. A sentence left out is said by that count alone, never by its words.
function schemaWords(view, value, refs, prefix = "", skip = undefined, carries = null) {
  const { words: sent, refused } = checked(view, value, refs);
  if (refused) throw new Refusal(`${prefix}${refused}`);
  const { words, setAside } = carries ? withoutCarried(view, sent, carries) : { words: sent, setAside: 0 };
  const why = proseRefusal(words, skip);
  if (why) throw new Refusal(`${prefix}${why}`);
  return { words, setAside };
}

// Whether a page already at the path is one render_view drew: its generated_by line says so.
function drawnHere(text) {
  return DRAWN_HERE.test(text);
}

// The generated_by line a page this engine draws now carries.
function drawnBy() {
  return `celorus-plugin ${pluginVersion()} ${TOOL}`;
}

function renderView(args = {}) {
  // required here, not at the top: lib/tools.js requires this file for its tool list
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(TOOL, args, ARGUMENTS);
  const { view, family = "", seat = "", date, prose, systems } = args;
  if (!VIEWS.includes(view)) {
    throw new Refusal(`${JSON.stringify(view === undefined ? "" : view)} is not a view. The views are: ${VIEWS.join(", ")}.`);
  }
  if (view !== "snapshot" && args.taken_at !== undefined) {
    throw new Refusal(`taken_at is the moment a snapshot is taken; the ${view} takes none. Leave it out.`);
  }
  for (const [key, value] of [
    ["family", family],
    ["seat", seat],
  ]) {
    if (typeof value !== "string") throw new Refusal(`\`${key}\` is a page name, as text.`);
  }
  if (TEAM_VIEWS.includes(view) && seat) {
    throw new Refusal(`The ${view} is the desk's, for its head, and is drawn for no seat: leave seat out.`);
  }
  const taken = view === "snapshot" ? snapshotMoment(args.taken_at, date) : null;
  const day = taken ? taken.day : dayOf(date);
  // the shape of `systems`, refused whole as every tool that takes it refuses it
  systemsOf(systems, { held: true });
  const fresh = prose !== undefined && prose !== null;
  const found = deskFor(args.desk, { writes: true });
  const read = readDesk(found);
  if (read.stampsUnread) {
    throw new Refusal(`The desk's stamps page ${read.stampsUnread.rel} cannot be read, so no page is drawn. Run check_desk to see why.`);
  }
  const desk = new Desk(read);
  // The live-row contract (row E11, live/live.js): a connector's rows are counted only when each
  // names someone on this desk, as it is read now, and only by the fields the contract carries. A
  // role holding a refused row is counted as not handed over. The sentences meet the contract before
  // they are checked: they are held to the rows that are left and to no other, so a refusal of them
  // names no refused row, and a sentence that carries a refused row's name, handle or number, as it
  // was sent or as the page would draw it, is left out and counted.
  const contract = liveRows(systems, read);
  const st = systemsOf(contract.systems);
  const refs = rowRefs(st);
  const asDrawn = delinker(desk).plain;
  const carries = (text) => contract.carriesRefused(text) || contract.carriesRefused(asDrawn(text));
  const given = fresh ? schemaWords(view, prose, refs, "", undefined, carries) : null;
  // a call that handed a connector's rows over, kept or refused: its sentences are about those
  // rows, never the desk's, so they are neither saved nor read from the ones saved
  const live = handedOver(contract);
  let data;
  let key;
  if (FAMILY_VIEWS.includes(view)) {
    if (seat && !(desk.pages.has(seat) && desk.pages.get(seat).kind === "seats")) refuseSeat(desk, seat);
    data = familyView(desk, st, seat, family, day);
    key = family;
  } else if (Object.hasOwn(SEAT_VIEWS, view)) {
    data = SEAT_VIEWS[view](desk, st, seat, day);
    // an RM's meetings link to no meeting brief here, as on the morning brief
    data.briefs = {};
    key = seat;
  } else if (TEAM_VIEWS.includes(view)) {
    data = view === "snapshot" ? C.snapshotView(desk, st, day, taken.moment) : C.leadGenView(desk, st, day);
    key = TEAM_KEY;
  } else {
    data = C.briefView(desk, st, seat, day);
    // what each of an RM's meetings links to: the meeting brief a build made is outside the desk,
    // so there is none here
    data.briefs = {};
    key = seat;
  }
  // Everything this render reads or writes is looked at before anything is written: the views
  // folder, the page, its saved sentences and the Obsidian settings, each a plain folder or file
  // inside the desk, never a link (files.js), opened under the desk as it resolves now, and each
  // opened and checked before the first byte of any of them is written (files.writeAll).
  const root = deskRoot(read.root);
  const pageRel = `${VIEWS_REL}/${day}-${view}-${key}.html`;
  const savedRel = `${VIEWS_REL}/${day}-${view}-${key}.prose.json`;
  const out = path.join(read.root, ...pageRel.split("/"));
  const hasViews = plainFolder(root, "celorus") && plainFolder(root, VIEWS_REL);
  const hasPage = hasViews && plainFile(root, pageRel);
  const hasSaved = hasViews && plainFile(root, savedRel);
  const settings = missingSettings(root);
  // an empty page or sentences file is named as empty, never read as a page or sentences: no file
  // render_view writes is at its path before it is whole (files.writeAll), so a kill never leaves
  // one. A settings file already there is the person's own, empty or not, and is never opened,
  // written or named (obsidian.js); a kill leaves a missing setting missing, and the next render
  // writes it.
  const present = [...(hasPage ? [pageRel] : []), ...(hasSaved ? [savedRel] : [])];
  const empty = emptyFiles(root, present);
  if (empty.length) {
    throw new Refusal(
      `These files are empty: ${empty.join(", ")}. A page or its sentences render_view writes is never empty, so an empty one is neither read nor written over: delete each one and render again. Nothing was written.`,
    );
  }
  if (hasPage && !drawnHere(readPlain(root, pageRel))) {
    throw new Refusal(
      `${pageRel} is not a page ${TOOL} drew (it carries no generated_by line of ${TOOL}), so it is not written over. Move it away and render again. Nothing was written.`,
    );
  }
  let savedWords;
  if (hasSaved) {
    try {
      savedWords = JSON.parse(readPlain(root, savedRel));
    } catch (err) {
      // unreadable saved sentences are refused when they would be used, and never written over;
      // the refusal names the path and the kind, never the parser's words (they quote the file)
      if (err instanceof Refusal) throw err;
      if (!fresh) {
        throw new Refusal(
          `The saved sentences at ${savedRel} are not valid JSON; move the file away and render this page again with your own prose. Nothing was written.`,
        );
      }
    }
    if (!W.isMap(savedWords)) {
      throw new Refusal(
        `${savedRel} is not sentences ${TOOL} saved (it is not a JSON object), so it is neither used nor written over. Move it away and render again. Nothing was written.`,
      );
    }
  }
  let words;
  let sentences;
  if (fresh) {
    words = given.words;
    // prose sent with no words in it clears the saved ones: they never come back on a later render
    sentences = !Object.keys(words).length && hasSaved && !live ? "cleared" : "new";
  } else if (hasSaved && !live) {
    // saved sentences are held to the same schema and the same screen before they are used
    words = schemaWords(view, savedWords, refs, SAVED_REFUSED, OWN_TEXT).words;
    sentences = "saved";
  } else {
    words = {};
    sentences = "none";
  }
  const stamp = drawnBy();
  // the persona this desk's page speaks for, read from this desk on this call (lib/persona.js)
  const who = persona({ desk, seat });
  const ctx = pageContext(desk, who);
  // every text is screened as the page draws its slot, drawn by this render or not (R20). A link
  // there reads as its page's title, the desk's own text, which is never refused for a path (R72,
  // K2c), so the path rule reads each link in the model's own words instead; saved sentences are
  // the page's own text, and no path in them is refused
  const sent = sentences !== "saved";
  const drawn = drawnRefusal(view, words, ctx.delink.plain, OWN_TEXT) || (sent ? drawnRefusal(view, words, ctx.delink.own, PATH_ONLY) : null);
  if (drawn) throw new Refusal(sentences === "saved" ? `${SAVED_REFUSED}${drawn}` : drawn);
  // DESK-147: a snapshot's record is sealed with this seat's snapshot key (key.js), and no other
  // view reads it. The key the machine holds is read here; one that does not read as a key refuses
  // the render, and the file is left as it is. Where the machine holds none a new one is made, on
  // no disk yet: it is put at its path only with the snapshot's own files (seal.around, below),
  // and the answer says once that the machine now holds it (key_made).
  const seal = view === "snapshot" ? forSnapshot(root) : null;
  if (seal) data.read = C.rowsRead(desk, taken.moment, seal.key);
  const page = PAGES[view](data, words, ctx);
  // a role that fell back to the desk's own count is said on the page, in the templates' words
  page.content += fellBack(ctx, contract.fell_back);
  // the screen holds what the page says: each sentence as it is drawn, links read and lines joined
  const shown = shownRefusal(ctx.shown, OWN_TEXT) || (sent ? shownRefusal(ctx.shownOwn, PATH_ONLY) : null);
  if (shown) throw new Refusal(sentences === "saved" ? `${SAVED_REFUSED}${shown}` : shown);
  const html = assemble(page, data, { firm: desk.firm(), fixture: desk.fixture, stamp, persona: who });
  // the saved sentences first, so a page never shows words its saved file does not hold; cleared
  // ones are written as the checked empty object, so the file never holds words the page dropped
  const files = [];
  if (!live && (Object.keys(words).length || sentences === "cleared")) files.push({ rel: savedRel, text: `${JSON.stringify(words, null, 2)}\n`, replace: hasSaved });
  files.push({ rel: pageRel, text: html, replace: hasPage }, ...settingsTargets(settings));
  // the sweep set (files.js): the folder of every file this render can create, taken from the same
  // names that chose them, over all of them, missing or not: its sentences, its page and every
  // settings file
  const targets = [savedRel, pageRel, ...settingsTargets(Object.keys(settingsFiles())).map((f) => f.rel)];
  const { removed, kept, unlisted } = seal ? seal.around(() => writeAll(root, files, targets)) : writeAll(root, files, targets);
  const drawnRel = path.relative(read.root, out).split(path.sep).join("/");
  const answer = {
    // The page to show: the caller's `desk` extended, or desk-relative (R72, lib/desk.js deskShown).
    path: deskShown(args.desk, found).at(drawnRel),
    page: drawnRel,
    view,
    key,
    bytes: Buffer.byteLength(html, "utf8"),
    sentences,
    systems: st.given,
    generated_by: stamp,
  };
  if (seal && seal.minted) answer.key_made = MINTED;
  // the contract's answer (row E11): the roles whose rows were refused and are counted as not handed
  // over, each refused row by its role, list and rule, never by its value; how many sentences were
  // left off the page for carrying a refused row's words, never which; and that a call that handed
  // a connector's rows over kept no sentences
  // (item 11, ruled) always said, as empty lists when nothing was refused, never left out: an absent
  // key cannot tell a contract that ran and refused nothing from one that never ran
  Object.assign(answer, { fell_back: contract.fell_back, dropped: contract.dropped });
  if (given && given.setAside) answer.sentences_set_aside = given.setAside;
  if (live) answer.sentences_not_saved = NOT_SAVED;
  // a desk's assistant_name that was set and refused is said, in words that never repeat it
  if (notUsed(who)) answer.assistant_name_not_used = notUsed(who);
  if (settings.length) answer.obsidian_settings_written = settings;
  // the leftover spare files in the sweep set, removed before this one wrote (files.js), each by
  // its path, and apart from them the folders of that set it could not look in
  if (removed.length) answer.spares_removed = removed;
  if (kept.length) answer.spares_not_removed = kept;
  if (unlisted.length) answer.spares_not_looked_for_in = unlisted;
  return answer;
}

const RENDER_TOOLS = [
  {
    name: TOOL,
    description:
      "Draw one desk page as a self-contained HTML file under celorus/.views/ and answer its path: " +
      "the reach-out card, the room brief or the summary card for a family; a seat's morning brief, " +
      "or its console (rep-console for a rep, rm-console for an RM); or the desk's team view " +
      "(lead-gen) or its snapshot. Every number " +
      "and row on it is counted by the engine from the desk and the systems rows handed over; the " +
      "sentences are yours, in prose, and are saved beside the page for the next render. A page drawn " +
      "with systems rows keeps no sentences: send them with each render. A systems row that names no " +
      "one on the desk is refused, and its whole role is then counted as not handed over; the answer " +
      "names the role and the rule. A sentence that carries a name, a handle or a number of a refused " +
      "row is left off the page, and sentences_set_aside says how many were." +
      " What the seat says about themselves is never written to the desk: leave it out of every field.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK_ARGUMENT,
        view: { type: "string", enum: VIEWS, description: "The page to draw." },
        family: {
          type: "string",
          description: "The family page's name, for the reach-out card, the room brief and the summary card.",
        },
        seat: {
          type: "string",
          description:
            "The seat the page is for: required for the morning brief and the consoles, optional on a " +
            "family page, refused on the team view and the snapshot.",
        },
        date: { type: "string", description: "The day, as 2026-09-21. Leave it out for today in IST." },
        prose: {
          description:
            "The sentences for the page, by slot: who_and_why, opener and avoid on the reach-out card " +
            "(each text or a list of text), sections on the room brief (each text, or heading and " +
            "paragraphs), gists on the morning brief (one text per mail thread, keyed by its id in " +
            "systems), upsell on the RM console (one text per family, keyed by its page name). Anything " +
            "else is refused. Leave it out to reuse the saved ones; send it empty to clear them.",
        },
        taken_at: {
          type: "string",
          description:
            "The moment the snapshot is taken, in IST, like 2026-09-21T08:31:00+05:30, on the page's " +
            "day. Leave it out for now. Refused on every other page.",
        },
        systems: {
          type: "object",
          description:
            "The rows read from the desk's connectors, in the stand-in systems' shape: crm (records, " +
            "activities), calendar (events, proposals), mail (threads) and chat (messages). Leave a " +
            "role out when its connector is not there. Every time is an ISO string in IST, like " +
            "2026-09-21T10:00:00+05:30; a time in another zone is refused, never converted.",
        },
      },
      required: ["view"],
      additionalProperties: false,
    },
    run: renderView,
  },
  // row E6: the snapshot held to the views it was drawn from
  RECONCILE_TOOL,
];

module.exports = { RENDER_TOOLS, renderView, familyView, todayInIst, VIEWS, dayOf, drawnHere, drawnBy };
