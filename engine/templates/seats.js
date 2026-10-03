"use strict";
// The seat pages render_view draws (row E6), each writing only what is its own, as pages.js does:
// the rep console and the RM console for a seat, the team view and the snapshot for the desk, and
// the summary card for a family, the lightest of its three tiers (ruled 21 Sep). Every number on
// them is counted by render/counts.js; nothing here counts. The frame, the look and the shared
// parts are base.js, design.js and parts.js; the parts only these pages draw are here.
//
// Ported from the demo kit's rep-console, rm-console, lead-gen, snapshot and summary-card
// templates and the macros only they use, so a page reads byte for byte as the kit's did.

const P = require("./parts.js");
const { PAGE_CSS } = require("./design.js");
const W = require("../render/words.js");

const { e, G } = { e: W.e, G: P.G };

// The name the pills' lines are said to and a sentence names who to ask is the page's
// `ctx.persona.name`, from the persona the render tools hand over (lib/persona.js): never written here, and
// never held between pages (base rulings R43 and R65).

function css(name) {
  return PAGE_CSS[name] || "";
}

function firstName(v) {
  return v.seat_name ? v.seat_name.trim().split(/\s+/)[0] : "";
}

// The jumps row: each section's label and its count, its dot coloured when the section asks.
function jumps(sections) {
  let out = '<nav class="jumps" aria-label="Sections">\n';
  for (const [id, label, rows, kind] of sections) {
    out +=
      `<a class="jump" href="#${e(id)}"><span class="dot${kind && rows.length ? ` k-${e(kind)}` : ""}" aria-hidden="true"></span>` +
      `${e(label)}<span class="num">${e(rows.length)}</span></a>\n`;
  }
  return `${out}</nav>\n`;
}

// Families new from a signal and not in the CRM: the family, the signal, when, and the yes.
function signals(ctx, rows) {
  let out = `<section class="block" id="new">${P.head("New from signals", rows.length)}\n`;
  if (rows.length) {
    out +=
      '<div class="ledger-t"><table>\n' +
      '<thead><tr><th scope="col">Family</th><th scope="col">Signal</th><th scope="col">Seen</th><th scope="col"><span class="sr">Say</span></th></tr></thead>\n' +
      "<tbody>\n";
    for (const r of rows) {
      out +=
        `<tr><td class="fam">${e(r.title)}</td><td class="s">${P.signalLine(ctx, r.why)}</td>` +
        `<td class="seen">${e(W.splitLast(r.why_today)[1])}</td>` +
        `<td class="act">${P.pill(ctx.persona.name, "yes", "Make them a prospect", `yes, make the ${r.title} a prospect`)}</td></tr>`;
    }
    out += "</tbody></table></div>\n";
  } else {
    out += '<p class="none">No new families from signals today.</p>';
  }
  return `${out}</section>\n`;
}

// The desk's funnel: what fell away on the way into a step, said in that step's own words, and
// what a step that lost nobody did, said of the step itself.
const FELL = {
  reached: "not reached this week",
  replies: "with no reply",
  meetings_set: "with no meeting set",
  handed_over: "not handed on",
};
const KEPT = { reached: "reached this week", replies: "replied", meetings_set: "set a meeting", handed_over: "handed on" };
// who the step before the stall holds, as a noun read for its own count, then its verb for one and many
const STALL_SAID = {
  reached: ["leads with the team", "was not reached this week", "were not reached this week"],
  replies: ["families the team reached", "did not reply", "did not reply"],
  meetings_set: ["families that replied", "did not set a meeting", "did not set a meeting"],
  handed_over: ["meetings set", "did not reach an RM", "did not reach an RM"],
};

// The team's totals as a funnel (counts.funnel's steps): each step a bar drawn against the first.
function funnel(steps) {
  let out = '<div class="fn">\n';
  steps.forEach((s, i) => {
    out += `<div class="fn-step${s.stall ? " is-stall" : ""}">\n`;
    if (i > 0) {
      let fell;
      if (s.lost) {
        fell =
          `<b>${e(s.lost)}</b> of ${e(s.from)} ${e(FELL[s.key])}${s.stall ? ` ${P.status("due", "where it stalls")}` : ""}` +
          `<span class="fn-kept">${e(s.kept)}% carried</span>`;
      } else if (s.gained) {
        fell = `<b>${e(s.gained)}</b> more than ${e(s.from_short)}`;
      } else {
        fell = `every one ${e(KEPT[s.key])}`;
      }
      out += `<p class="fn-fell">${fell}</p>\n`;
    }
    out +=
      `<b class="fn-v">${e(s.value)}</b>\n` +
      `<p class="fn-lbl">${e(W.counted(s.label, s.value))}</p>\n` +
      `<div class="fn-bar" aria-hidden="true"><span class="fn-tail" style="width: ${e(s.from_share)}%"></span>` +
      `<span class="fn-fill" style="width: ${e(s.share)}%"></span></div>\n` +
      "</div>\n";
  });
  return `${out}</div>\n`;
}

