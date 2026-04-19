"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Kayıt sonrası `?welcome=register` ile gelen tek seferlik mesaj. */
export function RegisterWelcomeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const visible = searchParams.get("welcome") === "register";

  useEffect(() => {
    if (!visible) return;
    router.replace(pathname ?? "/play/bot", { scroll: false });
  }, [visible, router, pathname]);

  if (!visible) return null;

  return (
    <div
      className="mb-3 rounded-md border border-[#5a7a45] bg-[#739552]/35 px-3 py-2.5 text-center text-sm font-medium text-white"
      role="status"
    >
      Başarıyla kayıt oldun, oyuna başla!
    </div>
  );
}
