"use strict";
// The pages render_view draws, each writing only what is its own (direction 2): its name, its
// theme words and drawing, the line its band pill says, its title, heading and lede, its own CSS,
// and its content. The frame, the look and the parts are base.js, design.js and parts.js.
//
// Ported from the demo kit's reach-out-card, room-brief and morning-brief templates (row E5).

const P = require("./parts.js");
const { PAGE_CSS } = require("./design.js");
const W = require("../render/words.js");
const S = require("./seats.js");

const { e } = W;

function css(name) {
  return PAGE_CSS[name];
}

function truthyAttr(rows, key) {
  return rows.filter((r) => W.truthy(r[key]));
}

// Level one: the card read standing up, sixty seconds before a first call.
function reachOutCard(v, prose, ctx) {
  const last = v.signal_rows.length ? v.signal_rows[v.signal_rows.length - 1] : null;
  const whoSlot = W.truthy(prose.who_and_why) ? "who_and_why" : "summary";
  const who = W.joinedLine(prose[whoSlot]);
  // the model's lines, joined as the card shows them, else the desk's own sentence
  const whoLine = who
    ? ctx.prose(whoSlot, who)
    : ctx.delink((last ? last.why : "") || v.wealth || "Ask Milan to write who they are and why now.");
  let c = `${P.ladder("one")}\n`;
  c += `<div class="who-why"><p>${whoLine}</p></div>\n`;
  const people = [...v.members, ...v.contacts];
  const lead = people.find((p) => W.truthy(p.decision_maker)) || null;
  const kin = people.filter((p) => !W.truthy(p.decision_maker));
  c += `<section class="block" id="family">${P.head("The family", people.length)}\n`;
  if (people.length) {
    c += '<div class="fam-card">\n';
    if (lead) {
      c +=
        '<div class="dm">\n' +
        `<div class="dm-who"><b>${e(lead.name)}</b>${lead.role ? `<span class="role">${e(lead.role)}</span>` : ""}<span class="chip ok">Decides</span></div>\n` +
        `<div class="dm-num"><span class="w">Ring</span><span class="n${lead.phone ? "" : " nil"}">${e(lead.phone || "no number held")}</span></div>\n` +
        "</div>\n";
    }
    if (kin.length) {
      c += '<ul class="kin">\n';
      for (const p of kin) {
        c +=
          `<li><div><b>${e(p.name)}</b>${p.role ? `<span class="role">${e(p.role)}</span>` : ""}</div>` +
          `<span class="n${p.phone ? "" : " nil"}">${e(p.phone || "no number held")}</span></li>\n`;
      }
      c += "</ul>\n";
    }
    if (!lead) c += '<p class="hint">Nobody on this family\'s page is marked as the one who decides. Ask who does before you call.</p>';
    c += "</div>\n";
  } else {
    c += '<div class="empty">No one from this family is on the desk yet.</div>\n';
  }
  c += "</section>\n";
  // the warm path leads: a route out of our own records is somebody the desk already knows
  const warm = v.routes.filter((r) => r.register === "yours");
  const cold = v.routes.filter((r) => r.register !== "yours");
  const kind = (r) => W.capitalize((r.kind || "route").replace(/-/g, " "));
  c += `<section class="block" id="routes">${P.head("Routes in", v.routes.length)}\n`;
  if (warm.length) {
    c += '<div class="routes">\n';
    warm.forEach((r, i) => {
      c +=
        '<article class="card is-warm">\n' +
        `<div class="top"><span class="kind">${e(kind(r))}</span>${r.proof ? `<span class="tag">${e(r.proof)}</span>` : ""}<span class="age">${e(W.shortWords(r.date))}</span></div>\n` +
        `<p class="how">${ctx.delink(r.how)}</p>\n` +
        '<div class="foot"><span class="src">From your own records</span></div>\n' +
        `${i === 0 ? '<p class="say">Somebody here already knows them. Open with this one.</p>' : ""}</article>\n`;
    });
    c += "</div>\n";
  }
  if (cold.length) {
    c += `<ul class="ways${warm.length ? " after" : ""}">\n`;
    for (const r of cold) {
      if (r.note) {
        c += `<li><div><span class="kind">Not a route yet</span><span class="how nil">${ctx.delink(r.line)}</span></div><span class="src"><span class="tag">${e(r.note)}</span></span></li>\n`;
      } else {
        c +=
          `<li><div><span class="kind">${e(kind(r))}</span><span class="how">${ctx.delink(r.how)}</span></div>` +
          `<span class="src">${r.proof ? `<span class="tag">${e(r.proof)}</span>` : ""}` +
          `<span>${r.register === "yours" ? "your own records" : "the public record"}</span><span class="d">${e(W.shortWords(r.date))}</span></span></li>\n`;
      }
    }
    c += "</ul>\n";
  }
  if (!v.routes.length) c += '<div class="empty">No route in yet. Ask Milan to look for one.</div>\n';
  c += "</section>\n";
  const opener = W.aslist(prose.opener);
  c += '<div class="pair words">\n';
  c += `<section class="block" id="opener">${P.head("Opener")}\n<div class="opener">\n`;
  c += opener.length
    ? opener.map((line) => `<p class="pad">${ctx.prose("opener", line)}</p>`).join("")
    : '<p class="pad nil">Ask Milan to write the opener.</p>';
  c += '<p class="say">The first words out of your mouth. Say the reason, then stop.</p>\n</div>\n</section>\n';
  c += `<section class="block" id="avoid">${P.head("Avoid")}\n<ul class="avoid">\n<li>No figure about their wealth in the opener.</li>\n`;
  c += W.aslist(prose.avoid)
    .map((a) => `<li>${ctx.prose("avoid", a)}</li>`)
    .join("");
  c += "</ul>\n</section>\n</div>\n";
  c += `<section class="block" id="fit">${P.head("What might fit", v.products.length)}\n`;
  if (v.products.length) {
    c += `<div class="fits">${v.products.map((p) => `<span class="chip">${e(p.product)}</span>`).join("")}</div>\n`;
  } else if (v.signal_rows.length) {
    c += '<div class="empty">No product on the list fits this signal for them yet.</div>\n';
  } else {
    c += '<div class="empty">No product fits yet: there is no signal to fit one to.</div>\n';
  }
  c += "</section>\n";
  c += `${P.block(ctx, "Signals", v.signal_rows, "No signal yet.")}\n`;
  return {
    page_name: "Reach-out card",
    theme: "Way in",
    drawing: "way-in",
    say: v.seat ? "Show my brief" : "",
    title: "Reach-out card",
    heading: e(v.title),
    lede: `<p class="verdict">${e(v.touch_words)}</p>`,
    page_css: css("reach-out-card"),
    content: c,
  };
}

