import fs from "fs";
import path from "path";

// مسارات الملفات التي تحتوي على أخطاء
const financialReportsPath = path.join(
  "src",
  "pages",
  "owner",
  "FinancialReports.jsx",
);
const schedulePath = path.join("src", "pages", "cashier", "Schedule.jsx");

console.log("⏳ جاري فحص وتصحيح مسارات الاستدعاء المكسورة...");

// 1. تصحيح ملف FinancialReports.jsx (تأمين استدعاء Button وحروف المجلدات)
if (fs.existsSync(financialReportsPath)) {
  let content = fs.readFileSync(financialReportsPath, "utf8");

  // تصحيح استدعاء البوتون لو كان مكتوب بحروف صغيرة أو مسار غير دقيق
  const updatedContent = content.replace(
    /import\s+\{\s*Button\s*\}\s+from\s+['"].*?components\/ui\/[bB]utton['"];?/g,
    'import { Button } from "../../components/ui/Button";',
  );

  fs.writeFileSync(financialReportsPath, updatedContent, "utf8");
  console.log(`✅ تم فحص وتحديث ملف: ${financialReportsPath}`);
} else {
  console.log(`⚠️ لم يتم العثور على الملف: ${financialReportsPath}`);
}

// 2. تصحيح ملف Schedule.jsx (إضافة الـ المفقودة وترجيع المسار خطوتين لورا)
if (fs.existsSync(schedulePath)) {
  let content = fs.readFileSync(schedulePath, "utf8");

  // تصحيح الـ 4 مسارات المكسورة وترجيعها خطوتين للخلف لأن الفولدر فرعي (cashier)
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
    );

  fs.writeFileSync(schedulePath, updatedContent, "utf8");
  console.log(
    `✅ تم تصحيح مسارات الاستدعاء (../../) بنجاح في ملف: ${schedulePath}`,
  );
} else {
  console.log(`⚠️ لم يتم العثور على الملف: ${schedulePath}`);
}

console.log(
  "\n🚀 الكل تمام! الحسابات والمسارات اتظبطت. تقدر ترفع الكود دلوقتي.",
);
