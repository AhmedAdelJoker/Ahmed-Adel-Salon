# تقرير فحص صفحة العملاء (Customers) — قبل التنفيذ

> فرع `security/postgres-hardening` — فحص فقط، **لم يُعدّل أي كود واجهة بعد**.
> بنية تحتية i18n: namespace `customers` مسجل + ملفات `ar|en/customers.json` (i18n test 8/8 ناجح).
> نطاق الكود: `frontend/src/pages/cashier/Customers.tsx` + `frontend/src/pages/cashier/CustomerDetail.tsx`
> + `frontend/src/features/customers/**` (25 ملفاً) + `frontend/src/hooks/useCustomer.ts`
> + `backend/app/api/v1/endpoints/customers.py` + `tests/e2e/customers.spec.ts`.
> المتصفح (live): `http://localhost:5173/customers` (HashRouter: `#/customers`).

---

## 1) ملخص تنفيذي

صفحة العملاء هي **الأكثر اكتمالاً برمجياً** من صفحات Schedule/Bookings/POS:
- قائمة مفلترة server-side (limit/offset/q/segment) مع pagination صحيح.
- KPIs system-wide (total/vip/regular/new/avg_spend/duplicates).
- كشف التكرارات + دمج العملاء (MergeCustomersDialog).
- Profile dialog (overview/appointments/invoices/activity) + تعديل/أرشفة.
- Import CSV/Excel + Export.

لكن الجولة كشفت **14 ملاحظة/مشكلة** أبرزها:
① **i18n غائبة كلياً** — 100% من نصوص الواجهة عربية ثابتة (لا `useTranslation` في أي ملف customers).
② **RTL hardcoded** — `text-right` literal في several components (CustomerTable, CustomerCards) بدلاً من logical properties.
③ **a11y ضعيف**: أزرار أيقونية (Eye/History/Trash) **بلا aria-label**، chip filter buttons بلا `aria-pressed`، أعمدة الجدول بلا `scope`، صفوف table قابلة للنقر بدون `role="button"`/`tabIndex`.
④ **أداء**: `transition={{ delay: index * 0.03 }}` في CustomerCards يُؤخر 30ms لكل بطاقة (100+ = 3s).
⑤ **الأمان**: لا `rel="noopener noreferrer"` (لا external links)، لكن phones/emails مكشوفة في كل صف (privacy concern).
⑥ **البحث بالكيبورد**: `document.querySelector('input[placeholder*="البحث"]')` fragile — يعتمد على النص (يُكسر عند i18n).
⑦ **الفلترة**: `activeFilter` uses Arabic literals ("الكل"/"VIP"/...) as identifiers — معرّفات بيانات مخزّنة بالعربية، مثل bookings tabs.
⑧ **الهاتف**: `maxLength` غير مطبّق في CustomerFormDialog (لا توجد فحص ≤ 11 رقم — bookings applied it).
⑨ **الحذف**: "حذف" (soft delete/archive) يُرسل `archive_reason` مع `customerName(deleteTarget)` — OK.
⑩ **التصدير/الاستيراد**: `handleImport` swallows errors silently (no toast).
⑪ **الـEmptyState في CustomerTable** uses `emptyTitle = "لا يوجد عملاء مطابقين"` (default Arabic).
⑫ **الـKPI cards** ل have hardcoded Arabic labels ("إجمالي العملاء" etc.) — no i18n.
⑬ **الـStatusConfig labels** في `customer.ts` hardcoded Arabic (قيد الانتظار/مؤكد/etc.).
⑭ **CustomerDetail**: `since` يُنسّق `ar-EG` ثابتاً (أرقام هندية حتى في English).

---

## 2) المشاكل المكتشفة (مرتبة بالخطورة)

