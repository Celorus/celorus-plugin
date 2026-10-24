"use strict";
// The link's own refusals and failures. `code` is a short word for the log; the message is what
// the person reads, and never carries a token, a page's text or a full path. `network` is true
// only for a call that reached nothing (no answer came back), the one failure after which a
// write may be queued (lib/queue.js). `passing` is true for a failure that says itself it will
// pass (a server or sign-in service that is busy or down): a queued call it stops stays queued.
// `sent`, on a network failure only: "never" when the call never left this computer (it never
// connected), else "maybe", as the call may have reached the server and its answer been lost.

class LinkError extends Error {
  constructor(code, message, { network = false, passing = false, sent } = {}) {
    super(message);
    this.name = "LinkError";
    this.code = code;
    this.network = network;
    this.passing = passing;
    if (network) this.sent = sent === "never" ? "never" : "maybe";
  }
}

// An HTTP status that says the service will answer later: it timed out, is limiting calls, or
// failed on its own side.
function passingStatus(status) {
  return status === 408 || status === 429 || (Number.isInteger(status) && status >= 500);
}

module.exports = { LinkError, passingStatus };
