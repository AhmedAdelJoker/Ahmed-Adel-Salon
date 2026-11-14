# تقرير تعريب صفحات المالك/المدير (Owner/Manager i18n) — قبل التنفيذ

> فرع `security/postgres-hardening` — فحص نطاق + خطة. **لم يُعدّل أي كود بعد**.
> namespace `owner` مسجل (ملف `ar|en/owner.json` — 18 سطر فقط، skeleton) — needs massive expansion.
> المتصفح (live): `http://localhost:5173/#/owner` (admin/owner، الوضعان AR/EN).

---

## 1) نطاق العمل (28 صفحة owner + 2 manager + many features)

### صفحات owner (26)
ReportsDashboard, ManagerDashboard, OperationalReports, FinancialReports, FinancialRules, DailySummaryReport, EmployeeReports, EmployeeArchive, HRManagement, Cashbox, Payroll, PayrollArchive, Expenses, ExpensesArchive, Inventory (+ProductBundles), CustomerArchive, InvoiceAdjustmentRequests, ServicesManagement, LoyaltySettingsPanel, Settings, BusinessSettingsPage, WebsiteSettingsPanel, WorkingHoursPanel, UsersPanel, SecurityAccess, PermissionsManagement, SmartAlerts.

### صفحات manager (2)
ManagerDashboard, AttendanceManagement (shared with owner).

