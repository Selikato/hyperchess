import type { Metadata } from "next";
import { Suspense } from "react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { BotChessGame } from "@/components/bot/BotChessGame";
import { RegisterWelcomeBanner } from "@/components/RegisterWelcomeBanner";

export const metadata: Metadata = {
  title: "Bot — HyperChess",
  description: "Stockfish ile satranç",
};

export default function PlayBotPage() {
  return (
    <ArenaShell>
      <div className="flex min-h-screen flex-col bg-black text-zinc-100">
        <header className="flex w-full items-start justify-between gap-3 px-3 pt-3 pb-1 sm:px-4">
          <h1 className="text-base font-semibold text-white/95 sm:text-lg">
            Bot&apos;a karşı
          </h1>
        </header>
        <main className="flex flex-1 flex-col items-center px-2 pb-4 pt-1 sm:px-3">
          <Suspense fallback={null}>
            <RegisterWelcomeBanner />
          </Suspense>
          <BotChessGame />
        </main>
      </div>
    </ArenaShell>
  );
}
