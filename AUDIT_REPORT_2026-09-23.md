# تقرير التدقيق الشامل — Salon Management Pro

**تاريخ الفحص:** 23 سبتمبر 2026  
**نطاق الفحص:** Backend، واجهة الإدارة، الموقع العام، Electron، قاعدة البيانات، الاختبارات، CI/CD، الاعتماديات، الملفات الميتة، ونظافة المستودع.  
**نوع الفحص:** تقرير أولي بالقراءة فقط مع تشغيل فحوص غير مدمرة. بدأت التعديلات التنفيذية بعد إنشاء التقرير، وتُوثَّق حالتها في القسم 15؛ لم تُطبّق migrations على أي قاعدة بيانات قائمة.

## 1. حالة المستودع وقت الفحص

- الفرع الحالي: `main`.
- المرجع وقت التقرير: `9fe7140`.
- الفرع متقدم 119 commit على `origin/main`.
- توجد 23 تغييرات متتبعة و3 ملفات untracked من أعمال محلية سابقة.
- تشمل التغييرات الحالية ملفات Electron ومسارات DB وHR وصفحات cashier والتوجيه وملفات تقارير محذوفة محليًا.
- يجب تثبيت baseline واضح قبل أي تنظيف حتى لا تختلط التعديلات المحلية بنتائج الفحص.
- الملف الجديد الوحيد المتوقع من هذا التقرير هو `AUDIT_REPORT_2026-09-23.md`.

## 2. الخلاصة التنفيذية

### الحكم العام

المشروع يملك أساسًا جيدًا، لكنه **غير جاهز حاليًا للإصدار الإنتاجي أو التوزيع خارجي**. الاختبارات الحالية تمر، لكن الفحص كشف مشكلات لم تغطيها الاختبارات في الصلاحيات، وسلامة الفواتير والمخزون، والترحيل من قاعدة فارغة، وتشغيل Docker، وتغليف Electron.

### حالة المحاور

| المحور | الحالة | الخلاصة |
|---|---|---|
| تنظيم Backend | Yellow | توجد طبقات واضحة، لكن منطق الأعمال والصلاحيات متسرب إلى endpoints |
| تنظيم Frontend | Yellow | توجد features folders، مع حدود barrels وخدمات وstate غير مستقرة |
| الموقع العام | Yellow–Red | البناء ينجح، لكن توجد contexts إدارية وخدمات مكررة وعقود API ناقصة |
| الأمان | Red | مسارات تعديل مالي وإعدادات بلا مصادقة، وWebSocket بلا مصادقة، ومخاطر تسريب ملفات |
| الفواتير والمخزون | Red | مدخلات مالية غير مقيّدة، وتعديل فاتورة قد يصنع فاتورة جديدة، وخصم المخزون غير idempotent |
| قاعدة البيانات | Red | migrations تفشل على قاعدة فارغة قبل الوصول إلى `head` |
| الاختبارات | Yellow | اختبارات Backend وFrontend تمر، لكن المخاطر الحرجة غير مغطاة و`public-site` بلا اختبارات |
| CI/CD | Red–Yellow | توجد اختبارات أساسية، لكن مسارات production وpublic وmigrations غير مغطاة بشكل صحيح |
| جاهزية تنظيف الكود الميت | Green | توجد مجموعات مرشحة بثقة عالية، لكن يجب حذفها على دفعات مع إعادة الفحص بعد كل دفعة |

## 3. النتائج الحرجة — الأولوية الأولى

### P0-01 — تعديلات الفواتير متاحة بلا مصادقة

- القراءة والإنشاء والاعتماد والرفض لا تستخدم dependency للمستخدم الحالي.
- هناك PIN افتراضي ثابت `"1234"`.
- الجدول المستخدم عبر SQL الخام يختلف عن ORM model.
- الكود يحاول تعديل `Invoice.final_amount` رغم أن الحقل غير موجود في `Invoice`.
- أي مستدعي قادر على قراءة طلبات التعديل أو إنشائها أو اعتمادها.

**الأدلة:**
- `backend/app/api/v1/endpoints/invoice_adjustment_requests.py:55`
- `backend/app/api/v1/endpoints/invoice_adjustment_requests.py:67`
- `backend/app/api/v1/endpoints/invoice_adjustment_requests.py:120`
- `backend/app/api/v1/endpoints/invoice_adjustment_requests.py:175`
- `backend/app/api/v1/endpoints/invoice_adjustment_requests.py:190`
- `backend/app/api/v1/endpoints/invoice_adjustment_requests.py:330`

### P0-02 — إعدادات المتجر قابلة للتغيير بلا مصادقة

- `GET` و`PUT` لا يطلبان `current_user`.
- تعريف `get_db` المحلي يمنع استخدام dependency override القياسي أثناء الاختبارات.
- الحقول تؤثر في العملة والضرائب والسماح بالسحب من الخزنة.

**الأدلة:**
- `backend/app/api/v1/endpoints/shop_settings.py:12`
- `backend/app/api/v1/endpoints/shop_settings.py:20`
- `backend/app/api/v1/endpoints/shop_settings.py:25`

### P0-03 — تصعيد صلاحيات عبر إدارة الموظفين

- `require_owner_or_manager` يسمح فعليًا لـ`manager` و`accountant`.
- إنشاء حساب موظف يقبل `role` كنص دون allowlist أو typed enum.
- التحديث يسمح بتغيير دور المستخدم إلى `owner` أو `admin` دون فحص تسلسل الأدوار.
- تغيير كلمة المرور لا يطبق سياسة القوة نفسها ولا يزيد `token_version`.

**الأدلة:**
- `backend/app/api/deps.py:23`
- `backend/app/schemas/employee.py:67`
- `backend/app/api/v1/endpoints/employees.py:125`
- `backend/app/api/v1/endpoints/employees.py:151`
- `backend/app/api/v1/endpoints/employees.py:217`
- `backend/app/api/v1/endpoints/employees.py:229`
- `backend/app/api/v1/endpoints/users_roles.py:102`

