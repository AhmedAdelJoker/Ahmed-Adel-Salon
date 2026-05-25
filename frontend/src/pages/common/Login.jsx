import React, { useEffect, useState } from "react";



import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Lock, Scissors, ShieldCheck, Sparkles, User, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import ThemeSwitcher from "../../components/common/ThemeSwitcher";

const PATTERNS = [
  { key: "none", label: "بدون نمط" },
  { key: "damask", label: "Damask" },
];

function applyPattern(pattern) {
  const safePattern = pattern === "damask" ? "damask" : "none";
  if (safePattern === "damask") {
    document.documentElement.setAttribute("data-pattern", "damask");
    document.body.setAttribute("data-pattern", "damask");
  } else {
    document.documentElement.removeAttribute("data-pattern");
    document.body.removeAttribute("data-pattern");
  }
  localStorage.setItem("ui_pattern", safePattern);
}

function InfoChip({ icon, title, label }) {
  

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
        {icon}
      </div>
      <div>
        <div className="text-xs font-black text-gray-950 dark:text-gray-50">
          {title}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pattern, setPattern] = useState(
    () => localStorage.getItem("ui_pattern") || "none",
  );
  const { login: loginUser, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {

    applyPattern(pattern);
  }, [pattern]);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.error("يرجى إكمال بيانات الوصول");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginUser(username.trim(), password);
      toast.success("تمت المصادقة الرقمية بنجاح");
      navigate("/", { replace: true });
    } catch {
      toast.error("بيانات الاعتماد غير صالحة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-gray-100 text-gray-950 dark:bg-[#0B0B0B] dark:text-gray-50"
      dir="rtl"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(109,40,217,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.10),transparent_30%)]" />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="hidden flex-col justify-between p-10 lg:flex xl:p-14">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6D28D9] text-white shadow-lg dark:bg-[#22D3EE] dark:text-[#121212]">
              <Scissors size={24} strokeWidth={2.3} />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">
                BarberLuxe
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#6D28D9] dark:text-[#22D3EE]">
                Salon Management OS
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-xl space-y-6"
          >
            <Badge variant="accent" size="md">
              The Luxury Standard in Salon Management
            </Badge>
            <h1 className="text-5xl font-black leading-tight tracking-tight xl:text-6xl">
              إدارة صالونك باحترافية ووضوح
            </h1>
            <p className="max-w-lg text-base font-bold leading-8 text-gray-600 dark:text-gray-300">
              نظام إدارة متكامل للمبيعات، الحجوزات، العملاء، المخزون، التقارير،
              والوردية اليومية — بواجهة عربية RTL وتجربة استخدام احترافية.
            </p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <InfoChip
                icon={<ShieldCheck size={18} />}
                title="حماية"
                label="Secure Access"
              />
              <InfoChip
                icon={<Zap size={18} />}
                title="أداء سريع"
                label="Fast Engine"
              />
              <InfoChip
                icon={<Sparkles size={18} />}
                title="واجهة عصرية"
                label="Premium UI"
              />
            </div>
          </motion.div>

          <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
            Barber Luxe Elite · 2026 Edition
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-6">
            <div className="flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6D28D9] text-white dark:bg-[#22D3EE] dark:text-[#121212]">
                  <Scissors size={22} />
                </div>
                <div className="text-lg font-black">BarberLuxe</div>
              </div>
              <ThemeSwitcher />
            </div>

            <Card className="border-black/10 bg-white/85 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171717]/85">
              <CardHeader className="space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
                  <Lock size={24} />
                </div>
                <CardTitle className="text-2xl font-black">
                  تسجيل الدخول
                </CardTitle>
                <CardDescription>
                  أدخل بيانات الهوية الرقمية للوصول للمنصة
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-black text-gray-600 dark:text-gray-300">
                      اسم المستخدم
                    </span>
                    <div className="relative">
                      <User className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={username || ""}
                        onChange={(event) => setUsername(event.target.value)}
                        className="pr-12"
                        placeholder="example_user"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black text-gray-600 dark:text-gray-300">
                      كلمة المرور
                    </span>
                    <div className="relative">
                      <Lock className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <Input
                        type="password"
                        value={password || ""}
                        onChange={(event) => setPassword(event.target.value)}
                        className="pr-12"
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </label>

                  <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                    <span>تذكر هذه الجلسة</span>
                    <button
                      type="button"
                      className="text-[#6D28D9] hover:underline dark:text-[#22D3EE]"
                      onClick={() =>
                        toast("يرجى التواصل مع مدير النظام لاستعادة الوصول")
                      }
                    >
                      فقدت الوصول؟
                    </button>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    loading={isSubmitting}
                    className="w-full"
                  >
                    دخول المنصة
                  </Button>
                </form>

                <div className="mt-7 border-t border-black/10 pt-5 dark:border-white/10">
                  <div className="mb-3 text-xs font-black text-gray-600 dark:text-gray-300">
                    تخصيص الواجهة البصرية
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PATTERNS.map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        disabled={isSubmitting}
                        onClick={() => setPattern(item.key)}
                        className={`rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                          pattern === item.key
                            ? "border-[#6D28D9] bg-[#6D28D9] text-white dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#121212]"
                            : "border-black/10 bg-white text-gray-500 hover:text-[#6D28D9] dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:text-[#22D3EE]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="hidden justify-center lg:flex">
              <ThemeSwitcher />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

