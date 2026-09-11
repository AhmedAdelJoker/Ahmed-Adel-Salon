# 📋 تقرير فحص هيكل الـ Frontend + خطة التطوير

> **الحالة:** Phase 0 مكتملة ✅ — `tsc` صفر أخطاء، `build` ناجح، `tests` 16/16
> **آخر تحديث:** بعد تنفيذ Phase 0

---

## 1️⃣ التشخيص — 8 مشاكل رئيسية (قبل الإصلاح)

| # | المشكلة | الدليل |
|---|---------|--------|
| 1 | **15 ملف وحش (God files)** — صفحات 1000~2700 سطر | `Bookings.tsx` (2703)، `HRManagement` (2443)، `POS_Legacy` (2107)، `AttendanceManagement` (1931)... أي تعديل = ريسك، والـ review مستحيل |
| 2 | **كود ميت بحجم كبير** | `POS_Legacy.tsx` (2107 سطر، الراوتر بيستخدم `POS/index` الجديد)، `lib/api.ts` (صفر مستخدمين — الحي `services/api.ts`)، `barbersService` (مستخدم واحد — الحي `barberService`)، `expensesService` (صفر مستخدمين) |
| 3 | **سيرفسز مكررة ومتضاربة** | `barberService` × `barbersService` (شكل داتا مختلف: `{items,total}` مقابل array خام)، `expenseService` × `expensesService` — محدش عارف أنهي الحي من غير بحث |
| 4 | **حدود ضبابية: `lib/` (21) × `utils/` (6) × `hooks/` (11)** | فورماترز في `lib` وتمويل في `utils`، تواريخ في `lib/dateUtils`، وطابعة في `utils/` — مفيش قاعدة تقول إيه يتحط فين |
| 5 | **مصدران للحقيقة في الـ hooks** | `useAuth` موجود في `context/` **و** `hooks/` (re-export)، نفس الشيء `useSalon`/`usePreferences` — ملفات تستورد من هنا وملفات من هنا (59 مقابل 1) |
| 6 | **الـ alias `@/` ميت** — 15 استخدام بس مقابل مئات `../../../` | أي نقل ملف بيكسر الاستيرادات، والمراجعة صعبة |
| 7 | **`features/` مشروع ناقص** — 6 ملفات inventory بس | نفس النمط (bookings/pos/hr) متوزع بين `pages` + `components` بدل ما كل دومين مع بعضه |
| 8 | **الـ `components/` سلة مهملات** — 88 ملف في 10 مجلدات بحدود وهمية | `common` (29) × `shared` (9) إيه الفرق؟ `bookings` × `pos`؟ `dashboard` × `charts`؟ + `types/` فيها ملف واحد بس والتايبات متبعثرة |

---

## 2️⃣ الهيكل المستهدف (ستايل المشاريع العالمية — feature-based)

```
src/
├── app/            # راوتر + providers + إعدادات عامة فقط
├── pages/          # أغلفة رفيعة للراوتات (كل صفحة < 100 سطر، تستدعي feature)
├── features/       # ⭐ كل دومين مع بعضه: api/ + components/ + hooks/ + types/
│   ├── bookings/ pos/ inventory/ hr/ payroll/ expenses/
│   ├── cashbox/ customers/ auth/ dashboard/ reports/ attendance/ settings/
├── components/     # مشترك حقيقي بس: ui/ + layout/ + shared/
├── lib/            # util عامة مقسمة: format/ date/ export/ print/ ...
├── services/       # يصغر لـ api-client فقط (axios + adapter)
├── types/          # تايبات الدومين المشتركة
└── test/           # unit tests جنب الكود + e2e منفصل
```

**قواعد الاستيراد (تتفرض بـ eslint في Phase 5):**
- `features/X` ممنوع تستورد من `features/Y` مباشرة — المشترك يعدي على `components/` أو `lib/`
- `pages/` تستورد من `features/` فقط — ممنوع العكس
- كل الاستيرادات الداخلية بـ `@/` — ممنوع `../..`

---

## 3️⃣ خطة المراحل (كل مرحلة تنتهي بـ `tsc` + `build` أخضر، بدون تغيير سلوك)

### ✅ Phase 0 — نظافة آمنة (تمت)
- [x] حذف الميت: `POS_Legacy.tsx` + `lib/api.ts` + `barbersService.ts` + `expensesService.ts` (~2500 سطر)
- [x] دمج آمن في `Users.tsx`: التحويل لـ `barberService` مع معالجة فرق شكل الداتا
- [x] توحيد الـ hooks على `context/*` + حذف الـ 3 shims
- [x] تحويل ~200 ملف لـ `@/` alias بسكريبت (`Temp/opencode/convert-alias.ps1`)
- [x] تحقق: `tsc` صفر + `build` ناجح + `tests` 16/16

