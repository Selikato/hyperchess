"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import { Auth } from "@/components/Auth";
import { BotChessGame } from "@/components/bot/BotChessGame";
import {
  ChessMobileBottomNav,
  ChessMobileTopBar,
  chessMobileMainPaddingClass,
} from "@/components/arena/ChessMobileChrome";
import { SessionBar } from "@/components/SessionBar";
import { useProfile } from "@/components/ProfileProvider";

function QueueFallbackBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const show = searchParams.get("fromQueue") === "1";

  const dismiss = useCallback(() => {
    router.replace("/");
  }, [router]);

  if (!show) return null;

  return (
    <div
      className="mb-2 flex w-full max-w-[min(100vw-0.5rem,560px)] items-start justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/95"
      role="status"
    >
      <p className="min-w-0 flex-1 leading-snug">
        10 saniye içinde insan rakibi bulunamadı; burada Stockfish ile
        oynamaya devam edebilirsin.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded border border-amber-500/50 px-2 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-500/20"
      >
        Tamam
      </button>
    </div>
  );
}

function HomeAuthedShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showBot = searchParams.get("fromQueue") === "1";

  useEffect(() => {
    if (!showBot) {
      router.replace("/play/online");
    }
  }, [router, showBot]);

  if (!showBot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] text-sm text-[#e8e6e3]">
        Arena açılıyor...
      </div>
    );
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
        <Suspense fallback={null}>
          <QueueFallbackBanner />
        </Suspense>
        <BotChessGame />
      </main>

      <ChessMobileBottomNav homeHref="/" />
    </div>
  );
}

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

  return <HomeAuthedShell />;
}
