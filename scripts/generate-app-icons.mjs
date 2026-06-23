import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(process.cwd(), 'web', 'public');
const SUPER_SAMPLE = 4;

const ICONS = [
  ['apple-touch-icon.png', 180],
  ['favicon-32x32.png', 32],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-192.png', 192],
  ['icon-maskable-512.png', 512],
];

const BLACK = [17, 17, 17, 255];
const WHITE = [255, 255, 255, 255];

function fillBackground(buf) {
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = WHITE[0];
    buf[i + 1] = WHITE[1];
    buf[i + 2] = WHITE[2];
    buf[i + 3] = WHITE[3];
  }
}

function setPixel(buf, size, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}

function fillCircle(buf, size, cx, cy, r, color) {
  const minX = Math.max(0, Math.floor(cx - r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxX = Math.min(size - 1, Math.ceil(cx + r));
  const maxY = Math.min(size - 1, Math.ceil(cy + r));
  const rr = r * r;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rr) setPixel(buf, size, x, y, color);
    }
  }
}

function strokeCircle(buf, size, cx, cy, r, width, color) {
  const minX = Math.max(0, Math.floor(cx - r - width));
  const minY = Math.max(0, Math.floor(cy - r - width));
  const maxX = Math.min(size - 1, Math.ceil(cx + r + width));
  const maxY = Math.min(size - 1, Math.ceil(cy + r + width));
  const inner = (r - width / 2) ** 2;
  const outer = (r + width / 2) ** 2;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d >= inner && d <= outer) setPixel(buf, size, x, y, color);
    }
  }
}

function fillPolygon(buf, size, points, color) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const xi = points[i][0];
        const yi = points[i][1];
        const xj = points[j][0];
        const yj = points[j][1];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      if (inside) setPixel(buf, size, x, y, color);
    }
  }
}

function rotatePoint([x, y], angle, cx, cy) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function drawBall(size) {
  const hiSize = size * SUPER_SAMPLE;
  const buf = new Uint8ClampedArray(hiSize * hiSize * 4);
  const scale = hiSize / 32;
  const p = (x, y) => [x * scale, y * scale];

  fillBackground(buf);

  const cx = 16 * scale;
  const cy = 16 * scale;
  const r = 15 * scale;
  fillCircle(buf, hiSize, cx, cy, r, WHITE);

  fillPolygon(
    buf,
    hiSize,
    [
      p(16, 10.55),
      p(21.18, 14.31),
      p(19.2, 20.42),
      p(12.8, 20.42),
      p(10.82, 14.31),
    ],
    BLACK,
  );

  const outerPentagon = [
    p(16, 29.64),
    p(12.5, 27.09),
    p(13.83, 22.98),
    p(18.17, 22.98),
    p(19.5, 27.09),
  ];
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5;
    fillPolygon(buf, hiSize, outerPentagon.map((point) => rotatePoint(point, angle, cx, cy)), BLACK);
  }

  strokeCircle(buf, hiSize, cx, cy, r, scale, BLACK);

  return downsample(buf, size, SUPER_SAMPLE);
}

function downsample(src, size, factor) {
  const dst = Buffer.alloc(size * size * 4);
  const hiSize = size * factor;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const accum = [0, 0, 0, 0];
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const i = ((y * factor + sy) * hiSize + x * factor + sx) * 4;
          accum[0] += src[i];
          accum[1] += src[i + 1];
          accum[2] += src[i + 2];
          accum[3] += src[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      const samples = factor * factor;
      dst[o] = Math.round(accum[0] / samples);
      dst[o + 1] = Math.round(accum[1] / samples);
      dst[o + 2] = Math.round(accum[2] / samples);
      dst[o + 3] = Math.round(accum[3] / samples);
    }
  }
  return dst;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND'),
  ]);
}

await mkdir(OUT_DIR, { recursive: true });

for (const [name, size] of ICONS) {
  const file = join(OUT_DIR, name);
  await writeFile(file, encodePng(size, size, drawBall(size)));
  console.log(`wrote ${file}`);
}
