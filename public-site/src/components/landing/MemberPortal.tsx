import { useEffect, useRef } from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  Award,
  Calendar,
  TrendingUp,
  Star,
  X,
  Mail,
  Lock,
  Phone,
} from "lucide-react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { useI18n } from "../../context/I18nContext";
import { formatDate } from "../../lib/i18n";
import { resolveAssetUrl } from "../../lib/imageOptimizer";

/**
 * Status colours. `t(\`member.status.${status}\`)` is looked up by key, so an
 * unrecognised status renders the raw key rather than blank — that is deliberate
 * and is why every status the backend can emit needs a translation.
 */
function statusColor(status: string): string {
  if (["completed", "done", "checked_out", "paid"].includes(status)) return "#10B981";
  if (["cancelled", "auto_cancelled", "no_show"].includes(status)) return "#F43F5E";
  if (["pending", "waiting"].includes(status)) return "#FBBF24";
  return "#94A3B8";
}

export interface MemberPortalProps {
  className?: string;
  /** Salon name for the welcome column. Optional: the panel degrades to a generic one. */
  salonName?: string;
  /** Salon cover image, shown faintly behind the welcome copy. */
  coverImageUrl?: string | null;
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
export default function MemberPortal({
  className = "",
  salonName = "",
  coverImageUrl = null,
}: MemberPortalProps) {
  const { t, number, locale } = useI18n();
  const coverImage = resolveAssetUrl(coverImageUrl);
  const { user, isAuthenticated, isLoading, login, register, logout, loyaltyPoints, bookings, cancelBooking } =
    useMemberAuth();
  const memberUser = (user ?? {}) as MemberDisplayUser;

  // Salon-scoped booking path for the "book again" button
  const salonSlug = user?.salon_slug || "";
  const bookingPath = salonSlug ? `/salon/${salonSlug}/book` : "/book";

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("login"); // login | register
  const [formData, setFormData] = useState({ email: "", password: "", name: "", phone: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Focus trap for the modal
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Trap focus within the modal
      const handleTab = (e: KeyboardEvent) => {
        if (e.key === "Tab") {
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setIsOpen(false);
        }
      };
      document.addEventListener("keydown", handleTab);
      modalRef.current?.focus();
      return () => {
        document.removeEventListener("keydown", handleTab);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen]);

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
      setError(apiErr.message || t("member.error.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const tier = getLoyaltyTier(loyaltyPoints, t);

  /**
   * Bookings the member may still change: not cancelled, not finished, and in
   * the future. Mirrors `_FINAL_STATUSES` on the backend plus the past-date
   * guard — showing a cancel button that is guaranteed to fail is worse than
   * showing nothing.
   */
  const cancellable = bookings.filter(
    (booking) =>
      !["cancelled", "auto_cancelled", "no_show", "completed", "done", "paid", "checked_out"].includes(
        booking.status,
      ) && new Date(`${booking.appointment_date}T${booking.appointment_time || "00:00"}`) > new Date(),
  );

  return (
    <>
      {/* Trigger Button */}
      {isAuthenticated ? (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 rounded-2xl border border-accent-line bg-accent-wash px-3 py-2 transition-colors duration-200 hover:border-accent ${className}`}
          aria-label={t("member.trigger")}
        >
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs"
            style={{ backgroundColor: tier.color, color: "var(--c-bg)" }}
          >
            {memberUser?.name?.charAt(0) || "U"}
          </div>
          <div className="hidden sm:flex flex-col -space-y-1 items-start">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
              {tier.label}
            </span>
            <span className="text-[9px] font-bold text-ink-faint">
              {number(loyaltyPoints)} {t("member.pointsUnit")}
            </span>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          id="member-portal-trigger"
          aria-label={t("member.loginRegister")}
          // Disabled until the stored session has been validated, so the modal
          // never opens on top of a half-restored auth state.
          disabled={isLoading}
          aria-busy={isLoading || undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-inset border border-line hover:border-accent-line hover:bg-accent-wash transition-all text-xs font-bold disabled:cursor-wait disabled:opacity-60 ${className}`}
        >
          <User size={14} className="text-accent" />
          <span className="hidden text-ink sm:inline">{t("member.trigger")}</span>
        </button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-portal-title"
          >
            {/*
              Half a viewport, not a card in the middle of one.

              This used to be `max-w-md` — about 450px, the width of a
              newsletter signup — for a flow that holds the member's whole
              relationship with the salon: their account, their loyalty tier,
              every booking they have made and the offers only they can see. A
              narrow column in the middle of a wide screen reads as an
              afterthought, and it forced the register form to stack four
              fields into a tall thin ribbon.

              It is now a two-panel dialog: the welcome column carries the
              salon's identity and what the account is for, and the form column
              keeps its own width so the fields stay comfortable. Below `lg`
              the welcome column is dropped rather than squashed, because a
              half-screen split has no meaning on a phone.

              `max-h` plus `overflow-y-auto` on the form column: the previous
              markup had no height cap at all, so on a short viewport the
              register form ran off the bottom of the window with no way to
              reach the submit button.
            */}
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative grid w-full max-w-lg lg:max-w-5xl lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] max-h-[92dvh] overflow-hidden rounded-3xl border bg-panel border-line"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t("common.close")}
                className="absolute top-4 end-4 z-10 h-9 w-9 rounded-xl bg-inset border border-line text-ink-faint hover:bg-rose-500/10 hover:text-rose-500 transition-all flex items-center justify-center"
              >
                <X size={16} />
              </button>

              {/* ── Welcome column ─────────────────────────────────────── */}
              <aside
                className="relative hidden flex-col justify-between overflow-hidden p-8 lg:flex"
                style={{ backgroundColor: "var(--c-inset)" }}
                aria-hidden="true"
              >
                {/* The salon's own cover, when there is one. */}
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-25"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                {/* Veil so the copy stays legible over any photo. */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, var(--c-inset) 0%, rgba(0,0,0,0.15) 100%)",
                  }}
                />

                <div className="relative">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold"
                    style={{ backgroundColor: "var(--c-accent)", color: "var(--c-bg)" }}
                  >
                    {(salonName || "S").charAt(0)}
                  </div>
                  <h2 className="mt-5 text-2xl font-bold leading-snug text-ink">
                    {t("member.panel.welcome")}
                    {salonName ? (
                      <>
                        {" "}
                        <span className="text-accent">{salonName}</span>
                      </>
                    ) : null}
                  </h2>
                  <p className="mt-3 max-w-xs text-sm font-bold leading-7 text-ink-faint">
                    {t("member.panel.tagline")}
                  </p>
                </div>

                <ul className="relative mt-8 space-y-4">
                  {[
                    "member.panel.benefit.loyalty",
                    "member.panel.benefit.history",
                    "member.panel.benefit.offers",
                  ].map((key) => (
                    <li key={key} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: "var(--c-accent)",
                          color: "var(--c-bg)",
                        }}
                      >
                        <Star size={12} aria-hidden="true" />
                      </span>
                      <span className="text-[13px] font-bold leading-6 text-ink">
                        {t(key as "member.panel.benefit.loyalty")}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* ── Account / form column ──────────────────────────────── */}
              <div className="relative overflow-y-auto overscroll-contain">
              {isAuthenticated ? (
                /* Logged-in state */
                <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div
                      className="mx-auto h-20 w-20 rounded-3xl flex items-center justify-center text-3xl font-bold"
                      style={{ backgroundColor: tier.color, color: "var(--c-bg)" }}
                    >
                      {memberUser?.name?.charAt(0) || "U"}
                    </div>
                    <h2
                      id="member-portal-title"
                      className="text-2xl font-bold text-ink tracking-tight"
                    >
                      {memberUser?.name || t("member.guestName")}
                    </h2>
                    <p className="text-xs font-bold text-ink-faint">{memberUser?.email}</p>
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
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                      style={{ backgroundColor: tier.color, color: "var(--c-bg)" }}
                    >
                      <Award size={12} />
                      {tier.label}
                    </div>
                    <div className="mt-3 text-3xl font-bold text-ink">
                      {number(loyaltyPoints)} <span className="text-sm font-bold opacity-60">{t("member.pointsUnit")}</span>
                    </div>
                    <p className="text-xs text-ink-faint mt-1">
                      {tier.nextTier
                        ? t("member.tierRemaining", {
                            points: number(tier.nextTier.points - loyaltyPoints),
                            tier: tier.nextTier.label,
                          })
                        : t("member.tierMaxed")}
                    </p>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-2xl bg-inset border border-line">
                      <Calendar size={16} className="text-accent mx-auto mb-1" />
                      <div className="text-base font-bold text-ink">{memberUser?.bookingsCount ?? 0}</div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-faint">{t("member.bookings")}</div>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-inset border border-line">
                      <Star size={16} className="text-accent mx-auto mb-1" />
                      <div className="text-base font-bold text-ink">{memberUser?.rating ?? "—"}</div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-faint">{t("member.rating")}</div>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-inset border border-line">
                      <TrendingUp size={16} className="text-accent mx-auto mb-1" />
                      <div className="text-base font-bold text-ink">{memberUser?.streak ?? 0}</div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-faint">{t("member.pointsLabel")}</div>
                    </div>
                  </div>

                  {/*
                  Booking history. `GET /public/member/bookings` has always
                  existed on the backend; the portal never called it, so a
                  signed-in member had a loyalty balance but no record of a single
                  visit. Upcoming visits are listed first because they are the
                  only ones the member can act on.
                */}
                {bookings.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                      {t("member.yourBookings")}
                    </h3>
                    <ul className="space-y-2">
                      {bookings.slice(0, 5).map((booking) => (
                        <li
                          key={booking.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-inset border border-line px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">
                              {booking.service_name || t("member.bookings")}
                            </p>
                            <p className="text-[10px] font-bold text-ink-faint">
                              {booking.barber_name}
                            </p>
                          </div>
                          <div className="shrink-0 text-end">
                            <p className="numeric text-xs font-bold text-ink">
                              {formatDate(booking.appointment_date, locale as "ar" | "en")}
                            </p>
                            <p
                              className="text-[10px] font-bold"
                              style={{ color: statusColor(booking.status) }}
                            >
                              {t(`member.status.${booking.status}`)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {/*
                      Cancel is offered only on bookings that can still be
                      changed. The backend refuses completed and past
                      appointments, so showing the button there would invite a
                      guaranteed failure.
                    */}
                    {cancellable.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void cancelBooking(cancellable[0].id)}
                        className="w-full rounded-2xl border border-rose-500/20 px-4 py-2.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      >
                        {t("member.cancelBooking")}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        window.location.href = bookingPath;
                      }}
                      className="flex-1 h-12 rounded-2xl font-bold text-sm"
                      style={{ backgroundColor: "var(--c-accent)", color: "var(--c-bg)" }}
                    >
                      {t("member.bookAgain")}
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      aria-label={t("member.logout")}
                      className="h-12 w-12 rounded-2xl bg-inset border border-line text-ink-faint hover:bg-rose-500/10 hover:text-rose-500 transition-all flex items-center justify-center"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Login / Register forms */
                <div className="p-8 space-y-6">
                  {/* Tab switcher */}
                  <div className="flex gap-2 p-1 rounded-2xl bg-inset border border-line">
                    {[
                      { id: "login", label: t("member.tabLogin"), icon: LogIn },
                      { id: "register", label: t("member.tabRegister"), icon: UserPlus },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setMode(tab.id)}
                        className={`flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          mode === tab.id
                            ? "bg-accent text-canvas"
                            : "text-ink-faint hover:text-ink"
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
                        <label htmlFor="member-name" className="block text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-1.5">
                          {t("member.field.name")}
                        </label>
                        <div className="relative">
                          <User
                            size={16}
                            className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-faint"
                          />
                          <input
                            id="member-name"
                            name="name"
                            type="text"
                            autoComplete="name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-12 ps-10 pe-4 rounded-2xl bg-inset border border-line text-ink text-sm focus:border-accent-line focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="member-email" className="block text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-1.5">
                        {t("member.field.email")}
                      </label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-faint"
                        />
                        <input
                          id="member-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full h-12 ps-10 pe-4 rounded-2xl bg-inset border border-line text-ink text-sm focus:border-accent-line focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="member-password" className="block text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-1.5">
                        {t("member.field.password")}
                      </label>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-faint"
                        />
                        <input
                          id="member-password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          minLength={6}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full h-12 ps-10 pe-4 rounded-2xl bg-inset border border-line text-ink text-sm focus:border-accent-line focus:outline-none"
                        />
                      </div>
                    </div>

                    {mode === "register" && (
                      <div>
                        <label htmlFor="member-phone" className="block text-[10px] font-bold uppercase tracking-widest text-ink-faint mb-1.5">
                          {t("member.field.phone")}
                        </label>
                        <div className="relative">
                          <Phone
                            size={16}
                            className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-faint"
                          />
                          <input
                            id="member-phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full h-12 ps-10 pe-4 rounded-2xl bg-inset border border-line text-ink text-sm focus:border-accent-line focus:outline-none"
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
                      className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: "var(--c-accent)", color: "var(--c-bg)" }}
                    >
                      {isSubmitting ? (
                        t("common.loading")
                      ) : mode === "login" ? (
                        <>
                          <LogIn size={16} aria-hidden="true" /> {t("member.submitLogin")}
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} aria-hidden="true" /> {t("member.submitRegister")}
                        </>
                      )}
                    </button>

                    {mode === "register" && (
                      <p className="text-[10px] text-ink-faint text-center leading-relaxed">
                        {t("member.firstRewardHint")}
                        <span className="font-bold text-accent">{t("member.firstReward")}</span>
                      </p>
                    )}
                  </form>
                </div>
              )}
              </div>
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

/**
 * Loyalty tiers.
 *
 * The labels used to be hardcoded English, so an Arabic visitor was shown
 * "Gold" beside Arabic copy. They are translated now; only the colour is a
 * per-tier constant, because a colour is not language.
 */
function getLoyaltyTier(points: number, t: (key: "member.tier.bronze" | "member.tier.silver" | "member.tier.gold" | "member.tier.platinum") => string): LoyaltyTier {
  if (points >= 1000)
    return { label: t("member.tier.platinum"), color: "#E5E4E2", nextTier: null };
  if (points >= 500)
    return { label: t("member.tier.gold"), color: "var(--c-accent)", nextTier: { label: t("member.tier.platinum"), points: 1000 } };
  if (points >= 200)
    return { label: t("member.tier.silver"), color: "#C0C0C0", nextTier: { label: t("member.tier.gold"), points: 500 } };
  return { label: t("member.tier.bronze"), color: "#CD7F32", nextTier: { label: t("member.tier.silver"), points: 200 } };
}

