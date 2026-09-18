import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, User } from "lucide-react";
import { useAuth, TotpRequiredError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ThemeSwitcher from "@/components/shared/ThemeSwitcher";
import { Input } from "@/components/ui/input";
import { Scissors, Sparkles, Zap } from "lucide-react";

function InfoChip({ icon, title, label }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-accent/20 bg-bg-card/40 p-5 shadow-2xl backdrop-blur-xl transition-all hover:border-accent/40 group">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-black text-main leading-tight mb-1 tracking-tight">
          {title}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/60">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login: loginUser, user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.error("يرجى إكمال بيانات الوصول");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginUser(username.trim(), password, totpRequired ? totp.trim() : undefined);
      toast.success("تمت المصادقة الرقمية بنجاح");
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof TotpRequiredError || (err as { code?: string })?.code === "TOTP_REQUIRED") {
        setTotpRequired(true);
        toast.error("هذا الحساب محمي بالمصادقة الثنائية — أدخل رمز التحقق");
      } else {
        toast.error("بيانات الاعتماد غير صالحة");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-bg-main text-main selection:bg-accent selection:text-bg-main"
    >
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-bg-main via-bg-soft to-bg-main" />
      <div className="absolute top-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-accent/5 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-accent/5 blur-[120px] animate-pulse" />

      {/* Decorative Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(var(--accent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Left Side: Brand & Value Prop */}
        <section className="hidden flex-col justify-between p-12 lg:flex xl:p-20">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="relative group">
              <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-md group-hover:bg-accent/40 transition-all duration-500" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-bg-card to-bg-soft border border-accent/30 text-accent shadow-2xl">
                <Scissors size={28} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black tracking-tighter text-main leading-tight">
                Barber Luxe
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent/70">
                Premium Management Suite
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl space-y-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
              <Sparkles size={14} className="text-accent animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-accent">
                The New Era of Salon Excellence
              </span>
            </div>

            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-main xl:text-7xl">
              إدارة صالونك <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-accent via-accent-strong to-accent/60">
                بمعايير عالمية
              </span>
            </h1>

            <p className="max-w-md text-lg font-bold leading-relaxed text-muted/80">
              ارتقِ بتجربة عملائك وأدر عملياتك التشغيلية والمالية بدقة متناهية
              من خلال منصة متكاملة صُممت خصيصاً للنخبة.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InfoChip
                icon={<ShieldCheck size={20} />}
                title="أمان مطلق"
                label="Encrypted"
              />
              <InfoChip
                icon={<Zap size={20} />}
                title="أداء ذكي"
                label="Optimization"
              />
              <InfoChip
                icon={<Sparkles size={20} />}
                title="واجهة فاخرة"
                label="Luxe Design"
              />
            </div>
          </motion.div>

          <div className="flex items-center gap-6">
            <div className="h-[1px] w-12 bg-accent/20" />
            <div className="text-[11px] font-black text-muted/40 uppercase tracking-[0.4em]">
              Barber Luxe Elite · MMXXVI
            </div>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="flex items-center justify-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-md"
          >
            <div className="flex flex-col items-center mb-10 lg:hidden">
              <div className="relative h-16 w-16 mb-4 flex items-center justify-center rounded-3xl bg-gradient-to-br from-bg-card to-bg-soft border border-accent/30 text-accent shadow-2xl">
                <Scissors size={32} strokeWidth={2.5} />
              </div>
              <div className="text-2xl font-black tracking-tighter text-main">
                Barber Luxe
              </div>
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-accent/70 mt-1">
                Premium Suite
              </div>
            </div>

            <Card className="relative overflow-hidden border-border/10 bg-bg-card/40 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl rounded-[2.5rem] px-4 py-8">
              {/* Subtle inner gold stroke */}
              <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] border border-accent/10 m-[1px]" />

              <CardHeader className="space-y-4 text-center">
                <div className="mx-auto relative group">
                  <div className="absolute inset-0 rounded-2xl bg-accent/10 blur-md" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/5 text-accent border border-accent/20">
                    <Lock size={28} strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-2xl font-black text-main tracking-tight">
                    تسجيل الدخول
                  </CardTitle>
                  <CardDescription className="text-xs font-bold text-muted mt-2">
                    يرجى إدخال بيانات الاعتماد للوصول إلى المركز القيادي
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-black text-muted uppercase tracking-widest mr-2">
                      اسم المستخدم
                    </span>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-5 flex items-center text-muted group-focus-within:text-accent transition-colors">
                        <User size={18} strokeWidth={2.5} />
                      </div>
                      <Input
                        value={username || ""}
                        onChange={(event) => setUsername(event.target.value)}
                        className="h-14 pr-14 bg-bg-main/50 border-border/40 focus:border-accent/40 rounded-2xl text-[14px] font-bold"
                        placeholder="أدخل اسم المستخدم..."
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mr-2">
                      <span className="text-[11px] font-black text-muted uppercase tracking-widest">
                        كلمة المرور
                      </span>
                      <button
                        type="button"
                        className="text-[10px] font-black text-accent/60 hover:text-accent transition-colors uppercase tracking-widest"
                        onClick={() =>
                          toast("يرجى مراجعة الإدارة لاستعادة كلمة المرور")
                        }
                      >
                        نسيت الكلمة؟
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-5 flex items-center text-muted group-focus-within:text-accent transition-colors">
                        <Lock size={18} strokeWidth={2.5} />
                      </div>
                      <Input
                        type="password"
                        value={password || ""}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-14 pr-14 bg-bg-main/50 border-border/40 focus:border-accent/40 rounded-2xl text-[14px] font-bold"
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </div>

                  {totpRequired && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-black text-muted uppercase tracking-widest mr-2">
                        رمز التحقق (6 أرقام)
                      </span>
                      <div className="relative group">
                        <div className="absolute inset-y-0 right-5 flex items-center text-muted group-focus-within:text-accent transition-colors">
                          <ShieldCheck size={18} strokeWidth={2.5} />
                        </div>
                        <Input
                          value={totp || ""}
                          onChange={(event) =>
                            setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          className="h-14 pr-14 bg-bg-main/50 border-border/40 focus:border-accent/40 rounded-2xl text-[14px] font-bold text-center tracking-[0.5em]"
                          placeholder="••••••"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          dir="ltr"
                          required={totpRequired}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    loading={isSubmitting}
                    className="h-14 w-full rounded-2xl bg-accent hover:bg-accent-strong text-bg-main font-black text-[15px] shadow-xl shadow-accent/20 transition-all active:scale-[0.98]"
                  >
                    دخول المنصة <Zap size={18} className="mr-2 fill-current" />
                  </Button>
                </form>

                <div className="mt-10 pt-6 border-t border-border/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                      System Online
                    </span>
                  </div>
                  <ThemeSwitcher />
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 text-center">
              <p className="text-[10px] font-bold text-muted/40 uppercase tracking-[0.2em]">
                Powered by Barber Luxe Digital Architecture
              </p>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
