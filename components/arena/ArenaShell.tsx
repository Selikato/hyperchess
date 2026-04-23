"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CirclePlay,
  Cpu,
  LogOut,
  Puzzle,
  Search,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";
import {
  ChessMobileBottomNav,
  ChessMobileTopBar,
  chessMobileMainPaddingClass,
} from "@/components/arena/ChessMobileChrome";

/** Chess.com tarzı koyu palet */
export const arena = {
  bg: "bg-[#262421]",
  panel: "bg-[#312e2b]",
  sidebar: "bg-[#201f1b]",
  border: "border-[#3c3b36]",
  text: "text-[#e8e6e3]",
  muted: "text-[#9b9893]",
  green: "bg-[#81b64c] hover:bg-[#8fc057] active:bg-[#74a843]",
  greenText: "text-[#81b64c]",
} as const;

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  disabled,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  disabled?: boolean;
}) {
  const base =
    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors";
  if (disabled) {
    return (
      <div
        className={`${base} cursor-not-allowed opacity-40 ${arena.muted}`}
        aria-disabled
      >
        <Icon className="size-[22px] shrink-0 opacity-80" aria-hidden />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} ${
        active
          ? `${arena.panel} text-white shadow-sm ring-1 ring-white/5`
          : `${arena.muted} hover:bg-white/5 hover:text-[#e8e6e3]`
      } ${active ? "border-l-[3px] border-[#81b64c] pl-[9px]" : "border-l-[3px] border-transparent pl-[9px]"}`}
    >
      <Icon className="size-[22px] shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export function ArenaShell({
  children,
  rightAside,
}: {
  children: React.ReactNode;
  rightAside?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, elo, profileLoading } = useProfile();

  const arenaActive = pathname?.startsWith("/play/online") ?? false;
  const botActive = pathname?.startsWith("/play/bot") ?? false;

  const display =
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Oyuncu";

  const initial = display.slice(0, 1).toUpperCase();

  return (
    <div className={`relative flex min-h-screen ${arena.bg} ${arena.text} font-sans antialiased`}>
      <ChessMobileTopBar homeHref="/play/online" />
      {/* Sol şerit — masaüstü */}
      <aside
        className={`hidden w-[212px] shrink-0 flex-col border-r lg:flex ${arena.border} ${arena.sidebar}`}
      >
        <div className="border-b border-white/5 px-3 py-4">
          <Link
            href="/play/online"
            className="flex items-center gap-2 font-bold tracking-tight text-white"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-[#81b64c] text-lg text-[#262421]">
              ♟
            </span>
            <span className="text-[15px] leading-tight">
              Hyper
              <br />
              Chess
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
          <NavItem
            href="/play/online"
            label="Çevrimiçi"
            icon={CirclePlay}
            active={arenaActive}
          />
          <NavItem
            href="/play/bot"
            label="Bot ile oyna"
            icon={Cpu}
            active={botActive}
          />
          <NavItem href="#" label="Bulmacalar" icon={Puzzle} active={false} disabled />
          <NavItem href="#" label="Öğren" icon={BookOpen} active={false} disabled />
          <NavItem href="#" label="Lig" icon={Trophy} active={false} disabled />
          <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#77a047]">
            Turnuvalar
          </div>
          <NavItem
            href="/play/online/tournaments"
            label="Turnuva Merkezi"
            icon={Trophy}
            active={pathname?.startsWith("/play/online/tournaments") ?? false}
          />
        </nav>

        <div className="mt-auto border-t border-white/5 p-2">
          <button
            type="button"
            className={`mb-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm ${arena.muted} hover:bg-white/5 hover:text-[#e8e6e3]`}
          >
            <Search className="size-[18px] shrink-0" aria-hidden />
            <span className="truncate">Ara</span>
          </button>
          {user && (
            <div className="flex items-center gap-2 rounded-md px-2 py-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#454240] text-sm font-bold text-white">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{display}</p>
                <p className="truncate text-[11px] tabular-nums text-[#9b9893]">
                  {profileLoading ? "…" : `Elo ${elo ?? "—"}`}
                </p>
              </div>
              <button
                type="button"
                title="Çıkış"
                onClick={() => {
                  void supabase.auth.signOut().then(() => {
                    router.push("/login");
                    router.refresh();
                  });
                }}
                className="shrink-0 rounded p-1.5 text-[#9b9893] hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Orta + sağ */}
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <div
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${arena.bg} ${chessMobileMainPaddingClass()}`}
        >
          {children}
        </div>
        {rightAside != null && (
          <aside
            className={`w-full shrink-0 border-t lg:w-[300px] lg:border-l lg:border-t-0 ${arena.border} ${arena.bg} lg:overflow-y-auto`}
          >
            {rightAside}
          </aside>
        )}
      </div>
      <ChessMobileBottomNav homeHref="/play/online" />
    </div>
  );
}