### P0-04 — مستندات الموظفين عامة، مع خطر Path Traversal

- كل مجلد uploads مقدم كـ`StaticFiles` عام.
- `file_type` واسم الموظف يدخلان اسم الملف دون تنظيف كامل لمسار الملفات.
- عملية الحذف لا تستخدم containment check.
- مستندات الهوية والعقد والبيانات الصحية قد تصبح متاحة عبر public URL.

**الأدلة:**
- `backend/app/main.py:122`
- `backend/app/main.py:142`
- `backend/app/api/v1/endpoints/employee_documents.py:55`
- `backend/app/api/v1/endpoints/employee_documents.py:77`
- `backend/app/api/v1/endpoints/employee_documents.py:85`
- `backend/app/api/v1/endpoints/employee_documents.py:121`

### P0-05 — Docker لا يستطيع الإقلاع بالإعدادات الحالية

- `Settings` يتطلب `FIRST_SUPERUSER_PASSWORD` ولا تمرره Compose.
- القيمة الافتراضية لـ`SECRET_KEY` أقصر من الحد المطلوب.
- تم تأكيد الفشل تحليليًا وبمحاكاة متغيرات البيئة دون تشغيل Docker.

**الأدلة:**
- `backend/app/core/config.py:18`
- `backend/app/core/config.py:20`
- `backend/app/core/config.py:33`
- `backend/app/core/config.py:94`
- `docker-compose.yml:10`

### P0-06 — Alembic يفشل على قاعدة فارغة

تم تشغيل سلسلة migrations على SQLite مؤقتة خارج المشروع. توقفت عند revision `4e2b6e9bb5a0` بالخطأ:

`no such table: employee_documents`

migration حاولت تعديل الجدول قبل إنشائه. كما توجد إشارات لاحقة إلى `employees` قبل وجود migration baseline صحيح لها. الاختبارات لا تكشف المشكلة لأنها تستخدم `Base.metadata.create_all` بدل migrations.

**الأدلة:**
- `backend/alembic/versions/4e2b6e9bb5a0_add_payroll_logic_and_documents_expiry.py:23`
- `backend/alembic/versions/0de75d6f3a31_unify_barber_to_employee.py:23`
- `backend/conftest.py:73`
- `backend/app/db/runtime_schema.py:30`

### P0-07 — Electron packaging قد يوزّع secrets وملفات runtime

- إعداد `extraResources` ينسخ `backend` كاملًا بدل allowlist ملفات البناء.
- سكربت Portable ينسخ المجلد كاملًا ولا يستبعد `.env`.
- وجود `backend/.env` محلي يجعل هذا المسار خطرًا حتى إذا كان الملف غير متتبع في Git.
- قواعد البيانات وuploads وملفات runtime قد تدخل الحزمة إذا كانت موجودة وقت البناء.

**الأدلة:**
- `frontend/package.json:44`
- `frontend/package.json:48`
- `frontend/build-portable.ps1:61`
- `frontend/build-portable.ps1:65`
- `.gitignore:1`

### P0-08 — Electron trust boundary ضعيف، والتحديث غير موقّع

- `webSecurity: false`.
- `allowRunningInsecureContent: true`.
- لا توجد سياسة allowlist للتنقل أو الروابط الخارجية.
- ZIP وملف version لا يوجد لهما signature أو hash verification.
- التحديث يستخرج الملفات مباشرة فوق application resources.

**الأدلة:**
- `frontend/electron-main.cjs:337`
- `frontend/electron-main.cjs:364`
- `frontend/electron-main.cjs:455`
- `frontend/electron-main.cjs:520`

### P0-09 — سلامة الفاتورة والمخزون غير مضمونة

- Schema يسمح بكميات وأسعار وخصومات سالبة.
- الخادم يثق في `unit_price` المرسل من العميل بدل جلب السعر من الكتالوج.
- split payments لا يتم التحقق من أن مجموعها يساوي إجمالي الفاتورة.
- POS edit mode يرسل `POST /invoices/manual` بدل update أو void semantics.
- رقم الفاتورة يُشتق من `count + 1` وهو معرض للتكرار عند التزامن.
- لا توجد idempotency marker لخصم المخزون.

**الأدلة:**
- `backend/app/schemas/invoice.py:8`
- `backend/app/schemas/invoice.py:23`
- `backend/app/api/v1/endpoints/invoices.py:33`
- `backend/app/api/v1/endpoints/invoices.py:151`
- `backend/app/api/v1/endpoints/invoices.py:181`
- `backend/app/api/v1/endpoints/invoices.py:218`
- `backend/app/services/inventory_service.py:58`
- `frontend/src/pages/cashier/POS/components/CheckoutBar.tsx:87`
- `frontend/src/pages/cashier/POS/components/CheckoutBar.tsx:157`

### P0-10 — Seed تلقائي ينشئ حسابًا بكلمة مرور ثابتة

- startup يستدعي `seed_data()` تلقائيًا.
- seed ينشئ مستخدم `accountant` بكلمة مرور ثابتة `"252525"`.

**الأدلة:**
- `backend/app/main.py:21`
- `backend/app/main.py:24`
- `backend/app/db/seed.py:33`
- `backend/app/db/seed.py:36`

## 4. النتائج High

### H-01 — WebSocket بلا مصادقة

- endpoint يقبل `user_id` من URL.
- العميل يستطيع إرسال `targetId` ورسالة.
- endpoint الإشعارات وservice events يستخدمان connection managers مختلفة.
- تعليم إشعار كمقروء يعتمد على role بدل user ID.

**الأدلة:**
- `backend/app/api/v1/endpoints/notifications.py:96`
- `backend/app/api/v1/endpoints/notifications.py:106`
- `backend/app/api/v1/endpoints/notifications.py:111`
- `backend/app/services/websocket.py:6`
- `backend/app/api/v1/endpoints/appointments.py:46`
- `backend/app/api/v1/endpoints/invoices.py:27`

