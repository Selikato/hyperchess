/** OAuth / e-posta callback sonrası güvenli dahili yönlendirme */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  if (trimmed.length > 256) return fallback;
  return trimmed;
}
