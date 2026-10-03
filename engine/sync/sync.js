"use strict";
// desk_sync: the desk's own history in git. The engine never runs git, reaches the network or
// writes a git object (the base's ruling R3): it checks the
// seat and the commit message, and answers the exact git commands for the skill to run, in
// order, each as its words (argv) and as one shell line.
//
// What it commits is an explicit set of paths (0.19.0 round 1, K1; the base's ruling R70): the
// shared rows of the writers' table below, each as git's glob pathspec, and only the rows the
// desk holds a file of. Never `add -A`, and never a folder that could carry a dot folder with it.
// A seat's own pages (render_view's celorus/.views, and the rest of the table's seat rows) are in
// no pathspec, so no command stages them, whatever the desk's .gitignore says; the .gitignore
// line for celorus/.views is a second layer of its own (update/update.js GITIGNORE_V2). A file
// no row names is not staged either, and the answer names it. The commit is made with the same
// pathspecs, so it holds those rows alone, whatever else is staged.
//
// The commands commit by default: first the seat-pages checks (K1k, R101 (B), seatPages below:
// where one stops, the run stops there, and taking the pages out of the history is the desk
// owner's act, never this tool's), then the stage, whether anything is staged, and the commit
// with the seat's message only when something is: a desk with nothing new still pulls and pushes
// when asked. Then git's own check that HEAD is on a branch (on a detached HEAD the run stops there), and, when asked, the branch's upstream read from the desk's config (its remote
// and its merge ref), a fetch of that branch from that remote alone, the pull and the push, each
// naming the same remote and branch (K1d, K1e, K1f). Before any command takes the upstream (K1g,
// the base's ruling R88), a remote or branch word that begins with - stops the run, and so does an
// upstream inside this repository (a remote "." or a path to its git folder or work tree): git's
// own answers, compared by git. K1i (R92) makes that check fail closed and reads every url git
// would use, the fetch's and the push's: the run goes on only when each leads to another
// repository. The pages only the overnight may change (families/, people/ and
// firms/, as the demo held them back) are in no pathspec either; the skill reads which were held
// back with the status command and says so. Pull and push are answered only when the person
// asked for them in words and the skill says so (`push: true`); on our own desk the push stays
// the founder's act, as every push of the desk repository is. The commit is made under the
// person's own git identity: the engine names none.

const fs = require("node:fs");
const path = require("node:path");
const { Refusal } = require("../lib/refusal.js");
const { screened, unpathed } = require("../write/screen.js");
const { deskMd, seatsOf, seatsNamed } = require("../write/facts.js");
const { GITIGNORE_V2 } = require("../update/update.js");

const OVERNIGHT = ["celorus/families", "celorus/people", "celorus/firms"];
const VIEWS = "celorus/.views";
const NOTHING = "Nothing was committed.";

// The writers' table: every file the registry's tools write on a desk, and the scaffold they write into,
// by where it sits from the desk folder, with what it holds. Each row is [glob, class, holds]:
// - seat: one seat's own, or drawn for one seat: never staged. First, so no other row can take a
//   file of one.
// - overnight: every seat's, but only the overnight changes and commits these: staged for it alone (`overnight: true`, and then the pages, *.md, and the merge record only: tableOf), held back from every other caller.
// - shared: every seat should have it: staged, one glob pathspec per row the desk holds a file of.
// In a glob, `*` is any name within one folder, as git's glob pathspec reads it, and `**` any
// depth (seat rows only, which never reach git).
const SEAT = [
  [`${VIEWS}/**`, "render_view's pages (.html) and their saved sentences (.prose.json): one seat's mail senders and subjects, chat text and CRM rows, and the model's gists of its mail"],
  [".obsidian/**", "render_view's Obsidian settings at the desk folder (app, appearance, graph, snippets/hide-model.css), fixed text as written; Obsidian rewrites this folder with the seat's own state (workspace.json the pages open, graph.json its search), so it can hold desk content, and render_view writes any one missing on each seat's own first render"],
  ["celorus/.obsidian/workspace*.json", "Obsidian's record of the panes and pages the seat has open"],
  // The vault's own settings, each by what Obsidian lets a seat write into it (R70 pin 5: a file
  // that can hold desk content is seat-only). install-desk and update_desk write each one missing
  // on every seat, so none needs the desk's history to arrive.
  ["celorus/.obsidian/graph.json", "the graph's search and its colour groups' queries, which the seat types: a query can name a family, a person or a page"],
  ["celorus/.obsidian/bookmarks.json", "the seat's bookmarks: saved searches whose queries it types, and the pages and headings it bookmarks, by name"],
  ["celorus/.obsidian/app.json", "Obsidian's app settings: beside the fixed link settings, the folder for new pages and the excluded files, typed by the seat, which can name any page"],
  ["celorus/.obsidian/appearance.json", "the seat's theme, fonts and the snippets it switches on, by the names it gives them"],
  ["celorus/.obsidian/snippets/**", "CSS the seat writes, any text in its comments"],
  [".celorus/**", "the seat's scratch, which may be deleted at any time. Deleting it also deletes this seat's snapshot key, and snapshots taken before then can no longer be checked. (install-desk)"],
  ["**/.DS_Store", "the Finder's record of how this machine shows a folder"],
];
const OVERNIGHT_ROWS = [...OVERNIGHT.map((folder) => [`${folder}/*`, "the family, person and firm pages: merge_pages and undo_merge change them; the overnight commits them"]), ["celorus/merge-record.md", "overnight_reconcile's record of the conversations it merged: the overnight commits it"]];
const SHARED = [
  [".gitignore", "the desk's ignore lines: update_desk adds each one it lacks"],
  ["celorus/desk.md", "the desk's stamps: check_desk (record: true), update_desk"],
  ["celorus/log.md", "the desk's history: a line from every tool that writes"],
  ["celorus/desk-log.md", "log_action's rows; update_desk"], ["celorus/scheduled.md", "register_routine's register of the routines set up for the desk"],
  ...["index", "motion-spec", "register", "marks"].map((name) => [`celorus/${name}.md`, "a page of the layout: update_desk"]),
  ["celorus/queues/*.md", "the queues: add_follow_up (follow-ups.md), assign_lead (supplied.md), update_desk (book.md)"],
  ["celorus/conversations/*.md", "write_conversation's pages; update_desk moves layout 1's calls here"],
  ["celorus/briefs/*.md", "write_brief's pages"],
  ["celorus/soul.md", "scaffold_desk: the assistant's soul"],
  ["celorus/manner/*.md", "soul_feedback: each seat's manner"],
  ["celorus/views/*.md", "render_views' views and who_can_introduce's path pages, drawn again by merge_pages, undo_merge and update_desk: drawn from the shared pages alone, the same on every seat"],
  ["celorus/merges/*/merge.md", "merge_pages' record; undo_merge marks it undone"],
  ["celorus/merges/*/before/*/*.md", "merge_pages' copies of the pages as they were"],
  ["celorus/merges/*/after/*/*.md", "merge_pages' copies of the pages as it left them"],
  ["celorus/model/*.md", "update_desk: the plugin's model pages"],
  ...["context", "rules", "seats", "today"].map((folder) => [`celorus/${folder}/*.md`, "pages of the layout: update_desk"]),
  ...["research", "sent", "drafts", "reviews", "learnings", "learnings/themes"].map((folder) => [
    `celorus/${folder}/*.md`,
    "the layout's folders, which update_desk makes and the workday skills fill with pages of the model's kinds",
  ]),
  ["celorus/crm/README.md", "update_desk: what the CRM export is (the export itself holds CRM rows, and no row names it)"],
  ["celorus/.obsidian/core-plugins.json", "update_desk: which of Obsidian's own plugins are on, install-desk/obsidian.md's fixed text; Obsidian writes only a plugin's id and true or false here, so it holds no desk content"],
  ...["today", "conversations", "briefs", "research", "sent", "learnings", "learnings/themes", "drafts", "reviews", "context/brand", "signals/inbox", "merges", "views"].map(
    (folder) => [`celorus/${folder}/.gitkeep`, "update_desk: an empty folder of the scaffold"],
  ),
];

// A glob as a pattern over a path from the desk folder. Only the forms the table uses are read.
function globPattern(glob) {
  if (!/^[A-Za-z0-9._/*-]+$/u.test(glob)) throw new Error(`desk_sync's table holds a glob it cannot read: ${glob}`);
  let src = "";
  let at = 0;
  if (glob.startsWith("**/")) {
    src += "(?:[^/]*/)*";
    at = 3;
  }
  const deep = glob.endsWith("/**");
  const end = deep ? glob.length - 3 : glob.length;
  for (; at < end; at += 1) {
    const ch = glob[at];
    if (ch === "*") src += "[^/]*";
    else if (ch === ".") src += "\\.";
    else src += ch;
  }
  if (deep) src += "/.*";
  return new RegExp(`^${src}$`, "u");
}

const TABLE = [
  ...SEAT.map(([glob, holds]) => ({ glob, cls: "seat", holds })),
  ...OVERNIGHT_ROWS.map(([glob, holds]) => ({ glob, cls: "overnight", holds })),
  ...SHARED.map(([glob, holds]) => ({ glob, cls: "shared", holds })),
].map((row) => ({ ...row, pattern: globPattern(row.glob) }));

// The row a path from the desk folder falls in, or null when no row names it.
function rowOf(rel) {
  return TABLE.find((row) => row.pattern.test(rel)) || null;
}

// Every entry under the desk folder but its own .git, by path from the desk folder: each plain
// file, and each entry that is neither a plain file nor a folder (a link, a pipe). Entries are
// looked at (lstat), never followed or read.
function entries(root) {
  const files = [];
  const odd = [];
  const walk = (rel) => {
    let names;
    try {
      names = fs.readdirSync(path.join(root, ...rel)).sort();
    } catch (err) {
      throw new Refusal(
        `${rel.length ? rel.join("/") : "The desk folder"} cannot be looked in (${err.code || "an error"}), so desk_sync cannot tell what on the desk is shared. ${NOTHING}`,
      );
    }
    for (const name of names) {
      if (rel.length === 0 && name === ".git") continue;
      const here = [...rel, name];
      const st = fs.lstatSync(path.join(root, ...here));
      if (st.isDirectory()) walk(here);
      else if (st.isFile()) files.push(here.join("/"));
      else odd.push(here.join("/"));
    }
  };
  walk([]);
  return { files, odd };
}

// Each path in `rels`, or the highest folder above it that holds no file the table names, once.
function shortest(rels, named) {
  const holding = new Set();
  for (const rel of named) {
    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i += 1) holding.add(parts.slice(0, i).join("/"));
  }
  const out = new Set();
  for (const rel of rels) {
    const parts = rel.split("/");
    let shown = rel;
    for (let i = 1; i < parts.length; i += 1) {
      const folder = parts.slice(0, i).join("/");
      if (!holding.has(folder)) {
        shown = `${folder}/`;
        break;
      }
    }
    out.add(shown);
  }
  return [...out].sort();
}

// One character of a .gitignore line as itself in a pattern (by its code point, so no character
// is read as a pattern's own syntax).
const itself = (ch) => (/^\w$/u.test(ch) ? ch : `\\u{${ch.codePointAt(0).toString(16)}}`);

// A line of a .gitignore as a pattern over a path from that file's folder (0.19.0 K1c), as git
// reads it: `#` starts a comment, `!` turns the line round, a trailing `/` takes folders alone, a
// line with a `/` before its end is anchored to the file's folder and one without matches at any
// depth, `*` and `?` stay within one folder, `**` crosses them, and a backslash takes the next
// character as it is. One form git reads is not read here: a character class (an opening square
// bracket, a set, a closing one) is read as those characters themselves, so a line holding one
// ignores less here than in git; a row whose every file only such a line ignores makes the stage
// fail, as the stage's why says. Null for a line that holds no pattern.
function ignoreLine(raw) {
  let line = raw.replace(/\r$/u, "");
  while (line.endsWith(" ") && !line.endsWith("\\ ")) line = line.slice(0, -1);
  if (line === "" || line.startsWith("#")) return null;
  const negate = line.startsWith("!");
  if (negate) line = line.slice(1);
  const folderOnly = line.endsWith("/");
  if (folderOnly) line = line.slice(0, -1);
  if (line === "") return null;
  const anchored = line.includes("/");
  if (line.startsWith("/")) line = line.slice(1);
  let src = anchored ? "" : "(?:.*/)?";
  for (let at = 0; at < line.length; at += 1) {
    const ch = line[at];
    if (ch === "*" && line[at + 1] === "*" && (at === 0 || line[at - 1] === "/") && (at + 2 === line.length || line[at + 2] === "/")) {
      if (at + 2 === line.length) src += ".*";
      else src += "(?:.*/)?";
      at += 2;
    } else if (ch === "*") src += "[^/]*";
    else if (ch === "?") src += "[^/]";
    else if (ch === "\\" && at + 1 < line.length) {
      at += 1;
      src += itself(line[at]);
    } else src += itself(ch);
  }
  let pattern;
  try {
    pattern = new RegExp(`^${src}$`, "u");
  } catch {
    return null;
  }
  return { pattern, negate, folderOnly };
}

