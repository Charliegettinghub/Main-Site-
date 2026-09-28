const MM_MIN = 20;
const MM_MAX = 200;
const MM_PER_INCH = 25.4;
const MAX_RANGE_CARDS = 300;
const FONT_OPTIONS = {
  sans: { label: "Bold Sans", cssFamily: '"Instrument Sans", sans-serif', weight: 700 },
  mono: { label: "Monospace", cssFamily: '"IBM Plex Mono", monospace', weight: 600 },
  serif: { label: "Editorial Serif", cssFamily: '"Bodoni Moda", serif', weight: 700 },
  script: { label: "Script", cssFamily: '"Great Vibes", cursive', weight: 400 },
};
const BG_PRESETS = { white: "#ffffff", black: "#000000" };
// Text colors that read well on each preset background. Used to flip the
// text automatically when switching White <-> Black, as long as the person
// hasn't picked their own text color yet.
const TEXT_ON_BG = { white: "#111111", black: "#f1efec" };
const PAPERS = {
  letter: { label: "US Letter", w: 215.9, h: 279.4 },
  a4: { label: "A4", w: 210, h: 297 },
};

const state = {
  lengthMm: 90,
  widthMm: 60,
  numberMode: "single",
  digits: "5",
  rangeFrom: 1,
  rangeTo: 50,
  bgMode: "white",
  bgColor: BG_PRESETS.white,
  customBgColor: "#1f4e79",
  textMode: "solid",
  solidColor: TEXT_ON_BG.white,
  innerColor: TEXT_ON_BG.white,
  outlineColor: "#ff7a33",
  fontFamily: "sans",
  fontSizeScale: 1,
  paper: "letter",
};
const textColorTouched = { solid: false, inner: false };

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

  // Alphabetic baseline + measured ink bounds, rather than
  // textBaseline "middle": "middle" centers the font's em box, which
  // reserves room for descenders digits never use, so numbers sat visibly
  // high. Centering the actual glyph outlines keeps them dead center at
  // any card size or font.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  // Measures per-character advances plus the ink bounding box of the whole
  // run (relative to x = 0 on the baseline) at a given font size. In
  // two-color mode an inter-character gap equal to the outline's stroke
  // width keeps adjacent digits' outlines from ever touching.
  function measureLayout(size) {
    ctx.font = `${fontOption.weight} ${size}px ${fontOption.cssFamily}`;
    const strokeWidth = isTwoColor ? size * 0.045 : 0;
    const gap = isTwoColor ? strokeWidth : 0;
    const pad = strokeWidth / 2;
    const metrics = chars.map((c) => ctx.measureText(c));
    const widths = metrics.map((m) => m.width);

    let inkLeft = Infinity;
    let inkRight = -Infinity;
    let ascent = -Infinity;
    let descent = -Infinity;
    let x = 0;
    metrics.forEach((m, i) => {
      inkLeft = Math.min(inkLeft, x - m.actualBoundingBoxLeft);
      inkRight = Math.max(inkRight, x + m.actualBoundingBoxRight);
      ascent = Math.max(ascent, m.actualBoundingBoxAscent);
      descent = Math.max(descent, m.actualBoundingBoxDescent);
      x += widths[i] + gap;
    });
    inkLeft -= pad;
    inkRight += pad;
    ascent += pad;
    descent += pad;

    return {
      widths,
      strokeWidth,
      gap,
      inkLeft,
      inkRight,
      ascent,
      descent,
      inkWidth: inkRight - inkLeft,
      inkHeight: ascent + descent,
    };
  }

  let layout = measureLayout(fontSize);
  const fit = Math.min(1, maxTextWidth / layout.inkWidth, heightCeiling / layout.inkHeight);
  if (fit < 1) {
    fontSize *= fit;
    layout = measureLayout(fontSize);
  }

  let x = pxWidth / 2 - (layout.inkLeft + layout.inkRight) / 2;
  const baselineY = pxHeight / 2 + (layout.ascent - layout.descent) / 2;

  chars.forEach((char, i) => {
    if (isTwoColor) {
      ctx.lineWidth = layout.strokeWidth;
      ctx.strokeStyle = cardState.outlineColor;
      ctx.strokeText(char, x, baselineY);
      ctx.fillStyle = cardState.innerColor;
      ctx.fillText(char, x, baselineY);
    } else {
      ctx.fillStyle = cardState.solidColor;
      ctx.fillText(char, x, baselineY);
    }
    x += layout.widths[i] + layout.gap;
  });
}

// --- Numbers to print ---

function rangeBounds() {
  return [Math.min(state.rangeFrom, state.rangeTo), Math.max(state.rangeFrom, state.rangeTo)];
}

