"use strict";
// The desk engine's run-time block. server.js and cli.js call install() as their first
// statement, before they load any other engine file. From then on, in that process, each of
// these throws DeskEngineGuardError when it is called:
//   - every function and class exported by the built-in modules in BLOCKED_MODULES, except
//     net's Socket and Stream classes, which Node makes standard input and output from;
//   - net.Socket's connect method, through which every connection a Socket makes goes, and
//     the methods of net.Server in BLOCKED_SERVER_METHODS: listen, which every server class of
//     net, tls, http, https and http2 inherits, and the inner methods it calls that make and
//     bind the listening handle;
//   - the process methods in BLOCKED_PROCESS_METHODS, kill's raw form among them, and the
//     two that start and stop a process inspector (process.exit calls reallyExit: left open);
//   - the node:module functions in BLOCKED_MODULE_FUNCTIONS, which add hooks to the loader;
//   - the globals in BLOCKED_GLOBALS.
// Each list holds the entries this Node version has: a module, method or function that a
// version does not have is left out of the list, and nothing is blocked for it.
// A built-in module is one object however it is reached (require with or without "node:",
// import(), process.getBuiltinModule), so each is changed in place, and import()'s copies of
// the exports are brought in line after. This file loads no other engine file.

const nodeModule = require("node:module");
const has = (name) => nodeModule.builtinModules.includes(name);

// Loads a module to block it with its deprecation warning held back: Node 26 warns when
// _tls_common or _tls_wrap is loaded, and loading one here to block it is no use of it.
function quietly(load) {
  const held = process.noDeprecation;
  process.noDeprecation = true;
  try {
    return load();
  } finally {
    process.noDeprecation = held;
  }
}

// Each by a literal require, so what this file loads is read from its text.
const MODULES = {
  net: require("node:net"),
  tls: require("node:tls"),
  http: require("node:http"),
  https: require("node:https"),
  http2: require("node:http2"),
  dns: require("node:dns"),
  "dns/promises": require("node:dns/promises"),
  dgram: require("node:dgram"),
  cluster: require("node:cluster"),
  inspector: require("node:inspector"),
  worker_threads: require("node:worker_threads"),
  child_process: require("node:child_process"),
};
// The legacy public names of http's and tls's parts (the same objects, bare or with "node:"),
// the promise form of inspector, the REPL, and vm, which runs text as code.
if (has("_http_agent")) MODULES._http_agent = quietly(() => require("node:_http_agent"));
if (has("_http_client")) MODULES._http_client = quietly(() => require("node:_http_client"));
if (has("_http_common")) MODULES._http_common = quietly(() => require("node:_http_common"));
if (has("_http_incoming")) MODULES._http_incoming = quietly(() => require("node:_http_incoming"));
if (has("_http_outgoing")) MODULES._http_outgoing = quietly(() => require("node:_http_outgoing"));
if (has("_http_server")) MODULES._http_server = quietly(() => require("node:_http_server"));
if (has("_tls_common")) MODULES._tls_common = quietly(() => require("node:_tls_common"));
if (has("_tls_wrap")) MODULES._tls_wrap = quietly(() => require("node:_tls_wrap"));
if (has("inspector/promises")) MODULES["inspector/promises"] = require("node:inspector/promises");
if (has("repl")) MODULES.repl = require("node:repl");
if (has("vm")) MODULES.vm = require("node:vm");

const BLOCKED_MODULES = Object.freeze(Object.keys(MODULES));
const BLOCKED_GLOBALS = Object.freeze(["fetch", "WebSocket", "EventSource"]);
const BLOCKED_PROCESS_METHODS = Object.freeze(
  ["binding", "_linkedBinding", "dlopen", "execve", "kill", "_kill", "_debugProcess", "_debugEnd"].filter(
    (key) => typeof process[key] === "function",
  ),
);
const BLOCKED_MODULE_FUNCTIONS = Object.freeze(
  ["register", "registerHooks"].filter((key) => typeof nodeModule[key] === "function"),
);
const KEPT = Object.freeze({ net: Object.freeze(["Socket", "Stream"]) });
// Read when this file loads, before any install replaces net.Server: the prototype every
// server class shares. Kept inside this file, so a second install finds it again.
const SERVER_PROTOTYPE = MODULES.net.Server.prototype;
const BLOCKED_SERVER_METHODS = Object.freeze(
  ["listen", "_listen2", "_setupListenHandle"].filter((key) =>
    Object.prototype.hasOwnProperty.call(SERVER_PROTOTYPE, key) && typeof SERVER_PROTOTYPE[key] === "function"),
);

class DeskEngineGuardError extends Error {
  constructor(route, by) {
    super(`${route} is blocked by ${by}`);
    this.name = "DeskEngineGuardError";
    this.code = "ERR_DESK_ENGINE_GUARD";
  }
}

function blocked(route, by) {
  return function blockedRoute() {
    throw new DeskEngineGuardError(route, by);
  };
}

function replace(owner, key, route, by) {
  const held = Object.getOwnPropertyDescriptor(owner, key);
  Object.defineProperty(owner, key, { ...held, value: blocked(route, by) });
}

// Installs the block. `by` names who installed it, in each error's message; the engine's two
// doors leave it at its default. Installing again replaces each blocked function with a new
// one, and unblocks nothing.
function install(by = "the desk engine") {
  for (const name of BLOCKED_MODULES) {
    const exported = MODULES[name];
    const keep = KEPT[name] || [];
    for (const key of Object.getOwnPropertyNames(exported)) {
      const held = Object.getOwnPropertyDescriptor(exported, key);
      if (keep.includes(key) || !("value" in held) || typeof held.value !== "function") continue;
      Object.defineProperty(exported, key, { ...held, value: blocked(`${name}.${key}`, by) });
    }
  }
  MODULES.net.Socket.prototype.connect = blocked("net.Socket.prototype.connect", by);
  for (const key of BLOCKED_SERVER_METHODS) replace(SERVER_PROTOTYPE, key, `net.Server.prototype.${key}`, by);
  for (const key of BLOCKED_MODULE_FUNCTIONS) replace(nodeModule, key, `module.${key}`, by);
  for (const key of BLOCKED_PROCESS_METHODS) {
    Object.defineProperty(process, key, { value: blocked(`process.${key}`, by), writable: true, configurable: true });
  }
  for (const key of BLOCKED_GLOBALS) {
    Object.defineProperty(globalThis, key, { value: blocked(key, by), writable: true, configurable: true });
  }
  nodeModule.syncBuiltinESMExports();
}

module.exports = {
  BLOCKED_MODULES,
  BLOCKED_GLOBALS,
  BLOCKED_PROCESS_METHODS,
  BLOCKED_MODULE_FUNCTIONS,
  BLOCKED_SERVER_METHODS,
  DeskEngineGuardError,
  install,
};