// Level two: the brief an RM reads through once before walking into the room.
function roomBrief(v, prose, ctx) {
  // the model's sections, else the desk's own room brief, else the model's summary
  let sections = W.assections(prose.sections);
  let slot = "sections";
  if (!sections.length) {
    sections = v.brief;
    slot = "";
  }
  if (!sections.length) {
    sections = W.assections(prose.summary);
    slot = "summary";
  }
  const put = slot ? (text) => ctx.prose(slot, text) : ctx.delink;
  let c = `${P.ladder("two")}\n`;
  c +=
    '<aside class="colophon">\n' +
    '<p class="said"><span class="tag">Written at the desk</span>The brief an RM writes from this desk\'s own pages before walking in. Every fact on it says where it came from, and where the desk does not know, it says so.</p>\n' +
    '<p class="apart">Not the meeting brief a console links to: that is a different page, built elsewhere from its own sources.</p>\n' +
    `<span class="when">${e(v.touch_words)}</span>\n` +
    "</aside>\n";
  if (truthyAttr(sections, "heading").length) {
    // the contents row draws every heading as a pill on one line, so the model's are read joined
    if (slot) ctx.sideBySide(slot, truthyAttr(sections, "heading").map((s) => s.heading));
    c += '<nav class="jumps contents" aria-label="The brief, section by section">\n';
    sections.forEach((s, i) => {
      if (s.heading) {
        c += `<a class="jump" href="#sec-${i + 1}"><span class="dot" aria-hidden="true"></span>${put(s.heading)}</a>`;
      }
    });
    c += "</nav>\n";
  }
  c += '<section class="block prose sheet">\n';
  sections.forEach((s, i) => {
    c +=
      `<div class="sh${s.heading ? "" : " bare"}" id="sec-${i + 1}">\n` +
      `${s.heading ? `<div class="sh-h"><h2>${put(s.heading)}</h2></div>` : ""}` +
      `<div class="sh-b">${P.paragraphs(ctx, s.paragraphs, put)}</div>\n` +
      "</div>\n";
  });
  if (!sections.length) c += '<p class="nothing">No room brief yet. Ask Milan to make one.</p>\n';
  c += "</section>\n";
  return {
    page_name: "Room brief",
    theme: "Bearings",
    drawing: "bearings",
    say: v.seat ? "Show my brief" : "",
    title: "Room brief",
    heading: e(v.title),
    lede: "",
    page_css: css("room-brief"),
    content: c,
  };
}

