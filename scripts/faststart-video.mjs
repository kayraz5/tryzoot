// EDITOR: MATTHEW
//Moves an MP4's `moov` atom in front of `mdat` (what ffmpeg calls -movflags +faststart), without needing ffmpeg.

import { readFileSync, writeFileSync } from "node:fs";

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) {
  console.error("usage: node scripts/faststart-video.mjs <in.mp4> <out.mp4>");
  process.exit(1);
}

const src = readFileSync(IN);

/** Top-level box table. */
function topBoxes(buf) {
  const out = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) {
      size = buf.length - p;
    }
    if (size < header) break;
    out.push({ type, start: p, size });
    p += size;
  }
  return out;
}

/** Adds `delta` to every chunk offset inside a moov buffer, in place. */
function patchChunkOffsets(moov, delta) {
  let patched = 0;
  const walk = (start, end) => {
    let p = start;
    while (p + 8 <= end) {
      const size = moov.readUInt32BE(p);
      const type = moov.toString("ascii", p + 4, p + 8);
      if (size < 8 || p + size > end) break;
      if (type === "stco") {
        const n = moov.readUInt32BE(p + 12);
        for (let i = 0; i < n; i++) {
          const at = p + 16 + i * 4;
          moov.writeUInt32BE(moov.readUInt32BE(at) + delta, at);
        }
        patched += n;
      } else if (type === "co64") {
        const n = moov.readUInt32BE(p + 12);
        for (let i = 0; i < n; i++) {
          const at = p + 16 + i * 8;
          moov.writeBigUInt64BE(moov.readBigUInt64BE(at) + BigInt(delta), at);
        }
        patched += n;
      } else if (
        ["trak", "mdia", "minf", "stbl", "edts", "dinf", "udta"].includes(type)
      ) {
        walk(p + 8, p + size);
      }
      p += size;
    }
  };
  walk(8, moov.length);
  return patched;
}

const boxes = topBoxes(src);
const moovBox = boxes.find((b) => b.type === "moov");
const mdatBox = boxes.find((b) => b.type === "mdat");
if (!moovBox || !mdatBox) {
  console.error("not an mp4 with both moov and mdat");
  process.exit(1);
}
if (moovBox.start < mdatBox.start) {
  console.log("already faststart; copying unchanged");
  writeFileSync(OUT, src);
  process.exit(0);
}

// Everything that is not moov, mdat, or free keeps its original order up front.
const leading = boxes.filter(
  (b) => !["moov", "mdat", "free", "skip"].includes(b.type),
);
const moov = Buffer.from(
  src.subarray(moovBox.start, moovBox.start + moovBox.size),
);

const leadingBytes = leading.reduce((n, b) => n + b.size, 0);
const newMdatStart = leadingBytes + moov.length;
const delta = newMdatStart - mdatBox.start;

const patched = patchChunkOffsets(moov, delta);

const out = Buffer.concat([
  ...leading.map((b) => src.subarray(b.start, b.start + b.size)),
  moov,
  src.subarray(mdatBox.start, mdatBox.start + mdatBox.size),
]);

writeFileSync(OUT, out);

console.log(
  `in  ${(src.length / 1048576).toFixed(2)}MB  order: ${boxes.map((b) => b.type).join(" ")}`,
);
console.log(
  `out ${(out.length / 1048576).toFixed(2)}MB  order: ${topBoxes(out)
    .map((b) => b.type)
    .join(" ")}`,
);
console.log(
  `moov moved before mdat, ${patched} chunk offsets shifted by ${delta} bytes`,
);
