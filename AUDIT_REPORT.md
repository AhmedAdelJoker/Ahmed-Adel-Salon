# 🔍 Salon Management Pro — Phase 0 Audit Report (تقرير الفحص الشامل قبل التنفيذ)

> **المسار**: `C:\Users\Ahmed\Downloads\Salon-Management-Pro\`
> **التاريخ**: 2026-09-17 | **المدقق**: Senior Full-Stack + UI/UX + Security + DB + DevOps
> **الحالة**: ⏸️ مرحلة 0 فقط — لا كود جديد — بانتظار كلمة **"ابدأ التنفيذ"**
> **منهجية**: فحص مباشر للملفات + `rg` counts + قراءة `router.tsx` و `main.py` و `config.py` و `session.py` — كل ادعاء أدناه موثق بـ `file:line`.

> ⚠️ **ملاحظة حالة الشجرة (مهم)**: يوجد حالياً **~125 تعديل غير مُ commit** (عمل Phase-1/Phase-3 جارٍ) + ملفات `AUDIT_REPORT.md` و `PHASE1_REPORT.md` و `PHASE3_REPORT.md` غير متتبعة (`??`). هذا التقرير يصف **حالة الـ working tree الحالية** (وليس آخر commit)، ويُميّز بوضوح بين "مُصلح في الـ WIP" و"متبقٍّ".

---

## 0️⃣ البوابات الذهبية: البورتات والبيئة (تحقق فوري)

| القاعدة | الملف:سطر | الحالة | التفاصيل |
|---|---|---|---|
| Frontend حصرياً `5173` | `frontend/vite.config.ts:89-90` | ✅ سليم | `port: 5173`, `strictPort: true` (مُصلح في الـ WIP — كان `false`) |
| Proxy إلى Backend | `frontend/vite.config.ts:92-98` | ✅ سليم | `/api → http://localhost:8000`, `changeOrigin: true` |
| Backend على `8000` | `backend/app/main.py` + `electron-main.cjs:35` + `docker-compose.yml:9` | ✅ سليم | `8000:8000` في compose، و Electron يشغّل `uvicorn --port 8000` |
| ممنوع بورت `3000` في Vite/Electron | `vite.config.ts` + `electron-main.cjs:121` | ✅ سليم | لا ذكر لـ `3000`؛ Electron يحمّل `http://localhost:5173` |
| ⚠️ بقايا `3000` في CORS | `backend/app/main.py:171-172` | 🔴 **مخالفة متبقية** | `origins` تتضمن `http://localhost:3000` و `http://127.0.0.1:3000` هاردكود — يجب حذف السطرين (الإعداد الافتراضي في `config.py:18-21` نظيف ويذكر `5173` فقط) |
| Electron SPA | `frontend/electron-main.cjs:1-168` | ⚠️ يعمل مع ملاحظات | `loadURL(5173)` في dev ✅، `loadFile(dist)` في prod ✅، لكن `webSecurity: false` سطر 88 + `openDevTools()` مفتوح في الإنتاج (سطر 119) — يجب إصلاحهما قبل التوزيع |

**الخلاصة**: البوابة الوحيدة المتبقية هي سطرا CORS لـ `:3000` في `main.py` — حذف سطرين فقط.

---

## 📊 الملخص التنفيذي (Snapshot)

| البُعد | القيمة المقاسة | الهدف | الفجوة |
|---|---|---|---|
| **صفحات Frontend** | 93 ملف `pages` (~32K سطر) + 257 ملف `features` (30 domain) | توحيد وتنحيف | ازدواجية `EmptyState/MetricCard/ReportsCharts` + ملفات بلا route |
| **Backend Endpoints** | 55 وحدة endpoints (أكبرها `exports.py` 1538 سطر) | 50 منظمة | `stubs.py` ميت + ازدواج `barber/barbers` + typing bug |
| **Models/جداول** | 52 ملف، ~51 جدول | ~47 بعد دمج legacy | عائلة `barber*` القديمة ما زالت **حية** (10 مستوردين) |
| **Schemas** | 50 ملف | ~46 | 4 ملفات `legacy_*` ميتة مؤكدة (0 مستورد) |
| **Services** | 31 ملف | ~21 | ~10 ميتة مؤكدة (أدناه بالأدلة) |
| **الأمان OWASP** | ~8/10 في الـ WIP (كان ~5.5) | 9/10 | بقايا: CORS 3000، revocation، lockout in-memory، drift في حدود الرفع |
| **Design System** | ~7.5/10 (tokens موجودة + تحسينات WIP) | 9/10 | i18n فعلي ~0% في الصفحات، `dir=rtl` ثابت، بطاقات/هياكل مكررة |
| **الأداء (مليون صف)** | ~5/10 | 8/10 | N+1 موثقة + indexes ناقصة + pagination غير موحد |
| **Dead code مؤكد بالـ grep** | ~20 ملف/وحدة | 0 | جداول الأدلة في §7 |
| **i18n** | `ar/en/common.json` فقط مفعّلة | ar/en كاملة | 9 locales ميتة + 14 ملف namespace غير مستوردة + 0% استخدام في `pages` |

**الخلاصة العامة**: المشروع قوي وظيفياً، والـ WIP الحالي أصلح أخطر 3 ثغرات (JWT الطويل، TrustedHost، CSP). المتبقي **تنظيف منضبط + توحيد UI + إصلاح pagination/indexes + حذف CORS:3000** — لا يوجد انهيار وظيفي.

---

## 1️⃣ جدول الصفحات (Page-by-Page Audit)

### 1.1 الجرد الفعلي

