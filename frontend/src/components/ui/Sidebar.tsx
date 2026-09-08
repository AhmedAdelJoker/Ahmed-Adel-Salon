import { forwardRef, useEffect, useState } from "react";
import type * as React from "react";
import { cn } from "@/lib/core/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    {
      className,
      children,
      collapsible = true,
      defaultCollapsed = false,
      onCollapseChange,
      ...props
    },
    ref,
  ) => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const [isMobile, setIsMobile] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

    useEffect(() => {
      const checkMobile = () => {
        const mobile = window.innerWidth < 1024;
        const tablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        setIsMobile(mobile);
        if (!mobile && drawerOpen) setDrawerOpen(false);
        if (!tablet && bottomSheetOpen) setBottomSheetOpen(false);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }, [drawerOpen, bottomSheetOpen]);

    const toggleCollapse = () => {
      const next = !collapsed;
      setCollapsed(next);
      onCollapseChange?.(next);
    };

    if (isMobile) {
      return (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              "sidebar-backdrop",
              drawerOpen && "sidebar-backdrop-visible",
            )}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside
            ref={ref}
            className={cn(
              "sidebar-drawer",
              drawerOpen && "sidebar-drawer-open",
              className,
            )}
            {...props}
            role="complementary"
            aria-label="القائمة الجانبية"
          >
            <div className="flex items-center justify-between p-4 border-b border-n-200">
              <h2 className="text-lg font-bold text-n-900">القائمة</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-n-500 hover:text-n-700 hover:bg-n-100 rounded-none"
                aria-label="إغلاق القائمة"
              >
                <X className="icon-size-lg" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </aside>
        </>
      );
    }

    if (window.innerWidth >= 768 && window.innerWidth < 1024) {
      return (
        <>
          <div
            className={cn(
              "sidebar-backdrop",
              bottomSheetOpen && "sidebar-backdrop-visible",
            )}
            onClick={() => setBottomSheetOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={ref}
            className={cn(
              "sidebar-bottom-sheet",
              bottomSheetOpen && "sidebar-bottom-sheet-open",
              className,
            )}
            {...props}
            role="complementary"
            aria-label="القائمة الجانبية"
          >
            <div className="flex items-center justify-between p-4 border-b border-n-200 sticky top-0 bg-n-50 z-10">
              <h2 className="text-lg font-bold text-n-900">القائمة</h2>
              <button
                onClick={() => setBottomSheetOpen(false)}
                className="p-2 text-n-500 hover:text-n-700 hover:bg-n-100 rounded-none"
                aria-label="إغلاق القائمة"
              >
                <X className="icon-size-lg" />
              </button>
            </div>
            <div className="p-4">{children}</div>
          </aside>
        </>
      );
    }

    // Desktop
    return (
      <aside
        ref={ref}
        className={cn(
          "sidebar",
          collapsed ? "sidebar-collapsed" : "sidebar-expanded",
          className,
        )}
        {...props}
        role="complementary"
        aria-label="القائمة الجانبية"
      >
        {collapsible && (
          <button
            onClick={toggleCollapse}
            className="absolute top-4 left-4 p-2 text-n-500 hover:text-n-700 hover:bg-n-100 rounded-none transition-colors"
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="icon-size-lg" />
            ) : (
              <ChevronLeft className="icon-size-lg" />
            )}
          </button>
        )}
        <div className={cn("flex-1 overflow-y-auto p-4", collapsed && "px-2")}>
          {!collapsed && <div className="mb-6 pb-4 border-b border-n-200" />}
          {children}
        </div>
      </aside>
    );
  },
);
Sidebar.displayName = "Sidebar";
