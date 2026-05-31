"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#262421] px-4 text-center text-[#e8e6e3]">
      <h1 className="text-xl font-semibold text-white">Bir şeyler ters gitti</h1>
      <p className="max-w-sm text-sm text-[#9b9893]">
        Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi dene; sorun sürerse bir süre
        sonra tekrar gel.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-[#81b64c] px-5 py-2.5 text-sm font-bold text-[#262421] hover:brightness-110"
        >
          Tekrar dene
        </button>
        <Link
          href="/play/online"
          className="rounded-lg border border-[#3c3b36] px-5 py-2.5 text-sm font-semibold text-[#e8e6e3] hover:bg-[#312e2b]"
        >
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
