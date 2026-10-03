"use strict";
// The desk's parts (direction 2, the founder's pick): the look lives once, here and in base.html,
// and a page writes only what is its own. Each part returns page text; a value set into it is
// escaped (words.e), and a sentence goes through the desk's own link reader (delinker) first.
// Glyphs are text set beside a word, never an icon library; U+FE0E keeps a glyph in text form.
// Colour is red for what waits on the reader, yellow for what is due, and nothing else.
//
// Ported from the demo kit's macros.html.j2 (row E5), so a page reads byte for byte as the kit's
// did. A pill copies the line to say and never sends it (Plan C item 22): the page cannot call a
// tool, so the click copies and the person pastes.

const { linkSpans } = require("../check/text.js");
const W = require("../render/words.js");

const { e } = W;

const G = {
  critical: "\u00a1",
  reply: "\u21a9\ufe0e",
  due: "\u25f7",
  quiet: "\u22ef",
  gap: "\u2610",
  add: "+",
  yes: "\u2713",
  card: "\u270e",
  go: "\u2192",
  row: "\u00b7",
};
// a row that is due: its glyph and the tag that says where it came from
const FOLLOW = { "follow-up": ["due", "Follow-up"], quiet: ["quiet", "Mail"], promise: ["due", "Promise"] };

// the day as a scale of hours: 08:00 to 19:00, widened to take a meeting outside it
const DAY_HOURS = [8, 19];
const HOUR_PX = 30;
// the least room between two meetings' marks on the scale, so two set close never cover each other
const EVENT_GAP_PX = 40;

// The filter every sentence goes through: a link becomes the page's title (or the words it is
// linked at), `**bold**` becomes bold, and everything else is escaped. A page never shows a link's
// brackets, a raw asterisk or a structure's repr. The link is found by the engine's one reader.
function delinker(desk) {
  // each link of `text` read by `word(span, alias)`
  const read = (text, word) => {
    const line = W.asline(text);
    let out = "";
    let from = 0;
    for (const span of linkSpans(line)) {
      const inner = line.slice(span.start + 2, span.end - 2);
      const bar = inner.indexOf("|");
      const alias = bar === -1 ? "" : inner.slice(bar + 1);
      out += line.slice(from, span.start) + word(span, alias);
      from = span.end;
    }
    return out + line.slice(from);
  };
  // the text as the page shows it, before it is escaped: each link read as its words
  const plain = (text) => read(text, (span, alias) => alias || desk.title(span.name));
  // the text in the sender's own words: a link read as its words when it has them, else as the
  // page it names, never as that page's title, which is the desk's own text (R72, K2c)
  const own = (text) => read(text, (span, alias) => alias || span.name);
  const delink = (text) => W.escape(plain(text)).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  delink.plain = plain;
  delink.own = own;
  return delink;
}

// What a page is drawn with: `delink` for the desk's own sentences, and `prose` for the
// sentences the model sent, which draws them the same way and keeps, by slot, the text each
// one shows, so render_view screens what the page says and not what was sent (a link's words
// and a list's joined lines read only once they are drawn). `persona` is the one the page
// speaks for, read by the render tools from the desk (lib/persona.js) and handed over; a page says
// its `name`.
function pageContext(desk, persona) {
  const delink = delinker(desk);
  const shown = [];
  // the same texts with each link in the sender's own words (delink.own), for the path rule
  const shownOwn = [];
  const prose = (slot, text) => {
    shown.push([slot, delink.plain(text)]);
    shownOwn.push([slot, delink.own(text)]);
    return delink(text);
  };
  // sentences a page draws side by side on one line are read as that line (base ruling R20)
  const sideBySide = (slot, texts) => {
    if (texts.length > 1) {
      shown.push([slot, texts.map((text) => delink.plain(text)).join(" ")]);
      shownOwn.push([slot, texts.map((text) => delink.own(text)).join(" ")]);
    }
  };
  return { delink, prose, sideBySide, shown, shownOwn, persona };
}

// A pill copies the line to say to the assistant `to`: its name, a comma, and the pill's words, or
// the rest of the line the row gives it. A line that ends open is finished by the person, and
// `note` says so.
function pill(to, glyph, words, rest = "", note = "") {
  const said = `${to}, ${rest || `${words.slice(0, 1).toLowerCase()}${words.slice(1)}`}`;
  return (
    `<button type="button" class="pill" data-say="${e(said)}"${note ? ` data-note="${e(note)}"` : ""}` +
    ` title="Say to ${e(to)}: ${e(said)}"><span class="pg" aria-hidden="true">${e(G[glyph])}</span>` +
    `<span class="pw">${e(words)}</span></button>`
  );
}

