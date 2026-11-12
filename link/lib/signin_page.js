"use strict";
// The page the browser shows when the sign-in comes back to the link's local address (DESK-305).
// Pure: it takes what the sign-in learned and answers the page's text. Inline styles only and no
// load from anywhere, since the page is served from the loopback port. It never carries the code.

const HEADING = "Georgia, 'Times New Roman', serif";
const BODY = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// DESK-384: what Milan does, above the next step; the Next line below is the one place that gives the step.
const WHAT_MILAN_DOES = "Milan runs your sales day: who to call first, why now, and what to say.";
const NEXT = [
  "Your chat can now use your Celorus desk.",
  WHAT_MILAN_DOES,
  'Next: go back to your chat and say "Milan, open my day."',
  'Not you? Say "Milan, sign out" in the chat and sign in again.',
  "You can close this tab.",
];
const FAILED = "The sign-in did not finish. You can close this tab, and start again from your assistant.";

function escapeHtml(text) {
  return String(text)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#x27;");
}

function wrap(title, lines) {
  const paragraphs = lines.map((line) => `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.5">${line}</p>`).join("\n");
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>Celorus</title>\n</head>\n" +
    `<body style="margin:0;padding:48px 24px;background:#E9E7E0;color:#0B0B0D;font-family:${BODY}">\n` +
    '<main style="max-width:560px;margin:0 auto">\n' +
    `<h1 style="margin:0 0 20px 0;font-family:${HEADING};font-size:28px;font-weight:600;color:#155A6B">${title}</h1>\n` +
    `${paragraphs}\n</main>\n</body>\n</html>\n`
  );
}

// signinPage({ email }) after a sign-in (email may be null: no claim), signinPage({ failed: true })
// when the exchange did not finish.
function signinPage({ email = null, failed = false } = {}) {
  if (failed) return wrap(FAILED, []);
  const said = typeof email === "string" && email !== "" ? `Signed in to Celorus as ${escapeHtml(email)}.` : "Signed in to Celorus.";
  return wrap(said, NEXT);
}

module.exports = { signinPage };
