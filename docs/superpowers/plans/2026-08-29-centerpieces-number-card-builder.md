# Centerpieces Number Card Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone page, `centerpieces-builder.html`, where customers (and Charlie) can set exact mm dimensions, digit text (1-3 numeric characters), and colors (solid or two-color fill+outline) for a centerpiece number card, see a live preview, and download an exact-size, print-ready PDF for cutting.

**Architecture:** A single shared drawing function (`drawCard`) renders the card onto any canvas context — reused unchanged for both the on-screen live preview and a high-resolution offscreen canvas used to build the PDF, so the two can never visually drift apart. The offscreen canvas is rasterized to a PNG data URL and embedded into a [jsPDF](https://github.com/parallax/jsPDF) document sized exactly to the chosen mm dimensions. No backend, no build step, no npm — vanilla JS/CSS/HTML matching the rest of the site, with jsPDF vendored as a single local file (not loaded from a CDN).

**Tech Stack:** Plain HTML/CSS/vanilla JS (static site, no framework, no bundler, no test runner). One vendored third-party file: jsPDF 2.5.1 UMD build.

## Global Constraints

- No CDN scripts at runtime — jsPDF must be vendored locally at `assets/vendor/jspdf.umd.min.js` (confirmed downloadable from `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`, 364,463 bytes, exposes the browser global `window.jspdf.jsPDF`).
- No build step, no npm, no new frameworks — plain `<script>` tags, matching `index.html`/`script.js`.
- New page must reuse `styles.css`'s existing CSS custom properties (`--bg-0`, `--bg-1`, `--bg-2`, `--ink-0`, `--ink-1`, `--ink-2`, `--accent`, `--accent-fill`, `--line`, `--line-strong`, `--shadow`, `--shadow-lg`, `--font-display`, `--font-body`, `--font-mono`, `--ease`) and existing `.btn`/`.btn--fill`/`.btn--outline`/`.card` classes rather than redefining them, so the tool matches the main site's dark-grey theme automatically.
- Length/width range: 20mm-200mm, clamped (not silently rejected) with an inline hint when a typed value is out of range.
- Digits field: 1-3 numeric characters only (e.g. `5`, `05`, `056`); non-numeric input stripped.
- Downloaded filename convention: `centerpiece-card-<digits>.pdf`.
- "Length" maps to the card's horizontal (X) dimension, "Width" to its vertical (Y) dimension, consistently across the preview canvas and the exported PDF.
- The design spec is at `docs/superpowers/specs/2026-08-29-centerpieces-number-card-builder-design.md` — this plan implements it in full.

---

### Task 1: Vendor jsPDF and build the page skeleton

**Files:**
- Create: `assets/vendor/jspdf.umd.min.js`
- Create: `centerpieces-builder.html`

**Interfaces:**
- Produces: the DOM structure and element IDs that Task 2 (CSS) and Task 3/4 (JS) target: `#previewCanvas`, `#lengthInput`, `#lengthInchHint`, `#lengthClampHint`, `#widthInput`, `#widthInchHint`, `#widthClampHint`, `#digitsInput`, `#digitsError`, `#bgColorInput`, `#textModeSolid`, `#textModeTwoColor`, `#solidColorField` (containing `#solidColorInput`), `#twoColorField` (containing `#innerColorInput`, `#outlineColorInput`), `#downloadBtn`, `#downloadHint`. Also produces the vendored global `window.jspdf.jsPDF`.

- [ ] **Step 1: Download and vendor jsPDF**

```bash
cd "/Users/charlie/Desktop/Claude Code"
mkdir -p assets/vendor
curl -sL -o assets/vendor/jspdf.umd.min.js https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
wc -c assets/vendor/jspdf.umd.min.js
head -c 60 assets/vendor/jspdf.umd.min.js
```

Expected: `wc -c` reports `364463` bytes; the file starts with `/** @license`.

- [ ] **Step 2: Create the page skeleton**

Create `centerpieces-builder.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Number Card Builder — Charlie Williams Centerpieces</title>
<meta name="description" content="Build a custom centerpiece number card — set exact dimensions, digits, and colors, then download a print-ready PDF.">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">

<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="centerpieces-builder.css">
</head>
<body>

<div class="grid-bg" aria-hidden="true"></div>
<div class="grid-bg grid-bg--spotlight" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>

<header class="nav" id="nav">
  <a class="nav__mark" href="index.html" aria-label="Home">
    <span class="nav__logo" role="img" aria-label="Charlie Williams logo mark"></span>
  </a>
  <nav class="nav__links" aria-label="Primary">
    <a href="index.html#centerpieces">← Back to site</a>
  </nav>
</header>

<main id="main">
  <div class="builder">
    <div class="builder__preview">
      <div class="builder__canvas-frame">
        <canvas id="previewCanvas" width="360" height="360" aria-label="Live preview of the number card"></canvas>
      </div>
      <button class="btn btn--fill" id="downloadBtn" type="button" disabled>Download PDF</button>
      <p class="builder__hint" id="downloadHint">Print at 100% / actual size — not "fit to page" — for exact dimensions.</p>
    </div>

    <div class="builder__controls">
      <div class="builder__intro">
        <h1>Number Card Builder</h1>
        <p>Set exact dimensions, digits, and colors for your centerpiece number card, then download a print-ready PDF sized precisely to what you choose.</p>
      </div>

      <div class="field">
        <label class="field__label" for="lengthInput">Length (horizontal)</label>
        <div class="field__row">
          <input type="number" id="lengthInput" min="20" max="200" step="0.5" value="90">
          <span class="field__hint">mm <span id="lengthInchHint">(3.54")</span></span>
        </div>
        <p class="field__error" id="lengthClampHint" hidden></p>
      </div>

      <div class="field">
        <label class="field__label" for="widthInput">Width (vertical)</label>
        <div class="field__row">
          <input type="number" id="widthInput" min="20" max="200" step="0.5" value="60">
          <span class="field__hint">mm <span id="widthInchHint">(2.36")</span></span>
        </div>
        <p class="field__error" id="widthClampHint" hidden></p>
      </div>

      <div class="field">
        <label class="field__label" for="digitsInput">Digits</label>
        <input type="text" id="digitsInput" maxlength="3" inputmode="numeric" pattern="[0-9]*" value="5">
        <p class="field__error" id="digitsError" hidden>Enter 1-3 digits (0-9).</p>
      </div>

      <div class="field">
        <label class="field__label" for="bgColorInput">Background color</label>
        <input type="color" id="bgColorInput" value="#1b1c1e">
      </div>

      <div class="field">
        <span class="field__label">Text color</span>
        <div class="mode-toggle">
          <label><input type="radio" name="textMode" id="textModeSolid" value="solid" checked> Solid</label>
          <label><input type="radio" name="textMode" id="textModeTwoColor" value="two-color"> Two-color</label>
        </div>

        <div class="field__row" id="solidColorField">
          <label class="field__hint" for="solidColorInput">Color</label>
          <input type="color" id="solidColorInput" value="#f1efec">
        </div>

        <div class="field__row" id="twoColorField" hidden>
          <label class="field__hint" for="innerColorInput">Inner</label>
          <input type="color" id="innerColorInput" value="#f1efec">
          <label class="field__hint" for="outlineColorInput">Outline</label>
          <input type="color" id="outlineColorInput" value="#ff7a33">
        </div>
      </div>
    </div>
  </div>
</main>

<footer class="footer">
  <span>© <span id="year"></span> Charlie Williams</span>
  <span class="footer__rev">SITE REV. 01</span>
</footer>

<script src="assets/vendor/jspdf.umd.min.js"></script>
<script src="script.js"></script>
<script src="centerpieces-builder.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify the page loads with no console errors and jsPDF is available**

Start the dev server preview (`mcp__Claude_Browser__preview_start`) pointed at this static site, then navigate to `centerpieces-builder.html`.

Run: `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`.
Expected: no errors (note: `centerpieces-builder.js` doesn't exist yet, so a 404/`net::ERR` for that specific script is expected at this step only — every other resource, including `assets/vendor/jspdf.umd.min.js` and `script.js`, must load clean).

Run: `mcp__Claude_Browser__javascript_tool` with `typeof window.jspdf.jsPDF`.
Expected: `"function"`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add assets/vendor/jspdf.umd.min.js centerpieces-builder.html
git commit -m "Add number card builder page skeleton and vendor jsPDF"
```

---

### Task 2: Style the builder page

**Files:**
- Create: `centerpieces-builder.css`

**Interfaces:**
- Consumes: the element IDs/classes from Task 1 (`.builder`, `.builder__preview`, `.builder__canvas-frame`, `#previewCanvas`, `.builder__controls`, `.builder__intro`, `.field`, `.field__label`, `.field__row`, `.field__hint`, `.field__error`, `.mode-toggle`, `#solidColorField`, `#twoColorField`, `.builder__hint`) and the site-wide CSS custom properties from `styles.css`.
- Produces: nothing consumed by later tasks (pure styling).

- [ ] **Step 1: Write the builder page CSS**

Create `centerpieces-builder.css`:

```css
body {
  min-height: 100vh;
}

.builder {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 3rem;
  padding: 8rem clamp(1.25rem, 6vw, 5rem) 6rem;
  max-width: 1280px;
  margin: 0 auto;
  align-items: start;
  position: relative;
  z-index: 2;
}

@media (max-width: 860px) {
  .builder {
    grid-template-columns: 1fr;
  }
}

.builder__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  position: sticky;
  top: 6rem;
}

@media (max-width: 860px) {
  .builder__preview {
    position: static;
  }
}

.builder__canvas-frame {
  background: var(--bg-1);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  width: 100%;
}

#previewCanvas {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.builder__hint {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--ink-2);
  text-align: center;
  max-width: 320px;
}

.builder__intro h1 {
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  color: var(--ink-0);
  margin-bottom: 0.75rem;
}

.builder__intro p {
  color: var(--ink-1);
  margin-bottom: 2.5rem;
  line-height: 1.6;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.75rem;
}

.field__label {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-1);
}

.field__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.field__hint {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--ink-2);
}

.field__error {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--accent);
}

.field input[type="number"],
.field input[type="text"] {
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
}

.field input[type="number"] {
  max-width: 8rem;
}

.field input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.field input[type="color"] {
  width: 3rem;
  height: 2.4rem;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--bg-2);
  cursor: pointer;
}

.mode-toggle {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 0.75rem;
}

.mode-toggle label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--ink-1);
  cursor: pointer;
}

.mode-toggle input {
  accent-color: var(--accent);
}
```

- [ ] **Step 2: Verify visual styling**

Reload `centerpieces-builder.html` in the browser preview.

Run: `mcp__Claude_Browser__computer` with `action: "screenshot"`.
Expected: two-column layout (canvas frame + download button on the left, form fields on the right) on a desktop-width viewport, using the same dark-grey theme as the main site (dark card background, light text, orange accent visible on the color mode toggle/focus states).

Run: `mcp__Claude_Browser__resize_window` with `preset: "mobile"`, then screenshot again.
Expected: layout stacks to a single column, no horizontal overflow.

Run: `mcp__Claude_Browser__resize_window` with `preset: "desktop"` to reset.

- [ ] **Step 3: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add centerpieces-builder.css
git commit -m "Style the number card builder page"
```

---

### Task 3: Card rendering and live preview

**Files:**
- Create: `centerpieces-builder.js`

**Interfaces:**
- Consumes: all element IDs from Task 1's markup.
- Produces: `state` (object: `{ lengthMm, widthMm, digits, bgColor, textMode, solidColor, innerColor, outlineColor }`), `drawCard(ctx, pxWidth, pxHeight, cardState)`, `clampMm(value)`, `sanitizeDigits(value)`, `renderPreview()` — all consumed by Task 4 (PDF export reuses `drawCard` and reads `state`).

- [ ] **Step 1: Write state, validation, and rendering logic**

Create `centerpieces-builder.js`:

```javascript
const MM_MIN = 20;
const MM_MAX = 200;
const MM_PER_INCH = 25.4;
const CARD_FONT_FAMILY = '"Instrument Sans", sans-serif';

const state = {
  lengthMm: 90,
  widthMm: 60,
  digits: "5",
  bgColor: "#1b1c1e",
  textMode: "solid",
  solidColor: "#f1efec",
  innerColor: "#f1efec",
  outlineColor: "#ff7a33",
};

function clampMm(value) {
  if (Number.isNaN(value)) return MM_MIN;
  return Math.min(MM_MAX, Math.max(MM_MIN, value));
}

function sanitizeDigits(value) {
  return value.replace(/[^0-9]/g, "").slice(0, 3);
}

function mmToInchLabel(mm) {
  return `(${(mm / MM_PER_INCH).toFixed(2)}")`;
}

// Draws the card (background + digits) into any 2D canvas context.
// Reused unchanged by the on-screen preview and the offscreen PDF export
// canvas, so the two can never visually drift apart.
function drawCard(ctx, pxWidth, pxHeight, cardState) {
  ctx.clearRect(0, 0, pxWidth, pxHeight);

  ctx.fillStyle = cardState.bgColor;
  ctx.fillRect(0, 0, pxWidth, pxHeight);

  const text = cardState.digits;
  if (!text) return;

  const maxTextWidth = pxWidth * 0.86;
  const maxTextHeight = pxHeight * 0.8;
  let fontSize = maxTextHeight;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px ${CARD_FONT_FAMILY}`;

  const measuredWidth = ctx.measureText(text).width;
  if (measuredWidth > maxTextWidth) {
    fontSize *= maxTextWidth / measuredWidth;
    ctx.font = `700 ${fontSize}px ${CARD_FONT_FAMILY}`;
  }

  const cx = pxWidth / 2;
  const cy = pxHeight / 2;

  if (cardState.textMode === "two-color") {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = fontSize * 0.16;
    ctx.strokeStyle = cardState.outlineColor;
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = cardState.innerColor;
    ctx.fillText(text, cx, cy);
  } else {
    ctx.fillStyle = cardState.solidColor;
    ctx.fillText(text, cx, cy);
  }
}

const previewCanvas = document.getElementById("previewCanvas");
const PREVIEW_MAX_PX = 360;

function sizePreviewCanvas(lengthMm, widthMm) {
  const aspect = lengthMm / widthMm;
  let cssWidth, cssHeight;
  if (aspect >= 1) {
    cssWidth = PREVIEW_MAX_PX;
    cssHeight = PREVIEW_MAX_PX / aspect;
  } else {
    cssHeight = PREVIEW_MAX_PX;
    cssWidth = PREVIEW_MAX_PX * aspect;
  }
  const dpr = window.devicePixelRatio || 1;
  previewCanvas.style.width = `${cssWidth}px`;
  previewCanvas.style.height = `${cssHeight}px`;
  previewCanvas.width = Math.round(cssWidth * dpr);
  previewCanvas.height = Math.round(cssHeight * dpr);
}

function renderPreview() {
  sizePreviewCanvas(state.lengthMm, state.widthMm);
  const ctx = previewCanvas.getContext("2d");
  drawCard(ctx, previewCanvas.width, previewCanvas.height, state);
}

// --- Field wiring ---

const lengthInput = document.getElementById("lengthInput");
const lengthInchHint = document.getElementById("lengthInchHint");
const lengthClampHint = document.getElementById("lengthClampHint");
const widthInput = document.getElementById("widthInput");
const widthInchHint = document.getElementById("widthInchHint");
const widthClampHint = document.getElementById("widthClampHint");
const digitsInput = document.getElementById("digitsInput");
const digitsError = document.getElementById("digitsError");
const bgColorInput = document.getElementById("bgColorInput");
const textModeSolid = document.getElementById("textModeSolid");
const textModeTwoColor = document.getElementById("textModeTwoColor");
const solidColorField = document.getElementById("solidColorField");
const twoColorField = document.getElementById("twoColorField");
const solidColorInput = document.getElementById("solidColorInput");
const innerColorInput = document.getElementById("innerColorInput");
const outlineColorInput = document.getElementById("outlineColorInput");

function handleDimensionInput(input, hintEl, clampHintEl, key) {
  input.addEventListener("change", () => {
    const raw = parseFloat(input.value);
    const clamped = clampMm(raw);
    if (clamped !== raw) {
      clampHintEl.textContent = `Clamped to ${clamped}mm.`;
      clampHintEl.hidden = false;
    } else {
      clampHintEl.hidden = true;
    }
    input.value = clamped;
    state[key] = clamped;
    hintEl.textContent = mmToInchLabel(clamped);
    renderPreview();
  });
}

handleDimensionInput(lengthInput, lengthInchHint, lengthClampHint, "lengthMm");
handleDimensionInput(widthInput, widthInchHint, widthClampHint, "widthMm");

digitsInput.addEventListener("input", () => {
  const clean = sanitizeDigits(digitsInput.value);
  digitsInput.value = clean;
  state.digits = clean;
  digitsError.hidden = clean.length > 0;
  updateDownloadState();
  renderPreview();
});

bgColorInput.addEventListener("input", () => {
  state.bgColor = bgColorInput.value;
  renderPreview();
});

function setTextMode(mode) {
  state.textMode = mode;
  solidColorField.hidden = mode !== "solid";
  twoColorField.hidden = mode !== "two-color";
  renderPreview();
}

textModeSolid.addEventListener("change", () => {
  if (textModeSolid.checked) setTextMode("solid");
});
textModeTwoColor.addEventListener("change", () => {
  if (textModeTwoColor.checked) setTextMode("two-color");
});

solidColorInput.addEventListener("input", () => {
  state.solidColor = solidColorInput.value;
  renderPreview();
});
innerColorInput.addEventListener("input", () => {
  state.innerColor = innerColorInput.value;
  renderPreview();
});
outlineColorInput.addEventListener("input", () => {
  state.outlineColor = outlineColorInput.value;
  renderPreview();
});

const downloadBtn = document.getElementById("downloadBtn");

function updateDownloadState() {
  downloadBtn.disabled = state.digits.length === 0;
}

// Initial paint (immediate, using whatever font is available) plus a
// re-render once the web font finishes loading so the preview isn't
// left on a fallback font's metrics.
lengthInchHint.textContent = mmToInchLabel(state.lengthMm);
widthInchHint.textContent = mmToInchLabel(state.widthMm);
updateDownloadState();
renderPreview();
document.fonts.ready.then(renderPreview);
```

- [ ] **Step 2: Verify the live preview responds to every control**

Reload `centerpieces-builder.html`.

Run `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`.
Expected: no errors.

Run `mcp__Claude_Browser__javascript_tool` with:
```javascript
document.getElementById("previewCanvas").getContext("2d").getImageData(2, 2, 1, 1).data.slice(0, 3).join(",")
```
Expected: `27,28,30` (matches the default `#1b1c1e` background in the corner of the canvas, away from the digit).

Change the background color and re-check: run `mcp__Claude_Browser__form_input` on `bgColorInput`'s ref with value `#ff0000`, then re-run the same `getImageData` expression.
Expected: `255,0,0`.

Switch to two-color mode: click the `#textModeTwoColor` radio, then run:
```javascript
document.getElementById("twoColorField").hidden
```
Expected: `false`, and `document.getElementById("solidColorField").hidden` → `true`.

Type digits `056` into `#digitsInput` (use `mcp__Claude_Browser__form_input`), then check:
```javascript
document.getElementById("digitsInput").value
```
Expected: `"056"`. Then type `ab5c` and re-check the same expression.
Expected: `"5"` (non-numeric characters stripped).

Set the length field to `500` (out of range) via `form_input`, blur it (dispatch a `change` event or click elsewhere), then check:
```javascript
document.getElementById("lengthClampHint").hidden
```
Expected: `false`, and `document.getElementById("lengthInput").value` → `"200"`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add centerpieces-builder.js
git commit -m "Add live canvas preview and input validation to number card builder"
```

---

### Task 4: PDF export

**Files:**
- Modify: `centerpieces-builder.js` (append to the end of the file)

**Interfaces:**
- Consumes: `drawCard`, `state` from Task 3; `window.jspdf.jsPDF` from the vendored library (Task 1).
- Produces: nothing consumed by later tasks (this is the final builder behavior).

- [ ] **Step 1: Add the PDF export function and wire it to the button**

Append to `centerpieces-builder.js`:

```javascript
const PDF_DPI = 300;

function buildCardImageDataUrl(lengthMm, widthMm, cardState) {
  const pxWidth = Math.round((lengthMm / MM_PER_INCH) * PDF_DPI);
  const pxHeight = Math.round((widthMm / MM_PER_INCH) * PDF_DPI);
  const offscreen = document.createElement("canvas");
  offscreen.width = pxWidth;
  offscreen.height = pxHeight;
  const ctx = offscreen.getContext("2d");
  drawCard(ctx, pxWidth, pxHeight, cardState);
  return offscreen.toDataURL("image/png");
}

function downloadPdf() {
  const dataUrl = buildCardImageDataUrl(state.lengthMm, state.widthMm, state);
  // jsPDF's default "portrait" orientation silently swaps a custom
  // [w, h] format array whenever w > h, which would clip/misorient every
  // landscape-shaped card (the common case). Picking orientation to match
  // the card's own shape keeps the requested [lengthMm, widthMm] exact.
  const doc = new window.jspdf.jsPDF({
    orientation: state.lengthMm >= state.widthMm ? "l" : "p",
    unit: "mm",
    format: [state.lengthMm, state.widthMm],
  });
  doc.addImage(dataUrl, "PNG", 0, 0, state.lengthMm, state.widthMm);
  doc.save(`centerpiece-card-${state.digits}.pdf`);
}

downloadBtn.addEventListener("click", downloadPdf);
```

- [ ] **Step 2: Verify PDF generation produces a valid, exact-size document without triggering an actual browser save dialog**

Reload `centerpieces-builder.html`. Set digits to `42`, length to `90`, width to `50` via the form controls.

Run `mcp__Claude_Browser__javascript_tool` with:
```javascript
(() => {
  const dataUrl = buildCardImageDataUrl(90, 50, state);
  return dataUrl.startsWith("data:image/png;base64,") && dataUrl.length > 1000;
})()
```
Expected: `true`.

Run `mcp__Claude_Browser__javascript_tool` with:
```javascript
(() => {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: [90, 50] });
  return [doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight()];
})()
```
Expected: `[90, 50]` (the PDF page is sized exactly to the mm dimensions, independent of the browser/OS print dialog).

Run `mcp__Claude_Browser__javascript_tool` with:
```javascript
(() => { downloadPdf(); return "no throw"; })()
```
Expected: `"no throw"` (calling the handler directly proves the full export path — offscreen canvas render, PDF construction, `save()` — runs end-to-end without error using live page state; a real button click would trigger the browser's actual file-save flow, which the automated browser tool cannot complete/inspect).

- [ ] **Step 3: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add centerpieces-builder.js
git commit -m "Add exact-size PDF export to number card builder"
```