- `frontend/src/pages/`: **93 ملف `*.ts(x)`** بإجمالي **~32,198 سطر**.
- `frontend/src/features/`: **257 ملف في 30 مجلد** (أكبرها `customers:25`، `hr:21`، `bookings:17`، `reception:16`، `catalog:14`، `inventory:14`).
- الراوتر: `frontend/src/app/router.tsx:1-661` — كل الصفحات `lazy` (سطور 105-199) + حراسة أدوار `RequireAuth:232-260` + `MainLayout:293-392`.

### 1.2 الجدول التفصيلي (مجمّع حسب الدور)

| # | المسار | الملف | الحجم | الدور | الحالة | أبرز ملاحظة |
|---|---|---|---|---|---|---|
| 1 | `/login` | `common/Login.tsx:265` | متوسط | public | ⚠️ متوسط | تحقق لحظي محدود، عربي هاردكود |
| 2 | `/` (قديم) | `common/Dashboard.tsx:595` | كبير | legacy | 🔴 **بلا route** | ملف يتيم — لا `<Route>` له (استُبدل بلوحات الأدوار) |
| 3 | (قديم) | `common/Users.tsx:491` | كبير | legacy | 🔴 **بلا route** | يتيم — الحل الحالي `features/users` + `owner/UsersPanel` |
| 4 | `/settings` | `common/Settings.tsx:594` | كبير | أي دور | ⚠️ أساسي | يتداخل اسمياً مع `owner/Settings.tsx:798` |
| 5 | `/activity-logs` | `common/ActivityLogs.tsx:575` | كبير | MGMT+CASH+ACC | ✅ متوسط | مربوط بـ `features` نشط |
| 6 | `/owner` | `owner/ReportsDashboard.tsx:148` | صغير (مُنحّف) | OWNER | ✅ جيد | مُستخرج إلى `features/reports-dashboard` (كان 692) |
| 7 | `/owner/hr` | `owner/HRManagement.tsx:612` | كبير | OWNER/MGR | ✅ محسّن | كان 2355 → مُستخرج إلى `features/hr` |
| 8 | `/owner/financial` | `owner/FinancialReports.tsx:1299` | **الأكبر** | FIN | ⚠️ ضخم | 1299 سطر — مرشح التقسيم التالي |
| 9 | `/owner/reports` | `owner/OperationalReports.tsx:883` | ضخم | FIN_MGMT | ⚠️ ضخم | يستخدم `features/operational-reports` (سطر 2 ملفات فقط — نحيف) |
| 10 | `/owner/financial-rules` | `owner/FinancialRules.tsx:843` | ضخم | OWNER | ⚠️ ضخم | `features/financial-rules` من ملفين فقط |
| 11 | `/owner/payroll` | `owner/Payroll.tsx:326` | متوسط | FIN_MGMT | ✅ محسّن | مُستخرج (كان 649) |
| 12 | `/owner/daily-summary` | `owner/DailySummaryReport.tsx:369` | متوسط | FIN | ✅ متوسط | `features/daily-summary` (4 ملفات، جديد untracked) |
| 13 | `/owner/services` | `owner/ServicesManagement.tsx:178` | صغير | OWNER | ✅ جيد | يستهلك `features/catalog` ✅ **حي** |
| 14 | `/owner/settings` | `owner/Settings.tsx:798` | ضخم | OWNER/MGR | ⚠️ معقد | تبويبات `?tab=` (users/hours/preferences) — يبتلع 3 صفحات بلا route |
| 15 | `/owner/security-access` | `owner/SecurityAccess.tsx:241` | متوسط | MGMT | ✅ محسّن | مُستخرج (كان 576) إلى `features/security` (9 ملفات) |
| 16 | `/owner/business-settings` | `owner/BusinessSettingsPage.tsx:457` | كبير | OWNER | ✅ جيد | |
| 17 | `/owner/website-settings` | `owner/OwnerWebsiteSettingsPage.tsx:44` | صغير | OWNER | ✅ جيد | ملف **untracked جديد** — يلتف حول `features/website-settings` |
| 18 | (بلا route) | `owner/WebsiteSettingsPanel.tsx:660` | كبير | — | 🔴 **بلا route** | يُعرض عبر `?tab=` فقط |
| 19 | (بلا route) | `owner/UsersPanel.tsx:164` | صغير | — | 🔴 **بلا route** | يُعرض عبر `settings?tab=users` فقط |
| 20 | (بلا route) | `owner/WorkingHoursPanel.tsx:653` | كبير | — | 🔴 **بلا route** | يُعرض عبر `settings?tab=hours` فقط |
| 21 | `/owner/cashbox` | `owner/Cashbox.tsx:593` | كبير | OWNER+CASH+ACC | ✅ متوسط | `features/cashbox` (7 ملفات) حي |
| 22 | `/owner/permissions` | `owner/PermissionsManagement.tsx:582` | كبير | OWNER | ✅ متوسط | |
| 23 | `/owner/alerts` | `owner/SmartAlerts.tsx:334` | متوسط | OWNER | ✅ متوسط | |
| 24 | `/owner/connected-pages` | `owner/ConnectedPages.tsx:130` | صغير | OWNER | ⚠️ أساسي | |
| 25 | `/owner/adjustment-requests` | `owner/InvoiceAdjustmentRequests.tsx:530` | كبير | FIN_MGMT | ✅ متوسط | |
| 26 | `/owner/customers/archive` | `owner/CustomerArchive.tsx:545` | كبير | FRONT_ACC | ✅ متوسط | |
| 27 | `/manager` | `manager/ManagerDashboard.tsx:342` | متوسط | MGMT | ✅ جيد | |
| 28 | `/attendance` | `manager/AttendanceManagement.tsx:567` | كبير | MGMT | ✅ محسّن | كان 1868 → 567 |
| 29 | `/approvals` | `manager/ApprovalCenter.tsx:558` | كبير | MGMT | ✅ متوسط | |
| 30 | `/cashier` | `cashier/CashierDashboard.tsx:242` | متوسط | FRONT | ✅ محسّن | كان 707 → 254 |
| 31 | `/pos` | `cashier/POS/index.tsx:211` + `POSContext.tsx:666` | كبير | FRONT | ✅ متوسط | 7 مكونات POS نشطة |
| 32 | `/reception-board` | `cashier/ReceptionBoard.tsx:318` | متوسط | OPS | ✅ محسّن | كان 734 → 353؛ يستهلك `features/reception` ✅ **حي** (تصحيح لتقرير قديم قال إنه ميت) |
| 33 | `/bookings` | `cashier/Bookings.tsx:248` | متوسط | OPS | ✅ محسّن | كان 2418 → 248 (أنحف صفحة بعد الاستخراج) |
| 34 | `/customers` | `cashier/Customers.tsx:191` | صغير | FRONT | ✅ محسّن | `features/customers` (25 ملف) حي |
| 35 | `/customers/:id` | `cashier/CustomerDetail.tsx:350` | متوسط | FRONT_ACC | ✅ متوسط | |
| 36 | `/invoices` | `cashier/Invoices.tsx:268` | متوسط | FRONT | ✅ متوسط | |
| 37 | `/inventory` | `cashier/Inventory.tsx:535` | كبير | FRONT_ACC | ✅ متوسط | `features/inventory` (14 ملف) حي |
| 38 | `/expenses` | `cashier/Expenses.tsx:9` | stub | FRONT_ACC | 🔴 **stub** | 9 أسطر فقط (re-export) — يقابله `owner/Expenses.tsx:308` لنفس المسار المنطقي |
| 39 | `/schedule` | `cashier/Schedule.tsx:206` | متوسط | OPS | ✅ محسّن | كان 727 → 206؛ `schedule/` (11 ملف: DayBoard 418، Toolbar 330...) |
| 40 | `/barber/*` (7) | `barber/Barber*.tsx` (108-592) | متنوع | BARBER | ✅ متوسط | `BarberWorkStation:282` يستهلك `features/barber-workstation` ✅ **حي** (تصحيح لتقرير قديم) |
| 41 | `/accountant` | `accountant/AccountantDashboard.tsx:336` | متوسط | ACC | ✅ متوسط | |

