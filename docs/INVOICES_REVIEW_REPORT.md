# تقرير فحص صفحة الفواتير (Invoices) — قبل التنفيذ

> فرع `security/postgres-hardening` — فحص كامل + تنفيذ P1/P2/P3 — **مكتمل**.
> نطاق الكود: `frontend/src/pages/cashier/Invoices.tsx` + `frontend/src/features/invoices/**`
> (`components/InvoicesToolbar.tsx`, `components/InvoicesTable.tsx`, `components/InvoicesDialogs.tsx`,
> `components/InvoicesPagination.tsx`, `hooks/useInvoicesData.ts`, `utils/invoice.ts`, `constants.ts`, `index.ts`)
> + `Pagination` المشترك + `lib/core/currency.ts` + نقاط النهاية في الباكند
> (`backend/app/api/v1/endpoints/invoices.py`, `invoice_adjustment_requests.py`).
> التحقق: `npx tsc --noEmit` نظيف، `npm run test:run` 573/573، `pytest tests/` 770 passed/29 skipped، `npm run build` ناجح.
> المتصفح (حي): `http://localhost:5173/#/invoices` — AR + EN verified.

---

## 0) الحالة الحالية (بيانات حية)

- الفاتورة الوحيدة في نوفمبر: `INV-20261102-0001` (200.00 ج.م، نقدي، عميل «احمد عادل»، خبير «Ahmed adel»).
- كل عام 2026: 34 فاتورة، إجمالي 17,363.00 — **لا توجد فواتير ملغاة حالياً** (الخطأ المالي في البند 1.3 كامن).
- الوصول: `FRONT_DESK` (OWNER/ADMIN/MANAGER/CASHIER) — مطابق للباكند.
- عنوان المتصفح في العربي والإنجليزي يعمل عبر `routes` («الفواتير» / «Invoices») — الجزء الوحيد المعرب في الصفحة.

---

## 1) ملخص تنفيذي

الصفحة **وظيفياً جيدة** (فلترة وترتيب server-side، summary للفترة كاملة، sequence guards، طباعة إيصال، PDF، CSV export يمشي على كامل النتائج)، لكنها **غير معربة إطلاقاً** — كل النصوص داخل المحتوى عربية صلبة حتى في الواجهة الإنجليزية — وفيها **خطأ مالي** في ما يُعرض كـ«صافي مبيعات الفترة»، و**خطأ وصول** بلوحة المفاتيح. الهيدر الخارجي يقرأ `routes:page.invoices` فيعمل بالإنجليزي، بينما المحتوى كله عربي — تجربة ناقصة ومحرجة.

أبرز 6 مشاكل:
1. i18n غائبة كلياً عن كل نصوص المحتوى (الدليل أدناه).
2. التواريخ/الأرقام مثبتة على `ar-EG-u-nu-latn` حتى في EN.
3. **ملخص الفترة يشمل الفواتير الملغاة** (الباكند يجمع `total_amount` دون استثناء `is_closed`).
4. Enter/Space من زر «إجراءات» يفتح تفاصيل الفاتورة بدل القائمة.
5. `get_invoice_pdf` لا يعيد توليد PDF مفقود؛ 404 بدل إعادة التوليد.
6. لاحقة العملة «ج.م» مثبتة في حوار طلب التعديل.

---

## 2) المشاكل مرتبة بالخطورة

### P1 — أخطاء وظيفية/وصول

