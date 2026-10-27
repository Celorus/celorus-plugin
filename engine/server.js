#!/usr/bin/env node
"use strict";
require("./lib/guard.js").install();
// The first statement, before any other engine file loads: lib/guard.js says what it blocks.
//
// The server door: the local MCP server `celorus-desk`, over stdio. The harness starts it
// from the plugin's server declaration and speaks one JSON-RPC message per line on stdin;
// every reply is one line on stdout, and stdout carries nothing else. Diagnostics go to
// stderr. It reads and writes only the desk folder it is given, and holds no sign-in.

const { createHandler, PARSE_ERROR, failure } = require("./lib/mcp.js");
const { TOOLS } = require("./lib/tools.js");
const { pluginVersion } = require("./lib/version.js");
const { namesUnsent } = require("./check/rules.js");
const { readDesk } = require("./lib/desk.js");

// On the desk server (host/server.js runs this door), a call whose list of files the link did
// not send names a path no sent item on the desk names is refused before any tool runs (`namesUnsent`
// in check/rules.js). The render service answers the caller in its own words
// (the render service's `_reply`). On a laptop there is never a list (only the server
// sets it, check/rules.js namedList), so nothing is read and nothing refused. A desk that
// cannot be read is left to the tool, which meets it too.
const INVALID_PARAMS = -32602;
const NAMED_REFUSED = "The list of files not sent names a file no sent item names.";

function refusesList(message) {
  if (message === null || typeof message !== "object" || message.method !== "tools/call") return false;
  return namesUnsent(() => {
    try {
      return readDesk(process.cwd()).pages;
    } catch {
      return null;
    }
  });
}

// Anything a tool prints by mistake must not corrupt the protocol channel.
console.log = console.error;
console.info = console.error;

const { handle } = createHandler({
  tools: TOOLS,
  name: "celorus-desk",
  version: pluginVersion(),
  log: (line) => process.stderr.write(`celorus-desk: ${line}\n`),
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function respond(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    send(failure(null, PARSE_ERROR, "A message is one line of JSON."));
    return;
  }
  if (refusesList(message)) {
    const refused = failure(message.id ?? null, INVALID_PARAMS, NAMED_REFUSED);
    refused.error.data = { refused: "named" };
    send(refused);
    return;
  }
  const answer = await handle(message);
  if (answer !== null) send(answer);
}

// Replies leave in the order the messages came in.
let queue = Promise.resolve();
let buffer = "";

function take(line) {
  const text = line.replace(/\r$/, "");
  if (text.trim() === "") return;
  // A failure answering one message is logged and never stops the ones after it.
  queue = queue
    .then(() => respond(text))
    .catch((err) => process.stderr.write(`celorus-desk: ${err && err.stack ? err.stack : err}\n`));
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let at;
  while ((at = buffer.indexOf("\n")) !== -1) {
    take(buffer.slice(0, at));
    buffer = buffer.slice(at + 1);
  }
});
process.stdin.on("end", () => {
  take(buffer);
  buffer = "";
});