### 1.3 مشاكل UI/UX المجمّعة (مع الدليل)

| الفئة | الدليل | الأولوية |
|---|---|---|
| صفحات يتيمة بلا route | `common/Dashboard.tsx`، `common/Users.tsx`، `owner/{UsersPanel,WebsiteSettingsPanel,WorkingHoursPanel}` — لا `<Route path>` لها في `router.tsx` | 🟡 (حذف/دمج آمن بعد تأكيد) |
| ازدواج `EmptyState` | `shared/EmptyState.tsx:1-49` (بسيط، بلا role) مقابل `ui/EmptyState.tsx:1-165` (نظام variants + `role=status:144`) — صفر استيراد لكليهما في `src` | 🟡 توحيد على `ui/EmptyState` + الجديد `shared/AsyncState.tsx` |
| بقايا `MetricCard` | `shared/MetricCard.tsx:1-44` ما زال موجوداً بينما `DashboardStatCard.tsx:4-5` يدّعي الدمج؛ `dashboard/MetricCard.tsx` محذوف فعلاً (staged D) | 🟢 حذف ملف واحد |
| `CommandPalette` مزدوج التركيب | `<CommandPalette/>` في `router.tsx:362` **و** `AppShell.tsx:131` معاً (نسخة `ui/` محذوفة — سليم) | 🟡 إبقاء تركيب واحد |
| تصادم اسم `Sidebar` | `layout/Sidebar.tsx:1-637` (قوائم حسب الدور `MENU_GROUPS:49-313`) مقابل `ui/Sidebar.tsx` (shadcn عام) | 🟢 إعادة تسمية الثاني |
| ازدواج تقارير | `shared/ReportsCharts.tsx` مقابل `charts/ReportsCharts.tsx` + مكونات `features/*reports*` | 🟡 |
| `Expenses` مزدوج | `cashier/Expenses.tsx:9` stub مقابل `owner/Expenses.tsx:308` | 🟡 توحيد المسار |
| i18n صفري في الصفحات | `rg useTranslation` في `pages/` = **0 ملف**؛ عربي هاردكود في **81/93 ملف (~87%)**؛ كل عناوين `router.tsx:28-82 PAGE_TITLES` ثابتة | 🔴 لخطة المرحلة 1 |
| `dir=rtl` ثابت | `router.tsx:215,319`، `AppShell.tsx:129`، `Header.tsx:87`، `Sidebar.tsx:465` — لا اشتقاق من `i18n.dir()` | 🟡 |

---

## 2️⃣ تحليل Responsive (320 / 768 / 1024 / 1440)

### 2.1 الحالة الحالية (من الكود الفعلي)

| Breakpoint | Sidebar | Header | الجداول | المودالز |
|---|---|---|---|---|
| **320px** | `MobileNav` سفلي (`MobileNav.tsx:75 fixed inset-x-4 bottom-4 lg:hidden`) ✅ | `flex-wrap` + إخفاء البحث/الساعة (`Header.tsx:86,125,140`) ✅ جزئياً | تمرير أفقي متوقع للجداول 6+ أعمدة ⚠️ | `Dialog` ضيق — يحتاج `max-w-[calc(100vw-2rem)]` ⚠️ |
| **768px** | Sidebar مخفي، درج موبايل (`router.tsx:366 lg:hidden`) ✅ | يضغط المحتوى ⚠️ | `Customers` ضيق ⚠️ | وسط الشاشة ✅ |
| **1024px** | `hidden lg:flex` يظهر (`router.tsx:325`) + عرض `w-20\|w-72` (`Sidebar.tsx:461`) ✅ | مرن ✅ | جيد ✅ | متوسط ✅ |
| **1440px** | كل شيء مرن + `container-page` (max 1440) ✅ | ✅ | ✅ | ✅ |

