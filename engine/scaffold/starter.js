"use strict";
// A pack's starter rules, set out as proposals when a desk is set up (the starter-rule origin).
// The founder's ruling 2 of 2026-09-17 (one-desk design section 2): "our
// craft rules arrive as proposals to accept, rewrite or strike". So each rule becomes one learning
// page, `learning_status: proposed` and `origin: starter`, and the rulebook lists them under the
// shape's own heading, apart from the rules the desk has ratified.
//
// The rules are read from the plugin's model/starter-rules/<pack>.yaml, a folder the public mirror
// never copies (build_plugin_mirror.py copies skills/, hooks/ and engine/'s .js only): an engine
// that has no file for a pack sets out no rule, and a desk with no pack gets none. A file that is
// there and cannot be read is our defect, and is refused before the set-up writes anything: so is
// anything in it the set-up could not write whole, or a page could not carry back as written.
//
// A shape's rule must stay distinguishable from a house rule, which may carry `starter` too: its
// page names the shape in its body and the industry record it came from in `sources` (the record's
// file, read off the rule's own source line; never the commit or the line number). The shape is
// the one the record names, its folder with spaces for underscores, which need not be the pack's
// name: one file's rules all cite the same shape.

const fs = require("node:fs");
const path = require("node:path");
const { parseHeader, HeaderError } = require("../lib/header.js");
const { Refusal } = require("../lib/refusal.js");

const STARTER_DIR = path.resolve(__dirname, "..", "..", "model", "starter-rules");
const NOTHING = "Nothing was written.";
const WORD = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RULE_MAX = 160;
// An id names its page, starter-<id>.md: short enough for any file system to write.
const ID_MAX = 64;
// celorus-industries <commit> <shape folder>/shape/starter-rules.md:<line>
const SOURCE = /^celorus-industries [0-9a-f]{7,40} (([a-z0-9_]+)\/shape\/starter-rules\.md):[1-9][0-9]*$/u;
const RULEBOOK = "celorus/rules/rulebook.md";

function unreadable(pack, why) {
  return new Refusal(`The starter rules for the pack ${pack} cannot be read: ${why}. ${NOTHING}`);
}

// A header value on one line, read back as the same text (JSON's escapes are YAML's). Every text
// value is quoted, a bucket too: a word such as `on` or `yes`, written bare, reads back as true.
function quoted(value) {
  return JSON.stringify(value);
}

// Whether a page's header carries `value` back as written, read by this engine's own reader. A
// character a desk header does not hold (U+0085, U+2028, DEL), or one JSON writes as an escape the
// reader does not read (backspace as \b, form feed as \f), is not carried.
function carried(value) {
  try {
    const back = parseHeader(`v: ${quoted(value)}\n`);
    return back !== null && back.v === value;
  } catch (err) {
    if (err instanceof HeaderError) return false;
    throw err;
  }
}

// What a page's body and the rulebook cannot carry as written, though a header can: a control
// character but tab (a carriage return reads back as a line break), and half of a surrogate pair,
// which UTF-8 writes as U+FFFD (the Buffer round trip in text()).
const BODY_OUT = /[\u0000-\u0008\u000a-\u001f\u007f]/u;

function text(rule, key, at, pack) {
  const value = rule[key];
  if (typeof value !== "string" || value.trim() === "" || value.includes("\n")) {
    throw unreadable(pack, `rule ${at} has no ${key} on one line`);
  }
  if (!carried(value) || BODY_OUT.test(value) || Buffer.from(value, "utf8").toString("utf8") !== value) {
    throw unreadable(pack, `rule ${at}'s ${key} holds a character a desk page cannot carry`);
  }
  return value;
}

