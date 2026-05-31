"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT_ID, adsEnabled, type AdPlacementId, getAdSlot } from "@/lib/ads/config";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type AdUnitProps = {
  placement: AdPlacementId;
  /** responsive | rectangle | horizontal | vertical */
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
  /** Yer tutucu yüksekliği (layout shift azaltır) */
  minHeight?: number;
};

export function AdUnit({
  placement,
  format = "auto",
  className = "",
  minHeight = 90,
}: AdUnitProps) {
  const slot = getAdSlot(placement);
  const pushed = useRef(false);

  useEffect(() => {
    if (!adsEnabled() || !slot || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      pushed.current = true;
    } catch {
      // Script henüz yüklenmemiş olabilir; bir sonraki render’da tekrar denenmez
    }
  }, [slot]);

  if (!adsEnabled() || !slot) return null;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-white/10 bg-[#1a1917] ${className}`}
      aria-label="Reklam"
    >
      <p className="px-2 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6f6d6a]">
        Reklam
      </p>
      <div className="px-1 pb-1">
        <ins
          className="adsbygoogle block w-full"
          style={{ display: "block", minHeight }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive={format === "auto" ? "true" : undefined}
        />
      </div>
    </div>
  );
}
