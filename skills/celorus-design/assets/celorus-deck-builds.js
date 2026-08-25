/*!
 * celorus-deck-builds.js — progressive reveal ("builds") for Celorus HTML decks.
 *
 * WHAT IT DOES
 * A slide can reveal its content in stages while presenting, instead of landing
 * whole. Mark any element with data-build="1", "2", … and it appears at that
 * step. Elements without the attribute are always visible.
 *
 *     <div class="wmap" data-build="1"> … </div>
 *     <div class="rsv"  data-build="2"> … </div>
 *
 * TWO PROPERTIES THAT MATTER, AND WHY
 *  1. Layout never moves. Hidden steps keep their space (visibility + opacity,
 *     never display:none). A deck that reflows as you present is worse than one
 *     that does not animate at all: the room re-reads the whole slide on every
 *     keypress. The final layout is the layout from the first frame.
 *  2. It degrades to nothing. The hiding rule only applies under
 *     html[data-deck-builds], which this script sets at run time. No JS, broken
 *     JS, print, or a stylesheet-only context: every step is simply visible.
 *
 * USAGE — the deck owns its own key handling and calls in:
 *
 *     var builds = celorusDeckBuilds.init();          // defaults to '.wf'
 *     // right arrow: advance a step, or fall through to the next slide
 *     if (!builds.next(currentSlideEl)) { goTo(current + 1); }
 *     // left arrow: step back, or fall through to the previous slide
 *     if (!builds.prev(currentSlideEl)) { goTo(current - 1); }
 *     // whenever a slide becomes active, tell the controller which way we came
 *     builds.enter(slideEl, 'forward');   // 'forward' starts at step 0
 *     builds.enter(slideEl, 'back');      // 'back' starts fully revealed
 *
 * next()/prev() return true if they consumed the keypress, false if the slide
 * has no steps left and the deck should change slides. That is the whole
 * contract; the deck keeps ownership of its own navigation.
 *
 * PRESENTER NOTE: builds are a presenting aid, never a place to hide a claim.
 * A slide must read correctly and completely in its final state, which is the
 * state a PDF export, a print, and any no-JS viewer will see.
 *
 * No dependencies. Safe to inline into a self-contained deck.
 */
(function (root) {
  "use strict";

  var STYLE_ID = "celorus-deck-builds-style";
  var ROOT_FLAG = "data-deck-builds";

  // Scoped under the root flag so the un-enhanced document shows everything.
  // visibility:hidden (not display:none) is load-bearing — see note above.
  var CSS =
    "html[" + ROOT_FLAG + "] [data-build]{" +
      "visibility:hidden;opacity:0;" +
      "transition:opacity .22s var(--primitive-easing-standard,ease-out)}" +
    "html[" + ROOT_FLAG + "] [data-build].is-built{visibility:visible;opacity:1}" +
    "@media print{html[" + ROOT_FLAG + "] [data-build]{visibility:visible;opacity:1}}" +
    "@media (prefers-reduced-motion: reduce){" +
      "html[" + ROOT_FLAG + "] [data-build]{transition:none}}";

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var el = doc.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    doc.head.appendChild(el);
  }

  function steps(slide) {
    if (!slide) return [];
    return Array.prototype.slice.call(slide.querySelectorAll("[data-build]"));
  }

  function maxStep(slide) {
    return steps(slide).reduce(function (m, el) {
      var n = parseInt(el.getAttribute("data-build"), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
  }

  function paint(slide, upTo) {
    steps(slide).forEach(function (el) {
      var n = parseInt(el.getAttribute("data-build"), 10);
      el.classList.toggle("is-built", !isNaN(n) && n <= upTo);
    });
  }

  function init(options) {
    var opts = options || {};
    var doc = opts.document || root.document;
    var slideSelector = opts.slideSelector || ".wf";

    injectStyle(doc);
    doc.documentElement.setAttribute(ROOT_FLAG, "");

    // step index per slide, held on the element so slide order can change freely
    var KEY = "__celorusBuildStep";

    function current(slide) {
      return slide && typeof slide[KEY] === "number" ? slide[KEY] : 0;
    }

    function set(slide, n) {
      if (!slide) return;
      var top = maxStep(slide);
      var v = Math.max(0, Math.min(n, top));
      slide[KEY] = v;
      paint(slide, v);
      return v;
    }

    var api = {
      /** Reveal the next step. Returns false when there is nothing left. */
      next: function (slide) {
        if (!slide || current(slide) >= maxStep(slide)) return false;
        set(slide, current(slide) + 1);
        return true;
      },
      /** Hide the last revealed step. Returns false when already at zero. */
      prev: function (slide) {
        if (!slide || current(slide) <= 0) return false;
        set(slide, current(slide) - 1);
        return true;
      },
      /**
       * Called when a slide becomes active. Entering forward starts closed;
       * entering backward starts open, so walking back through a deck never
       * makes the presenter re-click through builds they already showed.
       */
      enter: function (slide, direction) {
        set(slide, direction === "back" ? maxStep(slide) : 0);
      },
      /** Reveal everything on a slide (overview mode, export, handout). */
      revealAll: function (slide) { set(slide, maxStep(slide)); },
      /** Reveal everything on every slide, and stop hiding altogether. */
      disable: function () {
        Array.prototype.forEach.call(doc.querySelectorAll(slideSelector), function (s) {
          set(s, maxStep(s));
        });
        doc.documentElement.removeAttribute(ROOT_FLAG);
      },
      steps: maxStep,
      step: current
    };

    // start every slide closed; the deck calls enter() as slides activate
    Array.prototype.forEach.call(doc.querySelectorAll(slideSelector), function (s) {
      set(s, 0);
    });

    // a handout or a print must never omit a step
    if (root.addEventListener) {
      root.addEventListener("beforeprint", function () {
        Array.prototype.forEach.call(doc.querySelectorAll(slideSelector), api.revealAll);
      });
    }

    return api;
  }

  root.celorusDeckBuilds = { init: init };
})(typeof window !== "undefined" ? window : this);