### مكونات feature بعربية (أمثلة)
- Attendance: PulseView, MonthlyView, LeavesView, EmployeeCard, DailySummary
- Expenses: ExpensesToolbar, ExpenseFormSections, ExpenseDetailsPanel, ExpensesSummaryCards
- Payroll: PayrollTable, PayrollModals, PeriodChartPanel, StaffSnapshot
- HR: EmployeeTable, ReviewTab, WorkTab, form tabs
- Inventory: ProductFormModal, ProductDetailsModal, FilterPanel, StockWizard, StockSupplyModal
- Financial reports: DrilldownPanel, ForecastTab
- Security: UsersPanelTab, TwoFactorPanel, StatusRow, PoliciesPanel, OverviewPanel, ActivityPanel
- Schedule: many components (already partially i18n'd via schedule namespace)
- Reception, POS, Bookings: already i18n'd in earlier phases

### حجم Arbeit
- ~5669 سطر عربي across `src/` total; owner/manager subset ≈ 1465 سطر (per checkpoint).
- 28+ ملف صفحة owner + ~40 مكون feature.
- namespace `owner` skeleton (18 سطر) → needs full expansion (est. 1500+ keys).

## 2) خطة Execution (P1/P2/P3)

### P1 — صفحات الـLanding + الإعدادات + التقارير (الأعلى تأثيراً)
أولوية (high visibility in English UI):
1. ReportsDashboard.tsx (28 Arabic lines)
2. ManagerDashboard.tsx (31)
3. Settings.tsx (117)
4. BusinessSettingsPage.tsx (32)
5. Cashbox.tsx (96)
6. OperationalReports.tsx (94)
7. FinancialReports.tsx (66)
8. FinancialRules.tsx (93)
9. DailySummaryReport.tsx (33)
10. EmployeeReports.tsx (50)
11. HRManagement.tsx (55)
12. Payroll.tsx (30) + PayrollArchive.tsx (90)
13. Expenses.tsx (25) + ExpensesArchive.tsx (89)
14. SmartAlerts.tsx (32)
15. ServicesManagement.tsx (services already via catalog)
16. InvoiceAdjustmentRequests.tsx (60)
17. CustomerArchive.tsx (61)
18. EmployeeArchive.tsx (18)
19. LoyaltySettingsPanel.tsx (22)
20. SecurityAccess.tsx (21)
21. PermissionsManagement.tsx (12)
22. WorkingHoursPanel.tsx (82)
23. WebsiteSettingsPanel.tsx (128)
24. UsersPanel.tsx (8)
25. Inventory (38) + ProductBundles
26. AttendanceManagement (manager)

Plus feature components (attendance, expenses, payroll, HR, inventory, financial-reports, security, schedule).

### P2 — تجربة/وصول
- RTL/LTR audit on owner pages (text-right → text-end where needed).
- A11y on owner tables (aria-labels, scope="col", aria-sort).
- Date locale consistency.
- Empty states / loading states.

### P3 — جودة/اختبارات
- Unit tests for owner utils (similar to invoicesFeature.test.tsx).
- `tsc` + `npm run test:run` + build after each batch.
- Live AR/EN verification per batch.

## 3) استراتيجية Execution
- **دفعة واحدة = 3-5 صفحات + مكوناتها**، ثم `tsc` + `test:run` + build + live check AR/EN.
- إضافة keys إلى `owner.json` paralelly (ar/en) — i18n test enforces parity.
- Reuse existing keys from `common`, `pos`, `customers`, `invoices`, `routes` namespaces where appropriate (avoid duplication).
- Follow established patterns: `useTranslation("owner")`, `i18n.t("owner:...")` in pure utils, `getIntlLocale` for dates.

## 4) P1 batching (جلسة 1 = batches 1-3)
- Batch 1: ReportsDashboard, ManagerDashboard, DailySummaryReport, EmployeeReports (landing + reports)
- Batch 2: FinancialReports, FinancialRules, OperationalReports (financial)
- Batch 3: HRManagement, EmployeeArchive, CustomerArchive, InvoiceAdjustmentRequests (management)
- Batch 4: Cashbox, Expenses, ExpensesArchive, Inventory, ProductBundles (operations)
- Batch 5: Payroll, PayrollArchive, LoyaltySettingsPanel (finance/payroll)
- Batch 6: Settings, BusinessSettingsPage, WorkingHoursPanel, WebsiteSettingsPanel, UsersPanel, SecurityAccess, PermissionsManagement, SmartAlerts (settings/security)

كل دفعة: ترجمة + RTL + a11y + تحقق tsc + live.

## 5) الفحوص المطلوبة بعد كل دفعة
- `npx tsc --noEmit` نظيف.
- `npm run test:run` ناجح.
- `npm run build` ناجح.
- تحقق حي AR/EN: لا مفتاح خام، لا حرف عربي في EN، dates locale-aware.

## 7) التنفيذ — Batch 1 (مكتمل)

**الصفحات/المكونات المعرّبة:**
- `pages/owner/ReportsDashboard.tsx` (landing) ✅
- `pages/manager/ManagerDashboard.tsx` ✅
- `features/reports-dashboard/components/DayStatusBar.tsx` ✅
- `features/reports-dashboard/components/NeedsAttention.tsx` ✅
- `features/reports-dashboard/components/SmartInsights.tsx` ✅
- `features/reports-dashboard/components/RevenueChart.tsx` ✅
- `features/reports-dashboard/components/RankingTable.tsx` ✅
- `features/reports-dashboard/components/RevenueSparkline.tsx` ✅
- `features/reports-dashboard/components/ServiceDistribution.tsx` ✅
- `features/reports-dashboard/hooks/useReportsDashboard.ts` ✅
- `features/reports-dashboard/constants.ts` (PERIODS labels → keys) ✅

**التحقق:**
- `npx tsc --noEmit` نظيف
- `npm run test:run` → i18n 7/7 + 573/573
- `npm run build` ناجح
- تحقق حي EN: لا مفتاح خام، لا حرف عربي في المحتوى (باستثناء البيانات/التعليقات)، dates locale-aware
- تحقق حي AR: كل شيء يعمل

**متبقي (Batches 3-6):** Cashbox, Expenses, ExpensesArchive, Inventory, ProductBundles, Payroll, PayrollArchive, LoyaltySettingsPanel, Settings, BusinessSettingsPage, WorkingHoursPanel, WebsiteSettingsPanel, UsersPanel, SecurityAccess, PermissionsManagement, SmartAlerts, EmployeeReports, AttendanceManagement + مكونات feature (attendance, expenses, payroll, HR, inventory, security, schedule).

---

## 8) التنفيذ — Batch 2 (مكتمل — Group B: financial-reports)

**الصفحات/المكونات المعرّبة:**
- `pages/owner/FinancialReports.tsx` — جميع النصوص العربية (66 سطر) تُستدعى عبر `t("finRep.*")`، quickMetrics حصلت على حقول `key`، التواريخ عبر `getIntlLocale` مع طابع تاريخ ولغة عربية/إنجليزية ✅
- `features/financial-reports/hooks/useFinancialReports.ts` — `useTranslation("owner")` + `getIntlLocale`، دالة `monthLabelOf(key, locale)` بدلاً من `paymentLabel` المحلية، كل التواريخ تُستدعى عبر `t("finFeat.toast.*")` / `t("finFeat.insights.*")`، الميمو للشذوذ يرفق حقل `message`، تبعيات الاستخدام تضيف `t` و `locale`، رؤوس أعمدة CSV تُستدعى عبر `t("finFeat.cvs.*")` ✅
- `features/financial-reports/components/FilterBar.tsx` — `useTranslation("owner")` + `getIntlLocale`، Préسيتات عبر `t(p.label)`، تسميات ARIA عبر `t("finFeat.filter.*")`، طابع التدقيق عبر `t("finFeat.filter.lastAudit")` مع `toLocaleString(locale)` ✅
- `features/financial-reports/components/AnomalyAlerts.tsx` — `useTranslation("owner")` قبل عودة مبكرة، العنوان/الوصف/الشارة/الزر عبر `t("finFeat.anomaly.*")` ✅
- `features/financial-reports/components/CashflowTab.tsx` — `useTranslation("owner")`، جميع النصوص عبر `t("finFeat.cashflow.*")` ✅
- `features/financial-reports/components/DrilldownPanel.tsx` — `useTranslation("owner")`، العناوين/الوصف/الأزرار عبر `t("finFeat.drill.*")`، `paymentLabel(name, t)`، `expenseCatLabelFor(..., t)` ✅
- `features/financial-reports/components/KpiRow.tsx` — `useTranslation("owner")`، التلميحات والعناوين عبر `t("finFeat.kpi.*")` ✅
- `features/financial-reports/components/MonthlyTargetProgress.tsx` — `useTranslation("owner")` + `getIntlLocale`، العناوين والأزرار عبر `t("finRep.target.*")` / `t("common.*")` ✅
- `features/financial-reports/components/ForecastTab.tsx` — `useTranslation("owner")`، النصوص عبر `t("finRep.forecast.*")` ✅
- `features/financial-reports/components/FinancialChartBits.tsx` — `useTranslation("owner")`، العنوان الاحتياطي عبر `t("finFeat.tooltip.fallbackTitle")` ✅
- `features/financial-reports/constants.ts` — `PAYMENT_LABELS` قيمها مفاتيح `finFeat.pay.*`، `PRESETS` → `finRep.preset.*`، `REPORT_EXPORTS` → `finRep.reportCards.{growth,revenue,ledger}.{title,desc,details}`، النوع `ReportExport` و `as const` محفوظان ✅
- `features/financial-reports/utils.ts` — إعادة كتابة كاملة: `paymentLabel(key, t)`، `categoryKeyOf(raw)`، `expenseCatLabelFor(raw, t)`، `GROUP_BY_AR_LABEL` (13 تسمية عربية)، `GROUP_BY_EN_ALIAS` ✅
- `lib/money/financialAnalytics.ts` — واجهة `DayAnomaly`: حُذف `message` وأُضيف `value`/`mean`، 3 مواقع دفع تمرر `value` و `mean`، حُذف استيراد `formatCurrency` غير المستخدم، `downloadCsvFile`/`AR_MONTHS`/`monthLabelAr` غير معدّلة (مقيدة باختبارات) ✅
- `src/i18n/locales/ar/owner.json` + `src/i18n/locales/en/owner.json` — 672 مفتاح لكل منها، مجموعات متطابقة، تكافؤ عوامل التعبئة، لا عربي في EN، لا مجموعات لاتينية 3+ في AR (باستثناء القائمة المسموح بها) ✅

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` → 7/7 ناجح
- `npm run test:run` → 573/573 ناجح (يطابق الخط الأساس)
- `npm run build` ناجح
- فحص متبقٍ للعربية: لا نص عربي خام في ملفات Group B (باستثناء `عام` في المقارنات، `CANCELLED`، `AR_MONTHS`، `؛` في التواريخ)

## 9) التنفيذ — Batch 2 (مكتمل — Groups C, D, E)

**Group C — financial-rules:**
- `pages/owner/FinancialRules.tsx` — جميع النصوص العربية تُستدعى عبر `t("finRules.*")` و `t("finRulesHook.pay.*")\)، `useTranslation("owner")` + `getIntlLocale` للتواريخ، TABS تستخدم `t("finRules.tabs." + tab.id)` ✅
- `features/financial-rules/hooks/useFinancialRules.ts` — `useTranslation("owner")\)، `paymentLabels` مفاتيحها `finRulesHook.pay.*\)، `formatDate(value, locale)` تقبل locale اختيارياً، كل التواريخ والتواريخ عبر `t("finRulesHook.*")\) ✅

**Group D — operational-reports:**
- `pages/owner/OperationalReports.tsx` — `useTranslation("owner")` + `getIntlLocale`، PRESETS تستخدم `t(p.label)\)، جميع النصوص عبر `t("opRep.*")\)`. Tooltips (`ServiceTooltip`, `HourTooltip`) تقبل prop `t\) ✅
- `features/operational-reports/hooks/useOperationalReports.ts` — `useTranslation("owner")\)، كل التواريخ والأخطاء عبر `t("opRepHook.*")\)` ✅
- `components/AIInsights.tsx` — `useTranslation("owner")\)، العنوان/التوصية/الربح المتوقع عبر `t("ai.*")\)` ✅

**Group E — daily-summary:**
- `pages/owner/DailySummaryReport.tsx` — `useTranslation("owner")` + `getIntlLocale`، بناء CSV labels من `t()` وتمريرها لـ `buildDailySummaryCsv()\، التواريخ والتواريخ عبر `t("daily.*")\)`، الوردية — `toLocaleTimeString(locale)\)`. LINKS تستخدم `t(l.label)` / `t(l.desc)\)` ✅
- `features/daily-summary/constants.ts` — `DAILY_SUMMARY_LINKS` تستخدم مفاتيح `dailyFeature.links.*\)` ✅
- `features/daily-summary/utils.ts` — `getShiftDisplayName(shift, fallback?)\)` تقبل fallback اختياري، `buildDailySummaryCsv(data, labels?: DailySummaryCsvLabels)\)` تقبل labels اختيارية مع Arabic defaults محفوظة ✅
- `features/daily-summary/index.ts` — يصدّر `DailySummaryCsvLabels` كـ type ✅

