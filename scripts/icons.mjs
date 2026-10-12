import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
// Original bridge/checker mark, supersampled for crisp small toolbar icons.
const crc32 = (data) => {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const kind = Buffer.from(name),
    len = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([len, kind, data, crc]);
};
mkdirSync("public/icons", { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const bytes = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgba = [0, 0, 0, 0];
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const u = (x + (sx + 0.5) / 4) / size,
            v = (y + (sy + 0.5) / 4) / size;
          const corner =
            Math.hypot(
              Math.max(0.18 - u, 0, u - 0.82),
              Math.max(0.18 - v, 0, v - 0.82),
            ) < 0.17;
          let color = corner ? [31, 78, 58, 255] : [0, 0, 0, 0];
          const tower =
            ((u > 0.19 && u < 0.34) || (u > 0.66 && u < 0.81)) &&
            v > 0.27 &&
            v < 0.76;
          const deck = u > 0.19 && u < 0.81 && v > 0.41 && v < 0.57;
          const arch =
            u > 0.34 &&
            u < 0.66 &&
            v > 0.5 &&
            v < 0.76 &&
            Math.hypot((u - 0.5) / 0.16, (v - 0.76) / 0.24) > 1;
          const base = u > 0.15 && u < 0.85 && v > 0.74 && v < 0.82;
          if (tower || deck || arch || base) color = [233, 243, 218, 255];
          if (u > 0.43 && u < 0.57 && v > 0.21 && v < 0.35)
            color = [231, 181, 83, 255];
          color.forEach((c, i) => (rgba[i] += c / 16));
        }
      rgba.forEach(
        (c, i) => (bytes[y * (size * 4 + 1) + 1 + x * 4 + i] = Math.round(c)),
      );
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    `public/icons/${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(bytes)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
