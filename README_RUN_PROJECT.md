# دليل تشغيل مشروع صالون برو (Salon Management Pro ERP)

المشروع يعمل **تشغيل مباشر على الجهاز** (بدون Docker): خدمة Python عبر Uvicorn + واجهات React تُبنى كملفات static.

## 1. متطلبات التشغيل

- **Python:** 3.12 (هو ما يعمل عليه CI). طُوِّر محلياً على 3.14 بدون مشاكل.
- **Node.js:** **20 أو أحدث** (يُستخدم وقت البناء فقط). الإصدار 18 لا يعمل —
  `frontend/package.json` يطلب `>=20`، وVite 8 يتطلبه.
- **قاعدة البيانات:** SQLite افتراضيًا، أو PostgreSQL اختياريًا.
- **Redis (اختياري، موصى به):** 7+. بدونه تعمل حدود المعدل وقفل الحساب في ذاكرة
  كل عملية على حدة (انظر §2).

> حدّNode الأدنى مكتوب في `package.json` كحقل `engines`، لا في هذا الملف فقط،
> لأن الحقل هو الذي يمنع `npm install` على إصدار لا يصلح.

---

## 2. الباك إند (Backend)

من مجلد `backend`:

```bash
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# Linux / Mac
source .venv/bin/activate

pip install -r requirements.txt
```

### ملف البيئة

انسخ `backend/.env.example` إلى `backend/.env` واضبط:

| المتغير                    | ملاحظات                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`              | `development` أثناء التطوير، `production` عند التسليم.                                         |
| `SEED_DEMO_DATA`           | `true` في التطوير فقط (بيانات تجريبية). **يجب أن يكون `false` في الإنتاج** وإلا تعذّر الإقلاع. |
| `SECRET_KEY`               | إجباري وفريد: `python -c "import secrets; print(secrets.token_hex(32))"`.                      |
| `FIRST_SUPERUSER_PASSWORD` | كلمة مرور قوية (يرفض النظام القيم الضعيفة مثل `admin123`).                                     |
| `BACKEND_CORS_ORIGINS`     | قيم مفصولة بفاصلة، مثل `http://localhost:5173`.                                                |
| `DATABASE_URL`             | `sqlite:///./salon_pro.db` أو رابط PostgreSQL.                                                 |
| `REDIS_URL`                | اختياري. يشارك حدود المعدل وقفل الحساب وإشعارات WebSocket بين النسخ. بدونه تصبح في الذاكرة. |
| `TOTP_ENFORCEMENT_ENABLED` | `true` افتراضياً. إجباري لأدوار owner/admin/manager خلال 7 أيام سماح. |
| `SALON_DATA_DIR`           | اختياري: مسار خارجي لتخزين الـ DB والمرفقات (انظر §5).                                         |

> في `ENVIRONMENT=production` يرفض النظام أي `SECRET_KEY` تجريبي ويمنع تشغيل الـ seed.

### ثلاثة أشياء ليست اختيارية في الإنتاج

**1. كلمات المرور.** Argon2id افتراضياً. الحسابات القديمة بـ bcrypt تُقبل وتُعاد
كتابةها عند أول دخول ناجح — لا إجراء مطلوب.

**2. التحقق بخطوتين.** إجباري لأدوار `owner` و`admin` و`manager`. خلال
`TOTP_ENROLLMENT_GRACE_DAYS` (7 أيام) الدخول يعمل بدون تفعيل، وبعدها يُرفض حتى
يتم الربط من `/settings?tab=security`.

> **الامتناع عن ضبط Redis عند تعدّد النسخ.** بدون `REDIS_URL` يعمل كل شيء، لكن
> الحدّاد ينزل للذاكرة داخل كل عملية. عند تشغيل أكثر من نسخة من Uvicorn، يصبح
> الحدّ الفعلي أضعف بقدر عدد النسخ، وقفل الحساب يُفقد عند كل إعادة تشغيل. البديل
> في الذاكرة محدود عمداً حتى لا يتحول طلب واحد إلى رفض مفتوح، لكنه
>  حماية لا تصلح عند التوسّع. لنسخة واحدة على جهاز واحد لا مشكلة.

### تهيئة القاعدة

```bash
alembic upgrade head
```

### التشغيل

```bash
# تطوير (مع إعادة التحميل التلقائي)
python -m uvicorn app.main:app --reload --port 8000
```

للتحقق: `http://127.0.0.1:8000/health`

---

## 3. لوحة الإدارة (frontend)

