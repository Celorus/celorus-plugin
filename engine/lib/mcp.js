"use strict";
// The Model Context Protocol, the part a tools-only server needs, over JSON-RPC 2.0: the
// handshake (initialize, then the client's initialized notification), ping, tools/list and
// tools/call. Hand-rolled so the plugin carries no dependency. `handle` takes one parsed
// message and resolves to the reply, or to null when the message was a notification.

const { findTool } = require("./tools.js");
const { inspect } = require("node:util");
const { Refusal } = require("./refusal.js");

// Newest first. A client asking for one of these gets it back; any other gets the newest.
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

// The answer to an error a tool has no words for. It claims nothing about the desk: the tool
// stopped somewhere it cannot name, so it cannot say what it changed.
function unexpected(toolName) {
  return (
    `The desk tool ${toolName} stopped on an error it has no words for, so it cannot say what it ` +
    "did or did not change. The error is in the desk server's log."
  );
}

function reply(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function failure(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function createHandler({ tools, name, version, log = () => {} }) {
  const listed = tools.map(({ name: toolName, description, inputSchema }) => ({
    name: toolName,
    description,
    inputSchema,
  }));

  async function callTool(id, params) {
    const toolName = params && params.name;
    let tool;
    try {
      tool = findTool(toolName);
    } catch (err) {
      return failure(id, INVALID_PARAMS, err.message);
    }
    const args = params.arguments === undefined ? {} : params.arguments;
    try {
      const result = await tool.run(args);
      return reply(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        isError: false,
      });
    } catch (err) {
      // A refusal is the engine's own words, and passes as it is. Anything else is an error the
      // tool has no words for: its text can carry an absolute path or the system's own message,
      // so the answer is one fixed sentence naming the tool, and the error itself goes only to
      // the server's log (its stderr, never the answer).
      if (err instanceof Refusal) return reply(id, { content: [{ type: "text", text: err.message }], isError: true });
      log(`${tool.name} failed: ${err instanceof Error && err.stack ? err.stack : inspect(err)}`);
      return reply(id, { content: [{ type: "text", text: unexpected(tool.name) }], isError: true });
    }
  }

  async function handleOne(message) {
    if (message === null || typeof message !== "object" || Array.isArray(message)) {
      return failure(null, INVALID_REQUEST, "A message is a JSON-RPC 2.0 object.");
    }
    const isRequest = Object.hasOwn(message, "id");
    const id = isRequest ? message.id : null;
    if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return failure(id, INVALID_REQUEST, 'A message carries "jsonrpc": "2.0" and a method.');
    }
    if (!isRequest) return null; // notifications (initialized, cancelled, others) need no reply
    const params = message.params || {};
    switch (message.method) {
      case "initialize": {
        const asked = params.protocolVersion;
        return reply(id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name, version },
        });
      }
      case "ping":
        return reply(id, {});
      case "tools/list":
        return reply(id, { tools: listed });
      case "tools/call":
        return callTool(id, params);
      default:
        return failure(
          id,
          METHOD_NOT_FOUND,
          `This server does not answer ${message.method}. It answers initialize, ping, ` +
            "tools/list and tools/call.",
        );
    }
  }

  // One message, or a batch of them (an array), as the older protocol versions allow.
  async function handle(message) {
    if (!Array.isArray(message)) return handleOne(message);
    if (message.length === 0) return failure(null, INVALID_REQUEST, "An empty batch.");
    const replies = [];
    for (const one of message) {
      const answer = await handleOne(one);
      if (answer !== null) replies.push(answer);
    }
    return replies.length ? replies : null;
  }

  return { handle };
}

module.exports = { createHandler, PROTOCOL_VERSIONS, PARSE_ERROR, failure };
