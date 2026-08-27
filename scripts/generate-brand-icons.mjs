/**
 * Generates the browser-tab and home-screen icons from `public/logo_rd.jpg`.
 *
 * The issued logo is a wide plaque whose lower third is the wordmark. Shrunk to
 * a 16px tab icon the lettering turns to mush, so the icon is the gold lattice
 * alone, centred on the plaque's own red. The lattice region and the background
 * colour are both measured from the artwork rather than hard-coded, so
 * replacing the logo file and rerunning this produces a matching icon.
 *
 *   node scripts/generate-brand-icons.mjs
 */

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SOURCE = "public/logo_rd.jpg";
const PROBE = "_icon-probe.html";

/**
 * Padding around the lattice, as a fraction of the square's side. Kept small on
 * purpose: the lattice is roughly twice as wide as it is tall, so any margin
 * costs it size in the one dimension that is already constrained.
 */
const MARGIN = 0.04;

const OUTPUTS = [
  { path: "src/app/icon.png", size: 512 },
  { path: "src/app/apple-icon.png", size: 180 },
  // Wrapped into public/favicon.ico below. Browsers and crawlers still request
  // that path directly even when the document declares a PNG icon.
  { path: "_favicon-32.png", size: 32, temporary: true },
];

/**
 * Wraps a PNG in an ICO container. The Vista-era ICO format allows a PNG
 * payload verbatim, so no bitmap re-encoding is needed: a 6-byte directory
 * header, one 16-byte entry, then the PNG.
 */
function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // palette size: not paletted
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

  return Buffer.concat([header, entry, png]);
}

const base64 = readFileSync(SOURCE).toString("base64");
writeFileSync(
  PROBE,
  `<body style="margin:0"><img id="logo" src="data:image/jpeg;base64,${base64}"></body>`,
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
await page.goto(pathToFileURL(PROBE).href);

const measured = await page.evaluate(() => {
  const img = document.getElementById("logo");
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const at = (x, y) => (y * width + x) * 4;
  const isGold = (i) => {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    return r > 150 && g > 110 && g < 210 && b < 120 && r - b > 70;
  };

  // Scan above the wordmark only.
  const limit = Math.floor(height * 0.62);
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < limit; y++) {
    for (let x = 0; x < width; x++) {
      if (!isGold(at(x, y))) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // The plaque colour, sampled from a corner well clear of the lattice.
  const corner = at(4, 4);
  const background = `rgb(${data[corner]}, ${data[corner + 1]}, ${data[corner + 2]})`;

  return { minX, minY, maxX, maxY, background };
});

await page.close();

const latticeWidth = measured.maxX - measured.minX + 1;
const latticeHeight = measured.maxY - measured.minY + 1;

// The whole lattice is used, frame and both motifs, so the tab icon is the
// mark as issued rather than a fragment of it. It is a wide band, so it cannot
// fill a square canvas vertically; the margin above is minimised to give it as
// much width as the canvas allows.
const cropWidth = latticeWidth;
const cropHeight = latticeHeight;
const cropX = measured.minX;
const cropY = measured.minY;

for (const { path, size, temporary } of OUTPUTS) {
  const inner = size * (1 - MARGIN * 2);
  const scale = Math.min(inner / cropWidth, inner / cropHeight);
  const drawWidth = cropWidth * scale;
  const drawHeight = cropHeight * scale;

  const iconPage = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await iconPage.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;background:${measured.background}">
       <canvas id="c" width="${size}" height="${size}"></canvas>
     </body>`,
  );
  await iconPage.evaluate(
    async ({
      base64,
      measured,
      size,
      drawWidth,
      drawHeight,
      cropWidth,
      cropHeight,
      cropX,
      cropY,
    }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${base64}`;
      await img.decode();
      const ctx = document.getElementById("c").getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = measured.background;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        (size - drawWidth) / 2,
        (size - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
    },
    {
      base64,
      measured,
      size,
      drawWidth,
      drawHeight,
      cropWidth,
      cropHeight,
      cropX,
      cropY,
    },
  );

  const buffer = await iconPage
    .locator("#c")
    .screenshot({ omitBackground: false });
  writeFileSync(path, buffer);
  await iconPage.close();

  if (temporary) {
    writeFileSync("public/favicon.ico", pngToIco(buffer));
    unlinkSync(path);
    console.info("Wrote public/favicon.ico (32×32).");
  } else {
    console.info(`Wrote ${path} (${size}×${size}).`);
  }
}

await browser.close();
unlinkSync(PROBE);
console.info(
  `Lattice measured at ${latticeWidth}×${latticeHeight} from ` +
    `(${measured.minX}, ${measured.minY}); cropped ${cropWidth}×${cropHeight} ` +
    `on ${measured.background}.`,
);
