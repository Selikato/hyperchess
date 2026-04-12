/**
 * Node tarafında DNS çözümlemesinde IPv4’ü öne alır; bazı Windows ağlarında
 * Supabase’e `fetch failed` (IPv6) sorununu azaltır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
  }
}
