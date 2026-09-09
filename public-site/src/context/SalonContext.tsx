import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import type { AuthUser } from "../types/common";
import { customerService } from "../services/customerService";
import { serviceService } from "../services/serviceService";
import { barberService } from "../services/barberService";
import { sessionService } from "../services/sessionService";
import { invoiceService } from "../services/invoiceService";
import { reportService } from "../services/reportService";
import { dashboardService } from "../services/dashboardService";
import { SocketContext } from "./SocketContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SalonRecord = Record<string, any>;

export interface SalonContextValue {
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  loading: boolean;
  customers: SalonRecord[];
  services: SalonRecord[];
  barbers: SalonRecord[];
  sessions: SalonRecord[];
  invoices: SalonRecord[];
  reportOverview: SalonRecord | null;
  dashboardWidgets: SalonRecord | null;
  waiting: SalonRecord[];
  inProgress: SalonRecord[];
  completedUnpaid: SalonRecord[];
  checkedOut: SalonRecord[];
  refreshSalonData: () => Promise<void>;
  loadAll: () => Promise<void>;
  addClient: (payload: Record<string, unknown>) => Promise<unknown>;
}

export const SalonContext = createContext<SalonContextValue | undefined>(
  undefined,
);

const toArray = (value: unknown): SalonRecord[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as SalonRecord[];
  const maybeItems = (value as { items?: unknown }).items;
  if (Array.isArray(maybeItems)) return maybeItems as SalonRecord[];
  return [];
};

export function SalonProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const currentUser = auth?.currentUser ?? auth?.user ?? null;

  const socket = useContext(SocketContext);

  const [customers, setCustomers] = useState<SalonRecord[]>([]);
  const [services, setServices] = useState<SalonRecord[]>([]);
  const [barbers, setBarbers] = useState<SalonRecord[]>([]);
  const [sessions, setSessions] = useState<SalonRecord[]>([]);
  const [invoices, setInvoices] = useState<SalonRecord[]>([]);
  const [reportOverview, setReportOverview] = useState<SalonRecord | null>(null);
  const [dashboardWidgets, setDashboardWidgets] =
    useState<SalonRecord | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const [
        customersData,
        servicesData,
        barbersData,
        sessionsData,
        invoicesData,
        reportsData,
      ] = await Promise.allSettled([
        customerService.list?.(),
        serviceService.list?.(),
        barberService.list?.(),
        sessionService.list?.(),
        invoiceService.list?.(),
        reportService.overview?.(),
      ]);

      if (customersData.status === "fulfilled")
        setCustomers(toArray(customersData.value));
      if (servicesData.status === "fulfilled")
        setServices(toArray(servicesData.value));
      if (barbersData.status === "fulfilled")
        setBarbers(toArray(barbersData.value));
      if (sessionsData.status === "fulfilled")
        setSessions(toArray(sessionsData.value));
      if (invoicesData.status === "fulfilled")
        setInvoices(toArray(invoicesData.value));
      if (reportsData.status === "fulfilled")
        setReportOverview(reportsData.value || null);

      try {
        const widgets = await dashboardService.widgets?.();
        setDashboardWidgets(widgets || null);
      } catch (err) {
        console.error("Dashboard widgets load error:", err);
      }
    } catch (err) {
      console.error("SalonProvider loadAll error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addClient(
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const customer = await customerService.create({
      name: payload.name,
      phone: payload.phone,
      ...payload,
    });

    if (payload.serviceId || payload.service_id) {
      try {
        const created = customer as { id?: unknown; customer_id?: unknown } | null;
        await sessionService.create({
          customer_id:
            created?.id || created?.customer_id || payload.customer_id,
          service_id: payload.serviceId || payload.service_id,
          employee_id:
            payload.employee_id || payload.employeeId || payload.barberId,
          barber_id:
            payload.barber_id || payload.barberId || payload.employee_id,
        });
      } catch (err) {
        console.error("Create session after add client error:", err);
      }
    }

    await loadAll();
    return customer;
  }

  useEffect(() => {
    if (!socket) return;

    if (isAuthenticated) {
      loadAll();
    } else {
      setCustomers([]);
      setServices([]);
      setBarbers([]);
      setSessions([]);
      setInvoices([]);
      setReportOverview(null);
      setDashboardWidgets(null);
    }
  }, [isAuthenticated]);

  const waiting = useMemo(
    () => sessions.filter((s) => s.status === "waiting"),
    [sessions],
  );

  const inProgress = useMemo(
    () => sessions.filter((s) => s.status === "in_progress"),
    [sessions],
  );

  const completedUnpaid = useMemo(
    () =>
      sessions.filter(
        (s) => s.status === "completed_unpaid" || s.status === "completed",
      ),
    [sessions],
  );

  const checkedOut = useMemo(
    () =>
      sessions.filter((s) => s.status === "checked_out" || s.status === "paid"),
    [sessions],
  );

  const value = useMemo<SalonContextValue>(
    () => ({
      isAuthenticated,
      currentUser,
      loading,
      customers,
      services,
      barbers,
      sessions,
      invoices,
      reportOverview,
      dashboardWidgets,
      waiting,
      inProgress,
      completedUnpaid,
      checkedOut,
      refreshSalonData: loadAll,
      loadAll,
      addClient,
    }),
    [
      isAuthenticated,
      currentUser,
      loading,
      customers,
      services,
      barbers,
      sessions,
      invoices,
      reportOverview,
      dashboardWidgets,
      waiting,
      inProgress,
      completedUnpaid,
      checkedOut,
    ],
  );

  return (
    <SalonContext.Provider value={value}>
      {children}
    </SalonContext.Provider>
  );
}

export function useSalon(): SalonContextValue {
  const context = useContext(SalonContext);
  if (context === undefined) {
    throw new Error("useSalon must be used within SalonProvider");
  }
  return context;
}