### 2.2 مشاكل محددة بالدليل

1. **جداول الموبايل**: `pages/cashier/Customers.tsx` (6+ أعمدة) و `CustomerTable.tsx:193` بلا `scroll-x` wrapper موحد — الحل الجديد `.scroll-x` في `index.css` (WIP) لم يُعمم بعد.
2. **شبكات التقارير**: `FinancialReports.tsx:1299` و `OperationalReports.tsx:883` تحتاج فرض `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` (التوصية القديمة ما زالت صالحة).
3. **خطافات مهملة**: `hooks/useMediaQuery.ts:579B` و `hooks/useSwipeGesture.ts` موجودان لكن **صفر استيراد** (`rg import = 0`) — إما الاستخدام أو الأرشفة.
4. **اختبار آلي موجود لكن خارج CI الرئيسي**: `playwright.smoke.config.ts` + `playwright.a11y.config.ts` موجودان، و `ci.yml` لا يشغّلهما (3 jobs فقط: backend-tests، frontend-lint، build).

### 2.3 التوصية (مرحلة 1)

- تعميم `.container-page` + `.section-pad` + `.scroll-x` + `.truncate-{1,2,3}` (مضافة في WIP) على كل الصفحات الكبيرة أولاً (`FinancialReports`، `OperationalReports`، `Customers`، `Schedule`).
- تفعيل `useMediaQuery` أو حذفه؛ إضافة `playwright smoke` على 4 breakpoints إلى CI.

---

## 3️⃣ تحليل Design System

### 3.1 الألوان — Midnight Gold Luxury (سليم، ومُصحح)

`frontend/src/styles/index.css:8-100`: المصدر الحالي **ذهبي شمبين حقيقي** (`--primary: #a68b5c` فاتح / `#d4af37` داكن) — التقرير القديم الذي ذكر `#2402ffb4` **عفا عليه الزمن**. التباين: نص داكن `#1c1917` على `#fdfbf7` (AA ✅)، وذهبي داكن `#8b7345` للنصوص الفاتحة ✅. الحالات (`success/warning/danger/info` + soft) معرفة للوضعين ✅.

### 3.2 Tailwind Config — مكتمل في WIP

`frontend/tailwind.config.js:1-182`: `darkMode: class` ✅، ألوان مربوطة بـ `var(--*)` ✅، `premium: 26px` ✅، ظلال `soft/premium/accent` + `elevation-1..4` ✅، شاشات `xs:480 → 3xl:1920` ✅ (مُضافة)، خطوط `Alexandria + IBM Plex Sans Arabic + Cairo` ✅ (مُضافة)، مقياس طباعي `display-*` + `body-*` ✅، `spacing: section/subsection/gutter/tight/tighter` ✅، `z-index: dropdown→toast` ✅، حركات `fade-in/slide-up/slide-down/shimmer` ✅.

### 3.3 المتبقي (توحيد الاستخدام لا التوكنز)

| البند | الحالة |
|---|---|
| الكروت | 6+ تعريفات (`ui/card`، `shared/Panel`، `PageHero`، `PanelHeader`، `DashboardStatCard`...) — التوكن الجديد `.card-surface`/`.card-glass` (WIP) لم يُعمم |
| الأزرار | `ui/button` (Radix Slot) هو المرجع؛ `TouchButton` محذوف ✅؛ `NavButton` للسايدبار فقط — **سليم** |
| التحميل/الخطأ/الفارغ | `shared/AsyncState.tsx` (جديد untracked: `LoadingState/ErrorState/EmptyState` بـ `role=status/alert` + `aria-live`) **لم يُعتمد بعد**؛ القديم (`SkeletonCard`، `TableEmptyState`، `EmptyState×2`) ما زال هو المستخدم |
| المسافات | خليط `space-y-2/gap-4/mb-6` — التوكنز الجديدة موجودة لكن غير مفروضة |
| a11y | `Header.tsx` مُحسّن (aria-labels + `focus-ring` + `loading=lazy` للأفاتار ✅)؛ **الفجوات**: `MobileNav.tsx:75-104` بلا `aria-label/current`، زر logout في Sidebar بلا label، `CommandPalette` input بـ placeholder فقط |

---

## 4️⃣ تحليل Backend

### 4.1 البنية (أرقام محققة)

- `backend/app/api/v1/endpoints/`: **55 وحدة + `__init__`** (أكبرها `exports.py:1538` سطر، `appointments.py:972`، `invoices.py:804`، `barber.py:672`).
- `backend/app/models/`: **52 ملف (~51 جدول)**. `app/models/__init__.py` فارغ تقريباً (13B).
- `backend/app/schemas/`: **50 ملف** (منها 4 legacy ميتة).
- `backend/app/services/`: **31 ملف** (منها ~10 ميتة — §7).
- `backend/app/crud/`: ملف واحد `core_business.py` (16.7KB، monolith) + سطر `CORSMiddleware` مستورد عبثاً (`:1`).
- التوصيل: `backend/app/api/v1/api.py:1-115` يضم **50 router**؛ `stubs.py` **غير مضمّن** (ميت بلا ضرر).

### 4.2 ازدواج/عيوب مؤكدة