**التحقق (لكل مجموعة):**
- `npx tsc --noEmit\) نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts\) → 7/7 ناجح
- `npm run test:run\) → 573/573 ناجح (matching baseline)
- `npm run build\) ناجح
- فحص残余 للعربية: لا نص عربي خام في ملفات Group C/D/E (باستثناء defaults العربية في `DEFAULT_CSV_LABELS\)

## 11) Batch 3 — مكتمل (HRManagement, EmployeeArchive, CustomerArchive, InvoiceAdjustmentRequests)

**الصفحات المعرّبة:**
- `pages/owner/HRManagement.tsx` — `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("hr.*")`، `STATUS_BADGE` → `getStatusBadge(t)` ✅
- `pages/owner/EmployeeArchive.tsx` — `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("empArch.*")`، `STATUS_BADGE` → `getStatusBadge(t)` ✅
- `pages/owner/CustomerArchive.tsx` — `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("custArch.*")` ✅
- `pages/owner/InvoiceAdjustmentRequests.tsx` — `useTranslation("owner")` + `getIntlLocale`، constants `requestTypeLabel`/`requestStatusLabels`/`statusLabel` → functions with `t`، جميع النصوص عبر `t("invAdj.*")` ✅

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` → 7/7 ناجح
- `npm run test:run` → 573/573 ناجح (matching baseline)
- `npm run build` ناجح
- فحص残余 للعربية: لا نصوص عربية خام في ملفات Batch 3 (باستثناء comments)

**الملفات المعدّلة (Batch 3):**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (+61 hr + 18 empArch + 60 custArch + 54 invAdj keys = 193 new keys)
- `frontend/src/pages/owner/{HRManagement,EmployeeArchive,CustomerArchive,InvoiceAdjustmentRequests}.tsx`

**ملاحظة:** لا يوجد commit/push — كل التغييرات local على فرع `security/postgres-hardening`.

**النطاق:** FinancialReports, FinancialRules, OperationalReports, DailySummaryReport + كل feature components/hooks/constants/utils الخاصة بها + AIInsights.

**الحالة:**
- جميع النصوص العربية تُستدعى عبر مفاتيح i18n (`t()`) في namespace `owner`
- جميع التواريخ locale-aware عبر `getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar")`
- CSV labels قابلة للترجمة عبر `DailySummaryCsvLabels` (مع Arabic defaults للتوافق)
- `npx tsc --noEmit` نظيف
- `npx vitest run src/test/i18n.test.ts` → 7/7
- `npm run test:run` → 573/573
- `npm run build` ناجح
- فحص잔余 للعربية: لا نص عربي خام في ملفات Batch 2 (باستثناء `عام` في مقارنات تصنيفات المصروفات، `CANCELLED`، `AR_MONTHS`، `؛`، و`DEFAULT_CSV_LABELS`)

