// ✅ D5 AI Service
export const aiService = {
  generateInsights(transactions: Array<Record<string, unknown>>): { totalIn: number; totalOut: number; net: number; predicted: number; insights: string[] } {
    let totalIn = 0;
    let totalOut = 0;

    transactions.forEach((t: Record<string, unknown>) => {
      if (Number(t.is_voided) === 1) return;

      const amount = Number(t.amount || 0);

      if (t.direction === "in") totalIn += amount;
      else totalOut += amount;
    });

    const net = totalIn - totalOut;

    const insights: string[] = [];

    // ✅ profit warning
    if (net < 0) {
      insights.push("⚠️ الخسارة أعلى من الإيرادات");
    }

    // ✅ high expense
    if (totalOut > totalIn * 0.7) {
      insights.push("🚨 المصروفات مرتفعة مقارنة بالإيرادات");
    }

    // ✅ healthy
    if (net > 0 && totalOut < totalIn * 0.5) {
      insights.push("✅ الأداء المالي ممتاز");
    }

    // ✅ prediction
    const predicted = net * 1.2;

    return {
      totalIn,
      totalOut,
      net,
      predicted,
      insights,
    };
  },
};