// The three counts under the stall, each by its key in the page table: the label, and the kind and
// word a count that asks is drawn with. check_reconcile reads each by its key (round 5, row A11).
const STALL_COUNTS = [
  ["crm_gaps", "calls not in your CRM", "", ""],
  ["stale", "follow-ups overdue", "due", "overdue"],
  ["unassigned", "families with a signal and no owner", "act", "asks you"],
];

// Beside the funnel: the step the numbers name as the worst drop, in a sentence, and under it the
// three counts the desk already holds that could explain it.
function stallCard(stall, totals, unassigned = 0, link = "#exceptions", g = P.gates({ not_counted: [] })) {
  const value = { crm_gaps: totals.crm_gaps, stale: totals.stale, unassigned };
  let out = `<aside class="stall">\n<h3 class="head${stall ? " k-due" : ""}"><span>Where it stalls</span></h3>\n`;
  if (stall) {
    const said = STALL_SAID[stall.key];
    const who = W.counted(said[0], stall.from);
    const verb = W.plural(stall.lost, said[1], said[2]);
    out +=
      `<p class="stall-step"><span>${e(stall.from_label)}</span><span class="to" aria-hidden="true">${e(G.go)}</span>` +
      `<span class="sr">to</span><span>${e(stall.label)}</span></p>\n`;
    // a step before it holding one is said as the one it is, never "one of the one lead"
    out +=
      stall.from === 1
        ? `<p class="stall-said">The one ${e(who)} ${e(verb)}.</p>\n`
        : `<p class="stall-said">${e(W.capitalize(W.words(stall.lost)))} of the ${e(W.words(stall.from))} ${e(who)} ${e(verb)}.</p>\n`;
  } else {
    out += '<p class="stall-said">Nothing falls away between one step and the next today.</p>\n';
  }
  out +=
    `<p class="stall-why">${stall ? "What could explain it" : "What still asks you"}</p>\n` +
    '<div class="numbers stall-n">\n' +
    // each through the page's gates (round 4, row A9): a count that reads a hole is not drawn
    STALL_COUNTS.map(([key, label, kind, word]) => g.drawn(key, P.number(value[key], label, kind, word))).join("") +
    "\n</div>\n" +
    `<a class="go" href="${e(link)}">See them by seat<span aria-hidden="true"> ${e(G.go)}</span></a>\n` +
    "</aside>\n";
  return out;
}

// The seam in one sentence: how many were handed on, and what became of them. A part the page's
// gates leave out (round 5, row A11) is not said: with the calendar not read, no hand-over is said
// to have a meeting ahead, or none.
function seamSaid(s, g = P.gates({ not_counted: [] })) {
  if (!s.handed) return "Nothing was handed to an RM this week.";
  let out = `${e(W.capitalize(W.words(s.handed)))} ${W.plural(s.handed, "lead was", "leads were")} handed to an RM this week.`;
  out += s.met
    ? ` ${e(W.capitalize(W.words(s.met)))} ${W.plural(s.met, "has", "have")} been met`
    : " <em>None has been met yet</em>";
  const ahead = g.has("on_calendar") && s.on_calendar;
  if (ahead) out += `, and ${e(W.words(s.on_calendar))} ${W.plural(s.on_calendar, "has", "have")} a meeting ahead on the calendar`;
  if (g.has("stalled") && s.stalled) out += `${ahead ? "; " : ", and "}<em>${e(W.words(s.stalled))} ${W.plural(s.stalled, "has", "have")} no meeting at all</em>`;
  return `${out}.`;
}

// An RM's week on a scale of days and hours: a column a day from the view's own date, every
// weekday of the seven and a weekend day only when a meeting falls on it. A meeting sits at its
// start; two close on one day are set apart by a card's height, in the order they start, and a
// time that cannot be read goes last on its day. A place is a float as soon as a known time set
// it, as the kit's arithmetic makes it, and is printed so.
const WEEK_HOURS = [8, 19];
const WEEK_HOUR_PX = 48;
const WEEK_GAP_PX = 128;

function num(value, isFloat) {
  return isFloat ? new W.PyFloat(value) : value;
}