### ✅ Phase 1 — الطبقة المشتركة (تمت)
- [x] دمج `utils/` في `lib/` مقسمة: `core/` `format/` `theme/` `access/` `domain/` `site/` `export/` `money/` `media/` `print/` + barrel لكل مجلد — وحذف `lib/constants.ts` الميت
- [x] حسم `common` × `shared`: حذف 6 ملفات مكررة/ميتة (`Button` `Badge` `CardShell` `StatCard` + `EmptyState`/`ErrorBoundary` المكررين) ودمج الباقي في `shared/`
- [x] نقل تايبات الدومين لـ `types/` (10 ملفات: `employee` `payroll` `catalog` `expenses` `cashbox` `website` `attendance` `reports` + `common`) — وتوحيد `EmployeeRecord` المكررة 3 مرات في تعريف واحد — + barrel `types/index.ts`
- [x] تحقق: `tsc` صفر + `build` ناجح
- ⚠️ ملاحظة: أنواع الـ Props فضلت جنب مكوناتها (الستاندرد العالمي)، وأنواع الـ Context فضلت في ملفاتها

### ✅ Phase 2 — أول feature تجريبي: inventory (تمت)
- [x] إزالة التكرار: الصفحة كانت معرّفة 8 helpers/constants نسخة طبق الأصل من الـ feature — بقت تستورد من `@/features/inventory`
- [x] `features/inventory/hooks/useInventoryData.ts` (جلب + بحث + فلترة + إحصائيات) و `useInventoryForm.ts` (فورم + مودالات + حفظ + توريد)
- [x] الصفحة: 1514 ← 1172 سطر (~350 سطر اتنقلوا للـ feature) — `tsc` صفر + `build` ناجح
- [x] barrel محدّث: components + hooks + tokens من مكان واحد
- ⏭️ الباقي من الصفحة (JSX الجداول/المودالات ~1100 سطر) يدخل Phase 3 مع باقي الوحوش

### ⏳ Phase 3 — تكسير الوحوش
- تقسيم الـ 15 صفحة الكبيرة لمكونات + hooks (الأكبر أولاً: Bookings → HR → Attendance...)

### ⏳ Phase 4 — تعميم النمط
- نقل باقي الدومينات لـ `features/` وتصغير `services/` لـ api-client فقط

### ⏳ Phase 5 — حماية الهيكل
- `ARCHITECTURE.md` + قواعد eslint تمنع الاستيرادات العكسية

### Phase 3 progress (2026-09-10)
- [x] Bookings: pages/cashier/Bookings.tsx 2418 -> 747 lines; new features/bookings/components/* (9 files) + hooks/useBookingsBoard + utils/board + barrel
- [x] HR: pages/owner/HRManagement.tsx 2355 -> ~1980 lines; unified features/hr (utils/constants, utils/helpers, hooks/useHrData, hooks/useEmployeeForm, hooks/useEmployeeDocuments, components/*, types, barrel); page consumes shared utils + data hooks
- [x] Attendance: pages/manager/AttendanceManagement.tsx data layer wired to features/attendance (hooks/useAttendanceData + utils); fixed AttendanceRecord type gaps (missing full_name, payroll typed unknown)
- [x] Deleted orphaned components/bookings/* (5 files, -1132 lines, unused)
- [x] Verify: frontend tsc 0 + eslint 0 + build green + vitest 16/16

### Backend tests (2026-09-10) — 61 green
- [x] tests/: auth, services, bookings, invoices, pos-shifts, customers, expenses, offers, payroll, products, shift-lifecycle, customer-write, appointments, dashboard, reports
- [x] Bugs found by tests: reports/overview 500 (phantom service_id/session_id columns, fixed); shift-close drops same-second invoices on sqlite (1s tolerance fix); drafts counted in revenue in 7 aggregates (now excluded: close, daily-summary, total-balance, owner/manager/cashier summaries, reports overview)
- [x] RBAC pinned: payroll + reports/overview forbidden for cashier (403)
- [x] CI (.github/workflows/ci.yml): added pytest/httpx/apscheduler to requirements (were missing), fixed eslint-9 lint script, gated lint + typecheck + test:run + build
- [x] Pydantic v1 @validator -> @field_validator; FastAPI on_event -> lifespan

### Plan close-out (2026-09-11)
- [x] Phase 3 finished: Bookings (747), HR (770), Attendance (567) pages wired to features/* modules
- [x] Phase 4/5 formal: ARCHITECTURE.md written; eslint no-restricted-imports bans ../ (zero violations)
- [x] Backend suite: 88 tests green; 7 production bugs fixed via tests
- [x] Deferred (explicit): Postgres parity run, full POS E2E, useEmployeeForm state wiring