| # | المشكلة | الخطورة | المكان | الدليل |
|---|---------|---------|--------|--------|
| 1 | i18n غائبة كلياً: 100% نصوص صلبة عربية | عالية | 22 ملف في `features/customers/**` + `pages/cashier/Customers.tsx` + `CustomerDetail.tsx` | `grep useTranslation` صفر في features/customers |
| 2 | RTL hardcoded: `text-right` literal + `dir="ltr"` literal على أرقام | متوسطة | `CustomerTable.tsx` (L113, L168)، `CustomerCards.tsx` (L90) | `text-right` على table + `dir="ltr"` على phones |
| 3 | A11y: أزرار أيقونية بلا aria-label | متوسطة | `CustomerTable.tsx` L191-226 (Eye/History/Trash buttons) | لا `aria-label`/`title` على buttons (title="عرض الملف" موجود لكن aria-label غائب) |
| 4 | A11y: chip filter buttons بلا aria-pressed | منخفضة | `CustomerToolbar.tsx` L42-66 | لا `aria-pressed` |
| 5 | A11y: `table` semantics | متوسطة | `CustomerTable.tsx` L113-258 | لا `<caption>`، `colSpan` OK، but rows clickable without `role="button"`/`tabIndex` |
| 6 | Performance: staggered animation delay | متوسطة | `CustomerCards.tsx` L48-50 | `transition={{ delay: index * 0.03 }}` — 100+ cards = 3s stagger |
| 7 | Performance: `visitsOf`/`visitsVariant` recomputed per row | منخفضة | `CustomerCards.tsx` L33-40 | called twice per card (visitsOf + visitsVariant) |
| 8 | أمان/خصوصية: phones/emails مكشوفة في كل صف | منخفضة | `CustomerTable.tsx` L168-174، `CustomerCards.tsx` L90-92 | privacy concern for shared screens |
| 9 | phone maxLength غير مطبّق | متوسطة | `CustomerFormDialog.tsx` (L50-70) | لا `maxLength={11}` ولا `slice(0,11)` (bookings applied it) |
| 10 | `handleImport` swallows errors silently | منخفضة | `CustomerHeader.tsx` L23-34 | `console.error` only, no toast |
| 11 | `emptyTitle` default hardcoded Arabic | منخفضة | `CustomerTable.tsx` L36 | `"لا يوجد عملاء مطابقين"` default |
| 12 | CustomerDetail `toLocaleDateString("ar-EG")` ثابت | متوسطة | `CustomerDetail.tsx` L222 | أرقام هندية حتى في English |
| 13 | `isFiltering` depends on Arabic literal "الكل" | منخفضة | `Customers.tsx` L81 | `activeFilter !== "الكل"` — معرّف بيانات بالعربية |
| 14 | `SEGMENT_BY_FILTER` keys are Arabic literals | منخفضة | `useCustomersList.ts` L18-23 | معرّفات بيانات بالعربية (متسق مع bookings) |

### ملاحظات إضافية
- `CUSTOMER_FILTER_TABS = ["الكل", "VIP", "منتظم", "جديد"]` — Arabic literals as identifiers.
- `getTierInfo` uses `key.includes("gold")` OR `key.includes("ذهبي")` — dual-language matching.
- `getStatusConfig` labels hardcoded Arabic in `customer.ts`.
- `CustomerFormDialog` has no `useTranslation`.
- `CustomerDeleteDialog` has hardcoded Arabic strings.
- `CustomerDetailsDialog` has hardcoded Arabic strings.
- `CustomerHeader` has hardcoded Arabic strings.
- `CustomerKpis` has hardcoded Arabic labels.
- `CustomerCards`, `CustomerTable`, `CustomerToolbar` all hardcoded Arabic.
- `CustomerOverviewTab`, `CustomerAppointmentsTab`, `CustomerInvoicesTab` likely hardcoded.
- `CustomerPagination` likely hardcoded.
- `CustomerMiniStat`, `CustomerKpi` likely hardcoded.

---

## 3) الخلاصة

**لا توجد i18n على الإطلاق** في features/customers. كل 22 ملف في features/customers يحتوي على نصوص عربية صلبة. لا namespace `customers` مسجل في `i18n/index.ts`. لا توجد any `useTranslation` calls.

هذا يماثل situation Schedule قبل P1 (التي أكملناها بالكامل).

---

## 4) خطة الإصلاح المقترحة (P1..P3) — بانتظار الموافقة

