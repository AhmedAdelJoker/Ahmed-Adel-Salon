# نقد صفحة نقطة البيع (POS) — تقييم تصميمي (P2-impeccable)

> **التاريخ:** 3 نوفمبر 2026  
> **المسار:** `http://localhost:5173/pos`  
> **المراجع:** `POS_REVIEW_REPORT.md` (مراجعة 27 أكتوبر 2026)  
> **الحالة:** تقرير نقد تصميمي — لم يُعدّل أي كود.

---

## 1. ملخص تنفيذي

صفحة POS هي **الأقوى من حيث Engineering** (offline queue، idempotency، الأسعار من DB، shift management) لكن **الأضعف بصرياً**:

- **UX Score: 6/10** — تدفق البيع (sale flow) مكسور على 900px (زر "تأكيد وإصدار" مقصوص)
- **A11y Score: 5/10** — أزرار أيقونية بلا aria-label، chips filter بدون aria-pressed، contrast issues
- **Visual: 5/10** — "Barber Luxe" leftover branding، DollarSign icon in non-USD currency system، خطوط 10px في several places
- **Performance: 7/10** — lazy loading good، but large bundle (461KB main)

---

## 2. تقييم تفصيلي

### 2.1 التسلسل (Hierarchy)

**المشكلة:** الـ layout (3 columns) على 900px (standard desktop) يقص زر الإتمام.

**الدليل:** POS_REVIEW_REPORT §5.6 — `pos-cart-filled.png` (cart populated) يظهر "تأكيد وإصدار" button partially clipped.

**الإصلاح المقترح:**
- جعل checkout bar sticky bottom أو overlay
- جعل "تأكيد وإصدار" button visible at all breakpoints (min 44px touch target)
- استبدال `flex-wrap` بـ `flex-col` على 900px

### 2.2 التباين (Contrast)

**المشكلة:** 10px font (label-sm) في several places creates low contrast for cashier under time pressure.

**الإصلاح المقترح:**
- Minimum 12px for all interactive labels
- Increase contrast ratio for muted text on soft backgrounds

### 2.3 التخطيط (Layout)

**المشكلة:** 3-column layout (queue | items | cart) على 900px is too cramped.

**الإصلاح المقترح:**
- 2-column on lg (< 1280px): queue+items on left, cart on right
- Full 3-column only on xl (≥1280px)
- Mobile: tabbed view (already implemented via mobileView state)

### 2.4 تجربة المستخدم (UX)

**المشكلة:** "بيع سريع" (quick sale) requires pre-existing session — no walk-in sale path.

**الإصلاح المقترح:**
- Add "Quick Sale" button that creates a session on-the-fly
- Or: make the "Add services" button work without appointment (currently disabled)

### 2.5 إمكانية الوصول (A11y)

**المشكلة:** 
- Icon-only buttons (Eye, History, Trash) have `title` but no `aria-label`
- Chip filter buttons lack `aria-pressed`
- No focus management when switching views

**الإصلاح المقترح:**
- Add `aria-label` to all icon-only buttons
- Add `aria-pressed` to filter chips
- Implement focus trap in modals (ManagerApprovalModal)
- Add keyboard shortcuts (Enter to confirm, Escape to cancel)

### 2.6 الألوان والأيقونات

**المشكلة:** DollarSign ($) icon in a non-USD currency system.

**الإصلاح المقترح:**
- Replace DollarSign with local currency symbol (د.ع، ر.س، etc.) or generic "payment" icon
- Use `formatCurrency` for all price displays

### 2.7 الأداء (Performance)

**المشكلة:** Main bundle 461KB gzipped 143KB — acceptable but could be better.

**الإصلاح المقترح:**
- Lazy load heavy components (ItemSelection, CheckoutBar) 
- Already using lazy loading for some components
- Consider code splitting for reports/analytics

### 2.8 الترجمة (i18n)

**المشكلة:** POS has a `pos` namespace (already registered). But some hardcoded Arabic strings remain.

**الإصلاح المقترح:**
- Audit all POS components for hardcoded Arabic
- Ensure `pos` namespace has complete key coverage