| # | المشكلة | الخطورة | المكان | الدليل |
|---|---------|---------|--------|--------|
| 1.1 | i18n غائبة كلياً: العنوان الداخلي، الأزرار، الجدول، الفراغات، التلميحات، CSV headers، كل النصوص عربية صلبة | عالية | `Invoices.tsx`، كل ملفات `features/invoices/**` (TOOLTIP/`aria-label`s كذلك) | تحقق حي: بعد التبديل إلى English يبقى المحتوى كله عربياً بينما فقط الهيدر الخارجي يصبح «Invoices» |
| 1.2 | التواريخ/الأرقام مثبتة: `toLocaleDateString("ar-EG-u-nu-latn")` + وقت `ar-EG` + Pagination `locale="ar"` | عالية | `utils/invoice.ts` (`formatDateParts`)، `InvoicesToolbar` (`shortDate`)، `Invoices.tsx` (`rangeLabel`)، `InvoicesPagination.tsx` | EN: «02 نوفمبر 2026 • 05:43 م» و«عرض 1–1 من 1» في واجهة dir=ltr |
| 1.3 | **«صافي مبيعات الفترة» و«عدد الفواتير» و«متوسط الفاتورة» تشمل الملغاة**: يجمع `sum(total_amount)` و`count(*)` دون `case(is_closed)` | عالية (مالي) | `backend/app/api/v1/endpoints/invoices.py` L1253–1263 | الاستعلام نفسه يحسب `summary_closed` منفصلة، وبقية الوحدات تستبعد `is_closed == False` (barber.py L286, L1271…). حوار التعديل نفسه يقول «لن تُحسب ضمن مبيعات الفترة» |
| 1.4 | Enter/Space من أزرار الإجراءات الداخلية يُطلق `onSelectInvoice` عبر فقاعة الحدث على `TableRow` — يفتح Dialog التفاصيل بدل قائمة الإجراءات (أو فوقها) | عالية (a11y) | `InvoicesTable.tsx` L386–398 (Desktop row) وL473–484 (بطاقات الموبايل) | تحقق حي: Enter على زر «إجراءات الفاتورة …» فتح تفاصيل الفاتورة بدل القائمة |
| 1.5 | زر PDF يعيد 404 «لا يوجد PDF لهذه الفاتورة» كلما فقد الملف/لم يُولّد عند الإنشاء، رغم توفر `_ensure_invoice_pdf_path()` يُستخدم في exports.py | عالية (وظيفي) | `invoices.py` L1353–1366 مقابل L306–342 و`exports.py` L1616 | مسار التوليد موجود ولا يُستدعى من نقطة التحميل |
| 1.6 | لاحقة «ج.م» مثبتة في حوار طلب التعديل؛ لا تطابق عملة المحل عند تغيير `business_settings.currency` | متوسطة | `InvoicesDialogs.tsx` L365–383 | نص «ج.م» يتزامن مع `formatCurrency()` الذي يقرأ العملة من الإعدادات |

### P2 — تجربة/وصول/تجانس

| # | المشكلة | الخطورة | المكان | الدليل |
|---|---------|---------|--------|--------|
| 2.1 | `hasFilters` لا يشمل الفترة: عند فترة بدون فواتير يظهر «لا توجد فواتير بعد» وزر «مسح الفلاتر» مخفي | متوسطة | `Invoices.tsx` L107–110 | يجب ضم `timePreset !== "month"` (أو اختلاف الفترة عن الافتراضي) |
| 2.2 | `InvoicesPagination` يفرض `locale="ar"` + `useMemo` فارغ مع تعديل الحقول بعدها، والمشترك `Pagination` أسهم prev/next لا تتعكس مع `locale="en"` | متوسطة | `InvoicesPagination.tsx` L25–39؛ `Pagination.tsx` L177–233 | `CustomerPagination` يمرر اللغة من `i18n.language` — نفس النمط غير مطبق هنا |
| 2.3 | عدّاد «طلبات تعديل» يُحمّل حتى 100 طلب ويُفلتر في الواجهة؛ يتجاهل `X-Total-Count` و`?status=pending` → قصور العدد وفائض في الاستجابة | متوسطة | `useInvoicesData.ts` L285–323 | الباكند يرسل `X-Total-Count` (invoice_adjustment_requests.py L197–199) |
| 2.4 | منتقي الأعمدة ظاهر فقط ≥`sm`، وصفوف الموبايل تتجاهل `visibleColumns` — لا يمكن التحكم بالأعمدة على الموبايل + تسمية «وسيلة الدفع» في المنتقي مقابل «الدفع» في الجدول | منخفضة | `InvoicesToolbar.tsx` L44–52/L334–380، `InvoicesTable.tsx` L350–356/L468–550 | تناقض + ميزة ميتة على الموبايل |
| 2.5 | a11y للجدول: لا `aria-sort` ولا `scope="col"`، أزرار الفرز بلا `aria-label`، حقل البحث بلا `aria-label`، بطاقات الموبايل `role="button"` تحتضن أزراراً تفاعلية (nested interactive) | متوسطة | `InvoicesTable.tsx` L321–380/L468–550، `InvoicesToolbar.tsx` L254–259 | مخالفة ARIA؛ أزرار Enter داخلها تُطلق تفاصيل الفاتورة |
| 2.6 | `loading` يعيد استبدال الجدول كله بـ skeleton عند أي تحديث/فلترة (رمشة مزعجة) بدل إبقاء الصفوف مع مؤشر تحميل | منخفضة | `InvoicesTable.tsx` L267 | الأفضل: الاحتفاظ بالصفوف + `aria-busy`/مؤشر |
| 2.7 | كلمة «عدد الفواتير» و«متوسط الفاتورة» تشمل الملغاة أيضاً (نفس أصل 1.3) وكلمة «ملغاة» تُعرض مقابل `is_closed == False` (invoices open/مكتملة) | متوسطة | `invoices.py` L1253–1263، `Invoices.tsx` L190–213 | نفسه أصل البند 1.3 |
| 2.8 | تصدير CSV: عناوينه وتلميحات `toast` والتاريخ `ar-EG` — كلها عربية حتى في EN | منخفضة | `useInvoicesData.ts` L355–385 | يجب تمرير عنوان مترجم + locale اللغة |
| 2.9 | التلميحات الفارغة/الأخطاء كلها عربية (`INVOICE PDF…` إلخ) | منخفضة | `Invoices.tsx` L291–299، `InvoicesDialogs.tsx`، `InvoicesTable.tsx` L269–315 | نفس 1.1 |