function week(rows, first) {
  const clock = (r) => W.asline(r.start).slice(11, 16);
  const byDay = new Map();
  for (const r of rows) {
    const day = W.asline(r.start).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }
  const known = rows.map((r) => W.minutes(clock(r))).filter((at) => at !== null);
  const firstHour = Math.floor(Math.min(WEEK_HOURS[0] * 60, ...known) / 60);
  const lastHour = Math.max(WEEK_HOURS[1], ...known.map((at) => Math.ceil(at / 60)));
  const days = [];
  let bottom = 0;
  let bottomFloat = true;
  for (let i = 0; i < 7; i += 1) {
    const day = W.addDays(first, i);
    const held = byDay.get(day) || [];
    if (W.weekday(day) >= 5 && !held.length) continue;
    const timed = held
      .map((r, j) => ({ at: W.minutes(clock(r)), r, j }))
      .sort((a, b) => (a.at === null) - (b.at === null) || (a.at || 0) - (b.at || 0) || a.j - b.j);
    const events = [];
    let top = null;
    let topFloat = false;
    for (const { at, r } of timed) {
      const place = at !== null ? ((at - firstHour * 60) / 60) * WEEK_HOUR_PX : (top === null ? 0 : top) + WEEK_GAP_PX;
      const placeFloat = at !== null ? true : top === null ? false : topFloat;
      // Python's max keeps the first of two equal values: the place, not the gap
      if (top === null || place >= top + WEEK_GAP_PX) {
        top = place;
        topFloat = placeFloat;
      } else {
        top += WEEK_GAP_PX;
      }
      const title = W.asline(r.title);
      const rest = W.partition(W.asline(r.why), ", ")[2];
      events.push({
        row: r,
        time: clock(r) || "no time",
        top: num(Math.round(top * 10) / 10, topFloat),
        what: title && rest.startsWith(`${title}, `) ? rest.slice(title.length + 2) : rest,
      });
    }
    const reach = events.length ? (top === null ? 0 : top) + WEEK_GAP_PX : 0;
    const reachFloat = events.length ? topFloat : false;
    if (reach > bottom) {
      bottom = reach;
      bottomFloat = reachFloat;
    }
    days.push({ iso: day, label: W.shortWords(day), today: day === first, events });
  }
  const scale = (lastHour - firstHour) * WEEK_HOUR_PX;
  const hours = [];
  for (let h = firstHour; h <= lastHour; h += 1) hours.push({ label: String(h).padStart(2, "0"), top: (h - firstHour) * WEEK_HOUR_PX });
  return { hours, days, height: scale >= bottom ? scale : num(bottom, bottomFloat) };
}

// The week as the console draws it: a meeting with its brief made has a petrol edge, one without a
// yellow edge and the line that asks for it.
function weekBlock(ctx, rows, first, links = {}) {
  let out = `<section class="block" id="meetings">${P.head("Meetings this week", rows.length)}\n`;
  if (!rows.length) return `${out}<p class="none">No meetings this week.</p></section>\n`;
  const w = week(rows, first);
  const hours = (aria) =>
    w.hours.map((h) => `<div class="h" style="top: ${e(h.top)}px"${aria ? ' aria-hidden="true"' : ""}>${aria ? "" : `<span>${e(h.label)}</span>`}</div>`).join("");
  out +=
    `<div class="wk"><div class="wk-body" style="--wk-days: ${e(w.days.length)}">\n` +
    `<div class="wk-axis" aria-hidden="true"><div class="wk-dh"></div><div class="wk-track" style="height: ${e(w.height)}px">${hours(false)}</div></div>\n`;
  for (const d of w.days) {
    out +=
      `<div class="wk-day${d.today ? " is-today" : ""}">\n` +
      `<h3 class="wk-dh"><span>${e(d.label)}</span>${d.today ? '<span class="tag">Today</span>' : ""}` +
      `${d.events.length ? `<span class="n">${e(d.events.length)}</span>` : ""}</h3>\n` +
      `<div class="wk-track" style="height: ${e(w.height)}px">\n` +
      hours(true);
    for (const ev of d.events) {
      const r = ev.row;
      const k = links[`${r.family} ${r.start}`] || {};
      let go = "";
      if (k.meeting) {
        go =
          `<a class="go" href="${e(k.meeting)}">Meeting brief<span class="sr"> for ${e(r.title)}</span><span aria-hidden="true"> ${e(G.go)}</span></a>` +
          `${k.room ? `<a class="go quiet" href="${e(k.room)}">Room brief<span class="sr"> for ${e(r.title)}</span></a>` : ""}`;
      } else if (k.room) {
        go = `<a class="go" href="${e(k.room)}">Room brief<span class="sr"> for ${e(r.title)}</span><span aria-hidden="true"> ${e(G.go)}</span></a>`;
      } else if (!r.ref) {
        go = P.pill(ctx.persona.name, "card", "Make the room brief", `make the room brief for the ${r.title}`);
      }
      out +=
        `<article class="mt ${r.ref ? "k-ok" : "k-due"}" style="top: ${e(ev.top)}px">\n` +
        `<div class="mt-top"><span class="t"><span class="sr">${e(d.label)}, </span>${e(ev.time)}</span>${P.status(r.ref ? "ok" : "due", r.why_today)}</div>\n` +
        `<p class="mt-fam">${W.truthy(r.title) ? e(r.title) : ctx.delink(r.why)}</p>\n` +
        `${ev.what ? `<p class="mt-what">${ctx.delink(ev.what)}</p>` : ""}` +
        `<div class="mt-go">${go}</div>\n` +
        "</article>\n";
    }
    if (!d.events.length) out += '<p class="wk-open">Nothing booked</p>\n';
    out += "</div>\n</div>\n";
  }
  return `${out}</div></div>\n</section>\n`;
}

