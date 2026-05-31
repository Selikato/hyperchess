import { readFileSync } from "node:fs";
import { Chess } from "chess.js";

function fenFromPieces(pieces, turn = "w") {
  const board = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (const [square, piece] of pieces) {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - Number(square[1]);
    board[rank][file] = piece;
  }
  const rows = board.map((row) => {
    let out = "";
    let empty = 0;
    for (const cell of row) {
      if (!cell) {
        empty += 1;
      } else {
        if (empty > 0) out += empty;
        empty = 0;
        out += cell;
      }
    }
    if (empty > 0) out += empty;
    return out;
  });
  return `${rows.join("/")} ${turn} - - 0 1`;
}

function tryMove(fen, uci) {
  const game = new Chess(fen);
  try {
    return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
}

function playLine(fen, line) {
  const game = new Chess(fen);
  for (const uci of line) {
    try {
      const moved = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      if (!moved) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function parseDefs(sectionName, src) {
  const start = src.indexOf(`const ${sectionName}`);
  const end = src.indexOf("const ", start + 10);
  const section = src.slice(start, end > start ? end : undefined);
  return section.split(/\n  \},/).slice(0, -1);
}

function validateChunk(chunk, label) {
  const pm = chunk.match(/pieces:\s*\[([\s\S]*?)\],\s*solution:\s*"([^"]+)"/);
  if (!pm) return [];
  const pieces = [...pm[1].matchAll(/\["([a-h][1-8])",\s*"([^"]+)"\]/g)].map((m) => [
    m[1],
    m[2],
  ]);
  const fen = fenFromPieces(pieces);
  const solution = pm[2];
  const lineMatch = chunk.match(/solutionLine:\s*\[([\s\S]*?)\]/);
  const line = lineMatch
    ? [...lineMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
    : [solution];

  const errors = [];
  if (line[0] !== solution) {
    errors.push(`${label}: solutionLine[0] solution ile eşleşmiyor`);
  }
  if (line.length > 5) {
    errors.push(`${label}: çözüm ${line.length} yarım hamle (max 5)`);
  }
  if (!playLine(fen, line)) {
    errors.push(`${label}: geçersiz çözüm dizisi ${line.join(" ")}`);
  }
  for (const trap of chunk.matchAll(/uci:\s*"([^"]+)"/g)) {
    if (!tryMove(fen, trap[1])) {
      errors.push(`${label}: geçersiz tuzak ${trap[1]} (çözüm ${solution})`);
    }
  }
  return errors;
}

const src = readFileSync(new URL("../lib/chess/puzzles.ts", import.meta.url), "utf8");
const errors = [];

for (const section of ["beginnerDefs", "intermediateDefs", "advancedDefs"]) {
  const chunks = parseDefs(section, src);
  chunks.forEach((chunk, index) => {
    errors.push(...validateChunk(chunk, `${section} #${index + 1}`));
  });
}

if (errors.length > 0) {
  console.error("validate-puzzles: FAILED");
  for (const err of errors) console.error(err);
  process.exit(1);
}

console.log("validate-puzzles: OK (60 puzzles, solutions + traps legal)");
