"use strict";
// own_mail: the address the seat's own mailbox sends from, kept on this computer (DESK-367, the
// base's ruling at c/6799425914, amended at c/6801296281). The desk's pages say no
// seat's own address (the seat page the set-up writes has none, row DESK-175), so the mail
// guard cannot tell a lead firm's address from the seat's own, and a search held to the seat's
// own address reads that seat's whole mailbox. This tool records the address the person says they send mail from; the guard
// (live/shapes.js) reads the record, refuses every mail search without it, and with it lets a
// lead firm's address bound a search while the mailbox's own, its mail domain and the firm's own
// page bound nothing.
//
// The firm's own page cannot be told from a lead firm's by a kept address's domain when that
// domain is a public one, and no closed list knows every public one: a second address of the
// same mailbox there would bound a search that reads the whole mailbox. So the record also keeps the person's answer to "Which mail
// domain does your firm use, if any?": firm_domains left out is not asked yet, and no search
// goes through (c/6804197374); an empty list is none; a named domain makes a firm page on it the
// firm's own, and an address on it, or on a sub-domain of it, the firm's own wherever it is
// written.
//
// The record is the seat's scratch folder .celorus/ at the desk's root, as propose_hold's holds
// are (hold/hold.js): git-ignored, never sent to the desk server (link/lib/paths.js), and no page
// of the desk, so it is written on a seat's graph too and stays on this computer. Each computer
// asks once.
//
// Called with `addresses`, `firm_domains` or both, it replaces what the record held of each one
// given and keeps the other, so a corrected address keeps the firm's answer and the answer is
// written without the addresses said again; `firm_domains` is refused while no address is kept.
// Called with neither, it only says what the record holds, so a skill asks the person only what
// it lacks. A folder or record that is a link, or not what it
// should be, is refused for a write, and read as no record.
//
// The guard's hook loads this file through live/shapes.js, which loads the same engine files.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { DESK_ARGUMENT } = require("../lib/desk.js");

const TOOL = "own_mail";
const ARGUMENTS = ["desk", "addresses", "firm_domains"];
const SCRATCH = ".celorus";
const RECORD = "own-mail.json";
const WRITING = ".own-mail.json.writing";
// A plain address, ASCII only, so a look-alike letter is never read as a letter (the guard's own).
const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/u;
// A plain mail domain, the part of an address after its @.
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/u;
// How many addresses one mailbox may record: its address and a few it also sends from; and how
// many mail domains the firm may name.
const MOST = 5;
const NOTHING = "Nothing was recorded.";
// Mail domains anyone may hold an address on: a mailbox's own address on one of them says nothing
// of its firm, so only the exact address counts as the mailbox's own there, never its domain.
const PUBLIC_MAIL = Object.freeze([
  "aol.com",
  "fastmail.com",
  "gmail.com",
  "gmx.com",
  "gmx.net",
  "googlemail.com",
  "hotmail.co.in",
  "hotmail.co.uk",
  "hotmail.com",
  "icloud.com",
  "live.co.uk",
  "live.com",
  "live.in",
  "mac.com",
  "mail.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "outlook.in",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "rocketmail.com",
  "tuta.com",
  "tuta.io",
  "tutanota.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "yahoo.com",
  "yahoo.in",
  "yandex.com",
  "yandex.ru",
  "ymail.com",
  "zoho.com",
  "zohomail.com",
  "zohomail.in",
]);
// The web hosts of the common mail services, which a person may read from the browser bar and
// name as the firm's mail domain (the fifth review panel): refused as an answer, with their
// sub-domains, unless a kept address is on that very domain. They are not on PUBLIC_MAIL, since
// an address on one is that company's own.
const SERVICE_HOSTS = Object.freeze([
  "cloud.microsoft",
  "google.com",
  "hostinger.com",
  "microsoft.com",
  "microsoftonline.com",
  "office.com",
  "office365.com",
  "rediff.com",
  "secureserver.net",
  "titan.email",
  "zoho.com.au",
  "zoho.eu",
  "zoho.in",
]);
// No list of web hosts is whole (the sixth review panel), so an answer whose first part is one of
// these words reads as the web address mail is opened at, on any service or on the firm's own
// domain, and is refused under the same exception (c/6805395595, c/6805629249).
const WEB_WORDS = Object.freeze(["app", "email", "login", "m365", "mail", "outlook", "owa", "webmail"]);
// The question asked once on each computer (c/6801296281 Q1, asked whatever the kept address), in
// words that point at an address, not at the browser bar (c/6805629249).
const FIRM_DOMAIN_QUESTION = "What comes after the @ in your firm's own mail addresses, if the firm has a domain of its own?";
// The question as asked: a kept address's domain off the public list is offered by name, so
// the person can answer in a word (c/6803159294).
function question(addresses) {
  const offered = [...new Set(addresses.map(domainOf).filter((domain) => !PUBLIC_MAIL.includes(domain)))].sort();
  return offered.length ? `What comes after the @ in your firm's own mail addresses: ${offered.join(", ")}, another, or none?` : FIRM_DOMAIN_QUESTION;
}
// No record: no address, and the firm's mail domain not asked.
const NONE = Object.freeze({ addresses: Object.freeze([]), firm_domains: null });

