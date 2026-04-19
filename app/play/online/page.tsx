"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Clock, Cpu, GraduationCap } from "lucide-react";
import { ActiveMatchesStrip } from "@/components/arena/ActiveMatchesStrip";
import { arena, ArenaShell } from "@/components/arena/ArenaShell";
import { FriendsPanel } from "@/components/arena/FriendsPanel";
import { useProfile } from "@/components/ProfileProvider";
import { joinPublicMatch } from "@/lib/arena/api";

function MobileListRow({
  href,
  onClick,
  static: isStatic,
  thumb,
  title,
  subtitle,
  right,
}: {
  href?: string;
  onClick?: () => void;
  static?: boolean;
  thumb: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  const row = (
    <>
      <div className="flex size-[88px] shrink-0 items-center justify-center rounded-md bg-[#312e2b] text-3xl text-white">
        {thumb}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold leading-snug text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-[#9b9893]">{subtitle}</p>
        {right}
      </div>
    </>
  );
  const cls = `flex w-full gap-3 border-b ${arena.border} py-3 text-left transition active:bg-white/5`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {row}
      </button>
    );
  }
  if (isStatic || !href) {
    return <div className={cls}>{row}</div>;
  }
  return (
    <Link href={href} className={cls}>
      {row}
    </Link>
  );
}

export default function OnlineLobbyPage() {
  const router = useRouter();
  const { user, profileLoading, elo } = useProfile();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startQuick = () => {
    setErr(null);
    setBusy(true);
    void joinPublicMatch()
      .then((id) => router.push(`/play/online/${id}`))
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "Eşleşme başarısız.");
      })
      .finally(() => setBusy(false));
  };

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
        <p>Online Arena için giriş yapmalısın.</p>
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
    <ArenaShell rightAside={<FriendsPanel variant="rail" />}>
      {/* —— Mobil: Chess.com dikey liste + Oyna —— */}
      <div className="lg:hidden">
        <div className="border-b border-[#2a2926] bg-[#121212] px-1">
          <MobileListRow
            static
            thumb="♟"
            title="Günlük bulmaca"
            subtitle="Yakında — taktik görevleri"
            right={
              <div className="mt-2 flex gap-3 text-[#81b64c]">
                <span className="text-xs font-semibold">Bulmaca</span>
                <span className="flex items-center gap-0.5 text-xs font-semibold">
                  <span className="text-orange-400">🔥</span> 1
                </span>
              </div>
            }
          />
          <MobileListRow
            href="/"
            thumb={<Cpu className="size-10 text-[#81b64c]" aria-hidden />}
            title="Botlarla oynayın"
            subtitle="Stockfish · Elo güncellemesi"
            right={
              <div className="mt-2 flex size-10 items-center justify-center rounded-full bg-[#454240] text-lg">
                ♟
              </div>
            }
          />
          <MobileListRow
            onClick={() => {
              if (!busy) startQuick();
            }}
            thumb="♟"
            title="Çevrimiçi oyna"
            subtitle={busy ? "Eşleşiliyor…" : "Hızlı maç · rasgele rakip"}
            right={
              <div className="mt-2 flex items-center gap-1 text-amber-200/90">
                <span className="text-xs">🏆</span>
                <span className="text-xs font-semibold">Arena</span>
              </div>
            }
          />
          <MobileListRow
            static
            thumb={<GraduationCap className="size-10 text-sky-400" aria-hidden />}
            title="Sonraki ders"
            subtitle="Tahta temelleri (yakında)"
            right={
              <div className="mt-2">
                <BookOpen className="size-6 text-sky-400" aria-hidden />
              </div>
            }
          />
        </div>

        <section className="px-4 pt-5">
          <h2 className="text-base font-bold text-white">İstatistikler</h2>
          <p className="mt-1 text-sm text-[#9b9893]">
            Elo{" "}
            <span className="font-semibold tabular-nums text-[#e8e6e3]">
              {elo ?? "—"}
            </span>
          </p>
        </section>

        <div className="px-4 pb-3 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => startQuick()}
            className={`w-full rounded-xl py-3.5 text-center text-lg font-bold text-[#262421] shadow-lg ${arena.green} disabled:opacity-55`}
          >
            {busy ? "Eşleşiliyor…" : "Oyna"}
          </button>
          {err && <p className="mt-2 text-center text-sm text-red-400">{err}</p>}
        </div>

        <div className="px-4">
          <ActiveMatchesStrip />
        </div>
      </div>

      {/* —— Masaüstü —— */}
      <div className="mx-auto hidden max-w-4xl px-4 py-6 sm:px-6 lg:block lg:px-8">
        <div
          className={`mb-8 flex flex-col gap-4 rounded-xl border ${arena.border} ${arena.panel} p-5 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#81b64c]">
              HyperChess Arena
            </p>
            <p className="mt-1 max-w-xl text-lg font-bold text-white sm:text-xl">
              Her gün bir hamle; çevrimiçi veya botla gelişmeye devam et.
            </p>
          </div>
          <div className="hidden shrink-0 text-5xl sm:block" aria-hidden>
            ♟
          </div>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/"
            className={`group flex min-h-[140px] flex-col justify-between rounded-xl border ${arena.border} ${arena.panel} p-5 transition hover:ring-1 hover:ring-white/10`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9b9893]">
                  Pratik
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">Botlarla oynayın</h3>
                <p className="mt-2 text-sm text-[#9b9893]">
                  Stockfish ile tempolu maç ve Elo güncellemesi.
                </p>
              </div>
              <div
                className={`flex size-12 items-center justify-center rounded-lg bg-[#262421] text-[#81b64c] transition group-hover:bg-[#81b64c] group-hover:text-[#262421]`}
              >
                <Cpu className="size-6" aria-hidden />
              </div>
            </div>
            <span className="mt-4 text-sm font-semibold text-[#81b64c]">Oyuna git →</span>
          </Link>

          <div
            className={`flex min-h-[140px] flex-col justify-center rounded-xl border border-dashed ${arena.border} bg-[#262421]/80 p-5`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9b9893]">
              Yakında
            </p>
            <h3 className="mt-1 text-lg font-bold text-white/80">Bulmacalar</h3>
            <p className="mt-2 text-sm text-[#6b6863]">Taktik modu üzerinde çalışıyoruz.</p>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Çevrimiçi oynayın</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <button
              type="button"
              disabled={busy}
              onClick={() => startQuick()}
              className={`flex-1 rounded-xl px-6 py-4 text-center text-base font-bold text-[#262421] shadow-md transition disabled:opacity-55 ${arena.green}`}
            >
              {busy ? "Eşleşiliyor…" : "Yeni oyun"}
            </button>
            <div
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border ${arena.border} ${arena.panel} px-6 py-4 text-sm font-semibold text-[#e8e6e3]`}
            >
              <Clock className="size-5 shrink-0 text-[#81b64c]" aria-hidden />
              <span>Hızlı maç · eşleşme havuzu</span>
            </div>
          </div>
          {err && (
            <p className="mt-3 text-center text-sm text-red-400">{err}</p>
          )}
        </section>

        <ActiveMatchesStrip />
      </div>
    </ArenaShell>
  );
}
