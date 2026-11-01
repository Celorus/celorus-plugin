"use strict";
// The argument guard's hook (row E11): hooks.json runs this file before every connector call of
// the session (PreToolUse), with the call as JSON on stdin. The shapes it holds each role to are
// engine/live/shapes.js's; this file only reads the call, keeps the time, and answers. Exit 0
// hands the call on to the permissions as usual; exit 2 refuses it, and the one line on stderr
// is what the model reads. A call let through with a line to say (the guard stood aside: the
// session has no desk) says it as a PreToolUse hook says a line on a call it lets through: one
// JSON object on stdout whose hookSpecificOutput carries the line as additionalContext, and no
// permission decision, so the permissions decide the call as usual.
//
// It fails closed: a call not decided within BUDGET_MS, a read of stdin that fails, and any fault
// at all are refused, never passed. A fault while the engine's files load is caught by the try
// around main(); a fault after, while the call is read and decided in stdin's callbacks, by the
// uncaughtException handler main() sets once they are loaded. Built-in modules only, and the
// engine's own block on the network (engine/lib/guard.js) is installed before any other engine
// file is loaded.
//
// On a machine with no Node this file cannot start at all, and nothing in it runs. hooks.json says
// what happens then (E10-L): the hook's entry carries onFailure "block" (Claude Code 2.1.295 or
// later), so the harness refuses the guarded call instead of letting it pass unchecked. The same
// field refuses the call when a hook times out, exits with a code other than 0 or 2, or writes a
// line the harness cannot read; this file does none of those when it runs. The entry's matcher
// leaves outside only a tool of the record server, named by one of its two prefixes (the plugin's
// celorus-data server, or the desktop app's directory connector for the same address) and then
// the tool's own name with no double underscore in it, since those tools are served over the web
// and need no Node. Every other connector call stays inside, a name with a second double
// underscore after either prefix included, because shapes.js's roleOf reads a connector up to the
// last double underscore and would take such a name for a connector of its own.

const path = require("path");

const ENGINE = path.join(__dirname, "..", "engine");
// The time the guard has to decide, in milliseconds. The harness's own timeout for the hook
// (hooks.json) is longer, so this refusal always comes first.
const BUDGET_MS = 3000;
const REFUSE = 2;
const FAULT = "the guard could not decide this call";

function refuse(reason) {
  process.stderr.write(`Refused by the desk's argument guard: ${reason}. Nothing was called.\n`);
  process.exit(REFUSE);
}

function main() {
  const timer = setTimeout(() => refuse(`${FAULT} in time`), BUDGET_MS);
  require(path.join(ENGINE, "lib", "guard.js")).install("the desk's argument guard");
  const { run } = require(path.join(ENGINE, "live", "shapes.js"));
  process.on("uncaughtException", () => refuse(FAULT));
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("error", () => refuse("the call could not be read"));
  process.stdin.on("end", () => {
    clearTimeout(timer);
    const { code, message, said } = run(Buffer.concat(chunks).toString("utf8"));
    if (message) process.stderr.write(`${message}\n`);
    if (!said) process.exit(code);
    // the line is written whole before the hook ends
    const line = JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: said } });
    process.stdout.write(`${line}\n`, () => process.exit(code));
  });
}

try {
  main();
} catch {
  refuse(FAULT);
}

module.exports = { BUDGET_MS };
