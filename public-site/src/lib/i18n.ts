/**
 * i18n.ts — the translation catalogue and the pure translation helpers.
 *
 * This lives outside I18nContext for two reasons:
 *
 *  1. `translate()` is a plain function, so components that cannot use hooks —
 *     ErrorBoundary is a class, and index.html is a string — can still render
 *     real copy instead of hardcoded Arabic.
 *  2. Formatting (numbers, dates) is locale-aware here rather than being
 *     hardcoded to `toLocaleString("ar-EG")` at each call site, which is what
 *     made an English visitor see Arabic numerals in an English sentence.
 *
 * Interpolation uses `{name}`. A missing key falls back to Arabic, then to the
 * key itself, so a gap degrades visibly instead of rendering an empty string.
 *
 * Keeping the catalogue in one file is what makes it auditable: a test asserts
 * that `ar` and `en` have identical key sets.
 */

export type LocaleCode = "ar" | "en";

export const LOCALES: readonly LocaleCode[] = ["ar", "en"] as const;

export const DEFAULT_LOCALE: LocaleCode = "ar";

export interface LocaleMeta {
  code: LocaleCode;
  /** Endonym — always shown in its own language. */
  label: string;
  /** Name of the writing direction, for the toggle's accessible name. */
  dirLabel: string;
}

export const LOCALE_META: Record<LocaleCode, LocaleMeta> = {
  ar: { code: "ar", label: "العربية", dirLabel: "عربي" },
  en: { code: "en", label: "English", dirLabel: "English" },
};

export const isRTL = (locale: LocaleCode): boolean => locale === "ar";

/** BCP-47 tag used for Intl formatting and for the `lang` attribute. */
export const htmlLang = (locale: LocaleCode): string => locale;

/**
 * The locale `Intl` should format numbers and dates in.
 *
 * The `-u-nu-latn` extension pins Arabic to **Latin** digits.
 *
 * This was `ar-EG` plain, so `Intl.NumberFormat` produced Arabic-Indic digits:
 * the booking summary read `٠٫٠٠ ج.م` while the service count two rows above
 * read `0`, because the count went through React and the price went through
 * `Intl`. Two numbering systems on one screen is worse than either alone.
 *
 * Latin digits are also the right default for this product — the staff app
 * already does exactly this (`formatCurrency` there defaults to
 * `ar-EG-u-nu-latn`), prices and phone numbers are transcribed digit-for-digit,
 * and a tabular-figure font renders Latin numerals far more evenly in the
 * booking summary than the Arabic-Indic forms do.
 */
export const intlLocale = (locale: LocaleCode): string =>
  locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";

type Catalogue = Record<string, string>;