const domainOf = (address) => address.slice(address.lastIndexOf("@") + 1);

// What the record holds, in lower case: { addresses, firm_domains }, firm_domains null when the
// question was not asked. NONE when the folder or the record is missing, a link or not what it
// should be, when it cannot be read or parsed, and when any entry is not a plain address or a
// plain domain, so a record that is not whole bounds nothing.
function ownRecord(root) {
  try {
    const folder = path.join(root, SCRATCH);
    const at = fs.lstatSync(folder, { throwIfNoEntry: false });
    if (at === undefined || !at.isDirectory()) return NONE;
    const file = path.join(folder, RECORD);
    const was = fs.lstatSync(file, { throwIfNoEntry: false });
    if (was === undefined || !was.isFile()) return NONE;
    const held = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = held !== null && typeof held === "object" && Array.isArray(held.addresses) ? held.addresses : null;
    if (list === null || list.length === 0 || list.length > MOST) return NONE;
    if (!list.every((one) => typeof one === "string" && ADDRESS.test(one.toLowerCase()))) return NONE;
    const addresses = [...new Set(list.map((one) => one.toLowerCase()))].sort();
    if (!Object.hasOwn(held, "firm_domains")) return { addresses, firm_domains: null };
    // an answer not whole in its shape is no record, as before; one whole in shape is read with the
    // check own_mail writes with, the same exception among it, and an answer that check refuses (a
    // list grown since it was written, or one written by hand) is not yet answered: the address is
    // kept, every search waits, and the domain is asked again (c/6806340051 Q2)
    const shaped = shapeOf(held.firm_domains);
    return { addresses, firm_domains: stands(shaped, addresses) ? shaped : null };
  } catch {
    return NONE;
  }
}

// The addresses as the call gives them, in lower case and each once, or a refusal that names what
// the call may pass.
function addressesOf(addresses) {
  const say = `\`addresses\` is a list of one to ${MOST} plain addresses, the ones the person said they send mail from`;
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > MOST) throw new Refusal(`${say}. ${NOTHING}`);
  const lower = addresses.map((one) => (typeof one === "string" ? one.trim().toLowerCase() : one));
  const bad = lower.filter((one) => typeof one !== "string" || !ADDRESS.test(one));
  if (bad.length) throw new Refusal(`${say}; ${bad.length === 1 ? "one is" : `${bad.length} are`} not a plain address. ${NOTHING}`);
  return [...new Set(lower)].sort();
}

// The firm's mail domains in their shape: a list of plain domains, in lower case, each once, a
// leading @ dropped, or a refusal; an empty list is the person's answer "none".
function shapeOf(domains) {
  const say = `\`firm_domains\` is a list of up to ${MOST} mail domains, the person's answer to "${FIRM_DOMAIN_QUESTION}", empty for none`;
  if (!Array.isArray(domains) || domains.length > MOST) throw new Refusal(`${say}. ${NOTHING}`);
  // a website's host given for the domain (www.firm.example) is read as the domain it is on; every
  // leading www. goes, so what own_mail writes reads back the same and is checked as it is kept
  const lower = domains.map((one) => (typeof one === "string" ? one.trim().toLowerCase().replace(/^@/u, "").replace(/^(?:www\.)+/u, "") : one));
  const bad = lower.filter((one) => typeof one !== "string" || !DOMAIN.test(one));
  if (bad.length) throw new Refusal(`${say}; ${bad.length === 1 ? "one is" : `${bad.length} are`} not a plain mail domain. ${NOTHING}`);
  return [...new Set(lower)].sort();
}