**الملفات المعدّلة:**
OWNER_I18N_REVIEW_REPORT.md, docs/OWNER_I18N_REVIEW_REPORT.md
frontend/src/i18n/locales/{ar,en}/owner.json
frontend/src/pages/owner/{FinancialReports,FinancialRules,OperationalReports,DailySummaryReport}.tsx
frontend/src/features/financial-reports/{constants.ts,utils.ts}
frontend/src/features/financial-reports/components/{FilterBar,AnomalyAlerts,CashflowTab,DrilldownPanel,KpiRow,MonthlyTargetProgress,ForecastTab,FinancialChartBits}.tsx
frontend/src/features/financial-reports/hooks/useFinancialReports.ts
frontend/src/features/financial-rules/hooks/useFinancialRules.ts
frontend/src/features/operational-reports/hooks/useOperationalReports.ts
frontend/src/features/daily-summary/{constants.ts,utils.ts,index.ts}
frontend/src/components/AIInsights.tsx
frontend/src/lib/money/financialAnalytics.ts

**ملاحظة:** لا يوجد commit/push — كل التغييرات local على فرع `security/postgres-hardening`.
---

## 11) Batch 3 - مكتمل بالكامل (HRManagement, EmployeeArchive, CustomerArchive, InvoiceAdjustmentRequests)

