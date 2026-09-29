"use strict";
// The Obsidian vault settings that ship with the views (demo item 11): the graph shows people,
// families, firms and seats, coloured by kind, and the file explorer does not show the model.
// render_view writes each one that the desk does not have yet, beside the first page it draws,
// and never overwrites a setting the person has.
//
// Ported from the demo kit's obsidian.py (row E5): the files are byte for byte the kit's.

const { deskRoot, plainFolder, plainFile, writeAll } = require("./files.js");

const GRAPH_FILTER = "path:celorus/people OR path:celorus/families OR path:celorus/firms OR path:celorus/seats";
const COLOURS = [
  ["path:celorus/families", 1399403], // #155A6B petrol
  ["path:celorus/people", 12683297], // #C18821 ochre
  ["path:celorus/firms", 4868680], // #4A4A48 ink
  ["path:celorus/seats", 4171451], // #3FA6BB light petrol, token petrol.300
];
// the seats are the team, so the lightest of the four; petrol.300 still reads on both graph
// backgrounds (2.8:1 on the light theme's white, 5.9:1 on the dark theme's #1E1E1E)
const SNIPPET = "hide-model";
const HIDE_MODEL = `/* The desk's data model is proprietary and is not shown. Its folder stays on disk, where the
   skills and the desk checker read it, and leaves the file explorer: its row, and everything under it. */
.nav-folder:has(> .nav-folder-title[data-path="celorus/model"]),
.nav-folder-title[data-path="celorus/model"],
.nav-folder-title[data-path^="celorus/model/"],
.nav-file-title[data-path^="celorus/model/"],
.tree-item:has(> .tree-item-self[data-path="celorus/model"]),
.tree-item-self[data-path="celorus/model"],
.tree-item-self[data-path^="celorus/model/"] {
  display: none;
}
`;

function json(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

// Each settings file, by its path under the desk folder, and its text.
function settingsFiles() {
  return {
    ".obsidian/graph.json": json({
      "collapse-filter": false,
      search: GRAPH_FILTER,
      showTags: false,
      showAttachments: false,
      hideUnresolved: true,
      showOrphans: false,
      "collapse-color-groups": false,
      colorGroups: COLOURS.map(([query, rgb]) => ({ query, color: { a: 1, rgb } })),
      "collapse-display": true,
      showArrow: false,
      textFadeMultiplier: 0,
      nodeSizeMultiplier: 1.3,
      lineSizeMultiplier: 1,
      "collapse-forces": true,
      centerStrength: 0.5,
      repelStrength: 12,
      linkStrength: 1,
      linkDistance: 180,
      scale: 1,
      close: true,
    }),
    // the filter takes the model out of search, the graph and link suggestions; .views/ is never indexed
    ".obsidian/app.json": json({ userIgnoreFilters: ["celorus/model/"], propertiesInDocument: "visible", alwaysUpdateLinks: false }),
    [`.obsidian/snippets/${SNIPPET}.css`]: HIDE_MODEL,
    ".obsidian/appearance.json": json({ accentColor: "#155A6B", baseFontSize: 16, enabledCssSnippets: [SNIPPET] }),
  };
}

// The settings the desk folder does not have yet, by path. Looked at before anything is written:
// a linked .obsidian or snippets folder, or a settings path that is a link or not a plain file,
// is refused by its path, and a plain file already there is the person's own and stays.
function missingSettings(root) {
  const missing = [];
  for (const rel of Object.keys(settingsFiles())) {
    const parts = rel.split("/");
    let folders = true;
    for (let i = 1; i < parts.length && folders; i += 1) folders = plainFolder(root, parts.slice(0, i).join("/"));
    if (!folders || !plainFile(root, rel)) missing.push(rel);
  }
  return missing;
}

// The settings named (missingSettings'), each a new file, as files.writeAll takes them, so a
// render opens and checks them with its page before anything is written.
function settingsTargets(rels) {
  const files = settingsFiles();
  return rels.map((rel) => ({ rel, text: files[rel], replace: false }));
}

// Writes the settings the desk folder does not have; answers the paths written. The sweep set is
// every settings file's folder, missing or not.
function writeMissingSettings(root) {
  const real = deskRoot(root);
  return writeAll(real, settingsTargets(missingSettings(real)), Object.keys(settingsFiles())).written;
}

module.exports = { settingsFiles, missingSettings, settingsTargets, writeMissingSettings };