### P3 — جودة/صيانة/اختبارات

| # | المشكلة | الخطورة | المكان | الدليل |
|---|---------|---------|--------|--------|
| 3.1 | لا توجد اختبارات لميزة invoices (سوى `invoiceArchiveMonthRow` للأرشيف) — لا تغطية للـ utils/الفرز/اللوحة/الملخص | متوسطة | `frontend/src/test/` | لا يوجد أي test للـ Keyboard Guard أو locale للتواريخ أو hasFilters |
| 3.2 | كل شيء `any` — لا نوع `Invoice` موحد (نماذج، استجابات، `items`) | منخفضة | `useInvoicesData.ts`، `components/*` | Types توفر حماية من `invoice.is_closed` الخاطئ |
| 3.3 | كود ميت: `initialRange()` يقرأ `?month=` من `window.location.search` ولا أي تنقّل يضبطه | منخفضة | `useInvoicesData.ts` L83–97 | لا نتيجة لها إلا تعقيد وقابلية عطل في SPA |
| 3.4 | تناقض `PageHeader` الداخلي مع `Header` الخارجي — ضروري لكن يجب أن يستخدم `t(...)` مثل صفحة العملاء | منخفضة | `Invoices.tsx` L112–131 | `customers.tsx` يستخدم `useTranslation("customers")` + `t("page.title")` |

---

## 3) توصيات احترافية (بخلاف الإصلاحات أعلاه)

1. **تفصيل الضرائب والمدفوعات المنقسمة**: حوار التفاصيل لا يعرض `tax_amount`/`tax_rate` ولا التقسيم `payments[]` (مُتسلسل في الباكند L796–803) رغم أهميته للفوترة.
2. **تأكيد صريح لإلغاء الفاتورة (void)**: حوار التعديل يفتقر إلى خطوة تأكيد للإلغاء (سيُسقط الفاتورة نهائياً) — أضف حوار تأكيد ثانٍ + سبب إلزامي.
3. **إجراءات مجمعة (Bulk)**: تحديد عدة فواتير → تصدير/طباعة، مع عدّاد في الترويسة.
4. **«ثابت هذه الفترة»**: عند `timePreset = custom` اعرض Chip «فترة مخصصة» بدل عدم تمييز أي زر preset.
5. **آخر تحديث**: إظهار وقت آخر مزامنة (`آخر تحديث 05:43`) بجانب زر التحديث.
6. **دعوة للفعل (CTA)**: الفراغ الابتدائي بزر «إنشاء أول فاتورة من نقطة البيع» بدل النص فقط.
7. **Export**: إضافة أعمدة `الخصم` و`الضريبة` و`الصافي` + زر XLSX إن تيسر، مع اسم ملف محلي (`invoices_YYYY-MM-DD_HH-mm.csv`).
8. **net vs gross**: عرض طفيف «الإجمالي» و«بعد الملغاة» في البطاقة العلوية لزيادة الوضوح المالي.
9. **أيقونة طباعة مباشرة** بجانب «…» في الصف على الشاشات الكبيرة لتسريع المنضدة.
10. **توحيد الأسهم**: أسهم prev/next تُركب منطقياً (ChevronStart/End) لتمليح RTL/LTR بدون تبديل الأيقونات.
11. **جدول طباعة مستقل للنوافذ**: إعادة استخدام `PageShell printable` لاحقاً للتقارير (خارج نطاق هذه الجولة).
12. **الوصول**: صفوف الجدول `scope="col"` للرأس + `aria-sort` + `aria-label` للفرز "ترتيب حسب X تصاعدي/تنازلي".
13. **ملاحظة واتساب PDF**: الباكند يدعم `POST /{id}/send-whatsapp-pdf`؛ لا يوجد زر له في الجدول — مرشّح جيد للقائمة.
14. **إدارة العملة**: لاحقة ووحدة العملة كلها يجب أن ترجع لـ `formatCurrency()` فقط؛ توحيد انسياق `currencyLabel` مع `getIntlLocale` في التواريخ.
15. **ألوان الحالات**: شارة «ملغاة» حمراء و«مكتملة» خضراء — تعارض مع `warning` للتعديل؛ لا تغيير.

