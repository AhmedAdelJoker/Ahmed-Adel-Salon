import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { barberService } from "@/services/barberService";
import api from "@/services/api";
import { formatCurrency } from "@/lib/core/utils";
import { toast } from "react-hot-toast";

export const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export const useBarberWorkStation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  const [appointment, setAppointment] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [serviceNotes, setServiceNotes] = useState("");
  const [productsUsed, setProductsUsed] = useState<any[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);

  const timerRef = useRef<any>(null);

  const loadAppointment = useCallback(async () => {
    try {
      setLoading(true);
      const res = await barberService.getAppointmentById(appointmentId);
      setAppointment((res as any)?.data);
      const startedAt = (res as any)?.data?.started_at;
      if (startedAt) {
        const start = new Date(startedAt).getTime();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setElapsedTime(elapsed);
        setTimerRunning(true);
      }
    } catch (_err) {
      toast.error("فشل تحميل الحجز");
      navigate("/barber");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, navigate]);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await barberService.getQueue();
      const data: any = (res as any).data || {};
      const waiting = Array.isArray(data.waiting) ? data.waiting : [];
      const inService = Array.isArray(data.inService) ? data.inService : [];
      setAppointments([...waiting, ...inService]);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
    if (appointmentId) {
      loadAppointment();
    } else {
      setLoading(false);
    }
  }, [appointmentId, fetchAppointments, loadAppointment]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev: number) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const handleStartTimer = useCallback(() => {
    if (!appointment.started_at) {
      barberService.updateStatus(appointmentId, "in-service");
      const startTime = new Date().toISOString();
      setAppointment((prev: any) => ({ ...prev, started_at: startTime }));
      setElapsedTime(0);
    }
    setTimerRunning(true);
  }, [appointment, appointmentId]);

  const handlePauseTimer = useCallback(() => setTimerRunning(false), []);

  const handleCompleteService = useCallback(async () => {
    try {
      await barberService.updateStatus(appointmentId, "completed");
      if (tipAmount) {
        await api.post(`/barber/appointments/${appointmentId}/tip`, {
          amount: tipAmount,
        });
      }
      toast.success("تم إنهاء الخدمة بنجاح");
      navigate("/barber");
    } catch (_err) {
      toast.error("فشل إنهاء الخدمة");
    }
  }, [appointmentId, tipAmount, navigate]);

  const handleCancelService = useCallback(async () => {
    try {
      await barberService.updateStatus(appointmentId, "cancelled");
      toast.success("تم إلغاء الخدمة");
      navigate("/barber");
    } catch (_err) {
      toast.error("فشل إلغاء الخدمة");
    }
  }, [appointmentId, navigate]);

  const handleAddProduct = useCallback(() => {
    const name = prompt("اسم المنتج:");
    if (!name) return;
    const price = prompt("السعر:");
    if (!price) return;
    setProductsUsed((prev) => [
      ...prev,
      { name, price: Number(price), id: Date.now() },
    ]);
  }, []);

  const totalProducts = productsUsed.reduce(
    (s: number, p: any) => s + p.price,
    0,
  );

  return {
    user,
    navigate,
    searchParams,
    setSearchParams,
    appointmentId,
    appointment,
    setAppointment,
    appointments,
    loading,
    timerRunning,
    setTimerRunning,
    elapsedTime,
    serviceNotes,
    setServiceNotes,
    productsUsed,
    setProductsUsed,
    showCompleteDialog,
    setShowCompleteDialog,
    showCancelDialog,
    setShowCancelDialog,
    tipAmount,
    setTipAmount,
    audioEnabled,
    setAudioEnabled,
    fetchAppointments,
    loadAppointment,
    formatTime,
    handleStartTimer,
    handlePauseTimer,
    handleCompleteService,
    handleCancelService,
    handleAddProduct,
    totalProducts,
    formatCurrency,
  };
};
