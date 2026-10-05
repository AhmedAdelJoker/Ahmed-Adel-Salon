import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import WorkingHoursPanel from "@/pages/owner/WorkingHoursPanel";
import { businessSettingsService } from "@/services/businessSettingsService";

vi.mock("@/services/businessSettingsService", () => ({
  businessSettingsService: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const baseHours = {
  saturday: { is_open: true, open_time: "09:00", close_time: "18:00" },
  sunday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  monday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  tuesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  wednesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  thursday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  friday: { is_open: false, open_time: null, close_time: null },
};

const getMock = businessSettingsService.get as unknown as ReturnType<typeof vi.fn>;
const updateMock = businessSettingsService.update as unknown as ReturnType<typeof vi.fn>;

const OPEN_DAY_INPUTS = [
  "open-saturday",
  "close-saturday",
  "open-sunday",
  "close-sunday",
  "open-monday",
  "close-monday",
  "open-tuesday",
  "close-tuesday",
  "open-wednesday",
  "close-wednesday",
  "open-thursday",
  "close-thursday",
];

const renderPanel = () => render(<WorkingHoursPanel />);

const setTime = (id: string, value: string) => {
  fireEvent.change(document.getElementById(id) as HTMLInputElement, {
    target: { value },
  });
};

const waitForLoaded = async () => {
  await waitFor(() => {
    expect(document.getElementById("open-saturday")).toBeInTheDocument();
  });
};

const saveButton = () =>
  screen.getByRole("button", { name: /حفظ المواعيد/ }) as HTMLButtonElement;

const confirmInDialog = async (label: string) => {
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: label }));
};

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue({ working_hours: baseHours });
  updateMock.mockImplementation(async (payload: { working_hours: unknown }) => ({
    working_hours: payload.working_hours,
  }));
});

describe("WorkingHoursPanel loading", () => {
  it("hydrates the days from the server payload", async () => {
    renderPanel();
    await waitForLoaded();
    expect(document.getElementById("open-saturday")).toHaveValue("09:00");
    expect(document.getElementById("close-saturday")).toHaveValue("18:00");
    expect(document.getElementById("open-monday")).toHaveValue("10:00");
  });

  it("renders a closed day without time inputs", async () => {
    renderPanel();
    await waitForLoaded();
    expect(document.getElementById("open-friday")).toBeNull();
    expect(document.getElementById("close-friday")).toBeNull();
  });

  it("surfaces a retry action when loading fails", async () => {
    getMock.mockRejectedValue(new Error("boom"));
    renderPanel();
    expect(await screen.findByText("تعذر تحميل بروتوكول التشغيل")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /إعادة المحاولة/ })).toBeInTheDocument();
  });
});

describe("WorkingHoursPanel accessibility", () => {
  it("associates every time input with a label", async () => {
    renderPanel();
    await waitForLoaded();
    OPEN_DAY_INPUTS.forEach((id) => {
      expect(document.getElementById(id)).not.toBeNull();
      expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
    });
  });

  it("labels the copy and reset icon buttons for screen readers", async () => {
    renderPanel();
    await waitForLoaded();
    expect(screen.getByLabelText("نسخ مواعيد السبت إلى كل الأيام")).toBeInTheDocument();
    expect(screen.getByLabelText("إعادة السبت للحالة المحفوظة")).toBeInTheDocument();
  });

  it("labels every day switch", async () => {
    renderPanel();
    await waitForLoaded();
    ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].forEach((day) => {
      expect(screen.getByLabelText(`تبديل ${day}`)).toBeInTheDocument();
    });
  });

  it("announces the dirty state to assistive tech", async () => {
    renderPanel();
    await waitForLoaded();
    expect(screen.getByText("ساعات العمل محفوظة")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("تبديل الجمعة"));
    await waitFor(() => {
      expect(screen.getByText("لديك تعديلات غير محفوظة على ساعات العمل")).toBeInTheDocument();
    });
  });
});

