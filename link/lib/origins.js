"use strict";
// The two places the link calls, each for one purpose, and the sign-in's fixed values.
//
// The link calls the desk server's /mcp, for a making call, and the sign-in service's token
// address, for the token exchange and its refresh. Any other address is refused before a request
// is made: lib/transport.js asks `pinned` first, and an address passes only when it is, character
// for character, the one pinned for its purpose. The sign-in and sign-out pages are opened by the
// person in their own browser; the link builds their addresses and never calls them.
// The set-up page of the Celorus dashboard, where a seat's desk is made, is only named in an
// answer for the person to open: the link never calls it, and it is pinned for no purpose.
//
// The sign-in service answers on two addresses (DESK-257): auth.celorus.com, where every
// sign-in is made from this release, and the pool's Amazon address, which the pool keeps. A
// sign-in kept from an earlier release was made on the Amazon address, so its refresh and its
// sign-out go back there: the token file keeps a word for the address (`at`), never the address,
// and a file with no word is one of those. Each address's token exchange has its own purpose.
//
// The client is the desk server's public client: it holds no secret, signs in by PKCE, and has
// one registered loopback address. Its id is public by design. It lives here, in the link's own
// code, and not in the plugin's server declarations, where a pinned id would stop another
// harness from registering a client of its own.

const { LinkError } = require("./errors.js");

const MAKE_URL = "https://app.celorus.com/mcp";
const TOKEN_URL = "https://auth.celorus.com/oauth2/token";
const AUTHORIZE_URL = "https://auth.celorus.com/oauth2/authorize";
const LOGOUT_URL = "https://auth.celorus.com/logout";
const AMAZON_TOKEN_URL = "https://celorus-mcp.auth.ap-south-1.amazoncognito.com/oauth2/token";
const AMAZON_LOGOUT_URL = "https://celorus-mcp.auth.ap-south-1.amazoncognito.com/logout";
const CLIENT_ID = "3c77g9j943h4bn7js75e4nga6u";
const REDIRECT_URI = "http://localhost:8484/callback";
// What the sign-in asks for: the desk server's own access (`celorus-mcp/invoke`), and who is
// signing in (`openid email`), so the sign-in's answer carries an id token with the address. The
// address is shown once, on the page that ends the sign-in, and kept nowhere (lib/token.js). The
// plugin never asks for it again, though the tokens it keeps would let it (a renewal brings a new
// id token, dropped unread; the access token could ask the pool's userInfo page). The client
// allows exactly these three. Nothing else is asked for: no profile, and
// never a scope of any mail, calendar or file service.
const SCOPE = "openid email celorus-mcp/invoke";
const SETUP_PAGE = "https://app.celorus.com/dashboard/setup";

const PINNED = Object.freeze({ make: MAKE_URL, token: TOKEN_URL, amazon_token: AMAZON_TOKEN_URL });

// The address a sign-in was made on, by the word the token file keeps: its token exchange (with
// that exchange's purpose) and its sign-out page. NOW_AT is where a sign-in is made.
const SIGNED_IN_AT = Object.freeze({
  celorus: Object.freeze({ token: TOKEN_URL, purpose: "token", logout: LOGOUT_URL }),
  amazon: Object.freeze({ token: AMAZON_TOKEN_URL, purpose: "amazon_token", logout: AMAZON_LOGOUT_URL }),
});
const NOW_AT = "celorus";
// A token file from an earlier release keeps no word, and is read as a sign-in on the Amazon address.
const BEFORE_AT = "amazon";

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

// The address a sign-in was made on, by its word; a refusal for any other word.
function signedInAt(at) {
  if (typeof at !== "string" || !Object.hasOwn(SIGNED_IN_AT, at)) throw new LinkError("origin", ELSEWHERE);
  return SIGNED_IN_AT[at];
}

module.exports = {
  AUTHORIZE_URL,
  BEFORE_AT,
  CLIENT_ID,
  MAKE_URL,
  NOW_AT,
  PINNED,
  REDIRECT_URI,
  SCOPE,
  SETUP_PAGE,
  SIGNED_IN_AT,
  TOKEN_URL,
  pinned,
  signedInAt,
};
