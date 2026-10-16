/** "Showing 1–10 of 42", rows per page and Prev / Next: shared by the in-memory table and the server-paged lists. */
export function Pager({
  info,
  page,
  pages,
  size,
  onPage,
  onSize
}: {
  info: string;
  page: number;
  pages: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (n: number) => void;
}) {
  return (
    <div className="dt-foot">
      <div className="dt-info">{info}</div>
      <div className="dt-pager">
        <label className="dt-size">
          Rows
          <select aria-label="Rows per page" value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹ Prev
        </button>
        <span className="mut">{`Page ${page} of ${pages}`}</span>
        <button type="button" className="ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next ›
        </button>
      </div>
    </div>
  );
}
