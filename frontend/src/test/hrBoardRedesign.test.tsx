import { describe, it, expect, vi, beforeEach } from "vitest";
import "@/i18n";
import {
  render,
  renderHook,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import api from "@/services/api";
import {
  EmployeeTable,
  HrStatStrip,
  HrStatsGrid,
  HrToolbar,
  formatEmployeeDate,
  useHrData,
} from "@/features/hr";

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({ openEmployeeQuickView: vi.fn() }),
}));

/**
 * The HR board's two failure modes from the audit: a secondary request taking
 * the roster down with it, and a strip whose labels read like attendance when
 * they are account states.
 */
describe("useHrData keeps the roster when secondary requests fail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still shows employees when /services and /employees/stats fail", async () => {
    api.get = vi.fn().mockImplementation((url: string) => {
      if (url === "/employees") {
        return Promise.resolve({
          data: [
            {
              id: 1,
              full_name: "أحمد علي",
              status: "active",
              phone_primary: "01000000001",
            },
          ],
          headers: { "x-total-count": "1" },
        });
      }
      if (url === "/services" || url === "/employees/stats") {
        return Promise.reject(new Error(`${url} is down`));
      }
      return Promise.resolve({ data: [] });
    });

    const { result } = renderHook(() => useHrData());
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.loadError).toBe(false);
    expect(result.current.filteredEmployees).toHaveLength(1);
    expect(result.current.filteredEmployees[0].fullName).toBe("أحمد علي");
    // The strip keeps its empty fallback rather than inventing a number.
    expect(result.current.stats.total).toBe(0);
  });

  it("marks the list as failed when the roster itself is unreachable", async () => {
    api.get = vi.fn().mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useHrData());
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.loadError).toBe(true);
    expect(result.current.employees).toHaveLength(0);
  });
});

describe("the HR readouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts the team without leavers and keeps the archive as a way in", () => {
    render(
      <MemoryRouter>
        <HrStatsGrid
          stats={{
            total: 5,
            active: 3,
            suspended: 2,
            resigned: 1,
            barbers: 2,
            assistants: 1,
          }}
        />
      </MemoryRouter>,
    );

    // total 5 minus 1 resigned = 4 people on the team.
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("إجمالي الفريق")).toBeTruthy();
    expect(screen.getByText("حساب نشط")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /الأرشيف/ }),
    ).toBeTruthy();
  });

  it("renders a clickable stat cell as a button, not a list item", () => {
    const onOpen = vi.fn();
    render(
      <HrStatStrip
        cells={[
          { key: "team", label: "الفريق", value: 3, hint: "بدون من تركوا العمل" },
          {
            key: "archive",
            label: "الأرشيف",
            value: 2,
            hint: "فتح",
            onClick: onOpen,
            actionLabel: "فتح",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /الأرشيف/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows filter counts and the page range in the toolbar", () => {
    render(
      <HrToolbar
        searchTerm=""
        setSearchTerm={vi.fn()}
        statusFilter="all"
        setStatusFilter={vi.fn()}
        activeView="cards"
        setActiveView={vi.fn()}
        resultCount={2}
        totalCount={6}
        page={1}
        size={2}
        counts={{ all: 6, active: 4, suspended: 2 }}
        onRefresh={vi.fn()}
        refreshing={false}
      />,
    );

    expect(screen.getByText("عرض 1–2 من 6")).toBeTruthy();
    expect(screen.getByRole("button", { name: "تحديث" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /كل الفريق/ })).toHaveTextContent(
      "6",
    );
  });

  it("tells 'no team yet' apart from 'no results for this filter'", () => {
    const onClearFilters = vi.fn();
    render(
      <MemoryRouter>
        <EmployeeTable
          employees={[]}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onArchive={vi.fn()}
          hasActiveFilters
          onClearFilters={onClearFilters}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("لا نتائج مطابقة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "مسح التصفية" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("keeps a date-only hire date on the day the server sent", () => {
    expect(formatEmployeeDate("2026-10-15", "en-US")).toBe("10/15/2026");
    // An ISO timestamp is a date-only field once the server writes it; the
    // date part is what the owner agreed to, not a timezone-shifted instant.
    expect(formatEmployeeDate("2026-10-15T23:30:00Z", "en-US")).toBe(
      "10/15/2026",
    );
    expect(formatEmployeeDate(null, "en-US")).toBeNull();
  });
});