---

## 4) خطة الإصلاح المقترحة

### P1 — الأساس (الأخطر) — مقبول للتنفيذ مباشرة
1. إضافة namespace `invoices` (`ar|en/invoices.json`) + تسجيله في `i18n/index.ts` (وتحديث regex في `i18n.test.ts`).
2. ترجمة كل النصوص/labels/aria/skeletons/CSV headers/تلميحات الفارغ + حوار التفاصيل + حوار التعديل.
3. تواريخ محلية حسب اللغة عبر `i18n` (أو `useIntlLocale`) أو تمرير `locale` من المكونات.
4. **إصلاح الملخص المالي في الباكند**: `summary_count/total` يستبعد `is_closed` + اختبار pytest مغطى (بما فيه فرضية «void يُخرج من الملخص»).
5. **إصلاح لوحة المفاتيح**: قفل `onKeyDown` على `e.target === e.currentTarget` في الصف/البطاقة.
6. **PDF**: `get_invoice_pdf` يُستدعى `_ensure_invoice_pdf_path` أولاً، ويعيد 404 فقط إن تعذر التوليد فعلاً.
7. حوار التعديل: استبدال «ج.م» بـ `currencyLabel(getCurrency())`.
8. التحقق الحي AR+EN بعد التنفيذ + `tsc` + `npm run test:run` + `build`.

### P2 — تجربة/تجانس
1. `hasFilters`+رسالة الفارغ (يشمل الفترة) + زر reset معيد الشهر الافتراضي.
2. `InvoicesPagination` يأخذ اللغة من `i18n` + إصلاح أسهم prev/next باللغة في `Pagination` المشترك.
3. عدّاد «طلبات تعديل» عبر `?status=pending` مع قراءة `X-Total-Count`.
4. a11y: `aria-sort`+`scope="col"` + `aria-label` لـ search/فرز + التخلص من nested interactive في بطاقات الموبايل.
5. CSV header + toast بلغة الواجهة + بناء اسم الملف طبقاً للتاريخ المحلي.
6. إبقاء الصفوف مع مؤشر تحميل بدل skeleton كامل عند التحديث.

### P3 — جودة/صيانة
1. اختبارات جديدة: `formatDateParts/invoicePaymentLabel` locale-aware، Enter-guard على الصف، `hasFilters` مع الفترة، pytest للملخص يستثني `is_closed`.
2. استبدال `any` بأنواع `Invoice` (نوع مقترح في `utils/invoice.ts`).
3. حذف/توصيل `?month=` (إما ربط زر «الأرشيف» بـ `navigate("/invoices")` وحذف القراءة الميتة).
4. حوار التفاصيل: صفوف ضريبة/تقسيم خصم + badge «ملغاة» مع سبب الإلغاء إن وُجد.
5. Badge «فترة مخصصة» عند custom + إعادة ترتيب منتقي الأعمدة (منع `visibleColumns` الميتة على الموبايل أو تعميمها).

---

## 5) الفحوص المطلوبة بعد التنفيذ
- `npx tsc --noEmit` نظيف.
- `npm run test:run` ناجح (مع i18n namespace جديد).
- backend: `pytest` الاختبارات ذات العلاقة بـ invoices.
- `npm run build` ناجح.
- تحقق حي (العربية + الإنجليزية):
  - EN: كل النصوص إنجليزية بما فيها Pagination وCSV وتلميحات الحالة؛ لا أي حرف عربي في المحتوى.
  - الطباعة والـ PDF يعملان بدون تغيير سلوك، وإيصالات POS لم تتأثر.
  - قد يلزم إعادة تشغيل الباكند لتطبيق إصلاح 1.3 (uvicorn بدون --reload).
  - تحقق من الملخص: فاتورة إلغاء لا تُحتسب في «صافي مبيعات الفترة».

---

## 7) التنفيذ (بعد الموافقة) — ✅ مكتمل

