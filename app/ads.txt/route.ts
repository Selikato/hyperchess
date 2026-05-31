import { adsensePublisherId } from "@/lib/ads/config";

/** Google AdSense ads.txt — yayıncı kimliği .env’den okunur. */
export async function GET() {
  const pub = adsensePublisherId();
  const body = pub
    ? `google.com, pub-${pub}, DIRECT, f08c47fec0942fa0\n`
    : "# AdSense etkin değil: NEXT_PUBLIC_ADSENSE_CLIENT_ID ayarlayın\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
