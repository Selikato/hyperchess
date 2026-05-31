import type { Metadata } from "next";
import Link from "next/link";
import { getSupportEmail } from "@/lib/site/contact";

export const metadata: Metadata = {
  title: "Hizmet Şartları · HyperChess",
  description: "HyperChess kullanım koşulları",
};

export default function TermsPage() {
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
          <h1 className="mt-4 text-2xl font-bold text-white">Hizmet Şartları</h1>
          <p className="mt-2 text-[#9b9893]">Son güncelleme: Mayıs 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Hizmet</h2>
          <p>
            HyperChess, çevrimiçi ve bot karşı satranç oyunu, bulmaca, analiz ve
            turnuva özellikleri sunar. Hizmet &quot;olduğu gibi&quot; sağlanır; kesintisiz
            çalışma garantisi verilmez.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Hesap</h2>
          <p>
            Kayıt olurken doğru bilgi vermekle yükümlüsün. Hesap güvenliğinden sen
            sorumlusun. Hile, bot kullanımı (izin verilen bot modu hariç), Elo
            manipülasyonu ve diğer oyunculara zarar veren davranışlar yasaktır.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Reklamlar</h2>
          <p>
            Ücretsiz kullanımda üçüncü taraf reklamlar (Google AdSense) gösterilebilir.
            Reklam içeriğinden reklamverenler sorumludur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Fikri mülkiyet</h2>
          <p>
            Site tasarımı, marka ve yazılım HyperChess&apos;e aittir. Satranç kuralları ve
            standart tahta görselleri genel kullanıma açıktır.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">İletişim</h2>
          <p>
            Sorular ve şikayetler için:{" "}
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