| الموقع | العيب | الدليل |
|---|---|---|
| `barber.py:54-58` | **typing bug**: `_get_barber() -> Employee` تُرجع `int` (`return barber_id`) | يمر وقت التشغيل (المقارنات ضد id) لكن يكسر الفحص الساكن؛ استدعاءات `:373,463,490,526,550,577,606,624,663,710` |
| `barber.py` (28KB، `/barber`) مقابل `barbers.py` (3.3KB، `/barbers`) | راوتران متوازيان + `barber_availability.py:38` + `barber_presence.py:581` | تشتت منطق الحلاق — الدمج في مرحلة 2 |
| `dashboard.py` + `dashboard_core.py:15` | راوتران للوحات | `dashboard_core` **حي** (يُستخدم في `cashbox.py:51,65` و `api.py:56,115`) — **ليس ميتاً** (تصحيح لتقرير قديم) |
| `api/dependencies/` مقابل `api/deps.py` + `api/deps_auth.py` | مجلد يبدو مكرراً | يحتاج فحصاً يدوياً في مرحلة 2 |
| `user_preference.py:94B` | بلا `__tablename__` (stub/re-export) | مراجعة في مرحلة 2 |

### 4.3 عائلة `barber` القديمة — **حية، ليست ميتة** (تصحيح مهم)

الملفات الأربعة (`models/barber.py` + `barber_presence_log/time_off/working_hour`) تحمل ترويسة "Legacy... moved to Employee" لكن `rg` يُظهر **10 مستوردين فعليين**: `db/base.py:5`، `services/{barber,dashboard,invoice,report,reminder}_service`، `endpoints/{barber_availability,customers,sessions,users_roles}`. **لا يجوز حذفها قبل ترحيل هؤلاء العشرة** — خطة مرحلة 2.

### 4.4 الخدمات والـ Schemas

- `activity_service.py` **حية** (11 مستورداً: appointments، attendance، invoices...) — التقرير القديم أخطأ باعتبارها ميتة. التكرار الحقيقي: `activity_service.log_activity` مقابل `activity_log_service` (دالتان متوازيتان — توحيد في مرحلة 2).
- خدمات ميتة مؤكدة (§7): `barber/customer/employee/service/profile/auth/dashboard/invoice/invoice_builder/report/public_site_settings/user_preference` (بدرجات متفاوتة — الجدول يفرّق بين "0 مستورد" و"مستورد مرة واحدة").
- `schemas/legacy_*` الأربعة: **0 استيراد** — حذف آمن في مرحلة 4.

---

## 5️⃣ تحليل قاعدة البيانات

### 5.1 المحرك والجلسة

`backend/app/db/session.py:1-39`: `pool_pre_ping=True` ✅، `WAL + FK=ON` لـ SQLite ✅، `autoflush=False` (يتطلب `flush()` بعد `add()` — موثق في `ARCHITECTURE.md` بعد حادثة مخزون سابقة ⚠️). **لا `pool_size/max_overflow/poolclass`** (افتراضيات SQLAlchemy) — ضبط مطلوب عند الانتقال إلى Postgres.

### 5.2 التوافق مع Postgres — **عائق حقيقي**

`backend/app/db/runtime_schema.py:1-234` يستخدم `PRAGMA table_info` (`:8-13`) و `sqlite_master` (`:21-27`) و `ALTER TABLE ... ADD COLUMN` بلهجة SQLite (`:34-213`) — **سينكسر على Postgres**. `Base.metadata.create_all:31` + `create(checkfirst=True):226` لا تعوّض. التوصية: تجميد `runtime_schema` لمسار SQLite-dev فقط، وجعل Alembic المصدر الوحيد للحقيقة (17 migration موجودة وأسماؤها سليمة بما فيها `unify_barber_to_employee` و composite index للعملاء).

### 5.3 Indexes ناقصة (حرجة لمليون صف)

| الجدول | العمود | الحالة |
|---|---|---|
| `customers` | `phone` ✅، `is_deleted/created_at/visits_count/tier` | 3 ناقصة (عالية: `is_deleted`، `created_at`) |
| `invoices` | `customer_id/barber_id` FK ✅، `created_at/is_draft/status/payment_method` | 4 ناقصة (عالية: `created_at`، `is_draft`) |
| `appointments` | مركب `(barber_id+date)` ✅، `status/customer_id` | `status` ناقص (عالية) |
| `service_sessions` | `status` | ناقص (متوسطة) |
| `expenses/payroll/pos_shifts/activity/audit` | `created_at/category/(employee+period)/status/user_id` | ناقصة (عالية للتواريخ) |

### 5.4 N+1 موثقة (file:line من الفحص)

- `services/reminder_service.py:17-21`: `Appointment.all()` ثم `Customer` + `Barber` **لكل صف** — الأسوأ.
- `endpoints/invoices.py:343-346`: `rows.all()` ثم `Customer.first()` + `Employee.first()` لكل فاتورة؛ `:357` تحميل كل الفواتير ثم تجميع شهور بايثون.
- `endpoints/dashboard.py:43,72,131`: `Invoice.all()` + `Product.all()` ثم حلقات بايثون (`_sum_invoice_total:26-30`، `low_stock:132-138`) — **قنبلة ذاكرة**.
- `endpoints/barber.py:677-698,217-262,312-364`: علاقات `customer/service/items` كسولة داخل comprehensions.
- `endpoints/barber_presence.py:123,370` + `payroll.py:95-109`: حلقة موظفين × استعلامات لكل موظف.
- **نقاط مضيئة**: `joinedload` مستخدم في `barbers.py:34,51`، `employees.py:38,67,95`، `appointments.py:254,286,309`، `exports.py:459-463` — النمط موجود ويُعمم.

### 5.5 Pagination — غير موحد

- **مُرقّم**: `activity_logs` (page/page_size)، `customers`، `employees`، `expenses`، `cashbox`، `attendance`، `audit`.
- **غير مُرقّم (`.all()` كامل)**: `barber.py` كاملاً، `dashboard.py:43,69,72,116-119,131,198,204`، `payroll.py:45`، `pos_shifts.py:275,285`، `users_roles.py:28`، `offers/sessions/waitlist/walk_in_queue/bookings` — **إلزامي قبل اختبار المليون**.

