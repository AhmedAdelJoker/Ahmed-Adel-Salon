import { describe, expect, it } from "vitest";
import {
  DAYS_AR,
  PRESETS,
  WORKING_HOURS_DAYS,
  buildWorkingHours,
  cloneWorkingHours,
  crossesMidnight,
  dayKeyFor,
  durationLabel,
  formatDuration,
  formatRange,
  makeDay,
  normalizeWorkingHours,
  parseMins,
  sameWorkingHours,
  summarizeWorkingHours,
  todayStatusLabel,
  validateDay,
  weekBarPercent,
  windowMinutes,
} from "@/lib/domain/workingHours";

const open = (o: string | null, c: string | null) => ({
  is_open: true,
  open_time: o,
  close_time: c,
});
const closed = () => ({ is_open: false, open_time: null, close_time: null });

describe("day keys", () => {
  it("maps every JS getDay() value to a canonical key", () => {
    const expected = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(2026, 8, 20 + i);
      expect(expected).toContain(dayKeyFor(date));
    }
  });

  it("exposes exactly seven arabic day labels", () => {
    expect(WORKING_HOURS_DAYS).toHaveLength(7);
    WORKING_HOURS_DAYS.forEach((day) => {
      expect(DAYS_AR[day]).toBeTruthy();
    });
  });
});

describe("parseMins", () => {
  it("accepts zero padded HH:MM", () => {
    expect(parseMins("00:00")).toBe(0);
    expect(parseMins("09:30")).toBe(570);
    expect(parseMins("23:59")).toBe(1439);
  });

  it("rejects out-of-range and unpadded values", () => {
    expect(parseMins("24:00")).toBeNull();
    expect(parseMins("12:60")).toBeNull();
    expect(parseMins("9:05")).toBeNull();
    expect(parseMins("")).toBeNull();
    expect(parseMins(null)).toBeNull();
    expect(parseMins(undefined)).toBeNull();
  });
});

describe("midnight crossing", () => {
  it("flags a window whose close time is earlier than its open time", () => {
    expect(crossesMidnight(open("22:00", "02:00"))).toBe(true);
    expect(crossesMidnight(open("10:00", "22:00"))).toBe(false);
    expect(crossesMidnight(closed())).toBe(false);
  });

  it("measures the overnight duration across the day boundary", () => {
    expect(windowMinutes(open("22:00", "02:00"))).toBe(240);
    expect(windowMinutes(open("16:00", "02:00"))).toBe(600);
    expect(windowMinutes(open("10:00", "22:00"))).toBe(720);
    expect(windowMinutes(closed())).toBe(0);
  });

  it("labels the overnight window with a next-day marker", () => {
    expect(formatRange(open("22:00", "02:00"))).toBe("22:00 – 02:00 (+1)");
    expect(formatRange(open("10:00", "22:00"))).toBe("10:00 – 22:00");
    expect(formatRange(closed())).toBeNull();
  });

  it("keeps the legacy durationLabel helper overnight aware", () => {
    expect(durationLabel("22:00", "02:00")).toBe("4 ساعة");
    expect(durationLabel("10:00", "22:00")).toBe("12 ساعة");
    expect(durationLabel("10:00", "10:00")).toBeNull();
  });
});

describe("validateDay", () => {
  it("accepts a normal day and an overnight day", () => {
    expect(validateDay(open("10:00", "22:00"))).toBeNull();
    expect(validateDay(open("22:00", "02:00"))).toBeNull();
  });

  it("accepts any closed day", () => {
    expect(validateDay(closed())).toBeNull();
  });

  it("requires both times when the day is open", () => {
    expect(validateDay(open("", "22:00"))).toBe("حدد وقت الفتح والإغلاق");
    expect(validateDay(open("10:00", null))).toBe("حدد وقت الفتح والإغلاق");
  });

  it("rejects equal open and close times", () => {
    expect(validateDay(open("10:00", "10:00"))).toBe(
      "وقت الإغلاق لا يمكن أن يساوي وقت الفتح",
    );
  });

  it("rejects windows shorter than thirty minutes", () => {
    expect(validateDay(open("10:00", "10:10"))).toBe(
      "مدة الدوام قصيرة جداً (أقل من 30 دقيقة)",
    );
    expect(validateDay(open("23:50", "00:10"))).toBe(
      "مدة الدوام قصيرة جداً (أقل من 30 دقيقة)",
    );
  });

  it("rejects malformed values", () => {
    expect(validateDay(open("9:00", "22:00"))).toBe("صيغة الوقت غير صحيحة");
  });
});

describe("normalizeWorkingHours", () => {
  it("defaults every day to closed", () => {
    const result = normalizeWorkingHours();
    WORKING_HOURS_DAYS.forEach((day) => {
      expect(result[day]).toEqual(closed());
    });
  });

  it("keeps valid stored values untouched", () => {
    const result = normalizeWorkingHours({
      saturday: open("09:00", "18:00"),
      friday: closed(),
    });
    expect(result.saturday).toEqual(open("09:00", "18:00"));
    expect(result.friday).toEqual(closed());
    expect(result.monday).toEqual(closed());
  });

  it("degrades an open day with a broken time to closed instead of throwing", () => {
    const result = normalizeWorkingHours({ monday: open("99:99", "22:00") });
    expect(result.monday.is_open).toBe(false);
  });

  it("ignores non-object payloads", () => {
    expect(() => normalizeWorkingHours("junk" as unknown)).not.toThrow();
    expect(normalizeWorkingHours(null).friday.is_open).toBe(false);
  });
});