// A seat's number in a table: a zero reads quiet, and a column that asks reads in the colour of
// what is due.
function cell(value, label, ask = false) {
  return `<td class="n${!W.truthy(value) ? " nil" : ask ? " ask" : ""}" data-label="${e(label)}">${e(value)}</td>`;
}

// Two blocks side by side, or the one that is drawn alone, or nothing.
function pair(a, b) {
  const kept = [a, b].filter(Boolean);
  return kept.length === 2 ? `<div class="pair">\n${a}\n${b}\n</div>\n` : kept.map((x) => `${x}\n`).join("");
}

// A seat page's holes block (round 4, row A9): each hole of its view in desk_count's words, then
// the page's own, as the morning brief draws them.
function holesOf(v) {
  return P.holes([...(v.unread || []).map((h) => h.why), ...(v.holes || [])]);
}

// The jumps a page draws: each section whose key its gates let through.
function gatedJumps(g, sections) {
  return jumps(sections.filter((s) => g.has(s[4])));
}

// The SDR's console: the leads the seat owns, what asks it, and the day beside them.
function repConsole(v, prose, ctx) {
  const first = firstName(v);
  const c = v.counts;
  const b = v.blocks;
  // every figure and block is drawn through the one page table, as the brief draws it (round 4,
  // row A9): a key that reads a hole draws no figure and no line
  const g = P.gates(v);
  const { drawn } = g;
  const line = (text) => (text ? `${text}\n` : "");
  let out =
    '<div class="numbers">\n' +
    drawn("leads", P.number(c.leads, "leads you own")) +
    drawn("reached", P.number(c.reached, "reached this week")) +
    drawn("replies", P.number(c.replies, "replies")) +
    drawn("meetings_set", P.number(c.meetings_set, "meetings set")) +
    drawn("handed_over", P.number(c.handed_over, "handed to RMs")) +
    drawn("to_calendar", P.number(c.to_calendar, "to put on the calendar", "act", "asks you")) +
    "\n</div>\n";
  out += gatedJumps(g, [
    ["cal", "Not on the calendar", b.to_calendar, "act", "to_calendar"],
    ["new", "New from signals", b.new_from_signals, "", "new_from_signals"],
    ["reach", "To reach", b.to_reach, "", "to_reach"],
    ["due", "Due today", b.follow_ups_due, "due", "follow_ups_due"],
    ["quiet", "Gone quiet", b.quiet, "due", "quiet"],
    ["mail", "Critical mail", b.critical_mail, "act", "critical_mail"],
    ["chat", "Chat", b.chat, "act", "chat"],
    ["crm", "Missing in your CRM", b.crm_gaps, "", "crm_gaps"],
    g.has("backlog")
      ? ["backlog", "Backlog", b.backlog, "", "backlog"]
      : ["backlog", "Overdue follow-ups", b.backlog.filter((r) => r.kind === "follow-up"), "", "overdue"],
  ]);
  out +=
    '<div class="grid">\n<div class="col">\n' +
    drawn("to_calendar", `${P.toCalendar(ctx, b.to_calendar)}\n`) +
    drawn("new_from_signals", `${signals(ctx, b.new_from_signals)}\n`) +
    drawn("to_reach", `${P.families(ctx, b.to_reach)}\n`) +
    pair(
      drawn("follow_ups_due", P.follow(ctx, "Due today", b.follow_ups_due, "due", "Nothing due today.")),
      drawn("quiet", P.follow(ctx, "Gone quiet", b.quiet, "quiet", "Nobody has gone quiet.")),
    ) +
    line(P.gatedInbox(ctx, g, b.critical_mail, b.chat)) +
    "</div>\n" +
    // the day heads the rail, as the board draws it: the desk's own events, never a live list
    '<aside class="rail">\n' +
    drawn("calendar", `${P.today(v.calendar)}\n`) +
    drawn("crm_gaps", `${P.shortList(ctx, "Missing in your CRM", b.crm_gaps, "crm", "gap", "Every talk is in your CRM.")}\n`) +
    line(P.backlog(ctx, g, b.backlog)) +
    "</aside>\n</div>\n" +
    holesOf(v);
  return {
    page_name: "SDR console",
    theme: "Ground to cover",
    drawing: "ground-to-cover",
    say: "Show my brief",
    title: `SDR console, ${e(first)}`,
    heading: `Good morning, ${e(first)}.`,
    lede: "",
    page_css: css("rep-console"),
    content: out,
  };
}