### 5.6 تقدير المليون عميل (نوعي، يحتاج قياس k6/locust في مرحلة 5)

بدون إصلاح: `GET /customers` عشرات الثواني، لوحة المالك 30+ ثانية، إحصاءات الحلاق 5-10 ثوانٍ. بعد (pagination + indexes + eager): أجزاء الثانية. الأرقام الدقيقة تُقاس في مرحلة 5 — لا ندّعي أرقاماً نهائية هنا.

---

## 6️⃣ تحليل الأمان — OWASP Top 10 (محدّث على الـ WIP)

> التقرير القديم (5.5/10) **عفا عليه الزمن** — الـ WIP (ملخصه في `PHASE3_REPORT.md`) أصلح الكثير. أدناه الحالة **الحالية**.

| البند | الحالة الحالية | الدليل |
|---|---|---|
| **A01 تحكم الوصول** | ✅ RBAC مصفوفة (`core/rbac.py:19-49` + هرمية 100→20) + حراس endpoints + `RequireAuth` frontend | متبقٍّ: `barber.py:160-161` fallback `barber_id or employee_id` يحتاج مراجعة تفويض |
| **TrustedHost** | ✅ **مُصلح** (`main.py:159-166` يستخدم `settings.ALLOWED_HOSTS`) | التقرير القديم (`["*"]`) عفا عليه |
| **A02 تشفير/JWT** | ✅ **مُصلح**: access قصير `60m` + refresh `7d` (`config.py:15-16`) + `type` + `jti` + `nbf/iat` (`security.py:40-91`) + رفض type-mismatch | متبقٍّ: **لا revocation/blocklist** (الـ `jti` موجود بلا مخزن) — Redis في مرحلة 3 |
| **كلمات المرور** | ✅ bcrypt (`security.py:10`) + قوة (8 + كبير + صغير + رقم `:22-37`) + رفض `admin123/Admin@123/252525/password` (`config.py:109`) + `SECRET_KEY ≥ 32` ورفض الضعيفة (`:88-104`) | `passlib 1.7.4` مهملة + `bcrypt 4.x` تعارض محتمل — ترحيل لاحق |
| **A03 الحقن** | ✅ ORM فقط؛ `like` مُعامَل (`customers.py:46-54`) لكن بلا escape لـ `%_` | `email-validator` معتمَدة لكن غير مستخدمة في Schemas — تفعيل في مرحلة 3 |
| **A04 تصميم غير آمن** | ✅ حد login (5/60s) + عام (30/60s) + `account_lockout.py` جديد (5/60s/15m) + audit (`core/audit.py` جديد) | متبقٍّ: لا 2FA؛ `booking_public` بلا auth (spam) — captcha/حد أشد في مرحلة 3 |
| **A05 إعدادات** | ✅ **مُصلح**: `HSTS` + `CSP` (قابل للضبط `settings.CSP_POLICY:45-55`) + `COOP/CORP` + `nosniff/DENY/Referrer/Permissions` (`main.py:216-246`) + `no-store` للـ auth | متبقٍّ: **CORS يتضمن `:3000`** (`main.py:171-172`) — حذف سطرين؛ `Cache-Control` يُوسع للحساسة |
| **A06 مكونات ضعيفة** | ⚠️ `jose 3.3.0` مهملة (يُوصى `pyjwt`)؛ `axios 1.6.0` قديمة؛ لا `pip-audit/safety` في CI | ترقية مقيدة في مرحلة 3 |
| **A07 مصادقة** | ✅ lockout + حد + refresh endpoint (`POST /auth/refresh`) | متبقٍّ: لا إبطال عند logout؛ لا قفل دائم بعد N؛ in-memory (أحادي النسخة) |
| **A08 سلامة** | ⚠️ CSV import بـ `except Exception` واسع (`barber_presence.py:288-343`)؛ WebSocket بلا HMAC | تضييق الاستثناءات في مرحلة 2 |
| **A09 تسجيل** | ✅ activity + audit؛ ⚠️ `print()` في schedulers (`main.py:21,40,54,69`) | استبدال بـ `logging` في مرحلة 2 |
| **A10 SSRF** | ✅ Graph API موثوق + PDF محلي + Excel مُتحقق | لا إجراء |
| **رفع الملفات** | ✅ طبقة جديدة `core/upload_security.py` (حجم + MIME sniff + تعقيم + containment) + حدود `10MB` و `pdf,png,jpg,jpeg,webp,xlsx,csv` (`config.py:41-43`) | ⚠️ **drift**: `utils/media.py:16-19` ما زال `20MB` وصوراً فقط وبلا sniff — **التوحيد على `upload_security` في مرحلة 3**؛ تعارض `gif→jpg`؛ مجلدان منفصلان `backend/uploads` (ملفان) مقابل `/uploads` (15 ملف) — **split-brain** يُحسم في مرحلة 2؛ لا منع تنفيذ مباشر |
| **Electron** | ⚠️ `webSecurity: false` (`electron-main.cjs:88`) + DevTools مفتوح إنتاجاً (`:119`) | إصلاح قبل التوزيع |

**درجة تقديرية حالية: ~8/10** (من ~5.5). الطريق إلى 9+: حذف CORS:3000، revocation، توحيد الرفع، ترقيات الحزم، `logging`.

---

## 7️⃣ الأكواد الميتة والملفات المشبوهة (مع دليل `grep`/`rg`)

> القاعدة: **صفر استيراد = مرشح حذف**، ويُنقل إلى `.archive/` أولاً (كما فعل الـ WIP: `.archive/phase1-deadcode/` فيه 7 ملفات).

