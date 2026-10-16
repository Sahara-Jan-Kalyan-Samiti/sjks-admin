import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";

afterEach(cleanup);
interface Row {
  id: number;
  name: string;
  amount: number;
  status: string;
}
const rows: Row[] = [
  { id: 1, name: "Asha", amount: 500, status: "success" },
  { id: 2, name: "Bharat", amount: 1500, status: "pending" },
  { id: 3, name: "Chitra", amount: 250, status: "success" }
];
const columns = [
  { label: "Name", cell: (r: Row) => r.name, sort: (r: Row) => r.name },
  { label: "Amount", cell: (r: Row) => r.amount, sort: (r: Row) => r.amount, firstDir: "desc" as const },
  { label: "Status", cell: (r: Row) => r.status }
];
const body = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((r) => r.textContent ?? "");

describe("DataTable", () => {
  it("shows all rows, sorted when a header is clicked (first click uses firstDir)", () => {
    render(<DataTable rows={rows} columns={columns} />);
    expect(body()).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Amount/ }));
    expect(body()[0]).toContain("Bharat"); // largest first
    fireEvent.click(screen.getByRole("button", { name: /Amount/ }));
    expect(body()[0]).toContain("Chitra"); // a second click reverses
  });
  it("filters by a drop-down and by search, and clears them", async () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        search={(r) => r.name}
        filters={[
          {
            label: "Status",
            options: [
              ["success", "Success"],
              ["pending", "Pending"]
            ],
            test: (r, v) => r.status === v
          }
        ]}
      />
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });
    expect(body()).toHaveLength(1);
    expect(screen.getByText(/Showing 1–1 of 1/)).toBeTruthy();
    fireEvent.click(screen.getByText("Clear filters"));
    expect(body()).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "chit" } });
    await screen.findByText(/filtered from 3/);
    expect(body()).toHaveLength(1);
  });
  it("starts with a preselected filter and falls back to All when the option does not exist", () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        filters={[
          {
            label: "Status",
            value: "pending",
            options: [
              ["success", "Success"],
              ["pending", "Pending"]
            ],
            test: (r, v) => r.status === v
          }
        ]}
      />
    );
    expect(body()).toHaveLength(1);
    cleanup();
    render(
      <DataTable
        rows={rows}
        columns={columns}
        filters={[{ label: "Status", value: "gone", options: [["success", "Success"]], test: (r, v) => r.status === v }]}
      />
    );
    expect(body()).toHaveLength(3);
  });
  it("pages the rows", () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, amount: i, status: "success" }));
    render(<DataTable rows={many} columns={columns} pageSize={10} />);
    expect(body()).toHaveLength(10);
    fireEvent.click(screen.getByText(/Next/));
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByText(/Next/));
    expect(body()).toHaveLength(3);
  });
  it("calls onRow for a click on a row but not for a click on a button inside it", () => {
    const onRow = vi.fn();
    const cols = [...columns, { label: "", cell: (r: Row) => <button>Act {r.id}</button> }];
    render(<DataTable rows={rows} columns={cols} onRow={onRow} />);
    fireEvent.click(screen.getByText("Asha"));
    expect(onRow).toHaveBeenCalledWith(rows[0]);
    onRow.mockClear();
    fireEvent.click(screen.getByText("Act 2"));
    expect(onRow).not.toHaveBeenCalled();
  });
  it("shows the empty text, the loading state and an error", () => {
    const { rerender } = render(<DataTable rows={[]} columns={columns} empty="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    rerender(<DataTable rows={[]} columns={columns} loading />);
    expect(screen.getByRole("status")).toBeTruthy();
    rerender(<DataTable rows={[]} columns={columns} error="Boom" />);
    expect(screen.getByRole("alert").textContent).toBe("Boom");
  });
  it("hands the filtered rows to the toolbar (for exports)", () => {
    const seen: number[] = [];
    render(
      <DataTable
        rows={rows}
        columns={columns}
        search={(r) => r.name}
        tools={(list) => {
          seen.push(list.length);
          return null;
        }}
      />
    );
    expect(seen.at(-1)).toBe(3);
  });
});