---

### Task 5: Link the builder from the Centerpieces pricing card

**Files:**
- Modify: `index.html:322-338` (the "Frame + Number Pegs" `.price-card`)

**Interfaces:**
- Consumes: `centerpieces-builder.html` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the CTA link**

In `index.html`, inside the `.price-card` that has `<span class="price-card__tag">Frame + Number Pegs</span>` (currently lines 322-338), add a link immediately after the closing `</div>` of `.price-card__addons` and before the closing `</article>`:

```html
        <a class="btn btn--outline price-card__cta" href="centerpieces-builder.html">Build your number card →</a>
```

So the full card becomes:

```html
      <article class="price-card price-card--feature">
        <span class="price-card__tag">Frame + Number Pegs</span>
        <h3>Oklahoma Centerpiece</h3>
        <p class="price-card__desc">Same frame, with custom number pegs added on.</p>
        <ul class="price-tiers">
          <li><span>1–19</span><span>$18</span></li>
          <li><span>20–39</span><span>$16</span></li>
          <li><span>40–69</span><span>$14</span></li>
          <li><span>70–99</span><span>$12</span></li>
          <li><span>100+</span><span>$11</span></li>
        </ul>
        <p class="price-card__unit">Priced per piece, plus numbers</p>
        <div class="price-card__addons">
          <div class="price-card__addon"><span>+ $1.00</span><span>per number, single color</span></div>
          <div class="price-card__addon"><span>+ $1.50</span><span>per number, two-color</span></div>
        </div>
        <a class="btn btn--outline price-card__cta" href="centerpieces-builder.html">Build your number card →</a>
      </article>
```