### 7.1 Backend — ميت مؤكد (0 مستورد)

| الملف | الدليل |
|---|---|
| `app/services/barber_service.py` (792B) | `rg "from app.services.barber_service" backend` → **0** |
| `app/services/customer_service.py` (864B) | → **0** |
| `app/services/employee_service.py` (525B) | exact import → **0** (الـ 4 hits الأخرى `employee_service_link`/`set_employee_services` false positives) |
| `app/services/service_service.py` (856B) | → **0** |
| `app/services/profile_service.py` (506B) | → **0** (`profile.py` endpoint لا يستورده) |
| `app/services/dashboard_service.py` (5.7KB) | `dashboard.py` لا يستورده → **0 فعلي** |
| `app/services/invoice_service.py` (2.6KB) | `generate_invoice_no`/`list_invoices_detailed` بلا مستورد → **0** |
| `app/services/invoice_builder.py` (7.3KB) | `build_*` بلا مستورد → **0** |
| `app/services/report_service.py` (6.5KB) | `reports.py` لا يستورده → **0** |
| `app/services/public_site_settings.py` (9KB) | → **0** |
| `app/services/user_preference_service.py` (857B) | → **0** |
| `app/services/auth_service.py` (2.1KB) | `authenticate_user`/`login_user` بلا مستورد (يستورد هو من `activity_service`) → **0 كمستهلَك** |
| `app/api/v1/endpoints/stubs.py` (3 stub تُرجع `[]`) | غير مضمّن في `api.py` + `rg stubs` → **0** |
| `app/schemas/legacy_compat.py` + `inventory_legacy.py` + `owner_legacy.py` + `manager_legacy.py` | `rg "legacy_compat\|inventory_legacy\|owner_legacy\|manager_legacy" backend/app` → **0** |
| `app/services/productService.js` | **غير موجود أصلاً** في `backend/app/services/` (محذوف staged D، نسخته في `.archive/phase1-deadcode/`) ✅ |

### 7.2 Backend — **حي** (تصحيح لتقارير قديمة — لا تحذف)

| الملف | الدليل على الحياة |
|---|---|
| `app/services/activity_service.py` | **11 مستورداً** (`appointments/attendance/invoices/imports/exports/auth_service...`) |
| `app/services/cleanup_service.py` | مستورد lazy في `appointments.py:502` |
| `app/api/v1/endpoints/dashboard_core.py` | مضمّن `api.py:56,115` + مستخدم `cashbox.py:51,65` (**9 hits**) |
| `models/barber*.py` الأربعة | **10 مستوردين** (`db/base` + 5 services + 4 endpoints) — ترحيل أولاً |
| `features/{reception,catalog,barber-workstation}` | كلها **حية** (`ReceptionBoard:26`، `ServicesManagement:17`، `BarberWorkStation:22`) — الادعاء القديم بموتها **خطأ** |

### 7.3 Frontend — ميت مؤكد

| الملف | الدليل |
|---|---|
| `components/shared/TouchButton.tsx` | `rg TouchButton frontend/src` → **0** (محذوف staged D + مؤرشف ✅) |
| `components/forms/AddClientForm.tsx` | → **0** (D + مؤرشف ✅) |
| `components/ui/HeatmapCell.tsx` | → **0** (D + مؤرشف ✅) |
| `context/DensityContext.tsx` | `DensityProvider` → **0 wrap** (D + مؤرشف ✅) |
| `components/dashboard/MetricCard.tsx` | D + مؤرشف ✅ |
| `components/ui/CommandPalette.tsx` | D + مؤرشف ✅ (النسخة القانونية `layout/` فقط) |
| `hooks/useCustomerHelpers.ts` + `useMediaQuery.ts` + `useSwipeGesture.ts` | تعريف فقط، `rg import` → **0** — أرشفة في مرحلة 4 |
| `components/shared/MetricCard.tsx` | بقايا مكررة (الدمج مُعلن في `DashboardStatCard:4-5` ولم يُحذف) — حذف ملف واحد |
| `i18n/locales/{de,es,fr,it,pt,ru,tr,ur,zh}/common.json` (9 ملفات) | `i18n/index.ts:1-28` يستورد `ar/en` فقط؛ `rg locales/(de\|...)` → **0** |
| `i18n/locales/{ar,en}/{settings,dashboard,reports,customers,bookings,pos,notifications}.json` (14 ملف) | ملفات namespaces غير مستوردة (النظام يستخدم `ns: common` فقط) — دمج/حذف في مرحلة 4 |
| `common/Dashboard.tsx` + `common/Users.tsx` | بلا route — حذف بعد مراجعة مرحلة 4 |

### 7.4 ملفات مشبوهة (تحتاج فحصاً يدوياً قبل الحذف)

- `api/dependencies/` (مجلد) مقابل `api/deps.py` + `api/deps_auth.py` — تكرار محتمل.
- `cashier/Expenses.tsx:9` stub مقابل `owner/Expenses.tsx:308` — توحيد مسار.
- `user_preference.py` (94B بلا جدول)؛ `ServiceDetailsPanel` سليم (حي)؛ `ProductTable` غير موجود أصلاً (لا إجراء).

---

## 8️⃣ الاقتراحات الاحترافية + خطة المراحل + المخاطر

### 8.1 إصلاحات فورية (ساعات — تدخل في أول commits)