function status(kind, words) {
  return `<span class="status k-${e(kind)}"><span class="dot" aria-hidden="true"></span>${e(words)}</span>`;
}

function head(label, count = "", kind = "", tag = "") {
  return (
    `<h2 class="head${kind ? ` k-${e(kind)}` : ""}"><span>${e(label)}</span>` +
    `${count !== "" ? `<span class="count">${e(count)}</span>` : ""}` +
    `${tag ? `<span class="tag">${e(tag)}</span>` : ""}</h2>`
  );
}

// One count in the strip, its label read for the count it carries. A count that asks for
// something is coloured and says so in a word beside its dot, unless its label already says it.
function number(value, label, kind = "", word = "") {
  const on = Boolean(kind) && W.truthy(value);
  return (
    `<div class="c${on ? ` k-${e(kind)}` : ""}"><b>${e(value)}</b><span>${e(W.counted(label, value))}</span>` +
    `${on && word && !label.includes(word) ? status(kind, word) : ""}</div>`
  );
}

// A signal's sentence, its layer set as a kicker that keeps its colon: the label is the pitch.
function signalLine(ctx, why) {
  const [layer, rest] = W.splitSignal(why);
  return `${layer ? `<span class="layer">${e(layer)}:</span> ` : ""}${ctx.delink(rest)}`;
}

// The meetings the day proposed that no calendar holds yet; every meeting goes on the calendar.
function toCalendar(ctx, rows) {
  let out = `<section class="block" id="cal">${head("Not on the calendar", rows.length, rows.length ? "act" : "")}\n`;
  rows.forEach((r, i) => {
    const title = r.hold && r.hold.title ? r.hold.title : r.title;
    out +=
      `<article class="card k-act">\n` +
      `<div class="top"><span class="from">${e(title)}</span><span class="tag">Proposal</span></div>\n` +
      `<p class="said">${ctx.delink(r.why)}</p>\n` +
      `<div class="meta"><span class="when">${e(r.why_today)}</span>${status("act", "not on the calendar")}</div>\n` +
      `<div class="pills">${pill(ctx.persona.name, "add", "Add to calendar", `add the ${r.title} meeting to the calendar`)}` +
      `${pill(
        ctx.persona.name,
        "due",
        "Add to calendar at a time",
        `add the ${r.title} meeting to the calendar at `,
        `Copied. Add the time, then paste it to ${ctx.persona.name}.`,
      )}</div>\n` +
      `${
        i === rows.length - 1
          ? `<p class="say">A meeting off the calendar is never recorded. A pill copies its line for ${e(ctx.persona.name)}; with the second, add the time.</p>`
          : ""
      }</article>\n`;
  });
  if (!rows.length) out += '<p class="none">Every meeting the day proposed is on the calendar.</p>\n';
  return `${out}</section>\n`;
}

// Critical mail: "since Sat 19 Sep" at the right of the head and "waiting on you" in the foot;
// the whole sentence stays on the page for a screen reader, which reads it once.
function mail(ctx, rows, gists = {}, title = "Critical mail", empty = "No critical mail.") {
  let out = `<section class="block" id="mail">${head(title, rows.length, rows.length ? "act" : "")}\n`;
  if (rows.length) {
    out += '<div class="cards two">\n';
    for (const r of rows) {
      const [sender, subject] = W.splitMail(r.why);
      const who = sender || r.title;
      const fam = sender ? r.title : "";
      const age = W.since(r.why_today);
      const split = age !== W.pyStr(r.why_today);
      out +=
        `<article class="card k-act">\n` +
        `<div class="top"><span class="g" aria-hidden="true">${e(G.critical)}</span><span class="from">` +
        `${who ? `${e(who)} wrote` : ""}</span><span class="tag">Mail</span>` +
        `${split ? `<span class="age" aria-hidden="true">${e(age)}</span>` : ""}</div>\n` +
        `<p class="subj">${ctx.delink(subject)}</p>\n` +
        `${r.ref && Object.hasOwn(gists, r.ref) ? `<p class="said">${ctx.prose("gists", gists[r.ref])}</p>` : ""}` +
        `<div class="meta">${fam ? `<span>${e(fam)}</span>` : ""}` +
        `${
          split
            ? `<span aria-hidden="true">${status("act", "waiting on you")}</span><span class="sr">${e(r.why_today)}</span>`
            : status("act", r.why_today)
        }</div>\n` +
        `</article>\n`;
    }
    out += "</div>";
  } else {
    out += `<p class="none">${e(empty)}</p>`;
  }
  return `${out}</section>\n`;
}

