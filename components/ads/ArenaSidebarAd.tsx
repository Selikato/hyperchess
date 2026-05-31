"use client";

import { usePathname } from "next/navigation";
import { AdUnit } from "@/components/ads/AdUnit";
import {
  isActiveOnlineMatchPath,
  placementReady,
} from "@/lib/ads/config";

/** Masaüstü sol menü altı — aktif maç sayfasında gizlenir. */
export function ArenaSidebarAd() {
  const pathname = usePathname();

  if (!placementReady("sidebar") || isActiveOnlineMatchPath(pathname)) {
    return null;
  }

  return (
    <div className="hidden border-t border-white/5 p-2 lg:block">
      <AdUnit placement="sidebar" format="vertical" minHeight={250} className="w-full" />
    </div>
  );
}
