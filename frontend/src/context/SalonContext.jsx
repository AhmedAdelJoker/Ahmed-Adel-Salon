import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { SocketContext } from "./SocketContext";

// ✅ QR SYSTEM
import { generatePublicQR } from "@/utils/qr";

// ✅ Services
import { customerService } from "../services/customerService";
import { serviceService } from "../services/serviceService";
import { barberService } from "../services/barberService";
import { sessionService } from "../services/sessionService";
import { invoiceService } from "../services/invoiceService";
import { reportService } from "../services/reportService";
import { dashboardService } from "../services/dashboardService";

import { businessSettingsService } from "../services/businessSettingsService";

export const SalonContext = createContext(undefined);

const toArray = (value) => value?.items || value || [];

export function SalonProvider({ children }) {
  const auth = useAuth();
  const socket = useContext(SocketContext);

  const isAuthenticated = auth?.isAuthenticated ?? false;
  const currentUser = auth?.currentUser ?? auth?.user ?? null;

  const [settings, setSettings] = useState({});
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reportOverview, setReportOverview] = useState(null);
  const [dashboardWidgets, setDashboardWidgets] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ QR IMAGE (GLOBAL)
  const [qrImage, setQrImage] = useState("");

  // ✅ Load all data
  async function loadAll() {
    if (!isAuthenticated) return;

    setLoading(true);

    try {
      const [
        settingsData,
        customersData,
        servicesData,
        barbersData,
        sessionsData,
        invoicesData,
        reportsData,
      ] = await Promise.allSettled([
        businessSettingsService.get?.(),
        customerService.list?.(),
        serviceService.list?.(),
        barberService.list?.(),
        sessionService.list?.(),
        invoiceService.list?.(),
        reportService.overview?.(),
      ]);

      if (settingsData.status === "fulfilled") {
        const s = settingsData.value || {};
        setSettings(s);
        const slug = s.public_slug || s.publicSlug || "default-salon";
        generatePublicQR(slug).then(setQrImage);
      }

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
        console.error("Dashboard widgets error:", err);
      }
    } catch (err) {
      console.error("SalonProvider loadAll error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Load data
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
    }
  }, [isAuthenticated, socket]);

  // ✅ Session groups
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

  // ✅ Context Value
  const value = useMemo(
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

      refreshSalonData: loadAll,
      loadAll,

      // ✅ QR SYSTEM
      qrImage,
    }),
    [
      qrImage,
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
    ],
  );

  return (
    <SalonContext.Provider value={value}>{children}</SalonContext.Provider>
  );
}

// ✅ Hook
export function useSalon() {
  const context = useContext(SalonContext);

  if (!context) {
    throw new Error("useSalon must be used inside SalonProvider");
  }

  return context;
}