// The desk's own ignore rules: each .gitignore file among the desk's plain files, by the folder
// it sits in. desk_sync reads no rule of .git/info/exclude or of git's own excludes file.
function ignoreRules(root, files) {
  const rules = new Map();
  for (const rel of files) {
    if (rel !== ".gitignore" && !rel.endsWith("/.gitignore")) continue;
    const folder = rel === ".gitignore" ? "" : rel.slice(0, -"/.gitignore".length);
    const file = path.join(root, ...rel.split("/"));
    if (!fs.lstatSync(file).isFile()) continue;
    const text = fs.readFileSync(file, "utf8");
    rules.set(folder, text.split("\n").map(ignoreLine).filter(Boolean));
  }
  return rules;
}

// What of `rel` the rules ignore, as git decides it: each folder above it, then the file (a
// folder git ignores takes everything under it, and a line cannot take a file back out of it);
// the deepest .gitignore that has a matching line decides, and in it the last such line. The
// folder ("x/y/") or the file ignored, or null.
function ignoredBy(rules, rel) {
  const parts = rel.split("/");
  for (let i = 1; i <= parts.length; i += 1) {
    const sub = parts.slice(0, i).join("/");
    const folder = i < parts.length;
    const holders = [...rules.keys()].filter((at) => at === "" || sub.startsWith(`${at}/`)).sort((a, b) => b.length - a.length);
    for (const at of holders) {
      const here = at === "" ? sub : sub.slice(at.length + 1);
      const lines = rules.get(at);
      const hit = [...lines].reverse().find((line) => (folder || !line.folderOnly) && line.pattern.test(here));
      if (hit) {
        if (!hit.negate) return folder ? `${sub}/` : sub;
        break;
      }
    }
  }
  return null;
}

// What the desk holds, by the table: the shared rows it holds a file of, the seat rows with how
// many files each, and what no row names. An entry that is not a plain file where a shared row
// reaches is refused: git would commit a link as the path it leads to, or stop on a pipe. A
// shared file the desk's own .gitignore ignores does not bring its row in (0.19.0 K1c): a
// pathspec that matches only ignored files makes git stop the stage. Where another file of its
// row brings the row in, it is named under ignored: git stages it only when the desk already
// tracks it. Where every file of its row is ignored, no pathspec names the row, so none of its
// files is committed, a tracked one's change included: it is named under not_committed (0.19.0
// K1d; K1c named both as ignored, as if git staged the tracked ones).
function sorted(root, overnight = false) {
  const { files, odd } = entries(root);
  const rules = ignoreRules(root, files);
  for (const rel of odd) {
    const reached = tableOf(overnight).some((row) => (row.cls === "shared" || (overnight && row.cls === "overnight")) && (row.pattern.test(rel) || row.glob.startsWith(`${rel}/`)));
    if (reached) {
      throw new Refusal(
        `${rel} is a link or not a plain file, where desk_sync stages what every seat shares: git would commit it as a link or stop on it. ` +
          `Make it a plain file or folder there, or move it away. ${NOTHING}`,
      );
    }
  }
  const shared = new Set();
  const seat = new Map();
  const named = [];
  const unnamed = [...odd];
  const ignored = [];
  for (const rel of files) {
    const row = tableOf(overnight).find((one) => one.pattern.test(rel)) || null;
    if (row === null) {
      unnamed.push(rel);
      continue;
    }
    named.push(rel);
    if (row.cls === "shared" || (overnight && row.cls === "overnight")) {
      const by = ignoredBy(rules, rel);
      if (by === null) shared.add(row.glob);
      else ignored.push([by, row.glob]);
    } else if (row.cls === "seat") seat.set(row.glob, (seat.get(row.glob) || 0) + 1);
  }
  const namedIn = (inRow) => [...new Set(ignored.filter(([, glob]) => shared.has(glob) === inRow).map(([by]) => by))].sort();
  return {
    shared: tableOf(overnight).filter((row) => shared.has(row.glob)).map((row) => row.glob),
    seat: TABLE.filter((row) => seat.has(row.glob)).map((row) => ({ path: row.glob, files: seat.get(row.glob), holds: row.holds })),
    unclassified: [...new Set([...shortest(unnamed, named), ...holesIn(tableOf(overnight).filter((row) => shared.has(row.glob)), files, odd)])].sort(),
    ignored: namedIn(true),
    notCommitted: namedIn(false), holes: holesIn(tableOf(overnight).filter((row) => shared.has(row.glob)), files, odd),
  };
}

// How the shared rows the desk holds become the pathspecs the stage, the staged check and the
// commit name: this is desk_sync's guard. One object, so the ignore line's own test
// (desk_engine/sync.test.js) can take the guard out of the engine and stage everything, and see
// the ignore line hold alone; the engine never changes it.
const staging = {
  pathspecs(shared) {
    return shared.map((glob) => `:(glob)${glob}`);
  },
};

// One word of a shell line: bare when it holds nothing a shell reads, else in single quotes.
// "=" is not bare: zsh reads a word that starts with it as the path of a command.
function quoted(word) {
  return /^[A-Za-z0-9_@%+:,./-]+$/u.test(word) ? word : `'${word.split("'").join("'\\''")}'`;
}

// One command. `exits`, when there is one, names the exits that are not a failure, each with
// what to do next; `stops`, when there is one, names the exits that end the run there, each with
// what to tell the person; any other exit is a failure. `fills`, when there is one (0.19.0 K1f),
// names each word in braces the command's argv or its words hold, and the earlier step whose printed line
// fills it (with `after` taken off the line's start): git's own answer at run time, never a
// value the engine reads.
function command(step, argv, why, exits = null, stops = null, fills = null) {
  return { step, argv, shell: argv.map(quoted).join(" "), why, exits, stops, fills };
}

// The words in braces the push's commands hold, each filled from the line an earlier step printed
// (0.19.0 K1f, the base's rulings R84 and R86): the branch as the branch check prints it, and the
// branch's upstream as the desk's config holds it (branch.<the branch>.remote and .merge).
const BRANCH = "{branch}";
const REMOTE = "{remote}";
const MERGE = "{merge}";
const FILL_BRANCH = { [BRANCH]: { from: "on a branch", after: "refs/heads/" } };
const FILL_UPSTREAM = { [REMOTE]: { from: "upstream remote", after: "" }, [MERGE]: { from: "upstream branch", after: "" } };
// The same-repository check (0.19.0 K1g, the base's ruling R88; K1i, R92; K1j, R96 and R100) is
// fail closed. It reads every url git would use: the one the fetch (and the pull, itself a fetch)
// takes, and the ones the push takes, each as git prints it with insteadOf and pushInsteadOf
// applied. Each url ends one of three ways: it leads to this repository (stop); the check cannot
// tell with certainty where it leads (stop); or it leads to another repository, or is a network
// url whose host is another machine (go on). The run goes on only when every url does. A url is
// read by git itself, never by the engine: git's own value match classes its form, git's own path
// expansion expands it, git's own answer at each place git looks for a repository at that path
// says whether one is there (K1j: git rev-parse --resolve-git-dir, which reads a git folder and a
// .git file naming one, as git does), exactly one place must answer, and the folder git names for
// it, as the disk names it, is compared with this repository's, by git. The stop words name the
// url's form and never the url, a path, or the push's urls (R96 (e)).
//
// No state goes through a config (R96 (d)). Every check reads only what an earlier step of this
// run printed, set on its own command line after anything a config file sets:
// - a pick prints the value when it matches a pattern git's value match reads, else an empty line
//   (the empty value the pick sets first always matches): the last value set that matches, and
//   git reads values in order, a command line's last, so no value a config sets is ever printed;
// - a read takes a pick's line as the default of a key read from no file (--file= names none) as
//   true or false: git prints false and exits 0 when the line is empty, and exits 128 when it is
//   not, since no url with false after it is true or false;
// - a match (git's colour setting of a key the check names, set on its own command line to never
//   and then to always under the names it compares) exits 0 when the two names are one and 1 when
//   they are not; a value a config sets for the same key is read first, and the check's own last.
// A value a config sets can make git fail on a key the check reads (one that is not a colour
// setting), and every such failure is a stop: no config makes the run go on.
//
// The forms the check follows to a folder (R92 (b)), each as a pattern git's value match reads
// (POSIX extended); a url of no form below, and a network url whose host is this machine, stops:
// - an absolute path;
// - a path from the desk folder, the folder git's commands run in;
// - ~/ and a path, for the home folder;
// - a file: url whose host is empty or localhost, then an absolute path.
// A path holds no ":" (git reads a word with a ":" before its first "/" as a host) and no "="
// (git takes a -c setting's name up to its first "=", and the check sets a url and a folder in
// names); a file: url holds no "%" (git decodes it, and the check does not). A path may end in "/"
// (R100 (2)): git takes the "/" off before it looks at <path>.git, the check cannot, so for such
// a path it looks only at <path>/.git and <path>, and where git would reach <path>.git the check
// finds nothing there and stops. So ~user, the ext:: and fd:: transports, any other ::, a file:
// url with another host, and any other form stop. Each character of a url the check reads is
// printable ASCII, from space to ~, each class a range of that span without the characters named:
// a control character, and any character past ASCII, stops.
const LOCAL_CHAR = "[ -9;<>-~]";
const ABSOLUTE_PATH = `/${LOCAL_CHAR}*`;
const RELATIVE_PATH = `[ -$&-.0-9;<>-}]${LOCAL_CHAR}*`;
const HOME_PATH = `~/${LOCAL_CHAR}*`;
const FILE_URL = "file://(localhost)?/[ -$&-9;<>-~]*";
// A network url: a scheme git reaches another machine by, or host:path (git's ssh form), whose host
// is a name (its last label starts with a letter) or four decimal numbers of an IPv4 address that
// is not 127.x.x.x or 0.x.x.x. Its host is not resolved: a name that leads to this machine (one the
// hosts file maps to 127.0.0.1, say) goes on, a limit of the check, not a claim.
const NETWORK_SCHEME = "(ssh|git|https?|ftps?|git\\+ssh|ssh\\+git)";
const NETWORK_USER = "([A-Za-z0-9._~+-]+@)?";
const HOST_NAME = "([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\\.)*[A-Za-z]([A-Za-z0-9-]*[A-Za-z0-9])?\\.?";
const OCTET = "(0|[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-5])";
const FIRST_OCTET = "([1-9]|[1-9][0-9]|1[01][0-9]|12[0-689]|1[3-9][0-9]|2[0-4][0-9]|25[0-5])";
const HOST = `(${HOST_NAME}|${FIRST_OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET})`;
const SCHEME_URL = `${NETWORK_SCHEME}://${NETWORK_USER}${HOST}(:[0-9]+)?/[ -<>-~]*`;
const SSH_PATH = `${NETWORK_USER}${HOST}:([ -.0-9;<>-~]|/[ -.0-<>-~])[ -<>-~]*`;
const URL_FORM = `^(${ABSOLUTE_PATH}|${RELATIVE_PATH}|${HOME_PATH}|${FILE_URL}|${SCHEME_URL}|${SSH_PATH})$`;
const NETWORK_FORM = `^(${SCHEME_URL}|${SSH_PATH})$`;
// A network url whose host is this machine by a loopback name or address: localhost (any case, a
// name under it too), an IPv4 address that starts 127 or 0 (in any of the ways an address can be
// written). Git would reach this machine over the network, which the check cannot follow to a
// folder: it stops. An IPv6 address, ::1 among them, is of no form the check reads: it stops there.
const LOOPBACK_HOST = "(([^/@:]*\\.)?[Ll][Oo][Cc][Aa][Ll][Hh][Oo][Ss][Tt]\\.?|(127|0[0-9A-Fa-fXx]*)(\\.[0-9A-Fa-fXx]*)*)";
const LOOPBACK_FORM = `^(${NETWORK_SCHEME}://([^/@]*@)?${LOOPBACK_HOST}(:[0-9]*)?(/|$)|([^/@]*@)?${LOOPBACK_HOST}:)`;
// The rewrite the check adds on its own command line alone, to read a file: url's path: git's own
// insteadOf and pushInsteadOf, from each prefix below to /. No config file holds it.
const FILE_OFF_FETCH = ["-c", "url./.insteadOf=file:///", "-c", "url./.insteadOf=file://localhost/"];
const FILE_OFF_PUSH = [...FILE_OFF_FETCH, "-c", "url./.pushInsteadOf=file:///", "-c", "url./.pushInsteadOf=file://localhost/"];
// A remote's name the words may say (R96 (e)): a plain word; any other is the upstream's remote.
const PLAIN_NAME = "^[A-Za-z0-9._][A-Za-z0-9._-]*$";
const UNNAMED = "the upstream's remote";
// What a path whose last character is "/" is read as for the places git looks at <path>.git
// (see the forms above): a path under the git folder's HEAD file, where git reads no repository.
const NO_PLACE = ".git/HEAD/";