// The seat's morning, as its view counts it: a rep's day, an RM's day, or the desk head's team.
// A figure or block that reads a connector not handed over, or family pages the desk does not
// have, is not drawn, and neither is a line that follows from it: the holes block says it in the
// words desk_count answers (round 3, row A6), never as 0.
function morningBrief(v, prose, ctx) {
  const first = v.seat_name ? v.seat_name.trim().split(/\s+/)[0] : "";
  const n = v.numbers;
  const d = v.detail;
  const gists = W.asmap(prose.gists);
  // every figure and block is drawn through the one page table (round 4, row A9)
  const { has, drawn } = P.gates(v);
  // the strip, the rail and a pair, each drawn only around what is in it
  const strip = (tiles) => (tiles ? `<div class="numbers">\n${tiles}\n</div>\n` : "");
  const rail = (parts) => (parts ? `<aside class="rail">\n${parts}</aside>\n` : "");
  const pair = (...parts) => {
    const kept = parts.filter(Boolean);
    return kept.length === 2 ? `<div class="pair">\n${kept.map((x) => `${x}\n`).join("")}</div>\n` : kept.map((x) => `${x}\n`).join("");
  };
  const line = (text) => (text ? `${text}\n` : "");
  const inbox = (together) => P.gatedInbox(ctx, { has, drawn }, d.blocks.critical_mail, d.blocks.chat, gists, together);
  // the desk head's page has no proposals to put on the calendar
  const cal = v.role !== "desk-head" && has("to_calendar");
  let c = "";
  if (v.role === "rep") {
    c += strip(
      drawn("critical_mail", P.number(n.critical_mail, "critical mail", "act", "waiting on you")) +
        drawn("chat", P.number(n.chat, "chat to answer", "act", "waiting on you")) +
        drawn("to_calendar", P.number(n.to_calendar, "to put on the calendar", "act", "asks you")) +
        drawn("follow_ups", P.number(n.follow_ups, "to follow up", "due", "due")) +
        drawn("to_reach", P.number(n.to_reach, "to reach")) +
        drawn("crm_gaps", P.number(n.crm_gaps, "missing in your CRM")) +
        drawn("backlog", P.number(n.backlog, "backlog")),
    );
    const reach = n.to_reach
      ? `${e(W.capitalize(W.words(n.to_reach)))} ${e(W.plural(n.to_reach, "lead is", "leads are"))} there to reach, each on the console.`
      : "Nobody new to reach today.";
    c +=
      `<div class="grid${cal ? " has-cal" : ""}">\n` +
      (cal ? `${P.toCalendar(ctx, d.blocks.to_calendar)}\n` : "") +
      rail(
        drawn("calendar", `${P.today(v.calendar)}\n`) +
          drawn(
            "to_reach",
            `<section class="block" id="reach">${P.head("To reach", n.to_reach)}\n` + `<div class="card"><p class="subj">${reach}</p></div>\n` + "</section>\n",
          ),
      ) +
      '<div class="page-break"></div>\n' +
      '<div class="col">\n' +
      line(inbox(false)) +
      pair(
        drawn("follow_ups_due", P.follow(ctx, "Follow-ups due", d.blocks.follow_ups_due, "due", "Nothing due today.")),
        drawn("quiet", P.follow(ctx, "Gone quiet", d.blocks.quiet, "quiet", "Nobody has gone quiet.")),
      ) +
      pair(
        drawn("crm_gaps", P.shortList(ctx, "Missing in your CRM", d.blocks.crm_gaps, "crm", "gap", "Every talk is in your CRM.")),
        // the backlog whole, or with its supplied leads in a hole, its overdue follow-ups alone,
        // which read nothing beyond the desk (round 4, row A8)
        P.backlog(ctx, { has, drawn }, d.blocks.backlog),
      ) +
      "</div>\n" +
      "</div>\n";
  } else if (v.role === "rm") {
    // the RM's own work opens the strip; mail and chat come after it
    c +=
      strip(
        drawn("to_calendar", P.number(n.to_calendar, "to put on the calendar", "act", "asks you")) +
          drawn("meetings_today", P.number(n.meetings_today, "meetings today")) +
          drawn("briefs_to_make", P.number(n.briefs_to_make, "briefs to make", "due", "to make")) +
          // n["promises"], a string: the bare word names fs.promises, which the read scan (B4) refuses
          drawn("promises", P.number(n["promises"], "promises owed", "due", "owed")) +
          drawn("book_moments", P.number(n.book_moments, "book moments")) +
          drawn("critical_mail", P.number(n.critical_mail, "critical mail", "act", "waiting on you")) +
          drawn("chat", P.number(n.chat, "chat to answer", "act", "waiting on you")) +
          drawn("meetings_week", P.number(n.meetings_week, "meetings this week")) +
          drawn("meetings_held", P.number(d.counts.meetings_held, "meetings held")) +
          drawn("book_moments_acted", P.number(d.counts.book_moments_acted, "book moments acted on")),
      ) +
      `<div class="grid${cal ? " has-cal" : ""}">\n` +
      (cal ? `${P.toCalendar(ctx, d.blocks.to_calendar)}\n` : "") +
      rail(drawn("calendar", `${P.today(v.calendar)}\n`)) +
      '<div class="page-break"></div>\n' +
      '<div class="col">\n' +
      line(drawn("meetings", P.meetings(ctx, d.blocks.meetings, v.briefs || {}))) +
      line(inbox(true)) +
      line(drawn("promises", P.follow(ctx, "Promises owed", d.blocks.promises_owed, "promises", "No promise is due."))) +
      line(drawn("book_moments", P.book(ctx, d.blocks.grow_the_book))) +
      "</div>\n" +
      "</div>\n";
  } else {
    c +=
      strip(
        drawn("unassigned", P.number(n.unassigned, "unassigned", "act", "asks you")) +
          drawn("leads", P.number(n.leads, "leads with the team")) +
          drawn("reached", P.number(n.reached, "reached this week")) +
          drawn("meetings_set", P.number(n.meetings_set, "meetings set")) +
          drawn("handed_over", P.number(n.handed_over, "handed to RMs")) +
          drawn("crm_gaps", P.number(n.crm_gaps, "missing in your CRM")),
      ) +
      '<div class="grid">\n' +
      rail(drawn("calendar", `${P.today(v.calendar)}\n`)) +
      '<div class="page-break"></div>\n' +
      '<div class="col">\n' +
      line(drawn("unassigned", P.families(ctx, d.unassigned, "Unassigned, with a signal", "unassigned", "act", "Every family with a signal has an owner.", ""))) +
      // with a line it could hold in a hole, the block draws the lines it holds, and no count and
      // no "nothing out of the ordinary" (round 4, row A10)
      line(P.exceptions(v.exceptions, has("exceptions"))) +
      "</div>\n" +
      "</div>\n";
  }
  // what the brief's counts could not count, in the words its view's count says it (row E6 round
  // 2), the connectors not handed over first (round 3, row A6)
  c += P.holes(v.holes);
  return {
    page_name: "Morning brief",
    theme: "First light",
    drawing: "first-light",
    say: v.role === "desk-head" ? "Show the team" : "Show my console",
    title: `Morning brief, ${e(first)}`,
    heading: `Good morning, ${e(first)}.`,
    lede: "",
    page_css: "",
    content: c,
  };
}

