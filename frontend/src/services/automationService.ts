export const automationService = {
  lastRunKey: "auto_report_last_run",

  shouldRunToday() {
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(this.lastRunKey);

    return last !== today;
  },

  markRun() {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(this.lastRunKey, today);
  },

  runDailyAnalysis(transactions: Array<Record<string, unknown>>): { date: string; net: number; inTotal: number; outTotal: number; alerts: string[] } {
    let inTotal = 0;
    let outTotal = 0;

    transactions.forEach((t: Record<string, unknown>) => {
      if (Number(t.is_voided) === 1) return;

      const val = Number(t.amount || 0);

      if (t.direction === "in") inTotal += val;
      else outTotal += val;
    });

    const net = inTotal - outTotal;

    const alerts: string[] = [];

    // 🚨 low cash
    if (net < 1000) {
      alerts.push("⚠️ الرصيد منخفض اليوم");
    }

    // 🚨 heavy expense
    if (outTotal > inTotal * 0.7) {
      alerts.push("🚨 مصروفات عالية اليوم");
    }

    // ✅ good
    if (net > 2000) {
      alerts.push("✅ أداء ممتاز اليوم");
    }

    return {
      date: new Date().toLocaleDateString("ar-EG"),
      net,
      inTotal,
      outTotal,
      alerts,
    };
  },
};
