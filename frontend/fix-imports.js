import fs from "fs";
import path from "path";

const financialReportsPath = path.join(
  "src",
  "pages",
  "owner",
  "FinancialReports.jsx",
);
const schedulePath = path.join("src", "pages", "cashier", "Schedule.jsx");

console.log("⏳ جاري التنظيف النهائي للمسارات والمجلدات المتبقية...");

// 1. تصحيح FinancialReports.jsx بالكامل
if (fs.existsSync(financialReportsPath)) {
  let content = fs.readFileSync(financialReportsPath, "utf8");

  // استبدال شامل لأي شكل من أشكال استدعاء Button المكسور في هذا الملف
  let updatedContent = content.replace(
    /import\s+.*\s+from\s+['"].*?components\/ui\/[bB]utton['"];?/g,
    'import { Button } from "../../components/ui/Button";',
  );

  // لزيادة الأمان: لو كان المستودع عندك بيستخدم حروف صغيرة بالكامل لمجلد الـ Components
  updatedContent = updatedContent.replace(
    /..\/..\/components\/ui\/Button/g,
    "../../components/ui/button", // تجربة الحرف الصغير لو الكابيتال منفعش
  );

  fs.writeFileSync(financialReportsPath, updatedContent, "utf8");
  console.log(`✅ تم تصحيح ملف الحسابات: ${financialReportsPath}`);
}

// 2. تصحيح السطور المتبقية في Schedule.jsx
if (fs.existsSync(schedulePath)) {
  let content = fs.readFileSync(schedulePath, "utf8");

  // تصحيح السطرين الفاضلين (Button و StatusBadge) وترجيعهم خطوتين للخلف (../../)
  let updatedContent = content
    .replace(
      /["']\.\.\/services\/scheduleService["']/g,
      '"../../services/scheduleService"',
    )
    .replace(
      /["']\.\.\/components\/common\/PageHero["']/g,
      '"../../components/common/PageHero"',
    )
    .replace(
      /["']\.\.\/components\/common\/DashboardPanel["']/g,
      '"../../components/common/DashboardPanel"',
    )
    .replace(
      /["']\.\.\/components\/common\/MetricCard["']/g,
      '"../../components/common/MetricCard"',
    )
    .replace(
      /["']\.\.\/components\/common\/Button["']/g,
      '"../../components/common/Button"',
    )
    .replace(
      /["']\.\.\/components\/common\/StatusBadge["']/g,
      '"../../components/common/StatusBadge"',
    );

  fs.writeFileSync(schedulePath, updatedContent, "utf8");
  console.log(`✅ تم تصحيح أزرار وشارات ملف الجداول: ${schedulePath}`);
}

console.log("🚀 انتهى التصحيح! جاهز للرفع.");
