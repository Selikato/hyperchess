"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Binoculars,
  BookOpen,
  CirclePlay,
  Flame,
  Menu,
  Puzzle,
  Trophy,
  Users,
} from "lucide-react";
import { arena } from "@/components/arena/ArenaShell";

const topBarH = "h-12";

/** Sabit üst şerit (Chess.com mobil üst ikonlar) */
export function ChessMobileTopBar({
  homeHref = "/play/online",
}: {
  homeHref?: string;
}) {
  const friendsHref =
    homeHref === "/play/online" ? "/play/online#friends" : "/play/online#friends";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex ${topBarH} items-center justify-between border-b ${arena.border} bg-[#121212] px-3 lg:hidden`}
    >
      <div className="flex items-center gap-2">
        <Link
          href={homeHref}
          className="flex size-9 items-center justify-center rounded-md bg-[#2d2d2d] text-lg text-white"
          aria-label="Ana sayfa"
        >
          ♟
        </Link>
        <span
          className="rounded p-1.5 text-[#c74a4a] opacity-70"
          aria-hidden
          title="Lig (yakında)"
        >
          <Trophy className="size-5" />
        </span>
        <div className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold text-white">
          <Flame className="size-4 text-orange-400" aria-hidden />
          <span className="tabular-nums">4</span>
        </div>
      </div>
      {homeHref === "/" && (
        <Link
          href="/play/online"
          className="mr-1 rounded-md border border-[#3c3b36] bg-[#312e2b] px-2 py-1 text-[11px] font-bold text-[#81b64c]"
        >
          Arena
        </Link>
      )}
      <Link
        href={friendsHref}
        className="rounded p-2 text-sky-400 hover:bg-white/5"
        aria-label="Arkadaşlar"
      >
        <Users className="size-6" />
      </Link>
    </header>
  );
}

type TabKey = "home" | "puzzles" | "learn" | "watch" | "more";

/** Sabit alt navigasyon (Chess.com 5 sekme) */
export function ChessMobileBottomNav({
  homeHref = "/play/online",
}: {
  homeHref?: string;
}) {
  const pathname = usePathname();
  const homeActive =
    homeHref === "/play/online"
      ? (pathname?.startsWith("/play/online") ?? false)
      : pathname === "/";

  const entries: {
    tab: TabKey;
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
  }[] = [
    { tab: "home", href: homeHref, label: "Ana sayfa", icon: CirclePlay },
    { tab: "puzzles", href: "#", label: "Bulmacalar", icon: Puzzle, disabled: true },
    { tab: "learn", href: "#", label: "Öğren", icon: BookOpen, disabled: true },
    { tab: "watch", href: "#", label: "İzle", icon: Binoculars, disabled: true },
    { tab: "more", href: "#", label: "Daha fazla", icon: Menu, disabled: true },
  ];

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-50 flex border-t ${arena.border} bg-[#121212] px-1 pt-1 lg:hidden`}
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      aria-label="Ana navigasyon"
    >
      {entries.map((item) => {
        const Icon = item.icon;
        const active = item.tab === "home" && homeActive;
        const iconCls = active ? "text-white" : "text-[#9b9893]";
        const labelCls = active ? "text-white" : "text-[#9b9893]";

        const inner = (
          <>
            <span className="relative inline-flex">
              <Icon className={`size-6 ${iconCls}`} />
              {item.tab === "home" && active && (
                <span className="absolute -right-1.5 -top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white">
                  1
                </span>
              )}
            </span>
            <span
              className={`mt-0.5 max-w-[4.25rem] truncate text-center text-[10px] font-medium leading-tight ${labelCls}`}
            >
              {item.label}
            </span>
          </>
        );

        if (item.disabled) {
          return (
            <div
              key={item.tab}
              className="flex min-w-0 flex-1 cursor-not-allowed flex-col items-center py-2 opacity-45"
            >
              {inner}
            </div>
          );
        }

        return (
          <Link
            key={item.tab}
            href={item.href}
            className="flex min-w-0 flex-1 flex-col items-center py-2"
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

/** Ana kaydırma alanı: mobilde üst/alt çubuk için boşluk */
export function chessMobileMainPaddingClass() {
  return "pt-12 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pt-0 lg:pb-0";
}
