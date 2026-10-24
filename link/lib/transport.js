"use strict";
// The link's one carrier, and the only file of the link that loads node:https. Every call is a
// POST to one of the two pinned addresses (lib/origins.js), checked before any request is made.
// A redirect is never followed: any 3xx answer is an error. A call has a time limit, and an
// answer over the cap is refused, never cut. A call that reaches nothing (no answer came back)
// is a network failure, the one failure after which a write may be queued. It says whether the
// call may have reached the server: never, when it failed to connect before any connection was
// made (the address not found, the connection refused or out of reach, or a connect that timed
// out), and maybe otherwise (a connection reset, a time limit or an answer cut off after the
// connection was made), as the server may have taken the call and the answer been lost.

const https = require("node:https");
const { LinkError } = require("./errors.js");
const { pinned } = require("./origins.js");

// The largest answer read: the server returns at most 16 MiB of pages, and base64 makes a page
// a third larger.
const MAX_ANSWER_BYTES = 24 * 1024 * 1024;
const TIMEOUT_MS = 120 * 1000;

// The failures to connect, each before a byte of the call is sent.
const NEVER_CONNECTED = Object.freeze(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "EADDRNOTAVAIL", "ENETDOWN"]);

function offline(sent = "maybe") {
  return new LinkError("offline", "The desk server could not be reached.", { network: true, sent });
}

// POSTs `body` (text) to `url`, which must be the address pinned for `purpose`. Answers
// { status, type, text }. `request` stands in for https.request in the tests.
function post(url, purpose, headers, body, { request, timeoutMs = TIMEOUT_MS, maxBytes = MAX_ANSWER_BYTES } = {}) {
  let target;
  try {
    target = pinned(url, purpose);
  } catch (err) {
    return Promise.reject(err);
  }
  const send = request || https.request;
  const data = Buffer.from(body, "utf8");
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    let req;
    try {
      req = send(
        {
          protocol: "https:",
          hostname: target.hostname,
          port: 443,
          path: target.pathname,
          method: "POST",
          headers: { ...headers, "Content-Length": String(data.length) },
          timeout: timeoutMs,
          agent: false,
        },
        (res) => {
          const status = res.statusCode;
          if (status >= 300 && status < 400) {
            res.resume();
            req.destroy();
            settle(reject, new LinkError("redirect", "The server answered with a redirect, which the link never follows. Nothing was written."));
            return;
          }
          const chunks = [];
          let size = 0;
          res.on("data", (chunk) => {
            if (settled) return;
            size += chunk.length;
            if (size > maxBytes) {
              req.destroy();
              settle(reject, new LinkError("too_big", "The server's answer was larger than the link reads, so none of it was used. Nothing was written."));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () =>
            settle(resolve, { status, type: String(res.headers["content-type"] || ""), text: Buffer.concat(chunks).toString("utf8") }),
          );
          res.on("error", () => settle(reject, offline()));
          res.on("aborted", () => settle(reject, offline()));
        },
      );
    } catch (err) {
      // A route refused in this process (as under the engine's own block) is the caller's error,
      // never a network failure: nothing is queued for it.
      settle(reject, err);
      return;
    }
    // Whether a connection was made. `connecting`: a socket is seen and has not connected yet;
    // `connected`: it has. A failure to connect is never sent only while no connection was made;
    // a time limit is never sent only while the socket is seen still connecting.
    let connecting = false;
    let connected = false;
    req.on("socket", (socket) => {
      if (!socket || typeof socket.once !== "function") return;
      if (!socket.connecting) {
        connected = true;
        return;
      }
      connecting = true;
      socket.once("connect", () => {
        connecting = false;
        connected = true;
      });
    });
    req.on("timeout", () => {
      req.destroy();
      settle(reject, offline(connecting ? "never" : "maybe"));
    });
    req.on("error", (err) => {
      const code = err && typeof err.code === "string" ? err.code : "";
      settle(reject, offline(!connected && NEVER_CONNECTED.includes(code) ? "never" : "maybe"));
    });
    req.end(data);
  });
}

module.exports = { MAX_ANSWER_BYTES, TIMEOUT_MS, post };
