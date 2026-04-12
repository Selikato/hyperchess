import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * Route Handler / Server Component içinde kullanım için.
 * İstek başına yeni istemci oluşturun; paylaşmayın.
 */
export async function createSupabaseServer() {
  const { url, key } = getPublicSupabaseConfig();
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY (veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) gerekli."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Cookie yazılamayan bağlamlarda yoksay */
        }
      },
    },
  });
}
