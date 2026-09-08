/**
 * Attendance Engine - Advanced Logic for ERP System
 * Handles: Hours calculation, Payroll, AI Analysis, and Penalties
 */

export const deductionRules = {
  latePerMinute: 2, // 2 EGP per late minute
  absencePerDay: 100, // 100 EGP per day absent
  missingCheckout: 50, // 50 EGP for missing out log
  breakLimitMinutes: 60, // Max 1 hour break
};

/**
 * Advanced hours calculation including breaks and shifts
 */
export const calculateAdvancedHours = (
  records: Array<Record<string, any>>,
  shift: { start: string; end: string } = { start: "10:00", end: "18:00" },
): { totalHours: string; overtime: string; lateMinutes: number; breakMinutes: number; hasMissingCheckout: boolean } => {
  let totalMinutes = 0;
  let overtimeMinutes = 0;
  let lateMinutes = 0;
  let breakMinutes = 0;
  let hasMissingCheckout = false;

  // Sort records by timestamp
  const sortedRecords = [...records].sort(
    (a: Record<string, any>, b: Record<string, any>) => (new Date(a.created_at) as unknown as number) - (new Date(b.created_at) as unknown as number),
  );

  let lastInTime: Date | null = null;
  let lastBreakStartTime: Date | null = null;

  sortedRecords.forEach((rec: Record<string, any>, index: number) => {
    const currentTime = new Date(rec.created_at);

    if (rec.status === "in") {
      lastInTime = currentTime;

      // Calculate lateness only for the first 'in' of the day
      const isFirstIn = !sortedRecords
        .slice(0, index)
        .some((r: Record<string, any>) => r.status === "in");
      if (isFirstIn) {
        const [shiftH, shiftM] = shift.start.split(":").map(Number);
        const shiftStart = new Date(currentTime);
        shiftStart.setHours(shiftH as number, shiftM as number, 0, 0);

        if (currentTime > shiftStart) {
          lateMinutes += ((currentTime as unknown as number) - (shiftStart as unknown as number)) / (1000 * 60);
        }
      }
    } else if (rec.status === "out") {
      if (lastInTime) {
        totalMinutes += ((currentTime as unknown as number) - (lastInTime as unknown as number)) / (1000 * 60);

        // Overtime check
        const [endH, endM] = shift.end.split(":").map(Number);
        const shiftEnd = new Date(currentTime);
        shiftEnd.setHours(endH as number, endM as number, 0, 0);

        if (currentTime > shiftEnd) {
          overtimeMinutes += ((currentTime as unknown as number) - (shiftEnd as unknown as number)) / (1000 * 60);
        }

        lastInTime = null;
      }
    } else if (rec.status === "break") {
      lastBreakStartTime = currentTime;
    } else if (rec.status === "break_end") {
      if (lastBreakStartTime) {
        const duration = ((currentTime as unknown as number) - (lastBreakStartTime as unknown as number)) / (1000 * 60);
        breakMinutes += duration;
        // Subtract break from total hours
        totalMinutes -= duration;
        lastBreakStartTime = null;
      }
    }
  });

  // Check if still 'in' at end of day (Missing Checkout)
  if (lastInTime) {
    hasMissingCheckout = true;
  }

  return {
    totalHours: (totalMinutes / 60).toFixed(2),
    overtime: (overtimeMinutes / 60).toFixed(2),
    lateMinutes: Math.round(lateMinutes),
    breakMinutes: Math.round(breakMinutes),
    hasMissingCheckout,
  };
};

/**
 * Integrated Payroll Calculation
 */
export const calculatePayroll = (employee: Record<string, any>, stats: Record<string, any>, daysWorked = 30): Record<string, any> => {
  const baseSalary = Number(employee.base_salary || 3000);
  const hourlyRate = baseSalary / 160;

  const overtimePay = Number(stats.overtime) * hourlyRate * 1.5;
  const latePenalty = stats.lateMinutes * deductionRules.latePerMinute;
  const absencePenalty = (30 - daysWorked) * deductionRules.absencePerDay;
  const checkoutPenalty = stats.hasMissingCheckout
    ? deductionRules.missingCheckout
    : 0;

  const totalDeductions = latePenalty + absencePenalty + checkoutPenalty;
  const netSalary = baseSalary + overtimePay - totalDeductions;

  return {
    baseSalary,
    hourlyRate: hourlyRate.toFixed(2),
    overtimePay: overtimePay.toFixed(2),
    latePenalty,
    absencePenalty,
    checkoutPenalty,
    totalDeductions,
    netSalary: netSalary.toFixed(2),
  };
};

/**
 * AI Productivity & Discipline Scoring
 */
export const analyzeProductivity = (stats: Record<string, any>, daysInMonth = 22): { score: number; label: string; color: string } => {
  let score = 0;

  // Hours Score (Max 30)
  if (stats.totalHours > 160) score += 30;
  else if (stats.totalHours > 140) score += 20;

  // Overtime Score (Max 20)
  if (stats.overtime > 20) score += 20;
  else if (stats.overtime > 10) score += 10;

  // Discipline Score (Days Worked) (Max 30)
  if (daysInMonth >= 22) score += 30;
  else if (daysInMonth >= 18) score += 15;

  // Lateness Penalty (Max 20)
  if (stats.lateMinutes < 30) score += 20;
  else if (stats.lateMinutes < 60) score += 10;

  let label = "⚠️ ضعيف";
  let color = "text-danger";

  if (score >= 80) {
    label = "⭐ ممتاز";
    color = "text-success";
  } else if (score >= 50) {
    label = "✅ جيد";
    color = "text-warning";
  }

  return { score, label, color };
};