const ar = {
  /* ── shared ─────────────────────────────────────────────────────────── */
  "common.loading": "جاري التحميل...",
  "common.retry": "إعادة المحاولة",
  "common.back": "رجوع",
  "common.next": "التالي",
  "common.previous": "السابق",
  "common.continue": "متابعة",
  "common.close": "إغلاق",
  "common.cancel": "إلغاء",
  "common.home": "الصفحة الرئيسية",
  "common.skipToContent": "تخطي إلى المحتوى الرئيسي",
  "common.optional": "اختياري",
  "common.required": "مطلوب",
  "common.minutes": "دقيقة",
  "common.services": "خدمة",
  "common.open": "مفتوح",
  "common.closed": "مغلق",
  "common.optionalNote": "ملاحظات إضافية (اختياري)",

  /* ── navigation ─────────────────────────────────────────────────────── */
  "nav.home": "الرئيسية",
  "nav.services": "الخدمات",
  "nav.offers": "العروض",
  "nav.team": "الفريق",
  "nav.testimonials": "آراء العملاء",
  "nav.faq": "الأسئلة الشائعة",
  "nav.contact": "التواصل",
  "nav.bookNow": "احجز الآن",
  "nav.skipLabel": "القائمة الرئيسية",
  "nav.openMenu": "فتح القائمة",
  "nav.closeMenu": "إغلاق القائمة",

  /* ── weekday names ──────────────────────────────────────────────────── */
  "day.saturday": "السبت",
  "day.sunday": "الأحد",
  "day.monday": "الإثنين",
  "day.tuesday": "الثلاثاء",
  "day.wednesday": "الأربعاء",
  "day.thursday": "الخميس",
  "day.friday": "الجمعة",

  /* ── theme ──────────────────────────────────────────────────────────── */
  "theme.label": "تبديل المظهر",
  "theme.listLabel": "اختر المظهر",
  "theme.light": "فاتح",
  "theme.dark": "داكن",
  "theme.system": "تلقائي",

  /* ── language ───────────────────────────────────────────────────────── */
  "language.label": "تغيير اللغة",
  "language.listLabel": "اختر اللغة",
  "language.toggleLabel": "Switch to {language}",

  /* ── currency ───────────────────────────────────────────────────────── */
  "currency.label": "تغيير العملة",
  "currency.listLabel": "اختر العملة",
  "currency.toggleLabel": "Switch to {currency}",

  /* ── landing page ───────────────────────────────────────────────────── */
  "landing.metaDescription":
    "احجز موعدك بسهولة. خدمات واضحة وأسعار ظاهرة وتجربة حجز احترافية.",
  "landing.heroFallbackTitle": "احجز موعدك في {salon} بسهولة",
  "landing.heroFallbackSubtitle":
    "خدمات واضحة، أسعار ظاهرة، وفريق محترف يساعدك تختار الموعد المناسب بدون تشتت.",
  "landing.browseServices": "تصفح الخدمات",
  "landing.bookAppointment": "احجز موعدك الآن",
  "landing.bookYourAppointment": "احجز موعدك الآن",
  "landing.openNow": "مفتوح الآن",
  "landing.closedNow": "مغلق الآن",
  "landing.visitUs": "زورنا في",
  "landing.statServices": "خدمة متاحة للحجز الآن",
  "landing.statBarbers": "حلاق في الفريق",
  "landing.statOpen": "الصالون مفتوح الآن",
  "landing.statHours": "ساعات العمل",
  "landing.servicesTitle": "خدمات واضحة وأسعار ظاهرة",
  "landing.servicesSubtitle":
    "اختر الخدمة المناسبة لك بسرعة. كل بطاقة تعرض الاسم، المدة، السعر، وزر الحجز بدون تزاحم.",
  "landing.noServices": "لم يتم إضافة خدمات بعد. يمكنك الحجز مباشرة أو التواصل مع الصالون.",
  "landing.bookService": "احجز الخدمة",
  "landing.featured": "مميز",
  "landing.inlineBookingTitle": "احجز في 3 خطوات",
  "landing.inlineBookingService": "الخدمة",
  "landing.inlineBookingBarber": "المتخصص",
  "landing.inlineBookingSlot": "الموعد",
  "landing.inlineBookingTotal": "المدة والسعر",
  "landing.inlineBookingConfirm": "متابعة الحجز",
  "landing.inlineBookingAnyBarber": "أي متخصص",
  "landing.openNowBooking": "الصالون مفتوح الآن — الحجز متاح اليوم",
  "landing.closedNowHours": "شوف ساعات العمل أو احجز لموعد لاحق",
  "landing.heroPrimaryCta": "احجز موعدك الآن",
  "landing.heroSecondaryCta": "تصفح الخدمات",
  "landing.yearsExperience": "سنوات خبرة",
  "landing.monthlyOffer": "عروض هذا الشهر",
  "landing.offersHeadline": "عروض واضحة",
  "landing.offersSubline": "بقيمة حقيقية",
  "landing.galleryEyebrow": "معرض الأعمال",
  "landing.galleryTitle": "نتائج تتحدث عن نفسها",
  "landing.gallerySubtitle": "نماذج توضيحية لأساليب القص والتشذيب والعناية التي يقدمها الفريق.",
  "landing.teamEyebrow": "فريق العمل",
  "landing.reviewsEyebrow": "آراء العملاء",
  "landing.contactEyebrow": "تواصل معنا",
  "landing.contactTitle": "كيف توصلنا؟",
  "landing.copyAddress": "نسخ العنوان",
  "landing.addressCopied": "تم نسخ العنوان",
  "landing.openMap": "فتح الخريطة",
  "landing.followUs": "تابعنا",
  "landing.filtersAll": "الكل",
  "landing.filtersTitle": "تصفّح حسب النوع",
  "landing.noMatches": "لا توجد خدمات مطابقة لهذا الفلتر.",
  "landing.tierBasic": "أساسي",
  "landing.tierPremium": "بريميوم",
  "landing.bookWith": "احجز مع {name}",
  "landing.nextSlot": "أقرب موعد: {slot}",
  "landing.followUsHint": "أحدث القصات والعروض على حساباتنا.",
  "landing.offersTitle": "عروض مختارة لهذا الأسبوع",
  "landing.offersSubtitle":
    "العروض تظهر في كروت بسيطة حتى تكون الأسعار والخصومات واضحة على الموبايل والكمبيوتر.",
  "landing.discount": "خصم {percent}%",
  "landing.specialOffer": "عرض خاص",
  "landing.limitedOffer": "عرض محدود لفترة قصيرة.",
  "landing.bookOffer": "احجز العرض",
  "landing.teamTitle": "خبراء يقدمون تجربة ثابتة",
  "landing.teamSubtitle": "تعرف على الفريق قبل اختيار موعدك. البطاقات مصممة لتظهر الصور والأسماء بوضوح.",
  "landing.teamFallbackTitle": "خبير حلاقة وعناية",
  "landing.testimonialsFallbackTitle": "تجربة واضحة من أول زيارة",
  "landing.contactSubtitle": "تواصل معنا لمعرفة العنوان وتأكيد الموعد المناسب لك.",
  "landing.workingHours": "ساعات العمل",
  "landing.statusLabel": "حالة الصالون",
  "landing.addressLabel": "العنوان",
  "landing.phoneLabel": "الهاتف / واتساب",
  "landing.callUs": "اتصل بنا",
  "landing.contactMissing": "لم يتم تسجيل بيانات التواصل بعد.",
  "footer.links": "روابط",
  "footer.followUs": "تابعنا",
  "footer.languageSwitch": "العربية / English",
  "landing.whatsapp": "تواصل عبر واتساب",
  "landing.viewMap": "عرض الموقع على الخريطة",
  "landing.professionalSalon": "صالون محترف",
  "landing.copyright": "© {year} جميع الحقوق محفوظة",
  "landing.workGallery": "معرض أعمالنا",
  "landing.hairSalonIn": "صالون حلاقة {salon}",
  "landing.location": "الموقع على الخريطة",
  "landing.serviceFallbackName": "خدمة احترافية",
  "landing.serviceFallbackDescription":
    "خدمة مصممة بعناية لتجربة واضحة وسريعة داخل الصالون.",
  "landing.barberFallbackName": "خبير صالون",
  "landing.heroImageAlt": "صورة رئيسية من {salon}",
  "landing.featuresTitle": "لماذا يختارنا العملاء",
  "landing.portfolioTitle": "من أعمالنا",
  "landing.portfolioOpen": "تكبير الصورة {index}",
  "landing.portfolioCounter": "صورة {current} من {total}",
  "landing.testimonialsTitle": "آراء العملاء",
  "landing.review.verifiedVisit": "زيارة موثقة",
  "landing.services.notFound": "الخدمة غير موجودة",
  "landing.barbers.notFound": "الحلاق غير موجود",
  "landing.offers.notFound": "العرض غير موجود",
  "landing.services.eyebrow": "خدمة",
  "landing.barbers.eyebrow": "من الفريق",
  "landing.offers.eyebrow": "عرض",
  "landing.priceLabel": "السعر",
  "landing.durationLabel": "المدة",
  "landing.detailTrust.confirmed": "الموعد بيتأكد فور الحجز",
  "landing.detailTrust.durationKnown": "المدة والسعر معروفين قبل الحجز",
  "landing.detailTrust.hoursKnown": "ساعات العمل واضحة على مدار الأسبوع",
  "landing.trustBadges": "مؤشرات الثقة",
  "landing.stats": "أرقام عن الصالون",

  /* ── FAQ (structured data + on-page copy share these) ──────────────── */
  "landing.faqEyebrow": "الأسئلة الشائعة",
  "landing.faqTitle": "أسئلة يسألها العملاء",
  "landing.faqSubtitle": "إجابات سريعة قبل أن تحجز.",
  "landing.faqHint": "اضغط على أي سؤال لعرض الإجابة.",
  "faq.online": "هل يمكنني الحجز أونلاين؟",
  "faq.onlineAnswer": "نعم، يمكنك اختيار الخدمة والموعد من صفحة الحجز مباشرة.",
  "faq.prices": "هل الأسعار واضحة قبل الحجز؟",
  "faq.pricesAnswer": "نعم، تظهر أسعار الخدمات ومدتها داخل صفحة الصالون.",
  "faq.contact": "كيف أتواصل مع الصالون؟",
  "faq.contactAnswer": "يمكنك الاتصال أو التواصل عبر واتساب من أزرار الصفحة.",

  /* ── booking ────────────────────────────────────────────────────────── */
  "booking.title": "احجز موعدك الآن",
  "booking.metaDescription": "احجز موعدك في {salon} عبر أربع خطوات: الخدمة، الحلاق، الموعد، ثم بياناتك.",
  "booking.subtitle": "اتبع الخطوات الموضحة لتأكيد حجزك في ثوانٍ. كل تفصيلة هنا صُممت لراحتك.",
  "booking.backHome": "العودة إلى الصفحة الرئيسية",
  "booking.secure": "حجز آمن",
  "booking.loading": "جاري تجهيز صفحة الحجز...",
  "booking.summaryHeading": "ملخص الحجز",
  "booking.stepsHeading": "خطوات الحجز",
  "booking.currentStep": "الخطوة الحالية",
  "booking.stepOf": "الخطوة {current} من {total}",
  "booking.step.services": "الخدمات",
  "booking.step.servicesHint": "اختر ما يناسبك من القائمة",
  "booking.step.barber": "الحلاق",
  "booking.step.barberHint": "حدد المختص أو اتركه متاحًا",
  "booking.step.schedule": "الموعد",
  "booking.step.scheduleHint": "اختر اليوم والوقت المناسبين",
  "booking.step.details": "البيانات",
  "booking.step.detailsHint": "أكد معلوماتك قبل الإرسال",
  "booking.filterByCategory": "تصفية حسب الفئة",
  "booking.allCategories": "الكل",
  "booking.noServicesInCategory": "لا توجد خدمات متاحة في هذه الفئة.",
  "booking.uncategorised": "خدمات أخرى",
  "booking.nextToBarber": "المتابعة لاختيار الحلاق",
  "booking.nextToSchedule": "اختيار الموعد",
  "booking.nextToDetails": "تأكيد البيانات",
  "booking.anyBarber": "أي حلاق متاح",
  "booking.anyBarberCaption": "الخيار الأسرع",
  "booking.pickBarber": "اختر الحلاق",
  "booking.pickDate": "اختر التاريخ",
  "booking.dateHint": "يمكنك الحجز حتى 30 يومًا من اليوم.",
  "booking.availableSlots": "المواعيد المتاحة",
  "booking.pickDateFirst": "يرجى اختيار التاريخ لعرض الأوقات المتاحة.",
  "booking.noSlots": "عذرًا، جميع المواعيد محجوزة في هذا اليوم. جرّب يومًا آخر.",
  "booking.slots.morning": "فترة الصباح",
  "booking.slots.afternoon": "فترة الظهيرة",
  "booking.slots.evening": "فترة المساء",
  "booking.detailsLegend": "البيانات الشخصية",
  "booking.finalSummary": "الملخص النهائي",
  "booking.field.firstName": "الاسم الأول",
  "booking.field.lastName": "اسم العائلة",
  "booking.field.phone": "رقم الهاتف",
  "booking.field.email": "البريد الإلكتروني (اختياري)",
  "booking.field.notes": "ملاحظات إضافية (اختياري)",
  "booking.error.firstName": "الرجاء إدخال الاسم الأول.",
  "booking.error.phone": "الرجاء إدخال رقم هاتف صحيح.",
  "booking.error.email": "الرجاء إدخال بريد إلكتروني صحيح.",
  "booking.error.fixFields": "الرجاء تصحيح الحقول المميزة",
  "booking.error.catalog": "فشل تحميل البيانات، يرجى المحاولة لاحقاً",
  "booking.error.slots": "فشل جلب الأوقات المتاحة",
  "booking.error.submit": "فشل تسجيل الحجز",
  "booking.error.noService": "يرجى اختيار خدمة واحدة على الأقل",
  "booking.error.noDateTime": "يرجى اختيار التاريخ والوقت",
  "booking.submit": "تأكيد الحجز",
  "booking.submitting": "جاري المعالجة...",
  "booking.success": "تم الحجز بنجاح!",
  "booking.successBody": "شكرًا لاختيارك {salon}. تم تأكيد موعدك وستصلك رسالة بالتفاصيل قريبًا.",
  "booking.backHomeCta": "العودة للرئيسية",
  "booking.confirmation.referenceLabel": "رقم الحجز",
  "booking.confirmation.reference": "رقم الحجز: {reference}",
  "booking.confirmation.date": "الموعد: {date}",
  "booking.confirmation.time": "الوقت: {time}",
  "booking.confirmation.services": "الخدمات: {services}",
  "booking.confirmation.servicesLabel": "الخدمات",
  "booking.confirmation.notesLabel": "ملاحظاتك",
  "booking.confirmation.addToCalendar": "أضف للتقويم",
  "booking.confirmation.sendWhatsapp": "أرسل على واتساب",
  "booking.confirmation.directions": "الاتجاهات",
  "booking.confirmation.callSalon": "اتصال بالصالون",
  "booking.confirmation.copyDetails": "نسخ التفاصيل",
  "booking.confirmation.copied": "تم النسخ",
  "booking.confirmation.announced": "تم تأكيد حجزك. رقم الحجز {reference}، الموعد {date} الساعة {time}.",
  "booking.review.title": "كيف كانت تجربتك؟",
  "booking.review.placeholder": "اكتب رأيك هنا...",
  "booking.review.submit": "إرسال التقييم",
  "booking.review.submitting": "جاري الإرسال...",
  "booking.review.thanks": "شكراً لتقييمك!",
  "booking.review.selectRating": "اختر عدد النجوم أولاً",
  "booking.review.error": "حدث خطأ أثناء إرسال التقييم",
  "booking.review.starLabel": "{star} نجوم",
  "booking.draftRestored": "استعدنا بياناتك من آخر مرة.",
  "booking.summary.services": "الخدمات المختارة",
  "booking.summary.date": "تاريخ الموعد",
  "booking.summary.time": "توقيت الحجز",
  "booking.summary.barber": "الحلاق المختار",
  "booking.summary.count": "عدد الخدمات",
  "booking.summary.total": "الإجمالي",
  "booking.summary.due": "الإجمالي المستحق",
  "booking.asideHeading": "تفاصيل الموعد",
  "booking.selectedServices": "الخدمات المختارة",
  "booking.cartEmpty": "لم تختر أي خدمة بعد.",
  "booking.payInSalon": "الدفع داخل الصالون",
  "booking.durationEstimate": "مدة الجلسة التقريبية",
  "booking.barbersServing": "نخبة الحلاقين في خدمتك",
  "booking.hintMultiple": "يمكنك اختيار عدة خدمات",
  "booking.contact.location": "الموقع",
  "booking.contact.phone": "الهاتف",
  "booking.noteAboutBarber": "نلتزم بموعدك بدقة. في حالات نادرة قد يتغير الحلاق المنفذ لضمان انسيابية تجربتك.",
  "booking.logoAlt": "شعار {salon}",
  "booking.barberImageAlt": "صورة {name}",
  "booking.slotsGroupLabel": "مواعيد {group}",

  /* ── member portal ──────────────────────────────────────────────────── */
  "member.trigger": "حسابي",
  "member.loginRegister": "تسجيل الدخول / إنشاء حساب",
  "member.title": "بوابة الأعضاء",
  "member.points": "{points} نقطة",
  "member.tabLogin": "تسجيل الدخول",
  "member.tabRegister": "حساب جديد",
  "member.field.name": "الاسم",
  "member.field.email": "البريد الإلكتروني",
  "member.field.password": "كلمة المرور",
  "member.field.phone": "رقم الهاتف",
  "member.submitLogin": "دخول",
  "member.submitRegister": "إنشاء الحساب",
  "member.haveAccount": "لديك حساب بالفعل؟",
  "member.noAccount": "ليس لديك حساب؟",
  "member.logout": "تسجيل الخروج",
  "member.bookAgain": "احجز مرة أخرى",
  "member.welcome": "أهلاً {name}",
  "member.error.generic": "حدث خطأ، حاول مرة أخرى",
  "member.guestName": "عميل",
  "member.pointsUnit": "نقطة",
  "member.pointsLabel": "نقاط",
  "member.bookings": "الحجوزات",
  "member.yourBookings": "حجوزاتك",
  "member.cancelBooking": "إلغاء أقرب موعد",
  "member.status.pending": "في الانتظار",
  "member.status.confirmed": "مؤكد",
  "member.status.waiting": "في الانتظار بالمحل",
  "member.status.in_progress": "جاري الخدمة",
  "member.status.completed": "مكتمل",
  "member.status.done": "مكتمل",
  "member.status.paid": "مدفوع",
  "member.status.checked_out": "تم الحساب",
  "member.status.cancelled": "ملغي",
  "member.status.auto_cancelled": "ملغي تلقائياً",
  "member.status.no_show": "لم يحضر",
  "member.rating": "التقييم",
  "member.tierRemaining": "باقي {points} نقطة للوصول إلى {tier}",
  "member.tierMaxed": "وصلت لأعلى مستوى!",
  "member.firstRewardHint": "أول حجز يكسبك ",
  "member.firstReward": "100 نقطة",

  /* ── Member portal welcome panel ────────────────────────────────────── */
  "member.panel.welcome": "أهلاً بك",
  "member.panel.tagline": "حسابك يجمع حجوزاتك ومكافآتك في مكان واحد.",
  "member.panel.benefit.loyalty": "نقاط ومكافآت مع كل زيارة",
  "member.panel.benefit.history": "حجوزاتك كلها في مكان واحد",
  "member.panel.benefit.offers": "عروض خاصة بالأعضاء فقط",

  /* ── Loyalty tier labels ────────────────────────────────────────────── */
  "member.tier.bronze": "برونزي",
  "member.tier.silver": "فضي",
  "member.tier.gold": "ذهبي",
  "member.tier.platinum": "بلاتيني",

  /* ── PWA install prompt ─────────────────────────────────────────────── */
  "pwa.title": "ثبّت التطبيق على هاتفك",
  "pwa.bodyNative": "وصول سريع + يعمل بدون إنترنت",
  "pwa.bodyIOS": "اضغط على أيقونة المشاركة ثم Add to Home Screen",
  "pwa.install": "تثبيت",

  /* ── offline / errors ───────────────────────────────────────────────── */
  "offline.title": "لا يوجد اتصال بالإنترنت",
  "offline.reconnecting": "جاري استعادة الاتصال...",
  "offline.bodyOffline": "يبدو أنك غير متصل بالإنترنت. تحقق من الاتصال أو حاول مرة أخرى.",
  "offline.bodyRetrying": "نحاول إعادة الاتصال بالخادم. لحظات وتعود التجربة.",
  "offline.signature": "Salon Pro — تجربة الحلاقة الملكية",

  "notFound.title": "الصفحة غير موجودة",
  "notFound.body":
    "الرابط الذي فتحته غير صحيح أو تم نقل الصفحة. يمكنك العودة إلى الصفحة الرئيسية أو الانتقال مباشرة إلى صفحة الحجز.",
  "notFound.book": "احجز موعدك الآن",

  "error.title": "تعذر عرض هذه الصفحة",
  "error.body": "حدث خطأ أثناء تحميل المحتوى. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.",

  "loader.announcing": "جاري تحميل الصفحة",
  "loader.subtitle": "جاري تحضير التجربة الملكية...",
  "loader.eyebrow": "Royal Experience",
} as const;

