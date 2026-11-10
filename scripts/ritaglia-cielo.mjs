// Separa il primo piano (montagne, paese, alberi, terrazza) dal cielo della foto dell'hero,
// per far passare il titolo "dietro" le montagne.
// Uso: npm run ritaglia-cielo   (da rifare ogni volta che cambi la foto in src/assets/foto/hero/)
// Funziona con foto dove il cielo è sopra e il lago comincia a circa metà altezza.
import sharp from 'sharp';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';

const HERO = 'src/assets/foto/hero';
const FRONT = 'src/assets/foto/hero-primo-piano';
const file = readdirSync(HERO).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort()[0];
if (!file) throw new Error(`Nessuna foto in ${HERO}`);
const SRC = `${HERO}/${file}`;
rmSync(FRONT, { recursive: true, force: true });
mkdirSync(FRONT, { recursive: true });
const OUT = `${FRONT}/${file.replace(/\.[^.]+$/, '')}.png`;
const PREVIEW = process.argv[2]; // optional: a JPG preview with the removed sky in red

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const px = (x, y) => (y * w + x) * 3;

// 1. Sky-coloured pixels: bright, blue-dominant, or the white of the clouds.
const skyLike = new Uint8Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = px(x, y);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const light = (r + g + b) / 3;
    const blueSky = (b > 150 && b >= g && b - r > 35 && light > 120) || (y < h * 0.15 && b > 140 && b - r > 70 && b > g); // deep blue at the top
    const cloud = light > 205 && Math.abs(r - b) < 40;
    skyLike[y * w + x] = blueSky || cloud ? 1 : 0;
  }
}

// 2. Skyline, column by column: the sky ends where a solid run of non-sky pixels starts
//    (thin things like a power line are ignored). Below the lake horizon nothing is sky,
//    so the blue lake and the railing never get cut.
const horizon = Math.round(h * 0.455);
const RUN = 14;
const skyline = new Int32Array(w);
for (let x = 0; x < w; x++) {
  let run = 0;
  skyline[x] = horizon;
  for (let y = 0; y < horizon; y++) {
    run = skyLike[y * w + x] ? 0 : run + 1;
    if (run >= RUN) {
      skyline[x] = y - RUN + 1;
      break;
    }
  }
}
// Median over 9 columns removes single-column spikes.
const smooth = new Int32Array(w);
for (let x = 0; x < w; x++) {
  const window = [];
  for (let k = -4; k <= 4; k++) window.push(skyline[Math.min(w - 1, Math.max(0, x + k))]);
  smooth[x] = window.sort((a, b) => a - b)[4];
}
const sky = new Uint8Array(w * h);
for (let x = 0; x < w; x++) for (let y = 0; y < smooth[x]; y++) sky[y * w + x] = 1;

// 3. Foreground alpha = not sky, softened by 1.5 px so the edge is not jagged.
const alpha = Buffer.alloc(w * h);
for (let i = 0; i < w * h; i++) alpha[i] = sky[i] ? 0 : 255;
const softAlpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
  .blur(1.5)
  .extractChannel(0)
  .raw()
  .toBuffer();
if (softAlpha.length !== w * h) throw new Error(`Maschera di dimensione inattesa: ${softAlpha.length}`);

await sharp(SRC).joinChannel(softAlpha, { raw: { width: w, height: h, channels: 1 } }).png({ compressionLevel: 9 }).toFile(OUT);
if (PREVIEW) {
  // Preview: the foreground over bright red, so any missed sky or eaten mountain shows at once.
  const flat = await sharp({ create: { width: w, height: h, channels: 3, background: '#ff2020' } })
    .composite([{ input: OUT }])
    .png()
    .toBuffer();
  await sharp(flat).resize(1000).jpeg().toFile(PREVIEW);
}
console.log(`Primo piano salvato in ${OUT} (${w}×${h}), cielo: ${Math.round((sky.reduce((a, b) => a + b, 0) / (w * h)) * 100)}% della foto`);
