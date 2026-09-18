import React, { useState } from "react";
import { motion } from "framer-motion";
import { statusConfig, aiConfig } from "@/features/attendance/components/EmployeeCard/constants";
import { EmployeeCardHeader } from "@/features/attendance/components/EmployeeCard/EmployeeCardHeader";
import { EmployeeCardStats } from "@/features/attendance/components/EmployeeCard/EmployeeCardStats";
import { EmployeeCardDetailsDialog } from "@/features/attendance/components/EmployeeCard/EmployeeCardDetailsDialog";

const EmployeeCard = ({ rec, employees }: { rec: any; employees: any[] }) => {
  const [showDetails, setShowDetails] = useState(false);
  const employee = employees?.find((e: any) => String(e.id) === String(rec.id));
  const empName = rec.employee_name || employee?.full_name || "موظف غير معروف";
  const empImage = employee?.profile_image_url;
  const status = rec.status || "out";
  const statusInfo =
    (statusConfig as any)[status] || (statusConfig as any).out;
  const ai = rec.ai || {
    label: "ضعيف",
    color: "text-danger",
    bgColor: "bg-danger/10",
  };
  const aiInfo = (aiConfig as any)[ai.label] || (aiConfig as any).poor;
  const lateMinutes = rec.stats?.lateMinutes || 0;

  return (
    <>
      <motion.div
        layout
        className="group relative rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/30 hover:shadow-premium sm:rounded-2xl sm:p-5"
      >
        <EmployeeCardHeader
          empName={empName}
          empImage={empImage}
          status={status}
          statusInfo={statusInfo}
          aiInfo={aiInfo}
          aiLabel={ai.label}
        />

        <EmployeeCardStats
          rec={rec}
          lateMinutes={lateMinutes}
          onDetailsClick={() => setShowDetails(true)}
        />
      </motion.div>

      <EmployeeCardDetailsDialog
        open={showDetails}
        onOpenChange={setShowDetails}
        rec={rec}
        empName={empName}
        empImage={empImage}
        status={status}
        statusInfo={statusInfo}
      />
    </>
  );
};

export default EmployeeCard;
