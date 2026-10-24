#!/usr/bin/env node
"use strict";
// The link's door: the local MCP server `celorus-link`, over stdio, beside the desk engine's
// `celorus-desk`. The engine stays unable to reach the network; the link is the plugin's one
// local process that calls out, and it calls only the desk server and its sign-in service
// (lib/origins.js). It loads two engine files, to find the desk and to refuse a linked one, and
// nothing else of the engine's.
//
// Five tools: sign_in (answers that this computer is signed in when its kept sign-in is live;
// otherwise answers the sign-in page for the person to open, and waits for the browser's return
// on this computer's loopback address), sign_out (removes the kept token), make (one desk tool
// made on the desk server and written to this desk; offline, queued), pull (a seat's graph
// brought to what its storage holds now) and seed (a seat's converted graph written into its
// empty storage, in batches). pull and seed are served once the desk server keeps a seat's pages.
//
// The harness speaks one JSON-RPC message per line on stdin; every reply is one line on stdout,
// and stdout carries nothing else. The log goes to stderr and carries tools, outcomes and
// counts only: never a token, a page's text, a page's path or a folder.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { make, SERVED } = require("./lib/make.js");
const { pull } = require("./lib/pull.js");
const { seed } = require("./lib/seed.js");
const signin = require("./lib/signin.js");
const token = require("./lib/token.js");

const NAME = "celorus-link";
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const MANIFEST = path.resolve(__dirname, "..", ".claude-plugin", "plugin.json");

function version() {
  try {
    const v = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).version;
    return typeof v === "string" && v ? v : "unknown";
  } catch {
    return "unknown";
  }
}

const TOOLS = [
  {
    name: "sign_in",
    description:
      "Sign in to Celorus before any change to the desk. When this computer keeps a live sign-in, answers that you " +
      "are signed in and opens nothing: that is the link's own reading of the sign-in it keeps, so a sign-in ended on " +
      "the desk server reads as signed in until a change, a pull or a seed made through the link is answered " +
      "otherwise, and the desk " +
      "server still checks every change made through make. Otherwise answers a page for the person to open in their " +
      "own browser; the link waits five minutes on this computer for the sign-in to finish, and keeps the sign-in " +
      "under the home folder, never in the desk. Asks only for the desk server's own access.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sign_out",
    description: "Sign out of Celorus on this computer: the link's kept sign-in is removed.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "make",
    description:
      "Make one desk tool's pages on the Celorus desk server and write them to this desk: " +
      `${SERVED.join(", ")}. arguments are that tool's own, as the desk's own tool takes them (desk included). ` +
      "Only the pages the tool needs are sent. The pages are written only when each matches its digest and no page " +
      "changed on this computer meanwhile; otherwise nothing is written. Offline, the change is queued on the desk " +
      "and made at the next make. A refusal or a payment the server asks for writes nothing and is never queued.",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", enum: [...SERVED], description: "The desk tool to make." },
        arguments: { type: "object", description: "That tool's own arguments." },
      },
      required: ["tool", "arguments"],
      additionalProperties: false,
    },
  },
  {
    name: "pull",
    description:
      "Bring this seat's graph to what its storage on the Celorus desk server holds now, and hold that read on this " +
      "desk, so the next change made through the link is made over it. A page changed on this computer since the " +
      "desk last read its storage is never written over: the pull is refused, naming each such page and the way " +
      "through, and nothing is written.",
    inputSchema: {
      type: "object",
      properties: { desk: { type: "string", description: "The seat's graph folder; left out, the desk is found as make finds it." } },
      additionalProperties: false,
    },
  },
  {
    name: "seed",
    description:
      "Write this seat's converted graph into its storage on the Celorus desk server, in batches, adding pages only: " +
      "into an empty seat folder, or on from a seed stopped part way. Only the pages the desk's sync table shares " +
      "leave this computer; a page only this computer keeps, and one the table names nowhere, never do. A seed that " +
      "stops says what is kept and what is not yet sent.",
    inputSchema: {
      type: "object",
      properties: { desk: { type: "string", description: "The seat's graph folder; left out, the desk is found as make finds it." } },
      additionalProperties: false,
    },
  },
];
const TOOL_NAMES = Object.freeze(TOOLS.map((tool) => tool.name));

function defaults() {
  return {
    home: os.homedir(),
    cwd: process.cwd(),
    env: process.env,
    request: undefined,
    createServer: undefined,
    now: () => Math.floor(Date.now() / 1000),
    log: (line) => process.stderr.write(`${NAME}: ${line}\n`),
  };
}

function text(words, structured, isError = false) {
  const out = { content: [{ type: "text", text: words }], isError };
  if (structured !== undefined) out.structuredContent = structured;
  return out;
}

// The sign-in waiting for the browser, if one is.
let pending = null;

const SIGNED_IN = "You are signed in to Celorus on this computer.";
// sign_in's renewal waits this long at most: every message behind it on the one stdio queue waits too.
const RENEW_MS = 10 * 1000;