/**
 * Typed against the *keys* of `ar` rather than `typeof ar`.
 *
 * `Record<keyof typeof ar, string>` gives compile-time key parity — adding a
 * string to Arabic and forgetting English is a type error, not a runtime
 * fallback — while leaving the values free to be ordinary strings. Annotating
 * it `typeof ar` instead would demand Arabic and English hold the exact same
 * character sequence, which is nonsense.
 */
const en: Record<keyof typeof ar, string> = {
  /* ── shared ─────────────────────────────────────────────────────────── */
  "common.loading": "Loading...",
  "common.retry": "Retry",
  "common.back": "Back",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.continue": "Continue",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.home": "Home",
  "common.skipToContent": "Skip to main content",
  "common.optional": "optional",
  "common.required": "required",
  "common.minutes": "min",
  "common.services": "services",
  "common.open": "Open",
  "common.closed": "Closed",
  "common.optionalNote": "Additional notes (optional)",

  /* ── navigation ─────────────────────────────────────────────────────── */
  "nav.home": "Home",
  "nav.services": "Services",
  "nav.offers": "Offers",
  "nav.team": "Team",
  "nav.testimonials": "Testimonials",
  "nav.faq": "FAQ",
  "nav.contact": "Contact",
  "nav.bookNow": "Book Now",
  "nav.skipLabel": "Main navigation",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",

  /* ── weekday names ──────────────────────────────────────────────────── */
  "day.saturday": "Saturday",
  "day.sunday": "Sunday",
  "day.monday": "Monday",
  "day.tuesday": "Tuesday",
  "day.wednesday": "Wednesday",
  "day.thursday": "Thursday",
  "day.friday": "Friday",

  /* ── theme ──────────────────────────────────────────────────────────── */
  "theme.label": "Change appearance",
  "theme.listLabel": "Choose appearance",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",

  /* ── language ───────────────────────────────────────────────────────── */
  "language.label": "Change language",
  "language.listLabel": "Choose language",
  "language.toggleLabel": "Switch to {language}",

  /* ── currency ───────────────────────────────────────────────────────── */
  "currency.label": "Change currency",
  "currency.listLabel": "Choose currency",
  "currency.toggleLabel": "Switch to {currency}",

  /* ── landing page ───────────────────────────────────────────────────── */
  "landing.metaDescription":
    "Book your appointment with ease. Clear services, visible prices, and a booking flow that works.",
  "landing.heroFallbackTitle": "Book at {salon} in seconds",
  "landing.heroFallbackSubtitle":
    "Clear services, visible prices, and a professional team that helps you pick the right time without the guesswork.",
  "landing.browseServices": "Browse services",
  "landing.bookAppointment": "Book your appointment",
  "landing.bookYourAppointment": "Book your appointment",
  "landing.openNow": "Open now",
  "landing.closedNow": "Currently closed",
  "landing.visitUs": "Visit us at",
  "landing.statServices": "Services bookable now",
  "landing.statBarbers": "Barbers on the team",
  "landing.statOpen": "The salon is open now",
  "landing.statHours": "Working hours",
  "landing.servicesTitle": "Clear services, visible prices",
  "landing.servicesSubtitle":
    "Pick the service you need quickly. Every card shows the name, duration, price and a booking button.",
  "landing.noServices": "No services have been added yet. You can book directly or get in touch.",
  "landing.bookService": "Book service",
  "landing.featured": "Featured",
  "landing.inlineBookingTitle": "Book in 3 steps",
  "landing.inlineBookingService": "Service",
  "landing.inlineBookingBarber": "Stylist",
  "landing.inlineBookingSlot": "Time",
  "landing.inlineBookingTotal": "Duration & price",
  "landing.inlineBookingConfirm": "Continue to booking",
  "landing.inlineBookingAnyBarber": "Any stylist",
  "landing.openNowBooking": "Open now — book a slot today",
  "landing.closedNowHours": "See opening hours or book for later",
  "landing.heroPrimaryCta": "Book your slot",
  "landing.heroSecondaryCta": "Browse services",
  "landing.yearsExperience": "years of experience",
  "landing.monthlyOffer": "This month's offers",
  "landing.offersHeadline": "Clear offers",
  "landing.offersSubline": "with real value",
  "landing.galleryEyebrow": "Our work",
  "landing.galleryTitle": "Results that speak for themselves",
  "landing.gallerySubtitle": "A sample of the cutting, shaping and care styles the team offers.",
  "landing.teamEyebrow": "The team",
  "landing.reviewsEyebrow": "Customer reviews",
  "landing.contactEyebrow": "Get in touch",
  "landing.contactTitle": "How to reach us",
  "landing.copyAddress": "Copy address",
  "landing.addressCopied": "Address copied",
  "landing.openMap": "Open map",
  "landing.followUs": "Follow us",
  "landing.filtersAll": "All",
  "landing.filtersTitle": "Filter by type",
  "landing.noMatches": "No services match this filter.",
  "landing.tierBasic": "Basic",
  "landing.tierPremium": "Premium",
  "landing.bookWith": "Book with {name}",
  "landing.nextSlot": "Next available: {slot}",
  "landing.followUsHint": "Latest cuts and offers on our accounts.",
  "landing.offersTitle": "This week's selected offers",
  "landing.offersSubtitle":
    "Offers appear as simple cards so prices and discounts stay clear on every screen size.",
  "landing.discount": "{percent}% off",
  "landing.specialOffer": "Special offer",
  "landing.limitedOffer": "Limited-time offer.",
  "landing.bookOffer": "Book offer",
  "landing.teamTitle": "Experts who keep it consistent",
  "landing.teamSubtitle": "Meet the team before you book. Cards are designed to show photos and names clearly.",
  "landing.teamFallbackTitle": "Barber and care specialist",
  "landing.testimonialsFallbackTitle": "A clear experience from the first visit",
  "landing.contactSubtitle": "Get in touch for our address and to confirm a time that suits you.",
  "landing.workingHours": "Working hours",
  "landing.statusLabel": "Salon status",
  "landing.addressLabel": "Address",
  "landing.phoneLabel": "Phone / WhatsApp",
  "landing.callUs": "Call us",
  "landing.contactMissing": "No contact details have been published yet.",
  "footer.links": "Links",
  "footer.followUs": "Follow us",
  "footer.languageSwitch": "العربية / English",
  "landing.whatsapp": "Contact on WhatsApp",
  "landing.viewMap": "View on the map",
  "landing.professionalSalon": "Professional Salon",
  "landing.copyright": "© {year} All rights reserved",
  "landing.workGallery": "Our work",
  "landing.hairSalonIn": "{salon} hair salon",
  "landing.location": "Location on the map",
  "landing.serviceFallbackName": "Professional service",
  "landing.serviceFallbackDescription":
    "A service designed for a clear, fast experience inside the salon.",
  "landing.barberFallbackName": "Salon specialist",
  "landing.heroImageAlt": "Cover image from {salon}",
  "landing.featuresTitle": "Why clients choose us",
  "landing.portfolioTitle": "Our work",
  "landing.portfolioOpen": "Enlarge image {index}",
  "landing.portfolioCounter": "Image {current} of {total}",
  "landing.testimonialsTitle": "What clients say",
  "landing.review.verifiedVisit": "Verified visit",
  "landing.services.notFound": "Service not found",
  "landing.barbers.notFound": "Barber not found",
  "landing.offers.notFound": "Offer not found",
  "landing.services.eyebrow": "Service",
  "landing.barbers.eyebrow": "From the team",
  "landing.offers.eyebrow": "Offer",
  "landing.priceLabel": "Price",
  "landing.durationLabel": "Duration",
  "landing.detailTrust.confirmed": "Your appointment is confirmed instantly",
  "landing.detailTrust.durationKnown": "Duration and price are known before you book",
  "landing.detailTrust.hoursKnown": "Opening hours are published for the whole week",
  "landing.trustBadges": "Trust indicators",
  "landing.stats": "Salon figures",

  /* ── FAQ (structured data + on-page copy share these) ──────────────── */
  "landing.faqEyebrow": "Frequently asked",
  "landing.faqTitle": "Questions customers ask",
  "landing.faqSubtitle": "Quick answers before you book.",
  "landing.faqHint": "Select a question to see the answer.",
  "faq.online": "Can I book online?",
  "faq.onlineAnswer": "Yes. Pick a service and a time on the booking page.",
  "faq.prices": "Are prices clear before I book?",
  "faq.pricesAnswer": "Yes. Every service shows its price and duration on the salon page.",
  "faq.contact": "How do I get in touch?",
  "faq.contactAnswer": "Call the salon or message us on WhatsApp from the buttons on the page.",

  /* ── booking ────────────────────────────────────────────────────────── */
  "booking.title": "Book your appointment",
  "booking.metaDescription": "Book at {salon} in four steps: service, barber, time, then your details.",
  "booking.subtitle": "Follow the steps to confirm your booking in seconds. Every detail here is designed for your comfort.",
  "booking.backHome": "Back to the home page",
  "booking.secure": "Secure booking",
  "booking.loading": "Preparing the booking page...",
  "booking.summaryHeading": "Booking summary",
  "booking.stepsHeading": "Booking steps",
  "booking.currentStep": "Current step",
  "booking.stepOf": "Step {current} of {total}",
  "booking.step.services": "Services",
  "booking.step.servicesHint": "Pick what suits you from the list",
  "booking.step.barber": "Barber",
  "booking.step.barberHint": "Choose a specialist or leave it open",
  "booking.step.schedule": "Schedule",
  "booking.step.scheduleHint": "Pick a day and time that work",
  "booking.step.details": "Details",
  "booking.step.detailsHint": "Confirm your information before sending",
  "booking.filterByCategory": "Filter by category",
  "booking.allCategories": "All",
  "booking.noServicesInCategory": "No services available in this category.",
  "booking.uncategorised": "Other services",
  "booking.nextToBarber": "Continue to barber",
  "booking.nextToSchedule": "Choose a time",
  "booking.nextToDetails": "Confirm details",
  "booking.anyBarber": "Any available barber",
  "booking.anyBarberCaption": "The fastest option",
  "booking.pickBarber": "Choose your barber",
  "booking.pickDate": "Pick a date",
  "booking.dateHint": "You can book up to 30 days ahead.",
  "booking.availableSlots": "Available times",
  "booking.pickDateFirst": "Pick a date to see the available times.",
  "booking.noSlots": "Sorry, every slot on this day is taken. Try another day.",
  "booking.slots.morning": "Morning",
  "booking.slots.afternoon": "Afternoon",
  "booking.slots.evening": "Evening",
  "booking.detailsLegend": "Personal details",
  "booking.finalSummary": "Final summary",
  "booking.field.firstName": "First name",
  "booking.field.lastName": "Last name",
  "booking.field.phone": "Phone number",
  "booking.field.email": "Email address (optional)",
  "booking.field.notes": "Additional notes (optional)",
  "booking.error.firstName": "Please enter your first name.",
  "booking.error.phone": "Please enter a valid phone number.",
  "booking.error.email": "Please enter a valid email address.",
  "booking.error.fixFields": "Please correct the highlighted fields",
  "booking.error.catalog": "Could not load the data. Please try again later.",
  "booking.error.slots": "Could not load the available times.",
  "booking.error.submit": "Could not complete the booking.",
  "booking.error.noService": "Please choose at least one service",
  "booking.error.noDateTime": "Please choose a date and a time",
  "booking.submit": "Confirm booking",
  "booking.submitting": "Processing...",
  "booking.success": "Booking confirmed!",
  "booking.successBody": "Thanks for choosing {salon}. Your appointment is confirmed and the details will reach you shortly.",
  "booking.backHomeCta": "Back to home",
  "booking.confirmation.referenceLabel": "Booking reference",
  "booking.confirmation.reference": "Booking reference: {reference}",
  "booking.confirmation.date": "Appointment: {date}",
  "booking.confirmation.time": "Time: {time}",
  "booking.confirmation.services": "Services: {services}",
  "booking.confirmation.servicesLabel": "Services",
  "booking.confirmation.notesLabel": "Your notes",
  "booking.confirmation.addToCalendar": "Add to calendar",
  "booking.confirmation.sendWhatsapp": "Send on WhatsApp",
  "booking.confirmation.directions": "Directions",
  "booking.confirmation.callSalon": "Call the salon",
  "booking.confirmation.copyDetails": "Copy details",
  "booking.confirmation.copied": "Copied",
  "booking.confirmation.announced": "Your booking is confirmed. Reference {reference}, on {date} at {time}.",
  "booking.review.title": "How was your experience?",
  "booking.review.placeholder": "Write your review here...",
  "booking.review.submit": "Submit review",
  "booking.review.submitting": "Submitting...",
  "booking.review.thanks": "Thank you for your review!",
  "booking.review.selectRating": "Please select a star rating first",
  "booking.review.error": "An error occurred while submitting your review",
  "booking.review.starLabel": "{star} stars",
  "booking.draftRestored": "We restored your details from last time.",
  "booking.summary.services": "Selected services",
  "booking.summary.date": "Appointment date",
  "booking.summary.time": "Appointment time",
  "booking.summary.barber": "Barber",
  "booking.summary.count": "Number of services",
  "booking.summary.total": "Total",
  "booking.summary.due": "Amount due",
  "booking.asideHeading": "Appointment details",
  "booking.selectedServices": "Selected services",
  "booking.cartEmpty": "You have not selected any services yet.",
  "booking.payInSalon": "Pay at the salon",
  "booking.durationEstimate": "Estimated session length",
  "booking.barbersServing": "A team of specialists at your service",
  "booking.hintMultiple": "You can select several services",
  "booking.contact.location": "Location",
  "booking.contact.phone": "Phone",
  "booking.noteAboutBarber": "We take appointments seriously. In rare cases the assigned barber may change to keep the experience smooth.",
  "booking.logoAlt": "{salon} logo",
  "booking.barberImageAlt": "Photo of {name}",
  "booking.slotsGroupLabel": "{group} appointments",

  /* ── member portal ──────────────────────────────────────────────────── */
  "member.trigger": "My account",
  "member.loginRegister": "Sign in / create account",
  "member.title": "Member portal",
  "member.points": "{points} points",
  "member.tabLogin": "Sign in",
  "member.tabRegister": "Sign up",
  "member.field.name": "Name",
  "member.field.email": "Email address",
  "member.field.password": "Password",
  "member.field.phone": "Phone number",
  "member.submitLogin": "Sign in",
  "member.submitRegister": "Create account",
  "member.haveAccount": "Already have an account?",
  "member.noAccount": "Don't have an account?",
  "member.logout": "Sign out",
  "member.bookAgain": "Book again",
  "member.welcome": "Welcome, {name}",
  "member.error.generic": "Something went wrong. Please try again.",
  "member.guestName": "Guest",
  "member.pointsUnit": "pts",
  "member.pointsLabel": "Points",
  "member.bookings": "Bookings",
  "member.yourBookings": "Your bookings",
  "member.cancelBooking": "Cancel my next booking",
  "member.status.pending": "Pending",
  "member.status.confirmed": "Confirmed",
  "member.status.waiting": "Waiting at the salon",
  "member.status.in_progress": "In progress",
  "member.status.completed": "Completed",
  "member.status.done": "Completed",
  "member.status.paid": "Paid",
  "member.status.checked_out": "Checked out",
  "member.status.cancelled": "Cancelled",
  "member.status.auto_cancelled": "Auto-cancelled",
  "member.status.no_show": "No-show",
  "member.rating": "Rating",
  "member.tierRemaining": "{points} points to reach {tier}",
  "member.tierMaxed": "You have reached the top tier!",
  "member.firstRewardHint": "Your first booking earns ",
  "member.firstReward": "100 points",

  /* ── Member portal welcome panel ────────────────────────────────────── */
  "member.panel.welcome": "Welcome",
  "member.panel.tagline": "Your bookings and rewards, all in one place.",
  "member.panel.benefit.loyalty": "Points and rewards with every visit",
  "member.panel.benefit.history": "Every booking in one place",
  "member.panel.benefit.offers": "Members-only offers",

  /* ── Loyalty tier labels ────────────────────────────────────────────── */
  "member.tier.bronze": "Bronze",
  "member.tier.silver": "Silver",
  "member.tier.gold": "Gold",
  "member.tier.platinum": "Platinum",

  /* ── PWA install prompt ─────────────────────────────────────────────── */
  "pwa.title": "Install the app on your phone",
  "pwa.bodyNative": "Quick access, and it works offline",
  "pwa.bodyIOS": "Tap the share icon, then Add to Home Screen",
  "pwa.install": "Install",

  /* ── offline / errors ───────────────────────────────────────────────── */
  "offline.title": "No internet connection",
  "offline.reconnecting": "Restoring connection...",
  "offline.bodyOffline": "You appear to be offline. Check your connection or try again.",
  "offline.bodyRetrying": "We are reconnecting to the server. Back in a moment.",
  "offline.signature": "Salon Pro — the complete experience",

  "notFound.title": "Page not found",
  "notFound.body":
    "The link you opened is incorrect or the page has moved. You can return home or go straight to the booking page.",
  "notFound.book": "Book your appointment",

  "error.title": "This page could not be displayed",
  "error.body": "Something went wrong while loading the content. You can retry or return to the home page.",

  "loader.announcing": "Loading page",
  "loader.subtitle": "Preparing the signature experience...",
  "loader.eyebrow": "Royal Experience",
};

