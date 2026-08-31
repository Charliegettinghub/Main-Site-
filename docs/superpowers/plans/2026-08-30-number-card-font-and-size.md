# Number Card Font Style, Font Size, and Two-Color Spacing Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a font-style dropdown (5 options) and a bounded font-size slider to the number card builder, and fix a real rendering bug where two-color mode's outlines visibly overlap between digits whenever the card has 2 or 3 digits.

**Architecture:** `drawCard` in `centerpieces-builder.js` — the single function that drives both the live preview and the exported PDF — is reworked to draw each character individually (instead of the whole digit string in one call), inserting an explicit gap between characters sized to the current outline thickness in two-color mode. This same rework is what makes font-family/font-size selectable: the character-by-character layout reads the chosen font and size from `state` on every draw. No new files; three existing files gain scoped additions.

**Tech Stack:** Plain HTML/CSS/vanilla JS (unchanged from the rest of the site — no build step, no framework).

## Global Constraints

- No build step, no npm, no new frameworks or CDN scripts beyond the Google Fonts `<link>` already used by this page.
- Only `centerpieces-builder.html`, `centerpieces-builder.css`, and `centerpieces-builder.js` may change — `index.html`, `styles.css`, and `script.js` are untouched (this is a builder-page-only feature, consistent with how the page was originally built).
- 5 font options, exact keys/labels/CSS families/weights: `sans` "Bold Sans" `'"Instrument Sans", sans-serif'` weight `700` (today's existing default — must render pixel-identical to current behavior when selected); `mono` "Monospace" `'"IBM Plex Mono", monospace'` weight `600`; `serif` "Classic Serif" `'"Playfair Display", serif'` weight `700`; `serifLight` "Refined Serif" `'"Cormorant Garamond", serif'` weight `600`; `script` "Script" `'"Great Vibes", cursive'` weight `400`.
- Font size slider: `min="0.6" max="1.3" step="0.05" value="1"` — default (`1`) must render identically to the current auto-fit behavior (no regression for anyone who doesn't touch the slider).
- The font-size scale must never be able to push text past the card's edges, at any digit count or card aspect ratio — this is enforced inside `drawCard` itself (a height ceiling plus the existing width-fit-and-shrink pass), not by restricting the slider's range alone.
- Two-color mode: characters must never visually overlap at 1, 2, or 3 digits, regardless of font or outline thickness. Solid mode's character layout must be visually unchanged from today (zero inter-character gap, same as the browser's native single-string layout).
- `drawCard(ctx, pxWidth, pxHeight, cardState)` keeps its exact existing signature — both callers (`renderPreview()` and `buildCardImageDataUrl()`) are unchanged by this plan.
- The full design spec is at `docs/superpowers/specs/2026-08-30-number-card-font-and-size-design.md`.

---

### Task 1: Add font style and font size controls to the page

**Files:**
- Modify: `centerpieces-builder.html` (Google Fonts `<link>` in `<head>`, and two new `.field` blocks in `.builder__controls`)
- Modify: `centerpieces-builder.css` (styling for the new `<select>` and `<input type="range">`)

**Interfaces:**
- Produces: `#fontFamilyInput` (a `<select>` with values `sans`/`mono`/`serif`/`serifLight`/`script`) and `#fontSizeInput` (a range input, value `0.6`-`1.3`) — both consumed by Task 2's JS wiring. No behavior yet; this task is markup/CSS only.

- [ ] **Step 1: Add the three new font families to the Google Fonts link**

In `centerpieces-builder.html`, replace the existing Google Fonts `<link>` (currently around line 11):

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
```

with:

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=Playfair+Display:wght@700&family=Cormorant+Garamond:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Insert the two new field blocks**

In `centerpieces-builder.html`, insert this markup immediately after the Digits `.field` block and before the Background color `.field` block (currently: Digits field ends at line 71 with `</div>`, Background color field starts at line 73 with `<div class="field">`):

```html
      <div class="field">
        <label class="field__label" for="fontFamilyInput">Font style</label>
        <select id="fontFamilyInput">
          <option value="sans" selected>Bold Sans</option>
          <option value="mono">Monospace</option>
          <option value="serif">Classic Serif</option>
          <option value="serifLight">Refined Serif</option>
          <option value="script">Script</option>
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="fontSizeInput">Font size</label>
        <div class="field__row">
          <span class="field__hint">Small</span>
          <input type="range" id="fontSizeInput" min="0.6" max="1.3" step="0.05" value="1">
          <span class="field__hint">Large</span>
        </div>
      </div>
```

So the file reads (Digits field, then the two new fields, then Background color field):

```html
      <div class="field">
        <label class="field__label" for="digitsInput">Digits</label>
        <input type="text" id="digitsInput" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="5" aria-describedby="digitsError">
        <p class="field__error" id="digitsError" hidden>Enter 1-3 digits (0-9).</p>
      </div>

      <div class="field">
        <label class="field__label" for="fontFamilyInput">Font style</label>
        <select id="fontFamilyInput">
          <option value="sans" selected>Bold Sans</option>
          <option value="mono">Monospace</option>
          <option value="serif">Classic Serif</option>
          <option value="serifLight">Refined Serif</option>
          <option value="script">Script</option>
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="fontSizeInput">Font size</label>
        <div class="field__row">
          <span class="field__hint">Small</span>
          <input type="range" id="fontSizeInput" min="0.6" max="1.3" step="0.05" value="1">
          <span class="field__hint">Large</span>
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="bgColorInput">Background color</label>
        <input type="color" id="bgColorInput" value="#1b1c1e">
      </div>
```

- [ ] **Step 3: Style the new controls**

In `centerpieces-builder.css`, add after the existing `.field input[type="color"] { ... }` rule (currently ends around line 170) and before `.mode-toggle { ... }`:

```css
.field select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  color: var(--ink-0);
  font-family: var(--font-body);
  font-size: 1rem;
  padding: 0.6rem 0.75rem;
  width: 100%;
  cursor: pointer;
}

