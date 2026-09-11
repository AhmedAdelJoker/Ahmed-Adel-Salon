/**
 * Reception board UI state + derived lists (moved from ReceptionBoard page).
 * Data fetching (react-query), mutations and socket stay in the page.
 */
import { useEffect, useMemo, useState } from "react";

export function useReceptionBoard(appointments: any[] = []) {
  const [searchTerm, setSearchTerm] = useState("");
  const [barberFilter, setBarberFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [draggingId, setDraggingId] = useState<any>(null);
  const [dropCol, setDropCol] = useState<any>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const q = searchTerm.trim().toLowerCase();

  const filteredAppointments = useMemo(() => {
    const list = appointments || [];
    if (!q && barberFilter === "all") return list;
    return list.filter((a) => {
      if (barberFilter !== "all" && String(a.barber_id) !== barberFilter)
        return false;
      if (q) {
        const hay =
          `${a.customer_name || ""} ${a.customer_phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, q, barberFilter]);

  const waitingList = useMemo(
    () =>
      filteredAppointments.filter((a) =>
        ["waiting", "pending", "confirmed"].includes(a.status?.toLowerCase()),
      ),
    [filteredAppointments],
  );
  const inServiceList = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status?.toLowerCase() === "in_progress",
      ),
    [filteredAppointments],
  );
  const reviewList = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status?.toLowerCase() === "completed",
      ),
    [filteredAppointments],
  );
  const atCashierList = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status?.toLowerCase() === "ready_for_payment",
      ),
    [filteredAppointments],
  );
  const doneList = useMemo(
    () =>
      filteredAppointments.filter((a) =>
        ["done"].includes(a.status?.toLowerCase()),
      ),
    [filteredAppointments],
  );

  const kpis = useMemo(() => {
    const all = appointments || [];
    const active = all.filter((a) => a.status?.toLowerCase() !== "cancelled");
    const done = all.filter((a) => a.status?.toLowerCase() === "done");
    const revenue = done.reduce(
      (sum, a) => sum + Number(a.total_estimated_price || 0),
      0,
    );
    return {
      total: active.length,
      waiting: active.filter((a) =>
        ["waiting", "pending", "confirmed"].includes(a.status?.toLowerCase()),
      ).length,
      inService: active.filter((a) => a.status?.toLowerCase() === "in_progress")
        .length,
      cashier: active.filter(
        (a) => a.status?.toLowerCase() === "ready_for_payment",
      ).length,
      done: done.length,
      revenue,
    };
  }, [appointments]);

  return {
    searchTerm,
    setSearchTerm,
    barberFilter,
    setBarberFilter,
    showDone,
    setShowDone,
    draggingId,
    setDraggingId,
    dropCol,
    setDropCol,
    now,
    filteredAppointments,
    waitingList,
    inServiceList,
    reviewList,
    atCashierList,
    doneList,
    kpis,
  };
}