// The firm's mail domains as the call gives them, in their shape and none a firm may not hold, or
// a refusal. `addresses` are the ones kept with it, which let a mail service company's own domain
// through.
function domainsOf(domains, addresses) {
  const lower = shapeOf(domains);
  // a public mail domain is no firm's own, and a public service named is not the answer none
  // (c/6804197374 Q2): the firm's own domain named beside it is kept, the public one left out
  // a public service's own host (mail.<public domain>) is one too
  const onList = (one, list) => list.some((listed) => one === listed || one.endsWith(`.${listed}`));
  const open = [...new Set(lower.filter((one) => onList(one, PUBLIC_MAIL)))].sort();
  // a mail service's web address is no firm's own either: a service's domain (SERVICE_HOSTS, or a
  // host on one), or any domain whose first part is a web word (WEB_WORDS), unless a kept address
  // is on that very domain, since the person then works there: an address on google.com may
  // record google.com, and mail.google.com read off the browser bar is still refused
  // (c/6805395595)
  const kept = new Set(addresses.map(domainOf));
  const web = (one) => onList(one, SERVICE_HOSTS) || WEB_WORDS.includes(one.split(".")[0]);
  const hosts = [...new Set(lower.filter((one) => !open.includes(one) && web(one) && !kept.has(one)))].sort();
  if (open.length || hosts.length) {
    const said = [];
    if (open.length) said.push(`${open.join(", ")} ${open.length === 1 ? "is a public mail domain" : "are public mail domains"}, which anyone may hold an address on, so no firm's own`);
    if (hosts.length) said.push(`${hosts.join(", ")} ${hosts.length === 1 ? "looks like the web address" : "look like the web addresses"} the person opens mail at, not a firm's mail domain unless the person's own kept address is on it`);
    const after = hosts.length ? " For a web address, ask what comes after the @ in the person's own work address." : "";
    throw new Refusal(`${said.join("; ")}: record \`firm_domains\` again without it, with any other domain the person named; where they named only a mail service, ask which domain the firm's own addresses end in, and record an empty list, for none, only when the firm has no mail domain of its own.${after} ${NOTHING}`);
  }
  return [...new Set(lower)].sort();
}

// Whether an answer held still stands with the addresses now kept: own_mail's own check passes it.
function stands(domains, addresses) {
  if (domains === null) return false;
  try {
    domainsOf(domains, addresses);
    return true;
  } catch (err) {
    if (err instanceof Refusal) return false;
    throw err;
  }
}

// The record written whole: a real file in a real folder at the desk's root, never through a link.
function recordOwn(root, record) {
  const folder = path.join(root, SCRATCH);
  const file = path.join(folder, RECORD);
  try {
    const at = fs.lstatSync(folder, { throwIfNoEntry: false });
    if (at === undefined) fs.mkdirSync(folder);
    else if (!at.isDirectory()) throw new Refusal(`The desk's ${SCRATCH}/ is not a folder of its own, so the address cannot be kept for the mail guard. ${NOTHING}`);
    const was = fs.lstatSync(file, { throwIfNoEntry: false });
    if (was !== undefined && !was.isFile()) throw new Refusal(`The desk's ${SCRATCH}/${RECORD} is not a plain file, so the address cannot be kept for the mail guard. ${NOTHING}`);
    const writing = path.join(folder, WRITING);
    const left = fs.lstatSync(writing, { throwIfNoEntry: false });
    if (left !== undefined && !left.isFile()) throw new Refusal(`The desk's ${SCRATCH}/${WRITING} is not a plain file, so the address cannot be kept for the mail guard. ${NOTHING}`);
    fs.writeFileSync(writing, `${JSON.stringify(record, null, 2)}\n`);
    fs.renameSync(writing, file);
  } catch (err) {
    if (err instanceof Refusal) throw err;
    throw new Refusal(`The address could not be kept in the desk's ${SCRATCH}/ (${err && err.code ? err.code : "an error with no code"}), so the mail guard does not know it. ${NOTHING}`);
  }
}