.field input[type="range"] {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}
```

Then update the existing focus-visible rule so it also covers the new `<select>`. Replace:

```css
.field input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

with:

```css
.field input:focus-visible,
.field select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

- [ ] **Step 4: Verify the new controls render correctly**

Start the dev server preview and load `centerpieces-builder.html`.

Run: `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`.
Expected: no errors (the controls aren't wired to any JS yet, so interacting with them won't visibly change the canvas — that's expected at this step).

Run: `mcp__Claude_Browser__computer` with `action: "screenshot"`.
Expected: a "Font style" dropdown (showing "Bold Sans") and a "Font size" slider (labeled Small/Large) appear between the Digits field and the Background color field, styled consistently with the rest of the form (dark background, light border, matching the color/number inputs).

- [ ] **Step 5: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add centerpieces-builder.html centerpieces-builder.css
git commit -m "Add font style and font size controls to the number card builder"
```

---

### Task 2: Rework drawCard for selectable fonts, bounded sizing, and per-character spacing

**Files:**
- Modify: `centerpieces-builder.js`

**Interfaces:**
- Consumes: `#fontFamilyInput`, `#fontSizeInput` from Task 1.
- Produces: `state.fontFamily` (default `"sans"`), `state.fontSizeScale` (default `1`), `FONT_OPTIONS` lookup table. `drawCard(ctx, pxWidth, pxHeight, cardState)` keeps its exact existing signature and remains the single function used by both `renderPreview()` and `buildCardImageDataUrl()` — no changes to either of those callers.

- [ ] **Step 1: Add the two new state fields**

In `centerpieces-builder.js`, in the `state` object (currently lines 6-15), add two new properties:

```javascript
const state = {
  lengthMm: 90,
  widthMm: 60,
  digits: "5",
  bgColor: "#1b1c1e",
  textMode: "solid",
  solidColor: "#f1efec",
  innerColor: "#f1efec",
  outlineColor: "#ff7a33",
  fontFamily: "sans",
  fontSizeScale: 1,
};
```

- [ ] **Step 2: Replace `CARD_FONT_FAMILY` with the `FONT_OPTIONS` lookup table**