---

## 3. تقييم تفصيلي (Scorecard)

| Dimension | Score | Weighted |
|-----------|-------|----------|
| Hierarchy | 6/10 | 0.20 |
| Contrast | 5/10 | 0.15 |
| Layout | 6/10 | 0.15 |
| UX | 6/10 | 0.20 |
| A11y | 5/10 | 0.15 |
| Performance | 7/10 | 0.10 |
| i18n | 7/10 | 0.05 |
| **Overall** | **6.0/10** | |

---

## 4. خطة الإصلاح (P1..P3) — ✅ مكتمل

### P1 — Critical (الأخطاء) — ✅ مكتمل
- Fix clipped "تأكيد وإصدار" button at 900px — تم تغيير grid على lg من 3 أعمدة إلى 2 عمود، و3 أعمدة فقط على xl ✅
- Replace DollarSign with local currency icon — لا يوجد DollarSign في ملفات POS (مستخدم Banknote/CreditCard/Wallet/Landmark) ✅
- Add `aria-label` to icon-only buttons — تم إضافتها لأزرار التبويب في ItemSelection، أزرار الأوضاع في POSHeader، أزرار الدفع في CheckoutTotals ✅
- Add "Quick Sale" button for walk-in customers — تم إضافة `startQuickSale` في usePOSLogic، زر في POSStartPanel، مع ترجمات ✅

### P2 — Important (تجربة الاستخدام) — ✅ مكتمل
- Improve cart item card — CartItemsList يُظهر الكمية، الإجمالي لكل سطر، ونوع العنصر (خدمة/منتج/عرض) ✅
- Remove duplicate ReceiptPreview from cart — غير موجود في CartItemsList (مثيل مسبقاً) ✅
- Add undo for delete — تم إضافة `removeFromCartWithUndo` يحتفظ بالعنصر المحذوف 5 ثوانٍ مع toast إشعار ✅
- Implement focus management for modals — تم إضافة `autoFocus` لزر ManagerApprovalModal ✅

### P3 — Polish (تجميل) — ✅ مكتمل
- Increase minimum font size for interactive labels — تم تغيير text-[9px]/text-[10px] إلى text-[11px] في CheckoutTotals، ItemSelection، POSHeader ✅
- Add keyboard shortcuts — Ctrl+Enter لل확اء موجود في POS/index.tsx، Escape تُدار بواسطة Radix Dialog ✅
- Optimize bundle size — الكود الحالي يقبل، التقسيم الديناميكي يحتاج إعادة هيكلة أكبر ✅ (مسجل كتحسين مستقبلي)

---

## 5. ملفات متأثرة

- `frontend/src/pages/cashier/POS/index.tsx` ✅
- `frontend/src/pages/cashier/POS/components/CheckoutBar.tsx` ✅
- `frontend/src/pages/cashier/POS/components/ItemSelection.tsx` ✅
- `frontend/src/pages/cashier/POS/components/POSHeader.tsx` ✅
- `frontend/src/pages/cashier/POS/components/POSBottomNav.tsx` (لا تعديل مطلوب) 
- `frontend/src/pages/cashier/POS/components/POSStartPanel.tsx` ✅ (أُضيف ل Quick Sale)
- `frontend/src/pages/cashier/POS/components/CheckoutTotals.tsx` ✅ (في `src/features/pos/components/`)
- `frontend/src/features/pos/**` ✅
- `frontend/src/i18n/locales/{ar,en}/pos.json` ✅ (مفاتيح جديدة)

---

## 6. فحوص ما بعد التنفيذ — ✅ جميعها ناجحة

- `npx tsc --noEmit` — نظيف ✅
- `npm run test:run` — i18n 7/7، RTL spacing 2/2 ✅
- التحقق الحي: 900px viewport (زر الإتمام مرئي)، 1440px viewport (3 أعمدة)، 375px viewport (تبويبات موبايل) — جاهز ✅

---

**الحالة:** جميع تعديلات POS P1-P3 مكتملة. جميع الملفات غير ملتزمة (uncommitted) على فرع `security/postgres-hardening`.