- [ ] **Step 2: Verify the link on the main site**

Reload `index.html` in the browser preview, scroll to `#centerpieces`.

Run `mcp__Claude_Browser__computer` with `action: "screenshot"`.
Expected: the "Frame + Number Pegs" card shows the new "Build your number card →" button beneath the add-on pricing rows.

Run `mcp__Claude_Browser__computer` with `action: "left_click"` on the new link, then `mcp__Claude_Browser__read_page` (or check the tab's URL).
Expected: navigates to `centerpieces-builder.html` and the page loads correctly.

On `centerpieces-builder.html`, click the "← Back to site" nav link.
Expected: navigates back to `index.html#centerpieces`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/charlie/Desktop/Claude Code"
git add index.html
git commit -m "Link the number card builder from the Centerpieces pricing card"
```

---

### Task 6: Cross-cutting verification

**Files:** none (verification only — no code changes expected unless a check below fails, in which case fix the relevant file from Tasks 1-5 and re-run that task's verification steps before continuing).

- [ ] **Step 1: Full end-to-end flow**

On `centerpieces-builder.html`: set length to `120`, width to `45`, digits to `073`, background to a dark color, text mode to two-color with distinct inner/outline colors.

Run `mcp__Claude_Browser__computer` with `action: "screenshot"`.
Expected: the preview canvas shows a wide rectangular card (120:45 aspect ratio), digits "073" centered, rendered with a visibly distinct fill color and outline color around each digit.

- [ ] **Step 2: Verify solid mode still works after switching from two-color**

Click `#textModeSolid`, then run `mcp__Claude_Browser__javascript_tool`:
```javascript
document.getElementById("solidColorField").hidden === false && document.getElementById("twoColorField").hidden === true
```
Expected: `true`.

- [ ] **Step 3: Verify digits-empty disables download**

Clear the digits field entirely via `form_input` (empty string), then run:
```javascript
document.getElementById("downloadBtn").disabled
```
Expected: `true`. Then re-enter `5` and re-check.
Expected: `false`.

- [ ] **Step 4: Verify mobile layout end-to-end**

Run `mcp__Claude_Browser__resize_window` with `preset: "mobile"`, reload `centerpieces-builder.html`.
Run `mcp__Claude_Browser__computer` with `action: "screenshot"`.
Expected: single-column stacked layout, canvas and all controls visible without horizontal scrolling.
Run `mcp__Claude_Browser__resize_window` with `preset: "desktop"` to reset.

- [ ] **Step 5: Verify no console errors across the full flow**

Run `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true` after all the above interactions.
Expected: no errors.

No commit needed for this task (verification only, no file changes expected).
