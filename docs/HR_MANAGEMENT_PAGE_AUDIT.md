# تقرير صفحة `/manager/hr` — فحص مُصحَّح + المرحلة الثانية (الأرشفة)

**التاريخ:** 6 نوفمبر 2026
**النطاق:** صفحة HR + `features/hr` + صفحة أرشيف الموظفين + طبقة الأرشفة في الـ backend
**الحالة:** ✅ المرحلة الثانية منفذة ومقيسة — **التقرير السابق (نسخة 6 نوفمبر) فيه أرقام وادعاءات غير صحيحة، مصححة في §1**

---

## 1) تصحيح التقرير السابق

| البند كما كُتبت | القيمة الفعلية المقيسة |
|---|---|
| «190 مفتاح `hr.*`» | **196** قبل هذه المرحلة، و**230** بعدها (متطابقة `ar`/`en`) |
| «29 ملف في `features/hr`» | **29** قبل، **30** بعد إضافة `ArchiveEmployeeDialog.tsx` |
| «سياسة الأرشفة: علامة `archived` قابلة للاستعادة» | **غير صحيحة**: لم يكن يوجد أي عمود أرشفة. الأرشفة كانت `status='resigned'` فقط، بلا تاريخ ولا سبب ولا اسم مُقرِّر |
| «0 نصوص عربية صلبة في UI» | غير صحيح في `hooks`: رسائل `toast` كانت عربية صلبة (`useEmployeeForm.ts` / `useHrData.ts`) |
| «جاهز للإنتاج — لا إجراءات مطلوبة» | كان هناك بوق تشغيلي حقيقي في الأرشفة/الاستعادة (§2) |

البنود التي **تحققت** كما هي: `tsc --noEmit` نظيف، `vitest` 573/573، `npm run build` ناجح، اختبارات i18n 7/7، والصفحة في `pages/manager/HRManagement.tsx` على route `/manager/hr`.

---

## 2) البوق الذي كان في أرشفة الموظفين (مغلق الآن)

**قبل:** الأرشفة `PUT /employees/{id} {status:'resigned', isActive:false, showInBooking:false, showInPos:false}`
والاستعادة `PUT /employees/{id} {status:'active', isActive:true}`.

1. كل الأسطح التشغيلية تُفلتر أصلًا بـ `status=='active'` + `is_active` (`booking_public.py:194`، `booking_scheduler.py:32`، `barbers.py:49`) — فمسح المفاتيح كان **زائدًا عن الحاجة**.
2. الاستعادة لم تُرجع المفاتيح → موظف يرجّع القائمة **اختفي من الكاشير ومن الحجز الأونلاين** حتى يفتح أحد الملف ويفعّل مفتاحين يدويًا.
3. حوار التأكيد كان يعد نصًا «حسب مفاتيح الظهور المحفوظة له» — وعد كاذب لأن المفاتيح مُسحت.
4. صفحة الأرشيف تعرض تاريخ التعيين فقط، و`EmployeeListItem` لم يكن يرسل `hire_date` أصلًا → العمود كان يظهر فاضي (`---`) دائمًا.
5. `admin.py:archive_staff` (راوتر غير مُسجَّل) كان يكتب `is_archived`/`archived_at` على موديل بلا هذه الأعمدة — كود ميت وغير قابل للعمل.

---

## 3) ما تم تنفيذه في هذه المرحلة

### 3.1 طبقة البيانات (backend)

- **أعمدة جديدة على `employees`:** `archived_at`، `archive_reason`، `archived_by_user_id` (+ relationship `archived_by`) في `app/models/employee.py`.
- **Migration:** `alembic/versions/a7f3c91d4b62_record_when_and_why_an_employee_left.py` بنفس نمط `f2a7c3e91b45` (حراسة `_has_column`، nullable، بدون backfill) + نفس الأعمدة في `app/db/runtime_schema.py` ليتطابق مسار SQLite مع alembic.
- **Endpoints جديدة** في `app/api/v1/endpoints/employees.py`:
  - `POST /employees/{id}/archive` — `{reason, effectiveDate}`؛ تضبط `resigned/is_active=false` وتاريخ وسبب ومُقرِّر، **ولا تلمس مفاتيح الظهور**، وتُغلق حساب الدخول المرتبط مع `token_version++`، مع `audit_log`.
  - `POST /employees/{id}/restore` — يعيد `active/is_active=true` ويصفّر تاريخ/سبب الأرشفة ويُعيد فتح الحساب؛ مفاتيح الظهور تبقى كما هي.
  - `GET /employees/{id}/archive-impact` — عدد الحجوزات التي لم تُنفَّذ بعد باسم الموظف + وجود حساب دخول + مفاتيح الظهور (تُقرأ قبل القرار).
  - `GET /employees/stats` — عدّ على كامل الكادر (total/active/suspended/resigned/barbers/assistants).
- **`PUT` لم يعد بابًا خلفيًا:** ضبط `status='resigned'` عبره يُرفض بـ 400 حتى لا تنتج صفوف أرشيف بلا تاريخ.
- **`GET /employees`** يقبل `excludeStatus`؛ و**`GET /employees/archive`** صار يرسل `X-Total-Count` ويرتّب الأحدث رحيلًا أولًا ويُخرج `archived_on` كتاريخ (بمقياس يوم الصالون) لا كـ instant.

### 3.2 الواجهة (frontend) — تصميم «Ops console»

