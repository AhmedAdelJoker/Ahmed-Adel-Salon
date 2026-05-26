import React, { useEffect, useState, useCallback } from "react";
import {
  Command,
  Search,
  Users,
  Scissors,
  Package,
  Calendar,
  Wallet,
  Zap,
  TrendingUp,
  Settings,
  History,
  X,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

const QUICK_LINKS = [
  { icon: Zap, label: "نقطة البيع (POS)", to: "/pos", category: "تشغيل" },
  { icon: Calendar, label: "إدارة الحجوزات", to: "/bookings", category: "تشغيل" },
  { icon: Users, label: "سجل العملاء", to: "/customers", category: "بيانات" },
  { icon: Scissors, label: "إعدادات الخدمات", to: "/owner/settings?tab=services", category: "إدارة" },
  { icon: Package, label: "إدارة المخزن", to: "/inventory", category: "بيانات" },
  { icon: TrendingUp, label: "المصروفات", to: "/expenses", category: "مالية" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener('open-command-palette', handleCustomOpen);
    
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  const filteredLinks = QUICK_LINKS.filter(link => 
    link.label.toLowerCase().includes(query.toLowerCase()) ||
    link.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (to) => {
    navigate(to);
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-transparent" showCloseButton={false}>
        <DialogTitle className="sr-only">لوحة الأوامر</DialogTitle>
        <DialogDescription className="sr-only">
          ابحث سريعًا داخل النظام وانتقل إلى الصفحات المتاحة.
        </DialogDescription>
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl flex flex-col overflow-hidden h-[500px]">
          <div className="flex items-center gap-4 px-8 h-20 border-b border-slate-100 dark:border-slate-800/50">
            <Search className="text-indigo-600 dark:text-sky-400 shrink-0" size={22} />
            <input
              autoFocus
              placeholder="ما الذي تبحث عنه اليوم؟"
              className="flex-1 bg-transparent border-none outline-none font-black text-slate-900 dark:text-white placeholder:text-slate-400 text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-400">
               <span>ESC</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {filteredLinks.length > 0 ? (
              <div className="space-y-8 p-4">
                {Array.from(new Set(filteredLinks.map(l => l.category))).map(cat => (
                  <div key={cat} className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mr-4">{cat}</h3>
                    <div className="space-y-1">
                      {filteredLinks.filter(l => l.category === cat).map((link, idx) => (
                        <button
                          key={link.to}
                          onClick={() => handleSelect(link.to)}
                          className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-indigo-600 dark:hover:bg-sky-400 group transition-all duration-300 text-right"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-white/20 group-hover:text-white transition-colors">
                              <link.icon size={20} />
                            </div>
                            <span className="font-black text-slate-700 dark:text-slate-200 group-hover:text-white transition-colors">{link.label}</span>
                          </div>
                          <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-white group-hover:translate-x-[-4px] transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-10">
                <Search size={48} className="mb-4 text-slate-300" />
                <p className="font-black text-slate-500">لا توجد نتائج مطابقة لبحثك</p>
                <p className="text-xs font-bold mt-1 text-slate-400">جرب البحث بكلمات أبسط مثل "كاشير" أو "عملاء"</p>
              </div>
            )}
          </div>

          <div className="h-14 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/> التنقل بالأسهم</div>
                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> دخول سريع</div>
             </div>
             <div>صالون برو التميز</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