// Chat is quieter than mail: a speech bubble with no coloured edge.
function chat(ctx, rows, title = "Chat to answer", empty = "Nothing to answer in chat.") {
  let out = `<section class="block" id="chat">${head(title, rows.length, rows.length ? "act" : "")}\n`;
  if (rows.length) {
    out += '<div class="cards two">\n';
    for (const r of rows) {
      const [who, at] = W.splitLast(r.why_today);
      out +=
        `<article class="card chat">\n` +
        `<div class="top"><span class="g" aria-hidden="true">${e(G.reply)}</span>` +
        `<span class="from" aria-hidden="true">${e(who || at)}</span><span class="tag">Chat</span>` +
        `${who ? `<span class="age" aria-hidden="true">${e(at)}</span>` : ""}<span class="sr">${e(r.why_today)}</span></div>\n` +
        `<p class="subj quote">\u201c${ctx.delink(r.why)}\u201d</p>\n` +
        `<div class="meta">${status("act", "needs a reply")}</div>\n` +
        `</article>\n`;
    }
    out += "</div>";
  } else {
    out += `<p class="none">${e(empty)}</p>`;
  }
  return `${out}</section>\n`;
}

// Mail and chat, side by side or one under the other; when neither has a row, one quiet line
// stands for both.
function inbox(ctx, mailRows, chatRows, gists = {}, pair = false) {
  if (mailRows.length || chatRows.length) {
    return `${pair ? '<div class="pair">' : ""}${mail(ctx, mailRows, gists)}${chat(ctx, chatRows)}${pair ? "</div>" : ""}`;
  }
  return (
    '<section class="block quiet" id="mail"><h2 class="head" id="chat"><span>Mail and chat</span>' +
    '<span class="count">0</span><span class="nil">No critical mail, and nothing to answer in chat.</span></h2></section>\n'
  );
}

// A seat page's gates, read off its view (render/counts.js pageGates, round 4, row A9): `has(key)`
// is whether the page draws the figure or block of that key of the one page table, which it does
// unless the key reads a hole; `drawn(key, text)` is the text when it does, and nothing when not.
// A key the page's table does not hold (`page_keys`, when the view carries it) is an error: every
// figure a page draws is declared in the table first.
function gates(v) {
  const skipped = new Set(v.not_counted || []);
  const known = v.page_keys ? new Set(v.page_keys) : null;
  const has = (key) => {
    if (known && !known.has(key)) throw new Error(`The page draws ${JSON.stringify(key)}, which its table of what each figure reads does not hold.`);
    return !skipped.has(key);
  };
  return { has, drawn: (key, text) => (has(key) ? text : "") };
}

// Mail and chat through a page's gates: one block when neither is a hole, else the one that is not.
function gatedInbox(ctx, g, mailRows, chatRows, gists = {}, pair = false) {
  if (g.has("inbox")) return inbox(ctx, mailRows, chatRows, gists, pair);
  return g.has("critical_mail") ? mail(ctx, mailRows, gists) : g.drawn("chat", chat(ctx, chatRows));
}

// The backlog through a page's gates: whole, or with its supplied leads in a hole its overdue
// follow-ups alone, which read nothing beyond the desk (round 4, row A8).
function backlog(ctx, g, rows) {
  if (g.has("backlog")) return shortList(ctx, "Backlog", rows, "backlog", "row", "Nothing in the backlog.");
  return g.drawn(
    "overdue",
    shortList(
      ctx,
      "Overdue follow-ups",
      rows.filter((r) => r.kind === "follow-up"),
      "backlog",
      "row",
      "No follow-up is overdue.",
    ),
  );
}

function follow(ctx, title, rows, id = "", empty = "Nothing due today.") {
  let out = `<section class="block"${id ? ` id="${e(id)}"` : ""}>${head(title, rows.length, rows.length ? "due" : "")}\n`;
  if (rows.length) {
    out += '<div class="cards">\n';
    for (const r of rows) {
      const f = FOLLOW[r.kind] || FOLLOW["follow-up"];
      out +=
        `<article class="card k-due">\n` +
        `<div class="top"><span class="g" aria-hidden="true">${e(G[f[0]])}</span><span class="from">${e(r.title)}</span>` +
        `<span class="tag">${e(f[1])}</span><span class="age">${status("due", r.why_today)}</span></div>\n` +
        `<p class="subj">${ctx.delink(r.why)}</p>\n` +
        `</article>\n`;
    }
    out += "</div>";
  } else {
    out += `<p class="none">${e(empty)}</p>`;
  }
  return `${out}</section>\n`;
}

