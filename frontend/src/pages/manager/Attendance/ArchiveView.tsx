import React from "react";
import { motion } from "framer-motion";
import ArchiveRow from "@/pages/manager/Attendance/ArchiveRow";
import { AnimatePresence } from "framer-motion";

interface ArchiveViewProps {
   
  archiveRecords?: any[];
   
  employees?: any[];
}

const ArchiveView = ({ archiveRecords, employees }: ArchiveViewProps) => {
  const displayRecords = archiveRecords?.slice(0, 100) || [];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-right">
              <thead>
                <tr className="border-b border-border/50 bg-soft/50">
                  <th
                    scope="col"
                    className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-muted sm:px-4 sm:text-[10px]"
                  >
                    الموظف
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-muted sm:px-4 sm:text-[10px]"
                  >
                    نوع العملية
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center text-[9px] font-black uppercase tracking-widest text-muted sm:px-4 sm:text-[10px]"
                  >
                    التاريخ والوقت
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-center text-[9px] font-black uppercase tracking-widest text-muted sm:px-4 sm:text-[10px]"
                  >
                    الإجراء
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayRecords.length > 0 ? (
                   
                  displayRecords.map((rec: any) => (
                    <ArchiveRow key={rec.id} rec={rec} employees={employees} />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-16 text-center text-xs font-bold uppercase text-muted opacity-50 sm:text-sm"
                    >
                      لا توجد سجلات تطابق البحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {displayRecords.length >= 100 && (
          <p className="text-center text-[10px] font-bold text-muted">
            يتم عرض أول 100 سجل فقط. استخدم الفلاتر لتضييق النتائج.
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default ArchiveView;
