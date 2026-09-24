"use strict";
// A refusal is an answer, not a crash: the tool could not do what was asked, and its message
// says why and names the valid values. The server returns it as a tool error the person
// reads; the command line prints it and exits 2.

class Refusal extends Error {
  constructor(message) {
    super(message);
    this.name = "Refusal";
  }
}

module.exports = { Refusal };
