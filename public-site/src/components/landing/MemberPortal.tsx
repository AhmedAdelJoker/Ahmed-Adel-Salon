import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  Award,
  Calendar,
  Sparkles,
  TrendingUp,
  Star,
  X,
  Mail,
  Lock,
  Phone,
  CheckCircle2,
} from "lucide-react";
import { useMemberAuth } from "../../context/MemberAuthContext";

export interface MemberPortalProps {
  className?: string;
}

interface MemberDisplayUser {
  name?: string;
  email?: string;
  bookingsCount?: number;
  rating?: string | number;
  streak?: number;
}

/**
 * MemberPortal — Login/Register modal + loyalty display.
 * - Compact trigger button (User icon)
 * - Modal with login/register forms
 * - Shows loyalty points + tier badge for logged-in members
 * - Arabic-first design
 */
export default function MemberPortal({ className = "" }: MemberPortalProps) {
  const { user, isAuthenticated, isLoading, login, register, logout, loyaltyPoints } =
    useMemberAuth();
  const memberUser = (user ?? {}) as MemberDisplayUser;

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("login"); // login | register
  const [formData, setFormData] = useState({ email: "", password: "", name: "", phone: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(formData.email, formData.password);
      } else {
        await register(formData);
      }
      setIsOpen(false);
      setFormData({ email: "", password: "", name: "", phone: "" });
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || "حدث خطأ، حاول مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tier = getLoyaltyTier(loyaltyPoints);

  return (
    <>
      {/* Trigger Button */}
      {isAuthenticated ? (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-r from-[#D4AF37]/20 to-[#B08D26]/10 border border-[#D4AF37]/40 hover:border-[#D4AF37]/70 transition-all ${className}`}
          aria-label="حسابي"
        >
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center font-black text-xs"
            style={{ backgroundColor: tier.color, color: "#09090B" }}
          >
            {memberUser?.name?.charAt(0) || "U"}
          </div>
          <div className="hidden sm:flex flex-col -space-y-1 items-start">
            <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-wider">
              {tier.label}
            </span>
            <span className="text-[9px] font-bold text-slate-400">
              {loyaltyPoints} نقطة
            </span>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          id="member-portal-trigger"
          aria-label="دخول / تسجيل"
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 hover:bg-white/10 transition-all text-xs font-black ${className}`}
        >
          <User size={14} className="text-[#D4AF37]" />
          <span className="hidden sm:inline text-white">دخول</span>
        </button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-portal-title"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full max-w-md rounded-3xl border bg-[#17171A] border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق"
                className="absolute top-4 end-4 h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all flex items-center justify-center z-10"
              >
                <X size={16} />
              </button>

              {isAuthenticated ? (
                /* Logged-in state */
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div
                      className="mx-auto h-20 w-20 rounded-3xl flex items-center justify-center text-3xl font-black"
                      style={{ backgroundColor: tier.color, color: "#09090B" }}
                    >
                      {memberUser?.name?.charAt(0) || "U"}
                    </div>
                    <h2
                      id="member-portal-title"
                      className="text-2xl font-black text-white tracking-tight"
                    >
                      {memberUser?.name || "عضو مميز"}
                    </h2>
                    <p className="text-xs font-bold text-slate-500">{memberUser?.email}</p>
                  </div>

                  {/* Loyalty tier badge */}
                  <div
                    className="rounded-2xl p-4 border text-center"
                    style={{
                      backgroundColor: `${tier.color}10`,
                      borderColor: `${tier.color}40`,
                    }}
                  >
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                      style={{ backgroundColor: tier.color, color: "#09090B" }}
                    >
                      <Award size={12} />
                      {tier.label}
                    </div>
                    <div className="mt-3 text-3xl font-black text-white">
                      {loyaltyPoints} <span className="text-sm font-bold opacity-60">نقطة</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {tier.nextTier
                        ? `${tier.nextTier.points - loyaltyPoints} نقطة للوصول إلى ${tier.nextTier.label}`
                        : "أعلى مستوى! 🎉"}
                    </p>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/10">
                      <Calendar size={16} className="text-[#D4AF37] mx-auto mb-1" />
                      <div className="text-base font-black text-white">{memberUser?.bookingsCount ?? 0}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">حجوزات</div>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/10">
                      <Star size={16} className="text-[#D4AF37] mx-auto mb-1" />
                      <div className="text-base font-black text-white">{memberUser?.rating ?? "—"}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">تقييمك</div>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-white/5 border border-white/10">
                      <TrendingUp size={16} className="text-[#D4AF37] mx-auto mb-1" />
                      <div className="text-base font-black text-white">{memberUser?.streak ?? 0}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">سلسلة</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        window.location.href = "/book";
                      }}
                      className="flex-1 h-12 rounded-2xl font-black text-sm"
                      style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                    >
                      احجز الآن
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      aria-label="تسجيل الخروج"
                      className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all flex items-center justify-center"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Login / Register forms */
                <div className="p-8 space-y-6">
                  {/* Tab switcher */}
                  <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
                    {[
                      { id: "login", label: "دخول", icon: LogIn },
                      { id: "register", label: "تسجيل جديد", icon: UserPlus },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setMode(tab.id)}
                        className={`flex-1 h-10 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                          mode === tab.id
                            ? "bg-[#D4AF37] text-[#09090B]"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <tab.icon size={14} />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "register" && (
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                          الاسم
                        </label>
                        <div className="relative">
                          <User
                            size={16}
                            className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-500"
                          />
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-12 ps-10 pe-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#D4AF37]/40 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                        البريد الإلكتروني
                      </label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-500"
                        />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full h-12 ps-10 pe-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#D4AF37]/40 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-500"
                        />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full h-12 ps-10 pe-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#D4AF37]/40 focus:outline-none"
                        />
                      </div>
                    </div>

                    {mode === "register" && (
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                          رقم الهاتف
                        </label>
                        <div className="relative">
                          <Phone
                            size={16}
                            className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-500"
                          />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full h-12 ps-10 pe-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#D4AF37]/40 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs font-bold text-rose-500">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
                    >
                      {isSubmitting ? (
                        "جاري..."
                      ) : mode === "login" ? (
                        <>
                          <LogIn size={16} /> دخول
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} /> إنشاء حساب
                        </>
                      )}
                    </button>

                    {mode === "register" && (
                      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                        بإنشاء حساب، توافق على شروط الاستخدام. ستحصل على{" "}
                        <span className="text-[#D4AF37] font-black">100 نقطة ترحيب</span>! 🎁
                      </p>
                    )}
                  </form>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export interface LoyaltyTier {
  label: string;
  color: string;
  nextTier: { label: string; points: number } | null;
}

function getLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 1000)
    return { label: "Platinum", color: "#E5E4E2", nextTier: null };
  if (points >= 500)
    return { label: "Gold", color: "#D4AF37", nextTier: { label: "Platinum", points: 1000 } };
  if (points >= 200)
    return { label: "Silver", color: "#C0C0C0", nextTier: { label: "Gold", points: 500 } };
  return { label: "Bronze", color: "#CD7F32", nextTier: { label: "Silver", points: 200 } };
}