// The words the check holds, each filled from the line a step printed: this repository's git
// folder, as git finds it and as the disk names it; the remote's name for the words; the push's
// urls, all and the first; and, for each of the two urls, what each of its checks prints.
const HERE_AT = "{here_at}";
const HERE = "{here}";
const HERE_PICK = "{here_pick}";
const REMOTE_NAME = "{remote_name}";
const PUSH_URLS = "{push_urls}";
const PUSH_MANY = "{push_many}";
const printedBy = (step) => ({ from: step, after: "" });
const FILL_NAMED = { [REMOTE_NAME]: printedBy("remote name") };
// Each url's words: the url, then its loopback pick, its form pick, the url again where it is a
// network url (empty where it is not), the url with file: taken off, that with ~/ expanded, that
// again where it does not end in / (NO_PLACE where it does), the git folder git reads at each of
// the four places it looks (each empty where it reads none), the folder git names for the one,
// that folder as the disk names it, whether it is this repository's (true or false), and that
// again where it is (empty where it is not).
const CHAINS = {
  fetch: { url: "{url}", key: "url", name: "fetch" },
  push: { url: "{push_url}", key: "push", name: "push" },
};
// Every word the url checks fill, as the summary names them (a literal, so a reader proves it;
// sync.test.js pins it against the words urlChecks names).
const URL_WORDS =
  "{url}, {url_loopback}, {url_off}, {url_net}, {url_raw}, {url_path}, {url_whole}, {url_a}, {url_b}, {url_c}, {url_d}, " +
  "{url_git}, {url_common}, {url_same}, {url_this}, {push_url}, {push_loopback}, {push_off}, {push_net}, {push_raw}, " +
  "{push_path}, {push_whole}, {push_a}, {push_b}, {push_c}, {push_d}, {push_git}, {push_common}, {push_same}, {push_this}";
// The one key a pick and a read name, set on the command line alone.
const PICK_KEY = "desk-sync..pick";

// A pick: git prints `word` where it matches `pattern`, else an empty line (see the head of this
// section); it fills `fill`.
function pick(git, step, word, pattern, sentinel, why, fill, fills) {
  return command(
    step,
    [...git, "-c", `${PICK_KEY}=${sentinel}`, "-c", `${PICK_KEY}=${word}`, "config", "--get", PICK_KEY, pattern],
    `${why} Exits 0: git prints it.`,
    { 0: `the line git printed fills ${fill}; go on` },
    null,
    fills,
  );
}

// A read: exits 0 where the pick's line (`picked`) is empty, 128 where it is not (see the head of
// this section).
function read(git, step, picked, from, why, stop, fills) {
  return command(
    step,
    [...git, "config", "--file=", "--type=bool", `--default=${picked}false`, "--get", PICK_KEY],
    `${why} Exits 0 when ${picked} is empty: git prints false; go on. Exits 128 when it is not: the run stops here.`,
    { 0: `${picked} is empty: go on` },
    { 128: stop },
    { ...fills, [picked]: printedBy(from) },
  );
}

// A place git looks for a repository at the path a url names: git's own answer whether it reads
// one there, a git folder or a .git file naming one; the git folder fills `word`.
function place(git, step, at, name, word, fills) {
  return command(
    `${step} at ${name}`,
    [...git, "rev-parse", "--resolve-git-dir", at],
    `Print the git folder git reads at ${name}, from the desk folder, as git reads one there: a git folder, or a .git file ` +
      "that names one. Exits 0 when git reads one: git prints it. Exits 128 when it does not: git prints nothing.",
    { 0: `git reads a repository at ${name}, the git folder it printed: it fills ${word}; go on`, 128: `git reads no repository at ${name}: ${word} is empty; go on` },
    null,
    fills,
  );
}

// The check's commands for one url, from its form to whether it leads to this repository. Each
// argument is a word or words of text, never an object (a reader of this file follows text
// through a call): the step's name, the words that name the url's use, the url's word, the key of
// the words it fills ({<key>_net} and the rest), the name of its keys, the command that prints the
// url with file: taken off, and the stops' words.
function urlChecks(git, step, use, url, key, name, printUrl, loopbackStop, formStop, rewrittenStop, placesStop, sameStop, unfoundStop, unreadStop) {
  const loopback = `{${key}_loopback}`;
  const off = `{${key}_off}`;
  const net = `{${key}_net}`;
  const raw = `{${key}_raw}`;
  const followed = `{${key}_path}`;
  const whole = `{${key}_whole}`;
  const atGit = `{${key}_a}`;
  const atPath = `{${key}_b}`;
  const atDotGitGit = `{${key}_c}`;
  const atDotGit = `{${key}_d}`;
  const found = `{${key}_git}`;
  const common = `{${key}_common}`;
  const same = `{${key}_same}`;
  const sameRead = `{${key}_this}`;
  const urlFill = { [url]: printedBy(step) };
  const tail = { ...FILL_BRANCH, ...FILL_NAMED };
  const places = [atGit, atPath, atDotGitGit, atDotGit];
  const placeFills = {
    [atGit]: printedBy(`${step} at <path>/.git`),
    [atPath]: printedBy(`${step} at <path>`),
    [atDotGitGit]: printedBy(`${step} at <path>.git/.git`),
    [atDotGit]: printedBy(`${step} at <path>.git`),
  };
  // The one check: its key names no word, and each name it sets is the found places and the
  // network url but one; the last set, all five, is never where exactly one is found.
  const five = [...places, net];
  const oneKey = `desk-sync..${name}-one`;
  const sameKey = (at) => `desk-sync.${at}.${name}-same`;
  const rawKey = (at) => `desk-sync.${at}.${name}-raw`;
  const foundKey = `desk-sync..${name}-found`;
  return [
    pick(
      git,
      `${step} loopback picked`,
      url,
      `${LOOPBACK_FORM}|^$`,
      "",
      `Print ${url}, the url git would use for ${use}, where it is a network url whose host is this machine by a loopback ` +
        "name or address, else an empty line.",
      loopback,
      urlFill,
    ),
    read(git, `${step} loopback`, loopback, `${step} loopback picked`, `Read whether ${url} names a loopback host.`, loopbackStop, tail),
    pick(
      git,
      `${step} form picked`,
      url,
      `!${URL_FORM}`,
      "",
      `Print ${url} where it is of no form the check reads (an absolute path, a path from the desk folder, ~/ and a path, a ` +
        "file: url whose host is empty or localhost, or a network url whose host is another machine), else an empty line.",
      off,
      urlFill,
    ),
    read(git, `${step} form`, off, `${step} form picked`, `Read whether ${url} is of a form the check reads.`, formStop, tail),
    pick(
      git,
      `${step} on another machine`,
      url,
      `${NETWORK_FORM}|^$`,
      "",
      `Print ${url} where it is a network url whose host is another machine, else an empty line.`,
      net,
      urlFill,
    ),
    command(
      `${step} without file:`,
      [...git, ...printUrl],
      `Print the url of ${REMOTE} git would use for ${use} again, with a file: url whose host is empty or localhost ` +
        "read as its path. Exits 0: git prints it.",
      { 0: `the url with file: taken off, the one git printed: it fills ${raw}; go on` },
      null,
      { [REMOTE]: FILL_UPSTREAM[REMOTE] },
    ),
    command(
      `${step} rewritten`,
      [
        ...git,
        "-c",
        `${rawKey(url)}=never`,
        "-c",
        `${rawKey(raw)}=always`,
        "-c",
        `${rawKey(`file://${raw}`)}=always`,
        "-c",
        `${rawKey(`file://localhost${raw}`)}=always`,
        "config",
        "--get-colorbool",
        rawKey(url),
      ],
      `Read whether ${url} is ${raw}, or ${raw} with file:// or file://localhost before it: so the path the check ` +
        "follows is the one git would. Exits 0 when it is: go on. Exits 1 when it is not (a url rewrite of the desk's " +
        "config matches the url as well): the run stops here. Exits 128 when git cannot read the names: the run stops here.",
      { 0: `${raw} is the path of ${url}: go on` },
      { 1: rewrittenStop, 128: unreadStop },
      { ...tail, ...urlFill, [raw]: printedBy(`${step} without file:`) },
    ),
    command(
      `${step} expanded`,
      [...git, "config", "--file=", "--type=path", `--default=${raw}`, "--get", "desk-sync..path"],
      `Print ${raw} with ~/ at its start read as the home folder, as git reads a path. Exits 0: git prints it.`,
      { 0: `the path git would follow, the one git printed: it fills ${followed}; go on` },
      null,
      { [raw]: printedBy(`${step} without file:`) },
    ),
    pick(
      git,
      `${step} whole`,
      followed,
      `[^/]$|^\\.git/HEAD/$`,
      NO_PLACE,
      `Print ${followed} where it does not end in /, else ${NO_PLACE}, a path where git reads no repository.`,
      whole,
      { [followed]: printedBy(`${step} expanded`) },
    ),
    place(git, step, `${followed}/.git`, "<path>/.git", atGit, { [followed]: printedBy(`${step} expanded`) }),
    place(git, step, followed, "<path>", atPath, { [followed]: printedBy(`${step} expanded`) }),
    place(git, step, `${whole}.git/.git`, "<path>.git/.git", atDotGitGit, { [whole]: printedBy(`${step} whole`) }),
    place(git, step, `${whole}.git`, "<path>.git", atDotGit, { [whole]: printedBy(`${step} whole`) }),
    command(
      `${step} one repository`,
      [
        ...git,
        "-c",
        `${oneKey}=never`,
        ...five.flatMap((_, i) => ["-c", `desk-sync.${five.filter((__, j) => j !== i).join("")}.${name}-one=always`]),
        "-c",
        `desk-sync.${five.join("")}.${name}-one=never`,
        "config",
        "--get-colorbool",
        oneKey,
      ],
      `Read whether exactly one of ${five.join(", ")} holds a line: git reads a repository at exactly one of the places ` +
        `it looks at the path ${url} names, or ${url} is a network url on another machine. Exits 0 when exactly one ` +
        "does: go on. Exits 1 when none does, or more than one: the run stops here. Exits 128 when git cannot read the " +
        "names: the run stops here.",
      { 0: `exactly one of the places, or the network url, holds a line: go on` },
      { 1: placesStop, 128: unreadStop },
      { ...tail, ...placeFills, [net]: printedBy(`${step} on another machine`) },
    ),
    command(
      `${step} git folder`,
      [...git, "-C", `${atGit}${atPath}${atDotGitGit}${atDotGit}`, "--git-dir=.", "rev-parse", "--path-format=absolute", "--git-common-dir"],
      `Print the git folder of the repository at the one place git reads one (${atGit}${atPath}${atDotGitGit}${atDotGit}, the four joined, is ` +
        "that place's git folder), a worktree's being its repository's. Exits 0 when git reads it: git prints it. Exits " +
        "128 when it does not, or no place holds one: git prints nothing, and the check after the next decides.",
      { 0: `the git folder git printed: it fills ${found}; go on`, 128: `git reads no git folder there: ${found} is empty; go on` },
      null,
      placeFills,
    ),
    command(
      `${step} as the disk names it`,
      [...git, "-C", found, "--git-dir=.", "rev-parse", "--path-format=absolute", "--git-dir"],
      `Print ${found} as the disk names it, from inside it (a disk that ignores case reads a path in any case). Exits 0 ` +
        "when git reads it: git prints it. Exits 128 when it does not: git prints nothing.",
      { 0: `the git folder as the disk names it, the one git printed: it fills ${common}; go on`, 128: `git reads no git folder there: ${common} is empty; go on` },
      null,
      { [found]: printedBy(`${step} git folder`) },
    ),
    // The match prints true or false (git's colour setting read for output that is not a
    // terminal), so its one stop is where git cannot read the names; a pick and a read of its line
    // stop where it is this repository.
    command(
      `${step} matched`,
      [...git, "-c", `${sameKey(HERE)}=never`, "-c", `${sameKey(common)}=always`, "config", "--get-colorbool", sameKey(HERE), "false"],
      `Print whether ${common} is ${HERE}, this repository's git folder: true when it is, false when it is not. Exits 0: ` +
        "git prints it. Exits 128 when git cannot read the names: the run stops here.",
      { 0: `the line git printed fills ${same}; go on` },
      { 128: unreadStop },
      { ...tail, [common]: printedBy(`${step} as the disk names it`), [HERE]: printedBy("this repository as the disk names it") },
    ),
    pick(git, `${step} matched picked`, same, "^true$|^$", "", `Print ${same} where it is true, else an empty line.`, sameRead, {
      [same]: printedBy(`${step} matched`),
    }),
    read(git, `${step} is this repository`, sameRead, `${step} matched picked`, `Read whether ${url} leads to this repository.`, sameStop, tail),
    command(
      `${step} leads somewhere`,
      [...git, "-c", `${foundKey}=always`, "-c", `desk-sync.${common}${net}.${name}-found=never`, "config", "--get-colorbool", foundKey],
      `Read whether ${common} or ${net} holds a line: whether git read the repository the url leads to, or ${url} is a ` +
        "network url on another machine. Exits 0 when one does: the url leads to another repository; go on. Exits 1 when " +
        "neither does: the run stops here. Exits 128 when git cannot read the names: the run stops here.",
      { 0: `${url} leads to another repository: go on` },
      { 1: unfoundStop, 128: unreadStop },
      { ...tail, [common]: printedBy(`${step} as the disk names it`), [net]: printedBy(`${step} on another machine`) },
    ),
  ];
}

// 0.20.0 DESK-119 (R134, R138): a `desk` naming the desk's celorus folder is answered at resolution.
// The other tools take that form (every path they answer extends the desk as given); desk_sync's
// commands run in the desk folder, the folder above the one given, off the desk as the caller named
// it (R102), so it is refused here, before anything is read or answered, naming by last parts only
// (R72) the folder to give instead. A CELORUS_DESK in that form never reaches here: findDesk
// refuses it (lib/desk.js refuseCelorusFolder).
function celorusGiven(shown) {
  const { folder, holder } = shown.celorus;
  return new Refusal(
    `\`desk\` names the folder ${folder}, the desk's celorus folder. desk_sync's commands run in the desk folder, ` +
      `the one holding celorus/: set \`desk\` to the folder that holds that one, ${holder}. ${NOTHING}`,
  );
}