// Whether this computer keeps a live sign-in: the kept token, renewed first when it is at its end
// (token.current). Only a token in hand is signed in. None kept, a renewal refused, and a renewal
// that could not be made (offline included) are not, and the browser sign-in starts. A token
// folder the link may not use is said as it is: a sign-in could not be kept there either.
async function keptSignIn(d) {
  try {
    await token.current({ home: d.home, request: d.request, now: d.now, timeoutMs: RENEW_MS });
    return true;
  } catch (err) {
    if (err && err.code === "token_folder") throw err;
    d.log(`sign_in: not signed in (${err && err.code ? err.code : "failed"})`);
    return false;
  }
}

async function signIn(d) {
  try {
    if (await keptSignIn(d)) {
      d.log("sign_in: signed in");
      return text(SIGNED_IN, { state: "signed_in" });
    }
  } catch (err) {
    d.log("sign_in: token_folder");
    return text(err.message, { state: "failed" }, true);
  }
  if (pending !== null) {
    return text(`A sign-in is already waiting. Open this page in your browser and sign in: ${pending.url}`, { state: "waiting" });
  }
  const { verifier, challenge, state } = signin.pkce();
  const url = signin.authorizeUrl({ challenge, state });
  const { ready, code } = signin.listenForCode({ state, createServer: d.createServer, unref: true });
  try {
    await ready;
  } catch (err) {
    code.catch(() => {});
    d.log(`sign_in: ${err.code || "failed"}`);
    return text(err.message, { state: "failed" }, true);
  }
  const mine = { url };
  pending = mine;
  code
    .then((got) => token.exchange({ code: got, verifier }, { home: d.home, request: d.request, now: d.now }))
    .then(
      () => d.log("sign_in: signed in"),
      (err) => d.log(`sign_in: ${err && err.code ? err.code : "failed"}`),
    )
    .finally(() => {
      if (pending === mine) pending = null;
    });
  d.log("sign_in: waiting");
  return text(
    `To sign in to Celorus, open this page in your browser and sign in: ${url}\n` +
      "The link waits five minutes for the sign-in to finish on this computer, then stops. Then make the change again.",
    { state: "waiting" },
  );
}

function signOut(d) {
  try {
    token.dropToken({ home: d.home });
  } catch (err) {
    return text(err.message, { state: "failed" }, true);
  }
  d.log("sign_out: done");
  return text("Signed out: the link's sign-in is removed from this computer.", { state: "signed_out" });
}

async function run(name, args, d) {
  if (name === "sign_in") return signIn(d);
  if (name === "sign_out") return signOut(d);
  if (name === "pull") return pull(args, d);
  if (name === "seed") return seed(args, d);
  return make(args, d);
}

function reply(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function failure(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleOne(message, d) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return failure(null, -32600, "A message is a JSON-RPC 2.0 object.");
  }
  const isRequest = Object.hasOwn(message, "id");
  const id = isRequest ? message.id : null;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return failure(id, -32600, 'A message carries "jsonrpc": "2.0" and a method.');
  }
  if (!isRequest) return null;
  const params = message.params || {};
  switch (message.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      return reply(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: NAME, version: version() },
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS });
    case "tools/call": {
      const name = params.name;
      if (!TOOL_NAMES.includes(name)) return failure(id, -32602, `The link's tools are ${TOOL_NAMES.join(", ")}.`);
      const args = params.arguments === undefined ? {} : params.arguments;
      try {
        return reply(id, await run(name, args, d));
      } catch (err) {
        d.log(`${name}: failed (${err && err.name ? err.name : "error"})`);
        return reply(id, text(`The link's ${name} stopped on an error it has no words for.`, { state: "failed" }, true));
      }
    }
    default:
      return failure(id, -32601, `This server does not answer ${message.method}. It answers initialize, ping, tools/list and tools/call.`);
  }
}

// One message, or a batch of them. `deps` stands in for the computer in the tests.
async function handle(message, deps) {
  const d = { ...defaults(), ...(deps || {}) };
  if (!Array.isArray(message)) return handleOne(message, d);
  if (message.length === 0) return failure(null, -32600, "An empty batch.");
  const replies = [];
  for (const one of message) {
    const out = await handleOne(one, d);
    if (out !== null) replies.push(out);
  }
  return replies.length ? replies : null;
}

function serve() {
  // Anything printed by mistake must not reach the protocol channel.
  console.log = console.error;
  console.info = console.error;
  const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
  let queue = Promise.resolve();
  let buffer = "";
  const take = (line) => {
    const raw = line.replace(/\r$/u, "");
    if (raw.trim() === "") return;
    queue = queue
      .then(async () => {
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          send(failure(null, -32700, "A message is one line of JSON."));
          return;
        }
        const out = await handle(message);
        if (out !== null) send(out);
      })
      .catch((err) => process.stderr.write(`${NAME}: failed (${err && err.name ? err.name : "error"})\n`));
  };
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
}

if (require.main === module) serve();

module.exports = { TOOLS, TOOL_NAMES, handle };
