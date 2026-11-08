"use strict";
// The sign-in, by the person, in their own browser. The link makes a PKCE verifier and a state,
// answers the sign-in page's address for the person to open, and listens on this computer's
// loopback address alone (127.0.0.1 and ::1, port 8484, the client's one registered address)
// for the browser to come back with a code. It never calls the sign-in page itself. This is the
// one file of the link that loads node:http, and only to listen.
//
// The listener takes one request: GET /callback, from a loopback Host, carrying the state this
// sign-in made. A wrong request is answered and the wait goes on; the right one, or the person
// refusing in the browser, or five minutes passing, ends it, and both listeners close. The page
// the browser shows never carries the code.

const crypto = require("node:crypto");
const http = require("node:http");
const { LinkError } = require("./errors.js");
const { AUTHORIZE_URL, CLIENT_ID, REDIRECT_URI, SCOPE, signedInAt } = require("./origins.js");
const { signinPage } = require("./signin_page.js");

const PORT = 8484;
const HOSTS = ["127.0.0.1", "::1"];
const WAIT_MS = 5 * 60 * 1000;
const LOOPBACK_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
const CODE = /^[A-Za-z0-9._~-]{1,2048}$/u;

function pkce(randomBytes = crypto.randomBytes) {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  return { verifier, challenge, state };
}

