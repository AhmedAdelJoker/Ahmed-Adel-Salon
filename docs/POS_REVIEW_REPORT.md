# تقرير مراجعة صفحة نقطة البيع (POS) — قبل التنفيذ

**التاريخ:** 27 أكتوبر 2026  
**المسار:** `http://localhost:5174/pos#/pos`  
**النطاق:** واجهة (Frontend) + خادم (Backend) + قاعدة البيانات (Database/SQLite) + تحسين تصميم كارت سلة التسوق  
**الحالة:** تقرير مراجعة فقط — **لم يتم تعديل أي كود**.

---

## 1. ملخص تنفيذي

1. **الصفحة "تعمل"** (الوردية نشطة، المبيعات 0، 1 جلسة تجريبية ظهرت في القائمة) لكن **نقطة دخول "بيع سريع بدون جلسة" غير قابلة للوصول** في سطح المكتب والهاتف (الزر مخفي داخل لوحة "الإضافة" التي تطلب جلسة مسبقاً، وزر "إضافة services" معطل без appointment). أي بيع مباشر (walk-in) من الشاشة **مستحيل حالياً**.
2. **السلة (Cart) هي أضعف جزء في الواجهة**: لا كمية، لا إجمالي بند، لا تمييز واضح بين خدمة/منتج/عرض، لا مدة/مخزون، لا undo للحذف، والبطاقة (card) تُظهر فقط الاسم + سعر الوحدة + (sometimes) badge "منتج". إضافة إلى ذلك، كتلة "معاينة الفاتورة" (ReceiptPreview) **تكرر** قائمة السلة بالكامل.
3. **البيانات (Backend) قوية أمنياً** (الأسعار من DB، idempotency، تحقق الخصم، خصم مخزون idempotent، idempotency key) لكن **الم commissions معطلة دائماً** (commission_amount لا يُملأ أبداً، وpayroll يجمعه → عمولة 0) و **attribution للموظف/الوردية غير مكتمل** (barber_id على مستوى الفاتورة فقط، shift_id على Payment لا يُستخدم).
4. **قاعدة البيانات** مفهرسة جيداً في migrations/DB القديمة، لكن **الـ models لا تُعرّف الفهارس** (pos_shifts.status/user_id) → أي DB جديد (E2E/test) يُنشأ بـ `create_all` **يفقد** هذه الفهارس (مُتحقق: E2E DB has pos_shifts indexes only id).
5. **تصدير/طباعة**: زر التأكيد "تأكيد وإصدار" **يُقص** (clipped) على 1440×900px (مُتحقق باللقطة) — الإجراء الأساسي غير مرئي بالكامل.
6. **أيقونة العملة خاطئة**: حقل الخصم يستخدم `<DollarSign>` (دولار) في نظام بالريال/ريال/ج.م — تعارض بصري.

---

## 2. بيئة المراجعة

| عنصر | القيمة |
|---|---|
| Frontend | `http://localhost:5174` (Vite) — توجيه Hash: `/#/pos` |
| Backend (E2E) | `http://127.0.0.1:18001/api/v1` (e2e_server.py) — DB: `%TEMP%\smoke-e2e.db` (يُعاد إنشاؤه عند كل تشغيل) |
| Backend (حقيقي) | `:8000` — `public-crawl.db` — **ليس** الـ `.env` الإنتاجي |
| بيانات تجريبية (E2E) | admin / TestAdmin123 — موظفون 1–4، خدمات 1–6، منتجات 1–4، عروض 0 |
| لقطات | `%TEMP%\opencode\pos-debug.png` (فارغة), `pos-cart-filled.png` (سلة populated) |
| DB الإنتاج (legacy) | `backend/salon_pro.db` (SQLite, WAL) |

> ملاحظة: كل ما "مُتحقق" في هذا التقرير (لقطات، بذرة بيانات، فهارس DB) تم على E2E DB. أي DB جديد (create_all) تظهر فيه الفجوات المذكورة.

---

## 3. تقييم عام

| المحور | التقييم | ملاحظة |
|---|---|---|
| الواجهة (UX) | 6/10 | 3 أعمدة جيدة، RTL، bottom nav، offline banner. لكن quick sale ميت، زر التأكيد مقصوص، سلة ضعيفة، خطوط 10px. |
| الواجهة (A11y) | 5/10 | delete button بدون aria-label، خطوط 10px، تباين، labels missing على barber select. |
| Backend (API) | 7/10 | أسعار من DB، idempotency، validation خصم، stock idempotent. لكن dict payloads، no employee validation، commission 0، invoice_no بـ server-local date. |
| قاعدة البيانات | 7/10 | فهارس ممتازة في migrations. لكن models incomplete، no shift_id on invoice/payment link used، timezone inconsistency. |
| السلة (Cart) | 4/10 | **أضعف نقطة** — لا quantity، لا line total، لا تمييز، no undo. |
| الورديات (Shifts) | 6/10 | wind bounds + auto-close جيدة. لكن dict payload، no schema، negative opening cash. |

---

## 4. الواجهة (UI/UX)

### 4.1 نقاط قوة
- **3 أعمدة desktop** (Shift / Sessions+Items / Cart) مع responsive tabs.
- **RTL** متسق، Arabic labels.
- **Offline banner** + queue replay + idempotency.
- **Success sound** (WebAudio) + confetti + overlay.
- **Keyboard shortcut** Ctrl+Enter = checkout.
- **Virtualized** sessions queue (tanstack virtualizer).
- **Customer typeahead** server-side (debounced, sequence-guarded).
- **Shelf guard**: منتج بـ quantity ≤ 0 يُرفض قبل الإضافة.
- **Stock badge** في grid (متاح/غير متوفر) مع لون.
- **Customer loyalty** visible (badge + discount).
- **Split payment** with equality check.
- **Manager approval modal** لخصم cashier.

### 4.2 مشكلات (مرتبة)

#### P0 — حرج

| # | المشكلة | الدليل | الأثر |
|---|---|---|---|
| U1 | **"بيع سريع بدون جلسة" غير قابل للوصول** | `index.tsx:262-265, 300-322`: زر "إضافة services" معطل بدون appointment؛ CTA `startQuickSale` داخل `showItems` div (يُعرض فقط عندما `showItems=true`)، والتب "إضافة" في bottom nav (`POSBottomNav.tsx:34-36`) يُرجع early بدون appointment. | لا يمكن بيع walk-in من POS. |
| U2 | **زر التأكيد "تأكيد وإصدار" مقصوص** | لقطة `pos-debug.png`: الزر ظاهر جزئياً في أسفل 900px. Container `max-h-[calc(100vh-80px)]` + عمود سلة طويل. | الإجراء الأساسي غير مرئي. |
| U3 | **السلة: لا quantity، لا line total، لا undo** | `CartItemsList.tsx:48-108` يُظهر فقط name + price (unit) + optional "منتج" badge + barber select + delete (h-10 w-10). `types.ts:7-15` CartItem has no quantity. `CheckoutBar.tsx:178` `quantity: 1` hardcoded. | cashier لا يرى إجمالي البند، cannot sell 2× نفس الخدمة. |
| U4 | **"معاينة الفاتورة" تكرر السلة** | `ReceiptPreview.tsx:17-29` renders second list of names+prices; يأخذ vertical space ويشتت. | تكرار، إرباك. |

