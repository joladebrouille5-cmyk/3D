// Logos des clubs depuis Transfermarkt (usage personnel) : node tools/fetch-tm-crests.mjs
// Lit tools/tm-ids.json (généré par tools/tm-ids.mjs), télécharge le logo « big » de chaque club,
// le réduit à 160 px (sharp) et écrit assets/crests-tm/<id>.png + src/data/crest-tm.js.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets/crests-tm');
mkdirSync(OUT, { recursive: true });
const ids = JSON.parse(readFileSync(join(root, 'tools/tm-ids.json'), 'utf8'));
const sharp = (await import('sharp')).default;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.transfermarkt.fr/' }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status === 404) return null;
    } catch { /* réseau */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

const files = {};
let ok = 0;
const miss = [];
for (const [id, v] of Object.entries(ids)) {
  const dest = join(OUT, `${id}.png`);
  let buf = null;
  for (const u of [`https://tmssl.akamaized.net/images/wappen/big/${v.tm}.png`, `https://img.a.transfermarkt.technology/wappen/big/${v.tm}.png`, `https://tmssl.akamaized.net/images/wappen/head/${v.tm}.png`]) {
    buf = await get(u);
    if (buf && buf.length > 300) break;
  }
  await sleep(250);
  if (!buf || buf.length <= 300) { miss.push(id); continue; }
  try {
    const png = await sharp(buf).resize({ width: 160, height: 160, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    writeFileSync(dest, png);
    files[id] = `assets/crests-tm/${id}.png`;
    ok++;
  } catch (e) { miss.push(`${id} (${e.message})`); }
}
writeFileSync(join(root, 'src/data/crest-tm.js'), `// Généré par tools/fetch-tm-crests.mjs — logos Transfermarkt téléchargés pour un usage personnel.\nexport const CREST_TM = ${JSON.stringify(files, null, 0)};\n`);
console.log(`${ok} logos Transfermarkt, ${miss.length} manquants${miss.length ? ` : ${miss.join(', ')}` : ''}`);