### H-02 — ترتيب Providers يوقف SalonContext

- `SalonProvider` موضوع قبل `SocketProvider`.
- `SalonContext` يقرأ القيمة الافتراضية `null` من SocketContext ثم لا ينفذ `loadAll`.
- `PreferencesContext` لديه اعتماد مشابه.

**الأدلة:**
- `frontend/src/App.tsx:23`
- `frontend/src/App.tsx:25`
- `frontend/src/App.tsx:26`
- `frontend/src/context/SalonContext.tsx:64`
- `frontend/src/context/SalonContext.tsx:154`
- `frontend/src/context/PreferencesContext.tsx:103`
- `frontend/src/context/PreferencesContext.tsx:239`

### H-03 — عقود الخدمات غير متسقة

- بعض services تعيد `AxiosResponse` وبعضها يعيد raw data أو normalized result.
- `SalonContext.toArray()` لا يفك `AxiosResponse`، لذلك services قد تبقى فارغة حتى بعد إصلاح ترتيب providers.

**الأدلة:**
- `frontend/src/services/serviceService.ts:3`
- `frontend/src/services/sessionService.ts:3`
- `frontend/src/services/customerService.ts:4`
- `frontend/src/services/invoiceService.ts:4`
- `frontend/src/context/SalonContext.tsx:56`
- `public-site/src/context/SalonContext.tsx:47`

### H-04 — عقود Pagination مكسورة في المخزون والحجوزات

- Frontend يرسل `page,size` بينما Backend يتوقع `page,page_size`.
- صفحة المخزون قد تعيد الصفحة الأولى عند تغيير رقم الصفحة.
- الإحصائيات تحسب من الصفحة الحالية بدل كامل النطاق.
- توجد اختلافات مشابهة في bookings.

**الأدلة:**
- `frontend/src/features/inventory/hooks/useInventoryData.ts:75`
- `frontend/src/features/inventory/hooks/useInventoryData.ts:79`
- `frontend/src/features/inventory/hooks/useInventoryData.ts:149`
- `backend/app/api/v1/endpoints/products.py:41`
- `backend/app/api/v1/endpoints/products.py:50`

### H-05 — عدة endpoints مكسورة أو غير متسقة مع Models

| المسار | التعارض |
|---|---|
| Walk-in queue | `Optional` غير مستورد، و`barber_id` في endpoint/schema بينما model يستخدم `employee_id` |
| Reviews | endpoint/schema يستخدمان `barber_id` بينما model وrelationship يستخدمان `employee_id` |
| Search | `Invoice.final_amount` و`Product.price` غير موجودين في models |
| Discount approval | يكتب حقول invoice غير موجودة |
| Salary advances | ينشئ Expense بحقول `is_advance` و`employee_id` غير موجودة |
| Notifications | service ترسل `type` إلى model لا يحتويه |
| Exports | تشير إلى `Invoice.employee` و`Appointment.employee` بينما relationship الفعلية `barber` |
| Waitlist | غير mounted، ويشير إلى helper غير موجود |

**أبرز الأدلة:**
- `backend/app/api/v1/endpoints/walk_in_queue.py:3`
- `backend/app/api/v1/endpoints/walk_in_queue.py:91`
- `backend/app/models/walk_in_queue.py:17`
- `backend/app/api/v1/endpoints/reviews.py:31`
- `backend/app/models/review.py:14`
- `backend/app/api/v1/endpoints/search.py:79`
- `backend/app/api/v1/endpoints/discount_approvals.py:137`
- `backend/app/api/v1/endpoints/salary_advances.py:61`
- `backend/app/services/notification_service.py:16`
- `backend/app/models/notification.py:8`
- `backend/app/api/v1/endpoints/exports.py:460`
- `backend/app/api/v1/endpoints/waitlist.py:221`

### H-06 — Refresh token لا يقارن version بقيمة المستخدم الحالية

- access token يتحقق من `token_version`.
- refresh token لا يقارن claim `ver` بالقيمة الحالية في `User`.
- بعض مسارات تغيير كلمة المرور لا تزيد version.

**الأدلة:**
- `backend/app/api/deps_auth.py:44`
- `backend/app/api/v1/endpoints/auth.py:117`
- `backend/app/api/v1/endpoints/auth.py:165`
- `backend/app/api/v1/endpoints/users_roles.py:121`
- `backend/app/api/v1/endpoints/profile.py:103`

### H-07 — RBAC مركزي موجود لكنه غير مفعّل

- `PERMISSION_MATRIX` و`has_permission` لا يظهر استخدام لهما خارج ملف التعريف.
- services وoffers وcategories تسمح لأي staff بكتابة الكتالوج والأسعار.

**الأدلة:**
- `backend/app/core/rbac.py:19`
- `backend/app/core/rbac.py:52`
- `backend/app/api/v1/endpoints/services.py:177`
- `backend/app/api/v1/endpoints/offers.py:209`
- `backend/app/api/v1/endpoints/service_categories.py:42`

### H-08 — خصم المخزون قد يتكرر

- إنشاء session قد يخصم ingredients.
- إكمال session يخصم session products مرة أخرى.
- إصدار invoice قد يخصم ingredients الخاصة بالخدمة مرة ثالثة.
- لا توجد idempotency key أو unique reference لكل movement.

**الأدلة:**
- `backend/app/services/session_service.py:32`
- `backend/app/api/v1/endpoints/sessions.py:142`
- `backend/app/api/v1/endpoints/appointments.py:1050`
- `backend/app/services/inventory_service.py:58`

### H-09 — الموقع العام يستدعي APIs غير موجودة في Backend الحالي

- member login/register/history تستدعي endpoints لا يوجد لها route في مستودع Backend.
- published website snapshot مخزن في Backend، لكن public catalog لا يقرأه.

**الأدلة:**
- `public-site/src/context/MemberAuthContext.tsx:68`
- `public-site/src/context/MemberAuthContext.tsx:88`
- `public-site/src/components/landing/MemberHistorySection.tsx:50`
- `backend/app/api/v1/api.py:1`
- `backend/app/api/v1/endpoints/business_settings.py:115`

