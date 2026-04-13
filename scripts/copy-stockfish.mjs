/**
 * Stockfish.js (lite-single) — GitHub release’den indirilir.
 * İstenen kullanım: public/stockfish.js (WebWorker) + public/stockfish.wasm
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public");
const tag = "v18.0.0";
const base = `https://github.com/nmrugg/stockfish.js/releases/download/${tag}/`;
const files = [
  ["stockfish-18-lite-single.js", "stockfish.js"],
  ["stockfish-18-lite-single.wasm", "stockfish.wasm"],
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  for (const [sourceName, targetName] of files) {
    const url = base + sourceName;
    const dest = path.join(outDir, targetName);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`copy-stockfish: ${url} → HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    console.log(`copy-stockfish: ${targetName} (${buf.length} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
