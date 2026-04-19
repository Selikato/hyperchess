"use client";

import Link from "next/link";
import { Auth } from "@/components/Auth";
import { BotChessGame } from "@/components/bot/BotChessGame";
import { SessionBar } from "@/components/SessionBar";
import { useProfile } from "@/components/ProfileProvider";

export default function Home() {
  const { user, profileLoading } = useProfile();

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-200">
        Yükleniyor...
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#262421] text-[#e8e6e3] antialiased">
      <header className="flex w-full flex-wrap items-start justify-between gap-2 border-b border-[#3c3b36] px-3 py-3 sm:px-4">
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
      <main className="flex flex-1 flex-col items-center px-2 pb-4 pt-1 sm:px-3">
        <BotChessGame />
      </main>
    </div>
  );
}