### H-10 — CI لا يغطي سلوك الإنتاج الفعلي

- لا توجد بوابة لـ`public-site`.
- لا يوجد migration clean-room test.
- E2E config يستخدم Windows `.venv` داخل Ubuntu runner.
- a11y workflow غير موجود في مجلد GitHub workflows للجذر.
- وظيفة Docker تبني الصور ولا تثبت أن التطبيق يقلع.
- `docker compose config` وحده لا يثبت أن container سيبدأ بنجاح.

**الأدلة:**
- `.github/workflows/ci.yml:9`
- `.github/workflows/ci.yml:72`
- `.github/workflows/ci.yml:95`
- `.github/workflows/ci.yml:116`
- `frontend/playwright.smoke.config.ts:30`

### H-11 — الاعتماديات تحتوي ثغرات معروفة

نتائج `npm audit --omit=dev` بتاريخ الفحص:

| الحزمة | العدد | أعلى مستوى |
|---|---:|---|
| Root | 24 | 8 high، 16 moderate |
| Frontend | 4 | 4 moderate |
| Public Site | 5 | 2 high، 3 moderate |

أهم الحزم المتأثرة:

- `axios`
- `form-data`
- `react-router` و`@remix-run/router`
- `uuid` عبر `exceljs`
- `extract-zip` و`brace-expansion` في root tooling
- OpenTelemetry dependencies عبر Lighthouse/Sentry

`pip-audit -r backend/requirements.txt` لم يجد ثغرات معروفة في dependencies المحددة.

## 5. النتائج المتوسطة

### M-01 — Frontend كبير ومتفرّع

- Route-level lazy loading موجود وهذا نمط إيجابي.
- توجد صفحات كبيرة مثل `PublicBooking.tsx` وصفحات التقارير المالية والإعدادات.
- feature barrels تستورد modules داخلية، ما ينتج 203 lint warnings.
- pages وcomponents وservices تتحدث مع features في اتجاهين.

**التوصية:** كل feature يملك `api/` و`components/` و`hooks/` و`schemas/` و`index.ts`، مع منع page imports من feature internals.

### M-02 — SalonContext يعمل كـglobal fetch-all

- `loadAll()` يحمّل settings وservices وbarbers وcustomers وsessions وinvoices وreports وdashboard وcashbox معًا.
- أغلب consumers لا يحتاج كل هذه البيانات.
- هذا Context مركزي على مستوى التطبيق، ويمكن تقسيمه إلى settings وbalances وdomain queries.

### M-03 — الموقع العام يحمل providers إدارية

`public-site/src/App.tsx` يركّب `AuthProvider` و`PreferencesProvider` و`SalonProvider` و`SocketProvider`، بينما public UI لا يحتاج staff session كاملًا. كما توجد 25 service files غير مستوردة.

### M-04 — i18n والعملة غير مكاملتين

- يوجد Language/Currency switchers.
- معظم النصوص مكتوبة مباشرة بالعربية.
- تبديل العملة لا يغيّر جميع الأسعار.
- توجد بيانات تقييم ثابتة في SEO لا مصدر لها في مراجعات حقيقية.

### M-05 — بيئة التشغيل والتوثيق غير موحدين

- production config وhosting target وsecret manager وbackups وmonitoring غير موثقة في مرجع واحد.
- README لا يطابق الإصدارات أو الأوامر الحالية.
- `README_RUN_PROJECT.md` يحتوي prompt residue وأوامر `git add .` و`git push` في نهايته.

**الأدلة:**
- `README_RUN_PROJECT.md:5`
- `README_RUN_PROJECT.md:35`
- `README_RUN_PROJECT.md:51`
- `README_RUN_PROJECT.md:102`
- `README_RUN_PROJECT.md:112`
- `README_RUN_PROJECT.md:192`

### M-06 — حزم Build كبيرة

- Frontend build نجح لكنه أنتج chunks كبيرة مثل reports وjsPDF وhtml2canvas.
- Public build نجح لكنه أنتج JS رئيسي بحوالي 422 KB قبل الضغط و144 KB بعد الضغط، وCSS بحوالي 317 KB قبل الضغط و42 KB بعد الضغط.
- لا توجد bundle budget أو performance gate.

### M-07 — بوابة Accessibility غير موثوقة

- `lint:a11y` فشل على Windows بسبب quoting داخل script.
- `public-site` lint فشل لأن ESLint غير معلن في dependencies.
- a11y unit tests تمر، لكن بعض assertions ضعيفة، وE2E يحتاج login fixture لمسارات محمية.

### M-08 — Scheduler وrate limiting داخل الذاكرة

- APScheduler يبدأ داخل كل process.
- rate limiter وlockout في الذاكرة.
- multi-worker أو replicas قد تكرر jobs أو تتجاوز حدود معدل الأمان.

**الأدلة:**
- `backend/app/main.py:88`
- `backend/app/core/rate_limit.py:11`
- `backend/app/core/account_lockout.py:4`

## 6. نتائج منخفضة

- `public-site/index.html` يشير إلى `/src/main.jsx` بينما الملف `main.tsx`، لكن نسخة Vite الحالية تعالج ملف المصدر بنجاح. يبقى الخلل مجرد عدم اتساق في التسمية.
- `.gitignore` لا يغطي `frontend/.env` و`public-site/.env` بصورة عامة، ولا يغطي كل reports وcoverage files.
- التسميات مختلطة بين snake_case وcamelCase في payloads وcontracts.
- اختبارات Backend المحلية استخدمت Python 3.14.3، بينما Docker وCI يستهدفان 3.12؛ يجب توحيد الإصدار.
- كان `backend/salon_pro.db` متتبعًا تاريخيًا، و`backend/salon_pro.db-shm` ما زال متتبعًا في HEAD رغم أنه محذوف محليًا. يجب التعامل مع هذا كحالة نظافة بيانات وفحص history دون كشف محتوى البيانات.
- ملف `.env` الحقيقي غير متتبع، ولم يظهر private key أو AWS access key pattern في الملفات المتتبعة المفحوصة.

