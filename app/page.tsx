import { ChessBoard } from "@/components/ChessBoard";
import { SessionBar } from "@/components/SessionBar";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 p-8 dark:bg-zinc-950">
      <header className="flex w-full max-w-[min(90vw,560px)] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          HyperChess
        </h1>
        <SessionBar />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center">
        <ChessBoard />
      </div>
    </div>
  );
}
