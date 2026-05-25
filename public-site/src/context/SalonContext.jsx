import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { customerService } from "../services/customerService";
import { serviceService } from "../services/serviceService";
import { barberService } from "../services/barberService";
import { sessionService } from "../services/sessionService";
import { invoiceService } from "../services/invoiceService";
import { reportService } from "../services/reportService";
import { dashboardService } from "../services/dashboardService";
import { SocketContext } from "./SocketContext";

export const SalonContext = createContext(undefined);

const toArray = (value) => value?.items || value || [];

export function SalonProvider({ children }) {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const currentUser = auth?.currentUser ?? auth?.user ?? null;

  const socket = useContext(SocketContext);

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reportOverview, setReportOverview] = useState(null);
  const [dashboardWidgets, setDashboardWidgets] = useState(null);
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

  async function addClient(payload) {
    const createCustomer =
      customerService.create ||
      customerService.add ||
      customerService.createCustomer;
    const createSession =
      sessionService.create ||
      sessionService.add ||
      sessionService.createSession;

    if (!createCustomer) {
      throw new Error("خدمة إضافة العميل غير متاحة");
    }

    const customer = await createCustomer({
      name: payload.name,
      phone: payload.phone,
      ...payload,
    });

    if (createSession && (payload.serviceId || payload.service_id)) {
      try {
        await createSession({
          customer_id:
            customer?.id || customer?.customer_id || payload.customer_id,
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

  const value = useMemo(
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
    <SalonContext.Provider value={value || ""}>
      {children}
    </SalonContext.Provider>
  );
}

export function useSalon() {
  const context = useContext(SalonContext);
  if (context === undefined) {
    throw new Error("useSalon must be used within SalonProvider");
  }
  return context;
}