## 7. نتائج الفحوص الفعلية

| الفحص | النتيجة |
|---|---|
| Backend tests | **164 passed، 185 warnings** |
| إصدار Python المحلي | 3.14.3 |
| Frontend typecheck | Pass |
| Frontend lint | 0 errors، **203 warnings** |
| Frontend unit tests | **32 passed** |
| Frontend a11y tests | **16 passed** مع console noise |
| Frontend Vite build | Pass، 3220 modules |
| Public TypeScript | Pass |
| Public Vite build | Pass، 1768 modules |
| Public lint | **Fail: ESLint غير موجود** |
| Alembic empty DB | **Fail عند revision `4e2b6e9bb5a0`** |
| Docker config runtime | تعذر التشغيل: Docker CLI غير مثبت |
| Docker environment validity | **Fail مؤكد من Settings** |
| Backend pip audit | No known vulnerabilities |
| Frontend npm audit | 4 moderate |
| Public npm audit | 5 total: 2 high، 3 moderate |
| Root npm audit | 24 total: 8 high، 16 moderate |
| git diff --check | Pass مع warnings related to line endings |

### ملاحظة مهمة عن Python 3.12

اختبارات Python 3.14 تمر، لكن `walk_in_queue.py` يستخدم `Optional` دون import. في Python 3.12 المستهدف من Docker، فإن التقييم الفوري للـannotations يجعل هذا ImportError محتملًا وقت 정의 endpoint. يلزم تشغيل import check على 3.12 بعد تجهيز environment.

## 8. الملفات والأكواد الميتة

أظهر فحص import graph وrouters حوالي **145 ملف source مرشح عالي الثقة** بما يقارب **14,200 سطر**. الرقم تقريبي ويجب تحديثه بعد كل wave.

### Wave A — مرشحو حذف مستقلون عاليو الثقة

| النطاق | الحجم التقديري | الثقة | ملاحظات |
|---|---:|---|---|
| `frontend/src/pages/cashier/customers/*` | 5 files / 1,481 lines | عالية | جزيرة قديمة مستبدلة بـ`features/customers` |
| `frontend/src/pages/manager/Attendance/*` | 13 / 1,122 | عالية | جزيرة قديمة مستبدلة بـ`features/attendance` |
| `frontend/src/components/dashboard/*` | 3 / 378 | عالية | لا production imports |
| `frontend/src/components/auth/*` | 2 / 73 | عالية | router يستخدم route guards الحالية |
| `frontend/src/hooks/{useDebounce,usePaginatedList,usePagination,usePosShift}.ts` | 4 / 390 | عالية | لا imports حية |
| `frontend/src/context/ThemeContext.tsx` | 1 / 14 | عالية | Preferences هو المصدر الفعلي |
| `frontend/src/components/shared/*` | 19 files / ~2,000 | عالية | مجموعة غير مستخدمة، مع ضرورة عدم لمس shared components الحية |
| `frontend/src/components/charts/ReportsCharts.tsx` | 1 / 239 | عالية | duplicate غير referenced |
| `frontend/src/components/pos/ReadyBookingsForPosPanel.tsx` | 1 / 216 | عالية | غير مستخدم |
| locale files غير `common.json` | 14 / 952 | عالية | لا resources references |
| `public-site/src/components/landing/*` غير المستخدم | 22 / 3,119 | عالية | لا graph references |
| `public-site/src/hooks/{useABTest,useRealtimeBooking}.tsx` | 2 / 341 | عالية | يعتمدان على جزيرة landing الميتة |
| `public-site/src/services/*` غير referenced | 25 / 794 | عالية | لا تحذف contexts أولًا |
| `backend/app/api/dependencies/{auth,roles}.py` | 2 / 22 | عالية | PyJWT هو التنفيذ الفعلي |
| `backend/app/schemas/barber.py` | 1 / 27 | عالية | لا imports |
| `backend/app/api/v1/endpoints/waitlist.py` مع schema | 2 / 325 | عالية للـsource | غير mounted؛ لا يشمل model |
| `backend/prisma.config.ts` | 1 | عالية كـlegacy | لا Prisma schema ولا scripts |

### Wave B — Barrels وdownstream utilities

لا تحذفها قبل تتبع dependencies:

- `frontend/src/components/ui/{Avatar,EmptyState,Panel,Sidebar,date-picker,time-picker,Toast}.tsx` تصل إلى graph عبر barrel فقط.
- `frontend/src/lib/export/*`: 5 ملفات / 442 سطرًا.
- `frontend/src/lib/theme/*`: 3 ملفات / 117 سطرًا.
- `frontend/src/lib/format/*`: 4 ملفات / 319 سطرًا.
- `frontend/src/lib/domain/{bookings,index}.ts`: نحو 350 سطرًا.
- `frontend/src/lib/access/{index,navigation,permissions}.*` و`lib/money/finance.ts` بعد إزالة consumers.
- بعد حذف `lib/export/activityLogExcel.ts` يمكن فحص `exceljs` كـdependency غير مستخدمة.

### Wave C — مشروط، لا يحذف مباشرة

- `public-site/public/pages/*`: 3 ملفات / 1,943 سطرًا؛ غير مستخدم داخل graph لكنه ينسخ إلى deployment كملفات static، ولذلك يحتاج deep-link audit أولًا.
- `backend/app/api/v1/endpoints/admin.py`: 90 سطرًا؛ router mounted ويحتوي stubs، ولا يمكن اعتباره ميتًا تلقائيًا.
- public contexts والخدمات المرتبطة بها لا يمكن حذفها دفعة واحدة؛ أزل mounting أولًا ثم أعد graph search.
- Barber aliases/endpoints ليست ميتة، لأن أجزاء منها مستخدمة فعليًا.

