"use strict";
// The two places the link calls, each for one purpose, and the sign-in's fixed values.
//
// The link calls exactly two addresses: the desk server's /mcp, for a making call, and the
// sign-in service's token address, for the token exchange and its refresh. Any other address is
// refused before a request is made: lib/transport.js asks `pinned` first, and an address passes
// only when it is, character for character, the one pinned for its purpose. The sign-in page is
// opened by the person in their own browser; the link builds its address and never calls it.
//
// The client is the desk server's public client: it holds no secret, signs in by PKCE, and has
// one registered loopback address. Its id is public by design. It lives here, in the link's own
// code, and not in the plugin's server declarations, where a pinned id would stop another
// harness from registering a client of its own.

const { LinkError } = require("./errors.js");

const MAKE_URL = "https://app.celorus.com/mcp";
const TOKEN_URL = "https://celorus-mcp.auth.ap-south-1.amazoncognito.com/oauth2/token";
const AUTHORIZE_URL = "https://celorus-mcp.auth.ap-south-1.amazoncognito.com/oauth2/authorize";
const CLIENT_ID = "3c77g9j943h4bn7js75e4nga6u";
const REDIRECT_URI = "http://localhost:8484/callback";
// The one scope the desk server needs. Nothing else is asked for: no openid, no email, no
// profile, and never a scope of any mail, calendar or file service.
const SCOPE = "celorus-mcp/invoke";

const PINNED = Object.freeze({ make: MAKE_URL, token: TOKEN_URL });

const ELSEWHERE =
  "The link calls only the desk server and its sign-in service, each for its own purpose; " +
  "this address is neither, so nothing was sent.";

// The address, parsed, when it is the one pinned for `purpose`; a refusal otherwise.
function pinned(url, purpose) {
  if (typeof purpose !== "string" || !Object.hasOwn(PINNED, purpose) || url !== PINNED[purpose]) {
    throw new LinkError("origin", ELSEWHERE);
  }
  return new URL(url);
}

module.exports = { AUTHORIZE_URL, CLIENT_ID, MAKE_URL, PINNED, REDIRECT_URI, SCOPE, TOKEN_URL, pinned };
