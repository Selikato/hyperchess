"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AuthMode = "login" | "register";

function isAlreadyRegisteredError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already exists") ||
    m.includes("email address is already") ||
    m.includes("email already exists")
  );
}

function isInvalidCredentialsError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("invalid login credentials") ||
    m.includes("invalid credentials") ||
    m.includes("wrong password")
  );
}

function mapNetworkAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m === "load failed"
  ) {
    return "Bağlantı kurulamadı. İnternetini kontrol et; gerekirse reklam engelleyici veya VPN’i kapatıp yeniden dene.";
  }
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("429")
  ) {
    return "E-posta gönderim sınırı doldu. Supabase’in yerleşik e-postası saatte çok az gönderime izin verir; bir süre sonra tekrar dene. Sık kayıt veya birkaç kişi aynı anda denerse de sınır dolabilir. Kalıcı çözüm: Supabase Dashboard → Authentication → SMTP’den kendi sağlayıcını bağlamak (SendGrid, Resend vb.).";
  }
  if (isAlreadyRegisteredError(message)) {
    return "Bu e-posta ile zaten bir hesap var. Üstteki Giriş sekmesinden şifrenle giriş yap.";
  }
  return message;
}

export function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession();
  }, []);

  const setModeSafe = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const primaryBtnClass =
    "w-full rounded-md bg-[#81b64c] py-2.5 text-sm font-semibold text-[#262421] shadow-sm transition hover:enabled:brightness-110 active:enabled:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81b64c]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#312e2b] disabled:cursor-not-allowed disabled:opacity-60";

  const inputShellClass =
    "flex items-center gap-3 rounded-md border border-white/10 bg-[#262421]/80 px-3 py-2.5 transition focus-within:border-[#81b64c]/50 focus-within:ring-1 focus-within:ring-[#81b64c]/30";

  const fieldClass =
    "min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[#8b8987] outline-none";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError("E-posta ve şifre gerekli.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (signInError) {
          setError(mapNetworkAuthError(signInError.message));
          return;
        }
        router.push("/");
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: {
          data: {
            display_name: displayName.trim() || undefined,
            full_name: displayName.trim() || undefined,
          },
        },
      });
      if (signUpError) {
        if (isAlreadyRegisteredError(signUpError.message)) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: trimmed,
            password,
          });
          if (!signInError) {
            router.push("/");
            router.refresh();
            return;
          }
          if (signInError.message && isInvalidCredentialsError(signInError.message)) {
            setError(
              "Bu e-posta bu Supabase projesinde daha önce kayıtlı (test veya başka giriş olabilir). Şifre yanlış olabilir — Giriş sekmesinden dene. E-postayı hiç kullanmadığını düşünüyorsan Dashboard → Authentication → Users’ta adresi kontrol et; gerekirse silip yeniden kayıt ol."
            );
          } else {
            setError(mapNetworkAuthError(signInError.message));
          }
          return;
        }
        setError(mapNetworkAuthError(signUpError.message));
        return;
      }

      if (!data.session && data.user) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (signInError) {
          setError(
            mapNetworkAuthError(
              signInError.message ||
                "Kayıt oluştu ancak oturum açılamadı. Giriş yapmayı dene."
            )
          );
          return;
        }
      } else if (!data.session) {
        setError("Oturum oluşturulamadı. Tekrar dene veya giriş yap.");
        return;
      }

      setPassword("");
      router.push("/play/bot?welcome=register");
      router.refresh();
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      setError(mapNetworkAuthError(raw));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="font-sans flex min-h-screen w-full items-center justify-center bg-[#262421] px-4 py-12 antialiased">
      <div className="w-full max-w-[400px] rounded-lg border border-white/[0.06] bg-[#312e2b] px-8 py-10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]">
        <header className="mb-8 text-center">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-white">
            Hyper<span className="text-[#81b64c]">Chess</span>
          </h1>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#bababa]">
            Dünyanın en iyi satranç platformuna hoş geldin
          </p>
        </header>

        <div className="mb-6 flex rounded-md bg-[#262421]/60 p-0.5">
          <button
            type="button"
            onClick={() => setModeSafe("login")}
            className={`flex-1 rounded-[5px] py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-[#312e2b] text-white shadow-sm"
                : "text-[#bababa] hover:text-white"
            }`}
          >
            Giriş
          </button>
          <button
            type="button"
            onClick={() => setModeSafe("register")}
            className={`flex-1 rounded-[5px] py-2 text-sm font-medium transition ${
              mode === "register"
                ? "bg-[#312e2b] text-white shadow-sm"
                : "text-[#bababa] hover:text-white"
            }`}
          >
            Kayıt
          </button>
        </div>

        {error && (
          <div
            className="mb-4 whitespace-pre-wrap rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm leading-relaxed text-red-100"
            role="alert"
          >
            {error}
          </div>
        )}
        {info && (
          <div
            className="mb-4 rounded-md border border-[#81b64c]/40 bg-[#81b64c]/10 px-3 py-2 text-sm text-[#d4e8bc]"
            role="status"
          >
            {info}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div>
              <label htmlFor="auth-display" className="sr-only">
                Görünen ad
              </label>
              <div className={inputShellClass}>
                <User
                  className="size-[18px] shrink-0 text-[#8b8987]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  id="auth-display"
                  type="text"
                  autoComplete="name"
                  placeholder="Görünen ad (isteğe bağlı)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="sr-only">
              E-posta
            </label>
            <div className={inputShellClass}>
              <Mail
                className="size-[18px] shrink-0 text-[#8b8987]"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="sr-only">
              Şifre
            </label>
            <div className={inputShellClass}>
              <Lock
                className="size-[18px] shrink-0 text-[#8b8987]"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                id="auth-password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                required
                minLength={mode === "register" ? 6 : undefined}
              />
            </div>
          </div>

          {mode === "login" && (
            <div className="text-right">
              <button
                type="button"
                className="text-xs font-medium text-[#bababa] underline-offset-2 hover:text-white hover:underline"
              >
                Şifreni mi unuttun?
              </button>
            </div>
          )}

          <button type="submit" className={primaryBtnClass} disabled={loading}>
            {loading
              ? mode === "login"
                ? "Giriş yapılıyor…"
                : "Kayıt yapılıyor…"
              : mode === "login"
                ? "Giriş Yap"
                : "Kayıt Ol"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs leading-relaxed text-[#8b8987]">
          Devam ederek{" "}
          <button
            type="button"
            className="text-[#bababa] underline-offset-2 hover:text-white hover:underline"
          >
            Hizmet Şartları
          </button>{" "}
          ve{" "}
          <button
            type="button"
            className="text-[#bababa] underline-offset-2 hover:text-white hover:underline"
          >
            Gizlilik Politikası
          </button>
          &apos;nı kabul etmiş olursun.
        </p>
      </div>
    </div>
  );
}
