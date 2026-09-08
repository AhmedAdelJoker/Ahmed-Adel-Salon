import React from "react";
import { motion } from "framer-motion";
import MonthlyCard from "@/pages/manager/Attendance/MonthlyCard";
import EmptyState from "@/pages/manager/Attendance/EmptyState";
import { AnimatePresence } from "framer-motion";

const MonthlyView = ({ processedData, employees, onPayrollClick }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {processedData?.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {processedData.map((emp) => (
              <MonthlyCard
                key={emp.id}
                emp={emp}
                employees={employees}
                onPayrollClick={onPayrollClick}
              />
            ))}
          </div>
        ) : (
          <EmptyState view="monthly" className="sm:col-span-2" />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default MonthlyView;