function shortList(ctx, title, rows, id = "", glyph = "row", empty = "Nothing here today.", kind = "") {
  let out = `<section class="block"${id ? ` id="${e(id)}"` : ""}>${head(title, rows.length, kind)}\n`;
  out += '<div class="card"><ul class="list">\n';
  for (const r of rows) {
    out +=
      `<li><span class="g" aria-hidden="true">${e(G[glyph])}</span><div>${r.title ? `<b>${e(r.title)}</b>` : ""}` +
      `<span class="more">${ctx.delink(r.why)}</span></div><span class="d">${e(r.why_today)}</span></li>\n`;
  }
  if (!rows.length) out += `<li class="none">${e(empty)}</li>`;
  return `${out}</ul></div></section>\n`;
}

// Any block of rows, drawn the way its rows ask: mail and chat as cards, what is due with a yellow
// edge, the rest as one short list, each row's sentence whole.
function block(ctx, title, rows, empty = "Nothing here today.", gists = {}) {
  const kind = rows.length ? rows[0].kind : "";
  if (kind === "mail") return `${mail(ctx, rows, gists, title, empty)}\n`;
  if (kind === "chat") return `${chat(ctx, rows, title, empty)}\n`;
  if (Object.hasOwn(FOLLOW, kind)) return `${follow(ctx, title, rows, "", empty)}\n`;
  return `${shortList(ctx, title, rows, "", "row", empty)}\n`;
}

// Today's meetings on a scale of hours, so a time reads at a glance and an open afternoon looks
// open. Each meeting sits at its start; two close together are set apart by the least room one
// takes, in the order they start. A time that cannot be read goes last, never lost.
function dayScale(calendar) {
  const rows = (Array.isArray(calendar) ? calendar : [])
    .filter(W.isMap)
    .map((ev) => [W.minutes(ev.time), ev]);
  const known = rows.map(([at]) => at).filter((at) => at !== null);
  const first = Math.floor(Math.min(DAY_HOURS[0] * 60, ...known) / 60);
  const last = Math.max(DAY_HOURS[1], ...known.map((at) => Math.ceil(at / 60)));
  const events = [];
  // `top` is a float as soon as a known time placed it, as Python's arithmetic makes it
  let top = null;
  let isFloat = false;
  const ordered = rows
    .map((pair, i) => ({ pair, i }))
    .sort((a, b) => {
      const ka = a.pair[0] === null ? [1, 0] : [0, a.pair[0]];
      const kb = b.pair[0] === null ? [1, 0] : [0, b.pair[0]];
      return ka[0] - kb[0] || ka[1] - kb[1] || a.i - b.i;
    })
    .map((item) => item.pair);
  for (const [at, ev] of ordered) {
    let place;
    let placeFloat;
    if (at !== null) {
      place = ((at - first * 60) / 60) * HOUR_PX;
      placeFloat = true;
    } else {
      place = (top === null ? 0 : top) + EVENT_GAP_PX;
      placeFloat = top === null ? false : isFloat;
    }
    // Python's max keeps the first of two equal values: the place, not the gap
    if (top === null || place >= top + EVENT_GAP_PX) {
      top = place;
      isFloat = placeFloat;
    } else {
      top += EVENT_GAP_PX;
    }
    const shown = Math.round(top * 10) / 10;
    events.push({ time: W.asline(ev.time), title: W.asline(ev.title), top: isFloat ? new W.PyFloat(shown) : shown });
  }
  const scale = (last - first) * HOUR_PX;
  const hours = [];
  for (let h = first; h <= last; h += 1) hours.push({ label: String(h).padStart(2, "0"), top: (h - first) * HOUR_PX });
  const below = (top === null ? 0 : top) + EVENT_GAP_PX;
  const height = scale >= below ? scale : isFloat ? new W.PyFloat(below) : below;
  return { hours, events, height };
}

