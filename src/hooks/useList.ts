import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { messageOf } from "@/lib/errors";

/**
 * Loads a list for a screen and gives back what the table needs.
 *   const { rows, loading, error, reload } = useList("donations", getDonations);
 * `reload()` refreshes the list and the "needs attention" numbers in the menu.
 */
export function useList<T>(key: string, load: () => Promise<T[]>) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: [key], queryFn: load });
  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: [key] });
    qc.invalidateQueries({ queryKey: ["badges"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc, key]);
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? messageOf(query.error) : null, reload };
}
