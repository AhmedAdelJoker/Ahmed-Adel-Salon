import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";
import { AuthProvider } from "./context/AuthContext";
import { PreferencesProvider } from "./context/PreferencesContext";
import { SalonProvider } from "./context/SalonContext";
import { SocketProvider } from "./context/SocketContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { Scissors } from "lucide-react";
import { useI18n } from "./context/I18nContext";
import PWAInstallPrompt from "./components/landing/PWAInstallPrompt";
import LiveChat from "./components/landing/LiveChat";
import Analytics from "./components/landing/Analytics";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const OfflinePage = lazy(() => import("./pages/OfflinePage"));

function RouteLoader() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090B] px-4 text-white"
      dir="rtl"
    >
      {/* Cinematic Background for Loader */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.08] bg-[#D4AF37] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.05] bg-[#B08D26] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-white/5 border border-white/10 text-[#D4AF37] shadow-[0_0_50px_rgba(212,175,55,0.15)] backdrop-blur-xl animate-in fade-in zoom-in duration-700">
          <Scissors size={44} className="animate-bounce" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.6em] text-[#D4AF37] animate-pulse">
              Royal Experience
            </p>
            <h2 className="text-2xl font-black text-white sm:text-3xl tracking-tight">
              جاري تحضير التجربة الملكية...
            </h2>
          </div>
          <div className="h-1 w-48 mx-auto bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"
            />
          </div>
          <p className="text-xs font-bold text-slate-400 max-w-[300px] mx-auto leading-relaxed opacity-80">
            لحظات قليلة ونحمّل لك الواجهة الفاخرة بأعلى معايير الجودة العالمية.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <SalonProvider>
          <SocketProvider>
            <TooltipProvider delayDuration={400}>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                {/* Accessibility: Skip to main content link */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-1/2 focus:-translate-x-1/2 focus:z-[9999] focus:px-8 focus:py-3 focus:rounded-2xl focus:bg-[#D4AF37] focus:text-[#09090B] focus:font-black focus:text-sm focus:shadow-[0_20px_50px_rgba(212,175,55,0.4)] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#09090B]"
                >
                  تخطي إلى المحتوى الرئيسي
                </a>
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/shop" element={<LandingPage />} />
                    <Route path="/salon/:publicSlug" element={<LandingPage />} />
                    <Route path="/salon/:publicSlug/book" element={<PublicBooking />} />
                    <Route path="/book" element={<PublicBooking />} />
                    <Route path="/booking" element={<PublicBooking />} />
                    <Route path="/offline" element={<OfflinePage />} />
                    <Route path="*" element={<LandingPage />} />
                  </Routes>
                </Suspense>
                {/* Global utilities — must be INSIDE Router (Analytics uses useLocation) */}
                <PWAInstallPrompt />
                <LiveChat />
                <Analytics />
              </BrowserRouter>
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    borderRadius: "24px",
                    border: "1px solid rgba(212,175,55,0.2)",
                    background: "rgba(9,9,11,0.9)",
                    color: "#F8FAFC",
                    boxShadow:
                      "0 25px 60px -15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    fontWeight: "700",
                    fontSize: "14px",
                    padding: "12px 20px",
                  },
                  success: {
                    iconTheme: {
                      primary: "#D4AF37",
                      secondary: "#09090B",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#EF4444",
                      secondary: "#ffffff",
                    },
                  },
                }}
              />
            </TooltipProvider>
          </SocketProvider>
        </SalonProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
