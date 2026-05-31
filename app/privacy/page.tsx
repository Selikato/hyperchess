import type { Metadata } from "next";
import Link from "next/link";
import { getSupportEmail } from "@/lib/site/contact";

export const metadata: Metadata = {
  title: "Gizlilik Politikası · HyperChess",
  description: "HyperChess gizlilik ve reklam bilgileri",
};

export default function PrivacyPage() {
  const support = getSupportEmail();

  return (
    <div className="min-h-screen bg-[#262421] px-4 py-10 text-[#e8e6e3]">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed">
        <header>
          <Link
            href="/play/online"
            className="text-xs font-semibold text-[#81b64c] hover:underline"
          >
            ← HyperChess
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">Gizlilik Politikası</h1>
          <p className="mt-2 text-[#9b9893]">Son güncelleme: Mayıs 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Toplanan veriler</h2>
          <p>
            Hesap oluşturduğunuzda e-posta ve profil bilgileriniz Supabase üzerinde
            saklanır. Maç ve Elo verileri oyun deneyimi için işlenir.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Reklamlar</h2>
          <p>
            Ücretsiz kullanımda Google AdSense reklamları gösterilebilir. Google,
            çerezler ve benzeri teknolojilerle reklam kişiselleştirmesi yapabilir.
            Ayrıntılar için{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              className="text-[#81b64c] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Reklam politikaları
            </a>{" "}
            sayfasına bakın.
          </p>
          <p>
            Kişiselleştirilmiş reklamları devre dışı bırakmak için{" "}
            <a
              href="https://adssettings.google.com"
              className="text-[#81b64c] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Reklam Ayarları
            </a>{" "}
            kullanılabilir.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">İletişim</h2>
          <p>
            Sorularınız için:{" "}
            <a
              href={`mailto:${support}`}
              className="text-[#81b64c] underline-offset-2 hover:underline"
            >
              {support}
            </a>
          </p>
        </section>
      </article>
    </div>
  );
}