### Generated أو Recreatable — ليست source cleanup

| النطاق | التقدير | الملاحظة |
|---|---:|---|
| root + frontend + public `node_modules` | ~1.10 GiB | قابل لإعادة التثبيت، لكن لا تحذفه إذا تحتاجه الآن |
| root + backend virtualenvs | ~306 MB | backend venv مستخدم في smoke config |
| root test DBs | 13 ملف db/wal/shm | تُعامل كل مجموعة كوحدة cleanup |
| backend stale test DBs | توجد عدة ملفات | توجد db وwal وshm من process runs سابقة |
| `.pytest_cache` و`__pycache__` | متعدد | generated |
| `chromewebdata_...report.html` | untracked | تقرير فيه `CHROME_INTERSTITIAL_ERROR`؛ صالح للتنظيف |
| `dist/` وbuild outputs | متعدد | generated، لا يثبت سلامة source |

### ملفات لا يجوز حذفها كـdead

- `backend/salon_pro.db` وأي WAL/SHM؛ نحتاج backup قبل لمسه.
- `SalonPro_External/**` وuploads وملفات PDF وقت التشغيل.
- Alembic versions والاختبارات وملفات build configuration.
- Barber/Employee aliases التي ما زالت مستخدمة.
- `backend/app/models/waitlist_entry.py`؛ ما زال مستخدمًا في customer deletion guard.
- ملفات PWA مثل `sw.js` وworker وredirects وheaders.

## 9. الشكل المقترح للمشروع

لا يُنصح بنقل كل شيء دفعة واحدة. الهدف هو حدود واضحة وتقليل التكرار:

```text
Salon-Management-Pro/
  backend/
    app/
      api/v1/routers/
      core/
      models/
      schemas/
      policies/
      services/
      repositories/
      integrations/
    alembic/
    tests/
  frontend/
    src/
      app/
      features/<domain>/
        api/
        components/
        hooks/
        schemas/
        index.ts
      shared/
        api/
        ui/
        lib/
        types/
  public-site/
    src/
      app/
      features/public-booking/
      shared/
  packages/contracts/
  packages/config/
```

### قواعد مقترحة

1. الـEndpoint مسؤول عن validation والمصادقة واستدعاء use case فقط.
2. Service مسؤول عن business rules والtransaction.
3. Repository مسؤول عن persistence queries.
4. Policy واحد مركزي للصلاحيات، دون تكرار role lists.
5. لا يُقبل سعر أو خصم من العميل دون تحقق من الخادم.
6. Alembic هو source of truth في production؛ لا `create_all` كبديل صامت.
7. OpenAPI يحدد API response shapes، وتولد TypeScript types منه.
8. `public-site` لا يركب staff/admin contexts.
9. Services تعيد DTO/result موحدًا، لا `AxiosResponse` أو raw response بشكل متغير.
10. لا يدخل أي ملف إلى feature بلا `index.ts` وpublic API واضح.

## 10. خطة التنفيذ المقترحة

### Phase 0 — Baseline والبيانات

1. حفظ baseline للعمل الحالي في commit أو branch مستقل.
2. أخذ backup من `SalonPro_External` وقاعدة البيانات.
3. تسجيل `git status` وHEAD وhash للملفات الحساسة.
4. عدم استخدام `git add .` أو حذف جماعي.

### Phase 1 — Security P0

1. حماية invoice-adjustment وshop-settings أو تعطيل المسارات العامة فورًا.
2. إصلاح RBAC ومنع تصعيد الأدوار.
3. نقل employee documents إلى private authenticated storage.
4. إضافة مصادقة WebSocket حقيقية وconnection manager واحدة.
5. إصلاح refresh token version.
6. إزالة fixed credentials وحساب seed في production.
7. منع packaging لـ`.env` وDB وملفات runtime.
8. إعادة ضبط Electron web security وتوقيع updates.

### Phase 2 — البناء وقاعدة البيانات

1. إصلاح Alembic clean install.
2. إضافة migration test من empty DB وproduction snapshot.
3. توحيد Python 3.12 بين local وCI وDocker.
4. إصلاح walk-in import/model contract.
5. توحيد env names بين code و`.env.example` وCompose.
6. إضافة public lint وtypecheck وbuild إلى CI.
7. إضافة container startup smoke test.

### Phase 3 — الفواتير والمخزون

1. إنشاء Invoice use case واحدة لكل manual/draft/appointment/edit.
2. جلب الأسعار من server catalog.
3. التحقق من الكمية والسعر والخصم ومجموع split.
4. جعل cashbox وloyalty وstock داخل transaction ذري.
5. إضافة idempotency لinvoice finalization وpayment وpayroll.
6. إنشاء inventory movement ledger مع unique source reference.
7. إضافة database constraints وتسلسل آمن لأرقام الفواتير.

### Phase 4 — Frontend Architecture

1. إصلاح provider order.
2. توحيد API adapters.
3. تقسيم SalonContext.
4. إصلاح inventory/bookings contracts.
5. تنظيم feature public APIs وتقليل 203 warnings.
6. إزالة staff contexts من public-site تدريجيًا.
7. تقسيم الصفحات الكبيرة حسب workflow.

### Phase 5 — إزالة الكود الميت

1. تنفيذ Wave A فقط.
2. تشغيل typecheck والاختبارات والـbuild بعد Wave A.
3. تنفيذ Wave B بعد تقصير barrels.
4. إعادة dead-code graph بعد كل wave.
5. تنفيذ Wave C بعد deep-link وAPI confirmation.
6. تنظيف generated files في النهاية وبعد إيقاف processes.

### Phase 6 — الاعتماديات والتوثيق

1. تحديث `axios` و`form-data` وReact Router وUUID.
2. تحديث root tooling أو نقل Lighthouse إلى dev-only package.
3. إضافة bundle budget.
4. استبدال README الحالي إلى runbook واضحًا ومتسقًا مع المشروع.
5. إضافة CodeQL وdependency scanning وsecret scanning.
6. توثيق backup/restore/rollback.