// The RM's console: the week leads, then the book, and what asks beside it.
function rmConsole(v, prose, ctx) {
  const first = firstName(v);
  const c = v.counts;
  const b = v.blocks;
  const upsell = W.asmap(prose.upsell);
  // through the one page table, as the brief draws it (round 4, row A9)
  const g = P.gates(v);
  const { drawn } = g;
  const talk = P.gatedInbox(ctx, g, b.critical_mail, b.chat, {}, true);
  let out =
    '<div class="numbers">\n' +
    drawn("meetings_today", P.number(c.meetings_today, "meetings today")) +
    drawn("meetings_week", P.number(c.meetings_week, "meetings this week")) +
    drawn("briefs_ready", P.number(c.briefs_ready, "briefs ready")) +
    drawn("to_calendar", P.number(c.to_calendar, "to put on the calendar", "act", "asks you")) +
    // c["promises"], a string: the bare word names fs.promises, which the read scan (B4) refuses
    drawn("promises", P.number(c["promises"], "promises owed", "due", "owed")) +
    drawn("book_moments", P.number(c.book_moments, "book moments")) +
    drawn("meetings_held", P.number(c.meetings_held, "meetings held")) +
    drawn("book_moments_acted", P.number(c.book_moments_acted, "book moments acted on")) +
    "\n</div>\n";
  out += gatedJumps(g, [
    ["meetings", "Meetings this week", b.meetings, "", "meetings"],
    ["cal", "Not on the calendar", b.to_calendar, "act", "to_calendar"],
    ["book", "Grow the book", b.grow_the_book, "", "book_moments"],
    ["promises", "Promises owed", b.promises_owed, "due", "promises"],
    ...(g.has("inbox")
      ? [["mail", "Mail and chat", [...b.critical_mail, ...b.chat], "act", "inbox"]]
      : [
          ["mail", "Critical mail", b.critical_mail, "act", "critical_mail"],
          ["chat", "Chat", b.chat, "act", "chat"],
        ]),
  ]);
  out +=
    drawn("meetings", weekBlock(ctx, b.meetings, v.date, v.briefs || {})) +
    '<div class="rm-grid">\n<div class="col">\n' +
    drawn("book_moments", `${P.book(ctx, b.grow_the_book, upsell, "upsell")}\n`) +
    (talk ? `<div class="talk">${talk}</div>\n` : "") +
    "</div>\n" +
    '<aside class="rail">\n' +
    drawn("to_calendar", `${P.toCalendar(ctx, b.to_calendar)}\n`) +
    drawn("promises", `${P.follow(ctx, "Promises owed", b.promises_owed, "promises", "No promise is due.")}\n`) +
    "</aside>\n</div>\n" +
    holesOf(v);
  return {
    page_name: "RM console",
    theme: "Growth rings",
    drawing: "growth-rings",
    say: "Show my brief",
    title: `RM console, ${e(first)}`,
    heading: `Good morning, ${e(first)}.`,
    lede: "",
    page_css: css("rm-console"),
    content: out,
  };
}

const WEEK_HEAD =
  '<tr><th scope="col">Reached</th><th scope="col">Replies</th><th scope="col">Meetings set</th><th scope="col">Handed over</th>';