/**
 * Arabic is the fallback for every key, so a missing English string degrades to
 * readable Arabic rather than to the raw key.
 */
const CATALOGUES: Record<LocaleCode, Catalogue> = { ar: ar as Catalogue, en: en as Catalogue };

export const TRANSLATION_KEYS = Object.keys(ar).sort();

export type TranslationKey = keyof typeof ar;

/** Substitute `{name}` placeholders. Unknown placeholders are left in place. */
function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match,
  );
}

export function translate(
  locale: LocaleCode,
  key: string,
  vars?: Record<string, unknown>,
): string {
  const template = CATALOGUES[locale]?.[key] ?? CATALOGUES[DEFAULT_LOCALE][key] ?? key;
  return interpolate(template, vars);
}

/** Locale-aware integer formatting. */
export function formatNumber(
  value: number | string | null | undefined,
  locale: LocaleCode,
  options: Intl.NumberFormatOptions = {},
): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  try {
    return new Intl.NumberFormat(intlLocale(locale), options).format(numeric);
  } catch {
    return String(numeric);
  }
}

export const formatPrice = (
  value: number | string | null | undefined,
  locale: LocaleCode,
): string => formatNumber(value, locale, { maximumFractionDigits: 0 });

/** "09:30" -> "9:30 ص" / "9:30 AM", using the active locale's meridiem. */
export function formatTime12h(time: string | null | undefined, locale: LocaleCode): string {
  if (!time) return "";
  const [rawHour, rawMinute] = String(time).split(":");
  const hour = Number.parseInt(rawHour, 10);
  if (!Number.isFinite(hour)) return String(time);

  const minutes = (rawMinute ?? "0").replace(/\D/g, "").slice(0, 2).padStart(2, "0");
  const meridiem = locale === "ar" ? (hour >= 12 ? "م" : "ص") : hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;

  return `${display}:${minutes} ${meridiem}`;
}

/** Arabic-Indic digits read better inside Arabic numerals-heavy copy. */
export function formatCount(value: number, locale: LocaleCode): string {
  return formatNumber(value, locale);
}

/** Locale-aware date formatting (e.g., "4 Nov 2026" / "٤ نوفمبر ٢٠٢٦"). */
export function formatDate(
  isoDate: string | null | undefined,
  locale: LocaleCode,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  if (!isoDate) return "";
  try {
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return isoDate;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
  } catch {
    return isoDate;
  }
}

/** Full date with weekday (e.g., "الأربعاء، ٤ نوفمبر ٢٠٢٦" / "Wed, 4 Nov 2026"). */
export function formatDateFull(
  isoDate: string | null | undefined,
  locale: LocaleCode,
): string {
  return formatDate(isoDate, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

