import { describe, it, expect, vi, beforeEach } from "vitest";
import "@/i18n";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import api from "@/services/api";
import { EmployeeQuickView } from "@/components/shared/EmployeeQuickView";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const renderView = (props?: Partial<React.ComponentProps<typeof EmployeeQuickView>>) =>
  render(
    <MemoryRouter>
      <EmployeeQuickView employeeId={2} open onOpenChange={vi.fn()} {...props} />
    </MemoryRouter>,
  );

describe("EmployeeQuickView", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("ar");
  });

  it("maps camelCase employee data and real payroll metrics", async () => {
    api.get = vi.fn().mockImplementation((url: string) => {
      if (url === "/employees/2") {
        return Promise.resolve({
          data: {
            id: 2,
            fullName: "Ahmed adel",
            jobTitle: "barber",
            status: "active",
            employmentType: "full_time",
            phonePrimary: "01554374825",
            profileImageUrl: "/uploads/profiles/test.jpg",
            baseSalary: "7000.00",
            commissionRate: "1.00",
            hireDate: "2026-10-15T00:00:00",
            showInPos: true,
            showInBooking: true,
            hasLoginAccount: false,
            services: [{ id: 1, name_ar: "حلاقة", name: "Haircut" }],
          },
        });
      }
      if (url === "/payroll/expected-net") {
        return Promise.resolve({
          data: {
            net_salary: "6500.00",
            earned_base_salary: "7000.00",
            commission_amount: "100.00",
            fixed_deductions: "200.00",
            auto_deduction: "300.00",
            advance_amount: "100.00",
            metrics: {
              expected_days: 26,
              actual_days: 24,
              attendance_percent: 92,
            },
          },
        });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    renderView();

    await waitFor(() =>
      expect(screen.getByTestId("employee-file-name")).toHaveTextContent(
        "Ahmed adel",
      ),
    );
    expect(screen.getAllByText("حلاق").length).toBeGreaterThan(0);
    expect(screen.getByText("01554374825")).toBeTruthy();
    expect(screen.getByText("حلاقة")).toBeTruthy();
    expect(screen.getByTestId("employee-file-net")).toHaveTextContent("6,500");
    expect(screen.getByText(/92%/)).toBeTruthy();
    expect(screen.queryByText(/منذ ساعة/)).toBeNull();
  });

  it("keeps the employee file visible when payroll fails", async () => {
    api.get = vi.fn().mockImplementation((url: string) => {
      if (url === "/employees/2") {
        return Promise.resolve({
          data: {
            id: 2,
            fullName: "Payroll blocked",
            jobTitle: "cashier",
            status: "active",
            phonePrimary: "0100",
          },
        });
      }
      if (url === "/payroll/expected-net") {
        return Promise.reject({ response: { status: 403 } });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    renderView();

    await waitFor(() =>
      expect(screen.getByTestId("employee-file-name")).toHaveTextContent(
        "Payroll blocked",
      ),
    );
    expect(
      screen.getByTestId("employee-file-payroll-unavailable"),
    ).toHaveTextContent("بيانات الرواتب غير متاحة لحسابك.");
  });

  it("shows an error state and retries the employee request", async () => {
    let employeeAttempts = 0;
    api.get = vi.fn().mockImplementation((url: string) => {
      if (url === "/employees/2") {
        employeeAttempts += 1;
        if (employeeAttempts === 1) return Promise.reject(new Error("offline"));
        return Promise.resolve({
          data: { id: 2, fullName: "Recovered", jobTitle: "manager" },
        });
      }
      if (url === "/payroll/expected-net") {
        return Promise.resolve({ data: { net_salary: 0, metrics: {} } });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    renderView();

    await waitFor(() =>
      expect(screen.getByTestId("employee-file-error")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));

    await waitFor(() =>
      expect(screen.getByTestId("employee-file-name")).toHaveTextContent(
        "Recovered",
      ),
    );
    expect(employeeAttempts).toBe(2);
  });

  it("renders English labels when the UI language is English", async () => {
    await i18n.changeLanguage("en");
    api.get = vi.fn().mockImplementation((url: string) => {
      if (url === "/employees/2") {
        return Promise.resolve({
          data: {
            id: 2,
            fullName: "Ahmed adel",
            jobTitle: "barber",
            status: "active",
            employmentType: "full_time",
            baseSalary: "7000.00",
          },
        });
      }
      return Promise.resolve({
        data: { net_salary: 0, metrics: { attendance_percent: 0 } },
      });
    });

    renderView();

    await waitFor(() =>
      expect(screen.getByTestId("employee-file-name")).toHaveTextContent(
        "Ahmed adel",
      ),
    );
    expect(screen.getAllByText("Barber").length).toBeGreaterThan(0);
    expect(screen.getByText("Full time")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: /Employee file/i })).toBeTruthy();
  });
});
