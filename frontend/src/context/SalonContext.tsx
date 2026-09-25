import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { SocketContext } from "@/context/SocketContext";
import { generatePublicQR } from "@/lib/media/qr";
import { customerService } from "@/services/customerService";
import { serviceService } from "@/services/serviceService";
import { barberService } from "@/services/barberService";
import { sessionService } from "@/services/sessionService";
import { invoiceService } from "@/services/invoiceService";
import { reportService } from "@/services/reportService";
import { businessSettingsService } from "@/services/businessSettingsService";
import { posShiftService } from "@/services/posShiftService";
import cashboxService from "@/services/cashboxService";

export type SalonRecord = Record<string, any>;

export interface SalonContextValue {
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  loading: boolean;
  settings: SalonRecord;
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
  qrImage: string;
  drawerBalance: number;
  valutBalance: number;
  vaultCashBalance: number;
  vaultDigitalBalance: number;
  refreshBalance: () => Promise<void>;
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
  const socket = useContext(SocketContext);

  const isAuthenticated = auth?.isAuthenticated ?? false;
  const currentUser = auth?.currentUser ?? auth?.user ?? null;

  const [settings, setSettings] = useState<SalonRecord>({});
  const [customers, setCustomers] = useState<SalonRecord[]>([]);
  const [services, setServices] = useState<SalonRecord[]>([]);
  const [barbers, setBarbers] = useState<SalonRecord[]>([]);
  const [sessions, setSessions] = useState<SalonRecord[]>([]);
  const [invoices, setInvoices] = useState<SalonRecord[]>([]);
  const [reportOverview, setReportOverview] = useState<SalonRecord | null>(null);
  const [dashboardWidgets, setDashboardWidgets] =
    useState<SalonRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [drawerBalance, setDrawerBalance] = useState(0);
  const [valutBalance, setValutBalance] = useState(0);
  const [vaultCashBalance, setVaultCashBalance] = useState(0);
  const [vaultDigitalBalance, setVaultDigitalBalance] = useState(0);

  async function loadAll() {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [settingsRes, servicesRes, barbersRes] = await Promise.allSettled([
        businessSettingsService.get?.(),
        serviceService.list?.(),
        barberService.list?.(),
      ]);
      if (settingsRes.status === "fulfilled") {
        const s = (settingsRes.value || {}) as SalonRecord;
        setSettings(s);
        const slug =
          (s.public_slug as string) ||
          (s.publicSlug as string) ||
          "default-salon";
        generatePublicQR(slug).then((img) => setQrImage(img ?? ""));
      }
      if (servicesRes.status === "fulfilled")
        setServices(toArray(servicesRes.value));
      if (barbersRes.status === "fulfilled")
        setBarbers(toArray(barbersRes.value));
      setLoading(false);
      const [customersRes, sessionsRes, invoicesRes, reportsRes] =
        await Promise.allSettled([
          customerService.list?.(),
          sessionService.list?.(),
          invoiceService.list?.(),
          reportService.overview?.(),
        ]);
      if (customersRes.status === "fulfilled")
        setCustomers(toArray(customersRes.value));
      if (sessionsRes.status === "fulfilled")
        setSessions(toArray(sessionsRes.value));
      if (invoicesRes.status === "fulfilled")
        setInvoices(toArray(invoicesRes.value));
      if (reportsRes.status === "fulfilled")
        setReportOverview(reportsRes.value || null);
      try {
        const summary = await cashboxService.getSummary();
        const cashBal = Number(summary?.cash_balance_detail ?? summary?.cash_balance ?? 0);
        const digitalBal = Number(summary?.non_cash_balance ?? 0);
        const totalBal = Number(summary?.cash_balance ?? cashBal + digitalBal);
        setVaultCashBalance(cashBal);
        setVaultDigitalBalance(digitalBal);
        setValutBalance(totalBal);
        setDrawerBalance(cashBal);
      } catch (_e) {
        try {
          const b = await posShiftService.getBalance();
          setDrawerBalance(Number(b ?? 0));
          setValutBalance(Number(b ?? 0));
        } catch {}
      }
    } catch (err) {
      console.error("SalonProvider loadAll error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!socket) return;
    if (isAuthenticated) {
      loadAll();
    } else {
      setSettings({});
      setCustomers([]);
      setServices([]);
      setBarbers([]);
      setSessions([]);
      setInvoices([]);
      setReportOverview(null);
      setDashboardWidgets(null);
      setDrawerBalance(0);
      setValutBalance(0);
      setVaultCashBalance(0);
      setVaultDigitalBalance(0);
    }
  }, [isAuthenticated, socket]);

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

  const refreshBalance = async (): Promise<void> => {
    try {
      const summary = await cashboxService.getSummary();
      const cashBal = Number(summary?.cash_balance_detail ?? summary?.cash_balance ?? 0);
      const digitalBal = Number(summary?.non_cash_balance ?? 0);
      const totalBal = Number(summary?.cash_balance ?? cashBal + digitalBal);
      setVaultCashBalance(cashBal);
      setVaultDigitalBalance(digitalBal);
      setValutBalance(totalBal);
      setDrawerBalance(cashBal);
    } catch (e) {
      try {
        const b = await posShiftService.getBalance();
        setDrawerBalance(Number(b ?? 0));
        setValutBalance(Number(b ?? 0));
      } catch (inner) {
        console.error("refreshBalance error:", e, inner);
      }
    }
  };

  const addClient = async (
    payload: Record<string, unknown>,
  ): Promise<unknown> => {
    const created = await customerService.create?.(payload);
    try {
      const list = await customerService.list?.();
      if (list) setCustomers(toArray(list));
    } catch (e) {
      console.error("addClient refresh error:", e);
    }
    return created;
  };

  const value = useMemo<SalonContextValue>(
    () => ({
      isAuthenticated,
      currentUser,
      loading,
      settings,
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
      qrImage,
      drawerBalance,
      valutBalance,
      vaultCashBalance,
      vaultDigitalBalance,
      refreshBalance,
      refreshSalonData: loadAll,
      loadAll,
      addClient,
    }),
    [
      isAuthenticated,
      currentUser,
      loading,
      settings,
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
      qrImage,
      drawerBalance,
      valutBalance,
      vaultCashBalance,
      vaultDigitalBalance,
      addClient,
    ],
  );

  return (
    <SalonContext.Provider value={value}>{children}</SalonContext.Provider>
  );
}

export function useSalon(): SalonContextValue {
  const context = useContext(SalonContext);
  if (!context) {
    throw new Error("useSalon must be used inside SalonProvider");
  }
  return context;
}