**الصفحات المعرّبة:**
- `pages/owner/HRManagement.tsx` - `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("hr.*")`، `STATUS_BADGE` -> `getStatusBadge(t)`
- `pages/owner/EmployeeArchive.tsx` - `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("empArch.*")`، `STATUS_BADGE` -> `getStatusBadge(t)`
- `pages/owner/CustomerArchive.tsx` - `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("custArch.*")`
- `pages/owner/InvoiceAdjustmentRequests.tsx` - `useTranslation("owner")` + `getIntlLocale`، constants -> functions with `t`، جميع النصوص عبر `t("invAdj.*")`

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` -> 7/7 ناجح
- `npm run test:run` -> 573/573 ناجح (matching baseline)
- `npm run build` ناجح
- فحص残余 للعربية: لا نصوص عربية خام (باستثناء comments)

**الملفات المعدّلة (Batch 3):**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (+193 new keys: hr 61, empArch 18, custArch 60, invAdj 54)
- `frontend/src/pages/owner/{HRManagement,EmployeeArchive,CustomerArchive,InvoiceAdjustmentRequests}.tsx`

**ملاحظة:** لا يوجد commit/push - كل التغييرات local على فرع `security/postgres-hardening`.

---

## 12) Batch 4 - مكتمل بالكامل (Expenses, Cashbox, ExpensesArchive, Inventory, ProductBundles)

**الصفحات المعرّبة:**
- `pages/owner/Expenses.tsx` - `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("expenses.*")` (37 key)
- `pages/owner/Cashbox.tsx` - جميع النصوص عبر `t("cashbox.*")`؛ `PERIODS`/`SYSTEM_LINKS` أصبحت key-based؛ helpers `typeLabel`/`methodLabel`/`roleLabel` داخلية المكوّن؛ `buildCashboxCsv` أُبقي AR كما هو (مساعد CSV مشترك) مع تسمية ملف محايدة `cashbox-YYYY-MM-DD.csv` (131 key)
- `pages/owner/ExpensesArchive.tsx` - جميع النصوص عبر `t("expensesArch.*")`؛ قيم التصنيف العربية مخزنة في DB فأُبقيت كـ data (`CATEGORY_VALUES`) مع عرض عبر `finFeat.cat.*`؛ `toLocaleDateString("ar-EG")` ← `locale` (75 key)
- `pages/cashier/Inventory.tsx` - جميع النصوص عبر `t("inventory.*")`؛ prop `locale` لـ Pagination أصبح `locale={lang}` (37 key)
- `pages/cashier/ProductBundles.tsx` - جميع النصوص عبر `t("productBundles.*")` (94 key)

**الملاحظة المعمارية:** مفاتيح `finFeat.cat.*` أُعيد استخدامها لترجمة التصنيفات في أرشيف المصروفات بدل تكرارها.

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` -> 7/7 ناجح
- `npm run test:run` -> 573/573 ناجح (matching baseline)
- `npm run build` ناجح
- فحص残余 للعربية: لا نصوص عربية خام (باستثناء قيم التصنيف DB في سطر `CATEGORY_VALUES`)

**الملفات المعدّلة (Batch 4):**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (expenses 37، cashbox 131، expensesArch 75، inventory 37، productBundles 94)
- `frontend/src/pages/owner/{Expenses,ExpensesArchive,Cashbox}.tsx`, `frontend/src/pages/cashier/{Inventory,ProductBundles}.tsx`

**ملاحظة:** لا يوجد commit/push - كل التغييرات local على فرع `security/postgres-hardening`.

---

## 13) Batch 5 - مكتمل بالكامل (Payroll, PayrollArchive, LoyaltySettingsPanel + payroll feature components)

**الملفات المعرّبة:**
- `pages/owner/Payroll.tsx` - جميع النصوص عبر `t("payroll.*")`؛ `useTranslation("owner")` + `getIntlLocale`؛ `MONTHS` لم يعد يُستورد من الـ hook (171 key)
- `pages/owner/PayrollArchive.tsx` - جميع النصوص عبر `t("payrollArch.*")`؛ MONTHS المحلية استُبدلت بـ `MONTH_VALUES` + `monthLabel(t)`؛ `paymentLabel` ← `methodLabel(t)`؛ StatusBadge أصبح يستخدم `useTranslation` (71 key)
- `pages/owner/LoyaltySettingsPanel.tsx` - جميع النصوص عبر `t("loyalty.*")` (23 key)
- `features/payroll/hooks/usePayroll.ts` - أُزيل تصدير `MONTHS` العربي؛ كل toast/messages عبر `t("payroll.*")`؛ `pieData` و `systemLinks` و `prevLabel` تعتمد على `i18n.language`
- `features/payroll/index.ts` - إزالة `MONTHS` من re-exports
- `features/payroll/components/{PeriodChartPanel,PayrollTable,PayrollModals,StaffSnapshot}.tsx` - جميع النصوص عبر `t("payroll.*")`؛ StatusBadge مكرر داخل الملفين يستخدم `useTranslation`

