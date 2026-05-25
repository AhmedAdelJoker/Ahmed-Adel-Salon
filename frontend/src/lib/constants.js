import {
  LayoutDashboard,
  Users,
  Scissors,
  Wallet,
  BarChart3,
  Settings,
  UserCircle2,
  History,
} from "lucide-react";

export const NAV_ITEMS = [
  {
    key: "dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "reception",
    path: "/reception",
    icon: Users,
  },
  {
    key: "barbers",
    path: "/barbers",
    icon: Scissors,
  },
  {
    key: "billing",
    path: "/billing",
    icon: Wallet,
  },
  {
    key: "reports",
    path: "/reports",
    icon: BarChart3,
  },
];

export const ROLE_TABS = {
  admin: ["dashboard", "reception", "billing", "reports", "barbers"],
  manager: ["dashboard", "reports"],
  cashier: ["dashboard", "reception", "billing"],
  barber: ["dashboard", "barbers"],
};

export const EXTRA_NAV_ITEMS = [
  {
    key: "profile",
    path: "/profile",
    icon: UserCircle2,
  },
  {
    key: "settings",
    path: "/settings",
    icon: Settings,
  },
  {
    key: "activity-log",
    path: "/activity-log",
    icon: History,
  },
];
