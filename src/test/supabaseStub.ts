/**
 * A stand-in for the Supabase client in tests: every query answers "no rows", so a screen shows its empty state.
 * Pass `rows` to give a table some data.
 */
export function makeSupabaseStub(rows: Record<string, unknown[]> = {}) {
  const chain = (table: string): unknown =>
    new Proxy(() => undefined, {
      get: (_t, prop) => {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve({ data: rows[table] ?? [], error: null, count: (rows[table] ?? []).length });
        }
        return () => chain(table);
      },
      apply: () => chain(table)
    });
  const storage = {
    from: () => ({
      getPublicUrl: (p: string) => ({ data: { publicUrl: `https://files.test/${p}` } }),
      upload: async () => ({ error: null }),
      remove: async () => ({ error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: "https://files.test/signed" }, error: null })
    })
  };
  return {
    from: (table: string) => chain(table),
    storage,
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    }
  };
}