const PAGES = {
  "reach-out-card": reachOutCard,
  "room-brief": roomBrief,
  "morning-brief": morningBrief,
  // row E6: the consoles, the team view, the snapshot and the summary card (seats.js)
  "rep-console": S.repConsole,
  "rm-console": S.rmConsole,
  "lead-gen": S.leadGen,
  snapshot: S.snapshot,
  "summary-card": S.summaryCard,
};

// The sentences each page takes, slot by slot, each slot by the kind that says its exact shape
// and how the page draws it (render/prose.js): `line`, text or a list of text joined into one
// paragraph; `lines`, text or a list of text, each drawn alone; `sections`, the room brief's
// sections; `gists`, one text per row, keyed by that row's ref in this render's systems.
const PROSE = {
  "reach-out-card": { who_and_why: "line", summary: "line", opener: "lines", avoid: "lines" },
  "room-brief": { sections: "sections", summary: "sections" },
  "morning-brief": { gists: "gists" },
  // row E6: the RM console takes a grow-the-book line per family (`by_family`); the other seat
  // pages and the summary card take no sentence, every word on them read off the desk
  "rep-console": {},
  "rm-console": { upsell: "by_family" },
  "lead-gen": {},
  snapshot: {},
  "summary-card": {},
};

module.exports = { PAGES, PROSE, reachOutCard, roomBrief, morningBrief };