**القرارات:**
- أسماء الشهور أُضيفت كمفاتيح `payroll.months.m1..m12` (المصدر كان constants عربية مكررة 3 مرات: Hook + Payroll + PayrollArchive)
- `usePayroll` أصبح يستخدم `useTranslation("owner")` مباشرة (hooks تسمح بـ hooks)
- مكونات `StatusBadge` المكررة تُركت كما هي (هيكل مكرر مسبقاً) لكنها مترجمة الآن

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` -> 7/7 ناجح
- `npm run test:run` -> 573/573 ناجح (matching baseline)
- `npm run build` ناجح
- فحص Arabic residual: 0 سطور في كل ملفات Batch 5 (8 ملفات)

**الملفات المعدّلة (Batch 5):**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (payroll 171، payrollArch 71، loyalty 23)
- `frontend/src/pages/owner/{Payroll,PayrollArchive,LoyaltySettingsPanel}.tsx`
- `frontend/src/features/payroll/{hooks/usePayroll.ts, index.ts, components/PeriodChartPanel.tsx, components/PayrollTable.tsx, components/PayrollModals.tsx, components/StaffSnapshot.tsx}`

**ملاحظة:** لا يوجد commit/push - كل التغييرات local على فرع `security/postgres-hardening`.

---

## 14) Batch 6 - مكتمل بالكامل (10 صفحات + 3 ملفات feature)

**الصفحات المعرّبة:**
- `pages/owner/Settings.tsx` - جميع النصوص عبر `t("settings.*")`؛ hook مزدوج: `t` الأصلي يبقى `pos` للضريبة/الخصم، والجديد `ot` للـ owner؛ SETTINGS_TABS أصبحت key-based (109 key)
- `pages/owner/BusinessSettingsPage.tsx` - جميع النصوص عبر `t("businessSettings.*")`؛ MAIN_TABS key-based؛ PublicLinkCard يستخدم `useTranslation` داخلياً (33 key)
- `pages/owner/WorkingHoursPanel.tsx` - جميع النصوص عبر `t("workingHours.*")`؛ helpers محلية `dayName/dayShort/fmtDur/errLabel/presetLabel` بدل `DAYS_AR/DAYS_SHORT_AR/formatDuration/PRESETS` من lib؛ `todayStatusLabel` من lib استُبدل بحساب محلي؛ WeekTimeline يعيد بناء labels من t (93 key)
- `pages/owner/WebsiteSettingsPanel.tsx` - جميع النصوص عبر `t("website.*")`؛ SITE_PALETTES labels/notes أصبحت مفاتيح؛ arrays الحقول أصبحت key-based (140 key)
- `pages/owner/UsersPanel.tsx` (13) • `SecurityAccess.tsx` (22) • `PermissionsManagement.tsx` (5) • `SmartAlerts.tsx` (31) • `EmployeeReports.tsx` (66) • `manager/AttendanceManagement.tsx` (36)
- `features/reports/{constants.ts,utils.ts}` - SYSTEM_LINKS/PRESET_OPTIONS أصبحت key-based (empReports.quick*/preset*)
- `features/website-settings/hooks/useWebsiteSettings.ts` - SUB_TABS key-based + كل toasts عبر t (website.*)

**القرارات:**
- `lib/domain/workingHours.ts` تُرك كما هو (مستخدم من schedule feature خارج نطاق Batch 6)؛ التوطين يتم في الـ panel عبر helpers محلية. أسطر mapping لرسائل validateDay العربية تُركت مقصودة في errLabel (مطابقة لسلاسل الـ lib).
- CSV headers في EmployeeReports تُترجم (أعمدة ملف تصدير) عبر csv* keys.
- `workingHours.timelineNote` أُعيدت صياغتها لاحتواء "badges" اللاتينية (إعادة صياغة لتجنب run لاتيني 3+).
- `empReports.rangeLabel` أُعيدت تسمية param من `count` إلى `total` (count محجوز في i18next للجمع).
- ملفات الاختبار الثلاثة (settingsGuards, workingHoursPanel, smartAlertsDrivenByApi) أُضيف لها `import "@/i18n"` — كانت تستخدم hardcoded Arabic في assertions وتفشل بعد التوطين لأن i18next لم يكن مُهيأ في jsdom.

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` -> 7/7 ناجح
- `npm run test:run` -> 573/573 ناجح (matching baseline؛ 48 من ملفات Settings/SmartAlerts/WorkingHours تأكدت منفردة أولاً)
- `npm run build` ناجح
- فحص Arabic residual: 0 سطور في كل 13 ملف Batch 6 (باستثناء 4 أسطر mapping مقصودة في errLabel)

