const MM_MIN = 20;
const MM_MAX = 200;
const MM_PER_INCH = 25.4;
const FONT_OPTIONS = {
  sans: { label: "Bold Sans", cssFamily: '"Instrument Sans", sans-serif', weight: 700 },
  mono: { label: "Monospace", cssFamily: '"IBM Plex Mono", monospace', weight: 600 },
  serif: { label: "Editorial Serif", cssFamily: '"Bodoni Moda", serif', weight: 700 },
  script: { label: "Script", cssFamily: '"Great Vibes", cursive', weight: 400 },
};

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
    const strokeWidth = isTwoColor ? size * 0.045 : 0;
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
const fontFamilyInput = document.getElementById("fontFamilyInput");
const fontSizeInput = document.getElementById("fontSizeInput");

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

fontFamilyInput.addEventListener("change", () => {
  state.fontFamily = fontFamilyInput.value;
  renderPreview();
});

fontSizeInput.addEventListener("input", () => {
  state.fontSizeScale = parseFloat(fontSizeInput.value);
  renderPreview();
});

const downloadBtn = document.getElementById("downloadBtn");
const downloadHint = document.getElementById("downloadHint");
const downloadHintDefaultText = downloadHint.textContent;
const DOWNLOAD_DISABLED_REASON = "Enter 1-3 digits to enable download.";

function updateDownloadState() {
  const disabled = state.digits.length === 0;
  downloadBtn.disabled = disabled;
  downloadBtn.title = disabled ? "Enter 1-3 digits to enable download" : "";
  downloadHint.textContent = disabled
    ? `${DOWNLOAD_DISABLED_REASON} ${downloadHintDefaultText}`
    : downloadHintDefaultText;
}

// Initial paint (immediate, using whatever font is available) plus a
// re-render once the web font finishes loading so the preview isn't
// left on a fallback font's metrics.
lengthInchHint.textContent = mmToInchLabel(state.lengthMm);
widthInchHint.textContent = mmToInchLabel(state.widthMm);
updateDownloadState();
renderPreview();
document.fonts.ready.then(renderPreview);

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
  if (!window.jspdf || !window.jspdf.jsPDF) {
    downloadHint.textContent = "PDF library failed to load — please refresh the page and try again.";
    return;
  }
  const dataUrl = buildCardImageDataUrl(state.lengthMm, state.widthMm, state);
  // jsPDF's default orientation ("portrait") silently swaps a custom
  // [width, height] format's dimensions whenever width > height, which would
  // otherwise clip our card (most cards are wider than they are tall).
  // Pick the orientation that already matches the card so no swap happens.
  const doc = new window.jspdf.jsPDF({
    unit: "mm",
    format: [state.lengthMm, state.widthMm],
    orientation: state.lengthMm >= state.widthMm ? "l" : "p",
  });
  doc.addImage(dataUrl, "PNG", 0, 0, state.lengthMm, state.widthMm);
  doc.save(`centerpiece-card-${state.digits}.pdf`);
}

downloadBtn.addEventListener("click", downloadPdf);