Replace this line:

```javascript
const CARD_FONT_FAMILY = '"Instrument Sans", sans-serif';
```

with:

```javascript
const FONT_OPTIONS = {
  sans: { label: "Bold Sans", cssFamily: '"Instrument Sans", sans-serif', weight: 700 },
  mono: { label: "Monospace", cssFamily: '"IBM Plex Mono", monospace', weight: 600 },
  serif: { label: "Classic Serif", cssFamily: '"Playfair Display", serif', weight: 700 },
  serifLight: { label: "Refined Serif", cssFamily: '"Cormorant Garamond", serif', weight: 600 },
  script: { label: "Script", cssFamily: '"Great Vibes", cursive', weight: 400 },
};
```

- [ ] **Step 3: Replace `drawCard` with the per-character layout version**

Replace the entire existing `drawCard` function (currently lines 30-71, from the `// Draws the card...` comment through the closing `}`) with:

```javascript
// Draws the card (background + digits) into any 2D canvas context.
// Reused unchanged by the on-screen preview and the offscreen PDF export
// canvas, so the two can never visually drift apart.
function drawCard(ctx, pxWidth, pxHeight, cardState) {
  ctx.clearRect(0, 0, pxWidth, pxHeight);

  ctx.fillStyle = cardState.bgColor;
  ctx.fillRect(0, 0, pxWidth, pxHeight);

  const text = cardState.digits;
  if (!text) return;

  const chars = text.split("");
  const isTwoColor = cardState.textMode === "two-color";
  const fontOption = FONT_OPTIONS[cardState.fontFamily] || FONT_OPTIONS.sans;

  const maxTextWidth = pxWidth * 0.86;
  const maxTextHeight = pxHeight * 0.8;
  const heightCeiling = pxHeight * 0.92;

  let fontSize = Math.min(maxTextHeight * cardState.fontSizeScale, heightCeiling);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  // Measures per-character widths and the total block width (including an
  // inter-character gap in two-color mode) at a given font size. The gap
  // equals the outline's own stroke width, so adjacent digits' outlines —
  // which each bulge outward by roughly half their stroke width — can never
  // touch, regardless of digit count or how thick the outline is.
  function measureLayout(size) {
    ctx.font = `${fontOption.weight} ${size}px ${fontOption.cssFamily}`;
    const strokeWidth = isTwoColor ? size * 0.16 : 0;
    const gap = isTwoColor ? strokeWidth : 0;
    const widths = chars.map((c) => ctx.measureText(c).width);
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (chars.length - 1);
    return { widths, totalWidth, strokeWidth, gap };
  }

  let layout = measureLayout(fontSize);
  if (layout.totalWidth > maxTextWidth) {
    fontSize *= maxTextWidth / layout.totalWidth;
    layout = measureLayout(fontSize);
  }

  const cx = pxWidth / 2;
  const cy = pxHeight / 2;
  let x = cx - layout.totalWidth / 2;

  chars.forEach((char, i) => {
    if (isTwoColor) {
      ctx.lineWidth = layout.strokeWidth;
      ctx.strokeStyle = cardState.outlineColor;
      ctx.strokeText(char, x, cy);
      ctx.fillStyle = cardState.innerColor;
      ctx.fillText(char, x, cy);
    } else {
      ctx.fillStyle = cardState.solidColor;
      ctx.fillText(char, x, cy);
    }
    x += layout.widths[i] + layout.gap;
  });
}
```

- [ ] **Step 4: Wire the new controls to state and re-render**

In `centerpieces-builder.js`, after the existing element references (currently around line 115, after `const outlineColorInput = document.getElementById("outlineColorInput");`), add:

```javascript
const fontFamilyInput = document.getElementById("fontFamilyInput");
const fontSizeInput = document.getElementById("fontSizeInput");
```

Then, after the existing `outlineColorInput.addEventListener(...)` block (currently around lines 173-176), add:

```javascript
fontFamilyInput.addEventListener("change", () => {
  state.fontFamily = fontFamilyInput.value;
  renderPreview();
});

fontSizeInput.addEventListener("input", () => {
  state.fontSizeScale = parseFloat(fontSizeInput.value);
  renderPreview();
});
```