describe("clone + equality", () => {
  it("deep clones so later edits cannot leak into the baseline", () => {
    const base = normalizeWorkingHours({ monday: open("10:00", "22:00") });
    const copy = cloneWorkingHours(base);
    copy.monday.open_time = "09:00";
    expect(base.monday.open_time).toBe("10:00");
  });

  it("ignores key ordering when comparing", () => {
    const a = buildWorkingHours(() => open("10:00", "22:00"));
    const reordered = Object.fromEntries(
      [...Object.entries(a)].reverse(),
    ) as typeof a;
    expect(sameWorkingHours(a, reordered)).toBe(true);
  });

  it("detects a single differing minute", () => {
    const a = buildWorkingHours(() => open("10:00", "22:00"));
    const b = buildWorkingHours(() => open("10:01", "22:00"));
    expect(sameWorkingHours(a, b)).toBe(false);
  });

  it("treats a toggled day as different", () => {
    const a = buildWorkingHours(() => open("10:00", "22:00"));
    const b = buildWorkingHours(() => closed());
    expect(sameWorkingHours(a, b)).toBe(false);
  });
});

describe("makeDay", () => {
  it("nulls the times when closing a day", () => {
    expect(makeDay(false, "10:00", "22:00")).toEqual(closed());
  });

  it("falls back to sensible defaults when opening a day", () => {
    expect(makeDay(true, null, null)).toEqual(open("10:00", "22:00"));
  });

  it("keeps an overnight window intact", () => {
    expect(makeDay(true, "22:00", "02:00")).toEqual(open("22:00", "02:00"));
  });
});

describe("summarizeWorkingHours", () => {
  it("counts open days, totals and overnight days", () => {
    const hours = buildWorkingHours((day) => {
      if (day === "friday") return closed();
      if (day === "saturday") return open("22:00", "02:00");
      return open("10:00", "22:00");
    });
    const summary = summarizeWorkingHours(hours);
    expect(summary.openDays).toBe(6);
    expect(summary.closedDays).toBe(1);
    expect(summary.overnightDays).toEqual(["saturday"]);
    // 5 days * 720 + saturday 240 = 3840
    expect(summary.totalMinutes).toBe(3840);
    expect(summary.totalHours).toBe(64);
  });

  it("reports a fully closed week", () => {
    const summary = summarizeWorkingHours(normalizeWorkingHours());
    expect(summary.openDays).toBe(0);
    expect(summary.totalMinutes).toBe(0);
  });
});

describe("weekBarPercent", () => {
  it("gives closed days a small stub", () => {
    expect(weekBarPercent(closed())).toBe(12);
  });

  it("scales with the window length and stays in range", () => {
    // reference bar is a 16h day, so a 12h window fills 75%
    expect(weekBarPercent(open("10:00", "22:00"))).toBe(75);
    expect(weekBarPercent(open("00:00", "23:59"))).toBe(100);
    expect(weekBarPercent(open("10:00", "14:00"))).toBeGreaterThanOrEqual(18);
    expect(weekBarPercent(open("22:00", "02:00"))).toBeGreaterThanOrEqual(18);
  });
});

describe("todayStatusLabel", () => {
  it("describes an open day without repeating the same string twice", () => {
    const status = todayStatusLabel(open("10:00", "22:00"));
    expect(status.open).toBe(true);
    expect(status.title).toBe("10:00 – 22:00");
    expect(status.hint).not.toBe(status.title);
  });

  it("flags the overnight tail in the hint", () => {
    const status = todayStatusLabel(open("22:00", "02:00"));
    expect(status.title).toContain("+1");
    expect(status.hint).toContain("منتصف الليل");
  });

  it("describes a closed day", () => {
    const status = todayStatusLabel(closed());
    expect(status.open).toBe(false);
    expect(status.title).toBe("مغلق");
  });
});

describe("formatDuration", () => {
  it("formats hours, mixed and minutes", () => {
    expect(formatDuration(720)).toBe("12 ساعة");
    expect(formatDuration(630)).toBe("10 س 30 د");
    expect(formatDuration(45)).toBe("45 دقيقة");
    expect(formatDuration(0)).toBe("—");
  });
});

describe("presets", () => {
  it("every preset builds a valid week", () => {
    PRESETS.forEach((preset) => {
      const built = preset.build();
      WORKING_HOURS_DAYS.forEach((day) => {
        expect(validateDay(built[day])).toBeNull();
      });
      expect(validateDay(built.saturday)).toBeNull();
    });
  });

  it("includes at least one preset that crosses midnight", () => {
    const late = PRESETS.find((p) => p.id === "late-night");
    expect(late).toBeDefined();
    expect(crossesMidnight(late!.build().saturday)).toBe(true);
  });

  it("the friday-closed preset keeps friday shut", () => {
    const built = PRESETS.find((p) => p.id === "friday-closed")!.build();
    expect(built.friday.is_open).toBe(false);
    expect(built.monday.is_open).toBe(true);
  });
});