function deskSync(ctx, { seat, message, push, overnight }) {
  if (ctx.shown.celorus) throw celorusGiven(ctx.shown);
  if (typeof message !== "string" || message.trim() === "") {
    throw new Refusal(`message is the commit message, as text: what changed on the desk, in a sentence. ${NOTHING}`);
  }
  const said = screened([["the commit message", message]], undefined, NOTHING);
  if (said) throw new Refusal(said);
  const head = deskMd(ctx.celorus, NOTHING);
  const seats = seatsOf(ctx.celorus, head);
  if (typeof seat !== "string" || !seats.handles.includes(seat)) {
    throw new Refusal(`${JSON.stringify(seat)} is not a seat of this desk: the seats are ${seatsNamed(seats)}. ${NOTHING}`);
  }
  if (push !== undefined && push !== null && typeof push !== "boolean") {
    throw new Refusal(`push is true or false: true only when the person has just asked, in words, for the desk to go up. ${NOTHING}`);
  }
  // The overnight's own commit (the base's ruling on E9's item 8): the overnight skill alone passes
  // it, after its run, and the rows of the table's overnight class are then staged with the shared
  // ones. For every other caller they are held back, and the answer's held_back names them.
  if (overnight !== undefined && overnight !== null && typeof overnight !== "boolean") {
    throw new Refusal(`overnight is true or false: true only when the overnight commits the pages its own run changed. ${NOTHING}`);
  }
  const nightly = overnight === true;
  // The desk must be a git repository of its own: without one, git would work on the
  // repository around the folder. Only the entry is looked at, never read: a .git folder, or a
  // .git file that names the git folder elsewhere (a worktree's or a submodule's), is the desk's
  // own. desk_sync reads nothing inside it (0.19.0 K1e, the base's ruling R78): every command
  // runs with -C the desk, so git finds the git folder behind the entry itself, as
  // `git rev-parse --git-dir` would name it, and git's own answers give the branch and upstream.
  let own = false;
  try {
    fs.lstatSync(path.join(ctx.root, ".git"));
    own = true;
  } catch {
    own = false;
  }
  if (!own) {
    throw new Refusal(
      "This desk folder has no .git of its own, so git would commit to the repository around it, or to none. " +
        `Make the desk folder a git repository first. ${NOTHING}`,
    );
  }
  const desk = sorted(ctx.root, nightly);
  // With no pathspec, git would stage nothing and commit everything staged: never answered.
  if (!desk.shared.length) {
    if (desk.notCommitted.length) {
      throw new Refusal(
        "Every file of a shared row of desk_sync's table on the desk is ignored by its .gitignore, so no command is answered: " +
          "none of them is staged or committed, a change to one the desk already tracks included, and each stays on this " +
          "machine as it is. Committing them is the desk owner's act, never desk_sync's: take the line that ignores them " +
          `out of the .gitignore. ${NOTHING}`,
      );
    }
    throw new Refusal(`The desk holds no file of a shared row of desk_sync's table, so there is nothing to commit. ${NOTHING}`);
  }
  const specs = [...staging.pathspecs(desk.shared), ...desk.holes.map((rel) => `:(exclude,literal)${rel}`)];
  // The folder each command runs in, as the answer names it (R72, lib/desk.js deskShown): the
  // caller's `desk` as written, or, for a desk found from the working folder, the desk folder
  // itself, ".", and the summary says to run the commands from there.
  const git = ["git", "-C", ctx.shown.at("")];
  const asked = push === true;
  const commands = [
    // 0.19.0 K1k (R101 (B)): the seat-pages checks, before anything is staged (seatPages).
    ...seatPages(git, asked),
    command(
      "stage",
      [...git, "add", "--", ...specs],
      (nightly ? "Stage what every seat shares and what the overnight changed (the family, person and firm pages, and the merge record), " : "Stage what every seat shares, ") +
        "the rows of desk_sync's table the desk holds a file of, and nothing else. " +
        (nightly ? "A file in families/, people/ or firms/ that is not a page (.md) is in no row: it is not staged, and unclassified names it. " : "") +
        "A row whose every " +
        "file the desk's own .gitignore files ignore is in no pathspec, so none of its files is staged, a change to one the " +
        "desk already tracks included (not_committed); a file ignored in a row another file brings in is staged only when " +
        "the desk already tracks it (ignored). desk_sync does not read .git/info/exclude or git's own excludes " +
        "file, and reads a line's character class as its own characters, so a row whose every file only those ignore makes " +
        "this command fail.",
    ),
    // A commit with nothing staged fails, and would stop the pull and the push the person
    // asked for: this check says first whether there is anything to commit.
    command(
      "anything staged",
      [...git, "diff", "--cached", "--quiet", "--", ...specs],
      "Exits 0 when nothing is staged: then the commit is skipped, since it has nothing to do, and that is not a failure. " +
        "Exits 1 when the seat's work is staged: then the commit runs.",
      { 0: "nothing is staged: skip the commit and go on", 1: "the seat's work is staged: run the commit" },
    ),
    command(
      "commit",
      [...git, "commit", "-q", "-m", unpathed(message), "--", ...specs],
      "Commit the seat's work, those rows alone, whatever else is staged. The branch check after it says whether the " +
        `commit is on a branch; ${asked ? "the pull and the push send it up when that branch has an upstream" : "it stays on this machine"}.`,
    ),
    // 0.19.0 K1d: on a detached HEAD the commit is on no branch; the answer says so, and stops
    // before a pull, which cannot run there. K1e: this is the only answer to which branch HEAD is
    // on, git's own, with or without push (K1d also read .git/HEAD by a name pattern, and on a
    // branch the pattern missed, desk+1 or a .git file, answered no pull or push at all).
    command(
      "on a branch",
      [...git, "symbolic-ref", "-q", "HEAD"],
      "Exits 0 when HEAD is on a branch, so a commit made is on that branch: git prints the branch (refs/heads/<the branch>): " +
        "go on. Exits 1 when HEAD is detached, on no branch: the run stops here.",
      { 0: "HEAD is on a branch, the one git printed: go on" },
      { 1: detachedStop(asked) },
    ),
  ];
  if (asked) {
    // 0.19.0 K1f (the base's rulings R84 and R86): the sync touches exactly the upstream's remote
    // and nothing else. The upstream is read from the desk's config at run time, the branch's
    // remote and its merge ref, each with git's own answer to which branch HEAD is on; where none
    // is set, the run stops before any remote is contacted. The fetch names that remote and that
    // branch, so a zero exit says the remote holds the branch now, read in this run, and git fetched
    // it (K1l-d, R116 (5): no more; the desk's copy of it may be missing); the pull (itself a fetch,
    // R76; K1l-d, R116 (2), as up to K1l-b) and the push name the same two. K1e
    // fetched every remote the config sets (--all), and read the upstream from the desk's copy,
    // which a fetch of another refspec could leave stale.
    commands.push(
      command(
        "upstream remote",
        [...git, "config", "--get", `branch.${BRANCH}.remote`],
        `Read the remote of the branch's upstream from the desk's own config; ${BRANCH} is the branch the branch check ` +
          "printed. Exits 0 when one is set: git prints it. Exits 1 when none is set: the run stops here, before any " +
          "remote is contacted.",
        { 0: `the branch's upstream names a remote, the one git printed: it fills ${REMOTE}; go on` },
        { 1: noUpstream() },
        FILL_BRANCH,
      ),
      command(
        "upstream branch",
        [...git, "config", "--get", `branch.${BRANCH}.merge`],
        `Read the branch of the upstream's remote from the desk's own config; ${BRANCH} is the branch the branch check ` +
          "printed. Exits 0 when one is set: git prints it (refs/heads/<its name>). Exits 1 when none is set: the run stops " +
          "here, before any remote is contacted.",
        { 0: `the branch's upstream names a branch of that remote, the one git printed: it fills ${MERGE}; go on` },
        { 1: noUpstream() },
        FILL_BRANCH,
      ),
      // 0.19.0 K1g (the base's ruling R88): a word of the upstream that begins with - is read by
      // git as an option wherever a command hands it on without a -- (the pull hands the remote
      // on to its own git command so), so each is refused here, before any command takes it.
      command(
        "remote word",
        [...git, "config", "--get", `branch.${BRANCH}.remote`, "^-"],
        `Read whether the upstream names its remote (${REMOTE}) by a word that begins with -. Exits 1 when it does not: go on. ` +
          "Exits 0 when it does: git prints the word, and the run stops here, before any command takes it.",
        { 1: `${REMOTE} does not begin with -: go on` },
        { 0: remoteWordStop() },
        { ...FILL_BRANCH, ...FILL_UPSTREAM },
      ),
      command(
        "branch word",
        [...git, "config", "--get", `branch.${BRANCH}.merge`, "^-"],
        `Read whether the upstream names its branch (${MERGE}) by a word that begins with -. Exits 1 when it does not: go on. ` +
          "Exits 0 when it does: git prints the word, and the run stops here, before any command takes it.",
        { 1: `${MERGE} does not begin with -: go on` },
        { 0: branchWordStop() },
        { ...FILL_BRANCH, ...FILL_UPSTREAM },
      ),
      // 0.19.0 K1j (R96 (e)): the name the stop words give the upstream's remote, its word where
      // that is a plain word, else "the upstream's remote": never a path or a url in its place.
      pick(
        git,
        "remote name",
        REMOTE,
        `${PLAIN_NAME}|^the upstream.s remote$`,
        UNNAMED,
        `Print ${REMOTE} where it is a plain word (letters, digits, ., _ and -, not first), else ${UNNAMED}.`,
        REMOTE_NAME,
        { ...FILL_BRANCH, [REMOTE]: FILL_UPSTREAM[REMOTE] },
      ),
      // 0.19.0 K1g (R88), K1i (R92), K1j (R96, R100): an upstream inside this repository is refused,
      // fail closed. This repository's git folder, as git finds it and as the disk names it; then
      // the url the fetch would use and the urls the push would, each as git prints it with
      // insteadOf and pushInsteadOf applied, and each url's checks (see urlChecks); nothing is
      // contacted. The push's urls must be one: the check follows one url for the push. The run
      // goes on to the fetch only when every url leads to another repository.
      command(
        "this repository",
        [...git, "rev-parse", "--path-format=absolute", "--git-common-dir"],
        "Print this repository's git folder, as git finds it from the desk folder. Exits 0: git prints it.",
        { 0: `this repository's git folder, the one git printed: it fills ${HERE_AT}; go on` },
      ),
      command(
        "this repository as the disk names it",
        [...git, "-C", HERE_AT, "--git-dir=.", "rev-parse", "--path-format=absolute", "--git-dir"],
        `Print ${HERE_AT} as the disk names it, from inside it. Exits 0: git prints it.`,
        { 0: `this repository's git folder as the disk names it, the one git printed: it fills ${HERE}; go on` },
        null,
        { [HERE_AT]: printedBy("this repository") },
      ),
      pick(
        git,
        "this repository picked",
        HERE,
        "=|^$",
        "",
        `Print ${HERE} where it holds a =, which the check cannot set in a name, else an empty line.`,
        HERE_PICK,
        { [HERE]: printedBy("this repository as the disk names it") },
      ),
      read(git, "this repository read", HERE_PICK, "this repository picked", `Read whether ${HERE} holds a =.`, hereStop(), { ...FILL_BRANCH, ...FILL_NAMED }),
      command(
        "fetch url",
        [...git, "ls-remote", "--get-url", "--", REMOTE],
        `Print the url git would use for the fetch of the upstream's remote (${REMOTE}), with the desk's insteadOf ` +
          "applied; nothing is contacted. Exits 0: git prints it.",
        { 0: `the url the fetch would use, the one git printed: it fills ${CHAINS.fetch.url}; go on` },
        null,
        { [REMOTE]: FILL_UPSTREAM[REMOTE] },
      ),
      ...urlChecks(
        git,
        "fetch url",
        "the fetch (and the pull, itself a fetch)",
        "{url}",
        "url",
        "fetch",
        [...FILE_OFF_FETCH, "ls-remote", "--get-url", "--", REMOTE],
        fetchLoopbackStop(),
        fetchFormStop(),
        fetchRewrittenStop(),
        fetchPlacesStop(),
        fetchSameStop(),
        fetchUnfoundStop(),
        fetchUnreadStop(),
      ),
      command(
        "push urls",
        [...git, "remote", "get-url", "--push", "--all", "--", REMOTE],
        `Print every url git would use for the push of ${REMOTE}, with the desk's pushurl, insteadOf and ` +
          "pushInsteadOf applied, one to a line; nothing is contacted. Exits 0: git prints them. Exits 2 when the desk's " +
          "config sets no remote of that name: the run stops here.",
        { 0: `the urls the push would use, the lines git printed: they fill ${PUSH_URLS}; go on` },
        { 2: pushUnreadStop() },
        { ...FILL_BRANCH, ...FILL_NAMED, [REMOTE]: FILL_UPSTREAM[REMOTE] },
      ),
      command(
        "push url",
        [...git, "remote", "get-url", "--push", "--", REMOTE],
        `Print the first url git would use for the push of ${REMOTE}. Exits 0: git prints it.`,
        { 0: `the first url the push would use, the one git printed: it fills ${CHAINS.push.url}; go on` },
        null,
        { [REMOTE]: FILL_UPSTREAM[REMOTE] },
      ),
      ...urlChecks(
        git,
        "push url",
        "the push",
        "{push_url}",
        "push",
        "push",
        [...FILE_OFF_PUSH, "remote", "get-url", "--push", "--", REMOTE],
        pushLoopbackStop(),
        pushFormStop(),
        pushRewrittenStop(),
        pushPlacesStop(),
        pushSameStop(),
        pushUnfoundStop(),
        pushUnreadUrlStop(),
      ),
      // After the first url's checks, so a url of no form stops at its form (a character that is
      // not printable ASCII is also what a line break is): more than one line is more than one url.
      pick(
        git,
        "push urls picked",
        PUSH_URLS,
        "[^ -~]|^$",
        "",
        `Print ${PUSH_URLS} where it holds more than one line (a character that is not printable ASCII), else an empty line.`,
        PUSH_MANY,
        { [PUSH_URLS]: printedBy("push urls") },
      ),
      read(git, "one push url", PUSH_MANY, "push urls picked", "Read whether the push would use one url alone.", pushManyStop(), { ...FILL_BRANCH, ...FILL_NAMED }),
      command(
        "fetch",
        [...git, "fetch", "-q", "--", REMOTE, MERGE],
        `Fetch the upstream's branch (${MERGE}) from the upstream's remote (${REMOTE}), and from no other remote. Exits 0 ` +
          "when that remote holds that branch: git fetched the upstream's branch, in this run; the fetch leaves the " +
          "desk's own branch, its index and its files as they were. Exits 128 when git could not bring it in: the run " +
          "stops here, before the pull.",
        null,
        { 128: fetchStop() },
        { ...FILL_BRANCH, ...FILL_UPSTREAM },
      ),
      // 0.19.0 K1l-b (R111 (b)): where the push may go elsewhere, the commits the pull would bring
      // in, read on the desk's copy of the upstream's branch, where git names one, before the pull
      // (pullPages).
      ...pullPages(git),
      // 0.19.0 K1l-d (R116 (2)): K1l-b's pull, as it was (K1l-c's rebase onto @{upstream} is
      // reversed: it had no fork point, so an upstream rewritten to take a page out got it back, and
      // under a narrow refspec it had no @{upstream} to rebase onto, so the desk never synced).
      command(
        "pull",
        [...git, "pull", "-q", "--rebase", "--autostash", "--", REMOTE, MERGE],
        "Bring in the other seats' commits first, from the same remote and branch: the pull fetches them again, then " +
          "rebases onto them.",
        null,
        null,
        FILL_UPSTREAM,
      ),
      // 0.19.0 K1l-d (R116 (3)): where the push may go elsewhere, every commit on HEAD, read again
      // after the pull and before the push (pushPages): the pull's own fetch may bring in a commit
      // the upstream gained after the checks before the pull read it.
      ...pushPages(git),
      // 0.19.0 K1l-d (R116 (4)): the push's own words, from git's exit and its words alone. K1l-e
      // (R117 (1)): they say where git's push goes without knowing the arm, never that the upstream's
      // repository moved (where the push goes elsewhere, it did not). 0.20.0 DESK-104: where it goes is
      // the remote's push as git resolves it, never a claim that it is the remote's url as written (a
      // plain insteadOf sends it elsewhere too); DESK-103: the exits claim only that git did not send it, and git's words name the
      // refuser, as pushStop's do (a pre-push hook on this machine exits 1 too).
      command(
        "push",
        [...git, "push", "-q", "--", REMOTE, `HEAD:${MERGE}`],
        "Send the desk up, as the person asked, by the push of the upstream's remote, to where git resolves that " +
          "remote's push. Exits 0 when git sent it. Exits 1 or 128 when git did not send it: the cause is a hook on " +
          "this machine, the remote, or no reach, and git's own words name it only where they say more than that the " +
          "push failed (for one, where the upstream gained a commit " +
          "after the pull fetched it, git refuses the push as not a fast-forward): the run stops here.",
        {
          0: "git sent the desk up, by the push of the upstream's remote, to where git resolves that remote's push",
        },
        { 1: pushStop(), 128: pushStop() },
        { ...FILL_BRANCH, ...FILL_UPSTREAM },
      ),
    );
  }
  return {
    tool: "desk_sync",
    plugin_version: ctx.version,
    // The desk by its own name (desk.md's desk:, or null), never by its folder (round 1 readers, K4).
    desk: head.name,
    seat,
    commands,
    // What only the overnight commits, held back from every other caller: the pages and the merge
    // record. The overnight's own commit stages them, so it holds nothing back.
    held_back: nightly
      ? null
      : command("held back", [...git, "status", "--porcelain", "--", ...HELD_BACK], "Run after the commit: each line is a page held back, to name to the seat."),
    overnight: nightly,
    // 0.19.0 K1c: a pull that fails before it rebases anything leaves no rebase to undo, and git
    // says so with exit 128: that exit is listed. K1f (R84, R86): its words name no cause of their
    // own (K1e said the remote went out of reach, where a file another seat sent up stops the pull
    // too); the pull's own words name it, and either way the commit exists on this machine.
    on_pull_failure: asked
      ? command(
          "undo the pull",
          [...git, "rebase", "--abort"],
          "Run when the pull fails; the push is not run. Exits 0 when it undid the rebase the pull had started, so nothing is " +
            'half applied. Exits 128, with git saying "no rebase in progress", when the pull stopped before it rebased ' +
            "anything, so there is nothing to undo; the pull's own words say why (for one, a file another seat sent up that " +
            "this desk holds untracked, which the rebase would overwrite). Either way a commit this run made exists on this " +
            `machine, on refs/heads/${BRANCH} (the ref the branch check printed), the desk's branch, its index and its files ` +
            "are as they were before the pull, and nothing was pushed: tell the person the pull's words; clearing what they " +
            "name and running desk_sync again is the desk owner's next step. Any other exit, or 128 with other words, is a " +
            "failure: tell the person git's words.",
          {
            0: "the rebase the pull had started is undone: nothing is half applied, and the commit this run made is on its branch as before the pull",
            128: 'git says "no rebase in progress": the pull stopped before it rebased anything, so there is nothing to undo; the pull\'s own words say why',
          },
          null,
          FILL_BRANCH,
        )
      : null,
    push: asked,
    to_stage: desk.shared,
    seat_only: desk.seat,
    unclassified: desk.unclassified,
    ignored: desk.ignored,
    not_committed: desk.notCommitted,
    written: null,
    // Nothing is run when this is answered, so each sentence says what each way the run can end
    // means, and none says what happened (0.19.0 round 1 readers, K1b; the base's ruling R71):
    // what was done, what was not, and whose act comes next (R76).
    summary:
      "Nothing was run: run these commands in order and stop at the first that fails. " +
      (ctx.shown.given ? "" : "Each names the desk folder as ., so run them in the desk folder, the one holding celorus/. ") +
      "A command with exits is the one " +
      "exception: each exit it lists is not a failure, and says what to do next; any other exit is. An exit a command " +
      "lists under stops ends the run there: run nothing more, and tell the person its words. " +
      (asked
        ? `A word in braces (${UNPUSHED}, ${ON_HEAD}, ${ON_HEAD_PICK}, ${UNPUSHED_PICK}, ${BRANCH}, ${REMOTE}, ${MERGE}, ${REMOTE_NAME}, ${HERE_AT}, ${HERE}, ` +
          `${HERE_PICK}, ${PUSH_URLS}, ${PUSH_MANY}, ${PULLED}, ${PULLED_PICK}, ${AFTER_PULL}, ${AFTER_PULL_PICK}, and the url checks' words, ` +
          `${URL_WORDS}) is filled before its command runs, as the command's fills ` +
          "say, from what an earlier command printed (every line of it, without the last line's end): git's own answer, " +
          "never a word the engine read. Fill it in the argv, and in the shell line as one quoted word. @{upstream} is " +
          "git's own name for the branch's upstream, and no word to fill: it stays as written. "
        : "") +
      "How the run can end: " +
      "when a seat-pages check stops it (git's index holds a file under a path the desk's .gitignore keeps a seat's " +
      `own pages at${asked ? ", or a commit the push would send adds, changes or removes one" : ""}), nothing was ` +
      "staged or committed" +
      (asked ? ", pulled or pushed, and taking the pages out of those commits is the desk owner's act (the push's " +
        "range stops at the upstream: a commit the upstream already holds is outside it; where the desk's config sets a " +
        "push url of its own or a push rewrite, the push may go elsewhere, and the range is every commit on HEAD); " : "; ") +
      "when nothing is staged, the commit is skipped and no commit is made" +
      (asked ? ", and the branch check, the upstream checks, the fetch, the pull and the push still run; " : ", and the branch check still runs; ") +
      "when something is staged, the commit is made and holds only the rows under to_stage; " +
      "when HEAD is detached, the branch check stops the run after the commit step: a commit it made is on no branch, " +
      "and putting the desk back on its branch is the desk owner's act" +
      (asked ? ", and nothing is pulled or pushed; " : "; ") +
      (asked
        ? "on a branch, whatever its name and wherever the desk's git folder is, the upstream is read from the desk's " +
          "config, the branch's remote and its merge ref: when none is set, the upstream check stops the run before any " +
          "remote is contacted: nothing is pulled or pushed, a commit made before it stays on this machine, and setting " +
          "an upstream is the desk owner's act; when the upstream's remote or its branch is a word that begins with -, " +
          "the word checks stop the run before any command takes it, and their words do not say it; the url checks then read " +
          "every url git would use, the fetch's and the push's, with insteadOf and pushInsteadOf applied, and stop the " +
          "run unless each leads to another repository: when a url leads to this same repository (its remote is ., or a " +
          "path, a ~/ path or a file: url to this repository's git folder or work tree, however written), and when the " +
          "check could not tell where a url leads (a url of a form it does not read, a network url whose host is this " +
          "machine, a path at which git reads a repository at none, or at more than one, of the places it looks, a url a " +
          "rewrite also matches, or a push to more than one url), the stop's words name the url's form and why, and " +
          "never a url or a path; no remote was contacted, nothing was pulled or pushed, the desk's own branch moved " +
          "only where the commit step made a commit (it exited 0), which stays on this machine, nothing else moved, " +
          "and pointing the branch at a remote is the desk owner's act; " +
          "when every url leads to another repository, the fetch, the pull and the push name that remote and " +
          "that branch, and each goes where git resolves that remote's url for it; when the fetch cannot bring the branch in (the remote holds no " +
          "such branch, or cannot be reached), it stops the run: a commit made exists on this machine, on its branch, " +
          "which moved only where the commit step made one, nothing else moved, and the stop's words give the next step; " +
          "when it brings it in, fetched before or not, and the " +
          "desk's config sets a push url of its own or a push rewrite, the checks before the pull read the commits the " +
          "pull would bring in (@{upstream} --not HEAD, on the desk's copy of the upstream's branch, where git names " +
          "one) and stop the run before the pull where one adds, changes or removes a seat's page, or where git could " +
          "not count them: git fetched the upstream's branch, the desk's own branch moved only by a commit this run's " +
          "commit step made, its other branches and the remote's branches are where they were, nothing was pulled or " +
          "pushed, a commit made stays on this machine, on its branch, and taking the pages out of the upstream's " +
          "branch, or dropping the push url or the push rewrite, is the desk owner's act; otherwise the pull fetches " +
          "the upstream's branch again and rebases the desk onto it, and where the desk's config sets a push url of its " +
          "own or a push rewrite, the checks after the pull read every commit on HEAD again and stop the run before the " +
          "push where one adds, changes or removes a seat's page: the pull moved the desk's own branch, a commit made is " +
          "on it, nothing was pushed, the remote is unchanged, and taking the pages out, or dropping the push url or the " +
          "push rewrite, is the desk owner's act; otherwise the push sends the desk up, as the person asked in words; " +
          "when git does not send it (exit 1 or 128), the push stops the run; the cause is a hook on this machine, the " +
          "remote, or no reach, and git's own words name it only where they say more than that the push failed: " +
          "nothing was pushed, the " +
          "remote is unchanged, a commit made and what the pull brought in are on the desk's own branch, and the next " +
          "step is desk_sync again, never a pull by hand; "
        : "on a branch, a commit made stays on this machine; ") +
      "when a command fails, the commands after it are not run, and what ran before it stands" +
      (asked
        ? " (when the pull fails, run on_pull_failure: it undoes a rebase the pull started, or finds none to undo; either " +
          "way a commit made exists on this machine, on its branch, and the push is not run)."
        : ".") +
      (asked ? "" : " Nothing is pulled or pushed, since the person did not ask for it in words.") +
      " A seat's own pages are in no command, so no run stages them." +
      (desk.unclassified.length
        ? ` ${desk.unclassified.length === 1 ? "One path" : `${desk.unclassified.length} paths`} on the desk ` +
          `${desk.unclassified.length === 1 ? "is" : "are"} in no row of desk_sync's table, so ` +
          `${desk.unclassified.length === 1 ? "it is" : "they are"} not staged: name them to the person (unclassified).`
        : "") +
      (desk.ignored.length
        ? ` ${desk.ignored.length === 1 ? "One path" : `${desk.ignored.length} paths`} of a shared row ` +
          `${desk.ignored.length === 1 ? "is" : "are"} ignored by the desk's .gitignore, in a row the stage names by another ` +
          "file: git stages and commits a change to one the desk already tracks, and never one it does not track: name them " +
          "to the person (ignored)."
        : "") +
      (desk.notCommitted.length
        ? ` ${desk.notCommitted.length === 1 ? "One path" : `${desk.notCommitted.length} paths`} ` +
          `${desk.notCommitted.length === 1 ? "is" : "are"} not committed: the desk's .gitignore ignores every file of ` +
          `${desk.notCommitted.length === 1 ? "its" : "their"} shared row, so no command names the row, and none of ` +
          "them is staged or committed, a change to one the desk already tracks included; each stays on this machine as it " +
          "is. Name them to the person (not_committed): committing them is the desk owner's act, never desk_sync's, by " +
          "taking the line that ignores them out of the .gitignore."
        : ""),
  };
}

