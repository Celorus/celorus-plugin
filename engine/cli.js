#!/usr/bin/env node
"use strict";
require("./lib/guard.js").install();
// The first statement, before any other engine file loads: lib/guard.js says what it blocks.
//
// The command-line door: the same desk tools as the server, for continuous integration, the
// session hook, and a harness that cannot launch a local server.
//
//   node engine/cli.js check [<desk>] [--json] [--record]   read the desk and check it
//   node engine/cli.js tools                     list the desk tools
//   node engine/cli.js call <tool> [<json>]      run any tool by its server name
//   node engine/cli.js --version | --help
//
// Exit codes: 0 when the tool ran, findings or none (the check lists; it never blocks); 2
// when it refused (the message names the valid values) or the command was not understood; 1
// when something failed unexpectedly.
//
// A check is read-only unless asked to record: a hand run stamps only with --record, the same
// as `record: true` through the server's check_desk (lib/stamp.js).

const { TOOLS, findTool } = require("./lib/tools.js");
const { Refusal } = require("./lib/refusal.js");
const { pluginVersion } = require("./lib/version.js");

const USAGE = `Usage:
  node engine/cli.js check [<desk>] [--json] [--record]
                                               read the desk and check it, read-only;
                                               a hand run stamps only with --record
  node engine/cli.js tools                     list the desk tools
  node engine/cli.js call <tool> [<json>]      run a desk tool by name, its input as a JSON object
  node engine/cli.js --version | --help`;

function print(text) {
  process.stdout.write(`${text}\n`);
}

function refuse(message) {
  throw new Refusal(message);
}

function describeCheck(result) {
  const lines = [
    result.stamps_unread
      ? `A desk whose stamps page, ${result.stamps_unread}, could not be read for its stamps (name and id not known${result.layout === null ? ", nor the layout" : `; layout ${result.layout}, as it has no desk.md`}), at ${result.root}`
      : `${result.desk}${result.desk_id ? ` (${result.desk_id})` : ""}, layout ${result.layout}, at ${result.root}`,
    `Read ${result.pages_read} pages; ${result.pages_with_problems.length} carry a problem.`,
  ];
  const remedies = new Set();
  for (const page of result.pages_with_problems) {
    lines.push(`  ${page.page}: ${page.problem}${page.why ? ` (${page.why})` : ""}`);
    if (page.remedy) remedies.add(page.remedy);
  }
  lines.push(...remedies);
  for (const finding of result.findings) {
    lines.push(`${finding.rule} | ${result.rules[finding.rule]} | ${finding.page} | ${finding.message}`);
  }
  const rules = `${result.rules_run} ${result.rules_run === 1 ? "rule" : "rules"}`;
  lines.push(`${result.findings.length} to look at, against ${rules}. The check lists; it never blocks.`);
  const stamp = result.checked_with;
  lines.push(stamp.written ? `Wrote ${stamp.written.join(" and ")} into ${stamp.page}.` : stamp.reason);
  // A reason that says the previous text is in the answer: on this door too, it is, after a line
  // saying which file it belongs to. Only desk.md's own text is said to be desk.md's; the text of
  // the file the stamp went into, which desk.md may no longer name, is never to go over desk.md.
  if (typeof stamp.previous_text === "string") {
    lines.push(
      stamp.previous_text_is_desk_md === true
        ? "The previous text of desk.md follows."
        : "The previous text of the file the stamp went into follows. That file may no longer be desk.md, so do not write this text over desk.md.",
      stamp.previous_text,
    );
  }
  return lines.join("\n");
}

async function check(rest) {
  const json = rest.includes("--json");
  const record = rest.includes("--record");
  const positional = rest.filter((arg) => arg !== "--json" && arg !== "--record");
  const flag = positional.find((arg) => arg.startsWith("-"));
  if (flag) refuse(`check does not take ${flag}. It takes a desk folder, --json and --record.\n${USAGE}`);
  if (positional.length > 1) refuse(`check takes one desk folder, not ${positional.length}.\n${USAGE}`);
  const args = positional.length ? { desk: positional[0] } : {};
  if (record) args.record = true;
  const result = await findTool("check_desk").run(args);
  print(json ? JSON.stringify(result, null, 2) : describeCheck(result));
}

async function call(rest) {
  if (!rest.length) refuse(`call needs a tool name.\n${USAGE}`);
  if (rest.length > 2) refuse(`call takes a tool name and one JSON object.\n${USAGE}`);
  const tool = findTool(rest[0]);
  let args = {};
  if (rest.length === 2) {
    try {
      args = JSON.parse(rest[1]);
    } catch {
      args = undefined;
    }
    if (args === null || typeof args !== "object" || Array.isArray(args)) {
      refuse('The input is one JSON object, for example {"desk": "<folder>"}.');
    }
  }
  print(JSON.stringify(await tool.run(args), null, 2));
}

async function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case "check":
      return check(rest);
    case "tools":
      for (const tool of TOOLS) print(`${tool.name}  ${tool.description}`);
      return undefined;
    case "call":
      return call(rest);
    case "--version":
      return print(pluginVersion());
    case "--help":
    case "-h":
    case "help":
      return print(USAGE);
    default:
      return refuse(
        `${command === undefined ? "No command given" : `There is no command ${JSON.stringify(command)}`}. ` +
          `The commands are check, tools and call.\n${USAGE}`,
      );
  }
}

main(process.argv.slice(2)).then(
  () => {
    process.exitCode = 0;
  },
  (err) => {
    if (err instanceof Refusal) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = 2;
    } else {
      process.stderr.write(`celorus-desk: ${err && err.stack ? err.stack : err}\n`);
      process.exitCode = 1;
    }
  },
);