### P1 — الأساس
1. namespace `invoices` في `ar/en` + تسجيل في `i18n/index.ts` + تحديث regex في `i18n.test.ts` ✅
2. ترجمة جميع نصوص `Invoices.tsx` + `InvoicesToolbar` + `InvoicesTable` + `InvoicesDialogs` + `InvoicesPagination` ✅
3. تواريخ حسب اللغة (`getIntlLocale` + `i18n.language`) في `formatDateParts`/`shortDate`/`rangeLabel` ✅
4. **إصلاح الملخص المالي في الباكند**: `summary_count/total` يست exclude `is_closed` — اختبار `test_list_invoices_summary_excludes_closed` ✅ (770 backend tests ناجحة)
5. **إصلاح لوحة المفاتيح**: `event.target === event.currentTarget` guard في الصف/بطاقة الموبايل — اختبار `invoicesFeature.test.tsx` ✅
6. **PDF**: `get_invoice_pdf` يستدعي `_ensure_invoice_pdf_path` أولاً (مع إصلاح pdf_service لـ customer=None) ✅
7. ** currency suffix**: `currencyLabel(getCurrency())` بدل «ج.م» المثبتة ✅
8. زر **«إرسال PDF واتساب»** في قائمة الإجراءات (`send-whatsapp-pdf`) — frontend + ترجمة ✅
9. **WhatsApp** في حوار التعديل لا يُطلق إرسال فعلي (أزرار الإجراءات) — verified live في EN/AR ✅

### P2 — تجربة/تجانس
1. `hasFilters` includes timePreset ≠ month + رسالة فارغة + زر «مسح الفلاتر» + CTA «إنشاء فاتورة من نقطة البيع» ✅
2. `InvoicesPagination` locale من `i18n` + أسهم prev/next في `Pagination` مشتركة موجهة حسب اللغة ✅
3. `pendingAdjustments` عبر `?status=pending` + `X-Total-Count` (بلا 100-row download) ✅
4. a11y: `aria-sort` + `scope="col"` + `aria-label` لبحث/فرز + إزالة nested interactive في بطاقات الموبايل (button مستقل) ✅
5. CSV headers + toast + اسم ملف محلي باللغة (8 أعمدة incl. خصم/ضريبة) ✅
6. الاحتفاظ بالصفوف مع مؤشر تحميل (aria-busy) بدلاً من skeleton كامل ✅
7. **صفوف الضريبة + تقسيم الدفع** في حوار التفاصيل ✅
8. Badge «فترة مخصصة» عند `timePreset === custom` ✅
9. «آخر تحديث» بالوقت (locale-aware) في ترويسة السجل ✅
10. Deep-link `?month=` من أرشيف الفواتير (MonthArchiveRow `onOpenLedger`) ✅

### P3 — جودة/صيانة
1. اختبارات `invoicesFeature.test.tsx` (utils locale/labels/rows/isInvoiceEditable + keyboard guard) ✅ + `setup.ts` ResizeObserver/IntersectionObserver rebuilt as classes
2. أصناف `InvoiceRecord`/`InvoiceLine`/`InvoicePayment` في `utils/invoice.ts` (partially replaces `any`) ✅
3. إزالة `?month` من `window.location.search` الميت → `useSearchParams` (HashRouter-safe) + ربط أرشيف الفواتير ✅
4. `visibleColumns` مطبق على بطاقات الموبايل (customer/date/amount/payment/status/actions) ✅
5. توحيد تسمية عمود «وسيلة الدفع»/«الدفع» via نفس `columns.*` keys ✅

### تحديث الفحوص
- `npx tsc --noEmit` نظيف.
- `npm run test:run` → **573/573 ناجح** (567 + 6 جديدة).
- `pytest tests/` → **770 passed / 29 skipped**.
- `npm run build` ناجح.
- تحقق حي (AR+EN) في المتصفح:
  - AR: `1 فاتورة بعد الخصومات • 0 ملغاة`، `02 نوفمبر 2026 • 05:43 م`، `عرض 1–1 من 1`، `فلاتر`، إجراءات: `تفاصيل الفاتورة / طباعة إيصال / تحميل PDF / إرسال PDF واتساب / طلب تعديل`.
  - EN: `1 invoice after discounts • 0 cancelled`، `Nov 02, 2026 • 05:43 PM`، `Showing 1–1 of 1`، `Invoice details / Print receipt / Download PDF / Send PDF via WhatsApp / Request adjustment`.
  - Empty state في preset `Today` (0 نتائج): `لا توجد فواتير مطابقة` + `مسح الفلاتر` (hasFilters صحيحة).
  - Deep-link `#/invoices?month=2026-10` يفتح 2026-10 مع `INV-20261013-0001`.
  - Archive: زر «فتح في السجل» يظهر في Month panel.

### ملاحظات
- لا commit/push (كما هو مطلوب).
- زر واتساب PDF (Backend) لم يُختبر بضغط فعلي (يُرسل واتساب حقيقي) — الواجهة جاهزة.
- باقي صفحات المالك/المدير (i18n) بانتظار الأولوية.
