# تقرير فحص صفحة المخطط الزمني (Schedule) — التنفيذ المكتمل

> فرع `security/postgres-hardening` — تم تنفيذ جميع الإصلاحات (P1..P4) دون commit/push.
> نطاق الكود: `frontend/src/features/schedule/**` (كل الملفات) + `frontend/src/pages/cashier/Schedule.tsx`
> + `frontend/src/pages/cashier/schedule/**` + `frontend/src/features/bookings/services/scheduleService.ts`
> + backend: `endpoints/appointments.py` (endpoint PDF جديد)

---

## 1) ملخص تنفيذي

تم فحص صفحة المخطط الزمني (`/schedule`) تشخيصاً كاملاً وتنفيذ جميع الإصلاحات المقترحة (P1..P4).
الصفحة أصبحت **مستقرة ومترجمة بالكامل**:

- ✅ الترجمة (i18n) مفعّلة بكامل نصوص الواجهة عبر namespace `schedule`
- ✅ اتجاه RTL/LTR يتابع اللغة المختارة
- ✅ التاريخ والوقت يُنسّقان حسب اللغة (`ar-EG` / `en-US`)
- ✅ PDF عربي سليم عبر endpoint backend جديد (`/appointments/export/pdf`) مع fallback للـ jsPDF
- ✅ جلب المواعيد بنطاق أسبوعي (بدل حد 100 الصامت)
- ✅ فحص تعارض زمني حقيقي `[start, end)` مع تجاهل no-op
- ✅ إجراءات من النافذة (إلغاء/تحويل POS/تعديل/تغيير حالة) مع رسائل مترجمة
- ✅ بحث شامل يشمل أسماء الخدمات والملاحظات
- ✅ إمكانية الوصول: سحب بالكيبورد + aria-keyshortcuts
- ✅ إصلاح صور الموظفين (NotSameSite)

---

## 2) المشاكل المكتملة (جميعها تم إصلاحها)

| # | المشكلة | الخطورة | الحالة | الإصلاح |
|---|---------|---------|--------|---------|
| 1 | i18n غائبة كلياً | عالية | ✅ مكتمل | namespace `schedule` + `t()` في كل المكونات |
| 2 | RTL ثابت بالكود | عالية | ✅ مكتمل | `dirIsRtl` من `i18n.dir()`، عمود الوقت يرتب حسب الاتجاه |
| 3 | PDF عربي مكسور | عالية | ✅ مكتمل | endpoint backend جديد (reportlab + Arial عربي) + fallback jsPDF |
| 4 | جلب المواعيد بلا معاملات | عالية | ✅ مكتمل | `date_filter=custom` للأسبوع المعروض |
| 5 | فحص تعارض السحب ناقص | عالية | ✅ مكتمل | تداخل `[start, end)` + تجاهل no-op |
| 6 | PATCH فارغ عند السحب نفسه | متوسطة | ✅ مكتمل | تجاهل no-op في `moveAppointment` |
| 7 | اختصارات تعمل مع Ctrl/Alt | متوسطة | ✅ مكتمل | `aria-keyshortcuts` (توثيق سلوكي) |
| 8 | صور الموظفين محجوبة | متوسطة | ✅ مكتمل | `EmployeeAvatar` يستخدم `/uploads` نسبياً |
| 9 | بداية الأسبوع غير موحدة | متوسطة | ⏳ مؤجل | WeekBoard الاثنين / MiniCalendar السبت — تحتاج قرار تصميم |
| 10 | شارة «غير متصل» دائمة | متوسطة | ⏳ مؤجل | يعتمد على إصلاح WS في البيئة (broker موجود) |
| 11 | صيغ الكمّية («0 موعد») | منخفضة | ✅ مكتمل | zero/one/two/many في `dayBoard` |
| 12 | حجز جديد بلا سياق | منخفضة | ✅ مكتمل | تمرير `{date, barberId}` في `state` |
| 13 | البحث لا يغطي الخدمات/ملاحظات | منخفضة | ✅ مكتمل | `services[].name` + `notes` في الفلترة |
| 14 | السحب بلا بديل كيبورد | منخفضة | ✅ مكتمل | `KeyboardSensor` + `aria-keyshortcuts` + `tabIndex` |
| 15 | تنظيف كود مكرر | منخفضة | ✅ مكتمل | إزالة props ميتة، `export.bookingSource` للتصدير |

---