### P1 — الأساسيات (الأخطاء/الوصول) — ✅ مكتمل
- إضافة namespace `customers` في `i18n/index.ts` + ملفات `ar|en/customers.json` ✅
- تحويل جميع النصوص في features/customers (22 ملف) إلى `t("customers.…")` ✅
- إصلاح RTL hardcoded (`text-right` → `text-end`) ✅
- إصلاح `toLocaleDateString("ar-EG")` في CustomerDetail/Overview/Appointments/Invoices ✅ (يستخدم `dateLocale` حسب اللغة)
- إصلاح phone `maxLength={11}` في CustomerFormDialog ✅
- إصلاح `handleImport` لإظهار toast عند الخطأ ✅
- الاحتفاظ بـ `isFiltering` و `SEGMENT_BY_FILTER` بمعرّفات عربية (booking-style) ✅

### P2 — تجربة الاستخدام — ✅ مكتمل
- إضافة `aria-label` لجميع أزرار أيقونية ✅
- إضافة `aria-pressed` لـ chip filter buttons ✅
- إضافة `role="button"` + `tabIndex` + `onKeyDown` لصفوف table ✅
- إزالة staggered animation delay (تم ضبطه على 0) ✅
- empty state موحّد عبر `t("table.emptyTitle")` / `t("cards.emptyTitle")` ✅
- تأكيد حذف موجود مسبقاً ✅

### P3 — Biome (اختياري) — ✅ مكتمل
- إضافة `aria-live="polite"` + `aria-busy="true"` في `LoadingState` (مكون مشترك، مطبق على حالات التحميل) ✅
- إضافة اختصارات لوحة المفاتيح مع إشارات مرئية في شريط الأدوات: `/` للبحث، `n` لعميل جديد، `Esc` للإغلاق ✅
- إضافة إجراءات مجمعة (Bulk Actions): تحديد فردي/الكل، حذف للمحددين ✅

---

## 5) الفحوص المطلوبة بعد التنفيذ
- `npx tsc --noEmit` نظيف
- `npm run test:run` — 567+ اختبار (مع اختبار i18n nuevo namespace)
- `npm run build` ناجح
- تحقق حي في المتصفح (العربية + الإنجليزية)

---

**الحالة**: P1 (i18n + RTL + a11y + phone maxLength + import toast) — ✅ مكتمل. P2 (aria-label, aria-pressed, role="button", empty state، إزالة التأخير المتدرج) — ✅ مكتمل. P3 (aria-live، اختصارات لوحة المفاتيح، bulk actions) — ✅ مكتمل. tsc نظيف، i18n 7/7 ناجح، اختبار المسافة 방향ية ناجح. جميع مهام العملاء منتهية. بانتظار توجيه المستخدم للمهمة التالية (POS P1-P3، صفحات المالك/المدير، أو commit).

---

## A, B, C, D — المهام الإضافية (من impeccable audit)

| المهمة | الوصف | الحالة |
|--------|-------|--------|
| **A** | `/impeccable document` — توثيق النظام البصري في `DESIGN.md` | ✅ مكتمل |
| **B** | `/impeccable critique POS` — مراجعة POS (الأضعف: 6/10 UX, 5/10 a11y) | ✅ مكتمل (تقرير `docs/POS_CRITIQUE.md`) |
| **C** | إصلاح انحراف "Barber Luxe" في `frontend/index.html` + تنظيف ملفات mockup في root | ✅ مكتمل |
| **D** | استكمال i18n لصفحات المالك/المدير (reports, payroll, HR, settings) | ⏳ بنية تحتية جاهزة (namespace `owner` مسجل)، 28 ملف needs translation |

---

**السؤال**: هل تريد أن أبدأ بـ P1 للعملاء (i18n + a11y)، أم أن أبدأ بـ D (i18n owner pages) which is bigger, أم POS P1? أو تفضل كلها بالترتيب؟

---

## 6) إصلاحات ما بعد المراجعة (جلسة المتابعة)