// The seat-pages checks (0.19.0 K1k, the base's ruling R101 (B)): before
// anything is staged, the run stops where a seat's own page is in the desk's history or would go
// up with the push. The pages are the paths the ignore writer keeps out of every desk
// (update/update.js GITIGNORE_V2), derived from that one list at each call, never retyped here.
// Up to K1j the check read git's index alone, for celorus/.views alone, and said the folder was "in
// no commit", while the push sends every commit the upstream lacks: a commit that held a seat's
// page went up once the index was cleaned (panel round 2, row 3). Two reads, each git's own answer:
// - the index, with push asked or not: for each pathspec, whether git's index holds a file under
//   it (ls-files --error-unmatch; git needs every pathspec it is given to match, so one each);
// - with push asked, the commits the push would send: rev-list counts the commits of HEAD --not
//   @{upstream} that add, change or remove a file under the pathspecs. Where the branch has no
//   upstream, or HEAD is on no branch, git exits 128 on that range and its count is empty; then
//   the count of every commit on HEAD decides, the commits a first push sends. Where an upstream
//   is set but the desk holds no copy of its branch, git reads HEAD alone (--ignore-missing). A
//   pick and a read make the counts the run's stop.
// Limits, each named in the words: a commit the upstream already holds is outside the range, so a
// page in it is not read (the index check still stops on one git's index tracks); and a commit in
// the range that only removes a page counts too, an over-refusal.
// K1l (the base's ruling R107 (a)): the range stops at the upstream only where the push goes there.
// Where the push may go to a repository of its own, HEAD --not @{upstream} is the range of the
// repository the upstream's copy is read from, and a commit it holds that the push's repository
// lacks is sent unread. There the count of every commit on HEAD decides, the most a push of HEAD
// can send, never a blanket stop. The condition is git's own answer, a config read by exit code, never two urls compared: a push url
// of its own set for a remote (remote.<name>.pushurl, any remote's, since the upstream's remote is
// read only after the stage), or any push rewrite (url.<base>.pushInsteadOf) set. Each is its own
// check, with its own words naming its reason. A pick makes each read exit 1 wherever no commit on
// HEAD changes a seat's page: its line (_0 there, else empty) goes before the key pattern, where
// _0^ matches no key. The limit it adds, named in its words: a page in a commit the push's
// repository already holds is counted too, an over-refusal.
// K1l (R107 (b)): every path is read in any case (git's icase pathspec magic, PAGE_MAGIC), so a
// seat's page under a folder named in another case is read; on a disk that reads case, where the
// .gitignore line does not ignore such a folder, that is an over-refusal, named in the words.
const UNPUSHED = "{unpushed}";
const ON_HEAD = "{on_head}";
const ON_HEAD_PICK = "{on_head_pick}";
const UNPUSHED_PICK = "{unpushed_pick}";
const PAGE_MAGIC = ":(glob,icase)";
// The elsewhere condition's two config keys (K1l, R107 (a)), each a pattern git's --get-regexp
// reads, and what each names; read before the stage and again before the pull (K1l-b, R111 (b)).
const PUSH_URL_KEY = "^remote\\..*\\.pushurl$";
const PUSH_URL_SET = "a push url of its own for a remote (remote.<name>.pushurl)";
const PUSH_REWRITE_KEY = "^url\\..*\\.pushinsteadof$";
const PUSH_REWRITE_SET = "a push rewrite (url.<base>.pushInsteadOf)";

