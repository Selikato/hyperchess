import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#262421] px-4 text-center text-[#e8e6e3]">
      <p className="text-6xl font-bold text-[#81b64c]">404</p>
      <h1 className="text-xl font-semibold text-white">Sayfa bulunamadı</h1>
      <p className="max-w-sm text-sm text-[#9b9893]">
        Aradığın adres tahtadan düşmüş olabilir. Ana menüden devam et.
      </p>
      <Link
        href="/play/online"
        className="rounded-lg bg-[#81b64c] px-5 py-2.5 text-sm font-bold text-[#262421] hover:brightness-110"
      >
        Arena&apos;ya dön
      </Link>
    </div>
  );
}
