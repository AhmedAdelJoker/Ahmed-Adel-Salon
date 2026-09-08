import React from "react";
import { motion } from "framer-motion";
import KPIBento from "@/pages/manager/Attendance/KPIBento";
import EmployeeCard from "@/pages/manager/Attendance/EmployeeCard";
import EmptyState from "@/pages/manager/Attendance/EmptyState";
import DailySummary from "@/pages/manager/Attendance/DailySummary";
import { AnimatePresence } from "framer-motion";

const PulseView = ({ todayRecords, lateEmployees, employees }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        <KPIBento todayRecords={todayRecords} lateEmployees={lateEmployees} />
        {todayRecords?.length > 0 ? (
          <div className="space-y-4">
            {/* Daily Summary Cards - show immediately after "in" registration */}
            <DailySummary todayRecords={todayRecords} employees={employees} />

            {/* Individual Employee Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {todayRecords.map((rec) => (
                <EmployeeCard key={rec.id} rec={rec} employees={employees} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState view="pulse" className="sm:col-span-2" />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PulseView;