**الملفات المعدّلة (Batch 6):**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (settings 109، businessSettings 33، workingHours 93، website 140، usersPanel 13، security 22، permissions 5، smartAlerts 31، empReports 66، attendance 36)
- 10 صفحات + `features/reports/{constants,utils}.ts` + `features/website-settings/hooks/useWebsiteSettings.ts` + 3 ملفات اختبار (import إضافي فقط)

**ملاحظة:** لا يوجد commit/push - كل التغييرات local على فرع `security/postgres-hardening`.

**متبقي (feature components فقط — كل الصفحات.Owner اكتملت):**
- مكونات feature: attendance, expenses, HR, inventory, security, schedule, cashbox (CashboxTable/CashboxCharts/cashboxHelpers), loyalty (TierRow/PreviewCard), users, permissions, website-settings (remaining), reports (Podium/SalesChart), owner-alerts

---

## 15) دمج صفحات "طلبات التعديل" و"مركز الموافقات" في `ApprovalsPage` الموحدة

**الصفحات المتأثرة:**
- `pages/owner/ApprovalsPage.tsx` (جديدة، ~470 سطر) — صفحة موحدة بثلاثة تبويبات: "تعديلات الفواتير" (`invAdj`)، "المصروفات" (`expensesArch`)، "الرواتب" (`payrollArch`). تدعم `useTranslation("owner")` + `getIntlLocale`، جميع النصوص عبر `t("approvals.*")` (72 key)
- `pages/owner/InvoiceAdjustmentRequests.tsx` — حُذفت (تم دمجها في ApprovalsPage)
- `pages/manager/ApprovalCenter.tsx` — حُذفت (تم دمجها في ApprovalsPage)
- `pages/cashier/Invoices.tsx` — رابط "طلبات التعديل" يشير الآن إلى `/approvals`
- `pages/manager/ManagerDashboard.tsx` — كان يشير أصلاً إلى `/approvals` (لا تغيير)

**التغييرات في المسارات (`route-registry.tsx`):**
- `/approvals` → يشير الآن إلى `ApprovalsPage` (بدلاً من `ApprovalCenter`)
- `/owner/adjustment-requests` → أصبح `redirectTo: "/approvals"` (يحافظ على الروابط القديمة والكتيبات)
- أُزيلت import `ApprovalCenter` غير المستخدمة وأُضيفت `ApprovalsPage`

**التغييرات في الصلاحيات (`features/users/constants.ts`):**
- ACCOUNTANT acquired `/approvals` (display-only؛ الأزرار تُخفي في الواجهة حسب الدور عبر `useTranslation`/الحالة)
- MANAGER يحتفظ بـ `/owner/adjustment-requests` و `/approvals` (عبر التوجيه)

**قرارات معمارية:**
- نظام `discount-approvals` في الباكند أُُزيل نهائياً (`endpoints/discount_approvals.py`، `models/discount_approval_request.py`، `schemas/discount_approval.py`، وإزالة الاستيراد من `db/base.py`). الجدول كان فارغاً على قاعدة التطوير (0 صفوف) فلم يتطلب ترحيل بيانات. تعديلات الخصم تُدار الآن عبر `invoice-adjustment-requests` (`request_type: "discount"`).
- `endpoints/expenses.py`: `approve`/`reject` 이제는 تتطلب `require_owner_or_admin` (المحاسب عرض فقط).
- `endpoints/payroll.py`: `cancel` أصبح يُحدّث `status = "cancelled"` بدلاً من الحذف الصلب، ويتطلب `require_owner_or_admin`.
- `endpoints/owner_alerts.py`: وجهة تنبيهات الخصم تغيرت من `/discount-approvals` إلى `/approvals`.
- `frontend/src/services/invoiceService.ts`: أُزيلت دالة `createDiscountRequest` غير المستخدمة.

**التحقق:**
- `npx tsc --noEmit` نظيف (0 أخطاء)
- `npx vitest run src/test/i18n.test.ts` -> 7/7 ناجح
- `npm run test:run` -> 573/573 ناجح (matching baseline؛ بما في ذلك `settingsGuards` و `workingHoursPanel` و `smartAlertsDrivenByApi` بعد تحديث وجهات التنبيهات)
- `npm run build` ناجح
- فحص Arabic residual: 0 سطور في `ApprovalsPage.tsx`

**الملفات المعدّلة (Batch 6 إلحقاق):**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (+69 key قسم `approvals`، حذف قسم `invAdj` 54 key)
- `frontend/src/pages/owner/ApprovalsPage.tsx` (جديدة)
- `frontend/src/pages/cashier/Invoices.tsx`، `frontend/src/features/users/constants.ts`
- `frontend/src/test/{smartAlertsDrivenByApi,needsAttention}.test.tsx` (تحديث وجهات التنبيهات)
- `frontend/src/app/route-registry.tsx`
- `backend/app/api/v1/endpoints/{expenses,payroll,owner_alerts}.py`، `backend/app/api/deps.py`، `backend/app/db/base.py`
- حُذفت: `backend/app/api/v1/endpoints/discount_approvals.py`، `backend/app/models/discount_approval_request.py`، `backend/app/schemas/discount_approval.py`، `frontend/src/pages/owner/InvoiceAdjustmentRequests.tsx`، `frontend/src/pages/manager/ApprovalCenter.tsx`