function rangeIsValid() {
  const { rangeFrom: a, rangeTo: b } = state;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0 || a > 999 || b > 999) return false;
  const [lo, hi] = rangeBounds();
  return hi - lo + 1 <= MAX_RANGE_CARDS;
}

function numbersToPrint() {
  if (state.numberMode === "single") return state.digits ? [state.digits] : [];
  if (!rangeIsValid()) return [];
  const [lo, hi] = rangeBounds();
  const out = [];
  for (let n = lo; n <= hi; n++) out.push(String(n));
  return out;
}

function previewDigits() {
  if (state.numberMode === "single") return state.digits;
  return rangeIsValid() ? String(rangeBounds()[0]) : "";
}

// --- Sheet layout ---

// Printers can't reach the very edge of the page, so nothing (cards or
// crop marks) goes closer than this to the paper edge.
const PRINTER_SAFE_MM = 5;
const MARK_GAP_MM = 1.5;
const MARK_LEN_MM = 6;

// Tries every combination of page orientation and card rotation and keeps
// whichever fits the most cards on one sheet. Ties go to the layout with
// the roomiest margin, which leaves more space for crop marks.
function planSheet(cardW, cardH, paperKey) {
  const paper = PAPERS[paperKey];
  let best = null;
  const pages = [
    { pageW: paper.w, pageH: paper.h, orientation: "p" },
    { pageW: paper.h, pageH: paper.w, orientation: "l" },
  ];
  for (const page of pages) {
    for (const rotated of [false, true]) {
      const cellW = rotated ? cardH : cardW;
      const cellH = rotated ? cardW : cardH;
      const usableW = page.pageW - PRINTER_SAFE_MM * 2;
      const usableH = page.pageH - PRINTER_SAFE_MM * 2;
      const cols = Math.floor(usableW / cellW + 1e-9);
      const rows = Math.floor(usableH / cellH + 1e-9);
      const perSheet = cols * rows;
      if (perSheet === 0) continue;
      const gridW = cols * cellW;
      const gridH = rows * cellH;
      const marginX = (page.pageW - gridW) / 2;
      const marginY = (page.pageH - gridH) / 2;
      const minMargin = Math.min(marginX, marginY);
      if (
        !best ||
        perSheet > best.perSheet ||
        (perSheet === best.perSheet && minMargin > best.minMargin + 0.01)
      ) {
        best = { ...page, rotated, cellW, cellH, cols, rows, perSheet, gridW, gridH, marginX, marginY, minMargin };
      }
    }
  }
  return best;
}

// Cut guides tailored to the actual grid: a thin grey hairline on every
// cut (cards are butted edge to edge, so one cut separates two cards) plus
// crop marks in the margin that extend each cut line past the paper, for
// lining up a ruler or trimmer.
function drawCutGuides(doc, plan, cardCount) {
  const x0 = plan.marginX;
  const y0 = plan.marginY;
  const usedRows = Math.ceil(cardCount / plan.cols);
  const usedCols = Math.min(cardCount, plan.cols);
  const gridW = usedCols * plan.cellW;
  const gridH = usedRows * plan.cellH;

  doc.setLineCap("butt");

  // Hairline around every placed card (shared edges overlap exactly), so a
  // short last row never gets lines running across blank paper.
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.12);
  for (let i = 0; i < cardCount; i++) {
    const col = i % plan.cols;
    const row = Math.floor(i / plan.cols);
    doc.rect(x0 + col * plan.cellW, y0 + row * plan.cellH, plan.cellW, plan.cellH, "S");
  }

  // Crop marks in the margins, as long as the printable margin allows.
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  const topLen = Math.min(MARK_LEN_MM, y0 - MARK_GAP_MM - PRINTER_SAFE_MM);
  const bottomLen = Math.min(MARK_LEN_MM, plan.pageH - (y0 + gridH) - MARK_GAP_MM - PRINTER_SAFE_MM);
  const leftLen = Math.min(MARK_LEN_MM, x0 - MARK_GAP_MM - PRINTER_SAFE_MM);
  const rightLen = Math.min(MARK_LEN_MM, plan.pageW - (x0 + gridW) - MARK_GAP_MM - PRINTER_SAFE_MM);

  for (let c = 0; c <= usedCols; c++) {
    const x = x0 + c * plan.cellW;
    if (topLen > 1) doc.line(x, y0 - MARK_GAP_MM, x, y0 - MARK_GAP_MM - topLen);
    if (bottomLen > 1) doc.line(x, y0 + gridH + MARK_GAP_MM, x, y0 + gridH + MARK_GAP_MM + bottomLen);
  }
  for (let r = 0; r <= usedRows; r++) {
    const y = y0 + r * plan.cellH;
    if (leftLen > 1) doc.line(x0 - MARK_GAP_MM, y, x0 - MARK_GAP_MM - leftLen, y);
    if (rightLen > 1) doc.line(x0 + gridW + MARK_GAP_MM, y, x0 + gridW + MARK_GAP_MM + rightLen, y);
  }
}

