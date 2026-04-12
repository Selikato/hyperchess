import type { Metadata } from "next";
import Link from "next/link";
import { Auth } from "@/components/Auth";

export const metadata: Metadata = {
  title: "Giriş — HyperChess",
  description: "HyperChess hesabına giriş yap veya kayıt ol",
};

export default function LoginPage() {
  return (
    <div className="relative">
      <Link
        href="/"
        className="font-sans absolute left-4 top-4 z-10 rounded-md border border-white/10 bg-[#312e2b] px-3 py-1.5 text-xs font-medium text-[#bababa] transition hover:border-white/20 hover:text-white md:left-8 md:top-8"
      >
        ← Ana sayfa
      </Link>
      <Auth />
    </div>
  );
}
