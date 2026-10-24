"use strict";
// The link's sign-in: the desk server's access token and its refresh token, kept under the home
// folder in ~/.celorus/link/token.json, never in a desk. The folder is 0700 and the file 0600,
// written to a new file opened only if it does not exist and never through a link, then renamed
// into place. ~/.celorus, its link/ folder or the file itself being a link is refused: the token
// is never read or written through one. Nothing else is kept: no id token, no address, no name.
//
// The token is sent only to the desk server (lib/make.js); the refresh token only to the
// sign-in service's token address. Neither is ever written to a desk, a queued call, an answer
// or the log.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { LinkError, passingStatus } = require("./errors.js");
const { CLIENT_ID, REDIRECT_URI, TOKEN_URL } = require("./origins.js");
const { post } = require("./transport.js");

const PARTS = [".celorus", "link"];
const FILE = "token.json";
// A token this close to its end is refreshed before it is used.
const SKEW_SECONDS = 60;

const FOLDER_SAID =
  "The link keeps its sign-in in ~/.celorus/link/, and ~/.celorus, its link folder or the " +
  "token file there is a link or not what it should be, so it was neither read nor written. " +
  "Remove the link, then call sign_in.";
const SIGNED_OUT =
  "You are not signed in to Celorus through the link, or the sign-in has ended. Call sign_in, " +
  "open the page it gives, and sign in; then make the change again. Nothing was written.";

function tokenFolder(home) {
  return path.join(home, ...PARTS);
}