// --- Preview ---

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
  drawCard(ctx, previewCanvas.width, previewCanvas.height, { ...state, digits: previewDigits() });
}

// --- Field wiring ---

const lengthInput = document.getElementById("lengthInput");
const lengthInchHint = document.getElementById("lengthInchHint");
const lengthClampHint = document.getElementById("lengthClampHint");
const widthInput = document.getElementById("widthInput");
const widthInchHint = document.getElementById("widthInchHint");
const widthClampHint = document.getElementById("widthClampHint");
const numberModeSingle = document.getElementById("numberModeSingle");
const numberModeRange = document.getElementById("numberModeRange");
const singleNumberField = document.getElementById("singleNumberField");
const rangeNumberField = document.getElementById("rangeNumberField");
const digitsInput = document.getElementById("digitsInput");
const rangeFromInput = document.getElementById("rangeFromInput");
const rangeToInput = document.getElementById("rangeToInput");
const digitsError = document.getElementById("digitsError");
const bgModeInputs = document.querySelectorAll('input[name="bgMode"]');
const bgModeCustom = document.getElementById("bgModeCustom");
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
const paperInput = document.getElementById("paperInput");
const paperNameGuide = document.getElementById("paperNameGuide");
const sheetSummary = document.getElementById("sheetSummary");

function refresh() {
  updateNumberError();
  updateDownloadState();
  updateSheetSummary();
  renderPreview();
}

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
    refresh();
  });
}

handleDimensionInput(lengthInput, lengthInchHint, lengthClampHint, "lengthMm");
handleDimensionInput(widthInput, widthInchHint, widthClampHint, "widthMm");

function setNumberMode(mode) {
  state.numberMode = mode;
  singleNumberField.hidden = mode !== "single";
  rangeNumberField.hidden = mode !== "range";
  refresh();
}

numberModeSingle.addEventListener("change", () => {
  if (numberModeSingle.checked) setNumberMode("single");
});
numberModeRange.addEventListener("change", () => {
  if (numberModeRange.checked) setNumberMode("range");
});

digitsInput.addEventListener("input", () => {
  const clean = sanitizeDigits(digitsInput.value);
  digitsInput.value = clean;
  state.digits = clean;
  refresh();
});

function readRangeInput(input) {
  const n = parseInt(input.value, 10);
  return Number.isNaN(n) ? NaN : n;
}

rangeFromInput.addEventListener("input", () => {
  state.rangeFrom = readRangeInput(rangeFromInput);
  refresh();
});
rangeToInput.addEventListener("input", () => {
  state.rangeTo = readRangeInput(rangeToInput);
  refresh();
});

function updateNumberError() {
  let message = "";
  if (state.numberMode === "single") {
    if (!state.digits) message = "Enter 1-3 digits (0-9).";
  } else {
    const { rangeFrom: a, rangeTo: b } = state;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 999 || b > 999) {
      message = "Enter whole numbers from 0 to 999.";
    } else if (Math.abs(b - a) + 1 > MAX_RANGE_CARDS) {
      message = `Up to ${MAX_RANGE_CARDS} cards per PDF — split bigger sets into a few downloads.`;
    }
  }
  digitsError.textContent = message;
  digitsError.hidden = !message;
}

function setBgMode(mode) {
  state.bgMode = mode;
  state.bgColor = mode === "custom" ? state.customBgColor : BG_PRESETS[mode];
  if (mode !== "custom") {
    if (!textColorTouched.solid) {
      state.solidColor = TEXT_ON_BG[mode];
      solidColorInput.value = state.solidColor;
    }
    if (!textColorTouched.inner) {
      state.innerColor = TEXT_ON_BG[mode];
      innerColorInput.value = state.innerColor;
    }
  }
  renderPreview();
}

bgModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (input.checked) setBgMode(input.value);
  });
});

