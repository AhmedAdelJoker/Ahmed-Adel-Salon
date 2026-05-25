import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PreferencesProvider } from "./context/PreferencesContext";
import { SalonProvider } from "./context/SalonContext";
import { SocketProvider } from "./context/SocketContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { Scissors } from "lucide-react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));

function RouteLoader() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F172A] px-4 text-white"
      dir="rtl"
    >
      {/* Optimized Background for Loader */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full blur-[80px] opacity-[0.05] bg-[#38BDF8] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.04] bg-[#94A3B8] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white/5 border border-white/10 text-[#38BDF8] shadow-2xl backdrop-blur-md">
          <Scissors size={36} className="animate-bounce" />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#38BDF8] animate-pulse">
            Royal Experience
          </p>
          <p className="text-xl font-black text-white sm:text-2xl tracking-tight">
            جاري تحضير التجربة الفاخرة...
          </p>
          <p className="text-xs font-bold text-slate-400 max-w-[280px] mx-auto leading-relaxed">
            لحظات قليلة ونحمّل لك الواجهة الملكية بأفضل جودة وأسرع أداء.
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
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/shop" element={<LandingPage />} />
                    <Route path="/salon/:publicSlug" element={<LandingPage />} />
                    <Route path="/salon/:publicSlug/book" element={<PublicBooking />} />
                    <Route path="/book" element={<PublicBooking />} />
                    <Route path="/booking" element={<PublicBooking />} />
                    <Route path="*" element={<LandingPage />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    borderRadius: "20px",
                    border: "1px solid rgba(23,17,14,0.08)",
                    background: "rgba(255,255,255,0.92)",
                    color: "#17110e",
                    boxShadow:
                      "0 22px 50px -28px rgba(15, 23, 42, 0.28), inset 0 1px 0 rgba(255,255,255,0.55)",
                    backdropFilter: "blur(18px)",
                    fontWeight: "800",
                  },
                  success: {
                    iconTheme: {
                      primary: "#8a5a25",
                      secondary: "#ffffff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#c2410c",
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