| المشكلة | الإصلاح | الحالة |
|---------|---------|--------|
| ظهور `coupons.title` كنص خام في نافذة تفاصيل العميل | إضافة كائن `coupons` كامل إلى `ar/customers.json` و`en/customers.json` (title, noCoupons, invoice, date, type, amount, discountType.*) مع `defaultValue` لنوع الخصم | ✅ |
| تكرار كائن `appointments` في ملفي الترجمة (كان يلغي مفاتيح `cancelAll*`) | دمج الكتلتين في كائن واحد وإزالة التكرار | ✅ |
| اختصارات لوحة المفاتيح `/` و`n` ظاهرة في شريط أدوات العملاء | إزالة شريط الاختصارات من `CustomerToolbar.tsx` وتعطيل معالج لوحة المفاتيح في `useCustomerDialogs.tsx` | ✅ |
| زر "موافق" في نافذة تفاصيل العميل غير ظاهر | جسم النافذة أصبح `flex-1 min-h-0 overflow-y-auto` مع تثبيت `DialogFooter`، وإضافة مفتاح `details.ok` = "موافق" | ✅ |
| نص عربي مضمّن `عرض الباقي (n)` | إضافة `appointments.showRemaining` و`appointments.showLess` واستخدام الترجمة مع العدّاد | ✅ |
| فشل اختبار design-tokens بسبب ألوان PDF | إضافة `lib/export/customerPDF.ts` إلى استثناءات مستندات الطباعة المستقلة | ✅ |

**التحقق النهائي**: `npx tsc --noEmit` نظيف، `npm run test:run` 567/567 ناجح، `npm run build` ناجح.

**التحقق الحي (متصفح)**: صفحة العملاء لا تعرض اختصارات `/` و`n`، ونافذة تفاصيل العميل تعرض زر "موافق" داخل حدود الشاشة، وقسم "الخصومات المطبقة" يظهر بالعنوان العربي/الإنجليزي بدل `coupons.title`، وخريطة أوقات الذروة تظهر بعنوانها الصحيح في اللغتين.

---

## 7) تعريب بيانات المسارات والتنقل (PageMeta + Nav)

| البند | التنفيذ | الحالة |
|-------|---------|--------|
| namespace جديد `routes` | `ar|en/routes.json` + التسجيل في `i18n/index.ts` وتحديث اختبار التسجيل | ✅ |
| عناوين الصفحات | 61 مفتاحاً (`page.*` بما فيها `page.root`) تُستخدم في `document.title` و`Header` عبر `resolvePageMeta` + `routeKey` | ✅ |
| العناوين الفرعية | 18 مفتاحاً (`subtitle.*`) + `subtitle.default` | ✅ |
| عناصر القائمة الجانبية | 40 مفتاحاً (`nav.*`) + 5 مجموعات (`group.*`) تُترجم عند العرض دون المساس بمخرجات السجل أو حالة المجموعات | ✅ |
| شريط التنقل السفلي | تسميات `getMobileNavItems` + `aria-label` من `ui.quickNav` | ✅ |
| لوحة الأوامر (Ctrl+K) | تسميات العناصر والتصنيفات مترجمة، والبحث يعمل على النص المترجم (مثال: `financial` يجد Financial Reports، و`finance` يفلتر بالتصنيف) | ✅ |
| بطاقات الوصول السريع | `ui.quickAccess` + `ui.quickAccessSubtitle` + تسميات العناصر | ✅ |
| واجهة الهيدر/السايدبار | ترجمة دور المستخدم (`role.*`)، البحث الذكي، تبديل الثيم، قائمة المستخدم، الخزنة، تسجيل الخروج، وإنهاء الجلسة؛ ومشاركة `roleTranslationKey` في `lib/access/roles` | ✅ |
| ساعة الهيدر | تستخدم `useIntlLocale` بدل `ar-EG` الثابتة | ✅ |

**ملفات رئيسية**: `app/route-registry.tsx` (`routeKey`، `SEARCH_CATEGORY_KEYS`)، `app/router.tsx`، `components/layout/{Sidebar,MobileNav,CommandPalette,Header}.tsx`، `components/shared/LanguageSwitcher.tsx`، `features/reports-dashboard/components/QuickActions.tsx`، `i18n/locales/{ar,en}/routes.json` و`common.json`.

**التحقق**: `npx tsc --noEmit` نظيف، `npm run test:run` 567/567 ناجح، `npm run build` ناجح، والتحقق الحي بالعربية والإنجليزية يؤكد: `Customers` و`Customer Profile` في العنوان والهيدر، قائمة جانبية إنجليزية كاملة (Operations/Management/Finance/System + التسميات)، لوحة أوامر إنجليزية قابلة للبحث (بما فيها البحث بالتصنيف)، وتبديل اللغة يعيد الواجهة عربية/RTL دون أي مفتاح خام.