// The pack's starter rules, or null when there is no pack or no file for it.
function readStarter(pack, dir = STARTER_DIR) {
  if (pack === null) return null;
  // The set-up has checked the name already (scaffold.js packOf); the path is built from it here.
  if (typeof pack !== "string" || !WORD.test(pack)) throw unreadable(String(pack), "the pack's name is not lowercase words joined by hyphens");
  const file = path.join(dir, `${pack}.yaml`);
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw unreadable(pack, "the file cannot be looked at");
  }
  if (!st.isFile()) throw unreadable(pack, "it is not a plain file");
  let head;
  try {
    head = parseHeader(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err instanceof HeaderError) throw unreadable(pack, `it does not parse (${err.message})`);
    throw unreadable(pack, "the file cannot be read");
  }
  if (head === null || typeof head !== "object" || Array.isArray(head)) throw unreadable(pack, "it holds no mapping");
  if (head.pack !== pack) throw unreadable(pack, "its pack is not this pack");
  if (!Number.isSafeInteger(head.version) || head.version < 1) throw unreadable(pack, "its version is not a whole number from 1");
  if (!Array.isArray(head.rules) || head.rules.length === 0) throw unreadable(pack, "it holds no rules");
  const seen = new Set();
  let folder = null;
  const rules = head.rules.map((rule, i) => {
    const at = String(i + 1);
    if (rule === null || typeof rule !== "object" || Array.isArray(rule)) throw unreadable(pack, `rule ${at} is not a mapping`);
    const id = text(rule, "id", at, pack);
    if (!WORD.test(id)) throw unreadable(pack, `rule ${at}'s id is not lowercase words joined by hyphens`);
    if ([...id].length > ID_MAX) throw unreadable(pack, `rule ${at}'s id is longer than ${ID_MAX} characters`);
    if (seen.has(id)) throw unreadable(pack, `the id ${id} is used twice`);
    seen.add(id);
    const bucket = text(rule, "bucket", at, pack);
    if (!WORD.test(bucket)) throw unreadable(pack, `rule ${id}'s bucket is not one word`);
    const said = text(rule, "rule", at, pack);
    if ([...said].length > RULE_MAX) throw unreadable(pack, `rule ${id} is longer than ${RULE_MAX} characters`);
    const why = text(rule, "why", at, pack);
    const source = SOURCE.exec(text(rule, "source", at, pack));
    if (!source) throw unreadable(pack, `rule ${id}'s source is not a line of a shape's starter rules`);
    if (folder !== null && source[2] !== folder) throw unreadable(pack, `rule ${id} cites another shape than the rules before it`);
    folder = source[2];
    return { id, bucket, rule: said, why, record: `celorus-industries ${source[1]}` };
  });
  return { pack, shape: folder.split("_").join(" "), version: head.version, rules };
}

function pageName(rule) {
  return `starter-${rule.id}`;
}

// One learning page per rule, each { rel, text }, in the file's order.
function starterPages(starter, now) {
  return starter.rules.map((rule) => ({
    rel: `celorus/learnings/${pageName(rule)}.md`,
    text:
      [
        "---",
        "type: learning",
        `title: ${quoted(`${rule.id} ${rule.rule}`)}`,
        `description: ${quoted(rule.rule)}`,
        `timestamp: ${now}`,
        "learning_status: proposed",
        `bucket: ${quoted(rule.bucket)}`,
        "origin: starter",
        `rule: ${quoted(rule.rule)}`,
        `sources: [{resource: ${quoted(rule.record)}}]`,
        "---",
        "",
        `# ${rule.id} ${rule.rule}`,
        "",
        rule.why,
        "",
        `Proposed by the ${starter.shape} shape when this desk was set up. To accept it, set ` +
          "`learning_status` to `ratified`; to rewrite it, change `rule` and set `amended`; to strike " +
          "it, set `struck`. The page stays whichever you choose.",
      ].join("\n") + "\n",
  }));
}

// The rulebook's section for the pack's proposals, added after the rulebook template's text.
function rulebookSection(starter) {
  return [
    "",
    `## Proposed by the ${starter.shape} shape`,
    "",
    `The ${starter.shape} shape's starting advice. Each is a proposal on its own page in ` +
      "`learnings/`: accept it, rewrite it or strike it there. None is a rule of this desk until the " +
      "desk ratifies it.",
    "",
    ...starter.rules.map((rule) => `- ${rule.rule} From [[${pageName(rule)}]].`),
  ].join("\n") + "\n";
}

module.exports = { readStarter, starterPages, rulebookSection, STARTER_DIR, RULEBOOK, RULE_MAX, ID_MAX };
