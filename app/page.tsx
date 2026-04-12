import { ChessBoard } from "@/components/ChessBoard";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 p-8 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Hyperchess
      </h1>
      <ChessBoard />
    </div>
  );
}
