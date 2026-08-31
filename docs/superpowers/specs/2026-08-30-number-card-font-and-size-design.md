# Font style, font size, and two-color spacing fix for the number card builder

## Problem

The number card builder ([centerpieces-builder.html](../../../centerpieces-builder.html)) currently renders digits in a single fixed font (Instrument Sans, bold) at a single auto-fit size with no user control over either. Charlie wants to offer a few font styles (including some that fit an "upscale event" aesthetic) and a way to size the digits up or down.

Separately, there's a real rendering bug: in two-color mode, when the card has 2 or 3 digits, the outline around each digit visibly overlaps into its neighbor — "it bubbles out and then they run into each other," per Charlie. Root cause: `drawCard` in [centerpieces-builder.js](../../../centerpieces-builder.js) draws the whole digit string as one `strokeText`/`fillText` call, so the browser lays out characters using their normal (fill-only) advance widths — with no extra room reserved for the stroke's outward bulge. A single digit has no neighbor to collide with, so the bug only shows up at 2+ digits, matching what Charlie described.

## Goals

- A **font style** control (`<select>`) offering 5 options: Bold Sans (today's default, Instrument Sans), Monospace (IBM Plex Mono), Classic Serif (Playfair Display), Refined Serif (Cormorant Garamond), and Script (Great Vibes) — the last three newly added specifically to give an "upscale event" customer stylistic range beyond the current single sans-serif look.
- A **font size** control (range slider, labeled Small→Large) that scales digits up or down from today's auto-fit size. Defaults to the middle position, which must render identically to today's current default appearance (no visual regression for anyone who doesn't touch it). Internally bounded so no slider position can push text past the card's edges, regardless of digit count or dimensions.
- Fix the two-color outline collision: digits must never visually merge into one another, at any digit count (1-3), any outline thickness, any font, or any card size within the existing 20-200mm range.
- Both new controls apply identically to the live preview and the exported PDF (same `drawCard` function drives both, unchanged principle from the original design).

## Non-goals

- Custom/uploaded fonts, or more than these 5 options.
- An exact numeric font-size input (Charlie explicitly chose the bounded slider over a precise number field, since it can't produce an overflowing card).
- Any change to the digits/dimensions/color controls already built.

## Approach

**Font style**: a `fontFamily` key added to `state` (e.g. `"sans"`, `"mono"`, `"serif"`, `"serifLight"`, `"script"`), driving a small lookup table (`FONT_OPTIONS`) that maps each key to its CSS font-family string and weight. `drawCard` reads the current option's family/weight instead of the hardcoded `CARD_FONT_FAMILY` constant. The three new font families are added to the builder page's own Google Fonts `<link>` tag (the main site's `index.html` is untouched, consistent with this page already having its own font/CSS/JS files).

**Font size**: a `fontSizeScale` number added to `state` (range ~0.6-1.3, default 1.0, driven by an `<input type="range">`). `drawCard` multiplies its auto-fit base size by this scale before running its existing width-fit clamp — so the slider requests a size, but the render function still guarantees it never overflows the card (the existing clamp-to-`maxTextWidth` logic already does this; it just needs to run after the scale is applied, plus a height ceiling so a single wide-card digit at "Large" can't exceed the card's vertical space either).

**Two-color spacing fix**: `drawCard` switches from one whole-string `fillText`/`strokeText` call to drawing each character individually at a manually computed x-position, inserting a gap between characters equal to the current stroke width when in two-color mode (0 gap in solid mode, so solid-mode layout is visually unchanged). This is computed as part of the same width-fit-and-scale pass, so a 3-digit two-color card still shrinks to fit the card exactly as before — it just also reserves breathing room between digits so their outlines can't touch.

Rejected alternative: shrinking the outline's `lineWidth` ratio instead of adding a gap. This would reduce the collision risk but not eliminate it (a thinner outline is still a visual style choice Charlie should keep control of, not something to water down to dodge a layout bug), and it doesn't generalize — a wide font or a future change could reintroduce collisions. Reserving explicit spacing fixes the actual cause.

## Component design

**`centerpieces-builder.html`**: two new `.field` blocks inserted after the Digits field, before Background color — a `<select id="fontFamilyInput">` with the 5 labeled options, and a `<input type="range" id="fontSizeInput" min="0.6" max="1.3" step="0.05" value="1">` flanked by "Small"/"Large" text. The `<head>`'s Google Fonts link gains `Playfair+Display:wght@700`, `Cormorant+Garamond:wght@600;700`, and `Great+Vibes`.

**`centerpieces-builder.js`**:
- `FONT_OPTIONS` lookup table (key → `{ label, cssFamily, weight }`), replacing the single `CARD_FONT_FAMILY` constant.
- `state.fontFamily` (default `"sans"`) and `state.fontSizeScale` (default `1`) added to the existing state shape.
- `drawCard(ctx, pxWidth, pxHeight, cardState)` — same signature, same callers (live preview + PDF export unchanged) — internally reworked to: look up the selected font option; compute a base font size from `maxTextHeight * cardState.fontSizeScale`, clamped to a hard ceiling so it can never exceed the canvas height; measure each character individually and compute a total width (including inter-character gap when two-color); scale down to fit `maxTextWidth` if needed (recomputing per-character widths and the gap at the new size); then draw each character at its computed x position, centered as a block, using the existing fill-only or stroke-then-fill approach per character instead of per whole string.
- New `<select>`/`<input type="range">` event listeners mirroring the existing pattern (update `state`, call `renderPreview()`).

## Testing

- Visual check: 1, 2, and 3 digits in two-color mode, across all 5 fonts, confirm no outline overlap at any digit count and that digits remain legibly spaced (not excessively far apart either).
- Visual check: font size slider at min/mid/max, confirm text never touches the card edges and the mid position matches today's current default rendering exactly (regression check).
- Visual check: switching between solid and two-color mode at the same digits doesn't cause a jarring reflow (character positions should be visually consistent, since solid mode's gap is 0 and matches the prior native-layout look).
- Confirm the exported PDF matches the live preview for a non-default font + size + two-color combination (same `drawCard` function, so this should hold by construction, but verify once end-to-end).