// What the record lets the guard do, and what to ask the person next, in words.
function standing(record) {
  if (record.addresses.length === 0) {
    return "This computer does not know the address this mailbox sends mail from, so the mail guard refuses every mail search. Ask the person which address they send mail from, once, and record it here.";
  }
  if (record.firm_domains === null) {
    return (
      "This computer knows the address this mailbox sends mail from, but not the firm's own mail domain, so the " +
      "firm's own pages and addresses cannot be told from a lead's and no mail search goes through. " +
      `Ask the person "${question(record.addresses)}", once, and record the answer here as firm_domains, an empty list for none. ` +
      "Only the person's own answer may be recorded: with nobody to ask, as on an overnight run, no mail is read."
    );
  }
  return (
    "This computer knows the address this mailbox sends mail from: the mail guard never lets a search be held to it " +
    "alone, nor to the firm's own mail domain or page, and an address on a lead firm's page bounds a search."
  );
}

function ownMail(args = {}) {
  // required here, not at the top: lib/tools.js requires this file for its tool list
  const { deskFor, onlyArguments } = require("../lib/tools.js");
  onlyArguments(TOOL, args, ARGUMENTS);
  const root = deskFor(args.desk);
  if (args.addresses === undefined && args.firm_domains === undefined) {
    const held = ownRecord(root);
    return {
      tool: TOOL,
      addresses: held.addresses,
      firm_domains: held.firm_domains,
      summary: `${standing(held)} Nothing was written.`,
    };
  }
  // each field given replaces what the record held of it; one left out is kept as held
  const given = args.addresses === undefined ? null : addressesOf(args.addresses);
  const held = ownRecord(root);
  const addresses = given === null ? held.addresses : given;
  const answer = args.firm_domains === undefined ? null : domainsOf(args.firm_domains, addresses);
  if (addresses.length === 0) {
    throw new Refusal(`This computer keeps no address for this mailbox yet: record the person's address with \`addresses\` first, or with the firm's mail domain in the same call. ${NOTHING}`);
  }
  // a corrected address keeps the answer held, unless that answer no longer stands with the
  // addresses now kept (a service's domain no kept address is on any more): then it is asked
  // again, rather than written into a record the guard reads as none
  const firm_domains = answer !== null ? answer : stands(held.firm_domains, addresses) ? held.firm_domains : null;
  recordOwn(root, firm_domains === null ? { addresses } : { addresses, firm_domains });
  return {
    tool: TOOL,
    addresses,
    firm_domains,
    summary: `Kept on this computer only, in the desk's .celorus/ folder, and nothing on the desk's pages. ${standing({ addresses, firm_domains })}`,
  };
}

const TOOLS = [
  {
    name: TOOL,
    description:
      "Keep, on this computer only, the address the seat's own mailbox sends mail from, so the mail guard can tell " +
      "a lead firm's address from the seat's own, and the person's answer on the firm's own mail " +
      "domain. With `addresses`, `firm_domains` or both, writes each one given in the desk's .celorus/ folder and keeps " +
      "the other as held; with neither, says what it holds and what to ask. Writes nothing on the desk's pages and " +
      "sends nothing.",
    inputSchema: {
      type: "object",
      properties: {
        desk: DESK_ARGUMENT,
        addresses: {
          type: "array",
          description: `The addresses the person said they send mail from, as they said them: one to ${MOST}. Left out, the tool only says what is kept.`,
          items: { type: "string" },
        },
        firm_domains: {
          type: "array",
          description: `The person's answer to "${FIRM_DOMAIN_QUESTION}": up to ${MOST} mail domains, or an empty list for none. Left out, the question stays unasked.`,
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
    run: ownMail,
  },
];

module.exports = { TOOLS, ownMail, ownRecord, domainOf, ADDRESS, PUBLIC_MAIL, SERVICE_HOSTS, WEB_WORDS, FIRM_DOMAIN_QUESTION, SCRATCH, RECORD, MOST };
