import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmployeePhoto } from "@/components/shared/EmployeePhoto";
import { ImagePicker } from "@/components/shared/ImagePicker";

/**
 * A stored photo path whose file is gone.
 *
 * This is the normal state of this database, not an edge case: the column keeps
 * `/uploads/profiles/<uuid>.jpg` after the file is deleted, moved with the data
 * directory, or never written. Rendering that path without handling the 404
 * leaves a broken-image icon on screen, and the only evidence is one console
 * line — which is why every account in this workspace pointed at uploads that do
 * not exist for months.
 *
 * The assertion is on the fallback being *present*, not merely on the image
 * being absent: a broken `<img>` and an initials tile are both "no image", and
 * only one of them is what the visitor should see.
 */
describe("a missing photo", () => {
  it("shows initials rather than a broken image", async () => {
    render(<EmployeePhoto imageUrl="/uploads/profiles/gone.jpg" name="سارة محمود" />);
    const img = screen.getByRole("img");
    fireEvent.error(img);
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
    expect(screen.getByText("سم")).toBeTruthy();
  });

  it("does not offer to enlarge a photo that is not there", () => {
    const { container } = render(
      <EmployeePhoto imageUrl="/uploads/profiles/gone.jpg" name="سارة" />,
    );
    // The path resolves, so the button starts enabled — it only stops being a
    // lie once the load fails.
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-label")).toContain("لا توجد صورة");
  });

  it("recovers when a later value resolves", async () => {
    const { rerender } = render(
      <EmployeePhoto imageUrl="/uploads/profiles/gone.jpg" name="سارة" />,
    );
    fireEvent.error(screen.getByRole("img"));
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());

    // Re-rendering with a working value must show the photo again rather than
    // staying on the initials the error put up.
    rerender(<EmployeePhoto imageUrl="/uploads/profiles/here.jpg" name="سارة" />);
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it("shows initials for an employee with no photo at all", () => {
    render(<EmployeePhoto imageUrl={null} name="أحمد علي" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("أع")).toBeTruthy();
  });

  it("treats an empty string as no photo", () => {
    render(<EmployeePhoto imageUrl="" name="أحمد علي" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("ImagePicker with a stored path that no longer resolves", () => {
  it("renders the empty slot, not a broken image", () => {
    // The picker previews `value` directly; a stored path whose file is gone
    // must not leave an `<img>` pointing at nothing.
    render(
      <ImagePicker value="/uploads/offers/gone.jpg" onChange={() => {}} />,
    );
    const img = screen.queryByRole("img");
    if (img) {
      fireEvent.error(img);
      expect(
        (img as HTMLImageElement).closest("div")?.querySelector("img"),
      ).toBeNull();
    }
    // The empty slot is what remains.
    expect(screen.getByText(/PNG أو JPG أو WEBP/)).toBeTruthy();
  });

  it("rejects an oversized file before it reaches the server", async () => {
    /**
     * The client used to allow 20 MB while every upload endpoint enforces 5 MB,
     * so a large photo sat through the whole transfer and was then answered with
     * a 413. The size check now runs first and says so.
     */
    render(<ImagePicker value="" onChange={() => {}} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // `fireEvent.change(input, { target: { files } })` does not stick in jsdom:
    // the `files` property is read-only on a real input, so it has to be defined.
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 9 * 1024 * 1024 });
    Object.defineProperty(input, "files", { value: [big], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(screen.getByText(/5 ميجابايت/)).toBeTruthy());
    // The picker is unchanged: nothing was uploaded, nothing stored.
    expect(screen.getByText(/PNG أو JPG أو WEBP/)).toBeTruthy();
  });
});