// The sign-in page's address, for the person to open.
function authorizeUrl({ challenge, state }) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${query}`;
}

// The sign-out page's address, for the person to open, at the address the sign-in was made on
// (DESK-257). It is the pool's own sign-out in the form that needs only the client's one
// registered return address: it ends the browser's sign-in there, then shows the sign-in page.
function logoutUrl(at) {
  const query = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  });
  return `${signedInAt(at).logout}?${query}`;
}

function sameState(given, state) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(state, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Connection: "close",
};

// Listens for the browser's return. Answers { ready, code, stop }: `ready` settles once the
// listeners are up (or cannot be), `code` with the code the browser brings, and `stop` ends the
// wait at once (sign_out), so the listeners close and a code that comes later is turned away.
// `createServer` stands in for http.createServer in the tests; `unref` lets the process end while
// the wait is on. `onCode(code)` is the exchange, answering { email } (DESK-305): the page the
// browser shows is written after it, naming who signed in, or saying the sign-in did not finish
// when it fails; the wait ends with the code either way, so the caller is told. With no `onCode`
// the page is the plain signed-in one, at once.
function listenForCode({ state, createServer, timeoutMs = WAIT_MS, hosts = HOSTS, port = PORT, unref = false, onCode = null }) {
  const make = createServer || ((handler) => http.createServer(handler));
  const servers = [];
  let settled = false;
  // a code has come and its exchange is out: no second code is taken. `takenCode` is the code that
  // was taken, and `waiting` the responses held for the page it ends with: the first request's, and
  // a reload's of the same state and code (a reload of the only tab must not lose the result).
  let taken = false;
  let takenCode = null;
  const waiting = [];
  let timer = null;
  let onReady;
  let onNotReady;
  const ready = new Promise((resolve, reject) => {
    onReady = resolve;
    onNotReady = reject;
  });
  ready.catch(() => {});
  let stop = () => {};
  const code = new Promise((resolve, reject) => {
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      for (const server of servers) {
        try {
          server.close();
          if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
        } catch {
          // a listener that never came up has nothing to close
        }
      }
      fn(value);
    };
    stop = () => finish(reject, new LinkError("sign_in_stopped", "The sign-in was stopped by sign_out. Call sign_in to start again."));
    timer = setTimeout(
      () => finish(reject, new LinkError("sign_in_timeout", "The sign-in was not finished within five minutes, so the link stopped waiting. Call sign_in to start again.")),
      timeoutMs,
    );
    // The door's wait never keeps the link's process alive once its harness has gone.
    if (unref && typeof timer.unref === "function") timer.unref();

    const handler = (req, res) => {
      const answer = (status, text) => {
        res.writeHead(status, HEADERS);
        res.end(text);
      };
      // The page goes to every response held for it, the first request's and any reload's.
      const answerPage = (html) => {
        for (const held of waiting.splice(0)) {
          held.writeHead(200, { ...HEADERS, "Content-Type": "text/html; charset=utf-8" });
          held.end(html);
        }
      };
      const firstTab = () => answer(410, "This sign-in is being completed in your first tab. You can close this one.");
      if (settled) return answer(410, "This sign-in has ended. Start again from your assistant.");
      let url;
      try {
        url = new URL(req.url, `http://localhost:${port}`);
      } catch {
        return answer(400, "This is not a sign-in address.");
      }
      if (url.pathname !== "/callback") return answer(404, "Not found.");
      if (req.method !== "GET") return answer(405, "This address takes the browser's return from the sign-in only.");
      if (!LOOPBACK_HOSTS.has(String(req.headers.host || ""))) return answer(400, "This is not a sign-in address.");
      const rightState = sameState(url.searchParams.get("state"), state);
      const got = url.searchParams.get("code");
      // While the exchange is out, the one request that carries this sign-in's state and the code
      // that was taken (the first tab, reloaded) waits for the same page; any other is turned away.
      // The state is kept: it is never used up by its first use.
      if (taken) {
        if (rightState && got === takenCode) {
          waiting.push(res);
          return undefined;
        }
        return firstTab();
      }
      if (!rightState) {
        return answer(400, "This sign-in is not the one Celorus started. Start again from your assistant.");
      }
      if (url.searchParams.get("error") !== null) {
        answer(200, "The sign-in did not finish. You can close this tab, and start again from your assistant.");
        return finish(reject, new LinkError("sign_in_refused", "The sign-in was not finished in the browser. Call sign_in to start again."));
      }
      if (got === null || !CODE.test(got)) return answer(400, "The sign-in came back without a code. Start again from your assistant.");
      if (onCode === null) {
        waiting.push(res);
        answerPage(signinPage({ email: null }));
        return finish(resolve, got);
      }
      // The wait is closed to any other request while the exchange is out (a reload of the same
      // state and code waits for the same page), and the five minutes no longer apply: the timeout cannot end a wait whose exchange is running (the transport's own
      // timeout still bounds the exchange).
      taken = true;
      takenCode = got;
      waiting.push(res);
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      let exchanged;
      try {
        exchanged = Promise.resolve(onCode(got));
      } catch (err) {
        exchanged = Promise.reject(err);
      }
      return exchanged.then(
        (who) => {
          answerPage(signinPage({ email: who && typeof who.email === "string" ? who.email : null }));
          finish(resolve, got);
        },
        () => {
          answerPage(signinPage({ failed: true }));
          finish(resolve, got);
        },
      );
    };

    let up = 0;
    let down = 0;
    const settledOne = () => {
      if (up + down < hosts.length) return;
      if (up === 0) {
        const err = new LinkError("port_busy", `The sign-in could not listen on this computer's port ${port}. Close what is using it, then call sign_in again.`);
        onNotReady(err);
        finish(reject, err);
      } else {
        onReady();
      }
    };
    for (const host of hosts) {
      const server = make(handler);
      servers.push(server);
      let counted = false;
      server.on("error", (err) => {
        if (counted) return;
        counted = true;
        // The port taken on either address ends the sign-in; an address this computer does not
        // have (no IPv6) is passed over.
        if (err && err.code === "EADDRINUSE") {
          const busy = new LinkError("port_busy", `The sign-in could not listen on this computer's port ${port}: something else is using it. Close it, then call sign_in again.`);
          onNotReady(busy);
          finish(reject, busy);
          return;
        }
        down += 1;
        settledOne();
      });
      server.listen({ host, port, exclusive: true }, () => {
        if (counted) return;
        counted = true;
        up += 1;
        settledOne();
      });
    }
  });
  return { ready, code, stop: () => stop() };
}

// The code the browser brings back, for a sign-in the caller has already answered.
function waitForCode(options) {
  return listenForCode(options).code;
}

module.exports = { HOSTS, PORT, WAIT_MS, authorizeUrl, listenForCode, logoutUrl, pkce, waitForCode };