// The team view, for the desk head: the desk as a whole first, then who is doing what, never ranked.
function leadGen(v, prose, ctx) {
  const first = firstName(v);
  const t = v.totals;
  // through the one page table, as the desk head's brief draws it (round 4, row A9): a column, a
  // count or a block that reads a hole is not drawn, and the funnel has no step that reads one
  const g = P.gates(v);
  const { has, drawn } = g;
  const week = (r) =>
    drawn("leads", cell(r.leads, "Leads")) +
    drawn("reached", cell(r.reached, "Reached")) +
    drawn("replies", cell(r.replies, "Replies")) +
    drawn("meetings_set", cell(r.meetings_set, "Meetings set")) +
    drawn("handed_over", cell(r.handed_over, "Handed over"));
  const asks = (r) => drawn("stale", cell(r.stale, "Overdue", true)) + drawn("crm_gaps", cell(r.crm_gaps, "CRM gaps", true));
  const asking = ["stale", "crm_gaps"].filter(has).length;
  let out =
    `<section class="block" id="desk">${P.head("The desk this week")}\n` +
    '<div class="desk-grid">\n' +
    `<div class="fn-card">${funnel(v.funnel)}</div>\n` +
    `${stallCard(v.stall, t, v.unassigned.length, "#exceptions", g)}\n` +
    "</div>\n</section>\n" +
    `<section class="block" id="seats">${P.head("Who is doing what", drawn("seats", v.reps.length))}\n`;
  if (v.reps.length) {
    out +=
      '<div class="table-wrap stack seats"><table>\n<thead>\n' +
      `<tr><th scope="col" rowspan="2">Seat</th>${drawn("leads", '<th scope="col" rowspan="2">Leads</th>')}<th scope="colgroup" colspan="4" class="grp">This week</th>` +
      `${asking ? `<th scope="colgroup" colspan="${asking}" class="grp">Asks attention</th>` : ""}<th scope="col" rowspan="2">Doing now</th></tr>\n` +
      `${WEEK_HEAD}${drawn("stale", '<th scope="col">Overdue</th>')}${drawn("crm_gaps", '<th scope="col">CRM gaps</th>')}</tr>\n` +
      "</thead>\n<tbody>\n";
    for (const r of v.reps) {
      out +=
        `<tr><td class="seat">${e(r.name)}</td>${week(r)}${asks(r)}` +
        `<td class="doing" data-label="Doing now">${ctx.delink(r.doing)}</td></tr>\n`;
    }
    out +=
      `<tr class="team"><td class="seat">The team</td>${week(t)}${asks(t)}` +
      '<td class="doing" data-label="Doing now"></td></tr>\n</tbody>\n</table></div>\n';
  } else {
    out += '<div class="empty">No SDR seat on this desk yet.</div>\n';
  }
  out +=
    "</section>\n" +
    pair(
      drawn(
        "unassigned",
        P.families(ctx, v.unassigned, "Unassigned, with a signal", "unassigned", "act", "Every family with a signal has an owner.", "Hand it to an SDR"),
      ),
      P.exceptions(v.exceptions, has("exceptions")),
    ) +
    holesOf(v);
  return {
    page_name: "Team view",
    theme: "Confluence",
    drawing: "confluence",
    say: "Show my brief",
    title: `Team view, ${e(first)}`,
    heading: `Good morning, ${e(first)}.`,
    lede: "",
    page_css: css("lead-gen"),
    content: out,
  };
}

// A snapshot's record of the desk-log rows it read, as the page carries it (base ruling R56): how
// many rows, a whole number, and one digest in lowercase hex over those rows and the page's
// moment, so nothing in it can close the block or be read as markup, and no row has an identity
// on the page. A sealed record (DESK-147, render/key.js) carries two more, each lowercase hex too:
// its seal, and the id of the key that sealed it, never the key.
const DIGEST = /^[0-9a-f]{64}$/;
const KEY_ID = /^[0-9a-f]{16}$/;
function readRecord(read) {
  if (!read || !Number.isSafeInteger(read.rows) || read.rows < 0 || !DIGEST.test(read.digest)) {
    throw new Error("A snapshot's record of the rows it read is a count of rows and one digest in hex.");
  }
  if (read.seal === undefined && read.key_id === undefined) return JSON.stringify({ rows: read.rows, digest: read.digest });
  if (!DIGEST.test(read.seal) || !KEY_ID.test(read.key_id)) {
    throw new Error("A sealed snapshot's record also carries its seal and its key's id, each in hex.");
  }
  return JSON.stringify({ rows: read.rows, digest: read.digest, seal: read.seal, key_id: read.key_id });
}

