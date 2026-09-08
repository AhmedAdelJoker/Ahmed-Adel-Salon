import React from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import RegistrationForm from "@/pages/manager/Attendance/RegistrationForm";
import ImportZone from "@/pages/manager/Attendance/ImportZone";
import PenaltyForm from "@/pages/manager/Attendance/PenaltyForm";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";

const AttendanceSidebar = ({
  employees,
  todayRecords,
  regEmployeeId,
  setRegEmployeeId,
  regStatus,
  setRegStatus,
  regTime,
  setRegTime,
  regPreview,
  isRegistering,
  setShowRegConfirm,
  isImporting,
}) => {
  return (
    <aside className="space-y-4">
      <Card className="rounded-2xl border-border/70 bg-card p-4 shadow-soft sm:rounded-2xl sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 sm:h-11 sm:w-11">
            <Zap className="text-primary" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-main sm:text-base">
              إدارة القيود
            </h3>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">
              تسجيل واستيراد وجزاءات
            </p>
          </div>
        </div>

        <Tabs defaultValue="register" className="mt-4 w-full" dir="rtl">
          <TabsList className="h-11 w-full gap-1 rounded-xl bg-soft p-1 sm:h-12">
            <TabsTrigger
              value="register"
              className="h-full flex-1 rounded-lg text-[10px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-white sm:text-xs"
            >
              يدوي
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="h-full flex-1 rounded-lg text-[10px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-white sm:text-xs"
            >
              استيراد
            </TabsTrigger>
            <TabsTrigger
              value="penalty"
              className="h-full flex-1 rounded-lg text-[10px] font-black uppercase data-[state=active]:bg-primary data-[state=active]:text-white sm:text-xs"
            >
              جزاءات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <RegistrationForm
              employees={employees}
              todayRecords={todayRecords}
              regEmployeeId={regEmployeeId}
              setRegEmployeeId={setRegEmployeeId}
              regStatus={regStatus}
              setRegStatus={setRegStatus}
              regTime={regTime}
              setRegTime={setRegTime}
              regPreview={regPreview}
              isRegistering={isRegistering}
              setShowRegConfirm={setShowRegConfirm}
            />
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <ImportZone isImporting={isImporting} />
          </TabsContent>

          <TabsContent value="penalty" className="mt-4">
            <PenaltyForm employees={employees} />
          </TabsContent>
        </Tabs>
      </Card>
    </aside>
  );
};

export default AttendanceSidebar;