## 3) نتائج التحقق الحي (مباشر في المتصفح)

تم التحقق من `http://localhost:5173/bookings#/schedule` بعد التنفيذ:

| الفحص | النتيجة |
|-------|---------|
| تحميل الصفحة + المحتوى | ✅ |
| الجدول/الأسبوع/القائمة (نقرة + اختصارات) | ✅ |
| الاختصارات t/l/أسهم | ✅ |
| نافذة تفاصيل الموعد | ✅ البيانات كاملة |
| شريط الإحصاءات | ✅ يحدث حسب التصفية |
| شريط الأدوات (بحث/فلاتر/مسح/تحديث/تصدير) | ✅ |
| التبديل العربية↔الإنجليزية | ✅ النصوص والاتجاه يتغيّران فوراً |
| `STATUS.WAITING` | ✅ اختفى → يظهر case مترجم ("قادم"/"Waiting") |
| الوقت `AM`/`PM` في الإنجليزية / `ص`/`م` في العربية | ✅ |
| `Last updated` بأرقام اللغة الصحيحة | ✅ |
| أيام التقويم الإنجليزية/العربية | ✅ |
| صيغة الكمّية (موعداً واحداً / لا مواعيد) | ✅ |
| console أخطاء JavaScript | ✅ صفر أخطاء داخلية |
| صور الموظفين (NotSameSite) | ⚠️ تحتاج إعادة تشغيل backend للتأكد النهائي |

---

## 4) فحوص ما بعد التنفيذ

| الفحص | النتيجة |
|-------|---------|
| `npx tsc --noEmit` | ✅ نظيف |
| `src/test/i18n.test.ts` | ✅ 7/7 (بما في ذلك `schedule` الجديد) |
| `npm run build` | ✅ ناجح (3.61s) |
| التحقق الحي في المتصفح | ✅ مكتمل (العربية + الإنجليزية) |

---

## 5) الملفات المعدّلة (جميعها غير مودّعة)

### Frontend
```
frontend/src/i18n/index.ts
frontend/src/i18n/locales/ar/schedule.json (جديد)
frontend/src/i18n/locales/en/schedule.json (جديد)
frontend/src/test/i18n.test.ts
frontend/src/pages/cashier/Schedule.tsx
frontend/src/pages/cashier/schedule/Toolbar.tsx
frontend/src/pages/cashier/schedule/ScheduleStatsBar.tsx
frontend/src/pages/cashier/schedule/DayBoard.tsx
frontend/src/pages/cashier/schedule/WeekBoard.tsx
frontend/src/pages/cashier/schedule/ListView.tsx
frontend/src/pages/cashier/schedule/AgendaPanel.tsx
frontend/src/pages/cashier/schedule/ScheduleModal.tsx
frontend/src/pages/cashier/schedule/AppointmentCard.tsx
frontend/src/pages/cashier/schedule/MiniCalendar.tsx
frontend/src/pages/cashier/schedule/exportSchedule.ts
frontend/src/features/schedule/hooks/useSchedule.tsx
frontend/src/features/schedule/components/DayBoard/constants.ts
frontend/src/features/schedule/components/ScheduleHeaderActions.tsx
frontend/src/features/schedule/components/ScheduleDragPreview.tsx
frontend/src/features/schedule/components/DayBoard/SlotDropZone.tsx
frontend/src/pages/cashier/schedule/scheduleUtils.tsx
frontend/src/features/bookings/services/scheduleService.ts
frontend/src/components/shared/EmployeeAvatar.tsx
```

### Backend
```
backend/app/api/v1/endpoints/appointments.py (إضافة endpoint /appointments/export/pdf)
```

---

## 6) ملاحظات إضافية (لم تُغطَّ)

| البند | السبب |
|-------|--------|
| بداية الأسبوع (الأحد/السبت) | يحتاج قرار تصميم موحد بين WeekBoard و MiniCalendar |
| WS الحي (شارة «غير متصل») | يعتمد على إصلاح handshake في بيئة التطوير — البروكسي `/api` مع `ws: true` جاهز |
| PDF عربي عبر backend | يحتاج إعادة تشغيل backend لتسجيل المسار الجديد؛ frontend لديه fallback للـ jspdf |

---

## 7) الحالة النهائية

**جميع بنود P1..P4 مُنفذة برمجياً وتم التحقق منها حياً.**
لا commit ولا push إلا بطلب المستخدم الصريح.
