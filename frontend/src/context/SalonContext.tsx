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
import { setCurrency } from "@/lib/core/currency";
import { needsTwoFactorEnrollment } from "@/lib/auth/twoFactorEnrollment";
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

/**
 * Roles each of these endpoints accepts on the backend.
 *
 * `loadAll` used to fire every one of them for every signed-in user, so a
 * barber — who cannot read a single one of them — produced five 403s on every
 * login, all from `SalonContext`, and paid for requests that could only fail.
 * These mirror `app/api/deps.py`, which is the authority; the frontend cannot
 * see it, so the two are kept in step by hand and this is the one place they
 * are written down.
 */
const CASH_DESK_ROLES = ["cashier", "manager", "admin", "owner", "accountant"];
const REPORTS_ROLES = ["admin", "manager", "owner"];

const can = (user: AuthUser | null, allowed: string[]): boolean => {
  const role = String(user?.role ?? "").toLowerCase();
  return allowed.includes(role);
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
    // An enrolment-only session is authenticated but authorised to reach the
    // 2FA setup endpoints and nothing else. Every request below would come back
    // 403, so the salon data would stay empty regardless; firing them anyway
    // only produced a wall of failed requests in the console on the one screen
    // the user has to get through. Skipping is not a workaround -- the backend
    // answer is the same either way.
    if (needsTwoFactorEnrollment()) return;
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
        // Publish the salon's currency to `formatCurrency`.
        //
        // Both `currency` and `currencyCode` are accepted because the column is
        // `currency` and nothing has ever read it, so no adapter has had a
        // reason to normalise the name -- and a formatter that silently stays
        // on EGP because the key was spelled differently is the same bug this
        // is fixing. The label is left alone on failure: a failed settings
        // fetch should not reset a correctly configured currency to the
        // default.
        setCurrency(
          (s.currency as string) || (s.currencyCode as string) || undefined
        );
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
      // Cash-desk reads, then the reports overview. A barber is outside every
      // one of them, so `Promise.allSettled` would otherwise resolve five
      // rejections and spend a round-trip each to learn that. The two lists
      // are collected rather than destructured because which one ran depends
      // on the role, and their positions must not shift when they do.
      const jobs: { key: string; run: () => Promise<unknown> }[] = [];
      if (can(currentUser, CASH_DESK_ROLES)) {
        jobs.push(
          { key: "customers", run: () => customerService.list?.() },
          { key: "sessions", run: () => sessionService.list?.() },
          { key: "invoices", run: () => invoiceService.list?.() },
        );
      }
      if (can(currentUser, REPORTS_ROLES)) {
        jobs.push({ key: "reports", run: () => reportService.overview?.() });
      }

      if (jobs.length > 0) {
        const settled = await Promise.allSettled(jobs.map((job) => job.run()));
        jobs.forEach((job, index) => {
          const outcome = settled[index];
          if (outcome?.status !== "fulfilled") return;
          const value = outcome.value;
          switch (job.key) {
            case "customers":
              setCustomers(toArray(value));
              break;
            case "sessions":
              setSessions(toArray(value));
              break;
            case "invoices":
              setInvoices(toArray(value));
              break;
            case "reports":
              setReportOverview((value as SalonRecord | null) || null);
              break;
          }
        });
      }

      if (can(currentUser, CASH_DESK_ROLES)) {
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
