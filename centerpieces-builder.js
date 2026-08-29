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
