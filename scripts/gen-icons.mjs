// Generate ikon PWA tanpa dependency eksternal.
// Rendering pakai signed distance fields (SDF) → bentuk presisi + anti-alias.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [159, 201, 176]; // sage
const INK = [38, 36, 31]; // border ink
const CROSS = [255, 255, 255]; // putih card

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** SDF rounded box berpusat (cx,cy), half-size hx/hy, sudut r. */
function sdBox(px, py, cx, cy, hx, hy, r) {
  const dx = Math.abs(px - cx) - (hx - r);
  const dy = Math.abs(py - cy) - (hy - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - r;
}

function drawIcon(size, maskable = false) {
  const px = Buffer.alloc(size * size * 4);
  const U = 100; // ruang koordinat 0..100
  const scale = size / U;
  const aa = 1 / scale; // lebar ~1 piksel dalam unit

  // Composite per piksel langsung dari SDF layer
  function paintLayer(col, sdfFn) {
    for (let y = 0; y < size; y++) {
      const v = (y + 0.5) / scale;
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / scale;
        const sdf = sdfFn(u, v);
        const cov = Math.min(1, Math.max(0, 0.5 - sdf / aa));
        if (cov <= 0) continue;
        const i = (y * size + x) * 4;
        // source-over composite
        const da = px[i + 3] / 255;
        const oa = cov + da * (1 - cov);
        if (oa > 0) {
          px[i] = Math.round((col[0] * cov + px[i] * da * (1 - cov)) / oa);
          px[i + 1] = Math.round((col[1] * cov + px[i + 1] * da * (1 - cov)) / oa);
          px[i + 2] = Math.round((col[2] * cov + px[i + 2] * da * (1 - cov)) / oa);
        }
        px[i + 3] = Math.round(oa * 255);
      }
    }
  }

  if (maskable) {
    // Full bleed sage + cross putih di zona aman tengah (≤80%)
    paintLayer(BG, () => -1);
    paintLayer(CROSS, (u, v) =>
      Math.min(sdBox(u, v, 50, 50, 5.5, 15.5, 5.5), sdBox(u, v, 50, 50, 15.5, 5.5, 5.5)),
    );
  } else {
    px.fill(0); // mulai transparan
    paintLayer(INK, (u, v) => sdBox(u, v, 50, 50, 42, 42, 10));
    paintLayer(BG, (u, v) => sdBox(u, v, 50, 50, 38.5, 38.5, 7.5));
    paintLayer(CROSS, (u, v) =>
      Math.min(sdBox(u, v, 50, 50, 6.5, 18.5, 6.5), sdBox(u, v, 50, 50, 18.5, 6.5, 6.5)),
    );
  }
  return png(size, size, px);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', drawIcon(192));
writeFileSync('public/icons/icon-512.png', drawIcon(512));
writeFileSync('public/icons/icon-maskable-512.png', drawIcon(512, true));
console.log('icons regenerated');