## 11. ترتيب الأولويات التنفيذي

| الترتيب | المهمة | السبب |
|---:|---|---|
| 1 | حماية invoice adjustment وshop settings | مسار كتابة مباشرة بلا مصادقة |
| 2 | إصلاح role escalation وWebSocket | تصعيد الصلاحيات وانتحال الإشعارات |
| 3 | private documents ومنع packaging secrets | تسريب بيانات وبيانات اعتماد |
| 4 | إصلاح Alembic وDocker config | clean install ونشر |
| 5 | invoice/stock invariants | سلامة مالية |
| 6 | إصلاح frontend providers/contracts | منع بيانات فارغة أو متكسرة |
| 7 | dead-code Wave A | خفض الضوضاء بأقل خطر |
| 8 | public API gaps وElectron hardening | إكمال المنتج والتوزيع |
| 9 | CI والاعتماديات | منع regressions |
| 10 | cleanup ووثائق | استدامة لاحقة |

## 12. Definition of Done

- لا يوجد endpoint كتابة حساسة بلا auth وصلاحية على مستوى object.
- لا توجد fixed production credentials.
- الملفات الحساسة لا تُخدم من static public path.
- Docker يبدأ من clean checkout وenvironment واضح.
- `alembic upgrade head` ينجح على empty DB وعلى production snapshot.
- قواعد الفاتورة مغطاة باختبارات negative وatomicity وidempotency.
- المخزون لا يتضاعف خصمه في session إلى invoice paths.
- Frontend typecheck وlint دون أخطاء، مع warning budget متفق عليه.
- `public-site` لديه lint وtypecheck وtests وbuild في CI.
- E2E يستخدم Python portable ويعمل على Ubuntu.
- لا توجد ملفات DB/runtime متتبعة، ومخاطر history موثقة.
- كل wave من dead-code removal يمر بالاختبارات والـbuild، ولا يتم حذف جماعي في خطوة واحدة.

## 13. حدود الثقة والفحوص غير المنفذة

- **ثقة عالية:** static evidence المباشر، npm/pip audit، Frontend typecheck، Alembic temp failure، Settings failure، git status، وimport graph.
- **ثقة متوسطة:** النتائج التي تعتمد على runtime أو deployment target غير متاح، مثل Electron packaged mode وPython 3.12 import وDocker image startup.
- **قبل بدء التنفيذ:** لم يكن هناك تعديل كود أو حذف ملفات أو تطبيق migrations على بيانات production. بعد بدء التنفيذ، ما زالت تشغيل Docker، اختبارات packaging، واختبار production providers غير منفذة.
- **Baseline risk:** كان هناك WIP كبير قبل التقرير؛ أي تنفيذ يجب أن يبدأ من snapshot ثابت.

## 14. الخلاصة النهائية

المشروع قابل للتحسين والتنظيم، لكنه لا يجب أن يبدأ تنظيفًا جماعيًا قبل إصلاح security وfinancial وmigration blockers. أفضل مسار هو:

**snapshot ثابت → إصلاح P0 → migrations نظيفة → سلامة الفواتير → توحيد contracts → حذف الكود الميت على دفعات → تقوية CI والاعتماديات.**

ترتيب الإصلاحات أهم من عدد الملفات المحذوفة؛ لأن الحذف قبل تثبيت السلوك والعقود قد يخفي Bugs ولا يعالجها.

## 15. سجل التنفيذ — تحديث 24 سبتمبر 2026

### المنفذ