من مجلد `frontend`:

```bash
npm install
```

اضبط `frontend/.env`:

```
VITE_API_URL=http://127.0.0.1:8000/api/v1
VITE_WS_URL=ws://127.0.0.1:8000
```

> `VITE_WS_URL` مطلوب للإشعارات اللحظية (WebSocket). لو لم يُضبط، النظام يعمل لكن
> يتحول تلقائيًا إلى polling كل 30 ثانية.

```bash
cd frontend
npm run dev       # تطوير على :5173
npm run build     # إنتاج -> frontend/dist
```

فحوص ما قبل التسليم:

```bash
npm run lint
npm run typecheck
npm run test:run
```

## 4. الموقع العام (public-site)

```bash
cd public-site
npm install
npm run dev       # تطوير على :3000
npm run build
```

## 5. مكان البيانات (مهم للنسخ الاحتياطي)

كل ملفات التشغيل (قاعدة البيانات، المرفقات، الفواتير) تُخزَّن **خارج مجلد المشروع**،
والمسار يُحسم بالترتيب في `backend/app/core/paths.py`:

1. `SALON_DATA_DIR` أو `SALON_EXTERNAL_DIR` أو `EXTERNAL_DATA_DIR`
2. مجلد `SalonProData` بجانب الـ exe (عند البناء بـ PyInstaller / Electron)
3. مجلد `SalonPro_External` بجانب المشروع
4. مجلد `SalonPro_External_Data` (قديم، ما زال مدعوماً)
5. `Documents/SalonProData`
6. `SalonProData` داخل مجلد العمل (fallback أخير)

الترتيب في الكود هو المرجع؛ لو تعارض هذا الجدول مع `paths.py` فالثاني هو
الصحيح.

النسخ الاحتياطي = نسخ هذا المجلد. خذ نسخة قبل أي `alembic upgrade`.

---

## 6. النشر على سيرفر (تشغيل مباشر)

### أ. الباك إند

```bash
pip install gunicorn
gunicorn app.main:app \
  --bind 127.0.0.1:8000 \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker
```

الأفضل ربطه بـ systemd أو خدمة مشابهة لإعادة التشغيل التلقائي.

### ب. الواجهات

بعد `npm run build`، اربط `frontend/dist` و`public-site/dist` كملفات static.

**مهم — الإشعارات اللحظية:** الواجهة تقرأ `VITE_WS_URL` وقت البناء. لو أردت
الاشتغال خلف Nginx على نفس الأصل (خيار موصى به، يلغي الحاجة لـ CORS):

```bash
VITE_API_URL=/api/v1 \
VITE_WS_URL=ws://127.0.0.1:8000 \
npm run build
```

ثم في Nginx مرّر `/api/` إلى `127.0.0.1:8000` **مع ترويسات WebSocket**
(`Upgrade`/`Connection`) وإلغاء buffering على مسار `/api/v1/notifications/ws`.

### ج. جدار الحماية

- خلّي `8000` مقفول على الإنترنت (يستقبل طلبات Nginx فقط).
- `ALLOWED_HOSTS` يحتوي النطاق الفعلي للموقع.

---

## 7. نسخة Windows / Electron (اختياري)

```bash
build-windows.bat
```

يبني `backend.exe` بـ PyInstaller ثم Electron في `frontend/dist-electron/`.
يحتاج ضبط أسرار البيئة قبل البناء (راجع §2).

---

## 8. حل المشكلات

| العرض                                          | السبب المحتمل                                  | الحل                                  |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| `401` على كل الطلبات                           | التوكن منتهٍ                                   | أعد تسجيل الدخول.                     |
| التقارير فارغة                                 | لا توجد وردية مفتوحة أو مبيعات                 | افتح وردية (`Shift`) وسجّل عملية بيع. |
| `404` على PDF                                  | مجلد الفواتير غير قابل للكتابة                 | تأكد من صلاحيات مجلد البيانات.        |
| الإشعارات اللحظية لا تعمل                      | `VITE_WS_URL` غير مضبوط أو البروكسي لا يدعم WS | اضبط المتغير، أو اعتمد على polling.   |
| `Test SECRET_KEY cannot be used in production` | `SECRET_KEY` تجريبي                            | ولّد مفتاحًا حقيقيًا (§2).            |
| التطبيق يفتح مباشرة على الـ backend            | `SEED_DEMO_DATA=true` في الإنتاج               | اضبطه `false`.                        |

---

**إدارة صالون برو — فريق الهندسة**
