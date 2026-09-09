import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { WifiOff, RefreshCw, Home, Scissors } from "lucide-react";

/**
 * OfflinePage — Graceful fallback when the user loses connection.
 * Listens to online/offline events and auto-retries.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleHome = () => {
    window.location.href = "/";
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
      style={{ backgroundColor: "#09090B", color: "#F8FAFC" }}
      dir="rtl"
    >
      {/* Ambient gold blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ x: [0, 60, -30, 0], y: [0, -80, 50, 0] }}
          transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.08]"
          style={{ backgroundColor: "#D4AF37" }}
        />
        <motion.div
          animate={{ x: [0, -80, 40, 0], y: [0, 70, -60, 0] }}
          transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.06]"
          style={{ backgroundColor: "#B08D26" }}
        />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* Animated icon */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex justify-center"
        >
          <div
            className="h-28 w-28 rounded-[2rem] flex items-center justify-center shadow-[0_30px_80px_rgba(212,175,55,0.3)] border"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              borderColor: "rgba(212, 175, 55, 0.3)",
            }}
          >
            <WifiOff size={56} className="text-[#D4AF37]" />
          </div>
        </motion.div>

        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            {isOnline ? "جاري استعادة الاتصال..." : "لا يوجد اتصال بالإنترنت"}
          </h1>
          <p className="text-base font-bold text-slate-400 leading-relaxed">
            {isOnline
              ? "نحاول إعادة الاتصال بالخادم. لحظات وتعود التجربة."
              : "يبدو أنك غير متصل بالإنترنت. تحقق من الاتصال أو حاول مرة أخرى."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleRetry}
            className="h-14 px-8 rounded-2xl font-black text-sm flex items-center gap-2 shadow-[0_20px_50px_rgba(212,175,55,0.3)]"
            style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
          >
            <RefreshCw size={18} />
            إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={handleHome}
            className="h-14 px-8 rounded-2xl font-black text-sm flex items-center gap-2 border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            <Home size={18} />
            الصفحة الرئيسية
          </button>
        </div>

        <div className="pt-8 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Scissors size={14} className="text-[#D4AF37]" />
          <span>Salon Pro • Royal Grooming Experience</span>
        </div>
      </div>
    </div>
  );
}