// The day from 08:00 to 19:00 as a scale of hours; a meeting sits at its start time.
function today(calendar) {
  const d = dayScale(calendar);
  let out =
    `<section class="today" id="today"><h2 class="head"><span>Today's calendar</span><span class="count">${e(calendar.length)}</span></h2>\n` +
    `<div class="tl" style="height: ${e(d.height)}px">\n`;
  for (const h of d.hours) out += `<div class="h" style="top: ${e(h.top)}px"><span>${e(h.label)}</span></div>`;
  for (const ev of d.events) {
    out += `<div class="ev" style="top: ${e(ev.top)}px"><span class="t">${e(ev.time)}</span><span class="what">${e(ev.title)}</span></div>\n`;
  }
  out += "</div>\n";
  if (!calendar.length) out += '<p class="none">Nothing on the calendar today.</p>';
  return `${out}</section>\n`;
}

// The price ladder, as the price list names it (ruled 21 Sep): which of a family's pages this is.
function ladder(here) {
  const steps = [
    ["summary", "Summary", ""],
    ["one", "Level one", "the reach-out profile"],
    ["two", "Level two", "the family profile"],
  ];
  let out = '<ol class="ladder" aria-label="The three tiers of a lead">\n';
  for (const [key, level, name] of steps) {
    const on = key === here;
    out +=
      `<li><span class="step${on ? " is-here" : ""}"${on ? ' aria-current="page"' : ""}><b>${e(level)}</b>` +
      `${name ? `, ${e(name)}` : ""}</span></li>\n`;
  }
  return `${out}</ol>`;
}

// Families with a signal, two to a row: the family, when, the signal, and what to say.
function families(ctx, rows, title = "To reach", id = "reach", kind = "", empty = "Nobody new to reach.", say = "Make the reach-out card") {
  let out = `<section class="block" id="${e(id)}">${head(title, rows.length, rows.length ? kind : "")}\n`;
  if (rows.length) {
    out += '<div class="cards two">\n';
    for (const r of rows) {
      let pills = "";
      if (say) {
        pills =
          say === "Hand it to an SDR"
            ? pill(ctx.persona.name, "card", say, `assign the ${r.title} to `, `Copied. Add the SDR's name, then paste it to ${ctx.persona.name}.`)
            : pill(ctx.persona.name, "card", say, `${say.slice(0, 1).toLowerCase()}${say.slice(1)} for the ${r.title}`);
        pills = `<div class="pills">${pills}</div>`;
      }
      out +=
        `<article class="card">\n` +
        `<div class="top"><span class="fam">${e(r.title)}</span><span class="age">${e(W.splitLast(r.why_today)[1])}</span></div>\n` +
        `<p class="said">${signalLine(ctx, r.why)}</p>\n` +
        `${pills}</article>\n`;
    }
    out += "</div>";
  } else {
    out += `<p class="none">${e(empty)}</p>`;
  }
  return `${out}</section>\n`;
}

// Each seat once, with every exception it has under its name; the lines are the view's own.
// `counted` false is a block whose lines are not all counted (a line it could hold reads a hole):
// it draws the lines it holds with no count and no empty line, and nothing when it holds none.
function exceptions(rows, counted = true) {
  if (!counted && !rows.length) return "";
  let out = `<section class="block" id="exceptions">${head("Exceptions", counted ? rows.length : "", rows.length ? "due" : "")}\n`;
  out += '<div class="card"><ul class="list">\n';
  const groups = W.grouped(rows);
  for (const [name, items] of groups) {
    out +=
      `<li><span class="g" aria-hidden="true">${e(G.row)}</span><div>${name ? `<b>${e(name)}</b>` : ""}` +
      `${items.map((x) => `<span class="more">${e(x)}</span>`).join("")}</div></li>\n`;
  }
  if (!groups.length) out += '<li class="none">Nothing out of the ordinary today.</li>';
  return `${out}</ul></div></section>\n`;
}

// What the page's counts could not count (round 2, row B2), each in the words the count gives it,
// drawn as text (a cell it quotes as written is never drawn as a link); nothing at all when there
// is none.
function holes(rows = []) {
  if (!rows.length) return "";
  let out = `<section class="block" id="holes">${head("Not counted", rows.length, "due")}\n`;
  out += '<div class="card"><ul class="list">\n';
  for (const x of rows) out += `<li><span class="g" aria-hidden="true">${e(G.row)}</span><div><span class="more">${e(x)}</span></div></li>\n`;
  return `${out}</ul></div></section>\n`;
}

