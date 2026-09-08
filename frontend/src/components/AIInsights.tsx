import React from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { Sparkles, Target, TrendingUp, Zap } from "lucide-react";

export default function AIInsights({ data, isSidebar = false }) {
  if (!data) return null;

  return (
    <div
      className={cn(
        "space-y-4",
        !isSidebar &&
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 space-y-0",
      )}
    >
      {!isSidebar && (
        <div className="col-span-full flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Sparkles size={20} />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">
            الرؤية الذكية للأداء
          </h3>
        </div>
      )}

      {data.insights.map((insight, idx) => (
        <div
          key={idx}
          className={cn(
            "group p-5 rounded-[28px] border transition-all duration-300 hover:shadow-lg",
            isSidebar
              ? "bg-white/10 border-white/10 hover:bg-white/20"
              : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60 hover:border-indigo-500/30",
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "p-2.5 rounded-xl shrink-0",
                isSidebar
                  ? "bg-white/20 text-white"
                  : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
              )}
            >
              {idx % 3 === 0 ? (
                <Zap size={18} />
              ) : idx % 3 === 1 ? (
                <Target size={18} />
              ) : (
                <Lightbulb size={18} />
              )}
            </div>
            <div>
              <p
                className={cn(
                  "text-[11px] font-black uppercase tracking-widest mb-1 opacity-60",
                  isSidebar ? "text-white" : "text-slate-500",
                )}
              >
                توصية ذكية #{idx + 1}
              </p>
              <p
                className={cn(
                  "text-sm font-bold leading-relaxed",
                  isSidebar
                    ? "text-white"
                    : "text-slate-700 dark:text-slate-200",
                )}
              >
                {insight}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div
        className={cn(
          "p-6 rounded-[32px] flex items-center justify-between overflow-hidden relative",
          isSidebar
            ? "bg-white/20 border border-white/20"
            : "bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-xl shadow-indigo-500/20 col-span-full md:col-span-1",
        )}
      >
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">
            الربح المتوقع
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter">
              {Number(data.predicted).toLocaleString()}
            </span>
            <span className="text-[10px] font-black opacity-80 uppercase">
              ج.م
            </span>
          </div>
        </div>
        <div
          className={cn(
            "p-3 rounded-2xl relative z-10",
            isSidebar ? "bg-white/20" : "bg-white/20 backdrop-blur-md",
          )}
        >
          <TrendingUp size={24} />
        </div>

        {/* Decorative background shapes */}
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -left-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-xl" />
      </div>
    </div>
  );
}
