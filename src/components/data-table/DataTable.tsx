import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Msg, Spinner } from "@/components/ui/primitives";
import { Pager } from "./Pager";

export interface Column<T> {
  label: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable: the value to compare. */
  sort?: (row: T) => string | number | null | undefined;
  cls?: string;
  /** Direction of the first click on the header. */
  firstDir?: "asc" | "desc";
}
export interface Filter<T> {
  label: string;
  options: [value: string, text: string][] | ((rows: T[]) => [string, string][]);
  test: (row: T, value: string) => boolean;
  /** Initially selected value. */
  value?: string;
  all?: string;
}
export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: string | null;
  /** Text to search in, per row. Shows the search box. */
  search?: (row: T) => string;
  searchLabel?: string;
  filters?: Filter<T>[];
  /** Adds a "from / to" date range. */
  date?: { label: string; get: (row: T) => string | null | undefined };
  pageSize?: number;
  onRow?: (row: T) => void;
  empty?: string;
  /** Initial sort: index of the column and direction. */
  sort?: { i: number; dir: "asc" | "desc" };
  /** A line shown above the table about the filtered rows. */
  summary?: (rows: T[]) => ReactNode;
  /** Buttons at the right of the toolbar. A function receives the rows that match the filters (for an export). */
  tools?: ReactNode | ((filtered: T[]) => ReactNode);
  rowKey?: (row: T, index: number) => string | number;
}

const day = (d?: string | null) => String(d || "").slice(0, 10);

/** Search, filters, date range, column sorting and paging for any list: the one table every admin screen uses. */
export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  search,
  searchLabel = "Search",
  filters = [],
  date,
  pageSize = 10,
  onRow,
  empty = "Nothing here yet.",
  sort: initialSort = undefined,
  summary,
  tools,
  rowKey
}: DataTableProps<T>) {
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [fv, setFv] = useState<string[]>(() => filters.map((f) => f.value || ""));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);

  // search as you type, but not on every key press
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(typed.trim().toLowerCase());
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [typed]);

  const optionLists = useMemo(() => filters.map((f) => (typeof f.options === "function" ? f.options(rows) : f.options)), [filters, rows]);
  // a selected option that no longer exists (after a reload) counts as "All"
  const values = fv.map((v, i) => (v && optionLists[i].some(([x]) => x === v) ? v : ""));

  const filtered = useMemo(() => {
    let out = rows.filter(
      (r) =>
        (!q ||
          String(search?.(r) || "")
            .toLowerCase()
            .includes(q)) &&
        filters.every((f, i) => !values[i] || f.test(r, values[i])) &&
        (!date || ((!from || day(date.get(r)) >= from) && (!to || day(date.get(r)) <= to)))
    );
    if (sort) {
      const c = columns[sort.i];
      const dir = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = c.sort?.(a);
        const y = c.sort?.(b);
        return (x == null ? 1 : y == null ? -1 : x < y ? -1 : x > y ? 1 : 0) * dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, values.join("|"), from, to, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const view = filtered.slice((current - 1) * size, current * size);
  const active = Boolean(typed || values.some(Boolean) || from || to);
  const clear = () => {
    setTyped("");
    setQ("");
    setFv(filters.map(() => ""));
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="dt">
      <div className="dt-tools">
        {search && (
          <div className="dt-search">
            <input
              type="search"
              placeholder={searchLabel + "…"}
              aria-label={searchLabel}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
        {filters.map((f, i) => (
          <label className="dt-f" key={f.label}>
            {f.label}
            <select
              aria-label={f.label}
              value={values[i]}
              onChange={(e) => {
                setFv((old) => old.map((v, j) => (j === i ? e.target.value : v)));
                setPage(1);
              }}
            >
              <option value="">{f.all || "All"}</option>
              {optionLists[i].map(([v, t]) => (
                <option key={v} value={v}>
                  {t ?? v}
                </option>
              ))}
            </select>
          </label>
        ))}
        {date && (
          <>
            <label className="dt-f">
              {date.label} from
              <input
                type="date"
                aria-label={`${date.label} from`}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="dt-f">
              to
              <input
                type="date"
                aria-label={`${date.label} to`}
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </>
        )}
        {active && (
          <button type="button" className="ghost sm" onClick={clear}>
            Clear filters
          </button>
        )}
        <div className="grow" />
        {typeof tools === "function" ? tools(filtered) : tools}
      </div>

      {!loading && !error && summary && filtered.length > 0 && <div className="dt-sum">{summary(filtered)}</div>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <Msg kind="err">{error}</Msg>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {columns.map((c, i) => {
                  if (!c.sort)
                    return (
                      <th key={i} className={c.cls || ""}>
                        {c.label}
                      </th>
                    );
                  const on = sort?.i === i;
                  const dir = on ? sort!.dir : null;
                  return (
                    <th key={i} className={c.cls || ""} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button
                        type="button"
                        className="th-sort"
                        onClick={() => setSort({ i, dir: on && dir === "asc" ? "desc" : on ? "asc" : (c.firstDir ?? "asc") })}
                      >
                        {c.label}
                        <span className="arrow" aria-hidden="true">
                          {on ? (dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {view.length ? (
                view.map((r, n) => (
                  <tr
                    key={rowKey ? rowKey(r, n) : ((r as { id?: string | number }).id ?? n)}
                    className={onRow ? "click" : ""}
                    tabIndex={onRow ? 0 : undefined}
                    onClick={onRow ? (e) => !(e.target as HTMLElement).closest("button,select,a,input") && onRow(r) : undefined}
                    onKeyDown={onRow ? (e) => e.key === "Enter" && (e.target as HTMLElement).tagName === "TR" && onRow(r) : undefined}
                  >
                    {columns.map((c, i) => (
                      <td key={i} className={c.cls || ""}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="td-empty">
                    {rows.length ? "No results match these filters." : empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <Pager
          info={
            filtered.length
              ? `Showing ${(current - 1) * size + 1}–${(current - 1) * size + view.length} of ${filtered.length}${filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}`
              : ""
          }
          page={current}
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
