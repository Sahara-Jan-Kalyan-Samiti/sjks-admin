import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Msg, Spinner } from "@/components/ui/primitives";
import { messageOf } from "@/lib/errors";
import { Pager } from "./Pager";

export interface ServerListProps<T> {
  /** Cache key; the list reloads when this or the search / filter / page changes. */
  queryKey: string;
  load: (q: { q: string; status: string; page: number; size: number }) => Promise<{ rows: T[]; total: number }>;
  searchLabel: string;
  searchPlaceholder: string;
  statuses: [string, string][];
  headers: string[];
  row: (r: T) => ReactNode;
  empty: string;
  emptyFiltered: string;
  tools?: (filter: { q: string; status: string }) => ReactNode;
  /** Called after the first list is shown, with the total (for the stat cards). */
  onLoaded?: () => void;
}

/**
 * A list whose search, status filter and paging are run by the database, so the browser only holds the rows on screen.
 * Used for the newsletter subscribers and the contact messages, which can grow far past one page.
 */
export function ServerList<T extends { id: number }>({
  queryKey,
  load,
  searchLabel,
  searchPlaceholder,
  statuses,
  headers,
  row,
  empty,
  emptyFiltered,
  tools
}: ServerListProps<T>) {
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(typed.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [typed]);

  const query = useQuery({
    queryKey: [queryKey, "page", q, status, page, size],
    queryFn: () => load({ q, status, page, size }),
    placeholderData: keepPreviousData
  });
  const total = query.data?.total ?? 0;
  const rows = query.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil(total / size));

  // the last row of the last page just left this filter
  useEffect(() => {
    if (query.data && !rows.length && page > 1) setPage(1);
  }, [query.data, rows.length, page]);

  const filtering = Boolean(typed || status);
  return (
    <div className="dt">
      <div className="dt-tools">
        <div className="dt-search">
          <input
            type="search"
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <label className="dt-f">
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {statuses.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {filtering && (
          <button
            type="button"
            className="ghost sm"
            onClick={() => {
              setTyped("");
              setQ("");
              setStatus("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        )}
        <div className="grow" />
        {tools?.({ q, status })}
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : query.error ? (
        <>
          <Msg kind="err">{messageOf(query.error)}</Msg>
          <button type="button" className="ghost" onClick={() => query.refetch()}>
            Try again
          </button>
        </>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className={h ? "" : "actions"}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => <tr key={r.id}>{row(r)}</tr>)
              ) : (
                <tr>
                  <td colSpan={headers.length} className="td-empty">
                    {filtering ? emptyFiltered : empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!query.isLoading && !query.error && (
        <Pager
          info={
            rows.length
              ? `Showing ${((page - 1) * size + 1).toLocaleString("en-IN")}–${((page - 1) * size + rows.length).toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}`
              : ""
          }
          page={page}
          pages={pages}
          size={size}
          onPage={setPage}
          onSize={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
