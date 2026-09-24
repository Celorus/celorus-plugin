"use strict";
// The plugin's version, read from the plugin manifest beside this folder. That manifest is
// the single version source (the other two manifests are pinned equal to it), so the engine
// carries no version of its own and a release never has a fourth file to bump.

const fs = require("node:fs");
const path = require("node:path");

const MANIFEST = path.resolve(__dirname, "..", "..", ".claude-plugin", "plugin.json");

let cached;

function pluginVersion() {
  if (cached === undefined) {
    try {
      const version = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).version;
      cached = typeof version === "string" && version ? version : "unknown";
    } catch {
      cached = "unknown";
    }
  }
  return cached;
}

module.exports = { pluginVersion };
