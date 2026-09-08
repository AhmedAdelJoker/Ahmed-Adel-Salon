import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import posShiftService from "@/services/posShiftService";
import {
  calculateDenominationsTotal,
  calculateDiscrepancy,
  isDiscrepancySignificant,
} from "@/lib/money/finance";

/**
 * Custom hook to manage POS Shift lifecycle and financial integrity.
 */
export function usePosShift(onSuccess?: (result: unknown) => void) {
  const [working, setWorking] = useState(false);
  const [denominations, setDenominations] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
  });
  const [discrepancyNote, setDiscrepancyNote] = useState("");

  const totalFromDenoms = useMemo(
    () => calculateDenominationsTotal(denominations),
    [denominations],
  );

  const handleDenomChange = useCallback((denom: number | string, count: number | string) => {
    setDenominations((prev) => ({
      ...prev,
      [denom]: Number(count || 0),
    }));
  }, []);

  const resetDenominations = useCallback(() => {
    setDenominations({
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
    });
    setDiscrepancyNote("");
  }, []);

  const openShift = useCallback(
    async (openingCash: number | string | null | undefined) => {
      if (
        openingCash === "" ||
        openingCash === null ||
        openingCash === undefined
      ) {
        toast.error("يرجى إدخال الرصيد الافتتاحي للعهدة");
        return null;
      }

      setWorking(true);
      try {
        const payload = {
          opening_cash: Number(openingCash || 0),
        };

        const action =
          posShiftService.openShift ||
          posShiftService.open ||
          posShiftService.startShift ||
          posShiftService.create;

        if (!action) {
          throw new Error("خدمة فتح الوردية غير متاحة");
        }

        const result = await action(payload);
        toast.success("تم فتح الوردية بنجاح");
        onSuccess?.(result);
        return result;
      } catch (err) {
        console.error("Open shift error:", err);
        const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
        toast.error(
          (apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل فتح الوردية",
        );
        throw err;
      } finally {
        setWorking(false);
      }
    },
    [onSuccess],
  );

  const closeShift = useCallback(
    async (
      shiftId: string | number | null | undefined,
      countedCash: number | string | null | undefined,
      expectedCash: number | string | null | undefined,
    ) => {
      if (!shiftId) {
        toast.error("لا توجد وردية محددة للإغلاق");
        return null;
      }

      const counted =
        countedCash === "" || countedCash === null || countedCash === undefined
          ? totalFromDenoms
          : Number(countedCash || 0);
      const expected = Number(expectedCash || 0);
      const discrepancy = calculateDiscrepancy(counted, expected);

      if (isDiscrepancySignificant(discrepancy) && !discrepancyNote.trim()) {
        toast.error("يرجى كتابة سبب فرق العهدة قبل إغلاق الوردية");
        return null;
      }

      setWorking(true);
      try {
        const payload = {
          counted_cash: counted,
          expected_cash: expected,
          discrepancy,
          discrepancy_note: discrepancyNote.trim(),
          denominations,
        };

        const action =
          posShiftService.closeShift ||
          posShiftService.close ||
          posShiftService.endShift ||
          posShiftService.update;

        if (!action) {
          throw new Error("خدمة إغلاق الوردية غير متاحة");
        }

        const result = await action(shiftId, payload);
        toast.success("تم إغلاق الوردية بنجاح");
        resetDenominations();
        onSuccess?.(result);
        return result;
      } catch (err) {
        console.error("Close shift error:", err);
        const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
        toast.error(
          (apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل إغلاق الوردية",
        );
        throw err;
      } finally {
        setWorking(false);
      }
    },
    [
      denominations,
      discrepancyNote,
      onSuccess,
      resetDenominations,
      totalFromDenoms,
    ],
  );

  return {
    working,
    denominations,
    discrepancyNote,
    setDiscrepancyNote,
    handleDenomChange,
    resetDenominations,
    openShift,
    closeShift,
    totalFromDenoms,
  };
}

export default usePosShift;
