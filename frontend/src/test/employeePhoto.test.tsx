import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmployeePhoto, employeeInitials } from "@/components/shared/EmployeePhoto";

/**
 * `employeeInitials` takes the first letter of the first and last word rather
 * than joining every initial and truncating, which is what the old copy did:
 * "محمد عبد الرحمن سالم" produced "معالر" instead of "مس".
 */
describe("employeeInitials", () => {
  it("uses the first and last word", () => {
    expect(employeeInitials("محمد عبد الرحمن سالم")).toBe("مس");
    expect(employeeInitials("Carol Danvers")).toBe("CD");
  });

  it("handles a single word, and nothing at all", () => {
    expect(employeeInitials("احمد")).toBe("اح");
    expect(employeeInitials("")).toBe("؟");
    expect(employeeInitials(null)).toBe("؟");
  });
});

describe("EmployeePhoto", () => {
  it("shows the photo when the URL resolves", () => {
    render(
      <EmployeePhoto imageUrl="/uploads/profiles/a.jpg" name="احمد محمود" />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/profiles/a.jpg"),
    );
  });

  it("passes an absolute URL through untouched", () => {
    render(<EmployeePhoto imageUrl="https://cdn.example.com/a.jpg" name="A" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/a.jpg",
    );
  });

  it("falls back to initials when there is no photo", () => {
    render(<EmployeePhoto imageUrl={null} name="احمد محمود" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("ام")).toBeTruthy();
  });

  /**
   * The stored path outlives the file: the column keeps
   * `/uploads/profiles/<uuid>.jpg` long after the upload is deleted, so the
   * `<img>` 404s. Showing a broken image in a staff list is a bug that only a
   * rendered test catches, because the URL is truthy in every unit test of the
   * data path.
   */
  it("falls back to initials when the stored file is gone", async () => {
    render(<EmployeePhoto imageUrl="/uploads/profiles/gone.jpg" name="س" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
    expect(screen.getByText("س")).toBeTruthy();
  });

  it("offers an enlarge dialog only when there is a photo to enlarge", () => {
    const { unmount } = render(
      <EmployeePhoto imageUrl="/uploads/profiles/a.jpg" name="احمد" />,
    );
    expect(
      screen.getByRole("button", { name: /تكبير صورة احمد/ }),
    ).toBeTruthy();
    unmount();

    render(<EmployeePhoto imageUrl={null} name="احمد" />);
    // A missing photo must not be a dead "enlarge" control.
    expect(
      screen.queryByRole("button", { name: /تكبير/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /لا توجد صورة لـ احمد/ }),
    ).toBeTruthy();
  });
});