// Each line of the ignore writer's list as git's glob pathspecs that take the files the line
// ignores, as git reads a .gitignore line: a line with no / before its end matches at any depth
// (**/ before it), a line ending in / takes the files under a folder alone (/** after it), and
// any other takes a file of its name and the files under a folder of its name (both). Only the
// forms the list uses are read. Each carries PAGE_MAGIC, glob and icase (K1l, R107 (b)).
function protectedSpecs(lines) {
  return lines.flatMap((line) => {
    if (!/^[A-Za-z0-9._-][A-Za-z0-9._/*-]*$/u.test(line) || line.includes("**")) {
      throw new Error(`desk_sync cannot read the ignore writer's line ${line}`);
    }
    const folder = line.endsWith("/");
    const body = folder ? line.slice(0, -1) : line;
    const at = body.includes("/") ? body : `**/${body}`;
    return folder ? [`${PAGE_MAGIC}${at}/**`] : [`${PAGE_MAGIC}${at}`, `${PAGE_MAGIC}${at}/**`];
  });
}

function seatPages(git, asked) {
  const specs = protectedSpecs(GITIGNORE_V2);
  const said = GITIGNORE_V2.join(", ");
  const index = specs.map((spec) => {
    const under = spec.slice(PAGE_MAGIC.length);
    return command(
      `seat pages in the index: ${under}`,
      [...git, "ls-files", "--error-unmatch", "--", spec],
      `Exits 1 when git's index holds no file under ${under}: go on. Exits 0 when it holds one: a seat's own page is ` +
        "tracked on this desk, in the desk's history or staged for it, so the run stops there, before anything is staged.",
      { 1: `git's index holds no file under ${under}: go on` },
      { 0: indexStop(under, said, asked) },
    );
  });
  if (!asked) return index;
  const counts = { [UNPUSHED]: printedBy("seat pages in the range"), [ON_HEAD]: printedBy("seat pages on HEAD") };
  const headFills = { [ON_HEAD]: printedBy("seat pages on HEAD"), [ON_HEAD_PICK]: printedBy("seat pages on HEAD picked") };
  // K1l (R107 (a)): whether the push may go to a repository of its own, each reason a config read
  // by exit code; the key's pattern after the pick's line, so the read exits 1 where no commit on
  // HEAD changes a seat's page.
  const elsewhere = (step, pattern, what, stop) =>
    command(
      step,
      [...git, "config", "--name-only", "--get-regexp", `${ON_HEAD_PICK}${pattern}`],
      `Read whether the desk's config sets ${what}: git's own answer, by its exit. ${ON_HEAD_PICK}, before the ` +
        "pattern, is empty where a commit on HEAD changes a seat's page, and _0 where none does, which no key's name " +
        "matches. Exits 1 when none is set, or no commit on HEAD changes a seat's page: go on. Exits 0 when one is set " +
        "and a commit on HEAD changes a seat's page: git prints the names of the keys set, and the run stops here.",
      { 1: `the desk's config sets no ${what}, or no commit on HEAD changes a seat's page: go on` },
      { 0: stop },
      headFills,
    );
  return [
    ...index,
    command(
      "seat pages in the range",
      [...git, "rev-list", "--count", "--full-history", "--ignore-missing", "HEAD", "--not", "@{upstream}", "--", ...specs],
      "Print how many of the commits the push would send, HEAD --not @{upstream} (the commits on HEAD that are not on " +
        "the desk's copy of its upstream's branch), add, change or remove a file under a seat-pages path. Exits 0: git " +
        "prints the count. Exits 128 when the branch has no upstream, or HEAD is on no branch: git prints nothing, and the " +
        "count after this one decides.",
      { 0: `the count git printed fills ${UNPUSHED}; go on`, 128: `the branch has no upstream, or HEAD is on no branch: ${UNPUSHED} is empty; go on` },
    ),
    command(
      "seat pages on HEAD",
      [...git, "rev-list", "--count", "--full-history", "--ignore-missing", "HEAD", "--", ...specs],
      "Print how many of all the commits on HEAD, the commits a first push sends, add, change or remove a file under a " +
        "seat-pages path (0 where HEAD has no commit yet). Exits 0: git prints the count.",
      { 0: `the count git printed fills ${ON_HEAD}; go on` },
    ),
    pick(
      git,
      "seat pages on HEAD picked",
      `_${ON_HEAD}`,
      "^_0$|^$",
      "",
      `Print _${ON_HEAD} where it is _0 (no commit on HEAD changes a seat's page), else an empty line.`,
      ON_HEAD_PICK,
      { [ON_HEAD]: printedBy("seat pages on HEAD") },
    ),
    elsewhere("seat pages push url", PUSH_URL_KEY, PUSH_URL_SET, pushUrlStop(said)),
    elsewhere("seat pages push rewrite", PUSH_REWRITE_KEY, PUSH_REWRITE_SET, pushRewriteStop(said)),
    pick(
      git,
      "seat pages picked",
      `${UNPUSHED}:${ON_HEAD}`,
      "^[1-9][0-9]*:[0-9]+$|^:[1-9][0-9]*$|^$",
      "",
      `Print ${UNPUSHED}:${ON_HEAD} where a commit the push would send holds a change to a seat's page (${UNPUSHED} is not ` +
        `0, or it is empty and ${ON_HEAD} is not 0), else an empty line.`,
      UNPUSHED_PICK,
      counts,
    ),
    read(git, "seat pages go up", UNPUSHED_PICK, "seat pages picked", "Read whether a commit the push would send holds a change to a seat's page.", rangeStop(said), counts),
  ];
}

// The checks before the pull (0.19.0 K1l-b, the base's ruling R111 (b)), run after the fetch and
// before the pull, with push asked. Where the push may go to a repository of its own, the pull
// brings in the upstream's commits first and the push then sends them on there; the checks before
// the stage read the desk's copy of the upstream's branch before the fetch. So
// git reads the commits the pull would bring in, @{upstream} --not HEAD, on that copy as the fetch
// left it, under the same pathspecs (protectedSpecs); a pick makes the count the key reads' line
// (_0 where it is 0, empty otherwise, an empty count included); and the elsewhere condition is
// read again, git's own answer by exit code, each reason its own read with its own words. Where
// neither is set (the normal arm), the reads exit 1 and the run goes on as before: those commits go
// back to the upstream that already holds them. An empty count (git exits 128: it cannot name the
// desk's copy of the upstream's branch, where the remote's fetch refspec does not map it) stops
// where the push may go elsewhere, fail closed.
const PULLED = "{pulled}";
const PULLED_PICK = "{pulled_pick}";

function pullPages(git) {
  const specs = protectedSpecs(GITIGNORE_V2);
  const said = GITIGNORE_V2.join(", ");
  const fills = { ...FILL_BRANCH, [PULLED]: printedBy("seat pages the pull brings in"), [PULLED_PICK]: printedBy("seat pages the pull brings in picked") };
  const elsewhere = (step, pattern, what, stop) =>
    command(
      step,
      [...git, "config", "--name-only", "--get-regexp", `${PULLED_PICK}${pattern}`],
      `Read whether the desk's config sets ${what}: git's own answer, by its exit. ${PULLED_PICK}, before the ` +
        "pattern, is empty where a commit the pull would bring in changes a seat's page, or git could not count them, and " +
        "_0 where none does, which no key's name matches. Exits 1 when none is set, or no commit the pull would bring in " +
        "changes a seat's page: go on. Exits 0 when one is set and a commit the pull would bring in changes a seat's page, " +
        "or git could not count them: git prints the names of the keys set, and the run stops here, before the pull.",
      { 1: `the desk's config sets no ${what}, or no commit the pull would bring in changes a seat's page: go on` },
      { 0: stop },
      fills,
    );
  return [
    command(
      "seat pages the pull brings in",
      [...git, "rev-list", "--count", "--full-history", "--ignore-missing", "@{upstream}", "--not", "HEAD", "--", ...specs],
      "Print how many of the commits the pull would bring in, @{upstream} --not HEAD (the commits on the desk's copy of " +
        "its upstream's branch, where git names one, that are not on HEAD), add, change or remove a file under a " +
        "seat-pages path. Exits 0: git prints the count. Exits 128 when git cannot name the desk's copy of the upstream's " +
        "branch: git prints nothing, and the checks after this one stop the run where the push may go elsewhere.",
      {
        0: `the count git printed fills ${PULLED}; go on`,
        128: `git could not name the desk's copy of the upstream's branch: ${PULLED} is empty; go on`,
      },
    ),
    pick(
      git,
      "seat pages the pull brings in picked",
      `_${PULLED}`,
      "^_0$|^$",
      "",
      `Print _${PULLED} where it is _0 (no commit the pull would bring in changes a seat's page), else an empty line.`,
      PULLED_PICK,
      { [PULLED]: printedBy("seat pages the pull brings in") },
    ),
    elsewhere("seat pages the pull brings in, push url", PUSH_URL_KEY, PUSH_URL_SET, pullUrlStop(said)),
    elsewhere("seat pages the pull brings in, push rewrite", PUSH_REWRITE_KEY, PUSH_REWRITE_SET, pullRewriteStop(said)),
  ];
}

// The words the index checks stop with: the path read, from the desk folder, and the owner's act.
function indexStop(under, said, asked) {
  return (
    `git's index holds a file under ${under}, one of the paths the desk's .gitignore keeps a seat's own pages at ` +
    `(${said}, from the desk folder; ${ANY_CASE}): a seat's own page is tracked on this desk, in the desk's history or staged for ` +
    "it. Run nothing more, and tell the person so: the run stopped here, and nothing was staged or committed" +
    `${asked ? ", pulled or pushed" : ""}. Taking them out of the history is the desk owner's act, never desk_sync's.`
  );
}

// The words the range check stops with (R101 (B)): what git read (the range, how many commits, the
// paths), that nothing ran and nothing moved, the owner's act, and the limit.
function rangeStop(said) {
  return (
    "A seat's own pages would go up with the push. git read the commits the push would send, HEAD --not @{upstream}: " +
    `the commits on HEAD that are not on the desk's copy of its upstream's branch. ${UNPUSHED} of them add, change or ` +
    `remove a file under the paths the desk's .gitignore keeps a seat's own pages at (${said}, from the desk folder; ${ANY_CASE}). ` +
    "Where that count is empty, the branch has no upstream, or HEAD is on no branch, so the range git read is HEAD, " +
    `every commit on it, the commits a first push sends: ${ON_HEAD} of them do. Run nothing more, and tell the person ` +
    "so, with the count: nothing was staged, committed, pulled or pushed, no remote was contacted, and the desk's " +
    "branches, its remote-tracking branches and the remote's branches are where they were. desk_sync never rewrites " +
    "history: taking the pages out of those commits, before the desk goes up, is the desk owner's act, never " +
    "desk_sync's. The range stops at the upstream, since the desk's config sets no push url of its own and no push " +
    "rewrite (the two checks before this one): a commit the upstream already holds is outside the range, and a page in " +
    "it is not read here; a commit in the range that only removes a page is counted too."
  );
}

// K1l (R107 (b)): the case limit, one clause in each seat-pages stop's words.
const ANY_CASE =
  "each path is read in any case, as a disk that ignores case reads the .gitignore, so on a disk that reads case a " +
  "folder named in another case, which the .gitignore line does not ignore there, is read too, an over-refusal";

// The words the HEAD-arm checks stop with (0.19.0 K1l, the base's ruling R107 (a)): which reason
// made the range HEAD, what git read, that nothing ran and nothing moved, the owner's act, and the
// limits. Never "the branch has no upstream", and never a url.
function pushUrlStop(said) {
  return (
    "A seat's own pages could go up with the push. The desk's config sets a push url of its own for a remote " +
    "(remote.<name>.pushurl, for the upstream's remote or another), so the push may go to a repository other than the " +
    `one the desk's copy of its upstream's branch is fetched from${headArm(said)}`
  );
}

function pushRewriteStop(said) {
  return (
    "A seat's own pages could go up with the push. The desk's config sets a push rewrite (url.<base>.pushInsteadOf, " +
    "whether or not it matches the upstream's url), so the push may go to a repository other than the one the desk's " +
    `copy of its upstream's branch is fetched from${headArm(said)}`
  );
}

function headArm(said) {
  return (
    ", and what it would send may not be HEAD --not @{upstream}. So git read every commit on HEAD, the most a push of HEAD " +
    `can send: ${ON_HEAD} of them add, change or remove a file under the paths the desk's .gitignore keeps a seat's ` +
    `own pages at (${said}, from the desk folder; ${ANY_CASE}). Run nothing more, and tell the person so, with the ` +
    "count and the reason, naming no url: nothing was staged, committed, pulled or pushed, no remote was contacted, and " +
    "the desk's branches, its remote-tracking branches and the remote's branches are where they were. desk_sync never " +
    "rewrites history: taking the pages out of those commits, before the desk goes up, is the desk owner's act, never " +
    "desk_sync's. The limits: a page in a commit the push's repository already holds is counted too, an over-refusal, " +
    "and so is a commit that only removes a page. The commits the pull would bring in are read after the fetch, before " +
    "the pull, by the checks there: @{upstream} --not HEAD, on the desk's copy of the upstream's branch, where git " +
    "names one; and every commit on HEAD is read again after the pull, before the push, by the checks there."
  );
}

// The words the checks before the pull stop with (0.19.0 K1l-b, the base's ruling R111 (b)): which
// reason makes the push go elsewhere, what git read (the commits the pull would bring in, how
// many, the paths), what the fetch did (K1l-d, R116 (5): its exit 0, and no more) and what moved
// (K1l-c, R114: the desk's own branch only by a commit this run's commit step made), the owner's
// act, and the limits. Never a url. K1l-d
// (R115 (3)): the commit step (commit -q) prints no hash, so the words name the commit by the ref
// the branch check printed and by the commit step's exit, never by a hash.
function pullUrlStop(said) {
  return (
    "A seat's own pages could go up with the push, from the upstream. The desk's config sets a push url of its own for a " +
    "remote (remote.<name>.pushurl, for the upstream's remote or another), so the push may go to a repository other " +
    `than the upstream's${pullArm(said, "dropping the push url")}`
  );
}

function pullRewriteStop(said) {
  return (
    "A seat's own pages could go up with the push, from the upstream. The desk's config sets a push rewrite " +
    "(url.<base>.pushInsteadOf, whether or not it matches the upstream's url), so the push may go to a repository " +
    `other than the upstream's${pullArm(said, "dropping the push rewrite")}`
  );
}

function pullArm(said, drop) {
  return (
    ", and the pull brings the upstream's commits in first, which the push would then send on there. So git read the " +
    "commits the pull would bring in, @{upstream} --not HEAD, on the desk's copy of the upstream's branch as the " +
    `fetch left it: ${PULLED} of them add, change or remove a file under the paths the desk's .gitignore keeps a ` +
    `seat's own pages at (${said}, from the desk folder; ${ANY_CASE}). Where that count is empty, git could not name ` +
    "the desk's copy of the upstream's branch, so it could not read those commits, and the run stops too. Run nothing " +
    "more, and tell the person so, with the count and the reason, naming no url: git fetched the upstream's " +
    "branch; nothing was pulled or pushed; the desk's " +
    "other branches and the remote's branches are where they were; and the desk's own branch, " +
    `refs/heads/${BRANCH} (the ref the branch check printed), moved only where this run's commit step made a commit, ` +
    "which that step's exit says. Where the commit ran and exited 0, the branch moved by that one commit, which stays " +
    "on this machine; where it was skipped (the staged check exited 0), the branch did not move. No step printed a " +
    "hash for that commit: name it by the branch alone, never by a hash. desk_sync " +
    "never rewrites history: taking the pages out of the upstream's branch, or " +
    `${drop}, is the desk owner's act, never desk_sync's. The limits: a commit the pull would bring in that only ` +
    "removes a page is counted too, an over-refusal, and so is one the push's repository already holds."
  );
}

// The checks after the pull (0.19.0 K1l-d, the base's ruling R116 (3)), run after the pull and
// before the push, with push asked. The pull fetches the upstream's branch again, so a commit the
// upstream gained after the checks before the pull read it comes in unread; where the push may go
// to a repository of its own, the push would send it on there. So the HEAD-arm read runs again, the
// same argv (every commit on HEAD, under the same pathspecs), its count picked (_0 where it is 0,
// empty otherwise) and put before the elsewhere condition's key reads, as before the stage. Where
// neither is set (the normal arm), the reads exit 1 and the push runs: the commits go back to the
// upstream that already holds them. Where one is set, no commit on HEAD held a page before the pull
// (the checks before the stage stop there), and the commit step commits no page, so a count above 0
// is a commit the pull brought in.
const AFTER_PULL = "{after_pull}";
const AFTER_PULL_PICK = "{after_pull_pick}";

function pushPages(git) {
  const specs = protectedSpecs(GITIGNORE_V2);
  const said = GITIGNORE_V2.join(", ");
  const fills = { ...FILL_BRANCH, [AFTER_PULL]: printedBy("seat pages on HEAD after the pull"), [AFTER_PULL_PICK]: printedBy("seat pages on HEAD after the pull picked") };
  const elsewhere = (step, pattern, what, stop) =>
    command(
      step,
      [...git, "config", "--name-only", "--get-regexp", `${AFTER_PULL_PICK}${pattern}`],
      `Read whether the desk's config sets ${what}: git's own answer, by its exit. ${AFTER_PULL_PICK}, before the ` +
        "pattern, is empty where a commit on HEAD after the pull changes a seat's page, and _0 where none does, which no " +
        "key's name matches. Exits 1 when none is set, or no commit on HEAD after the pull changes a seat's page: go on. " +
        "Exits 0 when one is set and a commit on HEAD after the pull changes a seat's page: git prints the names of the " +
        "keys set, and the run stops here, before the push.",
      { 1: `the desk's config sets no ${what}, or no commit on HEAD after the pull changes a seat's page: go on` },
      { 0: stop },
      fills,
    );
  return [
    command(
      "seat pages on HEAD after the pull",
      [...git, "rev-list", "--count", "--full-history", "--ignore-missing", "HEAD", "--", ...specs],
      "Print how many of all the commits on HEAD after the pull, the most a push of HEAD can send, add, change or remove " +
        "a file under a seat-pages path. Exits 0: git prints the count.",
      { 0: `the count git printed fills ${AFTER_PULL}; go on` },
    ),
    pick(
      git,
      "seat pages on HEAD after the pull picked",
      `_${AFTER_PULL}`,
      "^_0$|^$",
      "",
      `Print _${AFTER_PULL} where it is _0 (no commit on HEAD after the pull changes a seat's page), else an empty line.`,
      AFTER_PULL_PICK,
      { [AFTER_PULL]: printedBy("seat pages on HEAD after the pull") },
    ),
    elsewhere("seat pages after the pull, push url", PUSH_URL_KEY, PUSH_URL_SET, afterPullUrlStop(said)),
    elsewhere("seat pages after the pull, push rewrite", PUSH_REWRITE_KEY, PUSH_REWRITE_SET, afterPullRewriteStop(said)),
  ];
}

// The words the checks after the pull stop with (0.19.0 K1l-d, R116 (3)): which reason makes the
// push go elsewhere, what git read (every commit on HEAD after the pull, how many, the paths), what
// the pull did by its exit, that nothing was pushed and the remote is unchanged, the owner's act,
// and the limits. Never a url.
function afterPullUrlStop(said) {
  return (
    "A seat's own pages could go up with the push, from the upstream by the pull. The desk's config sets a push url of " +
    "its own for a remote (remote.<name>.pushurl, for the upstream's remote or another), so the push may go to a " +
    `repository other than the upstream's${afterPullArm(said, "dropping the push url")}`
  );
}

function afterPullRewriteStop(said) {
  return (
    "A seat's own pages could go up with the push, from the upstream by the pull. The desk's config sets a push rewrite " +
    "(url.<base>.pushInsteadOf, whether or not it matches the upstream's url), so the push may go to a repository " +
    `other than the upstream's${afterPullArm(said, "dropping the push rewrite")}`
  );
}

function afterPullArm(said, drop) {
  return (
    ", and the pull brought the upstream's commits onto the desk's own branch, which the push would send on there. So " +
    `git read every commit on HEAD after the pull: ${AFTER_PULL} of them add, change or remove a file under the paths ` +
    `the desk's .gitignore keeps a seat's own pages at (${said}, from the desk folder; ${ANY_CASE}). Run nothing more, ` +
    "and tell the person so, with the count and the reason, naming no url: the pull ran and exited 0, so it moved the " +
    `desk's own branch, refs/heads/${BRANCH} (the ref the branch check printed), onto the upstream's commits, the ` +
    "counted ones among them; a commit this run's commit step made (where it exited 0) is on that branch, on this " +
    "machine; nothing was pushed, and the remote is unchanged. desk_sync never rewrites history: taking the pages out " +
    `of the upstream's branch and the desk's own, or ${drop}, is the desk owner's act, never desk_sync's. The limits: ` +
    "a page in a commit the push's repository already holds is counted too, an over-refusal, and so is a commit that " +
    "only removes a page."
  );
}

// The words the push stops with (0.19.0 K1l-d, R116 (4)), from git's exit and its words alone; K1l-e
// (R117 (2)): they name no refuser (a hook on this machine, the remote, or no reach), and claim git
// named it only where git's words say more than that the push failed (round 2, F2, ruling A: a
// silent pre-push hook exits 1 with no words). The next step is desk_sync again, never a
// pull by hand, which skips the checks, whatever git's own hint says.
function pushStop() {
  return (
    "git did not send the desk up: the cause is a hook on this machine, the remote, or no reach, and git's own words " +
    "name it only where they say more than that the push failed. " +
    "Run nothing more, and tell the person so, with git's words: nothing was pushed, and the remote is unchanged; a " +
    "commit this run's commit step made (where it exited 0) and what the pull brought in are on the desk's own branch, " +
    `refs/heads/${BRANCH} (the ref the branch check printed), on this machine. The next step is to run desk_sync ` +
    "again, which reads what the upstream gained before it brings it in and sends the desk up; never a git pull by " +
    "hand, whatever git's own words suggest: a pull by hand skips desk_sync's checks."
  );
}

// What moved in a stop after the commit step and before the pull (0.19.0 K1l-d, R116 (6)): the desk's
// own branch, by the commit step's exit alone, and nothing else.
const MOVED_BY_COMMIT =
  "moved only where this run's commit step made a commit (it exited zero), which stays on this machine, and nothing else moved";

// The words the upstream checks stop with where the branch has no upstream in the desk's config
// (0.19.0 K1f; K1e's stop at git's own check said the same, and also stopped on a remote that
// holds no such branch, which the fetch now says).
function noUpstream() {
  return (
    "No upstream is set for the branch HEAD is on (the branch check printed it), so git does not know where the desk " +
    "goes up. Run nothing more, and tell the person so: no remote was contacted, nothing was pulled or pushed, and a " +
    "commit this run made (the commit step ran) stays on this machine, on that branch. Setting an upstream is the desk " +
    "owner's act, never desk_sync's (git push -u <the desk's remote> <the branch> sets one)."
  );
}

// The words a word check stops with where the upstream names its remote or its branch by a word
// that begins with - (0.19.0 K1g, the base's ruling R88): why no command takes it. K1j (R96 (e)):
// the words do not say the word, which may hold a path. Each is its own function, with no
// argument, so its words are read where they are written.
const OPTION_TAIL =
  " by a word that begins with -, which git reads as an option, not as a name. Run nothing more, and tell the person so, " +
  "without saying the word: no remote was contacted, and nothing was pulled or pushed: the desk's own branch, " +
  `refs/heads/${BRANCH}, ${MOVED_BY_COMMIT}. desk_sync does not ` +
  "change the desk's remotes or its upstream. Pointing the branch at a remote and a branch by their names is the desk " +
  "owner's act, never desk_sync's.";

function remoteWordStop() {
  return `The branch's upstream names its remote${OPTION_TAIL}`;
}

function branchWordStop() {
  return `The branch's upstream names its branch${OPTION_TAIL}`;
}

// The words the url checks stop with (0.19.0 K1g, the base's ruling R88; K1i, R92; K1j, R96 (e)).
// Two outcomes stop: a url leads to this same repository (every answer at this door is about a
// remote with seats behind it, and an upstream in the same repository has none, so this is a
// stop, never an answer of another shape), or the check could not tell where a url leads (fail
// closed). The words name the url's form, and the upstream's remote by its name only where that
// is a plain word ({remote_name}); never the url, a path, or the push's urls. Each is its own
// function, with no argument, so its words are read where they are written.
const SAID =
  " Run nothing more, and tell the person so, naming no url and no path: no remote was contacted, and nothing was " +
  `pulled or pushed: the desk's own branch, refs/heads/${BRANCH}, ${MOVED_BY_COMMIT}; its upstream is as it was.`;
const SAME_TAIL =
  `${SAID} desk_sync brings in other seats' commits from another repository and sends the desk up to it; it does not ` +
  "send a desk into its own repository, and does not change the desk's remotes or its upstream. Pointing the branch " +
  "at a remote is the desk owner's act, never desk_sync's.";
const UNTOLD_TAIL =
  `${SAID} desk_sync does not follow a url it could not tell, and does not change the desk's remotes or its ` +
  "upstream. Pointing the branch's upstream at a remote whose urls each lead to another repository, as this check " +
  "reads them, is the desk owner's act, never desk_sync's.";
const FORMS_READ =
  "the check reads an absolute path, a path from the desk folder, ~/ and a path, a file: url whose host is empty or " +
  "localhost, and a network url (ssh, git, http, https, ftp, ftps, or host:path) whose host is a name or an IPv4 " +
  "address of another machine; it does not read ~user, an ext:: or fd:: transport, any other transport, a file: url " +
  "with another host or a %, a path with a : or a = in it, an IPv6 address, or a character that is not printable ASCII";
const ON_THIS_MACHINE = "a path on this machine, however it is written (a path, a ~/ path or a file: url)";
const PLACES =
  "the places git looks for one there, <path>/.git, <path>, <path>.git/.git and <path>.git (for a path that ends in /, " +
  "the first two alone)";
const UNREAD =
  "git could not read the check's own names for it on the check's command line (a url or a folder with a = or a line " +
  "break in it), or the desk's config sets color.ui, or a desk-sync key the check reads, to a value git does not read " +
  "as a colour setting";

function hereStop() {
  return (
    "This repository's own git folder has a = in its path, which the check cannot set in a name on its command line, so " +
    `it could not tell whether a url of ${REMOTE_NAME} leads to this repository.${UNTOLD_TAIL}`
  );
}

function fetchSameStop() {
  return `The upstream is a branch of this same repository: the url git would use for the fetch of ${REMOTE_NAME} is ${ON_THIS_MACHINE} that leads to this repository's own git folder.${SAME_TAIL}`;
}

function pushSameStop() {
  return `The upstream is a branch of this same repository: the url git would use for the push to ${REMOTE_NAME} is ${ON_THIS_MACHINE} that leads to this repository's own git folder.${SAME_TAIL}`;
}

function fetchLoopbackStop() {
  return (
    `The url git would use for the fetch of ${REMOTE_NAME} is a network url whose host is this machine, by a loopback ` +
    "name or address; the check follows a url on this machine only by its path, so it could not tell whether the url " +
    `leads to this repository.${UNTOLD_TAIL}`
  );
}

function pushLoopbackStop() {
  return (
    `The url git would use for the push to ${REMOTE_NAME} is a network url whose host is this machine, by a loopback ` +
    "name or address; the check follows a url on this machine only by its path, so it could not tell whether the url " +
    `leads to this repository.${UNTOLD_TAIL}`
  );
}

function fetchFormStop() {
  return `The url git would use for the fetch of ${REMOTE_NAME} is of no form this check reads (${FORMS_READ}), so it could not tell whether the url leads to this repository.${UNTOLD_TAIL}`;
}

function pushFormStop() {
  return `The url git would use for the push to ${REMOTE_NAME} is of no form this check reads (${FORMS_READ}), so it could not tell whether the url leads to this repository.${UNTOLD_TAIL}`;
}

function fetchRewrittenStop() {
  return (
    `The url git would use for the fetch of ${REMOTE_NAME} is ${ON_THIS_MACHINE}, and it is not the same url read with ` +
    "file: taken off: a url rewrite (insteadOf) of the desk's config matches it as well, so the check could not tell " +
    `which path git would follow, or whether the url leads to this repository.${UNTOLD_TAIL}`
  );
}

function pushRewrittenStop() {
  return (
    `The url git would use for the push to ${REMOTE_NAME} is ${ON_THIS_MACHINE}, and it is not the same url read with ` +
    "file: taken off: a url rewrite (insteadOf or pushInsteadOf) of the desk's config matches it as well, so the check " +
    `could not tell which path git would follow, or whether the url leads to this repository.${UNTOLD_TAIL}`
  );
}

function fetchPlacesStop() {
  return (
    `The url git would use for the fetch of ${REMOTE_NAME} is ${ON_THIS_MACHINE}, and git reads a repository at none, ` +
    `or at more than one, of ${PLACES}; so the check could not tell which repository git would reach, or whether it is ` +
    `this one.${UNTOLD_TAIL}`
  );
}

function pushPlacesStop() {
  return (
    `The url git would use for the push to ${REMOTE_NAME} is ${ON_THIS_MACHINE}, and git reads a repository at none, ` +
    `or at more than one, of ${PLACES}; so the check could not tell which repository git would reach, or whether it is ` +
    `this one.${UNTOLD_TAIL}`
  );
}

function fetchUnfoundStop() {
  return (
    `The url git would use for the fetch of ${REMOTE_NAME} is ${ON_THIS_MACHINE}, and git reads a repository at one of ` +
    "the places it looks there, but could not read that repository's own git folder, so the check could not tell " +
    `whether the url leads to this repository.${UNTOLD_TAIL}`
  );
}

function pushUnfoundStop() {
  return (
    `The url git would use for the push to ${REMOTE_NAME} is ${ON_THIS_MACHINE}, and git reads a repository at one of ` +
    "the places it looks there, but could not read that repository's own git folder, so the check could not tell " +
    `whether the url leads to this repository.${UNTOLD_TAIL}`
  );
}

function fetchUnreadStop() {
  return `The check could not follow the url git would use for the fetch of ${REMOTE_NAME}: ${UNREAD}. So it could not tell whether the url leads to this repository.${UNTOLD_TAIL}`;
}

function pushUnreadUrlStop() {
  return `The check could not follow the url git would use for the push to ${REMOTE_NAME}: ${UNREAD}. So it could not tell whether the url leads to this repository.${UNTOLD_TAIL}`;
}

function pushUnreadStop() {
  return (
    `git could not print the urls the push to ${REMOTE_NAME} would use: the desk's config sets no remote of that name ` +
    "(. or a path or url written in its place). So the check could not tell whether the push leads to this " +
    `repository.${UNTOLD_TAIL}`
  );
}

function pushManyStop() {
  return (
    `The push to ${REMOTE_NAME} would go to more than one url. The check follows one url for the push, so it could ` +
    `not tell whether each leads to another repository.${UNTOLD_TAIL}`
  );
}

// The words the fetch stops with (0.19.0 K1f, the base's rulings R84 and R86): the commit exists
// on this machine, by its ref, nothing else moved (K1l-d, R116 (6)), and the next step, for a remote that holds no such
// branch and for one that cannot be reached (K1e's answer for a gone remote said only that nothing
// was pulled or pushed).
function fetchStop() {
  return (
    `git could not fetch ${MERGE} from ${REMOTE}. Run nothing more, and tell the person so, with git's words: nothing ` +
    `was pulled or pushed: the desk's own branch, refs/heads/${BRANCH} (the ref the branch check printed), ` +
    `${MOVED_BY_COMMIT}; the desk's files, its index and the remote are as they were. Where git says it couldn't find remote ref ${MERGE}, ${REMOTE} holds no such branch: sending the ` +
    `branch up and setting it as the upstream is the desk owner's act, never desk_sync's (git push -u ${REMOTE} ` +
    `${BRANCH}). Otherwise git could not reach ${REMOTE}, and its words say why: run desk_sync again once it can, and ` +
    "the commit goes up then."
  );
}

// The words the branch check stops with on a detached HEAD (0.19.0 K1d): what was done, what was
// not, and whose act comes next (R76).
function detachedStop(asked) {
  return (
    "HEAD is detached: the desk is on no branch. Run nothing more, and tell the person so: a commit this run made (the " +
    "commit step ran) is on no branch, so no branch holds it, and a switch to a branch leaves it behind; when the commit " +
    `step was skipped, no commit was made.${asked ? " Nothing was pulled or pushed." : ""} Putting the desk back on its ` +
    "branch is the desk owner's act, never desk_sync's: git switch -c <a new branch> keeps the commit on a branch of its " +
    "own, or git switch <the desk's branch> and then git cherry-pick <the commit> brings it onto the desk's branch."
  );
}

// What the answer's held_back reads: every path of the table's overnight class (OVERNIGHT_ROWS),
// the three folders and the merge record. Here, below deskSync, which reads it when it runs.
const HELD_BACK = [...OVERNIGHT, "celorus/merge-record.md"];

// The table the overnight's own commit reads (E9 fix round 2, item 1). TABLE's overnight rows take
// any file name in the three folders: that is what a plain desk_sync holds back, and its held_back
// lists. As a pathspec that glob would stage every file there (an export, a scan, a swap file, a
// .DS_Store the seat row calls never staged), so with the flag each folder row is its pages alone
// (*.md, as every shared row is). A file there that is no page is then in no row: it is in no
// pathspec, and the answer names it under unclassified, as it names any file no row takes. TABLE
// itself is as it was, so a plain desk_sync answers as before.
const NIGHTLY = TABLE.map((row) => (row.cls === "overnight" && row.glob.endsWith("/*") ? { ...row, glob: `${row.glob}.md`, pattern: globPattern(`${row.glob}.md`) } : row));
function tableOf(overnight) {
  return overnight ? NIGHTLY : TABLE;
}

module.exports = { deskSync, TABLE, rowOf, globPattern, staging, VIEWS, OVERNIGHT, HELD_BACK, ignoreRules, ignoredBy };

// The folders a staged row's glob would take whole (E9 fix round 3, item 2). git reads a glob
// pathspec as the table reads its row, file by file, but for one thing: a pathspec that matches a
// folder takes everything under it, so a folder named as a page (people/x.md/, or one named
// literally *.md) would bring in every file it holds, which no row names and unclassified names as
// not staged. Each such folder, by its exact path, is taken back out of the stage, the staged
// check and the commit by a literal pathspec (:(exclude,literal)), which git reads as the path
// itself, whatever it holds. The rows stay globs, so a page taken off the desk (merge_pages takes
// the merged page off, and only the overnight commits people/) is still staged as gone. A desk
// with no such folder answers as before.
// A page that stood at such a folder's path, committed before and gone now (round 4, item 2), is a
// removal the exclude also keeps out: git cannot commit it with the folder there (a commit of
// named paths stops on a folder where a file was). desk_sync reads nothing of git's index, so it
// cannot tell whether one stood there: the path itself (the folder's, without its slash) is named
// under unclassified, as not staged, beside the folder.
function holesIn(rows, files, odd) {
  const folders = new Set();
  for (const rel of [...files, ...odd]) {
    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i += 1) folders.add(parts.slice(0, i).join("/"));
  }
  return [...folders].filter((folder) => rows.some((row) => row.pattern.test(folder))).sort();
}
