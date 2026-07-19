#!/usr/bin/env node
/**
 * Icon Composer PNG exports have no macOS Dock margin.
 * Pad to Apple's 824×824 content box on a 1024 canvas, then run `tauri icon`.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(
  root,
  "src-tauri/icons/_base/macOS/Icon Exports/Icon-iOS-Default-1024@1x.png",
);
const OUT = path.join(root, "src-tauri/icons/_base/macOS/Icon-macOS-1024-padded.png");
const CANVAS = 1024;
const CONTENT = 824;

const require = createRequire(import.meta.url);
const fs = require("node:fs");

function readPngRgba(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.subarray(0, 8).toString("binary") !== "\x89PNG\r\n\x1a\n") {
    throw new Error(`Not a PNG: ${filePath}`);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    offset += 4;
    const type = data.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const chunk = data.subarray(offset, offset + length);
    offset += length + 4;
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      if (chunk[8] !== 8 || chunk[9] !== 6) {
        throw new Error("Expected 8-bit RGBA PNG");
      }
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rows = [];
  let prev = Buffer.alloc(stride);
  let i = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[i++];
    const scan = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    if (filter === 1) {
      for (let x = 4; x < stride; x++) scan[x] = (scan[x] + scan[x - 4]) & 255;
    } else if (filter === 2) {
      for (let x = 0; x < stride; x++) scan[x] = (scan[x] + prev[x]) & 255;
    } else if (filter === 3) {
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? scan[x - 4] : 0;
        scan[x] = (scan[x] + ((a + prev[x]) >> 1)) & 255;
      }
    } else if (filter === 4) {
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? scan[x - 4] : 0;
        const b = prev[x];
        const c = x >= 4 ? prev[x - 4] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        scan[x] = (scan[x] + pr) & 255;
      }
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter ${filter}`);
    }
    rows.push(scan);
    prev = scan;
  }
  return { width, height, rows };
}

function nearestScale(rows, sw, sh, dw, dh) {
  const out = [];
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    const src = rows[sy];
    const row = Buffer.alloc(dw * 4);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      src.copy(row, x * 4, sx * 4, sx * 4 + 4);
    }
    out.push(row);
  }
  return out;
}

function writePng(filePath, width, height, rows) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 4 + 1);
    raw[o] = 0;
    rows[y].copy(raw, o + 1);
  }
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  fs.writeFileSync(
    filePath,
    Buffer.concat([
      signature,
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

if (!fs.existsSync(SRC)) {
  console.error(`Missing Icon Composer export:\n  ${SRC}`);
  process.exit(1);
}

const { width, height, rows } = readPngRgba(SRC);
const scaled = nearestScale(rows, width, height, CONTENT, CONTENT);
const margin = Math.floor((CANVAS - CONTENT) / 2);
const canvas = Array.from({ length: CANVAS }, () => Buffer.alloc(CANVAS * 4));
for (let y = 0; y < CONTENT; y++) {
  scaled[y].copy(canvas[margin + y], margin * 4);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
writePng(OUT, CANVAS, CANVAS, canvas);
console.log(`Padded ${CONTENT}×${CONTENT} → ${OUT}`);

const result = spawnSync("pnpm", ["tauri", "icon", OUT], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
