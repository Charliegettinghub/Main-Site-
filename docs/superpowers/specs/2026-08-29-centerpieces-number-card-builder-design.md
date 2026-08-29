# Number card customizer for Centerpieces

## Problem

The Centerpieces section (`index.html` `#centerpieces`) sells custom Oklahoma centerpiece frames with number pegs, including single-color (+$1) and two-color (+$1.50) options ([index.html:322-338](../../../index.html)). Customers currently have no way to specify or preview the number card that goes into the frame — size, digits, and colors are all handled ad hoc. Charlie wants a self-serve tool where customers (and Charlie himself) can set exact dimensions and styling for a number card and get an exact-size, print-ready PDF to cut out.

## Goals

- A dedicated page, `centerpieces-builder.html`, in the same repo/site, sharing the existing design system (colors, fonts, nav/footer chrome).
- Live visual preview of the card that updates instantly as inputs change.
- Length/width controls in millimeters, with an inch equivalent shown alongside, within a 20mm–200mm range.
- Digits field accepting 1–3 numeric characters (e.g. `5`, `05`, `056`).
- Background color picker.
- Text color mode toggle: **Solid** (one fill color) or **Two-color** (inner fill + outline stroke, each independently colorable).
- A "Download PDF" action that produces a PDF sized to the *exact* mm dimensions chosen, so printing at 100%/actual size yields a precisely-sized card for cutting by hand.
- A link from the "Frame + Number Pegs" pricing card ([index.html:322](../../../index.html)) to the new builder page, and a link back to the main site from the builder page.
- Fully static/client-side — no backend, no accounts, no build step, consistent with the rest of the site and its GitHub Pages hosting.

## Non-goals

- Ordering/checkout flow, payment, or persisting a customer's design server-side — this is a design/preview + download tool only. Ordering still happens via the existing "Get in touch" contact flow.
- Multiple frame/card shapes or free-form layouts — only the rectangular number card described here.
- Font choice controls, multi-line text, or non-numeric characters — digits only, one font.
- Saving/sharing a design via URL or account — out of scope unless requested later.

## Approach

**A new static page in the existing repo**, not a separate site and not an inline widget on the homepage. It reuses the site's CSS custom properties (grey theme, existing fonts) so it doesn't feel like a different product, but lives on its own URL so the tool's UI (sliders, color pickers, a canvas) doesn't clutter the portfolio's scrolling narrative.

Rejected alternatives:
- **Separate website/repo** — doubles hosting/maintenance for no benefit; GitHub Pages already serves multiple pages from one repo, and this tool is a direct extension of an existing product on the site, not an unrelated project.
- **Inline widget in the `#centerpieces` section on the homepage** — would turn a portfolio scroll section into a stateful tool mid-page, working against the site's existing "clean, distinctive" design direction.

**Rendering**: an HTML5 `<canvas>` element is the live preview, redrawn on every input change (numbers/colors/digits). The canvas tracks the true aspect ratio of the chosen length:width so the on-screen shape is proportionally accurate, not just a fixed square.

**PDF generation**: [jsPDF](https://github.com/parallax/jsPDF), vendored locally into the repo (e.g. `assets/vendor/jspdf.umd.min.js`) rather than loaded from a CDN, matching the site's existing no-external-dependency approach and avoiding a runtime failure mode if a CDN is unreachable. On "Download PDF," a new PDF document is created with a page size set exactly to the chosen mm dimensions, and the same background/digit rendering logic used for the canvas preview is re-drawn into the PDF (in PDF's coordinate space, i.e. not just an image export of the canvas, so the output stays crisp at print resolution). The filename is `centerpiece-card-<digits>.pdf`.

## Component design

### Page structure (`centerpieces-builder.html`)

- Shared `<nav>`/`<footer>` matching `index.html`'s chrome, with a "← Back to site" link.
- `<main class="builder">` with a two-column layout (`.builder__preview` + `.builder__controls`), stacking vertically on mobile.
- `.builder__preview`: contains the `<canvas>` and, beneath it, the "Download PDF" button plus the "print at 100% / actual size" hint text.
- `.builder__controls`: a vertical stack of labeled fields — Length, Width, Digits, Background color, Text color mode (with its conditional Inner/Outline swatches).

### Data flow

A single JS module (`centerpieces-builder.js`) holds one in-memory state object (`{ lengthMm, widthMm, digits, bgColor, textMode, solidColor, innerColor, outlineColor }`). Every control's `input`/`change` event updates state and calls one `render()` function, which:

1. Validates/clamps the changed field (see Validation below).
2. Redraws the canvas preview.
3. Enables/disables the Download button based on current validity.

The PDF export function reuses the same state object, so the preview and the downloaded PDF can never drift out of sync — there's exactly one source of truth for "what does this card look like."

### Validation / edge cases

- **Digits field**: strips non-numeric characters on input; disables Download when empty. Max length 3 enforced via `maxlength` plus a JS guard.
- **Length/Width**: clamped to the 20mm–200mm range on blur, with an inline hint (e.g. "Clamped to 200mm max") shown when a typed value gets adjusted — never a silent change.
- **Two-color mode with matching inner/outline colors**: allowed with no warning; it's a valid (if visually subtle) customer choice.
- **Download button**: disabled (with a `title`/inline hint explaining why) whenever digits are empty or a dimension is out of range, so an invalid PDF can never be generated.

## Integration with main site

- `index.html`: the "Frame + Number Pegs" `.price-card` ([index.html:322-338](../../../index.html)) gets a small link/button, e.g. `<a class="btn btn--ghost" href="centerpieces-builder.html">Build your number card →</a>`, styled consistently with the card's existing `.price-card__cta`.
- No changes to `styles.css`'s existing rules — the builder page's own stylesheet (or a scoped addition) reuses the same CSS custom properties (`--bg-0`, `--ink-0`, accent orange, fonts) so colors/typography match without duplicating the whole design system.

## Testing

- Manual verification in the browser preview: adjust each control and confirm the canvas updates correctly, including the two-color outline rendering.
- Download a PDF at a known size (e.g. 90mm × 40mm) and verify with a ruler/PDF viewer's "actual size" print preview that the output page dimensions are exactly correct.
- Verify the digits-only input guard rejects letters/symbols and enforces the 3-character max.
- Verify the min/max clamping on length/width shows the inline hint rather than failing silently.
- Verify the link from the Centerpieces pricing card navigates to the builder page, and the "back to site" link returns correctly.