describe("WorkingHoursPanel validation", () => {
  it("blocks saving when open equals close", async () => {
    renderPanel();
    await waitForLoaded();
    setTime("close-saturday", "09:00");

    await waitFor(() => {
      expect(screen.getAllByText(/وقت الإغلاق لا يمكن أن يساوي وقت الفتح/).length).toBeGreaterThan(0);
    });
    expect(saveButton()).toBeDisabled();
  });

  it("marks the offending inputs with aria-invalid", async () => {
    renderPanel();
    await waitForLoaded();
    setTime("close-saturday", "09:00");

    await waitFor(() => {
      expect(document.getElementById("close-saturday")).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("rejects a window shorter than thirty minutes", async () => {
    renderPanel();
    await waitForLoaded();
    setTime("close-saturday", "09:10");
    await waitFor(() => {
      expect(screen.getAllByText(/مدة الدوام قصيرة جداً/).length).toBeGreaterThan(0);
    });
  });
});

describe("WorkingHoursPanel overnight support", () => {
  it("accepts a close time earlier than the open time", async () => {
    renderPanel();
    await waitForLoaded();
    setTime("close-saturday", "02:00");

    await waitFor(() => expect(saveButton()).not.toBeDisabled());
  });

  it("marks the overnight day in the list", async () => {
    renderPanel();
    await waitForLoaded();
    setTime("close-saturday", "02:00");
    await waitFor(() => {
      expect(screen.getAllByText("بعد منتصف الليل").length).toBeGreaterThan(0);
    });
  });

  it("persists the overnight window on save", async () => {
    renderPanel();
    await waitForLoaded();
    setTime("close-saturday", "02:00");
    await waitFor(() => expect(saveButton()).not.toBeDisabled());
    fireEvent.click(saveButton());

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][0] as {
      working_hours: Record<string, { open_time: string; close_time: string }>;
    };
    expect(payload.working_hours.saturday).toEqual({
      is_open: true,
      open_time: "09:00",
      close_time: "02:00",
    });
  });

  it("applies the late-night preset to every day", async () => {
    renderPanel();
    await waitForLoaded();

    fireEvent.click(screen.getByRole("button", { name: /دوام متأخر/ }));
    await confirmInDialog("تطبيق");

    fireEvent.click(saveButton());
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));

    const payload = updateMock.mock.calls[0][0] as {
      working_hours: Record<string, { open_time: string; close_time: string }>;
    };
    expect(payload.working_hours.friday).toEqual({
      is_open: true,
      open_time: "16:00",
      close_time: "02:00",
    });
  });
});

describe("WorkingHoursPanel destructive actions", () => {
  it("asks before copying one day over the whole week", async () => {
    renderPanel();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText("نسخ مواعيد السبت إلى كل الأيام"));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/سيتم استبدال مواعيد الستة أيام الأخرى/),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "تطبيق" }));

    await waitFor(() => {
      expect(document.getElementById("open-friday")).toHaveValue("09:00");
    });
  });

  it("leaves the week untouched when the copy is cancelled", async () => {
    renderPanel();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText("نسخ مواعيد الأحد إلى كل الأيام"));
    await confirmInDialog("إلغاء");

    expect(document.getElementById("open-saturday")).toHaveValue("09:00");
    expect(document.getElementById("open-friday")).toBeNull();
  });

  it("restores the loaded values when discarding", async () => {
    renderPanel();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText("تبديل الجمعة"));
    await waitFor(() => {
      expect(screen.getByText("لديك تعديلات غير محفوظة على ساعات العمل")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^تراجع$/ }));
    await confirmInDialog("تراجع");

    await waitFor(() => {
      expect(screen.getByText("ساعات العمل محفوظة")).toBeInTheDocument();
    });
    expect(document.getElementById("close-friday")).toBeNull();
  });

  it("resets a single day back to its saved value", async () => {
    renderPanel();
    await waitForLoaded();

    setTime("close-saturday", "02:00");
    fireEvent.click(screen.getByLabelText("إعادة السبت للحالة المحفوظة"));

    await waitFor(() => {
      expect(document.getElementById("close-saturday")).toHaveValue("18:00");
    });
  });
});

describe("WorkingHoursPanel save flow", () => {
  it("does not call update when nothing changed", async () => {
    renderPanel();
    await waitForLoaded();
    expect(saveButton()).toBeDisabled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("shows the server validation message when the save is rejected", async () => {
    const { toast } = await import("react-hot-toast");
    updateMock.mockRejectedValue({
      response: { data: { detail: "مدة الدوام قصيرة جداً في السبت" } },
    });
    renderPanel();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText("تبديل الجمعة"));
    await waitFor(() => expect(saveButton()).not.toBeDisabled());
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("مدة الدوام قصيرة جداً في السبت");
    });
  });

  it("re-bases the baseline on the server response after saving", async () => {
    const { toast } = await import("react-hot-toast");
    updateMock.mockResolvedValue({
      working_hours: {
        ...baseHours,
        friday: { is_open: true, open_time: "10:00", close_time: "22:00" },
      },
    });
    renderPanel();
    await waitForLoaded();

    fireEvent.click(screen.getByLabelText("تبديل الجمعة"));
    await waitFor(() => expect(saveButton()).not.toBeDisabled());
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("تم حفظ ساعات العمل بنجاح");
    });
    await waitFor(() => {
      expect(screen.getByText("ساعات العمل محفوظة")).toBeInTheDocument();
    });
    expect(document.getElementById("open-friday")).toHaveValue("10:00");
  });
});
