/**
 * generate-icons.js
 *
 * Generates every application icon asset from a single square source image
 * (assets/icons/app.png -- the HvH logo, 256x256).
 *
 * Produces:
 *   assets/icons/app.ico            multi-size Windows icon (16..256) -> exe/installer/window
 *   assets/icons/icon.icns          macOS icon bundle (for completeness)
 *   assets/icons/icon-<size>.png    standalone PNGs (16,24,32,48,64,128,256,512)
 *   src/renderer/logo.png           UI branding logo (256)
 *   src/renderer/favicon.png        renderer favicon (64)
 *
 * Pure-JS tooling only (png2icons + jimp) so it runs anywhere without native builds.
 * Run:  npm run generate-icons
 */

const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');
const { Jimp, ResizeStrategy } = require('jimp');

const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'assets', 'icons');
const RENDERER_DIR = path.join(ROOT, 'src', 'renderer');
const SOURCE = path.join(ICONS_DIR, 'app.png');

// Standalone PNG icon sizes required by the task.
const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writeResizedPng(base, size, outPath) {
  const img = base.clone().resize({ w: size, h: size, mode: ResizeStrategy.BICUBIC });
  await img.write(outPath);
  const bytes = fs.statSync(outPath).size;
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${size}x${size}, ${bytes} bytes)`);
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source image not found: ${SOURCE}`);
  }

  ensureDir(ICONS_DIR);
  ensureDir(RENDERER_DIR);

  const srcBuffer = fs.readFileSync(SOURCE);
  console.log(`Source: ${path.relative(ROOT, SOURCE)} (${srcBuffer.length} bytes)`);

  // --- 1. Windows .ico (multi-size) -----------------------------------------
  // createICO(input, scalingAlgorithm, numOfColors, usePNG, forWinExe)
  // usePNG=false -> BMP for small sizes + PNG for 256 (max Windows compatibility).
  const icoBuffer = png2icons.createICO(srcBuffer, png2icons.BICUBIC, 0, false, false);
  if (!icoBuffer || icoBuffer.length === 0) {
    throw new Error('png2icons.createICO returned empty output');
  }
  const icoPath = path.join(ICONS_DIR, 'app.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`  wrote ${path.relative(ROOT, icoPath)} (${icoBuffer.length} bytes)`);

  // --- 2. macOS .icns ---------------------------------------------------------
  const icnsBuffer = png2icons.createICNS(srcBuffer, png2icons.BICUBIC, 0);
  if (!icnsBuffer || icnsBuffer.length === 0) {
    throw new Error('png2icons.createICNS returned empty output');
  }
  const icnsPath = path.join(ICONS_DIR, 'icon.icns');
  fs.writeFileSync(icnsPath, icnsBuffer);
  console.log(`  wrote ${path.relative(ROOT, icnsPath)} (${icnsBuffer.length} bytes)`);

  // --- 3. Standalone PNG sizes ------------------------------------------------
  const base = await Jimp.fromBuffer(srcBuffer);
  for (const size of PNG_SIZES) {
    await writeResizedPng(base, size, path.join(ICONS_DIR, `icon-${size}.png`));
  }

  // --- 4. Renderer UI branding ------------------------------------------------
  await writeResizedPng(base, 256, path.join(RENDERER_DIR, 'logo.png'));
  await writeResizedPng(base, 64, path.join(RENDERER_DIR, 'favicon.png'));

  console.log('\nIcon generation complete.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