- [ ] **Step 5: Verify no console errors and every control triggers a redraw**

Reload `centerpieces-builder.html` in the browser preview.

Run `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`.
Expected: no errors.

Run `mcp__Claude_Browser__javascript_tool` with:
```javascript
document.getElementById("previewCanvas").getContext("2d").getImageData(2, 2, 1, 1).data.slice(0, 3).join(",")
```
Expected: `27,28,30` (the default `#1b1c1e` background, confirming the page still renders correctly after the `drawCard` rewrite).

Change the font style dropdown to `"mono"` (use `mcp__Claude_Browser__form_input` on the `#fontFamilyInput` select), then run:
```javascript
state.fontFamily
```
Expected: `"mono"`.

Move the font size slider to its max (`form_input` value `1.3` on `#fontSizeInput`), then run:
```javascript
state.fontSizeScale
```
Expected: `1.3`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add centerpieces-builder.js
git commit -m "Add selectable font style/size and fix two-color outline collision between digits"
```

---

### Task 3: Cross-cutting verification

**Files:** none (verification only — no code changes expected unless a check below fails, in which case fix the relevant file from Tasks 1-2 and re-run that task's verification steps before continuing).

- [ ] **Step 1: Verify the two-color collision bug is actually fixed at 1, 2, and 3 digits**

Reload `centerpieces-builder.html`. Set text mode to two-color (click `#textModeTwoColor`), set inner color and outline color to visually distinct values (e.g. `#f1efec` inner, `#ff7a33` outline — the existing defaults already are distinct).

For each of `digits = "5"`, `digits = "05"`, `digits = "056"` (set via `mcp__Claude_Browser__form_input` on `#digitsInput`, dispatching an `input` event), run:
```javascript
mcp__Claude_Browser__computer with action: "screenshot"
```
Expected: at every digit count, each digit's outline is clearly separated from its neighbors — no visual merging/bubbling between adjacent digits' outlines. Compare the 3-digit case in particular against the pre-fix behavior described by Charlie ("bubbles out and then they run into each other") — it must not reproduce.

- [ ] **Step 2: Verify the font size slider never overflows the card**

With `digits = "056"` and two-color mode still active, move `#fontSizeInput` to its max value (`1.3`) via `form_input`, then screenshot.
Expected: digits stay fully inside the card's visible bounds — no clipping at the top/bottom/left/right edges of the canvas.

- [ ] **Step 3: Verify the default appearance is unchanged (regression check)**

Reload `centerpieces-builder.html` fresh (default state: `digits = "5"`, solid mode, `fontFamily = "sans"`, `fontSizeScale = 1`). Run:
```javascript
document.getElementById("previewCanvas").toDataURL()
```
Note the result isn't compared against a stored baseline (none exists), but confirm via screenshot that the single "5" renders large, bold, and centered — visually matching the tool's appearance from before this plan's changes (same font, same size, same position).

- [ ] **Step 4: Verify all 5 fonts render without errors**

For each font option (`sans`, `mono`, `serif`, `serifLight`, `script`), select it via `form_input` on `#fontFamilyInput`, then run `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`.
Expected: no errors for any of the 5 fonts (confirms all three new Google Fonts families actually loaded and are usable by canvas).

- [ ] **Step 5: Verify the exported PDF matches the live preview for a non-default combination**

Set `digits = "42"`, `fontFamily = "serif"`, `fontSizeScale = 1.15`, two-color mode with distinct colors. Run `mcp__Claude_Browser__javascript_tool` with:
```javascript
(() => {
  const dataUrl = buildCardImageDataUrl(state.lengthMm, state.widthMm, state);
  return dataUrl.startsWith("data:image/png;base64,") && dataUrl.length > 1000;
})()
```
Expected: `true` (confirms `buildCardImageDataUrl` — which drives the PDF — runs cleanly through the reworked `drawCard` with the new font/size state, not just the live preview path).

No commit needed for this task (verification only, no file changes expected).