// Where the desk stands at the moment the page is taken: the week step by step, every seat's
// week, and the seam from the SDRs to the RMs. Every figure on it is a view's own count, held to
// the views by check_reconcile.
function snapshot(v, prose, ctx) {
  const t = v.totals;
  const s = v.seam;
  // through the one page table, as the team view draws (round 5, row A11): a figure, a column or a
  // line that reads a hole is not drawn, and the holes block names each hole in desk_count's words
  const g = P.gates(v);
  const { drawn } = g;
  const week = (r) =>
    drawn("leads", cell(r.leads, "Leads")) +
    drawn("reached", cell(r.reached, "Reached")) +
    drawn("replies", cell(r.replies, "Replies")) +
    drawn("meetings_set", cell(r.meetings_set, "Meetings set")) +
    drawn("handed_over", cell(r.handed_over, "Handed over"));
  let out =
    `<p class="taken"><span>Taken at <b>${e(v.taken_clock)}</b>, ${e(v.taken_label)}</span><span class="sep" aria-hidden="true">·</span>` +
    `<span>where the desk stands on the week <b>${e(v.week.from_label)}</b> to <b>${e(v.week.to_label)}</b></span></p>\n` +
    `<section class="block" id="desk">${P.head("The week, step by step")}\n` +
    '<div class="desk-grid">\n' +
    `<div class="fn-card">${funnel(v.funnel)}</div>\n` +
    `${stallCard(v.stall, t, v.unassigned, "#seats", g)}\n` +
    "</div>\n</section>\n" +
    `<section class="block" id="seats">${P.head("Every seat's week", drawn("seats", v.reps.length))}\n`;
  if (v.reps.length) {
    out +=
      '<div class="table-wrap stack week-t"><table>\n<thead>\n' +
      `<tr><th scope="col" rowspan="2">Seat</th>${drawn("leads", '<th scope="col" rowspan="2">Leads</th>')}<th scope="colgroup" colspan="4" class="grp">This week</th></tr>\n` +
      `${WEEK_HEAD}</tr>\n` +
      "</thead>\n<tbody>\n";
    for (const r of v.reps) out += `<tr><td class="seat">${e(r.name)}</td>${week(r)}</tr>\n`;
    out += `<tr class="team"><td class="seat">The team</td>${week(t)}</tr>\n</tbody>\n</table></div>\n`;
  } else {
    out += '<div class="empty">No SDR seat on this desk yet.</div>\n';
  }
  out +=
    "</section>\n" +
    // the seam: every hand-over of the week is in one of the three states, and the three are its whole
    `<section class="block" id="seam">${P.head("From the SDRs to the RMs", drawn("handed", s.handed))}\n` +
    '<div class="desk-grid seam-grid">\n<div class="seam">\n' +
    `<p class="seam-said">${seamSaid(s, g)}</p>\n`;
  // the bar is the three parts' shares of the whole, so it is drawn only when every part is
  const parts = s.parts.filter((p) => g.has(p.key));
  if (s.handed && parts.length === s.parts.length) {
    out += `<div class="seam-bar" aria-hidden="true">\n${s.parts.map((p) => `<span class="p-${e(p.key)}" style="flex: ${e(p.share)} 1 0"></span>`).join("")}</div>\n`;
  }
  out += '<ul class="seam-key">\n';
  for (const p of parts) {
    out +=
      `<li${p.value ? ` class="k-${e(p.key)}"` : ""}><span class="sw p-${e(p.key)}" aria-hidden="true"></span>` +
      `<div><b>${p.value ? e(p.value) : "None"}</b><span class="w">${e(p.word)}</span><span class="said">${e(p.said)}</span></div></li>\n`;
  }
  out +=
    "</ul>\n</div>\n" +
    // an RM's two counts are their whole week over the book, beside a seam whose "met" is only
    // the leads handed on: the line says so
    '<aside class="rm-side">\n<h3 class="head"><span>Each RM\'s own week</span></h3>\n' +
    '<div class="card"><p class="rm-note">Their whole book, not only what came from an SDR.</p><ul class="list">\n';
  for (const r of g.has("rm_week") ? v.rms : []) {
    out +=
      `<li><span class="g" aria-hidden="true">${e(G.row)}</span><div><b>${e(r.name)}</b><span class="more">` +
      `<span>${e(r.meetings_held)} ${e(W.counted("meetings held", r.meetings_held))} across the book</span>` +
      `<span>${e(r.book_moments_acted)} ${e(W.counted("book moments acted on", r.book_moments_acted))}</span></span></div>` +
      `<span class="d">${e(r.handed_over)} ${e(W.counted("handed to them", r.handed_over))} this week</span></li>\n`;
  }
  if (!v.rms.length) out += '<li class="none">No RM seat on this desk yet.</li>\n';
  out +=
    "</ul></div>\n</aside>\n" +
    '<div class="seam-rows">\n<h3 class="head"><span>What became of each one</span></h3>\n<div class="card"><ul class="list">\n';
  // each hand-over's state, when the page reads what decides it: with the calendar not read, a
  // hand-over not met is neither ahead nor stalled on this page
  for (const r of s.rows) {
    out +=
      `<li><span class="g" aria-hidden="true">${e(G.go)}</span><div><b>${e(r.title)}</b><span class="more">${ctx.delink(r.why)}</span></div>` +
      `${g.has(r.state) ? `<span class="d">${P.status(r.state === "stalled" ? "due" : "ok", r.why_today)}</span>` : ""}</li>\n`;
  }
  if (!s.rows.length) out += '<li class="none">Nothing was handed to an RM in the last week.</li>\n';
  out +=
    "</ul></div>\n</div>\n</div>\n" +
    // what the desk holds beyond the week is read from its desk log (counts.snapshotView), and no
    // snapshot is said to be read against another: nothing compares two. The week is the whole of
    // what the desk holds only when its log holds no row before it (round 3, A5)
    (v.week.older
      ? `<p class="close">This page shows the week ${e(v.week.from_label)} to ${e(v.week.to_label)}. The desk log holds older work too, and it is not compared on this page.</p>\n`
      : `<p class="close">One week of work, ${e(v.week.from_label)} to ${e(v.week.to_label)}, is the whole of what this desk holds, so there is nothing older here to set it against.</p>\n`) +
    "</section>\n" +
    holesOf(v) +
    // how many rows of the desk log the page read at its moment, and one digest over them and the
    // moment (round 5, row A13; base ruling R56): check_reconcile draws the page again from those
    // rows, so rows logged in the desk log since leave it as it was taken. Data for the check,
    // never drawn
    `<script type="application/json" id="rows-read">${readRecord(v.read)}</script>\n`;
  return {
    page_name: "Snapshot",
    theme: "Tide line",
    drawing: "tide-line",
    say: "Take it again after the calls",
    title: "Where the desk stands",
    heading: "Where the desk stands.",
    lede: "",
    page_css: css("snapshot"),
    content: out,
  };
}

