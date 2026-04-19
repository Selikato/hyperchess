"use client";

import Link from "next/link";
import { Auth } from "@/components/Auth";
import { BotChessGame } from "@/components/bot/BotChessGame";
import {
  ChessMobileBottomNav,
  ChessMobileTopBar,
  chessMobileMainPaddingClass,
} from "@/components/arena/ChessMobileChrome";
import { SessionBar } from "@/components/SessionBar";
import { useProfile } from "@/components/ProfileProvider";

export default function Home() {
  const { user, profileLoading } = useProfile();

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#262421] text-sm text-[#e8e6e3]">
        Yükleniyor...
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#121212] text-[#e8e6e3] antialiased lg:bg-[#262421]">
      <ChessMobileTopBar homeHref="/" />

      <header className="hidden w-full flex-wrap items-start justify-between gap-2 border-b border-[#3c3b36] px-3 py-3 sm:px-4 lg:flex">
        <nav className="flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="rounded-md border border-[#81b64c]/50 bg-[#81b64c] px-2.5 py-1.5 font-semibold text-[#262421]">
            Bot maçı
          </span>
          <Link
            href="/play/online"
            className="rounded-md border border-[#3c3b36] bg-[#312e2b] px-2.5 py-1.5 font-medium text-[#e8e6e3] hover:bg-[#3a3734]"
          >
            Arena
          </Link>
        </nav>
        <SessionBar />
      </header>

      <main
        className={`flex flex-1 flex-col items-center px-2 pb-4 pt-1 sm:px-3 ${chessMobileMainPaddingClass()}`}
      >
        <div className="mb-2 flex w-full max-w-[min(100vw-0.5rem,560px)] justify-end lg:hidden">
          <SessionBar />
        </div>
        <BotChessGame />
      </main>

      <ChessMobileBottomNav homeHref="/" />
    </div>
  );
}
