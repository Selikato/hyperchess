"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArenaShell, arena } from "@/components/arena/ArenaShell";
import { OnlineChessGame } from "@/components/arena/OnlineChessGame";
import { useProfile } from "@/components/ProfileProvider";

export default function OnlineMatchPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const { user, profileLoading } = useProfile();

  if (profileLoading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center text-sm ${arena.bg} ${arena.text}`}
      >
        Yükleniyor...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center text-sm ${arena.bg} ${arena.text}`}
      >
        <p>Maça katılmak için giriş yapmalısın.</p>
        <Link
          href="/"
          className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-[#262421] ${arena.green}`}
        >
          Ana sayfa
        </Link>
      </div>
    );
  }

  return (
    <ArenaShell>
      <div className="mx-auto flex w-full max-w-[min(100vw-1rem,640px)] flex-col px-3 py-5 sm:px-4">
        <OnlineChessGame matchId={matchId} />
      </div>
    </ArenaShell>
  );
}