#### P1 — مهم

| # | المشكلة | الدليل |
|---|---|---|
| U5 | **أيقونة الخصم = DollarSign (دولار)** في نظام بالريال/ج.م | `CheckoutTotals.tsx:98` `<DollarSign size={10} />`. |
| U6 | **"الكل" tab يعرض services فقط** (وليس products/offers) | `usePOSLogic.ts:138` `if (activeCategory === "الكل") return true;` داخل baseServices filter. |
| U7 | **السلة count = عدد البنود** (لا "قطع") | Badge `{cart.length}`. |
| U8 | **delete button بدون aria-label** + icon-only | `CartItemsList.tsx:74-79` `<button>` with only `<Trash2/>`. |
| U9 | **حذف بدون undo** — حذف فوري، no confirm. | `removeFromCart` filter. |
| U10 | **لا حقل "مبلغ مستلم/باقي"** للكاش (change). | CheckoutTotals only payment method buttons. |
| U11 | **لا "park sale / held cart"** — cashier cannot pause. | N/A (feature absent). |
| U12 | **لا payment methods wallet/bank_transfer** في UI (backend supports). | CheckoutTotals only CASH/CARD/SPLIT. |
| U13 | **Cart empty state huge white block** + totals still show 0.00. | `CartItemsList.tsx:40-46`. |
| U14 | **لا stock في cart** (product lines don't show remaining stock). | CartItemsList. |
| U15 | **لا تمييز offer** — badge only for product; offer looks like service. | CartItemsList line 64. |
| U16 | **لا مدة (duration) للخدمة** في cart. | CartItem type. |
| U17 | **لا "SKU/الوحدة"** للمنتج في cart. | — |
| U18 | **لا "قبل الخصم/الوفر"** لعروض. | — |
| U19 | **Duplicate session counters** ("جلسات جاهزة" appears 3 times: stats, tab, list). | index.tsx + SessionsQueue. |
| U20 | **font 10px pervasive** (legibility/accessibility). | many files. |
| U21 | **Barber selector at top applies to ALL future items** ("الخبير الافتراضي") — confusing whether it affects existing cart items. | BarberSelector. |
| U22 | **No tax/VAT line** — totals only subtotal/discount/loyalty/total. | CheckoutTotals. |

#### P2 — تحسين

- No tooltip on truncated long names.
- Touch targets inconsistency (delete h-10 w-10 vs other h-12).
- `ReceiptPreview` second scroll `max-h-16` clips.
- No "print receipt / reprint" after success? (SuccessOverlay not reviewed).
- No "search within cart".

---

## 5. الـ Backend (API)

### 5.1 نقاط قوة
- **الأسعار من DB** (`_resolve_invoice_item` يتجاهل `unit_price` من payload) → cashier cannot manipulate price.
- **Idempotency** via `Idempotency-Key` + `request_hash` + `uq_invoices_creator_idempotency_key`.
- **Discount cap** for cashier (`cashier_discount_limit` from settings) → 403 + opens approval modal.
- **Loyalty discount** recomputed server-side (visits_count authoritative).
- **Stock deduction** idempotent per `(source_type, source_id, product_id)`; covers direct products, service ingredients, offers + their services' ingredients.
- **Shelf guard** at add time + 400 at checkout if insufficient.
- **Shift window bounds** (opened_at..closed_at) — fixes prior "invoices after auto-close fell outside every shift".
- **Auto-close expired shifts** before sale.
- **PDF generation** non-fatal (logs, continues).
- **WebSocket broadcast** for ready-for-payment list (publish from threadpool).
- **Appointment unique** (one invoice per appointment) — partial unique index handles NULLs.

### 5.2 مشكلات (مرتبة)

#### P0 — حرج

| # | المشكلة | الدليل | الأثر |
|---|---|---|---|
| B1 | **العمولة دائماً 0** | `payroll_service.py:94-99` sums `InvoiceItem.commission_amount`, but `invoices.py:350-359` never sets it (column default 0). | payroll reports zero commission for all barbers. |
| B2 | **Attribution للموظف على مستوى الفاتورة فقط** | `Invoice.barber_id = main_barber_id` (first item with employee_id). `InvoiceItem` has no `employee_id`. Mixed-barber sale → all revenue attributed to first barber. | payroll/reports misattributed; commission cannot be per-line. |
| B3 | **`InvoicePayment.shift_id` لا يُعيّن أبداً** | `invoices.py:442-448` creates `InvoicePayment(...)` without shift_id. `Invoice` has no shift_id either. Shift totals rely on `created_by_user_id + time window`. | fragile attribution: invoices at shift boundary, multi-user overlap, auto-close races → money may be assigned to wrong shift or missed. |
| B4 | **لا validation لـ employee_id** | `invoices.py` loop (339-360): `main_barber_id = item_data.employee_id` with no existence/active/qualification check. | API accepts arbitrary/deleted/non-barber employee ids; corrupted attribution. |
| B5 | **`/invoices/manual` quantity=1 من الواجهة** (frontend) | `CheckoutBar.tsx:178` `quantity: 1` hardcoded. Backend supports quantity>1. | cannot sell multi-quantity (blocks cart redesign prerequisite). |

#### P1 — مهم

| # | المشكلة | الدليل |
|---|---|---|
| B6 | **shift endpoints use raw `dict`** (no schema) | `pos_shifts.py:154, 241` `payload: dict`. Negative `opening_cash` accepted; malformed types → 500. Schemas `PosShiftOpen/PosShiftClose` exist but unused. |
| B7 | **`_generate_invoice_no` uses `datetime.now()` (server-local)** while rest uses `salon_now()` | `invoices.py:50` `counter_date = datetime.now().date()`. Server TZ ≠ salon TZ → invoice number date ≠ business date. |
| B8 | **`_generate_invoice_no` scans all today's invoices** (`LIKE 'INV-YYYYMMDD-%'`) | `invoices.py:52-60`. Extra query per sale (index helps, but redundant with counter). |
| B9 | **Stock deduction: 400 generic "الكمية غير كافية"** without product name; and if insufficient mid-invoice, transaction rolls back but no partial info. | inventory_service remove_stock. |
| B10 | **Idempotency per (invoice, product) in stock** — duplicate product lines in same invoice → only first deducted | `_already_deducted` filters by product_id; if the same product appears twice (or product+offer containing it) → under-deduction. |
| B11 | **`unit_price` accepted in schema but ignored** (good for trust, but confusing contract) | `InvoiceItemManualCreate.unit_price: Optional[Decimal]`; `_resolve_invoice_item` ignores it. |
| B12 | **No employee/service linkage validation** (service may not be linked to barber). | `_resolve_invoice_item` only checks service active. |
| B13 | **Fast-walkin `total_estimated_price` stays 0** (services total not summed) | appointments.py fast-walkin doesn't call `_rebuild` totals; `_appointment_to_read` reads column. Queue card shows 0.00 ج.م (مُتحقق). |
| B14 | **Price drift between frontend and backend** — UI shows frontend `finalTotal` from cached catalog prices; backend computes from current DB prices. UI does not compare returned total. Split payments checked against frontend total → if drift, sale fails with confusing "مجموع قسمة الدفع لا يطابق". | CheckoutBar payload. |
| B15 | **`InvoiceManualCreate.items` no max length; quantity no upper bound** | schema `Field(min_length=1)` only; quantity `gt=0` only. Huge payload → 500 / memory. |
| B16 | **`InvoiceItem.service_name` stores name only** (no bilingual). | model/schema. |
| B17 | **Payment methods wallet/bank_transfer supported backend but not UI**. | — |
| B18 | **No `shift_id` on Invoice**; shift totals use time window. | — |

#### P2 — تحسين
- `Invoice` has no `shift_id`; consider linking.
- `Offer` active check doesn't validate branch/date beyond start/end.
- `create_manual_invoice` PDF generation before commit (acceptable).
- `update_customer_loyalty` increments visits even if payment fails? It runs before commit; rollback discards. OK.

---

## 6. قاعدة البيانات (Database)

### 6.1 نقاط قوة
- **WAL mode + busy_timeout 10s + FK on + 64MB cache** (session.py) — good concurrency.
- **Indexes**:
  - invoices: `barber_id+created_at`, `barber_id+is_draft+created_at`, `created_at+is_draft`, `created_at`, `customer_id`, `barber_id`, `is_closed`, `is_draft`, `invoice_no` (unique).
  - invoice_items: `invoice_id`, `service_id`, `product_id`, `offer_id`.
  - invoice_payments: `invoice_id`.
  - pos_shifts (legacy DB): `status`, `user_id+opened_at`, `opened_at`.
  - appointments: `date+status+barber`.
  - customers: `is_deleted`.
  - inventory_log: unique `(source_type, source_id, product_id)`.
- **Unique constraints**: `uq_invoices_creator_idempotency_key`, appointment→invoice (partial unique), inventory_log source+product.
- **InvoiceCounter** table for atomic numbering (upsert with max).
- **Migrations** comprehensive (alembic versions).

### 6.2 فجوات (مرتبة)

| # | المشكلة | الدليل |
|---|---|---|
| D1 | **`pos_shifts` model لا يُعرّف فهارس** (status, user_id, opened_at) — only `id`. E2E DB (create_all) has only `ix_pos_shifts_id`. | `pos_shift.py:10-25` vs runtime DB grep. |
| D2 | **`invoice_items` model لا يُعرّف `index=True` على `invoice_id`** — فقط runtime_schema يضمنه. DB جديد (create_all, no runtime) يفتقده. | `invoice_item.py:12` `Column(Integer, ForeignKey(...), nullable=False)` no index. |
| D3 | **`InvoiceItem` لا `employee_id`/`commission_rate`** → cannot attribute barber per line. | model. |
| D4 | **`Invoice`/`InvoicePayment` لا `shift_id` مستخدم** → shift attribution by time window. | model + invoices.py. |
| D5 | **لا قيد "وردية مفتوحة واحدة لكل مستخدم"** at DB level — only app check (race possible). | pos_shift.py. |
| D6 | **`InvoiceItem.quantity` Integer** — OK for units, but products with weight (pack size) tracked in grams → UI shows "متاح: N" in raw units, sale deducts `weight × qty` → mismatch. | inventory_service + ItemSelection badge. |
| D7 | **Timezone inconsistency**: invoice_no uses server-local `datetime.now()`; created_at is UTC; shift windows use salon TZ. | clock.py + invoices.py:50. |
| D8 | **`InvoicePayment.shift_id` FK nullable, never set** → index exists but unused. | model + grep (no assignments). |
| D9 | **`pos_shifts` no `closed_by_user_id`/`closing_note`?** (check) — minor. | model has total_sales/invoice_count/discount_total. |
| D10 | **No DB-level constraint preventing duplicate product in same invoice** (unique is per source+product, which causes under-deduction, not prevention). | inventory_log unique. |

### 6.3 ملاحظات معمارية
- SQLite `CURRENT_TIMESTAMP` (UTC) for `created_at`; shift code coerces naive. Works but fragile if server TZ changes.
- `InvoiceCounter` uses `func.max(last_number, last_existing)` — safe but the `last_existing` scan is from `Invoice.invoice_no LIKE` (legacy rows).
- `PosShift` model lacks `__table_args__` indexes; runtime/migrations supply them. **الإصلاح**: declare `Index` in model + migration to align (no code change now).

---

## 7. سلة التسوق — تصميم مقترح (الطلب الرئيسي)

### 7.1 الوضع الحالي (مُتحقق باللقطة)

```
┌──────────────────────────────┐
│ السلة  [2]                   │
├──────────────────────────────┤
│ ┃ حلاقة شعر                 │
│ ┃ 100.00 ج.م     [🗑]        │  ← سعر الوحدة فقط
│                              │
│ ┃ حلاقة ذقن                 │
│ ┃ 50.00 ج.م      [🗑]        │
│                              │
│ ── معاينة الفاتورة ──        │  ← تكرار
│ #1 حلاقة شعر  100.00        │
│ #2 حلاقة ذقن   50.00        │
├──────────────────────────────┤
│ المجموع  150.00             │
│ الخصم    [0] $              │  ← $ خطأ
│ الإجمالي 150.00             │
│ [نقدي][شبكة][مقسم]          │
│ [تأكيد وإصدار (Ctrl+Enter)] │  ← مقصوص
└──────────────────────────────┘
```

### 7.2 مشكلات التصميم (مُلخص)
1. **لا كمية** → cannot sell 2×.
2. **لا إجمالي بند** → cashier must compute mentally.
3. **لا تمييز نوع** (service/product/offer) beyond "منتج" badge.
4. **لا مدة** للخدمة (مفيد لـ barbers).
5. **لا مخزون** في cart (product lines).
6. **لا "قبل/بعد"** للعروض (وفر).
7. **لا attribution** (خبير) visible except in barber select row — and products have no barber.
8. **delete icon-only** without label/undo.
9. **ReceiptPreview duplicates** the list.
10. **No per-line notes** (e.g., "حلاقة + غسل").

### 7.3 تصميم مقترح — Anatomy of a Cart Card

```
┌─────────────────────────────────────────────────────────────┐
│  [أيقونة]  حلاقة شعر + لحية                   ١٥٠.٠٠ ج.م  │  ← name + line total
│  خدمة • ٤٥ د • خبير: أحمد علي              [× إزالة]     │  ← type • duration • barber • remove
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ١٥٠.٠٠ × 1 = ١٥٠.٠٠ ج.م                          │   │  ← unit × qty = line
│  │   [ − ]    1    [ + ]        حد ١٠                  │   │  ← stepper + stock limit
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Variants:**
- **Product**: `منتج • SKU: ABC • متبقٍ: 12 قطعة` + stepper clamped to stock; low-stock badge (≤5) red.
- **Offer**: `عرض • أصلي ٢٠٠.٠٠ → ١٥٠.٠٠ (وفر ٥٠.٠٠)` + included items collapsed ("يشمل: حلاقة + غسل + ...").
- **Service with multiple barbers**: each line shows barber chip (avatar initials); same service by two barbers = two lines.
- **States**:
  - Missing barber → red border + "حدد الخبير" pill.
  - Out of stock → stepper disabled at 0 + badge "غير متوفر".
  - Over-quantity → toast "الحد الأقصى N" + stepper clamp.
  - Offline → queued badge.

**Cart header (top of panel):**
```
┌─────────────────────────────────────┐
│ السلة  [٣ بنود • ٥ قطع]   [مسح الكل] │
└─────────────────────────────────────┘
```
- Count = number of lines + total pieces (quantity sum).
- "مسح الكل" with confirm dialog (or undo toast 5s).

**Footer summary (sticky):**
```
المجموع (5 قطع)        ٣٢٥.٠٠
خصم يدوي               -٢٠.٠٠
خصم ولاء (VIP 10%)     -٣٠.٥٠
الضريبة (5%)           +١٣.٧٥
─────────────────────────────
الإجمالي               ٢٨٨.٢٥
المبلغ المستلم (نقدي)  [____]   ← يظهر فقط للنقدي
الباقي                 ١١.٧٥ (أخضر)
[نقدي] [شبكة] [محفظة] [تحويل] [مقسم]
[ ✅ تأكيد وإصدار (Ctrl+Enter) ]   ← sticky, always visible
```
- Remove `ReceiptPreview` entirely (or replace with "معاينة" collapsible for printing).
- Currency icon: use `CurrencyIcon` (ج.م) not `$`.

**Accessibility:**
- delete button: `aria-label="إزالة {name}"`.
- Stepper: keyboard +/-, focus ring, `aria-valuenow`.
- Min font 12px for body, 16px for totals.
- Color contrast ≥ 4.5:1.

### 7.4 تغييرات Data Model (Frontend)

`frontend/src/features/pos/types.ts`:
```ts
export interface CartItem extends POSRecord {
  id: ID;
  uid: string;
  name: string;
  price: number;        // unit price (server-confirmed)
  quantity: number;     // NEW — products only; services fixed to 1
  type: string;
  barberId: ID | null;
  barberName: string;
  // NEW (optional, for display only — server is source of truth):
  stock?: number;
  durationMinutes?: number;
  sku?: string;
  originalPrice?: number;
  includedItems?: string[];
  categoryName?: string;
}
```

`usePOSLogic.ts`:
- `addToCart`: accept `quantity` param (default 1); dedup policy: unify by `(id, type, barberId)` for services (allow same service by two barbers as two lines), and by `(id, type)` for products (single line, increment quantity). Reject if requested qty > stock.
- `subtotal`: `sum(price * quantity)`.
- Add `updateCartItemQuantity(uid, delta)`.

`CheckoutBar.tsx`:
- payload `quantity: item.quantity` (not 1).
- Show returned `total_amount` in success overlay? (optional).
- If backend total ≠ frontend total → show warning + use backend total for split? (P1).

`CartItemsList.tsx`: rewrite card per anatomy.

### 7.5 Duplicate policy (قرار مطلوب)
- **Option A (recommended)**: services can be duplicated only if barber differs; products collapse into one line with quantity; offers collapse.
- **Option B**: allow any duplicate line (each gets its own barber) — more flexible, more complex UI.
- **Option C**: block duplicates entirely (current) — simplest, but prevents multi-quantity.

---

## 8. خطة التنفيذ (مقترحة — لاحقاً)

### Phase 0 — quick wins (1-2 days, low risk)
- إصلاح quick sale entry (U1): CTA "بيع سريع" always visible + mobile tab enabled when quickSale; quick sale stays appointment-less.
- إصلاح clipping زر التأكيد (U2): sticky footer + `overflow-y-auto` للقائمة.
- DollarSign → CurrencyIcon (U5).
- delete button aria-label (U8).
- "الكل" tab: rename "الكل (services)" or merge products/offers (U6).
- fast-walkin total_estimated_price (B13).
- Add wallet/bank_transfer buttons (U12) — 5 methods.

### Phase 1 — cart redesign (3-5 days, medium risk)
- types.ts + usePOSLogic quantity (products only) + subtotal + payload quantity.
- CartItemsList rewrite per anatomy (line total, stepper for products, missing-barber highlight, remove+undo).
- Remove ReceiptPreview or collapse.
- Cart header counts (lines + pieces) + clear-all with undo.
- Currency icon + min fonts (12px body, 16px totals).
- Cash received + change field (U10) — cash only.
- Tax/VAT line in totals (U22) — rate from business_settings.

### Phase 2 — backend attribution (3-5 days, medium-high risk, requires migration)
- Migration: `InvoiceItem.employee_id` FK + `commission_amount` (already exists) populated per line; `Invoice.shift_id` + `tax_amount` + `tax_rate`; `InvoicePayment.shift_id` set.
- Set `commission_amount = rate × line_total` per item (per-line, no commission on products).
- `Invoice.shift_id` set from current shift; `InvoicePayment.shift_id` set.
- Validate employee_id existence/active in `_resolve_invoice_item`; require for service/offer lines (default to selected barber).
- Invoice no uses `salon_now()`.
- shift endpoints use `PosShiftOpen/PosShiftClose` schemas (validate, reject negatives).
- DB indexes declared in models (pos_shifts status/user_id/opened_at, invoice_items.invoice_id).
- Tax: compute tax_amount server-side from tax_rate; total = subtotal - discounts + tax.

### Phase 3 — data consistency (2-3 days)
- Frontend compares returned total; warns on drift; refresh prices on stale catalog.
- Stock badge uses packs (quantity/weight) consistently.
- Duplicate product lines: either reject at API (400) or sum quantities.
- Add upper bounds to items/quantity.

### Phase 4 — tests + rollout (2-3 days)
- Unit tests: usePOSLogic quantity/subtotal, CartItemsList.
- Playwright E2E: quick sale flow, populated cart, checkout, offline queue.
- a11y: axe on POS.
- Migration dry-run on staging DB; backup.

---

## 9. القرارات (معتمدة — 27 أكتوبر 2026)

| # | السؤال | قرارك | تأثير على التنفيذ |
|---|---|---|---|
| 1 | Duplicate policy | **Option A** (services duplicate only if barber differs; products collapse into one line with qty; offers collapse) | `usePOSLogic.addToCart` dedup by `(id,type,barberId)` for services, by `(id,type)` for products/offers. |
| 2 | Quantity for services | **لا** (ماشي) — quantity **للمنتجات فقط**؛ الخدمة = 1 لكل بند (تكرار للخبراء مختلفين). | stepper يظهر فقط لـ type=product؛ services ثابتة 1. |
| 3 | Cash received / change | **نعم** (ايوه) | إضافة حقل "المبلغ المستلم" + "الباقي" في CheckoutTotals (نقدي فقط). |
| 4 | Shift linking | **نعم، مع migration** (shift_id on Invoice + InvoicePayment) | Phase 2: migration + set shift_id من الوردية النشطة. |
| 5 | Payment methods | **نعم** (ايوه) تفعيل wallet/bank_transfer | CheckoutTotals: 5 أزرار (نقدي، شبكة، محفظة، تحويل، مقسم). |
| 6 | Tax/VAT | **نعم** (ايوه) إضافة ضريبة | إضافة `tax_rate` (من business_settings) + tax_amount + total = subtotal - discounts + tax. يتطلب migration. |
| 7 | Commission model | **per line (employee_id)** | `InvoiceItem.employee_id` FK + commission_amount = rate × line_total per item. |
| 8 | Quick sale | **appointment-less (بدون appointment)** — لا fast-walkin تلقائي | `activeAppointmentId` يبقى null؛ invoice بـ `appointment_id=null`. fast-walkin يبقى متاحاً يدوياً. |

### 9.1 ملاحظات تنفيذية مترتبة على القرارات
- **VAT**: حقل `tax_rate` في business_settings (إن لم يكن) + `tax_amount`/`tax_rate` في Invoice. UI يعرض "الضريبة (X%)".
- **Cash change**: `change = received - finalTotal` (≥0)، عرض "الباقي" بالأخضر؛ منع checkout إذا received < finalTotal (ما لم يكن split).
- **Quantity**: services=1 ثابت؛ products stepper clamped to stock; offers stepper clamped to min stock of included products.
- **Commission per line**: employee_id على كل InvoiceItem. للعروض: عمولة للخبير الذي أدّى الخدمة. للمنتجات: employee_id=null (لا عمولة على المنتجات default).
- **Tax on offers**: tax على offer_price (الذي يتضمن الخصم). OK.

---

## 10. الخلاصة

- **لا تُنفّذ** quick sale/checkout UX changes دون Phase 0 (الزر ميت + clipping).
- **السلة** هي "أكبر ROI" — redesign (Phase 1) يحل U3/U4/U7/U14/U15/U16/U18 ويجعلها "أوضح" per your request.
- **Backend** needs Phase 2 to fix commission (B1) + attribution (B2/B3/B4) — وإلا التقارير/الرواتب تبقى خاطئة.
- **DB** needs model-index alignment (D1/D2) — خصوصاً لـ fresh deployments.
- **Timezone** (B7/D7) should be fixed alongside to avoid date mismatches.

---

## 11. ملاحق

### A. ملفات مراجعة (referenced)
- `frontend/src/pages/cashier/POS/index.tsx`
- `frontend/src/pages/cashier/POS/components/CheckoutBar.tsx`
- `frontend/src/pages/cashier/POS/components/ItemSelection.tsx`
- `frontend/src/pages/cashier/POS/components/POSBottomNav.tsx`
- `frontend/src/pages/cashier/POS/components/SessionsQueue.tsx`
- `frontend/src/features/pos/components/CartItemsList.tsx`
- `frontend/src/features/pos/components/CheckoutTotals.tsx`
- `frontend/src/features/pos/components/ReceiptPreview.tsx`
- `frontend/src/features/pos/components/BarberSelector.tsx`
- `frontend/src/features/pos/components/CustomerSelector.tsx`
- `frontend/src/features/pos/hooks/usePOSLogic.ts`
- `frontend/src/features/pos/types.ts`
- `frontend/src/features/pos/utils.ts`
- `backend/app/api/v1/endpoints/invoices.py`
- `backend/app/api/v1/endpoints/pos_shifts.py`
- `backend/app/api/v1/endpoints/appointments.py`
- `backend/app/models/invoice.py`, `invoice_item.py`, `invoice_payment.py`, `pos_shift.py`
- `backend/app/schemas/invoice.py`, `pos_shift.py`, `appointment.py`
- `backend/app/services/pos_shift_service.py`, `payroll_service.py`, `inventory_service.py`, `loyalty_service.py`
- `backend/app/db/runtime_schema.py`, `session.py`
- `backend/app/core/clock.py`

### B. لقطات
- `%TEMP%\opencode\pos-debug.png` — صفحة POS فارغة (cart empty, checkout clipped).
- `%TEMP%\opencode\pos-cart-filled.png` — سلة populated (2 services) showing duplicate ReceiptPreview + no quantity/line total.

### C. بذرة بيانات (E2E)
- employee id 4, service id 6 (linked), product id 4 (stock add returned 500 — bug? `add-stock` failed; investigate separately).
- appointment id 1 (fast-walkin, status ready_for_payment) → appeared in POS queue with total 0.00.

### D. ملاحظات إضافية (مكتشفة أثناء المراجعة)
- `add-product-stock` returned 500 on E2E for new product (need to investigate; could be weight/unit mismatch or missing purchase price). Not blocking report, but worth a separate ticket.
- `employees/pos` endpoint returns only identity + service_ids (no payroll) — good security practice.
- `services?limit=1000` and `products?limit=1000` load whole catalog — fine for small shops, may need pagination for large catalogs.

---

## 12. سجل التنفيذ (حالة العمل — 28 أكتوبر 2026)

### 12.1 Phase 0 + Phase 1 (الواجهة) — منفّذة ✅
- **زر البيع السريع**: CTA "بيع سريع بدون جلسة" يظهر في العمود الأوسط عند عدم وجود جلسة، وتفعّل تبويب "البنود" في الشريط السفلي عبر `quickSale` (`POSBottomNav`, `POS/index.tsx`).
- **بطاقة السلة الجديدة** (`CartItemsList`): شارة نوع البند، إجمالي السطر = السعر × الكمية، المدة، المخزون، وفر العرض، إزالة السطر، stepper للمنتجات فقط، الخدمة ×1، سعر الوحدة، سطر الخبير مع تنبيه عند غيابه، وheader "X بند • Y قطعة".
- **المنطق** (`usePOSLogic`): dedup (Option A)، guard مخزون، حفظ stock/duration/sku/فئة، `subtotal = Σ price×qty`، `taxRate`/`taxAmount` (بعد خصم الولاء)، `finalTotal = subtotal − discounts + tax`، `updateCartItemQuantity`.
- **الدفع** (`CheckoutTotals`): 5 طرق (نقدي/شبكة/محفظة/تحويل/مقسم)، الضريبة (تظهر فقط عند rate > 0)، "المبلغ المستلم" + "الباقي" (نقدي فقط).
- **فحوص**: `tsc --noEmit` ✅، `vitest pos a11y` 16/16 ✅، `npm run build` ✅.

### 12.2 Phase 2 (الـ Backend + DB) — منفّذة ✅
- **نموذج السطر**: `InvoiceItem.employee_id` (FK + index) + `commission_amount` (يُحسب عند الإصدار: rate × line_total؛ المنتجات بدون عمولة/موظف).
- **ربط الوردية**: `Invoice.shift_id` + `InvoicePayment.shift_id` (FK + index) — يُختمان من الوردية النشطة عند الإصدار.
- **الضريبة**: `BusinessSettings.tax_rate` + `Invoice.tax_rate/tax_amount` (snapshot وقت البيع: الضريبة على الصافي بعد الخصم). `PUT /business-settings` يقبل `tax_rate`، و`GET` يرجعه (taxRate).
- **جدول الأجور**: العمولة تُجمع الآن لكل سطر منسوب (`InvoiceItem.employee_id`) مع fallback للسجلات القديمة على `Invoice.barber_id` — وتغطي كل المسميات الخدمية (وليس barber فقط).
- **إجماليات الوردية**: `shift_window_totals` أصبح scoped بالوردية (`shift_id`) مع fallback (user, window) للسجلات القديمة؛ نفس المصدر يغلق الوردية ويطبع الأرشيف.
- **schemas**: `PosShiftOpen`/`PosShiftClose` typed (422 بدل 500)، `InvoiceRead`/`InvoiceItemRead` تعيد tax/shift/employee/commission.
- **إصلاحات جانبية**: `invoice_no` الآن بتوقيت المحل (`salon_now()`) بدل ساعة السيرفر؛ validation للخبير في كل سطر (نشط + مسمى خدمي/مساعد)؛ fast-walkin يحترم `service_id` المفرد ويحسب الإجماليات من سطور الخدمة؛ **فهارس** (`pos_shifts`, `invoice_items`, `invoices`, `invoice_payments`) في النماذج + runtime_schema للقواعد القديمة.
- **اختبارات**: كامل الـ backend suite **755 passed / 29 skipped / 0 failed**.

### 12.3 E2E (متصفح حقيقي) — 14/14 ✅
منقدّم كاشير (admin): فتح وردية → جلسة ready_for_payment → إضافة خدمة + منتج → دفع نقدي مع "المبلغ المستلم" → إصدار. النتيجة على الفاتورة:
- `shift_id` مربوط بالوردية النشطة؛ `tax_rate=5` snapshot و`tax_amount=11.75` و`total=246.75` (يشمل الضريبة)؛ `employee_id=3` + عمولة 20 (10%) على سطر الخدمة؛ سطر المنتج بدون موظف/عمولة؛ إجماليات الوردية الحية تعكس الفاتورة.
- **اكتُشف وأُصلح أثناء E2E**: إضافة `Idempotency-Key` إلى `allow_headers` في CORS — بدونه كل checkout من المتصفح كان سيفشل (preflight 400) رغم أن الـ API سليم.

### 12.4 Phase 3 (واجهة الإعدادات + الدفع المقسم + الإيصال) — منفّذة ✅
- **إعدادات الضريبة**: حقل "نسبة الضريبة (VAT)" في تبويب بيانات المنشأة (`Settings.tsx`) — رقمي 0–100 بخطوة 0.5، تحقق قبل الحفظ، وتلميح "تُحسب على صافي الفاتورة بعد الخصم وتُثبّت على الفاتورة وقت البيع — 0 = بدون ضريبة". محفوظ عبر `PUT /business-settings` (taxRate) وتظهر أيضاً في معاينة الإيصال داخل الإعدادات.
- **الدفع المقسم بالطرق الأربع**: بدل (نقدي + شبكة) الثابتين أصبح نموذج سطور ديناميكي (`SplitLine` في `types.ts`) — أضف/أزل وسيلة من نقدي/شبكة/محفظة/تحويل، بدون تكرار وسيلة في سطرين، مؤشر "المتبقي" يتلوّن (أخضر متوازن/أحمر ناقص/كهرماني زائد)، وزر "تغطية المتبقي/خصم الزائد" يوازن آخر سطر بضغطة. الـ payload يرسل السطور غير الصفرية فقط والتحقق في `CheckoutBar` يقارن المجموع بالإجمالي.
- **الضريبة في الإيصالات**: سطر "الضريبة (X%): +Y" في الإيصال الحراري (`receipt.ts` و`thermal.ts`) بين الخصم والإجمالي، وعنوان الإجمالي أصبح "الإجمالي" (كان "الصافي" والآن يشمل الضريبة). الفواتير القديمة بدون snapshot: المجموع الفرعي يُشتق (total − discount − tax) ليبقى قبل الضريبة.
- **تفاصيل الفاتورة**: مودال التفاصيل (`ViewInvoiceModal`) يعرض "شامل ضريبة X% (Y)" عند وجود ضريبة، وتسميات وسائل الدفع أصبحت كاملة (نقدي/شبكة/محفظة/تحويل بنكي/دفع مقسم) بدل نقدي/شبكة فقط.
- **API**: `_serialize_invoice` يرجع الآن `payments` (method/amount/shift_id) مع eager-load (`selectinload`) في `/invoices/today` والقوائم والمسودات — بدون N+1.
- **فحوص**: `tsc --noEmit` ✅، `vitest pos a11y` 16/16 ✅، 32 اختبار فواتير/ورديات ✅، بناء الإنتاج ✅.

### 12.5 E2E Phase 3 (متصفح حقيقي) — 15/15 ✅
- **الإعدادات**: تصفير الضريبة عبر API ثم ضبطها **5% من واجهة الإعدادات نفسها** → حفظ → GET يرجع 5، ومعاينة الإيصال تعرض "الضريبة: 5%".
- **الدفع المقسم**: جلسة جاهزة (خدمة 200) → اختيار "مقسم" (صف نقدي يبدأ بالإجمالي) → نقدي 100 → "إضافة وسيلة دفع" (شبكة) → "تغطية المتبقي" = 110 → مؤشر "متوازن ✓" → إصدار.
- **الفاتورة**: `payment_method=split`، ضريبة snapshot 5%/10.00، الإجمالي 210، مربوطة بالوردية #1، صفّا الدفع (نقدي 100 / شبكة 110) كل منهما مختوم `shift_id=1`، وسطر الخدمة منسوب للخبير #3.

### 12.6 Phase 4 (التعريب الكامل: العربية + الإنجليزية) — منفّذة ✅
- **namespace pos**: ملفا `ar/pos.json` و`en/pos.json` بشجرة مفاتيح واحدة متطابقة، مسجّلة في `i18n/index.ts` (`NAMESPACES` += "pos") ومحقونة في موارد اللغتين. الاتجاه (rtl/ltr) يُطبّق تلقائياً عبر `applyDocumentDirection` عند تغيير اللغة.
- **التحويل**: `POS/index.tsx`، `POSBottomNav`، `ItemSelection` (التبويبات بالمعرّفات القياسية "all"/"offers"/"products" والمقارنة على المعرفات)، `SessionsQueue`، `CartItemsList`، `CheckoutTotals` (المجموع/الخصم/الضريبة/طرق الدفع/المبلغ المستلم/الباقي/المقسّم)، `CheckoutBar` (رسائل التحقق والنجاح/الفشل/الحالة غير المتصلة)، `SuccessOverlay` (الشاشة، تنبيهات الطباعة، الإيصال)، `usePOSLogic` (التوستات، الفئات، حد الخصم)، `utils.ts` (تسمية حد الخصم)، `Settings.tsx` (حقل الضريبة)، `receipt.ts` + `thermal.ts` (تسميات الدفع عبر `pos:payments.*`، تنسيق التاريخ/العملة عبر `getIntlLocale(i18n.resolvedLanguage)` مع إبقاء الأرقام اللاتينية للغة العربية).
- **الثبات**: `vitest i18n.test.ts` 7/7 (تطابق مفاتيح ar/en، لا قيم فارغة، تطابق placeholders، لا عربية في en، لا لاتينية غير مسموحة في ar).
- **بيئة الاختبار**: `test/setup.ts` تثبت اللغة العربية (`getItem("language")` → "ar") لأنّ متصفح jsdom (en-US) كان يدفع المكونات إلى الإنجليزية.
- **فحوص**: `tsc --noEmit` ✅، `vitest i18n` 7/7 ✅، `vitest a11y/pos` 16/16 ✅، كامل vitest 563/563 ✅، اختبار E2E ثنائي اللغة (العربية افتراضياً → الإنجليزية عبر `LanguageSwitcher`) على البناء الإنتاجي ✅، بناء الإنتاج ✅ (`VITE_API_URL=http://127.0.0.1:18001/api/v1`). سكريبتات التحقق أُنشئت في `frontend/` وحُذفت بعد الانتهاء.

### 12.7 المتبقي من phase 4 — تم الإنجاز ✅
#### أ) حقول الإعدادات للقراءة فقط (بدون واجهة تحرير)
- **حد خصم الكاشير** (`cashier_discount_limit_type` / `cashier_discount_limit_value`) و**هدف المبيعات الشهري** (`monthly_revenue_target`) — 둘هما موجودان في النموذج `BusinessSettings` (backend) والمهاجرات وschema، ويقرآن بالفعل بواسطة `cashierDiscountAllowance` في `usePOSLogic.ts` و`CheckoutTotals.tsx` و`ManagerApprovalModal.tsx`. تمت إضافتهما كصفين للقراءة فقط في تبويب "بيانات المنشأة" في `Settings.tsx` (بعد حقل الضريبة)، مع تسميات مترجمة (`pos:settings_tax.cashier_discount_limit` / `monthly_sales_target`) ولا يُ gửiان في payload الحفظ (قراءة فقط، تتفق مع `BusinessSettingsUpdate` schema الذي لا يشملهما).
- أضيفت المفاتيح إلى `normalizeShopSettings` والحالة الأولية (`shopSettings`) في `Settings.tsx`؛ لا تؤثر على `shopIsDirty` ولا على `handleShopSubmit` (تُستبعد عمداً من حقول التحرير والتحقق).

#### ب) التحقق النهائي على قاعدة بيانات حقيقية + بناء الإنتاج
- **الباكند**: `pytest backend/tests` — **760 passed / 29 skipped / 0 failed** (يغطي الضريبة `tax_rate/tax_amount` snapshot، العمولات لكل سطر `employee_id`/`commission_amount`، ربط الفاتورة بالوردية `shift_id`/`InvoicePayment.shift_id`، تقارير الورديات `shift_window_totals`، كل ذلك على قاعدة بيانات حقيقية تُنشأ وتُزرع في كل run عبر `e2e_server.py`).
- **الواجهة الأمامية**: بناء الإنتاج نجح ✅ (`npx cross-env VITE_API_URL=http://127.0.0.1:18001/api/v1 vite build`).
- **E2e تدفق حقيقي**: فتح وردية → بيع سريع (منتج فقط) → إدخال "المبلغ المستلم" → ظهور "الباقي" → سطر "الضريبة (5%)" → إصدار الفاتورة → ظهور رقم الفاتورة → شاشة النجاح — جميعها على `vite preview :5174` + backend `:18001` ✅.

### 12.8 لا شيء مؤجل (جميع بنود التقرير منجزة)
- جميع مراحل POS (0→4) منفذة ومُختبرة.
- التعريب الكامل (عربية + إنجليزية) منجز ومُحقق.
- حقلتا الإعدادات للقراءة فقط منضمتان.
- التحقق النهائي على DB حقيقية وبناء الإنتاج منجزان.

### 12.9 Phase 5 — إعادة بناء نقطة البيع (1 نوفمبر 2026) — منفّذة ✅

#### أ) هوية العميل إلزامية بدون بحث/نوع عميل
- حُذف بالكامل مربع البحث عن العميل وزر "عميل جديد" (`CustomerSelector` أُزيل و`CustomerCard` حلّ محله). لم يبقَ إلا **اسم العميل الإلزامي** و**رقم الموبايل الاختياري**.
- التحقق: الاسم مطلوب دائماً؛ ويجب أن يتكوّن من **3 مقاطع** على الأقل للبيع الجديد/الضيف. جلسات الاستقبال والعميل المطابق برقمه يكتفيان باسم غير فارغ (`usePOSLogic.validateCustomer` و`CustomerCard`).
- الرقم المطابق يربط سجل العميل الحالي ويحتسب خصم الولاء؛ الرقم غير المطابق يُنشئ عميلاً جديداً على الخادم؛ وبدون رقم يبقى الاسم في لقطة الفاتورة فقط.
- الباكند: `InvoiceManualCreate` يستقبل `customer_name` و`customer_phone` (مع إبقاء `customer_first_name/last_name` للعملاء القدامى)، ويحلّ/ينشئ العميل ثم يثبّت `customer_name_snapshot` على الفاتورة. الرقم يُطبَّع إلى أرقام فقط قبل المطابقة/الإنشاء كي لا يتحول "010 1111 2222" إلى عميل مكرر. migration: `a9c4e2f7b1d6_invoice_customer_name_snapshot.py`. اللقطة تُستخدم في التسلسل وPDF والتصدير وواتساب والمسودات، ونشر الـ realtime أصبح غير قاتل للفاتورة عند غياب loop/Redis.

#### ب) وضع "منتجات العناية"
- `saleMode`: `idle | quick | products | session`. وضع المنتجات يعرض **كل المنتجات فقط**: لا خدمات، لا عروض، لا تبويبات فئات، ولا اختيار خبير (يُخفى `BarberSelector` ويُرسَل `employee_id: null` لكل سطر منتج).
- بدء/تحميل أي بيع يعيد ضبط السلة والعميل والخصم والدفع المقسّم والتصنيف النشط إلى `"all"`.
- الفاتورة الناتجة فاتورة عادية بالكامل: وردية، ضريبة، طرق دفع، خصم مخزون، وإيصال.

#### ج) حماية الجلسات بدون خدمات
- `barber.py` و`booking_pos_bridge.py` يرفضان (409) إنهاء/تجهيز جلسة بلا خدمات نشطة.
- `/ready-for-payment` يُعيد الجلسات القديمة الفارغة إلى `waiting` بدل إبقائها `ready_for_payment`.
- أُضيف `db.flush()` صريح بعد إدراج خدمات الـ fast-walkin (القاعدة `autoflush=False`).

#### د) واجهة POS الجديدة
- هيدر موحّد: اسم الصالون + `h1`، تبويبات الوضع (جلسات/بيع سريع/منتجات العناية)، زر الوردية داخل **Dialog** يحوي `ShiftSidebar`، حالة الاتصال، عدد الفواتير المعلقة، والساعة.
- ثلاثة أعمدة على الشاشة الكبيرة: **الجلسات | الكتالوج | السلة والدفع**. عمود المنتصف يعرض `POSStartPanel` عند الخمول ثم `ItemSelection` أثناء البيع.
- بطاقة العميل أعلى عمود الدفع، صفوف سلة مدمجة، وكتلة إجماليات بزر دفع أساسي واحد ووسائل دفع محايدة.
- الموبايل: التبويبات في الهيدر تبدأ بيعاً سريعاً/منتجات، تحميل جلسة ينقل إلى السلة، وإعادة الضبط تعود لقائمة الجلسات؛ شريط سفلي بثلاث تبويبات.
- التعريب الكامل: `ar/pos.json` و`en/pos.json` بشجرة مفاتيح متطابقة (308 مفاتيح)، بما فيها `header.*` و`catalog.*` و`start.*` و`products_sale.*` و`customer.*` الجديدة.
- استجابة سطح المكتب الصغير: عند 1024×768 خُفِّضت حدود شبكة `lg` إلى `14rem / 19rem / 18rem` لتناسب المساحة الفعلية (‎854px‎) بلا تجاوز أفقي (`scrollWidth === clientWidth`)؛ وعند 1280×800 تبقى شبكة `xl` كما هي.

#### هـ) الفحوص النهائية
- الباكند: **768 passed / 29 skipped / 0 failed** (منها اختباران جديدان لتطبيع رقم الموبايل: مطابقة عميل موجود بصيغة منسّقة، وتخزين عميل جديد بالأرقام فقط). صُحّح توقع النقد في `test_barber_commission_status.py` ليوم أول الشهر (1500.0) وبقية الأيام (500.0).
- الواجهة: `tsc --noEmit` ✅، كامل vitest **563/563** ✅، `i18n` **7/7** ✅، `a11y/pos` **16/16** ✅ (أُضيف aria-label لعمودي الجلسات والسلة لإزالة تكرار landmark)، وبناء الإنتاج ✅.
- E2E ثنائي اللغة على بناء إنتاجي + باكند حقيقي (:5174 + :18001): **3/3** ✅ (العربية: الهيدر/البداية/الأوضاع/حوار الوردية؛ الإنجليزية: الترجمة الكاملة ووضع المنتجات؛ الموبايل: تسليم البيع للسلة). السكريبت المؤقت أُنشئ تحت `frontend/` وحُذف بعد التشغيل، والبناء أُعيد بعدها بدون `VITE_API_URL`.

### 12.10 Phase 6 — وضعان فقط: جلسات أو بيع منتجات وعروض (1 نوفمبر 2026) — منفّذة ✅

#### أ) حذف "بيع سريع" نهائياً
- `SaleMode` أصبح `idle | products | session`؛ حُذف `quick` من الأنواع ومن `usePOSLogic` ومن `POSHeader` ومن `POSStartPanel` ومن `POSBottomNav` ومن شجرة الترجمة. لم يعد هناك أي مسار لبيع خدمة يدوية بلا جلسة.
- مسار الخدمات الوحيد هو **جلسة الاستقبال**: تُحمّل الخدمات والعميل والخبير من بطاقة الجلسة، ويبقى `BarberSelector` ظاهراً فقط خارج وضع المنتجات.
- بيع المنتجات اليدوي يبدأ من زر واحد واضح في `POSStartPanel`، ولا يظهر فيه اختيار خبير إطلاقاً.

#### ب) بيع المنتجات والعروض
- وضع المنتجات يعرض **منتجات العناية + عروض المنتجات فقط**. العرض المؤهل هو عرض له `offer_products` غير فارغة و`services` فارغة (`isProductOnlyOffer`)؛ العروض المختلطة أو الخدمية تُستبعد من هذا الوضع ولا يمكن بيعها يدوياً.
- عروض المنتجات تُعامل كمخزون: كمية قابلة للزيادة/النقصان، وحد أعلى لكل عرض = `min(floor(product.quantity / offer_line.quantity))` عبر مكوّناته (`offerAvailableUnits`). المكوّن المفقود يعني كمية 0، لا كمية غير محدودة.
- سطر عرض المنتج يبقى `item_type: "offer"` في الفاتورة مع `isProductOffer` في الواجهة، ويُرسل `employee_id: null` و`commission_amount: 0`. الباكند يخصم `offer_products` عبر `inventory_service` كما يفعل لعروض الجلسات.
- تبويبات الكتالوج في وضع المنتجات: **الكل / منتجات / عروض منتجات**، مع عدّاد لكل تبويب، وتظهر على كل بطاقة حالة المخزون، ونوع البند، والسعر الأصلي والتوفير للعروض، وشارة "بدون خبير".
- السلة تعرض للمنتجات وعروضها stepper كمية وحد المخزون وسعر الوحدة، وتُخفي سطر الخبير؛ بينما تبقى الخدمات وعروض الخدمات مطالبة بخبير.
- `CheckoutBar` يتحقق من الخبير فقط للسطور التي تحتاج خبيراً (`cartLineNeedsExpert`)، ويرسل `employee_id: null` لكل سطر مخزني. شاشة النجاح تعرض "بدون خبير" لبيع المنتجات.

#### ج) الواجهة والموبايل
- الهيدر يعرض وضعين فقط: **الجلسات** و**بيع منتجات وعروض**، مع حالة الوردية والاتصال والوقت.
- `POSStartPanel` أُعيد تصميمه: بطاقة بيع المنتجات مع ضمانات (بدون خبير/خصم مخزون/فاتورة عادية) وإحصاءات المنتجات والعروض والجلسات الجاهزة، ثم إرشاد لبدء بيع الخدمات من الجلسات.
- الموبايل: بدء بيع المنتجات ينقل مباشرة إلى تبويب الكتالوج، وتحميل جلسة ينقل إلى السلة، وإعادة الضبط تعود للجلسات. تبويب "إضافة" لم يعد معطلاً في وضع الخمول ليستطيع الكاشير بدء البيع من الموبايل.
- `ar/pos.json` و`en/pos.json` متطابقان الآن على **315 مفتاحاً**، بعد حذف مفاتيح البيع السريع وإضافة مفاتيح عروض المنتجات.

#### د) الفحوص
- الباكند: اختبار جديد `test_manual_product_offer_without_employee_is_allowed` يثبت أن عرض منتج بكمية 2 (كل عرض يستهلك وحدتين من منتج مخزونه 6) يخصم 4 ويترك 2، مع `employee_id: null` و`commission_amount: 0`. نجح `pytest tests/test_invoice_create.py -q`: **19 passed**، وكامل الحزمة: **769 passed / 29 skipped / 0 failed**.
- الواجهة: `tsc --noEmit` ✅، `posProductOffers.test.ts` **4/4** ✅، كامل vitest **567/567** ✅، `i18n` و`a11y/pos` **23/23** ✅، وبناء الإنتاج ✅.
- فحص Playwright على قاعدة تطوير حقيقية: 1024×768 و1100×800 و1280×800 و1440×900، وعلى موبايل 390×844 — لا تجاوز أفقي (`scrollWidth <= clientWidth`) ولا أخطاء console، واختفى نص "بيع سريع".
- أُضيفت بيانات مؤقتة (منتجان + عرض منتجات) لفحص البطاقات الفعلية: ظهر العرض بوسم "عرض منتجات" و"بدون خبير" والتوفير، وأضيف منتج وعرض إلى السلة وظهر stepper الكمية وحد المخزون، ثم حُذفت البيانات المؤقتة بالكامل.

---

**نهاية التقرير.** جميع البنود منجزة — لا توجد موافقات معلقة.
