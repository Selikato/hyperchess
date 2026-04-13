"use client";

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
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="flex w-full justify-end px-3 pt-3 pb-1 sm:px-4">
        <SessionBar />
      </header>
      <main className="flex flex-1 flex-col items-center px-2 pb-4 pt-1 sm:px-3">
        <BotChessGame />
      </main>
    </div>
  );
}
