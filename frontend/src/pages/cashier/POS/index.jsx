import React, { useState } from "react";
import { POSProvider, usePOS } from "./POSContext";
import ShiftSidebar from "./components/ShiftSidebar";
import SessionsQueue from "./components/SessionsQueue";
import ItemSelection from "./components/ItemSelection";
import CheckoutBar from "./components/CheckoutBar";
import SuccessOverlay from "./components/SuccessOverlay";
import { Zap, Clock, Grid } from "lucide-react";
import { Badge } from "../../../components/ui/badge";

const POSLayout = () => {
  const { loading, readyAppointments } = usePOS();
  const [activeTab, setActiveTab] = useState("sessions"); // "sessions" or "items"

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Zap className="h-10 w-10 animate-pulse" />
          <p className="text-sm font-bold text-muted">تنشيط محطة الـ POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page-container erp-page--fixed gap-6" dir="rtl">
      {/* Success Overlay */}
      <SuccessOverlay />

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2.5fr_1.8fr] gap-6 flex-1 overflow-visible lg:overflow-hidden">
        
        {/* Right Column: Shift & Quick Stats */}
        <div className="lg:overflow-y-auto custom-scrollbar flex flex-col gap-6 order-2 lg:order-1">
          <ShiftSidebar />
        </div>

        {/* Middle Column: Tabs for Sessions or Manual Selection */}
        <div className="flex flex-col gap-4 overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 rounded-[2rem] p-4 md:p-6 border border-slate-200/60 dark:border-slate-800/60 order-1 lg:order-2">
          <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-white/5 rounded-2xl w-fit border border-slate-200/60 dark:border-slate-800/60 shadow-sm self-center">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === "sessions" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:bg-slate-50"
              }`}
            >
              <Clock size={16} className="text-indigo-600 dark:text-sky-400" />
              الجلسات الجاهزة
              <Badge variant={activeTab === "sessions" ? "secondary" : "outline"} className="mr-1 h-5 min-w-5 flex items-center justify-center rounded-full p-0">
                {readyAppointments.length}
              </Badge>
            </button>
            <button
              onClick={() => setActiveTab("items")}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === "items" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:bg-slate-50"
              }`}
            >
              <Grid size={16} className="text-indigo-600 dark:text-sky-400" />
              إضافة يدوية
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "sessions" ? <SessionsQueue /> : <ItemSelection />}
          </div>
        </div>

        {/* Left Column: Cart & Checkout */}
        <div className="overflow-hidden flex flex-col gap-4">
          <CheckoutBar />
        </div>

      </div>
    </div>
  );
};

export default function POS() {
  return (
    <POSProvider>
      <POSLayout />
    </POSProvider>
  );
}