// What a page says when a connector's rows were handed over and set aside (row E11, the live-row
// contract, live/live.js): a refused row drops its whole role back to the desk's own count, so the
// page reads that role as it does when its rows are not handed over, and says here that they were
// read and left out. A line for each role, in words, never a count of rows and never a row's own
// text; nothing at all when no role fell back. The assistant is the page's `ctx.persona.name`.
const SET_ASIDE = { crm: "the CRM", calendar: "the calendar", mail: "the mailbox", chat: "the chat" };
function fellBack(ctx, roles = []) {
  if (!roles.length) return "";
  let out = `<section class="block" id="set-aside">${head("Set aside")}\n`;
  out += '<div class="card"><ul class="list">\n';
  for (const role of roles) {
    const from = e(SET_ASIDE[role]);
    out +=
      `<li><span class="g" aria-hidden="true">${e(G.row)}</span><div><span class="more">${e(ctx.persona.name)} read rows from ${from} and set them all aside, ` +
      `because a row among them cannot go on a page of this desk. Where this page reads ${from}, it reads as it does when the rows are not handed over.</span></div></li>\n`;
  }
  return `${out}</ul></div></section>\n`;
}

// An RM's week: when, the meeting, and whether its brief is made; a brief not made says what to ask
// for. `links` is what each meeting links to, by `<family> <start>`.
function meetings(ctx, rows, links = {}) {
  let out = `<section class="block" id="meetings">${head("Meetings this week", rows.length)}\n`;
  if (rows.length) {
    out += '<div class="card"><ul class="list meet">\n';
    for (const r of rows) {
      const [when, , what] = W.partition(r.why, ", ");
      const k = links[`${r.family} ${r.start}`] || {};
      let act = "";
      if (k.meeting) {
        act = `<a class="go" href="${e(k.meeting)}">Meeting brief<span class="sr"> for ${e(r.title)}</span><span aria-hidden="true"> \u2192</span></a>`;
      } else if (!r.ref) {
        act = pill(ctx.persona.name, "card", "Make the room brief", `make the room brief for the ${r.title}`);
      }
      out +=
        `<li><span class="t">${e(when)}</span><div><b>${ctx.delink(what || r.title)}</b>` +
        `<span class="more">${status(r.ref ? "ok" : "due", r.why_today)}</span></div><span class="d">${act}</span></li>\n`;
    }
    out += "</ul></div>";
  } else {
    out += '<p class="none">No meetings this week.</p>';
  }
  return `${out}</section>\n`;
}

// An RM's book moments: the family, the signal, what might fit, and the line to ask the assistant for.
// `slot` names the sentences' slot, as the page's schema does (row E6: the RM console's upsell).
function book(ctx, rows, lines = {}, slot = "lines") {
  let out = `<section class="block" id="book">${head("Grow the book", rows.length)}\n`;
  if (rows.length) {
    out += '<div class="cards two">\n';
    for (const r of rows) {
      let chips = r.products.map((p) => `<span class="chip">${e(p.product)}</span>`).join("");
      if (!r.products.length) {
        chips = r.needs_connection
          ? '<span class="chip warn">Connect your product list</span>'
          : '<span class="chip">No product on the list fits this signal yet</span>';
      }
      out +=
        `<article class="card">\n` +
        `<div class="top"><span class="fam">${e(r.title)}</span><span class="age">${e(r.why_today)}</span></div>\n` +
        `<p class="said">${signalLine(ctx, r.why)}</p>\n` +
        `${W.truthy(lines[r.family]) ? `<p class="subj">${ctx.prose(slot, lines[r.family])}</p>` : ""}` +
        `<div class="tags">${chips}</div>\n` +
        `<div class="pills">${pill(ctx.persona.name, "card", "Write the grow-the-book line", `write the grow-the-book line for the ${r.title}`)}</div>\n` +
        `</article>\n`;
    }
    out += "</div>";
  } else {
    out += '<p class="none">No book moments today.</p>';
  }
  return `${out}</section>\n`;
}

// `put` draws one sentence: the desk's own through ctx.delink, the model's through ctx.prose.
function paragraphs(ctx, items, put = ctx.delink) {
  let out = "";
  for (const block of W.paragraphBlocks(items)) {
    out += block.list ? `<ul>${block.list.map((line) => `<li>${put(line)}</li>`).join("")}</ul>` : `<p>${put(block.text)}</p>`;
  }
  return out;
}

module.exports = {
  G,
  delinker,
  pageContext,
  pill,
  status,
  head,
  number,
  signalLine,
  toCalendar,
  mail,
  chat,
  inbox,
  gates,
  gatedInbox,
  backlog,
  follow,
  shortList,
  block,
  dayScale,
  today,
  ladder,
  families,
  exceptions,
  holes,
  fellBack,
  meetings,
  book,
  paragraphs,
};
