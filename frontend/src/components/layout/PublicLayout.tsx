import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  Scissors,
  Menu,
  X,
  Sun,
  Moon,
  Instagram,
  Facebook,
  Twitter,
  ArrowUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { getHomePath } from "@/lib/access/roles";
import { cn } from "@/lib/core/utils";

export default function PublicLayout() {
  const { user, isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme } = usePreferences();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();

  const isDark = theme === "dark";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "الرئيسية", href: "#home" },
    { name: "عن الصالون", href: "#about" },
    { name: "خدماتنا", href: "#services" },
    { name: "معرض الأعمال", href: "#portfolio" },
    { name: "فروعنا", href: "#branches" },
    { name: "اتصل بنا", href: "#contact" },
  ];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavClick = (href) => {
    setMobileMenuOpen(false);
    if (window.location.pathname !== "/") {
      navigate("/" + href);
      return;
    }
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="min-h-screen bg-main text-main selection:bg-accent-glow"
    >
      {/* Navbar */}
      <nav
        className={cn(
          "fixed top-0 z-50 w-full transition-all duration-300",
          isScrolled
            ? "glass-panel h-16 sm:h-20 shadow-premium border-b border-border"
            : "h-20 sm:h-24",
        )}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6 sm:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-grad-accent shadow-accent group-hover:scale-110 transition-transform">
              <Scissors className="text-white" size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-main">
                Barber Luxe
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Professional
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.name}
                disabled={loading}
                onClick={() => handleNavClick(link.href)}
                className="text-sm font-black text-muted hover:text-accent transition-colors relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full" />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              disabled={loading}
              onClick={toggleTheme}
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border border-border bg-card text-muted hover:text-accent hover:bg-accent-soft transition-all"
              aria-label="تبديل الوضع"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthenticated ? (
              <button
                disabled={loading}
                onClick={() => navigate(getHomePath(user?.role))}
                className="btn btn-primary px-5 py-2.5 text-xs sm:text-sm"
              >
                لوحة التحكم
              </button>
            ) : (
              <button
                disabled={loading}
                onClick={() => navigate("/login")}
                className="btn btn-primary px-5 py-2.5 text-xs sm:text-sm"
              >
                دخول النظام
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border text-muted"
              disabled={loading}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300",
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Menu Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-2xl lg:hidden transition-transform duration-300 transform",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-grad-accent shadow-accent">
              <Scissors className="text-white" size={20} />
            </div>
            <span className="text-lg font-black">Barber Luxe</span>
          </div>

          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <button
                key={link.name}
                disabled={loading}
                onClick={() => handleNavClick(link.href)}
                className="text-right text-base font-black text-muted hover:text-accent transition-colors"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="pt-8 border-t border-border">
            <div className="flex gap-4">
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-soft text-muted hover:text-accent transition-colors">
                <Instagram size={18} />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-soft text-muted hover:text-accent transition-colors">
                <Facebook size={18} />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-soft text-muted hover:text-accent transition-colors">
                <Twitter size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border pt-16 pb-8 px-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-grad-accent">
                  <Scissors className="text-white" size={20} />
                </div>
                <span className="text-xl font-black">Barber Luxe</span>
              </div>
              <p className="text-sm text-muted leading-relaxed font-bold">
                نحن نقدم تجربة حلاقة عصرية تمزج بين الفن التقليدي والأساليب
                الحديثة. هدفنا هو جعل كل عميل يشعر بالثقة والتميز.
              </p>
              <div className="flex gap-3">
                {[Instagram, Facebook, Twitter].map((Icon, idx) => (
                  <button
                    key={idx}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-accent-soft hover:text-accent transition-all"
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-accent mb-6">
                روابط سريعة
              </h4>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <button
                      disabled={loading}
                      onClick={() => handleNavClick(link.href)}
                      className="text-sm font-bold text-muted hover:text-accent transition-colors"
                    >
                      {link.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-accent mb-6">
                ساعات العمل
              </h4>
              <ul className="space-y-4 text-sm font-bold text-muted">
                <li className="flex justify-between">
                  <span>السبت - الخميس:</span>
                  <span className="text-main">10:00 ص - 10:00 م</span>
                </li>
                <li className="flex justify-between">
                  <span>الجمعة:</span>
                  <span className="text-main">2:00 م - 10:00 م</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-accent mb-6">
                النشرة الإخبارية
              </h4>
              <p className="text-xs font-bold text-muted mb-4 leading-relaxed">
                اشترك لتصلك أحدث العروض والخدمات الحصرية.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="بريدك الإلكتروني"
                  className="input h-11 text-xs px-4 border-border bg-soft"
                />
                <button className="btn btn-primary h-11 px-4">
                  <span className="text-xs">اشترك</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-widest text-subtle">
            <p>
              © {new Date().getFullYear()} Barber Luxe Pro. جميع الحقوق محفوظة.
            </p>
            <div className="flex gap-6">
              <button className="hover:text-accent">سياسة الخصوصية</button>
              <button className="hover:text-accent">شروط الخدمة</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll Top */}
      <button
        disabled={loading}
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 left-8 z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-grad-accent text-white shadow-accent transition-all duration-300 transform",
          showScrollTop
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0 pointer-events-none",
        )}
      >
        <ArrowUp size={20} />
      </button>
    </div>
  );
}
