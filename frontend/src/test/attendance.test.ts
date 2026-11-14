import { describe, expect, it, vi } from "vitest";

vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  ATTENDANCE_VIEW_MODES,
  buildCalendarDays,
  filterArchiveRecords,
  normalizeCurrentRecords,
  statusLabel,
  statusTone,
} from "@/features/attendance/utils/attendance";
import type { AttendanceRecord, WorkingHours } from "@/features/attendance/types";

const t = (key: string, opts?: Record<string, unknown>) => {
  if (opts && typeof opts.minutes !== "undefined") return `${key}:${opts.minutes}`;
  return key;
};

describe("attendance utils", () => {
  it("exposes redesigned view modes including register/import", () => {
    expect(ATTENDANCE_VIEW_MODES.map((m) => m.id)).toEqual([
      "today",
      "register",
      "leaves",
      "calendar",
      "analytics",
      "penalties",
      "archive",
    ]);
    expect(ATTENDANCE_VIEW_MODES.every((m) => m.labelKey.startsWith("attendance."))).toBe(true);
  });

  it("normalizes /barber-presence/current records into UI shape", () => {
    const records = normalizeCurrentRecords(
      [
        {
          employee_id: 7,
          employee_name: "Ali",
          current_status: "in",
          is_late: true,
          late_reason: "traffic",
          last_log: { created_at: "2026-11-08T09:10:00Z", stats: { totalHours: 1.5, lateMinutes: 10 } },
          logs_today: [{ status: "in", created_at: "2026-11-08T09:10:00Z" }],
        },
      ] as any,
      [{ id: 7, full_name: "Ali Hassan" } as any],
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 7,
      employee_id: 7,
      employee_name: "Ali",
      status: "in",
      is_late: true,
      late_reason: "traffic",
      created_at: "2026-11-08T09:10:00Z",
    });
    expect(records[0].stats?.lateMinutes).toBe(10);
    expect(Array.isArray(records[0].all_logs)).toBe(true);
  });

  it("filters and flattens archive records by date/search/employee", () => {
    const records: AttendanceRecord[] = [
      {
        employee_id: 1,
        employee_name: "Ahmed",
        all_logs: [
          { status: "in", created_at: "2026-11-01T08:00:00Z" },
          { status: "out", created_at: "2026-11-01T16:00:00Z" },
        ],
      } as any,
      {
        employee_id: 2,
        employee_name: "Mona",
        status: "in",
        created_at: "2026-11-05T08:00:00Z",
        all_logs: [],
      } as any,
    ];

    const filtered = filterArchiveRecords(records, {
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      searchTerm: "ahm",
      employeeIdFilter: null,
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => String(r.employee_name).includes("Ahmed"))).toBe(true);

    const byEmployee = filterArchiveRecords(records, {
      startDate: "",
      endDate: "",
      searchTerm: "",
      employeeIdFilter: "2",
    });
    expect(byEmployee).toHaveLength(1);
    expect(byEmployee[0].employee_id).toBe(2);
  });

  it("builds calendar indicators for all days with records", () => {
    const records: AttendanceRecord[] = [
      {
        employee_id: 1,
        status: "in",
        created_at: "2026-11-03T09:00:00Z",
        is_late: true,
        all_logs: [{ status: "in", created_at: "2026-11-03T09:00:00Z", is_late: true }],
      } as any,
      {
        employee_id: 2,
        status: "out",
        created_at: "2026-11-03T17:00:00Z",
        all_logs: [{ status: "out", created_at: "2026-11-03T17:00:00Z" }],
      } as any,
    ];
    const workingHours: WorkingHours = { monday: { is_open: true, open_time: "09:00", close_time: "17:00" } };
    const days = buildCalendarDays(records, new Date(2026, 10, 1), workingHours);
    const day3 = days.find((d) => d?.day === 3);
    expect(day3).toBeTruthy();
    expect(day3?.presentCount).toBe(2);
    expect(day3?.lateCount).toBeGreaterThanOrEqual(1);
  });

  it("maps status labels/tones", () => {
    expect(statusLabel("in", t as any)).toBe("attendance.statusIn");
    expect(statusLabel("break_end", t as any)).toBe("attendance.statusBreakEnd");
    expect(statusTone("out")).toBe("danger");
    expect(statusTone("break")).toBe("warning");
  });
});
