import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Calendar, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Every lucide icon is a `forwardRef`, which means it is an object with
 * `{$$typeof, render}` -- not a function, and not a React element.
 *
 * `EmptyState` decided between "component" and "already-rendered node" with
 * `typeof icon === "object"`, which classified every icon in the app as a node
 * and handed it to React as a child:
 *
 *     Objects are not valid as a React child
 *     (found: object with keys {$$typeof, render})
 *
 * The whole subtree went with it, not just the empty state. 76 call sites pass
 * an icon, so one empty reception board column took the entire page down. The
 * unit suite never rendered a component with an icon, so it stayed green --
 * and `typecheck` could not see it either, because passing a component where a
 * `ReactNode` is declared is type-compatible.
 */
describe("EmptyState icon handling", () => {
  const svgOf = (container: HTMLElement) =>
    container.querySelectorAll("svg").length;

  it("renders a lucide icon as a component, not as a node", () => {
    const { container } = render(
      <EmptyState variant="board" icon={Calendar} title="القائمة فارغة" />
    );
    // Before the fix this throws rather than rendering, which is why a render
    // test catches it and a snapshot of the props does not.
    expect(svgOf(container)).toBeGreaterThan(0);
    expect(container.textContent).toContain("القائمة فارغة");
  });

  it("renders any lucide icon, not just one", () => {
    const { container } = render(<EmptyState icon={Users} />);
    expect(svgOf(container)).toBeGreaterThan(0);
  });

  it("still accepts a pre-rendered node", () => {
    // The prop is typed `LucideIcon | ReactNode`, so both branches must work.
    const { container } = render(
      <EmptyState icon={<span data-testid="custom">*</span>} />
    );
    expect(container.querySelector('[data-testid="custom"]')).not.toBeNull();
    expect(container.textContent).toContain("*");
  });

  it("falls back to Inbox when given nothing", () => {
    const { container } = render(<EmptyState />);
    expect(svgOf(container)).toBeGreaterThan(0);
  });

  it("falls back to Inbox for null rather than rendering nothing", () => {
    const { container } = render(<EmptyState icon={null as never} />);
    expect(svgOf(container)).toBeGreaterThan(0);
  });

  it("sizes the icon according to the variant", () => {
    const small = render(<EmptyState variant="inline" icon={Calendar} />);
    const large = render(<EmptyState variant="page" icon={Calendar} />);
    const widthOf = (c: HTMLElement) => {
      const svg = c.querySelector("svg");
      return svg ? Number(svg.getAttribute("width") ?? 0) : -1;
    };
    expect(widthOf(small.container)).toBeLessThan(widthOf(large.container));
  });
});