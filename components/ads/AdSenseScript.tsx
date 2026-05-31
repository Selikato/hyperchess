import Script from "next/script";
import { ADSENSE_CLIENT_ID, adsEnabled } from "@/lib/ads/config";

/** Kök layout’ta bir kez yüklenir. */
export function AdSenseScript() {
  if (!adsEnabled()) return null;

  return (
    <Script
      id="adsense-loader"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
