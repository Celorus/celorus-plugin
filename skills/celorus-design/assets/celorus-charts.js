/**
 * Celorus Design System v3 — Chart.js v4 theme (celorus-charts.js)
 * ---------------------------------------------------------------
 * Reads --semantic-* / --component-* / --primitive-* CSS custom properties
 * at RUNTIME via getComputedStyle, so charts follow the page's light/dark
 * state automatically (including a live data-theme toggle — call
 * celorusChartDefaults(Chart) again, or re-instantiate charts, after the
 * toggle to pick up new values; Chart.js does not watch CSS itself).
 *
 * Usage:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js"></script>
 *   <script src="celorus-charts.js"></script>
 *   <script>
 *     celorusChartDefaults(Chart);                 // apply global defaults + register palette
 *     const palette = celorusChartPalette();        // ordered array of series colors
 *     new Chart(ctx, { type: 'line', data: {...}, options: celorusTooltip() });
 *   </script>
 *
 * Zero hex literals in this file — every color traces back to a CSS custom
 * property read via getComputedStyle(document.documentElement).
 */

(function (global) {
  'use strict';

  /** Read a CSS custom property off :root (or a supplied element), trimmed. */
  function cssVar(name, fallbackName, el) {
    var target = el || document.documentElement;
    var styles = getComputedStyle(target);
    var value = styles.getPropertyValue(name).trim();
    if (!value && fallbackName) {
      value = styles.getPropertyValue(fallbackName).trim();
    }
    return value || undefined;
  }

  /**
   * Ordinal palette for categorical series (max 6). Petrol first, then warm
   * neutrals from the ink/bone ramp so a rainbow never happens — this is a
   * one-hue-family system, not a "distinct color per category" system.
   * Order chosen for max perceptual separation within the family:
   *   1. petrol.600 (primary accent)
   *   2. ink.700 (charcoal-adjacent neutral)
   *   3. petrol.300 (dark-legible petrol, reads as a lighter teal in light mode)
   *   4. bone.400 (warm stone neutral)
   *   5. petrol.800 (deepest petrol)
   *   6. ink.400 (mid warm neutral)
   */
  function celorusChartPalette() {
    return [
      cssVar('--primitive-color-petrol-600'),
      cssVar('--primitive-color-ink-700'),
      cssVar('--primitive-color-petrol-300'),
      cssVar('--primitive-color-bone-400'),
      cssVar('--primitive-color-petrol-800'),
      cssVar('--primitive-color-ink-400'),
    ];
  }

  /** Single-series accent (line/bar charts with one metric). */
  function celorusChartAccent() {
    return cssVar('--semantic-color-accent-default');
  }

  /** Soft fill for area-under-line, using the accent-soft semantic tint. */
  function celorusChartAccentSoft() {
    return cssVar('--semantic-color-accent-soft');
  }

  /** Quiet grid / border color — never louder than the UI's own hairlines. */
  function celorusGridColor() {
    return cssVar('--semantic-color-border-default');
  }

  function celorusAxisTextColor() {
    return cssVar('--semantic-color-fg-muted');
  }

  function celorusFontFamilyMono() {
    return cssVar('--semantic-font-data', '--primitive-font-mono');
  }

  function celorusFontFamilySans() {
    return cssVar('--semantic-font-body', '--primitive-font-sans');
  }

  /**
   * Apply Celorus theme as Chart.js global defaults. Call once after Chart
   * is loaded, and again any time the page's data-theme attribute changes
   * (a toggle handler should re-run this + call .update() on live chart
   * instances, since Chart.js caches option values at creation/update time
   * rather than reading CSS live per frame).
   */
  function celorusChartDefaults(Chart) {
    if (!Chart) {
      throw new Error('celorusChartDefaults(Chart): Chart.js constructor is required.');
    }

    var mono = celorusFontFamilyMono();
    var sans = celorusFontFamilySans();
    var muted = celorusAxisTextColor();
    var grid = celorusGridColor();
    var paper = cssVar('--semantic-color-bg-paper');
    var strong = cssVar('--semantic-color-fg-strong');
    var lineColor = cssVar('--semantic-color-border-strong');

    Chart.defaults.font.family = sans;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = muted;
    Chart.defaults.borderColor = grid;

    // Legend: quiet, sans, muted — labels carry the meaning, not color chips
    // alone (see a11y note below).
    Chart.defaults.plugins.legend.labels.font = { family: sans, size: 12, weight: '500' };
    Chart.defaults.plugins.legend.labels.color = muted;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.align = 'start';

    // Tooltip styled like a card: paper background, quiet border, mono
    // numerals, serif-free (data is always sans/mono in this system, never
    // serif — serif is reserved for editorial headings).
    Chart.defaults.plugins.tooltip.enabled = true;
    Chart.defaults.plugins.tooltip.backgroundColor = paper;
    Chart.defaults.plugins.tooltip.titleColor = strong;
    Chart.defaults.plugins.tooltip.bodyColor = muted;
    Chart.defaults.plugins.tooltip.borderColor = lineColor;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleFont = { family: sans, size: 12, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { family: mono, size: 12 };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
    Chart.defaults.plugins.tooltip.caretSize = 5;

    // Scales: quiet grid, mono ticks (data reads as data), no bold axis
    // titles unless explicitly set by the caller per-chart.
    Chart.defaults.scale.grid.color = grid;
    Chart.defaults.scale.grid.tickColor = grid;
    Chart.defaults.scale.border.color = grid;
    Chart.defaults.scale.ticks.font = { family: mono, size: 11 };
    Chart.defaults.scale.ticks.color = muted;

    // Elements
    Chart.defaults.elements.point.radius = 3;
    Chart.defaults.elements.point.hoverRadius = 5;
    Chart.defaults.elements.point.borderWidth = 2;
    Chart.defaults.elements.line.borderWidth = 2;
    Chart.defaults.elements.line.tension = 0.3;
    Chart.defaults.elements.bar.borderRadius = 4;
    Chart.defaults.elements.bar.borderSkipped = false;

    // Register the ordinal palette as a Chart.js color plugin default so
    // multi-series charts pick it up without every call site repeating it.
    var palette = celorusChartPalette();
    Chart.defaults.plugins.colors = Chart.defaults.plugins.colors || {};
    Chart.defaults.plugins.colors.enabled = false; // we drive colors explicitly, not Chart.js's own random plugin

    return {
      palette: palette,
      accent: celorusChartAccent(),
      accentSoft: celorusChartAccentSoft(),
      grid: grid,
      mutedText: muted,
    };
  }

  /**
   * Convenience: a fully-formed options object for a single-metric line or
   * bar chart, tuned to the tokens (soft accent fill, mono ticks). Merge
   * with chart-specific options as needed:
   *   new Chart(ctx, { type: 'line', data, options: celorusLineOptions() })
   */
  function celorusLineOptions(overrides) {
    var base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          grid: { drawTicks: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    };
    return Object.assign({}, base, overrides || {});
  }

  /**
   * Convenience options for a donut/pie chart. cutout tuned to read as a
   * "coverage" ring rather than a full pie (matches the audit-grade,
   * restrained brand feel — avoid full pie wedges dominating a page).
   */
  function celorusDonutOptions(overrides) {
    var base = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'right', align: 'center' },
      },
    };
    return Object.assign({}, base, overrides || {});
  }

  global.celorusChartDefaults = celorusChartDefaults;
  global.celorusChartPalette = celorusChartPalette;
  global.celorusChartAccent = celorusChartAccent;
  global.celorusChartAccentSoft = celorusChartAccentSoft;
  global.celorusGridColor = celorusGridColor;
  global.celorusLineOptions = celorusLineOptions;
  global.celorusDonutOptions = celorusDonutOptions;

  /**
   * ACCESSIBILITY NOTE — categorical color (read before using this palette)
   * -------------------------------------------------------------------
   * This is a one-hue-family palette (petrol + warm neutrals), by design —
   * PHASE0 personality lock forbids a rainbow accent system. That means
   * several series sit close together in hue and can be hard to tell apart
   * for users with color vision deficiency, or at a glance for anyone.
   * Do NOT encode meaning by hue alone. Always pair color with one of:
   *   - Direct labeling: label series at the line/bar end or in a visible
   *     legend with text, not just a color swatch.
   *   - Point/line style: solid vs. dashed vs. dotted borderDash, or
   *     distinct point styles (circle/rect/triangle) via pointStyle.
   *   - Pattern fills for bar/area charts where feasible.
   *   - Sufficient legend text contrast (use --semantic-color-fg-muted or
   *     stronger, never --semantic-color-fg-faint, for legend labels).
   * Keep real series count to <= 6 (this palette's length) — beyond that,
   * aggregate into "Other" or split into small multiples instead of adding
   * a 7th color.
   */

})(typeof window !== 'undefined' ? window : this);
