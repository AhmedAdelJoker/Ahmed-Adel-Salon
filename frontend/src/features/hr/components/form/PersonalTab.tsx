/** HR PersonalTab (moved from HRManagement page, no logic changes). */
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import type { EmployeeRecord } from "@/types/employee";
import { Input } from "@/components/ui/input";
import { User, Phone, ShieldCheck, Calendar, MapPin, FileText, ImageIcon, Activity, Plus, X, CheckCircle2, Mail } from "lucide-react";
import {
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
} from "@/features/hr";
import {
  validatePhone,
  validateEmployeeEmail,
  normalizePhoneTyping,
  MAX_PHONE_DIGITS,
} from "@/features/hr/utils/phone";
import {
  analyzeNationalId,
  NATIONAL_ID_LENGTH,
} from "@/features/hr/utils/nationalId";
import { normalizeNumericInput } from "@/features/hr/utils/digits";
import { validatePersonName, NAME_MAX } from "@/features/hr/utils/validators";
import FieldError from "./FieldError";

export default function PersonalTab({
  formData,
  setFormData,
  imagePreview,
  setImagePreview,
  uploading,
  onImageChange,
  blueprint,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
  imagePreview: string | null;
  setImagePreview: (v: string | null) => void;
  uploading: boolean;
  onImageChange: (e: ChangeEvent<HTMLInputElement>) => void;
  blueprint: { title: string };
}) {
  // An empty field is not an error while the owner is still filling it in; only
  // speak up once something has been typed and looks wrong.
  const typedName = String(formData.fullName ?? "").trim();
  const nameError = typedName ? validatePersonName(typedName) : null;
  const typedPhone = String(formData.phonePrimary ?? "").trim();
  const phoneError = typedPhone ? validatePhone(typedPhone) : null;
  const typedEmail = String(formData.email ?? "").trim();
  const emailError = typedEmail ? validateEmployeeEmail(typedEmail) : null;

  const idAnalysis = analyzeNationalId(formData.nationalId);
  const idError = idAnalysis.error;
  /*
    The id knows the birth date. When both are present and disagree, one of them
    was mistyped — say which date the id implies rather than just "mismatch", so
    the fix does not require decoding the number by hand.
  */
  const birthMismatch =
    idAnalysis.info && formData.birthDate && formData.birthDate !== idAnalysis.info.birthDate
      ? `تاريخ الميلاد لا يطابق الرقم القومي (${idAnalysis.info.birthDate})`
      : null;

  const handleNationalIdChange = (raw: string) => {
    const value = normalizeNumericInput(raw, NATIONAL_ID_LENGTH);
    const analysis = analyzeNationalId(value);
    setFormData((prev) => ({
      ...prev,
      nationalId: value,
      // Fill the birth date only when it is empty: an owner who deliberately
      // corrected it must not have their correction overwritten on a re-type.
      birthDate:
        analysis.info && !String(prev.birthDate ?? "").trim()
          ? analysis.info.birthDate
          : prev.birthDate,
    }));
  };

  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-5">
              <div className="relative group">
                <div className="h-36 w-36 sm:h-40 sm:w-40 overflow-hidden rounded-[1.75rem] border-[5px] border-card bg-soft shadow-xl ring-1 ring-border/50">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      className="h-full w-full object-cover"
                      alt={formData?.fullName || "صورة الموظف"}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        setImagePreview(null);
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted/40 bg-gradient-to-br from-soft to-card">
                      <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
                        <ImageIcon size={26} className="text-muted/30" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest">أضف صورة</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-sm">
                      <div className="h-8 w-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                      <span className="text-xs font-black text-accent animate-pulse">جاري الرفع...</span>
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 border-2 border-card">
                  {uploading ? <Activity size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onImageChange} />
                </label>
                {imagePreview && !uploading && (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData((p) => ({ ...p, profileImageUrl: "" }));
                    }}
                    className="absolute -top-2 -left-2 h-8 w-8 rounded-full bg-danger-soft text-danger shadow-sm flex items-center justify-center hover:bg-danger/15 transition-colors border-2 border-card"
                    title="إزالة الصورة"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-[17px] font-black text-main leading-tight">
                  {formData.fullName || "اسم الموظف الجديد"}
                </h3>
                <p className="text-[11px] font-bold text-accent uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {blueprint.title}
                </p>
                <p className="text-xs font-bold text-muted">يُفضل صورة مربعة 500×500 بصيغة JPG أو PNG</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <User size={14} /> الاسم الكامل
                </label>
                <Input
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                  placeholder="أدخل الاسم الثلاثي..."
                  maxLength={NAME_MAX}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "employee-name-error" : undefined}
                />
                {nameError && (
                  <FieldError id="employee-name-error">{nameError}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Phone size={14} /> الجوال الأساسي
                </label>
                <Input
                  value={formData.phonePrimary}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phonePrimary: normalizePhoneTyping(e.target.value),
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={MAX_PHONE_DIGITS}
                  autoComplete="off"
                  placeholder="01xxxxxxxxx"
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "phone-primary-error" : undefined}
                />
                {/*
                  Validate as they type rather than only at submit: a mistyped
                  number used to look exactly like a correct one until the save
                  bounced, and the owner had no idea which of eleven digits was
                  wrong. Only shown once there is something to say.
                */}
                {phoneError && (
                  <FieldError id="phone-primary-error">{phoneError}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Mail size={14} /> البريد الإلكتروني
                </label>
                <Input
                  type="email"
                  value={String(formData.email ?? "")}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                  dir="ltr"
                  placeholder="name@example.com"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "employee-email-error" : undefined}
                />
                {emailError && (
                  <FieldError id="employee-email-error">{emailError}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <ShieldCheck size={14} /> رقم الهوية
                </label>
                <Input
                  value={formData.nationalId}
                  onChange={(e) => handleNationalIdChange(e.target.value)}
                  className={FIELD_INPUT_CLASS}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={NATIONAL_ID_LENGTH}
                  autoComplete="off"
                  placeholder="xxxxxxxxxxxxxx"
                  aria-invalid={Boolean(idError)}
                  aria-describedby={idError ? "national-id-error" : undefined}
                />
                {idError ? (
                  <FieldError id="national-id-error">{idError}</FieldError>
                ) : idAnalysis.info ? (
                  /*
                    A valid id already carries the birth date and the issuing
                    governorate. Showing them back is proof the number was read
                    as intended — and a free way to catch a wrong governorate.
                  */
                  <p className="flex items-center gap-1.5 text-xs font-bold text-success">
                    <CheckCircle2 size={13} className="shrink-0" aria-hidden="true" />
                    مولود في {idAnalysis.info.birthDate} — {idAnalysis.info.governorateName}
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-muted">
                    {NATIONAL_ID_LENGTH} رقمًا تبدأ بـ 2 أو 3 — يُستخرج منها تاريخ
                    الميلاد تلقائيًا
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Calendar size={14} /> تاريخ الميلاد
                </label>
                <Input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) =>
                    setFormData({ ...formData, birthDate: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                  aria-invalid={Boolean(birthMismatch)}
                  aria-describedby={birthMismatch ? "birth-date-error" : undefined}
                />
                {birthMismatch && (
                  <FieldError id="birth-date-error">{birthMismatch}</FieldError>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <MapPin size={14} /> العنوان التفصيلي
                </label>
                <Input
                  value={formData.detailedAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      detailedAddress: e.target.value,
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <FileText size={14} /> نبذة مهنية (بالعربية)
                </label>
                <textarea
                  value={formData.bioAr}
                  onChange={(e) =>
                    setFormData({ ...formData, bioAr: e.target.value })
                  }
                  className={FIELD_TEXTAREA_CLASS}
                  rows={3}
                />
              </div>
            </div>
          </div>
  );
}