- تم تنفيذ Phase 0: حفظ backup خارج المستودع، وتسجيل baseline، وعدم تطبيق migrations على قاعدة الإنتاج.
- تم securing مسارات تعديل الفواتير وإعدادات المتجر، وإزالة PIN الثابت من Backend والواجهات.
- تم إصلاح RBAC وتصعيد الأدوار، وتوحيد مصادقة WebSocket، وإبطال refresh tokens بعد تغيير كلمة المرور.
- تم جعل مستندات الموظفين خاصة وإزالة static public mount لمسار documents.
- تم تقوية Electron: `sandbox` و`contextIsolation` و`webSecurity`، allowlist للتنقل، تحقق من hash/tوقيع التحديث، ومنع extraction غير الموثوق.
- تمت إضافة `frontend/scripts/prepare-update.mjs` و`.github/workflows/electron-release.yml` للتوقيع بـEd25519 من GitHub secrets، مع إخراج `version.json` وpublic key artifact؛ لم يتم وضع private key في repo.
- تم إصلاح provider order في `frontend/src/App.tsx`: `SocketProvider` قبل `PreferencesProvider` و`SalonProvider` حتى يتم تحميل salon data عند تسجيل الدخول.
- تم إغلاق فجوة H-09 بإضافة member auth منفصلة للعميل (`/public/member/register|login|me|bookings|logout`) مع password hash، token versioning، rate limiting، object-level booking ownership، وربط الحجز العام بالحساب عند توافر token.
- تم إصلاح import/response contract في `walk_in_queue.py` بإضافة `Optional` وResponse dependency، ونجح OpenAPI generation بعد إصلاحه.
- تم إصلاح `frontend/playwright.smoke.config.ts` ليختار `python` على Ubuntu و`.venv/Scripts/python.exe` على Windows بدل تثبيت Windows path داخل CI.
- تم جعل `frontend/build-portable.ps1` portable عبر `$PSScriptRoot` بدل مسار مستخدم مطلق.
- تم تفعيل accessibility gate من `.github/workflows/accessibility.yml`، وإضافة `eslint-plugin-jsx-a11y` وتثبيت static lint اختباره؛ lint:a11y يمر الآن بـ`0 errors` مع warnings legacy.
- تم تصحيح public API interceptor لئلا يستبدل staff token طلبات member token الصريحة.
- تم تصحيح public-site entry point من `main.jsx` إلى `main.tsx`، وإضافة deployment contract tests للمسارات وsecurity headers وAPI proxy.
- تم تحديث CI ليشمل public-site lint/typecheck/build/contracts وclean-room `alembic upgrade head`، وتحديث Docker Compose لاستخدام متغيرات أسرار صريحة وتشغيل migrations قبل Uvicorn.
- تم توحيد `backend/.env.example` مع أسماء Settings الفعلية (`SECRET_KEY`, `FIRST_SUPERUSER_PASSWORD`, CORS/hosts, SQLite URL) وإزالة المتغيرات المهجورة.
- تم تحديث dependencies: `axios` إلى `1.20.0`، `react-router-dom` إلى `7.18.4`، `lighthouse` إلى `13.5.0`، وVitest إلى `4.1.11` المتوافق مع Node 20؛ وأضيف override آمن لـ`uuid` داخل ExcelJS.
- أصبح `npm audit --omit=dev --audit-level=high` نظيفًا في root وfrontend وpublic-site.
- تم إضافة `docker-smoke.ps1` لفحص Compose وبدء/فحص backend وfrontend وإيقاف stack المؤقت تلقائيًا.
- تم استبعاد `.env` وملفات DB وuploads/logs من electron-builder والـportable script.
- تم تعطيل مسار POS edit/reissue غير الآمن من الواجهة، وإزالة واجهة manager PIN.
- تم إنشاء migrations `f2c7a9d4e1b0_secure_p0_schema.py` و`a9d1e2f3b4c5_invoice_idempotency_keys.py` و`b8e2f3a4c5d6_invoice_number_counters.py` و`c5d6e7f8a9b0_cleanup_legacy_fk_constraints.py` و`d6e7f8a9b0c1_public_member_accounts.py`، وتُزيل فيها legacy column باسم `manager_approval_pin`، وتضيف offer/idempotency/counter/public-member schema، وتُصلح legacy FKs على نسخة فقط.
- تم hardening لنسخ الفاتورة اليدوية والمسودات: server-side catalog pricing، تحقق من المرجع والكمية والخصم، دعم offer pricing، وحفظ split payment legs في `invoice_payments`.
- تم إضافة `Idempotency-Key` scoped to creator مع request hash، وإعادة نفس النتيجة بدل تكرار الفاتورة والمخزون الخزينة.
- تم استبدال `count + 1` بجدول daily invoice counters مع upsert/lock، وتهيئة الأرقام الموجودة مسبقًا في migration.
- تم تجهيز non-destructive FK cleanup: إزالة legacy `barbers` constraints، حفظ invalid product IDs في `invoice_items_legacy_product_refs`، وتجربة downgrade دون loss للـbackup.
- تم منع خصم المخزون السالب، وإنشاء cash transaction leg مستقل لكل split بدل اعتبارها duplicate. وتкорين cash transaction legs بدل اعتبارها duplicate.

### نتائج التحقق

- Backend: `190 passed`.
- Regression P0: `11 passed`.
- Frontend: `32 passed`، مع successful serial Vitest run بعد React Router/Vitest updates.
- Frontend typecheck وbuild: ناجحان.
- Frontend accessibility unit tests: `16 passed`.
- Frontend lint: `0 errors` و`203 warnings` القائمة؛ `lint:a11y` يمر بـ`0 errors`.
- public-site lint: ناجح مع `0 errors` و`11 warnings`؛ typecheck وVite build ناجحان، و`test:contracts`: `4 passed`.
- CI YAML وDocker Compose YAML وPowerShell smoke script parsing: ناجحان.
- Root/frontend/public-site production dependency audit: `0 vulnerabilities` لكل حزمة.
- migration: نجح `alembic upgrade head` على empty SQLite حتى `d6e7f8a9b0c1`، و`PRAGMA integrity_check` نجح، وsecond upgrade كان no-op؛ كما نجحت b7 → head على snapshot مع بقاء row counts والـbackup.
- public member auth tests: `6 passed`، مع اختبار registration/login/me/logout، عدم كشف account state، ownership، booking association، وauthentication.
- Signed-update preparation test using a temporary Ed25519 key passed; missing-key execution fails closed with `UPDATE_SIGNING_PRIVATE_KEY is required`.
- Electron static checks: `node --check`، parse لـ`package.json`، parse للـPowerShell script، و`electron-builder --dir` نجحت؛ والـoutput لا يحتوي `.env` أو DB أو uploads/logs.

### المتبقي

- clean Alembic chain نجح بعد repair revision `c4d8e1f2a3b4`؛ نسخة production قبل cleanup كانت عند `b7e2f1a9c4d0` وتنتقل إلى `d6e7f8a9b0c1`، وكانت تكشف `58` مخالفة legacy FK؛ بعد cleanup على copy يصبح `PRAGMA foreign_key_check = 0`.
- Docker غير متاح في البيئة، لذلك تم التحقق من الصياغة فقط ولم يتم تشغيل startup smoke test الحقيقي.
- بدأ تنفيذ release: syntax/workflow جاهزان، و`prepare-update` يفشل بأمان بدون مفتاح؛ التنفيذ متوقف على `UPDATE_SIGNING_PRIVATE_KEY` و`UPDATE_SIGNING_PUBLIC_KEY` ثم وسم الإصدار.
- invoice/stock: تم إغلاق الفجوات الأساسية للـmanual/draft pricing وsplit/stock وإضافة idempotency وdaily counters؛ ما زال appointment issuance concurrency يحتاج مراجعة.
- frontend contracts: تم إصلاح provider order وinventory/HR pagination؛ bookings متوافق، وما زالت بقية العقود غير الـpagination تحتاج مراجعة.
- CI/CD وpublic-site contracts تم إضافتهما؛ ما زالت remote workflow execution غير متاحة محليًا.
- أُعيد فحص dead-code graph قراءةً فقط؛ لم يتم حذف أي WIP أو مرشح غير مؤكد.
- لم يتم تطبيق migration على قاعدة الإنتاج؛ يتطلب ذلك rollback plan ومراجعة يدوية.
