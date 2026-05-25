import { useEffect } from 'react';
import React from "react";
import { Activity } from "lucide-react";

export function TableEmptyState({
  icon: Icon = Activity,
  title = "لا توجد بيانات",
  description = "لم يتم العثور على أي سجلات مطابقة للبحث حالياً.",
  className = "",
}) {
  


return (

    <div
      className={`flex flex-col items-center justify-center py-24 text-center opacity-40 ${className}`}
    >
      <div className="w-20 h-20 rounded-full bg-soft flex items-center justify-center mb-6">
        <Icon size={40} className="text-muted" />
      </div>
      <h3 className="text-lg font-black text-main uppercase tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-sm font-bold text-muted max-w-xs mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  );
}


