/** Müşteri destek e-postası — Vercel’de NEXT_PUBLIC_SUPPORT_EMAIL ile ayarlanır */
export function getSupportEmail(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (fromEnv && fromEnv.includes("@")) return fromEnv;
  return "destek@hyperchess.app";
}