// The summary card: who, the bracket, why now and one contact, all read off the family's page, so
// the card takes no sentence from the model and is the same page every time it is drawn. With the
// CRM not counted, the "Not counted" block says the hole as a seat's page says it (holesOf).
function summaryCard(v, prose, ctx) {
  const people = [...v.members, ...v.contacts];
  const lead = people.find((p) => W.truthy(p.decision_maker)) || null;
  const last = v.signal_rows.length ? v.signal_rows[v.signal_rows.length - 1] : null;
  const usable = v.routes.filter((r) => !W.truthy(r.note));
  const route = [...usable.filter((r) => r.register === "yours"), ...usable][0] || null;
  const row = (k, value) => `<div class="row"><span class="k">${k}</span><p class="v">${value}</p></div>\n`;
  const who = lead
    ? `${e(lead.name)}${W.truthy(lead.role) ? `<span class="sub">${e(lead.role)}, ${e(v.title)}, ${e(v.city)}</span>` : ""}`
    : '<span class="nil">Nobody on this family\'s page is marked as the one who decides.</span>';
  // a family with no trigger and no signal is said as not held, as a missing bracket is: a missing
  // field is never shown as a judgement of the family
  let why = e("not held");
  if (last) {
    why = `${P.signalLine(ctx, last.why)}<span class="sub">${e(W.capitalize(v.trigger || "a signal"))}, ${e(last.title)}</span>`;
  } else if (v.trigger) {
    why = `${e(W.capitalize(v.trigger))}<span class="sub">No signal yet: the family is worth a call on its own.</span>`;
  }
  let contact;
  if (lead && W.truthy(lead.phone)) {
    contact = `<span class="n">${e(lead.phone)}</span><span class="sub">${e(lead.name)}'s number</span>`;
  } else if (route) {
    contact = `${ctx.delink(route.how)}<span class="sub">${route.register === "yours" ? "From your own records" : "From the public record"}</span>`;
  } else {
    contact = `<span class="nil">No contact held yet. Ask ${e(ctx.persona.name)} to look for one.</span>`;
  }
  const content =
    `${P.ladder("summary")}\n` +
    '<section class="summary" aria-label="The lead at a glance">\n' +
    row("Who", who) +
    row("Bracket", e(v.bracket || "not held")) +
    row("Why now", why) +
    row("Contact", contact) +
    "</section>\n" +
    '<p class="summary-foot">The summary is the first of three tiers. The reach-out profile adds the family, every route in and the opener; the family profile is the brief for the meeting.</p>\n' +
    holesOf(v);
  return {
    page_name: "Summary card",
    theme: "At a glance",
    drawing: "way-in",
    say: v.seat ? "Show my brief" : "",
    title: "Summary card",
    heading: e(v.title),
    lede: "",
    page_css: css("summary-card"),
    content,
  };
}

module.exports = {
  holesOf,
  repConsole,
  rmConsole,
  leadGen,
  snapshot,
  summaryCard,
  signals,
  funnel,
  stallCard,
  STALL_COUNTS,
  seamSaid,
  week,
  readRecord,
};
