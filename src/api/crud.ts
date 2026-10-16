import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/errors";

type Row = { id: number };

/**
 * Insert / update / delete for a table keyed by a numeric `id`, with errors turned into readable messages.
 * Listing is written per screen, because every list has its own order and filters.
 */
export function crud<T extends Row>(table: string) {
  return {
    async create(data: Record<string, unknown>): Promise<T> {
      return unwrap(await supabase.from(table).insert([data]).select().single()) as T;
    },
    async update(id: number, data: Record<string, unknown>): Promise<T> {
      return unwrap(await supabase.from(table).update(data).eq("id", id).select().single()) as T;
    },
    async remove(id: number): Promise<void> {
      unwrap(await supabase.from(table).delete().eq("id", id));
    }
  };
}

/** Most tables are listed in full; this is the common shape. */
export async function listAll<T>(table: string, order: { column: string; ascending?: boolean }[] = [{ column: "id" }]): Promise<T[]> {
  let q = supabase.from(table).select("*");
  for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true });
  return (unwrap(await q) ?? []) as T[];
}
