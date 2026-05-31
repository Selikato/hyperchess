"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { arena } from "@/components/arena/ArenaShell";

/** Çevrimiçi arena özellikleri için giriş zorunluluğu */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profileLoading } = useProfile();
  const pathname = usePathname();

  if (profileLoading) {
    return (
      <div
        className={`flex min-h-[40vh] items-center justify-center text-sm ${arena.muted}`}
      >
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(pathname ?? "/play/online");
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-lg font-semibold text-white">Giriş gerekli</p>
        <p className={`text-sm ${arena.muted}`}>
          Bu özelliği kullanmak için HyperChess hesabınla giriş yap.
        </p>
        <Link
          href={`/login?next=${next}`}
          className={`rounded-lg px-6 py-3 text-sm font-bold text-[#262421] ${arena.green}`}
        >
          Giriş yap / Kayıt ol
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