// Picking a color in the Custom swatch selects Custom automatically.
bgColorInput.addEventListener("input", () => {
  state.customBgColor = bgColorInput.value;
  bgModeCustom.checked = true;
  setBgMode("custom");
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
  textColorTouched.solid = true;
  renderPreview();
});
innerColorInput.addEventListener("input", () => {
  state.innerColor = innerColorInput.value;
  textColorTouched.inner = true;
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

paperInput.addEventListener("change", () => {
  state.paper = paperInput.value;
  paperNameGuide.textContent = PAPERS[state.paper].label;
  refresh();
});

function updateSheetSummary() {
  const plan = planSheet(state.lengthMm, state.widthMm, state.paper);
  const paperLabel = PAPERS[state.paper].label;
  if (!plan) {
    sheetSummary.textContent = `This card is too big for ${paperLabel} paper.`;
    return;
  }
  const count = numbersToPrint().length;
  const perSheet = `${plan.perSheet} card${plan.perSheet === 1 ? "" : "s"} per ${paperLabel} sheet`;
  if (count <= 1) {
    sheetSummary.textContent = `Fits ${perSheet}.`;
    return;
  }
  const pages = Math.ceil(count / plan.perSheet);
  sheetSummary.textContent = `${count} cards · ${perSheet} · ${pages} page${pages === 1 ? "" : "s"} total.`;
}

const downloadBtn = document.getElementById("downloadBtn");
const downloadHint = document.getElementById("downloadHint");
const DOWNLOAD_LABEL = "Download PDF";
let isBuilding = false;

function updateDownloadState() {
  if (isBuilding) return;
  const count = numbersToPrint().length;
  const fits = !!planSheet(state.lengthMm, state.widthMm, state.paper);
  const disabled = count === 0 || !fits;
  downloadBtn.disabled = disabled;
  downloadBtn.textContent = count > 1 ? `Download PDF · ${count} cards` : DOWNLOAD_LABEL;
  downloadHint.textContent = count === 0
    ? (state.numberMode === "single" ? "Enter 1-3 digits to enable download." : "Fix the range above to enable download.")
    : "";
}

// Initial paint (immediate, using whatever font is available) plus a
// re-render once the web font finishes loading so the preview isn't
// left on a fallback font's metrics.
lengthInchHint.textContent = mmToInchLabel(state.lengthMm);
widthInchHint.textContent = mmToInchLabel(state.widthMm);
refresh();
document.fonts.ready.then(renderPreview);

// --- PDF export ---

const PDF_DPI = 300;

// Renders one card at print resolution, rotated 90° when the sheet plan
// turned cards sideways to fit more per page.
function buildCardImageDataUrl(canvas, lengthMm, widthMm, cardState, rotated) {
  const pxWidth = Math.round((lengthMm / MM_PER_INCH) * PDF_DPI);
  const pxHeight = Math.round((widthMm / MM_PER_INCH) * PDF_DPI);
  canvas.width = rotated ? pxHeight : pxWidth;
  canvas.height = rotated ? pxWidth : pxHeight;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (rotated) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  }
  drawCard(ctx, pxWidth, pxHeight, cardState);
  return canvas.toDataURL("image/jpeg", 0.95);
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

async function downloadPdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    downloadHint.textContent = "PDF library failed to load — please refresh the page and try again.";
    return;
  }
  const numbers = numbersToPrint();
  const plan = planSheet(state.lengthMm, state.widthMm, state.paper);
  if (!numbers.length || !plan) return;

  isBuilding = true;
  downloadBtn.disabled = true;

  try {
    await document.fonts.ready;
    const paper = PAPERS[state.paper];
    // Pass the page in its natural portrait size and let `orientation`
    // do the swap, so jsPDF never second-guesses the dimensions.
    const doc = new window.jspdf.jsPDF({
      unit: "mm",
      format: [paper.w, paper.h],
      orientation: plan.orientation,
    });
    const canvas = document.createElement("canvas");
    const pages = Math.ceil(numbers.length / plan.perSheet);

    for (let p = 0; p < pages; p++) {
      if (p > 0) doc.addPage([paper.w, paper.h], plan.orientation);
      const pageNumbers = numbers.slice(p * plan.perSheet, (p + 1) * plan.perSheet);

      pageNumbers.forEach((digits, i) => {
        const col = i % plan.cols;
        const row = Math.floor(i / plan.cols);
        const dataUrl = buildCardImageDataUrl(canvas, state.lengthMm, state.widthMm, { ...state, digits }, plan.rotated);
        doc.addImage(
          dataUrl,
          "JPEG",
          plan.marginX + col * plan.cellW,
          plan.marginY + row * plan.cellH,
          plan.cellW,
          plan.cellH,
        );
      });

      drawCutGuides(doc, plan, pageNumbers.length);

      downloadBtn.textContent = `Building… page ${p + 1} of ${pages}`;
      await nextFrame();
    }

    const name = numbers.length === 1
      ? `centerpiece-card-${numbers[0]}.pdf`
      : `centerpiece-cards-${numbers[0]}-${numbers[numbers.length - 1]}.pdf`;
    doc.save(name);
  } finally {
    isBuilding = false;
    updateDownloadState();
  }
}

downloadBtn.addEventListener("click", downloadPdf);