**ملاحظة:** لا يوجد commit/push - كل التغييرات local على فرع `security/postgres-hardening`.

**المتبقي (مكونات feature فقط):**
- attendance, expenses, HR, inventory, security, schedule, cashbox (CashboxTable/CashboxCharts/cashboxHelpers), loyalty (TierRow/PreviewCard), users, permissions, website-settings (remaining), reports (Podium/SalesChart), owner-alerts

---

## 16) ترجمة مكونات HR الفرعية (Feature Components) — مكتمل

**النطاق:** جميع مكونات `features/hr/components/` المترجمة بالكامل عبر `useTranslation("owner")` مع مفاتيح `t("hr.*")`.

**الملفات المعرّبة (13 مكون):**
| المكون | الملف | مفاتيح الترجمة |
|----------|-------|----------------|
| PersonalTab | `components/form/PersonalTab.tsx` | 18 |
| WorkTab | `components/form/WorkTab.tsx` | 21 (بما في ذلك SelectItems للحالة) |
| FinancialTab | `components/form/FinancialTab.tsx` | 17 (بما في ذلك SelectItems لطريقة الصرف) |
| DocumentsTab | `components/form/DocumentsTab.tsx` | 15 (toast، prompts، labels) |
| ReviewTab | `components/form/ReviewTab.tsx` | 44 (مراجعة شاملة، دوال `contractEndSummary` و `formatReviewDate` محدثة) |
| SystemTab | `components/form/SystemTab.tsx` | 8 |
| AssistantTab | `components/form/AssistantTab.tsx` | 5 |
| SkillsTab | `components/form/SkillsTab.tsx` | 3 |
| EmployeeCardGrid | `components/EmployeeCardGrid.tsx` | 22 |
| EmployeeTable | `components/EmployeeTable.tsx` | 19 |
| HrStatsGrid | `components/HrStatsGrid.tsx` | 4 |
| HrToolbar | `components/HrToolbar.tsx` | 4 |
| ExpiringDocsAlert | `components/ExpiringDocsAlert.tsx` | 2 |

**مفاتيح الترجمة الجديدة:** 190 مفتاح `hr.*` في `ar/owner.json` و `en/owner.json` (متطابقة، لا placeholder mismatch، لا تسرب EN في AR).

**القرارات التقنية:**
- تواريخ التنسيق: `toLocaleDateString(locale)` مع `getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar")`
- دوال الوحدة (`formatReviewDate`، `contractEndSummary`) في `ReviewTab.tsx` تقبل `locale` و `t` كمعاملات
- `employmentTypeLabel` في `ReviewTab.tsx` تقبل `t` لترجمة label نوع العقد
- مكونات `utils/*.ts` و `hooks/*.ts`: رسائل التحقق الداخلية **مترجمة للعربية** (الاختبارات تتوقعها بالعربية — 263 assertion)، تغييرها لكسر الاختبارات غير مبرر في هذه المرحلة

**الاختبارات المحدثة:**
- `reviewTabAccept.test.tsx` — regex patterns محدثة (`/Approve New Employee/`، `/Approve Changes/`، `/Processing/`)
- `employeeBookingVisibility.test.tsx` — text expectations بالعربية (`الظهور في الحجز الأونلاين`، `/مقدّمي الخدمة فقط/`)
- `employeeVacationState.test.tsx` — title regex للعربية (`/أرشفة الموظف \(ترك العمل\)/`)

**التحقق:**
- `npx tsc --noEmit` ✅ clean (0 أخطاء)
- `npx vitest run` ✅ 573/573 passed
- `npm run build` ✅ success
- `npx vitest run src/test/i18n.test.ts` ✅ 7/7 passed
- Arabic residue في UI components: 0

**الملفات المعدّلة:**
- `frontend/src/i18n/locales/{ar,en}/owner.json` (+190 hr keys)
- `frontend/src/pages/manager/HRManagement.tsx` (مُحدثة ومُدارة من `pages/owner/`)
- 13 مكون في `features/hr/components/`
- `frontend/src/test/{reviewTabAccept,employeeBookingVisibility,employeeVacationState}.test.tsx`
- `frontend/src/app/route-registry.tsx` (route `/manager/hr`)

**ملاحظة:** لا يوجد commit/push — كل التغييرات local على فرع `security/postgres-hardening`.
