/** Basit FEN doğrulama (API kötüye kullanımını azaltır). */
export function isLikelyValidFen(fen: string): boolean {
  const s = fen.trim();
  if (s.length < 10 || s.length > 120) return false;
  const parts = s.split(/\s+/);
  if (parts.length < 4) return false;
  const ranks = parts[0].split("/");
  if (ranks.length !== 8) return false;
  for (const rank of ranks) {
    let files = 0;
    for (const ch of rank) {
      if (ch >= "1" && ch <= "8") files += Number(ch);
      else if (/[prnbqkPRNBQK]/.test(ch)) files += 1;
      else return false;
    }
    if (files !== 8) return false;
  }
  return true;
}