function tokenFile(home) {
  return path.join(tokenFolder(home), FILE);
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// The token folder as it is: true when it is there, false when some part of it is not; a link
// or a non-folder on the way is refused.
function folderThere(home) {
  let at = home;
  for (const part of PARTS) {
    at = path.join(at, part);
    const st = lstatOrNull(at);
    if (st === null) return false;
    if (st.isSymbolicLink() || !st.isDirectory()) throw new LinkError("token_folder", FOLDER_SAID);
  }
  return true;
}

// The token folder, made 0700 where it is not there.
function makeFolder(home) {
  let at = home;
  for (const part of PARTS) {
    at = path.join(at, part);
    const st = lstatOrNull(at);
    if (st === null) {
      fs.mkdirSync(at, { mode: 0o700 });
      fs.chmodSync(at, 0o700);
    } else if (st.isSymbolicLink() || !st.isDirectory()) {
      throw new LinkError("token_folder", FOLDER_SAID);
    }
  }
  fs.chmodSync(at, 0o700);
  return at;
}

function shapeOk(kept) {
  return (
    kept !== null &&
    typeof kept === "object" &&
    typeof kept.access_token === "string" &&
    kept.access_token !== "" &&
    Number.isInteger(kept.expires_at) &&
    (kept.refresh_token === null || (typeof kept.refresh_token === "string" && kept.refresh_token !== ""))
  );
}

// The kept token, or null when there is none (or what is there is not one).
function readToken({ home }) {
  if (!folderThere(home)) return null;
  const file = tokenFile(home);
  const st = lstatOrNull(file);
  if (st === null) return null;
  if (!st.isFile()) throw new LinkError("token_folder", FOLDER_SAID);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let text;
  try {
    text = fs.readFileSync(fd, "utf8");
  } finally {
    fs.closeSync(fd);
  }
  let kept;
  try {
    kept = JSON.parse(text);
  } catch {
    return null;
  }
  return shapeOk(kept) ? { access_token: kept.access_token, refresh_token: kept.refresh_token, expires_at: kept.expires_at } : null;
}

function saveToken(token, { home }) {
  const kept = { access_token: token.access_token, refresh_token: token.refresh_token || null, expires_at: token.expires_at };
  if (!shapeOk(kept)) throw new LinkError("token_shape", "The sign-in service's answer was not a token the link can keep.");
  const folder = makeFolder(home);
  const file = path.join(folder, FILE);
  const st = lstatOrNull(file);
  if (st !== null && !st.isFile()) throw new LinkError("token_folder", FOLDER_SAID);
  const spare = path.join(folder, `.token-${crypto.randomBytes(8).toString("hex")}.tmp`);
  const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
  const fd = fs.openSync(spare, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
  try {
    fs.fchmodSync(fd, 0o600);
    fs.writeSync(fd, JSON.stringify(kept));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(spare, file);
}

function dropToken({ home }) {
  if (!folderThere(home)) return;
  // rm takes a link itself away, never what it leads to
  fs.rmSync(tokenFile(home), { force: true });
}

// The kept token removed only while it is still the one that was refused (the same `field`): a
// sign-in saved meanwhile, by a browser sign-in finishing or another session's link, is kept.
function dropTokenIfStill(token, { home }, field = "access_token") {
  const kept = readToken({ home });
  if (kept === null || kept[field] !== token[field]) return;
  dropToken({ home });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

// The token from the sign-in service's answer to an exchange or a refresh. A refresh that
// carries no new refresh token keeps the one it was made with.
function fromAnswer(out, previous, now) {
  if (out.status === 400 || out.status === 401) throw new LinkError("signed_out", SIGNED_OUT);
  if (out.status !== 200) {
    throw new LinkError("token_failed", `The sign-in service answered ${out.status}. Nothing was written; try again.`, { passing: passingStatus(out.status) });
  }
  let body;
  try {
    body = JSON.parse(out.text);
  } catch {
    throw new LinkError("token_failed", "The sign-in service's answer was not one the link reads. Nothing was written.");
  }
  const ok =
    body !== null &&
    typeof body === "object" &&
    typeof body.access_token === "string" &&
    body.access_token !== "" &&
    typeof body.token_type === "string" &&
    body.token_type.toLowerCase() === "bearer" &&
    Number.isInteger(body.expires_in) &&
    body.expires_in > 0;
  if (!ok) throw new LinkError("token_failed", "The sign-in service's answer was not a token the link can keep. Nothing was written.");
  const refresh = typeof body.refresh_token === "string" && body.refresh_token !== "" ? body.refresh_token : previous ? previous.refresh_token : null;
  return { access_token: body.access_token, refresh_token: refresh, expires_at: now() + body.expires_in };
}

const FORM = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };

// The code from the browser, exchanged for the token, which is kept. PKCE: the verifier proves
// this link started the sign-in; the public client sends no secret.
async function exchange({ code, verifier }, { home, request, now = nowSeconds }) {
  const form = new URLSearchParams({ grant_type: "authorization_code", client_id: CLIENT_ID, code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
  const out = await post(TOKEN_URL, "token", FORM, form.toString(), { request });
  const token = fromAnswer(out, null, now);
  saveToken(token, { home });
  return token;
}

// A new access token from the refresh token, kept. A refused refresh ends the sign-in. The
// renewal is kept only while the sign-in it renewed is still the one kept: a sign-in saved while
// it was out (a browser sign-in finishing, another session's link) is used and kept instead, and
// a sign-out made while it was out stands.
async function refresh(token, { home, request, now = nowSeconds, timeoutMs }) {
  if (!token.refresh_token) throw new LinkError("signed_out", SIGNED_OUT);
  const form = new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, refresh_token: token.refresh_token });
  const out = await post(TOKEN_URL, "token", FORM, form.toString(), { request, timeoutMs });
  let fresh;
  try {
    fresh = fromAnswer(out, token, now);
  } catch (err) {
    if (err.code === "signed_out") dropTokenIfStill(token, { home }, "refresh_token");
    throw err;
  }
  const kept = readToken({ home });
  if (kept === null) throw new LinkError("signed_out", SIGNED_OUT);
  if (kept.refresh_token !== token.refresh_token) return kept;
  saveToken(fresh, { home });
  return fresh;
}

// The token to use now: the kept one, refreshed first when it is at its end.
async function current({ home, request, now = nowSeconds, timeoutMs }) {
  const token = readToken({ home });
  if (token === null) throw new LinkError("signed_out", SIGNED_OUT);
  if (token.expires_at - SKEW_SECONDS > now()) return token;
  return refresh(token, { home, request, now, timeoutMs });
}

module.exports = { SIGNED_OUT, current, dropToken, dropTokenIfStill, exchange, readToken, refresh, saveToken, tokenFile, tokenFolder };