- **صفحة الأرشيف نُقلت وأُعيدت كتابتها:** `pages/owner/EmployeeArchive.tsx` → `pages/manager/EmployeeArchive.tsx` (route `/manager/hr/archive` ثابت). جدول كثيف: تاريخ الخروج / الموظف / الجوال / السبب / مدة الخدمة / استعادة، بحث server-side بـ debounce، ترقيم حقيقي، فلتر سبب، وشريط ثلاثة قياسات (في الأرشيف / نتائج التصفية / بلا تاريخ خروج). صفوف ما قبل هذه المرحلة تُعرض **«غير مسجل»** بدل اختراع تاريخ.
- **حوار أرشفة جديد:** `features/hr/components/ArchiveEmployeeDialog.tsx` — آخر يوم عمل + سبب من قائمة + ما سيُلمَس (حجوزات لم تُنفَّذ، إغلاق حساب الدخول، بقاء مفاتيح الظهور).
- **`useHrData`:** بحث `q` على السيرفر مع تصفير الصفحة، و`excludeStatus=resigned`، والإحصاء من `/employees/stats` بدل عدّ الصفحة الحالية.
- **`HrStatsGrid`:** شريط قياس واحد كثيف بدل أربع كروت ضخمة، مع خلية أرشيف قابلة للفتح وعدّها من كامل الكادر.
- **`HrToolbar`:** chips للحالة بـ `aria-pressed` + عدّاد نتائج + زر مسح بحث.
- **`EmployeeTable`:** عمود «متاح في» (الكاشير/الحجز) و«منذ تاريخ» وأرقام tabular، وتوكنات v2 (`raised/sunken/line/content-*`) بدل v1، وخصائص RTL منطقية.
- **i18n:** `hr` من 196 → **230** مفتاحًا، و`empArch` من 18 → **36**، متطابقة `ar`/`en` (ومصحَّح بها الوعد القديم في `empArch.restoreDescription`).

---

## 4) بوابة التحقق (نتائج فعليّة)

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` | ✅ نظيف |
| `npx vitest run` | ✅ 573/573 (53 ملف) |
| `npm run build` | ✅ ناجح |
| `pytest` (backend كامل) | ✅ **781 passed، 29 skipped** |
| `pytest tests/test_employees_archive.py` | ✅ 16/16 (10 منها جديدة لهذه المرحلة) |
| Playwright `src/test/e2e/hr-archive.spec.ts` | ✅ يمرّ: أرشفة من الحوار → اختفاء من الفريق → الأرشيف يعرض التاريخ/السبب/مدة الخدمة → استعادة → `showInPos/showInBooking` يرجّعان `true` و`archivedAt` يصبح `null` |
| اختبارات i18n / RTL guard | ✅ 7/7 و 2/2 |

**فشلان في مجموعة e2e موجودان قبل هذه المرحلة ولا علاقة لهما بها** (تم التحقق منهما):

- `core-routes.spec.ts` يتوقع عنوان «مخطط المواعيد الذكي»، و`ar/schedule.json` (ملف غير متتبَّع، من شغل i18n جارٍ في الشجرة) يقول «المخطط الزمني الذكي».
- `customers.spec.ts` يتوقع زر «إضافة العميل»؛ هذه العبارة موجودة في namespace العملاء داخل نص toast فقط.

الملفان المتعلقان (`pages/cashier/Schedule.tsx`، `features/customers/**`) معدَّلان في شجرة العمل ولم ألمسهما.

---

## 5) حالة قاعدة البيانات

- **قاعدة البيانات الفعلية للتشغيل** هي `C:\Users\Ahmed\Downloads\SalonPro_External\data\salon_pro.db` (يحلّها `app/core/paths.py:resolve_database_url`)؛ ملف `backend/salon_pro.db` باقٍ من سلوك قديم وغير مستخدم.
- أثناء العمل، أمر `alembic upgrade head` بمسار SQLite نسبي انحرف إلى الـ URL الخارجي المعتمد، فطُبِّقت **ثلاثة** revisions على القاعدة الحية: `c4d9e2f6a8b3` و`a9c4e2f7b1d6` (كانا معلّقين أصلًا) ثم `a7f3c91d4b62` (هذه المرحلة). كلها إضافي (nullable columns + partial unique index) ولم تُعدّل أي صف.
- **التحقق بعد التطبيق:** `PRAGMA integrity_check = ok`، موظفان و36 فاتورة كما هما، `alembic_version = a7f3c91d4b62`.
- **نسخ:** `backend/backups/salon_pro_pre_archive_migration_20261106_125615.db` (نسخة `backend/salon_pro.db`) و`backend/backups/live_salon_pro_post_first_migration_20261106_1305.db` (القاعدة الحية بعد التطبيق). **لا توجد نسخة من القاعدة الحية قبل التطبيق**؛ التراجع الممكن هو `alembic downgrade -1` أو استرجاع هذه المرحلة يدويًا.

---

## 6) متبقٍّ معروف (لم يُنفَّذ في هذه المرحلة)

1. `DELETE /employees/{id}` يظل حذفًا فعليًا مع snapshot في audit — سياسة «الأرشفة لا الحذف» غير محروسة على مستوى الـ API، والواجهة لا تعرضه.
2. `admin.py` فيه راوتر غير مُسجَّل (`archive_staff`) صار يكتب عمودًا موجودًا دون الباقي — غير مُفعَّل لكنه فخ إن سُجِّل.
3. رسائل `utils/*` و`hooks/*` الداخلية ما زالت عربية صلبة (قرار موثق في التقرير السابق) — تعريبها يحتاج تحديث اختبارات.
4. تصدير CSV وبطاقة الموظف للطباعة ودعم الأرقام الدولية: لم تُطلب في هذه المرحلة.
5. `EmployeeCardGrid` تُركت كما هي (عرض «بشري») مقابل الجدول كثيف المعلومات؛ المظهران متعمَّدان.
