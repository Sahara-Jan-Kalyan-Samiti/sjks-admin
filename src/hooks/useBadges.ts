import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Badges {
  requests: number;
  volunteers: number;
  donations: number;
  messages: number;
  members: number;
  memberorgs: number;
}

const count = async (table: string, filters: Record<string, string>): Promise<number> => {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count: n } = await q;
  return n || 0;
};

/** The "needs attention" numbers next to the menu items. Reloaded every minute and after any change (invalidate ["badges"]). */
export function useBadges(): Badges | undefined {
  const { data } = useQuery({
    queryKey: ["badges"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Badges> => {
      const [requests, volunteers, donations, messages, members, memberorgs] = await Promise.all([
        count("document_requests", { status: "new" }),
        count("volunteers", { status: "pending" }),
        count("donations", { status: "pending" }),
        count("form_submissions", { kind: "contact", status: "new" }),
        count("member_cards", { status: "pending" }),
        count("member_organizations", { status: "pending" })
      ]);
      return { requests, volunteers, donations, messages, members, memberorgs };
    }
  });
  return data;
}
