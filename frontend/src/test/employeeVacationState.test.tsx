import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "@/services/api";
import { EmployeeTable, useHrData } from "@/features/hr";

/**
 * "On vacation" is not "suspended" and not "archived".
 *
 * The employee stays in the team list with a في إجازة badge, the trash-style
 * action toggles the vacation instead of deleting, and a separate archive
 * action exists for someone who actually left. The list still drops leavers —
 * they live in the archive.
 */
const suspendedEmployee = {
  id: 2,
  fullName: "سامي علي",
  jobTitle: "barber",
  status: "suspended",
  phonePrimary: "01000000002",
  baseSalary: 5000,
  profileImageUrl: "",
};

const renderTable = (overrides: {
  onDelete?: () => void;
  onArchive?: () => void;
}) =>
  render(
    <MemoryRouter>
      <EmployeeTable
        employees={[suspendedEmployee as never]}
        onEdit={vi.fn()}
        onDelete={overrides.onDelete ?? vi.fn()}
        onArchive={overrides.onArchive ?? vi.fn()}
      />
    </MemoryRouter>,
  );

describe("the vacation state in the team list", () => {
  it("shows a في إجازة badge instead of the old معلّق wording", () => {
    renderTable({});
    expect(screen.queryByText("معلّق")).toBeNull();
    expect(screen.getAllByText("في إجازة").length).toBeGreaterThan(0);
  });

  it("treats the row action as a return-to-work toggle, not a delete", () => {
    const onDelete = vi.fn();
    renderTable({ onDelete });
    fireEvent.click(screen.getAllByTitle("إرجاع للعمل")[0]);
    expect(onDelete).toHaveBeenCalledWith(suspendedEmployee);
  });

  it("offers a separate archive action for someone who left", () => {
    const onArchive = vi.fn();
    renderTable({ onArchive });
    fireEvent.click(screen.getAllByTitle("أرشفة (ترك العمل)")[0]);
    expect(onArchive).toHaveBeenCalledWith(suspendedEmployee);
  });
});

describe("useHrData keeps the team honest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps employees on vacation in the list and leaves leavers out", async () => {
    api.get = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url === "/employees"
          ? {
              data: [
                {
                  id: 1,
                  full_name: "نشط",
                  status: "active",
                  phone_primary: "01000000001",
                },
                {
                  id: 2,
                  full_name: "في إجازة",
                  status: "suspended",
                  phone_primary: "01000000002",
                },
                {
                  id: 3,
                  full_name: "مستقيل",
                  status: "resigned",
                  phone_primary: "01000000003",
                },
              ],
              headers: {},
            }
          : { data: [] },
      ),
    );

    const { result } = renderHook(() => useHrData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const names = result.current.filteredEmployees.map((e) => e.fullName);
    expect(names).toEqual(["نشط", "في إجازة"]);
  });
});
