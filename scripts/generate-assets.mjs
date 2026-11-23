// Generates every icon + the social preview image into public/ from the SVGs below.
// Run after changing the brand: `npm run assets`. Outputs are committed; this isn't part of the build.
// shortcut: OG text uses system fonts (Segoe UI → Arial), so output can differ slightly per OS; vectorize the text if that matters.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = "#0b0c12";
const BRAND_A = "#8b8ff8"; // top-left of the tile gradient
const BRAND_B = "#4f46e5"; // bottom-right

// The mark: two devices joined by one unbroken curve — a direct link with nothing in between.
// 512 grid; `scale` shrinks it for maskable safe zones.
function glyph(scale = 1) {
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  return `
  <g transform="${t}" fill="none" stroke="#fff" stroke-linecap="round">
    <path d="M166 346 C166 238 346 274 346 166" stroke-width="36"/>
    <circle cx="166" cy="346" r="46" fill="#fff" stroke="none"/>
    <circle cx="346" cy="166" r="46" fill="#fff" stroke="none"/>
    <circle cx="346" cy="166" r="18" fill="${BRAND_B}" stroke="none"/>
  </g>`;
}

const defs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_A}"/>
      <stop offset="1" stop-color="${BRAND_B}"/>
    </linearGradient>
  </defs>`;

// Rounded tile: favicon, in-app logo, standard "any" icons.
const roundedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" rx="116" fill="url(#g)"/>${glyph(1.15)}
</svg>`;

// Full-bleed square: maskable / Apple icons (the OS applies its own mask). Glyph kept inside the 80% safe zone.
const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#g)"/>${glyph(0.78)}
</svg>`;

// 1200×630 social card.
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0" r="0.8">
      <stop offset="0" stop-color="${BRAND_B}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${BRAND_B}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_A}"/>
      <stop offset="1" stop-color="${BRAND_B}"/>
    </linearGradient>
    <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BRAND_A}"/>
      <stop offset="1" stop-color="#e0e2ff"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity="0.04"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <svg x="80" y="72" width="64" height="64" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="116" fill="url(#g)"/>${glyph()}
  </svg>
  <text x="164" y="116" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#f4f5fb">MeshLink</text>

  <text x="80" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="#f4f5fb" letter-spacing="-2">Device to device.</text>
  <text x="80" y="394" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="url(#txt)" letter-spacing="-2">Nothing in between.</text>
  <text x="82" y="462" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#9aa0b4">Private, instant file transfer. Never uploaded, no account, any size.</text>

  <g font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#c9cde0">
    <rect x="80" y="520" width="146" height="46" rx="23" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12"/>
    <circle cx="106" cy="543" r="6" fill="#34d399"/>
    <text x="122" y="551">Private</text>
    <rect x="242" y="520" width="132" height="46" rx="23" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12"/>
    <text x="268" y="551">Instant</text>
    <rect x="390" y="520" width="146" height="46" rx="23" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12"/>
    <text x="416" y="551">Any size</text>
  </g>

  <!-- two devices linked, right side -->
  <g transform="translate(905 44) scale(0.8)">
    <rect x="0" y="40" width="120" height="200" rx="22" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/>
    <rect x="44" y="54" width="32" height="6" rx="3" fill="#ffffff" fill-opacity="0.2"/>
    <rect x="200" y="0" width="120" height="200" rx="22" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/>
    <rect x="244" y="14" width="32" height="6" rx="3" fill="#ffffff" fill-opacity="0.2"/>
    <path d="M120 150 C160 150 160 110 200 110" fill="none" stroke="${BRAND_A}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
    <circle cx="160" cy="130" r="8" fill="${BRAND_A}"/>
    <rect x="22" y="120" width="76" height="60" rx="10" fill="${BRAND_B}" fill-opacity="0.35"/>
    <rect x="222" y="80" width="76" height="60" rx="10" fill="${BRAND_B}" fill-opacity="0.6"/>
  </g>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// ICO with embedded PNGs (supported by every browser since IE Vista-era); covers /favicon.ico requests.
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

await fs.mkdir(out, { recursive: true });
const write = (name, data) => fs.writeFile(path.join(out, name), data).then(() => console.log("  ✓", name));

await write("favicon.svg", roundedSvg);
await write("favicon.ico", ico([{ size: 16, data: await png(roundedSvg, 16) }, { size: 32, data: await png(roundedSvg, 32) }, { size: 48, data: await png(roundedSvg, 48) }]));
await write("pwa-64x64.png", await png(roundedSvg, 64));
await write("pwa-192x192.png", await png(roundedSvg, 192));
await write("pwa-512x512.png", await png(roundedSvg, 512));
await write("maskable-icon-512x512.png", await png(squareSvg, 512));
await write("apple-touch-icon-180x180.png", await png(squareSvg, 180));
await write("og-image.png", await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toBuffer());