| # | الإصلاح | الملف:سطر | الأثر |
|---|---|---|---|
| 1 | حذف سطري CORS لـ `:3000` | `backend/app/main.py:171-172` | إغلاق بوابة مخالفة للقواعد |
| 2 | إصلاح `_get_barber` typing (إرجاع `Employee` أو تسمية `-> int`) | `backend/app/api/v1/endpoints/barber.py:54-58` | سلامة الفحص الساكن |
| 3 | توحيد تركيب `CommandPalette` (إبقاء واحد) | `router.tsx:362` مقابل `AppShell.tsx:131` | منع مستمعين مزدوجين |
| 4 | حذف `shared/MetricCard.tsx` (الدمج معلن) | `components/shared/MetricCard.tsx` | ملف واحد |
| 5 | `Electron`: `webSecurity: true` + إغلاق DevTools إنتاجاً | `electron-main.cjs:88,119` | توزيع آمن |
| 6 | توحيد حدود الرفع على `upload_security` (10MB) | `utils/media.py:16-19` مقابل `core/config.py:41` | إغلاق drift |

### 8.2 خطة المراحل (كل مرحلة = تقرير + Commit منفصل)

| المرحلة | النطاق | المدة | المخاطرة | المخرجات القابلة للتحقق |
|---|---|---|---|---|
| **Phase 1** UI/UX | تعميم tokens (`card-surface/scroll-x/container`) على الصفحات الكبرى؛ توحيد `EmptyState→AsyncState`؛ RTL/LTR عبر `i18n.dir()`؛ إصلاح `MobileNav` a11y؛ أرشفة hooks الميتة | 4-5 أيام | 🟡 | `tsc` + `eslint` نظيف؛ Lighthouse > 90؛ صفر بيانات متداخلة على 4 breakpoints |
| **Phase 2** Backend/DB | pagination موحد لكل list؛ `joinedload` لكل N+1 أعلاه؛ indexes الحرجة migration؛ تجميد `runtime_schema` لـ SQLite + Alembic للبقية؛ توحيد `uploads/` وحسم split-brain؛ دمج `barber/barbers` تدريجياً | 5-6 أيام | 🟡 | `pytest` أخضر؛ زمن استعلامات مُقاس قبل/بعد؛ كل صفحة تضرب API حقيقياً |
| **Phase 3** Security | revocation (Redis-ready blocklist)؛ حذف CORS:3000؛ توحيد الرفع + MIME؛ `logging` بدل `print`؛ ترقية `jose→pyjwt` و `axios`؛ `pip-audit` في CI؛ تشديد `booking_public` | 3-4 أيام | 🔴 | 6/6 اختبارات أمنية + suite موسعة؛ OWASP 9/10 |
| **Phase 4** Dead code | `eslint-unused-imports` + `knip/ts-prune` موثقة؛ أرشفة ثم حذف §7؛ حذف locales/namespaces الميتة؛ توحيد scripts | 1-2 يوم | 🟢 | `rg` صفر لكل بند + commit لكل ملف |
| **Phase 5** E2E/Perf | Playwright على `5173` فقط (Login→Dashboard→Clients→Appointments→Billing)؛ Lighthouse/Bundle/Query-time؛ حمل محاكى (k6/locust)؛ تحقق Electron SPA | 3-4 أيام | 🟡 | تقارير أداء + فيديو/سجل E2E أخضر |

### 8.3 تقدير المخاطر والتخفيف

| المخاطرة | الاحتمال | الأثر | التخفيف |
|---|---|---|---|
| كسر RBAC عند دمج barber/employee | متوسط | عالٍ | ترحيل العشرة المستوردين أولاً + `pytest` RBAC مثبت (cashier→403) |
| حذف ملف "ميت" ظاهرياً وهو مستخدم lazy | منخفض | متوسط | `rg` + فحص `lazy()` في الراوتر قبل كل حذف؛ الأرشفة أولاً (`.archive/`) |
| كسر i18n بعد حذف locales | منخفض | منخفض | اختبار `ar/en` قبل كل commit؛ الحذف للـ 9 + 14 غير المستوردة فقط |
| تغيير JWT يكسر جلسات قائمة | متوسط | عالٍ | دعم مزدوج مؤقت + `refresh` endpoint موجود أصلاً |
| انحدار أداء من `eager` زائد | منخفض | متوسط | قياس قبل/بعد لكل endpoint |
| `SECRET_KEY` الافتراضية في compose | منخفض | عالٍ | `docker-compose.yml:12` تستخدم `change_me_in_production` — الـ validator يرفضها (`config.py:100-103`) لكن يجب تدويرها بيئياً وعدم الاعتماد على الرفض وحده |

---

## 9️⃣ معايير القبول النهائية (تُقاس في مرحلة 5)

- [ ] صفر بيانات متداخلة على 320/768/1024/1440 (Playwright مصوَّر)
- [ ] كل الصفحات على tokens موحدة (`card-surface`، `container-page`، `AsyncState`)
- [ ] كل list endpoint مُرقّم + مُفهرس + بلا N+1 (دليل query-time)
- [ ] OWASP: لا CORS:3000، لا `webSecurity:false`، revocation يعمل، رفع مُوحّد
- [ ] `rg` صفر لكل بند §7 + `knip/ts-prune` نظيف
- [ ] E2E كامل أخضر على `http://localhost:5173` + Electron يعمل

---

## ✅ الإقرار وبانتظار الأمر

هذا التقرير هو **المرحلة 0 كاملة**: فحص صفحة-صفحة، responsive، design system، backend، DB، أمان OWASP، dead code بالأدلة، خطة المراحل والمخاطر — **ولم يُكتب أي كود منتج** (هذا الملف هو المُسلَّمة الوحيدة).

**التالي**: أجب بكلمة **"ابدأ التنفيذ"** (مع رقم المرحلة إن أردت غير 1) لأبدأ **المرحلة 1 — الواجهة الأمامية UI/UX وتوحيد المشروع** على دفعات منفصلة، كل دفعة تنتهي بتقرير + Commit مستقل، مع الحفاظ على `5173` حصراً والترابط `Frontend ↔ Backend ↔ DB`.
